import type { Effects } from './types';

/**
 * Feature #4 module: Devolution & the Union.
 *
 * Adds only what the engine lacked: a per-nation reading of how the devolved
 * administrations feel about Westminster (satisfaction), how strong the pull for
 * further devolution or independence is (pressure), the Sewel consent grievance,
 * and Barnett consequentials as a pure helper.
 *
 * Deliberately does NOT re-implement what exists: the `scotland`/`wales`/`ni`
 * regions, their seat counts and support live in ./data, and the devolution /
 * Section 30 PMQs already live in ./pmqData.
 *
 * INERT INVARIANT: while no nation is past the pressure floor and none is below
 * the satisfaction floor, this module returns NO gameplay effects.
 *
 * Magnitudes are deliberately small and capped (see devolutionEffects): the
 * Union should strain under neglect, not snap inside a single term.
 */

export type NationId = 'scotland' | 'wales' | 'ni';

export interface NationDevolution {
  /** Largest party in that nation's region (from REGIONS support). */
  administrationPartyId: string;
  /** 0..100 satisfaction with the UK government. */
  satisfaction: number;
  /** 0..100 pull toward further devolution or independence. */
  independencePressure: number;
  /** Times Westminster has legislated in a devolved area without consent. */
  sewelDenials: number;
}

export interface DevolutionState {
  nations: Record<NationId, NationDevolution>;
}

export const NATIONS: { id: NationId; name: string; barnettWeight: number }[] = [
  { id: 'scotland', name: 'Scotland', barnettWeight: 0.0965 },
  { id: 'wales', name: 'Wales', barnettWeight: 0.0582 },
  { id: 'ni', name: 'Northern Ireland', barnettWeight: 0.0355 },
];

export const DEVOLUTION_PRESSURE_FLOOR = 60;
export const DEVOLUTION_SATISFACTION_FLOOR = 25;
/** Pressure added each time Westminster denies/ignores Sewel consent. */
export const SEWEL_DENIAL_PRESSURE = 8;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

export function createDefaultDevolutionState(): DevolutionState {
  return {
    nations: {
      scotland: {
        administrationPartyId: 'reform',
        satisfaction: 50,
        independencePressure: 30,
        sewelDenials: 0,
      },
      wales: {
        administrationPartyId: 'reform',
        satisfaction: 50,
        independencePressure: 20,
        sewelDenials: 0,
      },
      ni: {
        administrationPartyId: 'conservative',
        satisfaction: 50,
        independencePressure: 35,
        sewelDenials: 0,
      },
    },
  };
}

export interface DevolutionTickInput {
  state: DevolutionState;
  approval: number;
  publicServices: number;
  week: number;
  seed: number;
}

export interface DevolutionTickResult {
  state: DevolutionState;
  effects: Effects;
  log: string[];
}

export function advanceDevolution(input: DevolutionTickInput): DevolutionTickResult {
  const nations: Record<NationId, NationDevolution> = { ...input.state.nations };
  const log: string[] = [];

  // Devolution reads the same public-service and popularity signals as the rest.
  const target = clamp(50 + (input.publicServices - 50) * 0.5 + (input.approval - 50) * 0.4, 0, 100);

  for (const nation of NATIONS) {
    const current = nations[nation.id];
    const satisfaction = r1(clamp(current.satisfaction + (target - current.satisfaction) * 0.15, 0, 100));

    // Grievance grows where satisfaction is poor and cools where it is good.
    const pressureDelta = satisfaction < 40 ? 0.4 : satisfaction > 60 ? -0.4 : 0;
    const independencePressure = r1(clamp(current.independencePressure + pressureDelta, 0, 100));

    if (independencePressure >= DEVOLUTION_PRESSURE_FLOOR && current.independencePressure < DEVOLUTION_PRESSURE_FLOOR) {
      log.push(`DEVOLUTION: support for independence is rising in ${nation.name}.`);
    }

    nations[nation.id] = { ...current, satisfaction, independencePressure };
  }

  const state: DevolutionState = { nations };
  return { state, effects: devolutionEffects(state), log };
}

/**
 * Gameplay effects implied by the state of the Union. Empty while no nation is
 * past the pressure floor and none is miserable — which keeps a settled Union inert.
 */
export function devolutionEffects(state: DevolutionState): Effects {
  let pressureExcess = 0;
  let satisfactionDeficit = 0;
  for (const nation of NATIONS) {
    const n = state.nations[nation.id];
    pressureExcess += Math.max(0, n.independencePressure - DEVOLUTION_PRESSURE_FLOOR);
    satisfactionDeficit += Math.max(0, DEVOLUTION_SATISFACTION_FLOOR - n.satisfaction);
  }
  if (pressureExcess === 0 && satisfactionDeficit === 0) return {};

  // Deliberately gentle and capped at 0.12 approval/turn: the Union strains, it
  // does not snap in a single term. Halved from 0.25 after the fuzzer gate showed a
  // -54 week Idle penalty, too aggressive once stacked on the media drag.
  const approvalCost = Math.min(0.12, pressureExcess * 0.002 + satisfactionDeficit * 0.002);
  return {
    approval: -r2(approvalCost),
    mediaAttention: r2(approvalCost * 0.6),
  };
}

/** Barnett consequentials: the devolved share of an England-only spending change. */
export function barnettConsequentials(englandSpendDelta: number, nation: NationId): number {
  const weight = NATIONS.find((n) => n.id === nation)?.barnettWeight ?? 0;
  return r2(englandSpendDelta * weight);
}

export function independenceRisk(state: DevolutionState, nation: NationId): number {
  return clamp(state.nations[nation].independencePressure / 100, 0, 1);
}

/** Westminster legislating in a devolved area without consent: the Sewel grievance. */
export function denySewelConsent(state: DevolutionState, nation: NationId): DevolutionState {
  const current = state.nations[nation];
  return {
    ...state,
    nations: {
      ...state.nations,
      [nation]: {
        ...current,
        sewelDenials: current.sewelDenials + 1,
        independencePressure: r1(clamp(current.independencePressure + SEWEL_DENIAL_PRESSURE, 0, 100)),
      },
    },
  };
}