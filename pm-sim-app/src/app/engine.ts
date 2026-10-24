import type { GameState, Action, Party, Effects, Dossier, Bill, Minister, PmqQuestion } from './types';
import { INITIAL_PARTIES, INITIAL_RELATIONS, REGIONS, DOSSIER_POOL } from './data';
import { BILL_POOL } from './bills';
import { BILL_POOL_2 } from './bills2';
import { DEFAULT_CABINET, FOREIGN_POOL, PMQ_POOL, BACKBENCHERS } from './politics';
import { BUDGET_PACKAGES } from './budget';
import { INITIAL_TAXES, TAX_YIELD_PER_POINT } from './taxes';
import { INITIAL_DEPARTMENTS } from './spending';
import type { Region } from './data';

// ===== Simulation modules (all of these run inside advanceWeek) =====
import { calculateFiscalDrag, fiscalDragToEffects, FROZEN_THRESHOLDS } from './fiscalDragIntegration';
import { calculateTradeDealEconomics, DEFAULT_TRADE_DEAL_STATUS } from './tradeDeals';
import { calculateNHSPerformance } from './nhsMetrics';
import type { NHSMetrics } from './nhsMetrics';
import { DEFAULT_SPENDING_REVIEW } from './spendingReview';
import { calculate1922Mood, calculateBlindsideRisk } from './leadershipChallenge';
import { DOSSIER_POOL_2 } from './dossiers2';
import { DOSSIER_POOL_3 } from './dossiers3';
import { applyScenario } from './scenarios';
import { makePledges, evaluatePledges } from './pledges';
import { computeBlocs, blocAverage } from './voterBlocs';
import { projectSeats } from './electionProjection';

/** Placeholder partner ministers; enough variety to staff a coalition. */
const COALITION_NAMES = [
  'Sarah Whitcombe',
  'Daniel Okafor',
  'Priya Raman',
  'Callum Reid',
  'Nadia Haddad',
  'Tom Beresford',
];

export const FPTP_EXPONENT = 2.5;

/** Full dossier pool: the original six plus both expanded slates. */
const ALL_DOSSIERS = [...DOSSIER_POOL, ...DOSSIER_POOL_2, ...DOSSIER_POOL_3];

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
    redBox: [{ ...ALL_DOSSIERS[0] }, { ...ALL_DOSSIERS[2] }],
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
    legacyScore: 0,
    termsWon: 0,
    regionSeats: {},
    ministerPicker: null,
    nhsPerformance: 50,
    fiscalDragRevenue: 0,
    fiscalDragIntensity: 'low',
    taxpayersAffectedByDrag: 0,
    thresholdFrozenTurns: 0,
    tradeGdpImpact: 0,
    committeeMood: undefined,
    pledges: [],
    blocs: [],
    oppositionMotion: undefined,
    coalition: false,
    coalitionPosts: [],
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

