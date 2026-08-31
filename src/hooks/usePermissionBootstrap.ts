import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraPermission } from 'react-native-vision-camera';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { ERRORS, PERMISSIONS } from '../constants/strings';
import { speakExclusive } from '../services/audioSession';
import { checkVietnameseVoice } from '../services/tts';

/**
 * Spoken permission bootstrap for blind users: announce why a permission is
 * needed, pause so the user can find the system dialog, then request it.
 *
 * Order: microphone first, then camera. Denials are announced but never
 * block the app — `ready` still becomes true so screens can render a
 * degraded state.
 *
 * Uses react-native-vision-camera's useCameraPermission hook for camera
 * and expo-speech-recognition for microphone permission.
 */

interface PermissionBootstrapState {
  ready: boolean;
  cameraGranted: boolean;
  micGranted: boolean;
}

/** Pause between the spoken explanation and the system permission dialog. */
const PERMISSION_PROMPT_DELAY_MS = 3_000;

export function usePermissionBootstrap(): PermissionBootstrapState {
  const [ready, setReady] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const cameraPermission = useCameraPermission();
  const hasBootstrappedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Unmount-only cleanup.
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);

  const trackedDelay = useCallback((ms: number): Promise<void> =>
    new Promise((resolve) => {
      const id = setTimeout(resolve, ms);
      timeoutIdsRef.current = [...timeoutIdsRef.current, id];
    }), []);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    const runBootstrap = async (): Promise<void> => {
      try {
        // --- Microphone permission ---
        const micStatus = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        let isMicGranted = micStatus.granted;

        if (!isMicGranted) {
          await speakExclusive(PERMISSIONS.MIC_REQUEST);
          await trackedDelay(PERMISSION_PROMPT_DELAY_MS);
          if (isCancelledRef.current) return;
          const micResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          isMicGranted = micResult.granted;
        }
        if (!isMicGranted) {
          await speakExclusive(PERMISSIONS.MIC_DENIED);
        }
        setMicGranted(isMicGranted);

        // --- Camera permission ---
        // `cameraPermission` bị đóng băng ở render đầu (effect chạy một lần),
        // nên phải dùng giá trị requestPermission() trả về, không đọc lại
        // cameraPermission.hasPermission sau khi xin quyền.
        let isCameraGranted = cameraPermission.hasPermission;

        if (!isCameraGranted) {
          await speakExclusive(PERMISSIONS.CAMERA_REQUEST);
          await trackedDelay(PERMISSION_PROMPT_DELAY_MS);
          if (isCancelledRef.current) return;
          isCameraGranted = await cameraPermission.requestPermission();
        }

        if (isCancelledRef.current) return;
        setReady(true);

        if (!isCameraGranted) {
          await speakExclusive(PERMISSIONS.CAMERA_DENIED);
          return;
        }

        await speakExclusive(PERMISSIONS.WELCOME);
        const hasVietnameseVoice = await checkVietnameseVoice();
        if (!hasVietnameseVoice && !isCancelledRef.current) {
          await speakExclusive(ERRORS.NO_VI_VOICE);
        }
      } catch (err) {
        console.warn('Lỗi khi xin quyền:', err);
        if (!isCancelledRef.current) {
          setReady(true);
        }
      }
    };

    void runBootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready, cameraGranted: cameraPermission.hasPermission, micGranted };
}
