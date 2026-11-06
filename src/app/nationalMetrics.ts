import type { Bill, GameState, Minister } from './types';
import type { WhipsState } from './modules/whips';
import { deriveTensionIndex } from './tension';

/**
 * National-level models layered on top of the existing `GameState`.
 *
 * These are deliberately *views* over state that already exists
 * (`metrics.approval`, `stats.cpiInflation`, `stats.debtToGdp`, the party
 * seat counts, the whips module and the cabinet array) plus one new stored
 * reserve figure. Nothing here re-simulates the economy: the monthly drift
 * helpers are small, explicit adjustments applied by `advanceWeek`.
 */

export const COMMONS_TOTAL_SEATS = 650;
export const DEFAULT_TREASURY_RESERVES = 25;

/** A three-line bill, or any bill the engine already considers high-risk. */
export const FLAGSHIP_REBELLION_RISK = 30;
export const LOW_WHIP_DISCIPLINE_THRESHOLD = 60;
export const MINISTERIAL_LOYALTY_THRESHOLD = 45;

const CPI_INFLATION_MIN = 0.1;
const CPI_INFLATION_MAX = 1000;

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
const r2 = (n: number): number => Math.round(n * 100) / 100;

export interface NationalMetrics {
  /** 0-100. */
  publicApproval: number;
  /** £bn of liquid reserves held by the Treasury. */
  treasuryReserves: number;
  /** CPI inflation, percent. */
  inflationRate: number;
  /** Public debt as a percentage of GDP. */
  publicDebtToGdp: number;
  /** 0-100 derived tension reading (see ./tension). */
  nationalTensionIndex: number;
}

export const KEY_DEPARTMENTS = [
  'Chancellor of the Exchequer',
  'Home Secretary',
  'Health Secretary',
  'Education Secretary',
  'Business Secretary',
  'Foreign Secretary',
  'Defence Secretary',
  'Justice Secretary',
  'Work and Pensions Secretary',
  'Transport Secretary',
  'Environment Secretary',
  'Culture Secretary',
] as const;

export type KeyDepartment = (typeof KEY_DEPARTMENTS)[number];

/** Strict shape required of a cabinet minister under the extended model. */
export interface CabinetMinisterProfile {
  name: string;
  post: KeyDepartment;
  /** 0-100. */
  loyalty: number;
  /** 0-100. */
  competence: number;
  faction: string;
  /** 0-100 public recognition / standing. */
  publicProfile: number;
}

export interface CommonsBalance {
  totalSeats: number;
  governmentPartySeats: number;
  /** Largest non-government party. */
  oppositionSeats: number;
  /** Everyone else, including crossbench and minor parties. */
  minorPartySeats: number;
  /** Estimated government MPs currently outside the whip. */
  rebelliousBackbenchers: number;
  /** 0-100 composite of whip strength and rebel pressure. */
  whipDiscipline: number;
}

export function deriveNationalTensionIndex(state: GameState): number {
  return deriveTensionIndex(state).value;
}

export function deriveNationalMetrics(state: GameState): NationalMetrics {
  return {
    publicApproval: clamp(state.metrics.approval, 0, 100),
    treasuryReserves: r2(state.treasuryReserves ?? DEFAULT_TREASURY_RESERVES),
    inflationRate: clamp(state.stats.cpiInflation, CPI_INFLATION_MIN, CPI_INFLATION_MAX),
    publicDebtToGdp: Math.max(0, state.stats.debtToGdp),
    nationalTensionIndex: clamp(deriveNationalTensionIndex(state), 0, 100),
  };
}

export function deriveWhipDiscipline(whips: WhipsState | undefined): number {
  if (!whips) return 75;
  return clamp(
    Math.round(whips.whipStrength * 0.65 + (100 - whips.rebelPressure) * 0.35),
    0,
    100,
  );
}

