import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

import {
  ASR_MAX_BACKOFF_MS,
  ASR_MAX_CONSECUTIVE_ERRORS,
  ASR_RESTART_ON_END_MS,
  ASR_RESTART_ON_ERROR_MS,
  ASR_TRACE_ENABLED,
  SPEECH_RECOGNITION_LOCALE,
  TTS_GUARD_DELAY_MS,
} from '../constants/config';
import { ERRORS } from '../constants/strings';
import * as tts from './tts';

/**
 * Half-duplex audio coordinator — the ONLY module allowed to touch both
 * ASR (expo-speech-recognition) and TTS (./tts).
 *
 * The mic and the speaker never run "at the same time" from the app's point
 * of view: while TTS speaks (and for TTS_GUARD_DELAY_MS afterwards) every
 * incoming transcript is discarded so the app never hears its own voice.
 */

type TranscriptCallback = (text: string, isFinal: boolean) => void;

interface SpeakExclusiveOptions {
  rate?: number;
  pitch?: number;
  flush?: boolean;
}

interface Subscription {
  remove(): void;
}

let isListening = false;
let isSuspended = false;
let wantListening = false;
/**
 * Chỉ đúng trong lúc TTS đang phát. KHÔNG gộp cửa sổ chặn hậu-TTS vào đây:
 * cờ này chặn cả việc mở mic, nên nếu nó phụ thuộc vào một timer (mà
 * stopListening() có quyền huỷ) thì cờ sẽ kẹt true và mic không bao giờ mở
 * lại. speakExclusive() luôn tự hạ cờ khi lượt đọc của nó kết thúc.
 */
let isSpeaking = false;
/** Mốc thời gian hết cửa sổ chặn hậu-TTS — hết hạn tự nhiên, không kẹt được. */
let guardUntilMs = 0;
let onTranscriptRef: TranscriptCallback | null = null;
let restartTimerId: ReturnType<typeof setTimeout> | null = null;
let consecutiveErrors = 0;
let subscriptions: Subscription[] = [];
/** Tăng mỗi lần speakExclusive được gọi — xem ghi chú ở speakExclusive. */
let speakGeneration = 0;

/**
 * Nhật ký chẩn đoán luồng giọng nói. Mỗi dòng kèm nguyên trạng thái nội bộ vì
 * mọi lỗi ở module này đều là "mic không mở" hoặc "transcript bị bỏ" — chỉ cần
 * nhìn cờ nào đang bật là biết guard nào chặn. Tách khỏi VVMETRIC để log tần
 * suất cao không lẫn vào dữ liệu đánh giá.
 */
export function traceVoice(event: string, detail?: Record<string, unknown>): void {
  if (!ASR_TRACE_ENABLED) {
    return;
  }
  // eslint-disable-next-line no-console -- INTENTIONAL: adb logcat collection path
  console.log(
    'VVASR ' +
      JSON.stringify({
        event,
        wantListening,
        isListening,
        isSuspended,
        isSpeaking,
        guardMsLeft: Math.max(0, guardUntilMs - Date.now()),
        ...detail,
      }),
  );
}

/**
 * Requests mic/speech permissions and starts continuous recognition.
 * Silently returns when permission is denied.
 */
export async function startListening(onTranscript: TranscriptCallback): Promise<void> {
  onTranscriptRef = onTranscript;
  consecutiveErrors = 0;
  try {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      traceVoice('permission_denied');
      return;
    }
  } catch (err) {
    console.warn('Lỗi khi xin quyền nhận dạng giọng nói:', err);
    traceVoice('permission_error');
    return;
  }
  subscribeOnce();
  wantListening = true;
  // KHÔNG đặt isSpeaking = false ở đây. Màn hình thường gọi startListening()
  // trong lúc lời giới thiệu đang được đọc; xoá cờ sẽ mở mic giữa câu và app
  // nghe chính giọng mình — mà các câu giới thiệu lại đọc to đúng những từ
  // khoá lệnh ("chụp ảnh", "dò vật cản", "dừng lại"). Nếu đang nói,
  // startRecognition() sẽ bỏ qua và speakExclusive() mở mic khi đọc xong.
  traceVoice('start_listening');
  startRecognition();
}

