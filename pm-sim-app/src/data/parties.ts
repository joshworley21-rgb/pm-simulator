import type { Party } from '../types';

/**
 * UK political parties — 5 main national parties.
 *
 * Internal party IDs are KEPT from the donor engine so relations, AI intents,
 * committee init and government formation continue to work unchanged; only the
 * human-visible UK branding is new.
 *
 *   conservative → Conservative Party
 *   reform       → Labour Party
 *   liberty      → Liberal Democrats
 *   populist     → Reform UK
 *   progressive  → Green Party
 *
 * All politicians are original fictional characters — no real politicians.
 *
 * baseSupport / currentSupport = national vote share (%).
 * projectedSeats = reference 650-seat FPTP starting figures; the election
 * engine recomputes the actual result from regional supportByParty.
 */
export const initialParties: Party[] = [
  {
    id: 'conservative',
    name: 'Conservative Party',
    abbreviation: 'CON',
    color: '#0087DC',
    ideology: 'center-right',
    leader: 'Richard Hartley',
    members: [
      'Eleanor Wainwright', 'Marcus Okafor', 'Charles Beaumont',
      'Philippa Ashworth', 'George Redfern', 'Harriet Colville',
    ],
    description:
      'The traditional party of government: low taxes, fiscal discipline, strong defence and family values. Rooted in the English shires, the South and older, rural voters.',
    baseSupport: 24,
    currentSupport: 24,
    projectedSeats: 121,
    funds: 1200,
    organization: 76,
    charisma: 55,
  },
  {
    id: 'reform',
    name: 'Labour Party',
    abbreviation: 'LAB',
    color: '#DC241F',
    ideology: 'center-left',
    leader: 'Daniel Mercer',
    members: [
      'Aisha Rahman', 'Tom Calloway', "Grace O'Donnell",
      'James Whitfield', 'Priya Nair', 'Oliver Stanmore',
    ],
    description:
      'The broad centre-left movement of working people, trade unions and public services: reindustrialisation, a rebuilt NHS, workers\u2019 rights and redistribution.',
    baseSupport: 34,
    currentSupport: 34,
    projectedSeats: 411,
    funds: 1400,
    organization: 88,
    charisma: 78,
  },
  {
    id: 'liberty',
    name: 'Liberal Democrats',
    abbreviation: 'LD',
    color: '#FDBB30',
    ideology: 'center',
    leader: 'Sophie Ashdown',
    members: [
      'Hugh Pemberton', 'Nadia Ellis', 'Felicity Trent', 'Alistair Monroe',
    ],
    description:
      'Centrist and socially liberal, strongest in university towns, the South West and suburban middle England. Pro-European, pro-civil-liberties, pro-localism.',
    baseSupport: 12,
    currentSupport: 12,
    projectedSeats: 72,
    funds: 600,
    organization: 64,
    charisma: 66,
  },
  {
    id: 'populist',
    name: 'Reform UK',
    abbreviation: 'RFM',
    color: '#12B6CF',
    ideology: 'right',
    leader: 'Nigel Crossley',
    members: [
      'Derek Hartley', 'Sandra Whitmore', 'Lee Bancroft', 'Tamsin Drake',
    ],
    description:
      'Populist, anti-establishment and anti-immigration, drawing disaffected voters across the post-industrial North, Midlands and coastal towns. Suffers the classic FPTP squeeze: high vote share, few seats.',
    baseSupport: 14,
    currentSupport: 14,
    projectedSeats: 5,
    funds: 500,
    organization: 52,
    charisma: 74,
  },
  {
    id: 'progressive',
    name: 'Green Party',
    abbreviation: 'GRN',
    color: '#6AB023',
    ideology: 'left',
    leader: 'Imogen Hale',
    members: [
      'Ravi Chandrasekhar', 'Bethany Cole', 'Fraser Dunbar', 'Yasmin Iqbal',
    ],
    description:
      'Environmentalist and social-justice party, prioritising climate action, public ownership of utilities and electoral reform. Strongest in university cities and Brighton.',
    baseSupport: 7,
    currentSupport: 7,
    projectedSeats: 4,
    funds: 350,
    organization: 58,
    charisma: 60,
  },
];
