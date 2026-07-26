import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, View } from 'react-native';

/**
 * Moves screen-reader focus (VoiceOver/TalkBack) to the referenced view on demand.
 * Attach `ref` to a focusable View and call `focusNow()` after mount/transition.
 */
export function useAccessibilityFocus<T extends View = View>(): {
  ref: RefObject<T | null>;
  focusNow: () => void;
} {
  const ref = useRef<T | null>(null);

  const focusNow = useCallback(() => {
    const handle = findNodeHandle(ref.current);
    if (handle == null) {
      return;
    }
    // AccessibilityInfo.setAccessibilityFocus works on both iOS (VoiceOver)
    // and Android (TalkBack) in RN 0.81 — one cross-platform path, no
    // Platform branch needed.
    AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);

  return { ref, focusNow };
}

/**
 * Announces text to the screen reader. Screens call this on mount
 * alongside voice TTS so screen-reader users get the same context.
 */
export function announceScreen(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}
