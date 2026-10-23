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
  lettersThreshold: number;
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

export interface Minister {
  name: string;
  post: string;
  partyId: string;
  loyalty: number;
  competence: number;
  faction: string;
}

/** A backbench MP available for promotion to cabinet. */
export interface Backbencher {
  name: string;
  partyId: string;
  faction: string;
  loyalty: number;
  competence: number;
  ambition: number;
}

export interface ForeignIssue {
  id: string;
  leader: string;
  country: string;
  topic: string;
  options: { id: string; label: string; effects: Effects; summary: string }[];
}

export interface PmqQuestion {
  id: string;
  from: string;
  question: string;
  options: { id: string; label: string; effects: Effects }[];
}

export interface BudgetPackage {
  id: string;
  title: string;
  description: string;
  effects: Effects;
  kicker: string;
}

/** A single controllable tax lever. */
export interface TaxLever {
  id: string;
  name: string;
  rate: number;          // current rate (%)
  min: number;
  max: number;
  step: number;
  /** Approval sensitivity: how much the public reacts to this tax changing. */
  popularityWeight: number;
}

/** A government department whose budget the PM can set. */
export interface SpendingDept {
  id: string;
  name: string;
  budget: number;
  min: number;
  max: number;
  step: number;
  desc: string;
  benefit: Effects;
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
  cabinet: Minister[];
  factionUnrest: number;
  foreignIssues: ForeignIssue[];
  pmq: PmqQuestion | null;
  budgetDue: boolean;
  backbenchers: Backbencher[];
  termLength: number;
  taxes: TaxLever[];
  fiscalEventKind: 'budget' | 'autumn' | null;
  departments: SpendingDept[];
  legacyScore: number;
  termsWon: number;
  regionSeats: Record<string, Record<string, number>>; // regionId -> partyId -> seats
  ministerPicker: string | null; // backbencher name whose promotion is being confirmed
}

export type Action =
  | { type: 'NEW_GAME' }
  | { type: 'CREATE_PLAYER'; player: Player }
  | { type: 'START_TURN' }
  | { type: 'SET_TERM_LENGTH'; weeks: number }
  | { type: 'OPEN_DOSSIER'; dossierId: string }
  | { type: 'CLOSE_DOSSIER' }
  | { type: 'RESOLVE_DOSSIER'; dossierId: string; choiceId: string }
  | { type: 'PROPOSE_BILL'; billId: string }
  | { type: 'SACK_MINISTER'; name: string }
  | { type: 'APPOINT_MINISTER'; post: string }
  | { type: 'APPOINT_MINISTER_BY_NAME'; name: string }
  | { type: 'PICK_MINISTER'; name: string }
  | { type: 'CONFIRM_APPOINT'; post: string }
  | { type: 'CANCEL_APPOINT' }
  | { type: 'RESOLVE_FOREIGN'; issueId: string; optionId: string }
  | { type: 'ANSWER_PMQ'; optionId: string }
  | { type: 'DISMISS_PMQ' }
  | { type: 'DELIVER_BUDGET'; packageId: string }
  | { type: 'SKIP_BUDGET' }
  | { type: 'ADJUST_TAX'; taxId: string; delta: number }
  | { type: 'SET_AUTUMN_TAXES' }
  | { type: 'ADJUST_SPENDING'; deptId: string; delta: number }
  | { type: 'DISMISS_ELECTION' }
  | { type: 'RESTORE'; state: GameState };
