// All user-facing strings (Vietnamese). Code identifiers stay English.

import { COCO_LABEL_VI } from './cocoLabels';

export const GEMINI_SYSTEM_INSTRUCTION =
  'Bạn là trợ lý thị giác hỗ trợ người khiếm thị dựa trên hình ảnh. ' +
  'Luôn trả lời bằng tiếng Việt tự nhiên, đơn giản, dễ hiểu và dễ nghe khi đọc thành tiếng. ' +
  'Trả lời trực tiếp câu hỏi của người dùng dựa trên những gì nhìn thấy trong ảnh. ' +
  'Mỗi câu trả lời gồm 2 đến 3 câu ngắn, tổng độ dài tối đa 150 ký tự. ' +
  'Nếu cần mô tả nhiều đối tượng, mô tả theo thứ tự từ trái sang phải. ' +
  'Chỉ mô tả những chi tiết có thể quan sát được từ ảnh. Không suy đoán hoặc tự thêm thông tin không có căn cứ. ' +
  'Nếu không chắc chắn về một chi tiết, hãy nói rõ bằng các cách như "Tôi không chắc" hoặc "Có vẻ là". ' +
  'Nếu không thể xác định câu trả lời từ ảnh, hãy nói ngắn gọn rằng không thể xác định từ ảnh hiện tại. ' +
  'Không dùng Markdown, danh sách, ký hiệu trang trí, biểu tượng cảm xúc hoặc cách trình bày khó nghe khi đọc thành tiếng. ' +
  'Không thêm giải thích ngoài nội dung cần thiết để trả lời câu hỏi.';

export const DESCRIBE_PROMPT = 'Hãy mô tả bức ảnh này cho người khiếm thị.';

export const KEYWORDS: Record<
  'capture' | 'question' | 'repeat' | 'back' | 'obstacle' | 'stop' | 'settings',
  string[]
> = {
  capture: ['chụp', 'chụp ảnh', 'chup', 'chup anh'],
  question: ['hỏi', 'hoi', 'đặt câu hỏi', 'dat cau hoi'],
  repeat: ['đọc lại', 'doc lai', 'nghe lại', 'nghe lai', 'nói lại', 'noi lai'],
  back: ['quay lại', 'quay lai', 'trở về', 'tro ve', 'thoát', 'thoat'],
  obstacle: [
    'vật cản',
    'vat can',
    'dò vật cản',
    'do vat can',
    'dò đường',
    'do duong',
    'cảnh báo',
    'canh bao',
  ],
  stop: ['dừng', 'dừng lại', 'dung lai', 'im lặng', 'im lang', 'tắt', 'tat'],
  settings: ['cài đặt', 'cai dat', 'thiết lập', 'thiet lap'],
};

export const NAV = {
  HOME:
    "Màn hình máy ảnh. Nói 'chụp ảnh', bấm phím âm lượng, hoặc chạm vùng dưới màn hình để chụp. " +
    "Nói 'dò vật cản' hoặc 'cài đặt' để mở chế độ khác.",
  QA:
    'Hỏi đáp về ảnh. Sau tiếng bíp, hãy đặt câu hỏi. ' +
    "Bấm giữ phím âm lượng hoặc vùng dưới màn hình để nói. Nói 'quay lại' để về máy ảnh.",
  OBSTACLE:
    'Chế độ dò vật cản đang bật. Giữ điện thoại trước ngực, camera hướng về phía trước. ' +
    "Nói 'dừng lại' hoặc chạm vùng dưới màn hình để dừng.",
  SETTINGS:
    'Màn hình cài đặt. Gồm tốc độ đọc, cao độ giọng, độ nhạy dò vật cản, và nghe thử giọng đọc. ' +
    "Nói 'quay lại' để thoát.",
};

export const STATE = {
  LISTENING: 'Đang nghe',
  THINKING: 'Đang xử lý',
  SPEAKING: 'Đang đọc',
};

export const CAPTURE = {
  SHUTTER_LABEL: 'Chụp ảnh',
  ANALYZING: 'Đã chụp. Đang phân tích, vui lòng chờ.',
  RESULT_HINT:
    "Nói 'hỏi' để đặt câu hỏi, 'chụp tiếp' để chụp ảnh mới, hoặc 'đọc lại' để nghe lại.",
  BACK_TO_CAMERA: 'Đã quay lại chế độ máy ảnh.',
  NO_IMAGE_YET: 'Chưa có ảnh nào. Hãy chụp ảnh trước.',
};

export const HOME = {
  BOOTING: 'Đang khởi động VisionVoice...',
  GALLERY_LABEL: 'Chọn ảnh từ thư viện',
  GALLERY_HINT: 'Mở thư viện ảnh để chọn một ảnh cần mô tả.',
  SETTINGS_HINT: 'Mở màn hình cài đặt.',
  OBSTACLE_HINT: 'Bật chế độ dò vật cản.',
  ASK_ABOUT_IMAGE: 'Hỏi về ảnh này',
  ASK_HINT: 'Mở màn hình hỏi đáp về ảnh vừa chụp.',
  NEW_CAPTURE: 'Chụp ảnh mới',
  READ_AGAIN: 'Đọc lại mô tả',
};

