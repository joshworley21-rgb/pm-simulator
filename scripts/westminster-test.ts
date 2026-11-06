/**
 * Westminster terminology and leadership-rule harness.
 */
import { createInitialState, reducer, resignationThreshold } from '../src/app/engine';
import { backbenchBody } from '../src/app/westminster';

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

check('party backbench bodies use their real institutions', () => {
  assert.equal(backbenchBody({ id: 'conservative' }).full, '1922 Committee');
  assert.equal(backbenchBody({ id: 'reform' }).full, 'Parliamentary Labour Party');
  assert.equal(backbenchBody({ id: 'reform' }).pressureLabel, 'PLP nominations');
  assert.equal(backbenchBody({ id: 'liberty' }).pressureUnit, 'nomination');
});

check('thresholds are party-specific', () => {
  assert.equal(resignationThreshold(400, 'conservative'), 60);
  assert.equal(resignationThreshold(400, 'reform'), 80);
  assert.equal(resignationThreshold(400, 'liberty'), 60);
});

check('a new Labour government starts with the PLP threshold', () => {
  const base = reducer(createInitialState(), {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Test',
      lastName: 'PM',
      partyId: 'reform',
      background: 'Former broadcast journalist',
    },
  });
  const seats = base.parties.find((party) => party.id === 'reform')?.seats ?? 0;
  assert.equal(base.stats.lettersThreshold, Math.max(15, Math.round(seats * 0.2)));
  assert.ok(base.stats.lettersThreshold > 65, 'Labour threshold should be higher than the old 15% figure');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' westminster checks failed');
}
console.log('all ' + checks + ' westminster checks passed');
