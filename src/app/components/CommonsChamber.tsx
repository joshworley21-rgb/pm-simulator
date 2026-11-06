import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fileFontFamily, font, headingFontFamily, spacing } from '../theme';
import type { Party } from '../types';
import { divisionStamp, type ParliamentaryVoteResult } from '../parliamentaryVotes';

export interface CommonsChamberProps {
  parties: Party[];
  playerPartyId?: string;
  /** The most recent division result, when the House has just voted. */
  result?: ParliamentaryVoteResult;
  /** Optional override; defaults to the sum of party seats or 650. */
  totalSeats?: number;
}

const ROW_WEIGHTS = [0.12, 0.18, 0.21, 0.23, 0.26];
const ROWS = ROW_WEIGHTS.length;

function allocateSeats(total: number, weights: number[]): number[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (total * weight) / weightTotal);
  const counts = raw.map((value) => Math.floor(value));
  let remaining = total - counts.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining; i += 1) {
    counts[order[i % order.length].index] += 1;
  }
  return counts;
}

function seatDots(rows: number[]): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  rows.forEach((count, rowIndex) => {
    const radius = 16 + rowIndex * 8;
    for (let seat = 0; seat < count; seat += 1) {
      const progress = count <= 1 ? 0.5 : seat / (count - 1);
      const angle = Math.PI + progress * Math.PI;
      dots.push({
        x: 50 + radius * Math.cos(angle),
        y: 88 + radius * Math.sin(angle),
      });
    }
  });
  return dots;
}

function stampTone(stamp: string | null): { color: string; border: string } {
  if (stamp === 'DEFEATED') return { color: colors.danger, border: colors.danger };
  if (stamp === 'AMENDED') return { color: colors.warning, border: colors.warning };
  return { color: colors.success, border: colors.success };
}

/**
 * Stylised green-bench Commons chamber. Seats are coloured by party so the
 * balance of the House is readable at a glance; the latest division is shown
 * as a live Ayes/Noes tally and an official result stamp.
 */
export function CommonsChamber({
  parties,
  playerPartyId,
  result,
  totalSeats = 650,
}: CommonsChamberProps) {
  const seatCounts = useMemo(
    () => allocateSeats(totalSeats, ROW_WEIGHTS),
    [totalSeats],
  );
  const dots = useMemo(() => seatDots(seatCounts), [seatCounts]);

  const seatColors = useMemo(() => {
    const colorsByParty: string[] = [];
    for (const party of parties) {
      for (let i = 0; i < party.seats; i += 1) colorsByParty.push(party.color);
    }
    return colorsByParty;
  }, [parties]);

  const stamp = divisionStamp(result);
  const tone = stampTone(stamp);
  const totalVotes = result ? Math.max(1, result.ayes + result.noes) : 0;

  return (
    <View style={styles.frame} testID="commons-chamber">
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>THE HOUSE OF COMMONS</Text>
          <Text style={styles.title}>Division of the House</Text>
        </View>
        {stamp ? (
          <View
            style={[styles.stamp, { borderColor: tone.border }]}
            testID="division-stamp"
          >
            <Text style={[styles.stampText, { color: tone.color }]}>{stamp}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.chamber}>
        <View style={styles.desk} />
        {dots.map((dot, index) => {
          const partyColor = seatColors[index];
          return (
            <View
              key={index}
              style={[
                styles.seat,
                {
                  left: `${dot.x}%`,
                  top: `${dot.y}%`,
                  backgroundColor: partyColor ?? colors.muted,
                },
              ]}
            />
          );
        })}
        <View style={styles.majorityLine}>
          <Text style={styles.majorityText}>326 TO GOVERN</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {parties.map((party) => (
          <View key={party.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: party.color }]} />
            <Text
              style={[
                styles.legendText,
                party.id === playerPartyId && styles.legendPlayer,
              ]}
              numberOfLines={1}
            >
              {party.abbreviation} {party.seats}
            </Text>
          </View>
        ))}
      </View>

      {result ? (
        <View style={styles.division} testID="division-live-tally">
          <View style={styles.tallyRow}>
            <Text style={[styles.tallyValue, { color: colors.success }]}>
              {result.ayes} AYES
            </Text>
            <Text style={[styles.tallyValue, { color: colors.danger }]}>
              {result.noes} NOES
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={{
                flex: result.ayes / totalVotes,
                backgroundColor: colors.success,
              }}
            />
            <View
              style={{
                flex: result.noes / totalVotes,
                backgroundColor: colors.danger,
              }}
            />
          </View>
          {result.rebels > 0 ? (
            <Text style={styles.rebelNote}>
              {result.rebels} government MP{result.rebels === 1 ? '' : 's'} rebelled.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.waiting}>Awaiting the division bells.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#143A2B',
    borderWidth: 1,
    borderColor: '#2F6B44',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: {
    color: '#C8D8C9',
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: '#F3EBD5',
    fontFamily: headingFontFamily,
    fontSize: font.h3,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  stamp: {
    borderWidth: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    transform: [{ rotate: '-3deg' }],
    maxWidth: 132,
  },
  stampText: {
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  chamber: {
    height: 190,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  desk: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    bottom: 10,
    height: 22,
    backgroundColor: '#0E2A1E',
    borderTopWidth: 2,
    borderTopColor: '#3C7A56',
  },
  seat: {
    position: 'absolute',
    width: 2.4,
    height: 2.4,
    borderRadius: 1.2,
  },
  majorityLine: {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#C8A75C',
    paddingLeft: 4,
  },
  majorityText: {
    color: '#C8A75C',
    fontFamily: fileFontFamily,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    color: '#C8D8C9',
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '700',
  },
  legendPlayer: {
    color: '#F3EBD5',
    textDecorationLine: 'underline',
  },
  division: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#2F6B44',
    paddingTop: spacing.sm,
  },
  tallyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tallyValue: {
    fontFamily: fileFontFamily,
    fontSize: font.small,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  track: {
    flexDirection: 'row',
    height: 6,
    backgroundColor: '#0E2A1E',
    overflow: 'hidden',
  },
  rebelNote: {
    color: '#C8D8C9',
    fontFamily: fileFontFamily,
    fontSize: 9,
    marginTop: spacing.xs,
  },
  waiting: {
    color: '#9DB4A1',
    fontFamily: fileFontFamily,
    fontSize: 9,
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
});
