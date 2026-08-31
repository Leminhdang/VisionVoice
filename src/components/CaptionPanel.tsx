import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CAPTURE } from '../constants/strings';
import { colors } from '../theme/colors';
import { radiusLg, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface CaptionPanelProps {
  imageUri: string;
  caption: string;
  isLoading: boolean;
}

const IMAGE_ASPECT_RATIO = 4 / 3;

export function CaptionPanel({ imageUri, caption, isLoading }: CaptionPanelProps) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={CAPTURE.IMAGE_LABEL}
      />
      <View style={styles.card}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.spinner} />
        ) : (
          <ScrollView contentContainerStyle={styles.captionContent}>
            <Text style={styles.caption} accessibilityLiveRegion="polite">
              {caption}
            </Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
  },
  image: {
    width: '100%',
    aspectRatio: IMAGE_ASPECT_RATIO,
    borderRadius: radiusLg,
    backgroundColor: colors.surfaceAlt,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radiusLg,
    padding: spacing.lg,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  captionContent: {
    paddingBottom: spacing.md,
  },
  caption: {
    ...typography.bodyLarge,
    color: colors.textBody,
  },
});
