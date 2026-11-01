/**
 * Central-bank harness: default parity with the extracted MPC rule, plus independence.
 * Mirrors scripts/engine-test.ts: no framework, run with tsx.
 */
import {
  advanceCentralBank,
  appointMpcMember,
  createDefaultCentralBankState,
  credibilityPremium,
  independenceReading,
  leanOnTheBank,
  rateReviewDue,
  BANK_RATE_START,
  CREDIBILITY_PREMIUM_FLOOR,
  INDEPENDENCE_CREDIBILITY_START,
  RATE_STEP,
  type CentralBankState,
} from '../src/app/centralBank';

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

/** Week 13 is a quarter boundary; week 12 is not. */
const QUARTER_WEEK = 13;
const PLAIN_WEEK = 12;

function review(state: CentralBankState, cpi: number, gdp: number, week = QUARTER_WEEK) {
  return advanceCentralBank({ state, cpiInflation: cpi, gdpGrowth: gdp, week });
}

check('central-bank defaults are inert', () => {
  const s = createDefaultCentralBankState();
  assert.equal(s.bankRate, BANK_RATE_START);
  assert.equal(s.credibility, INDEPENDENCE_CREDIBILITY_START);
  assert.equal(s.pressure, 0);
  assert.equal(s.hawkishness, 0);
  assert.equal(s.lastReviewWeek, null);
  assert.equal(credibilityPremium(s), 0, 'intact credibility charges no premium');
});

check('DEFAULT PARITY: the vote reproduces the extracted hike rule exactly', () => {
  // The rule this replaced: cpi > 4.5 => { cpi -0.2, gdp -0.1, gilt +0.1 }.
  const r = review(createDefaultCentralBankState(), 6.4, 1.5);
  assert.equal(r.decision, 'hike');
  assert.equal(r.effects.cpiInflation, -0.2);
  assert.equal(r.effects.gdpGrowth, -0.1);
  assert.equal(r.effects.giltYield, 0.1);
  assert.equal(Object.keys(r.effects).length, 3, 'hike must carry exactly the old three effects');
  assert.equal(r.state.bankRate, BANK_RATE_START + RATE_STEP, 'the stored rate steps up');
});

check('DEFAULT PARITY: the vote reproduces the extracted cut rule exactly', () => {
  // The rule this replaced: cpi < 2.0 && gdp < 1.0 => { gdp +0.1, gilt -0.1 }.
  const r = review(createDefaultCentralBankState(), 1.5, 0.4);
  assert.equal(r.decision, 'cut');
  assert.equal(r.effects.gdpGrowth, 0.1);
  assert.equal(r.effects.giltYield, -0.1);
  assert.equal(Object.keys(r.effects).length, 2, 'cut must carry exactly the old two effects');
});

check('DEFAULT PARITY: the boundary cases hold — 4.5 does not hike, 2.0 does not cut', () => {
  // The old rule used strict inequalities; parity depends on keeping them strict.
  assert.equal(review(createDefaultCentralBankState(), 4.5, 1.5).decision, 'hold', '4.5 is not > 4.5');
  assert.equal(review(createDefaultCentralBankState(), 6.0, 0.5).decision, 'hike', 'high cpi hikes');
  assert.equal(review(createDefaultCentralBankState(), 2.0, 0.5).decision, 'hold', '2.0 is not < 2.0');
  assert.equal(review(createDefaultCentralBankState(), 1.9, 1.0).decision, 'hold', 'gdp 1.0 is not < 1.0');
  assert.equal(review(createDefaultCentralBankState(), 1.9, 0.9).decision, 'cut', 'both conditions cut');
});

check('a non-quarter week never reviews, and changes nothing', () => {
  const base = createDefaultCentralBankState();
  const r = review(base, 9.9, 0.1, PLAIN_WEEK);
  assert.equal(r.decision, 'hold');
  assert.equal(Object.keys(r.effects).length, 0);
  assert.equal(r.state, base, 'the state is returned untouched off-quarter');
  assert.equal(rateReviewDue(PLAIN_WEEK), false);
  assert.equal(rateReviewDue(QUARTER_WEEK), true);
});

check('leaning on the Bank costs credibility and moves the market', () => {
  const base = createDefaultCentralBankState();
  const leaned = leanOnTheBank(base);
  assert.equal(leaned.state.pressure, 1, 'the pressure is recorded');
  assert.ok(leaned.state.credibility < base.credibility, 'credibility falls');
  assert.ok((leaned.effects.giltYield ?? 0) > 0, 'the market charges more to lend');
  assert.equal(base.pressure, 0, 'the input is not mutated');
});

check('the credibility premium only appears once independence is damaged', () => {
  const base = createDefaultCentralBankState();
  assert.equal(credibilityPremium(base), 0);
  const damaged: CentralBankState = { ...base, credibility: CREDIBILITY_PREMIUM_FLOOR - 10 };
  assert.ok(credibilityPremium(damaged) > 0, 'below the floor a premium is charged');
  const wrecked: CentralBankState = { ...base, credibility: 0 };
  assert.ok(credibilityPremium(wrecked) > credibilityPremium(damaged), 'worse is dearer');
});

check('stacking the committee moves the thresholds, never the magnitudes', () => {
  const base = createDefaultCentralBankState();
  // At default, 4.4 is a hold.
  assert.equal(review(base, 4.4, 1.5).decision, 'hold');

  const hawks = appointMpcMember(appointMpcMember(base, 'hawk'), 'hawk');
  assert.equal(hawks.hawkishness, 2, 'hawks are counted');
  // A hawkish committee hikes sooner...
  const hawkish = review(hawks, 4.4, 1.5);
  assert.equal(hawkish.decision, 'hike', 'hawks hike at a lower rate of inflation');
  // ...but the magnitude is still exactly the old rule's.
  assert.equal(hawkish.effects.cpiInflation, -0.2, 'magnitudes are untouched by the committee');
  assert.equal(hawkish.effects.giltYield, 0.1);

  const doves = appointMpcMember(base, 'dove');
  assert.equal(doves.hawkishness, -1);
  assert.equal(review(doves, 2.4, 0.5).decision, 'cut', 'doves cut sooner');
});

check('the independence reading and the stored rate stay in bounds', () => {
  let state = createDefaultCentralBankState();
  for (let i = 0; i < 20; i += 1) state = leanOnTheBank(state).state;
  assert.equal(state.credibility, 0, 'credibility floors at zero, never negative');
  assert.ok(state.pressure === 20, 'every lean is recorded');

  let rate = createDefaultCentralBankState();
  for (let i = 0; i < 30; i += 1) rate = review(rate, 9.0, 1.0, 13 * (i + 1)).state;
  assert.ok(rate.bankRate > 0, 'the rate rises with repeated hikes');
  let falling = createDefaultCentralBankState();
  for (let i = 0; i < 40; i += 1) falling = review(falling, 0.5, 0.0, 13 * (i + 1)).state;
  assert.equal(falling.bankRate, 0, 'the rate can never go below zero');
  assert.ok(independenceReading(state) >= 0 && independenceReading(state) <= 1, 'reading in 0..1');
});

check('identical inputs produce identical output', () => {
  const base = createDefaultCentralBankState();
  const input = { state: base, cpiInflation: 5.1, gdpGrowth: 1.2, week: QUARTER_WEEK };
  assert.equal(JSON.stringify(advanceCentralBank(input)), JSON.stringify(advanceCentralBank(input)));
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' central-bank checks failed');
}
console.log('all ' + checks + ' central-bank checks passed');