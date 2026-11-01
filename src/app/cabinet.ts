import type { Minister, Effects } from './types';

/**
 * Feature #2 module: "Cabinet as persons".
 *
 * Adds only what the engine lacked: per-minister TENURE, minister-to-minister
 * RIVALRIES, and a derived COHESION figure for the cabinet as a whole.
 *
 * Deliberately does NOT re-implement anything that already exists:
 *   - sacking costs / Chancellor leaks / Health Secretary relief live in ./cabinetEffects
 *   - 1922 mood and leadership challenges live in ./leadershipChallenge
 *   - weekly resignations from faction unrest already fire in engine.ts
 *
 * INERT INVARIANT: while `cohesion >= CABINET_COHESION_FLOOR` this module returns
 * NO gameplay effects. A default cabinet therefore leaves the simulation identical,
 * which keeps the 135 engine checks green.
 */

export interface CabinetRivalry {
  a: string;
  b: string;
  /** 0..100; decays when the pair stops qualifying and is dropped at 0. */
  intensity: number;
}

export interface CabinetState {
  /** 0..100 cabinet collective cohesion. */
  cohesion: number;
  /** minister name -> weeks served in the current post. */
  tenure: Record<string, number>;
  rivalries: CabinetRivalry[];
  /** minister name -> 0..100 pressure toward resignation. */
  resignationPressure: Record<string, number>;
}

export const CABINET_COHESION_FLOOR = 40;

const DEFAULT_COHESION = 65;
const RIVALRY_TENURE_MIN = 8;
const RIVALRY_AMBITION_MIN = 70;
const LONG_TENURE_WEEKS = 40;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Factions that sit opposite one another inside the party. */
const OPPOSED: Record<string, string[]> = {
  Left: ['Centrist', 'Right'],
  'Soft Left': ['Right'],
  Centrist: ['Left'],
  Right: ['Left', 'Soft Left'],
};

