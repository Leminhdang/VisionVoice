import { useCallback, useEffect, useRef, useState } from 'react';

import { QA_RELISTEN_DELAY_MS, QA_SILENCE_COMMIT_MS } from '../constants/config';
import { ERRORS, QA } from '../constants/strings';
import * as audioSession from '../services/audioSession';
import { hapticStop, playListenEnd, playListenStart } from '../services/feedback';
import { createQASession, GeminiError } from '../services/gemini';
import type { PreparedImage } from '../services/imagePipeline';
import { logMetric } from '../services/metrics';
import * as tts from '../services/tts';
import { parseIntent } from '../services/voiceIntents';

/**
 * Q&A voice loop over one captured image.
 *
 * On mount: creates a Gemini Q&A session, speaks the ask-prompt, then starts
 * listening. Each final transcript becomes a question; the answer is spoken
 * and listening resumes after QA_RELISTEN_DELAY_MS. 'back'/'stop' transcripts
 * are never sent to Gemini — they trigger opts.onExitIntent so the SCREEN can
 * leave Q&A mode.
 */

export type QAStatus = 'idle' | 'listening' | 'thinking' | 'answering';

export interface QATurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface UseQASessionOptions {
  /** Called when a transcript parses to 'back'/'stop' instead of a question. */
  onExitIntent?: () => void;
  /** Capture id of the image being discussed — used for qa_* metrics. */
  captureId?: number;
}

export interface UseQASessionResult {
  status: QAStatus;
  turns: ReadonlyArray<QATurn>;
  beginListening(): void;
  interrupt(): void;
  end(): void;
}

type QASession = ReturnType<typeof createQASession>;

const DEFAULT_CAPTURE_ID = 0;

