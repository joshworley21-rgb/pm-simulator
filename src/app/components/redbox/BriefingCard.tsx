import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../ui';
import { colors, font, headingFontFamily, spacing } from '../../theme';

export type BriefingTone = 'default' | 'warning' | 'danger' | 'success' | 'accent';

export interface BriefingCardProps {
  eyebrow: string;
  title: string;
  body: string;
  tone?: BriefingTone;
  meta?: string;
  actionLabel?: string;
  onPress?: () => void;
  testID?: string;
}

export function BriefingCard({
  eyebrow,
  title,
  body,
  tone = 'default',
  meta,
  actionLabel,
  onPress,
  testID,
}: BriefingCardProps) {
  const cardTone = tone === 'warning' ? 'default' : tone;
  const textColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'success'
        ? colors.success
        : tone === 'accent'
          ? colors.accent
          : tone === 'warning'
            ? colors.warning
            : colors.muted;

  const content = (
    <Card tone={cardTone}>
      <Text style={[styles.eyebrow, { color: textColor }]}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {onPress ? (
        <View style={styles.action}>
          {/* Non-compact + explicit floor: keeps the hit target above the 44px
              minimum with headroom instead of sitting on the boundary. */}
          <Button
            label={actionLabel ?? 'Open'}
            onPress={onPress}
            variant={tone === 'danger' ? 'danger' : 'secondary'}
            style={styles.actionButton}
          />
        </View>
      ) : null}
    </Card>
  );

  return onPress ? (
    <Pressable testID={testID} onPress={onPress} hitSlop={8} style={styles.pressable}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 44,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
    fontFamily: headingFontFamily,
    marginTop: spacing.xs,
  },
  body: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  meta: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: spacing.sm,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  actionButton: {
    minHeight: 48,
  },
});
