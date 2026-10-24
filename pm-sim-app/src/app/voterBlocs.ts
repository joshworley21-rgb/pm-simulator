import type { GameState } from './types';

/**
 * Voter blocs.
 *
 * A single approval number hides the thing that decides British elections:
 * the same policy can delight the blue wall and enrage the red wall. Each bloc
 * scores the government on the variables it actually cares about, and the
 * weighted mean pulls national approval around.
 */
export type BlocId = 'red-wall' | 'blue-wall' | 'young-renters' | 'retired' | 'public-sector';

export interface BlocSupport {
  id: BlocId;
  name: string;
  /** Share of the electorate, 0-1. */
  weight: number;
  support: number;
  mood: 'hostile' | 'restless' | 'content' | 'loyal';
  /** The one line that explains how they feel. */
  driver: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function moodOf(support: number): BlocSupport['mood'] {
  if (support < 30) return 'hostile';
  if (support < 45) return 'restless';
  if (support < 60) return 'content';
  return 'loyal';
}

export function computeBlocs(s: GameState): BlocSupport[] {
  const base = s.metrics.approval;
  const st = s.stats;
  const services = s.metrics.publicServices;
  const economy = s.metrics.economy;

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

  // Younger renters: services, housing and jobs, with little patience for
  // fiscal rectitude.
  const young = clamp(
    base + (services - 50) * 0.4 + (economy - 50) * 0.3 + (st.unemployment < 5 ? 4 : -6) + (st.gdpGrowth > 1.5 ? 3 : -2),
    0,
    100,
  );

  // Pensioners: the NHS waiting list and inflation are what they feel.
  const retired = clamp(
    base + (7 - st.nhsWaitingList) * 4 + (3 - st.cpiInflation) * 3 + (st.giltYield > 5 ? -4 : 0),
    0,
    100,
  );

  // Public sector workers: pay, staffing and the state of their services.
  const publicSector = clamp(base + (services - 50) * 0.8 + (st.budgetBalance < -120 ? -5 : 2), 0, 100);

  const raw: Omit<BlocSupport, 'mood'>[] = [
    { id: 'red-wall', name: 'Red wall', weight: 0.24, support: Math.round(redWall), driver: 'jobs, services, migration' },
    { id: 'blue-wall', name: 'Blue wall', weight: 0.22, support: Math.round(blueWall), driver: 'tax, debt, inflation' },
    { id: 'young-renters', name: 'Younger renters', weight: 0.18, support: Math.round(young), driver: 'housing, jobs, services' },
    { id: 'retired', name: 'Pensioners', weight: 0.2, support: Math.round(retired), driver: 'NHS waiting lists, prices' },
    { id: 'public-sector', name: 'Public sector', weight: 0.16, support: Math.round(publicSector), driver: 'pay, staffing, funding' },
  ];

  return raw.map((b) => ({ ...b, mood: moodOf(b.support) }));
}

/** Weighted mean of bloc support, used to pull national approval around. */
export function blocAverage(blocs: BlocSupport[]): number {
  const totalWeight = blocs.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight <= 0) return 50;
  return blocs.reduce((sum, b) => sum + b.support * b.weight, 0) / totalWeight;
}
