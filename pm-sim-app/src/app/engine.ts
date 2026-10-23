import type { GameState, Action, Party, Effects, Dossier, Bill, Minister } from './types';
import { INITIAL_PARTIES, INITIAL_RELATIONS, REGIONS, DOSSIER_POOL } from './data';
import { BILL_POOL } from './bills';
import { BILL_POOL_2 } from './bills2';
import { DEFAULT_CABINET, FOREIGN_POOL, PMQ_POOL, BACKBENCHERS } from './politics';
import { BUDGET_PACKAGES } from './budget';
import { INITIAL_TAXES, TAX_YIELD_PER_POINT } from './taxes';
import { INITIAL_DEPARTMENTS } from './spending';
import type { Region } from './data';

export const FPTP_EXPONENT = 2.5;

const r1 = (n: number) => Math.round(n * 10) / 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function resignationThreshold(seats: number): number {
  return Math.max(15, Math.round(seats * 0.15));
}

/** Deterministic LCG PRNG. */
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
    cabinet: DEFAULT_CABINET.map((m) => ({ ...m })),
    factionUnrest: 20,
    foreignIssues: [],
    pmq: null,
    budgetDue: false,
    backbenchers: BACKBENCHERS.map((b) => ({ ...b })),
    termLength: 60,
    taxes: INITIAL_TAXES.map((t) => ({ ...t })),
    fiscalEventKind: null,
    departments: INITIAL_DEPARTMENTS.map((d) => ({ ...d })),
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
    stats: { ...s.stats, lettersOfNoConfidence: 0, lettersThreshold: resignationThreshold(playerSeats) },
    turnsUntilElection: s.termLength || 60,
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

export function advanceWeek(s: GameState): GameState {
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

  // 2. Advance bills.
  const stillActive: Bill[] = [];
  for (const b of next.bills) {
    if (b.weeksToPass <= 1) next = resolveBill(next, b, rng);
    else stillActive.push({ ...b, weeksToPass: b.weeksToPass - 1 });
  }
  next.bills = stillActive;

  // 3. Economy & polling.
  next = weeklyEconomy(next);
  next = driftPolling(next, rng);

  // 4. 1922 letters.
  let letters = next.stats.lettersOfNoConfidence;
  if (next.metrics.partyConfidence < 40) letters += 2;
  else if (next.metrics.partyConfidence > 60 && letters > 0) letters -= 1;
  letters = clamp(letters, 0, 99);
  next = { ...next, stats: { ...next.stats, lettersOfNoConfidence: letters } };

  // 5. Confidence vote.
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

  // 6. Cabinet faction unrest and possible leak/resignation.
  let unrest = next.factionUnrest;
  if (next.metrics.partyConfidence < 40) unrest += 3;
  else if (next.metrics.partyConfidence > 60) unrest -= 1;
  unrest = clamp(unrest, 0, 100);
  next = { ...next, factionUnrest: unrest };

  // Occasional minister leak.
  if (next.cabinet.length > 0 && !next.gameOver && rng() < 0.12) {
    const idx = Math.floor(rng() * next.cabinet.length);
    const mins = next.cabinet.map((m, i) => (i === idx ? { ...m, loyalty: clamp(m.loyalty - 10, 0, 100) } : m));
    next = {
      ...next,
      cabinet: mins,
      log: [`CABINET LEAK: A minister briefed against the government.`, ...next.log].slice(0, 50),
      headlines: [{ paper: 'The Courier', title: 'CABINET RIFT AS MINISTER BRIEFS AGAINST PM', stance: 'right' }, ...next.headlines].slice(0, 4),
    };
  }

  // 7. Draw fresh dossier.
  const activeIds = new Set(remaining.map((d) => d.id));
  const available = DOSSIER_POOL.filter((d) => !activeIds.has(d.id));
  if (available.length > 0 && remaining.length < 4) {
    const pick = available[Math.floor(rng() * available.length)];
    remaining.push({ ...pick });
  }
  next.redBox = remaining;

  // 8. Every ~5 weeks, PMQs or a foreign call arises.
  if (next.week % 5 === 0 && !next.gameOver && !next.pmq) {
    next.pmq = PMQ_POOL[Math.floor(rng() * PMQ_POOL.length)];
  }
  if (next.week % 7 === 0 && !next.gameOver && next.foreignIssues.length < 2) {
    const fi = FOREIGN_POOL[Math.floor(rng() * FOREIGN_POOL.length)];
    if (!next.foreignIssues.some((f) => f.id === fi.id)) {
      next.foreignIssues = [...next.foreignIssues, { ...fi }];
    }
  }

  // 8b. Two fiscal events per year: Autumn Statement (week % 6 == 0) and Budget (week % 12 == 0).
  if (!next.gameOver) {
    if (next.week % 12 === 0) {
      next.budgetDue = true;
      next.fiscalEventKind = 'budget';
    } else if (next.week % 6 === 0) {
      next.budgetDue = true;
      next.fiscalEventKind = 'autumn';
    }
  }

  // 9. Election countdown.
  const turnsUntilElection = next.turnsUntilElection - 1;
  next = { ...next, turnsUntilElection };
  if (turnsUntilElection <= 0 && !next.gameOver) next = runElection(next);

  next.seed = seed >>> 0;
  return next;
}