/**
 * Stops recognition and cancels any pending restart.
 *
 * `owner` là callback đã truyền cho startListening(). audioSession là
 * singleton dùng chung, còn mỗi màn hình lại tự gọi stop khi blur — mà React
 * Navigation KHÔNG đảm bảo cleanup của màn cũ chạy trước effect focus của màn
 * mới. Nếu màn mới đã kịp startListening() thì lệnh stop của màn cũ sẽ tắt mic
 * của màn mới và người dùng mất hẳn điều khiển giọng nói. Truyền owner vào để
 * lệnh stop đến muộn tự nhận ra mình không còn giữ mic nữa.
 *
 * Bỏ trống owner = dừng vô điều kiện (dùng khi thực sự muốn tắt hẳn).
 */
export function stopListening(owner?: TranscriptCallback): void {
  if (owner !== undefined && onTranscriptRef !== owner) {
    traceVoice('stop_ignored_not_owner');
    return;
  }
  clearRestartTimer();
  wantListening = false;
  ExpoSpeechRecognitionModule.stop();
  isListening = false;
  traceVoice('stop_listening');
}

/**
 * true: pause recognition (keeps wantListening so it can resume later).
 * false: resume after TTS_GUARD_DELAY_MS if listening is still wanted.
 */
export function setSuspended(value: boolean): void {
  if (value) {
    isSuspended = true;
    clearRestartTimer();
    hardStopRecognition();
    traceVoice('suspended');
    return;
  }
  isSuspended = false;
  traceVoice('resumed');
  if (wantListening) {
    scheduleRestart(TTS_GUARD_DELAY_MS);
  }
}

/**
 * Speaks with the mic closed: hard-stops ASR, speaks, then restarts ASR
 * after a guard delay. Transcripts arriving while speaking or within the
 * guard window are discarded.
 *
 * Các lượt nói có thể chồng nhau (ví dụ cảnh báo vật cản gọi liên tiếp):
 * lượt mới `flush` khiến Speech.stop() làm lượt cũ resolve sớm. Nếu lượt cũ
 * vẫn được phép mở lại mic, mic sẽ mở trong khi lượt mới đang nói — đúng thứ
 * bất biến half-duplex cấm. Vì vậy chỉ lượt mới nhất được đụng vào ASR.
 */
export async function speakExclusive(
  text: string,
  opts?: SpeakExclusiveOptions,
): Promise<void> {
  speakGeneration++;
  const generation = speakGeneration;
  isSpeaking = true;
  clearRestartTimer();
  hardStopRecognition();
  traceVoice('speak_begin', { generation, chars: text.length });
  await tts.speak(text, opts);
  if (generation !== speakGeneration) {
    // Lượt mới đang phát và sẽ tự hạ cờ khi nó xong — không đụng vào state.
    traceVoice('speak_superseded', { generation, current: speakGeneration });
    return;
  }
  // Hạ cờ vô điều kiện: lượt đọc này đã kết thúc thật. Cửa sổ chặn hậu-TTS
  // chuyển sang guardUntilMs để việc mở lại mic không phụ thuộc timer nào.
  isSpeaking = false;
  guardUntilMs = Date.now() + TTS_GUARD_DELAY_MS;
  traceVoice('speak_end', { generation });
  if (wantListening && !isSuspended) {
    scheduleRestart(TTS_GUARD_DELAY_MS);
  }
}

function subscribeOnce(): void {
  if (subscriptions.length > 0) {
    return;
  }
  subscriptions = [
    ExpoSpeechRecognitionModule.addListener('result', handleResult),
    ExpoSpeechRecognitionModule.addListener('end', handleEnd),
    ExpoSpeechRecognitionModule.addListener('error', handleError),
  ];
}

