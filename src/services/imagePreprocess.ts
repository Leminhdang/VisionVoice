// Chuẩn bị pixel cho TFLite — decode + resize chạy native qua nitro-image.
//
// Không dùng Photo.getPixelBuffer(): trên Android nó trả dữ liệu ĐÃ NÉN
// (JPEG), không phải raw pixels. Photo.toImage() decode đúng cách và áp
// luôn EXIF orientation, nên frame đưa vào model mới thực sự thẳng đứng.

import type { Image } from 'react-native-nitro-image';

import {
  TFLITE_MODEL_INPUT_SIZE,
  TFLITE_MODEL_PAD_BYTE,
} from '../constants/config';

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
 * Dán RawPixelData (đã thu nhỏ giữ tỉ lệ) vào ô vuông size × size × 3, NEO GÓC
 * TRÊN TRÁI, phần thừa để nguyên màu đệm.
 *
 * Model nhận uint8 với quantization scale = 1/128, zero_point = 127, nên byte
 * thô 0–255 đã đúng — không chuẩn hoá thủ công.
 */
function rawPixelDataToLetterboxedRgb(
  raw: RawPixelData,
  size: number,
): ArrayBuffer {
  const offsets = CHANNEL_OFFSETS[raw.pixelFormat];
  if (offsets === undefined) {
    throw new Error(`Định dạng pixel không hỗ trợ: ${raw.pixelFormat}`);
  }
  if (raw.width > size || raw.height > size) {
    throw new Error(`Kích thước ảnh sai: ${raw.width}×${raw.height}`);
  }

  const src = new Uint8Array(raw.buffer);
  const bytesPerPixel = PACKED_FORMATS.has(raw.pixelFormat) ? 3 : 4;
  const rowStride = src.length / raw.height; // chịu được row padding
  const dst = new Uint8Array(size * size * 3).fill(TFLITE_MODEL_PAD_BYTE);
  const [rOffset, gOffset, bOffset] = offsets;

  for (let y = 0; y < raw.height; y++) {
    let s = y * rowStride;
    let d = y * size * 3;
    for (let x = 0; x < raw.width; x++) {
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
 * Thu nhỏ GIỮ NGUYÊN TỈ LỆ về ô vuông TFLITE_MODEL_INPUT_SIZE rồi trả buffer
 * RGB cho model (letterbox).
 *
 * Bản trước kéo giãn không giữ tỉ lệ, lập luận rằng box chuẩn hoá map ngược
 * lên full-frame vẫn đúng. Đúng về hình học, nhưng bỏ qua chuyện CHÍNH MODEL
 * đang nhìn vật thể méo: khung 640×480 bị bóp ngang 1,33× nên người, xe máy,
 * cột điện đều sai tỉ lệ so với dữ liệu EfficientDet-Lite0 được train. Giữ tỉ
 * lệ là khớp lại đúng tiền xử lý gốc của model.
 *
 * QUY ƯỚC NEO GÓC TRÊN TRÁI — parseDetections() trong tfliteDetector.ts phụ
 * thuộc trực tiếp vào quy ước này để map box ngược về khung gốc. Đổi bên này
 * phải đổi bên kia.
 *
 * Màu đệm TFLITE_MODEL_PAD_BYTE = 128 không phải tuỳ tiện: sau khi dequantize
 * (128 − 127) / 128 ≈ 0, tức đúng bằng vùng đệm 0 mà tiền xử lý EfficientDet
 * gốc tạo ra. Đệm 0 (đen) sẽ thành −1 sau chuẩn hoá, tạo viền giả rất đậm.
 */
export async function imageToModelInput(image: Image): Promise<ArrayBuffer> {
  const size = TFLITE_MODEL_INPUT_SIZE;
  const scale = Math.min(size / image.width, size / image.height);
  const scaledWidth = Math.max(1, Math.round(image.width * scale));
  const scaledHeight = Math.max(1, Math.round(image.height * scale));

  const resized = await image.resizeAsync(scaledWidth, scaledHeight);
  try {
    const raw = await resized.toRawPixelDataAsync();
    return rawPixelDataToLetterboxedRgb(raw, size);
  } finally {
    resized.dispose();
  }
}
