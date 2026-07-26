import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { CAPTURE } from '../constants/strings';
import { colors } from '../theme/colors';
import { SHUTTER_ZONE } from '../theme/spacing';

export interface ShutterButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const CIRCLE_SIZE = 104;
const RING_WIDTH = 6;
const GLOW_OPACITY = 0.6;
const GLOW_RADIUS = 16;

export function ShutterButton({ onPress, disabled = false }: ShutterButtonProps) {
  return (
    <TouchableOpacity
      style={styles.zone}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={CAPTURE.SHUTTER_LABEL}
      accessibilityState={{ disabled }}
    >
      <View style={styles.circle} />
    </TouchableOpacity>
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
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: GLOW_OPACITY,
    shadowRadius: GLOW_RADIUS,
    elevation: 12,
  },
});
