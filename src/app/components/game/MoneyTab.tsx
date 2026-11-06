import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '../../state';
import { colors, font, spacing } from '../../theme';
import { Button, Card, Chip, EffectChips, Meter, SectionTitle, Segmented, StatTile } from '../ui';
import {
  FUEL_DUTY_FREEZE_COST,
  PUBLIC_SECTOR_PAY_COST,
  STAMP_DUTY_RELIEF_COST,
  TRIPLE_LOCK_COST,
} from '../../budget';
import { TAX_YIELD_PER_POINT } from '../../taxes';
import { PURDAH_TURNS } from '../../calendar';
import {
  fundedEnvelope,
  isFiscalWindow,
  personalAllowanceRevenue,
  remainingEmergencyFiscalActions,
} from '../../engine';
import { spendingReviewEfficiencySavings } from '../../spendingReview';
import type { EfficiencyTargetPct } from '../../spendingReview';

type MoneyTabKey = 'spending' | 'taxes';

function angerLabel(weight: number): { text: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (weight >= 1.8) return { text: 'Very high anger', tone: 'danger' };
  if (weight >= 1.2) return { text: 'High anger', tone: 'warning' };
  if (weight >= 0.7) return { text: 'Moderate anger', tone: 'neutral' };
  return { text: 'Low anger', tone: 'neutral' };
}

function money(v: number): string {
  return `£${Math.round(v)}bn`;
}

