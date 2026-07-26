import { useReducer } from 'react';

export type AppPhase = 'idle' | 'capturing' | 'analyzing' | 'speaking';

export type CaptureEvent =
  | 'CAPTURE_START'
  | 'ANALYZE_START'
  | 'SPEAK_START'
  | 'DONE'
  | 'ERROR'
  | 'RESET';

const TRANSITION_TABLE: Partial<
  Record<AppPhase, Partial<Record<CaptureEvent, AppPhase>>>
> = {
  idle: { CAPTURE_START: 'capturing' },
  capturing: { ANALYZE_START: 'analyzing' },
  analyzing: { SPEAK_START: 'speaking' },
  speaking: { DONE: 'idle' },
};

export function transition(phase: AppPhase, event: CaptureEvent): AppPhase {
  if (event === 'ERROR' || event === 'RESET') {
    return 'idle';
  }
  return TRANSITION_TABLE[phase]?.[event] ?? phase;
}

export function canCapture(phase: AppPhase): boolean {
  return phase === 'idle';
}

export function isProcessing(phase: AppPhase): boolean {
  return phase !== 'idle';
}

export function useCaptureMachine(): {
  phase: AppPhase;
  dispatch: (event: CaptureEvent) => void;
  canCapture: boolean;
  isProcessing: boolean;
} {
  const [phase, dispatch] = useReducer(transition, 'idle');

  return {
    phase,
    dispatch,
    canCapture: canCapture(phase),
    isProcessing: isProcessing(phase),
  };
}
