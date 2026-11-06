import type { Bill, WhipLevel } from './types';
import { CABINET_COHESION_FLOOR } from './cabinet';

/**
 * Parliamentary votes as a small, explicit state machine.
 *
 * A bill or an opposition motion is scheduled, then resolved exactly once. The
 * vote arithmetic is deliberately pure: the engine computes the political
 * inputs, this module decides the lobby numbers and the record, and the engine
 * applies the consequences. That keeps the high-stakes arithmetic testable
 * without dragging the whole GameState into every branch.
 */

export type ParliamentaryVoteKind = 'government-bill' | 'opposition-motion';
export type ParliamentaryVoteStatus = 'scheduled' | 'passed' | 'defeated' | 'cancelled';

export interface ParliamentaryVoteResult {
  ayes: number;
  noes: number;
  /** Government MPs who rebelled, including named coalition ministers where known. */
  rebels: number;
  backbenchRebels?: number;
  rebelNames?: string[];
  /** Confidence motions count defections rather than named rebels. */
  defections?: number;
  passed: boolean;
  /** True when the bill carried with Lords amendments; drives the AMENDED stamp. */
  amended?: boolean;
  castWeek: number;
}

export type DivisionStamp = 'PASSED (ROYAL ASSENT)' | 'DEFEATED' | 'AMENDED';

/** The official stamp shown against a division result. */
export function divisionStamp(
  result: ParliamentaryVoteResult | undefined,
): DivisionStamp | null {
  if (!result) return null;
  if (result.amended) return 'AMENDED';
  return result.passed ? 'PASSED (ROYAL ASSENT)' : 'DEFEATED';
}

export interface ParliamentaryVote {
  id: string;
  kind: ParliamentaryVoteKind;
  /** Bill id, or the sponsor party id for an opposition motion. */
  subjectId: string;
  title: string;
  scheduledWeek: number;
  status: ParliamentaryVoteStatus;
  result?: ParliamentaryVoteResult;
}

export interface VoteState {
  scheduled: ParliamentaryVote[];
  recent: ParliamentaryVote[];
}

export const VOTE_HISTORY_LIMIT = 12;

export function createDefaultVoteState(): VoteState {
  return { scheduled: [], recent: [] };
}

export function billVoteId(billId: string): string {
  return `bill:${billId}`;
}

export function motionVoteId(sponsorPartyId: string, scheduledWeek: number): string {
  return `motion:${sponsorPartyId}:${scheduledWeek}`;
}

export function billVote(bill: Bill, scheduledWeek: number): ParliamentaryVote {
  return {
    id: billVoteId(bill.id),
    kind: 'government-bill',
    subjectId: bill.id,
    title: bill.title,
    scheduledWeek,
    status: 'scheduled',
  };
}

export function motionVote(input: {
  sponsorPartyId: string;
  sponsorName: string;
  scheduledWeek: number;
}): ParliamentaryVote {
  return {
    id: motionVoteId(input.sponsorPartyId, input.scheduledWeek),
    kind: 'opposition-motion',
    subjectId: input.sponsorPartyId,
    title: `Motion of no confidence in the government`,
    scheduledWeek: input.scheduledWeek,
    status: 'scheduled',
  };
}

export function scheduleVote(state: VoteState, vote: ParliamentaryVote): VoteState {
  return {
    scheduled: [...state.scheduled.filter((entry) => entry.id !== vote.id), vote].sort(
      (a, b) => a.scheduledWeek - b.scheduledWeek,
    ),
    recent: state.recent.filter((entry) => entry.id !== vote.id),
  };
}

export function rescheduleVote(state: VoteState, id: string, scheduledWeek: number): VoteState {
  return {
    ...state,
    scheduled: state.scheduled
      .map((entry) => (entry.id === id ? { ...entry, scheduledWeek } : entry))
      .sort((a, b) => a.scheduledWeek - b.scheduledWeek),
  };
}

