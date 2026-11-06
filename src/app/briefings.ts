import type { Department, Dossier } from './types';

/**
 * Presentation voice for a Red Box submission.
 *
 * The engine models a dossier by department and urgency, not by the official who
 * signed the covering note. This module supplies the missing human detail at the
 * edge of the UI: a named permanent secretary and the kind of marginal note a
 * minister would actually receive. It never feeds back into the simulation.
 */
export interface BriefingMeta {
  permanentSecretary: string;
  role: string;
  marginalia: string;
}

const BY_DEPARTMENT: Record<Department, BriefingMeta> = {
  'Number 10': {
    permanentSecretary: 'Sir Oliver Wren KCB',
    role: 'Cabinet Secretary · Cabinet Office',
    marginalia: 'No. 10 will not own this if it goes wrong.',
  },
  'HM Treasury': {
    permanentSecretary: 'Sir Alistair Finch KCB',
    role: 'Permanent Secretary · HM Treasury',
    marginalia: 'Treasury warns against this.',
  },
  'Home Office': {
    permanentSecretary: 'Dame Priya Raghavan',
    role: 'Permanent Secretary · Home Office',
    marginalia: 'The legal advice is not yet settled.',
  },
  'DHSC (Health)': {
    permanentSecretary: 'Dr Marcus Ellery',
    role: 'Permanent Secretary · DHSC',
    marginalia: 'The clinical case is stronger than the money case.',
  },
  'Foreign Office': {
    permanentSecretary: 'Sir Julian Voss KCMG',
    role: 'Permanent Secretary · FCDO',
    marginalia: 'The Ambassador has not been told.',
  },
  'Ministry of Defence': {
    permanentSecretary: 'Air Chief Marshal Ruth Calder',
    role: 'Permanent Secretary · Ministry of Defence',
    marginalia: 'The Chiefs want a decision by Friday.',
  },
  'Energy & Net Zero': {
    permanentSecretary: 'Dame Helen Marsh',
    role: 'Permanent Secretary · DESNZ',
    marginalia: 'This one will be carried by No. 10 alone.',
  },
};

const FALLBACK: BriefingMeta = {
  permanentSecretary: 'Sir Peter Hale KCB',
  role: 'Permanent Secretary · Cabinet Office',
  marginalia: 'The Department has not cleared this line.',
};

/** A stable note; urgency changes the tone, never the underlying advice. */
export function getBriefingMeta(dossier: Pick<Dossier, 'department' | 'urgent'>): BriefingMeta {
  const base = BY_DEPARTMENT[dossier.department] ?? FALLBACK;
  if (!dossier.urgent) return base;
  return {
    ...base,
    marginalia: `${base.marginalia} This cannot wait for the weekend.`,
  };
}
