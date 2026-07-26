import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { STATE } from '../constants/strings';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type IndicatorState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface StateIndicatorProps {
  state: IndicatorState;
}

const RING_SIZE = 96;
const RING_BORDER = 6;
const PULSE_SCALE = 1.12;
const PULSE_DURATION_MS = 900;
const ROTATE_DURATION_MS = 1200;
const IDLE_OPACITY = 0.4;

const RING_COLOR: Record<IndicatorState, string> = {
  idle: colors.textMuted,
  listening: colors.success,
  thinking: colors.accent,
  speaking: colors.accentSoft,
};

const STATE_WORD: Record<IndicatorState, string> = {
  idle: '',
  listening: STATE.LISTENING,
  thinking: STATE.THINKING,
  speaking: STATE.SPEAKING,
};

export function StateIndicator({ state }: StateIndicatorProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: PULSE_SCALE,
            duration: PULSE_DURATION_MS,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: PULSE_DURATION_MS,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => {
        pulse.stop();
        scaleAnim.setValue(1);
      };
    }
    if (state === 'thinking') {
      const spin = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: ROTATE_DURATION_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spin.start();
      return () => {
        spin.stop();
        rotateAnim.setValue(0);
      };
    }
    return undefined;
  }, [state, scaleAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const word = STATE_WORD[state];

  return (
    <View style={[styles.container, state === 'idle' && styles.idle]}>
      <Animated.View
        style={[
          styles.ring,
          { borderColor: RING_COLOR[state] },
          state === 'thinking'
            ? { borderTopColor: 'transparent', transform: [{ rotate: rotation }] }
            : { transform: [{ scale: scaleAnim }] },
        ]}
      />
      {word !== '' && (
        <Text
          style={[styles.word, { color: RING_COLOR[state] }]}
          accessibilityLiveRegion="polite"
        >
          {word}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  idle: {
    opacity: IDLE_OPACITY,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_BORDER,
  },
  word: {
    ...typography.display,
    textAlign: 'center',
  },
});
