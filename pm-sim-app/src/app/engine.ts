import type { GameState, Action, Party, Effects, Dossier, Bill } from './types';
import { INITIAL_PARTIES, INITIAL_RELATIONS, REGIONS, DOSSIER_POOL } from './data';
import { BILL_POOL } from './bills';
import type { Region } from './data';

export const FPTP_EXPONENT = 2.5;

const r1 = (n: number) => Math.round(n * 10) / 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Realistic 1922 threshold = 15% of the parliamentary party (min 15). */
function resignationThreshold(seats: number): number {
  return Math.max(15, Math.round(seats * 0.15));
}

/** Deterministic LCG PRNG so saves/replays reproduce identical worlds. */
function nextRandom(seed: number): { v: number; s: number } {
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  const n = (a * seed + c) % m;
  return { v: n / m, s: n };
}

export function createInitialState(): GameState {
  return {
    phase: 'menu',
    player: null,
    parties: INITIAL_PARTIES.map((p) => ({ ...p })),
    relations: INITIAL_RELATIONS.map((r) => ({ ...r })),
    metrics: { approval: 48, partyConfidence: 62, economy: 55, publicServices: 50, security: 58, mediaAttention: 35 },
    stats: {
      cpiInflation: 2.8,
      gdpGrowth: 1.1,
      giltYield: 4.15,
      nhsWaitingList: 7.2,
      netMigration: 420,
      lettersOfNoConfidence: 8,
      lettersThreshold: 15,
      taxRate: 33,
      debtToGdp: 98,
      unemployment: 4.2,
      budgetBalance: -75,
    },
    week: 1,
    turnsUntilElection: 60,
    isElection: false,
    redBox: [{ ...DOSSIER_POOL[0] }, { ...DOSSIER_POOL[2] }],
    selectedDossierId: null,
    lastOutcome: null,
    bills: [],
    passedLaws: [],
    headlines: [
      { paper: 'The National Standard', title: 'NEW PRIME MINISTER SETS OUT DOWNING STREET AGENDA', stance: 'centrist' },
      { paper: 'The Clarion', title: 'UNIONS WARN: FUND OUR SCHOOLS AND HOSPITALS NOW', stance: 'left' },
      { paper: 'The Courier', title: 'CAN NEW PM CONTROL SPENDING AND DEFEND THE SHIRES?', stance: 'right' },
    ],
    log: [],
    seed: 20260211,
    gameOver: null,
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
    stats: {
      ...s.stats,
      lettersOfNoConfidence: 0, // fresh mandate resets the revolt
      lettersThreshold: resignationThreshold(playerSeats),
    },
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
    cpiInflation: r1(Math.max(0.4, s.stats.cpiInflation + (fx.cpiInflation ?? 0))),
    gdpGrowth: r1(s.stats.gdpGrowth + (fx.gdpGrowth ?? 0)),
    giltYield: Math.max(1.0, r1(s.stats.giltYield + (fx.giltYield ?? 0))),
    nhsWaitingList: r1(Math.max(2.0, s.stats.nhsWaitingList + (fx.nhsWaitingList ?? 0))),
    netMigration: Math.max(50, s.stats.netMigration + (fx.netMigration ?? 0)),
    lettersOfNoConfidence: clamp(s.stats.lettersOfNoConfidence + (fx.lettersDelta ?? 0), 0, 99),
    lettersThreshold: s.stats.lettersThreshold,
    taxRate: r1(clamp(s.stats.taxRate + (fx.taxRate ?? 0), 15, 60)),
    debtToGdp: r1(Math.max(30, s.stats.debtToGdp + (fx.debtToGdp ?? 0))),
    unemployment: r1(Math.max(1.5, s.stats.unemployment + (fx.unemployment ?? 0))),
    budgetBalance: r1(s.stats.budgetBalance + (fx.budgetBalance ?? 0)),
  };
  return { ...s, parties, metrics, stats };
}

function driftPolling(s: GameState, rng: () => number): GameState {
  const parties = s.parties.map((p) => {
    let target = p.baseSupport;
    if (p.id === s.player?.partyId) {
      target = clamp(p.baseSupport + (s.metrics.approval - 50) / 5, 5, 55);
    } else {
      target = p.baseSupport + (rng() * 2 - 1);
    }
    const next = p.currentSupport + (target - p.currentSupport) * 0.15;
    return { ...p, currentSupport: r1(clamp(next, 1, 60)) };
  });
  return { ...s, parties };
}

function weeklyEconomy(s: GameState): GameState {
  const st = s.stats;
  let gilt = st.giltYield;
  let debt = st.debtToGdp;
  let confidence = s.metrics.partyConfidence;

  if (st.budgetBalance < -100) { gilt += 0.15; debt += 1.5; confidence -= 1; }
  else if (st.budgetBalance < -40) { gilt += 0.05; debt += 0.5; }
  else if (st.budgetBalance > 20) { gilt -= 0.05; debt -= 0.5; }
  if (debt > 100) gilt += 0.1;

  let approval = s.metrics.approval;
  if (st.cpiInflation > 4) approval -= 1;
  if (st.unemployment > 6) approval -= 1;
  approval = clamp(approval, 0, 100);

  return {
    ...s,
    stats: { ...st, giltYield: Math.max(1.0, r1(gilt)), debtToGdp: r1(Math.max(30, debt)) },
    metrics: { ...s.metrics, approval, partyConfidence: clamp(confidence, 0, 100) },
  };
}

