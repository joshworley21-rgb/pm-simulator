import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Meter } from '../ui';
import { colors, font, spacing } from '../../theme';
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

const loyaltyTone = (loyalty: number): 'success' | 'warning' | 'danger' =>
  loyalty >= 55 ? 'success' : loyalty >= 40 ? 'warning' : 'danger';

const competenceTone = (competence: number): 'success' | 'warning' | 'danger' =>
  competence >= 65 ? 'success' : competence >= 50 ? 'warning' : 'danger';

export function MinisterCard({
  minister,
  tenureWeeks,
  resignationRisk,
  leakRisk,
  onPress,
  testID,
}: MinisterCardProps) {
  const riskPct = Math.round(resignationRisk * 100);
  const lTone = loyaltyTone(minister.loyalty);
  const cTone = competenceTone(minister.competence);

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
        <Text
          style={[
            styles.meterValue,
            { color: lTone === 'danger' ? colors.accent : lTone === 'warning' ? colors.warning : colors.success },
          ]}
        >
          {Math.round(minister.loyalty)}
        </Text>
      </View>
      <Meter value={minister.loyalty} color={lTone === 'danger' ? colors.accent : lTone === 'warning' ? colors.warning : colors.success} />

      <View style={[styles.meterRow, styles.secondMeter]}>
        <Text style={styles.meterLabel}>Efficacy</Text>
        <Text
          style={[
            styles.meterValue,
            { color: cTone === 'danger' ? colors.accent : cTone === 'warning' ? colors.warning : colors.success },
          ]}
        >
          {Math.round(minister.competence)}
        </Text>
      </View>
      <Meter
        value={minister.competence}
        color={cTone === 'danger' ? colors.accent : cTone === 'warning' ? colors.warning : colors.success}
      />

      <Button label="Manage" variant="secondary" onPress={onPress} testID={testID} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, marginRight: spacing.sm },
  name: { color: colors.text, fontSize: font.body, fontWeight: '700', fontFamily: 'Georgia' },
  role: { color: colors.muted, fontSize: font.tiny, marginTop: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  meterLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginRight: 10,
  },
  meterValue: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  secondMeter: { marginTop: spacing.sm },
});
