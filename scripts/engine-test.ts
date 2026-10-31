/**
 * Engine regression harness.
 *
 * No test framework and no network: compile with tsc, run with node.
 *   npm run test:engine
 *
 * It checks the invariants that silently break game balance: finite numbers,
 * bounded metrics, deterministic replay and a save migration that survives
 * older saves.
 */
/** Minimal assertion shim so this harness needs no node type definitions. */
const assert = {
  ok(value: unknown, message?: string) {
    if (!value) throw new Error(message ?? 'expected a truthy value');
  },
  equal<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(message ?? 'expected ' + String(expected) + ' but got ' + String(actual));
    }
  },
  notEqual<T>(actual: T, expected: T, message?: string) {
    if (actual === expected) throw new Error(message ?? 'values should differ');
  },
};
import { createInitialState, migrateState, reducer, advanceWeek, chancellorBudgetLeak, nhsWaitingDrift, annualPersonalAllowanceUpdate, structuralBalance, personalAllowanceRevenue } from '../src/app/engine';
import { advanceRelationDecay } from '../src/app/diplomacy';
import { DOSSIER_POOL, REGIONS, REGION_COUNCIL_META } from '../src/app/data';
import { BILL_POOL } from '../src/app/bills';
import { DOSSIER_POOL_2 } from '../src/app/dossiers2';
import { DOSSIER_POOL_3 } from '../src/app/dossiers3';
import type { GameState, Bill, CustomBudgetPlan } from '../src/app/types';
import { calculateCustomBudget, getDefaultCustomPlan, DEFAULT_PERSONAL_ALLOWANCE, PERSONAL_ALLOWANCE_STEP, PERSONAL_ALLOWANCE_MIN, PERSONAL_ALLOWANCE_MAX, PERSONAL_ALLOWANCE_COST_PER_STEP, FUEL_DUTY_FREEZE_COST, fuelDutyRecurringRevenue, TRIPLE_LOCK_COST, tripleLockRecurringRevenue, PUBLIC_SECTOR_PAY_COST, publicSectorPayRecurringRevenue, personalAllowanceRecurringRevenue, STAMP_DUTY_RELIEF_COST, stampDutyRecurringRevenue } from '../src/app/budget';
import { calculateFiscalDrag, FROZEN_THRESHOLDS } from '../src/app/fiscalDragIntegration';
import { SCENARIOS } from '../src/app/scenarios';
import { evaluatePledges } from '../src/app/pledges';
import { projectSeats } from '../src/app/electionProjection';
import { computeBlocs } from '../src/app/voterBlocs';
import { CONFIDENCE_WARNING_ID, SUPPLY_ULTIMATUM_ID } from '../src/app/confidenceWarning';
import { PMQ_POOL, PMQ_TEMPLATES } from '../src/app/politics';
import { getTraitDetails } from '../src/app/backgrounds';
import {
  CHANCELLOR_POST,
  HEALTH_SECRETARY_POST,
  CHANCELLOR_LEAK_LOYALTY_THRESHOLD,
  BUDGET_LEAK_CHANCE,
  HEALTH_SECRETARY_MAX_RELIEF,
  chancellorLeakRisk,
  budgetLeakRolls,
  healthSecretaryWaitingRelief,
} from '../src/app/cabinetEffects';
import type { Minister } from '../src/app/types';

let checks = 0;
let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
    console.log('  ok   ' + name);
  } catch (err) {
    failures += 1;
    console.error('  FAIL ' + name);
    console.error(err);
  }
}

function newGameWithBackground(background: string, partyId = 'reform', scenario?: string): GameState {
  let s = createInitialState();
  s = reducer(s, { type: 'SET_TERM_LENGTH', weeks: 60 });
  s = reducer(s, {
    type: 'CREATE_PLAYER',
    player: { firstName: 'Test', lastName: 'PM', partyId, background, scenario },
  });
  return s;
}

function newGame(partyId = 'reform', scenario?: string): GameState {
  return newGameWithBackground('City financier', partyId, scenario);
}

/** Play `weeks` weeks, resolving everything that lands on the desk. */
function play(state: GameState, weeks: number, choiceOffset = 0): GameState {
  let s = state;
  for (let i = 0; i < weeks; i++) {
    while (s.redBox.length > 0) {
      const d = s.redBox[0];
      const idx = (i + choiceOffset) % d.choices.length;
      s = reducer(s, { type: 'RESOLVE_DOSSIER', dossierId: d.id, choiceId: d.choices[idx].id });
    }
    if (s.pmq) s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
    if (s.budgetDue) s = reducer(s, { type: 'DELIVER_BUDGET', packageId: 'budget-middle' });
    if (s.isElection) s = reducer(s, { type: 'DISMISS_ELECTION' });
    if (s.gameOver) break;
    s = reducer(s, { type: 'START_TURN' });
  }
  return s;
}

function assertFinite(s: GameState) {
  const numbers: [string, number][] = [
    ['approval', s.metrics.approval],
    ['partyConfidence', s.metrics.partyConfidence],
    ['economy', s.metrics.economy],
    ['publicServices', s.metrics.publicServices],
    ['security', s.metrics.security],
    ['cpiInflation', s.stats.cpiInflation],
    ['gdpGrowth', s.stats.gdpGrowth],
    ['giltYield', s.stats.giltYield],
    ['debtToGdp', s.stats.debtToGdp],
    ['budgetBalance', s.stats.budgetBalance],
    ['unemployment', s.stats.unemployment],
    ['nhsWaitingList', s.stats.nhsWaitingList],
    ['netMigration', s.stats.netMigration],
    ['letters', s.stats.lettersOfNoConfidence],
    ['nhsPerformance', s.nhsPerformance ?? 0],
  ];
  for (const [name, v] of numbers) {
    assert.ok(Number.isFinite(v), name + ' is not finite: ' + v);
  }
}

console.log('engine tests');

check('new game has a usable initial position', () => {
  const s = newGame();
  assert.equal(s.phase, 'playing');
  assert.equal(s.parties.length, 5);
  assert.ok(s.parties.some((p) => p.seats > 0), 'seats were not projected');
  assert.ok(s.stats.lettersThreshold >= 15);
  assertFinite(s);
});

check('dossier pool is large, unique and complete', () => {
  const all = [...DOSSIER_POOL, ...DOSSIER_POOL_2, ...DOSSIER_POOL_3];
  assert.ok(all.length >= 25, 'pool too small for replayability: ' + all.length);
  const ids = new Set(all.map((d) => d.id));
  assert.equal(ids.size, all.length, 'duplicate dossier ids');
  for (const d of all) {
    assert.ok(d.choices.length >= 2, d.id + ' has fewer than two choices');
    assert.ok(d.leadParagraph.length > 20, d.id + ' has an empty lead');
    for (const c of d.choices) {
      assert.ok(Object.keys(c.effects).length > 0, d.id + '/' + c.id + ' has no effects');
    }
  }
});

check('a full term stays inside its bounds', () => {
  let s = newGame();
  for (let i = 0; i < 120; i++) {
    if (s.gameOver) break;
    s = play(s, 1, i);
    assertFinite(s);
    assert.ok(s.metrics.approval >= 0 && s.metrics.approval <= 100, 'approval out of range');
    assert.ok(s.metrics.partyConfidence >= 0 && s.metrics.partyConfidence <= 100, 'unity out of range');
    assert.ok(s.stats.lettersOfNoConfidence >= 0 && s.stats.lettersOfNoConfidence <= 99, 'letters out of range');
    assert.ok(s.stats.debtToGdp >= 30, 'debt below floor');
    for (const p of s.parties) {
      assert.ok(p.currentSupport >= 1 && p.currentSupport <= 60, 'support out of range for ' + p.id);
    }
  }
});

check('the simulation is deterministic for a fixed seed', () => {
  const a = play(newGame(), 40, 1);
  const b = play(newGame(), 40, 1);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'same seed diverged');
});

check('expensive government actually costs you the party', () => {
  const generous = play(newGame(), 60, 0);
  const frugal = play(newGame(), 60, 1);
  assertFinite(generous);
  assertFinite(frugal);
  assert.notEqual(
    JSON.stringify(generous.stats),
    JSON.stringify(frugal.stats),
    'choice strategy had no effect on the fiscal position',
  );
});

check('fiscal drag is applied from frozen thresholds', () => {
  const s = play(newGame(), 10);
  assert.ok(typeof s.fiscalDragRevenue === 'number', 'fiscalDragRevenue missing');
  assert.ok((s.fiscalDragRevenue ?? 0) > 0, 'fiscal drag raised nothing');
  assert.ok((s.thresholdFrozenTurns ?? 0) >= 10, 'threshold freeze counter not advancing');
});

check('NHS telemetry is produced weekly', () => {
  const s = play(newGame(), 8);
  assert.ok(typeof s.nhsPerformance === 'number', 'nhsPerformance missing');
  assert.ok((s.nhsPerformance ?? 0) >= 0 && (s.nhsPerformance ?? 0) <= 100, 'nhsPerformance out of range');
  assert.ok(!!s.nhsMetrics, 'nhsMetrics missing');
  assert.ok(Number.isFinite(s.nhsMetrics!.aeWaitingTime), 'aeWaitingTime not finite');
  assert.ok(Number.isFinite(s.nhsMetrics!.cancerWaitTime), 'cancerWaitTime not finite');
  assert.ok(Number.isFinite(s.nhsMetrics!.ambulanceResponse), 'ambulanceResponse not finite');
});

check('save migration fills new fields and keeps old progress', () => {
  const oldSave = {
    phase: 'playing' as const,
    week: 42,
    stats: { cpiInflation: 9.9, gdpGrowth: 0.1 },
    metrics: { approval: 12 },
    log: ['an old line'],
  };
  const migrated = migrateState(oldSave as never);

  assert.equal(migrated.week, 42, 'old progress lost');
  assert.equal(migrated.stats.cpiInflation, 9.9, 'saved stat overwritten');
  assert.equal(migrated.metrics.approval, 12, 'saved approval overwritten');
  assert.equal(migrated.log[0], 'an old line');

  // Fields added after that save must exist rather than be undefined.
  assert.ok(typeof migrated.stats.lettersThreshold === 'number');
  assert.ok(typeof migrated.metrics.partyConfidence === 'number');
  assert.ok(Array.isArray(migrated.taxes) && migrated.taxes.length > 0);
  assert.ok(Array.isArray(migrated.departments) && migrated.departments.length > 0);
  assert.ok(Array.isArray(migrated.parties) && migrated.parties.length === 5);
  assert.ok(!!migrated.nhsMetrics, 'migrated save missing nhsMetrics');
  assert.ok(!!migrated.tradeDealStatus, 'migrated save missing tradeDealStatus');
  assert.equal(migrated.thresholdsFrozen, true, 'migrated save should default thresholdsFrozen to true');
  assert.ok(typeof migrated.blindsideRisk === 'number', 'migrated save missing blindsideRisk');
});

check('corrupt saves are sanitised rather than crashing', () => {
  const broken = migrateState({ week: NaN, seed: NaN, stats: { cpiInflation: NaN } } as never);
  assert.equal(broken.week, 1);
  assert.ok(Number.isFinite(broken.seed), 'seed not repaired');
  assert.ok(Number.isFinite(broken.stats.cpiInflation), 'inflation not repaired');
  assertFinite(broken);
});

check('advanceWeek is pure with respect to its input', () => {
  const s = newGame();
  const snapshot = JSON.stringify(s);
  advanceWeek(s);
  assert.equal(JSON.stringify(s), snapshot, 'advanceWeek mutated its argument');
});

check('scenarios give genuinely different openings', () => {
  for (const sc of SCENARIOS) {
    const s = newGame('reform', sc.id);
    assert.equal(s.scenarioId, sc.id);
    assert.equal(Math.round(s.metrics.approval), sc.approval, sc.id + ' approval');
    assert.equal(Math.round(s.metrics.partyConfidence), sc.unity, sc.id + ' unity');
    if (sc.hungParliament) {
      const seats = s.parties.find((p) => p.id === 'reform')?.seats ?? 0;
      assert.ok(seats <= (sc.seatsCap ?? 300), sc.id + ' did not cap seats: ' + seats);
    }
    assertFinite(s);
  }
});

check('the 1922 ballot tallies the whole parliamentary party', () => {
  let s = newGame('reform', 'winter-of-discontent');
  s = {
    ...s,
    stats: { ...s.stats, lettersOfNoConfidence: s.stats.lettersThreshold },
    metrics: { ...s.metrics, partyConfidence: 25 },
  };
  s = advanceWeek(s);
  const seats = s.parties.find((p) => p.id === 'reform')?.seats ?? 0;
  assert.ok(!!s.lastVote, 'no ballot was recorded');
  const vote = s.lastVote!;
  assert.equal(vote.votesFor + vote.votesAgainst, seats, 'ballot did not cover the party');
  assert.ok(vote.votesAgainst > vote.votesFor, 'a collapsing leader should lose the ballot');
  assert.ok(!!s.gameOver, 'losing the ballot should end the premiership');
});

check('a minority government can buy confidence and supply', () => {
  let s = newGame('reform', 'hung-parliament');
  const own = s.parties.find((p) => p.id === 'reform')?.seats ?? 0;
  assert.ok(own < 326, 'hung parliament should leave us short: ' + own);
  const partner = [...s.parties]
    .filter((p) => p.id !== 'reform')
    .sort((a, b) => b.seats - a.seats)[0];
  s = reducer(s, { type: 'NEGOTIATE_SUPPLY', partyId: partner.id });
  if (s.supplyPartnerId) {
    assert.ok((s.supplyCostPerWeek ?? 0) > 0, 'a supply deal should cost money');
    const backers = own + (s.parties.find((p) => p.id === s.supplyPartnerId)?.seats ?? 0);
    assert.ok(backers >= 326, 'the deal should produce a majority');
  } else {
    assert.ok(own + partner.seats < 326, 'refused despite being able to govern');
  }
});

check('a partner who cannot deliver a majority is refused', () => {
  let s = newGame('reform', 'hung-parliament');
  const smallest = [...s.parties]
    .filter((p) => p.id !== 'reform')
    .sort((a, b) => a.seats - b.seats)[0];
  s = reducer(s, { type: 'NEGOTIATE_SUPPLY', partyId: smallest.id });
  assert.equal(s.supplyPartnerId, undefined, 'took a partner who cannot govern');
});

check('manifesto pledges are made and can be judged', () => {
  const s = newGame('reform', 'inherited-mess');
  assert.equal((s.pledges ?? []).length, 2, 'expected two pledges');
  const results = evaluatePledges(s, s.pledges ?? []);
  assert.equal(results.length, 2);
  for (const r of results) assert.ok(Number.isFinite(r.current), 'pledge metric unreadable');
});

check('voter blocs are computed and weighted to 1', () => {
  const s = play(newGame(), 4);
  const blocs = s.blocs ?? [];
  assert.equal(blocs.length, 5, 'expected five blocs');
  const total = blocs.reduce((sum, b) => sum + b.weight, 0);
  assert.ok(Math.abs(total - 1) < 0.001, 'weights should sum to 1, got ' + total);
  for (const b of blocs) {
    assert.ok(b.support >= 0 && b.support <= 100, b.id + ' out of range');
  }
});

check('a minority government faces a fixed-timetable confidence motion', () => {
  let s = newGame('reform', 'hung-parliament');
  // Week 24 is the first tabling week at or after the week-16 grace period.
  s = { ...s, week: 23, turnsUntilElection: 40 };
  s = advanceWeek(s);
  assert.ok(!!s.oppositionMotion, 'no motion tabled at week 24 without a majority');
  const due = s.oppositionMotion!.scheduledWeek;
  s = advanceWeek({ ...s, week: due });
  assert.ok(!s.oppositionMotion, 'motion never resolved');
});

check('hung parliament blocks confidence motions during months 1-3 and allows them from month 4', () => {
  // Months 1-3 fall inside the first-100-days grace window (months 1-3)
  const inGrace = advanceWeek({ ...newGame('reform', 'hung-parliament'), week: 2, turnsUntilElection: 40 });
  assert.equal(inGrace.week, 3);
  assert.ok(!inGrace.oppositionMotion, 'motion must be blocked during months 1-3');

  // Month 4 is outside the grace period (>= 4).
  // At month 6 (cadence 6 with approval < 30%), the motion is allowed and tabled
  const afterGrace = advanceWeek({
    ...newGame('reform', 'hung-parliament'),
    week: 5,
    metrics: { ...newGame('reform', 'hung-parliament').metrics, approval: 25 },
    turnsUntilElection: 40,
  });
  assert.equal(afterGrace.week, 6);
  assert.ok(!!afterGrace.oppositionMotion, 'motion should be tabled at month 6 once grace period has ended');
});

