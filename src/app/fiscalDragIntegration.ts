/**
 * Fiscal drag: frozen thresholds quietly raise more tax as pay rises.
 *
 * All money is in pounds (input) and BILLIONS of pounds per year (output).
 * The model is deliberately simple and calibrated against the real-world
 * effect of the 2021-2025 threshold freeze, which raised roughly £6-8bn a
 * year at 4-5% nominal pay growth.
 */

import type { Effects } from './types';
import { TURNS_PER_HALF_YEAR, TURNS_PER_YEAR } from './calendar';

export interface FiscalDragParameters {
  /** Personal allowance (£) — frozen at the 2022/23 level of £12,570 */
  personalAllowance: number;
  /** Basic rate limit (£) — frozen at £50,270 */
  basicRateCutoff: number;
  /** Higher rate threshold (£) — frozen at £125,140 */
  higherRateCutoff: number;
  /** Additional rate threshold (£) */
  additionalRateCutoff: number;
  basicRate: number;
  higherRate: number;
  additionalRate: number;
  /** CPI inflation (%) */
  cpiInflation: number;
  /** Real income growth after inflation (%) */
  realIncomeGrowth: number;
  fiscalYear: number;
}

export interface FiscalDragResult {
  /** Extra revenue from bracket creep, £bn per year */
  additionalRevenue: number;
  /** Taxpayers dragged into a higher band this year */
  taxpayersAffected: number;
  /** Average extra tax per affected taxpayer, £ per year */
  avgTaxIncrease: number;
  /** Change in the effective tax rate, percentage points */
  effectiveTaxRateChange: number;
  intensity: 'low' | 'medium' | 'high' | 'very_high';
  /** True when allowances have not been indexed */
  thresholdsFrozen: boolean;
  /** Same as additionalRevenue, kept for continuity */
  cumulativeFiscalDrag: number;
}

/** Frozen thresholds, as they have stood since 2022/23. */
export const FROZEN_THRESHOLDS = {
  personalAllowance: 12_570,
  basicRateCutoff: 50_270,
  higherRateCutoff: 125_140,
  additionalRateCutoff: 150_000,
} as const;

export const DEFAULT_PERSONAL_ALLOWANCE = FROZEN_THRESHOLDS.personalAllowance;
export const PERSONAL_ALLOWANCE_STEP = 500;
export const PERSONAL_ALLOWANCE_MIN = 10_070;
export const PERSONAL_ALLOWANCE_MAX = 15_570;
/** Rough Treasury cost per £500 increase in the tax-free allowance (£bn/yr) */
export const PERSONAL_ALLOWANCE_COST_PER_STEP = 3.5;

/**
 * Single source of truth for the standing annual Personal Allowance revenue
 * effect (£bn/yr), measured against the fixed frozen baseline
 * (`FROZEN_THRESHOLDS.personalAllowance`). Strictly clamps `input` to
 * `[PERSONAL_ALLOWANCE_MIN, PERSONAL_ALLOWANCE_MAX]` so out-of-range values
 * cannot produce extreme game-breaking fiscal terms.
 */
export function calculatePersonalAllowanceRevenue(input: number): number {
  const clamped = Math.max(PERSONAL_ALLOWANCE_MIN, Math.min(PERSONAL_ALLOWANCE_MAX, input));
  const steps = (clamped - FROZEN_THRESHOLDS.personalAllowance) / PERSONAL_ALLOWANCE_STEP;
  return -steps * PERSONAL_ALLOWANCE_COST_PER_STEP;
}

/** Average taxable income used to translate pay growth into cash (£). */
const AVERAGE_TAXABLE_INCOME = 34_000;
/** UK taxpayer population used by the model. */
const TOTAL_TAXPAYERS = 32_000_000;
/** Share of taxpayers sitting near a band edge, so pay growth drags them over it. */
const BAND_EDGE_SHARE = 0.12;
/** Calibration factor, tuned so 4% nominal growth ≈ £6bn/yr. */
const DRAG_SENSITIVITY = 0.6;
/** Approximate total UK tax take, used for the effective-rate calculation (£bn). */
const TOTAL_TAX_TAKE_BN = 1_000;

