/**
 * Central game-loop / national-model harness.
 *
 * Exercises the immutable `processTurn` contract, the national metrics,
 * Commons balance, 12-portfolio cabinet model and the monthly drift rules.
 * Run with `npm run test:slices` or `npx --yes tsx scripts/gameLoop-test.ts`.
 */
import { createInitialState, migrateState, reducer } from '../src/app/engine';
import {
  COMMONS_TOTAL_SEATS,
  DEFAULT_TREASURY_RESERVES,
  KEY_DEPARTMENTS,
  applyMonthlyNationalDrift,
  debtInflationDrift,
  deriveCommonsBalance,
  deriveNationalMetrics,
  deriveNationalTensionIndex,
  deriveWhipDiscipline,
  flagshipRebellionChance,
  flagshipRebellionRiskDelta,
  isFlagshipBill,
  ministerialLoyaltyRisk,
  processTurn,
} from '../src/app/gameLoop';
import { createDefaultWhips } from '../src/app/modules/whips';
import { deriveTensionIndex } from '../src/app/tension';
import { AUTO_SAVE_SLOT, loadGameState } from '../src/storage/saveManager';
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

// ===== Fixtures =====

export function makeTestGame(): GameState {
  const initial = createInitialState();
  return reducer(initial, {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Test',
      lastName: 'PM',
      partyId: 'reform',
      background: 'City financier',
    },
  });
}

export function makeDebtState(publicDebtToGdp: number, budgetBalance: number): GameState {
  const base = makeTestGame();
  return {
    ...base,
    stats: { ...base.stats, debtToGdp: publicDebtToGdp, budgetBalance },
  };
}

export function makeWhipState(whipStrength: number, rebelPressure: number): GameState {
  const base = makeTestGame();
  return {
    ...base,
    whips: {
      ...createDefaultWhips(),
      whipStrength,
      rebelPressure,
    },
  };
}

export function makeFlagshipBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'flagship-test-bill',
    title: 'Flagship Reform Bill',
    department: 'HM Treasury',
    description: 'A test flagship bill.',
    fiscalCost: 1,
    weeksToPass: 1,
    rebellionRisk: 25,
    effects: {},
    kicker: 'FLAGSHIP TEST',
    whipLevel: 'three-line',
    ...overrides,
  };
}

export function makeLowLoyaltyCabinet(): GameState {
  const base = makeTestGame();
  return {
    ...base,
    cabinet: base.cabinet.map((minister) => ({ ...minister, loyalty: 20 })),
  };
}

// ===== processTurn =====

check('processTurn is immutable and advances exactly one week on START_TURN', () => {
  const state = makeTestGame();
  const snapshot = JSON.stringify(state);
  const next = processTurn(state, { type: 'START_TURN' });
  assert.equal(JSON.stringify(state), snapshot, 'processTurn mutated its input');
  assert.equal(next.week, state.week + 1, 'START_TURN should advance one week');
});

check('processTurn is deterministic for a fixed seed', () => {
  const a = makeTestGame();
  const b = makeTestGame();
  const left = processTurn(a, { type: 'START_TURN' });
  const right = processTurn(b, { type: 'START_TURN' });
  assert.equal(JSON.stringify(left), JSON.stringify(right), 'same state/action diverged');
});

check('processTurn autosaves the new state at the end of a turn', () => {
  const next = processTurn(makeTestGame(), { type: 'START_TURN' });
  const saved = loadGameState(AUTO_SAVE_SLOT);
  assert.ok(saved, 'expected an autosave');
  assert.equal(saved?.week, next.week);
  assert.equal(saved?.player?.firstName, next.player?.firstName);
});

// ===== National metrics =====

check('national metrics are derived, bounded and use the tension reading', () => {
  const state = makeTestGame();
  const metrics = deriveNationalMetrics(state);
  assert.equal(metrics.publicApproval, state.metrics.approval);
  assert.equal(metrics.treasuryReserves, DEFAULT_TREASURY_RESERVES);
  assert.equal(metrics.inflationRate, state.stats.cpiInflation);
  assert.equal(metrics.publicDebtToGdp, state.stats.debtToGdp);
  assert.equal(metrics.nationalTensionIndex, deriveTensionIndex(state).value);
  assert.equal(metrics.nationalTensionIndex, deriveNationalTensionIndex(state));
  assert.ok(metrics.publicApproval >= 0 && metrics.publicApproval <= 100);
  assert.ok(metrics.nationalTensionIndex >= 0 && metrics.nationalTensionIndex <= 100);
});

check('treasury reserves migrate safely from legacy saves', () => {
  const legacy: Partial<GameState> = { ...makeTestGame() };
  delete legacy.treasuryReserves;
  assert.equal(migrateState(legacy).treasuryReserves, DEFAULT_TREASURY_RESERVES);

  const broken = { ...legacy, treasuryReserves: -50 };
  assert.equal(migrateState(broken).treasuryReserves, 0, 'negative reserves clamped');
});

// ===== Commons =====

