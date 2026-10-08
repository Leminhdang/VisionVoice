import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TensorflowPlugin } from 'react-native-fast-tflite';
import { useFrameOutput } from 'react-native-vision-camera';
import type {
  CameraFrameOutput,
  CameraPhotoOutput,
  Frame,
} from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import {
  OBSTACLE_FRAME_MAX_ERRORS,
  OBSTACLE_FRAME_MODE_ENABLED,
  OBSTACLE_FRAME_PERIOD_MS,
  OBSTACLE_FRAME_RESOLUTION,
  OBSTACLE_FRAME_WATCHDOG_MS,
  OBSTACLE_MAX_DETECT_FAILURES,
  OBSTACLE_MIN_FRAME_GAP_MS,
  OBSTACLE_MODEL_NOTICE_DELAY_MS,
  OBSTACLE_TARGET_PERIOD_MS,
  TFLITE_MODEL_INPUT_SIZE,
} from '../constants/config';
import { OBSTACLE } from '../constants/strings';
import { speakExclusive } from '../services/audioSession';
import { hapticForSeverity, playDanger } from '../services/feedback';
import { rgbaToSquareRgb } from '../services/frameSampler';
import { imageToModelInput } from '../services/imagePreprocess';
import { logMetric, nextFrameId } from '../services/metrics';
import {
  assessDetections,
  createAnnouncementPolicy,
} from '../services/obstacleDetector';
import type {
  AnnouncementPolicy,
  Assessment,
  DetectedObject,
  FrameSize,
  Severity,
} from '../services/obstacleDetector';
import { loadObstacleModel } from '../services/obstacleModel';
import { createSeveritySmoother } from '../services/severitySmoother';
import type { SeveritySmoother } from '../services/severitySmoother';
import { parseDetections, readTopScore } from '../services/tfliteDetector';
import { useSettings } from '../state/SettingsContext';

interface UseObstacleScannerOptions {
  active: boolean;
}

