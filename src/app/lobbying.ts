import type { Bill, Department, Effects } from './types';

/**
 * Feature #8 module: Interest groups, lobbying & select committees.
 *
 * Adds only what the engine lacked: standing INTEREST GROUPS with influence, SELECT
 * COMMITTEES that scrutinise a department and turn hostile when a government looks
 * weak, an e-PETITION pressure gauge, and the REVOLVING DOOR risk of ministers
 * walking into lobbying jobs.
 *
 * Deliberately does NOT re-implement what exists: the press lobby briefing lives in
 * ./media, and the lobbying-ethics PMQ lives in ./pmqData.
 *
 * INERT INVARIANT (strict): the weekly tick returns NO effects, ever. Committee heat
 * is charged against BILLS only (see committeeDelayWeeks), which no passive Idle run
 * ever proposes — so this module provably cannot move the Idle archetype, whose drag
 * is capped at 315 weeks. Lobbying itself is an explicit, player-driven action.
 */

export type InterestKind = 'business' | 'union' | 'ngo' | 'think-tank';

export interface InterestGroup {
  id: string;
  name: string;
  kind: InterestKind;
  /** 0..100 access and influence with the government. */
  influence: number;
}

export interface SelectCommittee {
  id: string;
  name: string;
  department: Department;
  chairName: string;
  /** 0..100: how eager the chair is to wound ministers for their own profile. */
  chairAmbition: number;
  /** 0..100: how hostile the committee currently is toward the department. */
  hostility: number;
}

export interface LobbyingState {
  groups: InterestGroup[];
  committees: SelectCommittee[];
  /** Week of the last lobbying round, or null. */
  lastLobbyWeek: number | null;
  /** e-petitions that have crossed the debate threshold this term. */
  petitionsDebated: number;
  /** Revolving-door appointments recorded this term. */
  revolvingDoors: number;
  /** Signatures on the live e-petition ('000s). */
  livePetition: number;
}

export const COMMITTEE_HOSTILITY_FLOOR = 55;
export const COMMITTEE_DELAY_MAX_WEEKS = 2;
export const LOBBY_COOLDOWN_WEEKS = 3;
export const PETITION_DEBATE_THRESHOLD = 100;
export const COMMITTEE_HOSTILITY_START = 25;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

export function createDefaultLobbyingState(): LobbyingState {
  return {
    groups: [
      { id: 'cbi', name: 'The CBI', kind: 'business', influence: 60 },
      { id: 'tuc', name: 'The TUC', kind: 'union', influence: 55 },
      { id: 'green-alliance', name: 'The Green Alliance', kind: 'ngo', influence: 40 },
      { id: 'institute-ideas', name: 'The Institute of Economic Ideas', kind: 'think-tank', influence: 45 },
    ],
    committees: [
      { id: 'treasury-sel', name: 'Treasury Select Committee', department: 'HM Treasury', chairName: 'Harriet Vane', chairAmbition: 72, hostility: COMMITTEE_HOSTILITY_START },
      { id: 'home-sel', name: 'Home Affairs Select Committee', department: 'Home Office', chairName: 'Dennis Rook', chairAmbition: 64, hostility: COMMITTEE_HOSTILITY_START },
      { id: 'health-sel', name: 'Health & Social Care Committee', department: 'DHSC (Health)', chairName: 'Priya Nair', chairAmbition: 58, hostility: COMMITTEE_HOSTILITY_START },
      { id: 'defence-sel', name: 'Defence Select Committee', department: 'Ministry of Defence', chairName: 'Alastair Croft', chairAmbition: 66, hostility: COMMITTEE_HOSTILITY_START },
    ],
    lastLobbyWeek: null,
    petitionsDebated: 0,
    revolvingDoors: 0,
    livePetition: 0,
  };
}

export interface LobbyingTickInput {
  state: LobbyingState;
  approval: number;
  partyConfidence: number;
  week: number;
  seed: number;
}

export interface LobbyingTickResult {
  state: LobbyingState;
  effects: Effects;
  log: string[];
}

/**
 * Weekly bookkeeping only. Committees sharpen their knives while a government looks
 * weak and soften when it recovers; that heat is spent on bills, not here.
 */
export function advanceLobbying(input: LobbyingTickInput): LobbyingTickResult {
  const drift = input.approval < 45 ? 0.25 : -0.15;
  const committees = input.state.committees.map((c) => ({
    ...c,
    hostility: r1(clamp(c.hostility + drift, 0, 100)),
  }));

  const log: string[] = [];
  const crossed = committees.filter(
    (c, i) => c.hostility >= COMMITTEE_HOSTILITY_FLOOR && input.state.committees[i].hostility < COMMITTEE_HOSTILITY_FLOOR,
  );
  for (const c of crossed) {
    log.push(`COMMITTEE: ${c.name} turns hostile toward ${c.department}.`);
  }

  const state: LobbyingState = { ...input.state, committees };
  // Strictly inert: never returns effects, whatever the state.
  return { state, effects: {}, log };
}

/**
 * Extra weeks a bill spends in committee. Zero until the committee is genuinely
 * hostile, which is what keeps this invisible to a passive premiership.
 */
export function committeeDelayWeeks(bill: Bill, state: LobbyingState): number {
  const committee = state.committees.find((c) => c.department === bill.department);
  if (!committee || committee.hostility < COMMITTEE_HOSTILITY_FLOOR) return 0;
  const excess = committee.hostility - COMMITTEE_HOSTILITY_FLOOR;
  return Math.min(COMMITTEE_DELAY_MAX_WEEKS, 1 + Math.floor(excess / 25));
}

/** Courting a group buys goodwill but costs a little transparency; snubbing does the reverse. */
export function lobbyGroup(
  state: LobbyingState,
  groupId: string,
  week: number,
  mode: 'court' | 'snub',
): { state: LobbyingState; effects: Effects } {
  if (state.lastLobbyWeek !== null && week - state.lastLobbyWeek < LOBBY_COOLDOWN_WEEKS) {
    return { state, effects: {} };
  }
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return { state, effects: {} };

  const delta = mode === 'court' ? 8 : -10;
  const groups = state.groups.map((g) =>
    g.id === groupId ? { ...g, influence: r1(clamp(g.influence + delta, 0, 100)) } : g,
  );
  const weight = r2(clamp(group.influence / 100, 0, 1));

  const effects: Effects =
    mode === 'court'
      ? { approval: r2(1 * weight), partyConfidence: -r2(1 * weight) }
      : { approval: -r2(2 * weight), partyConfidence: r2(1 * weight) };

  return { state: { ...state, groups, lastLobbyWeek: week }, effects };
}

/** e-petition pressure, 0..1: the closer to the debate threshold, the louder it gets. */
export function petitionPressure(state: LobbyingState): number {
  return clamp(state.livePetition / PETITION_DEBATE_THRESHOLD, 0, 1);
}

/** 0..1 risk that a departing minister walks into a lobbying job. */
export function revolvingDoorRisk(state: LobbyingState): number {
  const bestConnected = state.groups.reduce((max, g) => Math.max(max, g.influence), 0);
  return clamp(bestConnected / 100, 0, 1);
}

export function hostileCommittees(state: LobbyingState): number {
  return state.committees.filter((c) => c.hostility >= COMMITTEE_HOSTILITY_FLOOR).length;
}