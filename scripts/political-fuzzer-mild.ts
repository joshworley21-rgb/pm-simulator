// @ts-ignore
const fs = require('fs');
import { createInitialState, reducer } from '../src/app/engine';

declare const process: { env: Record<string, string | undefined> };
import { BILL_POOL } from '../src/app/bills';
import { BILL_POOL_2 } from '../src/app/bills2';

/**
 * Milder companion to political-fuzzer.ts.
 *
 * The aggressive fuzzer commits a political blunder EVERY turn (propose a
 * reckless bill / sack a minister / answer PMQ), which floods the 1922 letter
 * count and ousts the PM in 100% of runs. This variant instead plays like a
 * cautious government: most turns are safe, with only an occasional own-goal.
 *
 * Per turn it draws one of four behaviours:
 *   DO_NOTHING   - let the clock run (default 35%)
 *   SAFE_ACTION  - resolve a Red Box dossier on its most unifying choice and
 *                  answer the tabled PMQ on its best option (default 30%)
 *   SAFE_BILL    - introduce the lowest-rebellion available bill on a FREE
 *                  VOTE, which adds zero mutiny letters (default 25%)
 *   BLUNDER      - the old behaviour: sack a minister, or force a random bill
 *                  through on a three-line whip (default 10%)
 *
 * Budgets are always delivered when due (housekeeping) so the run reflects the
 * passive-penalty change rather than unrelated fiscal neglect.
 *
 * The BLUNDER weight can be overridden for sensitivity testing, e.g.
 *   BLUNDER_WEIGHT=1 npx tsx scripts/political-fuzzer-mild.ts
 */

const NUM_SIMULATIONS = Number(process.env.SIMS ?? 10000);
const MAX_TURNS = 50;
const BLUNDER_WEIGHT = process.env.BLUNDER_WEIGHT !== undefined ? Number(process.env.BLUNDER_WEIGHT) : 0.10;
// Default 'bare' mirrors the aggressive fuzzer's starting position exactly
// (createInitialState only, letters threshold 15), so the only variable is the
// action mix. 'player' instead seeds a real majority PM so bills can actually
// pass (letters threshold rises to ~59). Override with SETUP=player.
const SETUP = process.env.SETUP ?? 'bare';

// Distribute the remaining behaviour budget proportionally as the blunder
// weight changes, so the mix always sums to 1.
const NON_BLUNDER = 1 - BLUNDER_WEIGHT;
const WEIGHTS = {
  DO_NOTHING: NonBlunderShare(0.35 / 0.9),
  SAFE_ACTION: NonBlunderShare(0.30 / 0.9),
  SAFE_BILL: NonBlunderShare(0.25 / 0.9),
  BLUNDER: BLUNDER_WEIGHT,
};
function NonBlunderShare(fraction: number): number {
  return NON_BLUNDER * fraction;
}

const ALL_BILLS = [...BILL_POOL, ...BILL_POOL_2];

