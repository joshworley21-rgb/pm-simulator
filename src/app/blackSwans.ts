import type { Effects } from './types';

/**
 * Feature #9 module: Black swans — authored shock decision trees.
 *
 * Adds only what the engine lacked: a small CATALOGUE of authored, high-impact shocks,
 * each with bespoke responses, plus a running "was the PM in command?" reading.
 *
 * Deliberately does NOT re-implement what exists: the ordinary rolling crisis lives in
 * the Red Box dossiers (./data, ./dossiers2, ./dossiers3) with their own escalation.
 *
 * INERT INVARIANT (strict — this is what protects the Idle cap):
 *   the weekly tick NEVER returns effects. A shock that is simply left unanswered
 *   expires NEUTRALLY: nothing happens, it is recorded as `missed`, and the world moves
 *   on. Effects fire ONLY when a response is explicitly chosen (resolveBlackSwan).
 *   A passive premiership therefore cannot be dragged below the 315-week Idle floor by
 *   this module, by construction rather than by tuning.
 *
 * Frequency is deliberately sparse: one shock per session at most.
 */

export type SwanKind = 'natural' | 'security' | 'economic' | 'infrastructure' | 'health';

export interface SwanOption {
  id: string;
  label: string;
  effects: Effects;
  /** 0..100: how decisively and competently this reads as command. */
  commandScore: number;
}

export interface SwanEvent {
  id: string;
  name: string;
  kind: SwanKind;
  brief: string;
  options: SwanOption[];
}

export interface BlackSwanState {
  /** The live shock, if any. */
  active: { eventId: string; openedWeek: number; weeksRemaining: number } | null;
  /** Week the next shock is scheduled to land. */
  nextSwanWeek: number;
  /** Shocks answered. */
  resolved: number;
  /** Shocks left to expire unanswered — recorded, never punished. */
  missed: number;
  /** Running 0..100 reading of command quality across answered shocks. */
  commandScore: number;
}

export const SWAN_FIRST_WEEK = 26;
export const SWAN_INTERVAL_WEEKS = 52;
export const SWAN_WINDOW_WEEKS = 4;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * The authored catalogue. Every entry offers a decisive response, a proportionate one,
 * and a dithering one — the last scoring poorly on command.
 */
export const BLACK_SWAN_CATALOGUE: SwanEvent[] = [
  {
    id: 'swan-floods',
    name: 'Once-in-a-century flooding',
    kind: 'natural',
    brief:
      'Two rivers have burst their banks overnight. Entire towns are under water, the Army is on standby and the Environment Agency says the defences were underfunded.',
    options: [
      {
        id: 'floods-cobra',
        label: 'Convene COBR within the hour and deploy the Army',
        effects: { approval: 2, publicServices: 2, security: 1, budgetBalance: -3 },
        commandScore: 85,
      },
      {
        id: 'floods-fund',
        label: 'Announce an emergency relief fund and visit the worst-hit town',
        effects: { approval: 1, publicServices: 1, budgetBalance: -1 },
        commandScore: 60,
      },
      {
        id: 'floods-defer',
        label: 'Wait for a full assessment before committing resources',
        effects: { approval: -2, publicServices: -2 },
        commandScore: 15,
      },
    ],
  },
  {
    id: 'swan-cyberattack',
    name: 'Ransomware strike on the NHS',
    kind: 'health',
    brief:
      'A ransomware attack has locked NHS trusts out of patient records. Ambulances are being diverted and surgeons are working from paper.',
    options: [
      {
        id: 'cyber-national',
        label: 'Declare a national cyber incident and trigger emergency powers',
        effects: { approval: 1, publicServices: 2, security: 3, budgetBalance: -2 },
        commandScore: 80,
      },
      {
        id: 'cyber-pay',
        label: 'Quietly sanction a ransom payment to restore systems',
        effects: { approval: -2, security: -3, publicServices: 1 },
        commandScore: 25,
      },
      {
        id: 'cyber-nothing',
        label: 'Let trusts handle it locally and avoid nationalising the failure',
        effects: { approval: -2, publicServices: -3 },
        commandScore: 10,
      },
    ],
  },
  {
    id: 'swan-energy',
    name: 'Global energy price spike',
    kind: 'economic',
    brief:
      'A supplier nation has cut exports. Wholesale gas has trebled in a fortnight and energy firms are asking for a bailout before the winter.',
    options: [
      {
        id: 'energy-cap',
        label: 'Impose an emergency price cap and fund it from general taxation',
        effects: { approval: 3, economy: -1, cpiInflation: -0.4, budgetBalance: -6 },
        commandScore: 75,
      },
      {
        id: 'energy-targeted',
        label: 'Target relief at the poorest households only',
        effects: { approval: 1, cpiInflation: -0.2, budgetBalance: -2 },
        commandScore: 65,
      },
      {
        id: 'energy-market',
        label: 'Let the market clear and urge suppliers to show restraint',
        effects: { approval: -3, cpiInflation: 0.3, economy: 1 },
        commandScore: 20,
      },
    ],
  },
  {
    id: 'swan-attack',
    name: 'Terror attack on a transport hub',
    kind: 'security',
    brief:
      'An attack at a major station has killed commuters in the rush hour. The threat level is under review and the capital is in shock.',
    options: [
      {
        id: 'attack-raise',
        label: 'Raise the threat level and make a statement from Downing Street',
        effects: { approval: 2, security: 3, mediaAttention: 6 },
        commandScore: 80,
      },
      {
        id: 'attack-visit',
        label: 'Visit the scene with emergency services and hold a vigil',
        effects: { approval: 1, security: 1, mediaAttention: 4 },
        commandScore: 60,
      },
      {
        id: 'attack-silent',
        label: 'Say nothing until the police have a complete picture',
        effects: { approval: -3, security: -2, mediaAttention: 8 },
        commandScore: 15,
      },
    ],
  },
  {
    id: 'swan-pandemic',
    name: 'Novel respiratory outbreak',
    kind: 'health',
    brief:
      'A novel respiratory virus is spreading in care homes. Advisers disagree sharply on whether to act now or wait for more data.',
    options: [
      {
        id: 'pandemic-act',
        label: 'Act early: surge testing, restrict care-home visits, buy vaccine options',
        effects: { approval: 1, publicServices: 3, economy: -2, budgetBalance: -5 },
        commandScore: 85,
      },
      {
        id: 'pandemic-wait',
        label: 'Wait for the data while quietly stockpiling supplies',
        effects: { approval: -1, publicServices: -1, budgetBalance: -1 },
        commandScore: 40,
      },
      {
        id: 'pandemic-dismiss',
        label: 'Play it down publicly and rely on the existing flu plan',
        effects: { approval: -4, publicServices: -4, nhsWaitingList: 0.6 },
        commandScore: 5,
      },
    ],
  },
];