function runElection(s: GameState): GameState {
  const detail = projectSeats(s);
  const seats = detail.totals;
  const parties = s.parties.map((p) => ({ ...p, seats: seats[p.id] ?? 0 }));
  const playerParty = parties.find((p) => p.id === s.player?.partyId);
  const playerSeats = playerParty?.seats ?? 0;
  const majority = playerSeats >= 326;
  const swing = Math.round((playerSeats - 350) / 30);
  const approval = clamp(s.metrics.approval + (majority ? swing + 3 : -12), 0, 100);
  const message = `GENERAL ELECTION: ${playerParty?.name ?? '?'} won ${playerSeats} seats ${majority ? '(Working Majority)' : '(Hung Parliament)'}.`;
  // Legacy score from governing quality; a second term rewards survival.
  const legacyScore = s.legacyScore + Math.round(s.metrics.approval / 10) + Math.round(s.metrics.economy / 10) + (majority ? 5 : 0);
  const termsWon = majority ? s.termsWon + 1 : s.termsWon;
  return {
    ...s,
    parties,
    metrics: { ...s.metrics, approval },
    stats: { ...s.stats, lettersOfNoConfidence: 0, lettersThreshold: resignationThreshold(playerSeats) },
    turnsUntilElection: s.termLength || 60,
    isElection: true,
    legacyScore,
    termsWon,
    regionSeats: detail.byRegion,
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
    approval: clamp(
      s.metrics.approval +
        // Diminishing returns: a government already riding high gets
        // little credit for one more popular decision.
        ((fx.approval ?? 0) > 0
          ? (fx.approval ?? 0) * (1 - s.metrics.approval / 110)
          : (fx.approval ?? 0)),
      0,
      100,
    ),
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

/** Baseline rates for each lever, used to score policy against the start position. */
const TAX_BASELINES: Record<string, number> = {
  income: 20,
  ni: 8,
  vat: 20,
  corporation: 25,
  capgains: 20,
  inheritance: 40,
};

/**
 * Where the deficit wants to settle given current policy.
 *
 * One-off decisions (a bailout, a budget package) should fade; only the
 * structural position - tax rates, department budgets, fiscal drag and the
 * interest bill - should persist. That keeps the deficit from compounding
 * into a debt spiral while still punishing expensive government.
 */
/**
 * The money the government is actually planning to spend this year.
 *
 * Spending plus the planned deficit: the envelope the departments are funded
 * from. The UI reads this instead of inventing its own revenue assumption, so
 * the Treasury tab and the deficit headline can never disagree again.
 */
export function fundedEnvelope(s: GameState): { spend: number; plannedDeficit: number; envelope: number } {
  const spend = s.departments.reduce((sum, d) => sum + d.budget, 0);
  const plannedDeficit = Math.max(0, -s.stats.budgetBalance);
  return { spend, plannedDeficit, envelope: spend + plannedDeficit };
}

// ===== PMQs =====
// A session is a proper exchange: the Leader of the Opposition gets six
// questions, then the third party gets two.
const PMQ_ROUNDS = 8;
const PMQ_LOTO_ROUNDS = 6;

/** Deterministic 0..1 draw so the reducer stays a pure function. */
function seededRandom(seed: number): number {
  const x = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return x / 4294967296;
}

/** Rival parties, largest first, excluding the government. */
function rivalParties(s: GameState): Party[] {
  return [...s.parties].filter((p) => p.id !== s.player?.partyId).sort((a, b) => b.seats - a.seats);
}

/** Build question `round` of the exchange. */
function pmqQuestion(s: GameState, round: number): PmqQuestion {
  const asker: 'loto' | 'third' = round <= PMQ_LOTO_ROUNDS ? 'loto' : 'third';
  const rivals = rivalParties(s);
  const source = asker === 'loto' ? rivals[0] : rivals[1] ?? rivals[0];
  const draw = seededRandom((s.seed + round * 7919 + s.week * 104729) >>> 0);
  const q = PMQ_POOL[Math.floor(draw * PMQ_POOL.length)];
  return { ...q, from: source ? `${source.name} leader` : q.from, asker, round, total: PMQ_ROUNDS };
}

export function structuralBalance(s: GameState): number {
  const BASE_DEFICIT = -75;
  const BASE_SPEND = 510;
  const spendNow = s.departments.reduce((sum, d) => sum + d.budget, 0);
  const taxDelta = s.taxes.reduce(
    (sum, t) => sum + (t.rate - (TAX_BASELINES[t.id] ?? t.rate)) * (TAX_YIELD_PER_POINT[t.id] ?? 0),
    0,
  );
  const drag = s.fiscalDragRevenue ?? 0;
  const interestBill = Math.max(0, (s.stats.debtToGdp - 100) * 0.6);
  return BASE_DEFICIT + taxDelta - (spendNow - BASE_SPEND) + drag - interestBill;
}

function weeklyEconomy(s: GameState): GameState {
  const st = s.stats;
  const structural = structuralBalance(s);

  // Published borrowing converges on the structural position at roughly
  // 10% a week, so a one-off bailout fades instead of compounding forever.
  const balance = r1(st.budgetBalance + (structural - st.budgetBalance) * 0.1);

  let gilt = st.giltYield;
  let debt = st.debtToGdp;
  let confidence = s.metrics.partyConfidence;

  if (structural < -120) {
    gilt += 0.08;
    debt += Math.min(0.35, -structural / 400);
    confidence -= 1;
  } else if (structural < -60) {
    gilt += 0.04;
    debt += Math.min(0.25, -structural / 500);
  } else if (structural > 0) {
    gilt -= 0.04;
    debt -= 0.2;
  }
  if (debt > 100) gilt += 0.05;
  if (debt > 130) gilt += 0.1;

  // Expensive borrowing is the price of a loose fiscal stance: it drags on
  // the real economy, which in turn drags on your approval target.
  let economy = s.metrics.economy;
  if (st.giltYield > 6) economy -= 0.5;
  else if (st.giltYield > 5) economy -= 0.25;
  else if (st.giltYield < 3.5 && st.cpiInflation < 3) economy += 0.15;
  economy = clamp(economy, 0, 100);

  let approval = s.metrics.approval;

  // Approval is not a score you bank: it drifts back toward what the
  // economy, services and inflation actually justify. Good weeks still
  // spike it, but nothing stays at 90% for a whole parliament.
  const approvalTarget = clamp(
    35 + (s.metrics.economy - 50) * 0.25 + (s.metrics.publicServices - 50) * 0.2 - (st.cpiInflation - 2) * 2,
    10,
    65,
  );
  approval += (approvalTarget - approval) * 0.09;

  if (st.cpiInflation > 4) approval -= 1;
  if (st.unemployment > 6) approval -= 1;
  approval = clamp(approval, 0, 100);

  // Unity recovers toward the level your popularity can sustain, so one
  // bad month does not doom the premiership but drift still punishes you.
  const unityTarget = clamp(45 + (approval - 50) * 0.5, 15, 85);
  confidence += (unityTarget - confidence) * 0.06;

  return {
    ...s,
    stats: { ...st, budgetBalance: balance, giltYield: Math.max(1.0, r1(gilt)), debtToGdp: r1(Math.max(30, debt)) },
    metrics: { ...s.metrics, approval, economy, partyConfidence: clamp(confidence, 0, 100) },
  };
}

function resolveBill(s: GameState, bill: Bill, rng: () => number): GameState {
  const party = s.parties.find((p) => p.id === s.player?.partyId);
  const ownSeats = party?.seats ?? 0;
  // A confidence-and-supply partner votes with the government on money and
  // confidence, which is what actually carries a bill through the lobbies.
  const partner = s.supplyPartnerId
    ? s.parties.find((p) => p.id === s.supplyPartnerId)
    : undefined;
  // Restive coalition ministers vote against the government, costing it seats
  // in the division even while the agreement formally holds.
  const rebels = s.cabinet.filter((m) => m.coalition && m.loyalty < 45 && (m.ambition ?? 50) >= 55);
  const rebelLoss = rebels.length * 15;
  const seats = ownSeats + (partner?.seats ?? 0) - rebelLoss;

  let passed: boolean;
  if (seats >= 360) passed = true;
  else if (seats >= 326) passed = rng() < 0.92;
  else if (seats >= 300) passed = rng() < (partner ? 0.6 : 0.25);
  else passed = false;

  let letters = s.stats.lettersOfNoConfidence + Math.round(bill.rebellionRisk / 8);
  let next = s;

  if (rebels.length > 0) {
    // Punish only the ministers who actually rebelled, by name, so the loyalty
    // hit matches the seat loss computed above.
    const rebelNames = new Set(rebels.map((r) => r.name));
    next = {
      ...next,
      cabinet: next.cabinet.map((m) =>
        rebelNames.has(m.name) ? { ...m, loyalty: clamp(m.loyalty - 8, 0, 100) } : m,
      ),
      log: [
        `COALITION REBELS: ${rebels.length} partner minister${rebels.length > 1 ? 's' : ''} (${rebels.map((r) => r.name).join(', ')}) voted against the government.`,
        ...(next.log ?? []),
      ].slice(0, 50),
    };
  }

  if (passed) {
    next = applyEffects(next, bill.effects);
    next = {
      ...next,
      stats: { ...next.stats, budgetBalance: r1(next.stats.budgetBalance - bill.fiscalCost) },
      passedLaws: [bill.title, ...next.passedLaws],
      log: [`LAW PASSED: ${bill.title}`, ...(next.log ?? [])].slice(0, 50),
      headlines: [{ paper: 'The National Standard', title: bill.kicker, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
    };
  } else {
    next = applyEffects(next, { approval: -2, partyConfidence: -2 });
    letters += Math.round(bill.rebellionRisk / 4);
    next = {
      ...next,
      log: [
        partner || ownSeats >= 326
          ? `BILL DEFEATED: ${bill.title} was voted down.`
          : `BILL DEFEATED: ${bill.title} fell for want of a majority in the Commons.`,
        ...(next.log ?? []),
      ].slice(0, 50),
    };
  }

  next = { ...next, stats: { ...next.stats, lettersOfNoConfidence: clamp(letters, 0, 99) } };
  return next;
}


/** Derive NHS performance metrics from the national waiting list. */
function nhsMetricsFromGame(s: GameState): NHSMetrics {
  const gap = s.stats.nhsWaitingList - 6;
  return {
    aeWaitingTime: clamp(10 + gap * 8, 4, 70),
    cancerWaitTime: clamp(62 + gap * 6, 55, 120),
    ambulanceResponse: clamp(85 - gap * 4, 40, 96),
    bedOccupancy: clamp(88 + gap * 3, 70, 99),
    staffVacancies: clamp(6 + gap * 2, 2, 20),
    mentalHealthWaitlist: clamp(400 + gap * 60, 150, 900),
    prescriptionAccess: 12,
    budgetUtilization: clamp(96 + gap, 80, 100),
    patientSatisfaction: clamp(s.metrics.publicServices, 0, 100),
  };
}

/**
 * NHS drift: under-funding lengthens the waiting list, extra cash shortens
 * it, and a service in crisis drags public services down without needing a
 * headline event.
 */
function weeklyNhsDrift(s: GameState): GameState {
  const performance = calculateNHSPerformance(nhsMetricsFromGame(s));
  const nhsBudget = s.departments.find((d) => d.id === 'nhs')?.budget ?? 190;
  const spendRatio = nhsBudget / 190;
  const waitingDrift = clamp(0.06 - (spendRatio - 1) * 0.6, -0.2, 0.25);
  const serviceDrag = performance < 45 ? -0.5 : performance > 65 ? 0.4 : 0;

  const next = applyEffects(s, {
    nhsWaitingList: waitingDrift,
    publicServices: serviceDrag,
    approval: performance < 35 ? -0.3 : 0,
  });

  return { ...next, nhsPerformance: performance };
}

/**
 * Fiscal drag: with allowances frozen, pay growth drags taxpayers into
 * higher bands. The module returns an annual figure; we apply a monthly
 * slice so a full term accumulates roughly five years of creep.
 */
function weeklyFiscalDrag(s: GameState): GameState {
  const result = calculateFiscalDrag({
    personalAllowance: FROZEN_THRESHOLDS.personalAllowance,
    basicRateCutoff: FROZEN_THRESHOLDS.basicRateCutoff,
    higherRateCutoff: FROZEN_THRESHOLDS.higherRateCutoff,
    additionalRateCutoff: FROZEN_THRESHOLDS.additionalRateCutoff,
    basicRate: 20,
    higherRate: 40,
    additionalRate: 45,
    cpiInflation: s.stats.cpiInflation,
    realIncomeGrowth: s.stats.gdpGrowth,
    fiscalYear: 2024 + Math.floor(s.week / 52),
  });

  let next = applyEffects(s, fiscalDragToEffects(result));
  const frozenTurns = (s.thresholdFrozenTurns ?? 0) + 1;

  next = {
    ...next,
    fiscalDragRevenue: result.additionalRevenue,
    fiscalDragIntensity: result.intensity,
    taxpayersAffectedByDrag: result.taxpayersAffected,
    thresholdFrozenTurns: frozenTurns,
  };

  if (result.additionalRevenue > 0 && frozenTurns > 0 && frozenTurns % 26 === 0) {
    next = {
      ...next,
      log: [`FISCAL DRAG: six months of frozen thresholds is quietly raising £${result.additionalRevenue}bn a year. ${result.taxpayersAffected} taxpayers dragged into a higher band.`, ...(next.log ?? [])].slice(0, 50),
      headlines: [{ paper: 'The Clarion', title: 'FROZEN THRESHOLDS: FAMILIES PAY MORE AS PAY RISES', stance: 'left' as const }, ...(next.headlines ?? [])].slice(0, 4),
    };
  }

  return next;
}

/**
 * Trade position and the spending-review envelope. Both are slow-burn: the
 * trade deal set nudges growth every month, and planning above the review
 * envelope is punished by the bond market every year.
 */
function periodicExternal(s: GameState): GameState {
  let next = s;

  if (next.week % 4 === 0) {
    const economics = calculateTradeDealEconomics(DEFAULT_TRADE_DEAL_STATUS);
    next = applyEffects(next, {
      gdpGrowth: Math.round(economics.gdpImpact * 0.01 * 100) / 100,
      budgetBalance: Math.round(economics.exportGrowth * 0.02 * 100) / 100,
    });
    next = { ...next, tradeGdpImpact: economics.gdpImpact };
  }

  if (next.week % 12 === 0) {
    const envelope =
      DEFAULT_SPENDING_REVIEW.totalCapital +
      DEFAULT_SPENDING_REVIEW.totalResource +
      DEFAULT_SPENDING_REVIEW.totalAnnuity;
    const planned = next.departments.reduce((sum, d) => sum + d.budget, 0);
    if (planned > envelope) {
      next = applyEffects(next, { giltYield: 0.1, approval: -1, partyConfidence: -1 });
      next = {
        ...next,
        log: [`SPENDING REVIEW: departments plan £${Math.round(planned)}bn against a £${Math.round(envelope)}bn envelope. The bond market has noticed.`, ...(next.log ?? [])].slice(0, 50),
      };
    }
  }

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

  // 3e. Voter blocs: recompute who is with you and who has turned.
  const blocs = computeBlocs(next);
  next = { ...next, blocs };
  next = applyEffects(next, { approval: (blocAverage(blocs) - next.metrics.approval) * 0.04 });

  // 3f. Opposition business: without a majority a confidence motion is tabled
  // on a fixed timetable, not by dice roll.
  if (!next.gameOver && !next.oppositionMotion) {
    const pmSeats = next.parties.find((p) => p.id === next.player?.partyId)?.seats ?? 0;
    const partnerSeats = next.supplyPartnerId
      ? next.parties.find((p) => p.id === next.supplyPartnerId)?.seats ?? 0
      : 0;
    const cadence = next.metrics.approval < 30 ? 6 : 12;
    if (pmSeats + partnerSeats < 326 && next.week % cadence === 0) {
      const sponsor = [...next.parties]
        .filter((p) => p.id !== next.player?.partyId)
        .sort((a, b) => b.seats - a.seats)[0];
      if (sponsor) {
        next = {
          ...next,
          oppositionMotion: { sponsorPartyId: sponsor.id, tabledWeek: next.week, scheduledWeek: next.week + 2 },
          log: [`OPPOSITION DAY: ${sponsor.name} tables a motion of no confidence, to be voted on in two weeks.`, ...next.log].slice(0, 50),
        };
      }
    }
  }

  // 3g. Division on the motion.
  if (next.oppositionMotion && next.week >= next.oppositionMotion.scheduledWeek && !next.gameOver) {
    const ownSeats = next.parties.find((p) => p.id === next.player?.partyId)?.seats ?? 0;
    const partnerSeats = next.supplyPartnerId
      ? next.parties.find((p) => p.id === next.supplyPartnerId)?.seats ?? 0
      : 0;
    const defections = Math.round((ownSeats * Math.max(0, 40 - next.metrics.partyConfidence)) / 100);
    const govVotes = Math.max(0, ownSeats + partnerSeats - defections);
    const totalSeats = next.parties.reduce((sum, p) => sum + p.seats, 0) || 650;
    const oppVotes = Math.max(0, totalSeats - govVotes);
    const sponsor = next.parties.find((p) => p.id === next.oppositionMotion?.sponsorPartyId);

    if (govVotes > oppVotes) {
      next = {
        ...next,
        oppositionMotion: undefined,
        metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - 2, 0, 100) },
        log: [`CONFIDENCE MOTION: the government wins ${govVotes}-${oppVotes}.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: `GOVERNMENT SURVIVES ${govVotes}-${oppVotes}`, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
      };
    } else {
      const who = next.player ? `${next.player.firstName} ${next.player.lastName}` : 'The Prime Minister';
      next = {
        ...next,
        gameOver: `${who} lost a motion of no confidence ${govVotes}-${oppVotes}${sponsor ? ' to ' + sponsor.name : ''} and resigned.`,
        oppositionMotion: undefined,
        log: [`CONFIDENCE MOTION: the government is defeated ${govVotes}-${oppVotes}.`, ...next.log].slice(0, 50),
      };
    }
  }
  // 3b. NHS performance and waiting-list drift.
  next = weeklyNhsDrift(next);

  // 3c. Fiscal drag from frozen thresholds.
  next = weeklyFiscalDrag(next);

  // 3d. Trade position and spending-review envelope.
  next = periodicExternal(next);

  // 4. 1922 Committee pressure: graded on party unity and backbench mood.
  const mood = calculate1922Mood(
    next.backbenchers.map((b) => ({ loyalty: b.loyalty, ambition: b.ambition, faction: b.faction })),
  );
  let letters = next.stats.lettersOfNoConfidence;
  const unity = next.metrics.partyConfidence;
  if (unity < 25) letters += 2;
  else if (unity < 40) letters += 1;
  else if (unity > 70) letters -= 2;
  else if (unity > 60) letters -= 1;
  if (mood.consideringDefection >= 2) letters += 1;
  letters = clamp(letters, 0, 99);
  next = { ...next, stats: { ...next.stats, lettersOfNoConfidence: letters }, committeeMood: mood };

  // 4a-ii. Mid-term reshuffle: when the 1922 mood is bad enough, the PM moves
  // the team around to refresh the government and buy off the restive.
  if (
    !next.gameOver &&
    next.cabinet.filter((m) => !m.coalition).length > 1 &&
    (next.lastReshuffleWeek ?? -99) + 8 <= next.week &&
    (mood.consideringDefection >= 2 || mood.averageLoyalty < 40) &&
    next.backbenchers.length > 0
  ) {
    const out = [...next.cabinet.filter((m) => !m.coalition)].sort((a, b) => a.loyalty - b.loyalty)[0];
    const incoming = next.backbenchers[0];
    next = {
      ...next,
      cabinet: [
        ...next.cabinet.filter((m) => m.name !== out.name),
        {
          name: incoming.name,
          post: out.post,
          partyId: incoming.partyId,
          loyalty: incoming.loyalty,
          competence: incoming.competence,
          faction: incoming.faction,
          ambition: incoming.ambition,
        },
      ],
      backbenchers: next.backbenchers.slice(1),
      lastReshuffleWeek: next.week,
      stats: { ...next.stats, lettersOfNoConfidence: clamp(next.stats.lettersOfNoConfidence - 1, 0, 99) },
      metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence + 2, 0, 100) },
      log: [`RESHUFFLE: ${out.name} leaves the Cabinet and ${incoming.name} takes over as ${out.post}.`, ...next.log].slice(0, 50),
      headlines: [{ paper: 'The National Standard', title: 'PM RESHUFFLES THE CABINET', stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
    };
  }

  // 4b. Confidence and supply: a minority government buys its votes, and the
  // arrangement frays when you become unpopular.
  if (next.supplyPartnerId && !next.gameOver) {
    const partner = next.parties.find((p) => p.id === next.supplyPartnerId);
    if (partner) {
      next = applyEffects(next, { budgetBalance: -(next.supplyCostPerWeek ?? 0) });
      if (next.metrics.approval < 30 && rng() < 0.12) {
        next = {
          ...next,
          supplyPartnerId: undefined,
          supplyCostPerWeek: 0,
          supplyConcessions: [],
          metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - 2, 0, 100) },
          log: [`CONFIDENCE AND SUPPLY: ${partner.name} withdraws its support.`, ...next.log].slice(0, 50),
          headlines: [{ paper: 'The Courier', title: `${partner.abbreviation} PULLS THE PLUG ON SUPPLY`, stance: 'right' as const }, ...next.headlines].slice(0, 4),
        };
      }
    }
  }

  // 4d. Coalition discipline: a partner's ministers resign when the deal stops
  // being worth it, and the government loses its majority with them.
  if (next.coalition && next.supplyPartnerId && !next.gameOver && rng() < 0.07) {
    const partner = next.parties.find((p) => p.id === next.supplyPartnerId);
    const coalitionMinisters = next.cabinet.filter((m) => m.coalition);
    const blocHostile = (next.blocs ?? []).some((b) => b.mood === 'hostile');
    if (partner && coalitionMinisters.length > 0 && (next.metrics.approval < 30 || blocHostile)) {
      const leaver = coalitionMinisters[0];
      next = {
        ...next,
        cabinet: next.cabinet.filter((m) => m.name !== leaver.name),
        supplyPartnerId: undefined,
        supplyCostPerWeek: 0,
        supplyConcessions: [],
        coalition: false,
        coalitionPosts: [],
        metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - 5, 0, 100) },
        log: [`COALITION COLLAPSE: ${leaver.name} resigned from the Cabinet and ${partner.name} withdrew its support.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The Courier', title: `${partner.abbreviation} WALKS OUT OF THE COALITION`, stance: 'right' as const }, ...next.headlines].slice(0, 4),
      };
    }
  }

  // 4e. By-elections: seats change hands between general elections, and the
  // bloc numbers decide which way they go.
  if (!next.gameOver && rng() < 0.05) {
    const regions = Object.keys(next.regionSeats ?? {});
    if (regions.length > 0) {
      const regionId = regions[Math.floor(rng() * regions.length)];
      const map = next.regionSeats?.[regionId] ?? {};
      const playerId = next.player?.partyId ?? '';
      const totalInRegion = Object.values(map).reduce((sum, n) => sum + n, 0);
      const mineInRegion = map[playerId] ?? 0;
      const blocMean =
        (next.blocs ?? []).reduce((sum, b) => sum + b.support * b.weight, 0) || next.metrics.approval;
      const holdChance = clamp(
        (totalInRegion > 0 ? mineInRegion / totalInRegion : 0.3) + (blocMean - 50) / 150,
        0.05,
        0.9,
      );
      const held = rng() < holdChance;
      const rival = [...next.parties]
        .filter((p) => p.id !== playerId)
        .sort((a, b) => b.currentSupport - a.currentSupport)[0];

      if (!held && rival) {
        const parties = next.parties.map((p) => {
          if (p.id === playerId) return { ...p, seats: Math.max(0, p.seats - 1) };
          if (p.id === rival.id) return { ...p, seats: p.seats + 1 };
          return p;
        });
        const regionSeats = { ...(next.regionSeats ?? {}) };
        const updated = { ...(regionSeats[regionId] ?? {}) };
        updated[playerId] = Math.max(0, (updated[playerId] ?? 0) - 1);
        updated[rival.id] = (updated[rival.id] ?? 0) + 1;
        regionSeats[regionId] = updated;

        next = { ...next, parties, regionSeats };
        next = applyEffects(next, { approval: -1, partyConfidence: -2, mediaAttention: 6 });
        next = {
          ...next,
          byElections: [...(next.byElections ?? []), { regionId, held: false, week: next.week }],
          log: [`BY-ELECTION: ${rival.name} takes ${regionId} from the government.`, ...next.log].slice(0, 50),
          headlines: [{ paper: 'The Courier', title: `BY-ELECTION DEFEAT IN ${regionId.toUpperCase()}`, stance: 'right' as const }, ...next.headlines].slice(0, 4),
        };
      } else {
        next = {
          ...next,
          byElections: [...(next.byElections ?? []), { regionId, held: true, week: next.week }],
          log: [`BY-ELECTION: the government holds ${regionId}.`, ...next.log].slice(0, 50),
        };
      }
    }
  }

  // 5. 1922 Committee confidence ballot.
  //
  // Party rules: 15% of a party's MPs writing to the chair triggers a ballot,
  // and the leader needs a majority of MPs voting for them. Results are
  // reported head-to-head, e.g. 211 for and 148 against.
  const threshold = next.stats.lettersThreshold || 15;
  if (letters >= threshold && !next.gameOver) {
    const conf = next.metrics.partyConfidence;
    const name = next.player ? `${next.player.firstName} ${next.player.lastName}` : 'The Prime Minister';
    const electorate = Math.max(
      1,
      next.parties.find((p) => p.id === next.player?.partyId)?.seats ?? 326,
    );
    const mood = next.committeeMood;
    const restless = mood ? mood.consideringDefection + mood.readyToChallenge : 0;

    // "Men in grey suits": senior colleagues can end a premiership before
    // a ballot is ever held.
    const blindside = calculateBlindsideRisk(letters, conf, electorate - 326);
    const greySuits = conf < 20 && rng() < clamp(0.2 + blindside.risk / 200, 0, 0.8);

    // Share of the parliamentary party voting for the leader.
    const loyaltyShare = clamp(0.22 + conf * 0.0072 - restless * 0.01, 0.05, 0.95);
    const votesFor = Math.round(clamp(electorate * loyaltyShare + (rng() * 6 - 3), 0, electorate));
    const votesAgainst = electorate - votesFor;
    const survived = votesFor > votesAgainst;

    const voteRecord = {
      votesFor,
      votesAgainst,
      survived,
      resignedWithoutBallot: greySuits,
      turn: next.week,
    };

    if (greySuits) {
      next = {
        ...next,
        gameOver: `${name} was told by senior colleagues that the party had lost confidence, and resigned before a ballot could be held.`,
        lastVote: voteRecord,
        log: [`1922 COMMITTEE: the grey suits called. ${name} resigned without a ballot.`, ...next.log].slice(0, 50),
      };
    } else if (survived) {
      next = {
        ...next,
        lastVote: voteRecord,
        stats: { ...next.stats, lettersOfNoConfidence: Math.round(threshold * 0.2) },
        metrics: { ...next.metrics, partyConfidence: clamp(conf - 5, 0, 100) },
        log: [`CONFIDENCE VOTE: ${name} survives ${votesFor} to ${votesAgainst}.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: `PM SURVIVES ${votesFor}-${votesAgainst} BUT EMERGES WOUNDED`, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
      };
    } else {
      next = {
        ...next,
        gameOver: `${name} lost a confidence ballot of MPs ${votesFor}-${votesAgainst} and was forced to resign.`,
        lastVote: voteRecord,
        stats: { ...next.stats, lettersOfNoConfidence: threshold },
        log: [`CONFIDENCE VOTE: ${name} loses ${votesFor} to ${votesAgainst} and resigns.`, ...next.log].slice(0, 50),
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
      headlines: [{ paper: 'The Courier', title: 'CABINET RIFT AS MINISTER BRIEFS AGAINST PM', stance: 'right' as const }, ...next.headlines].slice(0, 4),
    };
  }

  // 6b. Collective responsibility: a minister who no longer believes in the
  // direction of travel may resign rather than defend it.
  if (next.cabinet.length > 0 && !next.gameOver && rng() < 0.06) {
    const unhappy = next.cabinet.filter((m) => m.loyalty < 35);
    if (unhappy.length > 0) {
      const quit = unhappy[Math.floor(rng() * unhappy.length)];
      next = {
        ...next,
        cabinet: next.cabinet.filter((m) => m.name !== quit.name),
        metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - 3, 0, 100) },
        log: [`RESIGNATION: ${quit.name} (${quit.post}) quit, citing collective responsibility.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: `${quit.post.toUpperCase()} RESIGNS OVER GOVERNMENT DIRECTION`, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
      };
    }
  }

  // 7. Draw fresh dossier.
  const activeIds = new Set(remaining.map((d) => d.id));
  const available = ALL_DOSSIERS.filter((d) => !activeIds.has(d.id));
  if (available.length > 0 && remaining.length < 4) {
    const pick = available[Math.floor(rng() * available.length)];
    remaining.push({ ...pick });
  }
  next.redBox = remaining;

  // 8. Every ~5 weeks, PMQs or a foreign call arises.
  // PMQs is a weekly fixture when the House sits (LOTO gets six questions,
  // the third party two), so it fires more often than a summit would.
  if (next.week % 4 === 0 && !next.gameOver && !next.pmq) {
    next.pmq = pmqQuestion(next, 1);
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

  // 9. Election countdown, and the reckoning on the last set of promises.
  const turnsUntilElection = next.turnsUntilElection - 1;
  next = { ...next, turnsUntilElection };
  if (turnsUntilElection <= 0 && !next.gameOver) {
    const results = evaluatePledges(next, next.pledges ?? []);
    const kept = results.filter((r) => r.kept).length;
    const total = results.length;
    next = runElection(next);
    if (total > 0) {
      next = applyEffects(next, {
        approval: kept === total ? 4 : kept === 0 ? -6 : -1,
        partyConfidence: kept >= 1 ? 1 : -2,
      });
      next = {
        ...next,
        log: [`PLEDGES: ${kept} of ${total} manifesto promises kept.`, ...next.log].slice(0, 50),
      };
    }
    next = { ...next, pledges: makePledges(next, (next.seed + next.week) >>> 0) };
  }

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

/** Purdah: the pre-election quiet period when policy/nominal actions are locked. */
function inPurdah(s: GameState): boolean {
  return s.phase === 'playing' && s.turnsUntilElection <= 6;
}

/**
 * Merge an older save onto the current defaults.
 *
 * A plain spread would let a v7 save wholesale replace nested objects, so
 * every field added since that save would come back undefined. Merging the
 * nested stat/metric objects keeps old progress while filling in new keys.
 */
export function migrateState(saved: Partial<GameState> | null | undefined): GameState {
  const base = createInitialState();
  if (!saved) return base;

  const merged: GameState = {
    ...base,
    ...saved,
    stats: { ...base.stats, ...(saved.stats ?? {}) },
    metrics: { ...base.metrics, ...(saved.metrics ?? {}) },
    parties: saved.parties && saved.parties.length > 0 ? saved.parties : base.parties,
    taxes: saved.taxes && saved.taxes.length > 0 ? saved.taxes : base.taxes,
    departments:
      saved.departments && saved.departments.length > 0 ? saved.departments : base.departments,
  };

  // Guard against NaN creeping in from an interrupted save.
  const safe = (n: number | undefined, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? n : fallback;

  return {
    ...merged,
    stats: {
      ...merged.stats,
      cpiInflation: safe(merged.stats.cpiInflation, base.stats.cpiInflation),
      gdpGrowth: safe(merged.stats.gdpGrowth, base.stats.gdpGrowth),
      giltYield: safe(merged.stats.giltYield, base.stats.giltYield),
      budgetBalance: safe(merged.stats.budgetBalance, base.stats.budgetBalance),
      lettersOfNoConfidence: safe(merged.stats.lettersOfNoConfidence, 0),
      lettersThreshold: safe(merged.stats.lettersThreshold, base.stats.lettersThreshold),
    },
    week: safe(merged.week, 1),
    turnsUntilElection: safe(merged.turnsUntilElection, base.turnsUntilElection),
    seed: safe(merged.seed, base.seed),
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      // Fresh seed per game so replays do not replay the same events.
      return { ...createInitialState(), phase: 'create', seed: Math.floor(Math.random() * 1e9) };

    case 'RESTORE':
      return { ...action.state };

    case 'CREATE_PLAYER': {
      const fullName = `${action.player.firstName} ${action.player.lastName}`;
      const parties = state.parties.map((p) =>
        p.id === action.player.partyId ? { ...p, leader: fullName } : p,
      );
      const drafting: GameState = { ...state, player: action.player, parties };
      const detail = projectSeats(drafting);
      const seats = detail.totals;
      const withSeats = parties.map((p) => ({ ...p, seats: seats[p.id] ?? 0 }));
      const mySeats = withSeats.find((p) => p.id === action.player.partyId)?.seats ?? 0;

      const formed: GameState = {
        ...state,
        player: action.player,
        parties: withSeats,
        regionSeats: detail.byRegion,
        phase: 'playing',
        log: [`${fullName} enters Downing Street with ${mySeats} seats in the Commons.`, ...state.log].slice(0, 50),
      };

      // A scenario can reshape the economy, the party and even the seat count.
      const opened = applyScenario(formed, action.player.scenario);
      const seatsAfter = opened.parties.find((p) => p.id === action.player.partyId)?.seats ?? 0;

      const fresh: GameState = {
        ...opened,
        stats: { ...opened.stats, lettersThreshold: resignationThreshold(seatsAfter) },
      };
      const withBlocs = { ...fresh, blocs: computeBlocs(fresh) };
      return { ...withBlocs, pledges: makePledges(withBlocs, withBlocs.seed) };
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
      if (inPurdah(state)) {
        return { ...state, log: [`PURDAH: Cannot introduce bills during the pre-election quiet period.`, ...state.log].slice(0, 50) };
      }
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

    case 'SACK_MINISTER': {
      const minister = state.cabinet.find((m) => m.name === action.name);
      const wasCoalition = !!minister?.coalition;
      let sacked = resignMinister(state, action.name);

      // Sacking a partner's minister ends the coalition, and with it the
      // majority that kept the government upright.
      if (wasCoalition && sacked.supplyPartnerId) {
        const partner = sacked.parties.find((p) => p.id === sacked.supplyPartnerId);
        sacked = {
          ...sacked,
          supplyPartnerId: undefined,
          supplyCostPerWeek: 0,
          supplyConcessions: [],
          coalition: false,
          coalitionPosts: [],
          metrics: { ...sacked.metrics, partyConfidence: clamp(sacked.metrics.partyConfidence - 6, 0, 100) },
          log: [`COALITION COLLAPSE: sacking ${minister?.name} ended the deal with ${partner?.name ?? 'the partner'}.`, ...sacked.log].slice(0, 50),
          headlines: [{ paper: 'The National Standard', title: 'COALITION COLLAPSES AFTER MINISTER SACKED', stance: 'centrist' as const }, ...sacked.headlines].slice(0, 4),
        };
      }
      return sacked;
    }

    case 'APPOINT_MINISTER': {
      // Legacy: candidate picker is now driven by PICK_MINISTER + CONFIRM_APPOINT.
      return state;
    }

    case 'PICK_MINISTER': {
      return { ...state, ministerPicker: action.name };
    }

    case 'CONFIRM_APPOINT': {
      const name = state.ministerPicker;
      const candidate = state.backbenchers.find((b) => b.name === name);
      if (!candidate) return state;
      const post = action.post;
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
        ministerPicker: null,
        log: [`CABINET: ${candidate.name} appointed ${post}.`, ...state.log].slice(0, 50),
      };
    }

    case 'CANCEL_APPOINT':
      return { ...state, ministerPicker: null };

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
        headlines: [{ paper: 'The National Standard', title: `${issue.country.toUpperCase()}: PM MEETS ${issue.leader.toUpperCase()}`, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
      };
      return next;
    }

    case 'ANSWER_PMQ': {
      const q = state.pmq;
      if (!q) return state;
      const opt = q.options.find((o) => o.id === action.optionId);
      if (!opt) return state;
      const answered = {
        ...applyEffects(state, opt.effects),
        log: [`PMQS: Answered a question from ${q.from}.`, ...state.log].slice(0, 50),
        headlines: [{ paper: 'The Clarion', title: `PMQS: PM FACES ${q.from.toUpperCase()}`, stance: 'left' as const }, ...state.headlines].slice(0, 4),
      };
      const round = (q.round ?? 1) + 1;
      // Six from the Leader of the Opposition, then two from the third party.
      if (round > PMQ_ROUNDS) return { ...answered, pmq: null };
      return { ...answered, pmq: pmqQuestion(answered, round) };
    }

    case 'DISMISS_PMQ':
      return { ...state, pmq: null };

    case 'DELIVER_BUDGET': {
      if (inPurdah(state)) return state;
      const pkg = BUDGET_PACKAGES.find((b) => b.id === action.packageId);
      if (!pkg) return state;
      let next = applyEffects(state, pkg.effects);
      next = {
        ...next,
        budgetDue: false,
        fiscalEventKind: null,
        log: [`BUDGET: ${pkg.title} delivered by the Chancellor.`, ...next.log].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: pkg.kicker, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
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
      if (inPurdah(state)) return state;
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
        headlines: [{ paper: 'The National Standard', title: 'AUTUMN STATEMENT: CHANCELLOR SETS OUT TAX PLAN', stance: 'centrist' as const }, ...state.headlines].slice(0, 4),
      };
    }

    case 'ADJUST_SPENDING': {
      if (inPurdah(state)) return state;
      const idx = state.departments.findIndex((d) => d.id === action.deptId);
      if (idx < 0) return state;
      const dept = state.departments[idx];
      const budget = clamp(r1(dept.budget + action.delta), dept.min, dept.max);
      if (budget === dept.budget) return state;
      const delta = budget - dept.budget;
      const departments = state.departments.map((d, i) => (i === idx ? { ...d, budget } : d));
      // Spending costs the Exchequer; benefits scale with the (step-normalised) delta.
      const steps = Math.round(delta / dept.step);
      let fx: Effects = { budgetBalance: -delta };
      const b = dept.benefit;
      fx = {
        approval: (b.approval ?? 0) * steps,
        publicServices: (b.publicServices ?? 0) * steps,
        security: (b.security ?? 0) * steps,
        economy: (b.economy ?? 0) * steps,
        nhsWaitingList: (b.nhsWaitingList ?? 0) * steps,
        budgetBalance: -delta,
      };
      let next = applyEffects(state, fx);
      next = { ...next, departments };
      return next;
    }

    case 'NEGOTIATE_SUPPLY': {
      if (state.phase !== 'playing' || !state.player) return state;
      const partner = state.parties.find((p) => p.id === action.partyId);
      if (!partner) return state;
      const mySeats = state.parties.find((p) => p.id === state.player?.partyId)?.seats ?? 0;
      const combined = mySeats + partner.seats;
      if (combined < 326) {
        return {
          ...state,
          log: [`SUPPLY: ${partner.name} cannot deliver a majority (${combined} seats between you).`, ...state.log].slice(0, 50),
        };
      }

      const rel = state.relations.find((r) => r.from === state.player?.partyId && r.to === partner.id)?.score ?? -50;
      const willingness = Math.min(100, Math.max(0, 50 + rel / 2));
      // A hostile partner will still deal, but only at a price. The 2017 DUP
      // arrangement cost roughly GBP 1bn for ten seats; an unwilling partner
      // charges double that and takes a bite out of party unity.
      const hostile = willingness < 40;
      const ratePerSeat = hostile ? 0.04 : 0.02;
      const annualCost = Math.min(12, Math.round(partner.seats * ratePerSeat * 10) / 10);
      return {
        ...state,
        supplyPartnerId: partner.id,
        supplyCostPerWeek: Math.round((annualCost / 52) * 1000) / 1000,
        supplyConcessions: [`GBP ${annualCost}bn a year in extra spending`, 'Prior notice of legislation'],
        metrics: { ...state.metrics, partyConfidence: Math.max(0, state.metrics.partyConfidence - (hostile ? 4 : 2)) },
        log: [`SUPPLY: ${partner.name} agrees confidence and supply${hostile ? ' on punishing terms' : ''}, costing GBP ${annualCost}bn a year.`, ...state.log].slice(0, 50),
      };
    }
    case 'FORM_COALITION': {
      if (state.phase !== 'playing' || !state.player) return state;
      const partner = state.parties.find((p) => p.id === action.partyId);
      if (!partner) return state;
      const mine = state.parties.find((p) => p.id === state.player?.partyId)?.seats ?? 0;
      if (mine + partner.seats < 326 || partner.seats < 40) {
        return {
          ...state,
          log: [`COALITION: ${partner.name} is not a credible coalition partner.`, ...state.log].slice(0, 50),
        };
      }
      const annualCost = Math.min(18, Math.round(partner.seats * 0.05 * 10) / 10);
      const partnerNames = COALITION_NAMES.filter((n) => !state.cabinet.some((m) => m.name === n)).slice(0, 2);
      const coalitionMinisters: Minister[] = partnerNames.map((name, i) => ({
        name,
        post: i === 0 ? 'Minister of State (Coalition)' : 'Parliamentary Secretary (Coalition)',
        partyId: partner.id,
        loyalty: 60,
        competence: 68,
        faction: 'Coalition',
        coalition: true,
        ambition: 60 + i * 9,
      }));
      return {
        ...state,
        supplyPartnerId: partner.id,
        supplyCostPerWeek: Math.round((annualCost / 52) * 1000) / 1000,
        supplyConcessions: [`GBP ${annualCost}bn a year in extra spending`, 'Cabinet seats for the partner', 'Agreed programme for government'],
        coalition: true,
        coalitionPosts: [`${partner.name} takes two Cabinet posts`],
        cabinet: [...state.cabinet, ...coalitionMinisters],
        metrics: { ...state.metrics, partyConfidence: Math.min(100, state.metrics.partyConfidence + 1) },
        log: [`COALITION: ${partner.name} enters government with two Cabinet seats, at GBP ${annualCost}bn a year.`, ...state.log].slice(0, 50),
      };
    }

    case 'DISMISS_ELECTION':
      return { ...state, isElection: false };

    default:
      return state;
  }
}
