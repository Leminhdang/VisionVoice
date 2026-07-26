import { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { hapticNavigate } from '../services/feedback';
import { colors } from '../theme/colors';
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
    <TouchableOpacity
      style={[
        styles.base,
        compact ? styles.heightCompact : styles.heightFull,
        containerByVariant[variant],
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  heightFull: {
    height: TARGET_PRIMARY,
  },
  heightCompact: {
    height: TARGET_SECONDARY,
  },
  primary: {
    backgroundColor: colors.accentDeep,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  danger: {
    backgroundColor: colors.dangerFill,
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
