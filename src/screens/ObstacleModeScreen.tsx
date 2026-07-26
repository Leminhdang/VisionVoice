import { useIsFocused } from '@react-navigation/native';
import type { CameraView } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigActionButton } from '../components/BigActionButton';
import { CameraViewport } from '../components/CameraViewport';
import { SeverityBanner } from '../components/SeverityBanner';
import { NAV, OBSTACLE } from '../constants/strings';
import { announceScreen } from '../hooks/useAccessibilityFocus';
import { useObstacleScanner } from '../hooks/useObstacleScanner';
import { useVoiceControl } from '../hooks/useVoiceControl';
import type { ObstacleModeScreenProps } from '../navigation/types';
import { speakExclusive } from '../services/audioSession';
import { colors } from '../theme/colors';
import { SCREEN_PADDING, spacing } from '../theme/spacing';

/** Độ mờ lớp phủ tối trên khung camera (~55%). */
const SCRIM_OPACITY = 0.55;

/**
 * Chế độ dò vật cản: camera chạy nền, useObstacleScanner quét theo chu kỳ khi
 * màn hình đang focus (blur → active=false → vòng quét dừng hẳn, không TTS
 * rơi rớt sau khi thoát). Màn hình luôn sáng nhờ useKeepAwake.
 */
export default function ObstacleModeScreen({ navigation }: ObstacleModeScreenProps) {
  useKeepAwake();

  const cameraRef = useRef<CameraView | null>(null);
  const isFocused = useIsFocused();
  const { assessment } = useObstacleScanner(cameraRef, { active: isFocused });
  const severity = assessment?.severity ?? 'safe';

  const exit = useCallback(() => {
    void speakExclusive(OBSTACLE.EXIT);
    navigation.goBack();
  }, [navigation]);

  useVoiceControl({ stop: exit, back: exit });

  useEffect(() => {
    announceScreen(NAV.OBSTACLE);
    void speakExclusive(NAV.OBSTACLE);
    // Không dừng TTS khi unmount: exit() vừa phát OBSTACLE.EXIT ngay trước khi
    // rời màn hình — gọi tts.stop() ở đây sẽ cắt mất câu thông báo thoát.
    // Vòng quét và ASR đã tự dọn dẹp qua active/useFocusEffect.
  }, []);

  return (
    <View style={styles.container}>
      <CameraViewport ref={cameraRef} />
      <View pointerEvents="none" style={styles.scrim} />
      <SeverityBanner severity={severity} objectLabel={assessment?.label} />
      <View style={styles.stopZone}>
        <BigActionButton
          label={OBSTACLE.STOP_BUTTON}
          onPress={exit}
          variant={severity === 'safe' ? 'danger' : 'secondary'}
          accessibilityLabel={OBSTACLE.STOP_BUTTON}
          accessibilityHint={OBSTACLE.STOP_HINT}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: SCRIM_OPACITY,
  },
  stopZone: {
    position: 'absolute',
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
    bottom: spacing.xl,
  },
});
