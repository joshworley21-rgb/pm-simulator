import { createInitialState, reducer } from '../src/app/engine';

let s = createInitialState();
s = reducer(s, { type: 'SET_TERM_LENGTH', weeks: 60 });
s = reducer(s, {
  type: 'CREATE_PLAYER',
  player: { firstName: 'Test', lastName: 'PM', partyId: 'reform', background: 'City financier' },
});

let decisions = 0;
let budgets = 0;
let pmqs = 0;
let elections = 0;

for (let i = 0; i < 80; i++) {
  // Resolve everything on the desk each week
  while (s.redBox.length > 0) {
    const d = s.redBox[0];
    s = reducer(s, { type: 'RESOLVE_DOSSIER', dossierId: d.id, choiceId: d.choices[0].id });
    decisions++;
  }
  if (s.pmq) {
    s = reducer(s, { type: 'ANSWER_PMQ', optionId: s.pmq.options[0].id });
    pmqs++;
  }
  if (s.budgetDue) {
    s = reducer(s, { type: 'DELIVER_BUDGET', packageId: 'budget-middle' });
    budgets++;
  }
  if (s.isElection) {
    elections++;
    s = reducer(s, { type: 'DISMISS_ELECTION' });
  }
  if (s.gameOver) break;
  s = reducer(s, { type: 'START_TURN' });
}

console.log(
  JSON.stringify(
    {
      week: s.week,
      approval: Math.round(s.metrics.approval),
      partyConfidence: Math.round(s.metrics.partyConfidence),
      letters: s.stats.lettersOfNoConfidence,
      threshold: s.stats.lettersThreshold,
      budgetBalance: s.stats.budgetBalance,
      debt: s.stats.debtToGdp,
      inflation: s.stats.cpiInflation,
      seats: s.parties.map((p) => `${p.abbreviation}:${p.seats}`).join(' '),
      decisions,
      budgets,
      pmqs,
      elections,
      gameOver: s.gameOver,
      recent: s.log.slice(0, 6),
    },
    null,
    2,
  ),
);