export function deriveCommonsBalance(state: GameState): CommonsBalance {
  const actualTotal = state.parties.reduce((sum, party) => sum + party.seats, 0);
  const totalSeats = actualTotal > 0 ? actualTotal : COMMONS_TOTAL_SEATS;
  const playerPartyId = state.player?.partyId;
  const governmentPartySeats =
    state.parties.find((party) => party.id === playerPartyId)?.seats ?? 0;
  const oppositionSeats =
    [...state.parties]
      .filter((party) => party.id !== playerPartyId)
      .sort((a, b) => b.seats - a.seats)[0]?.seats ?? 0;
  const minorPartySeats = Math.max(
    0,
    totalSeats - governmentPartySeats - oppositionSeats,
  );
  const whipDiscipline = deriveWhipDiscipline(state.whips);
  const rebelPressure = state.whips?.rebelPressure ?? 0;
  const rebelliousBackbenchers = Math.round(
    governmentPartySeats * (rebelPressure / 100) * 0.25,
  );

  return {
    totalSeats,
    governmentPartySeats,
    oppositionSeats,
    minorPartySeats,
    rebelliousBackbenchers,
    whipDiscipline,
  };
}

export function isFlagshipBill(bill: Bill): boolean {
  return bill.whipLevel === 'three-line' || bill.rebellionRisk >= FLAGSHIP_REBELLION_RISK;
}

/** 0..1 chance that government MPs rebel on this bill at the current discipline. */
export function flagshipRebellionChance(state: GameState, bill: Bill): number {
  const discipline = deriveWhipDiscipline(state.whips);
  const disciplineDeficit = Math.max(0, LOW_WHIP_DISCIPLINE_THRESHOLD - discipline);
  const exposure = isFlagshipBill(bill) ? 1 : 0.35;
  return clamp(
    bill.rebellionRisk / 100 + (disciplineDeficit / 100) * exposure * 0.6,
    0,
    0.95,
  );
}

/**
 * Extra rebellion-risk points added to a flagship division when discipline has
 * fallen below the threshold. Zero at the default whips state, so existing
 * divisions are unchanged until the whips actually lose control.
 */
export function flagshipRebellionRiskDelta(state: GameState, bill: Bill): number {
  if (!isFlagshipBill(bill)) return 0;
  const discipline = deriveWhipDiscipline(state.whips);
  const deficit = Math.max(0, LOW_WHIP_DISCIPLINE_THRESHOLD - discipline);
  return r2(deficit * 0.3);
}

/**
 * Monthly probabilities of a leak or resignation driven by cabinet loyalty.
 * Zero for a healthy cabinet, rising as average loyalty falls or a minister
 * drops below the collective-responsibility threshold.
 */
export function ministerialLoyaltyRisk(cabinet: Minister[]): {
  leakChance: number;
  resignationChance: number;
} {
  if (cabinet.length === 0) return { leakChance: 0, resignationChance: 0 };

  const average =
    cabinet.reduce((sum, minister) => sum + minister.loyalty, 0) / cabinet.length;
  const disloyal = cabinet.filter(
    (minister) => minister.loyalty < MINISTERIAL_LOYALTY_THRESHOLD,
  ).length;
  const averageDeficit = Math.max(0, 55 - average);

  return {
    leakChance: clamp((averageDeficit / 100) * 0.35 + disloyal * 0.01, 0, 0.35),
    resignationChance: clamp(
      (averageDeficit / 100) * 0.15 + disloyal * 0.03,
      0,
      0.35,
    ),
  };
}

/**
 * Monthly inflation points caused by debt and deficit pressure. At the opening
 * position (98% debt, -£75bn balance) this is a small 0.02pt/month; a genuinely
 * distressed balance sheet pushes it up materially.
 */
export function debtInflationDrift(state: GameState): number {
  const debtExcess = Math.max(0, state.stats.debtToGdp - 90);
  const deficitExcess = Math.max(0, -state.stats.budgetBalance - 75);
  return r2(debtExcess * 0.002 + deficitExcess * 0.002);
}

/** Apply the monthly debt-to-inflation channel. Returns the same object when inert. */
export function applyMonthlyNationalDrift(state: GameState): GameState {
  const drift = debtInflationDrift(state);
  if (drift <= 0) return state;
  return {
    ...state,
    stats: {
      ...state.stats,
      cpiInflation: r2(
        clamp(state.stats.cpiInflation + drift, CPI_INFLATION_MIN, CPI_INFLATION_MAX),
      ),
    },
  };
}
