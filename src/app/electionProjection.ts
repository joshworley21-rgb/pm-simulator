import type { GameState, Party } from './types';
import { REGIONS } from './data';
import type { Region } from './data';
import { BLOC_REGIONS, type BlocId } from './voterBlocs';

/**
 * Seat projection.
 *
 * Previously the general election read the static regional support baked into
 * data.ts, which meant every election produced the same Commons no matter how
 * you governed. This projects seats from the live position instead:
 *
 *   1. start from each region's structural lean,
 *   2. apply the national polling swing since the last election,
 *   3. tilt the region toward or away from the government according to the
 *      bloc that lives there, then renormalise to 100%,
 *   4. apportion with the usual cube-law FPTP exponent.
 */
export const FPTP_EXPONENT = 2.5;

function largestRemainder(weights: Record<string, number>, seats: number): Record<string, number> {
  const result: Record<string, number> = {};
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0 || seats <= 0) {
    for (const id of Object.keys(weights)) result[id] = 0;
    return result;
  }

  const entries = Object.entries(weights)
    .map(([id, w]) => {
      const exact = (w / total) * seats;
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

/** Which blocs claim a given region. */
function blocsForRegion(regionId: string): BlocId[] {
  return (Object.keys(BLOC_REGIONS) as BlocId[]).filter((id) => BLOC_REGIONS[id].includes(regionId));
}

/**
 * Support in one region after the national swing and the bloc tilt.
 * Exported for tests and for the UI to explain a bad night.
 */
export function regionalSupport(s: GameState, region: Region): Record<string, number> {
  const parties: Party[] = s.parties;
  const playerId = s.player?.partyId;
  const support: Record<string, number> = {};

  for (const p of parties) {
    const structural = region.support[p.id] ?? 0;
    const swing = (p.currentSupport - p.baseSupport) * 0.8;
    support[p.id] = Math.max(0.2, structural + swing);
  }

  // Bloc tilt: the same region can love or loathe the government depending on
  // how the bloc that lives there scores it.
  const blocs = s.blocs ?? [];
  const relevant = blocsForRegion(region.id);
  if (blocs.length > 0 && relevant.length > 0 && playerId) {
    const scores = relevant
      .map((id) => blocs.find((b) => b.id === id)?.support)
      .filter((v): v is number => typeof v === 'number');

    if (scores.length > 0) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const tilt = (mean - 50) / 50; // -1 hostile .. +1 loyal
      const magnitude = Math.abs(tilt) * 10;

      if (tilt >= 0) {
        support[playerId] += magnitude;
      } else {
        const rival = parties
          .filter((p) => p.id !== playerId)
          .sort((a, b) => (support[b.id] ?? 0) - (support[a.id] ?? 0))[0];
        support[playerId] = Math.max(0.5, support[playerId] - magnitude);
        if (rival) support[rival.id] += magnitude;
      }
    }
  }

  // Renormalise so the region still sums to 100%.
  const total = Object.values(support).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const id of Object.keys(support)) support[id] = (support[id] / total) * 100;
  }
  return support;
}

export function projectSeats(s: GameState): {
  totals: Record<string, number>;
  byRegion: Record<string, Record<string, number>>;
} {
  const totals: Record<string, number> = {};
  for (const p of s.parties) totals[p.id] = 0;

  const byRegion: Record<string, Record<string, number>> = {};

  for (const region of REGIONS) {
    const support = regionalSupport(s, region);
    const weights: Record<string, number> = {};
    for (const p of s.parties) {
      weights[p.id] = Math.pow(Math.max(0, support[p.id] ?? 0), FPTP_EXPONENT);
    }
    const alloc = largestRemainder(weights, region.seats);
    byRegion[region.id] = alloc;
    for (const p of s.parties) totals[p.id] += alloc[p.id] ?? 0;
  }

  return { totals, byRegion };
}
