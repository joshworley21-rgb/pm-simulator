// @ts-ignore
const fs = require('fs');
import { createInitialState, reducer } from '../src/app/engine';

const NUM_SIMULATIONS = 10000;
const MAX_TURNS = 50; 
const crashes: any[] = [];

for (let sim = 1; sim <= NUM_SIMULATIONS; sim++) {
  let state: any;
  const playHistory: any[] = [];
  
  try {
    state = createInitialState(); 
  } catch (error: any) {
    crashes.push({ simId: sim, turn: 0, error: 'Failed to initialize state', details: error.message });
    continue;
  }

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    try {
      // 1. Check if there are events to resolve
      if (state.redBox && state.redBox.length > 0) {
        // Pick a random dossier
        const randomDossier = state.redBox[Math.floor(Math.random() * state.redBox.length)];
        
        // Dynamically find a valid option if the dossier has them, otherwise fallback to a generic string
        const options = randomDossier.options || [{ id: 'approve' }, { id: 'reject' }];
        const randomOption = options[Math.floor(Math.random() * options.length)];
        
        const action = { 
          type: 'RESOLVE_DOSSIER', 
          dossierId: randomDossier.id, 
          outcome: randomOption.id || randomOption 
        };

        state = reducer(state, action as any);
        playHistory.push({ turn, action });
      }

      // 2. Advance the turn to populate the next batch of events
      state = reducer(state, { type: 'START_TURN' } as any);

      // 3. State validation checks
      if (!state) throw new Error("Reducer returned undefined or null state.");
      if (!state.phase) throw new Error("State phase became undefined (engine got stuck).");

    } catch (error: any) {
      crashes.push({
        simId: sim,
        crashedOnTurn: turn,
        errorMessage: error.message || String(error),
        fatalHistory: playHistory // This is the goldmine: it tells you exactly what sequence broke the game
      });
      break; 
    }
  }
}

const output = {
  totalSimulations: NUM_SIMULATIONS,
  totalCrashes: crashes.length,
  crashRate: `${((crashes.length / NUM_SIMULATIONS) * 100).toFixed(2)}%`,
  sampleCrashes: crashes.slice(0, 50) 
};

fs.writeFileSync('redbox-crawler-results.json', JSON.stringify(output, null, 2));