export function createDefaultBlackSwanState(): BlackSwanState {
  return {
    active: null,
    nextSwanWeek: SWAN_FIRST_WEEK,
    resolved: 0,
    missed: 0,
    commandScore: 50,
  };
}

export interface BlackSwanTickInput {
  state: BlackSwanState;
  week: number;
  seed: number;
}

export interface BlackSwanTickResult {
  state: BlackSwanState;
  effects: Effects;
  log: string[];
}

/**
 * Weekly bookkeeping only: schedule a shock, expire an unanswered one neutrally.
 * Returns no effects, ever.
 */
export function advanceBlackSwans(input: BlackSwanTickInput): BlackSwanTickResult {
  let active = input.state.active;
  let nextSwanWeek = input.state.nextSwanWeek;
  let missed = input.state.missed;
  const log: string[] = [];

  if (active) {
    const weeksRemaining = active.weeksRemaining - 1;
    if (weeksRemaining <= 0) {
      // The passive path: the moment passes unanswered. Neutral by design, but recorded.
      active = null;
      missed += 1;
      log.push('BLACK SWAN: the window to respond closed; the moment passed unanswered.');
    } else {
      active = { ...active, weeksRemaining };
    }
  } else if (input.week >= nextSwanWeek) {
    const index = Math.abs(Math.floor(input.seed)) % BLACK_SWAN_CATALOGUE.length;
    const event = BLACK_SWAN_CATALOGUE[index];
    active = { eventId: event.id, openedWeek: input.week, weeksRemaining: SWAN_WINDOW_WEEKS };
    nextSwanWeek = input.week + SWAN_INTERVAL_WEEKS;
    log.push(`BLACK SWAN: ${event.name}.`);
  }

  const state: BlackSwanState = { ...input.state, active, nextSwanWeek, missed };
  return { state, effects: {}, log };
}

/** The event behind the live shock, if any. */
export function activeSwanEvent(state: BlackSwanState): SwanEvent | undefined {
  if (!state.active) return undefined;
  return BLACK_SWAN_CATALOGUE.find((e) => e.id === state.active!.eventId);
}

/**
 * Answer a shock. This is the only path that produces effects; the command reading
 * moves toward the chosen response's score.
 */
export function resolveBlackSwan(
  state: BlackSwanState,
  optionId: string,
): { state: BlackSwanState; effects: Effects } {
  const event = activeSwanEvent(state);
  if (!event) return { state, effects: {} };
  const option = event.options.find((o) => o.id === optionId);
  if (!option) return { state, effects: {} };

  const commandScore = r1((state.commandScore + option.commandScore) / 2);
  return {
    state: { ...state, active: null, resolved: state.resolved + 1, commandScore },
    effects: option.effects,
  };
}

/** 0..100 reading of how in-command the premiership has looked. */
export function commandReading(state: BlackSwanState): number {
  return clamp(state.commandScore, 0, 100);
}