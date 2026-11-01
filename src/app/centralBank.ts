import type { Effects } from './types';
import { TURNS_PER_QUARTER } from './calendar';

/**
 * Feature #10 module: the independent central bank.
 *
 * This REPLACES the hard-coded MPC block that used to live in engine.ts. It adds what
 * that rule could not express: a stored Bank Rate, an INDEPENDENCE/credibility reading,
 * recorded government PRESSURE on the Bank, and a committee balance of hawks and doves.
 *
 * DEFAULT PARITY (the contract that protects the Idle cap):
 *   at `createDefaultCentralBankState()` — hawkishness 0, credibility 70, no pressure —
 *   the quarterly vote reproduces the old rule EXACTLY:
 *     cpi > 4.5                          => hike { cpi -0.2, gdp -0.1, gilt +0.1 }
 *     cpi < 2.0 && gdp < 1.0             => cut  { gdp +0.1, gilt -0.1 }
 *     otherwise                          => hold { }
 *   and credibilityPremium() is 0. So a passive premiership is bit-identical to before,
 *   which is what keeps the Idle archetype pinned at its 315-week floor. Everything new
 *   is reachable only through explicit actions (leaning on the Bank, stacking the MPC).
 */

export type MpcDecision = 'hike' | 'cut' | 'hold';
export type MpcAppointment = 'hawk' | 'dove';

export interface CentralBankState {
  /** Stored policy rate (%). */
  bankRate: number;
  /** 0..100 perceived independence of the Bank. */
  credibility: number;
  /** Times the government has leant on the Bank this term. */
  pressure: number;
  /** Committee balance: positive = hawks stacked, negative = doves stacked. */
  hawkishness: number;
  /** Week of the last quarterly review, or null. */
  lastReviewWeek: number | null;
}

export const BANK_RATE_START = 4.15;
export const INDEPENDENCE_CREDIBILITY_START = 70;
/** Below this the market starts charging a credibility risk premium. */
export const CREDIBILITY_PREMIUM_FLOOR = 60;
export const HAWK_HIKE_THRESHOLD = 4.5;
export const DOVE_CUT_THRESHOLD = 2.0;
export const DOVE_GDP_CUT_THRESHOLD = 1.0;
export const RATE_STEP = 0.25;
/** Credibility lost each time the government leans on the Bank. */
export const PRESSURE_CREDIBILITY_COST = 8;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function createDefaultCentralBankState(): CentralBankState {
  return {
    bankRate: BANK_RATE_START,
    credibility: INDEPENDENCE_CREDIBILITY_START,
    pressure: 0,
    hawkishness: 0,
    lastReviewWeek: null,
  };
}

/** The quarterly review falls on quarter boundaries. */
export function rateReviewDue(week: number): boolean {
  return week % TURNS_PER_QUARTER === 0;
}

export interface CentralBankTickInput {
  state: CentralBankState;
  cpiInflation: number;
  gdpGrowth: number;
  week: number;
}

export interface CentralBankTickResult {
  state: CentralBankState;
  effects: Effects;
  decision: MpcDecision;
}

/**
 * The quarterly vote. A stacked committee moves the thresholds, never the magnitudes —
 * which is precisely why the default state reproduces the old rule to the decimal.
 */
export function advanceCentralBank(input: CentralBankTickInput): CentralBankTickResult {
  if (!rateReviewDue(input.week)) {
    return { state: input.state, effects: {}, decision: 'hold' };
  }

  // Hawks hike sooner (a lower inflation trigger); doves cut sooner (a higher one).
  // Both are exactly 4.5 / 2.0 at the default committee, which is what preserves parity.
  const hikeThreshold = HAWK_HIKE_THRESHOLD - 0.5 * input.state.hawkishness;
  const cutThreshold = DOVE_CUT_THRESHOLD - 0.5 * input.state.hawkishness;

  if (input.cpiInflation > hikeThreshold) {
    return {
      state: {
        ...input.state,
        bankRate: round2(input.state.bankRate + RATE_STEP),
        lastReviewWeek: input.week,
      },
      // Identical to the extracted rule.
      effects: { cpiInflation: -0.2, gdpGrowth: -0.1, giltYield: 0.1 },
      decision: 'hike',
    };
  }

  if (input.cpiInflation < cutThreshold && input.gdpGrowth < DOVE_GDP_CUT_THRESHOLD) {
    return {
      state: {
        ...input.state,
        bankRate: round2(Math.max(0, input.state.bankRate - RATE_STEP)),
        lastReviewWeek: input.week,
      },
      effects: { gdpGrowth: 0.1, giltYield: -0.1 },
      decision: 'cut',
    };
  }

  return { state: { ...input.state, lastReviewWeek: input.week }, effects: {}, decision: 'hold' };
}

/**
 * The gilt risk premium charged for lost independence. Zero while credibility is intact,
 * which is why coupling it into the yield model costs nothing at default state.
 */
export function credibilityPremium(state: CentralBankState): number {
  return round2(Math.max(0, CREDIBILITY_PREMIUM_FLOOR - state.credibility) * 0.01);
}

/** Leaning on the Bank: it gets its way this time, and the market remembers. */
export function leanOnTheBank(state: CentralBankState): { state: CentralBankState; effects: Effects } {
  return {
    state: {
      ...state,
      pressure: state.pressure + 1,
      credibility: round2(clamp(state.credibility - PRESSURE_CREDIBILITY_COST, 0, 100)),
    },
    effects: { giltYield: 0.15 },
  };
}

/** Stacking the committee: hawks want to hike sooner, doves to cut sooner. */
export function appointMpcMember(state: CentralBankState, kind: MpcAppointment): CentralBankState {
  const delta = kind === 'hawk' ? 1 : -1;
  return { ...state, hawkishness: state.hawkishness + delta };
}

/** 0..1 reading of how independent the Bank still looks. */
export function independenceReading(state: CentralBankState): number {
  return clamp(state.credibility / 100, 0, 1);
}