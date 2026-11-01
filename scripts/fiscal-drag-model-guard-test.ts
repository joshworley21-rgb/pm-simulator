/**
 * Guard test: the engine's fiscal-drag model relationship.
 *
 * Pins ONLY the engine-model behaviour for threshold freezing:
 *   1. the recurring model output (`fiscalDragRevenue`) is what `structuralBalance`
 *      consumes, counted exactly once; and
 *   2. `calculateFiscalDrag` — the function the deficit already uses — gates
 *      revenue on the rate cutoffs (frozen => positive, indexed => zero).
 *
 * It deliberately does NOT pin any preview/display figure (the flat `8` / `2`
 * in budget.ts, or the Workbench text). Those belong to decision 1 and will be
 * replaced when the displayed value is derived from this model.
 *
 * Mirrors scripts/engine-test.ts: no framework, tsc-compiled, run with node.
 */
import { createInitialState, structuralBalance } from '../src/app/engine';
import { calculateCustomBudget, getDefaultCustomPlan } from '../src/app/budget';
import { calculateFiscalDrag, FROZEN_THRESHOLDS, previewFiscalDrag } from '../src/app/fiscalDragIntegration';

/** Minimal assertion shim so this file needs no node type definitions. */
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

check('fiscal drag model: structuralBalance carries the engine model drag exactly once', () => {
  const base = createInitialState();
  const without = structuralBalance({ ...base, fiscalDragRevenue: 0 });
  const withSeven = structuralBalance({ ...base, fiscalDragRevenue: 7 });
  assert.equal(
    Math.round((withSeven - without) * 10) / 10,
    7,
    'structuralBalance must include fiscalDragRevenue exactly once',
  );
});

check('fiscal drag model: calculateFiscalDrag gates revenue on the rate cutoffs', () => {
  const baseParams = {
    personalAllowance: FROZEN_THRESHOLDS.personalAllowance,
    basicRateCutoff: FROZEN_THRESHOLDS.basicRateCutoff,
    higherRateCutoff: FROZEN_THRESHOLDS.higherRateCutoff,
    additionalRateCutoff: FROZEN_THRESHOLDS.additionalRateCutoff,
    basicRate: 20,
    higherRate: 40,
    additionalRate: 45,
    cpiInflation: 4,
    realIncomeGrowth: 1,
    fiscalYear: 2025,
  };

  const frozen = calculateFiscalDrag(baseParams);
  // Re-pinned 7.3 -> 7.4: calculateFiscalDrag now uses the nominal GDP cross-term
  // (real x inflation / 100), i.e. 5.04% rather than 5% at growth 1 / cpi 4.
  assert.equal(frozen.additionalRevenue, 7.4, 'engine model value at cpi 4 / growth 1 (frozen cutoffs)');

  const indexed = calculateFiscalDrag({
    ...baseParams,
    basicRateCutoff: Math.round(FROZEN_THRESHOLDS.basicRateCutoff * 1.04),
  });
  assert.equal(indexed.additionalRevenue, 0, 'indexed cutoffs must yield zero drag');
});

check('fiscal drag model: previewFiscalDrag and calculateCustomBudget agree across inflation levels', () => {
  const base = createInitialState();
  const s = { ...base, thresholdsFrozen: true, stats: { ...base.stats, cpiInflation: 4, gdpGrowth: 1 } };

  const expectedFrozen = previewFiscalDrag(s, true).additionalRevenue;
  assert.equal(expectedFrozen, 7.4, 'previewFiscalDrag yields ~£7.4bn at cpi 4 / growth 1');
  assert.equal(previewFiscalDrag(s, false).additionalRevenue, 0, 'previewFiscalDrag yields 0 when indexed');

  const keepingFrozen = calculateCustomBudget({ ...getDefaultCustomPlan(s), thresholdsFrozen: true }, s);
  assert.equal(keepingFrozen.fiscalDragRecurring, expectedFrozen, 'standing recurring drag matches previewFiscalDrag');
  assert.equal(keepingFrozen.fiscalDragRevenue, 0, 'no status change means no one-off delta in netDelta');

  const unfreezing = calculateCustomBudget({ ...getDefaultCustomPlan(s), thresholdsFrozen: false }, s);
  assert.equal(unfreezing.fiscalDragRecurring, 0, 'unfreezing clears standing recurring drag');
  assert.equal(unfreezing.fiscalDragRevenue, -expectedFrozen, 'unfreezing scores the dynamic one-off gap');
});

console.log('');
if (failures > 0) {
  // A thrown error gives the process a non-zero exit code.
  throw new Error(failures + ' of ' + (checks + failures) + ' checks failed');
}
console.log('all ' + checks + ' checks passed');
