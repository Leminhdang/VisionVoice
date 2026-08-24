import { COCO_90_LABELS, COCO_LABEL_VI } from '../cocoLabels';

/**
 * COCO_90_LABELS phải khớp từng chỉ số với bảng nhãn nhúng trong model.
 * Kiểm chứng lại bằng:
 *   unzip -p assets/models/efficientdet_lite0_detection.tflite labelmap.txt | cat -n
 *
 * Rút bảng xuống 80 lớp liền mạch (bỏ các ô ghost) là lỗi đã từng xảy ra:
 * mọi lớp từ chỉ số 11 trở lên lệch đi, `chair` bị đọc thành `toilet`.
 */
describe('COCO_90_LABELS khớp bảng nhãn của model', () => {
  test('có đúng 90 phần tử, gồm 10 ô ghost', () => {
    // Assert
    expect(COCO_90_LABELS).toHaveLength(90);
    expect(COCO_90_LABELS.filter((label) => label === null)).toHaveLength(10);
  });

  test('các chỉ số mốc nằm đúng vị trí', () => {
    // Arrange — lấy từ labelmap.txt của model, 0-based.
    const expected: ReadonlyArray<[number, string | null]> = [
      [0, 'person'],
      [10, 'fire hydrant'],
      [11, null], // ghost đầu tiên — chỗ bảng 80 lớp bắt đầu lệch
      [12, 'stop sign'],
      [61, 'chair'],
      [62, 'couch'],
      [66, 'dining table'],
      [89, 'toothbrush'],
    ];

    // Assert
    for (const [index, label] of expected) {
      expect(COCO_90_LABELS[index]).toBe(label);
    }
  });

  test('mọi nhãn không phải ghost đều có bản dịch tiếng Việt', () => {
    // Act
    const missing = COCO_90_LABELS.filter(
      (label): label is string => label !== null && COCO_LABEL_VI[label] === undefined,
    );

    // Assert — thiếu bản dịch nghĩa là vật cản được phát hiện nhưng không đọc được tên.
    expect(missing).toEqual([]);
  });
});
