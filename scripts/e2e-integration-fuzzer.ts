import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

interface TestResult {
  passed: boolean;
  error?: string;
  duration: number;
  testCase: unknown;
}

interface Summary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  failures: Array<{
    testCase: unknown;
    error: string;
  }>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERBOSE = process.env.VERBOSE === 'true';
const RESULTS_FILE = path.join(__dirname, '../e2e-results.json');

async function runSimulation(testCase: unknown): Promise<TestResult> {
  const startedAt = Date.now();

  try {
    const { createInitialState, reducer } = await import('../src/app/engine');
    const { BILL_POOL } = await import('../src/app/bills');
    const { BILL_POOL_2 } = await import('../src/app/bills2');

    // The generated test cases have numeric IDs. Derive both the engine seed
    // and action-selection seed from that ID so each run is reproducible.
    const index =
      typeof testCase === 'object' &&
      testCase !== null &&
      typeof (testCase as { id?: unknown }).id === 'number'
        ? (testCase as { id: number }).id
        : 0;
    let randomState = (Math.imul(index + 1, 1664525) + 1013904223) >>> 0;

    const random = (): number => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };

    let state = { ...createInitialState(), seed: randomState };

    const checkState = (): void => {
      const checkFinite = (value: unknown, location: string): void => {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          throw new Error(`Non-finite value at ${location}: ${String(value)}`);
        }
        if (Array.isArray(value)) {
          value.forEach((item, i) => checkFinite(item, `${location}[${i}]`));
        } else if (typeof value === 'object' && value !== null) {
          for (const [key, item] of Object.entries(value)) {
            checkFinite(item, `${location}.${key}`);
          }
        }
      };

      const checkRange = (
        label: string,
        value: number,
        min: number,
        max: number,
      ): void => {
        if (value < min || value > max) {
          throw new Error(
            `Out-of-range ${label}: ${value}; expected ${min}..${max}`,
          );
        }
      };

      checkFinite(state, 'state');

      for (const [key, value] of Object.entries(state.metrics)) {
        checkRange(`metrics.${key}`, value, 0, 100);
      }

      const statRanges: Record<string, [number, number]> = {
        cpiInflation: [0.1, 1000],
        gdpGrowth: [-100, 100],
        giltYield: [1, 50],
        nhsWaitingList: [2, Number.MAX_VALUE],
        netMigration: [50, Number.MAX_VALUE],
        lettersOfNoConfidence: [0, 99],
        lettersThreshold: [1, 99],
        taxRate: [15, 60],
        debtToGdp: [30, 1000],
        unemployment: [1.5, Number.MAX_VALUE],
      };

      for (const [key, [min, max]] of Object.entries(statRanges)) {
        checkRange(`stats.${key}`, state.stats[key as keyof typeof state.stats], min, max);
      }

      const partyIds = new Set<string>();
      for (const party of state.parties) {
        if (partyIds.has(party.id)) {
          throw new Error(`Duplicate party ID: ${party.id}`);
        }
        partyIds.add(party.id);
        checkRange(`party ${party.id} seats`, party.seats, 0, Number.MAX_SAFE_INTEGER);
        if (!Number.isInteger(party.seats)) {
          throw new Error(`Non-integer seat count for ${party.id}: ${party.seats}`);
        }
        checkRange(`party ${party.id} currentSupport`, party.currentSupport, 1, 60);
        if (party.funds < 0) {
          throw new Error(`Negative funds for party ${party.id}: ${party.funds}`);
        }
      }

      if (state.player && !partyIds.has(state.player.partyId)) {
        throw new Error(`Player party is absent from state.parties: ${state.player.partyId}`);
      }
      if (state.supplyPartnerId && !partyIds.has(state.supplyPartnerId)) {
        throw new Error(`Supply partner is absent from state.parties: ${state.supplyPartnerId}`);
      }

      for (const minister of state.cabinet) {
        checkRange(`minister ${minister.name} loyalty`, minister.loyalty, 0, 100);
        checkRange(`minister ${minister.name} competence`, minister.competence, 0, 100);
      }

      for (const department of state.departments) {
        checkRange(
          `department ${department.id} budget`,
          department.budget,
          department.min,
          department.max,
        );
      }

      const billIds = new Set<string>();
      for (const bill of state.bills) {
        if (billIds.has(bill.id)) {
          throw new Error(`Duplicate active bill ID: ${bill.id}`);
        }
        billIds.add(bill.id);
        if (state.passedLaws.includes(bill.title)) {
          throw new Error(`Bill is both active and passed: ${bill.title}`);
        }
      }

      if (state.pmq) {
        if (state.pmq.options.length === 0) {
          throw new Error(`PMQ ${state.pmq.id} has no answer options`);
        }
        const round = state.pmq.round;
        const total = state.pmq.total;
        if (
          typeof round === 'number' &&
          typeof total === 'number' &&
          (round < 1 || round > total)
        ) {
          throw new Error(`Invalid PMQ round: ${round} of ${total}`);
        }
      }
    };

    checkState();

    const allBills = [...BILL_POOL, ...BILL_POOL_2];
    const whipLevels = ['three-line', 'two-line', 'free-vote'] as const;

    // Drive the same real reducer actions and turn advancement used by the
    // reference fuzzer. Each choice uses this test case's seeded PRNG.
    for (let turn = 0; turn < 50 && !state.gameOver; turn++) {
      const actions: any[] = [];

      const availableBills = allBills.filter(
        (bill) =>
          !state.bills.some((active) => active.id === bill.id) &&
          !state.passedLaws.includes(bill.title),
      );
      if (availableBills.length > 0) {
        const bill = availableBills[Math.floor(random() * availableBills.length)];
        actions.push({
          type: 'PROPOSE_BILL',
          billId: bill.id,
          whipLevel: whipLevels[Math.floor(random() * whipLevels.length)],
        });
      }

      if (state.cabinet.length > 0) {
        const minister = state.cabinet[Math.floor(random() * state.cabinet.length)];
        actions.push({ type: 'SACK_MINISTER', name: minister.name });
      }

      if (state.pmq && state.pmq.options.length > 0) {
        const option = state.pmq.options[Math.floor(random() * state.pmq.options.length)];
        actions.push({ type: 'ANSWER_PMQ', optionId: option.id });
      }

      if (actions.length > 0) {
        const action = actions[Math.floor(random() * actions.length)];
        state = reducer(state, action);
        checkState();
      }

      state = reducer(state, { type: 'START_TURN' } as any);
      checkState();
    }

    return {
      passed: true,
      duration: Date.now() - startedAt,
      testCase,
    };
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? `${error.message}${error.stack ? `\nStack Trace:\n${error.stack}` : ''}`
        : `Error: ${String(error)}`;

    return {
      passed: false,
      error: errorDetails,
      duration: Date.now() - startedAt,
      testCase,
    };
  }
}

