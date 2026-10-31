// @ts-ignore
const fs = require('fs');
import { createInitialState, reducer } from '../src/app/engine';
import { BILL_POOL } from '../src/app/bills';
import { BILL_POOL_2 } from '../src/app/bills2';
import type { WhipLevel } from '../src/app/types';

const NUM_SIMULATIONS = 10000;
const MAX_TURNS = 50; // We give it 50 turns to see how long a bad PM can survive
const failures: any[] = [];

const ALL_BILLS = [...BILL_POOL, ...BILL_POOL_2];
const WHIP_LEVELS: WhipLevel[] = ['three-line', 'two-line', 'free-vote'];

function pick<T>(items: T[]): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

for (let sim = 1; sim <= NUM_SIMULATIONS; sim++) {
  let state = createInitialState();
  const playHistory: any[] = [];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // Build a menu of *valid* political blunders for this turn. Each action must
    // use the exact payload keys the engine's reducer expects:
    //   PROPOSE_BILL  -> { billId, whipLevel? }  (engine case 'PROPOSE_BILL')
    //   SACK_MINISTER -> { name }                (engine case 'SACK_MINISTER')
    //   ANSWER_PMQ    -> { optionId }            (engine case 'ANSWER_PMQ')
    const blunders: any[] = [];

    // PROPOSE_BILL: choose a real bill that hasn't been introduced or passed yet.
    const availableBills = ALL_BILLS.filter(
      (b) =>
        !state.bills.some((bill) => bill.id === b.id) &&
        !state.passedLaws.includes(b.title),
    );
    const bill = pick(availableBills);
    if (bill) {
      blunders.push({
        type: 'PROPOSE_BILL',
        billId: bill.id,
        whipLevel: pick(WHIP_LEVELS),
      });
    }

    // SACK_MINISTER: name a minister who is actually sitting in the Cabinet.
    const minister = pick(state.cabinet);
    if (minister) {
      blunders.push({ type: 'SACK_MINISTER', name: minister.name });
    }

    // ANSWER_PMQ: pick one of the live options on the question currently tabled.
    const pmqOption = state.pmq ? pick(state.pmq.options) : undefined;
    if (pmqOption) {
      blunders.push({ type: 'ANSWER_PMQ', optionId: pmqOption.id });
    }

    // Pick a random valid blunder. If the PM has nothing legal to do this turn
    // (no fresh bills, empty cabinet, no question tabled) we simply let the
    // clock run rather than firing an invalid action at the reducer.
    const randomAction = pick(blunders);

    // 1. Commit the blunder (when one is available).
    let nextState = randomAction ? reducer(state, randomAction as any) : state;

    // 2. Advance the time so political consequences calculate.
    nextState = reducer(nextState, { type: 'START_TURN' } as any);

    playHistory.push({
      turn,
      action: randomAction ? randomAction.type : 'NONE',
      letters: nextState.stats?.lettersOfNoConfidence || 0,
      confidence: nextState.metrics?.partyConfidence || 0,
    });

    // 3. Check for leadership collapse.
    const lettersHitThreshold =
      nextState.stats.lettersOfNoConfidence >= nextState.stats.lettersThreshold;
    const confidenceBottomedOut = nextState.metrics.partyConfidence <= 0;

    if (lettersHitThreshold || confidenceBottomedOut) {
      failures.push({
        simId: sim,
        oustedOnTurn: turn,
        reason: lettersHitThreshold
          ? '1922 Committee Threshold Reached'
          : 'Party Confidence Hit 0',
        finalLetters: nextState.stats.lettersOfNoConfidence,
        threshold: nextState.stats.lettersThreshold,
        finalConfidence: nextState.metrics.partyConfidence,
      });
      break;
    }

    state = nextState;
  }
}

const output = {
  totalSimulations: NUM_SIMULATIONS,
  totalOustings: failures.length,
  oustingRate: `${((failures.length / NUM_SIMULATIONS) * 100).toFixed(2)}%`,
  sampleFailures: failures.slice(0, 50),
};

fs.writeFileSync('political-fuzzer-results.json', JSON.stringify(output, null, 2));
