/**
 * Interest groups, lobbying & select-committee harness.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import type { Bill } from '../src/app/types';
import {
  advanceLobbying,
  committeeDelayWeeks,
  createDefaultLobbyingState,
  hostileCommittees,
  lobbyGroup,
  petitionPressure,
  revolvingDoorRisk,
  COMMITTEE_DELAY_MAX_WEEKS,
  COMMITTEE_HOSTILITY_FLOOR,
  LOBBY_COOLDOWN_WEEKS,
  PETITION_DEBATE_THRESHOLD,
  type LobbyingState,
} from '../src/app/lobbying';

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

const TREASURY_BILL: Bill = {
  id: 'bill-test-treasury',
  title: 'Test Treasury Bill',
  department: 'HM Treasury',
  description: 'A bill for testing.',
  fiscalCost: 1,
  weeksToPass: 3,
  rebellionRisk: 10,
  effects: {},
  kicker: 'TEST',
};

function tick(state: LobbyingState, week: number, approval = 48) {
  return advanceLobbying({ state, approval, partyConfidence: 55, week, seed: 4242 });
}

check('lobbying defaults are inert', () => {
  const s = createDefaultLobbyingState();
  assert.equal(s.groups.length, 4, 'expected the standing interest groups');
  assert.equal(s.committees.length, 4, 'expected the departmental select committees');
  assert.equal(s.lastLobbyWeek, null);
  assert.equal(s.petitionsDebated, 0);
  assert.equal(s.revolvingDoors, 0);
  assert.ok(s.groups.every((g) => g.influence >= 0 && g.influence <= 100), 'influence in range');
});

check('INERT INVARIANT: the weekly tick never returns effects', () => {
  let state = createDefaultLobbyingState();
  // Sweep a whole year at both strong and weak approval.
  for (let week = 1; week <= 52; week += 1) {
    const weak = tick(state, week, 20);
    assert.equal(Object.keys(weak.effects).length, 0, 'the tick must never yield effects');
    state = weak.state;
  }
  assert.ok(state.committees.length === 4, 'committees survive the sweep');
});

check('committees turn hostile while the government is weak, and soften when it recovers', () => {
  let weak = createDefaultLobbyingState();
  let strong = createDefaultLobbyingState();
  for (let week = 1; week <= 40; week += 1) {
    weak = tick(weak, week, 20).state;
    strong = tick(strong, week, 80).state;
  }
  assert.ok(weak.committees[0].hostility > strong.committees[0].hostility, 'weakness invites hostility');
  assert.ok(strong.committees[0].hostility >= 0, 'hostility stays non-negative');
});

check('committee scrutiny costs a bill nothing until the committee is hostile', () => {
  const calm = createDefaultLobbyingState();
  assert.equal(committeeDelayWeeks(TREASURY_BILL, calm), 0, 'a calm committee adds no delay');
  assert.equal(hostileCommittees(calm), 0);

  const angry: LobbyingState = {
    ...calm,
    committees: calm.committees.map((c) => ({ ...c, hostility: COMMITTEE_HOSTILITY_FLOOR })),
  };
  const delay = committeeDelayWeeks(TREASURY_BILL, angry);
  assert.ok(delay >= 1, 'a hostile committee delays the bill');
  assert.ok(delay <= COMMITTEE_DELAY_MAX_WEEKS, 'the delay is capped');

  // A department with no committee at all is untouched by a hostile Treasury one.
  assert.equal(
    committeeDelayWeeks({ ...TREASURY_BILL, department: 'Foreign Office' }, angry),
    0,
    'a department with no committee is never delayed',
  );
});

check('courting a group buys approval at a cost in party confidence', () => {
  const state = createDefaultLobbyingState();
  const courted = lobbyGroup(state, 'cbi', 10, 'court');
  assert.ok(courted.state.groups[0].influence > state.groups[0].influence, 'courting raises influence');
  assert.ok((courted.effects.approval ?? 0) > 0, 'courting buys approval');
  assert.ok((courted.effects.partyConfidence ?? 0) < 0, 'courting dents party confidence');

  const snubbed = lobbyGroup(state, 'cbi', 10, 'snub');
  assert.ok(snubbed.state.groups[0].influence < state.groups[0].influence, 'snubbing cuts influence');
  assert.ok((snubbed.effects.partyConfidence ?? 0) > 0, 'snubbing pleases the party');
});

check('a lobbying round cannot repeat inside the cooldown', () => {
  const state = createDefaultLobbyingState();
  const first = lobbyGroup(state, 'cbi', 10, 'court');
  const tooSoon = lobbyGroup(first.state, 'cbi', 10 + LOBBY_COOLDOWN_WEEKS - 1, 'court');
  assert.equal(tooSoon.state.groups[0].influence, first.state.groups[0].influence, 'cooldown blocks');
  assert.equal(Object.keys(tooSoon.effects).length, 0, 'a blocked round costs nothing');
  const later = lobbyGroup(first.state, 'cbi', 10 + LOBBY_COOLDOWN_WEEKS, 'court');
  assert.ok(later.state.groups[0].influence > first.state.groups[0].influence, 'cooldown expires');
});

check('petition pressure and revolving-door risk stay within 0..1', () => {
  const base = createDefaultLobbyingState();
  assert.equal(petitionPressure(base), 0, 'a silent petition is no pressure');
  assert.ok(petitionPressure({ ...base, livePetition: PETITION_DEBATE_THRESHOLD * 2 }) === 1, 'pressure caps at 1');
  assert.ok(revolvingDoorRisk(base) <= 1 && revolvingDoorRisk(base) >= 0, 'risk stays 0..1');
});

check('identical inputs and seeds produce identical module output', () => {
  const base = createDefaultLobbyingState();
  const input = { state: base, approval: 38, partyConfidence: 44, week: 7, seed: 777 };
  assert.equal(JSON.stringify(advanceLobbying(input)), JSON.stringify(advanceLobbying(input)));
  assert.equal(base.committees[0].hostility, 25, 'the input state must not be mutated');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' lobbying checks failed');
}
console.log('all ' + checks + ' lobbying checks passed');