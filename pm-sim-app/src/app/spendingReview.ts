/**
 * Spending Review Module
 * Multi-year spending planning, capital/resource allocation, and fiscal frameworks
 */
import type { Effects, Department } from './types';

/** Spending review cycle (SR) */
export type SpendingReviewCycle = 
  | 'sr2021'    // Spending Review 2021
  | 'sr2022'    // Spending Review 2022
  | 'sr2023'    // Spending Review 2023
  | 'sr2024'    // Spending Review 2024 (current)
  | 'sr2025'    // Spending Review 2025
  | 'sr2026'    // Spending Review 2026
  | 'future';   // Future planning cycles

/** Spending review phase */
export type SpendingReviewPhase = 'planning' | 'consultation' | 'consultation' | 'approval' | 'implementation' | 'monitoring';

/** Budget allocation types */
export type BudgetAllocationType = 
  | 'capital'      // Capital expenditure (infrastructure, assets)
  | 'resource'     // Resource expenditure (day-to-day operations)
  | 'annuity';     // Long-term contractual commitments

/** Efficiency target categories */
export type EfficiencyTarget = 
  | 'productivity'      // Productivity improvements
  | 'eliminate_waste'   // Eliminate wasteful spending
  | 'digital_transformation' // Digital efficiency gains
  | 'procurement'       // Better procurement deals
  | 'estate_consolidation'; // Property estate optimization

/** Spending review department allocation */
export interface SpendingReviewDepartment {
  department: Department;
  /** Capital spending (£bn) */
  capital: number;
  /** Resource spending (£bn) */
  resource: number;
  /** Annuity commitments (£bn) */
  annuity: number;
  /** Efficiency savings target (£bn) */
  efficiencyTargets: number;
  /** Year-over-year change (%) */
  yoyChange: number;
  /** Priority level (1 = highest) */
  priority: number;
  /** Multi-year commitment period */
  commitmentYears: number;
  /** Departmental efficiency target type */
  efficiencyType: EfficiencyTarget[];
  /** Departmental outcomes tracked */
  outcomes: string[];
}

/** Spending review summary */
export interface SpendingReview {
  /** Review cycle identifier */
  cycle: SpendingReviewCycle;
  /** Phase in the review process */
  phase: SpendingReviewPhase;
  /** Year the review starts */
  startYear: number;
  /** Multi-year period (years) */
  period: number;
  /** Total capital spending envelope (£bn) */
  totalCapital: number;
  /** Total resource spending envelope (£bn) */
  totalResource: number;
  /** Total annuity commitments (£bn) */
  totalAnnuity: number;
  /** Total efficiency savings target (£bn) */
  totalEfficiency: number;
  /** Debt interest limit (% of GDP) */
  debtInterestCeiling: number;
  /** Current debt interest (£bn) */
  currentDebtInterest: number;
  /** Wyeing borrowing (£bn) - planned deficit */
  plannedBorrowing: number;
  /** Headroom buffer (£bn) - contingency */
  headroomBuffer: number;
  /** Departmental allocations */
  departmentalAllocations: SpendingReviewDepartment[];
  /** Multi-year spending projections */
  projections: SpendingProjection[];
  /** Last update turn */
  lastUpdatedTurn: number;
}

/** Annual spending projection */
export interface SpendingProjection {
  year: number;
  totalSpend: number;
  capitalSpend: number;
  resourceSpend: number;
  debtInterest: number;
  borrowing: number;
  publicSectorPay: number;
  welfareSpend: number;
  netTaxRevenue: number;
  netDebtGDP: number;
}

/** Default spending review configuration */
export const DEFAULT_SPENDING_REVIEW: SpendingReview = {
  cycle: 'sr2024',
  phase: 'implementation',
  startYear: 2024,
  period: 3,
  totalCapital: 115,
  totalResource: 410,
  totalAnnuity: 85,
  totalEfficiency: 25,
  debtInterestCeiling: 4,
  currentDebtInterest: 120,
  plannedBorrowing: 140,
  headroomBuffer: 30,
  departmentalAllocations: [
    {
      department: 'HM Treasury',
      capital: 1,
      resource: 3,
      annuity: 2,
      efficiencyTargets: 0,
      yoyChange: 3,
      priority: 1,
      commitmentYears: 3,
      efficiencyType: ['procurement', 'estate_consolidation'],
      outcomes: ['fiscal_balance', 'debt_management']
    },
    {
      department: 'DHSC (Health)',
      capital: 14,
      resource: 175,
      annuity: 28,
      efficiencyTargets: 5,
      yoyChange: 0,
      priority: 1,
      commitmentYears: 3,
      efficiencyType: ['digital_transformation', 'procurement'],
      outcomes: ['nhs_waiting_times', 'patient_satisfaction', 'health_outcomes']
    },
    {
      department: 'Ministry of Defence',
      capital: 12,
      resource: 52,
      annuity: 18,
      efficiencyTargets: 3,
      yoyChange: 2,
      priority: 2,
      commitmentYears: 3,
      efficiencyType: ['eliminate_waste', 'procurement'],
      outcomes: ['defence_capability', 'equipment_readiness']
    },
    {
      department: 'Foreign Office',
      capital: 0,
      resource: 3,
      annuity: 1,
      efficiencyTargets: 0,
      yoyChange: 5,
      priority: 4,
      commitmentYears: 3,
      efficiencyType: ['estate_consolidation'],
      outcomes: ['diplomatic_influence', 'trade_relations']
    },
    {
      department: 'Energy & Net Zero',
      capital: 36,
      resource: 6,
      annuity: 12,
      efficiencyTargets: 2,
      yoyChange: 0,
      priority: 1,
      commitmentYears: 3,
      efficiencyType: ['digital_transformation', 'procurement'],
      outcomes: ['energy_security', 'net_zero_progress']
    },
  ],
  projections: [
    { year: 2024, totalSpend: 530, capitalSpend: 115, resourceSpend: 410, debtInterest: 120, borrowing: 140, publicSectorPay: 180, welfareSpend: 240, netTaxRevenue: 1100, netDebtGDP: 98 },
    { year: 2025, totalSpend: 545, capitalSpend: 122, resourceSpend: 418, debtInterest: 135, borrowing: 125, publicSectorPay: 185, welfareSpend: 250, netTaxRevenue: 1130, netDebtGDP: 101 },
    { year: 2026, totalSpend: 560, capitalSpend: 130, resourceSpend: 425, debtInterest: 142, borrowing: 110, publicSectorPay: 190, welfareSpend: 255, netTaxRevenue: 1155, netDebtGDP: 104 },
  ],
  lastUpdatedTurn: 1
};

