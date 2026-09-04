import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';

import { VOICE_INTENT_COOLDOWN_MS } from '../constants/config';
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
 * the audio session listens continuously; each transcript is parsed into a
 * VoiceIntent and dispatched to the matching handler (with a navigation
 * haptic). Listening stops on blur/unmount.
 *
 * Kết quả TẠM THỜI cũng được xử lý, không chỉ kết quả cuối: ở chế độ
 * `continuous` trên Android, engine phát interim liên tục còn `isFinal` chỉ
 * đến khi nó tự chốt đoạn — có thể rất trễ hoặc không bao giờ, nên chờ
 * `isFinal` là vứt bỏ những lệnh đã nghe đúng. Đổi lại, một câu nói sinh ra
 * nhiều interim ("chụp", "chụp ảnh"...) nên cùng một intent bị chặn lặp trong
 * VOICE_INTENT_COOLDOWN_MS.
 *
 * Handlers are kept in a ref so identity changes never restart the ASR.
 */
export function useVoiceControl(
  handlers: VoiceIntentHandlers,
  opts?: UseVoiceControlOptions,
): void {
  const handlersRef = useRef<VoiceIntentHandlers>(handlers);
  const lastIntentRef = useRef<VoiceIntent | null>(null);
  const lastIntentAtRef = useRef(0);
  const enabled = opts?.enabled ?? true;

  useEffect(() => {
    handlersRef.current = handlers;
    return () => {
      handlersRef.current = {};
    };
  }, [handlers]);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    const intent = parseIntent(text);
    const handler = handlersRef.current[intent];
    const now = Date.now();
    // Cùng một intent lặp lại trong cooldown là các interim nối tiếp của một
    // câu nói duy nhất, không phải lệnh mới.
    const isRepeat =
      lastIntentRef.current === intent && now - lastIntentAtRef.current < VOICE_INTENT_COOLDOWN_MS;

    // Phân biệt ba trường hợp "nói lệnh mà không thấy gì xảy ra": ASR không
    // trả transcript, transcript không khớp từ khoá nào, hoặc khớp nhưng màn
    // hình hiện tại không đăng ký handler cho intent đó.
    audioSession.traceVoice('intent', {
      transcript: text,
      intent,
      isFinal,
      isRepeat,
      handled: handler !== undefined && !isRepeat,
      registered: Object.keys(handlersRef.current),
    });

    if (handler === undefined || isRepeat) {
      return;
    }
    lastIntentRef.current = intent;
    lastIntentAtRef.current = now;
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
        // Truyền handler làm owner: nếu màn hình kế tiếp đã tiếp quản mic
        // trước khi cleanup này chạy, lệnh dừng phải tự bỏ qua.
        audioSession.stopListening(handleTranscript);
      };
    }, [enabled, handleTranscript]),
  );
}
