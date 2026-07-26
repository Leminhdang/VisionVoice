import { useCallback, useEffect } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigActionButton } from '../components/BigActionButton';
import { SegmentedRow, StepperRow } from '../components/SettingRow';
import { NAV, SCREEN_TITLES, SETTINGS } from '../constants/strings';
import { announceScreen, useAccessibilityFocus } from '../hooks/useAccessibilityFocus';
import { useVoiceControl } from '../hooks/useVoiceControl';
import type { SettingsScreenProps } from '../navigation/types';
import * as audioSession from '../services/audioSession';
import { notifySuccess } from '../services/feedback';
import { clearSession, getSessionJson } from '../services/metrics';
import * as tts from '../services/tts';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import { radiusLg, SCREEN_PADDING, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const RATE_MIN = 0.5;
const RATE_MAX = 1.5;
const PITCH_MIN = 0.8;
const PITCH_MAX = 1.2;
const STEP = 0.1;

const SENSITIVITY_OPTIONS = [
  { key: 'low', label: SETTINGS.SENSITIVITY_LOW },
  { key: 'medium', label: SETTINGS.SENSITIVITY_MEDIUM },
  { key: 'high', label: SETTINGS.SENSITIVITY_HIGH },
] as const;

/** Cộng/trừ theo bước 0.1 rồi kẹp trong [min, max], tránh sai số dấu phẩy động. */
function stepValue(value: number, delta: number, min: number, max: number): number {
  const rounded = Math.round((value + delta) * 10) / 10;
  return Math.min(max, Math.max(min, rounded));
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { settings, updateSettings } = useSettings();
  const { ref: titleRef, focusNow } = useAccessibilityFocus();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    focusNow();
    announceScreen(NAV.SETTINGS);
    void audioSession.speakExclusive(NAV.SETTINGS);
    return () => {
      tts.stop();
    };
  }, [focusNow]);

  const handleBack = useCallback(() => {
    navigation.goBack();
    void audioSession.speakExclusive(SETTINGS.EXIT);
  }, [navigation]);

  useVoiceControl({ back: handleBack });

  const changeRate = useCallback(
    (delta: number) => {
      const next = stepValue(settings.ttsRate, delta, RATE_MIN, RATE_MAX);
      updateSettings({ ttsRate: next });
      void audioSession.speakExclusive(SETTINGS.SAMPLE_RATE, { rate: next });
    },
    [settings.ttsRate, updateSettings],
  );

  const increaseRate = useCallback(() => changeRate(STEP), [changeRate]);
  const decreaseRate = useCallback(() => changeRate(-STEP), [changeRate]);

  const changePitch = useCallback(
    (delta: number) => {
      const next = stepValue(settings.ttsPitch, delta, PITCH_MIN, PITCH_MAX);
      updateSettings({ ttsPitch: next });
      void audioSession.speakExclusive(SETTINGS.SAMPLE_PITCH, { pitch: next });
    },
    [settings.ttsPitch, updateSettings],
  );

  const increasePitch = useCallback(() => changePitch(STEP), [changePitch]);
  const decreasePitch = useCallback(() => changePitch(-STEP), [changePitch]);

  const handleSensitivitySelect = useCallback(
    (key: string) => {
      if (key !== 'low' && key !== 'medium' && key !== 'high') {
        return;
      }
      updateSettings({ obstacleSensitivity: key });
      const option = SENSITIVITY_OPTIONS.find((candidate) => candidate.key === key);
      if (option !== undefined) {
        void audioSession.speakExclusive(option.label);
      }
    },
    [updateSettings],
  );

  const handleTestVoice = useCallback(() => {
    void tts.speakAlways(SETTINGS.TEST_SENTENCE);
  }, []);

  const handleExport = useCallback(() => {
    Share.share({ message: getSessionJson() }).catch((err: unknown) => {
      console.warn('Lỗi khi xuất nhật ký đánh giá:', err);
    });
  }, []);

  const handleClear = useCallback(() => {
    clearSession();
    void notifySuccess();
    void audioSession.speakExclusive(SETTINGS.CLEARED);
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <BigActionButton
        label={SETTINGS.BACK}
        onPress={handleBack}
        variant="secondary"
        compact
        accessibilityLabel={SETTINGS.BACK}
        accessibilityHint={SETTINGS.BACK_HINT}
      />
      <View ref={titleRef} accessible accessibilityRole="header">
        <Text style={styles.title}>{SCREEN_TITLES.SETTINGS}</Text>
      </View>
      <StepperRow
        label={SETTINGS.SPEECH_RATE}
        valueText={settings.ttsRate.toFixed(1)}
        onIncrease={increaseRate}
        onDecrease={decreaseRate}
        increaseLabel={SETTINGS.RATE_UP}
        decreaseLabel={SETTINGS.RATE_DOWN}
      />
      <StepperRow
        label={SETTINGS.SPEECH_PITCH}
        valueText={settings.ttsPitch.toFixed(1)}
        onIncrease={increasePitch}
        onDecrease={decreasePitch}
        increaseLabel={SETTINGS.PITCH_UP}
        decreaseLabel={SETTINGS.PITCH_DOWN}
      />
      <SegmentedRow
        label={SETTINGS.OBSTACLE_SENSITIVITY}
        options={SENSITIVITY_OPTIONS}
        selectedKey={settings.obstacleSensitivity}
        onSelect={handleSensitivitySelect}
      />
      <BigActionButton
        label={SETTINGS.TEST_VOICE}
        onPress={handleTestVoice}
        accessibilityLabel={SETTINGS.TEST_VOICE}
      />
      <BigActionButton
        label={SETTINGS.EXPORT_METRICS}
        onPress={handleExport}
        variant="secondary"
        compact
        accessibilityLabel={SETTINGS.EXPORT_METRICS}
        accessibilityHint={SETTINGS.EXPORT_HINT}
      />
      <BigActionButton
        label={SETTINGS.CLEAR_METRICS}
        onPress={handleClear}
        variant="danger"
        compact
        accessibilityLabel={SETTINGS.CLEAR_METRICS}
        accessibilityHint={SETTINGS.CLEAR_HINT}
      />
      <View style={styles.aboutCard} accessible>
        <Text style={styles.aboutText}>{SETTINGS.ABOUT}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgAlt,
  },
  content: {
    padding: SCREEN_PADDING,
    gap: spacing.lg,
    paddingBottom: spacing.huge,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: radiusLg,
    padding: spacing.lg,
  },
  aboutText: {
    ...typography.body,
    color: colors.textBody,
  },
});
