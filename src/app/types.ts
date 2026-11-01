import type { UKTradeDealStatus, TradePartner } from './tradeDeals';
import type { NHSMetrics } from './nhsMetrics';
import type { WhipsState } from './modules/whips';
import type { EthicsState } from './modules/ethics';
import type { CabinetState } from './cabinet';
import type { MediaState } from './media';
import type { ImmigrationState } from './immigration';
import type { LocalGovernmentState } from './localGovernment';
import type { ParliamentState } from './parliament';
import type { LobbyingState } from './lobbying';
import type { DevolutionState } from './devolution';

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
  leaderPersona?: string;
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

export type WhipLevel = 'three-line' | 'two-line' | 'free-vote';

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
  whipLevel?: WhipLevel;
}

export interface Minister {
  name: string;
  post: string;
  partyId: string;
  loyalty: number;
  competence: number;
  faction: string;
  /** True when the minister comes from a coalition partner. */
  coalition?: boolean;
  /** Ambition 0-100: restive, ambitious ministers can rebel in a division. */
  ambition?: number;
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
  /** Who is asking: the Leader of the Opposition, or the third party. */
  asker?: 'loto' | 'third';
  /** 1-based question number within the session. */
  round?: number;
  /** Six questions from LOTO, then two from the third party. */
  total?: number;
}

export interface BudgetPackage {
  id: string;
  title: string;
  description: string;
  effects: Effects;
  kicker: string;
}

/** A bespoke, full-control UK Budget plan assembled by the PM & Chancellor. */
export interface CustomBudgetPlan {
  title?: string;
  departmentBudgets: Record<string, number>;
  taxRates: Record<string, number>;
  personalAllowance: number;
  /** Annual Budget cycles the nominal allowance stays frozen; 0 = no freeze (uprating resumes). */
  personalAllowanceFreezeYears: number;
  fuelDutyFrozen: boolean;
  /** Whether SDLT nil-rate bands are raised (true) or higher rates maintained (false). */
  stampDutyRelief: boolean;
  thresholdsFrozen: boolean;
  publicSectorPay: 'full' | 'capped';
  tripleLock: boolean;
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
  /** Secondary levy that a limited emergency action may move outside a fiscal event. */
  emergency?: boolean;
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
  /** Starting scenario id (see scenarios.ts). */
  scenario?: string;
}

export type Phase = 'menu' | 'create' | 'playing';

export interface GameState {
  phase: Phase;
  player: Player | null;
  parties: Party[];
  relations: Relation[];
  metrics: Metrics;
  stats: NationalStats;
  /** Nominal GDP (£bn), used to scale primary borrowing in debt dynamics. */
  nominalGdp?: number;
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
  /** IDs of PMQ questions already asked during the active 8-question session (prevents repeats). */
  pmqSessionAskedIds?: string[];
  /** Rolling history of recent question IDs across sessions (cooldown to prevent repetition). */
  pmqRecentIds?: string[];
  budgetDue: boolean;
  /** Emergency off-cycle levy changes used this parliamentary term. */
  emergencyFiscalActions?: number;
  backbenchers: Backbencher[];
  termLength: number;
  taxes: TaxLever[];
  fiscalEventKind: 'budget' | 'autumn' | null;
  departments: SpendingDept[];
  legacyScore: number;
  termsWon: number;
  regionSeats: Record<string, Record<string, number>>; // regionId -> partyId -> seats
  ministerPicker: string | null; // backbencher name whose promotion is being confirmed

  // ===== Simulation telemetry (written weekly by the engine) =====
  /** Scenario this game started from. */
  scenarioId?: string;
  /** By-election results during the parliament. */
  byElections?: { regionId: string; held: boolean; week: number }[];
  /** Week of the last mid-term reshuffle, so they cannot chain. */
  lastReshuffleWeek?: number;
  /** Party-confidence points still baked in from the last qualifying reshuffle. */
  reshuffleDisciplineBonus?: number;
  /** True once the one-off minority-government confidence warning has been issued. */
  confidenceWarningShown?: boolean;
  /** Dossier IDs whose ignored-crisis escalation has already been applied. */
  escalatedDossierIds?: string[];

  /** Two manifesto promises judged at the next election. */
  pledges?: import('./pledges').Pledge[];
  /** Voter bloc breakdown, recomputed weekly. */
  blocs?: import('./voterBlocs').BlocSupport[];
  /** Opposition motion of no confidence, if one is tabled. */
  oppositionMotion?: { sponsorPartyId: string; tabledWeek: number; scheduledWeek: number };
  /** True when the partner is in government, not merely supplying votes. */
  coalition?: boolean;
  /** Cabinet posts handed to the coalition partner. */
  coalitionPosts?: string[];

  /** Party propping up a minority government (confidence and supply). */
  supplyPartnerId?: string;
  /** Weekly cost of the arrangement, GBP bn. */
  supplyCostPerWeek?: number;
  /** Promises made to the partner. */
  supplyConcessions?: string[];

