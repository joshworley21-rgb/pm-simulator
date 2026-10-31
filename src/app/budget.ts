import type { BudgetPackage, CustomBudgetPlan, GameState, Effects } from './types';
import { TAX_YIELD_PER_POINT } from './taxes';
import {
  FROZEN_THRESHOLDS,
  previewFiscalDrag,
  calculatePersonalAllowanceRevenue,
  DEFAULT_PERSONAL_ALLOWANCE,
  PERSONAL_ALLOWANCE_STEP,
  PERSONAL_ALLOWANCE_MIN,
  PERSONAL_ALLOWANCE_MAX,
  PERSONAL_ALLOWANCE_COST_PER_STEP,
} from './fiscalDragIntegration';
import { findPostHolder, CHANCELLOR_POST, chancellorCredibilityHeadroomDelta } from './cabinetEffects';

export {
  DEFAULT_PERSONAL_ALLOWANCE,
  PERSONAL_ALLOWANCE_STEP,
  PERSONAL_ALLOWANCE_MIN,
  PERSONAL_ALLOWANCE_MAX,
  PERSONAL_ALLOWANCE_COST_PER_STEP,
};
/** Cost of maintaining the temporary 5p fuel duty freeze (£bn/yr) */
export const FUEL_DUTY_FREEZE_COST = 2.5;
/** Cost of fully funding independent public sector pay review body awards (£bn/yr) */
export const PUBLIC_SECTOR_PAY_COST = 2.0;
/** Cost of maintaining the State Pension Triple Lock over wage growth (£bn/yr) */
export const TRIPLE_LOCK_COST = 2.0;
/** Cost of raising SDLT nil-rate bands to stimulate the housing market (£bn/yr) */
export const STAMP_DUTY_RELIEF_COST = 3.0;

/** Sustainable annual borrowing benchmark for debt-to-GDP stability (£bn) */
export const FISCAL_RULE_DEFICIT_CEILING = -65;

/**
 * Longest Personal Allowance freeze a campaign can contain, in annual Budget
 * cycles (tax years). One annual Budget falls every twelve turns, so a
 * five-year term caps the freeze at five years.
 */
export function personalAllowanceFreezeCap(termLength?: number): number {
  return Math.max(0, Math.floor((termLength || 60) / 12));
}

/**
 * Annual recurring fiscal effect of the Fuel Duty 5p freeze, as a revenue
 * figure (£bn/yr). Maintaining the freeze forgoes FUEL_DUTY_FREEZE_COST, so the
 * term is negative while the freeze holds and returns to zero once the
 * escalator is restored. Shared by the recurring structural model
 * (`structuralBalance` in engine.ts) and the budget preview so the two cannot
 * drift apart.
 */
export function fuelDutyRecurringRevenue(frozen: boolean): number {
  return frozen ? -FUEL_DUTY_FREEZE_COST : 0;
}

/**
 * Annual recurring fiscal effect of the State Pension Triple Lock (£bn/yr).
 * Maintaining the lock forgoes TRIPLE_LOCK_COST while it holds and returns to
 * zero once the pension is indexed to wages only. Shared by the recurring
 * structural model and the budget preview so the two cannot drift apart.
 */
export function tripleLockRecurringRevenue(locked: boolean): number {
  return locked ? -TRIPLE_LOCK_COST : 0;
}

/**
 * Annual recurring fiscal effect of public sector pay awards (£bn/yr). Fully
 * funding the Pay Review Bodies forgoes PUBLIC_SECTOR_PAY_COST while it holds
 * and returns to zero once awards are capped. Shared by the recurring
 * structural model and the budget preview so the two cannot drift apart.
 */
export function publicSectorPayRecurringRevenue(full: boolean): number {
  return full ? -PUBLIC_SECTOR_PAY_COST : 0;
}

/**
 * Standing annual Personal Allowance effect (£bn/yr) measured against the
 * fixed frozen baseline, matching `personalAllowanceRevenue` in engine.ts.
 * Raising the allowance forgoes revenue (negative); lowering it raises revenue.
 */
export function personalAllowanceRecurringRevenue(allowance: number): number {
  return calculatePersonalAllowanceRevenue(allowance);
}

