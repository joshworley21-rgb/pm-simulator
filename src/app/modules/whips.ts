export interface WhipsState {
  whipStrength: number;
  rebelPressure: number;
  payrollVotes: number;
  concessions: number;
  rebellionImminent: boolean;
}

export interface AdvanceWhipsResult {
  state: WhipsState;
  lettersDelta: number;
  factionUnrestDelta: number;
  logs: string[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function createDefaultWhips(): WhipsState {
  return {
    whipStrength: 75,
    rebelPressure: 10,
    payrollVotes: 0,
    concessions: 0,
    rebellionImminent: false,
  };
}

/** Advance whip discipline without mutating state or consuming an engine seed. */
export function advanceWhips(
  whips: WhipsState,
  inputs: { factionUnrest: number; partyConfidence: number; seed: number },
): AdvanceWhipsResult {
  const seed = Number.isFinite(inputs.seed) ? inputs.seed >>> 0 : 0;
  const variation = (((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
  const pressureChange =
    (inputs.factionUnrest - 50) * 0.08 -
    (inputs.partyConfidence - 50) * 0.06 -
    whips.payrollVotes * 1.5 -
    whips.concessions * 2 +
    (100 - whips.whipStrength) * 0.03 +
    variation;

  const rebelPressure = clamp(whips.rebelPressure + pressureChange, 0, 100);
  const rebellionImminent = rebelPressure >= 70;
  const crossedThreshold = !whips.rebellionImminent && rebellionImminent;
  const state: WhipsState = {
    ...whips,
    whipStrength: clamp(whips.whipStrength - 0.5, 0, 100),
    rebelPressure,
    rebellionImminent,
  };

  return {
    state,
    lettersDelta: crossedThreshold ? 1 : 0,
    factionUnrestDelta: rebellionImminent ? 0.25 : 0,
    logs: crossedThreshold ? ['WHIPS: Backbench rebellion is now imminent.'] : [],
  };
}

/** A promotion rewards loyalty and strengthens the payroll vote. */
export function patronageEffect(whips: WhipsState): WhipsState {
  return {
    ...whips,
    rebelPressure: clamp(whips.rebelPressure - 8, 0, 100),
    payrollVotes: clamp(whips.payrollVotes + 1, 0, 100),
    rebellionImminent: whips.rebelPressure - 8 >= 70,
  };
}

export function estimateRebellionChance(whips: WhipsState): number {
  return clamp(whips.rebelPressure / 100, 0, 1);
}

export function divisionDisciplineModifier(
  whips: WhipsState,
  whipLevel: 'two-line' | 'three-line' | 'free-vote',
): { voteSwing: number; rebellionRiskDelta: number; resentmentDelta: number } {
  if (whipLevel === 'free-vote') {
    return { voteSwing: 0, rebellionRiskDelta: 0, resentmentDelta: 0 };
  }

  const strain =
    (whips.rebelPressure - 10) +
    (75 - whips.whipStrength);
  const voteFactor = whipLevel === 'three-line' ? 0.5 : 1;

  return {
    voteSwing: -strain * 0.1 * voteFactor,
    rebellionRiskDelta: strain * 0.5 - 2 * whips.payrollVotes - 2 * whips.concessions,
    resentmentDelta:
      Math.max(0, strain) * (whipLevel === 'three-line' ? 0.1 : 0.05),
  };
}
