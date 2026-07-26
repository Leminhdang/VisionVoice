import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';

import * as audioSession from '../services/audioSession';
import { hapticNavigate } from '../services/feedback';
import { parseIntent } from '../services/voiceIntents';
import type { VoiceIntent } from '../services/voiceIntents';

export type VoiceIntentHandlers = Partial<Record<VoiceIntent, () => void>>;

export interface UseVoiceControlOptions {
  /** Bật/tắt lắng nghe lệnh giọng nói. Mặc định true. */
  enabled?: boolean;
}

/**
 * Per-screen voice control: while the screen is focused (and `enabled`),
 * the audio session listens continuously; each FINAL transcript is parsed
 * into a VoiceIntent and dispatched to the matching handler (with a
 * navigation haptic). Listening stops on blur/unmount.
 *
 * Handlers are kept in a ref so identity changes never restart the ASR.
 */
export function useVoiceControl(
  handlers: VoiceIntentHandlers,
  opts?: UseVoiceControlOptions,
): void {
  const handlersRef = useRef<VoiceIntentHandlers>(handlers);
  const enabled = opts?.enabled ?? true;

  useEffect(() => {
    handlersRef.current = handlers;
    return () => {
      handlersRef.current = {};
    };
  }, [handlers]);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (!isFinal) {
      return;
    }
    const intent = parseIntent(text);
    const handler = handlersRef.current[intent];
    if (handler === undefined) {
      return;
    }
    void hapticNavigate();
    handler();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }
      void audioSession.startListening(handleTranscript);
      return () => {
        audioSession.stopListening();
      };
    }, [enabled, handleTranscript]),
  );
}
