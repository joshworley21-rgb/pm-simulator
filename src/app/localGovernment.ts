import type { Effects } from './types';
import { REGION_COUNCIL_META } from './data';

/**
 * Feature #6 module: Local government & the delivery gap.
 *
 * Adds only what the engine lacked: a live read of council FINANCIAL STRESS per
 * authority, the s114 moment when one fails, and the DELIVERY GAP — announced money
 * that never reaches the front line.
 *
 * Deliberately does NOT re-implement what exists: the council name/city/bloc
 * metadata lives in ./data (REGION_COUNCIL_META) and is consumed here read-only;
 * the social-care and council-tax-precept choices live in the dossiers.
 *
 * INERT INVARIANT: while no authority has issued a s114 notice and the delivery
 * gap sits under DELIVERY_GAP_FLOOR, this module returns NO gameplay effects.
 * A solvent local-government landscape therefore leaves the simulation identical.
 *
 * Magnitudes are capped (see localGovernmentEffects): councils strain, they do not
 * single-handedly fell a government. Learned from the media/devolution spirals.
 */

export interface LocalAuthority {
  id: string;
  name: string;
  regionId: string;
  /** 0..100 financial stress. */
  stress: number;
  /** True once a section 114 notice has been issued. */
  section114: boolean;
}

export interface LocalGovernmentState {
  authorities: LocalAuthority[];
  /** 0..100 share of announced money not yet delivered to the front line. */
  deliveryGap: number;
  /** Week of the last central intervention, or null. */
  lastInterventionWeek: number | null;
}

export const STRESS_START = 20;
export const SECTION_114_STRESS = 85;
export const DELIVERY_GAP_FLOOR = 50;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

export function createDefaultLocalGovernmentState(): LocalGovernmentState {
  const authorities: LocalAuthority[] = [];
  for (const [regionId, meta] of Object.entries(REGION_COUNCIL_META)) {
    for (const name of meta.councils) {
      authorities.push({
        id: `${regionId}:${name}`,
        name,
        regionId,
        stress: STRESS_START,
        section114: false,
      });
    }
  }
  return { authorities, deliveryGap: 20, lastInterventionWeek: null };
}

export interface LocalGovernmentTickInput {
  state: LocalGovernmentState;
  publicServices: number;
  approval: number;
  week: number;
  seed: number;
}

export interface LocalGovernmentTickResult {
  state: LocalGovernmentState;
  effects: Effects;
  log: string[];
}

export function advanceLocalGovernment(input: LocalGovernmentTickInput): LocalGovernmentTickResult {
  // Thin services push councils toward the cliff; a healthy settlement lets them claw back.
  // Slow accrual: councils take years to fail, not months. (The first cut at
  // 0.03 + 0.15 failed every authority inside ~145 weeks and cost Idle 88 weeks.)
  const stressDelta = (60 - input.publicServices) * 0.02 + 0.06;

  const authorities = input.state.authorities.map((a) => {
    const stress = r1(clamp(a.stress + stressDelta, 0, 100));
    return { ...a, stress, section114: a.section114 || stress >= SECTION_114_STRESS };
  });

  // Announced money lags delivery while services are under strain, and lands when they recover.
  const gapDelta = input.publicServices < 50 ? 0.4 : -0.3;
  const deliveryGap = r1(clamp(input.state.deliveryGap + gapDelta, 0, 100));

  const state: LocalGovernmentState = { ...input.state, authorities, deliveryGap };
  const effects = localGovernmentEffects(state);

  const before = input.state.authorities.filter((a) => a.section114).length;
  const after = authorities.filter((a) => a.section114).length;
  const log: string[] =
    after > before
      ? [`LOCAL GOVERNMENT: ${after - before} council(s) issue a section 114 notice.`]
      : [];

  return { state, effects, log };
}

/**
 * Effects implied by council failure and the delivery gap. Empty while every
 * authority is solvent and announced money is landing.
 */
export function localGovernmentEffects(state: LocalGovernmentState): Effects {
  const failed = state.authorities.filter((a) => a.section114).length;
  const gapExcess = Math.max(0, state.deliveryGap - DELIVERY_GAP_FLOOR);
  if (failed === 0 && gapExcess === 0) return {};

  const approvalCost = Math.min(0.04, failed * 0.004);
  const servicesCost = Math.min(0.04, failed * 0.004 + gapExcess * 0.002);

  return {
    approval: -r2(approvalCost),
    publicServices: -r2(servicesCost),
  };
}

/** An emergency grant buys an authority back from the brink. */
export function emergencyGrant(state: LocalGovernmentState, authorityId: string, relief = 30): LocalGovernmentState {
  return {
    ...state,
    lastInterventionWeek: state.lastInterventionWeek,
    authorities: state.authorities.map((a) =>
      a.id === authorityId
        ? { ...a, stress: r1(clamp(a.stress - relief, 0, 100)), section114: false }
        : a,
    ),
  };
}

/** Sending in commissioners clears the notice but leaves the underlying stress. */
export function sendCommissioners(state: LocalGovernmentState, authorityId: string, week: number): LocalGovernmentState {
  return {
    ...state,
    lastInterventionWeek: week,
    authorities: state.authorities.map((a) =>
      a.id === authorityId ? { ...a, section114: false, stress: r1(clamp(a.stress - 5, 0, 100)) } : a,
    ),
  };
}

export function councilsAtRisk(state: LocalGovernmentState): number {
  return state.authorities.filter((a) => a.stress >= SECTION_114_STRESS - 10).length;
}

/**
 * The delivery discount: the fraction of announced spending that never reaches the
 * front line at the current gap. Pure helper for the UI and for future wiring.
 */
export function deliveryDiscount(state: LocalGovernmentState): number {
  return clamp(state.deliveryGap / 100, 0, 1);
}