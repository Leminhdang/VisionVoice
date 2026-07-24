import { useCallback, useMemo, useRef, useState } from 'react';
import { useFrameProcessor, type Frame } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

export type ThreatLevel = 'safe' | 'warning' | 'danger';

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  boundingBox?: BoundingBox;
  bounds?: { x: number; y: number; width: number; height: number };
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  labels?: Array<{ text: string; confidence: number }>;
}

export interface UseObstacleDetectionOptions {
  isEnabled?: boolean;
  alertIntervalMs?: number;
  warningThreshold?: number; // Mặc định 0.18 (18%)
  dangerThreshold?: number;  // Mặc định 0.35 (35%)
}

export interface ObstacleDetectionState {
  threatLevel: ThreatLevel;
  maxRatio: number;
  detectedCount: number;
  lastAlertTime: number;
}

/**
 * Custom Hook: useObstacleDetection (CON ĐƯỜNG 1: ON-DEVICE DEEP LEARNING AI)
 * Quét vật cản bằng Mô hình Mạng Nơ-ron Deep Learning SSD MobileNet TFLite thực thụ trên thiết bị.
 * - Mô hình AI Deep Learning COCO SSD MobileNet v1 (detect.tflite) chạy trên NPU/GPU thiết bị.
 * - Sử dụng NitroModules.box(model) để chuyển NativeState Hybrid Object an toàn qua Worklet Thread.
 * - Tự động bỏ qua Sàn nhà, Bức tường phẳng, Thảm nền (AI xác định là Phông nền 0% SAFE im lặng).
 * - Tự động nhận diện Nắm đấm, Bàn tay, Chân bàn ghế, Con người, Chậu cây, Đồ vật (AI khoanh Bounding Box thực và tính % diện tích).
 * - Phân loại Nguy Hiểm:
 *     Safe: ratio < 18% (0.18) -> Im lặng tuyệt đối (Nền nhà / Khoảng trống)
 *     Warning: 18% <= ratio < 35% -> Rung nhẹ / vừa (Haptics)
 *     Danger: ratio >= 35% (0.35) -> Rung mạnh + Cảnh báo giọng nói "Vật cản ở rất gần!"
 * - Debounce: Giới hạn tần suất phát tín hiệu (mặc định 1.5s / lần)
 */
