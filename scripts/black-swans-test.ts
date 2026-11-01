/**
 * Black-swan harness: authored shocks, neutral expiry, command scoring.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import {
  activeSwanEvent,
  advanceBlackSwans,
  commandReading,
  createDefaultBlackSwanState,
  resolveBlackSwan,
  BLACK_SWAN_CATALOGUE,
  SWAN_FIRST_WEEK,
  SWAN_INTERVAL_WEEKS,
  SWAN_WINDOW_WEEKS,
  type BlackSwanState,
} from '../src/app/blackSwans';

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

function tick(state: BlackSwanState, week: number, seed = 4242) {
  return advanceBlackSwans({ state, week, seed });
}

check('black-swan defaults are inert', () => {
  const s = createDefaultBlackSwanState();
  assert.equal(s.active, null);
  assert.equal(s.nextSwanWeek, SWAN_FIRST_WEEK);
  assert.equal(s.resolved, 0);
  assert.equal(s.missed, 0);
  assert.equal(s.commandScore, 50);
});

check('INERT INVARIANT: the weekly tick never returns effects', () => {
  let state = createDefaultBlackSwanState();
  // Sweep well past the first shock and through its whole window.
  for (let week = 1; week <= SWAN_FIRST_WEEK + SWAN_INTERVAL_WEEKS + 10; week += 1) {
    const result = tick(state, week);
    assert.equal(Object.keys(result.effects).length, 0, 'the tick must never yield effects');
    state = result.state;
  }
});

check('a shock opens on schedule, and only one is ever live at a time', () => {
  const state = createDefaultBlackSwanState();
  const before = tick(state, SWAN_FIRST_WEEK - 1);
  assert.equal(before.state.active, null, 'no shock before the schedule');

  const opened = tick(before.state, SWAN_FIRST_WEEK);
  assert.ok(!!opened.state.active, 'the shock should land on schedule');
  assert.equal(opened.state.active!.weeksRemaining, SWAN_WINDOW_WEEKS, 'the window is set');
  assert.ok((opened.log ?? []).some((l) => l.includes('BLACK SWAN:')), 'the shock is announced');
  assert.ok(!!activeSwanEvent(opened.state), 'the shock resolves to a catalogue event');
});

check('an unanswered shock expires NEUTRALLY and is only recorded as missed', () => {
  let state = tick(createDefaultBlackSwanState(), SWAN_FIRST_WEEK).state;
  for (let i = 0; i < SWAN_WINDOW_WEEKS; i += 1) {
    const result = tick(state, SWAN_FIRST_WEEK + 1 + i);
    assert.equal(Object.keys(result.effects).length, 0, 'expiry must cost nothing');
    state = result.state;
  }
  assert.equal(state.active, null, 'the shock has expired');
  assert.equal(state.missed, 1, 'the miss is recorded, not punished');
  assert.equal(state.resolved, 0, 'nothing was answered');
  assert.equal(state.commandScore, 50, 'the command reading is untouched by a passive government');
});

check('answering a shock applies its authored effects and moves the command reading', () => {
  const opened = tick(createDefaultBlackSwanState(), SWAN_FIRST_WEEK);
  const event = activeSwanEvent(opened.state)!;
  const best = [...event.options].sort((a, b) => b.commandScore - a.commandScore)[0];

  const answered = resolveBlackSwan(opened.state, best.id);
  assert.equal(answered.state.active, null, 'the shock is cleared');
  assert.equal(answered.state.resolved, 1, 'the answer is counted');
  assert.ok(Object.keys(answered.effects).length > 0, 'an authored answer has consequences');
  assert.ok(answered.state.commandScore > 50, 'a decisive answer improves the reading');
  assert.equal(commandReading(answered.state), answered.state.commandScore, 'the reading is exposed');
});

check('a decisive response scores higher than a dithering one', () => {
  for (const event of BLACK_SWAN_CATALOGUE) {
    const scores = event.options.map((o) => o.commandScore);
    const decisive = Math.max(...scores);
    const dither = Math.min(...scores);
    assert.ok(decisive > dither, `${event.id} must separate decisiveness from dithering`);
    assert.ok(decisive <= 100 && dither >= 0, `${event.id} scores must be in 0..100`);
    assert.ok(event.options.length >= 2, `${event.id} needs a real choice`);
  }
});

check('the catalogue is internally sound', () => {
  assert.ok(BLACK_SWAN_CATALOGUE.length >= 5, 'expected a decent catalogue of shocks');
  const eventIds = BLACK_SWAN_CATALOGUE.map((e) => e.id);
  assert.equal(new Set(eventIds).size, eventIds.length, 'event ids must be unique');
  const optionIds = BLACK_SWAN_CATALOGUE.flatMap((e) => e.options.map((o) => o.id));
  assert.equal(new Set(optionIds).size, optionIds.length, 'option ids must be unique across the catalogue');
  for (const e of BLACK_SWAN_CATALOGUE) {
    assert.ok(e.brief.length > 20, `${e.id} needs a real brief`);
    assert.ok(e.options.every((o) => o.label.length > 5), `${e.id} options need labels`);
  }
});

check('answering the wrong shock, or none, is a harmless no-op', () => {
  const idle = createDefaultBlackSwanState();
  const noop = resolveBlackSwan(idle, 'floods-cobra');
  assert.equal(noop.state, idle, 'resolving with nothing live must change nothing');
  assert.equal(Object.keys(noop.effects).length, 0, 'and must cost nothing');

  const opened = tick(idle, SWAN_FIRST_WEEK);
  const bad = resolveBlackSwan(opened.state, 'not-a-real-option');
  assert.equal(bad.state.resolved, 0, 'an unknown option is refused');
  assert.equal(Object.keys(bad.effects).length, 0, 'and costs nothing');
});

check('identical inputs produce identical output and never mutate the input', () => {
  const base = createDefaultBlackSwanState();
  assert.equal(JSON.stringify(tick(base, SWAN_FIRST_WEEK)), JSON.stringify(tick(base, SWAN_FIRST_WEEK)));
  assert.equal(base.active, null, 'the input state must not be mutated');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' black-swan checks failed');
}
console.log('all ' + checks + ' black-swan checks passed');