import { useRef, useCallback } from 'react';
import { CAPTURE_DEBOUNCE_MS } from '../constants/config';

export function useDebounceCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number = CAPTURE_DEBOUNCE_MS,
): T {
  const lastCalledRef = useRef<number>(0);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCalledRef.current < delay) {
        console.log('[Debounce] Ignored – too soon.');
        return;
      }
      lastCalledRef.current = now;
      fn(...args);
    },
    [fn, delay],
  ) as T;

  return debounced;
}
