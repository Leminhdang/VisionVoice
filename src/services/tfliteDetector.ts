// TFLite object detection — wraps react-native-fast-tflite.
// Loads EfficientDet-Lite0 model once at app start. Obstacle scanner captures
// frames via photoOutput, gets raw pixel data from Photo.getPixelBuffer(),
// converts BGRA→RGB + resizes to 320×320, then runs inference.

import { Platform } from 'react-native';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TfliteModel } from 'react-native-fast-tflite';
import type { Photo } from 'react-native-vision-camera';

import { COCO_LABELS } from '../constants/cocoLabels';
import { TFLITE_MODEL_INPUT_SIZE } from '../constants/config';
import type { DetectedObject } from './obstacleDetector';

let model: TfliteModel | null = null;
let isLoading = false;

/**
 * Load model từ bundled asset. Gọi một lần trong App.tsx useEffect.
 * Idempotent — gọi nhiều lần chỉ load một lần.
 */
export async function initTfliteModel(): Promise<void> {
  if (model !== null || isLoading) return;
  isLoading = true;
  try {
    const delegates = Platform.OS === 'ios' ? (['core-ml'] as const) : ([] as const);
    model = await loadTensorflowModel(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../assets/models/efficientdet_lite0.tflite'),
      [...delegates],
    );
    console.log('TFLite model loaded successfully');
  } catch (err) {
    console.warn('Lỗi khi tải TFLite model:', err);
  } finally {
    isLoading = false;
  }
}

/** Trả model instance. null nếu chưa load xong. */
export function getTfliteModel(): TfliteModel | null {
  return model;
}

/**
 * Convert BGRA pixel buffer sang RGB 320×320 ArrayBuffer cho TFLite input.
 *
 * Photo.getPixelBuffer() trả về BGRA trên iOS, RGBA trên Android.
 * Hàm này xử lý cả hai trường hợp + resize bằng nearest-neighbor.
 */
function preprocessPixelBuffer(
  pixelData: ArrayBuffer,
  srcWidth: number,
  srcHeight: number,
): ArrayBuffer {
  const size = TFLITE_MODEL_INPUT_SIZE;
  const src = new Uint8Array(pixelData);
  const dst = new Uint8Array(size * size * 3); // RGB

  const isIOS = Platform.OS === 'ios';
  // iOS: BGRA (B=0, G=1, R=2, A=3)
  // Android: RGBA (R=0, G=1, B=2, A=3)
  const rOff = isIOS ? 2 : 0;
  const gOff = 1;
  const bOff = isIOS ? 0 : 2;

  const srcBytesPerPixel = 4; // BGRA/RGBA = 4 bytes

  for (let y = 0; y < size; y++) {
    const srcY = Math.floor((y * srcHeight) / size);
    for (let x = 0; x < size; x++) {
      const srcX = Math.floor((x * srcWidth) / size);
      const srcIdx = (srcY * srcWidth + srcX) * srcBytesPerPixel;
      const dstIdx = (y * size + x) * 3;

      dst[dstIdx] = src[srcIdx + rOff];
      dst[dstIdx + 1] = src[srcIdx + gOff];
      dst[dstIdx + 2] = src[srcIdx + bOff];
    }
  }

  return dst.buffer;
}

/**
 * Parse EfficientDet-Lite0 output tensors → DetectedObject[].
 *
 * Output format (4 tensors):
 * - [0] locations: [1, N, 4] float32 — normalized [top, left, bottom, right]
 * - [1] classes: [1, N] float32 — class indices (0-based)
 * - [2] scores: [1, N] float32 — confidence scores
 * - [3] num_detections: [1] float32 — number of valid detections
 */
function parseDetections(
  outputData: ArrayBuffer[],
  frameWidth: number,
  frameHeight: number,
): DetectedObject[] {
  if (outputData.length < 4) return [];

  const locations = new Float32Array(outputData[0]);
  const classes = new Float32Array(outputData[1]);
  const scores = new Float32Array(outputData[2]);
  const numDetections = new Float32Array(outputData[3]);

  const count = Math.min(Math.round(numDetections[0]), classes.length);
  const objects: DetectedObject[] = [];

  for (let i = 0; i < count; i++) {
    const score = scores[i];
    if (score < 0.1) continue;

    const top = locations[i * 4];
    const left = locations[i * 4 + 1];
    const bottom = locations[i * 4 + 2];
    const right = locations[i * 4 + 3];

    const x = left * frameWidth;
    const y = top * frameHeight;
    const w = (right - left) * frameWidth;
    const h = (bottom - top) * frameHeight;

    const classIndex = Math.round(classes[i]);
    const labelText = COCO_LABELS[classIndex] ?? '';

    objects.push({
      frame: { origin: { x, y }, size: { x: w, y: h } },
      labels: labelText ? [{ text: labelText, confidence: score }] : [],
    });
  }

  return objects;
}

/**
 * Chạy object detection trên Photo object từ VisionCamera.
 *
 * Sử dụng Photo.getPixelBuffer() để lấy raw pixel data (BGRA/RGBA),
 * convert sang RGB 320×320, rồi chạy inference.
 *
 * Caller phải dispose Photo SAU khi hàm này return.
 */
export function detectFromPhoto(photo: Photo): DetectedObject[] {
  if (model === null) return [];
  if (!photo.hasPixelBuffer) return [];

  try {
    const pixelBuffer = photo.getPixelBuffer();
    const inputBuffer = preprocessPixelBuffer(pixelBuffer, photo.width, photo.height);
    const outputs = model.runSync([inputBuffer]);
    return parseDetections(outputs, photo.width, photo.height);
  } catch (err) {
    console.warn('Lỗi khi chạy TFLite detection:', err);
    return [];
  }
}

/** Model input dimension constant. */
export const MODEL_INPUT_SIZE = TFLITE_MODEL_INPUT_SIZE;