check('the grace period only applies to the hung-parliament scenario', () => {
  // A minority in another scenario keeps the old week-12 timetable.
  const base = newGame('reform', 'morning-in-britain');
  const minority: GameState = {
    ...base,
    week: 11,
    turnsUntilElection: 40,
    parties: base.parties.map((p) => (p.id === 'reform' ? { ...p, seats: 300 } : p)),
  };
  const after = advanceWeek(minority);
  assert.equal(after.week, 12);
  assert.ok(!!after.oppositionMotion, 'another scenario should still table at week 12');
});

check('a minority without a supply deal gets a one-time confidence warning', () => {
  const s = advanceWeek({ ...newGame('reform', 'hung-parliament'), week: 23, turnsUntilElection: 60 });
  assert.ok(!!s.oppositionMotion, 'expected a tabled motion');
  assert.equal(s.confidenceWarningShown, true, 'warning flag should be set');
  const warnings = (s.redBox ?? []).filter((d) => d.id === CONFIDENCE_WARNING_ID);
  assert.equal(warnings.length, 1, 'expected exactly one warning');
  assert.ok(warnings[0].choices.length > 0, 'warning should offer a way to negotiate');
  assert.ok(
    (s.log ?? []).some((l) => l.includes('confidence vote is being organised')),
    'warning should be logged',
  );
});

check('the confidence warning does not repeat on a later motion', () => {
  let s = advanceWeek({ ...newGame('reform', 'hung-parliament'), week: 23, turnsUntilElection: 60 });
  assert.ok((s.redBox ?? []).some((d) => d.id === CONFIDENCE_WARNING_ID));
  // Clear the paper and the motion, then let a later tabling week arrive.
  s = {
    ...s,
    oppositionMotion: undefined,
    redBox: (s.redBox ?? []).filter((d) => d.id !== CONFIDENCE_WARNING_ID),
    week: 35,
  };
  s = advanceWeek(s);
  assert.equal(s.week, 36);
  assert.ok(!!s.oppositionMotion, 'a later motion should still be tabled');
  assert.ok(!(s.redBox ?? []).some((d) => d.id === CONFIDENCE_WARNING_ID), 'warning must not repeat');
});

check('no confidence warning without the minority-and-no-supply conditions', () => {
  // A majority government never sees the warning.
  const majority = advanceWeek({ ...newGame('reform', 'inherited-mess'), week: 23, turnsUntilElection: 60 });
  assert.ok(!(majority.redBox ?? []).some((d) => d.id === CONFIDENCE_WARNING_ID));
  assert.ok(!majority.oppositionMotion, 'a majority should not face a confidence motion');

  // A minority that has bought a supply deal never sees the warning either.
  const base = newGame('reform', 'hung-parliament');
  const own = base.parties.find((p) => p.id === 'reform')?.seats ?? 0;
  const partner = [...base.parties]
    .filter((p) => p.id !== 'reform' && own + p.seats >= 326)
    .sort((a, b) => b.seats - a.seats)[0];
  const withSupply = reducer(base, { type: 'NEGOTIATE_SUPPLY', partyId: partner.id });
  assert.ok(!!withSupply.supplyPartnerId, 'supply deal should exist');
  const after = advanceWeek({ ...withSupply, week: 23, turnsUntilElection: 60 });
  assert.ok(!after.oppositionMotion, 'a supply deal should prevent tabling');
  assert.ok(!(after.redBox ?? []).some((d) => d.id === CONFIDENCE_WARNING_ID), 'no warning with a supply deal');
});

check('a large partner can be taken into coalition', () => {
  let s = newGame('reform', 'hung-parliament');
  const partner = [...s.parties].filter((p) => p.id !== 'reform').sort((a, b) => b.seats - a.seats)[0];
  s = reducer(s, { type: 'FORM_COALITION', partyId: partner.id });
  if (partner.seats >= 40) {
    assert.equal(s.coalition, true, 'coalition not formed');
    assert.ok((s.coalitionPosts ?? []).length > 0, 'no cabinet posts recorded');
    assert.ok((s.supplyCostPerWeek ?? 0) > 0, 'coalition should cost money');
  }
});

check('a coalition seats partner ministers and sacking them collapses it', () => {
  let s = newGame('reform', 'hung-parliament');
  const partner = [...s.parties].filter((p) => p.id !== 'reform').sort((a, b) => b.seats - a.seats)[0];
  s = reducer(s, { type: 'FORM_COALITION', partyId: partner.id });
  const partnerMinisters = s.cabinet.filter((m) => m.coalition);
  assert.equal(partnerMinisters.length, 2, 'expected two partner ministers');
  assert.ok(partnerMinisters.every((m) => m.partyId === partner.id));
  s = reducer(s, { type: 'SACK_MINISTER', name: partnerMinisters[0].name });
  assert.equal(s.coalition, false, 'coalition should collapse');
  assert.equal(s.supplyPartnerId, undefined, 'supply should be withdrawn');
});

check('seat geography drives bloc weights', () => {
  const s = newGame('reform', 'inherited-mess');
  assert.ok(Object.keys(s.regionSeats ?? {}).length > 0, 'no region seats recorded at game start');
  const blocs = s.blocs ?? [];
  assert.equal(blocs.length, 5);
  assert.ok(blocs.some((b) => b.seats > 0), 'no bloc holds any seats');
});

check('by-elections only take seats from the government', () => {
  const s = play(newGame('reform', 'winter-of-discontent'), 40);
  const bye = s.byElections ?? [];
  for (const b of bye) {
    assert.ok(Object.keys(s.regionSeats ?? {}).includes(b.regionId), 'unknown region ' + b.regionId);
  }
  const totalSeats = s.parties.reduce((sum, p) => sum + p.seats, 0);
  assert.ok(totalSeats <= 650, 'seat total should never exceed the Commons: ' + totalSeats);
});

check('the election result responds to how you have governed', () => {
  const base = newGame('reform', 'inherited-mess');
  const withPolling = (support: number): GameState => ({
    ...base,
    parties: base.parties.map((p) => (p.id === 'reform' ? { ...p, currentSupport: support } : p)),
  });
  const strong = projectSeats(withPolling(50)).totals.reform ?? 0;
  const middling = projectSeats(withPolling(34)).totals.reform ?? 0;
  const weak = projectSeats(withPolling(15)).totals.reform ?? 0;
  assert.ok(strong > middling, 'strong polling should win more seats');
  assert.ok(middling > weak, 'weak polling should win fewer seats');
});

check('hostile blocs cost seats even when polling holds', () => {
  const base = newGame('reform', 'inherited-mess');
  const withBlocs = (support: number): GameState => ({
    ...base,
    blocs: (base.blocs ?? []).map((b) => ({ ...b, support })),
  });
  const loyal = projectSeats(withBlocs(80)).totals.reform ?? 0;
  const hostile = projectSeats(withBlocs(20)).totals.reform ?? 0;
  assert.ok(loyal > hostile, 'loyal blocs should be worth seats');
});

check('the projection always fills the Commons', () => {
  const totals = projectSeats(newGame('reform', 'morning-in-britain')).totals;
  const seats = Object.values(totals).reduce((sum, n) => sum + n, 0);
  assert.equal(seats, 650, 'expected 650 seats');
});

check('PMQs runs a six-plus-two exchange and then clears', () => {
  let s = newGame('reform');
  for (let i = 0; i < 6 && !s.pmq; i++) s = advanceWeek(s);
  assert.ok(s.pmq, 'PMQs never came up');
  assert.equal(s.pmq?.total ?? 0, 8, 'a session should be eight questions');
  assert.equal(s.pmq?.asker ?? '', 'loto', 'the first questions come from the opposition leader');
  let rounds = 0;
  while (s.pmq && rounds < 20) {
    s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
    rounds += 1;
  }
  assert.equal(rounds, 8, 'exchange should be eight questions, got ' + rounds);
  assert.ok(!s.pmq, 'PMQs should clear once the exchange is answered');
});

check('manifesto pledges are party-aware', () => {
  const green = newGame('progressive');
  assert.equal((green.pledges ?? []).length, 2, 'a Green PM should still make two pledges');
  assert.ok(
    !(green.pledges ?? []).some((p) => p.metric === 'netMigration'),
    'a Green PM was offered a migration pledge',
  );
  const tory = newGame('conservative');
  assert.ok(
    !(tory.pledges ?? []).some((p) => p.metric === 'publicServices'),
    'a Conservative PM was offered a spending pledge',
  );
});

check('restive coalition ministers cost the government votes', () => {
  const base = newGame('reform');
  const s: GameState = {
    ...base,
    coalition: true,
    supplyPartnerId: 'liberty',
    cabinet: [
      ...base.cabinet,
      {
        name: 'Rebel One',
        post: 'Minister of State (Coalition)',
        partyId: 'liberty',
        loyalty: 20,
        competence: 60,
        faction: 'Coalition',
        coalition: true,
        ambition: 80,
      },
    ],
    bills: [{ ...BILL_POOL[0], weeksToPass: 1 }],
  };
  const after = advanceWeek(s);
  assert.ok(
    (after.log ?? []).some((l) => l.includes('COALITION REBELS')),
    'a restive coalition minister should be recorded as rebelling',
  );
});

check('only ambitious coalition ministers rebel and are punished', () => {
  const base = newGame('reform');
  const s: GameState = {
    ...base,
    coalition: true,
    supplyPartnerId: 'liberty',
    cabinet: [
      ...base.cabinet,
      {
        name: 'Reluctant One',
        post: 'Minister of State (Coalition)',
        partyId: 'liberty',
        loyalty: 30,
        competence: 60,
        faction: 'Coalition',
        coalition: true,
        ambition: 20,
      },
    ],
    bills: [{ ...BILL_POOL[0], weeksToPass: 1 }],
  };
  const after = advanceWeek(s);
  assert.ok(
    !(after.log ?? []).some((l) => l.includes('COALITION REBELS')),
    'an unambitious coalition minister should not be recorded as rebelling',
  );
  const who = after.cabinet.find((m) => m.name === 'Reluctant One');
  assert.equal(who?.loyalty ?? -1, 30, 'the unambitious minister should keep their loyalty');
});

check('a bad 1922 mood forces a mid-term reshuffle', () => {
  const base = newGame('reform');
  const s: GameState = {
    ...base,
    week: 12,
    lastReshuffleWeek: undefined,
    backbenchers: [
      { name: 'Fresh Face', partyId: 'reform', faction: 'One Nation', loyalty: 70, competence: 70, ambition: 60 },
      ...base.backbenchers.map((b) => ({ ...b, loyalty: 10, ambition: 90 })),
    ],
  };
  const after = advanceWeek(s);
  assert.ok((after.log ?? []).some((l) => l.includes('RESHUFFLE')), 'no reshuffle happened');
  assert.ok(typeof after.lastReshuffleWeek === 'number', 'reshuffle was not recorded');
});

check('diplomacy warms with a confidence-and-supply deal', () => {
  const s = newGame('reform', 'hung-parliament');
  const own = s.parties.find((p) => p.id === 'reform')?.seats ?? 0;
  const partner = [...s.parties].filter((p) => p.id !== 'reform' && own + p.seats >= 326).sort((a, b) => b.seats - a.seats)[0];
  const before = s.relations.find((r) => r.from === 'reform' && r.to === partner.id)?.score ?? 0;
  const after = reducer(s, { type: 'NEGOTIATE_SUPPLY', partyId: partner.id }).relations.find((r) => r.from === 'reform' && r.to === partner.id)?.score ?? 0;
  assert.ok(after > before, 'a supply deal should raise the relationship score');
});

check('strong relations cool toward the cap', () => {
  const cooled = advanceRelationDecay([{ from: 'a', to: 'b', score: 70 }]);
  assert.equal(cooled[0].score, 69, 'a strong relation should cool by one point');
  const floored = advanceRelationDecay([{ from: 'a', to: 'b', score: 60 }]);
  assert.equal(floored[0].score, 60, 'cooling must not drop below the strong-relation threshold');
  const base = newGame('reform', 'hung-parliament');
  const s = { ...base, relations: base.relations.map((r) => (r.from === 'reform' && r.to === 'liberty' ? { ...r, score: 70 } : r)) };
  const afterWeek = advanceWeek(s);
  assert.equal(afterWeek.relations.find((r) => r.from === 'reform' && r.to === 'liberty')?.score, 69, 'advanceWeek should cool a strong relation');
});

check('diplomacy is deterministic for a fixed seed', () => {
  const run = () => {
    let s = newGame('reform', 'hung-parliament');
    const own = s.parties.find((p) => p.id === 'reform')?.seats ?? 0;
    const partner = [...s.parties].filter((p) => p.id !== 'reform' && own + p.seats >= 326).sort((a, b) => b.seats - a.seats)[0];
    s = reducer(s, { type: 'NEGOTIATE_SUPPLY', partyId: partner.id });
    s = { ...s, relations: s.relations.map((r) => (r.from === 'reform' && r.to === 'liberty' ? { ...r, score: 70 } : r)) };
    for (let i = 0; i < 5; i++) s = advanceWeek(s);
    return JSON.stringify(s.relations);
  };
  assert.equal(run(), run(), 'diplomacy drifted non-deterministically across replays');
});

check('threshold freeze can be toggled off and back on', () => {
  let s = newGame();
  assert.equal(s.thresholdsFrozen, true, 'thresholds should start frozen');
  s = play(s, 3);
  assert.ok((s.fiscalDragRevenue ?? 0) > 0, 'expected positive fiscal drag while frozen');
  assert.ok((s.thresholdFrozenTurns ?? 0) >= 3, 'expected frozen turn counter to advance');

  s = reducer(s, { type: 'TOGGLE_THRESHOLD_FREEZE' });
  assert.equal(s.thresholdsFrozen, false, 'toggle should unfreeze thresholds');
  assert.equal(s.fiscalDragRevenue, 0, 'unfreezing should clear fiscalDragRevenue');
  assert.equal(s.thresholdFrozenTurns, 0, 'unfreezing should reset thresholdFrozenTurns');

  s = advanceWeek(s);
  assert.equal(s.fiscalDragRevenue, 0, 'indexed thresholds should produce zero drag revenue');
  assert.equal(s.thresholdFrozenTurns, 0, 'frozen turn counter should stay zero while indexed');

  s = reducer(s, { type: 'TOGGLE_THRESHOLD_FREEZE' });
  assert.equal(s.thresholdsFrozen, true, 'second toggle should refreeze thresholds');
  s = advanceWeek(s);
  assert.ok((s.fiscalDragRevenue ?? 0) > 0, 'refreezing should resume fiscal drag revenue');
  assert.equal(s.thresholdFrozenTurns, 1, 'refreezing should restart frozen turn counter');
});

check('trade deals can be suspended and pursued and affect monthly economics', () => {
  let s = newGame();
  assert.ok(!!s.tradeDealStatus?.usaTradeDeal, 'USA trade deal should start active');
  const initialImpact = s.tradeGdpImpact ?? 0;

  s = reducer(s, { type: 'PURSUE_TRADE_DEAL', partner: 'usa', action: 'suspend' });
  assert.equal(s.tradeDealStatus?.usaTradeDeal, null, 'suspending USA deal should withdraw it');
  assert.ok((s.tradeGdpImpact ?? 0) < initialImpact, 'suspending USA deal should lower tradeGdpImpact');

  const suspendedImpact = s.tradeGdpImpact ?? 0;
  s = { ...s, week: 3 };
  s = advanceWeek(s); // week 4 triggers periodicExternal
  assert.equal(s.tradeGdpImpact, suspendedImpact, 'periodicExternal should use state tradeDealStatus');

  s = reducer(s, { type: 'PURSUE_TRADE_DEAL', partner: 'usa', action: 'pursue' });
  assert.ok(!!s.tradeDealStatus?.usaTradeDeal, 'pursuing USA deal should restore it');
  assert.equal(s.tradeGdpImpact, initialImpact, 'restoring USA deal should restore tradeGdpImpact');
});

check('blindside risk is updated weekly from 1922 Committee pressure', () => {
  let s = newGame();
  assert.equal(s.blindsideRisk, 10, 'initial blindsideRisk should be low (10)');
  s = {
    ...s,
    stats: { ...s.stats, lettersOfNoConfidence: 72, lettersThreshold: 90 },
    metrics: { ...s.metrics, partyConfidence: 30 },
  };
  s = advanceWeek(s);
  assert.equal(s.blindsideRisk, 80, 'high letters should push blindsideRisk to 80');
});

