import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
        <TouchableOpacity
          style={styles.stepButton}
          onPress={onDecrease}
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
        >
          <Ionicons name="remove" size={STEP_ICON_SIZE} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.valueText}>{valueText}</Text>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={onIncrease}
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
        >
          <Ionicons name="add" size={STEP_ICON_SIZE} color={colors.textPrimary} />
        </TouchableOpacity>
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
    <TouchableOpacity
      style={[styles.segmentButton, isSelected ? styles.segmentSelected : styles.segmentUnselected]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={isSelected ? styles.segmentTextSelected : styles.segmentText}>{label}</Text>
    </TouchableOpacity>
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
    height: TARGET_SECONDARY,
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
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    height: TARGET_SECONDARY,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.accentDeep,
  },
  segmentUnselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
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
