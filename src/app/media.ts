import type { Effects } from './types';

/**
 * Feature #3 module: the media cycle and lobby briefings.
 *
 * Adds only what the engine lacked: per-outlet PRESS MOOD (warmth toward the
 * government, stance-weighted), accumulated HOSTILITY, a rolling COVERAGE TONE,
 * and a player-facing LOBBY BRIEFING with a cooling-off period.
 *
 * Deliberately does NOT re-implement the existing headline machinery: the
 * `headlines` array and the three stanced papers already live in engine.ts/data.
 *
 * INERT INVARIANT: while hostility is below MEDIA_HOSTILITY_FLOOR *and* every
 * outlet sits inside the mood band, this module returns NO gameplay effects.
 * A default press therefore leaves the simulation identical.
 */

export type PaperId = 'national-standard' | 'clarion' | 'courier';

export interface MediaOutlet {
  id: PaperId;
  name: string;
  stance: 'left' | 'centrist' | 'right';
}

export const MEDIA_OUTLETS: MediaOutlet[] = [
  { id: 'clarion', name: 'The Clarion', stance: 'left' },
  { id: 'national-standard', name: 'The National Standard', stance: 'centrist' },
  { id: 'courier', name: 'The Courier', stance: 'right' },
];

export interface MediaState {
  /** Per-outlet warmth toward the government, 0..100 (50 = neutral). */
  pressMood: Record<PaperId, number>;
  /** Accumulated press hostility, 0..100. */
  hostility: number;
  /** Rolling coverage tone, -1 (hostile) .. +1 (friendly). */
  cycleTone: number;
  /** Week of the last lobby briefing, or null if never. */
  lastBriefingWeek: number | null;
}

export const MEDIA_HOSTILITY_FLOOR = 60;
export const MEDIA_MOOD_BAND_LOW = 20;
export const MEDIA_MOOD_BAND_HIGH = 80;
export const BRIEFING_COOLDOWN_WEEKS = 4;

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const mean = (xs: number[]): number => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function createDefaultMediaState(): MediaState {
  return {
    pressMood: { 'national-standard': 50, clarion: 50, courier: 50 },
    hostility: 0,
    cycleTone: 0,
    lastBriefingWeek: null,
  };
}

/** Where each stance wants the government to be: left reads services, right reads spending. */
function outletTarget(
  stance: MediaOutlet['stance'],
  approval: number,
  cpiInflation: number,
  publicServices: number,
): number {
  const costOfLiving = (cpiInflation - 2.5) * 1.5;
  const popularity = (approval - 50) * 0.5;
  switch (stance) {
    case 'left':
      return clamp(50 + popularity + (publicServices - 50) * 0.6 - costOfLiving, 0, 100);
    case 'right':
      return clamp(50 + popularity * 0.4 - (publicServices - 50) * 0.3 - costOfLiving, 0, 100);
    default:
      return clamp(50 + popularity * 0.8 - costOfLiving, 0, 100);
  }
}

export interface MediaTickInput {
  state: MediaState;
  approval: number;
  cpiInflation: number;
  publicServices: number;
  mediaAttention: number;
  factionUnrest: number;
  week: number;
  seed: number;
}

export interface MediaTickResult {
  state: MediaState;
  effects: Effects;
  log: string[];
}

export function advanceMedia(input: MediaTickInput): MediaTickResult {
  const pressMood: Record<PaperId, number> = { ...input.state.pressMood };

  for (const outlet of MEDIA_OUTLETS) {
    const target = outletTarget(outlet.stance, input.approval, input.cpiInflation, input.publicServices);
    const current = pressMood[outlet.id] ?? 50;
    pressMood[outlet.id] = r1(clamp(current + (target - current) * 0.2, 0, 100));
  }

  // Hostility builds under scrutiny and party unrest, and decays without them.
  const hostilityDelta =
    (input.mediaAttention - 50) * 0.04 + (input.factionUnrest - 30) * 0.03 - 1;
  const hostility = r1(clamp(input.state.hostility + hostilityDelta, 0, 100));

  const moods = MEDIA_OUTLETS.map((o) => pressMood[o.id]);
  const state: MediaState = {
    ...input.state,
    pressMood,
    hostility,
    cycleTone: r2(clamp((mean(moods) - 50) / 50, -1, 1)),
  };

  const effects = mediaEffects(state);
  const log: string[] = [];
  if (Object.keys(effects).length > 0 && input.state.hostility < MEDIA_HOSTILITY_FLOOR) {
    const coldest = MEDIA_OUTLETS.reduce((worst, o) =>
      pressMood[o.id] < pressMood[worst.id] ? o : worst,
    );
    log.push(`PRESS: ${coldest.name} turns on the government; coverage hardens.`);
  }

  return { state, effects, log };
}

/**
 * Gameplay effects implied by the press. Empty while hostility is tolerable and
 * every outlet is inside the mood band — which keeps a default press inert.
 */
export function mediaEffects(state: MediaState): Effects {
  const moods = MEDIA_OUTLETS.map((o) => state.pressMood[o.id]);
  const inBand = moods.every((m) => m > MEDIA_MOOD_BAND_LOW && m < MEDIA_MOOD_BAND_HIGH);
  if (state.hostility < MEDIA_HOSTILITY_FLOOR && inBand) return {};

  const hostilityExcess = Math.max(0, state.hostility - MEDIA_HOSTILITY_FLOOR);
  const bandExcess = moods.reduce(
    (sum, m) => sum + Math.max(0, MEDIA_MOOD_BAND_LOW - m) + Math.max(0, m - MEDIA_MOOD_BAND_HIGH),
    0,
  );

  // Deliberately gentle: the press nags a government, it does not fell one on its own.
  // Capped at 0.25 approval/turn so sustained hostility is a drag, not a death spiral.
  const approvalCost = Math.min(0.25, hostilityExcess * 0.004 + bandExcess * 0.004);

  return {
    approval: -r2(approvalCost),
    mediaAttention: r2(approvalCost * 0.8),
  };
}

export interface BriefingResult {
  state: MediaState;
  effects: Effects;
}

/**
 * A lobby briefing: the classic No10 lever. It leans on one outlet, always
 * carries a whiff of manipulation, and cannot be repeated inside the cooldown.
 */
export function lobbyBriefing(
  state: MediaState,
  outletId: PaperId,
  angle: 'boost' | 'attack',
  week: number,
): BriefingResult {
  if (state.lastBriefingWeek !== null && week - state.lastBriefingWeek < BRIEFING_COOLDOWN_WEEKS) {
    return { state, effects: {} };
  }
  const pressMood: Record<PaperId, number> = { ...state.pressMood };
  const current = pressMood[outletId] ?? 50;
  pressMood[outletId] = r1(clamp(current + (angle === 'boost' ? 6 : -8), 0, 100));
  const hostility = r1(clamp(state.hostility + (angle === 'attack' ? 4 : 2), 0, 100));
  const next: MediaState = { ...state, pressMood, hostility, lastBriefingWeek: week };
  return { state: next, effects: mediaEffects(next) };
}

/** Summary coverage tone for the UI: -1 hostile .. +1 friendly. */
export function coverageTone(state: MediaState): number {
  return state.cycleTone;
}