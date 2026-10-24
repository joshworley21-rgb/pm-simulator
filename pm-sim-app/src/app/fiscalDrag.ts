/**
 * Fiscal Drag Module
 * Fiscal drag - inflation-induced tax burden as incomes rise into higher tax brackets
 */

import type { Effects } from './types';

// ===== Fiscal Drag Types =====

/** Fiscal drag types */
export type FiscalDragType = 
  | 'nominal_income_growth'      // Income growth without threshold change
  | 'inflation_drift'           // Bracket creep from inflation
  | 'real_income_growth'        // Genuine real income growth
  | 'tax_threshold_freeze'      // Freezing thresholds while inflation rises
  | 'allowance_reduction';       // Reducing personal allowances

/** Fiscal drag intensity levels */
export type FiscalDragIntensity = 'low' | 'medium' | 'high' | 'very_high';

/** Fiscal drag parameters */
export interface FiscalDragParameters {
  /** Personal allowance (£/year) - standard rate threshold */
  personalAllowance: number;
  /** Basic rate threshold (£/year) */
  basicRateCutoff: number;
  /** Higher rate threshold (£/year) */
  higherRateCutoff: number;
  /** Additional rate threshold (£/year) */
  additionalRateCutoff: number;
  /** Basic rate (%) */
  basicRate: number;
  /** Higher rate (%) */
  higherRate: number;
  /** Additional rate (%) */
  additionalRate: number;
  /** Current CPI inflation (%) */
  cpiInflation: number;
  /** Real income growth (%) after inflation adjustment */
  realIncomeGrowth: number;
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
  /** Cumulative fiscal drag impact over period (£bn) */
  cumulativeImpact: number;
  /** Fiscal drag intensity classification */
  intensity: FiscalDragIntensity;
}

/** Calculate fiscal drag impact for a given year */
export function calculateFiscalDrag(params: FiscalDragParameters): FiscalDragResult {
  const { personalAllowance, basicRateCutoff, higherRateCutoff, additionalRateCutoff,
    basicRate, higherRate, additionalRate, cpiInflation, realIncomeGrowth } = params;

  // Calculate taxable income progression
  const nominalGrowth = realIncomeGrowth + cpiInflation; // nominal income growth
  
  // Fiscal drag intensity assessment
  let intensity: FiscalDragIntensity;
  if (cpiInflation >= 5 && realIncomeGrowth >= 3) intensity = 'very_high';
  else if (cpiInflation >= 3 && realIncomeGrowth >= 1) intensity = 'high';
  else if (cpiInflation >= 2 || realIncomeGrowth >= 0.5) intensity = 'medium';
  else intensity = 'low';

  // Calculate how many taxpayers affected
  // Simplified model: assume income distribution follows typical UK pattern
  const totalTaxpayers = 32_000_000; // Approximate UK taxpayer count
  
  // Percentage pushed above personal allowance
  const allowanceDrift = nominalGrowth * 0.8; // Rough estimate of real-terms drift
  const taxpayersAboveAllowance = Math.round(totalTaxpayers * Math.min(1, allowanceDrift / 50));
  
  // Percentage pushed above basic rate threshold
  const basicRateDrift = nominalGrowth * 0.6;
  const taxpayersAboveBasic = Math.round(totalTaxpayers * Math.min(1, basicRateDrift / 40));
  
  // Percentage pushed above higher rate threshold  
  const higherRateDrift = nominalGrowth * 0.3;
  const taxpayersAboveHigher = Math.round(totalTaxpayers * Math.min(1, higherRateDrift / 30));
  
  // Percentage pushed above additional rate threshold
  const additionalRateDrift = nominalGrowth * 0.15;
  const taxpayersAboveAdditional = Math.round(totalTaxpayers * Math.min(1, additionalRateDrift / 20));
  
  // Additional revenue calculation
  let additionalRevenue = 0;
  
  // Revenue from taxpayers moving into basic rate (basicRate% on income above allowance)
  const basicRateRevenue = Math.round(taxpayersAboveBasic * basicRateCutoff * (basicRate / 100) * 0.1);
  additionalRevenue += basicRateRevenue;
  
  // Revenue from taxpayers moving into higher rate
  const higherRateRevenue = Math.round(taxpayersAboveHigher * (higherRateCutoff - basicRateCutoff) * (higherRate / 100) * 0.1);
  additionalRevenue += higherRateRevenue;
  
  // Revenue from taxpayers moving into additional rate
  const additionalRateRevenue = Math.round(taxpayersAboveAdditional * (additionalRateCutoff - higherRateCutoff) * (additionalRate / 100) * 0.1);
  additionalRevenue += additionalRateRevenue;
  
  // Average tax increase per affected taxpayer
  let avgTaxIncrease = 0;
  if (taxpayersAboveBasic + taxpayersAboveHigher + taxpayersAboveAdditional > 0) {
    avgTaxIncrease = Math.round(additionalRevenue / (taxpayersAboveBasic + taxpayersAboveHigher + taxpayersAboveAdditional));
  }
  
  // Effective tax rate change
  const effectiveTaxRateChange = Math.round((additionalRevenue / (totalTaxpayers * basicRateCutoff / 100)) * 10) / 10;
  
  // Cumulative impact (one year estimate)
  const cumulativeImpact = additionalRevenue;
  
  return {
    additionalRevenue: Math.round(additionalRevenue),
    taxpayersAffected: taxpayersAboveBasic + taxpayersAboveHigher + taxpayersAboveAdditional,
    avgTaxIncrease: Math.max(1, avgTaxIncrease),
    effectiveTaxRateChange,
    cumulativeImpact: Math.round(cumulativeImpact),
    intensity
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

/** Fiscal drag scenario definitions */
export const FISCAL_DRAG_SCENARIOS = {
  moderate_inflation: {
    name: 'Moderate Inflation Drift',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 250_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 2.5,
      realIncomeGrowth: 0.5,
    }
  },
  high_inflation: {
    name: 'High Inflation Drift',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 250_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 5.0,
      realIncomeGrowth: 1.0,
    }
  },
  threshold_freeze: {
    name: 'Threshold Freeze (No Indexation)',
    parameters: {
      personalAllowance: 12_570,  // Frozen at 2022 level
      basicRateCutoff: 50_270,    // Frozen at 2022 level
      higherRateCutoff: 125_140,  // Frozen at 2022 level
      additionalRateCutoff: 250_000, // Frozen at 2022 level
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 3.5,
      realIncomeGrowth: 0, // No real growth, only inflation
    }
  },
  growth_boom: {
    name: 'Strong Real Income Growth',
    parameters: {
      personalAllowance: 12_570,
      basicRateCutoff: 50_270,
      higherRateCutoff: 125_140,
      additionalRateCutoff: 250_000,
      basicRate: 20,
      higherRate: 40,
      additionalRate: 45,
      cpiInflation: 2.0,
      realIncomeGrowth: 3.0,
    }
  }
};

/** Get fiscal drag scenario by name */
export function getFiscalDragScenario(name: keyof typeof FISCAL_DRAG_SCENARIOS): FiscalDragParameters {
  return FISCAL_DRAG_SCENARIOS[name].parameters;
}
