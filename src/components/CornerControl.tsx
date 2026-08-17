import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // Màn hình không có header (headerShown: false), nên nút góc phải tự tránh
  // status bar / Dynamic Island ở trên và thanh home ở dưới.
  const insets = useSafeAreaInsets();
  const insetStyle =
    position === 'bottomLeft'
      ? { bottom: SCREEN_PADDING + insets.bottom }
      : { top: SCREEN_PADDING + insets.top };

  return (
    <TouchableOpacity
      style={[styles.base, positionStyles[position], insetStyle]}
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
  // Trục dọc do insetStyle quyết định — ở đây chỉ đặt trục ngang.
  topLeft: {
    left: SCREEN_PADDING,
  },
  topRight: {
    right: SCREEN_PADDING,
  },
  bottomLeft: {
    left: SCREEN_PADDING,
  },
});

const positionStyles = {
  topLeft: styles.topLeft,
  topRight: styles.topRight,
  bottomLeft: styles.bottomLeft,
} as const;
