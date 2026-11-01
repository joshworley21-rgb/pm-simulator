/** Whips and ethics regression harness; run with tsx or compile with tsc. */
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

import { createInitialState } from '../src/app/engine';
import {
  advanceWhips,
  createDefaultWhips,
  divisionDisciplineModifier,
  estimateRebellionChance,
  patronageEffect,
} from '../src/app/modules/whips';
import {
  advanceEthics,
  beginInvestigation,
  createDefaultEthics,
  endCoverUp,
  startCoverUp,
} from '../src/app/modules/ethics';

let checks = 0;
let failures = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
    console.log('  ok   ' + name);
  } catch (error) {
    failures += 1;
    console.error('  FAIL ' + name);
    console.error(error);
  }
}

check('initial game creates default whips and ethics state', () => {
  const state = createInitialState();
  assert.ok(!!state.whips, 'whips state missing');
  assert.ok(!!state.ethics, 'ethics state missing');
  assert.equal(state.whips!.whipStrength, createDefaultWhips().whipStrength);
  assert.equal(state.ethics!.activeInvestigations.length, 0);
});

check('increasing faction unrest increases rebel pressure with the same seed', () => {
  const whips = createDefaultWhips();
  const calm = advanceWhips(whips, { factionUnrest: 20, partyConfidence: 50, seed: 17 });
  const unrest = advanceWhips(whips, { factionUnrest: 80, partyConfidence: 50, seed: 17 });
  assert.ok(unrest.state.rebelPressure > calm.state.rebelPressure);
});

check('patronage lowers rebel pressure and increases payroll votes', () => {
  const whips = { ...createDefaultWhips(), rebelPressure: 40, payrollVotes: 2 };
  const promoted = patronageEffect(whips);
  assert.ok(promoted.rebelPressure < whips.rebelPressure);
  assert.ok(promoted.payrollVotes > whips.payrollVotes);
  const chance = estimateRebellionChance(promoted);
  assert.ok(chance >= 0 && chance <= 1);
});

check('default discipline leaves every whip level unchanged', () => {
  const whips = createDefaultWhips();
  for (const whipLevel of ['two-line', 'three-line', 'free-vote'] as const) {
    const modifier = divisionDisciplineModifier(whips, whipLevel);
    assert.equal(modifier.voteSwing, 0);
    assert.equal(modifier.rebellionRiskDelta, 0);
    assert.equal(modifier.resentmentDelta, 0);
  }
});

check('high rebel pressure reduces two-line whip vote swing', () => {
  const whips = { ...createDefaultWhips(), rebelPressure: 90 };
  const modifier = divisionDisciplineModifier(whips, 'two-line');
  assert.ok(modifier.voteSwing < 0);
});

check('free vote ignores non-default discipline', () => {
  const whips = {
    ...createDefaultWhips(),
    whipStrength: 20,
    rebelPressure: 90,
    payrollVotes: 3,
    concessions: 4,
  };
  const modifier = divisionDisciplineModifier(whips, 'free-vote');
  assert.equal(modifier.voteSwing, 0);
  assert.equal(modifier.rebellionRiskDelta, 0);
  assert.equal(modifier.resentmentDelta, 0);
});

check('cover-up benefit is one-shot and deferred damage is later published', () => {
  let ethics = beginInvestigation(createDefaultEthics(), { id: 'test-inquiry', severity: 80 });
  ethics = startCoverUp(ethics);
  const firstWeek = advanceEthics(ethics, 1);
  assert.equal(firstWeek.approvalDelta, 2, 'starting a cover-up should grant its approval benefit');
  assert.equal(firstWeek.state.pendingApprovalDelta, 0);

  const secondWeek = advanceEthics(firstWeek.state, 1);
  assert.equal(secondWeek.approvalDelta, 0, 'cover-up benefit must not repeat');
  let covered = secondWeek.state;
  covered = advanceEthics(covered, 1).state;
  assert.ok(covered.deferredScandalDamage > 0, 'mature finding should be deferred during cover-up');

  covered = endCoverUp(covered);
  let exposed = false;
  for (let seed = 0; seed < 1000 && !exposed; seed += 1) {
    const result = advanceEthics(covered, seed);
    if (result.findings.some((finding) => finding.id === 'cover-up-exposed')) {
      assert.ok(result.findings[0].approvalHit < 0, 'exposure should publish a penalty');
      assert.equal(result.state.deferredScandalDamage, 0, 'exposure should clear deferred damage');
      exposed = true;
    }
  }
  assert.ok(exposed, 'no deterministic seed exposed deferred damage');
});

check('identical inputs and seeds produce identical module results', () => {
  const whips = createDefaultWhips();
  const input = { factionUnrest: 65, partyConfidence: 42, seed: 9182 };
  assert.equal(
    JSON.stringify(advanceWhips(whips, input)),
    JSON.stringify(advanceWhips(whips, input)),
  );

  const ethics = beginInvestigation(createDefaultEthics(), { id: 'repeatable', severity: 55 });
  assert.equal(
    JSON.stringify(advanceEthics(ethics, 9182)),
    JSON.stringify(advanceEthics(ethics, 9182)),
  );
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' whips/ethics checks failed');
}
console.log('all ' + checks + ' whips/ethics checks passed');
