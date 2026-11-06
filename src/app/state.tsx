import React, { createContext, useContext, useReducer } from 'react';
import type { GameState, Action } from './types';
import { createInitialState } from './engine';
import { processTurn } from './gameLoop';
import { AUTO_SAVE_SLOT, loadGameState } from '../storage/saveManager';

interface Ctx {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}

const GameContext = createContext<Ctx | null>(null);

function initialState(): GameState {
  return loadGameState(AUTO_SAVE_SLOT) ?? createInitialState();
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  // The reducer is wrapped by processTurn, which autosaves at the end of every turn.
  const [state, dispatch] = useReducer(processTurn, undefined, initialState);

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame(): Ctx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
