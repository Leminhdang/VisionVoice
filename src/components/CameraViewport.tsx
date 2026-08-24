import { forwardRef, useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import {
  Camera,
  useCameraDevice,
  usePhotoOutput,
} from "react-native-vision-camera";
import type {
  CameraRef,
  CameraPhotoOutput,
  Size,
} from "react-native-vision-camera";

export interface CameraViewportProps {
  onReady?: () => void;
  /** Tắt camera (khi screen không focus). Mặc định true. */
  isActive?: boolean;
  /** Cho phép truy cập photoOutput từ bên ngoài component. */
  onPhotoOutputReady?: (photoOutput: CameraPhotoOutput) => void;
  /**
   * Ghi đè độ phân giải chụp. Bỏ trống = mặc định của VisionCamera (UHD 4:3).
   *
   * Phải truyền hằng số cấp module — `usePhotoOutput` so sánh giá trị này
   * theo tham chiếu, object literal inline sẽ gây tạo lại output mỗi render.
   */
  targetResolution?: Size;
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
    { onReady, isActive = true, onPhotoOutputReady, targetResolution },
    ref,
  ) {
    const innerCameraRef = useRef<CameraRef | null>(null);
    const device = useCameraDevice("back");
    const photoOutput = usePhotoOutput({
      targetResolution,
      qualityPrioritization: "speed",
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
        if (typeof ref === "function") {
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
