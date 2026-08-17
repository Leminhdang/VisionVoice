import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraPhotoOutput } from 'react-native-vision-camera';

import {
  OBSTACLE_ASSESSMENT_THROTTLE_MS,
  OBSTACLE_MAX_DETECT_FAILURES,
} from '../constants/config';
import { OBSTACLE } from '../constants/strings';
import { speakExclusive } from '../services/audioSession';
import { hapticForSeverity, playDanger } from '../services/feedback';
import { logMetric, nextFrameId } from '../services/metrics';
import {
  assessDetections,
  createAnnouncementPolicy,
} from '../services/obstacleDetector';
import type { AnnouncementPolicy, Assessment } from '../services/obstacleDetector';
import { detectFromPhoto, getTfliteModel } from '../services/tfliteDetector';
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
 * `photoOutput`, extracts raw pixels via Photo.getPixelBuffer(),
 * runs EfficientDet-Lite0 inference, and assesses severity.
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
      console.warn('Lỗi khi quét vật cản: dò hỏng liên tiếp, dừng vòng quét.');
      isCyclingRef.current = false;
      hapticForSeverity('danger');
      void speakExclusive(OBSTACLE.DETECTOR_FAILED, { flush: true });
    };

    const cycle = async (): Promise<void> => {
      if (!isCyclingRef.current) return;

      const output = photoOutputRef.current;
      const model = getTfliteModel();
      if (output === null || model === null) {
        scheduleNext();
        return;
      }

      let photo = null;
      try {
        const frameId = nextFrameId();
        const start = Date.now();

        photo = await output.capturePhoto({ enableShutterSound: false }, {});
        const objects = detectFromPhoto(photo);
        const detectMs = Date.now() - start;

        if (objects === null) {
          handleDetectFailure();
          logMetric({
            event: 'obstacle_detect_failed',
            frameId,
            consecutive: failureCountRef.current,
          });
          return;
        }
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
        // thường, không phải lỗi — chỉ cảnh báo khi vẫn đang quét thật.
        if (isCyclingRef.current) {
          console.warn('Lỗi khi quét vật cản:', err);
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
