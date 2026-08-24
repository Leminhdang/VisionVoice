import { useCallback, useEffect, useRef, useState } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';
import type { CameraPhotoOutput } from 'react-native-vision-camera';

import {
  OBSTACLE_ASSESSMENT_THROTTLE_MS,
  OBSTACLE_MAX_DETECT_FAILURES,
  TFLITE_DELEGATES,
} from '../constants/config';
import { OBSTACLE } from '../constants/strings';
import { speakExclusive } from '../services/audioSession';
import { hapticForSeverity, playDanger } from '../services/feedback';
import { imageToModelInput } from '../services/imagePreprocess';
import { logMetric, nextFrameId } from '../services/metrics';
import {
  assessDetections,
  createAnnouncementPolicy,
} from '../services/obstacleDetector';
import type { AnnouncementPolicy, Assessment } from '../services/obstacleDetector';
import { parseDetections } from '../services/tfliteDetector';
import { useSettings } from '../state/SettingsContext';

interface UseObstacleScannerOptions {
  active: boolean;
}

interface UseObstacleScannerResult {
  assessment: Assessment | null;
}

/**
 * Announces an assessment over the half-duplex audio session.
 */
async function announceAssessment(assessment: Assessment): Promise<void> {
  if (assessment.severity === 'danger') {
    void playDanger();
    hapticForSeverity('danger');
    await speakExclusive(OBSTACLE.DANGER, { flush: true });
    return;
  }
  if (assessment.severity === 'warning') {
    hapticForSeverity('warning');
    const phrase =
      assessment.label !== null
        ? OBSTACLE.WARNING_WITH_LABEL(assessment.label)
        : OBSTACLE.WARNING;
    await speakExclusive(phrase, { flush: true });
    return;
  }
  await speakExclusive(OBSTACLE.SAFE);
}

/**
 * Interval-based obstacle scanner using VisionCamera v5 + TFLite.
 *
 * While `opts.active` is true, captures a photo every ~900ms from the
 * photoOutput, decodes + resizes it to 320×320 natively (imageToModelInput),
 * and runs EfficientDet-Lite0 inference.
 *
 * setPhotoOutput() must be called when the camera is ready (from
 * CameraViewport's onPhotoOutputReady callback).
 */
export function useObstacleScanner(
  opts: UseObstacleScannerOptions,
): UseObstacleScannerResult & {
  setPhotoOutput: (output: CameraPhotoOutput) => void;
} {
  const { active } = opts;
  const { settings } = useSettings();

  const [assessment, setAssessment] = useState<Assessment | null>(null);

  const photoOutputRef = useRef<CameraPhotoOutput | null>(null);
  const policyRef = useRef<AnnouncementPolicy | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCyclingRef = useRef(false);
  const failureCountRef = useRef(0);
  const sensitivityRef = useRef(settings.obstacleSensitivity);

  useEffect(() => {
    sensitivityRef.current = settings.obstacleSensitivity;
  }, [settings.obstacleSensitivity]);

  const setPhotoOutput = useCallback((output: CameraPhotoOutput) => {
    photoOutputRef.current = output;
  }, []);

  // Load TFLite model via hook
  const tfModel = useTensorflowModel(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/models/efficientdet_lite0_detection.tflite'),
    TFLITE_DELEGATES,
  );
  const modelRef = useRef(tfModel.model);
  modelRef.current = tfModel.model;

  // TODO(debug): gỡ sau khi xác nhận model mới nạp đúng trên thiết bị.
  useEffect(() => {
    if (tfModel.model != null) {
      console.log('[TFLite] inputs', JSON.stringify(tfModel.model.inputs));
      console.log('[TFLite] outputs', JSON.stringify(tfModel.model.outputs));
    }
  }, [tfModel.model]);

  useEffect(() => {
    if (!active) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isCyclingRef.current = false;
      // Camera đóng theo màn hình; output này đã chết. Không buông ra thì lần
      // vào lại sẽ chụp lên nó trước khi camera kịp cấp output mới.
      photoOutputRef.current = null;
      return undefined;
    }

    policyRef.current = createAnnouncementPolicy();
    setAssessment(null);
    isCyclingRef.current = true;
    failureCountRef.current = 0;

    /**
     * Một khung không dò được. Im lặng bỏ qua vài lần đầu (model có thể còn
     * đang nạp, một khung lỗi lẻ là bình thường), nhưng hỏng liên tiếp thì
     * phải nói ra và dừng — im lặng ở chế độ dò vật cản bị hiểu thành
     * "đường trống", đúng thứ nguy hiểm nhất có thể nói với người khiếm thị.
     */
    const handleDetectFailure = (): void => {
      failureCountRef.current += 1;
      if (failureCountRef.current < OBSTACLE_MAX_DETECT_FAILURES) {
        return;
      }
      isCyclingRef.current = false;
      hapticForSeverity('danger');
      void speakExclusive(OBSTACLE.DETECTOR_FAILED, { flush: true });
    };

    const cycle = async (): Promise<void> => {
      if (!isCyclingRef.current) return;

      const output = photoOutputRef.current;
      const model = modelRef.current;
      if (output === null || model == null) {
        scheduleNext();
        return;
      }

      let photo = null;
      try {
        const frameId = nextFrameId();
        const start = Date.now();

        photo = await output.capturePhoto({ enableShutterSound: false }, {});

        // Decode + resize về 320×320 chạy native; toImage() áp luôn EXIF
        // orientation nên frame đưa vào model mới thực sự thẳng đứng.
        const image = await photo.toImageAsync();
        let inputBuffer: ArrayBuffer;
        try {
          inputBuffer = await imageToModelInput(image);
        } finally {
          image.dispose();
        }

        // Run TFLite inference
        const outputs = model.runSync([inputBuffer]);
        const detectMs = Date.now() - start;

        const objects = parseDetections(outputs, photo.width, photo.height);
        failureCountRef.current = 0;

        logMetric({
          event: 'obstacle_frame',
          frameId,
          detectMs,
          detections: objects.length,
        });

        const result = assessDetections(
          objects,
          { width: photo.width, height: photo.height },
          sensitivityRef.current,
        );
        setAssessment(result);

        const shouldAnnounce =
          policyRef.current?.shouldAnnounce(result, Date.now()) ?? false;
        if (shouldAnnounce) {
          if (result.severity !== 'safe') {
            logMetric({
              event: 'obstacle_alert',
              frameId,
              severity: result.severity,
              label: result.label,
            });
          }
          void announceAssessment(result);
        }
      } catch (err) {
        // Rời chế độ trong lúc capturePhoto còn đang bay: camera đóng trước
        // khi promise resolve ("Camera is closed"). Đây là teardown bình
        // thường, không phải lỗi — chỉ tính là hỏng khi vẫn đang quét thật.
        if (isCyclingRef.current) {
          console.warn('Lỗi khi quét vật cản:', err);
          handleDetectFailure();
        }
      } finally {
        photo?.dispose();
        scheduleNext();
      }
    };

    const scheduleNext = (): void => {
      if (!isCyclingRef.current) return;
      timerRef.current = setTimeout(() => void cycle(), OBSTACLE_ASSESSMENT_THROTTLE_MS);
    };

    // Bắt đầu cycle đầu tiên
    void cycle();

    return () => {
      isCyclingRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  return {
    assessment,
    setPhotoOutput,
  };
}
