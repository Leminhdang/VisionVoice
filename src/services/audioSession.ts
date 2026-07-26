import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

import {
  ASR_RESTART_ON_END_MS,
  ASR_RESTART_ON_ERROR_MS,
  SPEECH_RECOGNITION_LOCALE,
  TTS_GUARD_DELAY_MS,
} from '../constants/config';
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
/** Gate: true while TTS speaks and during the post-TTS guard window. */
let isSpeaking = false;
let onTranscriptRef: TranscriptCallback | null = null;
let restartTimerId: ReturnType<typeof setTimeout> | null = null;
let subscriptions: Subscription[] = [];

/**
 * Requests mic/speech permissions and starts continuous recognition.
 * Silently returns when permission is denied.
 */
export async function startListening(onTranscript: TranscriptCallback): Promise<void> {
  onTranscriptRef = onTranscript;
  try {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      return;
    }
  } catch (err) {
    console.warn('Lỗi khi xin quyền nhận dạng giọng nói:', err);
    return;
  }
  subscribeOnce();
  wantListening = true;
  isSpeaking = false;
  startRecognition();
}

/** Stops recognition and cancels any pending restart. */
export function stopListening(): void {
  clearRestartTimer();
  wantListening = false;
  ExpoSpeechRecognitionModule.stop();
  isListening = false;
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
    return;
  }
  isSuspended = false;
  if (wantListening) {
    scheduleRestart(TTS_GUARD_DELAY_MS);
  }
}

/**
 * Speaks with the mic closed: hard-stops ASR, speaks, then restarts ASR
 * after a guard delay. Transcripts arriving while speaking or within the
 * guard window are discarded.
 */
export async function speakExclusive(
  text: string,
  opts?: SpeakExclusiveOptions,
): Promise<void> {
  isSpeaking = true;
  clearRestartTimer();
  hardStopRecognition();
  await tts.speak(text, opts);
  if (wantListening && !isSuspended) {
    scheduleRestart(TTS_GUARD_DELAY_MS);
    return;
  }
  isSpeaking = false;
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
  if (isSpeaking) {
    return;
  }
  const transcript = event.results[0]?.transcript ?? '';
  if (transcript.trim().length === 0) {
    return;
  }
  onTranscriptRef?.(transcript, event.isFinal);
}

function handleEnd(): void {
  isListening = false;
  if (wantListening && !isSuspended && !isSpeaking) {
    scheduleRestart(ASR_RESTART_ON_END_MS);
  }
}

function handleError(event: ExpoSpeechRecognitionErrorEvent): void {
  isListening = false;
  // 'aborted' is self-induced (hardStopRecognition) — not worth a warning.
  if (event.error !== 'aborted') {
    console.warn('Lỗi khi nhận dạng giọng nói:', event.error, event.message);
  }
  if (wantListening && !isSuspended && !isSpeaking) {
    scheduleRestart(ASR_RESTART_ON_ERROR_MS);
  }
}

function startRecognition(): void {
  if (!wantListening || isSuspended || isListening) {
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
    isSpeaking = false;
    startRecognition();
  }, delayMs);
}

function clearRestartTimer(): void {
  if (restartTimerId !== null) {
    clearTimeout(restartTimerId);
    restartTimerId = null;
  }
}
