// Chuẩn bị model dò vật cản đúng một lần cho cả vòng đời bản cài đặt.
//
// File .tflite là asset của Metro, KHÔNG phải file nằm sẵn trên đĩa:
// - bản release: nằm trong APK (Android res/raw) / trong app bundle (iOS);
// - bản dev: Metro phục vụ qua http, chưa hề có trên máy.
// expo-asset materialise nó ra cacheDirectory — đúng thư mục mà tài liệu của
// chính expo-asset ghi là hệ điều hành được phép xoá bất cứ lúc nào. Xoá xong
// thì bản dev phải có Metro mới chạy lại được, tức là chế độ dò vật cản không
// dùng offline được, trái với thiết kế.
//
// Nên ở đây chép model một lần sang Paths.document (vùng hệ điều hành không tự
// dọn) rồi từ đó về sau nạp thẳng từ bản chép, không đụng expo-asset nữa.

import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TensorflowModel } from 'react-native-fast-tflite';

import {
  OBSTACLE_MODEL_DIR_NAME,
  OBSTACLE_MODEL_FILE_NAME,
  OBSTACLE_MODEL_SIZE_BYTES,
  TFLITE_DELEGATES,
} from '../constants/config';
import { OBSTACLE } from '../constants/strings';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET: number = require('../../assets/models/efficientdet_lite0_detection.tflite');

/**
 * Model đã nạp, dùng chung cho mọi lần vào chế độ dò vật cản.
 *
 * fast-tflite trên Android đọc model bằng đúng một dòng `URL(path).readBytes()`
 * (HybridAssetLoader.kt) nên không nhận thẳng require(): bản dev trả URL http
 * tới Metro, bản release trả TÊN RESOURCE TRẦN không có giao thức
 * ("models_efficientdet_lite0_detection") làm `URL()` ném "no protocol".
 *
 * Giữ ở cấp module chứ không trong hook: màn hình ObstacleMode thoát là
 * unmount, hook nào giữ model cũng mất theo — mỗi lần vào lại sẽ parse lại
 * 4,5 MB và dựng lại delegate GPU.
 *
 * Rơi về null khi nạp hỏng để lần vào sau còn thử lại được; nạp xong thì giữ
 * trọn vòng đời app, cố ý không dispose (giống tts.ts và firebase.ts).
 */
let modelPromise: Promise<TensorflowModel> | null = null;

/**
 * Đường dẫn model trong vùng nhớ bền, chép ra từ asset nếu chưa có hoặc bản
 * đang có sai kích thước.
 *
 * Kiểm bằng số byte chứ không băm nội dung: băm 4,5 MB tốn vài chục mili giây
 * mỗi lần mở app trong khi chỉ cần bắt được bản cụt. Model đổi mà số byte
 * trùng thì số phiên bản trong tên file lo nốt.
 */
async function ensureModelFile(): Promise<File> {
  const directory = new Directory(Paths.document, OBSTACLE_MODEL_DIR_NAME);
  directory.create({ intermediates: true, idempotent: true });

  const file = new File(directory, OBSTACLE_MODEL_FILE_NAME);
  if (file.exists && file.size === OBSTACLE_MODEL_SIZE_BYTES) {
    return file;
  }

  const asset = Asset.fromModule(MODEL_ASSET);
  await asset.downloadAsync();
  if (asset.localUri == null) {
    throw new Error(OBSTACLE.MODEL_NO_LOCAL_URI);
  }
  // overwrite: đè thẳng lên bản cụt còn sót, khỏi phải xoá trước.
  await new File(asset.localUri).copy(file, { overwrite: true });

  if (file.size !== OBSTACLE_MODEL_SIZE_BYTES) {
    throw new Error(OBSTACLE.MODEL_COPY_INVALID(file.size));
  }
  return file;
}

/**
 * Nạp model, dùng lại lần nạp trước nếu có.
 *
 * Hai lần mount sát nhau nhận cùng một promise nên chỉ nạp một lần thật. Nạp
 * hỏng thì bỏ cache promise: delegate GPU từ chối model là đường hỏng có thật
 * (tài liệu fast-tflite ghi rõ delegate tăng tốc "không chạy được với mọi
 * model"), và người dùng được bảo "quay lại và thử lại" — lời hứa đó chỉ đúng
 * nếu lần gọi sau thực sự nạp lại.
 */
export function loadObstacleModel(): Promise<TensorflowModel> {
  if (modelPromise !== null) {
    return modelPromise;
  }

  const pending = ensureModelFile().then((file) =>
    loadTensorflowModel({ url: file.uri }, TFLITE_DELEGATES),
  );
  modelPromise = pending;
  // So sánh danh tính trước khi xoá: lần thử lại đang bay không được bị lần
  // hỏng trước đó đạp đổ.
  void pending.catch(() => {
    if (modelPromise === pending) {
      modelPromise = null;
    }
  });

  return pending;
}
