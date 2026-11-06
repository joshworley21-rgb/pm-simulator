import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../../state';
import { colors, font, radius, spacing } from '../../theme';
import { Button, Card, Chip, EffectChips, SectionTitle, StatTile } from '../ui';
import { relationBand } from '../../diplomacy';
import { PURDAH_TURNS } from '../../calendar';
import type { RelationBand } from '../../diplomacy';
import type { TradePartner, UKTradeDealStatus } from '../../tradeDeals';

const BAND_TONE: Record<RelationBand, 'success' | 'accent' | 'warning' | 'danger' | 'neutral'> = {
  alliance: 'success',
  friendly: 'accent',
  neutral: 'neutral',
  tense: 'warning',
  hostile: 'danger',
};

const TRADE_ROWS: { key: Exclude<keyof UKTradeDealStatus, 'wtoBaseline'>; partner: TradePartner; label: string }[] = [
  { key: 'euTradeDeal', partner: 'eu', label: 'European Union' },
  { key: 'usaTradeDeal', partner: 'usa', label: 'United States' },
  { key: 'chinaTradeDeal', partner: 'china', label: 'China' },
  { key: 'indiaTradeDeal', partner: 'india', label: 'India' },
  { key: 'cpTradeDeal', partner: 'commonwealth', label: 'Commonwealth' },
];