export function useQASession(
  image: PreparedImage,
  opts?: UseQASessionOptions,
): UseQASessionResult {
  const [status, setStatus] = useState<QAStatus>('idle');
  const [turns, setTurns] = useState<ReadonlyArray<QATurn>>([]);

  const sessionRef = useRef<QASession | null>(null);
  const statusRef = useRef<QAStatus>('idle');
  const mountedRef = useRef(true);
  const relistenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef('');
  const onExitIntentRef = useRef<(() => void) | undefined>(undefined);
  const captureIdRef = useRef(DEFAULT_CAPTURE_ID);

  // The impl functions below close over refs and stable setState functions
  // only, so any render's instance is interchangeable — the mount effect and
  // the useCallback([]) wrappers safely capture the first render's instances.

  function updateStatus(next: QAStatus): void {
    statusRef.current = next;
    if (mountedRef.current) {
      setStatus(next);
    }
  }

  function clearRelistenTimer(): void {
    if (relistenTimerRef.current !== null) {
      clearTimeout(relistenTimerRef.current);
      relistenTimerRef.current = null;
    }
  }

  function scheduleRelisten(): void {
    if (!mountedRef.current) {
      return;
    }
    clearRelistenTimer();
    relistenTimerRef.current = setTimeout(() => {
      relistenTimerRef.current = null;
      beginListeningImpl();
    }, QA_RELISTEN_DELAY_MS);
  }

  function beginListeningImpl(): void {
    if (!mountedRef.current) {
      return;
    }
    clearRelistenTimer();
    clearSilenceTimer();
    pendingTranscriptRef.current = '';
    void playListenStart();
    void hapticStop();
    updateStatus('listening');
    void audioSession.startListening(handleTranscript);
  }

  function clearSilenceTimer(): void {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  /**
   * Ở chế độ `continuous` trên Android, engine phát kết quả tạm thời liên tục
   * còn `isFinal` chỉ đến khi nó tự chốt đoạn — có thể rất trễ hoặc không bao
   * giờ, nên chờ `isFinal` là câm hẳn (đúng lỗi đã gặp ở màn lệnh giọng nói).
   *
   * Nhưng khác màn lệnh, ở đây KHÔNG thể dùng ngay kết quả tạm thời: gửi
   * "cái này là" thay vì "cái này là cái gì" lên Gemini là hỏng câu hỏi. Nên
   * bản tạm thời được giữ lại và chỉ chốt khi người dùng đã ngừng nói
   * QA_SILENCE_COMMIT_MS — hoặc chốt ngay nếu engine chịu trả `isFinal`.
   *
   * Riêng lệnh thoát được nhận ngay trên bản tạm thời: "quay lại" không phải
   * câu hỏi nên không cần chờ nói hết, và bắt người khiếm thị đợi thêm hơn
   * một giây mới thoát được là tệ.
   */
  function handleTranscript(text: string, isFinal: boolean): void {
    if (statusRef.current !== 'listening') {
      return;
    }

    const intent = parseIntent(text);
    if (intent === 'back' || intent === 'stop') {
      clearSilenceTimer();
      pendingTranscriptRef.current = '';
      onExitIntentRef.current?.();
      return;
    }

    if (isFinal) {
      clearSilenceTimer();
      pendingTranscriptRef.current = '';
      void processTranscript(text);
      return;
    }

    pendingTranscriptRef.current = text;
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      const pending = pendingTranscriptRef.current;
      pendingTranscriptRef.current = '';
      if (!mountedRef.current || statusRef.current !== 'listening') {
        return;
      }
      void processTranscript(pending);
    }, QA_SILENCE_COMMIT_MS);
  }

  async function processTranscript(transcript: string): Promise<void> {
    const question = transcript.trim();
    if (question.length === 0) {
      await audioSession.speakExclusive(QA.NOT_HEARD);
      beginListeningImpl();
      return;
    }
    const intent = parseIntent(question);
    if (intent === 'back' || intent === 'stop') {
      // Exit intents belong to the screen — never sent to Gemini.
      onExitIntentRef.current?.();
      return;
    }
    await askQuestion(question);
  }

  async function askQuestion(question: string): Promise<void> {
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    void playListenEnd();
    updateStatus('thinking');
    audioSession.setSuspended(true);
    if (mountedRef.current) {
      setTurns((prev) => [...prev, { role: 'user', text: question }]);
    }
    const captureId = captureIdRef.current;
    logMetric({ event: 'qa_question', captureId, transcript: question });
    try {
      const answer = await session.ask(question, captureId);
      if (sessionRef.current === null) {
        return; // end() ran while the request was in flight
      }
      updateStatus('answering');
      if (mountedRef.current) {
        setTurns((prev) => [...prev, { role: 'assistant', text: answer }]);
      }
      logMetric({ event: 'qa_answer', captureId, answer });
      await audioSession.speakExclusive(answer);
      audioSession.setSuspended(false);
      if (statusRef.current !== 'answering') {
        return; // interrupted (barge-in) or ended while speaking
      }
      scheduleRelisten();
    } catch (err) {
      if (sessionRef.current === null || !mountedRef.current) {
        return; // session disposed — a rejection here is expected noise
      }
      console.warn('Lỗi khi hỏi đáp về ảnh:', err);
      const message = err instanceof GeminiError ? ERRORS[err.kind] : ERRORS.unknown;
      await audioSession.speakExclusive(message);
      audioSession.setSuspended(false);
      if (statusRef.current === 'listening') {
        return; // barge-in happened during the error announcement
      }
      updateStatus('idle');
      scheduleRelisten();
    }
  }

  function interruptImpl(): void {
    // PTT barge-in: cut the answer short and listen immediately.
    tts.stop();
    audioSession.setSuspended(false);
    beginListeningImpl();
  }

  function endImpl(): void {
    clearRelistenTimer();
    clearSilenceTimer();
    pendingTranscriptRef.current = '';
    // Lift any suspension BEFORE stopListening so audioSession is left in a
    // clean state for the next screen (stopListening clears the restart it
    // may schedule).
    audioSession.setSuspended(false);
    audioSession.stopListening();
    sessionRef.current?.dispose();
    sessionRef.current = null;
    updateStatus('idle');
  }

  useEffect(() => {
    onExitIntentRef.current = opts?.onExitIntent;
    captureIdRef.current = opts?.captureId ?? DEFAULT_CAPTURE_ID;
    return () => {
      onExitIntentRef.current = undefined;
    };
  }, [opts?.onExitIntent, opts?.captureId]);

  useEffect(() => {
    mountedRef.current = true;
    setTurns([]);
    sessionRef.current = createQASession(image);
    let isCancelled = false;
    audioSession
      .speakExclusive(QA.ASK_PROMPT)
      .then(() => {
        if (!isCancelled) {
          beginListeningImpl();
        }
      })
      .catch((err) => {
        console.warn('Lỗi khi đọc lời nhắc hỏi đáp:', err);
      });
    return () => {
      isCancelled = true;
      mountedRef.current = false;
      endImpl();
    };
    // beginListeningImpl/endImpl intentionally omitted: they close over refs
    // and stable setters only — see the note above the impl functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const beginListening = useCallback((): void => {
    beginListeningImpl();
    // Stable: impl closes over refs and stable setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interrupt = useCallback((): void => {
    interruptImpl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = useCallback((): void => {
    endImpl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, turns, beginListening, interrupt, end };
}
