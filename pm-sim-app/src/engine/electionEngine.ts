/**
 * UK election engine — first-past-the-post (FPTP), 650 seats.
 *
 * Replaces the donor's Japanese parallel system (110 constituency D'Hondt +
 * 90 national-proportional D'Hondt) with a regional FPTP projection:
 *
 *   1. Within each regional bloc, each party's vote share is raised to a
 *      "disproportionality exponent" (cube-law style).
 *   2. Seats are apportioned from those weights by largest remainder.
 *
 * This reproduces FPTP's winner bonus and small-party squeeze while keeping the
 * same District/ElectionResult types the rest of the engine expects.
 */
import type {
  Party,
  District,
  ElectionResult,
  PartyElectionResult,
  GameState,
} from '../types';
import { ELECTION_CONFIG } from '../config/electionConfig';

export const FPTP_DISPROPORTIONALITY = ELECTION_CONFIG.fptpDisproportionalityExponent;
export const FPTP_MIN_BLOC_SHARE = ELECTION_CONFIG.fptpMinBlocSharePct;

// Compatibility exports for any donor code still referencing the old constants.
export const CONSTITUENCY_SEATS = 650; // all seats are FPTP constituencies
export const PROPORTIONAL_SEATS = 0;   // no national top-up list

export const CAMPAIGN_MEDIA_MULTIPLIER = ELECTION_CONFIG.campaignMediaMultiplier;
export const CAMPAIGN_VOLATILITY_MULTIPLIER = ELECTION_CONFIG.campaignVolatilityMultiplier;

export type CampaignAction =
  | 'campaign'
  | 'media_attack'
  | 'policy_announcement'
  | 'coalition_signal'
  | 'debate';

/**
 * Largest-remainder apportionment from a set of positive weights.
 * Guarantees the returned integer seats sum exactly to `seats`.
 */
function largestRemainder(weights: Record<string, number>, seats: number): Record<string, number> {
  const result: Record<string, number> = {};
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0 || seats <= 0) {
    for (const id of Object.keys(weights)) result[id] = 0;
    return result;
  }

  const entries = Object.entries(weights)
    .map(([id, weight]) => {
      const exact = (weight / totalWeight) * seats;
      const floor = Math.floor(exact);
      return { id, floor, remainder: exact - floor };
    })
    .sort((a, b) => b.remainder - a.remainder);

  let allocated = 0;
  for (const e of entries) {
    result[e.id] = e.floor;
    allocated += e.floor;
  }
  const remaining = seats - allocated;
  for (let i = 0; i < remaining && entries.length > 0; i++) {
    result[entries[i % entries.length].id] += 1;
  }
  return result;
}

/** FPTP seat allocation within a single bloc. */
function allocateFptpSeats(
  parties: Party[],
  supportByParty: Record<string, number>,
  seats: number,
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const p of parties) {
    const share = Math.max(0, supportByParty[p.id] ?? 0);
    weights[p.id] = share < FPTP_MIN_BLOC_SHARE ? 0 : Math.pow(share, FPTP_DISPROPORTIONALITY);
  }
  return largestRemainder(weights, seats);
}