export function recordVoteResult(state: VoteState, vote: ParliamentaryVote): VoteState {
  if (!vote.result) return state;
  const completed: ParliamentaryVote = {
    ...vote,
    status: vote.result.passed ? 'passed' : 'defeated',
  };
  return {
    scheduled: state.scheduled.filter((entry) => entry.id !== vote.id),
    recent: [completed, ...state.recent.filter((entry) => entry.id !== vote.id)].slice(
      0,
      VOTE_HISTORY_LIMIT,
    ),
  };
}

export function cancelVote(state: VoteState, id: string): VoteState {
  const cancelled = state.scheduled.find((entry) => entry.id === id);
  if (!cancelled) return state;
  return {
    scheduled: state.scheduled.filter((entry) => entry.id !== id),
    recent: [{ ...cancelled, status: 'cancelled' as const }, ...state.recent].slice(0, VOTE_HISTORY_LIMIT),
  };
}

export function cancelVotesForSubject(state: VoteState, subjectId: string): VoteState {
  const cancelled = state.scheduled.filter((entry) => entry.subjectId === subjectId);
  if (cancelled.length === 0) return state;
  return {
    scheduled: state.scheduled.filter((entry) => entry.subjectId !== subjectId),
    recent: [
      ...cancelled.map((entry) => ({ ...entry, status: 'cancelled' as const })),
      ...state.recent,
    ].slice(0, VOTE_HISTORY_LIMIT),
  };
}

export function pendingVotes(state: VoteState | undefined): ParliamentaryVote[] {
  if (!state) return [];
  return [...state.scheduled].filter((vote) => vote.status === 'scheduled').sort(
    (a, b) => a.scheduledWeek - b.scheduledWeek,
  );
}

export function recentVotes(state: VoteState | undefined): ParliamentaryVote[] {
  return state?.recent ?? [];
}

/* ------------------------------------------------------------------ *
 * Vote arithmetic
 * ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export interface CommonsDivisionInput {
  ownSeats: number;
  partnerSeats: number;
  totalSeats: number;
  whipLevel: WhipLevel;
  /** Already adjusted by the whips' divisionDisciplineModifier. */
  rebellionRisk: number;
  voteSwing: number;
  cabinetCohesion: number;
  rebelPressure: number;
}

export interface CommonsDivisionResult {
  ayes: number;
  noes: number;
  rebels: number;
  passed: boolean;
}

const COHESION_REFERENCE = 40;
const REBEL_PRESSURE_REFERENCE = 10;

/** Government MPs who vote against their own bill in a true division. */
export function commonsRebelLoss(input: {
  rebellionRisk: number;
  ownSeats: number;
  whipLevel: WhipLevel;
  rebelPressure: number;
  whipStrength: number;
  cohesion: number;
}): number {
  const risk = Math.max(0, input.rebellionRisk);
  if (risk === 0) return 0;

  const cohesionPressure = Math.max(0, 40 - input.cohesion) * 0.4;
  const whipsPressure = Math.max(0, input.rebelPressure - 40) * 0.3;
  const effectiveRisk = risk + cohesionPressure + whipsPressure;
  const discipline = clamp(0.55 + ((input.whipStrength - 75) / 100) * 0.6, 0.35, 1.2);
  const whipDampener =
    input.whipLevel === 'three-line' ? 0.55 : input.whipLevel === 'free-vote' ? 1.15 : 0.8;

  return Math.round(input.ownSeats * (effectiveRisk / 100) * 0.25 * whipDampener * discipline);
}

