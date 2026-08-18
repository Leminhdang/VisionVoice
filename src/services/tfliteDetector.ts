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
  if (outputData.length < EXPECTED_OUTPUT_COUNT) return [];

  const boxes = new Float32Array(outputData[0]);
  const categories = new Float32Array(outputData[1]);
  const scores = new Float32Array(outputData[2]);
  const reported = new Float32Array(outputData[3])[0] ?? 0;
  const count = Math.min(Math.round(reported), scores.length);

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
