/**
 * Commons division / chamber harness.
 * Covers public-opinion swing, result stamps, Budget confidence votes and the
 * three-line whip cost, plus the new budget-defeat trigger.
 */
import { createInitialState, reducer } from '../src/app/engine';
import { BILL_POOL } from '../src/app/bills';
import { BUDGET_PACKAGES } from '../src/app/budget';
import {
  divisionStamp,
  resolveBillVote,
  resolveBudgetVote,
} from '../src/app/parliamentaryVotes';
import type { Bill, GameState } from '../src/app/types';

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

function newGame(): GameState {
  return reducer(createInitialState(), {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Test',
      lastName: 'PM',
      partyId: 'reform',
      background: 'City financier',
    },
  });
}

const billVoteBase = {
  ownSeats: 300,
  partnerSeats: 0,
  totalSeats: 650,
  whipLevel: 'two-line' as const,
  rebellionRisk: 10,
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
};

check('public opinion swings votes toward a popular government', () => {
  const popular = resolveBillVote({ ...billVoteBase, publicApproval: 100 });
  const unpopular = resolveBillVote({ ...billVoteBase, publicApproval: 0 });
  assert.ok(popular.ayes > unpopular.ayes, 'popularity should add Ayes');
});

check('division stamps map passed, defeated and amended results', () => {
  assert.equal(divisionStamp(undefined), null);
  assert.equal(
    divisionStamp({ ayes: 1, noes: 0, rebels: 0, passed: true, castWeek: 1 }),
    'PASSED (ROYAL ASSENT)',
  );
  assert.equal(
    divisionStamp({ ayes: 0, noes: 1, rebels: 0, passed: false, castWeek: 1 }),
    'DEFEATED',
  );
  assert.equal(
    divisionStamp({
      ayes: 1,
      noes: 0,
      rebels: 0,
      passed: true,
      amended: true,
      castWeek: 1,
    }),
    'AMENDED',
  );
});

check('a major Budget passes with a majority and fails without one', () => {
  const majority = resolveBudgetVote({
    ownSeats: 360,
    partnerSeats: 0,
    totalSeats: 650,
    publicApproval: 50,
    partyConfidence: 60,
  });
  assert.equal(majority.passed, true);

  const minority = resolveBudgetVote({
    ownSeats: 280,
    partnerSeats: 0,
    totalSeats: 650,
    publicApproval: 50,
    partyConfidence: 60,
  });
  assert.equal(minority.passed, false);
});

check('losing a Budget sets the imminent no-confidence trigger', () => {
  let state = newGame();
  state = {
    ...state,
    parties: state.parties.map((party) => ({
      ...party,
      seats: party.id === state.player?.partyId ? 250 : 100,
    })),
    budgetDue: true,
    fiscalEventKind: 'budget',
    metrics: { ...state.metrics, approval: 20, partyConfidence: 25 },
  };

  const after = reducer(state, {
    type: 'DELIVER_BUDGET',
    packageId: BUDGET_PACKAGES[0].id,
  });

  assert.equal(after.budgetVoteDefeated, true);
  assert.equal(after.noConfidenceImminent, true);
  assert.ok(after.oppositionMotion, 'a no-confidence motion should be tabled');
  assert.equal(after.oppositionMotion?.scheduledWeek, state.week + 1);
  assert.ok(
    after.parliamentState?.votes.scheduled.some(
      (vote) => vote.kind === 'opposition-motion',
    ),
    'the imminent confidence division should be on the paper',
  );
});

check('a winning Budget does not trigger a confidence motion', () => {
  let state = newGame();
  state = {
    ...state,
    budgetDue: true,
    fiscalEventKind: 'budget',
    metrics: { ...state.metrics, approval: 60, partyConfidence: 65 },
  };
  const after = reducer(state, {
    type: 'DELIVER_BUDGET',
    packageId: BUDGET_PACKAGES[0].id,
  });
  assert.equal(after.budgetVoteDefeated, false);
  assert.equal(after.noConfidenceImminent, false);
  assert.ok(!after.oppositionMotion, 'a winning Budget must not table a motion');
});

check('a three-line whip costs backbench morale and cabinet loyalty', () => {
  const base = newGame();
  const bill: Bill = {
    ...BILL_POOL[0],
    id: 'three-line-cost-test',
    weeksToPass: 1,
    whipLevel: 'three-line',
    rebellionRisk: 0,
  };
  const threeLine = reducer(
    {
      ...base,
      bills: [bill],
      factionUnrest: 20,
      cabinet: base.cabinet.map((minister) => ({ ...minister, loyalty: 80 })),
    },
    { type: 'START_TURN' },
  );
  const twoLine = reducer(
    {
      ...base,
      bills: [{ ...bill, whipLevel: 'two-line' }],
      factionUnrest: 20,
      cabinet: base.cabinet.map((minister) => ({ ...minister, loyalty: 80 })),
    },
    { type: 'START_TURN' },
  );

  const averageLoyalty = (s: GameState) =>
    s.cabinet.reduce((sum, minister) => sum + minister.loyalty, 0) / s.cabinet.length;

  assert.ok(threeLine.factionUnrest > twoLine.factionUnrest, 'morale should fall');
  assert.ok(averageLoyalty(threeLine) < averageLoyalty(twoLine), 'loyalty should fall');
});

console.log('');
console.log(`commons division tests: ${checks - failures}/${checks} checks passed.`);
if (failures > 0) process.exit(1);
