import type { Minister } from './types';

/**
 * Cabinet-post effects.
 *
 * These read the existing Minister fields (`loyalty`, `competence`) and the
 * existing post strings from politics.ts / the appointment picker. They do not
 * add any new state or meters, and they never alter a minister's stored loyalty
 * or competence, so the general cabinet average is untouched.
 */

export const CHANCELLOR_POST = 'Chancellor of the Exchequer';
export const HEALTH_SECRETARY_POST = 'Health Secretary';

/** Loyalty (%) below which a Chancellor is liable to leak the Budget. */
export const CHANCELLOR_LEAK_LOYALTY_THRESHOLD = 40;
/** Chance of a leak on a fiscal-event week, for a disloyal Chancellor. */
export const BUDGET_LEAK_CHANCE = 0.35;
/** Economic-credibility hit of a leak, in the engine's existing units. */
export const BUDGET_LEAK_GILT_DELTA = 0.1;
export const BUDGET_LEAK_APPROVAL_DELTA = -1;

/** Neutral baseline; below this a minister offers no waiting-list relief. */
export const HEALTH_SECRETARY_QUALITY_FLOOR = 50;
/** Cap on the weekly waiting-list growth (millions/week) a good secretary can offset. */
export const HEALTH_SECRETARY_MAX_RELIEF = 0.04;

/** Competence baseline for Chancellor fiscal management. */
export const CHANCELLOR_COMPETENCE_BASELINE = 65;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Headroom multiplier / bonus based on the Chancellor's competence.
 * Competence above 65 provides market credibility that widens effective OBR
 * headroom (£bn, max +£3bn); incompetence below 65 tightens headroom (max -£3bn).
 */
export function chancellorCredibilityHeadroomDelta(chancellor: Minister | undefined): number {
  if (!chancellor) return -1.5; // Missing Chancellor creates market uncertainty
  const diff = chancellor.competence - CHANCELLOR_COMPETENCE_BASELINE;
  return Math.round((diff / 10) * 10) / 10;
}

/** First holder of a post, preferring a minister from the PM's own party. */
export function findPostHolder(cabinet: Minister[], post: string): Minister | undefined {
  return cabinet.find((m) => m.post === post && !m.coalition) ?? cabinet.find((m) => m.post === post);
}

/** True when a Chancellor's loyalty leaves them liable to leak the Budget. */
export function chancellorLeakRisk(chancellor: Minister | undefined): boolean {
  return !!chancellor && chancellor.loyalty < CHANCELLOR_LEAK_LOYALTY_THRESHOLD;
}

/** True when the leak roll (0..1) fires for this Chancellor. */
export function budgetLeakRolls(chancellor: Minister | undefined, roll: number): boolean {
  return chancellorLeakRisk(chancellor) && roll < BUDGET_LEAK_CHANCE;
}

/**
 * Weekly waiting-list growth (millions) offset by the Health Secretary.
 *
 * "High loyalty or skill" is modelled as the better of the two normalised
 * scores above a neutral floor, capped at HEALTH_SECRETARY_MAX_RELIEF so a
 * strong secretary can only slow growth, never reverse a real crisis.
 */
export function healthSecretaryWaitingRelief(secretary: Minister | undefined): number {
  if (!secretary) return 0;
  const span = 100 - HEALTH_SECRETARY_QUALITY_FLOOR;
  const loyaltyScore = clamp((secretary.loyalty - HEALTH_SECRETARY_QUALITY_FLOOR) / span, 0, 1);
  const skillScore = clamp((secretary.competence - HEALTH_SECRETARY_QUALITY_FLOOR) / span, 0, 1);
  return Math.max(loyaltyScore, skillScore) * HEALTH_SECRETARY_MAX_RELIEF;
}
