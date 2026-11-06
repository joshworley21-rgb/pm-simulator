/**
 * Nation-action harness: the levers added to surface devolution, local
 * government, immigration, lobbying, the Bank, ethics, the Parliament Act,
 * by-election responses and the full trade-deal action set.
 *
 * No framework; run with tsx (or via `npm run test:slices`).
 */
import { createInitialState, reducer } from '../src/app/engine';
import { BILL_POOL } from '../src/app/bills';
import { beginInvestigation, createDefaultEthics } from '../src/app/modules/ethics';
import type { Action, GameState } from '../src/app/types';

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

function game(): GameState {
  const fresh = createInitialState();
  return reducer(fresh, {
    type: 'CREATE_PLAYER',
    player: {
      firstName: 'Test',
      lastName: 'Minister',
      partyId: 'reform',
      background: 'business',
    },
  });
}

const run = (state: GameState, action: Action) => reducer(state, action);

check('devolution: denying Sewel consent raises pressure and costs goodwill', () => {
  const before = game();
  const next = run(before, { type: 'DENY_SEWEL_CONSENT', nationId: 'scotland' });
  assert.ok(next.devolutionState, 'devolution state must exist');
  assert.equal(next.devolutionState!.nations.scotland.sewelDenials, 1);
  assert.ok(
    next.devolutionState!.nations.scotland.independencePressure >
      before.devolutionState!.nations.scotland.independencePressure,
    'pressure must rise',
  );
  assert.ok(next.metrics.approval < before.metrics.approval, 'approval must fall');
});

check('local government: an emergency grant clears s114 and reduces stress', () => {
  const before = game();
  const authority = before.localGovernmentState!.authorities[0];
  const stressed: GameState = {
    ...before,
    localGovernmentState: {
      ...before.localGovernmentState!,
      authorities: before.localGovernmentState!.authorities.map((a) =>
        a.id === authority.id ? { ...a, stress: 92, section114: true } : a,
      ),
    },
  };
  const next = run(stressed, { type: 'EMERGENCY_GRANT', authorityId: authority.id });
  const updated = next.localGovernmentState!.authorities.find((a) => a.id === authority.id)!;
  assert.equal(updated.section114, false);
  assert.ok(updated.stress < 92, 'stress must fall');
});

check('local government: commissioners clear the notice but leave the stress', () => {
  const before = game();
  const authority = before.localGovernmentState!.authorities[0];
  const stressed: GameState = {
    ...before,
    localGovernmentState: {
      ...before.localGovernmentState!,
      authorities: before.localGovernmentState!.authorities.map((a) =>
        a.id === authority.id ? { ...a, stress: 92, section114: true } : a,
      ),
    },
  };
  const next = run(stressed, { type: 'SEND_COMMISSIONERS', authorityId: authority.id });
  const updated = next.localGovernmentState!.authorities.find((a) => a.id === authority.id)!;
  assert.equal(updated.section114, false);
  assert.ok(updated.stress >= 80, 'commissioners should not fix the underlying stress');
});

check('immigration: caseworker capacity, removals toggle and removal flights', () => {
  const before = game();
  const resourced = run(before, { type: 'SET_CASEWORKER_CAPACITY', capacity: 50 });
  assert.equal(resourced.immigrationState!.caseworkerCapacity, 50);

  const blocked = run(resourced, { type: 'TOGGLE_REMOVALS_BLOCKED' });
  assert.equal(blocked.immigrationState!.removalsBlocked, true);
  const refused = run(blocked, { type: 'REMOVAL_FLIGHT', count: 20 });
  assert.equal(refused, blocked, 'a blocked flight must be a no-op');

  const open = run(blocked, { type: 'TOGGLE_REMOVALS_BLOCKED' });
  const loaded: GameState = {
    ...open,
    immigrationState: { ...open.immigrationState!, backlog: 200 },
  };
  const flown = run(loaded, { type: 'REMOVAL_FLIGHT', count: 20 });
  assert.ok(flown.immigrationState!.backlog < 200, 'backlog must fall');
});

check('lobbying: courting a group moves influence once per cooldown', () => {
  const before = game();
  const group = before.lobbyingState!.groups[0];
  const next = run(before, { type: 'LOBBY_GROUP', groupId: group.id, mode: 'court' });
  const after = next.lobbyingState!.groups.find((g) => g.id === group.id)!;
  assert.ok(after.influence > group.influence, 'influence must rise');
  assert.equal(next.lobbyingState!.lastLobbyWeek, next.week);

  const again = run(next, { type: 'LOBBY_GROUP', groupId: group.id, mode: 'court' });
  assert.equal(again, next, 'inside the cooldown the action must be refused');
});