/** Abroad and the economy: summits, trade and national indicators. */
export default function WorldTab() {
  const { state, dispatch } = useGame();
  const player = state.player;
  const inPurdah = state.turnsUntilElection <= PURDAH_TURNS;

  return (

  <View>
    <SectionTitle title="Abroad and the economy" hint="Summits, trade and the numbers that decide elections." />

    {state.foreignIssues.length === 0 ? (
      <Card>
        <Text style={{ color: colors.muted, fontSize: font.small }}>No outstanding summits or calls.</Text>
      </Card>
    ) : (
      state.foreignIssues.map((f) => (
        <Card key={f.id}>
          <Text style={{ color: colors.accent, fontSize: font.tiny, fontWeight: '800' }}>
            {f.country.toUpperCase()} | {f.leader}
          </Text>
          <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: 4 }}>{f.topic}</Text>
          {f.options.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => dispatch({ type: 'RESOLVE_FOREIGN', issueId: f.id, optionId: o.id })}
              style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }}
            >
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{o.label}</Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{o.summary}</Text>
              <EffectChips effects={o.effects} max={4} />
            </Pressable>
          ))}
        </Card>
      ))
    )}

    <Text style={[styles.label, { marginTop: spacing.lg }]}>THE NUMBERS</Text>
    <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
      <StatTile label="GDP growth" value={`${state.stats.gdpGrowth}%`} tone={state.stats.gdpGrowth >= 1 ? 'success' : 'danger'} hint="annual %" />
      <StatTile label="Inflation" value={`${state.stats.cpiInflation}%`} tone={state.stats.cpiInflation <= 3 ? 'success' : 'danger'} hint="CPI, %/yr" />
      <StatTile label="10y gilts" value={`${state.stats.giltYield}%`} tone={state.stats.giltYield <= 4.5 ? 'success' : 'danger'} hint="cost of borrowing" />
    </View>
    <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
      <StatTile label="Debt / GDP" value={`${state.stats.debtToGdp}%`} hint="share of GDP" />
      <StatTile label="Unemployment" value={`${state.stats.unemployment}%`} hint="% of workforce" />
      <StatTile label="Security" value={Math.round(state.metrics.security)} hint="0-100 scale" />
    </View>
    <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
      <StatTile label="NHS waiting" value={`${state.stats.nhsWaitingList}m`} hint="millions" />
      <StatTile
        label="NHS perf"
        value={Math.round(state.nhsPerformance ?? 0)}
        tone={(state.nhsPerformance ?? 0) >= 55 ? 'success' : 'danger'}
        hint="0-100 scale"
      />
      <StatTile label="Services" value={Math.round(state.metrics.publicServices)} hint="0-100 scale" />
    </View>
    <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
      <StatTile label="Migration" value={`${state.stats.netMigration}k`} hint="net, thousands" />
      <StatTile label="Trade effect" value={`${state.tradeGdpImpact ?? 0}%`} hint="% of GDP" />
      <StatTile label="Fiscal drag" value={`£${state.fiscalDragRevenue ?? 0}bn`} hint="from frozen bands" />
    </View>

    <Card>
      <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>NHS Operational Dashboard</Text>
      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
        Key clinical and operational performance indicators derived each month from the waiting list.
      </Text>
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        <StatTile
          label="A&E wait"
          value={`${Math.round(state.nhsMetrics?.aeWaitingTime ?? 0)}%`}
          tone={(state.nhsMetrics?.aeWaitingTime ?? 0) <= 15 ? 'success' : 'danger'}
          hint="target <10%"
        />
        <StatTile
          label="Cancer wait"
          value={`${Math.round(state.nhsMetrics?.cancerWaitTime ?? 0)}d`}
          tone={(state.nhsMetrics?.cancerWaitTime ?? 0) <= 62 ? 'success' : 'danger'}
          hint="target 62d"
        />
        <StatTile
          label="Beds"
          value={`${Math.round(state.nhsMetrics?.bedOccupancy ?? 0)}%`}
          tone={(state.nhsMetrics?.bedOccupancy ?? 0) <= 92 ? 'success' : 'warning'}
          hint="safe <92%"
        />
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
        <StatTile
          label="Ambulance"
          value={`${Math.round(state.nhsMetrics?.ambulanceResponse ?? 0)}%`}
          tone={(state.nhsMetrics?.ambulanceResponse ?? 0) >= 80 ? 'success' : 'danger'}
          hint="target >85%"
        />
        <StatTile
          label="Vacancies"
          value={`${Math.round(state.nhsMetrics?.staffVacancies ?? 0)}%`}
          tone={(state.nhsMetrics?.staffVacancies ?? 0) <= 5 ? 'success' : 'danger'}
          hint="target <3%"
        />
        <StatTile
          label="Satisfaction"
          value={`${Math.round(state.nhsMetrics?.patientSatisfaction ?? 0)}%`}
          tone={(state.nhsMetrics?.patientSatisfaction ?? 0) >= 60 ? 'success' : 'default'}
          hint="0-100 scale"
        />
      </View>
    </Card>

    <Card>
      <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Trade relationships</Text>
      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
        Advance or suspend bilateral trade agreements. Active deals boost GDP growth and export revenue.
      </Text>
      {TRADE_ROWS.map((row) => {
        const raw = state.tradeDealStatus ? state.tradeDealStatus[row.key] : undefined;
        const status = raw ? raw.status : 'none';
        const progress = raw && raw.status === 'negotiating' && typeof raw.progress === 'number' ? ` (${raw.progress}%)` : '';
        const tone: 'success' | 'accent' | 'warning' | 'neutral' =
          status === 'ratified' ? 'success' : status === 'signed' ? 'accent' : status === 'negotiating' ? 'warning' : 'neutral';
        const canNegotiate = !raw || status === 'expired' || status === 'withdrawn';
        const canConclude = status === 'negotiating' || status === 'signed';
        const canSuspend = status === 'negotiating' || status === 'signed' || status === 'ratified';
        const canWithdraw = status === 'negotiating' || status === 'signed' || status === 'ratified';
        return (
          <View key={row.key} style={styles.tradeRow}>
            <View style={styles.tradeHead}>
              <Text style={{ color: colors.text, flex: 1, fontSize: font.small }} numberOfLines={1}>{row.label}</Text>
              <Chip label={`${status}${progress}`} tone={tone} />
            </View>
            <View style={styles.tradeActions}>
              {canNegotiate && (
                <Button
                  label="Negotiate"
                  variant="secondary"
                  compact
                  disabled={inPurdah}
                  onPress={() => dispatch({ type: 'PURSUE_TRADE_DEAL', partner: row.partner, action: 'pursue' })}
                />
              )}
              {canConclude && (
                <Button
                  label="Conclude"
                  variant="secondary"
                  compact
                  disabled={inPurdah}
                  onPress={() =>
                    dispatch({
                      type: 'PURSUE_TRADE_DEAL',
                      partner: row.partner,
                      action: row.partner === 'eu' ? 'expand' : 'conclude',
                    })
                  }
                />
              )}
              {canSuspend && (
                <Button
                  label="Suspend"
                  variant="ghost"
                  compact
                  disabled={inPurdah}
                  onPress={() => dispatch({ type: 'PURSUE_TRADE_DEAL', partner: row.partner, action: 'expire' })}
                />
              )}
              {canWithdraw && (
                <Button
                  label="Withdraw"
                  variant="ghost"
                  compact
                  disabled={inPurdah}
                  onPress={() => dispatch({ type: 'PURSUE_TRADE_DEAL', partner: row.partner, action: 'withdraw' })}
                />
              )}
            </View>
          </View>
        );
      })}
    </Card>

    <Card>
      <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Diplomatic relations</Text>
      {player && state.relations.filter((r) => r.from === player.partyId).map((r) => {
        const band = relationBand(r.score);
        const partnerName = state.parties.find((p) => p.id === r.to)?.name ?? r.to;
        return (
          <View key={r.to} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: colors.text, flex: 1, fontSize: font.small }} numberOfLines={1}>{partnerName}</Text>
            <Text style={{ color: colors.muted, fontSize: font.tiny, marginRight: 8 }}>{r.score}</Text>
            <Chip label={band} tone={BAND_TONE[band]} />
          </View>
        );
      })}
    </Card>

    <Card>
      <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Legacy</Text>
      <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
        Score {state.legacyScore} | terms won {state.termsWon}
      </Text>
    </Card>
  </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.accent, fontSize: font.tiny, fontWeight: '800', letterSpacing: 1.2 },
  tradeRow: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderLight,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  tradeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tradeActions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
});
