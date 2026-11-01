/**
 * Local government & delivery-gap harness: council stress, s114 notices, delivery gap.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import {
  advanceLocalGovernment,
  councilsAtRisk,
  createDefaultLocalGovernmentState,
  deliveryDiscount,
  emergencyGrant,
  localGovernmentEffects,
  sendCommissioners,
  DELIVERY_GAP_FLOOR,
  SECTION_114_STRESS,
  type LocalGovernmentState,
} from '../src/app/localGovernment';

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

function tick(
  state: LocalGovernmentState,
  week: number,
  over: Partial<Parameters<typeof advanceLocalGovernment>[0]> = {},
) {
  return advanceLocalGovernment({
    state,
    publicServices: 55,
    approval: 48,
    week,
    seed: 4242,
    ...over,
  });
}

check('local-government defaults are inert', () => {
  const s = createDefaultLocalGovernmentState();
  assert.ok(s.authorities.length >= 60, 'expected every council from the region metadata');
  assert.equal(s.deliveryGap, 20);
  assert.equal(s.lastInterventionWeek, null);
  assert.ok(s.authorities.every((a) => a.stress === 20 && !a.section114), 'councils start solvent');
  assert.equal(new Set(s.authorities.map((a) => a.id)).size, s.authorities.length, 'ids must be unique');
});

check('INERT INVARIANT: a solvent landscape yields no effects and no log', () => {
  let state = createDefaultLocalGovernmentState();
  for (let week = 1; week <= 12; week += 1) {
    const result = tick(state, week);
    assert.equal(Object.keys(result.effects).length, 0, 'effects must be empty while solvent');
    assert.equal(result.log.length, 0, 'log must be empty while solvent');
    state = result.state;
  }
});

check('thin services raise council stress', () => {
  let strained = createDefaultLocalGovernmentState();
  let healthy = createDefaultLocalGovernmentState();
  for (let week = 1; week <= 30; week += 1) {
    strained = tick(strained, week, { publicServices: 35 }).state;
    healthy = tick(healthy, week, { publicServices: 80 }).state;
  }
  assert.ok(strained.authorities[0].stress > healthy.authorities[0].stress, 'poor services stress councils');
});

check('a council eventually issues a section 114 notice, and it is logged once', () => {
  let state = createDefaultLocalGovernmentState();
  let sawLog = false;
  let fired = false;
  for (let week = 1; week <= 400 && !fired; week += 1) {
    const result = tick(state, week, { publicServices: 35 });
    if (result.log.length > 0) sawLog = true;
    state = result.state;
    fired = state.authorities.some((a) => a.section114);
  }
  assert.ok(fired, 'a strained council should eventually fail');
  assert.ok(sawLog, 'the s114 moment should be logged');
  assert.ok(
    state.authorities.every((a) => !a.section114 || a.stress >= SECTION_114_STRESS),
    'notices must follow the stress threshold',
  );
});

check('council failure produces capped effects', () => {
  const failed: LocalGovernmentState = {
    ...createDefaultLocalGovernmentState(),
    authorities: createDefaultLocalGovernmentState().authorities.map((a, i) =>
      i < 3 ? { ...a, stress: 95, section114: true } : a,
    ),
    deliveryGap: 70,
  };
  const effects = localGovernmentEffects(failed);
  assert.ok((effects.approval ?? 0) < 0, 'failed councils must cost approval');
  assert.ok((effects.publicServices ?? 0) < 0, 'failed councils must cost services');
  assert.ok(
    Math.abs(effects.approval ?? 0) <= 0.1 && Math.abs(effects.publicServices ?? 0) <= 0.1,
    'effects must stay capped',
  );
});

check('the delivery gap grows under strain and the discount tracks it', () => {
  let state = createDefaultLocalGovernmentState();
  for (let week = 1; week <= 100; week += 1) {
    state = tick(state, week, { publicServices: 40 }).state;
  }
  assert.ok(state.deliveryGap > DELIVERY_GAP_FLOOR, 'a strained delivery grid should fall behind');
  assert.ok(deliveryDiscount(state) > 0.5, 'the discount should register');
  assert.ok(!state.authorities.every((a) => a.section114), 'not every council should fail');
});

check('an emergency grant rescues an authority; commissioners clear the notice', () => {
  const base = createDefaultLocalGovernmentState();
  const id = base.authorities[0].id;
  const failed: LocalGovernmentState = {
    ...base,
    authorities: base.authorities.map((a) => (a.id === id ? { ...a, stress: 95, section114: true } : a)),
  };

  const rescued = emergencyGrant(failed, id);
  const fixed = rescued.authorities.find((a) => a.id === id)!;
  assert.ok(fixed.stress < 95, 'a grant relieves stress');
  assert.equal(fixed.section114, false, 'a grant clears the notice');
  assert.ok(councilsAtRisk(failed) >= 1, 'the failed council is at risk');

  const commissioned = sendCommissioners(failed, id, 12);
  assert.equal(commissioned.lastInterventionWeek, 12);
  assert.equal(commissioned.authorities.find((a) => a.id === id)!.section114, false);
});

check('identical inputs and seeds produce identical module output', () => {
  const base = createDefaultLocalGovernmentState();
  const input = { state: base, publicServices: 42, approval: 40, week: 9, seed: 777 };
  assert.equal(
    JSON.stringify(advanceLocalGovernment(input)),
    JSON.stringify(advanceLocalGovernment(input)),
  );
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' local-government checks failed');
}
console.log('all ' + checks + ' local-government checks passed');