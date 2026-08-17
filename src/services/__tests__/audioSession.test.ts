import { TTS_GUARD_DELAY_MS } from '../../constants/config';

/**
 * Guards the half-duplex invariant: the mic must never be open while the app
 * speaks. The intro lines read out the command keywords themselves ("chụp
 * ảnh", "dò vật cản", "dừng lại"), so a mic opened during TTS makes the app
 * obey its own voice — capturing a photo or leaving a mode on its own.
 */

interface ResultEvent {
  results: { transcript: string }[];
  isFinal: boolean;
}

interface Listeners {
  result?: (event: ResultEvent) => void;
}

const mockRecognitionModule = {
  requestPermissionsAsync: jest.fn(),
  addListener: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};

const mockTts = {
  speak: jest.fn(),
  stop: jest.fn(),
};

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: mockRecognitionModule,
}));

jest.mock('../tts', () => mockTts);

const listeners: Listeners = {};

let audioSession: typeof import('../audioSession');

/** Makes tts.speak hang until the returned function is called. */
function deferSpeech(): () => void {
  let finish = (): void => {};
  mockTts.speak.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = () => resolve();
    }),
  );
  return () => finish();
}

function emitFinalResult(transcript: string): void {
  listeners.result?.({ results: [{ transcript }], isFinal: true });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  delete listeners.result;
  // audioSession ghi nhật ký VVASR ra console — chặn để output test sạch.
  jest.spyOn(console, 'log').mockImplementation(() => {});

  mockRecognitionModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
  mockRecognitionModule.addListener.mockImplementation(
    (name: string, callback: (event: ResultEvent) => void) => {
      if (name === 'result') {
        listeners.result = callback;
      }
      return { remove: jest.fn() };
    },
  );
  mockTts.speak.mockResolvedValue(undefined);

  // audioSession giữ state ở module scope — nạp lại để mỗi test độc lập.
  jest.resetModules();
  audioSession = jest.requireActual<typeof import('../audioSession')>('../audioSession');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('speakExclusive vs startListening', () => {
  test('does not open the mic while an announcement is still being spoken', async () => {
    // Arrange — màn hình đọc lời giới thiệu rồi mới bật nghe lệnh.
    const finishSpeech = deferSpeech();
    const speaking = audioSession.speakExclusive('Màn hình máy ảnh. Nói chụp ảnh để chụp.');

    // Act
    await audioSession.startListening(jest.fn());

    // Assert
    expect(mockRecognitionModule.start).not.toHaveBeenCalled();

    // Cleanup: để lời đọc kết thúc bình thường.
    finishSpeech();
    await speaking;
  });

  test('opens the mic once the announcement finishes and the guard delay elapses', async () => {
    // Arrange
    const finishSpeech = deferSpeech();
    const speaking = audioSession.speakExclusive('Màn hình máy ảnh.');
    await audioSession.startListening(jest.fn());

    // Act
    finishSpeech();
    await speaking;
    jest.advanceTimersByTime(TTS_GUARD_DELAY_MS);

    // Assert
    expect(mockRecognitionModule.start).toHaveBeenCalledTimes(1);
  });

  test('still discards echo during the guard window right after speech ends', async () => {
    // Arrange
    const onTranscript = jest.fn();
    await audioSession.startListening(onTranscript);
    await audioSession.speakExclusive('Đã chụp. Đang phân tích.');

    // Act — đuôi vọng của loa về ngay sau khi TTS tắt.
    jest.advanceTimersByTime(TTS_GUARD_DELAY_MS - 1);
    emitFinalResult('đang phân tích');

    // Assert
    expect(onTranscript).not.toHaveBeenCalled();
  });

  test('reopens the mic on the next screen when a blur cancels the pending restart', async () => {
    // Arrange — màn A đọc xong, restart đang chờ trong cửa sổ guard.
    await audioSession.startListening(jest.fn());
    await audioSession.speakExclusive('Màn hình máy ảnh.');

    // Act — người dùng chuyển màn trước khi timer guard kịp chạy.
    audioSession.stopListening();
    jest.advanceTimersByTime(TTS_GUARD_DELAY_MS * 3);
    mockRecognitionModule.start.mockClear();
    await audioSession.startListening(jest.fn());

    // Assert — cờ đang-nói không được phép kẹt lại và khoá mic vĩnh viễn.
    expect(mockRecognitionModule.start).toHaveBeenCalledTimes(1);
  });

  test('discards a transcript that arrives while the app is speaking', async () => {
    // Arrange
    const onTranscript = jest.fn();
    const finishSpeech = deferSpeech();
    const speaking = audioSession.speakExclusive("Nói 'chụp ảnh' để chụp.");
    await audioSession.startListening(onTranscript);

    // Act — app nghe thấy chính giọng của nó.
    emitFinalResult('chụp ảnh');

    // Assert
    expect(onTranscript).not.toHaveBeenCalled();

    finishSpeech();
    await speaking;
  });
});

describe('startListening / stopListening', () => {
  test('delivers a transcript when nothing is being spoken', async () => {
    // Arrange
    const onTranscript = jest.fn();
    await audioSession.startListening(onTranscript);

    // Act
    emitFinalResult('chụp ảnh');

    // Assert
    expect(mockRecognitionModule.start).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('chụp ảnh', true);
  });

  test('discards a transcript that arrives after listening was stopped', async () => {
    // Arrange — màn hình cũ chỉ blur chứ không unmount, handler của nó vẫn sống.
    const onTranscript = jest.fn();
    await audioSession.startListening(onTranscript);

    // Act
    audioSession.stopListening();
    emitFinalResult('quay lại');

    // Assert
    expect(onTranscript).not.toHaveBeenCalled();
  });
});
