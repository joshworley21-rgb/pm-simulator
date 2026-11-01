import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { Effects, GameState } from '../src/app/types';
import {
  PURDAH_TURNS,
  TURNS_PER_HALF_YEAR,
  TURNS_PER_MONTH,
  TURNS_PER_QUARTER,
  TURNS_PER_YEAR,
} from '../src/app/calendar';
import { DEFAULT_NOMINAL_GDP, getDefaultCustomPlan } from '../src/app/budget';
import { TAX_YIELD_PER_POINT } from '../src/app/taxes';
import { ministerSackingCost } from '../src/app/cabinetEffects';
import { applyScenario } from '../src/app/scenarios';

type FuzzerArchetype = 'Spender' | 'Hawk' | 'Reshuffler' | 'Idle' | 'Random';
type GovernmentMode = 'majority' | 'hung';
type ArchetypeLabel = `${FuzzerArchetype} [${GovernmentMode}]`;

const GOVERNMENT_MODES: GovernmentMode[] = ['majority', 'hung'];

function formatArchetypeLabel(
  archetype: FuzzerArchetype,
  mode: GovernmentMode,
): ArchetypeLabel {
  return `${archetype} [${mode}]`;
}

const FUZZER_ARCHETYPES: FuzzerArchetype[] = [
  'Spender',
  'Hawk',
  'Reshuffler',
  'Idle',
  'Random',
];

interface RunTelemetry {
  archetype: ArchetypeLabel;
  weeksSurvived: number;
  peakUnemployment: number;
  peakGiltYield: number;
  peakDebtToGdp: number;
  failState: string | null;
  failureDetail: string | null;
}

interface TestResult {
  passed: boolean;
  error?: string;
  duration: number;
  testCase: unknown;
  archetype?: ArchetypeLabel;
  telemetry?: RunTelemetry;
}

