import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BriefingCard, type BriefingCardProps } from '../components/redbox/BriefingCard';
import { Card, Chip, EmptyState, MandateBar, SectionTitle } from '../components/ui';
import { TensionBand } from '../components/record/TensionBand';
import { useGame } from '../state';
import { colors, font, fileFontFamily, headingFontFamily, spacing } from '../theme';
import { activeSwanEvent } from '../blackSwans';
import { TURNS_PER_SESSION, WASH_UP_WEEKS } from '../parliament';
import { isCabinetMeetingDue } from '../cabinetMeeting';
import { recentVotes } from '../parliamentaryVotes';

/**
 * Official Record — the landing surface.
 *
 * Reads live engine state via useGame(). Every number shown here is derived
 * from an existing field; nothing is recomputed or invented, so the dashboard
 * can never disagree with the rest of the simulation.
 */
export interface RedBoxScreenProps {
  /**
   * When true, renders without its own ScrollView so it can nest inside an
   * existing scroll container (e.g. the GameScreen tab shell).
   */
  embedded?: boolean;
  /**
   * Lets an urgent briefing jump the player to the surface that resolves it.
   * `tab` is a top-level GameScreen tab; `subTab` is a Politics sub-tab key
   * ('cabinet' | 'westminster' | 'press').
   */
  onNavigate?: (tab: string, subTab?: string) => void;
}

