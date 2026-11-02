/**
 * Emits a deterministic save fixture for the Playwright capture harness.
 *
 * Why this exists: at week 1 the Red Box has NO urgent briefings (no Black Swan
 * until week 26, no bills, no restless ministers), so the briefing action buttons
 * are unreachable and cannot be asserted. This fixture forces a realistic
 * late-term state where two of the three briefings are live:
 *
 *   - wash-up  : week 49 -> weeksToWashUp = 52 - 49 + 1 = 4 <= WASH_UP_WEEKS(4)
 *   - cabinet  : a minister at loyalty 22 (< 35 restless threshold)
 *
 * A Black Swan is deliberately NOT set: when `blackSwanState.active` is non-null
 * the global CrisisModal covers the whole app, so nothing else would be clickable.
 *
 * Output: artifacts/fixtures/redbox-state.json  (artifacts/ is gitignored)
 *
 * Run:  npx --yes tsx scripts/make-capture-fixture.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialState, reducer } from '../src/app/engine';
import { BACKGROUNDS } from '../src/app/data';
import { BILL_POOL } from '../src/app/bills';

const OUT = path.resolve('artifacts/fixtures/redbox-state.json');

let state = createInitialState();

state = reducer(state, {
  type: 'CREATE_PLAYER',
  player: {
    firstName: 'Alex',
    lastName: 'Worley',
    partyId: 'reform',
    background: BACKGROUNDS[0],
  },
});

// Force the late-term conditions described above.
const week = 49;
state = {
  ...state,
  week,
  // Keep well clear of purdah (> PURDAH_TURNS) while staying internally coherent.
  turnsUntilElection: Math.max(40, state.termLength - (week - 1)),
  bills: [{ ...BILL_POOL[0] }],
  cabinet: state.cabinet.map((m, i) => (i === 0 ? { ...m, loyalty: 22 } : m)),
};

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(state), 'utf8');

const restless = state.cabinet.filter((m) => m.loyalty < 35).length;
console.log(`fixture written: ${OUT}`);
console.log(`  week=${state.week}  bills=${state.bills.length}  restless=${restless}  swan=${state.blackSwanState?.active ?? 'none'}`);