export function runCommonsDivision(input: CommonsDivisionInput): CommonsDivisionResult {
  const govBloc = Math.max(0, input.ownSeats + input.partnerSeats);
  const oppBloc = Math.max(0, input.totalSeats - govBloc);

  const whipDampener =
    input.whipLevel === 'three-line' ? 0.55 : input.whipLevel === 'free-vote' ? 1.15 : 0.8;
  const cohesionPressure =
    Math.max(0, COHESION_REFERENCE - input.cabinetCohesion) * 0.4;
  const whipPressure =
    Math.max(0, input.rebelPressure - REBEL_PRESSURE_REFERENCE) * 0.3;
  const effectiveRisk = Math.max(0, input.rebellionRisk) + cohesionPressure + whipPressure;

  const rebels = Math.round(govBloc * (effectiveRisk / 100) * 0.25 * whipDampener);
  const ayes = Math.max(0, govBloc - rebels + input.voteSwing);
  const noes = Math.max(0, oppBloc + rebels - input.voteSwing);

  return { ayes, noes, rebels, passed: ayes > noes };
}

export interface BillVoteInput {
  ownSeats: number;
  partnerSeats: number;
  totalSeats: number;
  whipLevel: WhipLevel;
  rebellionRisk: number;
  whipRebellionDelta: number;
  voteSwing: number;
  /** Public approval 0-100; moves a small number of votes toward the government. */
  publicApproval?: number;
  cabinetCohesion: number;
  rebelPressure: number;
  whipStrength: number;
  coalitionRebelLoss: number;
  hasPartner: boolean;
  committeeHeat: boolean;
  currentLetters: number;
  billLettersDelta: number;
  resentmentDelta: number;
  rng: () => number;
}

export interface BillVoteOutcome {
  passed: boolean;
  ayes: number;
  noes: number;
  rebels: number;
  backbenchRebels: number;
  adjustedRebellionRisk: number;
  lettersOfNoConfidence: number;
  usedTrueDivision: boolean;
}

export function resolveBillVote(input: BillVoteInput): BillVoteOutcome {
  const adjustedRebellionRisk = Math.max(0, input.rebellionRisk + input.whipRebellionDelta);
  // Public opinion is a small, bounded swing, not a veto: at 50 it is neutral,
  // at 0/100 it moves at most five votes either way.
  const publicOpinionSwing = clamp(
    Math.round(((input.publicApproval ?? 50) - 50) / 10),
    -5,
    5,
  );
  const totalVoteSwing = input.voteSwing + publicOpinionSwing;
  const backbenchRebels = commonsRebelLoss({
    rebellionRisk: adjustedRebellionRisk,
    ownSeats: input.ownSeats,
    whipLevel: input.whipLevel,
    rebelPressure: input.rebelPressure,
    whipStrength: input.whipStrength,
    cohesion: input.cabinetCohesion,
  });
  const adjustedDivisionSeats =
    input.ownSeats +
    input.partnerSeats -
    input.coalitionRebelLoss +
    totalVoteSwing -
    backbenchRebels;

  const cohesionExcess = Math.max(0, CABINET_COHESION_FLOOR - input.cabinetCohesion);
  const whipExcess = Math.max(0, input.rebelPressure - 10);
  const usedTrueDivision = cohesionExcess + whipExcess + (input.committeeHeat ? 1 : 0) > 0;

  let passed: boolean;
  let ayes: number;
  let noes: number;
  let rebels = backbenchRebels;

  if (usedTrueDivision) {
    const division = runCommonsDivision({
      ownSeats: input.ownSeats,
      partnerSeats: input.partnerSeats,
      totalSeats: input.totalSeats,
      whipLevel: input.whipLevel,
      rebellionRisk: adjustedRebellionRisk,
      voteSwing: totalVoteSwing,
      cabinetCohesion: input.cabinetCohesion,
      rebelPressure: input.rebelPressure,
    });
    passed = division.passed;
    ayes = division.ayes;
    noes = division.noes;
    rebels = division.rebels;
  } else {
    // Keep the original threshold table and RNG consumption exactly intact.
    if (input.whipLevel === 'three-line') {
      const effectiveSeats = adjustedDivisionSeats + 15;
      if (effectiveSeats >= 355) passed = true;
      else if (effectiveSeats >= 326) passed = input.rng() < 0.96;
      else if (effectiveSeats >= 300) passed = input.rng() < (input.hasPartner ? 0.75 : 0.4);
      else passed = false;
      ayes = Math.max(0, Math.round(effectiveSeats));
    } else if (input.whipLevel === 'free-vote') {
      if (adjustedDivisionSeats >= 360) passed = input.rng() < 0.88;
      else if (adjustedDivisionSeats >= 326) passed = input.rng() < 0.75;
      else if (adjustedDivisionSeats >= 300) passed = input.rng() < 0.5;
      else passed = input.rng() < 0.25;
      ayes = Math.max(0, Math.round(adjustedDivisionSeats));
    } else {
      if (adjustedDivisionSeats >= 360) passed = true;
      else if (adjustedDivisionSeats >= 326) passed = input.rng() < 0.92;
      else if (adjustedDivisionSeats >= 300) passed = input.rng() < (input.hasPartner ? 0.6 : 0.25);
      else passed = false;
      ayes = Math.max(0, Math.round(adjustedDivisionSeats));
    }
    noes = Math.max(0, Math.round(input.totalSeats) - ayes);
  }

  let letters = input.currentLetters + input.billLettersDelta;
  if (input.whipLevel === 'free-vote') {
    letters += 0;
  } else if (input.whipLevel === 'three-line') {
    letters += Math.round(adjustedRebellionRisk / 20);
  } else {
    letters += Math.round(adjustedRebellionRisk / 24);
  }
  letters += input.resentmentDelta;
  if (passed) {
    letters = clamp(letters - 1, 0, 99);
  } else if (input.whipLevel !== 'free-vote') {
    letters += Math.round(input.rebellionRisk / (input.whipLevel === 'three-line' ? 10 : 12));
  }

  return {
    passed,
    ayes,
    noes,
    rebels,
    backbenchRebels,
    adjustedRebellionRisk,
    lettersOfNoConfidence: clamp(letters, 0, 99),
    usedTrueDivision,
  };
}

