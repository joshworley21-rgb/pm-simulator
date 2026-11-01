/**
 * Parliament-as-process harness: session clock, stages, Lords delay, assent, wash-up.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import type { Bill } from '../src/app/types';
import {
  advanceBillStage,
  advanceParliament,
  createDefaultParliamentState,
  grantRoyalAssent,
  invokeParliamentAct,
  isWashUp,
  lordsDelayRisk,
  sessionWeekFor,
  startBill,
  washUpBills,
  PARLIAMENT_ACT_LIMIT_PER_TERM,
  PARLIAMENT_ACT_PRESSURE,
  PARLIAMENTARY_STAGES,
  TURNS_PER_SESSION,
  WASH_UP_WEEKS,
  type ParliamentState,
} from '../src/app/parliament';

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

const TEST_BILL: Bill = {
  id: 'bill-test',
  title: 'Test Bill',
  department: 'Number 10',
  description: 'A bill for testing.',
  fiscalCost: 0,
  weeksToPass: 1,
  rebellionRisk: 10,
  effects: {},
  kicker: 'TEST',
};

function tick(state: ParliamentState, week: number) {
  return advanceParliament({ state, week, seed: 4242 });
}

check('parliament defaults are inert', () => {
  const s = createDefaultParliamentState();
  assert.equal(s.sessionWeek, 1);
  assert.equal(s.inProgress.length, 0);
  assert.equal(s.parliamentActUses, 0);
  assert.equal(s.washedUp, 0);
  assert.equal(s.assents, 0);
});

check('INERT INVARIANT: the weekly tick never returns effects', () => {
  // Sweep the whole session, plus a wash-up rollover, asserting effects stay empty.
  let state = createDefaultParliamentState();
  state = startBill(state, TEST_BILL);
  for (let week = 1; week <= 2 * TURNS_PER_SESSION; week += 1) {
    const result = tick(state, week);
    assert.equal(Object.keys(result.effects).length, 0, 'weekly tick must never yield effects');
    state = result.state;
  }
  assert.equal(state.parliamentActUses, 0, 'no act is invoked by bookkeeping');
});

check('the session clock rolls within 1..TURNS_PER_SESSION', () => {
  assert.equal(sessionWeekFor(1), 1);
  assert.equal(sessionWeekFor(TURNS_PER_SESSION), TURNS_PER_SESSION);
  assert.equal(sessionWeekFor(TURNS_PER_SESSION + 1), 1, 'a new session restarts the clock');
  assert.equal(sessionWeekFor(TURNS_PER_SESSION + 5), 5);
});

check('wash-up is the tail of a session', () => {
  assert.equal(isWashUp(1), false);
  assert.equal(isWashUp(TURNS_PER_SESSION - WASH_UP_WEEKS), false);
  assert.equal(isWashUp(TURNS_PER_SESSION - WASH_UP_WEEKS + 1), true);
  assert.equal(isWashUp(TURNS_PER_SESSION), true);
});

check('a bill climbs the stages in order', () => {
  let state = startBill(createDefaultParliamentState(), TEST_BILL);
  assert.equal(state.inProgress[0].stage, 'commons-committee');
  const seen: string[] = [state.inProgress[0].stage];
  for (let i = 0; i < PARLIAMENTARY_STAGES.length - 1; i += 1) {
    state = advanceBillStage(state, TEST_BILL.id);
    seen.push(state.inProgress[0].stage);
  }
  assert.equal(seen.join('>'), PARLIAMENTARY_STAGES.join('>'));
  // Advancing past the end must not run off the end of the ladder.
  state = advanceBillStage(state, TEST_BILL.id);
  assert.equal(state.inProgress[0].stage, 'royal-assent');
});

check('Lords amendments raise the delay risk', () => {
  let state = startBill(createDefaultParliamentState(), TEST_BILL);
  const clean = lordsDelayRisk(state.inProgress[0]);
  state = advanceBillStage(state, TEST_BILL.id, { lordsAmend: true });
  state = advanceBillStage(state, TEST_BILL.id, { lordsAmend: true });
  const amended = lordsDelayRisk(state.inProgress[0]);
  assert.ok(amended > clean, 'amendments must increase risk');
  assert.ok(amended <= 1, 'risk stays within 0..1');
});

check('the Parliament Act is strictly limited per term and costs confidence', () => {
  let state = startBill(createDefaultParliamentState(), TEST_BILL);
  state = advanceBillStage(state, TEST_BILL.id);
  const first = invokeParliamentAct(state, TEST_BILL.id);
  assert.equal(first.state.parliamentActUses, 1, 'the first invocation lands');
  assert.equal(first.effects.partyConfidence, -PARLIAMENT_ACT_PRESSURE, 'forcing costs confidence');
  assert.equal(first.state.inProgress[0].stage, 'royal-assent', 'the bill is forced to assent');

  const second = invokeParliamentAct(first.state, TEST_BILL.id);
  assert.equal(second.state.parliamentActUses, PARLIAMENT_ACT_LIMIT_PER_TERM, 'the limit holds');
  assert.equal(Object.keys(second.effects).length, 0, 'a refused invocation is free');
});

check('royal assent only lands at the assent stage, and clears the bill', () => {
  let state = startBill(createDefaultParliamentState(), TEST_BILL);
  const tooEarly = grantRoyalAssent(state, TEST_BILL.id);
  assert.equal(tooEarly.assents, 0, 'assent cannot be granted early');

  for (let i = 0; i < PARLIAMENTARY_STAGES.length - 1; i += 1) {
    state = advanceBillStage(state, TEST_BILL.id);
  }
  const granted = grantRoyalAssent(state, TEST_BILL.id);
  assert.equal(granted.assents, 1, 'assent is recorded');
  assert.equal(granted.inProgress.length, 0, 'the bill leaves the pipeline');
});

check('wash-up sweeps unfinished business', () => {
  let state = startBill(createDefaultParliamentState(), TEST_BILL);
  state = washUpBills(state);
  assert.equal(state.inProgress.length, 0, 'nothing survives wash-up');
  assert.equal(state.washedUp, 1, 'the fall is counted');
});

check('a session rollover washes up automatically, and logs it', () => {
  let state = startBill(createDefaultParliamentState(), TEST_BILL);
  // Sit in the last week of a session, then advance into the next.
  state = tick(state, TURNS_PER_SESSION).state;
  const rolled = tick(state, TURNS_PER_SESSION + 1);
  assert.equal(rolled.state.inProgress.length, 0, 'the session end clears the pipeline');
  assert.equal(rolled.state.washedUp, 1, 'and counts the loss');
});

check('identical inputs produce identical output and never mutate the bill', () => {
  const base = createDefaultParliamentState();
  const a = startBill(base, TEST_BILL);
  const b = startBill(base, TEST_BILL);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(base.inProgress.length, 0, 'the input state must not be mutated');
  assert.equal(TEST_BILL.id, 'bill-test', 'the input bill must not be mutated');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' parliament checks failed');
}
console.log('all ' + checks + ' parliament checks passed');