/**
 * Annual recurring fiscal effect of the Stamp Duty Land Tax nil-rate bands
 * (£bn/yr). Raising the bands forgoes STAMP_DUTY_RELIEF_COST while it is in
 * place and returns to zero once higher rates are maintained. Shared by the
 * recurring structural model and the budget preview so the two cannot drift.
 */
export function stampDutyRecurringRevenue(relief: boolean): number {
  return relief ? -STAMP_DUTY_RELIEF_COST : 0;
}

export const BUDGET_PACKAGES: BudgetPackage[] = [
  {
    id: 'budget-restraint',
    title: 'Fiscal Restraint',
    description: 'Freeze departmental spending and hold taxes to reassure the bond markets.',
    effects: { economy: 2, publicServices: -2, debtToGdp: -1, budgetBalance: 15, approval: -2, partyConfidence: 2 },
    kicker: 'CHANCELLOR FREEZES SPENDING TO BALANCE THE BOOKS',
  },
  {
    id: 'budget-invest',
    title: 'Invest for Growth',
    description: 'Boost NHS, energy and housing capital investment, funded by borrowing.',
    effects: { publicServices: 5, economy: 2, approval: 3, budgetBalance: -25, debtToGdp: 1, giltYield: 0.1 },
    kicker: 'BUDGET UNVEILS MAJOR INVESTMENT IN SERVICES AND GROWTH',
  },
  {
    id: 'budget-middle',
    title: 'The Middle Way',
    description: 'A modest tax rise paired with targeted frontline spending.',
    effects: { publicServices: 2, economy: 1, approval: 1, budgetBalance: 5, taxRate: 1 },
    kicker: 'BUDGET: MODEST TAX RISES TO FUND FRONTLINE SERVICES',
  },
  {
    id: 'budget-taxcuts',
    title: 'Tax Cuts',
    description: 'Cut National Insurance and corporation tax, betting on growth to pay for itself.',
    effects: { economy: 4, approval: 2, taxRate: -2, budgetBalance: -20, debtToGdp: 1, publicServices: -3, unemployment: -0.3 },
    kicker: 'BUDGET SLASHES TAXES IN AN ALL-OR-NOTHING GROWTH BET',
  },
];

export interface CustomBudgetResult {
  spendTotal: number;
  spendDelta: number;
  taxRevenueDelta: number;
  allowanceCost: number;
  /** Standing annual Personal Allowance cost once the budget is delivered (£bn/yr). */
  allowanceRecurring: number;
  /** One-off change in the annual position from switching the freeze on/off. */
  fuelDutyRevenue: number;
  /** Standing annual Fuel Duty cost once the budget is delivered (£bn/yr). */
  fuelDutyRecurring: number;
  /** One-off change in the annual position from moving the SDLT nil-rate bands. */
  stampDutyRevenue: number;
  /** Standing annual SDLT relief cost once the budget is delivered (£bn/yr). */
  stampDutyRecurring: number;
  /** One-off change in the annual position from switching the threshold freeze on/off. */
  fiscalDragRevenue: number;
  /** Standing annual Fiscal Drag revenue once the budget is delivered (£bn/yr). */
  fiscalDragRecurring: number;
  payCost: number;
  /** Standing annual Public Sector Pay cost once the budget is delivered (£bn/yr). */
  payRecurring: number;
  tripleLockCost: number;
  /** Standing annual Triple Lock cost once the budget is delivered (£bn/yr). */
  tripleLockRecurring: number;
  netBudgetBalance: number;
  netBorrowing: number;
  obrHeadroom: number;
  obrAssessment: 'compliant' | 'tight' | 'breach';
  obrVerdict: string;
  projectedGiltImpact: number;
  projectedApprovalImpact: number;
  projectedServicesImpact: number;
  projectedEconomyImpact: number;
  projectedUnityImpact: number;
  effects: Effects;
}