function handleResult(event: ExpoSpeechRecognitionResultEvent): void {
  // !wantListening: kết quả cuối thường về sau khi stopListening()/abort();
  // màn hình cũ vẫn còn mounted (chỉ blur) nên handler của nó sẽ chạy và
  // điều hướng nhầm. Không muốn nghe thì không nhận transcript.
  if (isSpeaking || Date.now() < guardUntilMs || !wantListening) {
    traceVoice('result_dropped', {
      transcript: event.results[0]?.transcript ?? '',
      isFinal: event.isFinal,
    });
    return;
  }
  consecutiveErrors = 0;
  const transcript = event.results[0]?.transcript ?? '';
  if (transcript.trim().length === 0) {
    traceVoice('result_empty', { isFinal: event.isFinal });
    return;
  }
  traceVoice('result', { transcript, isFinal: event.isFinal });
  onTranscriptRef?.(transcript, event.isFinal);
}

function handleEnd(): void {
  isListening = false;
  // Normal end (no error) — reset backoff counter.
  consecutiveErrors = 0;
  const willRestart = wantListening && !isSuspended && !isSpeaking;
  traceVoice('recognition_end', { willRestart });
  if (willRestart) {
    scheduleRestart(ASR_RESTART_ON_END_MS);
  }
}

function handleError(event: ExpoSpeechRecognitionErrorEvent): void {
  isListening = false;
  // 'aborted' is self-induced (hardStopRecognition) — not worth a warning.
  if (event.error === 'aborted') {
    traceVoice('recognition_aborted');
    return;
  }
  consecutiveErrors++;
  console.warn('Lỗi khi nhận dạng giọng nói:', event.error, event.message);
  traceVoice('recognition_error', {
    error: event.error,
    message: event.message,
    consecutiveErrors,
  });
  if (!wantListening || isSuspended || isSpeaking) {
    traceVoice('recognition_error_ignored', { error: event.error });
    return;
  }
  if (consecutiveErrors > ASR_MAX_CONSECUTIVE_ERRORS) {
    console.warn(
      `Nhận dạng giọng nói: ${consecutiveErrors} lỗi liên tiếp, tạm dừng thử lại.`,
    );
    // Bỏ cuộc trong im lặng nghĩa là người khiếm thị nói lệnh mãi mà không
    // hiểu vì sao không có gì xảy ra — phải nói ra là mic đã ngừng.
    wantListening = false;
    void speakExclusive(ERRORS.ASR_STOPPED);
    traceVoice('recognition_gave_up', { consecutiveErrors, error: event.error });
    return;
  }
  const backoff = Math.min(
    ASR_RESTART_ON_ERROR_MS * Math.pow(2, consecutiveErrors - 1),
    ASR_MAX_BACKOFF_MS,
  );
  traceVoice('recognition_retry', { backoff, consecutiveErrors });
  scheduleRestart(backoff);
}

function startRecognition(): void {
  if (!wantListening || isSuspended || isListening || isSpeaking) {
    // Trạng thái đi kèm cho biết cờ nào đang chặn — "mic không mở" luôn quy về
    // đúng một trong bốn cờ này.
    traceVoice('recognition_skipped');
    return;
  }
  ExpoSpeechRecognitionModule.start({
    lang: SPEECH_RECOGNITION_LOCALE,
    continuous: true,
    interimResults: true,
    iosCategory: {
      category: 'playAndRecord',
      categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
      mode: 'default',
    },
  });
  isListening = true;
  traceVoice('recognition_started', { lang: SPEECH_RECOGNITION_LOCALE });
}

/** Cancels recognition immediately without waiting for a final result. */
function hardStopRecognition(): void {
  if (!isListening) {
    return;
  }
  ExpoSpeechRecognitionModule.abort();
  isListening = false;
}

/** Single restart slot: scheduling always replaces any pending restart. */
function scheduleRestart(delayMs: number): void {
  clearRestartTimer();
  restartTimerId = setTimeout(() => {
    restartTimerId = null;
    startRecognition();
  }, delayMs);
}

function clearRestartTimer(): void {
  if (restartTimerId !== null) {
    clearTimeout(restartTimerId);
    restartTimerId = null;
  }
}