function pick<T>(items: T[]): T | undefined {
  if (!items || items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function newGame() {
  let s = createInitialState();
  if (SETUP === 'bare') return s;
  s = reducer(s, { type: 'SET_TERM_LENGTH', weeks: 60 } as any);
  s = reducer(s, {
    type: 'CREATE_PLAYER',
    player: { firstName: 'Test', lastName: 'PM', partyId: 'reform', background: 'City financier' },
  } as any);
  return s;
}

function chooseBehaviour(): keyof typeof WEIGHTS {
  const r = Math.random();
  let acc = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    acc += WEIGHTS[key];
    if (r < acc) return key;
  }
  return 'DO_NOTHING';
}

/** Best (most unifying) option on a PMQ: highest approval + party-confidence gain. */
function bestPmqOption(state: any) {
  if (!state.pmq || !state.pmq.options || state.pmq.options.length === 0) return undefined;
  let best = state.pmq.options[0];
  let bestScore = -Infinity;
  for (const o of state.pmq.options) {
    const score = (o.effects?.approval ?? 0) + (o.effects?.partyConfidence ?? 0);
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

/** Best (most unifying) choice on a dossier, favouring approval/confidence gains. */
function bestDossierChoice(d: any) {
  if (!d || !d.choices || d.choices.length === 0) return undefined;
  let best = d.choices[0];
  let bestScore = -Infinity;
  for (const c of d.choices) {
    const score = (c.effects?.approval ?? 0) + (c.effects?.partyConfidence ?? 0);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

const failures: any[] = [];
const behaviourCounts: Record<string, number> = { DO_NOTHING: 0, SAFE_ACTION: 0, SAFE_BILL: 0, BLUNDER: 0 };
let survived = 0;
let lettersSum = 0;
let lettersMax = 0;
let oustTurnSum = 0;

for (let sim = 1; sim <= NUM_SIMULATIONS; sim++) {
  let state = newGame();
  let ousted = false;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    let next = state;

    // Housekeeping: deliver the budget whenever it is due.
    if (next.budgetDue) next = reducer(next, { type: 'DELIVER_BUDGET', packageId: 'budget-middle' } as any);

    const behaviour = chooseBehaviour();
    behaviourCounts[behaviour]++;

    if (behaviour === 'DO_NOTHING') {
      // no action this turn
    } else if (behaviour === 'SAFE_ACTION') {
      const d = next.redBox[0];
      if (d) {
        const choice = bestDossierChoice(d);
        if (choice) next = reducer(next, { type: 'RESOLVE_DOSSIER', dossierId: d.id, choiceId: choice.id } as any);
      }
      const opt = bestPmqOption(next);
      if (opt) next = reducer(next, { type: 'ANSWER_PMQ', optionId: opt.id } as any);
    } else if (behaviour === 'SAFE_BILL') {
      const available = ALL_BILLS
        .filter((b) => !next.bills.some((x: any) => x.id === b.id) && !next.passedLaws.includes(b.title))
        .sort((a, b) => a.rebellionRisk - b.rebellionRisk);
      const bill = available[0];
      if (bill) next = reducer(next, { type: 'PROPOSE_BILL', billId: bill.id, whipLevel: 'free-vote' } as any);
    } else if (behaviour === 'BLUNDER') {
      if (next.cabinet.length > 0 && Math.random() < 0.5) {
        const m = pick(next.cabinet);
        if (m) next = reducer(next, { type: 'SACK_MINISTER', name: m.name } as any);
      } else {
        const available = ALL_BILLS.filter(
          (b) => !next.bills.some((x: any) => x.id === b.id) && !next.passedLaws.includes(b.title),
        );
        const bill = pick(available);
        if (bill) next = reducer(next, { type: 'PROPOSE_BILL', billId: bill.id, whipLevel: 'three-line' } as any);
      }
    }

    // Advance the clock so the weekly political consequences calculate.
    next = reducer(next, { type: 'START_TURN' } as any);

    const lettersHitThreshold =
      next.stats.lettersOfNoConfidence >= next.stats.lettersThreshold;
    const confidenceBottomedOut = next.metrics.partyConfidence <= 0;

    if (lettersHitThreshold || confidenceBottomedOut) {
      ousted = true;
      failures.push({
        simId: sim,
        oustedOnTurn: turn,
        reason: lettersHitThreshold ? '1922 Committee Threshold Reached' : 'Party Confidence Hit 0',
        finalLetters: next.stats.lettersOfNoConfidence,
        threshold: next.stats.lettersThreshold,
        finalConfidence: next.metrics.partyConfidence,
      });
      break;
    }

    state = next;
  }

  if (!ousted) survived++;
  else oustTurnSum += failures[failures.length - 1].oustedOnTurn;
  const finalLetters = state.stats.lettersOfNoConfidence;
  lettersSum += finalLetters;
  if (finalLetters > lettersMax) lettersMax = finalLetters;
}

const output = {
  totalSimulations: NUM_SIMULATIONS,
  maxTurns: MAX_TURNS,
  setup: SETUP,
  weights: WEIGHTS,
  totalSurvived: survived,
  totalOustings: failures.length,
  survivalRate: `${((survived / NUM_SIMULATIONS) * 100).toFixed(2)}%`,
  oustingRate: `${((failures.length / NUM_SIMULATIONS) * 100).toFixed(2)}%`,
  averageFinalLetters: Number((lettersSum / NUM_SIMULATIONS).toFixed(2)),
  maxFinalLetters: lettersMax,
  averageOustingTurn: failures.length ? Number((oustTurnSum / failures.length).toFixed(1)) : null,
  lettersThreshold: newGame().stats.lettersThreshold,
  behaviourCounts,
  sampleFailures: failures.slice(0, 50),
};

fs.writeFileSync('political-fuzzer-mild-results.json', JSON.stringify(output, null, 2));
