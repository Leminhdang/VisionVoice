// All user-facing strings (Vietnamese). Code identifiers stay English.

export const GEMINI_SYSTEM_INSTRUCTION =
  'Bạn là trợ lý thị giác cho người khiếm thị. ' +
  'Luôn trả lời bằng 2 đến 4 câu ngắn, tiếng Việt thuần, dễ nghe khi đọc to. ' +
  'Không dùng markdown, ký hiệu đặc biệt, danh sách hay biểu tượng. ' +
  'Mô tả bố cục theo thứ tự từ trái sang phải. ' +
  'Thông tin về nguy hiểm hoặc an toàn phải nói trước tiên. ' +
  'Nếu không chắc chắn về chi tiết nào, hãy nói rõ là không chắc.';

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

export const CAPTURE = {
  ANALYZING: 'Đã chụp. Đang phân tích, vui lòng chờ.',
  RESULT_HINT:
    "Nói 'hỏi' để đặt câu hỏi, 'chụp tiếp' để chụp ảnh mới, hoặc 'đọc lại' để nghe lại.",
  BACK_TO_CAMERA: 'Đã quay lại chế độ máy ảnh.',
  NO_IMAGE_YET: 'Chưa có ảnh nào. Hãy chụp ảnh trước.',
};

export const QA = {
  ASK_PROMPT: 'Bạn muốn hỏi gì về bức ảnh?',
  NOT_HEARD: 'Tôi chưa nghe rõ. Vui lòng hỏi lại sau tiếng bíp.',
  EXIT: 'Đã quay lại màn hình máy ảnh.',
};

const OBSTACLE_LABEL_VI: Record<string, string> = {
  person: 'người',
  chair: 'ghế',
  table: 'bàn',
  car: 'ô tô',
  motorcycle: 'xe máy',
  bicycle: 'xe đạp',
  dog: 'chó',
  cat: 'mèo',
  door: 'cửa',
  tree: 'cây',
  stairs: 'cầu thang',
  wall: 'tường',
  pole: 'cột',
  bench: 'ghế dài',
  truck: 'xe tải',
  bus: 'xe buýt',
  bottle: 'chai nước',
  couch: 'ghế sô pha',
  bed: 'giường',
  plant: 'chậu cây',
  umbrella: 'cây dù',
};

export const OBSTACLE = {
  SAFE: 'Đường trống.',
  WARNING: 'Vật cản phía trước.',
  WARNING_WITH_LABEL: (label: string) => `Vật cản phía trước: ${label}.`,
  DANGER: 'Dừng lại! Vật cản rất gần.',
  EXIT: 'Đã tắt chế độ dò vật cản.',
  LABEL_VI: OBSTACLE_LABEL_VI,
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
    'cảnh báo vật cản bằng ML Kit trên thiết bị.',
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