export function calculateCustomBudget(plan: CustomBudgetPlan, state: GameState): CustomBudgetResult {
  // 1. Spending
  const depts = state.departments;
  let spendTotal = 0;
  let baseSpend = 0;
  let servicesDelta = 0;
  let economySpendDelta = 0;

  for (const d of depts) {
    const planned = plan.departmentBudgets[d.id] !== undefined ? plan.departmentBudgets[d.id] : d.budget;
    spendTotal += planned;
    baseSpend += d.budget;
    const diff = planned - d.budget;
    const steps = Math.round(diff / d.step);
    if (d.benefit.publicServices) servicesDelta += d.benefit.publicServices * steps;
    if (d.benefit.economy) economySpendDelta += d.benefit.economy * steps;
  }
  const spendDelta = spendTotal - baseSpend;

  // 2. Taxes
  let taxRevenueDelta = 0;
  let taxApprovalHit = 0;
  for (const t of state.taxes) {
    const currentRate = t.rate;
    const plannedRate = plan.taxRates[t.id] !== undefined ? plan.taxRates[t.id] : t.rate;
    const diff = plannedRate - currentRate;
    taxRevenueDelta += diff * (TAX_YIELD_PER_POINT[t.id] ?? 0);
    taxApprovalHit += -diff * t.popularityWeight;
  }

  // 3. Personal Allowance
  const currentAllowance = state.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  const plannedAllowance = plan.personalAllowance ?? currentAllowance;
  const allowanceDiff = plannedAllowance - currentAllowance;
  const allowanceSteps = allowanceDiff / PERSONAL_ALLOWANCE_STEP;
  // Standing annual level (vs the frozen baseline), reported alongside the
  // one-off change so the preview cannot confuse the two.
  const allowanceRecurring = personalAllowanceRecurringRevenue(plannedAllowance);
  // Raising allowance costs revenue (positive `allowanceCost`), lowering saves
  // revenue — derived from the difference in `personalAllowanceRecurringRevenue`
  // so both the standing level and the one-off delta share the same clamped
  // single source of truth.
  const allowanceCost =
    Math.round(
      (personalAllowanceRecurringRevenue(currentAllowance) - allowanceRecurring) * 10,
    ) / 10;
  const allowanceApprovalBoost = allowanceSteps * 1.2;

  // 4. Fuel Duty. Only the one-off *change* in the freeze status is scored
  // here; the standing annual cost is held once in the recurring structural
  // model (`fuelDutyRecurringRevenue`), so the same £2.5bn is never counted as
  // both a one-off and a recurring item. `fuelDutyRevenue` is the difference
  // this budget makes to the annual position; `fuelDutyRecurring` is the level
  // it settles at.
  const isFuelDutyFrozen = plan.fuelDutyFrozen ?? state.fuelDutyFrozen ?? true;
  const fuelDutyRecurring = fuelDutyRecurringRevenue(isFuelDutyFrozen);
  const fuelDutyRevenue =
    fuelDutyRecurring - fuelDutyRecurringRevenue(state.fuelDutyFrozen ?? true);
  const fuelDutyApproval = isFuelDutyFrozen ? 1 : -1;

  // 4b. Stamp Duty Land Tax (SDLT). Same one-off/level split as Fuel Duty:
  // raising the nil-rate bands forgoes revenue and stimulates housing.
  const isStampDutyRelief = plan.stampDutyRelief ?? state.stampDutyRelief ?? false;
  const stampDutyRecurring = stampDutyRecurringRevenue(isStampDutyRelief);
  const stampDutyRevenue =
    stampDutyRecurring - stampDutyRecurringRevenue(state.stampDutyRelief ?? false);
  const stampDutyApproval = isStampDutyRelief ? 1 : 0;
  const stampDutyEconomy = isStampDutyRelief ? 1 : 0;

  // 5. Fiscal Drag / Threshold Freeze
  // Single source of truth: derived from `previewFiscalDrag` so the preview,
  // UI, and engine turn resolution all evaluate the same inflation-based model.
  // Only the one-off *change* in freeze status is scored in `netDelta`; the
  // standing annual revenue is reported separately (`fiscalDragRecurring`).
  const isThresholdsFrozen = plan.thresholdsFrozen ?? state.thresholdsFrozen ?? true;
  const fiscalDragRecurring = previewFiscalDrag(state, isThresholdsFrozen).additionalRevenue;
  const currentFiscalDragRecurring = previewFiscalDrag(state, state.thresholdsFrozen ?? true).additionalRevenue;
  const fiscalDragRevenue =
    Math.round((fiscalDragRecurring - currentFiscalDragRecurring) * 10) / 10;
  const fiscalDragApproval = isThresholdsFrozen ? -1 : 1;

  // 6. Public Sector Pay
  // As with Fuel Duty, only the one-off *change* is scored here; the standing
  // annual cost lives once in the recurring structural model
  // (`publicSectorPayRecurringRevenue`), so the same £2bn is never counted twice.
  const isPayFull = (plan.publicSectorPay ?? state.publicSectorPay ?? 'full') === 'full';
  const payRecurring = publicSectorPayRecurringRevenue(isPayFull);
  const payCost =
    payRecurring - publicSectorPayRecurringRevenue((state.publicSectorPay ?? 'full') !== 'capped');
  const payServicesDelta = isPayFull ? 2 : -2;
  const payUnityDelta = isPayFull ? 1 : -2;

  // 7. State Pension Triple Lock
  // Only the one-off *change* in lock status is scored here; the standing
  // annual cost lives once in the recurring structural model
  // (`tripleLockRecurringRevenue`), so the same £2bn is never counted twice.
  const isTripleLock = plan.tripleLock ?? state.tripleLock ?? true;
  const tripleLockRecurring = tripleLockRecurringRevenue(isTripleLock);
  const tripleLockCost =
    tripleLockRecurring - tripleLockRecurringRevenue(state.tripleLock ?? true);
  const tripleLockApproval = isTripleLock ? 1 : -2;

  // Net Deficit
  const startingBalance = state.stats.budgetBalance;
  const netDelta =
    taxRevenueDelta -
    spendDelta -
    allowanceCost +
    fuelDutyRevenue +
    stampDutyRevenue +
    fiscalDragRevenue +
    payCost +
    tripleLockCost;

  const netBudgetBalance = Math.round((startingBalance + netDelta) * 10) / 10;
  const netBorrowing = Math.max(0, -netBudgetBalance);

  // OBR Fiscal Headroom: baseline distance from sustainable deficit ceiling,
  // adjusted by Chancellor market credibility bonus/penalty.
  const chancellor = findPostHolder(state.cabinet, CHANCELLOR_POST);
  const chancellorDelta = chancellorCredibilityHeadroomDelta(chancellor);
  const obrHeadroom =
    Math.round((netBudgetBalance - FISCAL_RULE_DEFICIT_CEILING + chancellorDelta) * 10) / 10;
  let obrAssessment: 'compliant' | 'tight' | 'breach';
  let obrVerdict: string;
  let projectedGiltImpact = 0;
  let projectedUnityImpact = 0;

  if (obrHeadroom >= 0) {
    obrAssessment = 'compliant';
    obrVerdict = 'OBR Forecast: Debt falling in Year 5. Fiscal rules fully satisfied; bond markets calm.';
    projectedGiltImpact = -0.1;
    projectedUnityImpact += 2;
  } else if (obrHeadroom >= -15) {
    obrAssessment = 'tight';
    obrVerdict = 'OBR Forecast: Headroom tight. Borrowing within acceptable market bounds, but vulnerable to shocks.';
    projectedGiltImpact = 0;
  } else {
    obrAssessment = 'breach';
    obrVerdict = 'OBR Warning: Borrowing exceeds sustainable fiscal rules. High risk of bond vigilantes spiking gilt yields.';
    projectedGiltImpact = 0.3;
    projectedUnityImpact -= 3;
  }

  const projectedApprovalImpact =
    Math.round(
      (taxApprovalHit +
        allowanceApprovalBoost +
        fuelDutyApproval +
        stampDutyApproval +
        fiscalDragApproval +
        tripleLockApproval +
        servicesDelta * 0.3) *
        10,
    ) / 10;
  const projectedServicesImpact = Math.round((servicesDelta + payServicesDelta) * 10) / 10;
  const projectedEconomyImpact =
    Math.round((economySpendDelta * 0.5 + (taxRevenueDelta < 0 ? 1 : -1) + stampDutyEconomy) * 10) / 10;

  const effects: Effects = {
    budgetBalance: Math.round(netDelta * 10) / 10,
    approval: projectedApprovalImpact,
    publicServices: projectedServicesImpact,
    economy: projectedEconomyImpact,
    partyConfidence: projectedUnityImpact + payUnityDelta,
    giltYield: projectedGiltImpact !== 0 ? projectedGiltImpact : undefined,
  };

  return {
    spendTotal,
    spendDelta,
    taxRevenueDelta,
    allowanceCost,
    allowanceRecurring,
    fuelDutyRevenue,
    fuelDutyRecurring,
    stampDutyRevenue,
    stampDutyRecurring,
    fiscalDragRevenue,
    fiscalDragRecurring,
    payCost,
    payRecurring,
    tripleLockCost,
    tripleLockRecurring,
    netBudgetBalance,
    netBorrowing,
    obrHeadroom,
    obrAssessment,
    obrVerdict,
    projectedGiltImpact,
    projectedApprovalImpact,
    projectedServicesImpact,
    projectedEconomyImpact,
    projectedUnityImpact,
    effects,
  };
}