  /** Result of the most recent 1922 Committee confidence ballot. */
  lastVote?: {
    votesFor: number;
    votesAgainst: number;
    survived: boolean;
    resignedWithoutBallot: boolean;
    turn: number;
  };
  /** NHS performance index 0-100, derived from waiting times each week. */
  nhsPerformance?: number;
  /** Extra revenue from frozen thresholds, £bn per year. */
  fiscalDragRevenue?: number;
  /** Bracket-creep intensity bucket. */
  fiscalDragIntensity?: 'low' | 'medium' | 'high' | 'very_high';
  /** Taxpayers dragged into a higher band this year. */
  taxpayersAffectedByDrag?: number;
  /** Weeks the thresholds have been frozen. */
  thresholdFrozenTurns?: number;
  /** Whether income-tax and NI thresholds are frozen (default true) or indexed. */
  thresholdsFrozen?: boolean;
  /** GDP contribution from current trade arrangements (%). */
  tradeGdpImpact?: number;
  /** Current UK trade deal status across major partners. */
  tradeDealStatus?: UKTradeDealStatus;
  /** Detailed NHS clinical and operational indicators derived each week. */
  nhsMetrics?: NHSMetrics;
  /** 1922 Committee mood snapshot. */
  committeeMood?: {
    averageLoyalty: number;
    averageAmbition: number;
    consideringDefection: number;
    readyToChallenge: number;
    activeFactions: string[];
  };
  /** 1922 Committee blindside leadership challenge risk (0-100). */
  blindsideRisk?: number;
  /** Personal tax-free income allowance (£/year, default £12,570). */
  personalAllowance?: number;
  /**
   * Remaining annual Budget cycles the nominal Personal Allowance is held
   * frozen. Decremented once per annual Budget boundary; 0 = not frozen, and
   * the allowance is uprated by the CPI-like proxy at each boundary.
   */
  personalAllowanceFreezeYears?: number;
  /** Whether the 5p fuel duty freeze is maintained (true) or escalator restored (false). */
  fuelDutyFrozen?: boolean;
  /** Whether SDLT nil-rate bands are raised (true) or higher rates maintained (false). */
  stampDutyRelief?: boolean;
  /** Whether the State Pension Triple Lock is maintained (true) or indexed to wages only (false). */
  tripleLock?: boolean;
  /** Whether public sector pay awards are fully funded ('full') or capped ('capped'). */
  publicSectorPay?: 'full' | 'capped';
  /** OBR fiscal headroom (£bn) against Treasury debt & deficit fiscal rules. */
  obrHeadroom?: number;
  /** OBR fiscal sustainability assessment. */
  obrAssessment?: 'compliant' | 'tight' | 'breach';
  /** Cross-Whitehall Spending Review efficiency savings target (0%, 2%, or 4%). */
  efficiencyTargetPct?: 0 | 2 | 4;
  whips?: WhipsState;
  ethics?: EthicsState;
  cabinetState?: CabinetState;
  mediaState?: MediaState;
  immigrationState?: ImmigrationState;
  localGovernmentState?: LocalGovernmentState;
  parliamentState?: ParliamentState;
  lobbyingState?: LobbyingState;
  devolutionState?: DevolutionState;
}

export type Action =
  | { type: 'NEW_GAME' }
  | { type: 'CREATE_PLAYER'; player: Player }
  | { type: 'START_TURN' }
  | { type: 'SET_TERM_LENGTH'; weeks?: number; months?: number }
  | { type: 'CALL_EARLY_ELECTION' }
  | { type: 'OPEN_DOSSIER'; dossierId: string }
  | { type: 'CLOSE_DOSSIER' }
  | { type: 'RESOLVE_DOSSIER'; dossierId: string; choiceId: string }
  | { type: 'PROPOSE_BILL'; billId: string; whipLevel?: WhipLevel }
  | { type: 'SACK_MINISTER'; name: string }
  | { type: 'PICK_MINISTER'; name: string }
  | { type: 'CONFIRM_APPOINT'; post: string }
  | { type: 'CANCEL_APPOINT' }
  | { type: 'RESOLVE_FOREIGN'; issueId: string; optionId: string }
  | { type: 'ANSWER_PMQ'; optionId: string }
  | { type: 'DISMISS_PMQ' }
  | { type: 'DELIVER_BUDGET'; packageId?: string; customPlan?: CustomBudgetPlan }
  | { type: 'DELIVER_CUSTOM_BUDGET'; plan: CustomBudgetPlan }
  | { type: 'SKIP_BUDGET' }
  | { type: 'ADJUST_TAX'; taxId: string; delta: number }
  | { type: 'SET_AUTUMN_TAXES' }
  | { type: 'ADJUST_SPENDING'; deptId: string; delta: number }
  | { type: 'SET_EFFICIENCY_TARGET'; targetPct: 0 | 2 | 4 }
  | { type: 'NEGOTIATE_SUPPLY'; partyId: string }
  | { type: 'FORM_COALITION'; partyId: string }
  | { type: 'TOGGLE_THRESHOLD_FREEZE' }
  | { type: 'PURSUE_TRADE_DEAL'; partner: TradePartner; action: 'pursue' | 'suspend' }
  | { type: 'DISMISS_ELECTION' }
  | { type: 'RESTORE'; state: GameState };
