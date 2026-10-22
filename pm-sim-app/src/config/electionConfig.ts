/**
 * UK election rules — first-past-the-post, 650 seats.
 */
import { TOTAL_NPC_SEATS } from './districtConfig';

// Legacy exports kept so existing imports don't break.
export const DIRECT_SEATS_PER_BLOCK = 0;       // FPTP: no per-block direct rule
export const PROPORTIONAL_SEATS_TOTAL = 0;     // FPTP: no national top-up list
export const PROPORTIONAL_THRESHOLD_PERCENT = 0;

export const ELECTION_CONFIG = {
  get directSeatsTotal(): number { return 0; },
  get constituencySeats(): number { return TOTAL_NPC_SEATS; },
  proportionalSeats: PROPORTIONAL_SEATS_TOTAL,
  get totalSeats(): number { return TOTAL_NPC_SEATS; }, // 650
  get majorityThreshold(): number { return Math.floor(this.totalSeats / 2) + 1; }, // 326
  get superMajorityThreshold(): number { return Math.ceil((this.totalSeats * 2) / 3); },

  campaignMediaMultiplier: 2.0,
  campaignVolatilityMultiplier: 1.5,

  /**
   * FPTP cube-law exponent. voteShare^exponent is apportioned per bloc.
   * Higher = more disproportionate (bigger winner bonus, smaller-party squeeze).
   * Tune this ONE value to adjust Lab/Con/LD/Reform seat totals.
   */
  fptpDisproportionalityExponent: 2.5,
  /** Parties below this bloc vote-share (%) win no seats in that bloc. */
  fptpMinBlocSharePct: 0.5,

  electionWeights: {
    partySupport: 0.5,
    candidateScore: 0.25,
    districtLeaning: 0.2,
    randomFactor: 0.05,
  },

  campaignExposureBoost: 0.5,

  campaignActions: {
    speech: { supportMin: -2, supportMax: 3, mediaMin: 1, mediaMax: 5 },
    interview: { supportMin: -1, supportMax: 2, mediaMin: 2, mediaMax: 4 },
    scandal: { supportMin: -5, supportMax: -1, mediaMin: 3, mediaMax: 8 },
  },

  electionSeed: 20240,
} as const;

export const VOTER_CONFIG = {
  totalVoters: 48_200_000,
  baseTurnoutRate: 60.0,
  swingVoterRatio: 20.0,
  turnoutVolatility: 10,
} as const;
