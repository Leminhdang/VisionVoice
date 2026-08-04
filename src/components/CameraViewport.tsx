import { CameraView } from 'expo-camera';
import { forwardRef, useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { selectPictureSize } from '../services/imagePipeline';

export interface CameraViewportProps {
  onReady?: () => void;
  /** Tắt animation chớp trắng khi chụp — dùng cho obstacle scan loop. */
  animateShutter?: boolean;
}

export const CameraViewport = forwardRef<CameraView, CameraViewportProps>(
  function CameraViewport({ onReady, animateShutter }, ref) {
    const innerCameraRef = useRef<CameraView | null>(null);
    const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

    const assignRefs = useCallback(
      (camera: CameraView | null) => {
        innerCameraRef.current = camera;
        if (typeof ref === 'function') {
          ref(camera);
        } else if (ref) {
          ref.current = camera;
        }
      },
      [ref],
    );

    const handleCameraReady = useCallback(() => {
      const camera = innerCameraRef.current;
      if (!camera) {
        onReady?.();
        return;
      }
      selectPictureSize(camera)
        .then((size) => {
          if (size) {
            setPictureSize(size);
          }
          onReady?.();
        })
        .catch((err: unknown) => {
          console.warn('Lỗi khi chọn kích thước ảnh:', err);
          onReady?.();
        });
    }, [onReady]);

    return (
      <CameraView
        ref={assignRefs}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash="off"
        animateShutter={animateShutter ?? true}
        pictureSize={pictureSize}
        onCameraReady={handleCameraReady}
      />
    );
  },
);
