// COCO class labels for EfficientDet-Lite0.
// Model outputs 90 class indices (0-89), corresponding to COCO IDs 1-90.
// 10 indices are "ghost" classes (COCO IDs 12,26,29,30,45,66,68,69,71,83 don't exist).

/**
 * 90-element array: model output index → English label.
 * null entries are ghost classes that the model never fires on.
 */
export const COCO_90_LABELS: readonly (string | null)[] = [
  'person',         // 0 → COCO ID 1
  'bicycle',        // 1 → COCO ID 2
  'car',            // 2 → COCO ID 3
  'motorcycle',     // 3 → COCO ID 4
  'airplane',       // 4 → COCO ID 5
  'bus',            // 5 → COCO ID 6
  'train',          // 6 → COCO ID 7
  'truck',          // 7 → COCO ID 8
  'boat',           // 8 → COCO ID 9
  'traffic light',  // 9 → COCO ID 10
  'fire hydrant',   // 10 → COCO ID 11
  null,             // 11 → COCO ID 12 (ghost)
  'stop sign',      // 12 → COCO ID 13
  'parking meter',  // 13 → COCO ID 14
  'bench',          // 14 → COCO ID 15
  'bird',           // 15 → COCO ID 16
  'cat',            // 16 → COCO ID 17
  'dog',            // 17 → COCO ID 18
  'horse',          // 18 → COCO ID 19
  'sheep',          // 19 → COCO ID 20
  'cow',            // 20 → COCO ID 21
  'elephant',       // 21 → COCO ID 22
  'bear',           // 22 → COCO ID 23
  'zebra',          // 23 → COCO ID 24
  'giraffe',        // 24 → COCO ID 25
  null,             // 25 → COCO ID 26 (ghost)
  'backpack',       // 26 → COCO ID 27
  'umbrella',       // 27 → COCO ID 28
  null,             // 28 → COCO ID 29 (ghost)
  null,             // 29 → COCO ID 30 (ghost)
  'handbag',        // 30 → COCO ID 31
  'tie',            // 31 → COCO ID 32
  'suitcase',       // 32 → COCO ID 33
  'frisbee',        // 33 → COCO ID 34
  'skis',           // 34 → COCO ID 35
  'snowboard',      // 35 → COCO ID 36
  'sports ball',    // 36 → COCO ID 37
  'kite',           // 37 → COCO ID 38
  'baseball bat',   // 38 → COCO ID 39
  'baseball glove', // 39 → COCO ID 40
  'skateboard',     // 40 → COCO ID 41
  'surfboard',      // 41 → COCO ID 42
  'tennis racket',  // 42 → COCO ID 43
  'bottle',         // 43 → COCO ID 44
  null,             // 44 → COCO ID 45 (ghost)
  'wine glass',     // 45 → COCO ID 46
  'cup',            // 46 → COCO ID 47
  'fork',           // 47 → COCO ID 48
  'knife',          // 48 → COCO ID 49
  'spoon',          // 49 → COCO ID 50
  'bowl',           // 50 → COCO ID 51
  'banana',         // 51 → COCO ID 52
  'apple',          // 52 → COCO ID 53
  'sandwich',       // 53 → COCO ID 54
  'orange',         // 54 → COCO ID 55
  'broccoli',       // 55 → COCO ID 56
  'carrot',         // 56 → COCO ID 57
  'hot dog',        // 57 → COCO ID 58
  'pizza',          // 58 → COCO ID 59
  'donut',          // 59 → COCO ID 60
  'cake',           // 60 → COCO ID 61
  'chair',          // 61 → COCO ID 62
  'couch',          // 62 → COCO ID 63
  'potted plant',   // 63 → COCO ID 64
  'bed',            // 64 → COCO ID 65
  null,             // 65 → COCO ID 66 (ghost)
  'dining table',   // 66 → COCO ID 67
  null,             // 67 → COCO ID 68 (ghost)
  null,             // 68 → COCO ID 69 (ghost)
  'toilet',         // 69 → COCO ID 70
  null,             // 70 → COCO ID 71 (ghost)
  'tv',             // 71 → COCO ID 72
  'laptop',         // 72 → COCO ID 73
  'mouse',          // 73 → COCO ID 74
  'remote',         // 74 → COCO ID 75
  'keyboard',       // 75 → COCO ID 76
  'cell phone',     // 76 → COCO ID 77
  'microwave',      // 77 → COCO ID 78
  'oven',           // 78 → COCO ID 79
  'toaster',        // 79 → COCO ID 80
  'sink',           // 80 → COCO ID 81
  'refrigerator',   // 81 → COCO ID 82
  null,             // 82 → COCO ID 83 (ghost)
  'book',           // 83 → COCO ID 84
  'clock',          // 84 → COCO ID 85
  'vase',           // 85 → COCO ID 86
  'scissors',       // 86 → COCO ID 87
  'teddy bear',     // 87 → COCO ID 88
  'hair drier',     // 88 → COCO ID 89
  'toothbrush',     // 89 → COCO ID 90
];

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