function resignMinister(s: GameState, name: string): GameState {
  const m = s.cabinet.find((x) => x.name === name);
  if (!m) return s;
  return {
    ...s,
    cabinet: s.cabinet.filter((x) => x.name !== name),
    factionUnrest: clamp(s.factionUnrest + 8, 0, 100),
    log: [`CABINET: ${m.name} sacked as ${m.post}.`, ...s.log].slice(0, 50),
  };
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
      const allBills = [...BILL_POOL, ...BILL_POOL_2];
      const blueprint = allBills.find((b) => b.id === action.billId);
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

    case 'SACK_MINISTER':
      return resignMinister(state, action.name);

    case 'APPOINT_MINISTER': {
      const post = action.post;
      const candidates = state.backbenchers.filter((b) => b.partyId === state.player?.partyId);
      if (candidates.length === 0) return state;
      // Promote the most loyal (with a competence tilt) available backbencher.
      const candidate = [...candidates].sort((a, b) => (b.loyalty + b.competence * 0.4) - (a.loyalty + a.competence * 0.4))[0];
      const minister: Minister = {
        name: candidate.name,
        post,
        partyId: candidate.partyId,
        loyalty: candidate.loyalty,
        competence: candidate.competence,
        faction: candidate.faction,
      };
      return {
        ...state,
        cabinet: [...state.cabinet, minister],
        backbenchers: state.backbenchers.filter((b) => b.name !== candidate.name),
        log: [`CABINET: ${candidate.name} appointed ${post}.`, ...state.log].slice(0, 50),
      };
    }

    case 'SET_TERM_LENGTH':
      return { ...state, termLength: action.weeks, turnsUntilElection: action.weeks };

    case 'RESOLVE_FOREIGN': {
      const issue = state.foreignIssues.find((f) => f.id === action.issueId);
      if (!issue) return state;
      const opt = issue.options.find((o) => o.id === action.optionId);
      if (!opt) return state;
      let next = applyEffects(state, opt.effects);
      next = {
        ...next,
        foreignIssues: next.foreignIssues.filter((f) => f.id !== action.issueId),
        log: [`DIPLOMACY: ${issue.country} (${issue.leader}) \u2014 ${opt.label}`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: `${issue.country.toUpperCase()}: PM MEETS ${issue.leader.toUpperCase()}`, stance: 'centrist' }, ...next.headlines].slice(0, 4),
      };
      return next;
    }

    case 'ANSWER_PMQ': {
      const q = state.pmq;
      if (!q) return state;
      const opt = q.options.find((o) => o.id === action.optionId);
      if (!opt) return state;
      const next = applyEffects(state, opt.effects);
      return {
        ...next,
        pmq: null,
        log: [`PMQS: Answered a question from ${q.from}.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The Clarion', title: `PMQS: PM FACES ${q.from.toUpperCase()} ON THE ECONOMY`, stance: 'left' }, ...next.headlines].slice(0, 4),
      };
    }

    case 'DISMISS_PMQ':
      return { ...state, pmq: null };

    case 'DELIVER_BUDGET': {
      const pkg = BUDGET_PACKAGES.find((b) => b.id === action.packageId);
      if (!pkg) return state;
      let next = applyEffects(state, pkg.effects);
      next = {
        ...next,
        budgetDue: false,
        fiscalEventKind: null,
        log: [`BUDGET: ${pkg.title} delivered by the Chancellor.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: pkg.kicker, stance: 'centrist' }, ...next.headlines].slice(0, 4),
      };
      return next;
    }

    case 'SKIP_BUDGET':
      return {
        ...state,
        budgetDue: false,
        fiscalEventKind: null,
        log: [`FISCAL EVENT DEFERRED: The Chancellor postponed the statement.`, ...state.log].slice(0, 50),
      };

    case 'ADJUST_TAX': {
      const idx = state.taxes.findIndex((t) => t.id === action.taxId);
      if (idx < 0) return state;
      const tax = state.taxes[idx];
      const rate = clamp(r1(tax.rate + action.delta), tax.min, tax.max);
      if (rate === tax.rate) return state; // no change
      const taxes = state.taxes.map((t, i) => (i === idx ? { ...t, rate } : t));
      const delta = rate - tax.rate;
      // Fiscal yield: raising tax improves the budget, lowers approval; vice versa.
      const yieldChange = delta * (TAX_YIELD_PER_POINT[tax.id] ?? 0);
      const approvalChange = -delta * tax.popularityWeight;
      let next = applyEffects(state, {
        approval: approvalChange,
        budgetBalance: yieldChange,
        taxRate: tax.id === 'income' ? delta : 0,
      });
      next = { ...next, taxes };
      return next;
    }

    case 'SET_AUTUMN_TAXES': {
      // The Autumn Statement delivers the tax changes set since the last Budget.
      return {
        ...state,
        budgetDue: false,
        fiscalEventKind: null,
        log: [`AUTUMN STATEMENT: Tax measures delivered.`, ...state.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: 'AUTUMN STATEMENT: CHANCELLOR SETS OUT TAX PLAN', stance: 'centrist' }, ...state.headlines].slice(0, 4),
      };
    }

    case 'DISMISS_ELECTION':
      return { ...state, isElection: false };

    default:
      return state;
  }
}
