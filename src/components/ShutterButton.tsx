import { Pressable, StyleSheet, View } from 'react-native';

import { CAPTURE } from '../constants/strings';
import { colors } from '../theme/colors';
import { elevation } from '../theme/elevation';
import { SHUTTER_ZONE } from '../theme/spacing';

export interface ShutterButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const CIRCLE_SIZE = 104;
const RING_WIDTH = 6;
const PRESSED_SCALE = 0.94;

export function ShutterButton({ onPress, disabled = false }: ShutterButtonProps) {
  return (
    <Pressable
      style={styles.zone}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={CAPTURE.SHUTTER_LABEL}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => (
        <View
          style={[styles.circle, pressed && !disabled && styles.circlePressed]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: {
    width: '100%',
    height: SHUTTER_ZONE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: colors.textPrimary,
    borderWidth: RING_WIDTH,
    borderColor: colors.accent,
    ...elevation.hero,
  },
  // Co nhẹ + vòng sáng lên: chuyển động đủ nhỏ để không gây khó chịu, nhưng
  // thấy được cả khi thị lực còn rất ít.
  circlePressed: {
    borderColor: colors.accentSoft,
    transform: [{ scale: PRESSED_SCALE }],
  },
});
