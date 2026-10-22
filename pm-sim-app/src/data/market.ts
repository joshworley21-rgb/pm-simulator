import type { MarketMetrics, District } from '../types';
import { PROPORTIONAL_BLOCKS } from '../config/districtConfig';

/** UK initial macro metrics — 650-seat Commons. */
export const initialMetrics: MarketMetrics = {
  totalVoters: 48_200_000,
  turnoutRate: 60.0,
  swingVoterRatio: 20.0,
  daysToElection: 1825, // 5-year Parliament (display figure; counts down via turnsUntilElection)
  totalSeats: 650,
  majorityThreshold: 326,
  leadingCoalitionSeats: 0,
  economicIndex: 58,
  socialStabilityIndex: 64,
  mediaAttention: 40,
};

/** UK nations/regions as districts for the FPTP projection. */
export const initialDistricts: District[] = PROPORTIONAL_BLOCKS.map((block) => ({
  id: block.id,
  name: block.name,
  totalSeats: block.totalSeats,
  voterCount: block.voterCount,
  supportByParty: { ...block.supportByParty },
}));
