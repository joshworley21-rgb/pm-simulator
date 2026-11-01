/**
 * Cabinet-as-persons harness: tenure, rivalries and cohesion.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import type { Minister } from '../src/app/types';
import {
  advanceCabinet,
  applyPromotion,
  applyRemoval,
  cohesionEffects,
  createDefaultCabinetState,
  estimateResignationRisk,
  type CabinetState,
} from '../src/app/cabinet';

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

function minister(
  name: string,
  faction: string,
  loyalty: number,
  ambition: number,
): Minister {
  return { name, post: 'Minister ' + name, partyId: 'reform', loyalty, competence: 70, faction, ambition };
}

/** A deliberately rivalrous cabinet: Left vs Centrist, both ambitious. */
const RIVAL_CABINET: Minister[] = [
  minister('Ada Lovelace', 'Left', 60, 80),
  minister('Brunel', 'Centrist', 62, 85),
  minister('Curie', 'Left', 78, 40),
];

/** A calm cabinet: no opposed faction pairing at all. */
const CALM_CABINET: Minister[] = [
  minister('Ada Lovelace', 'Centrist', 80, 40),
  minister('Brunel', 'Centrist', 82, 45),
];

function tick(state: CabinetState, cabinet: Minister[], week: number, seed = 1234) {
  return advanceCabinet({ cabinet, state, factionUnrest: 20, partyConfidence: 60, week, seed });
}

check('cabinet state defaults are inert', () => {
  const s = createDefaultCabinetState();
  assert.equal(s.cohesion, 65, 'default cohesion');
  assert.equal(s.rivalries.length, 0);
  assert.equal(Object.keys(s.tenure).length, 0);
  assert.equal(Object.keys(s.resignationPressure).length, 0);
});

check('INERT INVARIANT: a healthy cabinet yields no effects and no log', () => {
  // Default cohesion is healthy, so the module must not perturb the simulation.
  let state = createDefaultCabinetState();
  for (let week = 1; week <= 12; week += 1) {
    const result = tick(state, CALM_CABINET, week);
    assert.equal(Object.keys(result.effects).length, 0, 'effects must be empty while cohesion >= floor');
    assert.equal(result.log.length, 0, 'log must be empty while cohesion >= floor');
    state = result.state;
  }
  assert.ok(state.cohesion >= 40, 'calm cabinet keeps cohesion healthy');
});

check('tenure accrues one week per minister per tick', () => {
  let state = createDefaultCabinetState();
  for (let week = 1; week <= 5; week += 1) {
    state = tick(state, CALM_CABINET, week).state;
  }
  assert.equal(state.tenure['Ada Lovelace'], 5);
  assert.equal(state.tenure['Brunel'], 5);
});

check('a rivalry forms between opposed, ambitious ministers after the tenure threshold', () => {
  let state = createDefaultCabinetState();
  // Seven weeks: still inside the 8-week threshold, no rivalry yet.
  for (let week = 1; week <= 7; week += 1) {
    state = tick(state, RIVAL_CABINET, week).state;
  }
  assert.equal(state.rivalries.length, 0, 'no rivalry before the tenure threshold');
  // Eighth week: both are now long enough in post.
  state = tick(state, RIVAL_CABINET, 8).state;
  assert.equal(state.rivalries.length, 1, 'expected exactly one rivalry');
  assert.equal(state.rivalries[0].a, 'Ada Lovelace');
  assert.equal(state.rivalries[0].b, 'Brunel');
});

check('rivalry heat drags cohesion down and stays inside its bounds', () => {
  let state = createDefaultCabinetState();
  const start = state.cohesion;
  for (let week = 1; week <= 60; week += 1) {
    state = tick(state, RIVAL_CABINET, week).state;
    assert.ok(state.cohesion >= 0 && state.cohesion <= 100, 'cohesion must stay 0..100');
  }
  assert.ok(state.cohesion < start, 'rivalry heat must reduce cohesion');
});

check('cohesion effects appear only once cohesion breaks the floor', () => {
  const healthy: CabinetState = { ...createDefaultCabinetState(), cohesion: 55 };
  assert.equal(Object.keys(cohesionEffects(healthy)).length, 0, 'healthy => no effects');
  const broken: CabinetState = { ...createDefaultCabinetState(), cohesion: 30 };
  const effects = cohesionEffects(broken);
  assert.ok((effects.partyConfidence ?? 0) < 0, 'broken cohesion costs party confidence');
  assert.ok((effects.approval ?? 0) < 0, 'broken cohesion costs approval');
});

check('resignation pressure builds with long tenure and high ambition', () => {
  let state = createDefaultCabinetState();
  for (let week = 1; week <= 50; week += 1) {
    state = tick(state, RIVAL_CABINET, week).state;
  }
  assert.ok(
    estimateResignationRisk(state, 'Brunel') > 0,
    'a long-serving, ambitious minister accrues resignation pressure',
  );
  assert.ok(estimateResignationRisk(state, 'Brunel') <= 1, 'risk stays within 0..1');
});

check('identical inputs and seeds produce identical module output', () => {
  const base = createDefaultCabinetState();
  const a = tick(base, RIVAL_CABINET, 9, 777);
  const b = tick(base, RIVAL_CABINET, 9, 777);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

check('promotion resets tenure and pressure; removal clears rivalries', () => {
  let state = tick(createDefaultCabinetState(), RIVAL_CABINET, 9).state;
  state = applyPromotion(state, 'Brunel', 9);
  assert.equal(state.tenure['Brunel'], 0, 'promotion resets tenure');
  assert.equal(state.resignationPressure['Brunel'], 0, 'promotion clears pressure');

  const afterRemoval = applyRemoval(state, 'Brunel');
  assert.equal(afterRemoval.tenure['Brunel'], undefined, 'removal forgets tenure');
  assert.equal(
    afterRemoval.rivalries.filter((r) => r.a === 'Brunel' || r.b === 'Brunel').length,
    0,
    'removal clears rivalries naming the minister',
  );
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' cabinet checks failed');
}
console.log('all ' + checks + ' cabinet checks passed');