export const FISCAL_DRAG_SCENARIOS = {
  moderate: {
    name: 'Moderate Inflation Drift',
    parameters: {
      ...FROZEN_THRESHOLDS,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 2.5,
      realIncomeGrowth: 0.5,
      fiscalYear: 2025,
    },
  },
  high: {
    name: 'High Inflation Drift',
    parameters: {
      ...FROZEN_THRESHOLDS,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 5.0,
      realIncomeGrowth: 1.0,
      fiscalYear: 2025,
    },
  },
  freeze: {
    name: 'Threshold Freeze (No Indexation)',
    parameters: {
      ...FROZEN_THRESHOLDS,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 3.5,
      realIncomeGrowth: 0,
      fiscalYear: 2025,
    },
  },
  growthBoom: {
    name: 'Strong Real Income Growth',
    parameters: {
      ...FROZEN_THRESHOLDS,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 2.0,
      realIncomeGrowth: 3.0,
      fiscalYear: 2025,
    },
  },
  electionGiveaway: {
    name: 'Election Year Threshold Increase',
    parameters: {
      personalAllowance: 12_750,
      basicRateCutoff: 50_500,
      higherRateCutoff: 126_000,
      additionalRateCutoff: 150_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 3.0,
      realIncomeGrowth: 1.5,
      fiscalYear: 2025,
    },
  },
} as const;

/** Annual nominal GDP growth (%) from real growth and inflation. */
export function nominalGdpGrowthRate(realGrowth: number, inflation: number): number {
  return realGrowth + inflation + (realGrowth * inflation) / 100;
}

export function calculateFiscalDrag(params: FiscalDragParameters): FiscalDragResult {
  const nominalGrowth = Math.max(
    0,
    nominalGdpGrowthRate(params.realIncomeGrowth, params.cpiInflation),
  );
  // Bracket-creep drag is driven by the general threshold-freeze policy applied
  // to the rate cutoffs only. The Personal Allowance level is deliberately NOT
  // part of this gate: it is scored once, as a separate recurring estimate
  // (`personalAllowanceRevenue` in engine.ts), so raising or lowering the
  // allowance cannot switch the general freeze on or off.
  const thresholdsFrozen = params.basicRateCutoff <= FROZEN_THRESHOLDS.basicRateCutoff;

  // Cash value of one year's pay growth for a typical taxpayer.
  const incomeIncrement = (AVERAGE_TAXABLE_INCOME * nominalGrowth) / 100;

  // Everyone whose pay rises pays basic rate on the increment; the slice of
  // taxpayers near a band edge also pays the higher-rate step on the part
  // that crosses the line.
  const basicDrag = TOTAL_TAXPAYERS * incomeIncrement * (params.basicRate / 100);
  const higherStep = (params.higherRate - params.basicRate) / 100;
  const higherDrag = TOTAL_TAXPAYERS * BAND_EDGE_SHARE * incomeIncrement * higherStep;

  const rawBn = ((basicDrag + higherDrag) / 1e9) * DRAG_SENSITIVITY;
  const additionalRevenue = thresholdsFrozen ? Math.round(rawBn * 10) / 10 : 0;

  const taxpayersAffected = thresholdsFrozen
    ? Math.round(TOTAL_TAXPAYERS * BAND_EDGE_SHARE * Math.min(1, nominalGrowth / 8))
    : 0;

  const avgTaxIncrease = taxpayersAffected > 0
    ? Math.round((additionalRevenue * 1e9) / taxpayersAffected)
    : 0;

  const effectiveTaxRateChange = Math.round((additionalRevenue / TOTAL_TAX_TAKE_BN) * 100 * 10) / 10;

  let intensity: FiscalDragResult['intensity'];
  if (nominalGrowth >= 6) intensity = 'very_high';
  else if (nominalGrowth >= 4) intensity = 'high';
  else if (nominalGrowth >= 2) intensity = 'medium';
  else intensity = 'low';

  return {
    additionalRevenue,
    taxpayersAffected,
    avgTaxIncrease,
    effectiveTaxRateChange,
    intensity,
    thresholdsFrozen,
    cumulativeFiscalDrag: additionalRevenue,
  };
}

