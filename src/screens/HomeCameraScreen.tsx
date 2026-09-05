import { useIsFocused } from "@react-navigation/native";
import type { CameraRef, CameraPhotoOutput } from "react-native-vision-camera";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BigActionButton } from "../components/BigActionButton";
import { CameraViewport } from "../components/CameraViewport";
import { CaptionPanel } from "../components/CaptionPanel";
import { CornerControl } from "../components/CornerControl";
import { ShutterButton } from "../components/ShutterButton";
import { StateIndicator } from "../components/StateIndicator";
import type { IndicatorState } from "../components/StateIndicator";
import {
  CAPTURE_DEBOUNCE_MS,
  CAPTURE_PHOTO_RESOLUTION,
} from "../constants/config";
import {
  CAPTURE,
  ERRORS,
  HOME,
  NAV,
  SCREEN_TITLES,
} from "../constants/strings";
import {
  announceScreen,
  useAccessibilityFocus,
} from "../hooks/useAccessibilityFocus";
import { useDebounceCallback } from "../hooks/useDebounceCallback";
import { usePermissionBootstrap } from "../hooks/usePermissionBootstrap";
import { useVoiceControl } from "../hooks/useVoiceControl";
import { useVolumeButtonPTT } from "../hooks/useVolumeButtonPTT";
import type { HomeCameraScreenProps } from "../navigation/types";
import * as audioSession from "../services/audioSession";
import {
  hapticCapture,
  hapticStop,
  notifyError,
  playShutter,
} from "../services/feedback";
import { describeImage, GeminiError } from "../services/gemini";
import { captureAndPrepare, prepareFromUri } from "../services/imagePipeline";
import type { PreparedImage } from "../services/imagePipeline";
import { logMetric, nextCaptureId } from "../services/metrics";
import * as tts from "../services/tts";
import { useCaptureMachine } from "../state/captureMachine";
import type { AppPhase } from "../state/captureMachine";
import { colors } from "../theme/colors";
import { SCREEN_PADDING, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

type CaptureTrigger = "voice" | "volume" | "button";

const GALLERY_IMAGE_QUALITY = 0.8;
const TOP_SCRIM_HEIGHT = 160;
const BOTTOM_SCRIM_HEIGHT = 220;

const INDICATOR_BY_PHASE: Record<AppPhase, IndicatorState> = {
  idle: "idle",
  capturing: "thinking",
  analyzing: "thinking",
  speaking: "speaking",
};

export default function HomeCameraScreen({
  navigation,
}: HomeCameraScreenProps) {
  const { ready } = usePermissionBootstrap();
  const isFocused = useIsFocused();
  const { phase, dispatch, canCapture, isProcessing } = useCaptureMachine();
  const insets = useSafeAreaInsets();
  const { ref: titleRef, focusNow } = useAccessibilityFocus();
  const cameraRef = useRef<CameraRef | null>(null);
  const photoOutputRef = useRef<CameraPhotoOutput | null>(null);
  const [lastImage, setLastImage] = useState<PreparedImage | null>(null);
  const [lastDescription, setLastDescription] = useState<string | null>(null);

  const hasResult =
    lastImage !== null && lastDescription !== null && phase === "idle";

  useEffect(() => {
    if (!ready) return undefined;
    focusNow();
    announceScreen(NAV.HOME);
    void audioSession.speakExclusive(NAV.HOME);
    return () => tts.stop();
  }, [ready, focusNow]);

  const analyzeAndSpeak = useCallback(
    async (image: PreparedImage, captureId: number): Promise<void> => {
      try {
        dispatch("ANALYZE_START");
        void audioSession.speakExclusive(CAPTURE.ANALYZING);
        const description = await describeImage(image, captureId);
        dispatch("SPEAK_START");
        logMetric({ event: "tts_start", captureId, chars: description.length });
        await audioSession.speakExclusive(description);
        dispatch("DONE");
        setLastImage(image);
        setLastDescription(description);
        await audioSession.speakExclusive(CAPTURE.RESULT_HINT);
      } catch (err) {
        console.warn("Lỗi khi phân tích ảnh:", err);
        dispatch("ERROR");
        void notifyError();
        const message =
          err instanceof GeminiError ? ERRORS[err.kind] : ERRORS.unknown;
        void audioSession.speakExclusive(message);
      }
    },
    [dispatch],
  );

  const runCaptureFlow = useCallback(
    async (trigger: CaptureTrigger): Promise<void> => {
      const output = photoOutputRef.current;
      if (output === null) {
        // Im lặng ở đây nghĩa là người dùng khiếm thị bấm chụp và không nhận
        // được phản hồi nào — phải nói ra.
        console.warn("Lỗi khi chụp ảnh: camera chưa sẵn sàng.");
        void notifyError();
        void audioSession.speakExclusive(ERRORS.CAMERA_NOT_READY);
        return;
      }
      const captureId = nextCaptureId();
      logMetric({ event: "capture_start", captureId, trigger });
      void hapticCapture();
      void playShutter();
      dispatch("CAPTURE_START");
      try {
        const image = await captureAndPrepare(output);
        await analyzeAndSpeak(image, captureId);
      } catch (err) {
        console.warn("Lỗi khi chụp ảnh:", err);
        dispatch("ERROR");
        void notifyError();
        void audioSession.speakExclusive(ERRORS.unknown);
      }
    },
    [analyzeAndSpeak, dispatch],
  );

  const debouncedCapture = useDebounceCallback(
    useCallback(
      (...args: unknown[]) => {
        const trigger = args[0];
        if (
          trigger === "voice" ||
          trigger === "volume" ||
          trigger === "button"
        ) {
          void runCaptureFlow(trigger);
        }
      },
      [runCaptureFlow],
    ),
    CAPTURE_DEBOUNCE_MS,
  );

  const handleNewCapture = useCallback(() => {
    setLastImage(null);
    setLastDescription(null);
    void audioSession.speakExclusive(CAPTURE.BACK_TO_CAMERA);
  }, []);

  const captureFlow = useCallback(
    (trigger: CaptureTrigger) => {
      // Từ màn kết quả, lệnh "chụp" đưa về chế độ máy ảnh thay vì chụp ngay.
      if (hasResult) {
        handleNewCapture();
        return;
      }
      if (!canCapture) return;
      debouncedCapture(trigger);
    },
    [hasResult, canCapture, handleNewCapture, debouncedCapture],
  );

  const pickImage = useCallback(async (): Promise<void> => {
    if (!canCapture) return;
    let pickedUri: string | null = null;
    try {
      const options = {
        mediaTypes: ["images" as const],
        quality: GALLERY_IMAGE_QUALITY,
      };
      const result = await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      pickedUri = result.assets[0]?.uri ?? null;
    } catch (err) {
      console.warn("Lỗi khi mở thư viện ảnh:", err);
      void audioSession.speakExclusive(ERRORS.GALLERY);
      return;
    }
    if (pickedUri === null) return;
    const captureId = nextCaptureId();
    logMetric({ event: "capture_start", captureId, trigger: "gallery" });
    dispatch("CAPTURE_START");
    try {
      const image = await prepareFromUri(pickedUri);
      await analyzeAndSpeak(image, captureId);
    } catch (err) {
      console.warn("Lỗi khi xử lý ảnh từ thư viện:", err);
      dispatch("ERROR");
      void notifyError();
      void audioSession.speakExclusive(ERRORS.GALLERY);
    }
  }, [canCapture, dispatch, analyzeAndSpeak]);

  const handlePhotoOutputReady = useCallback((output: CameraPhotoOutput) => {
    photoOutputRef.current = output;
  }, []);
  const handlePhotoOutputLost = useCallback(() => {
    photoOutputRef.current = null;
  }, []);

  // Unmount không kích hoạt onPhotoOutputLost, nên buông tham chiếu ở đây.
  useEffect(() => {
    if (!isFocused) {
      photoOutputRef.current = null;
    }
  }, [isFocused]);

  const handleGallery = useCallback(() => void pickImage(), [pickImage]);
  const handleShutterPress = useCallback(
    () => captureFlow("button"),
    [captureFlow],
  );
  const handleVoiceCapture = useCallback(
    () => captureFlow("voice"),
    [captureFlow],
  );
  const handleVolumePress = useCallback(
    () => captureFlow("volume"),
    [captureFlow],
  );

  const openQA = useCallback(() => {
    if (lastImage === null || lastDescription === null) {
      void audioSession.speakExclusive(CAPTURE.NO_IMAGE_YET);
      return;
    }
    navigation.navigate("QASession", {
      image: lastImage,
      caption: lastDescription,
    });
  }, [lastImage, lastDescription, navigation]);

  const repeatDescription = useCallback(() => {
    if (lastDescription === null) {
      void audioSession.speakExclusive(CAPTURE.NO_IMAGE_YET);
      return;
    }
    void audioSession.speakExclusive(lastDescription);
  }, [lastDescription]);

  const openSettings = useCallback(
    () => navigation.navigate("Settings"),
    [navigation],
  );
  const openObstacle = useCallback(
    () => navigation.navigate("ObstacleMode"),
    [navigation],
  );
  const stopSpeaking = useCallback(() => {
    tts.stop();
    void hapticStop();
  }, []);

  useVolumeButtonPTT(handleVolumePress, {
    enabled: !hasResult && phase === "idle",
  });
  useVoiceControl(
    {
      capture: handleVoiceCapture,
      question: openQA,
      repeat: repeatDescription,
      obstacle: openObstacle,
      settings: openSettings,
      stop: stopSpeaking,
    },
    { enabled: ready },
  );

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.bootText}>{HOME.BOOTING}</Text>
      </View>
    );
  }

  if (hasResult && lastImage !== null && lastDescription !== null) {
    const pad = {
      paddingTop: insets.top + spacing.md,
      paddingBottom: insets.bottom + spacing.md,
    };
    return (
      <View style={[styles.resultContainer, pad]}>
        <CaptionPanel
          imageUri={lastImage.uri}
          caption={lastDescription}
          isLoading={false}
        />
        <View style={styles.actions}>
          <BigActionButton
            label={HOME.ASK_ABOUT_IMAGE}
            onPress={openQA}
            accessibilityLabel={HOME.ASK_ABOUT_IMAGE}
            accessibilityHint={HOME.ASK_HINT}
          />
          <BigActionButton
            label={HOME.NEW_CAPTURE}
            onPress={handleNewCapture}
            variant="secondary"
            compact
            accessibilityLabel={HOME.NEW_CAPTURE}
          />
          <BigActionButton
            label={HOME.READ_AGAIN}
            onPress={repeatDescription}
            variant="secondary"
            compact
            accessibilityLabel={HOME.READ_AGAIN}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraViewport
          ref={cameraRef}
          targetResolution={CAPTURE_PHOTO_RESOLUTION}
          onPhotoOutputReady={handlePhotoOutputReady}
          onPhotoOutputLost={handlePhotoOutputLost}
        />
      )}
      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />
      <View
        style={[styles.titleRow, { top: insets.top + spacing.md }]}
        ref={titleRef}
        accessible
        accessibilityRole="header"
      >
        <Text style={styles.title}>{SCREEN_TITLES.HOME}</Text>
      </View>
      {isProcessing && (
        <View style={styles.indicatorWrap} pointerEvents="none">
          <StateIndicator state={INDICATOR_BY_PHASE[phase]} />
        </View>
      )}
      {/* {__DEV__ && (
        <View style={styles.debugOverlay} pointerEvents="none">
          <Text style={styles.debugText} numberOfLines={5}>
            {`[${phase}] ${lastDescription ?? "—"}`}
          </Text>
        </View>
      )} */}
      <View
        style={[
          styles.shutterWrap,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      >
        <ShutterButton onPress={handleShutterPress} disabled={isProcessing} />
      </View>
      <CornerControl
        position="topLeft"
        iconName="settings-outline"
        onPress={openSettings}
        label={SCREEN_TITLES.SETTINGS}
        hint={HOME.SETTINGS_HINT}
      />
      <CornerControl
        position="topRight"
        iconName="walk-outline"
        onPress={openObstacle}
        label={SCREEN_TITLES.OBSTACLE}
        hint={HOME.OBSTACLE_HINT}
      />
      <CornerControl
        position="bottomLeft"
        iconName="images-outline"
        onPress={handleGallery}
        label={HOME.GALLERY_LABEL}
        hint={HOME.GALLERY_HINT}
      />
    </View>
  );
}

const scrimBase = { position: "absolute", left: 0, right: 0 } as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: SCREEN_PADDING,
  },
  bootText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  scrimTop: {
    ...scrimBase,
    top: 0,
    height: TOP_SCRIM_HEIGHT,
    backgroundColor: colors.scrimTop,
  },
  scrimBottom: {
    ...scrimBase,
    bottom: 0,
    height: BOTTOM_SCRIM_HEIGHT,
    backgroundColor: colors.scrimBottom,
  },
  titleRow: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  title: { ...typography.title, color: colors.textPrimary },
  indicatorWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  resultContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing.md,
  },
  actions: { gap: spacing.sm },
  debugOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    top: "45%",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: spacing.sm,
  },
  debugText: {
    ...typography.caption,
    color: colors.textPrimary,
    textAlign: "center",
  },
});
