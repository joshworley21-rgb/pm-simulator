/**
 * Media-cycle harness: press mood, hostility, coverage tone and lobby briefings.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import {
  advanceMedia,
  coverageTone,
  createDefaultMediaState,
  lobbyBriefing,
  mediaEffects,
  BRIEFING_COOLDOWN_WEEKS,
  MEDIA_HOSTILITY_FLOOR,
  voiceHeadlines,
  PRESS_HOSTILE_MARK,
  PRESS_WARM_MARK,
  type MediaState,
} from '../src/app/media';

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

/** A neutral news week: nothing that should move the press. */
function neutral(state: MediaState, week: number, over: Partial<Parameters<typeof advanceMedia>[0]> = {}) {
  return advanceMedia({
    state,
    approval: 48,
    cpiInflation: 2.5,
    publicServices: 50,
    mediaAttention: 35,
    factionUnrest: 20,
    week,
    seed: 99,
    ...over,
  });
}

check('media state defaults are inert', () => {
  const s = createDefaultMediaState();
  assert.equal(s.hostility, 0);
  assert.equal(s.pressMood.clarion, 50);
  assert.equal(s.pressMood['national-standard'], 50);
  assert.equal(s.pressMood.courier, 50);
  assert.equal(s.cycleTone, 0);
  assert.equal(s.lastBriefingWeek, null);
});

check('INERT INVARIANT: a neutral press yields no effects and no log', () => {
  let state = createDefaultMediaState();
  for (let week = 1; week <= 10; week += 1) {
    const result = neutral(state, week);
    assert.equal(Object.keys(result.effects).length, 0, 'effects must be empty while the press is calm');
    assert.equal(result.log.length, 0, 'log must be empty while the press is calm');
    state = result.state;
  }
});

check('left and right outlets diverge on the same economy', () => {
  const state = createDefaultMediaState();
  // Strong public services please the left paper and mildly annoy the right one.
  const servicesHigh = neutral(state, 1, { publicServices: 90 }).state;
  assert.ok(
    servicesHigh.pressMood.clarion > servicesHigh.pressMood.courier,
    'a services boom should warm the left paper more than the right',
  );

  // High inflation hurts everyone, and the left paper most.
  const inflation = neutral(state, 1, { cpiInflation: 9 }).state;
  assert.ok(inflation.pressMood.clarion < 50, 'high inflation must cool the press');
});

check('coverage tone tracks the press and stays within -1..1', () => {
  let state = createDefaultMediaState();
  for (let week = 1; week <= 20; week += 1) {
    state = neutral(state, week, { approval: 80, cpiInflation: 1.5 }).state;
    assert.ok(state.cycleTone >= -1 && state.cycleTone <= 1, 'tone must stay in range');
  }
  assert.ok(state.cycleTone > 0, 'a popular government should enjoy positive coverage');
  assert.equal(coverageTone(state), state.cycleTone);
});

check('sustained scrutiny builds hostility, which then bites', () => {
  let state = createDefaultMediaState();
  for (let week = 1; week <= 80; week += 1) {
    state = neutral(state, week, {
      mediaAttention: 95,
      factionUnrest: 90,
      cpiInflation: 8,
      approval: 25,
    }).state;
  }
  assert.ok(state.hostility >= MEDIA_HOSTILITY_FLOOR, 'sustained scrutiny must build hostility');
  const effects = mediaEffects(state);
  assert.ok((effects.approval ?? 0) < 0, 'hostile press must cost approval');
  assert.ok((effects.mediaAttention ?? 0) > 0, 'hostile press must raise media attention');
});

