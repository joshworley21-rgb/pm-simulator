import type { Bill, Effects } from './types';
import {
  billVote,
  cancelVotesForSubject,
  createDefaultVoteState,
  scheduleVote,
  type VoteState,
} from './parliamentaryVotes';

/**
 * Feature #7 module: Parliament as a process.
 *
 * Adds only what the engine lacked: the passage of a bill THROUGH Parliament —
 * committee stage, Lords stages, ping-pong, royal assent — plus the session clock,
 * the wash-up deadline at the end of a session, and the constitutional cost of
 * forcing a bill past the Lords with the Parliament Act.
 *
 * Deliberately does NOT own the division arithmetic: the lobby tally, rebel
 * loss and confidence-vote maths live in ./parliamentaryVotes. This module owns
 * the pipeline, the session clock and the scheduled-vote bookkeeping that links
 * the two.
 *
 * INERT INVARIANT (strict): the weekly tick returns NO effects, ever. Bills enter
 * the parliamentary pipeline only through explicit calls (startBill / advanceBillStage
 * / invokeParliamentAct / grantRoyalAssent), which no autonomous archetype makes.
 * The module is therefore provably neutral on the Idle archetype — the cumulative
 * Idle drag is capped at 315 weeks, so nothing here may move it.
 */

export type ParliamentaryStage =
  | 'commons-committee'
  | 'commons-report'
  | 'lords-second-reading'
  | 'lords-amendments'
  | 'ping-pong'
  | 'royal-assent';

/** The stages a bill must clear, in order. */
export const PARLIAMENTARY_STAGES: ParliamentaryStage[] = [
  'commons-committee',
  'commons-report',
  'lords-second-reading',
  'lords-amendments',
  'ping-pong',
  'royal-assent',
];

export interface BillProgress {
  billId: string;
  title: string;
  stage: ParliamentaryStage;
  weeksInStage: number;
  /** Lords amendments carried against the government. */
  lordsAmendments: number;
  /** True once the two-week Lords delay has been applied to the countdown. */
  lordsDelayApplied: boolean;
}

export interface ParliamentState {
  /** Week within the current session, 1..TURNS_PER_SESSION. */
  sessionWeek: number;
  inProgress: BillProgress[];
  /** Parliament Act invocations this term (strictly limited). */
  parliamentActUses: number;
  /** Bills lost when a session ended before they cleared. */
  washedUp: number;
  /** Bills that have received royal assent. */
  assents: number;
  /** Scheduled and recently resolved parliamentary votes. */
  votes: VoteState;
}

export const TURNS_PER_SESSION = 52;
export const WASH_UP_WEEKS = 4;
export const LORDS_STAGE_WEEKS = 2;
export const PARLIAMENT_ACT_LIMIT_PER_TERM = 1;

/**
 * Commons time is a resource: each session has a fixed number of division
 * slots on the Order Paper, and every bill in progress occupies one. When the
 * slots are full the government must wait for a bill to fall or pass before
 * tabling another — scheduling, not appetite, becomes the constraint.
 */
export const DIVISION_SLOTS_PER_SESSION = 4;
export const PARLIAMENT_ACT_PRESSURE = 6;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

export function createDefaultParliamentState(): ParliamentState {
  return {
    sessionWeek: 1,
    inProgress: [],
    parliamentActUses: 0,
    washedUp: 0,
    assents: 0,
    votes: createDefaultVoteState(),
  };
}

/** Which week of the session a given game week falls in (sessions run 52 weeks). */
export function sessionWeekFor(week: number): number {
  const safe = Number.isFinite(week) ? Math.floor(week) : 1;
  return ((safe - 1) % TURNS_PER_SESSION + TURNS_PER_SESSION) % TURNS_PER_SESSION + 1;
}

/** The final weeks of a session are wash-up: unfinished bills die. */
export function isWashUp(sessionWeek: number): boolean {
  return sessionWeek > TURNS_PER_SESSION - WASH_UP_WEEKS;
}

export interface ParliamentTickInput {
  state: ParliamentState;
  week: number;
  seed: number;
}

export interface ParliamentTickResult {
  state: ParliamentState;
  effects: Effects;
  log: string[];
}

/**
 * Weekly bookkeeping only. The session clock advances and a session that ends
 * sweeps unfinished business into wash-up. This returns no effects by design.
 */
