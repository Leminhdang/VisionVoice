import {
  canCapture,
  isProcessing,
  transition,
  type AppPhase,
} from '../captureMachine';

const ALL_PHASES: AppPhase[] = ['idle', 'capturing', 'analyzing', 'speaking'];

describe('transition', () => {
  test('follows the happy path idle -> capturing -> analyzing -> speaking -> idle', () => {
    expect(transition('idle', 'CAPTURE_START')).toBe('capturing');
    expect(transition('capturing', 'ANALYZE_START')).toBe('analyzing');
    expect(transition('analyzing', 'SPEAK_START')).toBe('speaking');
    expect(transition('speaking', 'DONE')).toBe('idle');
  });

  test('returns idle on ERROR from every phase', () => {
    ALL_PHASES.forEach((phase) => {
      expect(transition(phase, 'ERROR')).toBe('idle');
    });
  });

  test('returns idle on RESET from every phase', () => {
    ALL_PHASES.forEach((phase) => {
      expect(transition(phase, 'RESET')).toBe('idle');
    });
  });

  test('keeps idle unchanged on illegal events', () => {
    expect(transition('idle', 'ANALYZE_START')).toBe('idle');
    expect(transition('idle', 'SPEAK_START')).toBe('idle');
    expect(transition('idle', 'DONE')).toBe('idle');
  });

  test('keeps capturing unchanged on illegal events', () => {
    expect(transition('capturing', 'CAPTURE_START')).toBe('capturing');
    expect(transition('capturing', 'SPEAK_START')).toBe('capturing');
    expect(transition('capturing', 'DONE')).toBe('capturing');
  });

  test('keeps analyzing unchanged on illegal events', () => {
    expect(transition('analyzing', 'CAPTURE_START')).toBe('analyzing');
    expect(transition('analyzing', 'ANALYZE_START')).toBe('analyzing');
    expect(transition('analyzing', 'DONE')).toBe('analyzing');
  });

  test('keeps speaking unchanged on illegal events', () => {
    expect(transition('speaking', 'CAPTURE_START')).toBe('speaking');
    expect(transition('speaking', 'ANALYZE_START')).toBe('speaking');
    expect(transition('speaking', 'SPEAK_START')).toBe('speaking');
  });
});

describe('canCapture', () => {
  test('returns true only when phase is idle', () => {
    expect(canCapture('idle')).toBe(true);
    expect(canCapture('capturing')).toBe(false);
    expect(canCapture('analyzing')).toBe(false);
    expect(canCapture('speaking')).toBe(false);
  });
});

describe('isProcessing', () => {
  test('returns false only when phase is idle', () => {
    expect(isProcessing('idle')).toBe(false);
    expect(isProcessing('capturing')).toBe(true);
    expect(isProcessing('analyzing')).toBe(true);
    expect(isProcessing('speaking')).toBe(true);
  });
});
