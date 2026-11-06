import React, { useMemo } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useGame } from '../../state';
import { colors, fileFontFamily, font, headingFontFamily, radius, spacing } from '../../theme';
import { Button, Card, Chip, Meter } from '../ui';
import { Swingometer } from './Swingometer';
import { REGIONS } from '../../data';

/** Election night: the declaration, the swingometer and the regional count. */
export default function ElectionNightModal() {
  const { state, dispatch } = useGame();

  const rankedParties = useMemo(() => [...state.parties].sort((a, b) => b.seats - a.seats), [state.parties]);
  const party = state.parties.find((p) => p.id === state.player?.partyId);
  const rivalParty = rankedParties.find((p) => p.id !== party?.id) ?? null;
  const electionWinner = rankedParties[0] ?? null;
  const electionHeadline =
    electionWinner && electionWinner.seats >= 326 ? `${electionWinner.name.toUpperCase()} WIN` : 'HUNG PARLIAMENT';

  const declarations = useMemo(
    () =>
      REGIONS.map((region) => {
        const seats = state.regionSeats?.[region.id] ?? {};
        const winnerId =
          Object.entries(seats)
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const prevWinnerId =
          Object.entries(region.support)
            .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const winner = state.parties.find((p) => p.id === winnerId) ?? null;
        return { region, winner, gain: !!winnerId && !!prevWinnerId && winnerId !== prevWinnerId };
      }),
    [state.regionSeats, state.parties],
  );

  return (
<Modal visible={state.isElection && !state.gameOver} transparent animationType="fade">
  <View style={styles.backdrop}>
    <View style={[styles.card, { maxHeight: '90%', width: '92%' }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>ELECTION NIGHT · THE COUNT</Text>
        <Text style={styles.headline}>{electionHeadline}</Text>
        <Text style={{ color: colors.faint, fontSize: font.small, textAlign: 'center', marginTop: 4, fontFamily: fileFontFamily }}>
          Terms won {state.termsWon} | legacy {state.legacyScore}
        </Text>
        {(() => {
          const mySeats = state.parties.find((p) => p.id === state.player?.partyId)?.seats ?? 0;
          const hasMajority = mySeats >= 326;
          return (
            <View style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: colors.text, fontSize: font.tiny, fontWeight: '800', flex: 1, marginRight: 8 }}>
                  {hasMajority ? `Working Majority (+${mySeats - 326})` : `Hung Parliament (${326 - mySeats} short of 326)`}
                </Text>
                <Text style={{ color: hasMajority ? colors.success : colors.warning, fontSize: font.tiny, fontWeight: '800' }}>
                  {mySeats} / 650
                </Text>
              </View>
              <Meter value={Math.round((mySeats / 650) * 100)} height={10} color={hasMajority ? colors.success : colors.warning} />
            </View>
          );
        })()}

        {party && rivalParty && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>THE SWINGOMETER</Text>
            <View style={{ marginTop: spacing.sm }}>
              <Swingometer player={party} rival={rivalParty} />
            </View>
          </Card>
        )}

        <Text style={[styles.label, { marginTop: spacing.lg }]}>THE TALLY | 650 SEATS</Text>
        <View style={{ marginTop: spacing.sm }}>
          {rankedParties.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: 10 }} />
              <Text style={{ color: colors.text, flex: 1, fontSize: font.body }}>{p.name}</Text>
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{p.seats}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>DECLARATIONS BY REGION</Text>
        <View style={{ marginTop: spacing.sm }}>
          {declarations.map(({ region, winner, gain }) => {
            const mine = winner?.id === party?.id;
            const rival = winner?.id === rivalParty?.id;
            return (
              <View key={region.id} style={styles.declarationRow}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: winner?.color ?? colors.muted, marginRight: 10 }} />
                <Text style={{ color: colors.text, flex: 1, fontSize: font.small }} numberOfLines={1}>
                  {region.name}
                </Text>
                <Chip
                  label={gain ? 'GAIN' : 'HOLD'}
                  tone={!gain ? 'neutral' : mine ? 'success' : rival ? 'danger' : 'warning'}
                />
                <Text style={{ color: colors.faint, fontSize: font.tiny, marginLeft: 8 }}>{region.seats} seats</Text>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Button label="Continue governing" onPress={() => dispatch({ type: 'DISMISS_ELECTION' })} />
        </View>
      </ScrollView>
    </View>
  </View>
</Modal>
  );
}

const styles = {
  backdrop: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(23,17,13,0.75)',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%' as const,
    maxHeight: '90%' as const,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '800' as const,
    letterSpacing: 2,
    textAlign: 'center' as const,
    fontFamily: fileFontFamily,
  },
  headline: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    fontFamily: headingFontFamily,
    marginTop: 2,
  },
  label: { color: colors.accent, fontSize: font.tiny, fontWeight: '800' as const, letterSpacing: 1.2 },
  declarationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderLight,
  },
};