check('Insider background adds confidence and relieves one starting letter', () => {
  const neutral = newGameWithBackground('Former broadcast journalist');
  const insider = newGameWithBackground('Insider');
  assert.equal(insider.metrics.partyConfidence, neutral.metrics.partyConfidence + 5, 'Insider confidence');
  assert.equal(
    insider.stats.lettersOfNoConfidence,
    neutral.stats.lettersOfNoConfidence - 1,
    'Insider should reduce starting letters by one',
  );
  assert.equal(insider.stats.lettersThreshold, neutral.stats.lettersThreshold, 'Insider should not move the threshold too');
  assert.equal(insider.metrics.approval, neutral.metrics.approval, 'Insider should not change approval');

  // The existing background label resolves to the same trait.
  const labelled = newGameWithBackground('Seasoned cabinet minister');
  assert.equal(labelled.metrics.partyConfidence, insider.metrics.partyConfidence);
});

check('Activist background adds approval and softens the blue-wall tax penalty', () => {
  const neutral = newGameWithBackground('Former broadcast journalist');
  const activist = newGameWithBackground('Activist');
  assert.equal(activist.metrics.approval, neutral.metrics.approval + 3, 'Activist approval');
  assert.equal(activist.metrics.partyConfidence, neutral.metrics.partyConfidence, 'Activist should not change unity');

  const blueWallAt = (s: GameState, taxRate: number): number => {
    const blocs = computeBlocs({ ...s, stats: { ...s.stats, taxRate } });
    return blocs.find((b) => b.id === 'blue-wall')?.support ?? 0;
  };
  // Compare with the same approval so only the tax-penalty relief differs.
  const activistAtNeutralApproval: GameState = {
    ...activist,
    metrics: { ...activist.metrics, approval: neutral.metrics.approval },
  };
  const smallHike = 34;
  const bigHike = 40;
  assert.ok(
    blueWallAt(activistAtNeutralApproval, smallHike) > blueWallAt(neutral, smallHike),
    'Activist should soften a small tax rise',
  );
  assert.ok(
    blueWallAt(activistAtNeutralApproval, bigHike) > blueWallAt(neutral, bigHike),
    'Activist should soften a large tax rise',
  );
  assert.ok(
    blueWallAt(activistAtNeutralApproval, bigHike) - blueWallAt(neutral, bigHike) <= 2,
    'Activist tax relief should be capped at two points',
  );
});

check('Business background lowers starting gilt yields by 0.2 points', () => {
  const neutral = newGameWithBackground('Former broadcast journalist');
  const business = newGameWithBackground('Business');
  assert.equal(business.stats.giltYield, Math.round((neutral.stats.giltYield - 0.2) * 10) / 10);
  // The existing label is the same trait.
  assert.equal(newGameWithBackground('City financier').stats.giltYield, business.stats.giltYield);
});

check('Intellectual background cuts introduced bill rebellion risk by five points once', () => {
  const billId = BILL_POOL[1].id;
  const neutral = reducer(newGameWithBackground('Former broadcast journalist'), { type: 'PROPOSE_BILL', billId });
  const intellectual = reducer(newGameWithBackground('Academic economist'), { type: 'PROPOSE_BILL', billId });
  const neutralBill = neutral.bills.find((b) => b.id === billId);
  const intellectualBill = intellectual.bills.find((b) => b.id === billId);
  assert.ok(!!neutralBill && !!intellectualBill, 'bill was not introduced');
  assert.equal(neutralBill!.rebellionRisk, BILL_POOL[1].rebellionRisk, 'neutral bill risk changed');
  assert.equal(
    intellectualBill!.rebellionRisk,
    Math.max(0, BILL_POOL[1].rebellionRisk - 5),
    'Intellectual should shave five points',
  );
  // Re-introducing the same bill is a no-op, so the risk cannot be shaved twice.
  const again = reducer(intellectual, { type: 'PROPOSE_BILL', billId });
  assert.equal(again.bills.find((b) => b.id === billId)!.rebellionRisk, intellectualBill!.rebellionRisk);
});

check('NEW_GAME resets background bonuses', () => {
  const insider = newGameWithBackground('Insider');
  const reset = reducer(insider, { type: 'NEW_GAME' });
  assert.equal(reset.phase, 'create');
  assert.equal(reset.player, null);
  assert.equal(reset.metrics.partyConfidence, 62);
  assert.equal(reset.metrics.approval, 48);
  assert.equal(reset.stats.lettersOfNoConfidence, 8);
  assert.equal(reset.stats.giltYield, 4.15);
});

check('restoring a save does not re-apply background bonuses', () => {
  const saved = newGameWithBackground('Business');
  const restored = migrateState(JSON.parse(JSON.stringify(saved)) as GameState);
  assert.equal(restored.stats.giltYield, saved.stats.giltYield, 'gilt yield changed on restore');
  const insiderSaved = newGameWithBackground('Insider');
  const insiderRestored = migrateState(JSON.parse(JSON.stringify(insiderSaved)) as GameState);
  assert.equal(insiderRestored.metrics.partyConfidence, insiderSaved.metrics.partyConfidence);
  assert.equal(insiderRestored.stats.lettersOfNoConfidence, insiderSaved.stats.lettersOfNoConfidence);
});

function pmqReady(letters = 5): GameState {
  let s = newGame('reform', 'inherited-mess');
  for (let i = 0; i < 6 && !s.pmq; i++) s = advanceWeek(s);
  if (!s.pmq) throw new Error('PMQs never came up');
  return { ...s, stats: { ...s.stats, lettersOfNoConfidence: letters } };
}

function withBill(seats: number, bill: Bill | null, letters = 5): GameState {
  const base = newGame('reform', 'inherited-mess');
  return {
    ...base,
    week: 10,
    turnsUntilElection: 50,
    parties: base.parties.map((p) => (p.id === 'reform' ? { ...p, seats } : p)),
    metrics: { ...base.metrics, partyConfidence: 50 },
    stats: { ...base.stats, lettersOfNoConfidence: letters },
    bills: bill ? [{ ...bill, weeksToPass: 1 }] : [],
  };
}

check('a fully answered PMQs session removes one no-confidence letter', () => {
  let s = pmqReady(5);
  let rounds = 0;
  while (s.pmq && rounds < 20) {
    s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
    rounds += 1;
  }
  assert.equal(rounds, 8, 'expected a full eight-question exchange');
  assert.equal(s.stats.lettersOfNoConfidence, 4, 'completed PMQs should remove one letter');
  assert.ok(!s.pmq, 'session should be resolved');
});

check('dismissed, partial or unresolved PMQs remove no letter', () => {
  const dismissed = reducer(pmqReady(5), { type: 'DISMISS_PMQ' });
  assert.equal(dismissed.stats.lettersOfNoConfidence, 5, 'a skipped PMQs must not help');
  assert.ok(!dismissed.pmq);

  let partial = pmqReady(5);
  partial = reducer(partial, { type: 'ANSWER_PMQ', optionId: partial.pmq!.options[0].id });
  partial = reducer(partial, { type: 'ANSWER_PMQ', optionId: partial.pmq!.options[0].id });
  partial = reducer(partial, { type: 'DISMISS_PMQ' });
  assert.equal(partial.stats.lettersOfNoConfidence, 5, 'a partially answered PMQs must not help');
  assert.ok(!partial.pmq);

  const unresolved = pmqReady(5);
  assert.ok(!!unresolved.pmq);
  assert.equal(unresolved.stats.lettersOfNoConfidence, 5, 'an open PMQs must not help');
});

check('PMQs letter relief respects the zero floor and cannot be applied twice', () => {
  let zero = pmqReady(0);
  while (zero.pmq) zero = reducer(zero, { type: 'ANSWER_PMQ', optionId: zero.pmq.options[0].id });
  assert.equal(zero.stats.lettersOfNoConfidence, 0, 'letters must not go below zero');

  let s = pmqReady(1);
  while (s.pmq) s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
  assert.equal(s.stats.lettersOfNoConfidence, 0);
  const duplicate = reducer(s, { type: 'ANSWER_PMQ', optionId: 'defend' });
  assert.equal(duplicate.stats.lettersOfNoConfidence, 0, 'a completed session must not pay out twice');
  assert.equal(duplicate, s, 'answering a cleared PMQs should be a no-op');
});

const zeroEffectBill: Bill = {
  ...BILL_POOL[0],
  weeksToPass: 1,
  rebellionRisk: 0,
  fiscalCost: 0,
  effects: {},
};

check('a passed bill adds five party confidence and removes one letter', () => {
  const passed = advanceWeek(withBill(400, zeroEffectBill));
  const control = advanceWeek(withBill(400, null));
  assert.ok(passed.passedLaws.includes(zeroEffectBill.title), 'bill should have passed');
  assert.ok(!control.passedLaws.includes(zeroEffectBill.title), 'control should have no law');
  assert.equal(
    passed.stats.lettersOfNoConfidence,
    control.stats.lettersOfNoConfidence - 1,
    'a carried bill should remove one active letter',
  );
  const confidenceGain = passed.metrics.partyConfidence - control.metrics.partyConfidence;
  assert.ok(confidenceGain > 4 && confidenceGain <= 5, 'expected roughly a five-point unity gain, got ' + confidenceGain);
});

check('a failed bill gets no unity bonus or letter relief', () => {
  const failed = advanceWeek(withBill(200, zeroEffectBill));
  const control = advanceWeek(withBill(200, null));
  assert.ok(!failed.passedLaws.includes(zeroEffectBill.title), 'bill should have failed');
  assert.equal(
    failed.stats.lettersOfNoConfidence,
    control.stats.lettersOfNoConfidence,
    'a defeated bill must not remove a letter',
  );
  assert.ok(
    failed.metrics.partyConfidence < control.metrics.partyConfidence,
    'a defeated bill should not receive the unity bonus',
  );
});

check('a passed bill benefit is applied once and respects the zero floor', () => {
  const zero = advanceWeek(withBill(400, zeroEffectBill, 0));
  assert.equal(zero.stats.lettersOfNoConfidence, 0, 'letters must not go below zero');

  const first = advanceWeek(withBill(400, zeroEffectBill));
  const second = advanceWeek(first);
  assert.equal(
    second.passedLaws.filter((title) => title === zeroEffectBill.title).length,
    1,
    'the same bill must not pass twice',
  );
  assert.equal(second.bills.length, 0, 'the resolved bill should not remain active');
  assert.ok(
    second.metrics.partyConfidence < first.metrics.partyConfidence + 1,
    'the unity bonus must not be applied again on a later week',
  );
});

function reshuffleReady(overrides: Partial<GameState> = {}): GameState {
  const base = newGame('reform');
  return {
    ...base,
    week: 12,
    lastReshuffleWeek: undefined,
    backbenchers: [
      { name: 'Fresh Face', partyId: 'reform', faction: 'One Nation', loyalty: 70, competence: 70, ambition: 60 },
      ...base.backbenchers.map((b) => ({ ...b, loyalty: 10, ambition: 90 })),
    ],
    ...overrides,
  };
}

check('a reshuffle that promotes a backbencher grants a capped discipline bonus', () => {
  const before = reshuffleReady();
  const after = advanceWeek(before);
  const control = advanceWeek(reshuffleReady({ backbenchers: [] }));
  assert.ok((after.log ?? []).some((l) => l.includes('RESHUFFLE')), 'no reshuffle happened');
  assert.equal(after.lastReshuffleWeek, 13, 'reshuffle should be stamped on the week clock');
  assert.equal(after.reshuffleDisciplineBonus, 2, 'expected the capped discipline bonus');
  assert.ok(after.cabinet.some((m) => m.name === 'Fresh Face'), 'backbencher was not promoted');
  assert.equal(after.backbenchers.length, before.backbenchers.length - 1, 'promoted backbencher should leave the bench');
  assert.equal(
    after.metrics.partyConfidence,
    control.metrics.partyConfidence + 2,
    'promotion should add the modest confidence bonus',
  );
});

check('a reshuffle without a backbencher promotion earns no discipline bonus', () => {
  const before = reshuffleReady({ backbenchers: [] });
  const after = advanceWeek(before);
  assert.ok(!(after.log ?? []).some((l) => l.includes('RESHUFFLE')), 'no promotion means no reshuffle');
  assert.equal(after.lastReshuffleWeek, undefined, 'no reshuffle should not be stamped');
  assert.equal(after.reshuffleDisciplineBonus, undefined, 'no promotion should earn no bonus');
  assert.equal(after.backbenchers.length, 0, 'there was no backbencher to promote');
});

check('the reshuffle discipline bonus expires on the existing week clock', () => {
  const after = advanceWeek(reshuffleReady()); // reshuffle at week 13
  assert.equal(after.reshuffleDisciplineBonus, 2);

  const stillActive = advanceWeek({ ...after, week: 16 }); // week 17, inside the window
  assert.equal(stillActive.reshuffleDisciplineBonus, 2, 'bonus expired too early');

  const expired = advanceWeek({ ...after, week: 17 }); // week 18, after the window
  assert.equal(expired.reshuffleDisciplineBonus, undefined, 'bonus did not expire');

  const control = advanceWeek({ ...after, week: 17, reshuffleDisciplineBonus: undefined });
  assert.ok(
    expired.metrics.partyConfidence < control.metrics.partyConfidence,
    'expiry should remove the confidence that was granted',
  );
});

check('reshuffle discipline does not stack beyond its cap', () => {
  const first = advanceWeek(reshuffleReady()); // week 13, bonus 2
  assert.equal(first.reshuffleDisciplineBonus, 2);

  // At week 21 the first bonus has expired and the 8-week cooldown allows a
  // second qualifying reshuffle. It should grant at most the same cap.
  const second = advanceWeek({ ...first, week: 20 });
  assert.equal(second.lastReshuffleWeek, 21);
  assert.equal(second.reshuffleDisciplineBonus, 2, 'reshuffle bonus stacked beyond its cap');
});

check('reshuffle expiry removes the discipline bonus only once', () => {
  const after = advanceWeek(reshuffleReady()); // week 13
  const expired = advanceWeek({ ...after, week: 17 }); // week 18, first week past the window
  assert.equal(expired.reshuffleDisciplineBonus, undefined);

  const next = advanceWeek(expired); // week 19
  assert.equal(next.reshuffleDisciplineBonus, undefined);
  const drop = expired.metrics.partyConfidence - next.metrics.partyConfidence;
  assert.ok(drop < 2, 'expiry should not subtract the bonus again, drop was ' + drop);
});

check('reshuffle bookkeeping is reset and sanitised on load', () => {
  const fresh = createInitialState();
  assert.equal(fresh.lastReshuffleWeek, undefined);
  assert.equal(fresh.reshuffleDisciplineBonus, undefined);

  const base = newGame();
  const capped = migrateState({ ...base, lastReshuffleWeek: 10, reshuffleDisciplineBonus: 99 } as GameState);
  assert.equal(capped.lastReshuffleWeek, 10);
  assert.equal(capped.reshuffleDisciplineBonus, 2, 'saved discipline bonus should be capped');

  const orphan = migrateState({ ...base, lastReshuffleWeek: undefined, reshuffleDisciplineBonus: 2 } as GameState);
  assert.equal(orphan.reshuffleDisciplineBonus, undefined, 'orphaned discipline bonus should be dropped');
});

function withChancellorLoyalty(loyalty: number): GameState {
  const base = newGame('reform', 'inherited-mess');
  return {
    ...base,
    cabinet: base.cabinet.map((m) => (m.post === CHANCELLOR_POST ? { ...m, loyalty } : m)),
  };
}

function withHealthSecretary(loyalty: number, competence: number): GameState {
  const base = newGame('reform', 'inherited-mess');
  return {
    ...base,
    cabinet: base.cabinet.map((m) => (m.post === HEALTH_SECRETARY_POST ? { ...m, loyalty, competence } : m)),
  };
}

const secretaryFixture: Minister = {
  name: 'Test Secretary',
  post: HEALTH_SECRETARY_POST,
  partyId: 'reform',
  loyalty: 50,
  competence: 50,
  faction: 'Centrist',
};

