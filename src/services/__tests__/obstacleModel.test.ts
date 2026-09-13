import {
  OBSTACLE_MODEL_DIR_NAME,
  OBSTACLE_MODEL_FILE_NAME,
  OBSTACLE_MODEL_SIZE_BYTES,
  TFLITE_DELEGATES,
} from '../../constants/config';
import { OBSTACLE } from '../../constants/strings';

/**
 * Hệ thống file giả: chỉ cần ánh xạ uri → số byte, vì service chỉ hỏi đúng
 * `exists` và `size`.
 */
const mockFileSizes = new Map<string, number>();
const mockDownloadAsync = jest.fn();
const mockLoadTensorflowModel = jest.fn();
let mockAssetLocalUri: string | null = null;

const DOCUMENT_URI = 'file:///doc';
const ASSET_URI = 'file:///cache/ExponentAsset-abc.tflite';
const MODEL_URI = `${DOCUMENT_URI}/${OBSTACLE_MODEL_DIR_NAME}/${OBSTACLE_MODEL_FILE_NAME}`;

/** Đứng thay TensorflowModel — các test chỉ so sánh định danh. */
const MODEL_HANDLE = { name: 'efficientdet' };

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({
      localUri: mockAssetLocalUri,
      downloadAsync: mockDownloadAsync,
    }),
  },
}));

jest.mock('expo-file-system', () => {
  // Không đặt type alias cục bộ trong factory này: babel-plugin-jest-hoist
  // quét mọi định danh được tham chiếu, kể cả tên kiểu, và chặn factory lại.
  const join = (segments: (string | { uri: string })[]): string =>
    segments
      .map((segment) => (typeof segment === 'string' ? segment : segment.uri))
      .join('/');

  class MockDirectory {
    readonly uri: string;
    constructor(...segments: (string | { uri: string })[]) {
      this.uri = join(segments);
    }
    create(): void {
      // Thư mục giả luôn tồn tại — service chỉ cần create() không ném.
    }
  }

  class MockFile {
    readonly uri: string;
    constructor(...segments: (string | { uri: string })[]) {
      this.uri = join(segments);
    }
    get exists(): boolean {
      return mockFileSizes.has(this.uri);
    }
    get size(): number {
      return mockFileSizes.get(this.uri) ?? 0;
    }
    copy(destination: { uri: string }): Promise<void> {
      mockFileSizes.set(destination.uri, mockFileSizes.get(this.uri) ?? 0);
      return Promise.resolve();
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: { uri: 'file:///doc' } },
  };
});

jest.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: mockLoadTensorflowModel,
}));

let obstacleModel: typeof import('../obstacleModel');

beforeEach(() => {
  jest.clearAllMocks();
  mockFileSizes.clear();
  mockAssetLocalUri = ASSET_URI;
  // downloadAsync materialise asset ra cacheDirectory.
  mockDownloadAsync.mockImplementation(() => {
    mockFileSizes.set(ASSET_URI, OBSTACLE_MODEL_SIZE_BYTES);
    return Promise.resolve();
  });
  mockLoadTensorflowModel.mockResolvedValue(MODEL_HANDLE);

  // obstacleModel giữ model ở module scope — nạp lại để mỗi test độc lập.
  jest.resetModules();
  obstacleModel = jest.requireActual<typeof import('../obstacleModel')>(
    '../obstacleModel',
  );
});

describe('loadObstacleModel', () => {
  test('chép model ra vùng nhớ bền rồi nạp từ chính bản chép đó', async () => {
    // Act
    await obstacleModel.loadObstacleModel();

    // Assert
    expect(mockFileSizes.get(MODEL_URI)).toBe(OBSTACLE_MODEL_SIZE_BYTES);
    expect(mockLoadTensorflowModel).toHaveBeenCalledWith(
      { url: MODEL_URI },
      TFLITE_DELEGATES,
    );
  });

  test('lần mở app sau không đụng tới expo-asset nữa', async () => {
    // Arrange — bản chép từ lần trước vẫn còn và đủ byte.
    mockFileSizes.set(MODEL_URI, OBSTACLE_MODEL_SIZE_BYTES);

    // Act
    await obstacleModel.loadObstacleModel();

    // Assert — không cần Metro, không cần mạng.
    expect(mockDownloadAsync).not.toHaveBeenCalled();
    expect(mockLoadTensorflowModel).toHaveBeenCalledWith(
      { url: MODEL_URI },
      TFLITE_DELEGATES,
    );
  });

  test('chép lại khi bản đang có thiếu byte', async () => {
    // Arrange — app bị kill giữa lúc chép ở lần trước.
    mockFileSizes.set(MODEL_URI, 1_024);

    // Act
    await obstacleModel.loadObstacleModel();

    // Assert
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
    expect(mockFileSizes.get(MODEL_URI)).toBe(OBSTACLE_MODEL_SIZE_BYTES);
  });

  test('hai màn hình mount cùng lúc chỉ nạp model một lần', async () => {
    // Act — lần mount thứ hai xen vào lúc lần nạp đầu còn đang bay.
    const [first, second] = await Promise.all([
      obstacleModel.loadObstacleModel(),
      obstacleModel.loadObstacleModel(),
    ]);

    // Assert
    expect(mockLoadTensorflowModel).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  test('vào lại chế độ dùng lại model cũ, không parse lại', async () => {
    // Arrange
    const first = await obstacleModel.loadObstacleModel();

    // Act — thoát màn hình rồi vào lại.
    const second = await obstacleModel.loadObstacleModel();

    // Assert
    expect(mockLoadTensorflowModel).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  test('nạp hỏng thì lần vào sau thử lại được', async () => {
    // Arrange — delegate GPU từ chối model ở lần đầu.
    mockLoadTensorflowModel
      .mockRejectedValueOnce(new Error('GPU delegate'))
      .mockResolvedValueOnce(MODEL_HANDLE);

    // Act
    await expect(obstacleModel.loadObstacleModel()).rejects.toThrow(
      'GPU delegate',
    );
    const retried = await obstacleModel.loadObstacleModel();

    // Assert — promise hỏng không được giữ lại làm cache vĩnh viễn.
    expect(mockLoadTensorflowModel).toHaveBeenCalledTimes(2);
    expect(retried).toBe(MODEL_HANDLE);
  });

  test('bản chép cụt thì báo lỗi thay vì nạp một model hỏng', async () => {
    // Arrange — asset materialise ra bản thiếu byte.
    mockDownloadAsync.mockImplementation(() => {
      mockFileSizes.set(ASSET_URI, 1_024);
      return Promise.resolve();
    });

    // Act + Assert
    await expect(obstacleModel.loadObstacleModel()).rejects.toThrow(/1024/);
    expect(mockLoadTensorflowModel).not.toHaveBeenCalled();
  });

  test('báo lỗi khi asset không cho đường dẫn cục bộ', async () => {
    // Arrange
    mockAssetLocalUri = null;

    // Act + Assert
    await expect(obstacleModel.loadObstacleModel()).rejects.toThrow(
      OBSTACLE.MODEL_NO_LOCAL_URI,
    );
    expect(mockLoadTensorflowModel).not.toHaveBeenCalled();
  });
});