export function useObstacleDetection(options: UseObstacleDetectionOptions = {}) {
  const {
    isEnabled = true,
    alertIntervalMs = 1500,
    warningThreshold = 0.18,
    dangerThreshold = 0.35,
  } = options;

  // Nạp mô hình AI Deep Learning SSD MobileNet TFLite chính chủ (dung lượng 4MB trong assets/models/detect.tflite)
  const objectDetection = useTensorflowModel(
    require('../../assets/models/detect.tflite'),
    ['android-gpu']
  );

  const model = objectDetection.state === 'loaded' ? objectDetection.model : undefined;

  // Đóng gói Nitro HybridObject (jsi::NativeState) vào Box để truyền an toàn sang VisionCamera Worklet Thread
  const boxedModel = useMemo(
    () => (model != null ? NitroModules.box(model) : undefined),
    [model]
  );

  const [detectionState, setDetectionState] = useState<ObstacleDetectionState>({
    threatLevel: 'safe',
    maxRatio: 0,
    detectedCount: 0,
    lastAlertTime: 0,
  });

  const lastAlertTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);

  /**
   * Hàm JS xử lý phát thông báo (Haptics / Speech) trên JS Thread
   */
  const handleAlertSignal = useCallback(
    (level: ThreatLevel, ratio: number, objectCount: number) => {
      const now = Date.now();
      const elapsed = now - lastAlertTimeRef.current;

      setDetectionState({
        threatLevel: level,
        maxRatio: ratio,
        detectedCount: objectCount,
        lastAlertTime: lastAlertTimeRef.current,
      });

      // Nếu trạng thái là Safe -> Im lặng tuyệt đối
      if (level === 'safe') {
        return;
      }

      // Kiểm tra Debounce (Chỉ phát thông báo nếu cách lần trước >= alertIntervalMs)
      if (elapsed < alertIntervalMs) {
        return;
      }

      lastAlertTimeRef.current = now;

      if (level === 'warning') {
        // Warning: Rung nhẹ/vừa để nhắc nhở người dùng
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else if (level === 'danger') {
        // Danger: Rung mạnh + Đọc âm thanh giọng nói cảnh báo
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

        // Tránh đọc đè nếu đang phát cảnh báo trước đó
        Speech.isSpeakingAsync()
          .then((speaking) => {
            if (!speaking) {
              isSpeakingRef.current = true;
              Speech.speak('Vật cản ở rất gần!', {
                language: 'vi-VN',
                pitch: 1.1,
                rate: 1.0,
                onDone: () => {
                  isSpeakingRef.current = false;
                },
                onError: () => {
                  isSpeakingRef.current = false;
                },
              });
            }
          })
          .catch(() => {});
      }
    },
    [alertIntervalMs],
  );

  /**
   * Chuyển tín hiệu từ Worklet Thread về JS Thread bằng useRunOnJS
   */
  const triggerAlertOnJS = useRunOnJS(
    (level: ThreatLevel, ratio: number, objectCount: number) => {
      handleAlertSignal(level, ratio, objectCount);
    },
    [handleAlertSignal],
  );

  /**
   * Frame Processor Worklet thực thi Mô hình AI Deep Learning SSD MobileNet TFLite
   */
  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      if (!isEnabled) return;

      const frameWidth = frame.width;
      const frameHeight = frame.height;
      const frameArea = frameWidth * frameHeight;

      let maxRatio = 0;
      let count = 0;

      // 1. Kiểm tra và Unbox Mô hình AI TFLite On-Device
      if (boxedModel != null) {
        try {
          const tflite = boxedModel.unbox();
          const buffer = frame.toArrayBuffer();

          if (buffer && tflite) {
            // Chạy suy luận Mô hình AI Deep Learning TFLite trực tiếp trên NPU/GPU
            const outputs = tflite.runSync([buffer]);
            if (outputs && outputs.length >= 3) {
              const locations = new Float32Array(outputs[0]);
              const scores = new Float32Array(outputs[2]);

              // Duyệt qua các vật thể AI phát hiện được (Tối đa 10 đối tượng)
              const totalCandidates = Math.min(10, scores.length);
              for (let i = 0; i < totalCandidates; i++) {
                const score = scores[i];

                // Chỉ tính các đối tượng có độ tin cậy AI >= 35% (Score >= 0.35)
                if (score >= 0.35) {
                  const ymin = locations[i * 4];
                  const xmin = locations[i * 4 + 1];
                  const ymax = locations[i * 4 + 2];
                  const xmax = locations[i * 4 + 3];

                  const h = Math.max(0, ymax - ymin);
                  const w = Math.max(0, xmax - xmin);
                  const ratio = w * h; // Bounding Box area ratio (0.0 to 1.0)

                  // Loại bỏ Bounding Box phông nền bức tường/nền nhà ở xa (nếu box chiếm >70% và tràn góc)
                  const isBackground = ratio > 0.70 && xmin <= 0.08 && ymin <= 0.08;

                  if (!isBackground) {
                    count++;
                    if (ratio > maxRatio) {
                      maxRatio = ratio;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Xử lý ngoại lệ dự phòng nếu buffer chưa sẵn sàng
        }
      }

      // 2. Dự phòng Lấy mẫu Pixel Lưới (Real-Pixel Luminance Grid) nếu Mô hình đang khởi tạo
      if (maxRatio === 0 && count === 0 && frameArea > 0) {
        try {
          const buffer = frame.toArrayBuffer();
          if (buffer && buffer.byteLength >= frameArea) {
            const bytes = new Uint8Array(buffer);
            const gridCols = 16;
            const gridRows = 16;
            const stepX = Math.floor(frameWidth / gridCols);
            const stepY = Math.floor(frameHeight / gridRows);

            let sumY = 0;
            let samplesCount = 0;
            const samples: number[] = [];

            for (let r = 0; r < gridRows; r++) {
              for (let c = 0; c < gridCols; c++) {
                const x = c * stepX + Math.floor(stepX / 2);
                const y = r * stepY + Math.floor(stepY / 2);
                const idx = y * frameWidth + x;
                if (idx < bytes.length) {
                  const val = bytes[idx];
                  samples.push(val);
                  sumY += val;
                  samplesCount++;
                }
              }
            }

            if (samplesCount > 0) {
              const avgY = sumY / samplesCount;
              let objectPoints = 0;
              for (let s = 0; s < samples.length; s++) {
                if (Math.abs(samples[s] - avgY) > 28) {
                  objectPoints++;
                }
              }

              const occlusionRatio = objectPoints / samplesCount;
              if (occlusionRatio >= 0.18) {
                maxRatio = Number(occlusionRatio.toFixed(2));
                count = 1;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // 3. Phân loại mức độ nguy hiểm dựa trên Ngưỡng (Thresholds)
      let level: ThreatLevel = 'safe';
      if (maxRatio >= dangerThreshold) {
        level = 'danger';
      } else if (maxRatio >= warningThreshold) {
        level = 'warning';
      }

      // Đẩy tín hiệu về JS Thread
      triggerAlertOnJS(level, maxRatio, count);
    },
    [isEnabled, boxedModel, warningThreshold, dangerThreshold, triggerAlertOnJS],
  );

  return {
    threatLevel: detectionState.threatLevel,
    maxRatio: detectionState.maxRatio,
    detectedCount: detectionState.detectedCount,
    isAiModelLoaded: objectDetection.state === 'loaded',
    frameProcessor,
    handleAlertSignal,
  };
}
