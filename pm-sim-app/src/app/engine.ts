import type { GameState, Action, Party, Effects } from './types';
import { INITIAL_PARTIES, INITIAL_RELATIONS, REGIONS, EVENTS } from './data';
import type { Region } from './data';

/** FPTP cube-law exponent — tune this to adjust Lab/Con/LD/Reform seat totals. */
export const FPTP_EXPONENT = 2.5;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function createInitialState(): GameState {
  return {
    phase: 'menu',
    player: null,
    parties: INITIAL_PARTIES.map((p) => ({ ...p })),
    relations: INITIAL_RELATIONS.map((r) => ({ ...r })),
    metrics: { approval: 45, partyConfidence: 55, economy: 58, publicServices: 52, security: 60, mediaAttention: 40 },
    week: 1,
    turnsUntilElection: 60,
    isElection: false,
    activeEvent: null,
    dialogIndex: 0,
    showChoices: false,
    chosenId: null,
    pendingChoice: null,
    lastOutcome: null,
    log: [],
  };
}

function largestRemainder(weights: Record<string, number>, seats: number): Record<string, number> {
  const result: Record<string, number> = {};
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0 || seats <= 0) {
    for (const id of Object.keys(weights)) result[id] = 0;
    return result;
  }
  const entries = Object.entries(weights)
    .map(([id, w]) => {
      const exact = (w / total) * seats;
      const floor = Math.floor(exact);
      return { id, floor, remainder: exact - floor };
    })
    .sort((a, b) => b.remainder - a.remainder);
  let allocated = 0;
  for (const e of entries) { result[e.id] = e.floor; allocated += e.floor; }
  const remaining = seats - allocated;
  for (let i = 0; i < remaining && entries.length > 0; i++) {
    result[entries[i % entries.length].id] += 1;
  }
  return result;
}

function electSeats(parties: Party[], regions: Region[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of parties) totals[p.id] = 0;
  for (const region of regions) {
    const weights: Record<string, number> = {};
    for (const p of parties) {
      const share = Math.max(0, region.support[p.id] ?? 0);
      weights[p.id] = Math.pow(share, FPTP_EXPONENT);
    }
    const alloc = largestRemainder(weights, region.seats);
    for (const p of parties) totals[p.id] += alloc[p.id] ?? 0;
  }
  return totals;
}

function runElection(s: GameState): GameState {
  const seats = electSeats(s.parties, REGIONS);
  const parties = s.parties.map((p) => ({ ...p, seats: seats[p.id] ?? 0 }));
  const playerParty = parties.find((p) => p.id === s.player?.partyId);
  const playerSeats = playerParty?.seats ?? 0;
  const majority = playerSeats >= 326;
  const swing = Math.round((playerSeats - 411) / 40);
  const approval = clamp(s.metrics.approval + (majority ? swing + 2 : -10), 0, 100);
  const message = `General election: ${playerParty?.name ?? '?'} won ${playerSeats} seats${majority ? ' \u2014 a majority.' : ' \u2014 no majority.'}`;
  return {
    ...s,
    parties,
    metrics: { ...s.metrics, approval },
    turnsUntilElection: 60,
    isElection: true,
    log: [message, ...s.log].slice(0, 50),
  };
}

function applyEffects(s: GameState, fx: Effects): GameState {
  const parties = s.parties.map((p) => ({
    ...p,
    currentSupport: clamp(p.currentSupport + (fx.supportDelta?.[p.id] ?? 0), 1, 60),
    funds: Math.max(0, p.funds + (fx.fundsDelta ?? 0)),
  }));
  const relations = s.relations.map((r) => {
    const delta = fx.relationDelta?.[`${r.from}>${r.to}`] ?? 0;
    return delta ? { ...r, score: clamp(r.score + delta, -100, 100) } : r;
  });
  const metrics = {
    approval: clamp(s.metrics.approval + (fx.approval ?? 0), 0, 100),
    partyConfidence: clamp(s.metrics.partyConfidence + (fx.partyConfidence ?? 0), 0, 100),
    economy: clamp(s.metrics.economy + (fx.economy ?? 0), 0, 100),
    publicServices: clamp(s.metrics.publicServices + (fx.publicServices ?? 0), 0, 100),
    security: clamp(s.metrics.security + (fx.security ?? 0), 0, 100),
    mediaAttention: clamp(s.metrics.mediaAttention + (fx.mediaAttention ?? 0), 0, 100),
  };
  return { ...s, parties, relations, metrics };
}

function advanceWeek(s: GameState): GameState {
  if (s.activeEvent) return s;

  let next: GameState = { ...s, week: s.week + 1, lastOutcome: null, isElection: false };

  const eco = next.metrics.economy;
  let approval = next.metrics.approval + (eco >= 55 ? 1 : eco <= 45 ? -1 : 0);
  let partyConfidence = next.metrics.partyConfidence + (approval >= 50 ? 1 : -1);
  approval = clamp(approval, 0, 100);
  partyConfidence = clamp(partyConfidence, 0, 100);
  next = { ...next, metrics: { ...next.metrics, approval, partyConfidence } };

  const turnsUntilElection = s.turnsUntilElection - 1;
  next = { ...next, turnsUntilElection };

  if (turnsUntilElection <= 0) {
    next = runElection(next);
  } else if (next.week % 3 === 0) {
    const idx = Math.floor((next.week / 3) % EVENTS.length);
    next = { ...next, activeEvent: EVENTS[idx], dialogIndex: 0, showChoices: false, chosenId: null, pendingChoice: null };
  }

  return next;
}

function advanceDialog(s: GameState): GameState {
  if (!s.activeEvent) return s;
  if (s.dialogIndex + 1 >= s.activeEvent.dialogs.length) {
    return { ...s, showChoices: true };
  }
  return { ...s, dialogIndex: s.dialogIndex + 1 };
}

function choose(s: GameState, choiceId: string): GameState {
  const ev = s.activeEvent;
  if (!ev) return s;
  const choice = ev.choices.find((c) => c.id === choiceId);
  if (!choice) return s;
  let next = applyEffects(s, choice.effects);
  next = {
    ...next,
    showChoices: false,
    chosenId: choiceId,
    pendingChoice: choice,
    lastOutcome: choice.consequence,
    log: [`${ev.title}: ${choice.consequence}`, ...next.log].slice(0, 50),
  };
  return next;
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return { ...createInitialState(), phase: 'create' };
    case 'RESTORE':
      return { ...action.state };
    case 'CREATE_PLAYER': {
      const fullName = `${action.player.firstName} ${action.player.lastName}`;
      const parties = state.parties.map((p) =>
        p.id === action.player.partyId ? { ...p, leader: fullName } : p,
      );
      // Initial election: seat the government before week 1 begins.
      const seats = electSeats(parties, REGIONS);
      const withSeats = parties.map((p) => ({ ...p, seats: seats[p.id] ?? 0 }));
      const mySeats = withSeats.find((p) => p.id === action.player.partyId)?.seats ?? 0;
      return {
        ...state,
        player: action.player,
        parties: withSeats,
        phase: 'playing',
        log: [`${fullName} becomes Prime Minister with ${mySeats} seats.`, ...state.log].slice(0, 50),
      };
    }
    case 'START_TURN':
      return advanceWeek(state);
    case 'ADVANCE_DIALOG':
      return advanceDialog(state);
    case 'CHOOSE':
      return choose(state, action.choiceId);
    case 'DISMISS_EVENT':
      return { ...state, activeEvent: null, dialogIndex: 0, showChoices: false, chosenId: null, pendingChoice: null };
    default:
      return state;
  }
}