export function getDefaultCustomPlan(state: GameState): CustomBudgetPlan {
  const departmentBudgets: Record<string, number> = {};
  for (const d of state.departments) departmentBudgets[d.id] = d.budget;

  const taxRates: Record<string, number> = {};
  for (const t of state.taxes) taxRates[t.id] = t.rate;

  return {
    title: 'Custom Budget Plan',
    departmentBudgets,
    taxRates,
    personalAllowance: state.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: Math.min(
      personalAllowanceFreezeCap(state.termLength),
      Math.max(0, state.personalAllowanceFreezeYears ?? 0),
    ),
    fuelDutyFrozen: state.fuelDutyFrozen ?? true,
    stampDutyRelief: state.stampDutyRelief ?? false,
    thresholdsFrozen: state.thresholdsFrozen ?? true,
    publicSectorPay: state.publicSectorPay ?? 'full',
    tripleLock: state.tripleLock ?? true,
  };
}

export function getPresetPlan(presetId: string, state: GameState): CustomBudgetPlan {
  const plan = getDefaultCustomPlan(state);
  switch (presetId) {
    case 'budget-invest':
      return {
        ...plan,
        title: 'Invest for Growth Budget',
        departmentBudgets: {
          ...plan.departmentBudgets,
          nhs: Math.min(230, (plan.departmentBudgets.nhs ?? 190) + 15),
          education: Math.min(105, (plan.departmentBudgets.education ?? 80) + 10),
          transport: Math.min(50, (plan.departmentBudgets.transport ?? 30) + 10),
        },
        personalAllowance: Math.min(PERSONAL_ALLOWANCE_MAX, plan.personalAllowance + 500),
        publicSectorPay: 'full',
        tripleLock: true,
      };
    case 'budget-restraint':
      return {
        ...plan,
        title: 'Fiscal Restraint Budget',
        departmentBudgets: {
          ...plan.departmentBudgets,
          nhs: Math.max(150, (plan.departmentBudgets.nhs ?? 190) - 10),
          education: Math.max(55, (plan.departmentBudgets.education ?? 80) - 5),
          transport: Math.max(18, (plan.departmentBudgets.transport ?? 30) - 5),
        },
        taxRates: {
          ...plan.taxRates,
          corporation: Math.min(35, (plan.taxRates.corporation ?? 25) + 2),
        },
        publicSectorPay: 'capped',
        tripleLock: false,
      };
    case 'budget-taxcuts':
      return {
        ...plan,
        title: 'Radical Tax Cuts Budget',
        taxRates: {
          ...plan.taxRates,
          income: Math.max(15, (plan.taxRates.income ?? 20) - 2),
          ni: Math.max(4, (plan.taxRates.ni ?? 8) - 2),
          corporation: Math.max(15, (plan.taxRates.corporation ?? 25) - 3),
        },
        personalAllowance: Math.min(PERSONAL_ALLOWANCE_MAX, plan.personalAllowance + 1000),
        thresholdsFrozen: false,
        publicSectorPay: 'capped',
      };
    case 'budget-middle':
    default:
      return {
        ...plan,
        title: 'The Middle Way Budget',
        departmentBudgets: {
          ...plan.departmentBudgets,
          nhs: Math.min(230, (plan.departmentBudgets.nhs ?? 190) + 5),
        },
        taxRates: {
          ...plan.taxRates,
          corporation: Math.min(35, (plan.taxRates.corporation ?? 25) + 1),
        },
        personalAllowance: DEFAULT_PERSONAL_ALLOWANCE,
        fuelDutyFrozen: true,
        thresholdsFrozen: true,
        publicSectorPay: 'full',
        tripleLock: true,
      };
  }
}
