import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, fileFontFamily, radius, spacing } from '../theme';
import { Button, Card, Chip, EffectChips, Meter, SectionTitle } from './ui';
import type { CustomBudgetPlan, GameState, Effects } from '../types';
import {
  calculateCustomBudget,
  getDefaultCustomPlan,
  getPresetPlan,
  DEFAULT_PERSONAL_ALLOWANCE,
  PERSONAL_ALLOWANCE_STEP,
  PERSONAL_ALLOWANCE_MIN,
  PERSONAL_ALLOWANCE_MAX,
  PERSONAL_ALLOWANCE_COST_PER_STEP,
  FUEL_DUTY_FREEZE_COST,
  TRIPLE_LOCK_COST,
  PUBLIC_SECTOR_PAY_COST,
  personalAllowanceFreezeCap,
} from '../budget';
import { TAX_YIELD_PER_POINT } from '../taxes';
import { previewFiscalDrag } from '../fiscalDragIntegration';

interface BudgetWorkbenchProps {
  state: GameState;
  onDeliver: (plan: CustomBudgetPlan) => void;
  onDefer: () => void;
}

export function BudgetWorkbench({ state, onDeliver, onDefer }: BudgetWorkbenchProps) {
  const [plan, setPlan] = useState<CustomBudgetPlan>(() => getDefaultCustomPlan(state));
  const [activeSection, setActiveSection] = useState<'spending' | 'taxes' | 'allowances'>('allowances');

  // Live real-time OBR calculation
  const result = useMemo(() => calculateCustomBudget(plan, state), [plan, state]);

  // Dynamic annual fiscal-drag revenue if thresholds are frozen under current inflation/growth.
  const frozenFiscalDragBn = useMemo(
    () => previewFiscalDrag(state, true).additionalRevenue,
    [state],
  );

  // Freeze duration is measured in annual Budget cycles, capped by the term.
  const maxFreezeYears = personalAllowanceFreezeCap(state.termLength);

  // Handlers for personal allowance
  const adjustAllowance = (delta: number) => {
    setPlan((prev) => ({
      ...prev,
      personalAllowance: Math.max(
        PERSONAL_ALLOWANCE_MIN,
        Math.min(PERSONAL_ALLOWANCE_MAX, prev.personalAllowance + delta),
      ),
    }));
  };

  // Handlers for Personal Allowance freeze duration
  const adjustFreezeYears = (delta: number) => {
    setPlan((prev) => ({
      ...prev,
      personalAllowanceFreezeYears: Math.max(
        0,
        Math.min(maxFreezeYears, (prev.personalAllowanceFreezeYears ?? 0) + delta),
      ),
    }));
  };

  // Handlers for tax rates
  const adjustTax = (taxId: string, delta: number, min: number, max: number) => {
    setPlan((prev) => {
      const current = prev.taxRates[taxId] ?? 20;
      const nextRate = Math.max(min, Math.min(max, current + delta));
      return {
        ...prev,
        taxRates: { ...prev.taxRates, [taxId]: nextRate },
      };
    });
  };

  // Handlers for department budgets
  const adjustSpending = (deptId: string, delta: number, min: number, max: number) => {
    setPlan((prev) => {
      const current = prev.departmentBudgets[deptId] ?? 50;
      const nextBudget = Math.max(min, Math.min(max, current + delta));
      return {
        ...prev,
        departmentBudgets: { ...prev.departmentBudgets, [deptId]: nextBudget },
      };
    });
  };

  // Apply a preset
  const applyPreset = (presetId: string) => {
    const preset = getPresetPlan(presetId, state);
    setPlan(preset);
  };

  const headroomTone =
    result.obrAssessment === 'compliant' ? 'success' : result.obrAssessment === 'tight' ? 'warning' : 'danger';
  const headroomCardTone =
    result.obrAssessment === 'compliant' ? 'success' : result.obrAssessment === 'tight' ? 'default' : 'danger';

  // Sum of the standing annual terms the delivered budget would lock in. Kept
  // separate from the one-off OBR headroom above.
  const totalStanding =
    result.allowanceRecurring +
    result.fiscalDragRecurring +
    result.fuelDutyRecurring +
    result.stampDutyRecurring +
    result.tripleLockRecurring +
    result.payRecurring;

  return (
    <View style={{ marginTop: spacing.sm }}>
      {/* ================= LIVE OBR SCORECARD ================= */}
      <Card tone={headroomCardTone} style={{ borderWidth: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: font.small, fontWeight: '800' }}>
            OFFICE FOR BUDGET RESPONSIBILITY (OBR)
          </Text>
          <Chip
            label={result.obrAssessment.toUpperCase()}
            tone={headroomTone}
          />
        </View>

        <View style={{ flexDirection: 'row', marginTop: spacing.sm, alignItems: 'baseline' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: font.tiny }}>FISCAL HEADROOM</Text>
            <Text
              style={{
                color: result.obrHeadroom >= 0 ? colors.success : colors.danger,
                fontSize: font.h1,
                fontWeight: '900',
              }}
            >
              {result.obrHeadroom >= 0 ? '+' : ''}£{result.obrHeadroom}bn
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: font.tiny }}>NET BORROWING</Text>
            <Text style={{ color: colors.text, fontSize: font.h2, fontWeight: '800' }}>
              £{result.netBorrowing}bn
            </Text>
          </View>
        </View>

        {/* Live OBR Headroom Meter */}
        <View style={{ marginTop: spacing.xs }}>
          <Meter
            value={Math.max(0, Math.min(100, Math.round(((result.obrHeadroom + 20) / 40) * 100)))}
            height={8}
            color={result.obrHeadroom >= 0 ? colors.success : colors.danger}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ color: colors.danger, fontSize: 11 }}>-£20bn Breach</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>£0bn Balance</Text>
            <Text style={{ color: colors.success, fontSize: 11 }}>+£20bn Headroom</Text>
          </View>
        </View>

        <Text style={{ color: colors.text, fontSize: font.tiny, marginTop: spacing.sm, lineHeight: 16 }}>
          {result.obrVerdict}
        </Text>

        {/* Live Impact Preview */}
        <View style={{ flexDirection: 'row', marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginRight: 12 }}>
            Approval: <Text style={{ color: result.projectedApprovalImpact >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
              {result.projectedApprovalImpact >= 0 ? '+' : ''}{result.projectedApprovalImpact}%
            </Text>
          </Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginRight: 12 }}>
            Services: <Text style={{ color: result.projectedServicesImpact >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
              {result.projectedServicesImpact >= 0 ? '+' : ''}{result.projectedServicesImpact}
            </Text>
          </Text>
          <Text style={{ color: colors.muted, fontSize: font.tiny }}>
            Gilts: <Text style={{ color: result.projectedGiltImpact > 0 ? colors.danger : colors.success, fontWeight: '700' }}>
              {result.projectedGiltImpact > 0 ? `+${result.projectedGiltImpact}% (spike risk)` : 'Stable'}
            </Text>
          </Text>
        </View>

        {/* Standing recurring position: the annual terms a delivered budget
            locks in, shown separately from the one-off headroom above. */}
        <View style={{ marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          <Text style={{ color: colors.muted, fontSize: font.tiny, fontWeight: '800', letterSpacing: 0.5 }}>
            STANDING RECURRING POSITION (£bn/yr)
          </Text>
          {[
            { label: 'Personal allowance', value: result.allowanceRecurring },
            { label: 'Threshold freeze (drag)', value: result.fiscalDragRecurring },
            { label: 'Fuel Duty freeze', value: result.fuelDutyRecurring },
            { label: 'Stamp Duty (SDLT)', value: result.stampDutyRecurring },
            { label: 'Triple Lock', value: result.tripleLockRecurring },
            { label: 'Public sector pay', value: result.payRecurring },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>{row.label}</Text>
              <Text
                style={{
                  color: row.value < 0 ? colors.danger : row.value > 0 ? colors.success : colors.muted,
                  fontSize: font.tiny,
                  fontWeight: '700',
                }}
              >
                {row.value >= 0 ? '+' : '-'}£{Math.abs(row.value).toFixed(1)}bn/yr
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, paddingTop: 3, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
            <Text style={{ color: colors.text, fontSize: font.tiny, fontWeight: '800' }}>Total standing</Text>
            <Text
              style={{
                color: totalStanding < 0 ? colors.danger : totalStanding > 0 ? colors.success : colors.text,
                fontSize: font.tiny,
                fontWeight: '800',
              }}
            >
              {totalStanding >= 0 ? '+' : '-'}£{Math.abs(totalStanding).toFixed(1)}bn/yr
            </Text>
          </View>
        </View>
      </Card>

      {/* ================= ONE-CLICK CHANCELLOR PRESETS ================= */}
      <Text style={[styles.subhead, { marginTop: spacing.md, marginBottom: spacing.xs }]}>
        CHANCELLOR PRESETS (ONE-CLICK CONFIGURE)
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 }}>
        <Pressable onPress={() => applyPreset('budget-middle')} style={styles.presetBtn}>
          <Text style={styles.presetText}>The Middle Way</Text>
        </Pressable>
        <Pressable onPress={() => applyPreset('budget-invest')} style={styles.presetBtn}>
          <Text style={styles.presetText}>Invest for Growth</Text>
        </Pressable>
        <Pressable onPress={() => applyPreset('budget-restraint')} style={styles.presetBtn}>
          <Text style={styles.presetText}>Fiscal Restraint</Text>
        </Pressable>
        <Pressable onPress={() => applyPreset('budget-taxcuts')} style={styles.presetBtn}>
          <Text style={styles.presetText}>Tax Cuts Bet</Text>
        </Pressable>
      </View>

      {/* ================= CATEGORY NAVIGATION ================= */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 3, marginTop: spacing.md, borderWidth: 1, borderColor: colors.cardBorder }}>
        <Pressable
          onPress={() => setActiveSection('allowances')}
          style={[styles.tabBtn, activeSection === 'allowances' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeSection === 'allowances' && styles.tabTextActive]}>
            Allowances & Policy
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveSection('spending')}
          style={[styles.tabBtn, activeSection === 'spending' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeSection === 'spending' && styles.tabTextActive]}>
            Spending (DEL)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveSection('taxes')}
          style={[styles.tabBtn, activeSection === 'taxes' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, activeSection === 'taxes' && styles.tabTextActive]}>
            Tax Rates
          </Text>
        </Pressable>
      </View>

      {/* ================= 1. ALLOWANCES & MAJOR MEASURES ================= */}
      {activeSection === 'allowances' && (
        <View style={{ marginTop: spacing.sm }}>
          {/* Personal Tax-Free Allowance Slider */}
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  Personal Tax-Free Allowance
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  Income earned tax-free before basic rate 20% applies.
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: font.h2, fontWeight: '900' }}>
                £{plan.personalAllowance.toLocaleString()}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Button
                label="-£500"
                variant="ghost"
                compact
                disabled={plan.personalAllowance <= PERSONAL_ALLOWANCE_MIN}
                onPress={() => adjustAllowance(-PERSONAL_ALLOWANCE_STEP)}
              />
              <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                <Meter
                  value={plan.personalAllowance - PERSONAL_ALLOWANCE_MIN}
                  max={PERSONAL_ALLOWANCE_MAX - PERSONAL_ALLOWANCE_MIN}
                  height={8}
                />
              </View>
              <Button
                label="+£500"
                variant="ghost"
                compact
                disabled={plan.personalAllowance >= PERSONAL_ALLOWANCE_MAX}
                onPress={() => adjustAllowance(PERSONAL_ALLOWANCE_STEP)}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>Min £10,070</Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>
                {plan.personalAllowance > DEFAULT_PERSONAL_ALLOWANCE
                  ? `Raises take-home pay (Costs £${Math.abs(result.allowanceCost).toFixed(1)}bn/yr)`
                  : plan.personalAllowance < DEFAULT_PERSONAL_ALLOWANCE
                  ? `Cuts threshold (Saves £${Math.abs(result.allowanceCost).toFixed(1)}bn/yr)`
                  : 'Frozen at 2022 level (£12,570)'}
              </Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>Max £15,570</Text>
            </View>
          </Card>

          {/* Personal Allowance Freeze Duration */}
          <Card style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  Personal Allowance Freeze
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  Hold the nominal £{plan.personalAllowance.toLocaleString()} allowance flat for the next{' '}
                  {plan.personalAllowanceFreezeYears} annual Budget
                  {plan.personalAllowanceFreezeYears === 1 ? '' : 's'}, then resume uprating.
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: font.h2, fontWeight: '900' }}>
                {plan.personalAllowanceFreezeYears}y
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Button
                label="-1y"
                variant="ghost"
                compact
                disabled={plan.personalAllowanceFreezeYears <= 0}
                onPress={() => adjustFreezeYears(-1)}
              />
              <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                <Meter
                  value={plan.personalAllowanceFreezeYears}
                  max={Math.max(1, maxFreezeYears)}
                  height={8}
                />
              </View>
              <Button
                label="+1y"
                variant="ghost"
                compact
                disabled={plan.personalAllowanceFreezeYears >= maxFreezeYears}
                onPress={() => adjustFreezeYears(1)}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>No freeze</Text>
              <Text style={{ color: colors.muted, fontSize: font.tiny }}>
                Max {maxFreezeYears}y (term length)
              </Text>
            </View>

            <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: spacing.xs, lineHeight: 16 }}>
              {plan.personalAllowanceFreezeYears > 0
                ? 'Fiscal-drag trade-off: a frozen allowance lets inflation drag more pay into tax, trimming borrowing but squeezing households; it only catches up once the freeze expires.'
                : 'No freeze: the allowance is uprated with the CPI-like inflation proxy at each annual Budget, protecting take-home pay but leaving less headroom against borrowing.'}
              {' '}Counted in annual Budgets (tax years). Indicative only, not a Treasury costing.
            </Text>
          </Card>

          {/* Fuel Duty 5p Freeze Toggle */}
          <Card style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  Fuel Duty (52.95p / litre)
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  {plan.fuelDutyFrozen
                    ? `5p cut maintained — recurring cost £${Math.abs(result.fuelDutyRecurring).toFixed(1)}bn/yr; protects motorists & hauliers`
                    : `5p freeze ended — no recurring cost;${
                        result.fuelDutyRevenue > 0 ? ` one-off +£${result.fuelDutyRevenue.toFixed(1)}bn this Budget;` : ''
                      } unpopular with motorists`}
                </Text>
              </View>
              <Button
                label={plan.fuelDutyFrozen ? 'Freeze 5p' : 'Restore Duty'}
                variant={plan.fuelDutyFrozen ? 'secondary' : 'ghost'}
                compact
                onPress={() => setPlan((p) => ({ ...p, fuelDutyFrozen: !p.fuelDutyFrozen }))}
              />
            </View>
          </Card>

          {/* Stamp Duty Land Tax (SDLT) Nil-Rate Bands */}
          <Card style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  Stamp Duty (SDLT) Nil-Rate Bands
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  {plan.stampDutyRelief
                    ? `Bands raised to stimulate the housing market; recurring cost £${Math.abs(result.stampDutyRecurring).toFixed(1)}bn/yr`
                    : `Higher rates maintained to fund local services; no recurring cost${
                        result.stampDutyRevenue > 0 ? `, one-off +£${result.stampDutyRevenue.toFixed(1)}bn this Budget` : ''
                      }`}
                </Text>
              </View>
              <Button
                label={plan.stampDutyRelief ? 'Bands Raised' : 'Maintain Rates'}
                variant={plan.stampDutyRelief ? 'secondary' : 'ghost'}
                compact
                onPress={() => setPlan((p) => ({ ...p, stampDutyRelief: !p.stampDutyRelief }))}
              />
            </View>
          </Card>

          {/* State Pension Triple Lock Toggle */}
          <Card style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  State Pension Triple Lock
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  {plan.tripleLock
                    ? `Protected in full (rises with highest of inflation/wages/2.5%); recurring cost £${Math.abs(result.tripleLockRecurring).toFixed(1)}bn/yr`
                    : `Index to wages only — no recurring cost;${
                        result.tripleLockCost > 0 ? ` one-off +£${result.tripleLockCost.toFixed(1)}bn this Budget;` : ''
                      } strongly opposed by pensioners`}
                </Text>
              </View>
              <Button
                label={plan.tripleLock ? 'Keep Lock' : 'Wage Index'}
                variant={plan.tripleLock ? 'secondary' : 'ghost'}
                compact
                onPress={() => setPlan((p) => ({ ...p, tripleLock: !p.tripleLock }))}
              />
            </View>
          </Card>

          {/* Public Sector Pay Body Awards */}
          <Card style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  Public Sector Pay Awards
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  {plan.publicSectorPay === 'full'
                    ? `Fully fund Pay Review Body awards; recurring cost £${Math.abs(result.payRecurring).toFixed(1)}bn/yr`
                    : `Impose 2.5% pay cap; no recurring cost${
                        result.payCost > 0 ? `, one-off +£${result.payCost.toFixed(1)}bn this Budget` : ''
                      }; risks public sector union strike ballots`}
                </Text>
              </View>
              <Button
                label={plan.publicSectorPay === 'full' ? 'Fund Full' : 'Cap 2.5%'}
                variant={plan.publicSectorPay === 'full' ? 'secondary' : 'ghost'}
                compact
                onPress={() =>
                  setPlan((p) => ({
                    ...p,
                    publicSectorPay: p.publicSectorPay === 'full' ? 'capped' : 'full',
                  }))
                }
              />
            </View>
          </Card>

          {/* Threshold Freeze / Stealth Tax Toggle */}
          <Card style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
                  Threshold Freeze (Fiscal Drag)
                </Text>
                <Text style={{ color: colors.muted, fontSize: font.tiny, marginTop: 2 }}>
                  {plan.thresholdsFrozen
                    ? `Thresholds frozen: inflation drags pay into higher tax brackets (+£${result.fiscalDragRecurring.toFixed(1)}bn/yr)`
                    : `Indexed with inflation: stops stealth tax creep, leaves £${frozenFiscalDragBn.toFixed(1)}bn/yr gap`}
                </Text>
              </View>
              <Button
                label={plan.thresholdsFrozen ? 'Frozen' : 'Indexed'}
                variant={plan.thresholdsFrozen ? 'secondary' : 'ghost'}
                compact
                onPress={() => setPlan((p) => ({ ...p, thresholdsFrozen: !p.thresholdsFrozen }))}
              />
            </View>
          </Card>
        </View>
      )}

      {/* ================= 2. SPENDING DEPARTMENT SLIDERS ================= */}
      {activeSection === 'spending' && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginBottom: spacing.xs }}>
            Total Planned DEL Expenditure: £{result.spendTotal}bn/yr ({result.spendDelta >= 0 ? '+' : ''}£{result.spendDelta}bn)
          </Text>
          {state.departments.map((d) => {
            const currentVal = plan.departmentBudgets[d.id] ?? d.budget;
            const diff = currentVal - d.budget;

            return (
              <Card key={d.id} style={{ marginBottom: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{d.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.tiny }}>{d.desc}</Text>
                  </View>
                  <Text style={{ color: colors.accent, fontSize: font.h3, fontWeight: '800' }}>
                    £{currentVal}bn
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                  <Button
                    label={`-£${d.step}bn`}
                    variant="ghost"
                    compact
                    disabled={currentVal <= d.min}
                    onPress={() => adjustSpending(d.id, -d.step, d.min, d.max)}
                  />
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Meter value={currentVal - d.min} max={d.max - d.min} height={8} />
                  </View>
                  <Button
                    label={`+£${d.step}bn`}
                    variant="ghost"
                    compact
                    disabled={currentVal >= d.max}
                    onPress={() => adjustSpending(d.id, d.step, d.min, d.max)}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: font.tiny }}>Min £{d.min}bn</Text>
                  <Text style={{ color: diff === 0 ? colors.muted : diff > 0 ? colors.success : colors.danger, fontSize: font.tiny, fontWeight: '700' }}>
                    {diff === 0 ? 'Baseline' : `${diff > 0 ? '+' : ''}£${diff}bn vs current`}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny }}>Max £{d.max}bn</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* ================= 3. TAX RATE SLIDERS ================= */}
      {activeSection === 'taxes' && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ color: colors.muted, fontSize: font.tiny, marginBottom: spacing.xs }}>
            Tax Revenue Shift: {result.taxRevenueDelta >= 0 ? '+' : ''}£{result.taxRevenueDelta}bn/yr
          </Text>
          {state.taxes.map((t) => {
            const currentVal = plan.taxRates[t.id] ?? t.rate;
            const diff = currentVal - t.rate;
            const yieldPerPoint = TAX_YIELD_PER_POINT[t.id] ?? 1;

            return (
              <Card key={t.id} style={{ marginBottom: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{t.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.tiny }}>
                      Yields £{yieldPerPoint}bn/yr per 1% point
                    </Text>
                  </View>
                  <Text style={{ color: colors.accent, fontSize: font.h3, fontWeight: '800' }}>
                    {currentVal}%
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                  <Button
                    label={`-1%`}
                    variant="ghost"
                    compact
                    disabled={currentVal <= t.min}
                    onPress={() => adjustTax(t.id, -t.step, t.min, t.max)}
                  />
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Meter value={currentVal - t.min} max={t.max - t.min} height={8} />
                  </View>
                  <Button
                    label={`+1%`}
                    variant="ghost"
                    compact
                    disabled={currentVal >= t.max}
                    onPress={() => adjustTax(t.id, t.step, t.min, t.max)}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: font.tiny }}>Min {t.min}%</Text>
                  <Text style={{ color: diff === 0 ? colors.muted : diff > 0 ? colors.success : colors.danger, fontSize: font.tiny, fontWeight: '700' }}>
                    {diff === 0 ? 'Baseline' : `${diff > 0 ? '+' : ''}£${diff * yieldPerPoint}bn (${diff > 0 ? '+' : ''}${diff}%)`}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: font.tiny }}>Max {t.max}%</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* ================= DISPATCH BOX ACTION BUTTONS ================= */}
      <View style={{ marginTop: spacing.lg }}>
        <Button
          label="Deliver Budget at Dispatch Box"
          onPress={() => onDeliver(plan)}
        />
        <View style={{ marginTop: spacing.xs }}>
          <Button label="Postpone / Defer Statement" variant="ghost" onPress={onDefer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subhead: {
    color: colors.gold,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: fileFontFamily,
    textTransform: 'uppercase',
  },
  presetBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetText: {
    color: colors.text,
    fontSize: font.tiny,
    fontWeight: '700',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.accentSoft,
  },
  tabText: {
    color: colors.muted,
    fontSize: font.tiny,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.text,
  },
});
