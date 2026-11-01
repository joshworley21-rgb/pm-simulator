/**
 * Immigration & asylum harness: backlog, arrivals, capacity, removals.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import {
  advanceImmigration,
  accommodationCost,
  backlogAlertRisk,
  createDefaultImmigrationState,
  immigrationEffects,
  removalFlight,
  setCaseworkerCapacity,
  setRemovalsBlocked,
  BACKLOG_ALERT,
  type ImmigrationState,
} from '../src/app/immigration';

const assert = {
  ok(value: unknown, message?: string) {
    if (!value) throw new Error(message ?? 'expected a truthy value');
  },
  equal<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(message ?? 'expected ' + String(expected) + ' but got ' + String(actual));
    }
  },
};

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

function tick(state: ImmigrationState, week: number, over: Partial<Parameters<typeof advanceImmigration>[0]> = {}) {
  return advanceImmigration({
    state,
    approval: 48,
    security: 58,
    week,
    seed: 4242,
    ...over,
  });
}

check('immigration state defaults are inert', () => {
  const s = createDefaultImmigrationState();
  assert.equal(s.backlog, 100);
  assert.equal(s.caseworkerCapacity, 70);
  assert.equal(s.removalsBlocked, false);
  assert.equal(s.arrivalsThisYear, 0);
  assert.equal(s.removalsThisTerm, 0);
});

check('INERT INVARIANT: a settled backlog yields no effects and no log', () => {
  let state = createDefaultImmigrationState();
  for (let week = 1; week <= 12; week += 1) {
    const result = tick(state, week);
    assert.equal(Object.keys(result.effects).length, 0, 'effects must be empty below the alert threshold');
    assert.equal(result.log.length, 0, 'log must be empty below the alert threshold');
    state = result.state;
  }
});

check('arrivals accrue and the backlog grows under strain', () => {
  let state = setCaseworkerCapacity(createDefaultImmigrationState(), 10);
  const start = state.backlog;
  for (let week = 1; week <= 20; week += 1) {
    state = tick(state, week).state;
  }
  assert.ok(state.arrivalsThisYear > 0, 'arrivals must be recorded');
  assert.ok(state.backlog > start, 'a starved caseworking operation must fall behind');
});

check('caseworker capacity changes the trajectory', () => {
  let lean = setCaseworkerCapacity(createDefaultImmigrationState(), 20);
  let rich = setCaseworkerCapacity(createDefaultImmigrationState(), 100);
  for (let week = 1; week <= 20; week += 1) {
    lean = tick(lean, week).state;
    rich = tick(rich, week).state;
  }
  assert.ok(rich.backlog < lean.backlog, 'better staffing must hold the backlog down');
});

check('a backlog past the alert threshold produces capped effects', () => {
  const strained: ImmigrationState = { ...createDefaultImmigrationState(), backlog: 400 };
  const effects = immigrationEffects(strained);
  assert.ok((effects.approval ?? 0) < 0, 'a runaway backlog must cost approval');
  assert.ok((effects.budgetBalance ?? 0) < 0, 'a runaway backlog must cost money');
  assert.ok(
    Math.abs(effects.approval ?? 0) <= 0.1 && Math.abs(effects.budgetBalance ?? 0) <= 0.03,
    'effects must stay capped',
  );
  assert.ok(backlogAlertRisk(strained) > 0, 'risk should register');
});

check('accommodation cost scales with the backlog', () => {
  const small = accommodationCost({ ...createDefaultImmigrationState(), backlog: 100 });
  const big = accommodationCost({ ...createDefaultImmigrationState(), backlog: 400 });
  assert.ok(big > small, 'a bigger estate costs more');
});

check('a removal flight reduces the backlog, unless an injunction blocks it', () => {
  const strained: ImmigrationState = { ...createDefaultImmigrationState(), backlog: 300 };
  const removed = removalFlight(strained, 40);
  assert.equal(removed.backlog, 260, 'removals come off the backlog');
  assert.equal(removed.removalsThisTerm, 40);

  const blocked = setRemovalsBlocked(strained, true);
  const refused = removalFlight(blocked, 40);
  assert.equal(refused.backlog, 300, 'an injunction must block removals outright');
});

check('identical inputs and seeds produce identical module output', () => {
  const base = createDefaultImmigrationState();
  const input = { state: base, approval: 40, security: 35, week: 11, seed: 31337 };
  assert.equal(JSON.stringify(advanceImmigration(input)), JSON.stringify(advanceImmigration(input)));
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' immigration checks failed');
}
console.log('all ' + checks + ' immigration checks passed');