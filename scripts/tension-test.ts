/**
 * National Tension Index / calendar harness.
 * Pure presentation reads over live GameState; no engine mutation.
 */
import { createInitialState } from '../src/app/engine';
import { deriveCalendar, deriveTensionIndex } from '../src/app/tension';
import type { GameState } from '../src/app/types';

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

const base = createInitialState();

function calm(): GameState {
  return {
    ...base,
    metrics: { ...base.metrics, approval: 70, partyConfidence: 80 },
    stats: { ...base.stats, lettersOfNoConfidence: 0, giltYield: 3 },
    factionUnrest: 5,
  };
}

function stressed(): GameState {
  return {
    ...base,
    metrics: { ...base.metrics, approval: 12, partyConfidence: 15 },
    stats: { ...base.stats, lettersOfNoConfidence: 15, giltYield: 8.5 },
    factionUnrest: 92,
    blackSwanState: {
      ...(base.blackSwanState ?? {
        active: null,
        nextSwanWeek: 26,
        resolved: 0,
        missed: 0,
        commandScore: 50,
      }),
      active: { eventId: 'test-crisis', openedWeek: 1, weeksRemaining: 2 },
    },
  };
}

check('tension stays inside 0..100 and has a label', () => {
  for (const state of [calm(), stressed()]) {
    const reading = deriveTensionIndex(state);
    assert.ok(reading.value >= 0 && reading.value <= 100, 'tension within bounds');
    assert.ok(reading.label.length > 0, 'tension has a label');
    assert.ok(reading.components.length >= 4, 'components present');
  }
});

check('a calm country reads lower than a crisis country', () => {
  assert.ok(
    deriveTensionIndex(calm()).value < deriveTensionIndex(stressed()).value,
    'stress must raise the reading',
  );
});

check('calendar includes the month, session and election clock', () => {
  const labels = deriveCalendar(base).map((chip) => chip.label);
  assert.ok(labels.some((label) => label.startsWith('MONTH ')), 'month chip');
  assert.ok(labels.some((label) => label.startsWith('SESSION MONTH ')), 'session chip');
  assert.ok(labels.some((label) => label.endsWith('TO ELECTION')), 'election chip');
});

check('calendar switches to purdah at the election window', () => {
  const labels = deriveCalendar({ ...base, turnsUntilElection: 2 }).map((chip) => chip.label);
  assert.ok(labels.some((label) => label.startsWith('PURDAH')), 'purdah chip');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' tension checks failed');
}
console.log('all ' + checks + ' tension checks passed');
