import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { hapticNavigate } from '../services/feedback';
import { colors } from '../theme/colors';
import { elevation } from '../theme/elevation';
import { radius, spacing, TARGET_PRIMARY, TARGET_SECONDARY } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface BigActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  compact?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
}

const DISABLED_OPACITY = 0.4;

export function BigActionButton({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: BigActionButtonProps) {
  const handlePress = useCallback(() => {
    void hapticNavigate();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        compact ? styles.heightCompact : styles.heightFull,
        containerByVariant[variant],
        variant === 'primary' && elevation.primary,
        pressed && !disabled && pressedByVariant[variant],
        pressed && !disabled && styles.pressedOutline,
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: radius,
    // Viền luôn hiện diện (mặc định trong suốt) để lúc nhấn chỉ đổi MÀU viền —
    // đổi cả bề dày sẽ làm nhãn nhảy vài pixel, rất khó chịu khi nhìn kém.
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // minHeight chứ không phải height: token là SÀN vùng chạm, không phải trần.
  // Người nhìn kém thường bật cỡ chữ hệ thống rất lớn; khoá chiều cao thì nhãn
  // bị cắt cụt đúng ở nhóm người dùng cần đọc được nó nhất.
  heightFull: {
    minHeight: TARGET_PRIMARY,
  },
  heightCompact: {
    minHeight: TARGET_SECONDARY,
  },
  primary: {
    backgroundColor: colors.accentDeep,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  danger: {
    backgroundColor: colors.dangerFill,
  },
  // Nhấn = nền sáng lên + viền nổi, KHÔNG phải mờ đi. Viền vẽ đè lên viền sẵn
  // có của variant secondary nên bề dày nút không đổi khi nhấn.
  primaryPressed: {
    backgroundColor: colors.accent,
  },
  secondaryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  dangerPressed: {
    backgroundColor: colors.danger,
  },
  pressedOutline: {
    borderColor: colors.accentSoft,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

const containerByVariant = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
} as const;

const pressedByVariant = {
  primary: styles.primaryPressed,
  secondary: styles.secondaryPressed,
  danger: styles.dangerPressed,
} as const;
