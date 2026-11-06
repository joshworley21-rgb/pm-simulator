import type { Action, GameState } from './types';
import { reducer } from './engine';
import { autoSave } from '../storage/saveManager';

export * from './nationalMetrics';

/**
 * The single entry point for advancing the whole simulation.
 *
 * The reducer remains the source of truth (it handles every action, including
 * `START_TURN`, which runs the weekly loop). This wrapper exists so callers and
 * tests have one stable, immutable `processTurn(state, action)` contract even
 * if the reducer is split into smaller slices later.
 *
 * `START_TURN` is the end-of-turn boundary, so the new state is written to the
 * synchronous autosave slot before it is returned.
 */
export function processTurn(currentState: GameState, action: Action): GameState {
  const next = reducer(currentState, action);
  if (action.type === 'START_TURN') {
    autoSave(next);
  }
  return next;
}