check('a disloyal Chancellor can leak the Budget and hurt economic credibility', () => {
  const low = withChancellorLoyalty(30);
  const leaked = chancellorBudgetLeak(low, 0.1);
  assert.notEqual(leaked, low, 'a fired leak should produce a new state');
  assert.equal(
    leaked.stats.giltYield,
    Math.round((low.stats.giltYield + 0.1) * 10) / 10,
    'a leak should nudge gilt yields up by one tenth',
  );
  assert.ok(leaked.metrics.approval < low.metrics.approval, 'a leak should cost approval');
  assert.ok((leaked.log ?? []).some((l) => l.includes('BUDGET LEAK')), 'a leak should be logged');
  assert.equal(JSON.stringify(leaked.cabinet), JSON.stringify(low.cabinet), 'cabinet average must be untouched');
});

check('the budget leak respects the loyalty threshold, the roll and a missing Chancellor', () => {
  assert.equal(CHANCELLOR_LEAK_LOYALTY_THRESHOLD, 40);
  assert.equal(chancellorLeakRisk(undefined), false, 'no Chancellor, no leak risk');
  assert.equal(chancellorLeakRisk({ ...secretaryFixture, post: CHANCELLOR_POST, loyalty: 40 }), false, 'loyalty 40 is not below the threshold');
  assert.equal(chancellorLeakRisk({ ...secretaryFixture, post: CHANCELLOR_POST, loyalty: 39 }), true, 'loyalty 39 is below the threshold');
  assert.equal(
    budgetLeakRolls({ ...secretaryFixture, post: CHANCELLOR_POST, loyalty: 30 }, BUDGET_LEAK_CHANCE),
    false,
    'a roll at the chance boundary must not fire',
  );
  assert.equal(
    budgetLeakRolls({ ...secretaryFixture, post: CHANCELLOR_POST, loyalty: 30 }, BUDGET_LEAK_CHANCE - 0.01),
    true,
    'a roll below the chance should fire',
  );

  const loyal = withChancellorLoyalty(60);
  assert.equal(chancellorBudgetLeak(loyal, 0), loyal, 'a loyal Chancellor must not leak');
  const low = withChancellorLoyalty(30);
  assert.equal(chancellorBudgetLeak(low, 0.9), low, 'a failed roll must not leak');
  const noChancellor: GameState = { ...low, cabinet: low.cabinet.filter((m) => m.post !== CHANCELLOR_POST) };
  assert.equal(chancellorBudgetLeak(noChancellor, 0), noChancellor, 'a missing Chancellor must not leak');
});

check('a loyal or skilled Health Secretary relief is modest, capped and thresholded', () => {
  assert.equal(healthSecretaryWaitingRelief(undefined), 0, 'no secretary, no relief');
  assert.equal(healthSecretaryWaitingRelief({ ...secretaryFixture, loyalty: 50, competence: 50 }), 0, 'neutral quality, no relief');
  assert.equal(healthSecretaryWaitingRelief({ ...secretaryFixture, loyalty: 40, competence: 40 }), 0, 'below the floor, no relief');
  assert.ok(healthSecretaryWaitingRelief({ ...secretaryFixture, loyalty: 90, competence: 40 }) > 0, 'high loyalty should help');
  assert.ok(healthSecretaryWaitingRelief({ ...secretaryFixture, loyalty: 40, competence: 95 }) > 0, 'high skill should help');
  assert.equal(
    healthSecretaryWaitingRelief({ ...secretaryFixture, loyalty: 100, competence: 100 }),
    HEALTH_SECRETARY_MAX_RELIEF,
    'relief must be capped at the maximum',
  );
});

check('the Health Secretary slows waiting-list growth without touching other state', () => {
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const neutral = withHealthSecretary(50, 50);
  const strong = withHealthSecretary(90, 90);
  const none: GameState = { ...neutral, cabinet: neutral.cabinet.filter((m) => m.post !== HEALTH_SECRETARY_POST) };
  const maxed = withHealthSecretary(100, 100);

  assert.ok(close(nhsWaitingDrift(neutral), 0.06), 'neutral secretary should leave the base drift');
  assert.ok(close(nhsWaitingDrift(none), 0.06), 'no secretary should leave the base drift');
  assert.ok(nhsWaitingDrift(strong) < nhsWaitingDrift(neutral), 'a strong secretary should slow growth');
  assert.ok(close(nhsWaitingDrift(maxed), 0.02), 'the capped relief should be 0.04 off the base drift');
  assert.ok(nhsWaitingDrift(maxed) >= -0.2 && nhsWaitingDrift(maxed) <= 0.25, 'drift must stay inside its bounds');

  // Integration: a strong secretary grows the waiting list more slowly over time.
  let weakRun = neutral;
  let strongRun = strong;
  for (let i = 0; i < 8; i++) {
    weakRun = advanceWeek(weakRun);
    strongRun = advanceWeek(strongRun);
  }
  assert.ok(
    strongRun.stats.nhsWaitingList < weakRun.stats.nhsWaitingList,
    'a strong secretary should produce a lower waiting list',
  );
  const held = strongRun.cabinet.find((m) => m.post === HEALTH_SECRETARY_POST);
  assert.equal(held?.loyalty, 90, 'loyalty must be read, not rewritten');
  assert.equal(held?.competence, 90, 'competence must be read, not rewritten');
});

check('prison capacity barracks choice applies real budget and approval trade-off and preserves early release', () => {
  const dossier = DOSSIER_POOL.find((d) => d.id === 'dos-prison-capacity');
  assert.ok(!!dossier, 'dos-prison-capacity not found');
  assert.equal(dossier!.choices.length, 2);

  const base: GameState = {
    ...newGame('reform', 'inherited-mess'),
    redBox: [{ ...dossier! }],
  };

  // Requisition barracks choice: live cost to budget balance, live positive approval gain.
  const barracksChoice = dossier!.choices.find((c) => c.id === 'emergency-pre-fabs');
  assert.ok(!!barracksChoice, 'emergency-pre-fabs choice not found');
  assert.equal(barracksChoice!.effects.budgetBalance, -2, 'barracks should have -2 budgetBalance cost');
  assert.equal(barracksChoice!.effects.approval, 1, 'barracks should have +1 approval');

  const afterBarracks = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-prison-capacity',
    choiceId: 'emergency-pre-fabs',
  });

  // Verify live state changes
  assert.equal(
    afterBarracks.stats.budgetBalance,
    Math.round((base.stats.budgetBalance - 2) * 10) / 10,
    'barracks must reduce budgetBalance by 2',
  );
  assert.ok(
    afterBarracks.metrics.approval > base.metrics.approval,
    'barracks must increase approval',
  );
  assert.ok(
    !afterBarracks.redBox.some((d) => d.id === 'dos-prison-capacity'),
    'dossier must be cleared from redBox',
  );

  // Early release choice: preserves existing outcomes (-5 approval, +3 services, +2 letters, no budget hit).
  const releaseChoice = dossier!.choices.find((c) => c.id === 'early-release');
  assert.ok(!!releaseChoice, 'early-release choice not found');
  assert.equal(releaseChoice!.effects.approval, -5);
  assert.equal(releaseChoice!.effects.publicServices, 3);
  assert.equal(releaseChoice!.effects.lettersDelta, 2);

  const afterRelease = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-prison-capacity',
    choiceId: 'early-release',
  });

  assert.equal(
    afterRelease.stats.budgetBalance,
    base.stats.budgetBalance,
    'early release should not alter budgetBalance',
  );
  assert.equal(
    afterRelease.metrics.approval,
    base.metrics.approval - 5,
    'early release should reduce approval by 5',
  );
  assert.equal(
    afterRelease.metrics.publicServices,
    base.metrics.publicServices + 3,
    'early release should increase publicServices by 3',
  );
  assert.equal(
    afterRelease.stats.lettersOfNoConfidence,
    base.stats.lettersOfNoConfidence + 2,
    'early release should add 2 letters',
  );
});

check('children mental health waiting times target choice applies live state consequences and preserves schools option', () => {
  const dossier = DOSSIER_POOL_3.find((d) => d.id === 'dos-mental-health-waits');
  assert.ok(!!dossier, 'dos-mental-health-waits not found');
  assert.equal(dossier!.choices.length, 2);

  const base: GameState = {
    ...newGame('reform', 'inherited-mess'),
    redBox: [{ ...dossier! }],
  };

  // Choice 2 (mh-targets): unfunded target strains services, harms approval and party confidence, with no dead keys.
  const targetChoice = dossier!.choices.find((c) => c.id === 'mh-targets');
  assert.ok(!!targetChoice, 'mh-targets choice not found');
  assert.equal(targetChoice!.effects.approval, -2, 'target should reduce approval by 2');
  assert.equal(targetChoice!.effects.publicServices, -2, 'target should reduce publicServices by 2');
  assert.equal(targetChoice!.effects.partyConfidence, -1, 'target should reduce partyConfidence by 1');
  assert.equal(targetChoice!.effects.budgetBalance, undefined, 'target should not have a dead budgetBalance: 0 key');
  assert.equal(targetChoice!.effects.mediaAttention, undefined, 'target should not have an inert mediaAttention key');

  const afterTarget = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-mental-health-waits',
    choiceId: 'mh-targets',
  });

  // Verify live state changes
  assert.equal(
    afterTarget.metrics.publicServices,
    base.metrics.publicServices - 2,
    'target must reduce publicServices by 2',
  );
  assert.equal(
    afterTarget.metrics.partyConfidence,
    base.metrics.partyConfidence - 1,
    'target must reduce partyConfidence by 1',
  );
  assert.equal(
    afterTarget.metrics.approval,
    base.metrics.approval - 2,
    'target must reduce approval by 2',
  );
  assert.equal(
    afterTarget.stats.budgetBalance,
    base.stats.budgetBalance,
    'target must not change budgetBalance',
  );
  assert.equal(
    afterTarget.stats.nhsWaitingList,
    base.stats.nhsWaitingList,
    'target does not claim or model direct waiting-list changes',
  );
  assert.ok(
    !afterTarget.redBox.some((d) => d.id === 'dos-mental-health-waits'),
    'dossier must be cleared from redBox',
  );

  // Choice 1 (mh-schools): preserves existing outcomes (+3 approval, +4 services, -3 budget, polling boost).
  const schoolsChoice = dossier!.choices.find((c) => c.id === 'mh-schools');
  assert.ok(!!schoolsChoice, 'mh-schools choice not found');
  assert.equal(schoolsChoice!.effects.approval, 3);
  assert.equal(schoolsChoice!.effects.publicServices, 4);
  assert.equal(schoolsChoice!.effects.budgetBalance, -3);
  assert.equal(schoolsChoice!.effects.supportDelta?.progressive, 2);
  assert.equal(schoolsChoice!.effects.supportDelta?.liberty, 1);

  const afterSchools = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-mental-health-waits',
    choiceId: 'mh-schools',
  });

  assert.equal(
    afterSchools.stats.budgetBalance,
    Math.round((base.stats.budgetBalance - 3) * 10) / 10,
    'schools choice must reduce budgetBalance by 3',
  );
  assert.equal(
    afterSchools.metrics.publicServices,
    base.metrics.publicServices + 4,
    'schools choice must increase publicServices by 4',
  );
  assert.ok(
    afterSchools.metrics.approval > base.metrics.approval,
    'schools choice must increase approval',
  );
});

check('nato spending commitment choice applies live approval, unity and polling effects and preserves aspirational option', () => {
  const dossier = DOSSIER_POOL.find((d) => d.id === 'dos-nato-spending');
  assert.ok(!!dossier, 'dos-nato-spending not found');
  assert.equal(dossier!.choices.length, 2);

  const base: GameState = {
    ...newGame('reform', 'inherited-mess'),
    redBox: [{ ...dossier! }],
  };

  const immediateChoice = dossier!.choices.find((c) => c.id === 'pledge-immediate');
  assert.ok(!!immediateChoice, 'pledge-immediate choice not found');
  assert.equal(immediateChoice!.effects.approval, 2);
  assert.equal(immediateChoice!.effects.partyConfidence, -1);
  assert.equal(immediateChoice!.effects.security, 8);
  assert.equal(immediateChoice!.effects.supportDelta?.progressive, -2);
  assert.equal(immediateChoice!.effects.supportDelta?.conservative, 1);

  const afterImmediate = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-nato-spending',
    choiceId: 'pledge-immediate',
  });

  // Verify live effects applied
  assert.ok(afterImmediate.metrics.approval > base.metrics.approval, 'immediate commitment must raise approval');
  assert.equal(afterImmediate.metrics.partyConfidence, base.metrics.partyConfidence - 1, 'immediate commitment must reduce partyConfidence by 1');
  const progBefore = base.parties.find((p) => p.id === 'progressive')?.currentSupport ?? 0;
  const progAfter = afterImmediate.parties.find((p) => p.id === 'progressive')?.currentSupport ?? 0;
  assert.equal(progAfter, progBefore - 2, 'progressive support must drop by 2');
  const conBefore = base.parties.find((p) => p.id === 'conservative')?.currentSupport ?? 0;
  const conAfter = afterImmediate.parties.find((p) => p.id === 'conservative')?.currentSupport ?? 0;
  assert.equal(conAfter, conBefore + 1, 'conservative support must rise by 1');
  assert.equal(afterImmediate.metrics.security, base.metrics.security + 8, 'security metric updated for display');
  assert.equal(afterImmediate.stats.budgetBalance, base.stats.budgetBalance, 'reallocated aid is fiscally neutral on budget balance');
  assert.ok(!afterImmediate.redBox.some((d) => d.id === 'dos-nato-spending'), 'dossier cleared from redBox');

  // Verify aspirational option is preserved
  const aspirationalChoice = dossier!.choices.find((c) => c.id === 'aspirational-target');
  assert.ok(!!aspirationalChoice, 'aspirational-target choice not found');
  assert.equal(aspirationalChoice!.effects.approval, -1);
  assert.equal(aspirationalChoice!.effects.security, -3);
  assert.equal(aspirationalChoice!.effects.economy, 2);

  const afterAspirational = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-nato-spending',
    choiceId: 'aspirational-target',
  });
  assert.equal(afterAspirational.metrics.approval, base.metrics.approval - 1);
  assert.equal(afterAspirational.metrics.security, base.metrics.security - 3);
  assert.equal(afterAspirational.metrics.economy, base.metrics.economy + 2);
});

check('nato burden sharing demand choice applies live budget, debt, economy, approval and polling effects and preserves European pillar option', () => {
  const dossier = DOSSIER_POOL_3.find((d) => d.id === 'dos-nato-burden');
  assert.ok(!!dossier, 'dos-nato-burden not found');
  assert.equal(dossier!.choices.length, 2);

  const base: GameState = {
    ...newGame('reform', 'inherited-mess'),
    redBox: [{ ...dossier! }],
  };

  const pledgeChoice = dossier!.choices.find((c) => c.id === 'nato-pledge');
  assert.ok(!!pledgeChoice, 'nato-pledge choice not found');
  assert.equal(pledgeChoice!.effects.budgetBalance, -14);
  assert.equal(pledgeChoice!.effects.debtToGdp, 0.8);
  assert.equal(pledgeChoice!.effects.economy, 1);
  assert.equal(pledgeChoice!.effects.approval, 1);
  assert.equal(pledgeChoice!.effects.security, 6);
  assert.equal(pledgeChoice!.effects.supportDelta?.conservative, 3);
  assert.equal(pledgeChoice!.effects.supportDelta?.progressive, -3);

  const afterPledge = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-nato-burden',
    choiceId: 'nato-pledge',
  });

  // Verify live effects applied
  assert.equal(
    afterPledge.stats.budgetBalance,
    Math.round((base.stats.budgetBalance - 14) * 10) / 10,
    '3% commitment must reduce budgetBalance by 14',
  );
  assert.equal(
    afterPledge.stats.debtToGdp,
    Math.round((base.stats.debtToGdp + 0.8) * 10) / 10,
    '3% commitment must increase debtToGdp by 0.8',
  );
  assert.equal(
    afterPledge.metrics.economy,
    base.metrics.economy + 1,
    '3% commitment must increase economy by 1',
  );
  assert.ok(
    afterPledge.metrics.approval > base.metrics.approval,
    '3% commitment must increase approval',
  );
  const conBefore = base.parties.find((p) => p.id === 'conservative')?.currentSupport ?? 0;
  const conAfter = afterPledge.parties.find((p) => p.id === 'conservative')?.currentSupport ?? 0;
  assert.equal(conAfter, conBefore + 3, 'conservative support must rise by 3');
  const progBefore = base.parties.find((p) => p.id === 'progressive')?.currentSupport ?? 0;
  const progAfter = afterPledge.parties.find((p) => p.id === 'progressive')?.currentSupport ?? 0;
  assert.equal(progAfter, progBefore - 3, 'progressive support must drop by 3');
  assert.equal(
    afterPledge.metrics.security,
    base.metrics.security + 6,
    'security metric updated for display',
  );
  assert.ok(!afterPledge.redBox.some((d) => d.id === 'dos-nato-burden'), 'dossier cleared from redBox');

  // Verify European pillar option is preserved
  const aspiChoice = dossier!.choices.find((c) => c.id === 'nato-aspi');
  assert.ok(!!aspiChoice, 'nato-aspi choice not found');
  assert.equal(aspiChoice!.effects.security, -2);
  assert.equal(aspiChoice!.effects.publicServices, 2);
  assert.equal(aspiChoice!.effects.budgetBalance, 4);
  assert.equal(aspiChoice!.effects.supportDelta?.progressive, 2);
  assert.equal(aspiChoice!.effects.supportDelta?.conservative, -2);

  const afterAspi = reducer(base, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-nato-burden',
    choiceId: 'nato-aspi',
  });
  assert.equal(afterAspi.stats.budgetBalance, Math.round((base.stats.budgetBalance + 4) * 10) / 10);
  assert.equal(afterAspi.metrics.publicServices, base.metrics.publicServices + 2);
  assert.equal(afterAspi.metrics.security, base.metrics.security - 2);
});