function opposed(a: string, b: string): boolean {
  return (OPPOSED[a] ?? []).includes(b) || (OPPOSED[b] ?? []).includes(a);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Deterministic 0..1 draw keyed on (seed, week). Never consumes the engine seed. */
function draw(seed: number, week: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (week >>> 0), 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 0x100000000;
}

export function createDefaultCabinetState(): CabinetState {
  return {
    cohesion: DEFAULT_COHESION,
    tenure: {},
    rivalries: [],
    resignationPressure: {},
  };
}

export interface CabinetTickInput {
  cabinet: Minister[];
  state: CabinetState;
  factionUnrest: number;
  partyConfidence: number;
  week: number;
  seed: number;
}

export interface CabinetTickResult {
  state: CabinetState;
  effects: Effects;
  log: string[];
}

export function advanceCabinet(input: CabinetTickInput): CabinetTickResult {
  const tenure: Record<string, number> = { ...input.state.tenure };
  const resignationPressure: Record<string, number> = { ...input.state.resignationPressure };
  const present = new Set(input.cabinet.map((m) => m.name));

  // 1. Tenure accrues for everyone still in post; departed ministers are forgotten.
  for (const minister of input.cabinet) {
    tenure[minister.name] = (tenure[minister.name] ?? 0) + 1;
  }
  for (const key of Object.keys(tenure)) {
    if (!present.has(key)) delete tenure[key];
  }
  for (const key of Object.keys(resignationPressure)) {
    if (!present.has(key)) delete resignationPressure[key];
  }

  // 2. Rivalries form between opposed-faction ministers who are both ambitious
  //    and both long enough in post; they heat up while those terms hold and
  //    cool to nothing otherwise.
  const rivalries: CabinetRivalry[] = input.state.rivalries.map((r) => ({ ...r }));
  const findRivalry = (a: string, b: string): CabinetRivalry | undefined =>
    rivalries.find((r) => pairKey(r.a, r.b) === pairKey(a, b));

  for (let i = 0; i < input.cabinet.length; i += 1) {
    for (let j = i + 1; j < input.cabinet.length; j += 1) {
      const x = input.cabinet[i];
      const y = input.cabinet[j];
      if (!opposed(x.faction, y.faction)) continue;

      const ax = x.ambition ?? 50;
      const ay = y.ambition ?? 50;
      const eligible =
        ax >= RIVALRY_AMBITION_MIN &&
        ay >= RIVALRY_AMBITION_MIN &&
        (tenure[x.name] ?? 0) >= RIVALRY_TENURE_MIN &&
        (tenure[y.name] ?? 0) >= RIVALRY_TENURE_MIN;

      const existing = findRivalry(x.name, y.name);
      if (!existing && eligible) {
        rivalries.push({
          a: x.name,
          b: y.name,
          intensity: r2(clamp(10 + (ax + ay) / 10, 0, 100)),
        });
      } else if (existing) {
        existing.intensity = r2(clamp(existing.intensity + (eligible ? 0.5 : -2), 0, 100));
      }
    }
  }
  const liveRivalries = rivalries.filter((r) => r.intensity > 0);

  // 3. Long service breeds restlessness in the ambitious; loyalty is the brake.
  for (const minister of input.cabinet) {
    const served = tenure[minister.name] ?? 0;
    const ambition = minister.ambition ?? 50;
    const restless = served >= LONG_TENURE_WEEKS && ambition >= 60;
    const delta = (restless ? 0.5 : -0.25) - (minister.loyalty - 50) / 250;
    resignationPressure[minister.name] = r2(
      clamp((resignationPressure[minister.name] ?? 0) + delta, 0, 100),
    );
  }

  // 4. Cohesion is pulled by loyalty spread, rivalry heat and faction unrest.
  const loyalties = input.cabinet.map((m) => m.loyalty);
  const spread = loyalties.length > 1 ? Math.max(...loyalties) - Math.min(...loyalties) : 0;
  const rivalryHeat = liveRivalries.reduce((sum, r) => sum + r.intensity, 0);
  const target = clamp(
    78 - spread * 0.5 - rivalryHeat * 0.25 - (input.factionUnrest - 20) * 0.3,
    0,
    100,
  );
  const cohesion = r2(clamp(input.state.cohesion + (target - input.state.cohesion) * 0.15, 0, 100));

  const state: CabinetState = { cohesion, tenure, rivalries: liveRivalries, resignationPressure };
  const effects = cohesionEffects(state);

  // Log once, at the moment cohesion actually breaks: a silent cabinet is the norm.
  const log: string[] =
    Object.keys(effects).length > 0 && input.state.cohesion >= CABINET_COHESION_FLOOR
      ? ['CABINET: cohesion has broken down; ministers are briefing against one another.']
      : [];

  void draw; // reserved for future stochastic rivalry escalation

  return { state, effects, log };
}

/**
 * Gameplay effects implied by cabinet cohesion. Empty while cohesion is healthy,
 * which is what keeps a default cabinet inert.
 */
export function cohesionEffects(state: CabinetState): Effects {
  if (state.cohesion >= CABINET_COHESION_FLOOR) return {};
  const shortfall = CABINET_COHESION_FLOOR - state.cohesion;
  return {
    partyConfidence: -r2(shortfall * 0.1),
    approval: -r2(shortfall * 0.05),
  };
}

export function estimateResignationRisk(state: CabinetState, ministerName: string): number {
  return clamp((state.resignationPressure[ministerName] ?? 0) / 100, 0, 1);
}

/** A promotion hands a minister a fresh post: tenure and pressure reset. */
export function applyPromotion(state: CabinetState, ministerName: string, week: number): CabinetState {
  void week;
  return {
    ...state,
    tenure: { ...state.tenure, [ministerName]: 0 },
    resignationPressure: { ...state.resignationPressure, [ministerName]: 0 },
  };
}

/** A departure forgets the minister's tenure, pressure and any rivalry naming them. */
export function applyRemoval(state: CabinetState, ministerName: string): CabinetState {
  const tenure = { ...state.tenure };
  const resignationPressure = { ...state.resignationPressure };
  delete tenure[ministerName];
  delete resignationPressure[ministerName];
  return {
    ...state,
    tenure,
    resignationPressure,
    rivalries: state.rivalries.filter((r) => r.a !== ministerName && r.b !== ministerName),
  };
}