check('Commons balance partitions all 650 seats', () => {
  const state = makeTestGame();
  const commons = deriveCommonsBalance(state);
  const playerSeats =
    state.parties.find((party) => party.id === state.player?.partyId)?.seats ?? 0;

  assert.equal(commons.totalSeats, COMMONS_TOTAL_SEATS);
  assert.equal(commons.governmentPartySeats, playerSeats);
  assert.equal(
    commons.governmentPartySeats + commons.oppositionSeats + commons.minorPartySeats,
    COMMONS_TOTAL_SEATS,
    'seat buckets must sum to the whole House',
  );
  assert.ok(commons.whipDiscipline >= 0 && commons.whipDiscipline <= 100);
  assert.ok(commons.rebelliousBackbenchers <= commons.governmentPartySeats);
});

check('whip discipline falls when the whips lose control', () => {
  const healthy = deriveWhipDiscipline(createDefaultWhips());
  const strained = deriveWhipDiscipline({
    ...createDefaultWhips(),
    whipStrength: 10,
    rebelPressure: 95,
  });
  assert.ok(healthy > strained, 'strained whips must read as less disciplined');
  assert.ok(strained >= 0 && healthy <= 100);
});

// ===== Cabinet =====

check('cabinet has all 12 key portfolios with complete attributes', () => {
  const state = makeTestGame();
  assert.equal(state.cabinet.length, 12, 'expected a 12-minister cabinet');

  const posts = new Set(state.cabinet.map((minister) => minister.post));
  assert.equal(posts.size, 12, 'portfolio names must be unique');
  for (const post of KEY_DEPARTMENTS) {
    assert.ok(posts.has(post), 'missing portfolio: ' + post);
  }

  for (const minister of state.cabinet) {
    assert.ok(minister.name.length > 0, 'minister needs a name');
    assert.ok(minister.loyalty >= 0 && minister.loyalty <= 100, 'loyalty out of range');
    assert.ok(minister.competence >= 0 && minister.competence <= 100, 'competence out of range');
    assert.ok(minister.faction.length > 0, 'minister needs a faction');
    assert.ok(
      typeof minister.publicProfile === 'number' &&
        minister.publicProfile >= 0 &&
        minister.publicProfile <= 100,
      'public profile out of range for ' + minister.name,
    );
  }
});

// ===== Monthly drift =====

check('high debt and deficits raise the monthly inflation drift', () => {
  const calm = debtInflationDrift(makeDebtState(60, -50));
  const stressed = debtInflationDrift(makeDebtState(160, -150));
  assert.equal(calm, 0, 'a low-debt, low-deficit state should not drift');
  assert.ok(stressed > calm, 'high debt must drift more than low debt');

  const drifted = applyMonthlyNationalDrift(makeDebtState(160, -150));
  assert.ok(
    drifted.stats.cpiInflation > 2.8,
    'stressed debt must add inflation pressure',
  );
});

check('the monthly inflation drift is inert for a healthy balance sheet', () => {
  const calm = makeDebtState(60, -50);
  assert.equal(applyMonthlyNationalDrift(calm), calm, 'no-op must preserve identity');
});

check('low whip discipline increases flagship rebellion risk', () => {
  const bill = makeFlagshipBill();
  const healthy = makeWhipState(75, 10);
  const strained = makeWhipState(10, 95);

  assert.ok(isFlagshipBill(bill));
  assert.equal(flagshipRebellionRiskDelta(healthy, bill), 0, 'healthy whips add no surcharge');
  assert.ok(flagshipRebellionRiskDelta(strained, bill) > 0, 'strained whips add risk');
  assert.ok(
    flagshipRebellionChance(strained, bill) > flagshipRebellionChance(healthy, bill),
    'rebellion chance must rise',
  );
});

check('non-flagship bills get a much smaller discipline exposure', () => {
  const bill = makeFlagshipBill({ id: 'minor-bill', rebellionRisk: 5, whipLevel: 'two-line' });
  const strained = makeWhipState(10, 95);
  assert.equal(isFlagshipBill(bill), false);
  assert.equal(flagshipRebellionRiskDelta(strained, bill), 0);
  assert.ok(
    flagshipRebellionChance(strained, bill) < flagshipRebellionChance(strained, makeFlagshipBill()),
    'minor bills should be less exposed than flagship bills',
  );
});

check('low cabinet loyalty raises leak and resignation risk', () => {
  const healthy = ministerialLoyaltyRisk(makeTestGame().cabinet);
  const disloyal = ministerialLoyaltyRisk(makeLowLoyaltyCabinet().cabinet);

  assert.equal(healthy.leakChance, 0, 'a loyal cabinet keeps the baseline leak chance');
  assert.equal(healthy.resignationChance, 0, 'a loyal cabinet keeps the baseline resignation chance');
  assert.ok(disloyal.leakChance > healthy.leakChance, 'leaks must rise');
  assert.ok(
    disloyal.resignationChance > healthy.resignationChance,
    'resignations must rise',
  );
  assert.equal(ministerialLoyaltyRisk([]).leakChance, 0, 'an empty cabinet has no risk');
});

console.log('');
console.log(`gameLoop tests: ${checks - failures}/${checks} checks passed.`);
if (failures > 0) process.exit(1);
