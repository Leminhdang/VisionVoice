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
 * Màu đệm letterbox, dạng byte uint8. 128 chứ không phải 0: sau dequantize
 * (128 − 127) / 128 ≈ 0, khớp đúng vùng đệm 0 của tiền xử lý EfficientDet gốc.
 * Đệm 0 (đen) thành −1 sau chuẩn hoá, tạo viền giả rất đậm quanh ảnh.
 */
export const TFLITE_MODEL_PAD_BYTE = 128;
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

/**
 * Model được chép ra thư mục documents (KHÔNG phải cache) rồi nạp từ đó.
 *
 * `Asset.downloadAsync()` chỉ ghi vào cacheDirectory — thư mục mà tài liệu của
 * chính expo-asset ghi là hệ điều hành được phép xoá bất cứ lúc nào. Mất bản
 * cache nghĩa là bản dev phải kéo lại 4,5 MB từ Metro, tức là chế độ dò vật
 * cản chết khi không có mạng. Documents không bị dọn tự động.
 *
 * Tên file mang số phiên bản: đổi file .tflite trong assets/ thì tăng số này,
 * bản cũ trên máy người dùng tự khắc bị bỏ thay vì bị nạp nhầm.
 */
export const OBSTACLE_MODEL_DIR_NAME = 'models';
export const OBSTACLE_MODEL_FILE_NAME = 'efficientdet_lite0_detection.v1.tflite';
/**
 * Kích thước đúng của assets/models/efficientdet_lite0_detection.tflite.
 * Bắt bản chép dở (app bị kill giữa lúc chép) — rẻ hơn hẳn băm MD5 4,5 MB mỗi
 * lần mở app. Phải sửa cùng lúc khi đổi model.
 */
export const OBSTACLE_MODEL_SIZE_BYTES = 4_563_519;
/**
 * Chờ bấy nhiêu trước khi báo "đang chuẩn bị". Đường ấm (model đã nạp sẵn lúc
 * mở app) chuyển sang 'loaded' trong vài microtask nên timer bị huỷ trước khi
 * kịp chạy — không nghe câu thừa ở mỗi lần vào chế độ.
 */
export const OBSTACLE_MODEL_NOTICE_DELAY_MS = 600;

export const OBSTACLE_SCORE_MIN = 0.35;
/**
 * Cạnh ĐÁY của bbox phải nằm dưới mốc này (tỉ lệ theo chiều cao khung) thì vật
 * mới được tính là nằm trên đường đi.
 *
 * Diện tích bbox một mình là thước đo khoảng cách rất yếu: ô tô bên kia đường
 * và cái ghế cách một mét cho diện tích như nhau. Với camera đeo ngực hướng
 * thẳng, vật đặt trên mặt đất càng gần thì đáy càng tụt xuống thấp trong
 * khung, nên đáy bbox là tín hiệu khoảng cách tốt hơn hẳn — và vật có đáy nằm
 * ở nửa trên khung thì gần như chắc chắn ở xa, hoặc ở trên cao ngoài lối đi.
 *
 * HẠN CHẾ ĐÃ BIẾT: lọc theo mặt phẳng nền nên vật treo lơ lửng (biển hiệu
 * thấp, cành cây) có thể bị loại oan. Những vật đó phần lớn không nằm trong
 * COCO nên model vốn đã không thấy; đặt về 0 để tắt hẳn bộ lọc này.
 */
export const OBSTACLE_MIN_BOTTOM_RATIO = 0.45;
/**
 * Số khung liên tiếp phải cùng thấy vật cản (hoặc cùng thấy đường trống) trước
 * khi được phép nói ra.
 *
 * Trước đây một khung nhiễu duy nhất đủ để hét "Dừng lại!". Đổi lại, cảnh báo
 * bị trễ thêm (N − 1) × OBSTACLE_ASSESSMENT_THROTTLE_MS — với N = 2 là ~0,9 s.
 * Đây là đánh đổi an toàn có thật, chỉnh xuống 1 là tắt hẳn xác nhận.
 *
 * Đếm theo "có vật cản / không có vật cản" chứ không theo từng mức severity:
 * nếu đếm theo severity thì chuỗi warning/danger/warning xen kẽ sẽ không bao
 * giờ đủ N khung cùng mức, thành ra im lặng — mà im lặng bị hiểu là đường
 * trống, đúng thứ nguy hiểm nhất.
 */
export const OBSTACLE_CONFIRM_FRAMES = 2;
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
/** Số khung dò hỏng liên tiếp trước khi báo cho người dùng và dừng vòng quét. */
export const OBSTACLE_MAX_DETECT_FAILURES = 5;
/**
 * Độ phân giải ảnh yêu cầu ở photoOutput. Mặc định của VisionCamera là
 * UHD_4_3 (3024×4032 — 12 megapixel), quá lớn cho cả hai nhu cầu ở đây và là
 * nguyên nhân chính khiến mỗi khung dò mất ~1,5 giây.
 */
// Ảnh gửi Gemini: pipeline hạ về IMAGE_RESIZE_WIDTH nên không cần cao hơn.
export const CAPTURE_PHOTO_RESOLUTION = { width: 1440, height: 1920 };

// Voice / ASR timing
export const ASR_RESTART_ON_END_MS = 500;
export const ASR_RESTART_ON_ERROR_MS = 2000;
export const ASR_MAX_CONSECUTIVE_ERRORS = 5;
export const ASR_MAX_BACKOFF_MS = 30_000;
export const TTS_GUARD_DELAY_MS = 400;
export const QA_RELISTEN_DELAY_MS = 800;
/**
 * Câu hỏi được chốt sau khi người dùng ngừng nói bấy nhiêu mili giây.
 * Cần thiết vì ASR `continuous` trên Android có thể không bao giờ gửi isFinal.
 */
export const QA_SILENCE_COMMIT_MS = 1200;
/** Chặn một lệnh giọng nói lặp lại — xem ghi chú trong useVoiceControl. */
export const VOICE_INTENT_COOLDOWN_MS = 2000;

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
/**
 * Nhật ký chẩn đoán luồng nhận dạng giọng nói — lọc bằng `adb logcat | grep VVASR`.
 * Mặc định TẮT vì rất ồn; bật lên khi cần dựng lại lỗi "không nhận lệnh".
 */
export const ASR_TRACE_ENABLED = false;

// Mock data
export const MOCK_DESCRIPTION =
  'Đây là chế độ thử nghiệm. Trong ảnh có một không gian sáng với ánh đèn tự nhiên. ' +
  'Phía trước là một bàn làm việc với máy tính xách tay màu bạc đang mở. ' +
  'Bên cạnh là một tách cà phê và vài tờ giấy ghi chú.';
export const MOCK_QA_ANSWER =
  'Chiếc máy tính xách tay màu bạc đang mở, nằm ở giữa bàn làm việc.';
export const MOCK_DELAY_MS = 1500;