function supplyAtRiskGame(): GameState {
  let s = newGame('reform', 'hung-parliament');
  const partner = [...s.parties].filter((p) => p.id !== 'reform').sort((a, b) => b.seats - a.seats)[0];
  s = reducer(s, { type: 'NEGOTIATE_SUPPLY', partyId: partner.id });
  for (let i = 0; i < 20; i++) {
    if ((s.redBox ?? []).some((d) => d.id === SUPPLY_ULTIMATUM_ID)) break;
    while (s.redBox.length > 0) {
      const d = s.redBox[0];
      const idx = (i + 0) % d.choices.length;
      s = reducer(s, { type: 'RESOLVE_DOSSIER', dossierId: d.id, choiceId: d.choices[idx].id });
    }
    if (s.pmq) s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
    if (s.budgetDue) s = reducer(s, { type: 'DELIVER_BUDGET', packageId: 'budget-middle' });
    s = reducer(s, { type: 'START_TURN' });
    if (s.gameOver) break;
  }
  return s;
}

check('confidence and supply partner at risk issues Red Box ultimatum instead of immediate silent withdrawal', () => {
  const s = supplyAtRiskGame();
  const ultimatum = (s.redBox ?? []).find((d) => d.id === SUPPLY_ULTIMATUM_ID);
  assert.ok(!!ultimatum, 'expected supply ultimatum in redBox');
  assert.equal(ultimatum!.urgent, true, 'ultimatum should be marked urgent');
  assert.equal(ultimatum!.weeksRemaining, 2, 'ultimatum should give 2 weeks to respond');
  assert.ok(s.supplyPartnerId !== undefined, 'partner should still be active when ultimatum is issued');
  assert.equal(ultimatum!.choices.length, 2, 'expected two choices: concede or reject');
});

check('player can concede to supply ultimatum to preserve the agreement at a fiscal and unity cost', () => {
  const s = supplyAtRiskGame();
  const ultimatum = (s.redBox ?? []).find((d) => d.id === SUPPLY_ULTIMATUM_ID);
  assert.ok(!!ultimatum);

  const initialBalance = s.stats.budgetBalance;
  const initialUnity = s.metrics.partyConfidence;
  const partnerId = s.supplyPartnerId;

  const resolved = reducer(s, {
    type: 'RESOLVE_DOSSIER',
    dossierId: ultimatum!.id,
    choiceId: 'supply-concede',
  });

  assert.equal(resolved.supplyPartnerId, partnerId, 'supply partner should remain active');
  assert.equal(
    resolved.stats.budgetBalance,
    Math.round((initialBalance - 2) * 10) / 10,
    'concession should cost £2bn on budget balance',
  );
  assert.equal(
    resolved.metrics.partyConfidence,
    initialUnity - 1,
    'concession should cost 1 point of party unity',
  );
  assert.ok(
    (resolved.supplyConcessions ?? []).some((c) => c.includes('£2bn')),
    'concession should be recorded in supplyConcessions',
  );
  assert.ok(
    !resolved.redBox.some((d) => d.id === SUPPLY_ULTIMATUM_ID),
    'ultimatum should be cleared from redBox',
  );
});

check('player rejecting supply ultimatum causes immediate partner withdrawal', () => {
  const s = supplyAtRiskGame();
  const ultimatum = (s.redBox ?? []).find((d) => d.id === SUPPLY_ULTIMATUM_ID);
  assert.ok(!!ultimatum);

  const rejected = reducer(s, {
    type: 'RESOLVE_DOSSIER',
    dossierId: ultimatum!.id,
    choiceId: 'supply-reject',
  });

  assert.equal(rejected.supplyPartnerId, undefined, 'partner must be withdrawn upon rejection');
  assert.equal(rejected.supplyCostPerWeek, 0, 'weekly cost must be reset');
  assert.equal((rejected.supplyConcessions ?? []).length, 0, 'concessions must be cleared');
  assert.ok(
    !rejected.redBox.some((d) => d.id === SUPPLY_ULTIMATUM_ID),
    'ultimatum should be cleared from redBox',
  );
});

check('ignoring supply ultimatum causes partner withdrawal when it expires', () => {
  let s = supplyAtRiskGame();
  const ultimatum = (s.redBox ?? []).find((d) => d.id === SUPPLY_ULTIMATUM_ID);
  assert.ok(!!ultimatum);

  // Age the ultimatum by advancing weeks without resolving it
  s = advanceWeek({
    ...s,
    redBox: (s.redBox ?? []).map((d) => (d.id === SUPPLY_ULTIMATUM_ID ? { ...d, weeksRemaining: 1 } : d)),
  });

  // Now weeksRemaining <= 1; advancing again triggers expiration and withdrawal
  s = advanceWeek(s);

  assert.equal(s.supplyPartnerId, undefined, 'partner must withdraw when ultimatum expires');
  assert.equal(s.supplyCostPerWeek, 0, 'weekly cost must be reset');
  assert.ok(
    !s.redBox.some((d) => d.id === SUPPLY_ULTIMATUM_ID),
    'expired ultimatum should be removed from redBox',
  );
});

check('supported term options trigger election at selected month boundary', () => {
  for (const term of [36, 48, 60, 72]) {
    let s = newGame('reform', 'morning-in-britain');
    s = reducer(s, { type: 'SET_TERM_LENGTH', months: term });
    assert.equal(s.termLength, term);
    assert.equal(s.turnsUntilElection, term);

    // Fast-forward to the month right before the election
    s = { ...s, turnsUntilElection: 1, week: term };
    assert.equal(s.isElection, false);

    // Advancing one month triggers the election at exactly the chosen term length
    s = advanceWeek(s);
    assert.equal(s.isElection, true, `election failed to trigger at term length ${term}`);
    assert.equal(s.turnsUntilElection, term, `election countdown failed to reset to ${term}`);
  }
});

check('the 12-month annual cycle governs fiscal events and annual review', () => {
  let s = newGame('reform', 'morning-in-britain');
  // Month 6: Autumn statement
  s = { ...s, week: 5 };
  s = advanceWeek(s);
  assert.equal(s.week, 6);
  assert.equal(s.budgetDue, true);
  assert.equal(s.fiscalEventKind, 'autumn');

  // Month 12: Annual budget
  s = { ...s, week: 11, budgetDue: false, fiscalEventKind: null };
  s = advanceWeek(s);
  assert.equal(s.week, 12);
  assert.equal(s.budgetDue, true);
  assert.equal(s.fiscalEventKind, 'budget');
});

check('a Parliament may end early and does not guarantee five years tenure', () => {
  // In hung parliament without supply, government loses confidence motion early
  let s = newGame('reform', 'hung-parliament');
  // Fast forward to month 6 when opposition tables motion (approval < 30)
  s = { ...s, week: 5, metrics: { ...s.metrics, approval: 25 }, turnsUntilElection: 55 };
  s = advanceWeek(s); // Month 6 tables motion
  assert.ok(!!s.oppositionMotion);
  const due = s.oppositionMotion!.scheduledWeek;
  s = advanceWeek({ ...s, week: due }); // Division month
  assert.ok(!!s.gameOver, 'early confidence defeat should terminate the premiership before 60 months');
  assert.ok(s.week < 60, 'parliament should have ended before 60 months');
});

check('security metric influences red wall and retired voter blocs', () => {
  const base = newGame('reform', 'morning-in-britain');
  const neutralSec = { ...base, metrics: { ...base.metrics, security: 50 } };
  const highSec = { ...base, metrics: { ...base.metrics, security: 70 } };
  const lowSec = { ...base, metrics: { ...base.metrics, security: 30 } };

  const neutralBlocs = computeBlocs(neutralSec);
  const highBlocs = computeBlocs(highSec);
  const lowBlocs = computeBlocs(lowSec);

  const getBloc = (blocs: typeof neutralBlocs, id: string) => blocs.find((b) => b.id === id)?.support ?? 0;

  // Red wall & Retired respond positively to higher security
  assert.equal(getBloc(highBlocs, 'red-wall'), getBloc(neutralBlocs, 'red-wall') + 5, 'high security should boost red wall');
  assert.equal(getBloc(lowBlocs, 'red-wall'), getBloc(neutralBlocs, 'red-wall') - 5, 'low security should penalize red wall');

  assert.equal(getBloc(highBlocs, 'retired'), getBloc(neutralBlocs, 'retired') + 5, 'high security should boost retired');
  assert.equal(getBloc(lowBlocs, 'retired'), getBloc(neutralBlocs, 'retired') - 5, 'low security should penalize retired');

  // Other blocs are not directly tied to security
  assert.equal(getBloc(highBlocs, 'blue-wall'), getBloc(neutralBlocs, 'blue-wall'));
  assert.equal(getBloc(highBlocs, 'young-renters'), getBloc(neutralBlocs, 'young-renters'));
  assert.equal(getBloc(highBlocs, 'public-sector'), getBloc(neutralBlocs, 'public-sector'));
});

check('pmq housing attack choice applies live trade-off and dos-china-taiwan applies reliable gilt yield', () => {
  // 1. PMQ housing option "attack"
  const housingPmq = PMQ_POOL.find((q) => q.id === 'pmq-housing');
  assert.ok(!!housingPmq, 'pmq-housing not found');
  const attackOption = housingPmq!.options.find((o) => o.id === 'attack');
  assert.ok(!!attackOption, 'attack option not found');
  assert.equal(attackOption!.effects.approval, 1);
  assert.equal(attackOption!.effects.partyConfidence, -1);

  const base = newGame('reform', 'morning-in-britain');
  const pmqState: GameState = { ...base, pmq: { ...housingPmq! } };
  const afterPmq = reducer(pmqState, { type: 'ANSWER_PMQ', optionId: 'attack' });
  assert.ok(afterPmq.metrics.approval > base.metrics.approval, 'attack should raise approval');
  assert.equal(afterPmq.metrics.partyConfidence, base.metrics.partyConfidence - 1, 'attack should reduce partyConfidence by 1');

  // 2. dos-china-taiwan option "taiwan-firm" applies giltYield: 0.1 reliably
  const taiwanDossier = DOSSIER_POOL_3.find((d) => d.id === 'dos-china-taiwan');
  assert.ok(!!taiwanDossier, 'dos-china-taiwan not found');
  const firmChoice = taiwanDossier!.choices.find((c) => c.id === 'taiwan-firm');
  assert.ok(!!firmChoice, 'taiwan-firm choice not found');
  assert.equal(firmChoice!.effects.giltYield, 0.1, 'giltYield should be 0.1 to avoid rounding ambiguity');

  const dossierState: GameState = { ...base, redBox: [{ ...taiwanDossier! }] };
  const afterTaiwan = reducer(dossierState, {
    type: 'RESOLVE_DOSSIER',
    dossierId: 'dos-china-taiwan',
    choiceId: 'taiwan-firm',
  });
  assert.equal(
    afterTaiwan.stats.giltYield,
    Math.round((base.stats.giltYield + 0.1) * 10) / 10,
    'giltYield should increase by exactly 0.1 percentage points',
  );
  assert.equal(afterTaiwan.metrics.economy, base.metrics.economy - 2);
  assert.ok(afterTaiwan.metrics.approval > base.metrics.approval);
});

check('early snap election prerogative respects parliamentary timing and dissolves for election', () => {
  const base = newGame('reform', 'morning-in-britain');
  // 1. Cannot call election in the first 5 months (in office under 6 months)
  const tooEarly = { ...base, week: 4, turnsUntilElection: 56 };
  const rejectedEarly = reducer(tooEarly, { type: 'CALL_EARLY_ELECTION' });
  assert.equal(rejectedEarly.isElection, false, 'cannot dissolve within first 6 months');
  assert.equal(rejectedEarly.week, 4);

  // 2. Cannot call election during purdah (turnsUntilElection <= 6)
  const purdahState = { ...base, week: 50, turnsUntilElection: 4 };
  const rejectedPurdah = reducer(purdahState, { type: 'CALL_EARLY_ELECTION' });
  assert.equal(rejectedPurdah.isElection, false, 'cannot dissolve during purdah');

  // 3. Valid snap election call at Month 18
  const validState = { ...base, week: 18, turnsUntilElection: 42 };
  const afterSnap = reducer(validState, { type: 'CALL_EARLY_ELECTION' });
  assert.equal(afterSnap.isElection, true, 'snap election should trigger election modal');
  assert.equal(afterSnap.turnsUntilElection, 60, 'term countdown must reset for the new mandate');
  assert.ok((afterSnap.log ?? []).some((l) => l.includes('SNAP ELECTION')), 'snap election must be logged');
  assert.ok((afterSnap.headlines ?? []).some((h) => h.title.includes('SNAP GENERAL ELECTION')), 'headline must be published');
});

check('trait details provide badge and description for all PM backgrounds', () => {
  const backgrounds = [
    'Seasoned cabinet minister',
    'Trade union organiser',
    'City financier',
    'Academic economist',
  ];
  for (const bg of backgrounds) {
    const details = getTraitDetails(bg);
    assert.ok(!!details, `trait details missing for ${bg}`);
    assert.ok(details!.badge.length > 0, `badge missing for ${bg}`);
    assert.ok(details!.description.length > 0, `description missing for ${bg}`);
  }
});

check('PMQ questions do not repeat within an 8-question exchange', () => {
  let s = newGame('reform', 'inherited-mess');
  // Fast forward to month 4 when PMQ triggers
  s = { ...s, week: 3 };
  s = advanceWeek(s);
  assert.ok(!!s.pmq, 'PMQ should trigger on month 4');

  const sessionIds: string[] = [];
  while (s.pmq) {
    sessionIds.push(s.pmq.id);
    s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
  }

  assert.equal(sessionIds.length, 8, 'exchange should be 8 questions');
  assert.equal(new Set(sessionIds).size, 8, 'questions must not repeat within the same exchange');
  assert.ok(!s.pmq, 'PMQ session should be cleared after 8 rounds');
});

check('PMQ pool contains at least 50 diverse departmental questions with live dynamic stats', () => {
  assert.ok(PMQ_POOL.length >= 50, 'expected at least 50 questions in PMQ_POOL, got ' + PMQ_POOL.length);
  assert.ok(PMQ_TEMPLATES.length >= 50, 'expected at least 50 questions in PMQ_TEMPLATES, got ' + PMQ_TEMPLATES.length);

  // Dynamic interpolation check
  let highInflationState = newGame('reform', 'inherited-mess');
  highInflationState = {
    ...highInflationState,
    stats: { ...highInflationState.stats, cpiInflation: 9.8, nhsWaitingList: 8.7 },
  };

  const costOfLivingTemplate = PMQ_TEMPLATES.find((t) => t.id === 'pmq-cost-of-living');
  assert.ok(!!costOfLivingTemplate);
  const qText = costOfLivingTemplate!.question(highInflationState, 'Opposition Leader');
  assert.ok(qText.includes('9.8%'), 'question should dynamically interpolate live inflation rate');

  const nhsTemplate = PMQ_TEMPLATES.find((t) => t.id === 'pmq-nhs');
  assert.ok(!!nhsTemplate);
  const nhsText = nhsTemplate!.question(highInflationState, 'Opposition Leader');
  assert.ok(nhsText.includes('8.7 million'), 'question should dynamically interpolate live NHS waiting list');
});

