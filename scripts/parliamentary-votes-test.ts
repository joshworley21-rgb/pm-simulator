/**
 * Parliamentary vote state machine harness.
 * Covers scheduling, rescheduling, cancellation, recording and the two pure
 * vote calculators. Engine round-trips are checked through the real reducer.
 */
import { createInitialState, migrateState, reducer, advanceWeek } from '../src/app/engine';
import { BILL_POOL } from '../src/app/bills';
import {
  billVote,
  billVoteId,
  cancelVote,
  cancelVotesForSubject,
  createDefaultVoteState,
  pendingVotes,
  recordVoteResult,
  rescheduleVote,
  resolveBillVote,
  resolveConfidenceVote,
  scheduleVote,
} from '../src/app/parliamentaryVotes';
import type { ParliamentaryVote } from '../src/app/parliamentaryVotes';

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

const testBill = { ...BILL_POOL[0], weeksToPass: 3 };
const scheduled = billVote(testBill, 7);
const resultVote: ParliamentaryVote = {
  ...scheduled,
  result: { ayes: 330, noes: 320, rebels: 4, passed: true, castWeek: 7 },
};

check('a vote can be scheduled, rescheduled and prioritised', () => {
  let state = createDefaultVoteState();
  state = scheduleVote(state, scheduled);
  state = scheduleVote(state, { ...scheduled, id: 'motion:test:8', scheduledWeek: 8, kind: 'opposition-motion' });
  assert.equal(pendingVotes(state).length, 2);
  assert.equal(pendingVotes(state)[0].id, scheduled.id, 'earliest vote first');

  state = rescheduleVote(state, scheduled.id, 9);
  assert.equal(pendingVotes(state)[0].id, 'motion:test:8', 'rescheduled vote moves back');
});

check('a resolved vote leaves the queue and enters history', () => {
  let state = scheduleVote(createDefaultVoteState(), scheduled);
  state = recordVoteResult(state, resultVote);
  assert.equal(pendingVotes(state).length, 0);
  assert.equal(state.recent.length, 1);
  assert.equal(state.recent[0].status, 'passed');
});

check('cancellation handles one vote and all votes for a subject', () => {
  let state = scheduleVote(createDefaultVoteState(), scheduled);
  state = cancelVote(state, scheduled.id);
  assert.equal(pendingVotes(state).length, 0);
  assert.equal(state.recent[0].status, 'cancelled');

  const two = scheduleVote(
    scheduleVote(createDefaultVoteState(), scheduled),
    { ...scheduled, id: 'bill:second' },
  );
  const cleared = cancelVotesForSubject(two, testBill.id);
  assert.equal(pendingVotes(cleared).length, 0, 'all bill votes cancelled');
});

check('a government bill vote records ayes, noes and the pass/fail result', () => {
  const passed = resolveBillVote({
    ownSeats: 400,
    partnerSeats: 0,
    totalSeats: 650,
    whipLevel: 'two-line',
    rebellionRisk: 0,
    whipRebellionDelta: 0,
    voteSwing: 0,
    cabinetCohesion: 65,
    rebelPressure: 10,
    whipStrength: 75,
    coalitionRebelLoss: 0,
    hasPartner: false,
    committeeHeat: false,
    currentLetters: 5,
    billLettersDelta: 0,
    resentmentDelta: 0,
    rng: () => 0.5,
  });
  assert.equal(passed.passed, true);
  assert.equal(passed.lettersOfNoConfidence, 4, 'a passed bill removes one letter');

  const failed = resolveBillVote({
    ownSeats: 200,
    partnerSeats: 0,
    totalSeats: 650,
    whipLevel: 'two-line',
    rebellionRisk: 0,
    whipRebellionDelta: 0,
    voteSwing: 0,
    cabinetCohesion: 65,
    rebelPressure: 10,
    whipStrength: 75,
    coalitionRebelLoss: 0,
    hasPartner: false,
    committeeHeat: false,
    currentLetters: 5,
    billLettersDelta: 0,
    resentmentDelta: 0,
    rng: () => 0.5,
  });
  assert.equal(failed.passed, false);
  assert.ok(failed.ayes < failed.noes);
  assert.ok(failed.lettersOfNoConfidence >= 5, 'a defeat does not grant letter relief');
});

check('a confidence motion has an explicit government and opposition tally', () => {
  const lost = resolveConfidenceVote({
    ownSeats: 300,
    partnerSeats: 20,
    totalSeats: 650,
    partyConfidence: 30,
  });
  assert.equal(lost.govVotes, 290);
  assert.equal(lost.oppVotes, 360);
  assert.equal(lost.passed, false);
  assert.equal(lost.defections, 30);
});

check('older saves without a vote queue migrate to an empty vote state', () => {
  const base = createInitialState();
  const { votes, ...legacyParliament } = base.parliamentState!;
  void votes;
  const migrated = migrateState({ ...base, parliamentState: legacyParliament as never });
  assert.ok(!!migrated.parliamentState?.votes, 'migrated parliament state should have votes');
  assert.equal(migrated.parliamentState!.votes.scheduled.length, 0);
  assert.equal(migrated.parliamentState!.votes.recent.length, 0);
});

check('the engine schedules a vote when a bill is introduced', () => {
  const base = reducer(createInitialState(), {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Test',
      lastName: 'PM',
      partyId: 'reform',
      background: 'Former broadcast journalist',
    },
  });
  const proposed = reducer(base, { type: 'PROPOSE_BILL', billId: BILL_POOL[0].id });
  const pipeline = proposed.parliamentState!;
  assert.ok(
    pipeline.votes.scheduled.some((vote) => vote.id === billVoteId(BILL_POOL[0].id)),
    'bill vote was not scheduled',
  );
});

check('the engine records the result when the division is called', () => {
  const base = reducer(createInitialState(), {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Test',
      lastName: 'PM',
      partyId: 'reform',
      background: 'Former broadcast journalist',
    },
  });
  const proposed = reducer(base, { type: 'PROPOSE_BILL', billId: BILL_POOL[0].id });
  const bill = proposed.bills.find((b) => b.id === BILL_POOL[0].id)!;
  const resolved = advanceWeek({ ...proposed, week: 10, bills: [{ ...bill, weeksToPass: 1 }] });
  const votes = resolved.parliamentState!.votes;
  assert.equal(pendingVotes(votes).length, 0, 'the scheduled vote should leave the queue');
  assert.ok(votes.recent.length > 0, 'the result should be recorded');
  assert.ok(typeof votes.recent[0].result?.ayes === 'number', 'ayes recorded');
  assert.ok(typeof votes.recent[0].result?.noes === 'number', 'noes recorded');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' parliamentary-vote checks failed');
}
console.log('all ' + checks + ' parliamentary-vote checks passed');
