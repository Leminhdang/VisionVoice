// ============================================================
// App-wide constants
// ============================================================

/** Thay bằng IPv4 của máy tính đang chạy backend (port 3000) */
export const API_BASE_URL = 'http://192.168.2.13:3000';

/** Debounce (ms) giữa các lần chụp liên tiếp */
export const CAPTURE_DEBOUNCE_MS = 2000;

/** Timeout gọi API (ms) */
export const API_TIMEOUT_MS = 30_000;

/** Keyword giọng nói kích hoạt chụp ảnh (lowercase) */
export const CAPTURE_KEYWORDS: string[] = ['chụp', 'chụp ảnh', 'chup', 'chup anh'];

/** Ngôn ngữ nhận dạng giọng nói */
export const SPEECH_RECOGNITION_LOCALE = 'vi-VN';

/** Ngôn ngữ đọc kết quả */
export const TTS_LOCALE = 'vi-VN';

/** Thông báo lỗi khi API thất bại */
export const ERROR_MESSAGE = 'Không thể nhận diện ảnh, vui lòng thử lại.';

/**
 * Bật chế độ giả lập (mock) khi chưa có backend.
 * Đặt thành false khi backend đã sẵn sàng.
 */
export const MOCK_MODE = false;

/**
 * Câu đọc ngay sau khi chụp, báo hiệu đang xử lý.
 * Người dùng nghe thấy ngay lập tức, không phải chờ im lặng.
 */
export const CAPTURE_FEEDBACK_PHRASE = 'Đã chụp ảnh. Đang phân tích, vui lòng chờ.';

/**
 * Mô tả giả (dùng khi MOCK_MODE = true).
 * Thay bằng nội dung thực tế để test giọng đọc.
 */
export const MOCK_DESCRIPTION =
  'Đây là chế độ thử nghiệm. Trong ảnh có một không gian sáng với ánh đèn tự nhiên. ' +
  'Phía trước là một bàn làm việc với máy tính xách tay màu bạc đang mở. ' +
  'Bên cạnh là một tách cà phê và vài tờ giấy ghi chú.';