/** Shared FPTP computation used by both v1 and v2 entry points. */
function computeElection(
  parties: Party[],
  districts: District[],
  totalSeats: number,
  majorityThreshold: number,
  isElectionCampaign: boolean,
): ElectionResult {
  // Deterministic RNG for campaign wobble.
  let seed: number = ELECTION_CONFIG.electionSeed;
  const rng = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const seatTotals: Record<string, number> = {};
  for (const p of parties) seatTotals[p.id] = 0;
  const byDistrict: Record<string, Record<string, number>> = {};

  for (const district of districts) {
    const support: Record<string, number> = {};
    for (const p of parties) {
      let share = Math.max(0, district.supportByParty[p.id] ?? 0);
      if (isElectionCampaign) {
        const wobble = 1 + (rng() - 0.5) * 0.1 * CAMPAIGN_VOLATILITY_MULTIPLIER;
        share *= Math.max(0, wobble);
      }
      support[p.id] = share;
    }
    const allocated = allocateFptpSeats(parties, support, district.totalSeats);
    for (const p of parties) seatTotals[p.id] += allocated[p.id] ?? 0;
    byDistrict[district.id] = allocated;
  }

  // National weighted vote shares for the "supportPercent" report figure.
  const nationalVotes: Record<string, number> = {};
  for (const p of parties) nationalVotes[p.id] = 0;
  for (const district of districts) {
    for (const p of parties) {
      nationalVotes[p.id] += district.voterCount * Math.max(0, district.supportByParty[p.id] ?? 0);
    }
  }
  const totalVotes = Object.values(nationalVotes).reduce((a, b) => a + b, 0);

  const partyResults: PartyElectionResult[] = parties
    .map((p) => ({
      partyId: p.id,
      seats: seatTotals[p.id] ?? 0,
      supportPercent: totalVotes > 0 ? (nationalVotes[p.id] ?? 0) / totalVotes * 100 : 0,
    }))
    .sort((a, b) => b.seats - a.seats);

  const majorityParty = partyResults.find((r) => r.seats >= majorityThreshold) ?? null;

  return {
    partyResults,
    hasMajority: majorityParty !== null,
    majorityPartyId: majorityParty?.partyId ?? null,
    totalSeats,
    majorityThreshold,
    districtResults: byDistrict,
    nationalProportionalResults: {}, // FPTP has no national list
  };
}

/** v1-compatible entry point (kept for any callers/tests). */
export function runElection(
  parties: Party[],
  districts: District[],
  totalSeats: number,
  majorityThreshold: number,
): ElectionResult {
  return computeElection(parties, districts, totalSeats, majorityThreshold, false);
}

/**
 * UK FPTP election.
 *
 * Signature kept from the donor so initialState.ts keeps working. The
 * `candidatePopularity` argument is accepted but not used at seat level
 * (UK FPTP is driven by aggregate vote share in this projection).
 */
export function runElectionV2(
  parties: Party[],
  districts: District[],
  totalSeats: number,
  majorityThreshold: number,
  _candidatePopularity: Record<string, number>,
  isElectionCampaign: boolean = false,
): ElectionResult {
  return computeElection(parties, districts, totalSeats, majorityThreshold, isElectionCampaign);
}

/** Handle a campaign action (unchanged from donor behaviour). */
export function processCampaignAction(state: GameState, partyId: string, action: CampaignAction): GameState {
  const party = state.parties.find((p) => p.id === partyId);
  if (!party) return state;

  const updatedParties = state.parties.map((p) => {
    if (p.id !== partyId) return p;

    let supportDelta = 0;
    switch (action) {
      case 'campaign': supportDelta = 0.5 + Math.random() * 1.5; break;
      case 'media_attack': supportDelta = -1 + Math.random() * 3; break;
      case 'policy_announcement': supportDelta = 0.3 + Math.random() * 1; break;
      case 'coalition_signal': supportDelta = 0.2 + Math.random() * 0.5; break;
      case 'debate': supportDelta = -0.5 + Math.random() * 2.5; break;
    }
    supportDelta *= CAMPAIGN_VOLATILITY_MULTIPLIER;
    return { ...p, currentSupport: Math.max(1, Math.min(60, p.currentSupport + supportDelta)) };
  });

  return { ...state, parties: updatedParties };
}

/** Generate candidate popularity from MP personalities (unchanged). */
export function generateCandidatePopularity(mpPersonalities: Record<string, import('../types/mp').MPPersonality>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const mp of Object.values(mpPersonalities)) {
    if (mp.isLeader) {
      result[mp.personName] = mp.popularity * 0.6 + mp.mediaSkill * 0.3 + mp.negotiationSkill * 0.1;
    }
  }
  return result;
}
