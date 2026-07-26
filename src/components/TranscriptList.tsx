import { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { QA } from '../constants/strings';
import { colors } from '../theme/colors';
import { radiusLg, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface TranscriptTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface TranscriptListProps {
  turns: ReadonlyArray<TranscriptTurn>;
}

const ACCENT_BORDER_WIDTH = 3;

function keyExtractor(_turn: TranscriptTurn, index: number): string {
  return String(index);
}

export function TranscriptList({ turns }: TranscriptListProps) {
  const listRef = useRef<FlatList<TranscriptTurn>>(null);

  const handleContentSizeChange = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const renderItem = useCallback(({ item }: { item: TranscriptTurn }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={isUser ? styles.userRow : styles.assistantRow}
        accessible
        accessibilityLabel={isUser ? QA.TURN_USER(item.text) : QA.TURN_ASSISTANT(item.text)}
      >
        <Text style={isUser ? styles.userText : styles.assistantText}>{item.text}</Text>
      </View>
    );
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={turns}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  userRow: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: colors.surface,
    borderRadius: radiusLg,
    padding: spacing.md,
  },
  assistantRow: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    borderLeftWidth: ACCENT_BORDER_WIDTH,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  userText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  assistantText: {
    ...typography.bodyLarge,
    color: colors.textBody,
  },
});
