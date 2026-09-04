import { OBSTACLE_SCORE_MIN } from '../../constants/config';
import { parseDetections, readTopScore } from '../tfliteDetector';

const FRAME_WIDTH = 400;
const FRAME_HEIGHT = 200;

/** Index của một ghost class trong COCO_90_LABELS (COCO ID 12 không tồn tại). */
const GHOST_CLASS_INDEX = 11;
/** Index của 'person'. */
const PERSON_CLASS_INDEX = 0;

/**
 * Score biểu diễn chính xác được trong float32, nên đi qua Float32Array
 * không sai số — giữ assertion sạch.
 */
const HIGH_SCORE = 0.875;

interface Detection {
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0..1)
  category: number;
  score: number;
}

/**
 * Dựng 4 output tensor giống model EfficientDet-Lite0 (bản có NMS).
 * `slots` là độ dài tensor — cố tình lớn hơn số detection để mô phỏng
 * phần đệm rác mà model để lại sau `count`.
 */
function makeOutputs(
  detections: Detection[],
  count = detections.length,
  slots = Math.max(detections.length, 4),
): ArrayBuffer[] {
  const boxes = new Float32Array(slots * 4);
  const categories = new Float32Array(slots);
  const scores = new Float32Array(slots);

  detections.forEach((detection, i) => {
    boxes.set(detection.box, i * 4);
    categories[i] = detection.category;
    scores[i] = detection.score;
  });

  return [
    boxes.buffer,
    categories.buffer,
    scores.buffer,
    new Float32Array([count]).buffer,
  ];
}

describe('parseDetections', () => {
  test('converts a normalised box to pixel coordinates', () => {
    // Arrange: nửa trái, nửa trên của frame
    const outputs = makeOutputs([
      { box: [0, 0, 0.5, 0.5], category: PERSON_CLASS_INDEX, score: HIGH_SCORE },
    ]);

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result).toEqual([
      {
        frame: { origin: { x: 0, y: 0 }, size: { x: 200, y: 100 } },
        labels: [{ text: 'person', confidence: HIGH_SCORE }],
      },
    ]);
  });

  test('maps a non-zero box origin to the correct offset', () => {
    // Arrange: x 0.25..0.75, y 0.5..1.0
    const outputs = makeOutputs([
      { box: [0.5, 0.25, 1, 0.75], category: PERSON_CLASS_INDEX, score: 0.8 },
    ]);

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result[0].frame).toEqual({
      origin: { x: 100, y: 100 },
      size: { x: 200, y: 100 },
    });
  });

  test('drops detections scoring below OBSTACLE_SCORE_MIN', () => {
    // Arrange
    const outputs = makeOutputs([
      {
        box: [0, 0, 1, 1],
        category: PERSON_CLASS_INDEX,
        score: OBSTACLE_SCORE_MIN - 0.01,
      },
    ]);

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result).toEqual([]);
  });

  test('keeps a detection scoring just above OBSTACLE_SCORE_MIN', () => {
    // Arrange: score của model là float32, nên so sánh ở sát ngưỡng phải
    // chừa biên float32 thay vì lấy đúng hằng số float64.
    const outputs = makeOutputs([
      {
        box: [0, 0, 1, 1],
        category: PERSON_CLASS_INDEX,
        score: OBSTACLE_SCORE_MIN + 0.01,
      },
    ]);

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result).toHaveLength(1);
  });

  test('ignores padding slots past the reported detection count', () => {
    // Arrange: 2 detection hợp lệ nhưng model chỉ báo count = 1
    const outputs = makeOutputs(
      [
        { box: [0, 0, 0.5, 0.5], category: PERSON_CLASS_INDEX, score: 0.9 },
        { box: [0, 0, 1, 1], category: PERSON_CLASS_INDEX, score: 0.95 },
      ],
      1,
    );

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].frame.size).toEqual({ x: 200, y: 100 });
  });

  test('returns an empty labels array for a ghost class', () => {
    // Arrange
    const outputs = makeOutputs([
      { box: [0, 0, 1, 1], category: GHOST_CLASS_INDEX, score: 0.9 },
    ]);

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert: vẫn là vật cản, chỉ không có nhãn
    expect(result).toHaveLength(1);
    expect(result[0].labels).toEqual([]);
  });

  test('returns an empty array when the model returns too few tensors', () => {
    // Arrange
    const outputs = makeOutputs([
      { box: [0, 0, 1, 1], category: PERSON_CLASS_INDEX, score: 0.9 },
    ]).slice(0, 3);

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result).toEqual([]);
  });

  test('returns an empty array when the reported count is zero', () => {
    // Arrange
    const outputs = makeOutputs(
      [{ box: [0, 0, 1, 1], category: PERSON_CLASS_INDEX, score: 0.9 }],
      0,
    );

    // Act
    const result = parseDetections(outputs, FRAME_WIDTH, FRAME_HEIGHT);

    // Assert
    expect(result).toEqual([]);
  });
});

describe('nhận dạng vai trò tensor đầu ra', () => {
  /** Đảo thứ tự thành count, score, box, category — một hoán vị khác hẳn. */
  function shuffleOutputs(outputs: ArrayBuffer[]): ArrayBuffer[] {
    const [boxes, categories, scores, count] = outputs;
    return [count, scores, boxes, categories];
  }

  test('đọc đúng dù thứ tự tensor bị hoán vị', () => {
    // Arrange — cùng một khung, chỉ khác thứ tự tensor.
    const detection = {
      box: [0, 0, 0.5, 0.5] as [number, number, number, number],
      category: PERSON_CLASS_INDEX,
      score: HIGH_SCORE,
    };
    const inOrder = parseDetections(makeOutputs([detection]), FRAME_WIDTH, FRAME_HEIGHT);

    // Act
    const shuffled = parseDetections(
      shuffleOutputs(makeOutputs([detection])),
      FRAME_WIDTH,
      FRAME_HEIGHT,
    );

    // Assert — đọc nhầm thứ tự không ném lỗi, nó chỉ lặng lẽ ra 0 vật cản.
    expect(shuffled).toEqual(inOrder);
    expect(shuffled).toHaveLength(1);
  });

  test('readTopScore lấy đúng tensor điểm dù thứ tự bị hoán vị', () => {
    // Arrange
    const outputs = makeOutputs([
      { box: [0, 0, 0.5, 0.5], category: PERSON_CLASS_INDEX, score: HIGH_SCORE },
    ]);

    // Act + Assert
    expect(readTopScore(outputs)).toBeCloseTo(HIGH_SCORE);
    expect(readTopScore(shuffleOutputs(outputs))).toBeCloseTo(HIGH_SCORE);
  });

  test('phân biệt được lớp và điểm khi chỉ số lớp lớn hơn 1', () => {
    // Arrange — ghost class index 11 > 1, còn điểm luôn nằm trong [0,1].
    const outputs = makeOutputs([
      { box: [0.1, 0.1, 0.9, 0.9], category: GHOST_CLASS_INDEX, score: HIGH_SCORE },
    ]);

    // Act
    const result = parseDetections(shuffleOutputs(outputs), FRAME_WIDTH, FRAME_HEIGHT);

    // Assert — nhãn ghost cho labels rỗng, nhưng vật cản vẫn được tính.
    expect(result).toHaveLength(1);
    expect(result[0].labels).toEqual([]);
  });
});
