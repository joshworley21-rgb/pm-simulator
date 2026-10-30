import type { GameState, Action, Party, Effects, Dossier, Bill, Minister, PmqQuestion } from './types';
import { INITIAL_PARTIES, INITIAL_RELATIONS, REGIONS, DOSSIER_POOL } from './data';
import { BILL_POOL } from './bills';
import { BILL_POOL_2 } from './bills2';
import { DEFAULT_CABINET, FOREIGN_POOL, PMQ_POOL, PMQ_TEMPLATES, BACKBENCHERS } from './politics';
import { BUDGET_PACKAGES, calculateCustomBudget, DEFAULT_PERSONAL_ALLOWANCE, personalAllowanceFreezeCap, fuelDutyRecurringRevenue, tripleLockRecurringRevenue, publicSectorPayRecurringRevenue, stampDutyRecurringRevenue } from './budget';
import { INITIAL_TAXES, TAX_YIELD_PER_POINT } from './taxes';
import { INITIAL_DEPARTMENTS } from './spending';
import type { Region } from './data';
import { advanceRelationDecay, warmMutual, COALITION_WARMTH, SUPPLY_WARMTH } from './diplomacy';

// ===== Simulation modules (all of these run inside advanceWeek) =====
import { fiscalDragToEffects, FROZEN_THRESHOLDS, previewFiscalDrag, calculatePersonalAllowanceRevenue } from './fiscalDragIntegration';
import {
  calculateTradeDealEconomics,
  calculateTradeDealChange,
  cloneTradeDealStatus,
  DEFAULT_TRADE_DEAL_STATUS,
} from './tradeDeals';
import { calculateNHSPerformance } from './nhsMetrics';
import type { NHSMetrics } from './nhsMetrics';
import {
  DEFAULT_SPENDING_REVIEW,
  spendingReviewEfficiencySavings,
  spendingReviewEfficiencyEffects,
} from './spendingReview';
import type { EfficiencyTargetPct } from './spendingReview';
import { calculate1922Mood, calculateBlindsideRisk } from './leadershipChallenge';
import { DOSSIER_POOL_2 } from './dossiers2';
import { DOSSIER_POOL_3 } from './dossiers3';
import { applyScenario } from './scenarios';
import { makePledges, evaluatePledges } from './pledges';
import { applyBackgroundEffects, applyIntellectualRebellionRelief } from './backgrounds';
import { CONFIDENCE_WARNING_DOSSIER, SUPPLY_ULTIMATUM_ID, createSupplyUltimatumDossier } from './confidenceWarning';
import {
  CHANCELLOR_POST,
  HEALTH_SECRETARY_POST,
  findPostHolder,
  budgetLeakRolls,
  healthSecretaryWaitingRelief,
  BUDGET_LEAK_GILT_DELTA,
  BUDGET_LEAK_APPROVAL_DELTA,
} from './cabinetEffects';
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

/** Scenario id for the minority-government opening. */
const HUNG_PARLIAMENT_SCENARIO_ID = 'hung-parliament';
/**
 * First month a no-confidence motion may be tabled in the hung-parliament
 * scenario (months 1–3 are blocked as the first-100-days protection; allowed from month 4).
 */
const HUNG_PARLIAMENT_GRACE_MONTH = 4;

/** Modest party-discipline boost earned by a reshuffle that promotes a backbencher. */
const RESHUFFLE_DISCIPLINE_BONUS = 2;
/** How many weeks the reshuffle honeymoon lasts on the existing week clock. */
const RESHUFFLE_DISCIPLINE_WEEKS = 4;

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
  const s: GameState = {
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
    emergencyFiscalActions: 0,
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
    thresholdsFrozen: true,
    tradeGdpImpact: calculateTradeDealEconomics(DEFAULT_TRADE_DEAL_STATUS).gdpImpact,
    tradeDealStatus: cloneTradeDealStatus(DEFAULT_TRADE_DEAL_STATUS),
    committeeMood: undefined,
    blindsideRisk: 10,
    pledges: [],
    blocs: [],
    oppositionMotion: undefined,
    coalition: false,
    coalitionPosts: [],
    lastReshuffleWeek: undefined,
    reshuffleDisciplineBonus: undefined,
    confidenceWarningShown: false,
    personalAllowance: DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: 0,
    fuelDutyFrozen: true,
    stampDutyRelief: false,
    tripleLock: true,
    publicSectorPay: 'full',
    obrHeadroom: undefined,
    obrAssessment: undefined,
    efficiencyTargetPct: 0,
  };
  const nhsMetrics = nhsMetricsFromGame(s);
  return { ...s, nhsMetrics, nhsPerformance: calculateNHSPerformance(nhsMetrics) };
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
    emergencyFiscalActions: 0,
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

/**
 * Baseline rates for each lever, derived from INITIAL_TAXES so the recurring
 * structural model and the initial tax levers cannot drift apart.
 */
const TAX_BASELINES: Record<string, number> = Object.fromEntries(
  INITIAL_TAXES.map((t) => [t.id, t.rate]),
);

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

/** Build question `round` of the exchange dynamically from live state. */
export function pmqQuestion(
  s: GameState,
  round: number,
  sessionAskedIds: string[] = [],
  recentAskedIds: string[] = [],
): PmqQuestion {
  const asker: 'loto' | 'third' = round <= PMQ_LOTO_ROUNDS ? 'loto' : 'third';
  const rivals = rivalParties(s);
  const source = asker === 'loto' ? rivals[0] : rivals[1] ?? rivals[0];
  const askerTitle = source ? `${source.name} leader` : (asker === 'third' ? 'Third Party leader' : 'Opposition leader');

  // 1. Filter out questions already asked in this session (strictly 0 repeats within an 8-question exchange)
  const sessionSet = new Set(sessionAskedIds);
  let available = PMQ_TEMPLATES.filter((t) => !sessionSet.has(t.id));
  if (available.length === 0) available = PMQ_TEMPLATES;

  // 2. Filter by asker preference (LOTO vs Third Party)
  const askerCandidates = available.filter((t) => {
    if (asker === 'third') return t.preferredAsker === 'third' || t.preferredAsker === 'both';
    return t.preferredAsker === 'loto' || t.preferredAsker === 'both';
  });
  if (askerCandidates.length > 0) available = askerCandidates;

  // 3. Exclude questions asked in recent sessions (rolling cooldown across sessions)
  // If excluding recent still leaves at least 4 candidates, exclude them; otherwise allow fallback
  const recentSet = new Set(recentAskedIds);
  const freshCandidates = available.filter((t) => !recentSet.has(t.id));
  if (freshCandidates.length >= 4) {
    available = freshCandidates;
  }

  // 4. Weight by current government relevance
  const weighted = available.map((t) => ({
    template: t,
    weight: Math.max(1, t.relevance(s)),
  }));

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const draw = seededRandom((s.seed + round * 7919 + s.week * 104729) >>> 0) * totalWeight;

  let chosen = weighted[0]?.template ?? PMQ_TEMPLATES[0];
  let acc = 0;
  for (const item of weighted) {
    acc += item.weight;
    if (draw <= acc) {
      chosen = item.template;
      break;
    }
  }

  const formattedQuestion = chosen.question(s, askerTitle);
  return {
    id: chosen.id,
    from: askerTitle,
    question: formattedQuestion,
    options: chosen.options,
    asker,
    round,
    total: PMQ_ROUNDS,
  };
}

