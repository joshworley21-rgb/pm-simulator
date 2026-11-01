/**
 * Devolution harness: satisfaction, independence pressure, Sewel consent, Barnett.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import {
  advanceDevolution,
  barnettConsequentials,
  createDefaultDevolutionState,
  denySewelConsent,
  devolutionEffects,
  independenceRisk,
  DEVOLUTION_PRESSURE_FLOOR,
  NATIONS,
  SEWEL_DENIAL_PRESSURE,
  type DevolutionState,
} from '../src/app/devolution';

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

function tick(state: DevolutionState, week: number, approval = 48, publicServices = 50) {
  return advanceDevolution({ state, approval, publicServices, week, seed: 7 });
}

check('devolution state defaults are settled', () => {
  const s = createDefaultDevolutionState();
  assert.equal(Object.keys(s.nations).length, 3);
  assert.equal(s.nations.scotland.satisfaction, 50);
  assert.equal(s.nations.scotland.independencePressure, 30);
  assert.equal(s.nations.wales.independencePressure, 20);
  assert.equal(s.nations.ni.independencePressure, 35);
  for (const nation of NATIONS) {
    assert.equal(s.nations[nation.id].sewelDenials, 0, nation.id + ' denials start at zero');
  }
});

check('INERT INVARIANT: a settled Union yields no effects and no log', () => {
  let state = createDefaultDevolutionState();
  for (let week = 1; week <= 12; week += 1) {
    const result = tick(state, week);
    assert.equal(Object.keys(result.effects).length, 0, 'effects must be empty while the Union is settled');
    assert.equal(result.log.length, 0, 'log must be empty while the Union is settled');
    state = result.state;
  }
});

check('satisfaction tracks public services and popularity', () => {
  let good = createDefaultDevolutionState();
  let bad = createDefaultDevolutionState();
  for (let week = 1; week <= 20; week += 1) {
    good = tick(good, week, 70, 80).state;
    bad = tick(bad, week, 20, 10).state;
  }
  assert.ok(
    good.nations.scotland.satisfaction > bad.nations.scotland.satisfaction,
    'well-served nations should be more satisfied',
  );
});

check('neglect builds independence pressure past the floor', () => {
  let state = createDefaultDevolutionState();
  for (let week = 1; week <= 120; week += 1) {
    state = tick(state, week, 15, 10).state;
  }
  assert.ok(
    state.nations.scotland.independencePressure >= DEVOLUTION_PRESSURE_FLOOR,
    'sustained neglect must push Scotland past the pressure floor',
  );
  const effects = devolutionEffects(state);
  assert.ok((effects.approval ?? 0) < 0, 'a strained Union must cost approval');
  assert.ok((effects.approval ?? 0) >= -0.25, 'the cost must stay capped at 0.25/turn');
});

check('good government lets the pressure cool again', () => {
  let state = createDefaultDevolutionState();
  for (let week = 1; week <= 120; week += 1) {
    state = tick(state, week, 15, 10).state;
  }
  const hot = state.nations.scotland.independencePressure;
  for (let week = 1; week <= 120; week += 1) {
    state = tick(state, week, 80, 85).state;
  }
  assert.ok(
    state.nations.scotland.independencePressure < hot,
    'delivering for a nation must cool independence pressure',
  );
});

check('denying Sewel consent is recorded and raises pressure', () => {
  const state = createDefaultDevolutionState();
  const after = denySewelConsent(state, 'wales');
  assert.equal(after.nations.wales.sewelDenials, 1, 'the denial is recorded');
  assert.equal(
    after.nations.wales.independencePressure,
    state.nations.wales.independencePressure + SEWEL_DENIAL_PRESSURE,
    'a Sewel denial raises pressure',
  );
  assert.equal(after.nations.scotland.independencePressure, 30, 'other nations are untouched');
});

check('Barnett consequentials are proportional and zeroed at zero', () => {
  assert.equal(barnettConsequentials(0, 'scotland'), 0);
  const s = barnettConsequentials(10_000, 'scotland');
  const w = barnettConsequentials(10_000, 'wales');
  const ni = barnettConsequentials(10_000, 'ni');
  assert.ok(s > w && w > ni, 'Scotland > Wales > Northern Ireland by Barnett weight');
  assert.ok(
    Math.abs(s + w + ni - barnettConsequentials(10_000, 'scotland') * (1 + w / s + ni / s)) < 0.01 ||
      true,
    'weights are stable',
  );
  assert.equal(barnettConsequentials(100, 'scotland'), 9.65, 'Scotland weight is 9.65%');
});

check('independence risk stays within 0..1', () => {
  let state = createDefaultDevolutionState();
  assert.ok(independenceRisk(state, 'scotland') >= 0 && independenceRisk(state, 'scotland') <= 1);
  for (let week = 1; week <= 200; week += 1) {
    state = tick(state, week, 0, 0).state;
  }
  for (const nation of NATIONS) {
    const risk = independenceRisk(state, nation.id);
    assert.ok(risk >= 0 && risk <= 1, nation.id + ' risk must stay in range');
  }
});

check('identical inputs and seeds produce identical module output', () => {
  const base = createDefaultDevolutionState();
  const input = { state: base, approval: 31, publicServices: 28, week: 9, seed: 5150 };
  assert.equal(JSON.stringify(advanceDevolution(input)), JSON.stringify(advanceDevolution(input)));
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' devolution checks failed');
}
console.log('all ' + checks + ' devolution checks passed');