check('cross-session recency memory prevents question repetition across consecutive PMQ sessions', () => {
  let s = newGame('reform', 'inherited-mess');

  // Month 4: Session 1
  s = { ...s, week: 3 };
  s = advanceWeek(s);
  assert.ok(!!s.pmq);
  const session1Ids: string[] = [];
  while (s.pmq) {
    session1Ids.push(s.pmq.id);
    s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
  }
  assert.equal(session1Ids.length, 8);
  assert.equal(new Set(session1Ids).size, 8);
  assert.ok((s.pmqRecentIds ?? []).length >= 8, 'recent question history must be stored');

  // Month 8: Session 2
  s = { ...s, week: 7 };
  s = advanceWeek(s);
  assert.ok(!!s.pmq);
  const session2Ids: string[] = [];
  while (s.pmq) {
    session2Ids.push(s.pmq.id);
    s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
  }
  assert.equal(session2Ids.length, 8);
  assert.equal(new Set(session2Ids).size, 8);

  // Assert ZERO questions from session 1 were repeated in session 2!
  const overlap = session1Ids.filter((id) => session2Ids.includes(id));
  assert.equal(
    overlap.length,
    0,
    'questions from previous session should be on cooldown and not repeat in next session; overlap was: ' + overlap.join(', '),
  );
});

check('whip levels alter division passage chances and backbench rebellion consequences', () => {
  const billId = 'bill-assisted-dying';
  const base = newGame('reform', 'hung-parliament');

  // 1. Three-line whip: enforces attendance and logs whip
  const threeLine = reducer(base, { type: 'PROPOSE_BILL', billId, whipLevel: 'three-line' });
  const b3 = threeLine.bills.find((b) => b.id === billId);
  assert.ok(!!b3, 'bill should be introduced');
  assert.equal(b3!.whipLevel, 'three-line');
  assert.ok((threeLine.log ?? [])[0].includes('three-line whip'), 'log should note three-line whip');

  // 2. Free vote: conscience vote adds 0 mutiny letters
  const freeVote = reducer(base, { type: 'PROPOSE_BILL', billId, whipLevel: 'free-vote' });
  const bFree = freeVote.bills.find((b) => b.id === billId);
  assert.ok(!!bFree);
  assert.equal(bFree!.whipLevel, 'free-vote');
  assert.ok((freeVote.log ?? [])[0].includes('free vote'), 'log should note free vote');

  // Division on a free vote vs three-line whip
  const resolvedFree = advanceWeek({ ...freeVote, week: 10, bills: [{ ...bFree!, weeksToPass: 1 }] });
  const resolved3 = advanceWeek({ ...threeLine, week: 10, bills: [{ ...b3!, weeksToPass: 1 }] });
  assert.ok(resolvedFree.stats.lettersOfNoConfidence < resolved3.stats.lettersOfNoConfidence, 'free vote must incur fewer rebellion letters than three-line whip');
  assert.equal(resolvedFree.stats.lettersOfNoConfidence, 7, 'free vote avoids rebellion surge and earns pass letter relief');
  assert.equal(resolved3.stats.lettersOfNoConfidence, 13, 'three-line whip on contentious bill provokes backbench letters');
});

check('trade deal negotiating progress advances over time and accelerates with Foreign Secretary', () => {
  let s = newGame('reform', 'morning-in-britain');
  // chinaTradeDeal starts in 'negotiating' status
  assert.equal(s.tradeDealStatus?.chinaTradeDeal?.status, 'negotiating');

  // Fast forward to month 3 right before quarterly check (week 4)
  s = { ...s, week: 3 };
  s = advanceWeek(s); // Month 4 triggers periodicExternal
  const progress1 = s.tradeDealStatus?.chinaTradeDeal?.progress ?? 0;
  assert.ok(progress1 > 0, 'negotiating deal should advance progress at month 4');

  // Appointing an experienced Foreign Secretary accelerates progress
  s = {
    ...s,
    cabinet: [
      ...s.cabinet.filter((m) => m.post !== 'Foreign Secretary'),
      { name: 'Sir Humphrey', post: 'Foreign Secretary', partyId: 'reform', loyalty: 80, competence: 95, faction: 'Centrist' },
    ],
    week: 7,
  };
  s = advanceWeek(s); // Month 8 triggers periodicExternal
  const progress2 = s.tradeDealStatus?.chinaTradeDeal?.progress ?? 0;
  assert.ok(progress2 - progress1 >= 25, 'experienced Foreign Secretary should provide strong progress gain');
});

check('Bank of England MPC responds to high inflation or stagnation quarterly', () => {
  // High inflation trigger
  let highInf = newGame('reform', 'inherited-mess');
  highInf = { ...highInf, week: 2, stats: { ...highInf.stats, cpiInflation: 6.5 } };
  const afterHike = advanceWeek(highInf); // Month 3 triggers MPC
  assert.equal(afterHike.week, 3);
  assert.ok((afterHike.log ?? []).some((l) => l.includes('BANK OF ENGLAND')), 'rate hike should be logged');
  assert.ok((afterHike.headlines ?? []).some((h) => h.title.includes('INTEREST RATES')), 'headline should be published');

  // Low inflation & low growth trigger
  let lowInf = newGame('reform', 'morning-in-britain');
  lowInf = { ...lowInf, week: 2, stats: { ...lowInf.stats, cpiInflation: 1.5, gdpGrowth: 0.4 } };
  const afterCut = advanceWeek(lowInf); // Month 3 triggers MPC
  assert.equal(afterCut.week, 3);
  assert.ok((afterCut.log ?? []).some((l) => l.includes('cuts Bank Rate')), 'rate cut should be logged');
});

check('party leader personas and parliamentary seat layout are populated', () => {
  const s = newGame('reform', 'morning-in-britain');
  for (const p of s.parties) {
    assert.ok(!!p.leaderPersona, `leaderPersona missing for party ${p.id}`);
    assert.ok(p.leaderPersona!.length > 5);
  }
});

check('electoral map metadata accurately defines England council regions and seat totals', () => {
  const englishRegions = REGIONS.filter((r) => REGION_COUNCIL_META[r.id]?.isEngland);
  assert.equal(englishRegions.length, 6, 'expected 6 English regions');

  const englishSeats = englishRegions.reduce((sum, r) => sum + r.seats, 0);
  assert.equal(englishSeats, 543, 'expected 543 English Commons seats');

  const allSeats = REGIONS.reduce((sum, r) => sum + r.seats, 0);
  assert.equal(allSeats, 650, 'expected 650 total UK Commons seats');

  for (const r of REGIONS) {
    const meta = REGION_COUNCIL_META[r.id];
    assert.ok(!!meta, `metadata missing for region ${r.id}`);
    assert.ok(meta.councils.length >= 5, `expected at least 5 council areas for ${r.id}`);
    assert.ok(meta.keyCities.length >= 3, `expected key urban centers for ${r.id}`);
    assert.ok(meta.bloc.length > 5, `expected dominant bloc description for ${r.id}`);
  }
});

// ===== Personal Allowance freeze / annual uprating =====

function allowancePlan(s: GameState, freezeYears: number): CustomBudgetPlan {
  return {
    title: 'Test Budget',
    departmentBudgets: {},
    taxRates: {},
    personalAllowance: s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: freezeYears,
    fuelDutyFrozen: s.fuelDutyFrozen ?? true,
    stampDutyRelief: s.stampDutyRelief ?? false,
    thresholdsFrozen: s.thresholdsFrozen ?? true,
    publicSectorPay: 'full',
    tripleLock: true,
  };
}

check('personal allowance: no freeze uprates at the annual Budget boundary', () => {
  let s = newGame('reform', 'morning-in-britain');
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: allowancePlan(s, 0) });
  const before = s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  assert.equal(s.personalAllowanceFreezeYears, 0);
  s = { ...s, week: 11, budgetDue: false, fiscalEventKind: null };
  s = advanceWeek(s); // crosses the annual boundary at week 12
  assert.ok((s.personalAllowance ?? 0) > before, 'allowance must be uprated when not frozen');
});

check('personal allowance: active freeze holds the nominal allowance for the chosen years', () => {
  let s = newGame('reform', 'morning-in-britain');
  const base = s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: allowancePlan(s, 2) });
  assert.equal(s.personalAllowanceFreezeYears, 2);

  s = { ...s, week: 11, budgetDue: false, fiscalEventKind: null };
  s = advanceWeek(s);
  assert.equal(s.personalAllowance, base, 'frozen year 1 must hold the allowance');
  assert.equal(s.personalAllowanceFreezeYears, 1);

  s = { ...s, week: 23, budgetDue: false, fiscalEventKind: null };
  s = advanceWeek(s);
  assert.equal(s.personalAllowance, base, 'frozen year 2 must hold the allowance');
  assert.equal(s.personalAllowanceFreezeYears, 0);
});

check('personal allowance: freeze expires and uprating resumes', () => {
  let s = newGame('reform', 'morning-in-britain');
  const base = s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: allowancePlan(s, 1) });
  s = { ...s, week: 11, budgetDue: false, fiscalEventKind: null };
  s = advanceWeek(s);
  assert.equal(s.personalAllowance, base, 'frozen year must hold the allowance');
  assert.equal(s.personalAllowanceFreezeYears, 0);
  s = { ...s, week: 23, budgetDue: false, fiscalEventKind: null };
  s = advanceWeek(s);
  assert.ok((s.personalAllowance ?? 0) > base, 'uprating must resume once the freeze expires');
});

check('personal allowance: annual update is pure and uses the CPI-like proxy', () => {
  const s = newGame('reform', 'morning-in-britain');
  const frozen = annualPersonalAllowanceUpdate({
    ...s,
    personalAllowance: 12570,
    personalAllowanceFreezeYears: 2,
    stats: { ...s.stats, cpiInflation: 3 },
  });
  assert.equal(frozen.personalAllowance, 12570);
  assert.equal(frozen.personalAllowanceFreezeYears, 1);

  const input = {
    ...s,
    personalAllowance: 12570,
    personalAllowanceFreezeYears: 0,
    stats: { ...s.stats, cpiInflation: 3 },
  };
  const open = annualPersonalAllowanceUpdate(input);
  assert.equal(open.personalAllowance, Math.round(12570 * 1.03), 'uprating uses the CPI-like proxy');
  assert.equal(input.personalAllowance, 12570, 'the annual update must not mutate its input');
});

check('personal allowance: repeated, previewed or deferred delivery cannot double-apply', () => {
  const s = newGame('reform', 'morning-in-britain');
  const base = s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  const plan = allowancePlan(s, 3);
  const once = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const twice = reducer(once, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const thrice = reducer(twice, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  assert.equal(once.personalAllowanceFreezeYears, 3);
  assert.equal(thrice.personalAllowanceFreezeYears, 3, 'freeze years are set, never accumulated');
  assert.equal(thrice.personalAllowance, base, 'repeated delivery must not move the allowance level');

  // Previewing a plan must not touch the saved state.
  const previewState = newGame('reform', 'morning-in-britain');
  calculateCustomBudget(getDefaultCustomPlan(previewState), previewState);
  assert.equal(previewState.personalAllowanceFreezeYears ?? 0, 0, 'preview must not set freeze years');

  // Deferring/cancelling a budget must leave the freeze untouched.
  const deferred = reducer({ ...s, budgetDue: true }, { type: 'SKIP_BUDGET' });
  assert.equal(deferred.personalAllowanceFreezeYears ?? 0, 0);
});

check('personal allowance: older saves default to no freeze and stay safe', () => {
  const s = newGame('reform', 'morning-in-britain');
  const legacy: Partial<GameState> = { ...s };
  delete legacy.personalAllowanceFreezeYears;
  const migrated = migrateState(legacy);
  assert.equal(migrated.personalAllowanceFreezeYears, 0, 'legacy save must default to no freeze');

  const before = migrated.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  const advanced = advanceWeek({ ...migrated, week: 11 });
  assert.ok((advanced.personalAllowance ?? 0) >= before, 'legacy save must not retro-freeze the allowance');
});

check('personal allowance: freeze is capped by term length and sanitised on load', () => {
  const s = newGame('reform', 'morning-in-britain'); // 60-month term => 5 annual Budgets
  const capped = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: allowancePlan(s, 99) });
  assert.equal(capped.personalAllowanceFreezeYears, 5, 'freeze must be capped at floor(term/12)');
  assert.equal(
    migrateState({ ...s, personalAllowanceFreezeYears: -4 }).personalAllowanceFreezeYears,
    0,
    'a negative freeze must clamp to no-freeze',
  );
});

// ===== Personal Allowance level -> recurring fiscal estimate =====

check('personal allowance: level changes the recurring structural estimate vs the frozen baseline', () => {
  const base = newGame('reform', 'morning-in-britain');
  const flat = { ...base, personalAllowance: DEFAULT_PERSONAL_ALLOWANCE };
  const raised = { ...base, personalAllowance: DEFAULT_PERSONAL_ALLOWANCE + 500 };
  const lowered = { ...base, personalAllowance: DEFAULT_PERSONAL_ALLOWANCE - 500 };

  assert.equal(personalAllowanceRevenue(flat), 0, 'the default allowance has no recurring cost');
  assert.equal(
    Math.round((structuralBalance(flat) - structuralBalance(raised)) * 10) / 10,
    PERSONAL_ALLOWANCE_COST_PER_STEP,
    'one £500 step up must forgo exactly one step of revenue',
  );
  assert.equal(
    Math.round((structuralBalance(lowered) - structuralBalance(flat)) * 10) / 10,
    PERSONAL_ALLOWANCE_COST_PER_STEP,
    'one £500 step down must raise exactly one step of revenue',
  );
  assert.equal(
    personalAllowanceRevenue(raised),
    -(500 / PERSONAL_ALLOWANCE_STEP) * PERSONAL_ALLOWANCE_COST_PER_STEP,
    'the recurring estimate uses the existing £-per-step scale',
  );
});

check('personal allowance: general threshold freeze no longer gates on the allowance level', () => {
  const params = {
    personalAllowance: FROZEN_THRESHOLDS.personalAllowance,
    basicRateCutoff: FROZEN_THRESHOLDS.basicRateCutoff,
    higherRateCutoff: FROZEN_THRESHOLDS.higherRateCutoff,
    additionalRateCutoff: FROZEN_THRESHOLDS.additionalRateCutoff,
    basicRate: 20,
    higherRate: 40,
    additionalRate: 45,
    cpiInflation: 4,
    realIncomeGrowth: 1,
    fiscalYear: 2025,
  };
  const low = calculateFiscalDrag({ ...params, personalAllowance: FROZEN_THRESHOLDS.personalAllowance });
  const high = calculateFiscalDrag({ ...params, personalAllowance: FROZEN_THRESHOLDS.personalAllowance + 2000 });
  assert.ok(low.additionalRevenue > 0, 'the general freeze still raises bracket-creep revenue');
  assert.equal(high.additionalRevenue, low.additionalRevenue, 'the allowance level must not change the general freeze');
});

check('personal allowance: allowance contribution is counted exactly once', () => {
  const s = newGame('reform', 'morning-in-britain');
  const base = { ...s, thresholdsFrozen: true, personalAllowance: DEFAULT_PERSONAL_ALLOWANCE };
  const raised = { ...s, thresholdsFrozen: true, personalAllowance: DEFAULT_PERSONAL_ALLOWANCE + 2000 };
  const diff = Math.round((structuralBalance(base) - structuralBalance(raised)) * 10) / 10;
  assert.equal(
    diff,
    (2000 / PERSONAL_ALLOWANCE_STEP) * PERSONAL_ALLOWANCE_COST_PER_STEP,
    'the allowance difference must appear once, not duplicated by the general freeze',
  );
});

check('personal allowance: freeze holds the recurring estimate until expiry, then uprating bites', () => {
  let s = newGame('reform', 'morning-in-britain');
  const base = s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE;
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: allowancePlan(s, 2) });
  const atBase = personalAllowanceRevenue(s);
  assert.equal(atBase, 0);

  s = advanceWeek({ ...s, week: 11, budgetDue: false, fiscalEventKind: null });
  assert.equal(s.personalAllowance, base, 'frozen year 1 must hold the allowance');
  assert.equal(personalAllowanceRevenue(s), atBase, 'the recurring estimate stays flat while frozen');

  s = advanceWeek({ ...s, week: 23, budgetDue: false, fiscalEventKind: null });
  assert.equal(s.personalAllowance, base, 'frozen year 2 must hold the allowance');
  assert.equal(personalAllowanceRevenue(s), atBase);

  s = advanceWeek({ ...s, week: 35, budgetDue: false, fiscalEventKind: null });
  assert.ok((s.personalAllowance ?? 0) > base, 'uprating must resume after the freeze expires');
  assert.ok(personalAllowanceRevenue(s) < 0, 'the uprated allowance forgoes recurring revenue');
});