async function main() {
  const testCases = generateTestCases();
  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const testCase of testCases) {
    try {
      const result = await runSimulation(testCase);
      results.push(result);

      if (VERBOSE) {
        console.log(`Test ${result.passed ? 'PASSED' : 'FAILED'} in ${result.duration.toFixed(2)}ms`);
      }
    } catch (error) {
      const errorDetails = error instanceof Error ? 
        `${error.message}\nStack Trace:\n${error.stack}` : 
        `Error: ${String(error)}`;
      
      const failedResult: TestResult = {
        passed: false,
        error: errorDetails,
        duration: 0,
        testCase
      };
      results.push(failedResult);

      if (VERBOSE) {
        console.error(`Test FAILED with error: ${failedResult.error}`);
      }
    }
  }

  const duration = Date.now() - startTime;
  const summary = buildSummary(results, duration);

  // Always print final summary
  console.log('\n=== E2E Test Summary ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Duration: ${summary.duration}ms`);

  // Always save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nResults saved to ${RESULTS_FILE}`);
}

function generateTestCases(): unknown[] {
  const maxRuns = parseInt(process.env.MAX_RUNS || '1000');
  return Array(maxRuns).fill(null).map((_, i) => ({ id: i }));
}

function buildSummary(results: TestResult[], duration: number): Summary {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const failures = results
    .filter(r => !r.passed)
    .map(r => ({
      testCase: r.testCase,
      error: r.error || 'No error details captured'
    }));

  return {
    total: results.length,
    passed,
    failed,
    duration,
    failures
  };
}

main().catch(error => {
  console.error('Fatal error in E2E runner:', error);
  process.exit(1);
});
