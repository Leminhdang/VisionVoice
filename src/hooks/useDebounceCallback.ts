import { useRef, useCallback } from 'react';
import { CAPTURE_DEBOUNCE_MS } from '../constants/config';

/**
 * Hook đơn giản để debounce một callback.
 * Trả về hàm debounced – gọi liên tiếp nhanh hơn CAPTURE_DEBOUNCE_MS sẽ bị bỏ qua.
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, delay],
  ) as T;

  return debounced;
}
