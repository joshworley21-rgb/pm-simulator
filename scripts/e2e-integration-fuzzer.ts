import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { Effects } from '../src/app/types';
import {
  TURNS_PER_HALF_YEAR,
  TURNS_PER_MONTH,
  TURNS_PER_QUARTER,
  TURNS_PER_YEAR,
} from '../src/app/calendar';

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

interface SeededTestCase {
  id: number;
  seed: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERBOSE = process.env.VERBOSE === 'true';
const RESULTS_FILE = path.join(__dirname, '../e2e-results.json');

const DEFAULT_MAX_RUNS = 2000;
const DEFAULT_SEED = 20260211;

function envInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in ${min}..${max}; received "${raw}"`);
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function expectedMetricAfterEffects(
  metric: number,
  effect: number | undefined,
  metricName: string,
): number {
  const delta = effect ?? 0;
  const adjustedDelta =
    metricName === 'approval' && delta > 0
      ? delta * (1 - metric / 110)
      : delta;
  return clamp(metric + adjustedDelta, 0, 100);
}

function assertPmqTransition(before: any, after: any): void {
  const question = before.pmq;
  if (!question) {
    throw new Error('ANSWER_PMQ dispatched without an active question');
  }

  const expectedLog = `PMQS: Answered a question from ${question.from}.`;
  if (!after.log.includes(expectedLog)) {
    throw new Error(`ANSWER_PMQ did not add the expected log entry: ${expectedLog}`);
  }

  const nextRound = (question.round ?? 1) + 1;
  const total = question.total ?? 8;
  if (nextRound > total) {
    if (after.pmq !== null) {
      throw new Error('Completed PMQ session should clear the active question');
    }
  } else if (!after.pmq || after.pmq.round !== nextRound) {
    throw new Error(
      `ANSWER_PMQ did not advance the question round: expected ${nextRound}, got ${after.pmq?.round}`,
    );
  }
}

function assertPmqEffects(
  before: any,
  after: any,
  effects: Effects,
): void {
  const metricNames = [
    'approval',
    'partyConfidence',
    'economy',
    'publicServices',
    'security',
    'mediaAttention',
  ] as const;

  for (const metricName of metricNames) {
    const expected = expectedMetricAfterEffects(
      before.metrics[metricName],
      effects[metricName],
      metricName,
    );
    if (after.metrics[metricName] !== expected) {
      throw new Error(
        `PMQ ${metricName} effect mismatch: expected ${expected}, got ${after.metrics[metricName]}`,
      );
    }
  }
}

function assertSackMinisterTransition(before: any, after: any, name: string): void {
  const minister = before.cabinet.find((candidate: any) => candidate.name === name);
  if (!minister) {
    throw new Error(`SACK_MINISTER dispatched for missing minister: ${name}`);
  }

  if (after.cabinet.some((candidate: any) => candidate.name === name)) {
    throw new Error(`SACK_MINISTER did not remove ${name} from the cabinet`);
  }
  if (after.cabinet.length !== before.cabinet.length - 1) {
    throw new Error(
      `SACK_MINISTER should remove exactly one minister: expected ${before.cabinet.length - 1}, got ${after.cabinet.length}`,
    );
  }

  const expectedUnrest = clamp(before.factionUnrest + 8, 0, 100);
  if (after.factionUnrest !== expectedUnrest) {
    throw new Error(
      `SACK_MINISTER factionUnrest mismatch: expected ${expectedUnrest}, got ${after.factionUnrest}`,
    );
  }

  const coalitionCollapse =
    minister.coalition === true && Boolean(before.supplyPartnerId);
  const expectedConfidence = coalitionCollapse
    ? clamp(before.metrics.partyConfidence - 6, 0, 100)
    : before.metrics.partyConfidence;

  if (after.metrics.partyConfidence !== expectedConfidence) {
    throw new Error(
      `SACK_MINISTER partyConfidence mismatch: expected ${expectedConfidence}, got ${after.metrics.partyConfidence}`,
    );
  }

  if (coalitionCollapse && after.supplyPartnerId !== undefined) {
    throw new Error('Sacking a coalition minister should end the supply arrangement');
  }
}

function assertBillProposal(
  before: any,
  after: any,
  billBlueprint: any,
  whipLevel: string,
): void {
  const proposed = after.bills.find((bill: any) => bill.id === billBlueprint.id);
  if (!proposed) {
    throw new Error(`PROPOSE_BILL did not add ${billBlueprint.id} to active bills`);
  }
  if (proposed.whipLevel !== whipLevel) {
    throw new Error(
      `PROPOSE_BILL whip mismatch for ${billBlueprint.id}: expected ${whipLevel}, got ${proposed.whipLevel}`,
    );
  }
  if (proposed.weeksToPass !== billBlueprint.weeksToPass) {
    throw new Error(
      `PROPOSE_BILL timing mismatch for ${billBlueprint.id}: expected ${billBlueprint.weeksToPass}, got ${proposed.weeksToPass}`,
    );
  }
  if (after.passedLaws.includes(billBlueprint.title)) {
    throw new Error(`Newly proposed bill was already recorded as passed: ${billBlueprint.title}`);
  }

  // Introducing a bill queues a division; it does not immediately apply its
  // effects or alter the cabinet, departments, or headline fiscal settings.
  if (after.departments !== before.departments) {
    throw new Error('PROPOSE_BILL unexpectedly replaced department allocations');
  }
}

function assertBillResolution(before: any, after: any): void {
  const dueBills = before.bills.filter((bill: any) => bill.weeksToPass <= 1);
  for (const bill of dueBills) {
    const passedMessage = `LAW PASSED: ${bill.title}`;
    const defeatedMessage = `BILL DEFEATED: ${bill.title}`;
    const passed = after.log.some((line: string) => line.startsWith(passedMessage));
    const defeated = after.log.some((line: string) => line.startsWith(defeatedMessage));

    if (passed === defeated) {
      throw new Error(
        `Due bill ${bill.title} should have exactly one recorded resolution outcome`,
      );
    }

    if (after.bills.some((active: any) => active.id === bill.id)) {
      throw new Error(`Resolved bill ${bill.title} remained active`);
    }

    if (passed && !after.passedLaws.includes(bill.title)) {
      throw new Error(`Passed bill ${bill.title} was not added to passedLaws`);
    }

    if (defeated && after.passedLaws.includes(bill.title)) {
      throw new Error(`Defeated bill ${bill.title} was incorrectly added to passedLaws`);
    }
  }
}

function assertFiscalActionGuards(
  createInitialState: () => any,
  reducer: (state: any, action: any) => any,
  getDefaultCustomPlan: (state: any) => any,
): void {
  const outsidePurdah = {
    ...createInitialState(),
    phase: 'playing',
    turnsUntilElection: TURNS_PER_YEAR,
    budgetDue: false,
    fiscalEventKind: null,
  };

  const cases = [
    {
      name: 'DELIVER_BUDGET',
      makeAction: () => ({ type: 'DELIVER_BUDGET', packageId: 'budget-restraint' }),
    },
    {
      name: 'DELIVER_CUSTOM_BUDGET',
      makeAction: (state: any) => ({
        type: 'DELIVER_CUSTOM_BUDGET',
        plan: getDefaultCustomPlan(state),
      }),
    },
    {
      name: 'SKIP_BUDGET',
      makeAction: () => ({ type: 'SKIP_BUDGET' }),
    },
    {
      name: 'SET_AUTUMN_TAXES',
      makeAction: () => ({ type: 'SET_AUTUMN_TAXES' }),
    },
  ];

  for (const fiscalAction of cases) {
    const offCycleAction = fiscalAction.makeAction(outsidePurdah);
    if (reducer(outsidePurdah, offCycleAction) !== outsidePurdah) {
      throw new Error(`${fiscalAction.name} changed state outside a fiscal window`);
    }

    const openWindow = {
      ...outsidePurdah,
      budgetDue: true,
      fiscalEventKind: 'budget',
    };
    const action = fiscalAction.makeAction(openWindow);
    const delivered = reducer(openWindow, action);
    if (delivered.budgetDue !== false || delivered.fiscalEventKind !== null) {
      throw new Error(`${fiscalAction.name} did not consume the open fiscal window`);
    }

    if (reducer(delivered, action) !== delivered) {
      throw new Error(`${fiscalAction.name} changed state after its fiscal window was consumed`);
    }
  }
}

function assertFiscalMilestones(
  createInitialState: () => any,
  reducer: (state: any, action: any) => any,
): void {
  const initial = createInitialState();
  const governingPartyId = initial.parties[0]?.id;
  if (!governingPartyId) throw new Error('Cannot test fiscal milestones without a governing party');

  let state = {
    ...initial,
    phase: 'playing',
    player: {
      firstName: 'Test',
      lastName: 'Prime Minister',
      partyId: governingPartyId,
      background: 'business',
    },
    parties: initial.parties.map((party: any, index: number) => ({
      ...party,
      seats: index === 0 ? 650 : 0,
    })),
    turnsUntilElection: 1000,
    termLength: 1000,
    stats: {
      ...initial.stats,
      lettersOfNoConfidence: 0,
      lettersThreshold: 99,
    },
    cabinet: [],
    backbenchers: [],
    regionSeats: {},
    thresholdsFrozen: true,
    thresholdFrozenTurns: 0,
    gameOver: null,
  };

  const budgetWeeks: number[] = [];
  const autumnWeeks: number[] = [];
  const quarterWeeks: number[] = [];
  let dragReports = 0;

  for (let turn = 0; turn < TURNS_PER_YEAR * 2; turn++) {
    const previousDragReports = dragReports;
    state = reducer(state, { type: 'START_TURN' });

    if (state.week % TURNS_PER_QUARTER === 0) quarterWeeks.push(state.week);

    if (state.fiscalEventKind === 'budget' && state.week % TURNS_PER_YEAR === 0) {
      budgetWeeks.push(state.week);
      if (!state.budgetDue) throw new Error(`Annual Budget window did not open at week ${state.week}`);
    }
    if (state.fiscalEventKind === 'autumn' && state.week % TURNS_PER_HALF_YEAR === 0) {
      autumnWeeks.push(state.week);
      if (!state.budgetDue) throw new Error(`Autumn Statement window did not open at week ${state.week}`);
    }

    dragReports = state.log.filter((line: string) =>
      line.startsWith('FISCAL DRAG: six months'),
    ).length;
    const expectedNewDragReport = (turn + 1) % TURNS_PER_HALF_YEAR === 0 ? 1 : 0;
    if (dragReports - previousDragReports !== expectedNewDragReport) {
      throw new Error(
        `Fiscal-drag report cadence mismatch at turn ${turn + 1}: expected ${expectedNewDragReport} new report(s)`,
      );
    }
  }

  const expectedBudgetWeeks = [TURNS_PER_YEAR, TURNS_PER_YEAR * 2];
  const expectedAutumnWeeks = [TURNS_PER_HALF_YEAR, TURNS_PER_HALF_YEAR * 3];
  if (JSON.stringify(budgetWeeks) !== JSON.stringify(expectedBudgetWeeks)) {
    throw new Error(
      `Annual Budget events should occur once per 52 weeks: expected ${expectedBudgetWeeks}, got ${budgetWeeks}`,
    );
  }
  if (JSON.stringify(autumnWeeks) !== JSON.stringify(expectedAutumnWeeks)) {
    throw new Error(
      `Autumn Statement events should occur every 26 weeks: expected ${expectedAutumnWeeks}, got ${autumnWeeks}`,
    );
  }
  if (quarterWeeks.length !== 8) {
    throw new Error(`Expected 8 quarterly milestones in two years, got ${quarterWeeks.length}`);
  }
  if (dragReports !== 4) {
    throw new Error(`Expected four six-month fiscal-drag reports in two years, got ${dragReports}`);
  }
}

async function runSimulation(testCase: SeededTestCase): Promise<TestResult> {
  const startedAt = Date.now();

  try {
    const { createInitialState, reducer, structuralBalance } = await import('../src/app/engine');
    const { getDefaultCustomPlan } = await import('../src/app/budget');
    const { BILL_POOL } = await import('../src/app/bills');
    const { BILL_POOL_2 } = await import('../src/app/bills2');

    assertFiscalActionGuards(createInitialState, reducer, getDefaultCustomPlan);
    assertFiscalMilestones(createInitialState, reducer);

    // Keep the engine and action-selection RNGs reproducible but independent.
    const runSeed = testCase.seed >>> 0;
    let randomState =
      (Math.imul((runSeed ^ 0x9e3779b9) >>> 0, 1664525) + 1013904223) >>> 0;

    const random = (): number => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };

    let state = { ...createInitialState(), seed: runSeed };

    const baselinePartySeats = state.parties.reduce((sum, party) => sum + party.seats, 0);
    const baselineDepartmentBudgets = new Map(
      state.departments.map((department) => [department.id, department.budget] as const),
    );
    const baselineDepartmentTotal = state.departments.reduce(
      (sum, department) => sum + department.budget,
      0,
    );

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
      checkRange('factionUnrest', state.factionUnrest, 0, 100);

      const statRanges: Record<string, [number, number]> = {
        cpiInflation: [0.1, 1000],
        gdpGrowth: [-100, 100],
        giltYield: [1, 50],
        lettersOfNoConfidence: [0, 99],
        lettersThreshold: [1, 99],
        taxRate: [15, 60],
        debtToGdp: [30, 1000],
      };

      for (const [key, [min, max]] of Object.entries(statRanges)) {
        checkRange(`stats.${key}`, state.stats[key as keyof typeof state.stats], min, max);
      }
      if (state.stats.nhsWaitingList < 2) {
        throw new Error(`Out-of-range stats.nhsWaitingList: ${state.stats.nhsWaitingList}; expected at least 2`);
      }
      if (state.stats.netMigration < 50) {
        throw new Error(`Out-of-range stats.netMigration: ${state.stats.netMigration}; expected at least 50`);
      }
      if (state.stats.unemployment < 1.5) {
        throw new Error(`Out-of-range stats.unemployment: ${state.stats.unemployment}; expected at least 1.5`);
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

      const partySeatTotal = state.parties.reduce((sum, party) => sum + party.seats, 0);
      if (partySeatTotal !== baselinePartySeats) {
        throw new Error(
          `Party seat total changed: expected ${baselinePartySeats}, got ${partySeatTotal}`,
        );
      }

      if (state.player && !partyIds.has(state.player.partyId)) {
        throw new Error(`Player party is absent from state.parties: ${state.player.partyId}`);
      }
      if (state.supplyPartnerId && !partyIds.has(state.supplyPartnerId)) {
        throw new Error(`Supply partner is absent from state.parties: ${state.supplyPartnerId}`);
      }
      if (state.supplyCostPerWeek !== undefined && state.supplyCostPerWeek < 0) {
        throw new Error(`Negative supplyCostPerWeek: ${state.supplyCostPerWeek}`);
      }

      for (const tax of state.taxes) {
        checkRange(`tax ${tax.id} rate`, tax.rate, tax.min, tax.max);
      }

      for (const minister of state.cabinet) {
        checkRange(`minister ${minister.name} loyalty`, minister.loyalty, 0, 100);
        checkRange(`minister ${minister.name} competence`, minister.competence, 0, 100);
        if (typeof minister.ambition === 'number') {
          checkRange(`minister ${minister.name} ambition`, minister.ambition, 0, 100);
        }
      }

      for (const backbencher of state.backbenchers) {
        for (const field of ['loyalty', 'competence', 'ambition'] as const) {
          const value = backbencher[field];
          if (typeof value === 'number') {
            checkRange(`backbencher ${backbencher.name} ${field}`, value, 0, 100);
          }
        }
      }

      for (const department of state.departments) {
        checkRange(
          `department ${department.id} budget`,
          department.budget,
          department.min,
          department.max,
        );
        if (!baselineDepartmentBudgets.has(department.id)) {
          throw new Error(`Unexpected department ID: ${department.id}`);
        }
        if (department.budget !== baselineDepartmentBudgets.get(department.id)) {
          throw new Error(`Department budget changed for ${department.id}`);
        }
      }
      if (state.departments.length !== baselineDepartmentBudgets.size) {
        throw new Error(
          `Department count changed: expected ${baselineDepartmentBudgets.size}, got ${state.departments.length}`,
        );
      }
      const departmentTotal = state.departments.reduce(
        (sum, department) => sum + department.budget,
        0,
      );
      if (departmentTotal !== baselineDepartmentTotal) {
        throw new Error(
          `Department budget total changed: expected ${baselineDepartmentTotal}, got ${departmentTotal}`,
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
    for (let turn = 0; turn < 60 && !state.gameOver; turn++) {
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
        const beforeAction = state;
        state = reducer(state, action);

        if (state === beforeAction) {
          throw new Error(`Reducer silently ignored ${action.type}`);
        }

        if (action.type === 'SACK_MINISTER') {
          assertSackMinisterTransition(beforeAction, state, action.name);
        } else if (action.type === 'PROPOSE_BILL') {
          const blueprint = allBills.find((bill) => bill.id === action.billId);
          if (!blueprint) {
            throw new Error(`Selected unknown bill ID: ${action.billId}`);
          }
          assertBillProposal(beforeAction, state, blueprint, action.whipLevel);
        } else if (action.type === 'ANSWER_PMQ') {
          const question = beforeAction.pmq;
          if (!question) {
            throw new Error('ANSWER_PMQ dispatched without an active question');
          }
          const option = question.options.find(
            (candidate: any) => candidate.id === action.optionId,
          );
          if (!option) {
            throw new Error(`ANSWER_PMQ dispatched with unknown option: ${action.optionId}`);
          }
          assertPmqEffects(beforeAction, state, option.effects);
          assertPmqTransition(beforeAction, state);
        }

        checkState();
      }

      const beforeTurn = state;
      const nextWeek = beforeTurn.week + 1;
      const balanceBeforeTurn = beforeTurn.stats.budgetBalance;
      const structuralBeforeTurn = structuralBalance(beforeTurn);
      const hasBillSettling = beforeTurn.bills.some((bill: any) => bill.weeksToPass <= 1);
      const canCheckBalanceConvergence =
        !hasBillSettling &&
        !beforeTurn.supplyPartnerId &&
        nextWeek % TURNS_PER_MONTH !== 0 &&
        nextWeek % TURNS_PER_QUARTER !== 0;

      state = reducer(state, { type: 'START_TURN' } as any);
      checkState();

      if (state.week !== nextWeek) {
        throw new Error(
          `START_TURN did not advance the week: expected ${nextWeek}, got ${state.week}`,
        );
      }
      if (state === beforeTurn) {
        throw new Error('START_TURN returned the unchanged state object');
      }
      assertBillResolution(beforeTurn, state);

      if (canCheckBalanceConvergence) {
        const oldDistance = Math.abs(balanceBeforeTurn - structuralBeforeTurn);
        const newDistance = Math.abs(state.stats.budgetBalance - structuralBeforeTurn);

        // weeklyEconomy moves the published balance 10% toward the structural
        // position. Fiscal-drag accounting can also affect the weekly result,
        // so allow a small margin while still rejecting a material move away
        // from the engine's stated convergence direction.
        if (newDistance > oldDistance + 5) {
          throw new Error(
            `START_TURN budget balance moved away from structural balance: distance ${oldDistance.toFixed(2)} -> ${newDistance.toFixed(2)}`,
          );
        }

        const weeklyConvergence = 1 - Math.pow(0.9, 1 / TURNS_PER_MONTH);
        const convergedBalance = roundToOneDecimal(
          balanceBeforeTurn +
            (structuralBeforeTurn - balanceBeforeTurn) * weeklyConvergence,
        );
        if (
          oldDistance > 10 &&
          Math.abs(state.stats.budgetBalance - convergedBalance) > oldDistance * 0.5 + 5
        ) {
          throw new Error(
            `START_TURN budget balance diverged from 10% structural convergence: expected near ${convergedBalance}, got ${state.stats.budgetBalance}`,
          );
        }
      }
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
  console.log(
    `Configuration: MAX_RUNS=${summary.total} (default ${DEFAULT_MAX_RUNS}), SEED=${testCases[0]?.seed ?? DEFAULT_SEED} (default ${DEFAULT_SEED})`,
  );

  for (const failure of summary.failures) {
    const testCase = failure.testCase as SeededTestCase;
    console.error(`REPORTED ISSUE run=${testCase.id} seed=${testCase.seed}\n${failure.error}`);
  }

  // Always save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nResults saved to ${RESULTS_FILE}`);
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function generateTestCases(): SeededTestCase[] {
  const maxRuns = envInteger('MAX_RUNS', DEFAULT_MAX_RUNS, 1, Number.MAX_SAFE_INTEGER);
  const baseSeed = envInteger('SEED', DEFAULT_SEED, 0, 0xffffffff);

  return Array.from({ length: maxRuns }, (_, id) => ({
    id,
    seed: (baseSeed + id) >>> 0,
  }));
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
