import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CameraView } from 'expo-camera';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import type { ObjectDetectionConfig } from '@infinitered/react-native-mlkit-object-detection';

import { OBSTACLE_SCAN_INTERVAL_MS } from '../constants/config';
import { OBSTACLE } from '../constants/strings';
import { speakExclusive } from '../services/audioSession';
import { hapticForSeverity, playDanger } from '../services/feedback';
import { captureFrameForDetection, deleteFrameFile } from '../services/imagePipeline';
import { logMetric, nextFrameId } from '../services/metrics';
import {
  assessDetections,
  createAnnouncementPolicy,
} from '../services/obstacleDetector';
import type { AnnouncementPolicy, Assessment } from '../services/obstacleDetector';
import { useSettings } from '../state/SettingsContext';

interface UseObstacleScannerOptions {
  active: boolean;
}

interface UseObstacleScannerResult {
  assessment: Assessment | null;
}

/**
 * Announces an assessment over the half-duplex audio session.
 * Severity decides the channel mix (sound + haptic + speech).
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
 * Self-scheduling obstacle-scan loop.
 *
 * While `opts.active` is true and the ML Kit default model is loaded, each
 * cycle: captures a low-quality frame → runs on-device object detection →
 * assesses severity → publishes the latest Assessment, and announces it when
 * the announcement policy allows. Cycles never overlap — the next cycle is
 * scheduled only after the current one finishes, delayed by
 * max(0, OBSTACLE_SCAN_INTERVAL_MS - elapsed). A failed cycle logs a warning
 * and the loop continues.
 *
 * Requires the ObjectDetectionProvider (built in App.tsx from
 * useObjectDetectionModels({ loadDefaultModel: true, ... }) +
 * useObjectDetectionProvider) to be mounted above this hook's component —
 * useObjectDetection throws without it.
 */
export function useObstacleScanner(
  cameraRef: RefObject<CameraView | null>,
  opts: UseObstacleScannerOptions,
): UseObstacleScannerResult {
  const { active } = opts;
  const { settings } = useSettings();
  const detector = useObjectDetection<ObjectDetectionConfig>('default');

  const [assessment, setAssessment] = useState<Assessment | null>(null);

  const policyRef = useRef<AnnouncementPolicy | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Cancellation flag for the current run: a cycle whose captured token no
   * longer matches this ref is cancelled. Per-run tokens (instead of a shared
   * boolean) guarantee an in-flight cycle from a previous activation can never
   * resume and create a second, overlapping loop.
   */
  const runTokenRef = useRef<symbol | null>(null);
  const sensitivityRef = useRef(settings.obstacleSensitivity);

  // Keep the latest sensitivity visible to in-flight cycles without
  // restarting the loop (a restart would reset the announcement cooldowns).
  useEffect(() => {
    sensitivityRef.current = settings.obstacleSensitivity;
  }, [settings.obstacleSensitivity]);

  useEffect(() => {
    if (!active || detector === undefined) {
      return undefined;
    }

    const runToken = Symbol('obstacle-scan-run');
    runTokenRef.current = runToken;
    policyRef.current = createAnnouncementPolicy();
    setAssessment(null);

    const isCancelled = (): boolean => runTokenRef.current !== runToken;

    const scheduleNext = (cycleStartMs: number): void => {
      if (isCancelled()) {
        return;
      }
      const elapsedMs = Date.now() - cycleStartMs;
      timerRef.current = setTimeout(() => {
        void cycle();
      }, Math.max(0, OBSTACLE_SCAN_INTERVAL_MS - elapsedMs));
    };

    const cycle = async (): Promise<void> => {
      if (isCancelled()) {
        return;
      }
      const startMs = Date.now();
      let frameUri: string | null = null;
      try {
        const camera = cameraRef.current;
        if (camera === null) {
          return; // Camera chưa gắn xong — finally vẫn hẹn chu kỳ kế tiếp.
        }

        const frame = await captureFrameForDetection(camera);
        frameUri = frame.uri;
        const objects = await detector.detectObjects(frame.uri);
        if (isCancelled()) {
          return;
        }

        const detectMs = Date.now() - startMs;
        const frameId = nextFrameId();
        logMetric({
          event: 'obstacle_frame',
          frameId,
          detectMs,
          detections: objects.length,
        });

        const result = assessDetections(
          objects,
          { width: frame.width, height: frame.height },
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
          await announceAssessment(result);
        }
      } catch (err) {
        // Một khung hình lỗi không được làm chết vòng quét — cảnh báo rồi quét tiếp.
        console.warn('Lỗi khi quét vật cản:', err);
      } finally {
        if (frameUri !== null) {
          void deleteFrameFile(frameUri);
        }
        scheduleNext(startMs);
      }
    };

    void cycle();

    return () => {
      runTokenRef.current = null;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, detector, cameraRef]);

  return { assessment };
}
