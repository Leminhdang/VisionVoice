import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';

import { DEFAULT_TTS_PITCH, DEFAULT_TTS_RATE, TTS_LOCALE } from '../constants/config';

/**
 * TTS singleton for the whole app.
 *
 * When a screen reader (TalkBack/VoiceOver) is active, speaking with
 * expo-speech would talk over it, so announcements are routed through
 * AccessibilityInfo.announceForAccessibility instead.
 */

interface SpeakOptions {
  rate?: number;
  pitch?: number;
  /** Defaults to true — an assistive app never queues utterances. */
  flush?: boolean;
}

const ANNOUNCE_MS_PER_CHAR = 80;
const ANNOUNCE_MAX_WAIT_MS = 15_000;

let screenReaderEnabled = false;
let currentRate = DEFAULT_TTS_RATE;
let currentPitch = DEFAULT_TTS_PITCH;

/**
 * Reads the initial screen-reader state and tracks changes.
 * App-lifetime singleton — the subscription is intentionally never removed.
 * Call once from App.tsx.
 */
export function initTts(): void {
  AccessibilityInfo.isScreenReaderEnabled()
    .then((isEnabled) => {
      screenReaderEnabled = isEnabled;
    })
    .catch((err) => {
      console.warn('Lỗi khi kiểm tra trình đọc màn hình:', err);
    });

  AccessibilityInfo.addEventListener('screenReaderChanged', (isEnabled) => {
    screenReaderEnabled = isEnabled;
  });
}

/** Applies rate/pitch defaults chosen in Settings. */
export function setTtsDefaults(opts: { rate?: number; pitch?: number }): void {
  if (opts.rate !== undefined) {
    currentRate = opts.rate;
  }
  if (opts.pitch !== undefined) {
    currentPitch = opts.pitch;
  }
}

/**
 * Speaks text, routing through the screen reader when one is active.
 * Resolves when speech finishes (or is stopped / errors — never rejects).
 */
export function speak(text: string, opts?: SpeakOptions): Promise<void> {
  if (text.trim().length === 0) {
    return Promise.resolve();
  }
  if (screenReaderEnabled) {
    return announceViaScreenReader(text);
  }
  return speakWithExpoSpeech(text, opts);
}

/**
 * Speaks with expo-speech even when a screen reader is active.
 * Only for the Settings voice test, where the actual TTS voice must be heard.
 */
export function speakAlways(text: string, opts?: SpeakOptions): Promise<void> {
  if (text.trim().length === 0) {
    return Promise.resolve();
  }
  return speakWithExpoSpeech(text, opts);
}

export function stop(): void {
  Speech.stop();
}

export function isScreenReaderOn(): boolean {
  return screenReaderEnabled;
}

/**
 * Checks whether the device has any Vietnamese TTS voice installed.
 * Returns true on API failure — đừng chặn app vì API voice lỗi.
 */
export async function checkVietnameseVoice(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some((voice) => voice.language.startsWith('vi'));
  } catch (err) {
    console.warn('Lỗi khi kiểm tra giọng đọc tiếng Việt:', err);
    return true;
  }
}

function announceViaScreenReader(text: string): Promise<void> {
  AccessibilityInfo.announceForAccessibility(text);
  // Screen readers give no completion callback, so resolve after a
  // duration estimate proportional to text length, capped at 15s.
  const estimatedMs = Math.min(text.length * ANNOUNCE_MS_PER_CHAR, ANNOUNCE_MAX_WAIT_MS);
  return new Promise((resolve) => {
    setTimeout(resolve, estimatedMs);
  });
}

function speakWithExpoSpeech(text: string, opts?: SpeakOptions): Promise<void> {
  if (opts?.flush !== false) {
    Speech.stop();
  }
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: TTS_LOCALE,
      rate: opts?.rate ?? currentRate,
      pitch: opts?.pitch ?? currentPitch,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (err) => {
        console.warn('Lỗi khi đọc:', err);
        resolve();
      },
    });
  });
}
