import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BriefingCard, type BriefingCardProps } from '../components/redbox/BriefingCard';
import { Card, EmptyState, Meter, SectionTitle, StatTile } from '../components/ui';
import { useGame } from '../state';
import { colors, font, headingFontFamily, spacing } from '../theme';
import { activeSwanEvent } from '../blackSwans';
import { TURNS_PER_SESSION, WASH_UP_WEEKS } from '../parliament';

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
  const pressHostility = state.mediaState?.hostility ?? 0;

  const approval = state.metrics.approval;
  const partyConfidence = state.metrics.partyConfidence;

  // ----- Fiscal watch ---------------------------------------------------
  const obrHeadroom = state.obrHeadroom ?? 0;
  const giltYield = state.stats.giltYield;
  // The app's calendar renders `state.week` as a month (see GameScreen header),
  // so one turn == one month and "days in office" is months * 30.
  const daysInOffice = state.week * 30;

  const playerName = state.player
    ? `${state.player.firstName} ${state.player.lastName}`.trim()
    : 'Prime Minister';

  // ----- Urgent briefings (wired to live engine state) ------------------
  const briefings: BriefingCardProps[] = [];

  // (a) Black Swan: the engine stores the live shock under `.active`.
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
      // The live Black Swan is presented by the global CrisisModal, which overlays
      // the entire app while `blackSwanState.active` is set — so this card is only
      // reachable once that modal has been dealt with. Tapping returns to the desk.
      onPress: () => onNavigate?.('desk'),
    });
  }

  // (b) Wash-up countdown: bills still in Parliament when the session ends.
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

  // (c) Cabinet defection risk.
  const restless = state.cabinet.filter((m) => m.loyalty < 35);
  const considering = state.committeeMood?.consideringDefection ?? restless.length;
  if (considering > 0) {
    const lowestLoyalty =
      state.cabinet.length > 0 ? Math.min(...state.cabinet.map((m) => m.loyalty)) : 0;
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
      <Text style={styles.eyebrow}>10 DOWNING STREET</Text>
      <Text style={styles.title}>The Dispatch Box</Text>
      <Text style={styles.subtitle}>
        {playerName} · Month {state.week} · Day {daysInOffice}
      </Text>

      <SectionTitle title="National Sentiment" hint="The three numbers that decide your future." />
      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <StatTile
            label="Public Approval"
            value={Math.round(approval)}
            tone={approval >= 45 ? 'success' : approval >= 35 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Party Confidence"
            value={Math.round(partyConfidence)}
            tone={partyConfidence >= 55 ? 'success' : partyConfidence >= 40 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Press Mood"
            value={Math.round(pressMood)}
            tone={pressMood >= 55 ? 'success' : pressMood >= 40 ? 'warning' : 'danger'}
          />
        </View>
      </View>
      <Card>
        <Text style={styles.meterLabel}>Public Approval</Text>
        <Meter value={approval} color={colors.accent} />
        <Text style={[styles.meterLabel, styles.secondMeter]}>Press Hostility</Text>
        <Meter value={pressHostility} color={pressHostility >= 60 ? colors.danger : colors.warning} />
      </Card>

      <SectionTitle title="Fiscal Watch" hint="The borrowing outlook and your time in office." />
      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <StatTile
            label="OBR Headroom"
            value={`${obrHeadroom >= 0 ? '+' : '-'}£${Math.abs(obrHeadroom).toFixed(1)}bn`}
            tone={obrHeadroom >= 0 ? 'success' : obrHeadroom >= -15 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile
            label="Gilt Yield"
            value={`${giltYield.toFixed(2)}%`}
            tone={giltYield <= 4.5 ? 'success' : giltYield <= 5.5 ? 'warning' : 'danger'}
          />
        </View>
        <View style={styles.statTile}>
          <StatTile label="Days in Office" value={daysInOffice} />
        </View>
      </View>

      <SectionTitle title="Urgent Briefings" hint="Items needing your attention this month." />
      {briefings.length === 0 ? (
        <EmptyState
          title="All quiet"
          body="No urgent items this month. Advance the calendar to see what lands next."
        />
      ) : (
        briefings.map((briefing, index) => (
          <BriefingCard key={`${briefing.eyebrow}-${index}`} {...briefing} />
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
    fontFamily: headingFontFamily,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.small,
    marginTop: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
  },
  statTile: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  meterLabel: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  secondMeter: {
    marginTop: spacing.md,
  },
});