/**
 * Minimal macro snapshot needed to evaluate fiscal drag from game state.
 * Shared by turn resolution (`weeklyFiscalDrag`, `TOGGLE_THRESHOLD_FREEZE`,
 * `DELIVER_CUSTOM_BUDGET` in `engine.ts`), the budget preview (`budget.ts`),
 * and the UI (`BudgetWorkbench.tsx`) so all surfaces read a Single Source of
 * Truth.
 */
export interface FiscalDragMacroState {
  thresholdsFrozen?: boolean;
  week?: number;
  stats: {
    cpiInflation: number;
    gdpGrowth: number;
  };
}

/**
 * Evaluate the live fiscal-drag model for a given macro state and optional
 * freeze override. When `thresholdsFrozenOverride` is omitted, uses
 * `macroState.thresholdsFrozen ?? true`.
 */
export function previewFiscalDrag(
  macroState: FiscalDragMacroState,
  thresholdsFrozenOverride?: boolean,
): FiscalDragResult {
  const frozen = thresholdsFrozenOverride ?? macroState.thresholdsFrozen ?? true;
  const cpiInflation = macroState.stats.cpiInflation;
  const realIncomeGrowth = macroState.stats.gdpGrowth;
  const week = macroState.week ?? 1;
  const indexedFactor = frozen ? 1 : 1 + Math.max(0.01, cpiInflation / 100);
  return calculateFiscalDrag({
    personalAllowance: Math.round(FROZEN_THRESHOLDS.personalAllowance * indexedFactor),
    basicRateCutoff: Math.round(FROZEN_THRESHOLDS.basicRateCutoff * indexedFactor),
    higherRateCutoff: Math.round(FROZEN_THRESHOLDS.higherRateCutoff * indexedFactor),
    additionalRateCutoff: FROZEN_THRESHOLDS.additionalRateCutoff,
    basicRate: 20,
    higherRate: 40,
    additionalRate: 45,
    cpiInflation,
    realIncomeGrowth,
    fiscalYear: 2024 + Math.floor((week - 1) / TURNS_PER_YEAR),
  });
}

/** Translate the annual drag into the small weekly effect the engine applies. */
export function fiscalDragToEffects(result: FiscalDragResult): Effects {
  if (result.additionalRevenue <= 0) return {};
  return {
    // A monthly slice of the annual figure, so a 60-month term accumulates
    // roughly five years of drag.
    budgetBalance: Math.round((result.additionalRevenue / TURNS_PER_YEAR) * 100) / 100,
    // Voters notice stealth taxation, but gently.
    approval: -Math.min(2, result.effectiveTaxRateChange * 1.5),
    partyConfidence: -Math.min(1, result.effectiveTaxRateChange * 0.5),
  };
}

/** Back-compat helper: direct effects from parameters. */
export function applyFiscalDragToState(
  _state: unknown,
  params: FiscalDragParameters,
): Effects {
  return fiscalDragToEffects(calculateFiscalDrag(params));
}

/** Pick the scenario that matches the current economy. */
export function getFiscalDragScenario(
  cpiInflation: number,
  realIncomeGrowth: number,
): keyof typeof FISCAL_DRAG_SCENARIOS {
  if (cpiInflation >= 4.5) return 'high';
  if (cpiInflation >= 3) return 'freeze';
  if (cpiInflation >= 2) return 'moderate';
  if (realIncomeGrowth >= 2.5) return 'growthBoom';
  return 'moderate';
}
