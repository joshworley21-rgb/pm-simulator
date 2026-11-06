import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, EmptyState, Card, Meter, SectionTitle, Sheet, StatTile } from '../components/ui';
import { MotionRow, WHIP_LABEL } from '../components/division/MotionRow';
import { useGame } from '../state';
import { colors, font, fileFontFamily, headingFontFamily, spacing } from '../theme';
import { BILL_POOL } from '../bills';
import { BILL_POOL_2 } from '../bills2';
import { createDefaultWhips } from '../modules/whips';
import { TURNS_PER_SESSION, DIVISION_SLOTS_PER_SESSION, PARLIAMENT_ACT_LIMIT_PER_TERM } from '../parliament';
import { PURDAH_TURNS } from '../calendar';
import { CommonsChamber } from '../components/CommonsChamber';
import { pendingVotes, recentVotes, divisionStamp } from '../parliamentaryVotes';
import { backbenchBody } from '../westminster';
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
  const party = state.parties.find((p) => p.id === state.player?.partyId);
  const backbench = backbenchBody(party);

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
  const [resultOpen, setResultOpen] = useState(false);
  const whipFor = (billId: string): WhipLevel => whipChoice[billId] ?? 'two-line';

  const sessionWeek = ((state.week - 1) % TURNS_PER_SESSION) + 1;
  // Mirrors engine inPurdah(): no new bills once the pre-election quiet period starts.
  const inPurdah = state.phase === 'playing' && state.turnsUntilElection <= PURDAH_TURNS;
  // Commons time is a resource: every bill before the House holds a division slot.
  const orderPaperFull = activeBills.length >= DIVISION_SLOTS_PER_SESSION;
  const scheduledVotes = pendingVotes(parliament?.votes);
  const lastDivision = recentVotes(parliament?.votes)[0];
  const lastDivisionStamp = divisionStamp(lastDivision?.result);

  const body = (
    <>
      {!embedded && (
        <>
          <Text style={styles.eyebrow}>DIVISION RECORD</Text>
          <Text style={styles.title}>The House</Text>
          <Text style={styles.subtitle}>
            Session month {sessionWeek}/{TURNS_PER_SESSION} · Month {state.week}
          </Text>
        </>
      )}

      <CommonsChamber
        parties={state.parties}
        playerPartyId={state.player?.partyId}
        result={lastDivision?.result}
      />

      {state.budgetVoteDefeated || state.noConfidenceImminent ? (
        <Card tone="danger">
          <Text style={styles.budgetWarning}>
            BUDGET DEFEATED — a vote of no confidence is imminent.
          </Text>
        </Card>
      ) : null}

      <SectionTitle title="The Numbers" hint="Your majority, your whips and party pressure." />
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
            label="Whip"
            value={Math.round(whips.whipStrength)}
            hint="strength"
            tone={whips.whipStrength >= 60 ? 'success' : whips.whipStrength >= 35 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Rebellion"
            value={Math.round(whips.rebelPressure)}
            tone={whips.rebellionImminent ? 'danger' : whips.rebelPressure >= 40 ? 'warning' : 'success'}
            hint={whips.rebellionImminent ? 'imminent' : 'pressure'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Payroll"
            value={whips.payrollVotes}
            hint="vote"
            tone={whips.payrollVotes > 0 ? 'success' : 'default'}
          />
        </View>
      </View>

      <Card tone={whips.rebellionImminent ? 'danger' : 'default'}>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>{backbench.pressureLabel}</Text>
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
            : `${Math.max(0, lettersThreshold - letters)} more ${backbench.pressureUnit}${Math.max(0, lettersThreshold - letters) === 1 ? '' : 's'} to the threshold.`}
        </Text>
        <Text style={[styles.meterLabel, styles.secondMeter]}>Rebellion pressure</Text>
        <Meter
          value={whips.rebelPressure}
          color={whips.rebellionImminent ? colors.danger : colors.warning}
        />
      </Card>

      {lastDivision?.result ? (
        <Card tone={lastDivision.result.passed ? 'success' : 'danger'}>
          <View style={styles.meterRow}>
            <Text style={styles.meterLabel}>Last division</Text>
            <Chip
              label={lastDivision.result.passed ? 'CARRIED' : 'DEFEATED'}
              tone={lastDivision.result.passed ? 'success' : 'danger'}
            />
          </View>
          <Text style={styles.lastDivisionTitle} numberOfLines={2}>{lastDivision.title}</Text>
          <View style={styles.divisionTally}>
            <View style={styles.divisionTallyItem}>
              <Text style={styles.divisionTallyValue}>{lastDivision.result.ayes}</Text>
              <Text style={styles.divisionTallyLabel}>AYES</Text>
            </View>
            <View style={styles.divisionTallyItem}>
              <Text style={styles.divisionTallyValue}>{lastDivision.result.noes}</Text>
              <Text style={styles.divisionTallyLabel}>NOES</Text>
            </View>
            <View style={styles.divisionTallyItem}>
              <Text style={styles.divisionTallyValue}>{lastDivision.result.rebels}</Text>
              <Text style={styles.divisionTallyLabel}>REBELS</Text>
            </View>
          </View>
          <View style={styles.lastDivisionAction}>
            <Button
              label="View division result"
              variant="secondary"
              compact
              onPress={() => setResultOpen(true)}
              testID="open-division-result"
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Active Legislation" hint="Bills already before Parliament." />
      {activeBills.length === 0 ? (
        <EmptyState
          title="Nothing before the House"
          body="No bills are in progress. Bring one from the list below."
        />
      ) : (
        activeBills.map((bill) => {
          const progress = progressByBillId[bill.id];
          const parliamentActLeft =
            (parliament?.parliamentActUses ?? 0) < PARLIAMENT_ACT_LIMIT_PER_TERM;
          return (
            <MotionRow
              key={bill.id}
              title={bill.title}
              sponsor={bill.department}
              rebellionRisk={bill.rebellionRisk}
              stage={progress?.stage}
              weeksToDivision={bill.weeksToPass}
              whipLevel={bill.whipLevel ?? 'two-line'}
              secondaryActionLabel={parliamentActLeft ? 'Force through the Lords (Parliament Act)' : 'Parliament Act used this term'}
              onSecondaryAction={() => dispatch({ type: 'INVOKE_PARLIAMENT_ACT', billId: bill.id })}
              secondaryActionDisabled={inPurdah || !parliamentActLeft}
              secondaryTestID={`parliament-act-${bill.id}`}
              testID={`active-${bill.id}`}
            />
          );
        })
      )}

      <SectionTitle
        title="Upcoming Divisions"
        hint={inPurdah ? 'Purdah: no new bills until after polling day.' : 'Set the whip, then bring it to the House.'}
      />
      {/* Commons time: the Order Paper has fixed division slots. */}
      <View style={styles.orderPaperRow}>
        <Chip
          label={`ORDER PAPER · ${activeBills.length} OF ${DIVISION_SLOTS_PER_SESSION} SLOTS`}
          tone={orderPaperFull ? 'danger' : 'neutral'}
        />
        {orderPaperFull && (
          <Text style={styles.orderPaperNote}>
            The Order Paper is full — a bill must fall or pass before another is tabled.
          </Text>
        )}
      </View>
      {scheduledVotes.length > 0 ? (
        <View style={styles.scheduledList}>
          <Text style={styles.scheduledHeading}>SCHEDULED</Text>
          {scheduledVotes.map((vote) => (
            <View key={vote.id} style={styles.scheduledRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduledTitle} numberOfLines={1}>{vote.title}</Text>
                <Text style={styles.scheduledMeta}>
                  {vote.kind === 'government-bill' ? 'Government bill' : 'Opposition motion'} · Month {vote.scheduledWeek}
                </Text>
              </View>
              <Chip
                label={vote.kind === 'government-bill' ? 'BILL' : 'MOTION'}
                tone={vote.kind === 'government-bill' ? 'accent' : 'danger'}
              />
            </View>
          ))}
        </View>
      ) : null}
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
            actionDisabled={inPurdah || orderPaperFull}
            onAction={() =>
              dispatch({ type: 'PROPOSE_BILL', billId: bill.id, whipLevel: whipFor(bill.id) })
            }
            testID={`propose-${bill.id}`}
          />
        ))
      )}

      <Sheet
        visible={resultOpen && !!lastDivision?.result}
        onClose={() => setResultOpen(false)}
        eyebrow="DIVISION RESULT"
        title={lastDivision?.title ?? ''}
      >
        {lastDivision?.result ? (
          <View>
            <View style={styles.resultHead}>
              <Chip
                label={lastDivisionStamp ?? (lastDivision.result.passed ? 'CARRIED' : 'DEFEATED')}
                tone={
                  lastDivisionStamp === 'AMENDED'
                    ? 'warning'
                    : lastDivision.result.passed
                      ? 'success'
                      : 'danger'
                }
              />
              <Text style={styles.resultDate}>
                Month {lastDivision.result.castWeek} · {lastDivision.kind === 'government-bill' ? 'Government bill' : 'Opposition motion'}
              </Text>
            </View>
            <View style={styles.resultTally}>
              <View style={styles.resultTallyItem}>
                <Text style={styles.resultTallyValue}>{lastDivision.result.ayes}</Text>
                <Text style={styles.resultTallyLabel}>AYES</Text>
              </View>
              <View style={styles.resultTallyItem}>
                <Text style={styles.resultTallyValue}>{lastDivision.result.noes}</Text>
                <Text style={styles.resultTallyLabel}>NOES</Text>
              </View>
            </View>
            <Text style={styles.resultBody}>
              {lastDivision.result.rebels > 0
                ? `${lastDivision.result.rebels} government MP${lastDivision.result.rebels === 1 ? '' : 's'} rebelled in the division.`
                : 'No government MPs rebelled in the division.'}
            </Text>
            {lastDivision.result.backbenchRebels ? (
              <Text style={styles.resultBody}>
                Backbench rebels: {lastDivision.result.backbenchRebels}.
              </Text>
            ) : null}
            {lastDivision.result.rebelNames && lastDivision.result.rebelNames.length > 0 ? (
              <Text style={styles.resultBody}>
                Coalition ministers in the No lobby: {lastDivision.result.rebelNames.join(', ')}.
              </Text>
            ) : null}
            {lastDivision.result.defections ? (
              <Text style={styles.resultBody}>
                Government defections: {lastDivision.result.defections}.
              </Text>
            ) : null}
            <Text style={styles.resultFootnote}>
              Ayes and Noes are the recorded lobby totals. The result is entered in the Official Record.
            </Text>
          </View>
        ) : null}
      </Sheet>
    </>
  );

  return embedded ? (
    <View style={[styles.content, styles.embeddedContent]}>{body}</View>
  ) : (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lastDivisionTitle: {
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.h3,
    fontWeight: '700',
    lineHeight: 21,
  },
  divisionTally: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
    paddingTop: spacing.sm,
  },
  divisionTallyItem: { flex: 1, alignItems: 'center' },
  divisionTallyValue: {
    color: colors.text,
    fontFamily: fileFontFamily,
    fontSize: font.h2,
    fontWeight: '800',
  },
  divisionTallyLabel: {
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: .8,
  },
  lastDivisionAction: { flexDirection: 'row', marginTop: spacing.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  resultDate: { color: colors.faint, fontFamily: fileFontFamily, fontSize: 9 },
  resultTally: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cardBorderLight,
  },
  resultTallyItem: { flex: 1, alignItems: 'center' },
  resultTallyValue: {
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
  },
  resultTallyLabel: {
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resultBody: { marginTop: spacing.sm, color: colors.text, fontSize: font.body, lineHeight: 21 },
  resultFootnote: { marginTop: spacing.lg, color: colors.faint, fontSize: font.tiny, lineHeight: 17 },
  content: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  embeddedContent: { padding: 0, backgroundColor: 'transparent' },
  eyebrow: {
    color: colors.accent,
    fontSize: font.tiny,
    fontWeight: '700',
    fontFamily: fileFontFamily,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: '700',
    fontFamily: headingFontFamily,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.faint,
    fontSize: font.small,
    marginTop: spacing.xs,
    fontFamily: fileFontFamily,
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
  budgetWarning: {
    color: colors.danger,
    fontFamily: fileFontFamily,
    fontSize: font.small,
    fontWeight: '900',
    letterSpacing: 0.5,
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
  orderPaperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  scheduledList: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
  },
  scheduledHeading: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontFamily: fileFontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderLight,
  },
  scheduledTitle: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
  },
  scheduledMeta: {
    marginTop: 2,
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 8,
    letterSpacing: .2,
  },
  orderPaperNote: {
    color: colors.faint,
    fontSize: font.tiny,
    lineHeight: 16,
    fontFamily: fileFontFamily,
    marginTop: spacing.xs,
    flexBasis: '100%',
  },
});
