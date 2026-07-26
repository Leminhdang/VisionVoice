import { useEffect, useRef, useState } from 'react';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

import { ERRORS, PERMISSIONS } from '../constants/strings';
import { checkVietnameseVoice, speak } from '../services/tts';

/**
 * Spoken permission bootstrap for blind users, ported from the legacy
 * CameraScreen flow: announce why a permission is needed, pause so the
 * user can find the system dialog, then request it.
 *
 * Order: microphone first, then camera. Denials are announced but never
 * block the app — `ready` still becomes true so screens can render a
 * degraded state (`cameraGranted` false hides capture UI, `micGranted`
 * false disables voice control — screens decide). ASR is NOT started
 * here; screens own that via the audio session.
 */

interface PermissionBootstrapState {
  ready: boolean;
  cameraGranted: boolean;
  micGranted: boolean;
}

/** Pause between the spoken explanation and the system permission dialog. */
const PERMISSION_PROMPT_DELAY_MS = 3000;

export function usePermissionBootstrap(): PermissionBootstrapState {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [ready, setReady] = useState(false);
  const hasBootstrappedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Unmount-only cleanup. The bootstrap effect below re-runs whenever a
  // permission object changes identity (which happens mid-flow after each
  // request), so clearing timers in that effect's cleanup would kill the
  // in-flight sequence.
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);

  useEffect(() => {
    // Wait until both permission hooks hydrate.
    if (!cameraPermission || !micPermission) {
      return;
    }
    // One-shot latch — later permission updates re-run the effect as no-ops.
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    const trackedDelay = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        timeoutIdsRef.current = [...timeoutIdsRef.current, id];
      });

    const runBootstrap = async (): Promise<void> => {
      try {
        let isMicGranted = micPermission.granted;
        let isCameraGranted = cameraPermission.granted;

        if (!isMicGranted) {
          await speak(PERMISSIONS.MIC_REQUEST);
          await trackedDelay(PERMISSION_PROMPT_DELAY_MS);
          if (isCancelledRef.current) {
            return;
          }
          const micResult = await requestMicPermission();
          isMicGranted = micResult.granted;
        }
        if (!isMicGranted) {
          await speak(PERMISSIONS.MIC_DENIED);
        }

        if (!isCameraGranted) {
          await speak(PERMISSIONS.CAMERA_REQUEST);
          await trackedDelay(PERMISSION_PROMPT_DELAY_MS);
          if (isCancelledRef.current) {
            return;
          }
          const cameraResult = await requestCameraPermission();
          isCameraGranted = cameraResult.granted;
        }

        if (isCancelledRef.current) {
          return;
        }
        // Flow complete — app is usable even when degraded.
        setReady(true);

        if (!isCameraGranted) {
          await speak(PERMISSIONS.CAMERA_DENIED);
          return;
        }

        await speak(PERMISSIONS.WELCOME);
        const hasVietnameseVoice = await checkVietnameseVoice();
        if (!hasVietnameseVoice && !isCancelledRef.current) {
          await speak(ERRORS.NO_VI_VOICE);
        }
      } catch (err) {
        console.warn('Lỗi khi xin quyền:', err);
        if (!isCancelledRef.current) {
          setReady(true);
        }
      }
    };

    void runBootstrap();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  return {
    ready,
    cameraGranted: cameraPermission?.granted ?? false,
    micGranted: micPermission?.granted ?? false,
  };
}