check('a lobby briefing leans on an outlet and cannot repeat inside the cooldown', () => {
  const state = createDefaultMediaState();
  const boosted = lobbyBriefing(state, 'courier', 'boost', 10);
  assert.ok(
    boosted.state.pressMood.courier > state.pressMood.courier,
    'a boost briefing should warm the target outlet',
  );
  assert.equal(boosted.state.lastBriefingWeek, 10);

  // Inside the cooldown the briefing is refused outright.
  const tooSoon = lobbyBriefing(boosted.state, 'courier', 'boost', 10 + BRIEFING_COOLDOWN_WEEKS - 1);
  assert.equal(tooSoon.state.pressMood.courier, boosted.state.pressMood.courier, 'cooldown must block');
  assert.equal(tooSoon.state.lastBriefingWeek, 10);

  // Past the cooldown it lands.
  const later = lobbyBriefing(boosted.state, 'courier', 'boost', 10 + BRIEFING_COOLDOWN_WEEKS);
  assert.ok(later.state.pressMood.courier > boosted.state.pressMood.courier, 'cooldown must expire');
});

check('attack briefings carry manipulation risk', () => {
  const state = createDefaultMediaState();
  const attacked = lobbyBriefing(state, 'clarion', 'attack', 5);
  assert.ok(attacked.state.hostility > state.hostility, 'an attack briefing raises hostility');
});

check('identical inputs and seeds produce identical module output', () => {
  const base = createDefaultMediaState();
  const input = {
    state: base,
    approval: 33,
    cpiInflation: 6,
    publicServices: 41,
    mediaAttention: 70,
    factionUnrest: 55,
    week: 7,
    seed: 4242,
  };
  assert.equal(JSON.stringify(advanceMedia(input)), JSON.stringify(advanceMedia(input)));
});

check('a calm press leaves the copy exactly as written', () => {
  const calm = createDefaultMediaState();
  const base = { paper: 'The Courier', title: 'BUDGET LEAKED', stance: 'right' as const };
  assert.equal(voiceHeadlines(calm, [base])[0].title, base.title, 'neutral press must not re-voice');
});

check('a hostile press appends its mark without destroying the base title', () => {
  const base = { paper: 'The Courier', title: 'BUDGET LEAKED', stance: 'right' as const };
  const hostile: MediaState = {
    ...createDefaultMediaState(),
    hostility: MEDIA_HOSTILITY_FLOOR + 10,
  };
  const voiced = voiceHeadlines(hostile, [base])[0];
  assert.ok(voiced.title.startsWith('BUDGET LEAKED'), 'the base title must survive intact');
  assert.ok(voiced.title.includes(PRESS_HOSTILE_MARK), 'a hostile press files a hostile line');
  // Idempotent: re-voicing the same array must never stack marks.
  assert.equal(voiceHeadlines(hostile, [voiced])[0].title, voiced.title, 'marks must not stack');
});

check('mood decides the tone: a warm outlet backs the government, a cold one turns', () => {
  const item = { paper: 'The Courier', title: 'GROWTH UP', stance: 'right' as const };
  const warm: MediaState = {
    ...createDefaultMediaState(),
    pressMood: { ...createDefaultMediaState().pressMood, courier: 95 },
    hostility: 5,
  };
  assert.ok(
    voiceHeadlines(warm, [item])[0].title.includes(PRESS_WARM_MARK),
    'a warm outlet should back the government',
  );

  const cold: MediaState = {
    ...createDefaultMediaState(),
    pressMood: { ...createDefaultMediaState().pressMood, courier: 10 },
    hostility: 5,
  };
  assert.ok(
    voiceHeadlines(cold, [item])[0].title.includes(PRESS_HOSTILE_MARK),
    'a cold outlet should turn on the government',
  );
});

check('voicing never mutates the input and carries no effects', () => {
  const hostile: MediaState = { ...createDefaultMediaState(), hostility: MEDIA_HOSTILITY_FLOOR + 10 };
  const input = [{ paper: 'The Courier', title: 'ORIGINAL', stance: 'right' as const }];
  const snapshot = JSON.stringify(input);
  voiceHeadlines(hostile, input);
  assert.equal(JSON.stringify(input), snapshot, 'the input headlines must not be mutated');
  // The signature returns an array, not effects: double-counting is structurally impossible.
  assert.equal(voiceHeadlines(hostile, input).length, 1);
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' media checks failed');
}
console.log('all ' + checks + ' media checks passed');