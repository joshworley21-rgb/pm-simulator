export type RootStackParamList = {
  Menu: undefined;
  Create: undefined;
  Game: undefined;
};

export type Ideology = 'left' | 'centre-left' | 'centre' | 'centre-right' | 'right';

export type Department =
  | 'Number 10'
  | 'HM Treasury'
  | 'Home Office'
  | 'DHSC (Health)'
  | 'Foreign Office'
  | 'Ministry of Defence'
  | 'Energy & Net Zero';

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

export interface NationalStats {
  cpiInflation: number;
  gdpGrowth: number;
  giltYield: number;
  nhsWaitingList: number;
  netMigration: number;
  lettersOfNoConfidence: number;
  lettersThreshold: number;   // 15% of parliamentary party (min 15)
  taxRate: number;
  debtToGdp: number;
  unemployment: number;
  budgetBalance: number;
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
  cpiInflation?: number;
  gdpGrowth?: number;
  giltYield?: number;
  nhsWaitingList?: number;
  netMigration?: number;
  lettersDelta?: number;
  taxRate?: number;
  debtToGdp?: number;
  unemployment?: number;
  budgetBalance?: number;
  supportDelta?: Record<string, number>;
  fundsDelta?: number;
}

export interface DossierChoice {
  id: string;
  label: string;
  summary: string;
  advice: string;
  effects: Effects;
}

export interface Dossier {
  id: string;
  title: string;
  department: Department;
  urgent: boolean;
  weeksRemaining: number;
  leadParagraph: string;
  body: string;
  choices: DossierChoice[];
}

export interface Bill {
  id: string;
  title: string;
  department: Department;
  description: string;
  fiscalCost: number;
  weeksToPass: number;
  rebellionRisk: number;
  effects: Effects;
  kicker: string;
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
  stats: NationalStats;
  week: number;
  turnsUntilElection: number;
  isElection: boolean;
  redBox: Dossier[];
  selectedDossierId: string | null;
  lastOutcome: string | null;
  bills: Bill[];
  passedLaws: string[];
  headlines: { paper: string; title: string; stance: 'left' | 'centrist' | 'right' }[];
  log: string[];
  seed: number;
  gameOver: string | null;
}

export type Action =
  | { type: 'NEW_GAME' }
  | { type: 'CREATE_PLAYER'; player: Player }
  | { type: 'START_TURN' }
  | { type: 'OPEN_DOSSIER'; dossierId: string }
  | { type: 'CLOSE_DOSSIER' }
  | { type: 'RESOLVE_DOSSIER'; dossierId: string; choiceId: string }
  | { type: 'PROPOSE_BILL'; billId: string }
  | { type: 'RESTORE'; state: GameState };
