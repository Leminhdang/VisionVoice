// Gemini models (Firebase AI Logic)
export const GEMINI_MODEL = 'gemini-3.6-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

// Image capture & processing
export const CAPTURE_QUALITY = 0.4;
export const IMAGE_RESIZE_WIDTH = 800;
export const IMAGE_COMPRESS = 0.5;
export const TARGET_PICTURE_SIZE = 1280;
export const DETECTION_FRAME_QUALITY = 0.2;

// Obstacle detection
export const OBSTACLE_SCAN_INTERVAL_MS = 900;
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
