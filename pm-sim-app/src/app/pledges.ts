import type { GameState } from './types';

/**
 * Manifesto pledges.
 *
 * Two promises are made at every election and judged at the next one. This is
 * the cheapest realism win in the genre: it turns a sandbox into a record you
 * have to defend.
 */
export type PledgeMetric =
  | 'approval'
  | 'nhsWaitingList'
  | 'unemployment'
  | 'cpiInflation'
  | 'netMigration'
  | 'debtToGdp'
  | 'gdpGrowth'
  | 'publicServices';

export interface Pledge {
  id: string;
  /** Sentence shown to the player, e.g. "Cut NHS waiting lists to 6.2m". */
  text: string;
  metric: PledgeMetric;
  direction: 'up' | 'down';
  target: number;
  /** Value when the promise was made, so the game can show the movement. */
  baseline: number;
}

export interface PledgeResult {
  pledge: Pledge;
  current: number;
  kept: boolean;
}

interface Template {
  key: string;
  metric: PledgeMetric;
  direction: 'up' | 'down';
  /** How far from the current value the promise reaches. */
  delta: number;
  label: (target: string) => string;
  /** Parties that should never be offered this promise. */
  avoidParties?: string[];
}

const TEMPLATES: Template[] = [
  {
    key: 'approval',
    metric: 'approval',
    direction: 'up',
    delta: 5,
    label: (t) => `Get public approval above ${t}%`,
  },
  {
    key: 'nhs',
    metric: 'nhsWaitingList',
    direction: 'down',
    delta: -0.5,
    label: (t) => `Cut NHS waiting lists to ${t}m`,
  },
  {
    key: 'jobs',
    metric: 'unemployment',
    direction: 'down',
    delta: -0.4,
    label: (t) => `Bring unemployment below ${t}%`,
  },
  {
    key: 'inflation',
    metric: 'cpiInflation',
    direction: 'down',
    delta: -0.6,
    label: (t) => `Bring inflation down to ${t}%`,
  },
  {
    key: 'migration',
    metric: 'netMigration',
    direction: 'down',
    delta: -60,
    label: (t) => `Reduce net migration to ${t}k`,
    // A Green or Liberal Democrat PM would not campaign on cutting migration.
    avoidParties: ['progressive', 'liberty'],
  },
  {
    key: 'debt',
    metric: 'debtToGdp',
    direction: 'down',
    delta: -3,
    label: (t) => `Cut debt to ${t}% of GDP`,
  },
  {
    key: 'growth',
    metric: 'gdpGrowth',
    direction: 'up',
    delta: 0.5,
    label: (t) => `Grow the economy by ${t}%`,
  },
  {
    key: 'services',
    metric: 'publicServices',
    direction: 'up',
    delta: 3,
    label: (t) => `Lift public services to ${t}`,
    // Right-of-centre parties campaign on tax and migration, not spending.
    avoidParties: ['conservative', 'populist'],
  },
];

export function readMetric(s: GameState, metric: PledgeMetric): number {
  switch (metric) {
    case 'approval':
      return s.metrics.approval;
    case 'nhsWaitingList':
      return s.stats.nhsWaitingList;
    case 'unemployment':
      return s.stats.unemployment;
    case 'cpiInflation':
      return s.stats.cpiInflation;
    case 'netMigration':
      return s.stats.netMigration;
    case 'debtToGdp':
      return s.stats.debtToGdp;
    case 'gdpGrowth':
      return s.stats.gdpGrowth;
    case 'publicServices':
      return s.metrics.publicServices;
    default:
      return 0;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pick two pledges deterministically from the seed, targeting current values. */
export function makePledges(s: GameState, seed: number): Pledge[] {
  // Party-aware: never offer a promise the PM's own party would not make.
  const partyId = s.player?.partyId;
  const allowed = TEMPLATES.filter((t) => !(partyId && t.avoidParties?.includes(partyId)));
  const pool = [...(allowed.length >= 2 ? allowed : TEMPLATES)];
  const picks: Template[] = [];
  let state = seed >>> 0;

  for (let i = 0; i < 2 && pool.length > 0; i++) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const index = state % pool.length;
    picks.push(pool.splice(index, 1)[0]);
  }

  return picks.map((t) => {
    const baseline = readMetric(s, t.metric);
    const raw = baseline + t.delta;
    const target = t.metric === 'netMigration' ? Math.round(raw / 10) * 10 : round1(raw);
    return {
      id: `pledge-${t.key}-${s.week}`,
      text: t.label(String(target)),
      metric: t.metric,
      direction: t.direction,
      target,
      baseline: round1(baseline),
    };
  });
}

export function evaluatePledges(s: GameState, pledges: Pledge[]): PledgeResult[] {
  return pledges.map((p) => {
    const current = round1(readMetric(s, p.metric));
    const kept = p.direction === 'up' ? current >= p.target : current <= p.target;
    return { pledge: p, current, kept };
  });
}

export function countKept(results: PledgeResult[]): number {
  return results.filter((r) => r.kept).length;
}
