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
import { DOSSIER_POOL } from '../src/app/data';
import { DOSSIER_POOL_2 } from '../src/app/dossiers2';
import { DOSSIER_POOL_3 } from '../src/app/dossiers3';
import type { GameState } from '../src/app/types';
import { SCENARIOS } from '../src/app/scenarios';

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

console.log('');
if (failures > 0) {
  // A thrown error gives the process a non-zero exit code.
  throw new Error(failures + ' of ' + (checks + failures) + ' engine checks failed');
}
console.log('all ' + checks + ' engine checks passed');