export default function RedBoxScreen({ embedded = false, onNavigate }: RedBoxScreenProps = {}) {
  const { state } = useGame();

  // ----- Approval triad -------------------------------------------------
  const pressMoodValues = Object.values(state.mediaState?.pressMood ?? {});
  const pressMood =
    pressMoodValues.length > 0
      ? pressMoodValues.reduce((sum, mood) => sum + mood, 0) / pressMoodValues.length
      : 50;
  const approval = state.metrics.approval;
  const partyConfidence = state.metrics.partyConfidence;

  // ----- Fiscal watch ---------------------------------------------------
  const obrHeadroom = state.obrHeadroom ?? 0;
  const giltYield = state.stats.giltYield;
  const daysInOffice = state.week * 30;
  const proceedings = state.log.slice(0, 5).reverse();
  const voteHistory = recentVotes(state.parliamentState?.votes).slice(0, 3);

  const playerName = state.player
    ? `${state.player.firstName} ${state.player.lastName}`.trim()
    : 'Prime Minister';

  // ----- Urgent briefings (wired to live engine state) ------------------
  const briefings: BriefingCardProps[] = [];

  const swan = state.blackSwanState;
  if (swan?.active) {
    const event = activeSwanEvent(swan);
    briefings.push({
      eyebrow: 'BLACK SWAN',
      title: event?.name ?? 'Active national crisis',
      body: event?.brief ?? 'A national crisis demands an immediate decision.',
      meta: `${swan.active.weeksRemaining} month${swan.active.weeksRemaining === 1 ? '' : 's'} left to respond`,
      tone: 'danger',
      actionLabel: 'Respond',
      onPress: () => onNavigate?.('desk'),
    });
  }

  const sessionWeek = ((state.week - 1) % TURNS_PER_SESSION) + 1;
  const weeksToWashUp = TURNS_PER_SESSION - sessionWeek + 1;
  if (state.bills.length > 0 && weeksToWashUp <= WASH_UP_WEEKS) {
    const n = state.bills.length;
    briefings.push({
      eyebrow: 'WASH-UP',
      title: 'Session ending — bills at risk',
      body: `${n} bill${n === 1 ? '' : 's'} still in Parliament will be lost unless they clear before wash-up.`,
      meta: `${weeksToWashUp} month${weeksToWashUp === 1 ? '' : 's'} to wash-up`,
      tone: 'warning',
      actionLabel: 'Review',
      onPress: () => onNavigate?.('politics', 'westminster'),
    });
  }

  const investigations = state.ethics?.activeInvestigations.length ?? 0;
  if (investigations > 0) {
    briefings.push({
      eyebrow: 'STANDARDS',
      title: 'Investigation on your desk',
      body: `${investigations} investigation${investigations === 1 ? '' : 's'} will publish soon. Admit the finding now, or contain it.`,
      meta: state.ethics?.coverUpActive ? 'Cover-up active' : 'Decision required',
      tone: 'danger',
      actionLabel: 'Decide',
      onPress: () => onNavigate?.('nation'),
    });
  }

  if (isCabinetMeetingDue(state)) {
    briefings.push({
      eyebrow: 'CABINET',
      title: 'Cabinet meeting due',
      body: 'The Cabinet Secretary has circulated the agenda. Every minister and the senior officials are waiting in the Cabinet Room.',
      meta: `Month ${state.week} · agenda ready`,
      tone: 'warning',
      actionLabel: 'Convene',
      onPress: () => onNavigate?.('politics', 'cabinet'),
    });
  }

  const restless = state.cabinet.filter((m) => m.loyalty < 35);
  const considering = state.committeeMood?.consideringDefection ?? restless.length;
  if (considering > 0) {
    const lowestLoyalty = state.cabinet.length > 0 ? Math.min(...state.cabinet.map((m) => m.loyalty)) : 0;
    briefings.push({
      eyebrow: 'CABINET',
      title: 'Defection risk in the Cabinet',
      body: `${considering} minister${considering === 1 ? '' : 's'} are considering defection or a leadership challenge.`,
      meta: `Lowest loyalty: ${lowestLoyalty}%`,
      tone: 'warning',
      actionLabel: 'Manage',
      onPress: () => onNavigate?.('politics', 'cabinet'),
    });
  }

  const body = (
    <>
      {/* Standalone view keeps its own masthead; embedded, the record shell supplies it. */}
      {!embedded && (
        <>
          <Text style={styles.eyebrow}>THE RED BOX · OFFICIAL RECORD</Text>
          <Text style={styles.title}>House of Commons</Text>
          <Text style={styles.subtitle}>
            {playerName} · Month {state.week} · Day {daysInOffice}
          </Text>
          <View style={styles.rule} />
        </>
      )}

      <TensionBand state={state} />

      <SectionTitle title="Proceedings" hint={`Recent entries in the record · Month ${state.week}.`} />
      {proceedings.length === 0 ? (
        <EmptyState title="No entries yet" body="The first decisions of this ministry will appear here." />
      ) : (
        <View style={styles.recordList}>
          {proceedings.map((entry, index) => (
            <View key={`${state.week}-${index}`} style={styles.recordEntry}>
              <View style={styles.recordMarker} />
              <View style={styles.recordCopy}>
                <Text style={styles.recordFolio}>
                  MONTH {state.week} · ENTRY {String(index + 1).padStart(2, '0')}
                </Text>
                <Text style={styles.recordText} numberOfLines={3}>{entry}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {voteHistory.length > 0 ? (
        <>
          <SectionTitle title="Recent divisions" hint="Ayes and Noes from the division lobbies." />
          <View style={styles.voteList}>
            {voteHistory.map((vote) => (
              <View key={vote.id} style={styles.voteRow}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.voteTitle} numberOfLines={2}>{vote.title}</Text>
                  <Text style={styles.voteMeta}>
                    {vote.kind === 'government-bill' ? 'Government bill' : 'Opposition motion'} · Month {vote.scheduledWeek}
                  </Text>
                </View>
                <View style={styles.voteResult}>
                  <Text style={styles.voteNumbers}>
                    {vote.result?.ayes ?? 0}–{vote.result?.noes ?? 0}
                  </Text>
                  <Text style={[styles.voteOutcome, { color: vote.result?.passed ? colors.success : colors.danger }]}>
                    {vote.result?.passed ? 'CARRIED' : 'DEFEATED'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle title="Notices for decision" hint="Time-sensitive matters awaiting a ministerial answer." />
      {briefings.length === 0 ? (
        <EmptyState title="No urgent matters" body="The record is quiet. Advance the month to see what enters proceedings." />
      ) : (
        briefings.map((briefing, index) => <BriefingCard key={`${briefing.eyebrow}-${index}`} {...briefing} />)
      )}

      <SectionTitle title="State of the Nation" hint="The approval line against the 50% mark." />
      <Card>
        <View style={styles.mandateRow}>
          <View>
            <Text style={styles.mandateLabel}>PUBLIC APPROVAL</Text>
            <Text style={styles.mandateValue}>{Math.round(approval)}%</Text>
          </View>
          <Chip
            label={approval >= 50 ? 'ABOVE THE LINE' : `${Math.round(50 - approval)} PTS TO WIN`}
            tone={approval >= 50 ? 'success' : approval >= 40 ? 'warning' : 'danger'}
          />
        </View>
        <MandateBar approval={approval} />
        <View style={styles.ledgerRow}>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerValue}>{Math.round(partyConfidence)}</Text>
            <Text style={styles.ledgerLabel}>Party</Text>
          </View>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerValue}>{Math.round(pressMood)}</Text>
            <Text style={styles.ledgerLabel}>Press</Text>
          </View>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerValue}>
              {obrHeadroom >= 0 ? '+' : '-'}£{Math.abs(obrHeadroom).toFixed(1)}bn
            </Text>
            <Text style={styles.ledgerLabel}>Headroom</Text>
          </View>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerValue}>{giltYield.toFixed(2)}%</Text>
            <Text style={styles.ledgerLabel}>Gilts</Text>
          </View>
        </View>
      </Card>
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
  rule: {
    height: 1,
    backgroundColor: colors.cardBorderLight,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  recordList: { borderTopWidth: 1, borderTopColor: colors.ink, marginTop: spacing.sm },
  recordEntry: { flexDirection: 'row', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorderLight },
  recordMarker: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5, marginRight: spacing.md },
  recordCopy: { flex: 1 },
  recordFolio: { color: colors.gold, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1, fontFamily: fileFontFamily },
  recordText: { color: colors.text, fontSize: font.small, lineHeight: 18, marginTop: 4 },
  voteList: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorderLight,
  },
  voteTitle: {
    color: colors.text,
    fontFamily: headingFontFamily,
    fontSize: font.small,
    fontWeight: '700',
    lineHeight: 17,
  },
  voteMeta: {
    marginTop: 2,
    color: colors.faint,
    fontFamily: fileFontFamily,
    fontSize: 8,
    letterSpacing: .3,
  },
  voteResult: { alignItems: 'flex-end' },
  voteNumbers: {
    color: colors.text,
    fontFamily: fileFontFamily,
    fontSize: font.body,
    fontWeight: '800',
  },
  voteOutcome: {
    marginTop: 2,
    fontFamily: fileFontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: .6,
  },
  mandateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  mandateValue: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    fontFamily: headingFontFamily,
  },
  mandateLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: fileFontFamily,
  },
  ledgerRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
  },
  ledgerItem: { flex: 1 },
  ledgerValue: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
    fontFamily: fileFontFamily,
  },
  ledgerLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    marginTop: 1,
  },
});