export function advanceParliament(input: ParliamentTickInput): ParliamentTickResult {
  const sessionWeek = sessionWeekFor(input.week);
  const log: string[] = [];
  let inProgress = input.state.inProgress;
  let washedUp = input.state.washedUp;

  const sessionRolledOver = sessionWeek < input.state.sessionWeek;
  let votes = input.state.votes ?? createDefaultVoteState();
  if (sessionRolledOver) {
    const washed = inProgress.length;
    for (const bill of inProgress) {
      votes = cancelVotesForSubject(votes, bill.billId);
    }
    washedUp += washed;
    inProgress = [];
    if (washed > 0) {
      log.push('PARLIAMENT: the session ended; unfinished bills fell at wash-up.');
    }
  } else if (isWashUp(sessionWeek) && !isWashUp(input.state.sessionWeek)) {
    log.push('PARLIAMENT: wash-up begins — unfinished bills will fall at the session end.');
  }

  const state: ParliamentState = { ...input.state, sessionWeek, inProgress, washedUp, votes };
  // Strictly inert: never returns effects, whatever the state.
  return { state, effects: {}, log };
}

/** A bill the government is trying to carry, entering at committee stage. */
export function startBill(state: ParliamentState, bill: Bill, week?: number): ParliamentState {
  if (state.inProgress.some((b) => b.billId === bill.id)) return state;
  const nextState: ParliamentState = {
    ...state,
    inProgress: [
      ...state.inProgress,
      {
        billId: bill.id,
        title: bill.title,
        stage: 'commons-committee',
        weeksInStage: 0,
        lordsAmendments: 0,
        lordsDelayApplied: false,
      },
    ],
  };
  if (week === undefined) return nextState;
  return {
    ...nextState,
    votes: scheduleVote(
      nextState.votes ?? createDefaultVoteState(),
      billVote(bill, week + Math.max(1, bill.weeksToPass)),
    ),
  };
}

function nextStage(stage: ParliamentaryStage): ParliamentaryStage {
  const i = PARLIAMENTARY_STAGES.indexOf(stage);
  return PARLIAMENTARY_STAGES[Math.min(i + 1, PARLIAMENTARY_STAGES.length - 1)];
}

/**
 * Advance one bill a stage (or age it within its stage). The Lords may amend as
 * it moves, which raises the delay risk on the return leg.
 */
export function advanceBillStage(
  state: ParliamentState,
  billId: string,
  opts: { lordsAmend?: boolean; weeks?: number } = {},
): ParliamentState {
  const weeks = opts.weeks ?? 1;
  return {
    ...state,
    inProgress: state.inProgress.map((b) => {
      if (b.billId !== billId) return b;
      const stage = nextStage(b.stage);
      const lordsAmendments = opts.lordsAmend && stage.startsWith('lords') ? b.lordsAmendments + 1 : b.lordsAmendments;
      return { ...b, stage, weeksInStage: weeks, lordsAmendments };
    }),
  };
}

/**
 * 0..1 risk that a bill is delayed or sent back: Lords amendments raise it, and
 * wash-up makes everything urgent.
 */
export function lordsDelayRisk(progress: BillProgress): number {
  const amendmentPressure = progress.lordsAmendments * 0.2;
  const stagePressure = progress.stage === 'lords-amendments' || progress.stage === 'ping-pong' ? 0.25 : 0;
  return clamp(amendmentPressure + stagePressure, 0, 1);
}

/**
 * The Parliament Act: force a bill past the Lords. Constitutionally expensive and
 * strictly limited per term — it costs party confidence rather than being free.
 */
export function invokeParliamentAct(state: ParliamentState, billId: string): { state: ParliamentState; effects: Effects } {
  if (state.parliamentActUses >= PARLIAMENT_ACT_LIMIT_PER_TERM) {
    return { state, effects: {} };
  }
  return {
    state: {
      ...state,
      parliamentActUses: state.parliamentActUses + 1,
      inProgress: state.inProgress.map((b) =>
        b.billId === billId ? { ...b, stage: 'royal-assent' } : b,
      ),
    },
    effects: { partyConfidence: -PARLIAMENT_ACT_PRESSURE },
  };
}

/** Royal assent: the bill leaves the pipeline and becomes law. */
export function grantRoyalAssent(state: ParliamentState, billId: string): ParliamentState {
  const bill = state.inProgress.find((b) => b.billId === billId);
  if (!bill || bill.stage !== 'royal-assent') return state;
  return {
    ...state,
    inProgress: state.inProgress.filter((b) => b.billId !== billId),
    assents: state.assents + 1,
  };
}

/** Sweep every unfinished bill into wash-up (called at a session end). */
/**
 * Record that the Lords delay has been charged against a bill's countdown, so it
 * is only ever applied once per bill.
 */
export function markLordsDelay(state: ParliamentState, billId: string): ParliamentState {
  return {
    ...state,
    inProgress: state.inProgress.map((b) =>
      b.billId === billId ? { ...b, lordsDelayApplied: true } : b,
    ),
  };
}

export function washUpBills(state: ParliamentState): ParliamentState {
  if (state.inProgress.length === 0) return state;
  let votes = state.votes ?? createDefaultVoteState();
  for (const bill of state.inProgress) {
    votes = cancelVotesForSubject(votes, bill.billId);
  }
  return {
    ...state,
    washedUp: state.washedUp + state.inProgress.length,
    inProgress: [],
    votes,
  };
}