check('personal allowance: preview, repeated delivery and restore do not double-apply', () => {
  const s = newGame('reform', 'morning-in-britain');
  const plan = allowancePlan(s, 0);
  plan.personalAllowance = DEFAULT_PERSONAL_ALLOWANCE + 1000;
  const once = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const twice = reducer(once, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const expected = -(1000 / PERSONAL_ALLOWANCE_STEP) * PERSONAL_ALLOWANCE_COST_PER_STEP;
  assert.equal(personalAllowanceRevenue(once), expected);
  assert.equal(personalAllowanceRevenue(twice), expected, 'repeated delivery must not stack');

  // Preview is side-effect free.
  const previewState = newGame('reform', 'morning-in-britain');
  calculateCustomBudget(getDefaultCustomPlan(previewState), previewState);
  assert.equal(personalAllowanceRevenue(previewState), 0, 'preview must not change the estimate');

  // Restore preserves the level without re-applying it.
  const migrated = migrateState({ ...once });
  assert.equal(migrated.personalAllowance, once.personalAllowance);
  assert.equal(personalAllowanceRevenue(migrated), personalAllowanceRevenue(once));
});

check('personal allowance: older saves default to the baseline recurring estimate', () => {
  const s = newGame('reform', 'morning-in-britain');
  const legacy: Partial<GameState> = { ...s };
  delete legacy.personalAllowance;
  const migrated = migrateState(legacy);
  assert.equal(migrated.personalAllowance, DEFAULT_PERSONAL_ALLOWANCE, 'legacy saves default to £12,570');
  assert.equal(personalAllowanceRevenue(migrated), 0, 'the default allowance adds no recurring cost');
});

// ===== Fuel Duty 5p freeze -> recurring structural cost =====

function fuelDutyPlan(s: GameState, frozen: boolean): CustomBudgetPlan {
  return {
    title: 'Fuel Duty Test Budget',
    departmentBudgets: {},
    taxRates: {},
    personalAllowance: s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: 0,
    fuelDutyFrozen: frozen,
    stampDutyRelief: s.stampDutyRelief ?? false,
    thresholdsFrozen: s.thresholdsFrozen ?? true,
    publicSectorPay: 'full',
    tripleLock: true,
  };
}

check('fuel duty: maintaining the freeze carries one annual recurring cost, restoring clears it', () => {
  const s = newGame('reform', 'morning-in-britain');
  const frozen = { ...s, fuelDutyFrozen: true };
  const restored = { ...s, fuelDutyFrozen: false };
  assert.equal(fuelDutyRecurringRevenue(true), -FUEL_DUTY_FREEZE_COST);
  assert.equal(fuelDutyRecurringRevenue(false), 0);
  assert.equal(
    Math.round((structuralBalance(frozen) - structuralBalance(restored)) * 10) / 10,
    -FUEL_DUTY_FREEZE_COST,
    'the freeze lowers the structural position by exactly the annual cost',
  );
});

check('fuel duty: delivering a budget persists the choice into the recurring model', () => {
  let s = newGame('reform', 'morning-in-britain');
  const restoredBaseline = structuralBalance({ ...s, fuelDutyFrozen: false });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: fuelDutyPlan(s, true) });
  assert.equal(s.fuelDutyFrozen, true, 'delivered budget persists the freeze');
  assert.equal(
    Math.round((structuralBalance(s) - restoredBaseline) * 10) / 10,
    -FUEL_DUTY_FREEZE_COST,
    'the delivered freeze appears once in the structural model',
  );
});

check('fuel duty: a later budget can turn the freeze off and the cost disappears', () => {
  let s = newGame('reform', 'morning-in-britain');
  const restoredBaseline = structuralBalance({ ...s, fuelDutyFrozen: false });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: fuelDutyPlan(s, true) });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: fuelDutyPlan(s, false) });
  assert.equal(s.fuelDutyFrozen, false);
  assert.equal(
    Math.round(structuralBalance(s) * 10) / 10,
    Math.round(restoredBaseline * 10) / 10,
    'restoring the escalator returns the structural position to baseline',
  );
});

check('fuel duty: the cost recurs annually, not once a month', () => {
  const base = newGame('reform', 'morning-in-britain');
  // Settle the published balance onto the structural position first, so the
  // only remaining weekly movement is the policy under test, not the large
  // baseline gap towards the starting structural position.
  let s = { ...base, stats: { ...base.stats, budgetBalance: structuralBalance(base) } };
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: fuelDutyPlan(s, true) });
  const balanceAtDelivery = s.stats.budgetBalance;
  // Isolate the fuel-duty share of the structural position: the general
  // threshold-freeze drag also changes once weeks start advancing.
  const fuelShare = (g: GameState) =>
    Math.round((structuralBalance(g) - structuralBalance({ ...g, fuelDutyFrozen: false })) * 10) / 10;
  assert.equal(fuelShare(s), -FUEL_DUTY_FREEZE_COST);
  s = advanceWeek({ ...s, week: 5, budgetDue: false, fiscalEventKind: null });
  assert.equal(fuelShare(s), -FUEL_DUTY_FREEZE_COST, 'the standing term is an annual figure, applied once');
  assert.ok(
    Math.abs(s.stats.budgetBalance - balanceAtDelivery) < FUEL_DUTY_FREEZE_COST,
    'a single month must not absorb the full annual cost',
  );
});

check('fuel duty: repeated delivery does not stack the recurring cost', () => {
  const s = newGame('reform', 'morning-in-britain');
  const plan = fuelDutyPlan(s, true);
  const once = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const thrice = reducer(
    reducer(once, { type: 'DELIVER_CUSTOM_BUDGET', plan }),
    { type: 'DELIVER_CUSTOM_BUDGET', plan },
  );
  assert.equal(thrice.fuelDutyFrozen, true);
  assert.equal(
    structuralBalance(thrice),
    structuralBalance(once),
    'repeated delivery must not multiply the annual cost',
  );
});

check('fuel duty: preview scores the one-off separately from the recurring level', () => {
  const s = newGame('reform', 'morning-in-britain');
  const keeping = calculateCustomBudget(fuelDutyPlan(s, true), { ...s, fuelDutyFrozen: true });
  assert.equal(keeping.fuelDutyRevenue, 0, 'no status change means no one-off fiscal effect');
  assert.equal(keeping.fuelDutyRecurring, -FUEL_DUTY_FREEZE_COST, 'the standing cost is reported separately');

  const restoring = calculateCustomBudget(fuelDutyPlan(s, false), { ...s, fuelDutyFrozen: true });
  assert.equal(restoring.fuelDutyRevenue, FUEL_DUTY_FREEZE_COST, 'restoring is a one-off improvement of one year');
  assert.equal(restoring.fuelDutyRecurring, 0, 'restoring clears the standing cost');
});

check('fuel duty: freeze setting and cost survive save/restore', () => {
  let s = newGame('reform', 'morning-in-britain');
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: fuelDutyPlan(s, false) });
  const migrated = migrateState({ ...s });
  assert.equal(migrated.fuelDutyFrozen, false);
  assert.equal(fuelDutyRecurringRevenue(migrated.fuelDutyFrozen ?? true), 0);

  const legacy: Partial<GameState> = { ...newGame('reform', 'morning-in-britain') };
  delete legacy.fuelDutyFrozen;
  const legacyMigrated = migrateState(legacy);
  assert.equal(legacyMigrated.fuelDutyFrozen, true, 'older saves default to the freeze being on');
  assert.equal(fuelDutyRecurringRevenue(legacyMigrated.fuelDutyFrozen ?? true), -FUEL_DUTY_FREEZE_COST);
});

// ===== State Pension Triple Lock -> recurring structural cost =====

function tripleLockPlan(s: GameState, locked: boolean): CustomBudgetPlan {
  return {
    title: 'Triple Lock Test Budget',
    departmentBudgets: {},
    taxRates: {},
    personalAllowance: s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: 0,
    fuelDutyFrozen: s.fuelDutyFrozen ?? true,
    stampDutyRelief: s.stampDutyRelief ?? false,
    thresholdsFrozen: s.thresholdsFrozen ?? true,
    publicSectorPay: 'full',
    tripleLock: locked,
  };
}

check('triple lock: maintaining it carries one annual recurring cost, indexing clears it', () => {
  const s = newGame('reform', 'morning-in-britain');
  assert.equal(tripleLockRecurringRevenue(true), -TRIPLE_LOCK_COST);
  assert.equal(tripleLockRecurringRevenue(false), 0);
  assert.equal(
    Math.round((structuralBalance({ ...s, tripleLock: true }) - structuralBalance({ ...s, tripleLock: false })) * 10) / 10,
    -TRIPLE_LOCK_COST,
    'the lock lowers the structural position by exactly the annual cost',
  );
});

check('triple lock: delivering a budget persists the choice into the recurring model', () => {
  let s = newGame('reform', 'morning-in-britain');
  const indexedBaseline = structuralBalance({ ...s, tripleLock: false });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: tripleLockPlan(s, true) });
  assert.equal(s.tripleLock, true, 'delivered budget persists the lock');
  assert.equal(Math.round((structuralBalance(s) - indexedBaseline) * 10) / 10, -TRIPLE_LOCK_COST);
});

check('triple lock: a later budget can index it and the cost disappears', () => {
  let s = newGame('reform', 'morning-in-britain');
  const indexedBaseline = structuralBalance({ ...s, tripleLock: false });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: tripleLockPlan(s, true) });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: tripleLockPlan(s, false) });
  assert.equal(s.tripleLock, false);
  assert.equal(Math.round(structuralBalance(s) * 10) / 10, Math.round(indexedBaseline * 10) / 10);
});

check('triple lock: the cost recurs annually, not once a month', () => {
  const base = newGame('reform', 'morning-in-britain');
  // Settle the published balance onto the structural position first, so the
  // only remaining weekly movement is the policy under test, not the large
  // baseline gap towards the starting structural position.
  let s = { ...base, stats: { ...base.stats, budgetBalance: structuralBalance(base) } };
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: tripleLockPlan(s, true) });
  const atDelivery = s.stats.budgetBalance;
  const lockShare = (g: GameState) =>
    Math.round((structuralBalance(g) - structuralBalance({ ...g, tripleLock: false })) * 10) / 10;
  assert.equal(lockShare(s), -TRIPLE_LOCK_COST);
  s = advanceWeek({ ...s, week: 5, budgetDue: false, fiscalEventKind: null });
  assert.equal(lockShare(s), -TRIPLE_LOCK_COST, 'the standing term is an annual figure, applied once');
  assert.ok(Math.abs(s.stats.budgetBalance - atDelivery) < TRIPLE_LOCK_COST, 'a single month must not absorb the full annual cost');
});

check('triple lock: repeated delivery does not stack the recurring cost', () => {
  const s = newGame('reform', 'morning-in-britain');
  const plan = tripleLockPlan(s, true);
  const once = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const thrice = reducer(reducer(once, { type: 'DELIVER_CUSTOM_BUDGET', plan }), { type: 'DELIVER_CUSTOM_BUDGET', plan });
  assert.equal(thrice.tripleLock, true);
  assert.equal(structuralBalance(thrice), structuralBalance(once), 'repeated delivery must not multiply the annual cost');
});

check('triple lock: preview scores the one-off separately from the recurring level', () => {
  const s = newGame('reform', 'morning-in-britain');
  const keeping = calculateCustomBudget(tripleLockPlan(s, true), { ...s, tripleLock: true });
  assert.equal(keeping.tripleLockCost, 0, 'no status change means no one-off fiscal effect');
  assert.equal(keeping.tripleLockRecurring, -TRIPLE_LOCK_COST, 'the standing cost is reported separately');
  const indexing = calculateCustomBudget(tripleLockPlan(s, false), { ...s, tripleLock: true });
  assert.equal(indexing.tripleLockCost, TRIPLE_LOCK_COST, 'indexing is a one-off improvement of one year');
  assert.equal(indexing.tripleLockRecurring, 0, 'indexing clears the standing cost');
});

check('triple lock: setting and cost survive save/restore', () => {
  let s = newGame('reform', 'morning-in-britain');
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: tripleLockPlan(s, false) });
  const migrated = migrateState({ ...s });
  assert.equal(migrated.tripleLock, false);
  assert.equal(tripleLockRecurringRevenue(migrated.tripleLock ?? true), 0);
  const legacy: Partial<GameState> = { ...newGame('reform', 'morning-in-britain') };
  delete legacy.tripleLock;
  const legacyMigrated = migrateState(legacy);
  assert.equal(legacyMigrated.tripleLock, true, 'older saves default to the lock being on');
  assert.equal(tripleLockRecurringRevenue(legacyMigrated.tripleLock ?? true), -TRIPLE_LOCK_COST);
});

// ===== Public Sector Pay awards -> recurring structural cost =====

function publicSectorPayPlan(s: GameState, full: boolean): CustomBudgetPlan {
  return {
    title: 'Public Sector Pay Test Budget',
    departmentBudgets: {},
    taxRates: {},
    personalAllowance: s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: 0,
    fuelDutyFrozen: s.fuelDutyFrozen ?? true,
    stampDutyRelief: s.stampDutyRelief ?? false,
    thresholdsFrozen: s.thresholdsFrozen ?? true,
    publicSectorPay: full ? 'full' : 'capped',
    tripleLock: s.tripleLock ?? true,
  };
}

check('public sector pay: full funding carries one annual recurring cost, capping clears it', () => {
  const s = newGame('reform', 'morning-in-britain');
  assert.equal(publicSectorPayRecurringRevenue(true), -PUBLIC_SECTOR_PAY_COST);
  assert.equal(publicSectorPayRecurringRevenue(false), 0);
  assert.equal(
    Math.round(
      (structuralBalance({ ...s, publicSectorPay: 'full' }) -
        structuralBalance({ ...s, publicSectorPay: 'capped' })) *
        10,
    ) / 10,
    -PUBLIC_SECTOR_PAY_COST,
    'full funding lowers the structural position by exactly the annual cost',
  );
});

check('public sector pay: delivering a budget persists the choice into the recurring model', () => {
  let s = newGame('reform', 'morning-in-britain');
  const cappedBaseline = structuralBalance({ ...s, publicSectorPay: 'capped' });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: publicSectorPayPlan(s, true) });
  assert.equal(s.publicSectorPay, 'full', 'delivered budget persists full funding');
  assert.equal(Math.round((structuralBalance(s) - cappedBaseline) * 10) / 10, -PUBLIC_SECTOR_PAY_COST);
});

check('public sector pay: a later budget can cap it and the cost disappears', () => {
  let s = newGame('reform', 'morning-in-britain');
  const cappedBaseline = structuralBalance({ ...s, publicSectorPay: 'capped' });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: publicSectorPayPlan(s, true) });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: publicSectorPayPlan(s, false) });
  assert.equal(s.publicSectorPay, 'capped');
  assert.equal(Math.round(structuralBalance(s) * 10) / 10, Math.round(cappedBaseline * 10) / 10);
});

check('public sector pay: the cost recurs annually, not once a month', () => {
  const base = newGame('reform', 'morning-in-britain');
  let s = { ...base, stats: { ...base.stats, budgetBalance: structuralBalance(base) } };
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: publicSectorPayPlan(s, true) });
  const atDelivery = s.stats.budgetBalance;
  const payShare = (g: GameState) =>
    Math.round((structuralBalance(g) - structuralBalance({ ...g, publicSectorPay: 'capped' })) * 10) / 10;
  assert.equal(payShare(s), -PUBLIC_SECTOR_PAY_COST);
  s = advanceWeek({ ...s, week: 5, budgetDue: false, fiscalEventKind: null });
  assert.equal(payShare(s), -PUBLIC_SECTOR_PAY_COST, 'the standing term is an annual figure, applied once');
  assert.ok(Math.abs(s.stats.budgetBalance - atDelivery) < PUBLIC_SECTOR_PAY_COST, 'a single month must not absorb the full annual cost');
});

check('public sector pay: repeated delivery does not stack the recurring cost', () => {
  const s = newGame('reform', 'morning-in-britain');
  const plan = publicSectorPayPlan(s, true);
  const once = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const thrice = reducer(reducer(once, { type: 'DELIVER_CUSTOM_BUDGET', plan }), { type: 'DELIVER_CUSTOM_BUDGET', plan });
  assert.equal(thrice.publicSectorPay, 'full');
  assert.equal(structuralBalance(thrice), structuralBalance(once), 'repeated delivery must not multiply the annual cost');
});

