import type { GameState } from './types';

/**
 * Voter blocs.
 *
 * A single approval number hides what decides British elections: the same
 * policy can delight the blue wall and enrage the red wall. Each bloc scores
 * the government on the variables it actually cares about.
 *
 * Bloc weights are not fixed: half the weight comes from the electorate, and
 * half from where the governing party's seats actually are. Win 90 seats across
 * the north and the red wall starts to dominate your approval; win the shires
 * and the blue wall does.
 */
export type BlocId = 'red-wall' | 'blue-wall' | 'young-renters' | 'retired' | 'public-sector';

export interface BlocSupport {
  id: BlocId;
  name: string;
  /** Share of the effective electorate, 0-1. */
  weight: number;
  support: number;
  mood: 'hostile' | 'restless' | 'content' | 'loyal';
  /** The one line that explains how they feel. */
  driver: string;
  /** Seats the governing party holds in this bloc's territory. */
  seats: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const BASE_WEIGHTS: Record<BlocId, number> = {
  'red-wall': 0.24,
  'blue-wall': 0.22,
  'young-renters': 0.18,
  retired: 0.2,
  'public-sector': 0.16,
};

/** Where each bloc's seats are concentrated, using the region ids in data.ts. */
const REGION_GROUPS: Record<BlocId, string[]> = {
  'red-wall': ['north', 'midlands', 'wales'],
  'blue-wall': ['south-east', 'south-west', 'east'],
  'young-renters': ['london', 'scotland'],
  retired: ['south-west', 'east', 'scotland'],
  'public-sector': ['london', 'north', 'scotland'],
};

const BLOC_IDS = Object.keys(BASE_WEIGHTS) as BlocId[];

function moodOf(support: number): BlocSupport['mood'] {
  if (support < 30) return 'hostile';
  if (support < 45) return 'restless';
  if (support < 60) return 'content';
  return 'loyal';
}

interface SeatHold {
  mine: number;
  total: number;
}

function seatHolds(s: GameState): Record<BlocId, SeatHold> | null {
  const regionSeats = s.regionSeats;
  const playerId = s.player?.partyId;
  if (!regionSeats || !playerId || Object.keys(regionSeats).length === 0) return null;

  const out = {} as Record<BlocId, SeatHold>;
  for (const id of BLOC_IDS) {
    let mine = 0;
    let total = 0;
    for (const region of REGION_GROUPS[id]) {
      const map = regionSeats[region];
      if (!map) continue;
      for (const [partyId, seats] of Object.entries(map)) {
        total += seats;
        if (partyId === playerId) mine += seats;
      }
    }
    out[id] = { mine, total };
  }
  return out;
}

/** Blend electoral weight with the geography of your majority. */
function blocWeights(s: GameState): { weights: Record<BlocId, number>; seats: Record<BlocId, number> } {
  const holds = seatHolds(s);
  if (!holds) {
    const seats = BLOC_IDS.reduce((acc, id) => ({ ...acc, [id]: 0 }), {} as Record<BlocId, number>);
    return { weights: { ...BASE_WEIGHTS }, seats };
  }

  const seatTotal = BLOC_IDS.reduce((sum, id) => sum + holds[id].mine, 0);
  const weights = {} as Record<BlocId, number>;
  const seats = {} as Record<BlocId, number>;
  let sum = 0;

  for (const id of BLOC_IDS) {
    const share = seatTotal > 0 ? holds[id].mine / seatTotal : 0;
    weights[id] = 0.5 * BASE_WEIGHTS[id] + 0.5 * share;
    seats[id] = holds[id].mine;
    sum += weights[id];
  }

  // Normalise so the weights always sum to 1.
  if (sum > 0) for (const id of BLOC_IDS) weights[id] = weights[id] / sum;
  return { weights, seats };
}

export function computeBlocs(s: GameState): BlocSupport[] {
  const base = s.metrics.approval;
  const st = s.stats;
  const services = s.metrics.publicServices;
  const economy = s.metrics.economy;
  const { weights, seats } = blocWeights(s);

  // Red wall: post-industrial seats won on jobs, services and control of
  // migration. Cares little about the deficit.
  const redWall = clamp(
    base + (services - 50) * 0.5 + (4.5 - st.unemployment) * 4 + (350 - st.netMigration) / 60 - (st.cpiInflation > 4 ? 6 : 0),
    0,
    100,
  );

  // Blue wall: lower-tax, lower-debt, Remain-leaning commuter seats.
  const blueWall = clamp(
    base + (33 - st.taxRate) * 1.6 + (st.debtToGdp < 100 ? 4 : -6) + (st.cpiInflation < 3 ? 4 : -5),
    0,
    100,
  );

  // Younger renters: services, housing and jobs, little patience for austerity.
  const young = clamp(
    base + (services - 50) * 0.4 + (economy - 50) * 0.3 + (st.unemployment < 5 ? 4 : -6) + (st.gdpGrowth > 1.5 ? 3 : -2),
    0,
    100,
  );

  // Pensioners: the NHS waiting list and prices are what they feel.
  const retired = clamp(
    base + (7 - st.nhsWaitingList) * 4 + (3 - st.cpiInflation) * 3 + (st.giltYield > 5 ? -4 : 0),
    0,
    100,
  );

  // Public sector workers: pay, staffing and the state of their services.
  const publicSector = clamp(base + (services - 50) * 0.8 + (st.budgetBalance < -120 ? -5 : 2), 0, 100);

  const raw: { id: BlocId; name: string; support: number; driver: string }[] = [
    { id: 'red-wall', name: 'Red wall', support: redWall, driver: 'jobs, services, migration' },
    { id: 'blue-wall', name: 'Blue wall', support: blueWall, driver: 'tax, debt, inflation' },
    { id: 'young-renters', name: 'Younger renters', support: young, driver: 'housing, jobs, services' },
    { id: 'retired', name: 'Pensioners', support: retired, driver: 'NHS waiting lists, prices' },
    { id: 'public-sector', name: 'Public sector', support: publicSector, driver: 'pay, staffing, funding' },
  ];

  return raw.map((b) => ({
    id: b.id,
    name: b.name,
    weight: weights[b.id],
    support: Math.round(b.support),
    mood: moodOf(b.support),
    driver: b.driver,
    seats: seats[b.id],
  }));
}

/** Weighted mean of bloc support, used to pull national approval around. */
export function blocAverage(blocs: BlocSupport[]): number {
  const totalWeight = blocs.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight <= 0) return 50;
  return blocs.reduce((sum, b) => sum + b.support * b.weight, 0) / totalWeight;
}
