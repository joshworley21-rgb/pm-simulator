import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Card, Meter, SectionTitle, StatTile } from '../components/ui';
import { MotionRow, WHIP_LABEL } from '../components/division/MotionRow';
import { useGame } from '../state';
import { colors, font, spacing } from '../theme';
import { BILL_POOL } from '../bills';
import { BILL_POOL_2 } from '../bills2';
import { createDefaultWhips } from '../modules/whips';
import { TURNS_PER_SESSION } from '../parliament';
import { PURDAH_TURNS } from '../calendar';
import type { WhipLevel } from '../types';
import type { BillProgress } from '../parliament';

/** 650 Commons seats: a working majority is 326. */
const MAJORITY_LINE = 326;

export interface DivisionLobbyScreenProps {
  /**
   * When true, renders without its own ScrollView so it can nest inside an
   * existing scroll container (e.g. the GameScreen tab shell).
   */
  embedded?: boolean;
}

/**
 * Division Lobby — the whipping operation.
 *
 * Strictly bound to the engine: reads `state.bills`, `state.whips` and
 * `state.parliamentState`, and dispatches the existing PROPOSE_BILL action.
 * The whip control writes into PROPOSE_BILL.whipLevel, which is the only
 * place the engine stores a division's whip level.
 */
export default function DivisionLobbyScreen({ embedded = false }: DivisionLobbyScreenProps = {}) {
  const { state, dispatch } = useGame();

  const whips = state.whips ?? createDefaultWhips();
  const parliament = state.parliamentState;

  const ownSeats = state.parties.find((p) => p.id === state.player?.partyId)?.seats ?? 0;
  const partnerSeats =
    state.parties.find((p) => p.id === state.supplyPartnerId)?.seats ?? 0;
  const workingMajority = ownSeats + partnerSeats;
  const majorityDelta = workingMajority - MAJORITY_LINE;

  const letters = state.stats.lettersOfNoConfidence;
  const lettersThreshold = state.stats.lettersThreshold;

  // Bills already in Parliament, with their stage where the engine knows it.
  const progressByBillId = useMemo(() => {
    const map: Record<string, BillProgress> = {};
    for (const progress of parliament?.inProgress ?? []) map[progress.billId] = progress;
    return map;
  }, [parliament]);

  const activeBills = state.bills;

  // Bills not yet introduced, offered for a fresh division.
  const proposedIds = useMemo(() => new Set(activeBills.map((b) => b.id)), [activeBills]);
  const upcoming = useMemo(
    () => [...BILL_POOL, ...BILL_POOL_2].filter((b) => !proposedIds.has(b.id)).slice(0, 4),
    [proposedIds],
  );

  const [whipChoice, setWhipChoice] = useState<Record<string, WhipLevel>>({});
  const whipFor = (billId: string): WhipLevel => whipChoice[billId] ?? 'two-line';

  const sessionWeek = ((state.week - 1) % TURNS_PER_SESSION) + 1;
  // Mirrors engine inPurdah(): no new bills once the pre-election quiet period starts.
  const inPurdah = state.phase === 'playing' && state.turnsUntilElection <= PURDAH_TURNS;

  const body = (
    <>
      <Text style={styles.eyebrow}>THE HOUSE OF COMMONS</Text>
      <Text style={styles.title}>Division Lobby</Text>
      <Text style={styles.subtitle}>
        Session week {sessionWeek}/{TURNS_PER_SESSION} · Month {state.week}
      </Text>

      <SectionTitle title="The Numbers" hint="Your majority, your whips, and the letters meter." />
      <Card tone={majorityDelta >= 0 ? 'success' : 'danger'}>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>Working Majority</Text>
          <Text
            style={[
              styles.meterValue,
              { color: majorityDelta >= 0 ? colors.success : colors.danger },
            ]}
          >
            {majorityDelta >= 0 ? `+${majorityDelta}` : majorityDelta}
          </Text>
        </View>
        <Text style={styles.meterSub}>
          {workingMajority} seats (own {ownSeats}
          {partnerSeats > 0 ? ` + partner ${partnerSeats}` : ''}) vs the {MAJORITY_LINE} line
        </Text>
      </Card>

      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <StatTile
            label="Whip Strength"
            value={Math.round(whips.whipStrength)}
            tone={whips.whipStrength >= 60 ? 'success' : whips.whipStrength >= 35 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Rebel Pressure"
            value={Math.round(whips.rebelPressure)}
            tone={whips.rebellionImminent ? 'danger' : whips.rebelPressure >= 40 ? 'warning' : 'success'}
            hint={whips.rebellionImminent ? 'imminent' : undefined}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Payroll Votes"
            value={whips.payrollVotes}
            tone={whips.payrollVotes > 0 ? 'success' : 'default'}
          />
        </View>
      </View>

      <Card tone={whips.rebellionImminent ? 'danger' : 'default'}>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>Letters of No Confidence</Text>
          <Text style={styles.meterValue}>
            {letters}/{lettersThreshold}
          </Text>
        </View>
        <Meter
          value={letters}
          max={lettersThreshold}
          color={letters >= lettersThreshold ? colors.danger : colors.warning}
        />
        <Text style={styles.meterSub}>
          {letters >= lettersThreshold
            ? 'Threshold reached — a confidence vote is due.'
            : `${Math.max(0, lettersThreshold - letters)} more letter(s) to the threshold.`}
        </Text>
        <Text style={[styles.meterLabel, styles.secondMeter]}>Rebel Pressure</Text>
        <Meter
          value={whips.rebelPressure}
          color={whips.rebellionImminent ? colors.danger : colors.warning}
        />
      </Card>

      <SectionTitle title="Active Legislation" hint="Bills already before Parliament." />
      {activeBills.length === 0 ? (
        <EmptyState
          title="Nothing before the House"
          body="No bills are in progress. Bring one from the list below."
        />
      ) : (
        activeBills.map((bill) => {
          const progress = progressByBillId[bill.id];
          return (
            <MotionRow
              key={bill.id}
              title={bill.title}
              sponsor={bill.department}
              rebellionRisk={bill.rebellionRisk}
              stage={progress?.stage}
              weeksToDivision={bill.weeksToPass}
              whipLevel={bill.whipLevel ?? 'two-line'}
              testID={`active-${bill.id}`}
            />
          );
        })
      )}

      <SectionTitle
        title="Upcoming Divisions"
        hint={inPurdah ? 'Purdah: no new bills until after polling day.' : 'Set the whip, then bring it to the House.'}
      />
      {upcoming.length === 0 ? (
        <EmptyState title="No bills left" body="Every available bill has already been introduced." />
      ) : (
        upcoming.map((bill) => (
          <MotionRow
            key={bill.id}
            title={bill.title}
            sponsor={bill.department}
            rebellionRisk={bill.rebellionRisk}
            weeksToDivision={bill.weeksToPass}
            whipLevel={whipFor(bill.id)}
            onChangeWhip={(level) =>
              setWhipChoice((prev) => ({ ...prev, [bill.id]: level }))
            }
            actionLabel={`Bring to the House · ${WHIP_LABEL[whipFor(bill.id)]}`}
            actionDisabled={inPurdah}
            onAction={() =>
              dispatch({ type: 'PROPOSE_BILL', billId: bill.id, whipLevel: whipFor(bill.id) })
            }
            testID={`propose-${bill.id}`}
          />
        ))
      )}
    </>
  );

  return embedded ? (
    <View style={styles.content}>{body}</View>
  ) : (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.small,
    marginTop: spacing.xs,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  meterLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  meterValue: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '800',
  },
  meterSub: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  secondMeter: {
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  statTile: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
});
