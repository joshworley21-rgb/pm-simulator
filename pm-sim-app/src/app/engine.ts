import type { GameState, Action, Party, Effects, Dossier } from './types';
import { INITIAL_PARTIES, INITIAL_RELATIONS, REGIONS, DOSSIER_POOL } from './data';
import type { Region } from './data';

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
    metrics: { approval: 48, partyConfidence: 62, economy: 55, publicServices: 50, security: 58, mediaAttention: 35 },
    stats: { cpiInflation: 2.8, gdpGrowth: 1.1, giltYield: 4.15, nhsWaitingList: 7.2, netMigration: 420, lettersOfNoConfidence: 8 },
    week: 1,
    turnsUntilElection: 60,
    isElection: false,
    redBox: [{ ...DOSSIER_POOL[0] }, { ...DOSSIER_POOL[2] }],
    selectedDossierId: null,
    lastOutcome: null,
    headlines: [
      { paper: 'The National Standard', title: 'NEW PRIME MINISTER SETS OUT DOWNING STREET AGENDA', stance: 'centrist' },
      { paper: 'The Clarion', title: 'UNIONS WARN: FUND OUR SCHOOLS AND HOSPITALS NOW', stance: 'left' },
      { paper: 'The Courier', title: 'CAN NEW PM CONTROL SPENDING AND DEFEND THE SHIRES?', stance: 'right' },
    ],
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
  const swing = Math.round((playerSeats - 350) / 30);
  const approval = clamp(s.metrics.approval + (majority ? swing + 3 : -12), 0, 100);
  const message = `GENERAL ELECTION: ${playerParty?.name ?? '?'} won ${playerSeats} seats ${majority ? '(Working Majority)' : '(Hung Parliament)'}.`;
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
  const metrics = {
    approval: clamp(s.metrics.approval + (fx.approval ?? 0), 0, 100),
    partyConfidence: clamp(s.metrics.partyConfidence + (fx.partyConfidence ?? 0), 0, 100),
    economy: clamp(s.metrics.economy + (fx.economy ?? 0), 0, 100),
    publicServices: clamp(s.metrics.publicServices + (fx.publicServices ?? 0), 0, 100),
    security: clamp(s.metrics.security + (fx.security ?? 0), 0, 100),
    mediaAttention: clamp(s.metrics.mediaAttention + (fx.mediaAttention ?? 0), 0, 100),
  };
  const stats = {
    cpiInflation: Math.max(0.5, Math.round((s.stats.cpiInflation + (fx.cpiInflation ?? 0)) * 10) / 10),
    gdpGrowth: Math.round((s.stats.gdpGrowth + (fx.gdpGrowth ?? 0)) * 10) / 10,
    giltYield: Math.max(1.0, Math.round((s.stats.giltYield + (fx.giltYield ?? 0)) * 100) / 100),
    nhsWaitingList: Math.max(2.0, Math.round((s.stats.nhsWaitingList + (fx.nhsWaitingList ?? 0)) * 10) / 10),
    netMigration: Math.max(50, s.stats.netMigration + (fx.netMigration ?? 0)),
    lettersOfNoConfidence: clamp(s.stats.lettersOfNoConfidence + (fx.lettersDelta ?? 0), 0, 54),
  };
  return { ...s, parties, metrics, stats };
}

function advanceWeek(s: GameState): GameState {
  let next: GameState = {
    ...s,
    week: s.week + 1,
    selectedDossierId: null,
    lastOutcome: null,
    isElection: false,
  };

  const eco = next.metrics.economy;
  const serv = next.metrics.publicServices;
  let approval = next.metrics.approval + (eco >= 58 ? 1 : eco <= 44 ? -1 : 0) + (serv >= 55 ? 1 : serv <= 42 ? -1 : 0);
  let confidence = next.metrics.partyConfidence + (approval >= 50 ? 1 : -1);

  let letters = next.stats.lettersOfNoConfidence;
  if (confidence < 40) letters += 2;
  else if (confidence > 60 && letters > 0) letters -= 1;
  letters = clamp(letters, 0, 54);

  approval = clamp(approval, 0, 100);
  confidence = clamp(confidence, 0, 100);
  next = {
    ...next,
    metrics: { ...next.metrics, approval, partyConfidence: confidence },
    stats: { ...next.stats, lettersOfNoConfidence: letters },
  };

  // Age dossiers; escalate ignored urgent crises.
  const remaining: Dossier[] = [];
  for (const d of next.redBox) {
    if (d.weeksRemaining <= 1) {
      if (d.urgent) {
        next = applyEffects(next, { approval: -3, partyConfidence: -2, mediaAttention: 10 });
        next.log = [`CRISIS ESCALATION: ${d.title} went unanswered and damaged the government.`, ...(next.log ?? [])].slice(0, 50);
      }
      // Non-urgent dossiers with no time left simply lapse.
    } else {
      remaining.push({ ...d, weeksRemaining: d.weeksRemaining - 1 });
    }
  }

  // Draw one fresh dossier (if room) into the Red Box.
  const activeIds = new Set(remaining.map((d) => d.id));
  const available = DOSSIER_POOL.filter((d) => !activeIds.has(d.id));
  if (available.length > 0 && remaining.length < 4) {
    const pick = available[Math.floor(Math.random() * available.length)];
    remaining.push({ ...pick });
  }
  next.redBox = remaining;

  const turnsUntilElection = next.turnsUntilElection - 1;
  next = { ...next, turnsUntilElection };

  if (turnsUntilElection <= 0) {
    next = runElection(next);
  }

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
      const seats = electSeats(parties, REGIONS);
      const withSeats = parties.map((p) => ({ ...p, seats: seats[p.id] ?? 0 }));
      const mySeats = withSeats.find((p) => p.id === action.player.partyId)?.seats ?? 0;
      return {
        ...state,
        player: action.player,
        parties: withSeats,
        phase: 'playing',
        log: [`${fullName} enters Downing Street with ${mySeats} seats in the Commons.`, ...state.log].slice(0, 50),
      };
    }

    case 'START_TURN':
      return advanceWeek(state);

    case 'OPEN_DOSSIER':
      return { ...state, selectedDossierId: action.dossierId };

    case 'CLOSE_DOSSIER':
      return { ...state, selectedDossierId: null };

    case 'RESOLVE_DOSSIER': {
      const dossier = state.redBox.find((d) => d.id === action.dossierId);
      if (!dossier) return state;
      const choice = dossier.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;

      let next = applyEffects(state, choice.effects);
      next = {
        ...next,
        redBox: next.redBox.filter((d) => d.id !== action.dossierId),
        selectedDossierId: null,
        lastOutcome: `${dossier.title}: ${choice.label} \u2014 ${choice.summary}`,
        log: [`[${dossier.department}] ${dossier.title}: ${choice.label}`, ...next.log].slice(0, 50),
        headlines: [
          { paper: 'The National Standard', title: `${choice.label.toUpperCase()}: PM SIGNS OFF POLICY`, stance: 'centrist' },
          { paper: 'The Clarion', title: `GOVERNMENT DECISION ON ${dossier.department.toUpperCase()} DRAWS MIXED REACTION`, stance: 'left' },
          { paper: 'The Courier', title: `WHITEHALL REACTS AS PM CHOOSES COURSE ON ${dossier.title.toUpperCase()}`, stance: 'right' },
        ],
      };
      return next;
    }

    default:
      return state;
  }
}