/** Spending review effects on game state */
export const SPENDING_REVIEW_EFFECTS: Record<Department, Effects> = {
  'Number 10': { approval: 0, partyConfidence: 0 },
  'HM Treasury': { budgetBalance: 15, debtToGdp: -0.5 },
  'Home Office': { publicServices: -2, security: -1 },
  'DHSC (Health)': { publicServices: 4, nhsWaitingList: -0.3, approval: 2 },
  'Foreign Office': { economy: 1, publicServices: 0 },
  'Ministry of Defence': { security: 2, approval: 1 },
  'Energy & Net Zero': { economy: 2, publicServices: 1 },
};

/** Calculate spending review impact on specific department */
export function calculateSpendingReviewImpact(
  review: SpendingReview,
  department: Department,
  budgetChange: number
): Effects {
  const deptAllocation = review.departmentalAllocations.find(d => d.department === department);
  if (!deptAllocation) return {};
  
  const effects: Effects = {};
  const yoyRatio = deptAllocation.yoyChange / 100;
  
  // Capital spending affects economy and public services
  if (budgetChange > 0 && deptAllocation.capital > 0) {
    if (department === 'DHSC (Health)') {
      (effects.publicServices) = (effects.publicServices ?? 0) + Math.round(budgetChange * 0.3);
      (effects.nhsWaitingList) = (effects.nhsWaitingList ?? 0) - Math.round(budgetChange * 0.02);
      (effects.approval) = (effects.approval ?? 0) + Math.round(budgetChange * 0.15);
    } else if (department === 'Energy & Net Zero') {
      (effects.economy) = (effects.economy ?? 0) + Math.round(budgetChange * 0.4);
      (effects.publicServices) = (effects.publicServices ?? 0) + Math.round(budgetChange * 0.2);
    } else if (department === 'Ministry of Defence') {
      (effects.security) = (effects.security ?? 0) + Math.round(budgetChange * 0.5);
    } else if (department === 'Home Office') {
      (effects.security) = (effects.security ?? 0) + Math.round(budgetChange * 0.4);
    }
  }
  
  // Efficiency targets reduce resource spending pressure
  if (budgetChange < 0) {
    const efficiency = deptAllocation.efficiencyTargets || 0;
    const saved = Math.min(efficiency, Math.abs(budgetChange));
    effects.budgetBalance = (effects.budgetBalance ?? 0) + Math.round(saved * 0.8);
  }
  
  // Budget impact on fiscal balance
  effects.budgetBalance = (effects.budgetBalance ?? 0) - budgetChange;
  
  return effects;
}

/** Get department spending priority ranking */
export function rankDepartmentSpending(review: SpendingReview): SpendingReviewDepartment[] {
  return [...review.departmentalAllocations].sort((a, b) => a.priority - b.priority);
}

/** Calculate total spending against fiscal limits */
export function checkFiscalLimits(review: SpendingReview): { exceedsCapital: boolean; exceedsResource: boolean; exceedsAnnuity: boolean; headroom: number } {
  const totalCapital = review.departmentalAllocations.reduce((sum, d) => sum + d.capital, 0);
  const totalResource = review.departmentalAllocations.reduce((sum, d) => sum + d.resource, 0);
  const totalAnnuity = review.departmentalAllocations.reduce((sum, d) => sum + d.annuity, 0);
  const totalSpend = totalCapital + totalResource + totalAnnuity;
  const headroom = review.headroomBuffer + review.plannedBorrowing - totalSpend;
  
  return {
    exceedsCapital: totalCapital > review.totalCapital,
    exceedsResource: totalResource > review.totalResource,
    exceedsAnnuity: totalAnnuity > review.totalAnnuity,
    headroom: Math.round(headroom)
  };
}
