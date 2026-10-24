/**
 * Fiscal Drag Integration
 * Tax threshold freezing, bracket creep, and automatic fiscal effects
 */

import type { Effects } from './types';

/** Fiscal drag parameters - based on UK 2024/25 tax year */
export interface FiscalDragParameters {
  /** Personal allowance (£) - frozen at 2022/23 level of £12,570 */
  personalAllowance: number;
  /** Basic rate threshold (£) - frozen at £50,270 */
  basicRateCutoff: number;
  /** Higher rate threshold (£) - frozen at £125,140 */
  higherRateCutoff: number;
  /** Additional rate threshold (£) - frozen at £125,140+ */
  additionalRateCutoff: number;
  /** Basic rate of income tax (%) - 20% */
  basicRate: number;
  /** Higher rate of income tax (%) - 40% */
  higherRate: number;
  /** Additional rate of income tax (%) - 45% */
  additionalRate: number;
  /** Current CPI inflation (%) */
  cpiInflation: number;
  /** Real income growth after inflation (%) */
  realIncomeGrowth: number;
  /** Year of fiscal event (for threshold review announcements) */
  fiscalYear: number;
}

/** Fiscal drag result */
export interface FiscalDragResult {
  /** Additional revenue raised (£bn/year) */
  additionalRevenue: number;
  /** Number of taxpayers pushed into higher bracket */
  taxpayersAffected: number;
  /** Average tax increase per affected taxpayer (£/year) */
  avgTaxIncrease: number;
  /** Effective tax rate change (percentage points) */
  effectiveTaxRateChange: number;
  /** Fiscal drag intensity classification */
  intensity: 'low' | 'medium' | 'high' | 'very_high';
  /** Whether thresholds were frozen or adjusted */
  thresholdsFrozen: boolean;
  /** Cumulative fiscal drag since threshold freeze started */
  cumulativeFiscalDrag: number;
}

/** UK fiscal drag scenarios */
export const FISCAL_DRAG_SCENARIOS = {
  /** Moderate inflation drift */
  moderate: {
    name: 'Moderate Inflation Drift',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 150_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 2.5,
      realIncomeGrowth: 0.5,
      fiscalYear: 2024,
    },
  },
  /** High inflation bracket creep */
  high: {
    name: 'High Inflation Drift',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 150_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 5.0,
      realIncomeGrowth: 1.0,
      fiscalYear: 2024,
    },
  },
  /** Threshold freeze (no indexation) - worst case */
  freeze: {
    name: 'Threshold Freeze (No Indexation)',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 150_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 3.5,
      realIncomeGrowth: 0,
      fiscalYear: 2024,
    },
  },
  /** Strong real income growth */
  growthBoom: {
    name: 'Strong Real Income Growth',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 150_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 2.0,
      realIncomeGrowth: 3.0,
      fiscalYear: 2024,
    },
  },
  /** Election year giveaway - threshold increase */
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
      fiscalYear: 2024,
    },
  },
} as const;

/** Calculate fiscal drag impact for a given year */
export function calculateFiscalDrag(params: FiscalDragParameters): FiscalDragResult {
  const {
    personalAllowance,
    basicRateCutoff,
    higherRateCutoff,
    additionalRateCutoff,
    basicRate,
    higherRate,
    additionalRate,
    cpiInflation,
    realIncomeGrowth,
  } = params;

  const nominalGrowth = realIncomeGrowth + cpiInflation;
  const totalTaxpayers = 32_000_000;

  // Determine intensity
  let intensity: 'low' | 'medium' | 'high' | 'very_high';
  if (cpiInflation >= 5 && realIncomeGrowth >= 3) intensity = 'very_high';
  else if (cpiInflation >= 3 && realIncomeGrowth >= 1) intensity = 'high';
  else if (cpiInflation >= 2 || realIncomeGrowth >= 0.5) intensity = 'medium';
  else intensity = 'low';

  // Calculate taxpayers affected by each threshold
  const taxpayersAboveAllowance = Math.round(totalTaxpayers * Math.min(1, (nominalGrowth * 0.8) / 50));
  const taxpayersAboveBasic = Math.round(totalTaxpayers * Math.min(1, (nominalGrowth * 0.6) / 40));
  const taxpayersAboveHigher = Math.round(totalTaxpayers * Math.min(1, (nominalGrowth * 0.3) / 30));
  const taxpayersAboveAdditional = Math.round(totalTaxpayers * Math.min(1, (nominalGrowth * 0.15) / 20));

  // Additional revenue calculations
  const basicRateRevenue = Math.round(
    taxpayersAboveBasic * basicRateCutoff * (basicRate / 100) * 0.0001
  );

  const higherRateRevenue = Math.round(
    taxpayersAboveHigher * (higherRateCutoff - basicRateCutoff) * (higherRate / 100) * 0.0001
  );

  const additionalRateRevenue = Math.round(
    taxpayersAboveAdditional * (additionalRateCutoff - higherRateCutoff) * (additionalRate / 100) * 0.0001
  );

  const additionalRevenue = basicRateRevenue + higherRateRevenue + additionalRateRevenue;
  const taxpayersAffected = taxpayersAboveBasic + taxpayersAboveHigher + taxpayersAboveAdditional;

  let avgTaxIncrease = 0;
  if (taxpayersAffected > 0) {
    avgTaxIncrease = Math.round(additionalRevenue / taxpayersAffected);
  }

  const baselineTaxRevenue = totalTaxpayers * basicRateCutoff / 100 * (basicRate / 100) * 0.01;
  const effectiveTaxRateChange = Math.round(
    (additionalRevenue / Math.max(1, baselineTaxRevenue)) * 10
  ) / 10;

  const cumulativeFiscalDrag = additionalRevenue;

  return {
    additionalRevenue: Math.round(additionalRevenue),
    taxpayersAffected,
    avgTaxIncrease: Math.max(1, avgTaxIncrease),
    effectiveTaxRateChange,
    intensity,
    thresholdsFrozen: params.personalAllowance === 12_570 && params.basicRateCutoff === 50_270,
    cumulativeFiscalDrag,
  };
}

/** Apply fiscal drag to game state metrics */
export function applyFiscalDragToState(
  state: any,
  params: FiscalDragParameters
): Effects {
  const result = calculateFiscalDrag(params);

  const effects: Effects = {
    budgetBalance: result.additionalRevenue,
    approval: -Math.min(20, Math.abs(result.effectiveTaxRateChange) * 5),
    cpiInflation: result.intensity === 'very_high' ? 0.3 : 0,
    gdpGrowth: -0.1 * Math.min(5, Math.abs(result.effectiveTaxRateChange)),
    publicServices: -0.5,
    partyConfidence: -Math.min(15, Math.abs(result.effectiveTaxRateChange) * 3),
  };

  return effects;
}

/**
 * Get the fiscal drag scenario based on current economic conditions
 * Higher inflation leads to more aggressive bracket creep
 */
export function getFiscalDragScenario(cpiInflation: number, realIncomeGrowth: number): keyof typeof FISCAL_DRAG_SCENARIOS {
  if (cpiInflation >= 4.5) return 'high';
  if (cpiInflation >= 3) return 'freeze';
  if (cpiInflation >= 2) return 'moderate';
  if (realIncomeGrowth >= 2.5) return 'growthBoom';
  return 'moderate';
}