import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing, TARGET_SECONDARY } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface StepperRowProps {
  label: string;
  valueText: string;
  onIncrease: () => void;
  onDecrease: () => void;
  increaseLabel: string;
  decreaseLabel: string;
}

export interface SegmentedRowProps {
  label: string;
  options: ReadonlyArray<{ key: string; label: string }>;
  selectedKey: string;
  onSelect: (key: string) => void;
}

const ROW_MIN_HEIGHT = 112;
const STEP_ICON_SIZE = 32;
const VALUE_MIN_WIDTH = 72;

export function StepperRow({
  label,
  valueText,
  onIncrease,
  onDecrease,
  increaseLabel,
  decreaseLabel,
}: StepperRowProps) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.controlPressed]}
          onPress={onDecrease}
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
        >
          <Ionicons name="remove" size={STEP_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.valueText}>{valueText}</Text>
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.controlPressed]}
          onPress={onIncrease}
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
        >
          <Ionicons name="add" size={STEP_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

interface SegmentButtonProps {
  optionKey: string;
  label: string;
  isSelected: boolean;
  onSelect: (key: string) => void;
}

function SegmentButton({ optionKey, label, isSelected, onSelect }: SegmentButtonProps) {
  const handlePress = useCallback(() => {
    onSelect(optionKey);
  }, [onSelect, optionKey]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.segmentButton,
        isSelected ? styles.segmentSelected : styles.segmentUnselected,
        pressed && styles.segmentPressed,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={isSelected ? styles.segmentTextSelected : styles.segmentText}>{label}</Text>
    </Pressable>
  );
}

export function SegmentedRow({ label, options, selectedKey, onSelect }: SegmentedRowProps) {
  return (
    <View style={styles.segmentedContainer}>
      <Text style={styles.segmentLabel}>{label}</Text>
      <View style={styles.segmentRow}>
        {options.map((option) => (
          <SegmentButton
            key={option.key}
            optionKey={option.key}
            label={option.label}
            isSelected={option.key === selectedKey}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepperRow: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperLabel: {
    ...typography.title,
    color: colors.textPrimary,
    flex: 1,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    width: TARGET_SECONDARY,
    // Xem ghi chú minHeight ở BigActionButton — dấu +/− dùng cỡ display,
    // phóng to theo hệ thống sẽ tràn khỏi ô vuông cố định.
    minHeight: TARGET_SECONDARY,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    ...typography.display,
    color: colors.accentText,
    textAlign: 'right',
    minWidth: VALUE_MIN_WIDTH,
  },
  segmentedContainer: {
    minHeight: ROW_MIN_HEIGHT,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  segmentLabel: {
    ...typography.title,
    color: colors.textPrimary,
  },
  // Cùng ngôn ngữ nhấn với BigActionButton: nền sáng lên + viền nổi.
  controlPressed: {
    backgroundColor: colors.surfacePressed,
    borderColor: colors.accentSoft,
  },
  // Nút phân đoạn dùng NỀN để thể hiện đang chọn, nên khi nhấn chỉ đổi viền —
  // đổi nền sẽ làm mục đang chọn trông như vừa bị bỏ chọn.
  segmentPressed: {
    borderColor: colors.accentSoft,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    minHeight: TARGET_SECONDARY,
    paddingVertical: spacing.sm,
    borderRadius: radius,
    // Viền cố định: mục được chọn và không được chọn phải cùng kích thước,
    // và lúc nhấn chỉ đổi màu viền.
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.accentDeep,
  },
  segmentUnselected: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  segmentText: {
    ...typography.label,
    color: colors.textBody,
  },
  segmentTextSelected: {
    ...typography.label,
    color: colors.textPrimary,
  },
});
