import { useCallback, useEffect, useRef, useState } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';
import type { CameraPhotoOutput } from 'react-native-vision-camera';

import {
  OBSTACLE_ASSESSMENT_THROTTLE_MS,
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
      return undefined;
    }

    policyRef.current = createAnnouncementPolicy();
    setAssessment(null);
    isCyclingRef.current = true;

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
        console.warn('Lỗi khi quét vật cản:', err);
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
