// Nhãn lớp COCO — chỉ số → khoá tiếng Anh → nhãn tiếng Việt.
// Chỉ số lớp trong tensor đầu ra của EfficientDet-Lite0 tra thẳng vào
// COCO_LABELS (0-based, 90 phần tử — xem ghi chú ở đó).
// tfliteDetector.ts dùng để parse output, obstacleDetector.ts dùng để đọc tên vật.

/** English label → Vietnamese label for obstacle announcements. */
export const COCO_LABEL_VI: Record<string, string> = {
  person: 'người',
  bicycle: 'xe đạp',
  car: 'ô tô',
  motorcycle: 'xe máy',
  airplane: 'máy bay',
  bus: 'xe buýt',
  train: 'tàu hỏa',
  truck: 'xe tải',
  boat: 'thuyền',
  'traffic light': 'đèn giao thông',
  'fire hydrant': 'trụ cứu hỏa',
  'stop sign': 'biển dừng',
  'parking meter': 'đồng hồ đỗ xe',
  bench: 'ghế dài',
  bird: 'chim',
  cat: 'mèo',
  dog: 'chó',
  horse: 'ngựa',
  sheep: 'cừu',
  cow: 'bò',
  elephant: 'voi',
  bear: 'gấu',
  zebra: 'ngựa vằn',
  giraffe: 'hươu cao cổ',
  backpack: 'ba lô',
  umbrella: 'cây dù',
  handbag: 'túi xách',
  tie: 'cà vạt',
  suitcase: 'vali',
  frisbee: 'đĩa bay',
  skis: 'ván trượt tuyết',
  snowboard: 'ván trượt tuyết',
  'sports ball': 'bóng',
  kite: 'diều',
  'baseball bat': 'gậy bóng chày',
  'baseball glove': 'găng tay bóng chày',
  skateboard: 'ván trượt',
  surfboard: 'ván lướt',
  'tennis racket': 'vợt tennis',
  bottle: 'chai nước',
  'wine glass': 'ly rượu',
  cup: 'cốc',
  fork: 'nĩa',
  knife: 'dao',
  spoon: 'thìa',
  bowl: 'bát',
  banana: 'chuối',
  apple: 'táo',
  sandwich: 'bánh mì',
  orange: 'cam',
  broccoli: 'bông cải',
  carrot: 'cà rốt',
  'hot dog': 'xúc xích',
  pizza: 'bánh pizza',
  donut: 'bánh rán',
  cake: 'bánh ngọt',
  chair: 'ghế',
  couch: 'ghế sô pha',
  'potted plant': 'chậu cây',
  bed: 'giường',
  'dining table': 'bàn ăn',
  toilet: 'bồn cầu',
  tv: 'tivi',
  laptop: 'máy tính',
  mouse: 'chuột máy tính',
  remote: 'điều khiển',
  keyboard: 'bàn phím',
  'cell phone': 'điện thoại',
  microwave: 'lò vi sóng',
  oven: 'lò nướng',
  toaster: 'máy nướng bánh',
  sink: 'bồn rửa',
  refrigerator: 'tủ lạnh',
  book: 'sách',
  clock: 'đồng hồ',
  vase: 'bình hoa',
  scissors: 'kéo',
  'teddy bear': 'gấu bông',
  'hair drier': 'máy sấy tóc',
  toothbrush: 'bàn chải đánh răng',
};

/**
 * Chỉ số lớp do model trả về (0-based) → nhãn tiếng Anh.
 *
 * Đây là bảng nhãn 90 dòng NHÚNG TRONG chính file model
 * (`assets/models/efficientdet_lite0.tflite` → `labels.txt`), không phải danh
 * sách 80 lớp COCO liền mạch. Bảng của TF Object Detection API chừa 10 ô trống
 * cho các ID không dùng (11, 25, 28, 29, 44, 65, 67, 68, 70, 82) — trong
 * labels.txt gốc chúng là '???', ở đây để chuỗi rỗng vì không có nhãn nào để
 * đọc lên.
 *
 * Bỏ 10 ô trống này đi là mọi lớp từ chỉ số 11 trở lên bị lệch: model thấy
 * `chair` (61) thì app đọc thành `toilet`. Muốn kiểm chứng lại:
 *   unzip -p assets/models/efficientdet_lite0.tflite labels.txt
 */
export const COCO_LABELS: readonly string[] = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus',
  'train', 'truck', 'boat', 'traffic light', 'fire hydrant', '',
  'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
  'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', '', 'backpack', 'umbrella', '', '',
  'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
  'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', '', 'wine glass', 'cup', 'fork',
  'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich',
  'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut',
  'cake', 'chair', 'couch', 'potted plant', 'bed', '',
  'dining table', '', '', 'toilet', '', 'tv',
  'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave',
  'oven', 'toaster', 'sink', 'refrigerator', '', 'book',
  'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
];
