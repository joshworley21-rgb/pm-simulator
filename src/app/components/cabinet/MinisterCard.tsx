import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Meter } from '../ui';
import { colors, font, headingFontFamily, spacing } from '../../theme';
import type { Minister } from '../../types';

export interface MinisterCardProps {
  minister: Minister;
  /** Weeks served in the current post (cabinetState.tenure[name] ?? 0). */
  tenureWeeks: number;
  /** 0..1 estimate from estimateResignationRisk(). */
  resignationRisk: number;
  /** True when this minister is currently a budget-leak risk. */
  leakRisk: boolean;
  /** Opens the reshuffle / sacking sheet for this minister. */
  onPress: () => void;
  testID?: string;
}

const loyaltyTone = (loyalty: number): string =>
  loyalty >= 55 ? colors.success : loyalty >= 40 ? colors.warning : colors.danger;

const competenceTone = (competence: number): string =>
  competence >= 65 ? colors.success : competence >= 50 ? colors.warning : colors.danger;

export function MinisterCard({
  minister,
  tenureWeeks,
  resignationRisk,
  leakRisk,
  onPress,
  testID,
}: MinisterCardProps) {
  const riskPct = Math.round(resignationRisk * 100);

  return (
    <Card tone={leakRisk ? 'danger' : 'default'}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {minister.name}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            {minister.post}
            {minister.coalition ? ' · coalition' : ''}
          </Text>
        </View>
        <Chip label={minister.faction} tone={minister.coalition ? 'neutral' : 'accent'} />
      </View>

      <View style={styles.chipRow}>
        {leakRisk ? <Chip label="LEAK RISK" tone="danger" /> : null}
        {resignationRisk >= 0.5 ? <Chip label={`RESIGN ${riskPct}%`} tone="warning" /> : null}
        <Chip label={`${tenureWeeks}m in post`} tone="neutral" />
      </View>

      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>Influence</Text>
        <Text style={[styles.meterValue, { color: loyaltyTone(minister.loyalty) }]}>
          {Math.round(minister.loyalty)}
        </Text>
      </View>
      <Meter value={minister.loyalty} color={loyaltyTone(minister.loyalty)} />

      <View style={[styles.meterRow, styles.secondMeter]}>
        <Text style={styles.meterLabel}>Efficacy</Text>
        <Text style={[styles.meterValue, { color: competenceTone(minister.competence) }]}>
          {Math.round(minister.competence)}
        </Text>
      </View>
      <Meter value={minister.competence} color={competenceTone(minister.competence)} />

      <Button label="Manage" variant="secondary" onPress={onPress} testID={testID} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
    fontFamily: headingFontFamily,
  },
  role: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  secondMeter: {
    marginTop: spacing.md,
  },
  meterLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  meterValue: {
    fontSize: font.tiny,
    fontWeight: '800',
  },
});
