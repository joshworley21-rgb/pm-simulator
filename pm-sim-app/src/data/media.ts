/**
 * Fixed UK media configuration.
 * Three fictional national outlets spanning the political spectrum.
 */

export type MediaId = 'centrist' | 'left' | 'right';

export interface MediaOutlet {
  id: MediaId;
  name: string;
  abbreviation: string;
  stance: 'centrist' | 'left' | 'right';
  influence: number; // 1-10
  audience: string;
}

export const MEDIA_OUTLETS: readonly MediaOutlet[] = [
  {
    id: 'centrist',
    name: 'The National Standard',
    abbreviation: 'NSTD',
    stance: 'centrist',
    influence: 10,
    audience: 'Suburban professionals, the civil service, and swing voters across Middle England.',
  },
  {
    id: 'left',
    name: 'The Clarion',
    abbreviation: 'CLR',
    stance: 'left',
    influence: 8,
    audience: 'Trade unionists, students, public-sector workers and metropolitan progressives.',
  },
  {
    id: 'right',
    name: 'The Courier',
    abbreviation: 'CRR',
    stance: 'right',
    influence: 9,
    audience: 'Business readers, older rural voters and Conservative-leaning homeowners.',
  },
] as const;

export function getMediaByStance(stance: 'centrist' | 'left' | 'right'): MediaOutlet {
  return MEDIA_OUTLETS.find((m) => m.stance === stance) || MEDIA_OUTLETS[0];
}

export function getAllMediaIds(): MediaId[] {
  return ['centrist', 'left', 'right'];
}

export const MEDIA_NAMES: Record<MediaId, string> = {
  centrist: 'The National Standard',
  left: 'The Clarion',
  right: 'The Courier',
} as const;
