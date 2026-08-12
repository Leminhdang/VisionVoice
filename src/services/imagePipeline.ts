import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { CameraPhotoOutput, Photo } from 'react-native-vision-camera';

import {
  IMAGE_COMPRESS,
  IMAGE_RESIZE_WIDTH,
} from '../constants/config';

export interface PreparedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
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

/**
 * Chụp ảnh từ photoOutput, lưu ra temp file, rồi thu nhỏ + nén + base64.
 * Vision Camera v5: capturePhoto() trả Photo object, cần saveToTemporaryFileAsync()
 * để lấy file path.
 */
export async function captureAndPrepare(photoOutput: CameraPhotoOutput): Promise<PreparedImage> {
  const photo: Photo = await photoOutput.capturePhoto({ enableShutterSound: false }, {});
  const tempPath = await photo.saveToTemporaryFileAsync();
  const uri = tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`;
  photo.dispose();

  return prepareFromUri(uri);
}

/**
 * Chụp frame nhẹ cho obstacle detection — không nén, chỉ lưu temp file.
 * Trả về URI để TFLite detector resize + inference.
 */
export async function captureFrameForDetection(
  photoOutput: CameraPhotoOutput,
): Promise<{ uri: string; width: number; height: number }> {
  const photo: Photo = await photoOutput.capturePhoto({ enableShutterSound: false }, {});
  const tempPath = await photo.saveToTemporaryFileAsync();
  const uri = tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`;
  const width = photo.width;
  const height = photo.height;
  photo.dispose();

  return { uri, width, height };
}

/** Xoá file khung hình tạm — best-effort, bỏ qua lỗi. */
export async function deleteFrameFile(uri: string): Promise<void> {
  try {
    new File(uri).delete();
  } catch {
    // Best-effort: file có thể đã bị xoá hoặc URI không hợp lệ.
  }
}
