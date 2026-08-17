import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useCameraDevice, usePhotoOutput } from 'react-native-vision-camera';
import type { CameraRef, CameraPhotoOutput } from 'react-native-vision-camera';

export interface CameraViewportProps {
  onReady?: () => void;
  /** Tắt camera (khi screen không focus). Mặc định true. */
  isActive?: boolean;
  /** Cho phép truy cập photoOutput từ bên ngoài component. */
  onPhotoOutputReady?: (photoOutput: CameraPhotoOutput) => void;
  /**
   * Độ phân giải ảnh chụp. Phải là một tham chiếu ỔN ĐỊNH (hằng số ở
   * constants/config.ts) — usePhotoOutput memo theo identity của object này,
   * truyền object literal sẽ tạo lại photoOutput mỗi lần render.
   */
  photoResolution: { width: number; height: number };
}

/**
 * Camera wrapper dùng react-native-vision-camera v5.
 *
 * - HomeCameraScreen: dùng `ref.capturePhoto()` qua photoOutput
 * - ObstacleModeScreen: dùng cameraRef + photoOutput để chụp frame cho detection
 *
 * Photo output luôn bật vì cả hai screen đều cần chụp ảnh.
 */
export const CameraViewport = forwardRef<CameraRef, CameraViewportProps>(
  function CameraViewport(
    { onReady, isActive = true, onPhotoOutputReady, photoResolution },
    ref,
  ) {
    const innerCameraRef = useRef<CameraRef | null>(null);
    const device = useCameraDevice('back');
    const photoOutput = usePhotoOutput({
      targetResolution: photoResolution,
      qualityPrioritization: 'speed',
    });
    const hasReportedRef = useRef(false);

    // Tắt camera (rời màn hình) huỷ session hiện tại; lần bật lại sẽ có
    // photoOutput mới. Không mở cờ ra thì màn hình giữ tham chiếu output đã
    // chết và mọi lệnh chụp sau đó đều hỏng.
    useEffect(() => {
      if (!isActive) {
        hasReportedRef.current = false;
      }
    }, [isActive]);

    const assignRefs = useCallback(
      (camera: CameraRef | null) => {
        innerCameraRef.current = camera;
        if (typeof ref === 'function') {
          ref(camera);
        } else if (ref) {
          ref.current = camera;
        }
      },
      [ref],
    );

    const handleStarted = useCallback(() => {
      if (!hasReportedRef.current) {
        hasReportedRef.current = true;
        onReady?.();
        onPhotoOutputReady?.(photoOutput);
      }
    }, [onReady, onPhotoOutputReady, photoOutput]);

    if (device == null) return null;

    return (
      <Camera
        ref={assignRefs}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        outputs={[photoOutput]}
        onStarted={handleStarted}
      />
    );
  },
);
