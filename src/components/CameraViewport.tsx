import { forwardRef, useCallback, useEffect, useMemo, useRef } from "react";
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
  /**
   * Cấp photoOutput cho màn hình. Được gọi lại MỖI lần session khởi động,
   * không chỉ lần đầu — xem ghi chú ở handleStarted.
   */
  onPhotoOutputReady?: (photoOutput: CameraPhotoOutput) => void;
  /** Session dừng hoặc lỗi: tham chiếu photoOutput hiện tại đã chết. */
  onPhotoOutputLost?: () => void;
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
    {
      onReady,
      isActive = true,
      onPhotoOutputReady,
      onPhotoOutputLost,
      targetResolution,
    },
    ref,
  ) {
    const innerCameraRef = useRef<CameraRef | null>(null);
    const device = useCameraDevice("back");
    const photoOutput = usePhotoOutput({
      targetResolution,
      qualityPrioritization: "speed",
    });
    const hasReportedReadyRef = useRef(false);

    // `outputs` là dependency của useCamera nên phải giữ tham chiếu ổn định;
    // mảng literal inline làm session bị cấu hình lại mỗi lần render.
    const outputs = useMemo(() => [photoOutput], [photoOutput]);

    useEffect(() => {
      if (!isActive) {
        hasReportedReadyRef.current = false;
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
      // onReady chỉ một lần mỗi lần bật, nhưng photoOutput thì cấp lại MỖI
      // lần session khởi động: rời màn hình rồi quay lại là một session mới,
      // tham chiếu cũ đã chết và mọi lệnh chụp lên nó đều hỏng.
      if (!hasReportedReadyRef.current) {
        hasReportedReadyRef.current = true;
        onReady?.();
      }
      onPhotoOutputReady?.(photoOutput);
    }, [onReady, onPhotoOutputReady, photoOutput]);

    const handleStopped = useCallback(() => {
      onPhotoOutputLost?.();
    }, [onPhotoOutputLost]);

    // Không có các handler này thì camera hỏng hoàn toàn im lặng: màn hình
    // đen thui mà không một dòng log nào cho biết vì sao.
    const handleError = useCallback(
      (error: Error) => {
        console.warn("Lỗi camera:", error.message);
        onPhotoOutputLost?.();
      },
      [onPhotoOutputLost],
    );

    const handleInterruptionStarted = useCallback((reason: unknown) => {
      console.warn("Camera bị gián đoạn:", String(reason));
    }, []);

    if (device == null) return null;

    return (
      <Camera
        ref={assignRefs}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        outputs={outputs}
        onStarted={handleStarted}
        onStopped={handleStopped}
        onError={handleError}
        onInterruptionStarted={handleInterruptionStarted}
      />
    );
  },
);
