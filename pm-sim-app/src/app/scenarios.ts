import type { GameState } from './types';

/**
 * Starting scenarios.
 *
 * Replayability comes from a different opening position, not just a different
 * random seed: a 1997-style honeymoon and a 2022-style crisis premiership
 * should not play the same way even with identical decisions.
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';

export interface Scenario {
  id: string;
  name: string;
  blurb: string;
  difficulty: Difficulty;
  /** Short line shown under the name in the picker. */
  tagline: string;
  approval: number;
  unity: number;
  stats: Partial<GameState['stats']>;
  /** Force a minority government by capping the player's seats. */
  hungParliament?: boolean;
  seatsCap?: number;
  /** Baselines the starting money against, so the deficit reads correctly. */
  departmentsDelta?: Record<string, number>;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'inherited-mess',
    name: 'Inherited Mess',
    blurb:
      'You have won, but the books are wrecked. Inflation is sticky, borrowing costs are up and every department says it is already cut to the bone.',
    difficulty: 'hard',
    tagline: 'Deficit, inflation and broken services',
    approval: 40,
    unity: 52,
    stats: {
      cpiInflation: 4.8,
      gdpGrowth: 0.3,
      giltYield: 5.2,
      nhsWaitingList: 8.6,
      netMigration: 480,
      unemployment: 5.1,
      debtToGdp: 104,
      budgetBalance: -140,
    },
  },
  {
    id: 'morning-in-britain',
    name: 'Morning in Britain',
    blurb:
      'A landslide, a strong economy and a party that still likes you. The danger is that everyone expects you to spend it.',
    difficulty: 'easy',
    tagline: 'Landslide honeymoon, healthy books',
    approval: 56,
    unity: 68,
    stats: {
      cpiInflation: 2.1,
      gdpGrowth: 2.4,
      giltYield: 3.6,
      nhsWaitingList: 6.4,
      netMigration: 310,
      unemployment: 4.0,
      debtToGdp: 88,
      budgetBalance: -45,
    },
  },
  {
    id: 'hung-parliament',
    name: 'Hung Parliament',
    blurb:
      'You are the largest party but 26 seats short. Every bill is a negotiation and the smaller parties know it.',
    difficulty: 'brutal',
    tagline: 'Minority government, no safe majority',
    approval: 45,
    unity: 48,
    stats: {
      cpiInflation: 3.2,
      gdpGrowth: 1.2,
      giltYield: 4.6,
      nhsWaitingList: 7.4,
      netMigration: 420,
      unemployment: 4.6,
      debtToGdp: 97,
      budgetBalance: -95,
    },
    hungParliament: true,
    seatsCap: 300,
  },
  {
    id: 'winter-of-discontent',
    name: 'Winter of Discontent',
    blurb:
      'Double-digit inflation, strikes in the public sector and a party that has stopped briefing you and started briefing against you.',
    difficulty: 'brutal',
    tagline: 'Inflation crisis, strikes, mutiny',
    approval: 33,
    unity: 41,
    stats: {
      cpiInflation: 11.2,
      gdpGrowth: -0.6,
      giltYield: 4.0,
      nhsWaitingList: 9.1,
      netMigration: 260,
      unemployment: 7.4,
      debtToGdp: 96,
      budgetBalance: -110,
      lettersOfNoConfidence: 18,
    },
  },
  {
    id: 'wartime-footing',
    name: 'Wartime Footing',
    blurb:
      'A land war in Europe has reset every priority. Defence is ring-fenced, everything else is not, and the public is behind you for now.',
    difficulty: 'normal',
    tagline: 'Defence first, services squeezed',
    approval: 51,
    unity: 60,
    stats: {
      cpiInflation: 4.1,
      gdpGrowth: 0.8,
      giltYield: 4.4,
      nhsWaitingList: 8.0,
      netMigration: 190,
      unemployment: 4.8,
      debtToGdp: 101,
      budgetBalance: -120,
    },
  },
];

export const DEFAULT_SCENARIO_ID = 'inherited-mess';

export function getScenario(id: string | undefined): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/**
 * Apply a scenario to a state that has just formed a government.
 *
 * Seats are capped for minority-government scenarios by handing the excess to
 * the largest rival, which keeps the Commons arithmetic honest.
 */
export function applyScenario(state: GameState, id: string | undefined): GameState {
  const scenario = getScenario(id);
  const playerPartyId = state.player?.partyId;

  let parties = state.parties;
  if (scenario.hungParliament && playerPartyId) {
    const cap = scenario.seatsCap ?? 300;
    const player = parties.find((p) => p.id === playerPartyId);
    if (player && player.seats > cap) {
      const excess = player.seats - cap;
      const rival = [...parties]
        .filter((p) => p.id !== playerPartyId)
        .sort((a, b) => b.currentSupport - a.currentSupport)[0];
      parties = parties.map((p) => {
        if (p.id === playerPartyId) return { ...p, seats: cap };
        if (rival && p.id === rival.id) return { ...p, seats: p.seats + excess };
        return p;
      });
    }
  }

  const departments = scenario.departmentsDelta
    ? state.departments.map((d) =>
        scenario.departmentsDelta && scenario.departmentsDelta[d.id] !== undefined
          ? { ...d, budget: d.budget + (scenario.departmentsDelta[d.id] ?? 0) }
          : d,
      )
    : state.departments;

  return {
    ...state,
    scenarioId: scenario.id,
    parties,
    departments,
    stats: { ...state.stats, ...scenario.stats },
    metrics: {
      ...state.metrics,
      approval: scenario.approval,
      partyConfidence: scenario.unity,
    },
    log: [`SCENARIO: ${scenario.name} — ${scenario.tagline}.`, ...state.log].slice(0, 50),
  };
}
