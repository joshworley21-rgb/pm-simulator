import type { GameState } from './types';
import { PURDAH_TURNS } from './calendar';
import { sessionWeekFor } from './parliament';

/**
 * The National Tension Index is a presentation reading, not a new engine stat.
 *
 * It folds together signals the simulation already publishes so the player can
 * see the mood of the country in one line: public approval, party confidence,
 * press hostility, the 1922 letters count, faction unrest and gilt pressure.
 * A live black swan dominates the reading while it is open.
 */
export interface TensionComponent {
  label: string;
  value: number;
}

export type TensionTone = 'success' | 'accent' | 'warning' | 'danger';

export interface TensionReading {
  value: number;
  label: string;
  tone: TensionTone;
  components: TensionComponent[];
}

export interface CalendarChip {
  label: string;
  tone: TensionTone;
}

const clamp = (n: number, min = 0, max = 100): number => Math.max(min, Math.min(max, n));
const round = (n: number): number => Math.round(n);

function pressPressure(state: GameState): number {
  const moods = Object.values(state.mediaState?.pressMood ?? {});
  if (moods.length === 0) return 50;
  const average = moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
  return clamp(100 - average);
}

function giltPressure(state: GameState): number {
  return clamp((state.stats.giltYield - 2) * 18);
}

function lettersPressure(state: GameState): number {
  const threshold = Math.max(1, state.stats.lettersThreshold || 15);
  return clamp((state.stats.lettersOfNoConfidence / threshold) * 100);
}

function crisisPressure(state: GameState): number {
  return state.blackSwanState?.active ? 90 : 0;
}

export function deriveTensionIndex(state: GameState): TensionReading {
  const approval = clamp(100 - state.metrics.approval);
  const confidence = clamp(100 - state.metrics.partyConfidence);
  const press = pressPressure(state);
  const letters = lettersPressure(state);
  const factions = clamp(state.factionUnrest);
  const gilts = giltPressure(state);
  const crisis = crisisPressure(state);

  const value = round(
    approval * 0.18 +
      confidence * 0.16 +
      press * 0.16 +
      letters * 0.14 +
      factions * 0.14 +
      gilts * 0.1 +
      crisis * 0.12,
  );

  const tone: TensionTone =
    value <= 25 ? 'success' : value <= 45 ? 'accent' : value <= 65 ? 'warning' : 'danger';
  const label =
    value <= 25 ? 'CALM' : value <= 45 ? 'WATCHFUL' : value <= 65 ? 'ELEVATED' : value <= 82 ? 'SEVERE' : 'CRITICAL';

  return {
    value,
    label,
    tone,
    components: [
      { label: 'APPROVAL', value: round(approval) },
      { label: 'PARTY', value: round(confidence) },
      { label: 'PRESS', value: round(press) },
      { label: 'LEADERSHIP', value: round(letters) },
      { label: 'FACTIONS', value: round(factions) },
      { label: 'GILTS', value: round(gilts) },
      ...(crisis > 0 ? [{ label: 'CRISIS', value: round(crisis) }] : []),
    ],
  };
}

/** The calendar strip that sits alongside the tension reading. */
export function deriveCalendar(state: GameState): CalendarChip[] {
  const sessionWeek = state.parliamentState?.sessionWeek ?? sessionWeekFor(state.week);
  const chips: CalendarChip[] = [
    { label: `MONTH ${state.week}`, tone: 'accent' },
    { label: `SESSION MONTH ${sessionWeek}`, tone: 'accent' },
  ];

  if (state.fiscalEventKind === 'autumn') {
    chips.push({ label: 'AUTUMN STATEMENT', tone: 'warning' });
  } else if (state.fiscalEventKind === 'budget' || state.budgetDue) {
    chips.push({ label: 'BUDGET DUE', tone: 'warning' });
  } else if (state.pmq) {
    chips.push({ label: 'PMQs WAITING', tone: 'warning' });
  } else {
    chips.push({ label: 'NO FISCAL EVENT', tone: 'accent' });
  }

  if (state.turnsUntilElection <= PURDAH_TURNS) {
    chips.push({
      label: `PURDAH · ${Math.max(0, state.turnsUntilElection)}M`,
      tone: 'danger',
    });
  } else {
    chips.push({ label: `${state.turnsUntilElection}M TO ELECTION`, tone: 'accent' });
  }

  return chips;
}
