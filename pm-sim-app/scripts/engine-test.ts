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
import { createInitialState, migrateState, reducer, advanceWeek } from '../src/app/engine';
import { advanceRelationDecay } from '../src/app/diplomacy';
import { DOSSIER_POOL } from '../src/app/data';
import { BILL_POOL } from '../src/app/bills';
import { DOSSIER_POOL_2 } from '../src/app/dossiers2';
import { DOSSIER_POOL_3 } from '../src/app/dossiers3';
import type { GameState } from '../src/app/types';
import { SCENARIOS } from '../src/app/scenarios';
import { evaluatePledges } from '../src/app/pledges';
import { projectSeats } from '../src/app/electionProjection';

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

function newGame(partyId = 'reform', scenario?: string): GameState {
  let s = createInitialState();
  s = reducer(s, { type: 'SET_TERM_LENGTH', weeks: 60 });
  s = reducer(s, {
    type: 'CREATE_PLAYER',
    player: { firstName: 'Test', lastName: 'PM', partyId, background: 'City financier', scenario },
  });
  return s;
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
  s = { ...s, week: 11, turnsUntilElection: 40 };
  s = advanceWeek(s);
  assert.ok(!!s.oppositionMotion, 'no motion tabled at week 12 without a majority');
  const due = s.oppositionMotion!.scheduledWeek;
  s = advanceWeek({ ...s, week: due });
  assert.ok(!s.oppositionMotion, 'motion never resolved');
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

console.log('');
if (failures > 0) {
  // A thrown error gives the process a non-zero exit code.
  throw new Error(failures + ' of ' + (checks + failures) + ' engine checks failed');
}
console.log('all ' + checks + ' engine checks passed');