interface Summary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  failures: Array<{
    testCase: unknown;
    archetype?: ArchetypeLabel;
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

const TELEMETRY_FILE = path.join(__dirname, '../fuzzer-telemetry.json');

const DEFAULT_MAX_RUNS = 500;
const DEFAULT_SEED = 20260211;
const DEFAULT_ARCHETYPE_HORIZON = 520;
const RESHUFFLER_SACK_INTERVAL_WEEKS = 6;

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

type ActionBias = 'spender' | 'hawk' | 'reshuffler';

interface AvailableAction {
  action: any;
  bias?: ActionBias;
}

function availableActions(
  state: any,
  allBills: any[],
  budgetPackages: any[],
  random: () => number,
): AvailableAction[] {
  const actions: AvailableAction[] = [];
  const inPurdah =
    state.phase === 'playing' && state.turnsUntilElection <= PURDAH_TURNS;

  if (!inPurdah) {
    const availableBills = allBills.filter(
      (bill) =>
        !state.bills.some((active: any) => active.id === bill.id) &&
        !state.passedLaws.includes(bill.title),
    );
    for (const bill of availableBills) {
      const whipLevels = ['three-line', 'two-line', 'free-vote'] as const;
      actions.push({
        action: {
          type: 'PROPOSE_BILL',
          billId: bill.id,
          whipLevel: whipLevels[Math.floor(random() * whipLevels.length)],
        },
      });
    }
  }

  // Sacking is the engine's only explicit discretionary cabinet action;
  // reshuffles themselves are triggered automatically during START_TURN.
  for (const minister of state.cabinet) {
    actions.push({
      action: { type: 'SACK_MINISTER', name: minister.name },
      bias: 'reshuffler',
    });
  }

  if (state.pmq) {
    for (const option of state.pmq.options) {
      actions.push({
        action: { type: 'ANSWER_PMQ', optionId: option.id },
      });
    }
  }

  if (!inPurdah && state.budgetDue) {
    const defaultPlan = getDefaultCustomPlan(state);
    actions.push({
      action: {
        type: 'DELIVER_CUSTOM_BUDGET',
        plan: {
          ...defaultPlan,
          title: 'Reckless expansion',
          departmentBudgets: Object.fromEntries(
            state.departments.map((department: any) => [department.id, department.max]),
          ),
          taxRates: Object.fromEntries(
            state.taxes.map((tax: any) => [tax.id, tax.min]),
          ),
        },
      },
      bias: 'spender',
    });

    for (const budget of budgetPackages) {
      const bias =
        budget.id === 'budget-invest' || budget.id === 'budget-taxcuts'
          ? 'spender'
          : budget.id === 'budget-restraint'
            ? 'hawk'
            : undefined;
      actions.push({
        action: { type: 'DELIVER_BUDGET', packageId: budget.id },
        bias,
      });
    }

    for (const department of state.departments) {
      if (department.budget + department.step <= department.max) {
        actions.push({
          action: {
            type: 'ADJUST_SPENDING',
            deptId: department.id,
            delta: department.step,
          },
          bias: 'spender',
        });
      }
      if (department.budget - department.step >= department.min) {
        actions.push({
          action: {
            type: 'ADJUST_SPENDING',
            deptId: department.id,
            delta: -department.step,
          },
          bias: 'hawk',
        });
      }
    }
  }

  if (!inPurdah) {
    const fiscalWindowOpen = state.budgetDue === true;
    const emergencyActionsAvailable =
      (state.emergencyFiscalActions ?? 0) < 2;

    for (const tax of state.taxes) {
      if (!fiscalWindowOpen && !(tax.emergency && emergencyActionsAvailable)) {
        continue;
      }
      const step =
        typeof tax.step === 'number' && tax.step > 0 ? tax.step : 1;

      if (tax.rate + step <= tax.max) {
        actions.push({
          action: { type: 'ADJUST_TAX', taxId: tax.id, delta: step },
          bias: 'hawk',
        });
      }
      if (tax.rate - step >= tax.min) {
        actions.push({
          action: { type: 'ADJUST_TAX', taxId: tax.id, delta: -step },
          bias: 'spender',
        });
      }
    }
  }

  return actions;
}

/*
 * Spender: 80% chance of a spending-biased action; otherwise choose uniformly.
 * Hawk: 80% chance of an austerity/tax-hike-biased action; otherwise choose uniformly.
 * Reshuffler: 70% chance of a sack-biased action on its existing six-week cadence.
 * Idle: never takes a discretionary action.
 * Random: choose uniformly from all available actions.
 */
function selectArchetypeAction(
  archetype: FuzzerArchetype,
  state: any,
  allBills: any[],
  budgetPackages: any[],
  random: () => number,
): any | undefined {
  if (archetype === 'Idle') return undefined;

  if (archetype === 'Reshuffler') {
    if (state.ministerPicker) {
      return { type: 'CONFIRM_APPOINT', post: 'Parliamentary Secretary' };
    }
    if (state.cabinet.length <= 1 && state.backbenchers.length > 0) {
      return { type: 'PICK_MINISTER', name: state.backbenchers[0].name };
    }
    if (state.week % RESHUFFLER_SACK_INTERVAL_WEEKS !== 0) return undefined;
  }

  const actions = availableActions(state, allBills, budgetPackages, random);
  if (actions.length === 0) return undefined;

  if (archetype === 'Random') {
    return actions[Math.floor(random() * actions.length)].action;
  }

  const bias: ActionBias =
    archetype === 'Spender'
      ? 'spender'
      : archetype === 'Hawk'
        ? 'hawk'
        : 'reshuffler';
  const preferredActions = actions.filter((candidate) => candidate.bias === bias);
  const preferredProbability = archetype === 'Reshuffler' ? 0.7 : 0.8;

  if (preferredActions.length > 0 && random() < preferredProbability) {
    return preferredActions[Math.floor(random() * preferredActions.length)].action;
  }

  return actions[Math.floor(random() * actions.length)].action;
}

/**
 * The engine has no explicit debt-default or polling-floor game-over checks.
 * For telemetry, define them as debt/GDP >= 300% or gilt yield >= 20%, and
 * approval or governing-party support <= 1%, respectively.
 */
function failStateFor(
  state: any,
): { name: string; detail: string } | undefined {
  if (state.gameOver) {
    const detail = String(state.gameOver);
    if (
      /supply.{0,40}(withdraw|withdrew|withdrawn|ended|collapse)|(?:withdraw|withdrew|withdrawn).{0,40}supply/i.test(
        detail,
      )
    ) {
      return { name: 'Supply Withdrawal', detail };
    }
    if (
      /confidence|lost.{0,30}motion|motion.{0,30}lost/i.test(detail)
    ) {
      return { name: 'No Confidence Vote', detail };
    }
    if (/government.{0,30}(collapse|fell|fall|defeat)/i.test(detail)) {
      return { name: 'Government Collapse', detail };
    }
    return { name: detail, detail };
  }

  if (state.stats.debtToGdp >= 300 || state.stats.giltYield >= 20) {
    return {
      name: 'Debt Default',
      detail: `Debt/GDP ${state.stats.debtToGdp}% or gilt yield ${state.stats.giltYield}% reached the telemetry threshold.`,
    };
  }

  const governingParty = state.parties.find(
    (party: any) => party.id === state.player?.partyId,
  );
  if (
    state.metrics.approval <= 1 ||
    (governingParty && governingParty.currentSupport <= 1)
  ) {
    return {
      name: 'Polling Floor',
      detail: `Approval ${state.metrics.approval}% or governing-party support ${governingParty?.currentSupport}% reached the telemetry threshold.`,
    };
  }

  return undefined;
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

  const cost = ministerSackingCost(minister);
  const expectedUnrest = clamp(
    before.factionUnrest + cost.factionUnrestIncrease,
    0,
    100,
  );
  if (after.factionUnrest !== expectedUnrest) {
    throw new Error(
      `SACK_MINISTER factionUnrest mismatch: expected ${expectedUnrest}, got ${after.factionUnrest}`,
    );
  }

  const expectedLetters = clamp(
    (before.stats.lettersOfNoConfidence ?? 0) + cost.lettersOfNoConfidenceIncrease,
    0,
    99,
  );
  if (after.stats.lettersOfNoConfidence !== expectedLetters) {
    throw new Error(
      `SACK_MINISTER letters mismatch: expected ${expectedLetters}, got ${after.stats.lettersOfNoConfidence}`,
    );
  }

  const coalitionCollapse =
    minister.coalition === true && Boolean(before.supplyPartnerId);
  const expectedApproval = clamp(
    before.metrics.approval - cost.approvalPenalty,
    0,
    100,
  );
  const expectedConfidence = clamp(
    before.metrics.partyConfidence -
      cost.partyConfidencePenalty -
      (coalitionCollapse ? 6 : 0),
    0,
    100,
  );

  if (after.metrics.approval !== expectedApproval) {
    throw new Error(
      `SACK_MINISTER approval mismatch: expected ${expectedApproval}, got ${after.metrics.approval}`,
    );
  }
  if (after.metrics.partyConfidence !== expectedConfidence) {
    throw new Error(
      `SACK_MINISTER partyConfidence mismatch: expected ${expectedConfidence}, got ${after.metrics.partyConfidence}`,
    );
  }
  if (
    (before.metrics.approval > 0 || before.metrics.partyConfidence > 0) &&
    after.metrics.approval >= before.metrics.approval &&
    after.metrics.partyConfidence >= before.metrics.partyConfidence
  ) {
    throw new Error('SACK_MINISTER should reduce approval or party confidence');
  }

  if (coalitionCollapse) {
    if (after.supplyPartnerId !== undefined) {
      throw new Error('Sacking a coalition minister should end the supply arrangement');
    }
    if (after.coalition !== false || (after.coalitionPosts ?? []).length !== 0) {
      throw new Error('Sacking a coalition minister should end coalition government');
    }
  }
}

function assertSackMinisterCosts(
  createInitialState: () => any,
  reducer: (state: any, action: any) => any,
): void {
  const initial = createInitialState();
  const partyId = initial.parties[0]?.id;
  const partnerId = initial.parties.find((party: any) => party.id !== partyId)?.id;
  if (!partyId || !partnerId) {
    throw new Error('Cannot test minister sackings without two parties');
  }

  const makeMinister = (
    name: string,
    post: string,
    ministerPartyId: string,
    coalition = false,
  ) => ({
    name,
    post,
    partyId: ministerPartyId,
    loyalty: 60,
    competence: 60,
    faction: 'Test',
    coalition,
  });
  const makeState = (minister: any, isCoalition = false) => ({
    ...initial,
    phase: 'playing',
    player: {
      firstName: 'Test',
      lastName: 'Prime Minister',
      partyId,
      background: 'business',
    },
    cabinet: [minister],
    metrics: { ...initial.metrics, approval: 60, partyConfidence: 60 },
    factionUnrest: 20,
    supplyPartnerId: isCoalition ? partnerId : undefined,
    supplyCostPerWeek: isCoalition ? 0.01 : undefined,
    supplyConcessions: isCoalition ? ['test concession'] : [],
    coalition: isCoalition,
    coalitionPosts: isCoalition ? ['Partner takes a Cabinet post'] : [],
  });
  const sack = (before: any) =>
    reducer(before, { type: 'SACK_MINISTER', name: before.cabinet[0].name });
  const combinedPoliticalCost = (before: any, after: any) =>
    before.metrics.approval -
    after.metrics.approval +
    before.metrics.partyConfidence -
    after.metrics.partyConfidence;

  const seniorBefore = makeState(
    makeMinister('Senior Minister', 'Chancellor of the Exchequer', partyId),
  );
  const seniorAfter = sack(seniorBefore);
  assertSackMinisterTransition(seniorBefore, seniorAfter, 'Senior Minister');

  const juniorBefore = makeState(
    makeMinister('Junior Minister', 'Parliamentary Secretary', partyId),
  );
  const juniorAfter = sack(juniorBefore);
  assertSackMinisterTransition(juniorBefore, juniorAfter, 'Junior Minister');

  if (
    combinedPoliticalCost(seniorBefore, seniorAfter) <
    combinedPoliticalCost(juniorBefore, juniorAfter)
  ) {
    throw new Error('Sacking a senior minister should cost at least as much as a junior minister');
  }

  const coalitionBefore = makeState(
    makeMinister('Coalition Minister', 'Health Secretary', partnerId, true),
    true,
  );
  const coalitionAfter = sack(coalitionBefore);
  assertSackMinisterTransition(coalitionBefore, coalitionAfter, 'Coalition Minister');
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
  const hasDurableRecord = (resolutions: any, billId: string): boolean =>
    resolutions !== null &&
    typeof resolutions === 'object' &&
    Object.prototype.hasOwnProperty.call(resolutions, billId);

  const logBefore: string[] = before.log;
  const logAfter: string[] = after.log;
  let newLogEntries: string[];

  if (
    logAfter.length >= logBefore.length &&
    logBefore.every((line, index) => logAfter[index] === line)
  ) {
    newLogEntries = logAfter.slice(logBefore.length);
  } else {
    let overlap = Math.min(logBefore.length, logAfter.length);
    while (overlap > 0) {
      const matches = logBefore
        .slice(logBefore.length - overlap)
        .every((line, index) => line === logAfter[index]);
      if (matches) break;
      overlap -= 1;
    }
    newLogEntries = logAfter.slice(overlap);
  }

  const dueBills = before.bills.filter(
    (bill: any) =>
      bill.weeksToPass <= 1 &&
      !hasDurableRecord(before.billResolutions, bill.id),
  );

  for (const bill of dueBills) {
    const passedMessage = `LAW PASSED: ${bill.title}`;
    const defeatedMessage = `BILL DEFEATED: ${bill.title}`;
    const outcomes = newLogEntries
      .map((line, index) => ({ line, index }))
      .filter(
        ({ line }) =>
          line.startsWith(passedMessage) || line.startsWith(defeatedMessage),
      );

    if (outcomes.length !== 1) {
      throw new Error(
        `Due bill ${bill.title} should have exactly one new resolution outcome`,
      );
    }

    const [outcome] = outcomes;
    newLogEntries.splice(outcome.index, 1);

    if (
      (before.billResolutions !== undefined ||
        after.billResolutions !== undefined) &&
      !hasDurableRecord(after.billResolutions, bill.id)
    ) {
      throw new Error(
        `Due bill ${bill.title} should have exactly one durable resolution record`,
      );
    }

    if (after.bills.some((active: any) => active.id === bill.id)) {
      throw new Error(`Resolved bill ${bill.title} remained active`);
    }

    const passed = outcome.line.startsWith(passedMessage);
    if (passed && !after.passedLaws.includes(bill.title)) {
      throw new Error(`Passed bill ${bill.title} was not added to passedLaws`);
    }

    if (!passed && after.passedLaws.includes(bill.title)) {
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
      fiscalEventKind: fiscalAction.name === 'SET_AUTUMN_TAXES' ? 'autumn' : 'budget',
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

function assertMacroDynamics(
  createInitialState: () => any,
  advanceWeek: (state: any) => any,
  effectiveTaxBurden: (state: any) => number,
): void {
  const initial = createInitialState();
  const parties = initial.parties.map((party: any, index: number) => ({
    ...party,
    seats: index === 0 ? 650 : 0,
  }));

  const makeState = (overrides: any = {}) => {
    const { stats: statsOverride, ...rest } = overrides;
    return {
      ...initial,
      phase: 'playing',
      player: {
        firstName: 'Test',
        lastName: 'Prime Minister',
        partyId: parties[0].id,
        background: 'business',
      },
      parties,
      cabinet: [],
      backbenchers: [],
      regionSeats: {},
      turnsUntilElection: 10000,
      termLength: 10000,
      gameOver: null,
      ...rest,
      stats: {
        ...initial.stats,
        lettersOfNoConfidence: 0,
        lettersThreshold: 99,
        ...(statsOverride ?? {}),
      },
    };
  };

  const weightedCandidates = initial.taxes
    .map((tax: any) => ({
      tax,
      weight: Math.max(0, TAX_YIELD_PER_POINT[tax.id] ?? 0),
    }))
    .filter((candidate: any) => candidate.weight > 0)
    .sort((a: any, b: any) => a.weight - b.weight);
  if (weightedCandidates.length < 2) {
    throw new Error('Cannot verify weighted tax burden with fewer than two tax bases');
  }
  const lowWeight = weightedCandidates[0];
  const highWeight = weightedCandidates[weightedCandidates.length - 1];
  if (lowWeight.weight === highWeight.weight) {
    throw new Error('Tax-base weights must differ to verify GDP-weighted tax burden');
  }
  const taxState = {
    taxes: [
      { ...lowWeight.tax, rate: 20 },
      { ...highWeight.tax, rate: 40 },
    ],
  };
  const expectedWeightedBurden =
    (20 * lowWeight.weight + 40 * highWeight.weight) /
    (lowWeight.weight + highWeight.weight);
  const actualWeightedBurden = effectiveTaxBurden(taxState);
  if (Math.abs(actualWeightedBurden - expectedWeightedBurden) > 1e-10) {
    throw new Error(
      `Tax burden is not GDP-weighted: expected ${expectedWeightedBurden}, got ${actualWeightedBurden}`,
    );
  }
  if (Math.abs(actualWeightedBurden - 30) < 1e-10) {
    throw new Error('Tax burden unexpectedly matches the unweighted average');
  }

  const unemploymentHorizon = TURNS_PER_QUARTER;
  let recession = makeState({ stats: { gdpGrowth: -2, unemployment: 5 } });
  const recessionStartingUnemployment = recession.stats.unemployment;
  for (let turn = 0; turn < unemploymentHorizon; turn++) {
    recession = advanceWeek(recession);
    if (recession.stats.unemployment < 0 || recession.stats.unemployment > 20) {
      throw new Error(
        `Unemployment escaped 0..20 during recession: ${recession.stats.unemployment}`,
      );
    }
  }
  if (recession.stats.unemployment <= recessionStartingUnemployment) {
    throw new Error('Unemployment should rise when GDP growth is below potential');
  }

  let expansion = makeState({ stats: { gdpGrowth: 5, unemployment: 5 } });
  const expansionStartingUnemployment = expansion.stats.unemployment;
  for (let turn = 0; turn < unemploymentHorizon; turn++) {
    expansion = advanceWeek(expansion);
    if (expansion.stats.unemployment < 0 || expansion.stats.unemployment > 20) {
      throw new Error(
        `Unemployment escaped 0..20 during expansion: ${expansion.stats.unemployment}`,
      );
    }
  }
  if (expansion.stats.unemployment >= expansionStartingUnemployment) {
    throw new Error('Unemployment should fall when GDP growth is above potential');
  }

  const stableYieldState = makeState({
    taxes: initial.taxes.map((tax: any) => {
      const rateIncreases: Record<string, number> = {
        income: 5,
        ni: 4,
        vat: 2,
        corporation: 1,
        capgains: 1,
        inheritance: 1,
      };
      return { ...tax, rate: tax.rate + (rateIncreases[tax.id] ?? 0) };
    }),
    stats: { debtToGdp: 100, cpiInflation: 2.5, gdpGrowth: 1.2, giltYield: 12 },
  });
  let yieldState = stableYieldState;
  for (let turn = 0; turn < TURNS_PER_YEAR; turn++) {
    yieldState = advanceWeek(yieldState);
  }
  if (yieldState.stats.giltYield >= stableYieldState.stats.giltYield) {
    throw new Error('Gilt yields did not mean-revert from a high starting rate');
  }
  if (yieldState.stats.giltYield < 3 || yieldState.stats.giltYield > 7) {
    throw new Error(`Gilt yields failed to return near neutral: ${yieldState.stats.giltYield}`);
  }

  let stressState = makeState({
    nominalGdp: DEFAULT_NOMINAL_GDP,
    stats: {
      debtToGdp: 250,
      budgetBalance: -300,
      cpiInflation: 8,
      gdpGrowth: -2,
      unemployment: 19.5,
    },
  });
  const startingDebtRatio = stressState.stats.debtToGdp;
  const startingNominalGdp = stressState.nominalGdp;
  for (let turn = 0; turn < TURNS_PER_YEAR; turn++) {
    stressState = advanceWeek(stressState);
    if (!Number.isFinite(stressState.stats.debtToGdp)) {
      throw new Error('Debt-to-GDP became non-finite under macroeconomic stress');
    }
    if (stressState.stats.unemployment < 0 || stressState.stats.unemployment > 20) {
      throw new Error(`Unemployment escaped 0..20 under stress: ${stressState.stats.unemployment}`);
    }
  }
  if (stressState.stats.debtToGdp === startingDebtRatio) {
    throw new Error('Debt-to-GDP did not evolve under macroeconomic stress');
  }
  if (stressState.stats.debtToGdp <= 30 || stressState.stats.debtToGdp >= 1000) {
    throw new Error(`Debt-to-GDP saturated under stress: ${stressState.stats.debtToGdp}`);
  }
  if (!Number.isFinite(stressState.nominalGdp) || stressState.nominalGdp === startingNominalGdp) {
    throw new Error('Nominal GDP did not evolve finitely under macroeconomic stress');
  }
  if (stressState.stats.giltYield >= 20) {
    throw new Error(`Gilt yields ran away under stress: ${stressState.stats.giltYield}`);
  }
}

async function runSimulation(
  testCase: SeededTestCase,
  archetype: FuzzerArchetype,
  governmentMode: GovernmentMode,
  archetypeHorizon: number,
  telemetryTracker: TelemetryTracker,
): Promise<TestResult> {
  const startedAt = Date.now();
  const archetypeLabel = formatArchetypeLabel(archetype, governmentMode);
  const telemetry = telemetryTracker.startNewRun(archetypeLabel);

  try {
    const { createInitialState, reducer, advanceWeek, structuralBalance, effectiveTaxBurden } = await import('../src/app/engine');
    const { getDefaultCustomPlan, BUDGET_PACKAGES } = await import('../src/app/budget');
    const { BILL_POOL } = await import('../src/app/bills');
    const { BILL_POOL_2 } = await import('../src/app/bills2');

    assertSackMinisterCosts(createInitialState, reducer);
    assertFiscalActionGuards(createInitialState, reducer, getDefaultCustomPlan);
    assertFiscalMilestones(createInitialState, reducer);
    assertMacroDynamics(createInitialState, advanceWeek, effectiveTaxBurden);

    // Keep the engine and action-selection RNGs reproducible but independent.
    const runSeed = testCase.seed >>> 0;
    let randomState =
      (Math.imul((runSeed ^ 0x9e3779b9) >>> 0, 1664525) + 1013904223) >>> 0;

    const random = (): number => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };

    const initialState = createInitialState();
    const governingParty = initialState.parties[0];
    if (!governingParty) {
      throw new Error('Cannot start archetype run without a governing party');
    }

    const parties = initialState.parties.map((party, index) => ({
      ...party,
      seats: index === 0 ? 650 : 0,
    }));

    let state: GameState = {
      ...initialState,
      phase: 'playing',
      player: {
        firstName: 'Test',
        lastName: 'Prime Minister',
        partyId: governingParty.id,
        background: 'business',
      },
      parties,
      stats: {
        ...initialState.stats,
        lettersOfNoConfidence: 0,
        lettersThreshold: 50,
      },
      termLength: Math.max(10_000, archetypeHorizon + 1),
      turnsUntilElection: Math.max(10_000, archetypeHorizon + 1),
      thresholdsFrozen: true,
      thresholdFrozenTurns: 0,
      gameOver: null,
      seed: runSeed,
    };

    if (governmentMode === 'hung') {
      state = applyScenario(state, 'hung-parliament');
      const playerPartyId = state.player?.partyId;
      const otherParties = state.parties.filter(
        (party) => party.id !== playerPartyId,
      );
      if (!playerPartyId || otherParties.length < 2) {
        throw new Error('Cannot create a hung parliament without a player party and two other parties');
      }

      const playerSeats = 320;
      const oppositionSeats = 650 - playerSeats;
      const baseOppositionSeats = Math.floor(
        oppositionSeats / otherParties.length,
      );
      let remainingOppositionSeats =
        oppositionSeats % otherParties.length;

      state = {
        ...state,
        parties: state.parties.map((party) => {
          if (party.id === playerPartyId) {
            return { ...party, seats: playerSeats };
          }
          const seats =
            baseOppositionSeats + (remainingOppositionSeats > 0 ? 1 : 0);
          remainingOppositionSeats -= 1;
          return { ...party, seats };
        }),
      };

      const playerParty = state.parties.find(
        (party) => party.id === playerPartyId,
      );
      if (
        !playerParty ||
        playerParty.seats >= 325 ||
        state.parties.some(
          (party) =>
            party.id !== playerPartyId && party.seats >= playerParty.seats,
        )
      ) {
        throw new Error('Hung-parliament fixture must give the player the largest party without a majority');
      }
    }

    const startingWeek = state.week;
    telemetryTracker.updateFromState(state, startingWeek);

    const baselinePartySeats = state.parties.reduce((sum, party) => sum + party.seats, 0);
    const baselineDepartmentBudgets = new Map(
      state.departments.map((department) => [department.id, department.budget] as const),
    );
    let baselineDepartmentTotal = state.departments.reduce(
      (sum, department) => sum + department.budget,
      0,
    );
    const recordExpectedDepartmentBudgets = (): void => {
      baselineDepartmentBudgets.clear();
      for (const department of state.departments) {
        baselineDepartmentBudgets.set(department.id, department.budget);
      }
      baselineDepartmentTotal = state.departments.reduce(
        (sum, department) => sum + department.budget,
        0,
      );
    };

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
        unemployment: [0, 20],
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

    // Drive real reducer actions with reproducible, archetype-weighted choices.
    for (
      let turn = 0;
      turn < archetypeHorizon && !state.gameOver && !telemetry.failState;
      turn++
    ) {
      const action = selectArchetypeAction(
        archetype,
        state,
        allBills,
        BUDGET_PACKAGES,
        random,
      );

      if (action) {
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

        if (
          action.type === 'ADJUST_SPENDING' ||
          action.type === 'DELIVER_BUDGET' ||
          action.type === 'DELIVER_CUSTOM_BUDGET'
        ) {
          recordExpectedDepartmentBudgets();
        }

        checkState();
      }

      telemetryTracker.updateFromState(state, startingWeek);
      if (telemetry.failState) break;

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
      telemetryTracker.updateFromState(state, startingWeek);

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

    telemetryTracker.finalizeRun(archetypeLabel, telemetry.failState);
    return {
      passed: true,
      duration: Date.now() - startedAt,
      testCase,
      archetype: archetypeLabel,
      telemetry,
    };
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? `${error.message}${error.stack ? `\nStack Trace:\n${error.stack}` : ''}`
        : `Error: ${String(error)}`;

    if (telemetry.failState === null) {
      telemetry.failState = 'Runner Error';
      telemetry.failureDetail = errorDetails;
    }

    telemetryTracker.finalizeRun(archetypeLabel, telemetry.failState);
    return {
      passed: false,
      error: errorDetails,
      duration: Date.now() - startedAt,
      testCase,
      archetype: archetypeLabel,
      telemetry,
    };
  }
}

interface ArchetypeTelemetrySummary {
  runs: number;
  medianWeeksSurvived: number;
  medianPeakUnemployment: number;
  medianPeakGiltYield: number;
  medianPeakDebtToGdp: number;
  failStates: Record<string, number>;
  runsTelemetry: RunTelemetry[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

class TelemetryTracker {
  private readonly runsByArchetype = new Map<ArchetypeLabel, RunTelemetry[]>();
  private currentRun: RunTelemetry | undefined = undefined;

  constructor(
    private readonly maxRunsPerArchetype: number,
    private readonly archetypeHorizon: number,
    private readonly seed: number,
  ) {
    for (const archetype of FUZZER_ARCHETYPES) {
      for (const mode of GOVERNMENT_MODES) {
        this.runsByArchetype.set(formatArchetypeLabel(archetype, mode), []);
      }
    }
  }

  startNewRun(archetype: ArchetypeLabel): RunTelemetry {
    if (this.currentRun) {
      throw new Error('Cannot start a run before finalizing the current run');
    }

    this.currentRun = {
      archetype,
      weeksSurvived: 0,
      peakUnemployment: 0,
      peakGiltYield: 0,
      peakDebtToGdp: 0,
      failState: null,
      failureDetail: null,
    };
    return this.currentRun;
  }

  updateMetrics(unemployment: number, bondYield: number): void {
    if (!this.currentRun) throw new Error('No active telemetry run');
    this.currentRun.peakUnemployment = Math.max(
      this.currentRun.peakUnemployment,
      unemployment,
    );
    this.currentRun.peakGiltYield = Math.max(
      this.currentRun.peakGiltYield,
      bondYield,
    );
  }

  updateFromState(state: any, startingWeek: number): RunTelemetry {
    if (!this.currentRun) throw new Error('No active telemetry run');

    this.currentRun.weeksSurvived = Math.max(
      this.currentRun.weeksSurvived,
      state.week - startingWeek,
    );
    this.updateMetrics(state.stats.unemployment, state.stats.giltYield);
    this.currentRun.peakDebtToGdp = Math.max(
      this.currentRun.peakDebtToGdp,
      state.stats.debtToGdp,
    );

    const failure = failStateFor(state);
    if (failure && this.currentRun.failState === null) {
      this.currentRun.failState = failure.name;
      this.currentRun.failureDetail = failure.detail;
    }
    return this.currentRun;
  }

  finalizeRun(
    archetypeLabel: ArchetypeLabel,
    failState: string | null,
  ): RunTelemetry {
    if (!this.currentRun) throw new Error('No active telemetry run');
    if (this.currentRun.failState === null && failState !== null) {
      this.currentRun.failState = failState;
    }

    const run = this.currentRun;
    const runs = this.runsByArchetype.get(archetypeLabel);
    if (!runs) throw new Error(`Unknown telemetry label: ${archetypeLabel}`);
    runs.push(run);
    this.currentRun = undefined;
    return run;
  }

  exportReport(): Record<ArchetypeLabel, ArchetypeTelemetrySummary> {
    const summaries = {} as Record<ArchetypeLabel, ArchetypeTelemetrySummary>;

    for (const archetype of FUZZER_ARCHETYPES) {
      for (const mode of GOVERNMENT_MODES) {
        const label: ArchetypeLabel = formatArchetypeLabel(archetype, mode);
        const runsTelemetry = this.runsByArchetype.get(label) ?? [];
        const failStates: Record<string, number> = {};

        for (const run of runsTelemetry) {
          const name = run.failState ?? 'No failure';
          failStates[name] = (failStates[name] ?? 0) + 1;
        }

        summaries[label] = {
          runs: runsTelemetry.length,
          medianWeeksSurvived: median(
            runsTelemetry.map((run) => run.weeksSurvived),
          ),
          medianPeakUnemployment: median(
            runsTelemetry.map((run) => run.peakUnemployment),
          ),
          medianPeakGiltYield: median(
            runsTelemetry.map((run) => run.peakGiltYield),
          ),
          medianPeakDebtToGdp: median(
            runsTelemetry.map((run) => run.peakDebtToGdp),
          ),
          failStates,
          runsTelemetry,
        };
      }
    }

    fs.writeFileSync(
      TELEMETRY_FILE,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          maxRunsPerArchetype: this.maxRunsPerArchetype,
          archetypeHorizon: this.archetypeHorizon,
          seed: this.seed,
          archetypes: summaries,
        },
        null,
        2,
      ),
    );

    console.log('\\n=== Archetype Telemetry ===');
    for (const archetype of FUZZER_ARCHETYPES) {
      for (const mode of GOVERNMENT_MODES) {
        const label: ArchetypeLabel = formatArchetypeLabel(archetype, mode);
        const data = summaries[label];
        const failures = Object.entries(data.failStates)
          .map(([name, count]) => `${name}: ${count}`)
          .join(', ');
        console.log(
          `${label}: median weeks=${data.medianWeeksSurvived}, peak unemployment=${data.medianPeakUnemployment.toFixed(2)}%, peak gilt yield=${data.medianPeakGiltYield.toFixed(2)}%, peak debt/GDP=${data.medianPeakDebtToGdp.toFixed(2)}%; ${failures || 'No runs'}`,
        );
      }
    }

    return summaries;
  }
}

function assertHungGovernmentCollapseOutcomes(results: TestResult[]): void {
  const collapseStates = new Set([
    'No Confidence Vote',
    'Supply Withdrawal',
    'Government Collapse',
  ]);
  let majorityRuns = 0;
  let hungRuns = 0;
  let majorityCollapses = 0;
  let hungCollapses = 0;

  for (const archetype of FUZZER_ARCHETYPES) {
    const majorityLabel = formatArchetypeLabel(archetype, 'majority');
    const hungLabel = formatArchetypeLabel(archetype, 'hung');
    const archetypeMajority = results.filter(
      (result) => result.archetype === majorityLabel,
    );
    const archetypeHung = results.filter(
      (result) => result.archetype === hungLabel,
    );
    majorityRuns += archetypeMajority.length;
    hungRuns += archetypeHung.length;
    majorityCollapses += archetypeMajority.filter((result) =>
      collapseStates.has(result.telemetry?.failState ?? ''),
    ).length;
    hungCollapses += archetypeHung.filter((result) =>
      collapseStates.has(result.telemetry?.failState ?? ''),
    ).length;
  }

  if (majorityRuns !== hungRuns || majorityRuns === 0) {
    throw new Error(
      `Cannot compare government modes: majority runs=${majorityRuns}, hung runs=${hungRuns}`,
    );
  }

  const minimumAdditionalCollapses = Math.max(1, Math.ceil(majorityRuns * 0.05));
  if (hungCollapses - majorityCollapses < minimumAdditionalCollapses) {
    throw new Error(
      `Hung-parliament runs must produce at least ${minimumAdditionalCollapses} more government-collapse outcome(s) than majority runs; majority=${majorityCollapses}, hung=${hungCollapses}`,
    );
  }

  console.log(
    `Government-collapse assertion passed: majority=${majorityCollapses}/${majorityRuns}, hung=${hungCollapses}/${hungRuns}`,
  );
}

async function main() {
  const archetypeHorizon = envInteger(
    'ARCHETYPE_HORIZON',
    DEFAULT_ARCHETYPE_HORIZON,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const maxRuns = envInteger(
    'MAX_RUNS',
    DEFAULT_MAX_RUNS,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const baseSeed = envInteger('SEED', DEFAULT_SEED, 0, 0xffffffff);
  const results: TestResult[] = [];
  const telemetryTracker = new TelemetryTracker(maxRuns, archetypeHorizon, baseSeed);
  const startTime = Date.now();

  for (
    let archetypeIndex = 0;
    archetypeIndex < FUZZER_ARCHETYPES.length;
    archetypeIndex++
  ) {
    const archetype = FUZZER_ARCHETYPES[archetypeIndex];
    const testCases = generateTestCases(archetypeIndex, maxRuns, baseSeed);

    for (const governmentMode of GOVERNMENT_MODES) {
      const label: ArchetypeLabel = formatArchetypeLabel(archetype, governmentMode);
      for (const testCase of testCases) {
        const result = await runSimulation(
          testCase,
          archetype,
          governmentMode,
          archetypeHorizon,
          telemetryTracker,
        );
        results.push(result);

        if (VERBOSE) {
          console.log(
            `${label} test ${result.passed ? 'PASSED' : 'FAILED'} in ${result.duration.toFixed(2)}ms`,
          );
        }
      }
    }
  }

  assertHungGovernmentCollapseOutcomes(results);

  const duration = Date.now() - startTime;
  const summary = buildSummary(results, duration);

  console.log('\n=== E2E Test Summary ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Duration: ${summary.duration}ms`);
  console.log(
    `Configuration: MAX_RUNS=${maxRuns} per archetype/mode (${FUZZER_ARCHETYPES.length} archetypes, ${GOVERNMENT_MODES.length} modes), ARCHETYPE_HORIZON=${archetypeHorizon}, SEED=${baseSeed} (default ${DEFAULT_SEED})`,
  );

  for (const failure of summary.failures) {
    const testCase = failure.testCase as SeededTestCase;
    console.error(
      `REPORTED ISSUE archetype=${failure.archetype ?? 'unknown'} run=${testCase.id} seed=${testCase.seed}\n${failure.error}`,
    );
  }

  telemetryTracker.exportReport();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nResults saved to ${RESULTS_FILE}`);
  console.log(`Telemetry saved to ${TELEMETRY_FILE}`);

  // Reaching a simulated fail state is telemetry, not a runner failure.
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function generateTestCases(
  archetypeIndex: number,
  maxRuns: number,
  baseSeed: number,
): SeededTestCase[] {
  return Array.from({ length: maxRuns }, (_, id) => ({
    id,
    seed: (baseSeed + archetypeIndex * maxRuns + id) >>> 0,
  }));
}

function buildSummary(results: TestResult[], duration: number): Summary {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const failures = results
    .filter(r => !r.passed)
    .map(r => ({
      testCase: r.testCase,
      archetype: r.archetype,
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
