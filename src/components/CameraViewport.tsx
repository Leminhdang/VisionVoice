import { forwardRef, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useCameraDevice, usePhotoOutput } from 'react-native-vision-camera';
import type { CameraRef, CameraPhotoOutput } from 'react-native-vision-camera';

export interface CameraViewportProps {
  onReady?: () => void;
  /** Tắt camera (khi screen không focus). Mặc định true. */
  isActive?: boolean;
  /** Cho phép truy cập photoOutput từ bên ngoài component. */
  onPhotoOutputReady?: (photoOutput: CameraPhotoOutput) => void;
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
  function CameraViewport({ onReady, isActive = true, onPhotoOutputReady }, ref) {
    const innerCameraRef = useRef<CameraRef | null>(null);
    const device = useCameraDevice('back');
    const photoOutput = usePhotoOutput({
      qualityPrioritization: 'speed',
    });
    const hasReportedRef = useRef(false);

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
