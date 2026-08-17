import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigActionButton } from '../components/BigActionButton';
import { StateIndicator } from '../components/StateIndicator';
import type { IndicatorState } from '../components/StateIndicator';
import { TranscriptList } from '../components/TranscriptList';
import type { TranscriptTurn } from '../components/TranscriptList';
import { NAV, QA } from '../constants/strings';
import { announceScreen } from '../hooks/useAccessibilityFocus';
import { useQASession } from '../hooks/useQASession';
import type { QAStatus, UseQASessionOptions } from '../hooks/useQASession';
import { useVolumeButtonPTT } from '../hooks/useVolumeButtonPTT';
import type { QASessionScreenProps } from '../navigation/types';
import * as audioSession from '../services/audioSession';
import type { PreparedImage } from '../services/imagePipeline';
import * as tts from '../services/tts';
import { colors } from '../theme/colors';
import { radiusSm, SCREEN_PADDING, SHUTTER_ZONE, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Màn hình hỏi đáp về một ảnh đã chụp.
 *
 * Trình tự đọc khi vào màn hình: useQASession tự đọc QA.ASK_PROMPT ngay khi
 * mount, và tts.speak mặc định flush (cắt câu đang đọc) — nên nếu mount phần
 * Q&A cùng lúc với lời giới thiệu thì ASK_PROMPT sẽ cắt ngang NAV.QA. Vì vậy
 * màn hình được tách hai tầng: tầng ngoài (QASessionScreen) đọc NAV.QA cho
 * XONG rồi mới mount tầng trong (QASessionActive) — lúc đó useQASession mới
 * chạy và đọc ASK_PROMPT rồi bắt đầu nghe.
 *
 * useVoiceControl KHÔNG dùng ở đây: audioSession đã thuộc về useQASession;
 * lệnh thoát bằng giọng nói đi qua onExitIntent của chính useQASession.
 */

const HEADER_HEIGHT = 96;
const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 72;

const INDICATOR_BY_STATUS: Record<QAStatus, IndicatorState> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  answering: 'speaking',
};

export default function QASessionScreen({ route, navigation }: QASessionScreenProps) {
  const { image, caption } = route.params;
  const [isIntroDone, setIsIntroDone] = useState(false);
  // true khi lời giới thiệu NAV.QA có thể còn đang đọc — chỉ khi đó cleanup
  // mới được phép tts.stop() (để không cắt nhầm câu QA.EXIT lúc thoát).
  const isIntroSpeechActiveRef = useRef(true);

  const introTurns = useMemo<ReadonlyArray<TranscriptTurn>>(
    () => [{ role: 'assistant', text: caption }],
    [caption],
  );

  useEffect(() => {
    announceScreen(NAV.QA);
    let isCancelled = false;
    const finishIntro = (): void => {
      isIntroSpeechActiveRef.current = false;
      if (!isCancelled) {
        setIsIntroDone(true);
      }
    };
    audioSession
      .speakExclusive(NAV.QA)
      .then(finishIntro)
      .catch((err) => {
        console.warn('Lỗi khi đọc lời giới thiệu hỏi đáp:', err);
        finishIntro();
      });
    return () => {
      isCancelled = true;
      if (isIntroSpeechActiveRef.current) {
        tts.stop();
      }
    };
  }, []);

  const handleIntroBack = useCallback(() => {
    // Thoát ngay trong lúc giới thiệu: chưa có phiên Q&A nào để kết thúc.
    isIntroSpeechActiveRef.current = false;
    void audioSession.speakExclusive(QA.EXIT);
    navigation.goBack();
  }, [navigation]);

  if (!isIntroDone) {
    return (
      <QASessionLayout
        imageUri={image.uri}
        indicatorState="speaking"
        turns={introTurns}
        onBack={handleIntroBack}
      />
    );
  }

  return <QASessionActive image={image} caption={caption} navigation={navigation} />;
}

interface QASessionActiveProps {
  image: PreparedImage;
  caption: string;
  navigation: QASessionScreenProps['navigation'];
}

