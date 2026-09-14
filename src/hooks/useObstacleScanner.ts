import { useCallback, useEffect, useRef, useState } from 'react';
import type { TensorflowPlugin } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import type {
  CameraFrameOutput,
  CameraPhotoOutput,
  Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import {
  OBSTACLE_FRAME_PROBE_ENABLED,
  OBSTACLE_FRAME_PROBE_LOG_MS,
  OBSTACLE_FRAME_RESOLUTION,
  OBSTACLE_MAX_DETECT_FAILURES,
  OBSTACLE_MIN_FRAME_GAP_MS,
  OBSTACLE_MODEL_NOTICE_DELAY_MS,
  OBSTACLE_TARGET_PERIOD_MS,
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
import type {
  AnnouncementPolicy,
  Assessment,
  Severity,
} from '../services/obstacleDetector';
import { loadObstacleModel } from '../services/obstacleModel';
import { parseDetections, readTopScore } from '../services/tfliteDetector';
import { useSettings } from '../state/SettingsContext';

interface UseObstacleScannerOptions {
  active: boolean;
}

interface UseObstacleScannerResult {
  assessment: Assessment | null;
  /**
   * Frame output cần gắn vào <Camera outputs>. null khi bước dò đang tắt.
   *
   * Màn hình phải chuyển tiếp giá trị này xuống CameraViewport — không gắn vào
   * session thì output không nhận khung nào và `onFrame` không bao giờ nổ.
   */
  frameOutput: CameraFrameOutput | null;
}

/**
 * Bọc model dùng chung ở obstacleModel.ts thành state cho scanner.
 *
 * Trả về đúng kiểu TensorflowPlugin như useTensorflowModel để phần còn lại của
 * scanner không phải đổi gì. Chuẩn bị file và nạp model nằm hết trong service —
 * hook này chỉ theo dõi kết quả và tự huỷ khi rời màn hình.
 */
function useLocalTfliteModel(): TensorflowPlugin {
  const [plugin, setPlugin] = useState<TensorflowPlugin>({
    model: undefined,
    state: 'loading',
  });

  useEffect(() => {
    let isCancelled = false;

    loadObstacleModel()
      .then((model) => {
        if (!isCancelled) {
          setPlugin({ model, state: 'loaded' });
        }
      })
      .catch((error: unknown) => {
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
 * Nhận báo cáo khung từ worklet và ghi log, có tiết chế.
 *
 * Worklet chạy ở tốc độ camera (~30 khung/giây) nên không ghi log trong đó.
 * Toàn bộ phần quyết định nằm bên JS cho dễ sửa và dễ đọc — worklet chỉ đọc vài
 * thuộc tính rồi chuyển sang.
 */
function createFrameProbeReporter(): (
  width: number,
  height: number,
  pixelFormat: string,
  bytes: number,
  isPlanar: boolean,
) => void {
  let lastLoggedAt = 0;
  let seen = 0;

  return (width, height, pixelFormat, bytes, isPlanar) => {
    seen++;
    const now = Date.now();
    if (now - lastLoggedAt < OBSTACLE_FRAME_PROBE_LOG_MS) {
      return;
    }
    lastLoggedAt = now;
    console.log(
      `VVFRAME ${JSON.stringify({
        seen,
        width,
        height,
        pixelFormat,
        bytes,
        isPlanar,
      })}`,
    );
  };
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
  // Mức của khung trước, cấp cho trễ trạng thái trong assessDetections. Dùng ref
  // chứ không dùng state `assessment`: effect vòng quét chỉ phụ thuộc [active]
  // nên closure của nó giữ mãi giá trị state của lần chạy đầu.
  const lastSeverityRef = useRef<Severity>('safe');
  const sensitivityRef = useRef(settings.obstacleSensitivity);

  useEffect(() => {
    sensitivityRef.current = settings.obstacleSensitivity;
  }, [settings.obstacleSensitivity]);

  const setPhotoOutput = useCallback((output: CameraPhotoOutput | null) => {
    photoOutputRef.current = output;
  }, []);

  /**
   * BƯỚC DÒ frame output — chưa thay vòng quét, chỉ xác nhận đường này sống.
   *
   * Lần trước `onFrame` không bao giờ nổ nên cần bằng chứng trước khi viết lại
   * vòng quét. Nếu log VVFRAME xuất hiện thì đường lấy pixel dùng được và bước
   * sau mới bỏ capturePhoto (đang chiếm 90% thời gian mỗi khung).
   *
   * useFrameOutput phải được gọi VÔ ĐIỀU KIỆN — nó là hook, không thể bọc trong
   * if. Cờ bật/tắt chỉ quyết định có gắn output vào session hay không.
   */
  const reportFrame = useRef(createFrameProbeReporter()).current;
  const onProbeFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        // Phải dispose trong finally: giữ khung lại làm nghẽn cả pipeline camera.
        const buffer = frame.isPlanar ? null : frame.getPixelBuffer();
        scheduleOnRN(
          reportFrame,
          frame.width,
          frame.height,
          String(frame.pixelFormat),
          buffer?.byteLength ?? 0,
          frame.isPlanar,
        );
      } finally {
        frame.dispose();
      }
    },
    [reportFrame],
  );

  const frameOutput = useFrameOutput({
    targetResolution: OBSTACLE_FRAME_RESOLUTION,
    pixelFormat: 'rgb',
    enablePreviewSizedOutputBuffers: true,
    onFrame: onProbeFrame,
  });

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
   * Lần đầu sau khi cài, model còn đang chép ra bộ nhớ. Không nói gì thì người
   * khiếm thị chỉ nghe lời giới thiệu rồi im lặng vài giây — không phân biệt
   * được với "đường trống".
   *
   * flush: false để câu này XẾP HÀNG sau lời giới thiệu màn hình thay vì cắt
   * ngang nó (tts.speak mặc định flush = true, xem speakWithExpoSpeech).
   */
  useEffect(() => {
    if (!active || tfModel.state !== 'loading') {
      return undefined;
    }
    const timer = setTimeout(() => {
      void speakExclusive(OBSTACLE.PREPARING, { flush: false });
    }, OBSTACLE_MODEL_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, tfModel.state]);

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
    lastSeverityRef.current = 'safe';
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
      const cycleStart = Date.now();
      try {
        const frameId = nextFrameId();

        photo = await output.capturePhoto({ enableShutterSound: false }, {});
        const capturedAt = Date.now();

        // Decode + resize về ô vuông model chạy native; toImage() áp luôn EXIF
        // orientation nên frame đưa vào model mới thực sự thẳng đứng.
        const image = await photo.toImageAsync();
        const decodedAt = Date.now();

        let inputBuffer: ArrayBuffer;
        try {
          inputBuffer = await imageToModelInput(image);
        } finally {
          image.dispose();
        }
        const preparedAt = Date.now();

        // Run TFLite inference
        const outputs = model.runSync([inputBuffer]);
        const inferredAt = Date.now();
        const detectMs = inferredAt - cycleStart;

        const objects = parseDetections(outputs, photo.width, photo.height);
        failureCountRef.current = 0;

        const result = assessDetections(
          objects,
          { width: photo.width, height: photo.height },
          sensitivityRef.current,
          lastSeverityRef.current,
        );
        lastSeverityRef.current = result.severity;
        setAssessment(result);

        // Tách từng chặng: 557 ms/khung đo được không cho biết nghẽn ở chụp,
        // decode, tiền xử lý hay suy luận — mà bốn chỗ đó cần bốn cách sửa
        // hoàn toàn khác nhau. areaRatio + severity đi kèm để lần sau đo được
        // mức có còn nhảy qua lại hay không, thay vì phải suy từ topScore.
        logMetric({
          event: 'obstacle_frame',
          frameId,
          detectMs,
          captureMs: capturedAt - cycleStart,
          decodeMs: decodedAt - capturedAt,
          prepMs: preparedAt - decodedAt,
          inferMs: inferredAt - preparedAt,
          detections: objects.length,
          topScore: Number(readTopScore(outputs).toFixed(3)),
          areaRatio: Number(result.areaRatio.toFixed(3)),
          severity: result.severity,
        });

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
        scheduleNext(Date.now() - cycleStart);
      }
    };

    /**
     * Hẹn khung kế tiếp theo HẠN CHÓT, không phải nghỉ cứng sau khi làm xong.
     *
     * Nghỉ cứng khiến chu kỳ thật = nghỉ + thời gian xử lý, nên máy càng chậm
     * cảnh báo càng trễ — đúng chiều sai. Trừ đi phần đã tiêu thì nhịp giữ
     * nguyên trên mọi máy, chỉ co lại tới OBSTACLE_MIN_FRAME_GAP_MS khi máy
     * không theo kịp.
     */
    const scheduleNext = (elapsedMs = 0): void => {
      if (!isCyclingRef.current) return;
      const delay = Math.max(
        OBSTACLE_MIN_FRAME_GAP_MS,
        OBSTACLE_TARGET_PERIOD_MS - elapsedMs,
      );
      timerRef.current = setTimeout(() => void cycle(), delay);
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
    frameOutput: OBSTACLE_FRAME_PROBE_ENABLED ? frameOutput : null,
  };
}