/** HM Treasury: spending envelopes and tax levers. */
export default function MoneyTab() {
  const { state, dispatch } = useGame();
  const [moneyTab, setMoneyTab] = useState<MoneyTabKey>('spending');

  const inPurdah = state.turnsUntilElection <= PURDAH_TURNS;
  const fiscalWindowOpen = isFiscalWindow(state);
  const emergencyLevyLeft = remainingEmergencyFiscalActions(state);
  const envelope = fundedEnvelope(state);
  const allowanceRecurringBn = personalAllowanceRevenue(state);

  return (

  <View>
    <SectionTitle title="HM Treasury" hint="Every pound spent or cut moves approval, services and the deficit." />
    <Segmented
      options={[
        { key: 'spending', label: 'Spending' },
        { key: 'taxes', label: 'Taxes' },
      ]}
      value={moneyTab}
      onChange={setMoneyTab}
    />

    {!fiscalWindowOpen && (
      <Card>
        <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Fiscal lock</Text>
        <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
          Headline taxes and departmental budgets can only be changed at a Budget or Autumn Statement.
          {emergencyLevyLeft > 0
            ? ` Emergency levy changes left this term: ${emergencyLevyLeft} (Capital Gains, Inheritance) — each unnerves the markets.`
            : ' No emergency levy changes remain this term.'}
        </Text>
      </Card>
    )}

    {moneyTab === 'spending' && (
      <View>
        <Card tone={envelope.plannedDeficit > 0 ? 'danger' : 'success'}>
          <View style={{ flexDirection: 'row' }}>
            <StatTile label="Spending" value={money(envelope.spend)} />
            <StatTile
              label="Borrowing"
              value={money(envelope.plannedDeficit)}
              tone={envelope.plannedDeficit > 0 ? 'danger' : 'success'}
            />
            <StatTile label="Funded" value={money(envelope.envelope)} />
          </View>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: spacing.sm, lineHeight: 17 }}>
            Departments are funded by taxes plus this borrowing. Every step you add widens the deficit the
            moment you take it.
          </Text>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>
                Spending Review Efficiency Target
              </Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
                {(state.efficiencyTargetPct ?? 0) === 0
                  ? 'No Whitehall efficiency savings mandated. Standard departmental delivery.'
                  : `Mandatory ${state.efficiencyTargetPct}% annual efficiency target yields £${spendingReviewEfficiencySavings(
                      (state.efficiencyTargetPct ?? 0) as EfficiencyTargetPct,
                    )}bn/yr in recurring savings, but squeezes public services and union goodwill.`}
              </Text>
            </View>
            <Chip
              label={`${state.efficiencyTargetPct ?? 0}%`}
              tone={(state.efficiencyTargetPct ?? 0) > 0 ? 'success' : 'neutral'}
            />
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            {([0, 2, 4] as EfficiencyTargetPct[]).map((pct) => (
              <View key={pct} style={{ flex: 1, marginRight: pct !== 4 ? 6 : 0 }}>
                <Button
                  label={pct === 0 ? 'Standard' : `${pct}% Target`}
                  variant={(state.efficiencyTargetPct ?? 0) === pct ? 'secondary' : 'ghost'}
                  compact
                  disabled={inPurdah}
                  onPress={() => dispatch({ type: 'SET_EFFICIENCY_TARGET', targetPct: pct })}
                />
              </View>
            ))}
          </View>
        </Card>

        {state.departments.map((d) => (
          <Card key={d.id}>
            <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700' }}>{d.name}</Text>
            <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>{d.desc}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
              <Button label="-" variant="ghost" compact disabled={!fiscalWindowOpen} onPress={() => dispatch({ type: 'ADJUST_SPENDING', deptId: d.id, delta: -d.step })} />
              <Text style={{ flex: 1, textAlign: 'center', color: colors.accent, fontSize: font.h2, fontWeight: '800' }}>
                {money(d.budget)}
              </Text>
              <Button label="+" variant="ghost" compact disabled={!fiscalWindowOpen} onPress={() => dispatch({ type: 'ADJUST_SPENDING', deptId: d.id, delta: d.step })} />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Meter value={d.budget - d.min} max={Math.max(1, d.max - d.min)} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                <Text style={{ color: colors.muted, fontSize: font.tiny }}>{money(d.min)}</Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny }}>
                  each step moves the deficit by {money(d.step)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny }}>{money(d.max)}</Text>
              </View>
            </View>
            <EffectChips effects={d.benefit} max={4} />
          </Card>
        ))}
      </View>
    )}

    {moneyTab === 'taxes' && (
      <View>
        <Text style={[styles.hint, { marginTop: spacing.md }]}>
          Raising a rate improves the public finances but costs you popularity.
        </Text>
        {state.taxes.map((t) => {
          const anger = angerLabel(t.popularityWeight);
          const yieldPerPoint = TAX_YIELD_PER_POINT[t.id] ?? 0;
          return (
            <Card key={t.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: font.h3, fontWeight: '700', flex: 1 }}>{t.name}</Text>
                <Chip label={anger.text} tone={anger.tone} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <Button label="-" variant="ghost" compact disabled={!fiscalWindowOpen && !(t.emergency && emergencyLevyLeft > 0)} onPress={() => dispatch({ type: 'ADJUST_TAX', taxId: t.id, delta: -t.step })} />
                <Text style={{ flex: 1, textAlign: 'center', color: colors.accent, fontSize: font.h2, fontWeight: '800' }}>{t.rate}%</Text>
                <Button label="+" variant="ghost" compact disabled={!fiscalWindowOpen && !(t.emergency && emergencyLevyLeft > 0)} onPress={() => dispatch({ type: 'ADJUST_TAX', taxId: t.id, delta: t.step })} />
              </View>
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4 }}>
                Range {t.min}-{t.max}% | 1pt is about {money(yieldPerPoint)}/yr for the Exchequer
              </Text>
            </Card>
          );
        })}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Fiscal drag</Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
                {state.thresholdsFrozen !== false
                  ? `Frozen thresholds quietly raise ${money(state.fiscalDragRevenue ?? 0)}/yr as inflation pushes pay into higher bands.`
                  : 'Thresholds indexed to inflation: stealth bracket creep is paused.'}
                {' '}Intensity: {state.fiscalDragIntensity ?? 'low'} | frozen for {state.thresholdFrozenTurns ?? 0} month{(state.thresholdFrozenTurns ?? 0) === 1 ? '' : 's'}.
              </Text>
            </View>
            <Button
              label={state.thresholdsFrozen !== false ? 'Index Bands' : 'Freeze Bands'}
              variant={state.thresholdsFrozen !== false ? 'ghost' : 'secondary'}
              compact
              disabled={inPurdah}
              onPress={() => dispatch({ type: 'TOGGLE_THRESHOLD_FREEZE' })}
            />
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Personal Tax-Free Allowance</Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
            Currently £{(state.personalAllowance ?? 12570).toLocaleString()}/yr tax-free.{' '}
            {(state.personalAllowanceFreezeYears ?? 0) > 0
              ? `Frozen for ${state.personalAllowanceFreezeYears} more annual Budget${
                  state.personalAllowanceFreezeYears === 1 ? '' : 's'
                } before CPI-like uprating resumes.`
              : 'Uprated at each annual Budget by the CPI-like inflation proxy.'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
            {allowanceRecurringBn >= 0
              ? `Current position: against the £12,570 baseline this adds about £${allowanceRecurringBn.toFixed(1)}bn/yr to the recurring fiscal estimate.`
              : `Current position: against the £12,570 baseline this costs about £${(-allowanceRecurringBn).toFixed(1)}bn/yr in the recurring fiscal estimate.`}
            {' '}The Budget preview shows the proposed position. Simplified in-game estimate, not an OBR forecast.
          </Text>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Fuel Duty</Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
            {state.fuelDutyFrozen !== false
              ? `Temporary 5p cut frozen (costs £${FUEL_DUTY_FREEZE_COST}bn/yr to protect motorists).`
              : `5p escalator restored (+£${FUEL_DUTY_FREEZE_COST}bn revenue).` }
          </Text>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Stamp Duty (SDLT)</Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
            {state.stampDutyRelief === true
              ? `Nil-rate bands raised to stimulate the housing market (costs £${STAMP_DUTY_RELIEF_COST}bn/yr).`
              : `Standard SDLT thresholds maintained (no £${STAMP_DUTY_RELIEF_COST}bn/yr relief cost).`}
          </Text>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>State Pension Triple Lock</Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
            {state.tripleLock !== false
              ? `Protected in full — rises with highest of inflation, wages, or 2.5% (costs £${TRIPLE_LOCK_COST}bn/yr).`
              : `Indexed to average earnings only (saves £${TRIPLE_LOCK_COST}bn/yr recurring cost).`}
          </Text>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>Public Sector Pay Awards</Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 4, lineHeight: 17 }}>
            {(state.publicSectorPay ?? 'full') === 'full'
              ? `Pay Review Body awards funded in full (costs £${PUBLIC_SECTOR_PAY_COST}bn/yr; averts strike ballots).`
              : `Capped at 2.5% (saves £${PUBLIC_SECTOR_PAY_COST}bn/yr recurring cost; risks union unrest).`}
          </Text>
        </Card>
      </View>
    )}
  </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.faint, fontSize: font.small, lineHeight: 19 },
});