function QASessionActive({ image, caption, navigation }: QASessionActiveProps) {
  // onExitIntent cần exit(), nhưng exit() lại cần kết quả của useQASession —
  // giải vòng lặp bằng ref giữ bản exit mới nhất.
  const exitRef = useRef<() => void>(() => {});

  const qaOptions = useMemo<UseQASessionOptions>(
    () => ({
      onExitIntent: () => {
        exitRef.current();
      },
    }),
    [],
  );

  const { status, turns, interrupt, end } = useQASession(image, qaOptions);

  const exit = useCallback(() => {
    end();
    void audioSession.speakExclusive(QA.EXIT);
    navigation.goBack();
  }, [end, navigation]);

  useEffect(() => {
    exitRef.current = exit;
    return () => {
      exitRef.current = () => {};
    };
  }, [exit]);

  const handlePushToTalk = useCallback(() => {
    // interrupt() tự mở lại mic ngay sau khi cắt lời (barge-in) — không gọi
    // thêm beginListening() để tránh phát âm báo bắt đầu nghe hai lần.
    interrupt();
  }, [interrupt]);

  useVolumeButtonPTT(handlePushToTalk);

  // Rời màn hình (blur hoặc unmount) là kết thúc phiên hỏi đáp ngay.
  useFocusEffect(
    useCallback(() => {
      return () => {
        end();
      };
    }, [end]),
  );

  const displayTurns = useMemo<ReadonlyArray<TranscriptTurn>>(
    () => [{ role: 'assistant', text: caption }, ...turns],
    [caption, turns],
  );

  return (
    <QASessionLayout
      imageUri={image.uri}
      indicatorState={INDICATOR_BY_STATUS[status]}
      turns={displayTurns}
      onBack={exit}
      onMicPressIn={handlePushToTalk}
    />
  );
}

interface QASessionLayoutProps {
  imageUri: string;
  indicatorState: IndicatorState;
  turns: ReadonlyArray<TranscriptTurn>;
  onBack: () => void;
  /** Không truyền = vùng mic bị vô hiệu (giai đoạn giới thiệu). */
  onMicPressIn?: () => void;
}

function QASessionLayout({
  imageUri,
  indicatorState,
  turns,
  onBack,
  onMicPressIn,
}: QASessionLayoutProps) {
  const isMicDisabled = onMicPressIn === undefined;
  // Không có header điều hướng, nên màn hình tự chừa chỗ cho status bar ở trên
  // và thanh home ở dưới — nếu không, nút Quay lại và vùng mic bị che.
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top }]}>
        <View style={styles.backWrap}>
          <BigActionButton
            label={QA.BACK}
            onPress={onBack}
            variant="secondary"
            compact
            accessibilityLabel={QA.BACK}
            accessibilityHint={QA.BACK_HINT}
          />
        </View>
        <View style={styles.thumbFrame}>
          <Image
            source={{ uri: imageUri }}
            style={styles.thumb}
            accessible
            accessibilityRole="image"
            accessibilityLabel={QA.IMAGE_LABEL}
          />
        </View>
      </View>
      <View style={styles.indicatorWrap}>
        <StateIndicator state={indicatorState} />
      </View>
      <View style={styles.transcript}>
        <TranscriptList turns={turns} />
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.micZone,
          { height: SHUTTER_ZONE + insets.bottom, paddingBottom: insets.bottom },
          pressed && !isMicDisabled && styles.micZonePressed,
        ]}
        onPressIn={onMicPressIn}
        disabled={isMicDisabled}
        accessibilityRole="button"
        accessibilityLabel={QA.HOLD_TO_ASK}
        accessibilityHint={QA.HOLD_HINT}
        accessibilityState={{ disabled: isMicDisabled }}
      >
        <Text style={styles.micLabel}>{QA.HOLD_TO_ASK}</Text>
        <Text style={styles.micCaption}>{QA.MIC_CAPTION}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgAlt,
  },
  // height/paddingTop đặt tại chỗ dùng vì phụ thuộc safe-area inset.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
  },
  backWrap: {
    width: '40%',
  },
  thumbFrame: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radiusSm,
    padding: spacing.xs,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radiusSm,
  },
  indicatorWrap: {
    paddingVertical: spacing.md,
  },
  transcript: {
    flex: 1,
  },
  // height/paddingBottom đặt tại chỗ dùng vì phụ thuộc safe-area inset.
  micZone: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  micZonePressed: {
    backgroundColor: colors.accentDeep,
  },
  micLabel: {
    ...typography.label,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  micCaption: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
