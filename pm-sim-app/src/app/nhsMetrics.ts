/**
 * NHS Metrics Module
 * Comprehensive NHS performance and financial tracking for UK policymaking
 */

import type { Effects } from './types';

// ===== NHS Metrics Types =====

/** Detailed NHS performance indicators (in millions) */
export interface NHSMetrics {
  /** A&E waiting time - percentage of patients waiting >4 hours */
  aeWaitingTime: number;        // 0-100 (target: <10% wait >4 hours)
  
  /** Cancer waiting time - days from referral to treatment (target: <62 days) */
  cancerWaitTime: number;       // 0-100 (lower = better)
  
  /** Ambulance response time - percentage meeting 15-minute target */
  ambulanceResponse: number;    // 0-100 (target: >85%)
  
  /** Bed occupancy rate (target: 85-95%) */
  bedOccupancy: number;         // 0-100
  
  /** NHS staff vacancies (% of posts unfilled) */
  staffVacancies: number;       // 0-100
  
  /** Mental health waiting list (thousands) */
  mentalHealthWaitlist: number;  // in thousands
  
  /** Prescription charge exemptions used (millions) - proxy for access */
  prescriptionAccess: number;   // in millions
  
  /** NHS England budget utilization (% of annual budget) */
  budgetUtilization: number;    // 0-100
  
  /** Patient satisfaction score (0-100) */
  patientSatisfaction: number;  // 0-100
}

/** NHS budget categories */
export interface NHSBudgetAllocation {
  /** General hospital services */
  acuteCare: number;            // £bn
  
  /** Community health services */
  communityCare: number;        // £bn
  
  /** Mental health services */
  mentalHealth: number;        // £bn
  
  /** Public health prevention */
  publicHealth: number;        // £bn
  
  /** Digital health & innovation */
  digitalHealth: number;       // £bn
}

/** NHS performance targets */
export const NHS_TARGETS = {
  aeWaitingTime: { target: 10, acceptable: 15, warning: 20 },
  cancerWaitTime: { target: 62, acceptable: 75, warning: 90 }, // days
  ambulanceResponse: { target: 85, acceptable: 80, warning: 75 },
  bedOccupancy: { target: 90, acceptable: 95, warning: 98 },
  staffVacancies: { target: 3, acceptable: 5, warning: 8 },
} as const;

/**
 * Calculate NHS performance rating based on metrics
 */
export function calculateNHSPerformance(metrics: NHSMetrics): number {
  const aeScore = 100 - Math.min(100, metrics.aeWaitingTime);
  const cancerScore = Math.max(0, 100 - ((metrics.cancerWaitTime / 62) * 100));
  const ambulanceScore = metrics.ambulanceResponse;
  const occupancyScore = 100 - Math.abs(90 - metrics.bedOccupancy) * 2;
  const vacancyScore = 100 - (Math.min(100, metrics.staffVacancies) * 5);
  const satisfactionScore = metrics.patientSatisfaction;
  
  return Math.round((aeScore + cancerScore + ambulanceScore + occupancyScore + vacancyScore + satisfactionScore) / 6);
}

/**
 * Get NHS service impact effect based on changes
 */
export function nhsMetricsToEffects(delta: Partial<NHSMetrics>): Effects {
  const effects: Effects = {};
  
  if (delta.aeWaitingTime !== undefined && delta.aeWaitingTime < 0) {
    effects.publicServices = 2;
    effects.approval = 1;
  } else if (delta.aeWaitingTime !== undefined && delta.aeWaitingTime > 0) {
    effects.publicServices = -1;
    effects.approval = -1;
  }
  
  if (delta.cancerWaitTime !== undefined && delta.cancerWaitTime < 0) {
    effects.economy = 1;
  }
  
  if (delta.staffVacancies !== undefined && delta.staffVacancies < 0) {
    effects.fundsDelta = -100; // Staff costs
  }
  
  if (delta.patientSatisfaction !== undefined) {
    effects.approval = delta.patientSatisfaction / 20;
  }
  
  if (delta.budgetUtilization !== undefined) {
    effects.budgetBalance = -delta.budgetUtilization * 2; // Spending effect
  }
  
  return effects;
}
