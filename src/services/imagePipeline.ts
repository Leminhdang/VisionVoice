import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import {
  CAPTURE_QUALITY,
  DETECTION_FRAME_QUALITY,
  IMAGE_COMPRESS,
  IMAGE_RESIZE_WIDTH,
  TARGET_PICTURE_SIZE,
} from '../constants/config';

export interface PreparedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

/**
 * Chọn kích thước ảnh chụp có cạnh dài gần TARGET_PICTURE_SIZE nhất
 * trong các kích thước camera hỗ trợ (định dạng 'WxH').
 */
export async function selectPictureSize(camera: CameraView): Promise<string | undefined> {
  try {
    const sizes = await camera.getAvailablePictureSizesAsync();
    let bestSize: string | undefined = sizes[0];
    let minDiff = Infinity;

    for (const size of sizes) {
      const parts = size.split('x');
      if (parts.length !== 2) continue;

      const width = parseInt(parts[0], 10);
      const height = parseInt(parts[1], 10);
      if (Number.isNaN(width) || Number.isNaN(height)) continue;

      const maxDimension = Math.max(width, height);
      const diff = Math.abs(maxDimension - TARGET_PICTURE_SIZE);
      if (diff < minDiff) {
        minDiff = diff;
        bestSize = size;
      }
    }

    return bestSize;
  } catch (err) {
    console.warn('Lỗi khi lấy kích thước ảnh:', err);
    return undefined;
  }
}

/**
 * Thu nhỏ và nén ảnh từ URI (ảnh chụp hoặc ảnh thư viện),
 * trả về ảnh JPEG kèm dữ liệu base64 sẵn sàng gửi lên API.
 */
export async function prepareFromUri(uri: string): Promise<PreparedImage> {
  const manipulated = await manipulateAsync(uri, [{ resize: { width: IMAGE_RESIZE_WIDTH } }], {
    compress: IMAGE_COMPRESS,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!manipulated.base64) {
    throw new Error('Không tạo được dữ liệu ảnh base64.');
  }

  return {
    uri: manipulated.uri,
    base64: manipulated.base64,
    width: manipulated.width,
    height: manipulated.height,
  };
}

/** Chụp ảnh từ camera rồi thu nhỏ, nén và mã hoá base64. */
export async function captureAndPrepare(camera: CameraView): Promise<PreparedImage> {
  const photo = await camera.takePictureAsync({ quality: CAPTURE_QUALITY });

  if (!photo?.uri) {
    throw new Error('Không chụp được ảnh.');
  }

  return prepareFromUri(photo.uri);
}

/** Chụp nhanh một khung hình chất lượng thấp, không âm thanh, cho nhận diện. */
export async function captureFrameForDetection(
  camera: CameraView,
): Promise<{ uri: string; width: number; height: number }> {
  const photo = await camera.takePictureAsync({
    quality: DETECTION_FRAME_QUALITY,
    skipProcessing: true,
    shutterSound: false,
  });

  if (!photo?.uri) {
    throw new Error('Không chụp được khung hình.');
  }

  return { uri: photo.uri, width: photo.width, height: photo.height };
}

/** Xoá file khung hình tạm — best-effort, bỏ qua lỗi. */
export async function deleteFrameFile(uri: string): Promise<void> {
  try {
    new File(uri).delete();
  } catch {
    // Best-effort: file có thể đã bị xoá hoặc URI không hợp lệ.
  }
}
