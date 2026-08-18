import { Platform } from 'react-native';
import type { TensorflowModelDelegate } from 'react-native-fast-tflite';

// Gemini models (Firebase AI Logic)
export const GEMINI_MODEL = 'gemini-3.6-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

// Image capture & processing
export const CAPTURE_QUALITY = 0.4;
export const IMAGE_RESIZE_WIDTH = 800;
export const IMAGE_COMPRESS = 0.5;
export const TARGET_PICTURE_SIZE = 1280;


// Obstacle detection
export const OBSTACLE_ASSESSMENT_THROTTLE_MS = 900;
export const TFLITE_MODEL_INPUT_SIZE = 320;
/**
 * Độ phân giải chụp cho vòng dò vật cản. Mặc định của VisionCamera là UHD 4:3
 * (~4080×3060) — thừa thãi vì model chỉ ăn 320×320, mà decode ảnh 12MP tốn
 * ~700ms/frame và đẩy ION heap lên cao.
 *
 * PHẢI là hằng số cấp module: `usePhotoOutput` dùng targetResolution làm
 * useMemo dependency THEO THAM CHIẾU, nên object literal inline sẽ tạo lại
 * photo output mỗi lần render (chính là lỗi remount loop đã sửa ở 83336b0).
 */
export const OBSTACLE_CAPTURE_RESOLUTION = { width: 640, height: 480 };
/**
 * Delegate tăng tốc phần cứng cho TFLite.
 *
 * Android cần `enableAndroidGpuLibraries: true` trong app.json để kèm
 * libOpenCL.so, nếu không `'android-gpu'` sẽ không nạp được. NNAPI bị khai tử
 * từ Android 15 nên không dùng.
 *
 * PHẢI là hằng số cấp module — mảng này là dependency của `useTensorflowModel`,
 * literal inline sẽ nạp lại model mỗi lần render.
 */
export const TFLITE_DELEGATES: TensorflowModelDelegate[] =
  Platform.select<TensorflowModelDelegate[]>({
    android: ['android-gpu'],
    ios: ['core-ml'],
    default: [],
  });

export const OBSTACLE_SCORE_MIN = 0.35;
export const DANGER_AREA_RATIO = 0.35;
export const WARNING_AREA_RATIO = 0.18;
export const CENTER_BAND_WIDTH_RATIO: Record<'low' | 'medium' | 'high', number> = {
  low: 0.25,
  medium: 0.4,
  high: 0.5,
};
export const ANNOUNCE_COOLDOWN_MS = {
  danger: 2000,
  warning: 3000,
};

// Voice / ASR timing
export const ASR_RESTART_ON_END_MS = 500;
export const ASR_RESTART_ON_ERROR_MS = 2000;
export const ASR_MAX_CONSECUTIVE_ERRORS = 5;
export const ASR_MAX_BACKOFF_MS = 30_000;
export const TTS_GUARD_DELAY_MS = 400;
export const QA_RELISTEN_DELAY_MS = 800;

// Capture flow timing
export const CAPTURE_DEBOUNCE_MS = 2000;
export const POST_RESET_COOLDOWN_MS = 1500;
export const API_TIMEOUT_MS = 30_000;

// Speech
export const TTS_LOCALE = 'vi-VN';
export const SPEECH_RECOGNITION_LOCALE = 'vi-VN';
export const DEFAULT_TTS_RATE = 0.9;
export const DEFAULT_TTS_PITCH = 1.0;

// Modes
export const MOCK_MODE: boolean = false;
export const METRICS_ENABLED = true;

// Mock data
export const MOCK_DESCRIPTION =
  'Đây là chế độ thử nghiệm. Trong ảnh có một không gian sáng với ánh đèn tự nhiên. ' +
  'Phía trước là một bàn làm việc với máy tính xách tay màu bạc đang mở. ' +
  'Bên cạnh là một tách cà phê và vài tờ giấy ghi chú.';
export const MOCK_QA_ANSWER =
  'Chiếc máy tính xách tay màu bạc đang mở, nằm ở giữa bàn làm việc.';
export const MOCK_DELAY_MS = 1500;