export interface ConfidenceVoteInput {
  ownSeats: number;
  partnerSeats: number;
  totalSeats: number;
  partyConfidence: number;
}

export interface ConfidenceVoteOutcome {
  govVotes: number;
  oppVotes: number;
  defections: number;
  passed: boolean;
}

/** The fixed-timetable confidence motion tabled by the opposition. */
export function resolveConfidenceVote(input: ConfidenceVoteInput): ConfidenceVoteOutcome {
  const defections = Math.round(
    (input.ownSeats * Math.max(0, 40 - input.partyConfidence)) / 100,
  );
  const govVotes = Math.max(0, input.ownSeats + input.partnerSeats - defections);
  const oppVotes = Math.max(0, input.totalSeats - govVotes);
  return { govVotes, oppVotes, defections, passed: govVotes > oppVotes };
}

export interface BudgetVoteInput {
  ownSeats: number;
  partnerSeats: number;
  totalSeats: number;
  /** Public approval 0-100. */
  publicApproval: number;
  partyConfidence: number;
}

export interface BudgetVoteOutcome {
  ayes: number;
  noes: number;
  rebels: number;
  passed: boolean;
}

/**
 * A major Budget division. Unlike a confidence motion it can be lost by a
 * government with a paper majority if public support and party discipline have
 * collapsed; losing it is the trigger for an imminent no-confidence motion.
 */
export function resolveBudgetVote(input: BudgetVoteInput): BudgetVoteOutcome {
  const governmentBloc = Math.max(0, input.ownSeats + input.partnerSeats);
  const oppositionBloc = Math.max(0, input.totalSeats - governmentBloc);
  const publicSwing = clamp(Math.round((input.publicApproval - 50) / 8), -6, 6);
  const confidenceDeficit = Math.max(0, 45 - input.partyConfidence);
  const rebels = Math.round(governmentBloc * (confidenceDeficit / 100) * 0.25);
  const ayes = Math.max(0, governmentBloc - rebels + publicSwing);
  const noes = Math.max(0, oppositionBloc + rebels - publicSwing);
  return { ayes, noes, rebels, passed: ayes > noes };
}

