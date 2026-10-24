/**
 * Fiscal drag: frozen thresholds quietly raise more tax as pay rises.
 *
 * All money is in pounds (input) and BILLIONS of pounds per year (output).
 * The model is deliberately simple and calibrated against the real-world
 * effect of the 2021-2025 threshold freeze, which raised roughly £6-8bn a
 * year at 4-5% nominal pay growth.
 */

import type { Effects } from './types';

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

export function calculateFiscalDrag(params: FiscalDragParameters): FiscalDragResult {
  const nominalGrowth = Math.max(0, params.realIncomeGrowth + params.cpiInflation);
  const thresholdsFrozen =
    params.personalAllowance <= FROZEN_THRESHOLDS.personalAllowance &&
    params.basicRateCutoff <= FROZEN_THRESHOLDS.basicRateCutoff;

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

/** Translate the annual drag into the small weekly effect the engine applies. */
export function fiscalDragToEffects(result: FiscalDragResult): Effects {
  if (result.additionalRevenue <= 0) return {};
  return {
    // A twelfth of the annual figure each month-ish, so a 60-week term
    // accumulates roughly five years of drag.
    budgetBalance: Math.round((result.additionalRevenue / 12) * 100) / 100,
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
