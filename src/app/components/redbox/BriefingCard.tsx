import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
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
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [entrance]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      <Animated.View
        style={[
          styles.file,
          urgent && styles.fileUrgent,
          tone === 'warning' && styles.fileWarning,
          { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] },
        ]}
      >
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
          <Text style={styles.footerHint}>{actionLabel ?? 'Open file'}</Text>
          <ArrowRight size={17} color={colors.accent} strokeWidth={1.8} />
        </View>
      </Animated.View>
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
    borderRadius: 0,
    padding: spacing.md,
  },
  fileUrgent: {
    borderColor: colors.danger,
    borderLeftWidth: 5,
    borderLeftColor: colors.danger,
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
    color: colors.accent,
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
    color: colors.danger,
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
    color: colors.accent,
    fontSize: font.small,
    fontWeight: '700',
  },
});