interface UseObstacleScannerResult {
  assessment: Assessment | null;
  /**
   * Frame output cần gắn vào <Camera outputs>. null khi đang quét bằng chụp ảnh
   * tĩnh (cờ tắt, hoặc đã lùi về vì luồng camera không chạy).
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

type ScanMode = 'frame' | 'photo';

/** Số đo một khung, ghi vào obstacle_frame. */
interface FrameTiming {
  source: ScanMode;
  frameId: number;
  detectMs: number;
  captureMs: number;
  decodeMs: number;
  prepMs: number;
  inferMs: number;
}

/**
 * Một box thành chuỗi ngắn cho log, toạ độ theo tỉ lệ khung. Đủ để dựng lại
 * vì sao một khung bị báo nguy hiểm: model thấy gì, điểm bao nhiêu, nằm đâu.
 */
function describeBox(object: DetectedObject, frame: FrameSize): string {
  const { origin, size } = object.frame;
  const label = object.labels[0];
  const ratio = (value: number, total: number): string => (value / total).toFixed(2);
  return (
    `${label?.text ?? '?'} ${label?.confidence.toFixed(2) ?? '?'}` +
    ` x${ratio(origin.x, frame.width)}-${ratio(origin.x + size.x, frame.width)}` +
    ` y${ratio(origin.y, frame.height)}-${ratio(origin.y + size.y, frame.height)}`
  );
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
  const smootherRef = useRef<SeveritySmoother | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCyclingRef = useRef(false);
  const failureCountRef = useRef(0);
  // Mức của khung trước, cấp cho trễ trạng thái trong assessDetections. Dùng ref
  // chứ không dùng state `assessment`: effect vòng quét chỉ phụ thuộc [active]
  // nên closure của nó giữ mãi giá trị state của lần chạy đầu.
  const lastSeverityRef = useRef<Severity>('safe');
  const sensitivityRef = useRef(settings.obstacleSensitivity);
  const activeRef = useRef(active);
  activeRef.current = active;

  /**
   * Nguồn khung hiện tại. Bắt đầu bằng luồng camera; chỉ đổi một chiều sang
   * 'photo' khi luồng camera không chạy (xem fallbackToPhoto). Ref để các
   * callback đọc giá trị mới nhất, state để render lại và tháo frame output.
   */
  const [scanMode, setScanMode] = useState<ScanMode>(
    OBSTACLE_FRAME_MODE_ENABLED ? 'frame' : 'photo',
  );
  const scanModeRef = useRef(scanMode);
  const lastFrameResultAtRef = useRef(0);
  const frameErrorCountRef = useRef(0);
  /**
   * Hai giá trị dùng chung giữa luồng JS và worklet của camera. Worklet chạy ở
   * runtime riêng nên không đọc được ref của React; Synchronizable là cách
   * react-native-worklets cho hai bên cùng thấy một giá trị.
   */
  const isFrameScanEnabled = useMemo(() => createSynchronizable(false), []);
  const lastFrameRunAt = useMemo(() => createSynchronizable(0), []);

  useEffect(() => {
    sensitivityRef.current = settings.obstacleSensitivity;
  }, [settings.obstacleSensitivity]);

  const setPhotoOutput = useCallback((output: CameraPhotoOutput | null) => {
    photoOutputRef.current = output;
  }, []);

  const tfModel = useLocalTfliteModel();
  const modelRef = useRef(tfModel.model);
  modelRef.current = tfModel.model;

  /**
   * Phần dùng chung của mọi khung, bất kể nguồn: output model → box → mức thô
   * → mức đã làm mượt → màn hình, log, giọng nói. Chỉ đọc ref nên ổn định suốt
   * vòng đời hook.
   */
  const processDetections = useCallback(
    (outputs: ArrayBuffer[], frameSize: FrameSize, timing: FrameTiming): void => {
      const objects = parseDetections(outputs, frameSize.width, frameSize.height);
      failureCountRef.current = 0;

      const result = assessDetections(
        objects,
        frameSize,
        sensitivityRef.current,
        lastSeverityRef.current,
      );
      // lastSeverityRef giữ mức THÔ cho hysteresis diện tích; màn hình và giọng
      // nói chỉ thấy mức đã làm mượt — xem severitySmoother.ts.
      lastSeverityRef.current = result.severity;
      const smoothed = smootherRef.current?.update(result, Date.now()) ?? result;
      setAssessment(smoothed);

      // Tách từng chặng: 557 ms/khung đo được không cho biết nghẽn ở chụp,
      // decode, tiền xử lý hay suy luận — mà bốn chỗ đó cần bốn cách sửa
      // hoàn toàn khác nhau. areaRatio + severity đi kèm để lần sau đo được
      // mức có còn nhảy qua lại hay không, thay vì phải suy từ topScore.
      logMetric({
        event: 'obstacle_frame',
        frameId: timing.frameId,
        source: timing.source,
        detectMs: timing.detectMs,
        captureMs: timing.captureMs,
        decodeMs: timing.decodeMs,
        prepMs: timing.prepMs,
        inferMs: timing.inferMs,
        detections: objects.length,
        topScore: Number(readTopScore(outputs).toFixed(3)),
        areaRatio: Number(result.areaRatio.toFixed(3)),
        severity: result.severity,
        smoothed: smoothed.severity,
        frame: `${frameSize.width}x${frameSize.height}`,
        boxes: objects.map((object) => describeBox(object, frameSize)),
      });

      const shouldAnnounce =
        policyRef.current?.shouldAnnounce(smoothed, Date.now()) ?? false;
      if (shouldAnnounce) {
        if (smoothed.severity !== 'safe') {
          logMetric({
            event: 'obstacle_alert',
            frameId: timing.frameId,
            severity: smoothed.severity,
            label: smoothed.label,
          });
        }
        void announceAssessment(smoothed);
      }
    },
    [],
  );

  /**
   * Lùi hẳn về vòng chụp ảnh tĩnh. Một chiều: máy nào đã không chạy được luồng
   * camera thì thử lại trong cùng phiên chỉ thêm khoảng im lặng.
   *
   * Tắt worklet qua Synchronizable NGAY (state chỉ tháo output ở lần render
   * sau), để worklet không gọi model cùng lúc với vòng chụp ảnh — fast-tflite
   * không khoá interpreter.
   */
  const fallbackToPhoto = useCallback(
    (reason: string) => {
      if (scanModeRef.current === 'photo') {
        return;
      }
      scanModeRef.current = 'photo';
      isFrameScanEnabled.setBlocking(false);
      setScanMode('photo');
      console.warn('Lỗi khi quét bằng luồng camera, chuyển sang chụp ảnh:', reason);
      logMetric({ event: 'obstacle_mode', mode: 'photo', reason });
    },
    [isFrameScanEnabled],
  );

  /** Kết quả một khung từ worklet, chạy trên luồng JS. */
  const handleFrameResult = useCallback(
    (outputs: number[][], width: number, height: number, prepMs: number, inferMs: number) => {
      if (!activeRef.current || scanModeRef.current !== 'frame') {
        return;
      }
      lastFrameResultAtRef.current = Date.now();
      frameErrorCountRef.current = 0;
      processDetections(
        outputs.map((values) => new Float32Array(values).buffer),
        { width, height },
        {
          source: 'frame',
          frameId: nextFrameId(),
          detectMs: prepMs + inferMs,
          captureMs: 0,
          decodeMs: 0,
          prepMs,
          inferMs,
        },
      );
    },
    [processDetections],
  );

  const handleFrameError = useCallback(
    (message: string) => {
      if (!activeRef.current || scanModeRef.current !== 'frame') {
        return;
      }
      frameErrorCountRef.current += 1;
      if (frameErrorCountRef.current >= OBSTACLE_FRAME_MAX_ERRORS) {
        fallbackToPhoto(message);
      }
    },
    [fallbackToPhoto],
  );

  /**
   * Worklet chạy trên luồng camera cho MỌI khung (~30/giây). Khung tới sớm hơn
   * OBSTACLE_FRAME_PERIOD_MS bị bỏ ngay; khung còn lại được cắt vuông, thu nhỏ,
   * chạy model rồi gửi output (dạng số thường) về luồng JS.
   *
   * dispose() trong finally là BẮT BUỘC: khung không được trả lại thì CameraX
   * ngừng cấp khung — đúng lỗi "onFrame chỉ nổ một lần" của lần thử trước.
   * runSync chặn luồng camera; dropFramesWhileBusy lo bỏ các khung dồn lại.
   */
  const model = tfModel.model;
  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        if (model == null || !isFrameScanEnabled.getBlocking()) {
          return;
        }
        const startedAt = Date.now();
        if (startedAt - lastFrameRunAt.getBlocking() < OBSTACLE_FRAME_PERIOD_MS) {
          return;
        }
        lastFrameRunAt.setBlocking(startedAt);

        const size = TFLITE_MODEL_INPUT_SIZE;
        const input = new Uint8Array(size * size * 3);
        rgbaToSquareRgb(
          new Uint8Array(frame.getPixelBuffer()),
          frame.width,
          frame.height,
          frame.bytesPerRow,
          size,
          input,
        );
        const preparedAt = Date.now();
        const outputs = model.runSync([input.buffer]);
        const inferredAt = Date.now();
        // fast-tflite dùng lại buffer output ở lần chạy sau — chép ra mảng số
        // thường trước khi gửi sang luồng khác.
        const values = outputs.map((buffer) => Array.from(new Float32Array(buffer)));
        scheduleOnRN(
          handleFrameResult,
          values,
          frame.width,
          frame.height,
          preparedAt - startedAt,
          inferredAt - preparedAt,
        );
      } catch (e) {
        scheduleOnRN(handleFrameError, String(e));
      } finally {
        frame.dispose();
      }
    },
    [model, isFrameScanEnabled, lastFrameRunAt, handleFrameResult, handleFrameError],
  );

  /**
   * pixelFormat 'rgb' + xoay vật lý: CameraX tự đổi YUV sang RGBA và xoay về
   * chiều dọc, nên worklet không phải giải mã YUV (đường đã hỏng ở lần thử
   * đầu) và kích thước khung đã là kích thước ảnh dọc parseDetections cần.
   *
   * useFrameOutput phải được gọi VÔ ĐIỀU KIỆN — nó là hook. Có gắn vào session
   * hay không do giá trị trả về quyết định.
   */
  const frameOutput = useFrameOutput({
    targetResolution: OBSTACLE_FRAME_RESOLUTION,
    pixelFormat: 'rgb',
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame,
  });

  /**
   * Watchdog: đang ở chế độ luồng camera, model đã sẵn sàng mà quá
   * OBSTACLE_FRAME_WATCHDOG_MS không có kết quả nào (chưa từng có, hoặc đang có
   * rồi ngừng) thì lùi về chụp ảnh tĩnh. Im lặng kéo dài ở chế độ này bị hiểu
   * thành "đường trống".
   */
  useEffect(() => {
    if (!active || scanMode !== 'frame' || tfModel.model == null) {
      return undefined;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const lastResultAt = Math.max(startedAt, lastFrameResultAtRef.current);
      if (Date.now() - lastResultAt >= OBSTACLE_FRAME_WATCHDOG_MS) {
        fallbackToPhoto('watchdog');
      }
    }, 500);
    return () => clearInterval(timer);
  }, [active, scanMode, tfModel.model, fallbackToPhoto]);

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
      isFrameScanEnabled.setBlocking(false);
      // Camera đóng theo màn hình; output này đã chết. Không buông ra thì lần
      // vào lại sẽ chụp lên nó trước khi camera kịp cấp output mới.
      photoOutputRef.current = null;
      return undefined;
    }

    policyRef.current = createAnnouncementPolicy();
    smootherRef.current = createSeveritySmoother();
    setAssessment(null);
    lastSeverityRef.current = 'safe';
    isCyclingRef.current = true;
    failureCountRef.current = 0;
    frameErrorCountRef.current = 0;
    lastFrameRunAt.setBlocking(0);
    isFrameScanEnabled.setBlocking(scanModeRef.current === 'frame');

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
      // Đang quét bằng luồng camera thì vòng này chỉ chờ, sẵn sàng tiếp quản
      // khi fallbackToPhoto() đổi chế độ. Lượt đầu sau khi đổi mất ~500 ms ở
      // capturePhoto, đủ để lần suy luận cuối của worklet chạy xong trước.
      if (output === null || model == null || scanModeRef.current === 'frame') {
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
        // Kích thước khung PHẢI lấy từ ảnh đã xoay, không lấy từ photo:
        // photo.width/height là buffer CameraX CHƯA XOAY (ngang, 640×480) trong
        // khi model nhìn ảnh dọc. Dùng nhầm thì box map ngược bị ép vào giữa
        // trục ngang — tường sát mép lọt vào dải lối đi và bị báo "Dừng lại!".
        const frameSize = { width: image.width, height: image.height };

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

        processDetections(outputs, frameSize, {
          source: 'photo',
          frameId,
          detectMs,
          captureMs: capturedAt - cycleStart,
          decodeMs: decodedAt - capturedAt,
          prepMs: preparedAt - decodedAt,
          inferMs: inferredAt - preparedAt,
        });
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
  }, [active, isFrameScanEnabled, lastFrameRunAt, processDetections]);

  return {
    assessment,
    setPhotoOutput,
    frameOutput: scanMode === 'frame' ? frameOutput : null,
  };
}
