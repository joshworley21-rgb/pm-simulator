// @ts-ignore
const fs = require('fs');
import { createInitialState, reducer } from '../src/app/engine';

const NUM_SIMULATIONS = 10000;
const MAX_TURNS = 10;
const failures: any[] = [];

for (let sim = 1; sim <= NUM_SIMULATIONS; sim++) {
  let state = createInitialState(); 
  const playHistory: any[] = [];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // 1. Dynamically build random budgets and taxes based on the current state's IDs
    const randomPlan: any = {
      departmentBudgets: {},
      taxRates: {}
    };

    // Randomize department budgets (between 50% and 150% of their current budget)
    if (state.departments) {
      state.departments.forEach((d: any) => {
        const currentBudget = d.budget || 100;
        const changeMultiplier = 0.5 + Math.random(); 
        randomPlan.departmentBudgets[d.id] = Math.floor(currentBudget * changeMultiplier);
      });
    }

    // Randomize tax rates (between 10% and 60%)
    if (state.taxes) {
      state.taxes.forEach((t: any) => {
        randomPlan.taxRates[t.id] = Math.floor(Math.random() * 50) + 10;
      });
    }

    // 2. Format the action exactly as the engine expects it
    const randomAction = {
      type: 'DELIVER_CUSTOM_BUDGET',
      plan: randomPlan
    };

    // 3. Process the turn
    let nextState = reducer(state, randomAction as any);
    
    // Advance the time so the engine calculates the new stats!
    nextState = reducer(nextState, { type: 'START_TURN' } as any);

    console.log("Turn:", turn, "Debt:", nextState.stats.debtToGdp);

    
    // Note: If DELIVER_CUSTOM_BUDGET only updates the arrays but doesn't advance time, 
    // uncomment the line below to also trigger your time-step action so stats calculate.
    // nextState = reducer(nextState, { type: 'ADVANCE_WEEK' } as any);

    playHistory.push({ turn, action: randomAction, resultingState: nextState });

    // 4. Check for economic collapse
    const debtSpiraled = nextState.stats.debtToGdp > 150; 
    const hyperInflation = nextState.stats.cpiInflation > 15.0;
    const marketCrash = nextState.stats.gdpGrowth < -10.0;

    if (debtSpiraled || hyperInflation || marketCrash) {
      failures.push({
        simId: sim,
        crashedOnTurn: turn,
        failureReason: debtSpiraled ? 'Debt Crisis' : (hyperInflation ? 'Hyperinflation' : 'Market Crash'),
        fatalAction: randomAction,
        // Optional: only save the stats rather than the whole massive state object to keep the JSON small
        resultingStats: nextState.stats 
      });
      break; 
    }
    
    state = nextState;
  }
}

const output = {
  totalSimulations: NUM_SIMULATIONS,
  totalFailures: failures.length,
  failureRate: `${((failures.length / NUM_SIMULATIONS) * 100).toFixed(2)}%`,
  sampleFailures: failures.slice(0, 50) 
};

fs.writeFileSync('fuzzer-results.json', JSON.stringify(output, null, 2));
