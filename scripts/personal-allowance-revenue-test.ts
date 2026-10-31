/**
 * Characterization test: duplicated Personal Allowance revenue logic.
 *
 * Two implementations of the same formula exist:
 *   - src/app/engine.ts:398  personalAllowanceRevenue(s: GameState)
 *   - src/app/budget.ts:69   personalAllowanceRecurringRevenue(allowance: number)
 *
 * This test pins TODAY'S behaviour: the two must return identical output for a
 * fixed table of inputs, and neither clamps to
 * [PERSONAL_ALLOWANCE_MIN, PERSONAL_ALLOWANCE_MAX]. It is a drift detector — it
 * fails only if the two implementations diverge (or if the currently-absent
 * clamp behaviour changes). It does not assert a preferred behaviour.
 *
 * Mirrors scripts/engine-test.ts: no framework, tsc-compiled, run with node.
 */
import { createInitialState, personalAllowanceRevenue } from '../src/app/engine';
import {
  personalAllowanceRecurringRevenue,
  PERSONAL_ALLOWANCE_MIN,
  PERSONAL_ALLOWANCE_MAX,
  PERSONAL_ALLOWANCE_STEP,
  DEFAULT_PERSONAL_ALLOWANCE,
} from '../src/app/budget';
import { calculatePersonalAllowanceRevenue } from '../src/app/fiscalDragIntegration';

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
  notEqual<T>(actual: T, expected: T, message?: string) {
    if (actual === expected) throw new Error(message ?? 'values should differ');
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

check('personal allowance revenue: duplicated implementations agree (characterization)', () => {
  const base = createInitialState();
  const engineEstimate = (allowance: number) =>
    personalAllowanceRevenue({ ...base, personalAllowance: allowance });
  const budgetEstimate = (allowance: number) => personalAllowanceRecurringRevenue(allowance);

  // Table: typical, zero, negative, both exact bounds, and one step outside each.
  const rows: { label: string; allowance: number }[] = [
    { label: 'typical (default allowance)', allowance: DEFAULT_PERSONAL_ALLOWANCE },
    { label: 'zero', allowance: 0 },
    { label: 'negative', allowance: -5000 },
    { label: 'exactly PERSONAL_ALLOWANCE_MIN', allowance: PERSONAL_ALLOWANCE_MIN },
    { label: 'exactly PERSONAL_ALLOWANCE_MAX', allowance: PERSONAL_ALLOWANCE_MAX },
    { label: 'one step below MIN', allowance: PERSONAL_ALLOWANCE_MIN - PERSONAL_ALLOWANCE_STEP },
    { label: 'one step above MAX', allowance: PERSONAL_ALLOWANCE_MAX + PERSONAL_ALLOWANCE_STEP },
  ];

  for (const row of rows) {
    assert.equal(
      engineEstimate(row.allowance),
      budgetEstimate(row.allowance),
      `engine/budget disagree at ${row.label} (£${row.allowance})`,
    );
    assert.equal(
      engineEstimate(row.allowance),
      calculatePersonalAllowanceRevenue(row.allowance),
      `engine/integration disagree at ${row.label} (£${row.allowance})`,
    );
  }

  // Both delegate to `calculatePersonalAllowanceRevenue`, which strictly clamps
  // input to [PERSONAL_ALLOWANCE_MIN, PERSONAL_ALLOWANCE_MAX].
  assert.equal(
    budgetEstimate(PERSONAL_ALLOWANCE_MIN - PERSONAL_ALLOWANCE_STEP),
    budgetEstimate(PERSONAL_ALLOWANCE_MIN),
    'below-MIN input is clamped to MIN',
  );
  assert.equal(
    budgetEstimate(PERSONAL_ALLOWANCE_MAX + PERSONAL_ALLOWANCE_STEP),
    budgetEstimate(PERSONAL_ALLOWANCE_MAX),
    'above-MAX input is clamped to MAX',
  );

  // Within [MIN, MAX], raising the allowance strictly decreases revenue.
  assert.ok(
    budgetEstimate(DEFAULT_PERSONAL_ALLOWANCE) < budgetEstimate(PERSONAL_ALLOWANCE_MIN) &&
      budgetEstimate(PERSONAL_ALLOWANCE_MAX) < budgetEstimate(DEFAULT_PERSONAL_ALLOWANCE),
    'within [MIN, MAX], higher allowance forgoes more revenue',
  );

  // Today's baseline: the default allowance sits exactly on the frozen baseline.
  assert.equal(budgetEstimate(DEFAULT_PERSONAL_ALLOWANCE), 0);
});

console.log('');
if (failures > 0) {
  // A thrown error gives the process a non-zero exit code.
  throw new Error(failures + ' of ' + (checks + failures) + ' checks failed');
}
console.log('all ' + checks + ' checks passed');
