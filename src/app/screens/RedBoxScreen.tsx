import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BriefingCard, type BriefingCardProps } from '../components/redbox/BriefingCard';
import { Card, Chip, EmptyState, MandateBar, SectionTitle } from '../components/ui';
import { useGame } from '../state';
import { colors, font, fileFontFamily, headingFontFamily, spacing } from '../theme';
import { activeSwanEvent } from '../blackSwans';
import { TURNS_PER_SESSION, WASH_UP_WEEKS } from '../parliament';
import type { BlocSupport } from '../voterBlocs';

/** Bloc mood → chip tone. */
const BLOC_TONE: Record<BlocSupport['mood'], 'danger' | 'warning' | 'neutral' | 'success'> = {
  hostile: 'danger',
  restless: 'warning',
  content: 'neutral',
  loyal: 'success',
};

/**
 * Red Box dashboard — the landing surface.
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
      meta: `${swan.active.weeksRemaining} month(s) left to respond`,
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
      meta: `${weeksToWashUp} month(s) to wash-up`,
      tone: 'warning',
      actionLabel: 'Review',
      onPress: () => onNavigate?.('politics', 'westminster'),
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
      {/* Standalone view keeps its own masthead; embedded, the GameScreen tab
          shell already carries the 10 Downing Street header, so skip it. */}
      {!embedded && (
        <>
          <Text style={styles.eyebrow}>10 DOWNING STREET — PRIVATE OFFICE</Text>
          <Text style={styles.title}>The Dispatch Box</Text>
          <Text style={styles.subtitle}>
            {playerName} · Month {state.week} · Day {daysInOffice}
          </Text>
          <View style={styles.rule} />
        </>
      )}

      <SectionTitle title="State of the Nation" hint="One bar decides your future: the line marks 50%." />
      <Card>
        <View style={styles.mandateRow}>
          <Text style={styles.mandateValue}>{Math.round(approval)}%</Text>
          <Text style={styles.mandateLabel}>PUBLIC APPROVAL</Text>
        </View>
        <MandateBar approval={approval} />
        <Text style={styles.ledger} numberOfLines={1}>
          Party {Math.round(partyConfidence)} · Press {Math.round(pressMood)} · Headroom{' '}
          {obrHeadroom >= 0 ? '+' : '-'}£{Math.abs(obrHeadroom).toFixed(1)}bn · Gilts {giltYield.toFixed(2)}% · In
          office {daysInOffice}d
        </Text>
      </Card>

      <SectionTitle title="The Country" hint="Five blocs decide your majority. Govern for the ones that matter." />
      {(state.blocs ?? []).map((bloc) => (
        <Card key={bloc.id}>
          <View style={styles.blocHeader}>
            <Text style={styles.blocName} numberOfLines={1}>
              {bloc.name}
            </Text>
            <Chip label={bloc.mood.toUpperCase()} tone={BLOC_TONE[bloc.mood]} />
          </View>
          <View style={styles.blocRow}>
            <Text style={styles.blocDriver} numberOfLines={1}>
              {bloc.driver}
            </Text>
            <Text style={[styles.blocSupport, { color: bloc.support >= 45 ? colors.success : colors.accent }]}>
              {Math.round(bloc.support)}%
            </Text>
          </View>
        </Card>
      ))}

      <SectionTitle title="Urgent Briefings" hint="Items needing your attention this month." />
      {briefings.length === 0 ? (
        <EmptyState title="All quiet" body="No urgent items this month. Advance the calendar to see what lands next." />
      ) : (
        briefings.map((briefing, index) => <BriefingCard key={`${briefing.eyebrow}-${index}`} {...briefing} />)
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
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '700',
    fontFamily: fileFontFamily,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.card,
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
  mandateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  mandateValue: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: '700',
    fontFamily: fileFontFamily,
  },
  mandateLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: fileFontFamily,
  },
  ledger: {
    color: colors.muted,
    fontSize: font.tiny,
    fontFamily: fileFontFamily,
    marginTop: spacing.sm,
  },
  blocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blocName: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    fontFamily: headingFontFamily,
    flex: 1,
    marginRight: spacing.sm,
  },
  blocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
    paddingTop: spacing.sm,
  },
  blocDriver: {
    color: colors.muted,
    fontSize: font.small,
    lineHeight: 18,
    flex: 1,
    marginRight: spacing.sm,
  },
  blocSupport: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
    fontFamily: fileFontFamily,
  },
});
