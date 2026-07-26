import { useEffect, useRef } from 'react';
import { VolumeManager } from 'react-native-volume-manager';

/**
 * Turns the hardware volume buttons into a capture/PTT trigger for blind
 * users: while enabled, the native volume UI is hidden, any volume change
 * fires `onPress`, and the system volume is snapped back to the level
 * captured on mount so repeated presses never drift the real volume.
 */

interface UseVolumeButtonPTTOptions {
  enabled?: boolean;
}

/** Ignore volume events fired within this window of the last handled press. */
const VOLUME_PRESS_THROTTLE_MS = 500;

export function useVolumeButtonPTT(
  onPress: () => void,
  opts?: UseVolumeButtonPTTOptions,
): void {
  const isEnabled = opts?.enabled ?? true;
  const onPressRef = useRef(onPress);
  const lastHandledAtRef = useRef(0);
  const baselineVolumeRef = useRef<number | null>(null);

  // Keep the latest handler in a ref so the native listener below never
  // has to resubscribe when the caller passes a new function identity.
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let isCancelled = false;

    VolumeManager.getVolume()
      .then((result) => {
        if (!isCancelled) {
          baselineVolumeRef.current = result.volume;
        }
      })
      .catch((err) => {
        console.warn('Lỗi khi đọc mức âm lượng:', err);
      });

    VolumeManager.showNativeVolumeUI({ enabled: false }).catch((err) => {
      console.warn('Lỗi khi ẩn giao diện âm lượng:', err);
    });

    const subscription = VolumeManager.addVolumeListener(() => {
      const now = Date.now();
      // Throttle: a handled press resets the volume below, which itself
      // emits a volume event — this window swallows that echo too.
      if (now - lastHandledAtRef.current < VOLUME_PRESS_THROTTLE_MS) {
        return;
      }
      lastHandledAtRef.current = now;
      onPressRef.current();

      const baselineVolume = baselineVolumeRef.current;
      if (baselineVolume !== null) {
        VolumeManager.setVolume(baselineVolume).catch((err) => {
          console.warn('Lỗi khi khôi phục mức âm lượng:', err);
        });
      }
    });

    return () => {
      isCancelled = true;
      subscription.remove();
      VolumeManager.showNativeVolumeUI({ enabled: true }).catch((err) => {
        console.warn('Lỗi khi hiện lại giao diện âm lượng:', err);
      });
    };
  }, [isEnabled]);
}
