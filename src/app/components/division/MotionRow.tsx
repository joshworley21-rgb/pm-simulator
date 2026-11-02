import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Meter, Segmented } from '../ui';
import { colors, font, spacing } from '../../theme';
import type { WhipLevel } from '../../types';

export interface MotionRowProps {
  /** Bill or motion title. */
  title: string;
  /** Who is carrying it. The engine stores a department, not a named sponsor. */
  sponsor: string;
  /** 0..100 rebellion risk (Bill.rebellionRisk). */
  rebellionRisk: number;
  /** Parliamentary stage label, for bills already in progress. */
  stage?: string;
  /** Months until the division. */
  weeksToDivision?: number;
  /** Current whip level. */
  whipLevel: WhipLevel;
  /** When provided, the whip control becomes interactive. */
  onChangeWhip?: (level: WhipLevel) => void;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  testID?: string;
}

const WHIP_OPTIONS: { key: WhipLevel; label: string }[] = [
  { key: 'three-line', label: 'Three-line' },
  { key: 'two-line', label: 'Two-line' },
  { key: 'free-vote', label: 'Free vote' },
];

export const WHIP_LABEL: Record<WhipLevel, string> = {
  'three-line': 'Three-Line Whip',
  'two-line': 'Two-Line Whip',
  'free-vote': 'Free Vote',
};

function riskTone(risk: number): 'danger' | 'warning' | 'success' {
  return risk > 40 ? 'danger' : risk > 20 ? 'warning' : 'success';
}

function titleCaseStage(stage: string): string {
  return stage.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MotionRow({
  title,
  sponsor,
  rebellionRisk,
  stage,
  weeksToDivision,
  whipLevel,
  onChangeWhip,
  actionLabel,
  onAction,
  actionDisabled,
  testID,
}: MotionRowProps) {
  const tone = riskTone(rebellionRisk);

  return (
    <Card tone={tone === 'danger' ? 'danger' : 'default'}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.sponsor} numberOfLines={1}>
        {sponsor}
      </Text>

      <View style={styles.chipRow}>
        <Chip label={`Rebellion risk ${Math.round(rebellionRisk)}%`} tone={tone} />
        {stage ? <Chip label={titleCaseStage(stage)} tone="accent" /> : null}
        {typeof weeksToDivision === 'number' ? (
          <Chip label={`${weeksToDivision}m to division`} tone="neutral" />
        ) : null}
      </View>

      <Meter
        value={rebellionRisk}
        color={tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.success}
      />

      <Text style={styles.whipLabel}>Whip</Text>
      {onChangeWhip ? (
        <Segmented options={WHIP_OPTIONS} value={whipLevel} onChange={onChangeWhip} />
      ) : (
        <Chip
          label={WHIP_LABEL[whipLevel]}
          tone={whipLevel === 'three-line' ? 'danger' : whipLevel === 'free-vote' ? 'neutral' : 'accent'}
        />
      )}

      {onAction ? (
        <Button
          label={actionLabel ?? 'Bring to the House'}
          onPress={onAction}
          disabled={actionDisabled}
          testID={testID}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
  },
  sponsor: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  whipLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