check('the Bank: leaning costs credibility; appointments move the committee', () => {
  const before = game();
  const leaned = run(before, { type: 'LEAN_ON_BANK' });
  assert.ok(
    leaned.centralBankState!.credibility < before.centralBankState!.credibility,
    'credibility must fall',
  );
  const hawk = run(leaned, { type: 'APPOINT_MPC_MEMBER', kind: 'hawk' });
  assert.equal(hawk.centralBankState!.hawkishness, leaned.centralBankState!.hawkishness + 1);
});

check('ethics: admitting drops the investigation and takes a bounded hit', () => {
  const before = game();
  const withCase: GameState = {
    ...before,
    ethics: beginInvestigation(createDefaultEthics(), { id: 'test-case', severity: 15 }),
  };
  const next = run(withCase, { type: 'ADMIT_INVESTIGATION', investigationId: 'test-case' });
  assert.equal(next.ethics!.activeInvestigations.length, 0);
  assert.ok(next.metrics.approval < withCase.metrics.approval, 'admission must hurt');
  assert.equal(next.ethics!.coverUpActive, false);
});

check('ethics: cover-up toggles and can be called off', () => {
  const before = game();
  const withCase: GameState = {
    ...before,
    ethics: beginInvestigation(createDefaultEthics(), { id: 'test-case', severity: 15 }),
  };
  const covered = run(withCase, { type: 'START_COVER_UP' });
  assert.equal(covered.ethics!.coverUpActive, true);
  const clean = run(covered, { type: 'END_COVER_UP' });
  assert.equal(clean.ethics!.coverUpActive, false);
  const refused = run(clean, { type: 'END_COVER_UP' });
  assert.equal(refused, clean, 'ending a non-existent cover-up must be a no-op');
});

check('Parliament Act: forces a bill through once per term', () => {
  const before = game();
  const bill = BILL_POOL[0];
  const proposed = run(before, { type: 'PROPOSE_BILL', billId: bill.id, whipLevel: 'two-line' });
  assert.equal(proposed.bills.length, 1);

  const forced = run(proposed, { type: 'INVOKE_PARLIAMENT_ACT', billId: bill.id });
  assert.equal(forced.bills[0].weeksToPass, 0, 'the bill must resolve at the next sitting');
  assert.equal(forced.parliamentState!.parliamentActUses, 1);
  assert.ok(
    forced.metrics.partyConfidence < proposed.metrics.partyConfidence,
    'forcing the Lords must cost confidence',
  );

  const second = run(forced, { type: 'INVOKE_PARLIAMENT_ACT', billId: bill.id });
  assert.equal(second, forced, 'the Act is limited to once per term');
});

check('by-elections: the government can respond to a recent loss once', () => {
  const before = game();
  const lost: GameState = {
    ...before,
    byElections: [{ regionId: 'north', held: false, week: before.week }],
  };
  const visited = run(lost, { type: 'BY_ELECTION_RESPONSE', mode: 'visit' });
  assert.equal(visited.byElectionResponseWeek, before.week);
  assert.ok(visited.metrics.approval > lost.metrics.approval, 'visiting must help');
  const again = run(visited, { type: 'BY_ELECTION_RESPONSE', mode: 'visit' });
  assert.equal(again, visited, 'only one response per loss');
});

check('trade: ratify, expand and withdraw are all reachable', () => {
  const before = game();
  const concluded = run(before, {
    type: 'PURSUE_TRADE_DEAL',
    partner: 'china',
    action: 'conclude',
  });
  assert.equal(concluded.tradeDealStatus!.chinaTradeDeal!.status, 'ratified');

  const suspended = run(concluded, {
    type: 'PURSUE_TRADE_DEAL',
    partner: 'china',
    action: 'expire',
  });
  assert.equal(suspended.tradeDealStatus!.chinaTradeDeal!.status, 'expired');

  const withdrawn = run(suspended, {
    type: 'PURSUE_TRADE_DEAL',
    partner: 'china',
    action: 'withdraw',
  });
  assert.equal(withdrawn.tradeDealStatus!.chinaTradeDeal, null);
});

console.log(`\nall ${checks} nation-action checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
