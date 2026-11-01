/**
 * Slice-harness runner.
 *
 * Discovers every `scripts/*-test.ts` harness and runs it, so no module's checks are
 * left to be run by hand. This is what closes the "98 checks running manually" gap.
 *
 * The three CORE suites — engine-test, personal-allowance-revenue-test and
 * fiscal-drag-model-guard-test — are already compiled to CommonJS and executed by
 * `npm run test:engine`, so they are skipped here to avoid running them twice.
 *
 * Exits non-zero if any harness fails, or if discovery finds nothing at all (a runner
 * that passes vacuously is worse than no runner).
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const CORE_SUITES = new Set([
  'engine-test.ts',
  'personal-allowance-revenue-test.ts',
  'fiscal-drag-model-guard-test.ts',
]);

const suites = readdirSync('scripts')
  .filter((file) => file.endsWith('-test.ts') && !CORE_SUITES.has(file))
  .sort();

if (suites.length === 0) {
  console.error('run-slice-tests: no slice harnesses found in scripts/ — refusing to pass vacuously.');
  process.exit(1);
}

console.log(`run-slice-tests: ${suites.length} slice harness(es) to run.`);

const failed: string[] = [];
for (const suite of suites) {
  const file = `scripts/${suite}`;
  // Run each harness in its own process, matching the repo's `npx --yes tsx` convention.
  const result = spawnSync('npx', ['--yes', 'tsx', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed.push(file);
    console.error(`FAILED: ${file}`);
  }
}

console.log('');
console.log(`run-slice-tests: ${suites.length - failed.length}/${suites.length} harnesses passed.`);
if (failed.length > 0) {
  console.error(`run-slice-tests: failing harnesses: ${failed.join(', ')}`);
  process.exit(1);
}