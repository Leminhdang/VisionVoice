import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TensorflowPlugin } from 'react-native-fast-tflite';
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
import { parseDetections, readTopScore } from '../services/tfliteDetector';
import { useSettings } from '../state/SettingsContext';

interface UseObstacleScannerOptions {
  active: boolean;
}

interface UseObstacleScannerResult {
  assessment: Assessment | null;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET: number = require('../../assets/models/efficientdet_lite0_detection.tflite');

/**
 * Nạp model qua expo-asset thay vì truyền thẳng require() cho fast-tflite.
 *
 * fast-tflite trên Android đọc model bằng đúng một dòng `URL(path).readBytes()`
 * (HybridAssetLoader.kt). Nếu truyền require(), React Native tự chọn đường dẫn:
 * - bản dev trả URL http tới Metro → tắt Wi-Fi là không nạp được model;
 * - bản release trả TÊN RESOURCE TRẦN không có giao thức
 *   ("models_efficientdet_lite0_detection") → `URL()` ném "no protocol",
 *   hỏng ngay cả khi có mạng.
 * Tức là chế độ dò vật cản chưa từng chạy được offline, trái với thiết kế.
 *
 * `Asset.downloadAsync()` chép model ra một đường dẫn file:// mà `URL()` đọc
 * được ở mọi môi trường và lưu cache: bản release luôn offline; bản dev offline
 * được sau khi đã vào chế độ này một lần lúc còn mạng.
 *
 * Trả về đúng kiểu TensorflowPlugin như useTensorflowModel để phần còn lại của
 * scanner không phải đổi gì.
 */
function useLocalTfliteModel(): TensorflowPlugin {
  const [plugin, setPlugin] = useState<TensorflowPlugin>({
    model: undefined,
    state: 'loading',
  });

  useEffect(() => {
    let isCancelled = false;

    const load = async (): Promise<void> => {
      const asset = Asset.fromModule(MODEL_ASSET);
      await asset.downloadAsync();
      if (asset.localUri == null) {
        throw new Error('Không có đường dẫn cục bộ cho model vật cản.');
      }
      const model = await loadTensorflowModel({ url: asset.localUri }, TFLITE_DELEGATES);
      if (!isCancelled) {
        setPlugin({ model, state: 'loaded' });
      }
    };

    load().catch((error: unknown) => {
      if (isCancelled) {
        return;
      }
      setPlugin({
        model: undefined,
        state: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return plugin;
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
  setPhotoOutput: (output: CameraPhotoOutput | null) => void;
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

  const setPhotoOutput = useCallback((output: CameraPhotoOutput | null) => {
    photoOutputRef.current = output;
  }, []);

  const tfModel = useLocalTfliteModel();
  const modelRef = useRef(tfModel.model);
  modelRef.current = tfModel.model;

  // TODO(debug): gỡ sau khi xác nhận model mới nạp đúng trên thiết bị.
  useEffect(() => {
    if (tfModel.model != null) {
      console.log('[TFLite] inputs', JSON.stringify(tfModel.model.inputs));
      console.log('[TFLite] outputs', JSON.stringify(tfModel.model.outputs));
    }
  }, [tfModel.model]);

  /**
   * Model nạp hỏng là hỏng vĩnh viễn — vòng quét bên dưới chỉ thấy
   * `model == null` nên sẽ lặp vô hạn trong im lặng, và người dùng chỉ nghe
   * lời giới thiệu rồi không gì nữa. Delegate GPU từ chối model lượng tử hoá
   * là đường hỏng dễ xảy ra nhất (tài liệu fast-tflite ghi rõ delegate tăng
   * tốc "không chạy được với mọi model"), nên phải bắt riêng và nói ra.
   */
  useEffect(() => {
    if (!active || tfModel.state !== 'error') {
      return;
    }
    console.warn('Lỗi khi nạp model dò vật cản:', tfModel.error);
    logMetric({
      event: 'app_error',
      where: 'obstacle_model_load',
      message: String(tfModel.error?.message ?? tfModel.error),
    });
    isCyclingRef.current = false;
    hapticForSeverity('danger');
    void speakExclusive(OBSTACLE.DETECTOR_FAILED, { flush: true });
  }, [active, tfModel]);

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
          topScore: Number(readTopScore(outputs).toFixed(3)),
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
