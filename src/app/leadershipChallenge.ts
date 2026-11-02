/**
 * 1922 Committee & Leadership Challenge System
 * Dynamic letters threshold, leadership votes, blindside sacking
 */

/** 1922 Committee rules */
export const NINETEEN_TWENTY_TWO_RULES = {
  /** Minimum letters to trigger vote */
  triggerThreshold: 55,
  /** Conservative Party ID */
  partyId: 'conservative',
  /** Maximum letters before blindside sacking */
  blindsideThreshold: 70,
  /** Confidence vote win threshold (need 60% of party MPs) */
  confidenceWinThreshold: 0.60,
  /** Leadership challenge requires 15% of MPs to nominate */
  nominationThresholdPct: 0.15,
  /** If PM loses leadership vote, must resign immediately */
  autoResignOnLoss: true,
  /** If PM wins, cannot be challenged again for 12 months (12 turns) */
  challengeCooldownTurns: 12,
  /** Letters decay slowly when party confidence is high */
  letterDecayRate: 0.5,
  /** Letters increase faster when party confidence is low */
  letterAccelRate: 1.5,
} as const;

/** Leadership challenge outcome */
export interface LeadershipChallenge {
  id: string;
  partyId: string;
  challengerName: string;
  challengerFaction: string;
  challengerSupport: number;  // 0-100
  incumbentName: string;
  incumbentSupport: number;   // 0-100
  lettersAtTrigger: number;
  votesForChallenger: number;
  votesForIncumbent: number;
  totalMPs: number;
  result: 'incumbent_wins' | 'challenger_wins' | 'no_vote_held';
  turn: number;
}

/** 1922 Committee mood */
export interface Committee1922Mood {
  /** Average loyalty of backbench MPs (0-100) */
  averageLoyalty: number;
  /** Average ambition of backbench MPs (0-100) */
  averageAmbition: number;
  /** Number of MPs considering defecting */
  consideringDefection: number;
  /** Number of MPs ready to challenge leadership */
  readyToChallenge: number;
  /** Factions actively agitating */
  activeFactions: string[];
}

/** Calculate 1922 Committee mood from backbenchers */
export function calculate1922Mood(
  backbenchers: { loyalty: number; ambition: number; faction: string }[]
): Committee1922Mood {
  const avgLoyalty = backbenchers.reduce((s, b) => s + b.loyalty, 0) / Math.max(1, backbenchers.length);
  const avgAmbition = backbenchers.reduce((s, b) => s + b.ambition, 0) / Math.max(1, backbenchers.length);
  const consideringDefection = backbenchers.filter(b => b.loyalty < 30).length;
  const readyToChallenge = backbenchers.filter(b => b.loyalty < 50 && b.ambition > 70).length;
  const factionCounts: Record<string, number> = {};
  backbenchers.filter(b => b.loyalty < 50).forEach(b => {
    factionCounts[b.faction] = (factionCounts[b.faction] || 0) + 1;
  });
  const activeFactions = Object.entries(factionCounts)
    .filter(([, c]) => c >= 2)
    .map(([f]) => f);

  return {
    averageLoyalty: Math.round(avgLoyalty),
    averageAmbition: Math.round(avgAmbition),
    consideringDefection,
    readyToChallenge,
    activeFactions,
  };
}

/**
 * REMOVED (Commit B reconciliation): `shouldTriggerLeadershipChallenge` and
 * `simulateLeadershipVote` were dead code -- nothing in src/ or scripts/ ever called them,
 * and their rules disagreed with the engine's live ballot (a 55-letter trigger and a 12-TURN
 * cooldown against the engine's per-seat threshold and 52-WEEK immunity). Two sources of
 * truth for one mechanic is how the split stayed invisible, so the engine's unified pipeline
 * in advanceWeek is now the single implementation. `NINETEEN_TWENTY_TWO_RULES` stays exported
 * because the engine reads `blindsideThreshold` from it for the changed-rules override.
 */

/** Calculate blindside sacking risk */
export function calculateBlindsideRisk(
  lettersOfNoConfidence: number,
  partyConfidence: number,
  majoritySize: number
): { risk: number; description: string } {
  let risk = 0;
  if (lettersOfNoConfidence >= NINETEEN_TWENTY_TWO_RULES.blindsideThreshold) {
    risk = 80;
    return { risk, description: 'CRITICAL: Blindside sacking imminent - letters far exceed threshold' };
  }
  if (lettersOfNoConfidence >= 60) {
    risk = 50;
    return { risk, description: 'HIGH: Backbenchers are openly discussing leadership' };
  }
  if (lettersOfNoConfidence >= 50) {
    risk = 30;
    return { risk, description: 'MODERATE: Letters accumulating - watch carefully' };
  }
  if (partyConfidence < 40 && majoritySize < 30) {
    risk = 40;
    return { risk, description: 'MODERATE: Small majority + low confidence = dangerous' };
  }
  return { risk: 10, description: 'LOW: No immediate threat' };
}