/**
 * Recurring in-game estimate of the revenue effect of the current Personal
 * Allowance level, measured against the fixed frozen baseline
 * (FROZEN_THRESHOLDS.personalAllowance). Raising the allowance forgoes revenue
 * (negative); lowering it raises revenue (positive).
 *
 * Simplified: reuses the budget preview's £-per-£500-step assumption
 * (PERSONAL_ALLOWANCE_COST_PER_STEP) rather than an empirical tax-base model,
 * so this is a rough in-game estimate — not a real UK revenue costing and not
 * an OBR forecast. The general threshold-freeze policy is scored separately
 * (via `fiscalDragRevenue`), so the allowance is counted once, not twice.
 */
export function personalAllowanceRevenue(s: GameState): number {
  return calculatePersonalAllowanceRevenue(s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE);
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
  const allowance = personalAllowanceRevenue(s);
  // Fuel Duty 5p freeze: the standing annual cost (FUEL_DUTY_FREEZE_COST while
  // frozen, zero once the escalator is restored). Measured against the
  // restored-escalator baseline and applied once here, like the other standing
  // structural terms, so it recurs each year without being recharged monthly.
  const fuelDuty = fuelDutyRecurringRevenue(s.fuelDutyFrozen ?? true);
  // Stamp Duty Land Tax: nil-rate relief forgoes revenue while in place.
  const stampDuty = stampDutyRecurringRevenue(s.stampDutyRelief === true);
  // State Pension Triple Lock: the standing annual cost while the lock holds,
  // zero once indexed to wages only. Applied once, like the other terms.
  const tripleLock = tripleLockRecurringRevenue(s.tripleLock ?? true);
  // Public sector pay: the standing annual cost while awards are fully funded,
  // zero once capped. Applied once, like the other terms.
  const publicSectorPay = publicSectorPayRecurringRevenue((s.publicSectorPay ?? 'full') === 'full');
  // Spending Review efficiency target: cross-Whitehall efficiency savings
  // offset resource spending pressure each year.
  const efficiencySavings = spendingReviewEfficiencySavings((s.efficiencyTargetPct ?? 0) as EfficiencyTargetPct);
  const interestBill = Math.max(0, (s.stats.debtToGdp - 100) * 0.6);
  return (
    BASE_DEFICIT +
    taxDelta -
    (spendNow - BASE_SPEND) +
    drag +
    allowance +
    fuelDuty +
    stampDuty +
    tripleLock +
    publicSectorPay +
    efficiencySavings -
    interestBill
  );
}