function resolveBill(s: GameState, bill: Bill, rng: () => number): GameState {
  const party = s.parties.find((p) => p.id === s.player?.partyId);
  const seats = party?.seats ?? 0;

  let passed: boolean;
  if (seats >= 360) passed = true;
  else if (seats >= 326) passed = rng() < 0.92;
  else if (seats >= 300) passed = rng() < 0.6;
  else passed = false;

  let letters = s.stats.lettersOfNoConfidence + Math.round(bill.rebellionRisk / 8);
  let next = s;

  if (passed) {
    next = applyEffects(next, bill.effects);
    next = {
      ...next,
      stats: { ...next.stats, budgetBalance: r1(next.stats.budgetBalance - bill.fiscalCost) },
      passedLaws: [bill.title, ...next.passedLaws],
      log: [`LAW PASSED: ${bill.title}`, ...(next.log ?? [])].slice(0, 50),
      headlines: [{ paper: 'The National Standard', title: bill.kicker, stance: 'centrist' }, ...next.headlines].slice(0, 4),
    };
  } else {
    next = applyEffects(next, { approval: -2, partyConfidence: -2 });
    letters += Math.round(bill.rebellionRisk / 4);
    next = { ...next, log: [`BILL DEFEATED: ${bill.title}`, ...(next.log ?? [])].slice(0, 50) };
  }

  next = { ...next, stats: { ...next.stats, lettersOfNoConfidence: clamp(letters, 0, 99) } };
  return next;
}

function advanceWeek(s: GameState): GameState {
  let seed = (s.seed ?? 20260211) >>> 0;
  const rng = (): number => {
    const r = nextRandom(seed);
    seed = r.s;
    return r.v;
  };

  let next: GameState = {
    ...s,
    week: s.week + 1,
    selectedDossierId: null,
    lastOutcome: null,
    isElection: false,
  };

  // 1. Age dossiers; escalate ignored urgent crises.
  const remaining: Dossier[] = [];
  for (const d of next.redBox) {
    if (d.weeksRemaining <= 1) {
      if (d.urgent) {
        next = applyEffects(next, { approval: -3, partyConfidence: -2, mediaAttention: 10 });
        next.log = [`CRISIS ESCALATION: ${d.title} went unanswered and damaged the government.`, ...(next.log ?? [])].slice(0, 50);
      }
    } else {
      remaining.push({ ...d, weeksRemaining: d.weeksRemaining - 1 });
    }
  }

  // 2. Advance bills; resolve those reaching division.
  const stillActive: Bill[] = [];
  for (const b of next.bills) {
    if (b.weeksToPass <= 1) {
      next = resolveBill(next, b, rng);
    } else {
      stillActive.push({ ...b, weeksToPass: b.weeksToPass - 1 });
    }
  }
  next.bills = stillActive;

  // 3. Economy & polling feedback.
  next = weeklyEconomy(next);
  next = driftPolling(next, rng);

  // 4. 1922 letters follow confidence.
  let letters = next.stats.lettersOfNoConfidence;
  if (next.metrics.partyConfidence < 40) letters += 2;
  else if (next.metrics.partyConfidence > 60 && letters > 0) letters -= 1;
  letters = clamp(letters, 0, 99);
  next = { ...next, stats: { ...next.stats, lettersOfNoConfidence: letters } };

  // 5. Confidence vote if the threshold is crossed.
  const threshold = next.stats.lettersThreshold || 15;
  if (letters >= threshold && !next.gameOver) {
    const conf = next.metrics.partyConfidence;
    const chance = conf >= 60 ? 0.9 : conf >= 50 ? 0.7 : conf >= 40 ? 0.5 : 0.25;
    const survive = rng() < chance;
    const name = next.player ? `${next.player.firstName} ${next.player.lastName}` : 'The Prime Minister';

    if (survive) {
      next = {
        ...next,
        stats: { ...next.stats, lettersOfNoConfidence: Math.round(threshold * 0.2) },
        metrics: { ...next.metrics, partyConfidence: clamp(conf - 5, 0, 100) },
        log: [`CONFIDENCE VOTE: ${name} SURVIVES a leadership challenge.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: 'PM SURVIVES CONFIDENCE VOTE BUT EMERGES WOUNDED', stance: 'centrist' }, ...next.headlines].slice(0, 4),
      };
    } else {
      next = {
        ...next,
        gameOver: `${name} lost a vote of no confidence among their own MPs and was forced to resign.`,
        stats: { ...next.stats, lettersOfNoConfidence: threshold },
        log: [`CONFIDENCE VOTE: ${name} LOSES and is forced to resign.`, ...next.log].slice(0, 50),
      };
    }
  }

  // 6. Draw one fresh dossier into the Red Box.
  const activeIds = new Set(remaining.map((d) => d.id));
  const available = DOSSIER_POOL.filter((d) => !activeIds.has(d.id));
  if (available.length > 0 && remaining.length < 4) {
    const pick = available[Math.floor(rng() * available.length)];
    remaining.push({ ...pick });
  }
  next.redBox = remaining;

  // 7. Election countdown.
  const turnsUntilElection = next.turnsUntilElection - 1;
  next = { ...next, turnsUntilElection };
  if (turnsUntilElection <= 0 && !next.gameOver) {
    next = runElection(next);
  }

  next.seed = seed >>> 0;
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
        stats: { ...state.stats, lettersThreshold: resignationThreshold(mySeats) },
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

    case 'PROPOSE_BILL': {
      const blueprint = BILL_POOL.find((b) => b.id === action.billId);
      if (!blueprint) return state;
      const already = state.bills.some((b) => b.id === blueprint.id) || state.passedLaws.includes(blueprint.title);
      if (already) return state;
      const bill: Bill = { ...blueprint, weeksToPass: blueprint.weeksToPass };
      return {
        ...state,
        bills: [...state.bills, bill],
        log: [`BILL INTRODUCED: ${bill.title} (will face a division in ${bill.weeksToPass} weeks)`, ...state.log].slice(0, 50),
      };
    }

    default:
      return state;
  }
}