check('public sector pay: preview scores the one-off separately from the recurring level', () => {
  const s = newGame('reform', 'morning-in-britain');
  const keeping = calculateCustomBudget(publicSectorPayPlan(s, true), { ...s, publicSectorPay: 'full' });
  assert.equal(keeping.payCost, 0, 'no status change means no one-off fiscal effect');
  assert.equal(keeping.payRecurring, -PUBLIC_SECTOR_PAY_COST, 'the standing cost is reported separately');
  const capping = calculateCustomBudget(publicSectorPayPlan(s, false), { ...s, publicSectorPay: 'full' });
  assert.equal(capping.payCost, PUBLIC_SECTOR_PAY_COST, 'capping is a one-off improvement of one year');
  assert.equal(capping.payRecurring, 0, 'capping clears the standing cost');
});

check('public sector pay: setting and cost survive save/restore', () => {
  let s = newGame('reform', 'morning-in-britain');
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: publicSectorPayPlan(s, false) });
  const migrated = migrateState({ ...s });
  assert.equal(migrated.publicSectorPay, 'capped');
  assert.equal(publicSectorPayRecurringRevenue(migrated.publicSectorPay !== 'capped'), 0);
  const legacy: Partial<GameState> = { ...newGame('reform', 'morning-in-britain') };
  delete legacy.publicSectorPay;
  const legacyMigrated = migrateState(legacy);
  assert.equal(legacyMigrated.publicSectorPay, 'full', 'older saves default to full funding');
  assert.equal(publicSectorPayRecurringRevenue(legacyMigrated.publicSectorPay !== 'capped'), -PUBLIC_SECTOR_PAY_COST);
});

// ===== Cross-cutting migration + preview consistency =====

check('migration: older saves default all four budget-policy flags at once', () => {
  const legacy: Partial<GameState> = { ...newGame('reform', 'morning-in-britain') };
  delete legacy.personalAllowance;
  delete legacy.fuelDutyFrozen;
  delete legacy.tripleLock;
  delete legacy.publicSectorPay;
  const migrated = migrateState(legacy);
  assert.equal(migrated.personalAllowance, DEFAULT_PERSONAL_ALLOWANCE, 'allowance defaults to £12,570');
  assert.equal(migrated.fuelDutyFrozen, true, 'fuel duty freeze defaults on');
  assert.equal(migrated.tripleLock, true, 'triple lock defaults on');
  assert.equal(migrated.publicSectorPay, 'full', 'public sector pay defaults to full funding');
  // The recurring model reads those defaults consistently (one annual term each).
  assert.equal(personalAllowanceRecurringRevenue(migrated.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE), 0);
  assert.equal(fuelDutyRecurringRevenue(migrated.fuelDutyFrozen ?? true), -FUEL_DUTY_FREEZE_COST);
  assert.equal(tripleLockRecurringRevenue(migrated.tripleLock ?? true), -TRIPLE_LOCK_COST);
  assert.equal(publicSectorPayRecurringRevenue((migrated.publicSectorPay ?? 'full') !== 'capped'), -PUBLIC_SECTOR_PAY_COST);
});

check('budget preview: allowance recurring level matches the engine recurring model', () => {
  const s = newGame('reform', 'morning-in-britain');
  const levels = [DEFAULT_PERSONAL_ALLOWANCE, DEFAULT_PERSONAL_ALLOWANCE + 1000, DEFAULT_PERSONAL_ALLOWANCE - 500];
  for (const allowance of levels) {
    const preview = calculateCustomBudget({ ...getDefaultCustomPlan(s), personalAllowance: allowance }, s);
    assert.equal(
      preview.allowanceRecurring,
      personalAllowanceRevenue({ ...s, personalAllowance: allowance }),
      `preview recurring must match engine recurring at £${allowance}`,
    );
  }
});

// ===== Stamp Duty Land Tax (SDLT) nil-rate bands -> recurring structural cost =====

function stampDutyPlan(s: GameState, relief: boolean): CustomBudgetPlan {
  return {
    title: 'SDLT Test Budget',
    departmentBudgets: {},
    taxRates: {},
    personalAllowance: s.personalAllowance ?? DEFAULT_PERSONAL_ALLOWANCE,
    personalAllowanceFreezeYears: 0,
    fuelDutyFrozen: s.fuelDutyFrozen ?? true,
    stampDutyRelief: relief,
    thresholdsFrozen: s.thresholdsFrozen ?? true,
    publicSectorPay: 'full',
    tripleLock: s.tripleLock ?? true,
  };
}

check('SDLT: raising nil-rate bands carries one annual recurring cost, maintaining rates clears it', () => {
  const s = newGame('reform', 'morning-in-britain');
  assert.equal(stampDutyRecurringRevenue(true), -STAMP_DUTY_RELIEF_COST);
  assert.equal(stampDutyRecurringRevenue(false), 0);
  assert.equal(
    Math.round(
      (structuralBalance({ ...s, stampDutyRelief: true }) - structuralBalance({ ...s, stampDutyRelief: false })) *
        10,
    ) / 10,
    -STAMP_DUTY_RELIEF_COST,
    'raising the bands lowers the structural position by exactly the annual cost',
  );
});

check('SDLT: delivering a budget persists the choice into the recurring model', () => {
  let s = newGame('reform', 'morning-in-britain');
  const maintainedBaseline = structuralBalance({ ...s, stampDutyRelief: false });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: stampDutyPlan(s, true) });
  assert.equal(s.stampDutyRelief, true, 'delivered budget persists the relief');
  assert.equal(Math.round((structuralBalance(s) - maintainedBaseline) * 10) / 10, -STAMP_DUTY_RELIEF_COST);
});

check('SDLT: a later budget can maintain rates and the cost disappears', () => {
  let s = newGame('reform', 'morning-in-britain');
  const maintainedBaseline = structuralBalance({ ...s, stampDutyRelief: false });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: stampDutyPlan(s, true) });
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: stampDutyPlan(s, false) });
  assert.equal(s.stampDutyRelief, false);
  assert.equal(Math.round(structuralBalance(s) * 10) / 10, Math.round(maintainedBaseline * 10) / 10);
});

check('SDLT: the cost recurs annually, not once a month', () => {
  const base = newGame('reform', 'morning-in-britain');
  let s = { ...base, stats: { ...base.stats, budgetBalance: structuralBalance(base) } };
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: stampDutyPlan(s, true) });
  const atDelivery = s.stats.budgetBalance;
  const sdltShare = (g: GameState) =>
    Math.round((structuralBalance(g) - structuralBalance({ ...g, stampDutyRelief: false })) * 10) / 10;
  assert.equal(sdltShare(s), -STAMP_DUTY_RELIEF_COST);
  s = advanceWeek({ ...s, week: 5, budgetDue: false, fiscalEventKind: null });
  assert.equal(sdltShare(s), -STAMP_DUTY_RELIEF_COST, 'the standing term is an annual figure, applied once');
  assert.ok(Math.abs(s.stats.budgetBalance - atDelivery) < STAMP_DUTY_RELIEF_COST, 'a single month must not absorb the full annual cost');
});

check('SDLT: repeated delivery does not stack the recurring cost', () => {
  const s = newGame('reform', 'morning-in-britain');
  const plan = stampDutyPlan(s, true);
  const once = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan });
  const thrice = reducer(reducer(once, { type: 'DELIVER_CUSTOM_BUDGET', plan }), { type: 'DELIVER_CUSTOM_BUDGET', plan });
  assert.equal(thrice.stampDutyRelief, true);
  assert.equal(structuralBalance(thrice), structuralBalance(once), 'repeated delivery must not multiply the annual cost');
});

check('SDLT: preview scores the one-off separately from the recurring level', () => {
  const s = newGame('reform', 'morning-in-britain');
  const keeping = calculateCustomBudget(stampDutyPlan(s, true), { ...s, stampDutyRelief: true });
  assert.equal(keeping.stampDutyRevenue, 0, 'no status change means no one-off fiscal effect');
  assert.equal(keeping.stampDutyRecurring, -STAMP_DUTY_RELIEF_COST, 'the standing cost is reported separately');
  const maintaining = calculateCustomBudget(stampDutyPlan(s, false), { ...s, stampDutyRelief: true });
  assert.equal(maintaining.stampDutyRevenue, STAMP_DUTY_RELIEF_COST, 'maintaining rates is a one-off improvement of one year');
  assert.equal(maintaining.stampDutyRecurring, 0, 'maintaining rates clears the standing cost');
});

check('SDLT: setting and cost survive save/restore', () => {
  let s = newGame('reform', 'morning-in-britain');
  s = reducer(s, { type: 'DELIVER_CUSTOM_BUDGET', plan: stampDutyPlan(s, true) });
  const migrated = migrateState({ ...s });
  assert.equal(migrated.stampDutyRelief, true);
  assert.equal(stampDutyRecurringRevenue(migrated.stampDutyRelief === true), -STAMP_DUTY_RELIEF_COST);
  const legacy: Partial<GameState> = { ...newGame('reform', 'morning-in-britain') };
  delete legacy.stampDutyRelief;
  const legacyMigrated = migrateState(legacy);
  assert.equal(legacyMigrated.stampDutyRelief, false, 'older saves default to maintaining higher rates');
  assert.equal(stampDutyRecurringRevenue(legacyMigrated.stampDutyRelief === true), 0);
});

// ===== Fiscal-event lock + limited emergency levies =====

check('fiscal lock: headline tax rates are unchanged outside a fiscal window', () => {
  const s = newGame('reform', 'morning-in-britain');
  assert.equal(s.budgetDue, false, 'no fiscal event on the desk');
  const before = s.taxes.find((t) => t.id === 'income')!.rate;
  const next = reducer(s, { type: 'ADJUST_TAX', taxId: 'income', delta: 1 });
  assert.equal(next.taxes.find((t) => t.id === 'income')!.rate, before, 'locked outside a window');
  assert.equal(next, s, 'a blocked edit returns the same state');
});

check('fiscal lock: headline tax rates move inside a fiscal window', () => {
  const s = { ...newGame('reform', 'morning-in-britain'), budgetDue: true };
  const before = s.taxes.find((t) => t.id === 'income')!.rate;
  const next = reducer(s, { type: 'ADJUST_TAX', taxId: 'income', delta: 1 });
  assert.equal(next.taxes.find((t) => t.id === 'income')!.rate, before + 1);
});

check('fiscal lock: departmental budgets only move inside a fiscal window', () => {
  const s = newGame('reform', 'morning-in-britain');
  const before = s.departments.find((d) => d.id === 'nhs')!.budget;
  const locked = reducer(s, { type: 'ADJUST_SPENDING', deptId: 'nhs', delta: 5 });
  assert.equal(locked.departments.find((d) => d.id === 'nhs')!.budget, before, 'locked outside a window');
  const moved = reducer({ ...s, budgetDue: true }, { type: 'ADJUST_SPENDING', deptId: 'nhs', delta: 5 });
  assert.equal(moved.departments.find((d) => d.id === 'nhs')!.budget, before + 5);
});

check('fiscal lock: a designated emergency levy moves off-cycle at a cost, then caps out', () => {
  let s = newGame('reform', 'morning-in-britain');
  const gilt0 = s.stats.giltYield;
  const approval0 = s.metrics.approval;
  const start = s.taxes.find((t) => t.id === 'capgains')!.rate;

  s = reducer(s, { type: 'ADJUST_TAX', taxId: 'capgains', delta: 1 });
  assert.equal(s.taxes.find((t) => t.id === 'capgains')!.rate, start + 1, 'emergency levy allowed off-cycle');
  assert.equal(s.emergencyFiscalActions, 1);
  assert.ok(s.stats.giltYield > gilt0, 'markets react to the off-cycle move');
  assert.ok(s.metrics.approval < approval0, 'the public reacts too');

  s = reducer(s, { type: 'ADJUST_TAX', taxId: 'capgains', delta: 1 });
  assert.equal(s.emergencyFiscalActions, 2);

  const capped = s.taxes.find((t) => t.id === 'capgains')!.rate;
  const blocked = reducer(s, { type: 'ADJUST_TAX', taxId: 'capgains', delta: 1 });
  assert.equal(blocked.taxes.find((t) => t.id === 'capgains')!.rate, capped, 'emergency allowance is capped');
  assert.equal(blocked.emergencyFiscalActions, 2);
});

check('fiscal lock: non-emergency taxes cannot use the emergency allowance', () => {
  const s = newGame('reform', 'morning-in-britain');
  const before = s.taxes.find((t) => t.id === 'vat')!.rate;
  const next = reducer(s, { type: 'ADJUST_TAX', taxId: 'vat', delta: 1 });
  assert.equal(next.taxes.find((t) => t.id === 'vat')!.rate, before);
  assert.equal(next.emergencyFiscalActions ?? 0, 0, 'the allowance is untouched');
});

check('fiscal lock: the emergency counter migrates safely and resets each term', () => {
  const legacy: Partial<GameState> = { ...newGame('reform', 'morning-in-britain') };
  delete legacy.emergencyFiscalActions;
  assert.equal(migrateState(legacy).emergencyFiscalActions, 0, 'older saves start with a full allowance');

  let s: GameState = { ...newGame('reform', 'morning-in-britain'), emergencyFiscalActions: 2, turnsUntilElection: 1 };
  s = advanceWeek({ ...s, week: 20, budgetDue: false, fiscalEventKind: null });
  assert.equal(s.emergencyFiscalActions, 0, 'a new term restores the emergency allowance');
});

check('personal allowance: engine and budget recurring estimates stay identical (characterization)', () => {
  const base = createInitialState();
  const engineEstimate = (allowance: number) =>
    personalAllowanceRevenue({ ...base, personalAllowance: allowance });
  const budgetEstimate = (allowance: number) => personalAllowanceRecurringRevenue(allowance);

  // Inputs: negative, zero, one step outside each boundary, both boundaries,
  // the default, and a couple of ordinary values.
  const table = [
    -10000,
    -PERSONAL_ALLOWANCE_STEP,
    0,
    PERSONAL_ALLOWANCE_MIN - PERSONAL_ALLOWANCE_STEP,
    PERSONAL_ALLOWANCE_MIN,
    10000,
    DEFAULT_PERSONAL_ALLOWANCE,
    15000,
    PERSONAL_ALLOWANCE_MAX,
    PERSONAL_ALLOWANCE_MAX + PERSONAL_ALLOWANCE_STEP,
  ];

  // Drift detector: the two implementations must agree on every row.
  for (const allowance of table) {
    assert.equal(
      engineEstimate(allowance),
      budgetEstimate(allowance),
      `engine/budget allowance estimates disagree at £${allowance}`,
    );
  }

  // Both delegate to `calculatePersonalAllowanceRevenue`, which clamps to
  // [PERSONAL_ALLOWANCE_MIN, PERSONAL_ALLOWANCE_MAX]. Inside the valid range,
  // estimates are strictly decreasing; outside the bounds, they saturate at the
  // boundary values.
  const inRange = [
    PERSONAL_ALLOWANCE_MIN,
    DEFAULT_PERSONAL_ALLOWANCE,
    15000,
    PERSONAL_ALLOWANCE_MAX,
  ];
  for (let i = 1; i < inRange.length; i++) {
    assert.ok(
      budgetEstimate(inRange[i]) < budgetEstimate(inRange[i - 1]),
      `estimate not strictly decreasing between £${inRange[i - 1]} and £${inRange[i]}`,
    );
    assert.equal(
      engineEstimate(inRange[i]),
      budgetEstimate(inRange[i]),
      `engine/budget disagree on the monotonic run at £${inRange[i]}`,
    );
  }

  // Out-of-range values are clamped at the boundary.
  assert.equal(
    budgetEstimate(PERSONAL_ALLOWANCE_MIN - PERSONAL_ALLOWANCE_STEP),
    budgetEstimate(PERSONAL_ALLOWANCE_MIN),
    'below-floor allowance is clamped to the minimum',
  );
  assert.equal(
    budgetEstimate(PERSONAL_ALLOWANCE_MAX + PERSONAL_ALLOWANCE_STEP),
    budgetEstimate(PERSONAL_ALLOWANCE_MAX),
    'above-ceiling allowance is clamped to the maximum',
  );

  // Today's baseline: the default allowance sits exactly on the frozen baseline.
  assert.equal(budgetEstimate(DEFAULT_PERSONAL_ALLOWANCE), 0);
});

console.log('');
if (failures > 0) {
  // A thrown error gives the process a non-zero exit code.
  throw new Error(failures + ' of ' + (checks + failures) + ' engine checks failed');
}
console.log('all ' + checks + ' engine checks passed');