function weeklyEconomy(s: GameState): GameState {
  const st = s.stats;
  const structural = structuralBalance(s);

  // Published borrowing converges on the structural position at roughly
  // 10% a week, so a one-off bailout fades instead of compounding forever.
  const balance = r1(st.budgetBalance + (structural - st.budgetBalance) * 0.1);

  let gilt = st.giltYield;
  let debt = st.debtToGdp;
  let cpi = st.cpiInflation;
  let gdp = st.gdpGrowth;
  let confidence = s.metrics.partyConfidence;
  let economy = s.metrics.economy;

  // 1. Severe Deficit & Non-Linear Market Panic / Hyperinflation:
  // Baseline UK structural deficit is ~ -75bn to -81bn.
  // When deficits spiral past -100bn, markets panic and uncosted borrowing compounds.
  if (structural < -100) {
    const excessDeficit = (-structural - 100) / 100;
    // Market panic multiplier: gilt spike scales non-linearly with deficit severity
    gilt += 0.85 * excessDeficit + 0.55 * Math.pow(excessDeficit, 1.4);
    // Unfunded debt accumulation (deficit compounding with interest costs)
    debt += ((-structural) / 10.0) * (1 + Math.max(0, gilt - 4.2) * 0.35);
    // Hyperinflation trigger: massive unfinanced deficits compound inflation
    cpi += 5.2 * Math.pow(excessDeficit, 1.2);
    confidence -= Math.min(5, Math.round(excessDeficit * 1.5));
  } else if (structural < -65) {
    // Normal / sustainable deficit range
    debt += Math.min(0.25, -structural / 400);
    // In calm conditions, gilts mean-revert towards 4.0%
    if (gilt > 4.2) gilt -= (gilt - 4.2) * 0.1;
  } else if (structural > 120) {
    // Extreme austerity / severe fiscal contraction
    const excessSurplus = (structural - 120) / 100;
    debt -= Math.min(1.5, excessSurplus * 0.6);
    gdp -= 0.6 * excessSurplus;
    cpi -= 0.2 * excessSurplus;
  } else if (structural > 0) {
    gilt -= 0.04;
    debt -= 0.2;
  }

  // 2. Debt Death Spiral: when debt exceeds 120% of GDP, interest burden escalates
  if (debt > 120) {
    const excessDebt = (debt - 120) / 10;
    gilt += excessDebt * 0.55;
    debt += excessDebt * 2.8;
  }

  // 3. Capital Flight: punitive average tax rates crush GDP growth (baseline is ~22%)
  const avgTax = s.taxes.reduce((acc, t) => acc + t.rate, 0) / (s.taxes.length || 1);
  if (avgTax > 35) {
    gdp -= Math.pow((avgTax - 35) / 10, 1.1) * 0.75;
  }

  // 4. Bond Market Panic Shock to Growth: high gilt yields strangle investment
  if (gilt > 6.0) {
    gdp -= ((gilt - 6.0) / 2) * 0.75;
  }

  // High inflation drag on real growth
  if (cpi > 7.0) {
    gdp -= ((cpi - 7.0) / 3) * 0.4;
  }

  // Natural growth mean-reversion towards 1.2% in calm conditions
  if (gdp > 1.2) {
    gdp -= (gdp - 1.2) * 0.05;
  } else if (gdp < 1.2 && structural >= -95 && gilt < 5.0 && avgTax <= 30) {
    gdp += (1.2 - gdp) * 0.08;
  }

  // Natural inflation mean-reversion towards 2.5% in calm conditions
  if (cpi > 2.5 && structural >= -95 && gilt < 5.0) {
    cpi -= (cpi - 2.5) * 0.05;
  }

  // Expensive borrowing drags on the real economy
  if (st.giltYield > 6) economy -= 0.5;
  else if (st.giltYield > 5) economy -= 0.25;
  else if (st.giltYield < 3.5 && st.cpiInflation < 3) economy += 0.15;
  economy = clamp(economy, 0, 100);

  let approval = s.metrics.approval;

  // Approval drifts toward economic reality
  const approvalTarget = clamp(
    35 + (economy - 50) * 0.25 + (s.metrics.publicServices - 50) * 0.2 - (cpi - 2) * 2,
    10,
    65,
  );
  approval += (approvalTarget - approval) * 0.09;

  if (cpi > 4) approval -= 1;
  if (st.unemployment > 6) approval -= 1;
  approval = clamp(approval, 0, 100);

  // Unity recovers toward what popularity can sustain
  const unityTarget = clamp(45 + (approval - 50) * 0.5, 15, 85);
  confidence += (unityTarget - confidence) * 0.06;

  return {
    ...s,
    stats: {
      ...st,
      budgetBalance: balance,
      giltYield: Math.max(1.0, r1(gilt)),
      debtToGdp: r1(Math.max(30, debt)),
      cpiInflation: Math.max(0.1, r1(cpi)),
      gdpGrowth: r1(gdp),
    },
    metrics: { ...s.metrics, approval: r1(approval), economy: r1(economy), partyConfidence: clamp(r1(confidence), 0, 100) },
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
  const whip = bill.whipLevel ?? 'two-line';

  let passed: boolean;
  if (whip === 'three-line') {
    // Three-line whip: maximum attendance and discipline (+15 virtual votes in lobbies)
    const effectiveSeats = seats + 15;
    if (effectiveSeats >= 355) passed = true;
    else if (effectiveSeats >= 326) passed = rng() < 0.96;
    else if (effectiveSeats >= 300) passed = rng() < (partner ? 0.75 : 0.40);
    else passed = false;
  } else if (whip === 'free-vote') {
    // Free vote: MPs vote on conscience without party coercion
    if (seats >= 360) passed = rng() < 0.88;
    else if (seats >= 326) passed = rng() < 0.75;
    else if (seats >= 300) passed = rng() < 0.50;
    else passed = rng() < 0.25;
  } else {
    // Standard two-line whip (existing baseline)
    if (seats >= 360) passed = true;
    else if (seats >= 326) passed = rng() < 0.92;
    else if (seats >= 300) passed = rng() < (partner ? 0.6 : 0.25);
    else passed = false;
  }

  // Letters accumulation from backbench rebellion:
  let letters = s.stats.lettersOfNoConfidence;
  if (whip === 'free-vote') {
    // Free vote: zero mutiny letters added because MPs are free to vote their conscience!
    letters += 0;
  } else if (whip === 'three-line') {
    // Strict three-line whip: heavy-handedness increases backbench resentment
    letters += Math.round(bill.rebellionRisk / 6);
  } else {
    letters += Math.round(bill.rebellionRisk / 8);
  }

  let next = s;

  if (rebels.length > 0 && whip !== 'free-vote') {
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
    // A carried bill is a genuine governing success: it buys party unity and
    // removes at most one active letter of no confidence.
    next = applyEffects(next, { partyConfidence: whip === 'three-line' && bill.rebellionRisk > 30 ? 3 : 5 });
    letters = clamp(letters - 1, 0, 99);
    next = {
      ...next,
      stats: { ...next.stats, budgetBalance: r1(next.stats.budgetBalance - bill.fiscalCost) },
      passedLaws: [bill.title, ...next.passedLaws],
      log: [`LAW PASSED: ${bill.title} (${whip === 'three-line' ? 'three-line whip' : whip === 'free-vote' ? 'free vote' : 'standard whip'})`, ...(next.log ?? [])].slice(0, 50),
      headlines: [{ paper: 'The National Standard', title: bill.kicker, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
    };
  } else {
    // Defeat on a free vote does not damage party unity!
    if (whip !== 'free-vote') {
      next = applyEffects(next, { approval: -2, partyConfidence: -2 });
      letters += Math.round(bill.rebellionRisk / (whip === 'three-line' ? 3 : 4));
    } else {
      next = applyEffects(next, { approval: -1 });
    }
    next = {
      ...next,
      log: [
        partner || ownSeats >= 326
          ? `BILL DEFEATED: ${bill.title} was voted down in the Commons.`
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
 * Weekly waiting-list drift in millions, given NHS funding and the Health
 * Secretary. Positive growth is the norm; a loyal or skilled secretary offsets
 * part of it, capped so a crisis is only slowed, never reversed.
 */
export function nhsWaitingDrift(s: GameState): number {
  const nhsBudget = s.departments.find((d) => d.id === 'nhs')?.budget ?? 190;
  const spendRatio = nhsBudget / 190;
  const secretaryRelief = healthSecretaryWaitingRelief(findPostHolder(s.cabinet, HEALTH_SECRETARY_POST));
  return clamp(0.06 - (spendRatio - 1) * 0.6 - secretaryRelief, -0.2, 0.25);
}

/**
 * NHS drift: under-funding lengthens the waiting list, extra cash shortens
 * it, and a service in crisis drags public services down without needing a
 * headline event. The Health Secretary's relief is applied inside
 * nhsWaitingDrift above.
 */
function weeklyNhsDrift(s: GameState): GameState {
  const initialMetrics = nhsMetricsFromGame(s);
  const performance = calculateNHSPerformance(initialMetrics);
  const waitingDrift = nhsWaitingDrift(s);
  const serviceDrag = performance < 45 ? -0.5 : performance > 65 ? 0.4 : 0;

  const next = applyEffects(s, {
    nhsWaitingList: waitingDrift,
    publicServices: serviceDrag,
    approval: performance < 35 ? -0.3 : 0,
  });

  const nhsMetrics = nhsMetricsFromGame(next);
  return { ...next, nhsPerformance: performance, nhsMetrics };
}

/**
 * A Chancellor with low loyalty can leak the statement, denting economic
 * credibility. Exported so the trigger and magnitude can be tested directly;
 * `roll` is the 0..1 draw that decides whether the leak fires this cycle.
 */
export function chancellorBudgetLeak(s: GameState, roll: number): GameState {
  const chancellor = findPostHolder(s.cabinet, CHANCELLOR_POST);
  if (!budgetLeakRolls(chancellor, roll)) return s;
  const leaked = applyEffects(s, {
    giltYield: BUDGET_LEAK_GILT_DELTA,
    approval: BUDGET_LEAK_APPROVAL_DELTA,
  });
  return {
    ...leaked,
    log: [
      `BUDGET LEAK: the Chancellor's statement was briefed to the press before the Commons. Borrowing costs ticked up.`,
      ...leaked.log,
    ].slice(0, 50),
    headlines: [
      { paper: 'The Courier', title: 'BUDGET LEAKED: BORROWING COSTS RISE AS MARKETS QUESTION THE NUMBERS', stance: 'right' as const },
      ...leaked.headlines,
    ].slice(0, 4),
  };
}

/**
 * Fiscal drag: with allowances frozen, pay growth drags taxpayers into
 * higher bands. The module returns an annual figure; we apply a monthly
 * slice so a full term accumulates roughly five years of creep.
 */
function weeklyFiscalDrag(s: GameState): GameState {
  const frozen = s.thresholdsFrozen ?? true;
  const result = previewFiscalDrag(s, frozen);

  let next = applyEffects(s, fiscalDragToEffects(result));
  const frozenTurns = frozen ? (s.thresholdFrozenTurns ?? 0) + 1 : 0;

  next = {
    ...next,
    thresholdsFrozen: frozen,
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
 * The annual Personal Allowance update, run once at each annual Budget
 * boundary.
 *
 * While a freeze is active the nominal allowance is held unchanged and one
 * budget cycle is consumed. Otherwise the allowance is uprated by the game's
 * existing CPI-like inflation measure (`stats.cpiInflation`) — a deliberately
 * simple proxy, not an exact UK costing. Pure and idempotent per boundary.
 */
export function annualPersonalAllowanceUpdate(s: GameState): GameState {
  const remaining = Math.max(0, Math.floor(s.personalAllowanceFreezeYears ?? 0));
  if (remaining > 0) {
    return { ...s, personalAllowanceFreezeYears: remaining - 1 };
  }
  const current = s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  const cpi = Math.max(0, s.stats.cpiInflation);
  const uprated = Math.round(current * (1 + cpi / 100));
  return uprated === current ? s : { ...s, personalAllowance: uprated };
}

/**
 * Trade position and the spending-review envelope. Both are slow-burn: the
 * trade deal set nudges growth every month, and planning above the review
 * envelope is punished by the bond market every year.
 */
function periodicExternal(s: GameState): GameState {
  let next = s;
  const tradeStatus = next.tradeDealStatus ? cloneTradeDealStatus(next.tradeDealStatus) : cloneTradeDealStatus(DEFAULT_TRADE_DEAL_STATUS);

  // Bank of England Monetary Policy Committee (MPC) review (quarterly: month % 3 == 0)
  if (next.week % 3 === 0 && !next.gameOver) {
    if (next.stats.cpiInflation > 4.5) {
      next = applyEffects(next, {
        cpiInflation: -0.2,
        gdpGrowth: -0.1,
        giltYield: 0.1,
      });
      next = {
        ...next,
        log: [`BANK OF ENGLAND: MPC raises Bank Rate by 25bps to counter inflation (${next.stats.cpiInflation}%).`, ...(next.log ?? [])].slice(0, 50),
        headlines: [{ paper: 'The Courier', title: 'BANK OF ENGLAND HIKES INTEREST RATES', stance: 'right' as const }, ...next.headlines].slice(0, 4),
      };
    } else if (next.stats.cpiInflation < 2.0 && next.stats.gdpGrowth < 1.0) {
      next = applyEffects(next, {
        gdpGrowth: 0.1,
        giltYield: -0.1,
      });
      next = {
        ...next,
        log: [`BANK OF ENGLAND: MPC cuts Bank Rate to stimulate economic growth.`, ...(next.log ?? [])].slice(0, 50),
        headlines: [{ paper: 'The National Standard', title: 'BANK OF ENGLAND CUTS RATES TO BOOST GROWTH', stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
      };
    }
  }

  // Quarterly trade progression & economic impact (month % 4 == 0)
  if (next.week % 4 === 0) {
    const fs = findPostHolder(next.cabinet, 'Foreign Secretary');
    const fsBonus = fs ? Math.max(0, Math.round(((fs.competence - 50) / 50) * 15)) : 0;
    const progressGain = 20 + fsBonus;

    const dealKeys = ['euTradeDeal', 'usaTradeDeal', 'chinaTradeDeal', 'indiaTradeDeal', 'cpTradeDeal'] as const;
    for (const key of dealKeys) {
      const deal = tradeStatus[key];
      if (deal && deal.status === 'negotiating') {
        const curProgress = (deal.progress ?? 0) + progressGain;
        if (curProgress >= 100) {
          deal.status = 'signed';
          deal.progress = undefined;
          const partnerName = deal.partner === 'eu' ? 'European Union' : deal.partner === 'usa' ? 'United States' : deal.partner === 'china' ? 'China' : deal.partner === 'india' ? 'India' : 'Commonwealth';
          next = {
            ...next,
            log: [`TRADE DEAL: Negotiations with ${partnerName} concluded! Trade agreement signed and ready for ratification.`, ...(next.log ?? [])].slice(0, 50),
            headlines: [{ paper: 'The National Standard', title: `UK CONCLUDES TRADE DEAL WITH ${partnerName.toUpperCase()}`, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
          };
        } else {
          deal.progress = curProgress;
        }
      }
    }
    next = { ...next, tradeDealStatus: tradeStatus };

    const economics = calculateTradeDealEconomics(tradeStatus);
    next = applyEffects(next, {
      gdpGrowth: Math.round(economics.gdpImpact * 0.01 * 100) / 100,
      budgetBalance: Math.round(economics.exportGrowth * 0.02 * 100) / 100,
    });
    next = { ...next, tradeGdpImpact: economics.gdpImpact };
  }

  if (next.week % 12 === 0) {
    const effSavings = spendingReviewEfficiencySavings((next.efficiencyTargetPct ?? 0) as EfficiencyTargetPct);
    const envelope =
      DEFAULT_SPENDING_REVIEW.totalCapital +
      DEFAULT_SPENDING_REVIEW.totalResource +
      DEFAULT_SPENDING_REVIEW.totalAnnuity +
      effSavings;
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

  // A reshuffle honeymoon is temporary: once its window on the week clock has
  // passed, remove the confidence that was actually granted at the time.
  if (
    next.reshuffleDisciplineBonus !== undefined &&
    next.lastReshuffleWeek !== undefined &&
    next.week > next.lastReshuffleWeek + RESHUFFLE_DISCIPLINE_WEEKS
  ) {
    const bonus = next.reshuffleDisciplineBonus;
    next = {
      ...next,
      metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - bonus, 0, 100) },
      reshuffleDisciplineBonus: undefined,
    };
  }

  // 1. Age dossiers; escalate ignored urgent crises.
  const remaining: Dossier[] = [];
  for (const d of next.redBox) {
    if (d.weeksRemaining <= 1) {
      if (d.id === SUPPLY_ULTIMATUM_ID) {
        // An ignored ultimatum causes the partner to officially withdraw support.
        if (next.supplyPartnerId) {
          const partner = next.parties.find((p) => p.id === next.supplyPartnerId);
          next = {
            ...next,
            supplyPartnerId: undefined,
            supplyCostPerWeek: 0,
            supplyConcessions: [],
            metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - 2, 0, 100) },
            log: [`CONFIDENCE AND SUPPLY: ${partner?.name ?? 'Partner'} withdraws support after ultimatum went unanswered.`, ...next.log].slice(0, 50),
            headlines: [{ paper: 'The Courier', title: `${partner?.abbreviation ?? 'PARTNER'} PULLS THE PLUG ON SUPPLY`, stance: 'right' as const }, ...next.headlines].slice(0, 4),
          };
        }
      } else if (d.urgent) {
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

  // 3a. Diplomacy: strong alliances cool without upkeep (relationEngine adapter).
  next = { ...next, relations: advanceRelationDecay(next.relations) };

  // 3e. Voter blocs: recompute who is with you and who has turned.
  const blocs = computeBlocs(next);
  next = { ...next, blocs };
  next = applyEffects(next, { approval: (blocAverage(blocs) - next.metrics.approval) * 0.04 });

  // 3f. Opposition business: without a majority a confidence motion is tabled
  // on a fixed timetable, not by dice roll.
  // Set when a motion is tabled for a minority with no supply deal. The paper
  // is added after the Red Box is rebuilt (step 7) so it is not overwritten.
  let confidenceWarningDue = false;
  if (!next.gameOver && !next.oppositionMotion) {
    const pmSeats = next.parties.find((p) => p.id === next.player?.partyId)?.seats ?? 0;
    const partnerSeats = next.supplyPartnerId
      ? next.parties.find((p) => p.id === next.supplyPartnerId)?.seats ?? 0
      : 0;
    const cadence = next.metrics.approval < 30 ? 6 : 12;
    // The hung-parliament opening gets a grace period: the opposition cannot
    // table a confidence motion during months 1–3, giving the new government a
    // 100-day window to settle into office and negotiate support.
    const inGracePeriod =
      next.scenarioId === HUNG_PARLIAMENT_SCENARIO_ID && next.week < HUNG_PARLIAMENT_GRACE_MONTH;
    if (pmSeats + partnerSeats < 326 && next.week % cadence === 0 && !inGracePeriod) {
      const sponsor = [...next.parties]
        .filter((p) => p.id !== next.player?.partyId)
        .sort((a, b) => b.seats - a.seats)[0];
      if (sponsor) {
        next = {
          ...next,
          oppositionMotion: { sponsorPartyId: sponsor.id, tabledWeek: next.week, scheduledWeek: next.week + 1 },
          log: [`OPPOSITION DAY: ${sponsor.name} tables a motion of no confidence, to be voted on next month.`, ...next.log].slice(0, 50),
        };
        // Guaranteed, one-time warning for a minority with no supply deal, so
        // the player can use the existing supply negotiation before the
        // division. The flag stops it repeating on later motions.
        if (!next.confidenceWarningShown && pmSeats < 326 && !next.supplyPartnerId) {
          confidenceWarningDue = true;
        }
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
  const playerSeatsNow = next.parties.find((p) => p.id === next.player?.partyId)?.seats ?? 326;
  const blindsideSnapshot = calculateBlindsideRisk(letters, unity, playerSeatsNow - 326);
  next = {
    ...next,
    stats: { ...next.stats, lettersOfNoConfidence: letters },
    committeeMood: mood,
    blindsideRisk: blindsideSnapshot.risk,
  };

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
    // The reshuffle only exists because a backbencher is promoted into the post.
    const incoming = next.backbenchers[0];
    const activeBonus = next.reshuffleDisciplineBonus ?? 0;
    // Cap the total discipline honeymoon, even if another reshuffle were forced
    // before the previous one had expired.
    const grant = Math.max(0, RESHUFFLE_DISCIPLINE_BONUS - activeBonus);
    const confidenceBefore = next.metrics.partyConfidence;
    const confidenceAfter = clamp(confidenceBefore + grant, 0, 100);
    const appliedGrant = confidenceAfter - confidenceBefore;
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
      reshuffleDisciplineBonus: activeBonus + appliedGrant,
      metrics: { ...next.metrics, partyConfidence: confidenceAfter },
      log: [`RESHUFFLE: ${out.name} leaves the Cabinet and ${incoming.name} takes over as ${out.post}.`, ...next.log].slice(0, 50),
      headlines: [{ paper: 'The National Standard', title: 'PM RESHUFFLES THE CABINET', stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
    };
  }

  // 4b. Confidence and supply: a minority government buys its votes, and the
  // arrangement frays when you become unpopular.
  let supplyUltimatumDue = false;
  if (next.supplyPartnerId && !next.gameOver) {
    const partner = next.parties.find((p) => p.id === next.supplyPartnerId);
    if (partner) {
      next = applyEffects(next, { budgetBalance: -(next.supplyCostPerWeek ?? 0) });
      if (next.metrics.approval < 30 && rng() < 0.12) {
        // Warn the player via an urgent Red Box ultimatum instead of an instant
        // silent withdrawal, if an ultimatum is not already pending.
        if (!remaining.some((d) => d.id === SUPPLY_ULTIMATUM_ID)) {
          supplyUltimatumDue = true;
        }
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

  // 7b. Add the one-off confidence warning now the Red Box has been rebuilt.
  if (confidenceWarningDue && !next.confidenceWarningShown) {
    next = {
      ...next,
      confidenceWarningShown: true,
      redBox: [
        ...next.redBox.filter((d) => d.id !== CONFIDENCE_WARNING_DOSSIER.id),
        { ...CONFIDENCE_WARNING_DOSSIER },
      ],
      log: [
        `RED BOX: a confidence vote is being organised. Negotiate confidence and supply before the division.`,
        ...next.log,
      ].slice(0, 50),
    };
  }

  // 7c. Add the supply ultimatum dossier if triggered this turn.
  if (supplyUltimatumDue && next.supplyPartnerId) {
    const partner = next.parties.find((p) => p.id === next.supplyPartnerId);
    if (partner) {
      const ultimatum = createSupplyUltimatumDossier(partner.name, partner.abbreviation);
      next = {
        ...next,
        redBox: [...next.redBox.filter((d) => d.id !== SUPPLY_ULTIMATUM_ID), ultimatum],
        log: [
          `RED BOX: ${partner.name} threatens to withdraw confidence and supply. Address the ultimatum before support is pulled.`,
          ...next.log,
        ].slice(0, 50),
        headlines: [
          { paper: 'The Courier', title: `${partner.abbreviation} WARNS SUPPLY DEAL IS AT RISK`, stance: 'right' as const },
          ...next.headlines,
        ].slice(0, 4),
      };
    }
  }

  // 8. Every ~5 weeks, PMQs or a foreign call arises.
  // PMQs is a weekly fixture when the House sits (LOTO gets six questions,
  // the third party two), so it fires more often than a summit would.
  if (next.week % 4 === 0 && !next.gameOver && !next.pmq) {
    const q = pmqQuestion(next, 1, [], next.pmqRecentIds ?? []);
    next.pmq = q;
    next.pmqSessionAskedIds = [q.id];
  }
  if (next.week % 7 === 0 && !next.gameOver && next.foreignIssues.length < 2) {
    const fi = FOREIGN_POOL[Math.floor(rng() * FOREIGN_POOL.length)];
    if (!next.foreignIssues.some((f) => f.id === fi.id)) {
      next.foreignIssues = [...next.foreignIssues, { ...fi }];
    }
  }

  // 8b. Two fiscal events per year: Autumn Statement (week % 6 == 0) and Budget (week % 12 == 0).
  if (!next.gameOver) {
    let fiscalEvent = false;
    if (next.week % 12 === 0) {
      // Annual boundary: settle the Personal Allowance for the new tax year
      // exactly once per cycle. A frozen allowance is held; otherwise it is
      // uprated by the CPI-like proxy. Delivery sets the freeze *duration*,
      // never the allowance itself, so this cannot double-count.
      next = annualPersonalAllowanceUpdate(next);
      next.budgetDue = true;
      next.fiscalEventKind = 'budget';
      fiscalEvent = true;
    } else if (next.week % 6 === 0) {
      next.budgetDue = true;
      next.fiscalEventKind = 'autumn';
      fiscalEvent = true;
    }
    // A disloyal Chancellor may leak the statement during a fiscal week.
    // Gating on the fiscal-event week keeps it to one chance per cycle.
    if (fiscalEvent) next = chancellorBudgetLeak(next, rng());
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
 * A fiscal window is open while a Budget or Autumn Statement is waiting to be
 * delivered (`budgetDue`). Headline tax rates and DEL budgets may only move
 * then; outside it, only designated emergency levies can be changed, a limited
 * number of times per term.
 */
export function isFiscalWindow(s: GameState): boolean {
  return s.budgetDue === true;
}

/** Off-cycle emergency levy changes permitted per parliamentary term. */
export const EMERGENCY_FISCAL_ACTIONS_PER_TERM = 2;

/**
 * Remaining off-cycle emergency levy changes available in the current term.
 * Shared by the reducer guard and the UI so the rule is never re-derived.
 */
export function remainingEmergencyFiscalActions(s: GameState): number {
  return Math.max(0, EMERGENCY_FISCAL_ACTIONS_PER_TERM - (s.emergencyFiscalActions ?? 0));
}
/** Approval cost of moving a levy outside a fiscal event. */
const EMERGENCY_APPROVAL_PENALTY = -3;
/** Gilt-yield (percentage-point) reaction to an off-cycle levy change. */
const EMERGENCY_GILT_DELTA = 0.15;

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

  // Reshuffle bookkeeping must be paired and capped; an orphaned bonus would
  // otherwise never reach its expiry branch.
  const savedLastReshuffleWeek =
    typeof saved.lastReshuffleWeek === 'number' && Number.isFinite(saved.lastReshuffleWeek)
      ? saved.lastReshuffleWeek
      : undefined;
  const savedReshuffleBonus =
    savedLastReshuffleWeek !== undefined &&
    typeof saved.reshuffleDisciplineBonus === 'number' &&
    Number.isFinite(saved.reshuffleDisciplineBonus)
      ? clamp(saved.reshuffleDisciplineBonus, 0, RESHUFFLE_DISCIPLINE_BONUS)
      : undefined;

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
    thresholdsFrozen:
      typeof saved.thresholdsFrozen === 'boolean' ? saved.thresholdsFrozen : base.thresholdsFrozen,
    tradeDealStatus: saved.tradeDealStatus
      ? cloneTradeDealStatus({ ...DEFAULT_TRADE_DEAL_STATUS, ...saved.tradeDealStatus })
      : cloneTradeDealStatus(DEFAULT_TRADE_DEAL_STATUS),
    nhsMetrics: saved.nhsMetrics
      ? { ...nhsMetricsFromGame(merged), ...saved.nhsMetrics }
      : nhsMetricsFromGame(merged),
    blindsideRisk: safe(saved.blindsideRisk, base.blindsideRisk ?? 10),
    lastReshuffleWeek: savedLastReshuffleWeek,
    reshuffleDisciplineBonus: savedReshuffleBonus,
    confidenceWarningShown: saved.confidenceWarningShown === true,
    pmqSessionAskedIds: Array.isArray(saved.pmqSessionAskedIds) ? saved.pmqSessionAskedIds : undefined,
    pmqRecentIds: Array.isArray(saved.pmqRecentIds) ? saved.pmqRecentIds : undefined,
    personalAllowance: safe(saved.personalAllowance, DEFAULT_PERSONAL_ALLOWANCE),
    // Older saves predate the freeze field: default to "no freeze" so the
    // allowance keeps uprating as it always did.
    personalAllowanceFreezeYears: clamp(safe(saved.personalAllowanceFreezeYears, 0), 0, 99),
    emergencyFiscalActions: clamp(safe(saved.emergencyFiscalActions, 0), 0, 99),
    fuelDutyFrozen: typeof saved.fuelDutyFrozen === 'boolean' ? saved.fuelDutyFrozen : true,
    stampDutyRelief: saved.stampDutyRelief === true,
    tripleLock: typeof saved.tripleLock === 'boolean' ? saved.tripleLock : true,
    publicSectorPay: saved.publicSectorPay === 'capped' ? 'capped' : 'full',
    obrHeadroom: typeof saved.obrHeadroom === 'number' ? saved.obrHeadroom : undefined,
    obrAssessment: saved.obrAssessment,
    efficiencyTargetPct:
      saved.efficiencyTargetPct === 2 || saved.efficiencyTargetPct === 4 ? saved.efficiencyTargetPct : 0,
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
      // Background traits are a one-off adjustment to the opening position,
      // applied after the scenario has set its absolute values.
      const withBackground = applyBackgroundEffects(fresh);
      const withBlocs = { ...withBackground, blocs: computeBlocs(withBackground) };
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

      if (action.dossierId === SUPPLY_ULTIMATUM_ID) {
        const partner = next.parties.find((p) => p.id === next.supplyPartnerId);
        if (action.choiceId === 'supply-concede') {
          // Concession granted: agreement holds, concessions recorded, partner relations warmed.
          next = {
            ...next,
            supplyConcessions: [...(next.supplyConcessions ?? []), `Emergency £2bn funding concession to ${partner?.name ?? 'partner'}`],
            relations: partner ? warmMutual(next.relations, next.player!.partyId, partner.id, 4) : next.relations,
            log: [`SUPPLY: Emergency concession granted to ${partner?.name ?? 'partner'}; agreement preserved.`, ...next.log].slice(0, 50),
            headlines: [{ paper: 'The National Standard', title: `GOVERNMENT STABILISES DEAL WITH ${partner?.abbreviation ?? 'PARTNER'}`, stance: 'centrist' as const }, ...next.headlines].slice(0, 4),
          };
        } else if (action.choiceId === 'supply-reject') {
          // Concession rejected: partner withdraws support immediately.
          next = {
            ...next,
            supplyPartnerId: undefined,
            supplyCostPerWeek: 0,
            supplyConcessions: [],
            metrics: { ...next.metrics, partyConfidence: clamp(next.metrics.partyConfidence - 2, 0, 100) },
            log: [`CONFIDENCE AND SUPPLY: ${partner?.name ?? 'Partner'} withdraws support after demands were rejected.`, ...next.log].slice(0, 50),
            headlines: [{ paper: 'The Courier', title: `${partner?.abbreviation ?? 'PARTNER'} PULLS THE PLUG ON SUPPLY`, stance: 'right' as const }, ...next.headlines].slice(0, 4),
          };
        }
      }

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
      const whipLevel = action.whipLevel ?? 'two-line';
      const bill: Bill = {
        ...blueprint,
        rebellionRisk: applyIntellectualRebellionRelief(blueprint.rebellionRisk, state.player?.background),
        weeksToPass: blueprint.weeksToPass,
        whipLevel,
      };
      const whipDesc = whipLevel === 'three-line' ? 'on a three-line whip' : whipLevel === 'free-vote' ? 'on a free vote' : 'with the government whip';
      return {
        ...state,
        bills: [...state.bills, bill],
        log: [`BILL INTRODUCED: ${bill.title} ${whipDesc} (will face a division in ${bill.weeksToPass} months)`, ...state.log].slice(0, 50),
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

    case 'SET_TERM_LENGTH': {
      const len = action.months ?? action.weeks ?? 60;
      return { ...state, termLength: len, turnsUntilElection: len };
    }

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
      const updatedRecent = [q.id, ...(state.pmqRecentIds ?? []).filter((id) => id !== q.id)].slice(0, 16);

      // Six from the Leader of the Opposition, then two from the third party.
      if (round > PMQ_ROUNDS) {
        // Only a completed eight-question exchange counts: DISMISS_PMQ clears
        // the session early and therefore earns no relief.
        return {
          ...answered,
          stats: {
            ...answered.stats,
            lettersOfNoConfidence: clamp(answered.stats.lettersOfNoConfidence - 1, 0, 99),
          },
          pmq: null,
          pmqSessionAskedIds: undefined,
          pmqRecentIds: updatedRecent,
        };
      }
      const askedIds = [...(state.pmqSessionAskedIds ?? []), q.id];
      const nextQ = pmqQuestion(answered, round, askedIds, updatedRecent);
      return {
        ...answered,
        pmq: nextQ,
        pmqSessionAskedIds: [...askedIds, nextQ.id],
        pmqRecentIds: updatedRecent,
      };
    }

    case 'DISMISS_PMQ':
      return { ...state, pmq: null, pmqSessionAskedIds: undefined };

    case 'DELIVER_CUSTOM_BUDGET':
    case 'DELIVER_BUDGET': {
      if (inPurdah(state)) return state;

      const plan = action.type === 'DELIVER_CUSTOM_BUDGET' ? action.plan : action.customPlan;
      if (plan) {
        const result = calculateCustomBudget(plan, state);

        const departments = state.departments.map((d) => ({
          ...d,
          budget: plan.departmentBudgets[d.id] !== undefined ? plan.departmentBudgets[d.id] : d.budget,
        }));

        const taxes = state.taxes.map((t) => ({
          ...t,
          rate: plan.taxRates[t.id] !== undefined ? plan.taxRates[t.id] : t.rate,
        }));

        let next = applyEffects(state, result.effects);
        next = {
          ...next,
          departments,
          taxes,
          personalAllowance: plan.personalAllowance,
          // Set (never accumulated) so previewing or repeating delivery cannot
          // compound the freeze; capped by the selected campaign term.
          personalAllowanceFreezeYears: Math.min(
            Math.max(0, Math.floor(plan.personalAllowanceFreezeYears ?? 0)),
            personalAllowanceFreezeCap(state.termLength),
          ),
          fuelDutyFrozen: plan.fuelDutyFrozen,
          stampDutyRelief: plan.stampDutyRelief,
          tripleLock: plan.tripleLock,
          publicSectorPay: plan.publicSectorPay,
          thresholdsFrozen: plan.thresholdsFrozen,
          obrHeadroom: result.obrHeadroom,
          obrAssessment: result.obrAssessment,
          budgetDue: false,
          fiscalEventKind: null,
          log: [
            `BUDGET: ${plan.title || 'Annual Budget'} delivered. Borrowing ${result.netBorrowing > 0 ? '£' + result.netBorrowing + 'bn' : 'balanced'} (OBR Headroom: ${result.obrHeadroom >= 0 ? '+' : ''}£${result.obrHeadroom}bn).`,
            ...next.log,
          ].slice(0, 50),
          headlines: [
            {
              paper: result.obrAssessment === 'breach' ? 'The Courier' : 'The National Standard',
              title:
                result.obrAssessment === 'breach'
                  ? 'BUDGET BORROWING SPARKS BOND MARKET PANIC'
                  : 'CHANCELLOR DELIVERS ANNUAL BUDGET AT DISPATCH BOX',
              stance: result.obrAssessment === 'breach' ? ('right' as const) : ('centrist' as const),
            },
            ...next.headlines,
          ].slice(0, 4),
        };
        return next;
      }

      const pkgId = action.type === 'DELIVER_BUDGET' ? action.packageId : undefined;
      const pkg = BUDGET_PACKAGES.find((b) => b.id === pkgId);
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
      // Headline rates move only inside a fiscal window. A designated emergency
      // levy may be moved off-cycle a limited number of times per term, at a
      // credibility cost.
      const windowOpen = isFiscalWindow(state);
      const emergency = !windowOpen && tax.emergency === true;
      const used = state.emergencyFiscalActions ?? 0;
      if (!windowOpen && !emergency) return state;
      if (emergency && remainingEmergencyFiscalActions(state) <= 0) return state;
      const taxes = state.taxes.map((t, i) => (i === idx ? { ...t, rate } : t));
      const delta = rate - tax.rate;
      // Fiscal yield: raising tax improves the budget, lowers approval; vice versa.
      const yieldChange = delta * (TAX_YIELD_PER_POINT[tax.id] ?? 0);
      const approvalChange = -delta * tax.popularityWeight;
      let next = applyEffects(state, {
        approval: approvalChange + (emergency ? EMERGENCY_APPROVAL_PENALTY : 0),
        budgetBalance: yieldChange,
        giltYield: emergency ? EMERGENCY_GILT_DELTA : undefined,
        taxRate: tax.id === 'income' ? delta : 0,
      });
      next = { ...next, taxes };
      if (emergency) {
        next = {
          ...next,
          emergencyFiscalActions: used + 1,
          log: [
            `EMERGENCY LEVY: ${tax.name} moved to ${rate}% outside a fiscal event (${used + 1}/${EMERGENCY_FISCAL_ACTIONS_PER_TERM} this term). Markets unimpressed.`,
            ...next.log,
          ].slice(0, 50),
          headlines: [
            { paper: 'The Courier', title: 'SURPRISE LEVY CHANGE UNNERVES THE MARKETS', stance: 'right' as const },
            ...next.headlines,
          ].slice(0, 4),
        };
      }
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
      // DEL totals are settled at a fiscal event only.
      if (!isFiscalWindow(state)) return state;
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

    case 'SET_EFFICIENCY_TARGET': {
      if (inPurdah(state)) return state;
      const prevPct = (state.efficiencyTargetPct ?? 0) as EfficiencyTargetPct;
      const nextPct = action.targetPct;
      if (prevPct === nextPct) return state;
      const prevSavings = spendingReviewEfficiencySavings(prevPct);
      const nextSavings = spendingReviewEfficiencySavings(nextPct);
      const fx = {
        ...spendingReviewEfficiencyEffects(prevPct, nextPct),
        budgetBalance: r1(nextSavings - prevSavings),
      };
      const next = applyEffects(state, fx);
      return {
        ...next,
        efficiencyTargetPct: nextPct,
        log: [
          `SPENDING REVIEW: Cross-Whitehall efficiency target set to ${nextPct}% (${nextSavings > 0 ? '+£' + nextSavings + 'bn/yr savings' : 'no mandatory efficiency target'}).`,
          ...next.log,
        ].slice(0, 50),
      };
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
        supplyCostPerWeek: Math.round((annualCost / 12) * 1000) / 1000,
        supplyConcessions: [`GBP ${annualCost}bn a year in extra spending`, 'Prior notice of legislation'],
        relations: warmMutual(state.relations, state.player!.partyId, partner.id, SUPPLY_WARMTH),
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
        supplyCostPerWeek: Math.round((annualCost / 12) * 1000) / 1000,
        supplyConcessions: [`GBP ${annualCost}bn a year in extra spending`, 'Cabinet seats for the partner', 'Agreed programme for government'],
        coalition: true,
        coalitionPosts: [`${partner.name} takes two Cabinet posts`],
        relations: warmMutual(state.relations, state.player!.partyId, partner.id, COALITION_WARMTH),
        cabinet: [...state.cabinet, ...coalitionMinisters],
        metrics: { ...state.metrics, partyConfidence: Math.min(100, state.metrics.partyConfidence + 1) },
        log: [`COALITION: ${partner.name} enters government with two Cabinet seats, at GBP ${annualCost}bn a year.`, ...state.log].slice(0, 50),
      };
    }

    case 'TOGGLE_THRESHOLD_FREEZE': {
      if (inPurdah(state)) return state;
      const nowFrozen = !(state.thresholdsFrozen ?? true);
      if (nowFrozen) {
        const result = previewFiscalDrag(state, true);
        const next = applyEffects(state, { approval: -1 });
        return {
          ...next,
          thresholdsFrozen: true,
          fiscalDragRevenue: result.additionalRevenue,
          fiscalDragIntensity: result.intensity,
          taxpayersAffectedByDrag: result.taxpayersAffected,
          log: [
            `TREASURY: Income-tax thresholds frozen at £${FROZEN_THRESHOLDS.personalAllowance.toLocaleString()} / £${FROZEN_THRESHOLDS.basicRateCutoff.toLocaleString()} (projected £${result.additionalRevenue}bn/yr fiscal drag).`,
            ...next.log,
          ].slice(0, 50),
        };
      }
      const lostDrag = state.fiscalDragRevenue ?? 0;
      const next = applyEffects(state, { approval: 2, budgetBalance: -Math.round((lostDrag / 12) * 100) / 100 });
      return {
        ...next,
        thresholdsFrozen: false,
        fiscalDragRevenue: 0,
        fiscalDragIntensity: 'low',
        taxpayersAffectedByDrag: 0,
        thresholdFrozenTurns: 0,
        log: [
          `TREASURY: Income-tax and NI thresholds indexed to inflation, ending stealth bracket creep.`,
          ...next.log,
        ].slice(0, 50),
      };
    }

    case 'PURSUE_TRADE_DEAL': {
      if (inPurdah(state)) return state;
      const current = state.tradeDealStatus ?? DEFAULT_TRADE_DEAL_STATUS;
      const dealMap = {
        eu: current.euTradeDeal,
        usa: current.usaTradeDeal,
        china: current.chinaTradeDeal,
        india: current.indiaTradeDeal,
        commonwealth: current.cpTradeDeal,
      } as const;
      const existing = dealMap[action.partner];
      let updated = cloneTradeDealStatus(current);

      if (action.action === 'pursue') {
        if (!existing) {
          updated = calculateTradeDealChange(updated, 'ratify', action.partner);
        } else if (existing.status === 'expired' || existing.status === 'withdrawn') {
          const withdrawn = calculateTradeDealChange(updated, 'withdraw', action.partner);
          updated = calculateTradeDealChange(withdrawn, 'ratify', action.partner);
        } else if (action.partner === 'eu') {
          updated = calculateTradeDealChange(updated, 'expand', 'eu');
        } else {
          updated = calculateTradeDealChange(updated, 'conclude', action.partner);
        }
      } else {
        updated = calculateTradeDealChange(updated, 'withdraw', action.partner);
      }

      const prevEcon = calculateTradeDealEconomics(current);
      const nextEcon = calculateTradeDealEconomics(updated);
      const gdpDelta = r1(nextEcon.gdpImpact - prevEcon.gdpImpact);
      const next = applyEffects(state, {
        economy: action.action === 'pursue' ? 1 : -1,
        approval: action.action === 'pursue' ? 1 : -1,
        gdpGrowth: Math.round(gdpDelta * 0.1 * 100) / 100,
      });
      const partnerLabel: Record<typeof action.partner, string> = {
        eu: 'European Union',
        usa: 'United States',
        china: 'China',
        india: 'India',
        commonwealth: 'Commonwealth',
      };
      return {
        ...next,
        tradeDealStatus: updated,
        tradeGdpImpact: nextEcon.gdpImpact,
        log: [
          `TRADE: ${action.action === 'pursue' ? 'Advanced trade agreement with' : 'Suspended trade agreement with'} ${partnerLabel[action.partner]} (GDP impact ${nextEcon.gdpImpact >= 0 ? '+' : ''}${nextEcon.gdpImpact}%).`,
          ...next.log,
        ].slice(0, 50),
      };
    }

    case 'CALL_EARLY_ELECTION': {
      if (state.phase !== 'playing' || !!state.gameOver || state.isElection) return state;
      if (inPurdah(state) || state.week < 6) return state;

      const results = evaluatePledges(state, state.pledges ?? []);
      const kept = results.filter((r) => r.kept).length;
      const total = results.length;
      let next = runElection(state);
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
      next = {
        ...next,
        pledges: makePledges(next, (next.seed + next.week) >>> 0),
        log: [`SNAP ELECTION: The Prime Minister has dissolved Parliament and called an early general election.`, ...next.log].slice(0, 50),
        headlines: [
          { paper: 'The National Standard', title: 'PM DISSOLVES PARLIAMENT: CALLS SNAP GENERAL ELECTION', stance: 'centrist' as const },
          ...next.headlines,
        ].slice(0, 4),
      };
      return next;
    }

    case 'DISMISS_ELECTION':
      return { ...state, isElection: false };

    default:
      return state;
  }
}
