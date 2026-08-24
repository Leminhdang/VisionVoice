// Chuẩn bị pixel cho TFLite — decode + resize chạy native qua nitro-image.
//
// Không dùng Photo.getPixelBuffer(): trên Android nó trả dữ liệu ĐÃ NÉN
// (JPEG), không phải raw pixels. Photo.toImage() decode đúng cách và áp
// luôn EXIF orientation, nên frame đưa vào model mới thực sự thẳng đứng.

import type { Image } from 'react-native-nitro-image';

import { TFLITE_MODEL_INPUT_SIZE } from '../constants/config';

/** nitro-image không re-export RawPixelData ở package root — lấy từ Image. */
type RawPixelData = ReturnType<Image['toRawPixelData']>;

/** Offset của R, G, B trong 1 pixel, theo từng PixelFormat của nitro-image. */
const CHANNEL_OFFSETS: Record<string, readonly [number, number, number]> = {
  RGBA: [0, 1, 2],
  RGBX: [0, 1, 2],
  RGB: [0, 1, 2],
  BGRA: [2, 1, 0],
  BGRX: [2, 1, 0],
  BGR: [2, 1, 0],
  ARGB: [1, 2, 3],
  XRGB: [1, 2, 3],
  ABGR: [3, 2, 1],
  XBGR: [3, 2, 1],
};

/** Các format không có kênh alpha/padding — 3 byte mỗi pixel thay vì 4. */
const PACKED_FORMATS = new Set(['RGB', 'BGR']);

/**
 * Ép RawPixelData về buffer uint8 RGB liên tục, kích thước size × size × 3.
 *
 * Model nhận uint8 với quantization scale = 1/128, zero_point = 127, nên
 * byte thô 0–255 đã đúng — không chuẩn hoá thủ công.
 */
function rawPixelDataToRgb(raw: RawPixelData, size: number): ArrayBuffer {
  const offsets = CHANNEL_OFFSETS[raw.pixelFormat];
  if (offsets === undefined) {
    throw new Error(`Định dạng pixel không hỗ trợ: ${raw.pixelFormat}`);
  }
  if (raw.width !== size || raw.height !== size) {
    throw new Error(`Kích thước ảnh sai: ${raw.width}×${raw.height}`);
  }

  const src = new Uint8Array(raw.buffer);
  const bytesPerPixel = PACKED_FORMATS.has(raw.pixelFormat) ? 3 : 4;
  const rowStride = src.length / size; // chịu được row padding
  const dst = new Uint8Array(size * size * 3);
  const [rOffset, gOffset, bOffset] = offsets;

  let d = 0;
  for (let y = 0; y < size; y++) {
    let s = y * rowStride;
    for (let x = 0; x < size; x++) {
      dst[d] = src[s + rOffset];
      dst[d + 1] = src[s + gOffset];
      dst[d + 2] = src[s + bOffset];
      d += 3;
      s += bytesPerPixel;
    }
  }

  return dst.buffer;
}

/**
 * Resize native về ô vuông TFLITE_MODEL_INPUT_SIZE rồi trả buffer RGB cho model.
 *
 * Resize là kéo giãn (không giữ tỉ lệ) — cố ý: box chuẩn hoá do model trả về
 * map ngược lên full-frame vẫn đúng, nên heuristic diện tích bbox trong
 * obstacleDetector giữ nguyên ý nghĩa.
 */
export async function imageToModelInput(image: Image): Promise<ArrayBuffer> {
  const size = TFLITE_MODEL_INPUT_SIZE;
  const resized = await image.resizeAsync(size, size);
  try {
    const raw = await resized.toRawPixelDataAsync();
    return rawPixelDataToRgb(raw, size);
  } finally {
    resized.dispose();
  }
}
