import type { GameState } from './types';

/**
 * PM background traits.
 *
 * Backgrounds are stored on `player.background` as the descriptive strings in
 * data.ts. The four gameplay traits below are keyed off those existing strings
 * (and accept the trait names themselves, which is convenient for tests and
 * future UI work). No new state field is introduced: every effect writes to a
 * meter the engine already owns.
 */
export type BackgroundTrait = 'insider' | 'activist' | 'business' | 'intellectual';

const TRAIT_BY_BACKGROUND: Record<string, BackgroundTrait> = {
  'seasoned cabinet minister': 'insider',
  insider: 'insider',
  'trade union organiser': 'activist',
  activist: 'activist',
  'city financier': 'business',
  business: 'business',
  'academic economist': 'intellectual',
  intellectual: 'intellectual',
};

export function traitForBackground(background: string | null | undefined): BackgroundTrait | null {
  if (!background) return null;
  return TRAIT_BY_BACKGROUND[background.trim().toLowerCase()] ?? null;
}

export interface TraitDetails {
  trait: BackgroundTrait;
  badge: string;
  label: string;
  description: string;
}

export const TRAIT_DETAILS: Record<BackgroundTrait, TraitDetails> = {
  insider: {
    trait: 'insider',
    badge: 'INSIDER',
    label: 'Insider',
    description: '+5 Starting Party Unity, -1 No-Confidence Letter',
  },
  activist: {
    trait: 'activist',
    badge: 'ACTIVIST',
    label: 'Activist',
    description: '+3 Starting Approval, Tax Hike Relief',
  },
  business: {
    trait: 'business',
    badge: 'BUSINESS',
    label: 'Business',
    description: '-0.2% Gilt Yields (Lower Borrowing Cost)',
  },
  intellectual: {
    trait: 'intellectual',
    badge: 'INTELLECTUAL',
    label: 'Intellectual',
    description: '-5% Backbench Rebellion Risk on Bills',
  },
};

export function getTraitDetails(background: string | null | undefined): TraitDetails | null {
  const trait = traitForBackground(background);
  return trait ? TRAIT_DETAILS[trait] : null;
}

/** Starting party-confidence bonus, in the 0-100 point scale. */
const INSIDER_CONFIDENCE_BONUS = 5;
/** One fewer letter of no confidence at the start (letters are whole counts). */
const INSIDER_LETTER_RELIEF = 1;
/** Starting approval bonus, in the 0-100 point scale. */
const ACTIVIST_APPROVAL_BONUS = 3;
/** Gilt yields are stored in percentage points, to one decimal like the engine. */
const BUSINESS_GILT_RELIEF = 0.2;
/** Rebellion risk is a 0-100 percentage. */
const INTELLECTUAL_REBELLION_RELIEF = 5;

/**
 * Activist softens the blue-wall tax penalty. The penalty itself is
 * `(33 - taxRate) * 1.6` in voterBlocs.ts; we give back a quarter of any
 * negative term, capped at two support points.
 */
export const ACTIVIST_TAX_RELIEF_FACTOR = 0.25;
export const ACTIVIST_TAX_RELIEF_CAP = 2;

export function activistTaxPenaltyRelief(taxTerm: number): number {
  if (taxTerm >= 0) return 0;
  return Math.min(ACTIVIST_TAX_RELIEF_CAP, -taxTerm * ACTIVIST_TAX_RELIEF_FACTOR);
}

/**
 * Apply the one-off starting effects. Called exactly once, from CREATE_PLAYER,
 * after the scenario has set its absolute opening position. Scenarios overwrite
 * approval/confidence/gilt absolutely, so a replay starts from the same place
 * rather than stacking bonuses.
 */
export function applyBackgroundEffects(state: GameState): GameState {
  const trait = traitForBackground(state.player?.background);
  if (!trait) return state;

  switch (trait) {
    case 'insider':
      return {
        ...state,
        metrics: {
          ...state.metrics,
          partyConfidence: Math.max(0, Math.min(100, state.metrics.partyConfidence + INSIDER_CONFIDENCE_BONUS)),
        },
        stats: {
          ...state.stats,
          lettersOfNoConfidence: Math.max(
            0,
            Math.min(99, state.stats.lettersOfNoConfidence - INSIDER_LETTER_RELIEF),
          ),
        },
      };

    case 'activist':
      return {
        ...state,
        metrics: {
          ...state.metrics,
          approval: Math.max(0, Math.min(100, state.metrics.approval + ACTIVIST_APPROVAL_BONUS)),
        },
      };

    case 'business':
      return {
        ...state,
        stats: {
          ...state.stats,
          // Existing engine units: percentage points, rounded to one decimal.
          giltYield: Math.max(1.0, Math.round((state.stats.giltYield - BUSINESS_GILT_RELIEF) * 10) / 10),
        },
      };

    case 'intellectual':
      // Applied per bill when it is introduced (see PROPOSE_BILL), so there is
      // no starting-state meter to change here.
      return state;
  }
}

/** Intellectual's per-bill modifier, on the existing 0-100 rebellion-risk scale. */
export function applyIntellectualRebellionRelief(risk: number, background: string | null | undefined): number {
  if (traitForBackground(background) !== 'intellectual') return risk;
  return Math.max(0, Math.min(100, risk - INTELLECTUAL_REBELLION_RELIEF));
}
