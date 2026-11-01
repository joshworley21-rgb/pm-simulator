import type { Effects } from './types';

/**
 * Feature #5 module: Immigration & asylum.
 *
 * Adds only what the engine lacked: a living asylum BACKLOG, small-boat ARRIVALS
 * accruing weekly, caseworker THROUGHPUT, accommodation COST, and a removals
 * channel that a court injunction can block.
 *
 * Deliberately does NOT re-implement what exists: the `netMigration` stat and its
 * Effects plumbing live in engine/types, and the asylum + small-boats dossiers
 * live in ./dossiers3 and ./data.
 *
 * INERT INVARIANT: while the backlog sits below BACKLOG_ALERT this module returns
 * NO gameplay effects, so a settled system leaves the simulation identical.
 *
 * Magnitudes are capped (see immigrationEffects): the Home Office adds drag, it
 * does not fell a government. Learned from the media/devolution death spirals.
 */

export interface ImmigrationState {
  /** Outstanding asylum cases ('000s). */
  backlog: number;
  /** Small-boat arrivals recorded this fiscal year ('000s). */
  arrivalsThisYear: number;
  /** Caseworker throughput, 0..100 (100 = fully staffed). */
  caseworkerCapacity: number;
  /** True while a court injunction blocks removals. */
  removalsBlocked: boolean;
  /** Removals completed this term ('000s). */
  removalsThisTerm: number;
}

export const BACKLOG_ALERT = 140;
export const BACKLOG_CEILING = 1000;
export const DEFAULT_BACKLOG = 100;

// 0.40, not 0.22: at 0.22 the net inflow (+0.10/wk) needed ~400 weeks to reach the
// alert threshold, so the mechanic never fired in a normal-length game. 0.40 gives a
// net ~+0.27/wk, breaching BACKLOG_ALERT around week 150 and landing a mild Idle drag.
const ARRIVALS_BASE_PER_WEEK = 0.4;
const CASEWORKER_CLEARANCE_PER_WEEK = 0.16;
const ACCOMMODATION_COST_PER_1K = 0.03;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Deterministic 0..1 draw keyed on (seed, week); never consumes the engine seed. */
function draw(seed: number, week: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ ((week * 2654435761) >>> 0), 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 0x100000000;
}

export function createDefaultImmigrationState(): ImmigrationState {
  return {
    backlog: DEFAULT_BACKLOG,
    arrivalsThisYear: 0,
    caseworkerCapacity: 70,
    removalsBlocked: false,
    removalsThisTerm: 0,
  };
}

export interface ImmigrationTickInput {
  state: ImmigrationState;
  approval: number;
  security: number;
  week: number;
  seed: number;
}

export interface ImmigrationTickResult {
  state: ImmigrationState;
  effects: Effects;
  log: string[];
}

export function advanceImmigration(input: ImmigrationTickInput): ImmigrationTickResult {
  // Weather windows and security pressure drive the boats.
  const seasonality = 0.7 + draw(input.seed, input.week) * 0.6;
  const securityFactor = 1 + (50 - input.security) / 200;
  const arrivals = r2(Math.max(0, ARRIVALS_BASE_PER_WEEK * securityFactor * seasonality));
  const clearance = r2(CASEWORKER_CLEARANCE_PER_WEEK * (input.state.caseworkerCapacity / 100));

  const backlog = r2(clamp(input.state.backlog + arrivals - clearance, 0, BACKLOG_CEILING));
  const state: ImmigrationState = {
    ...input.state,
    backlog,
    arrivalsThisYear: r2(input.state.arrivalsThisYear + arrivals),
  };

  const effects = immigrationEffects(state);
  const log: string[] = [];
  if (backlog >= BACKLOG_ALERT && input.state.backlog < BACKLOG_ALERT) {
    log.push('HOME OFFICE: the asylum backlog has passed the alert threshold.');
  }

  return { state, effects, log };
}

/**
 * Effects implied by the backlog. Empty below the alert threshold, which keeps a
 * settled system inert.
 */
export function immigrationEffects(state: ImmigrationState): Effects {
  const excess = Math.max(0, state.backlog - BACKLOG_ALERT);
  if (excess <= 0) return {};
  const approvalCost = Math.min(0.1, excess * 0.004);
  const fiscalCost = Math.min(0.03, excess * 0.002);
  return {
    approval: -r2(approvalCost),
    budgetBalance: -r2(fiscalCost),
  };
}

/** Weekly accommodation bill for the asylum estate (£m). */
export function accommodationCost(state: ImmigrationState): number {
  return r2(state.backlog * ACCOMMODATION_COST_PER_1K);
}

export function setCaseworkerCapacity(state: ImmigrationState, capacity: number): ImmigrationState {
  return { ...state, caseworkerCapacity: r2(clamp(capacity, 0, 100)) };
}

export function setRemovalsBlocked(state: ImmigrationState, blocked: boolean): ImmigrationState {
  return { ...state, removalsBlocked: blocked };
}

/** A removal flight: blocked while an injunction stands. */
export function removalFlight(state: ImmigrationState, count: number): ImmigrationState {
  if (state.removalsBlocked || count <= 0) return state;
  const removed = Math.min(count, state.backlog);
  return {
    ...state,
    backlog: r2(clamp(state.backlog - removed, 0, BACKLOG_CEILING)),
    removalsThisTerm: r2(state.removalsThisTerm + removed),
  };
}

/** 0..1 risk that the backlog becomes a political crisis. */
export function backlogAlertRisk(state: ImmigrationState): number {
  return clamp((state.backlog - BACKLOG_ALERT) / (BACKLOG_CEILING - BACKLOG_ALERT), 0, 1);
}