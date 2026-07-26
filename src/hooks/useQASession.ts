import { useCallback, useEffect, useRef, useState } from 'react';

import { QA_RELISTEN_DELAY_MS } from '../constants/config';
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
    void playListenStart();
    void hapticStop();
    updateStatus('listening');
    void audioSession.startListening(handleTranscript);
  }

  function handleTranscript(text: string, isFinal: boolean): void {
    // Interim results are ignored; so is anything arriving outside the
    // listening state (e.g. stray results while thinking/answering).
    if (!isFinal || statusRef.current !== 'listening') {
      return;
    }
    void processTranscript(text);
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
