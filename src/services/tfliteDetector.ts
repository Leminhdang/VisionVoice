// TFLite object detection — parse output của EfficientDet-Lite0.
//
// Model dùng bản có op TFLite_Detection_PostProcess dựng sẵn, nên NMS đã chạy
// bên trong model. Module này chỉ lọc ngưỡng và đổi box chuẩn hoá sang pixel.
//
// Thứ tự output đọc từ TFLITE_METADATA của model:
// - outputs[0] 'location'             [1, N, 4] float32 — ymin,xmin,ymax,xmax (0..1)
// - outputs[1] 'category'             [1, N]    float32 — index 0-based vào COCO_90_LABELS
// - outputs[2] 'score'                [1, N]    float32
// - outputs[3] 'number of detections' [1]       float32

import { COCO_90_LABELS } from '../constants/cocoLabels';
import { OBSTACLE_SCORE_MIN } from '../constants/config';
import type { DetectedObject } from './obstacleDetector';

/** Số tensor output mà model có NMS dựng sẵn phải trả về. */
const EXPECTED_OUTPUT_COUNT = 4;

/** Bốn tensor đầu ra đã được nhận dạng theo vai trò, không theo chỉ số. */
interface ResolvedOutputs {
  boxes: Float32Array;
  categories: Float32Array;
  scores: Float32Array;
  count: number;
}

/**
 * Nhận dạng vai trò từng tensor đầu ra bằng HÌNH DẠNG và MIỀN GIÁ TRỊ, thay vì
 * tin vào thứ tự chỉ số.
 *
 * Thứ tự tensor của các bản build EfficientDet/SSD khác nhau không thống nhất,
 * và đọc nhầm thứ tự KHÔNG gây lỗi — nó chỉ lặng lẽ cho ra 0 vật cản, đúng
 * kiểu hỏng nguy hiểm nhất ở tính năng này (im lặng bị hiểu là "đường trống").
 * Không có thiết bị thì không cách nào kiểm chứng thứ tự, nên tự suy ra:
 *
 * - `count`  — mảng duy nhất có độ dài 1
 * - `boxes`  — độ dài gấp 4 lần hai mảng còn lại
 * - `scores` / `categories` — cùng độ dài N; điểm luôn nằm trong [0,1] còn
 *   lớp là số nguyên có thể vượt 1, nên giá trị > 1 là dấu hiệu của lớp, và
 *   giá trị không nguyên là dấu hiệu của điểm.
 *
 * Không phân định được thì giữ nguyên thứ tự ghi trong metadata của model.
 */
function resolveOutputs(outputData: ArrayBuffer[]): ResolvedOutputs | null {
  if (outputData.length < EXPECTED_OUTPUT_COUNT) return null;
  const arrays = outputData.map((buffer) => new Float32Array(buffer));

  const countIndex = arrays.findIndex((a) => a.length === 1);
  const rest = arrays.filter((_, i) => i !== countIndex);
  if (countIndex === -1 || rest.length !== 3) {
    return fallbackOrder(arrays);
  }

  const perDetectionLength = Math.min(...rest.map((a) => a.length));
  const boxes = rest.find((a) => a.length === perDetectionLength * 4);
  const pair = rest.filter((a) => a.length === perDetectionLength);
  if (boxes === undefined || pair.length !== 2) {
    return fallbackOrder(arrays);
  }

  const [first, second] = pair;
  const hasValueAboveOne = (a: Float32Array): boolean => a.some((v) => v > 1);
  const hasFraction = (a: Float32Array): boolean => a.some((v) => !Number.isInteger(v));

  let categories = first;
  let scores = second;
  if (hasValueAboveOne(first)) {
    categories = first;
    scores = second;
  } else if (hasValueAboveOne(second)) {
    categories = second;
    scores = first;
  } else if (hasFraction(first) && !hasFraction(second)) {
    scores = first;
    categories = second;
  } else if (hasFraction(second) && !hasFraction(first)) {
    scores = second;
    categories = first;
  }

  return {
    boxes,
    categories,
    scores,
    count: Math.round(arrays[countIndex][0] ?? 0),
  };
}

/** Thứ tự ghi trong TFLITE_METADATA: location, category, score, count. */
function fallbackOrder(arrays: Float32Array[]): ResolvedOutputs {
  return {
    boxes: arrays[0],
    categories: arrays[1],
    scores: arrays[2],
    count: Math.round(arrays[3][0] ?? 0),
  };
}

/**
 * Điểm tin cậy cao nhất trong khung, TRƯỚC khi lọc ngưỡng.
 *
 * `detections: 0` một mình không phân biệt được ba trường hợp hoàn toàn khác
 * nhau: model không thấy gì, model có thấy nhưng dưới OBSTACLE_SCORE_MIN, hay
 * thứ tự tensor đầu ra bị đọc sai. Điểm thô này tách bạch cả ba.
 */
export function readTopScore(outputData: ArrayBuffer[]): number {
  const resolved = resolveOutputs(outputData);
  if (resolved === null) return 0;
  let top = 0;
  for (const score of resolved.scores) {
    if (score > top) top = score;
  }
  return top;
}

/**
 * Parse output tensors → DetectedObject[].
 *
 * Chỉ đọc `count` slot đầu tiên — các slot còn lại trong tensor là rác đệm.
 * Nhãn ghost (COCO ID không tồn tại) cho `labels` rỗng; obstacleDetector coi
 * detection không nhãn là vật cản với score 1, nên vẫn được tính.
 */
export function parseDetections(
  outputData: ArrayBuffer[],
  frameWidth: number,
  frameHeight: number,
): DetectedObject[] {
  const resolved = resolveOutputs(outputData);
  if (resolved === null) return [];

  const { boxes, categories, scores } = resolved;
  const count = Math.min(resolved.count, scores.length);

  const objects: DetectedObject[] = [];

  for (let i = 0; i < count; i++) {
    const score = scores[i];
    if (score < OBSTACLE_SCORE_MIN) continue;

    const boxOffset = i * 4;
    const ymin = boxes[boxOffset];
    const xmin = boxes[boxOffset + 1];
    const ymax = boxes[boxOffset + 2];
    const xmax = boxes[boxOffset + 3];

    const label = COCO_90_LABELS[Math.round(categories[i])] ?? null;

    objects.push({
      frame: {
        origin: { x: xmin * frameWidth, y: ymin * frameHeight },
        size: {
          x: (xmax - xmin) * frameWidth,
          y: (ymax - ymin) * frameHeight,
        },
      },
      labels: label !== null ? [{ text: label, confidence: score }] : [],
    });
  }

  return objects;
}
