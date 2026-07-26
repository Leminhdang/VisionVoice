import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { OBSTACLE } from '../constants/strings';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type BannerSeverity = 'safe' | 'warning' | 'danger';

export interface SeverityBannerProps {
  severity: BannerSeverity;
  objectLabel?: string | null;
}

const FADE_DURATION_MS = 180;
const FRAME_BORDER = 8;

const WORD_BY_SEVERITY: Record<BannerSeverity, string> = {
  safe: OBSTACLE.BANNER_SAFE,
  warning: OBSTACLE.BANNER_WARNING,
  danger: OBSTACLE.BANNER_DANGER,
};

export function SeverityBanner({ severity, objectLabel }: SeverityBannerProps) {
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const previousSeverityRef = useRef(severity);

  useEffect(() => {
    if (previousSeverityRef.current === severity) {
      return undefined;
    }
    previousSeverityRef.current = severity;
    opacityAnim.setValue(0);
    const fade = Animated.timing(opacityAnim, {
      toValue: 1,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    });
    fade.start();
    return () => {
      fade.stop();
    };
  }, [severity, opacityAnim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, fillBySeverity[severity], { opacity: opacityAnim }]}
    >
      {severity === 'safe' && <View style={styles.safeFrame} />}
      <View style={styles.content}>
        <Text style={[styles.word, wordBySeverity[severity]]}>{WORD_BY_SEVERITY[severity]}</Text>
        {severity !== 'safe' && objectLabel ? (
          <Text style={[styles.objectLabel, labelBySeverity[severity]]}>{objectLabel}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: FRAME_BORDER,
    borderColor: colors.success,
  },
  warningFill: {
    backgroundColor: colors.warning,
  },
  dangerFill: {
    backgroundColor: colors.dangerFill,
  },
  safeFill: {
    backgroundColor: 'transparent',
  },
  content: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  word: {
    ...typography.hero,
    textAlign: 'center',
  },
  safeWord: {
    color: colors.successText,
  },
  inkText: {
    color: colors.ink,
  },
  primaryText: {
    color: colors.textPrimary,
  },
  objectLabel: {
    ...typography.title,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

const fillBySeverity = {
  safe: styles.safeFill,
  warning: styles.warningFill,
  danger: styles.dangerFill,
} as const;

const wordBySeverity = {
  safe: styles.safeWord,
  warning: styles.inkText,
  danger: styles.primaryText,
} as const;

const labelBySeverity = {
  safe: styles.inkText,
  warning: styles.inkText,
  danger: styles.primaryText,
} as const;
