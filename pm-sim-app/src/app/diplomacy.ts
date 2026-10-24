import type { Relation } from './types';

/**
 * Diplomacy adapter - wires the dormant `src/engine/relationEngine.ts` into
 * the live game, one mechanic at a time.
 *
 * The donor engine models a relationship network where strong alliances decay
 * without upkeep ("natural cooling"). Its `RelationEntry`/`GameState` types are
 * incompatible with the live `src/app` types, so we re-express the single
 * mechanic that maps cleanly onto the live `Relation = { from, to, score }`:
 *
 *   1. Strong relations (score > 60) cool by 1 per week, floored at 60.
 *   2. Player alliance-building decisions (coalition / confidence-and-supply)
 *      warm the relationship, which then cools over time.
 *
 * Constants mirror `RELATION_CAP` in `src/config/gameBalance.ts` (threshold
 * 60, decay 1/turn) so behaviour stays consistent without importing the
 * dormant dependency tree.
 */

/** Mirrors RELATION_CAP.strongRelationScoreThreshold. */
export const STRONG_RELATION_THRESHOLD = 60;
/** Mirrors RELATION_CAP.decayPerTurn. */
export const RELATION_DECAY_PER_WEEK = 1;
export const RELATION_SCORE_MIN = -100;
export const RELATION_SCORE_MAX = 100;

/** How much forming a coalition warms the relationship (both directions). */
export const COALITION_WARMTH = 12;
/** How much a confidence-and-supply deal warms the relationship. */
export const SUPPLY_WARMTH = 8;

export type RelationBand = 'alliance' | 'friendly' | 'neutral' | 'tense' | 'hostile';

/** Mirrors RelationType thresholds in the donor engine. */
export function relationBand(score: number): RelationBand {
  if (score >= 60) return 'alliance';
  if (score >= 20) return 'friendly';
  if (score >= -20) return 'neutral';
  if (score >= -50) return 'tense';
  return 'hostile';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Weekly "natural cooling": strong alliances decay toward the strong-relation
 * threshold. Pure - returns the same array reference when nothing changes,
 * else a fresh copy, so `advanceWeek` stays side-effect free.
 */
export function advanceRelationDecay(relations: Relation[]): Relation[] {
  let changed = false;
  const next = relations.map((r) => {
    if (r.score > STRONG_RELATION_THRESHOLD) {
      changed = true;
      return { ...r, score: Math.max(STRONG_RELATION_THRESHOLD, r.score - RELATION_DECAY_PER_WEEK) };
    }
    return r;
  });
  return changed ? next : relations;
}

/**
 * Warm the relationship between two parties in both directions (alliances are
 * roughly reciprocal). Missing pairs are left untouched (the initial matrix is
 * complete).
 */
export function warmMutual(relations: Relation[], a: string, b: string, delta: number): Relation[] {
  return relations.map((r) => {
    if ((r.from === a && r.to === b) || (r.from === b && r.to === a)) {
      return { ...r, score: clamp(r.score + delta, RELATION_SCORE_MIN, RELATION_SCORE_MAX) };
    }
    return r;
  });
}

/** Read the score one party holds toward another (0 when absent). */
export function relationScore(relations: Relation[], from: string, to: string): number {
  return relations.find((r) => r.from === from && r.to === to)?.score ?? 0;
}