export const QA = {
  ASK_PROMPT: 'Bạn muốn hỏi gì về bức ảnh?',
  NOT_HEARD: 'Tôi chưa nghe rõ. Vui lòng hỏi lại sau tiếng bíp.',
  EXIT: 'Đã quay lại màn hình máy ảnh.',
  BACK: 'Quay lại',
  BACK_HINT: 'Kết thúc hỏi đáp và quay về màn hình máy ảnh.',
  IMAGE_LABEL: 'Ảnh đang được hỏi đáp',
  HOLD_TO_ASK: 'Giữ để đặt câu hỏi',
  HOLD_HINT: 'Giữ trong khi nói, thả ra khi nói xong',
  MIC_CAPTION: 'Giữ để nói, hoặc bấm phím âm lượng',
  TURN_USER: (text: string) => `Bạn hỏi: ${text}`,
  TURN_ASSISTANT: (text: string) => `Trả lời: ${text}`,
};

export const OBSTACLE = {
  BANNER_SAFE: 'AN TOÀN',
  BANNER_WARNING: 'VẬT CẢN',
  BANNER_DANGER: 'NGUY HIỂM',
  SAFE: 'Đường trống.',
  WARNING: 'Vật cản phía trước.',
  WARNING_WITH_LABEL: (label: string) => `Vật cản phía trước: ${label}.`,
  DANGER: 'Dừng lại! Vật cản rất gần.',
  EXIT: 'Đã tắt chế độ dò vật cản.',
  STOP_BUTTON: 'Dừng dò vật cản',
  STOP_HINT: 'Dừng quét vật cản và quay về màn hình máy ảnh.',
  LABEL_VI: COCO_LABEL_VI,
};

export const ERRORS = {
  network: 'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.',
  blocked: 'Ảnh này không thể mô tả được. Vui lòng thử ảnh khác.',
  quota: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.',
  unknown: 'Đã xảy ra lỗi khi phân tích ảnh. Vui lòng thử lại.',
  NO_VI_VOICE:
    'Thiết bị chưa có giọng đọc tiếng Việt. ' +
    'Vui lòng cài Google Text-to-Speech và dữ liệu tiếng Việt trong phần Cài đặt điện thoại.',
  GALLERY: 'Không thể mở thư viện ảnh.',
};

export const SETTINGS = {
  SPEECH_RATE: 'Tốc độ đọc',
  SPEECH_PITCH: 'Cao độ giọng',
  OBSTACLE_SENSITIVITY: 'Độ nhạy dò vật cản',
  SENSITIVITY_LOW: 'Thấp',
  SENSITIVITY_MEDIUM: 'Vừa',
  SENSITIVITY_HIGH: 'Cao',
  TEST_VOICE: 'Nghe thử giọng đọc',
  EXPORT_METRICS: 'Xuất nhật ký đánh giá',
  CLEAR_METRICS: 'Xoá nhật ký',
  BACK: 'Quay lại',
  TEST_SENTENCE: 'Đây là giọng đọc của VisionVoice.',
  ABOUT:
    'VisionVoice — mô tả ảnh và hỏi đáp bằng Gemini qua Firebase AI Logic, ' +
    'cảnh báo vật cản bằng MediaPipe trên thiết bị.',
  EXIT: 'Đã đóng cài đặt.',
  SAMPLE_RATE: 'Đây là tốc độ đọc mới.',
  SAMPLE_PITCH: 'Đây là cao độ giọng mới.',
  CLEARED: 'Đã xoá nhật ký đánh giá.',
  RATE_UP: 'Tăng tốc độ đọc',
  RATE_DOWN: 'Giảm tốc độ đọc',
  PITCH_UP: 'Tăng cao độ giọng',
  PITCH_DOWN: 'Giảm cao độ giọng',
  BACK_HINT: 'Đóng cài đặt và quay về màn hình máy ảnh.',
  EXPORT_HINT: 'Mở bảng chia sẻ để gửi tệp nhật ký đánh giá.',
  CLEAR_HINT: 'Xoá toàn bộ nhật ký đánh giá đã ghi.',
};

export const SCREEN_TITLES = {
  HOME: 'Máy ảnh',
  QA: 'Hỏi đáp về ảnh',
  OBSTACLE: 'Dò vật cản',
  SETTINGS: 'Cài đặt',
};

export const PERMISSIONS = {
  MIC_REQUEST:
    'VisionVoice cần quyền sử dụng micro để nhận lệnh giọng nói. ' +
    'Vui lòng nhấn đúp vào nút Cho phép trên màn hình.',
  MIC_DENIED: 'Không có quyền micro, bạn sẽ không thể điều khiển bằng giọng nói.',
  CAMERA_REQUEST:
    'VisionVoice cần quyền truy cập Camera để nhận diện hình ảnh. ' +
    'Vui lòng nhấn đúp vào nút Cho phép tiếp theo.',
  CAMERA_DENIED: 'Không có quyền camera, ứng dụng không thể nhận diện hình ảnh giúp bạn.',
  WELCOME: 'Xin chào! VisionVoice đã sẵn sàng.',
};
