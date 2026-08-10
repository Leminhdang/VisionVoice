import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme/colors';
import { CORNER_CONTROL, radius, SCREEN_PADDING } from '../theme/spacing';

export interface CornerControlProps {
  position: 'topLeft' | 'topRight' | 'bottomLeft';
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}

const ICON_SIZE = 32;
const HIT_SLOP = 8;
const BG_OPACITY = 0.6;

export function CornerControl({ position, iconName, label, hint, onPress }: CornerControlProps) {
  return (
    <TouchableOpacity
      style={[styles.base, positionStyles[position]]}
      onPress={onPress}
      hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <View style={styles.background} />
      <Ionicons name={iconName} size={ICON_SIZE} color={colors.accentSoft} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    width: CORNER_CONTROL,
    height: CORNER_CONTROL,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
    opacity: BG_OPACITY,
  },
  topLeft: {
    top: SCREEN_PADDING,
    left: SCREEN_PADDING,
  },
  topRight: {
    top: SCREEN_PADDING,
    right: SCREEN_PADDING,
  },
  bottomLeft: {
    bottom: SCREEN_PADDING,
    left: SCREEN_PADDING,
  },
});

const positionStyles = {
  topLeft: styles.topLeft,
  topRight: styles.topRight,
  bottomLeft: styles.bottomLeft,
} as const;
