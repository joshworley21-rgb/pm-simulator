/**
 * Cabinet meeting harness: attendance, agenda and engine round-trip.
 */
import { createInitialState, migrateState, reducer } from '../src/app/engine';
import {
  buildCabinetAttendees,
  buildCabinetMeeting,
  isCabinetMeetingDue,
  resolveCabinetMeeting,
} from '../src/app/cabinetMeeting';
import type { CabinetMeetingPlan } from '../src/app/cabinetMeeting';

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
    if (actual === expected) {
      throw new Error(message ?? 'expected values to differ');
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

const base = createInitialState();
const meeting = buildCabinetMeeting(base);
const plan: CabinetMeetingPlan = {
  decisions: meeting.items.map((item) => ({
    itemId: item.id,
    optionId: item.options[0].id,
  })),
  bilateralChoices: Object.fromEntries(
    meeting.bilaterals.map((bilateral) => [bilateral.id, bilateral.options[0].id]),
  ),
  quadOptionId: meeting.quad.options[0].id,
  collectiveResponsibility: 'united',
};

check('meetings unlock once per month', () => {
  assert.equal(isCabinetMeetingDue(base), true, 'first meeting is due');
  assert.equal(isCabinetMeetingDue({ ...base, lastCabinetMeetingWeek: base.week }), false);
  assert.equal(isCabinetMeetingDue({ ...base, lastCabinetMeetingWeek: base.week - 1 }), true);
});

check('the whole cabinet and the senior officials are in the room', () => {
  const attendees = buildCabinetAttendees(base);
  assert.equal(attendees[0].role, 'Prime Minister');
  assert.ok(attendees.some((person) => person.role === 'Cabinet Secretary'), 'Cabinet Secretary');
  assert.ok(attendees.some((person) => person.role === 'Chief Whip'), 'Chief Whip');
  assert.ok(attendees.some((person) => person.role === 'Attorney General'), 'Attorney General');
  assert.ok(attendees.some((person) => person.role === 'National Security Adviser'), 'NSA');
  for (const minister of base.cabinet) {
    assert.ok(attendees.some((person) => person.name === minister.name), minister.name + ' is present');
  }
});

check('the agenda covers the economy, services, home affairs and the world', () => {
  assert.equal(meeting.items.length, 4);
  assert.ok(meeting.items.every((item) => item.options.length >= 2), 'every item offers a choice');
  assert.ok(meeting.items.every((item) => item.contributions.length >= 2), 'every item has a discussion');
});

check('every minister contributes to the meeting', () => {
  const speakers = new Set(meeting.items.flatMap((item) => item.contributions.map((person) => person.name)));
  for (const minister of base.cabinet) {
    assert.ok(speakers.has(minister.name), minister.name + ' has a line');
  }
});

check('resolving a full set of decisions produces effects and a record', () => {
  const outcome = resolveCabinetMeeting(meeting, plan, base);
  assert.ok(outcome, 'valid decisions resolve');
  assert.ok(outcome!.summary.startsWith('Cabinet meeting:'), 'summary');
  assert.ok(outcome!.log[0].startsWith('CABINET MEETING:'), 'log');
  assert.ok(Object.keys(outcome!.effects).length > 0, 'combined effects');
  assert.ok(Object.keys(outcome!.loyaltyByName).length > 0, 'minister loyalty moves');
});

check('an incomplete or unknown decision set is rejected', () => {
  assert.equal(resolveCabinetMeeting(meeting, { ...plan, decisions: plan.decisions.slice(0, 2) }, base), null);
  assert.equal(
    resolveCabinetMeeting(meeting, { ...plan, decisions: [{ itemId: meeting.items[0].id, optionId: 'not-real' }] }, base),
    null,
  );
  assert.equal(
    resolveCabinetMeeting(meeting, { ...plan, bilateralChoices: {}, quadOptionId: meeting.quad.options[0].id }, base),
    null,
  );
});

check('the minutes record the Quad, bilaterals and collective responsibility', () => {
  const outcome = resolveCabinetMeeting(meeting, plan, base);
  assert.ok(outcome, 'valid plan resolves');
  assert.ok(outcome!.record.quad?.choice, 'Quad minute');
  assert.equal(outcome!.record.bilaterals.length, meeting.bilaterals.length, 'bilateral minutes');
  assert.equal(outcome!.record.items.length, 4, 'agenda minutes');
  assert.equal(outcome!.record.collectiveResponsibility, 'united', 'collective responsibility recorded');
  assert.ok(outcome!.record.loyaltyChanges.length > 0, 'loyalty changes recorded');
});

check('the meeting month survives save and restore', () => {
  const restored = migrateState({ ...base, lastCabinetMeetingWeek: 5 });
  assert.equal(restored.lastCabinetMeetingWeek, 5);
  assert.equal(migrateState({ ...base, lastCabinetMeetingWeek: undefined }).lastCabinetMeetingWeek, undefined);
});

check('the engine stamps the meeting, applies the outcome and blocks a repeat', () => {
  const next = reducer(base, { type: 'HOLD_CABINET_MEETING', plan });
  assert.equal(next.lastCabinetMeetingWeek, base.week, 'meeting month stamped');
  assert.ok((next.lastOutcome ?? '').startsWith('Cabinet meeting:'), 'outcome recorded');
  assert.ok(next.log[0].startsWith('CABINET MEETING:'), 'record entry written');
  assert.notEqual(next.cabinetState?.cohesion, base.cabinetState?.cohesion, 'cohesion moved');

  const repeated = reducer(next, { type: 'HOLD_CABINET_MEETING', plan });
  assert.equal(repeated, next, 'a second meeting in the same month is a no-op');
});

console.log('');
if (failures > 0) {
  throw new Error(failures + ' of ' + (checks + failures) + ' cabinet-meeting checks failed');
}
console.log('all ' + checks + ' cabinet-meeting checks passed');
