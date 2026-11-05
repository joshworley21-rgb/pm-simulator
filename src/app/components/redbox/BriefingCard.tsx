import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, fileFontFamily, headingFontFamily, spacing } from '../../theme';

export interface BriefingCardProps {
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  actionLabel?: string;
  onPress?: () => void;
}

export function BriefingCard({
  eyebrow,
  title,
  body,
  meta,
  tone = 'default',
  actionLabel,
  onPress,
}: BriefingCardProps) {
  const urgent = tone === 'danger';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      <View style={[styles.file, urgent && styles.fileUrgent, tone === 'warning' && styles.fileWarning]}>
        <View style={styles.meta}>
          <Text style={styles.department} numberOfLines={1}>
            {eyebrow.toUpperCase()}
          </Text>
          {meta ? <Text style={[styles.deadline, urgent && styles.deadlineUrgent]}>{meta.toUpperCase()}</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.summary} numberOfLines={3}>
          {body}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.footerHint}>{(actionLabel ?? 'OPEN FILE').toUpperCase()}</Text>
          <Text style={styles.stamp}>{urgent ? 'REQUIRES ACTION' : 'FOR REVIEW'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  file: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorderLight,
    borderRadius: 2,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
    elevation: 3,
  },
  fileUrgent: {
    borderColor: colors.accent,
    borderLeftWidth: 5,
    borderLeftColor: colors.accent,
  },
  fileWarning: {
    borderLeftWidth: 5,
    borderLeftColor: colors.warning,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  department: {
    color: colors.muted,
    fontSize: font.tiny,
    fontFamily: fileFontFamily,
    letterSpacing: 1,
    flexShrink: 1,
  },
  deadline: {
    color: colors.muted,
    fontSize: font.tiny,
    fontFamily: fileFontFamily,
    letterSpacing: 0.6,
  },
  deadlineUrgent: {
    color: colors.accent,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    fontFamily: headingFontFamily,
    lineHeight: 22,
  },
  summary: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 18,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
    paddingTop: 8,
  },
  footerHint: {
    color: colors.textOnPaper,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stamp: {
    color: colors.stamp,
    fontSize: 9,
    fontFamily: fileFontFamily,
    letterSpacing: 1.2,
    borderWidth: 1,
    borderColor: colors.stamp,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '-4deg' }],
    opacity: 0.85,
  },
});
