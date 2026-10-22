export type RootStackParamList = {
  Menu: undefined;
  Create: undefined;
  Game: undefined;
};

export type Ideology = 'left' | 'centre-left' | 'centre' | 'centre-right' | 'right';

export interface Party {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  ideology: Ideology;
  leader: string;
  description: string;
  baseSupport: number;
  currentSupport: number;
  seats: number;
  funds: number;
}

export interface Relation {
  from: string;
  to: string;
  score: number;
}

export interface Metrics {
  approval: number;
  partyConfidence: number;
  economy: number;
  publicServices: number;
  security: number;
  mediaAttention: number;
}

export interface Effects {
  approval?: number;
  economy?: number;
  publicServices?: number;
  security?: number;
  partyConfidence?: number;
  mediaAttention?: number;
  supportDelta?: Record<string, number>;
  relationDelta?: Record<string, number>;
  fundsDelta?: number;
}

export interface Choice {
  id: string;
  text: string;
  consequence: string;
  effects: Effects;
}

export interface GameEvent {
  id: string;
  title: string;
  summary: string;
  sourceParty?: string;
  severity: 1 | 2 | 3 | 4 | 5;
  dialogs: { speaker: string | null; text: string }[];
  choices: Choice[];
}

export interface Player {
  firstName: string;
  lastName: string;
  partyId: string;
  background: string;
}

export type Phase = 'menu' | 'create' | 'playing';

export interface GameState {
  phase: Phase;
  player: Player | null;
  parties: Party[];
  relations: Relation[];
  metrics: Metrics;
  week: number;
  turnsUntilElection: number;
  isElection: boolean;
  activeEvent: GameEvent | null;
  dialogIndex: number;
  showChoices: boolean;
  chosenId: string | null;
  pendingChoice: Choice | null;
  lastOutcome: string | null;
  log: string[];
}

export type Action =
  | { type: 'NEW_GAME' }
  | { type: 'CREATE_PLAYER'; player: Player }
  | { type: 'START_TURN' }
  | { type: 'ADVANCE_DIALOG' }
  | { type: 'CHOOSE'; choiceId: string }
  | { type: 'DISMISS_EVENT' }
  | { type: 'RESTORE'; state: GameState };
