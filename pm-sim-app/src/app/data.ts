import type { Party, Relation, GameEvent } from './types';

export const INITIAL_PARTIES: Party[] = [
  {
    id: 'conservative', name: 'Conservative Party', abbreviation: 'CON', color: '#0087DC',
    ideology: 'centre-right', leader: 'Richard Hartley',
    description: 'Low taxes, fiscal discipline, strong defence and family values.',
    baseSupport: 24, currentSupport: 24, seats: 0, funds: 1200,
  },
  {
    id: 'reform', name: 'Labour Party', abbreviation: 'LAB', color: '#DC241F',
    ideology: 'centre-left', leader: 'Daniel Mercer',
    description: 'Rebuilt public services, workers\u2019 rights and economic growth.',
    baseSupport: 34, currentSupport: 34, seats: 0, funds: 1400,
  },
  {
    id: 'liberty', name: 'Liberal Democrats', abbreviation: 'LD', color: '#FDBB30',
    ideology: 'centre', leader: 'Sophie Ashdown',
    description: 'Civil liberties, localism and closer ties with Europe.',
    baseSupport: 12, currentSupport: 12, seats: 0, funds: 600,
  },
  {
    id: 'populist', name: 'Reform UK', abbreviation: 'RFM', color: '#12B6CF',
    ideology: 'right', leader: 'Nigel Crossley',
    description: 'Anti-establishment, lower immigration and a smaller state.',
    baseSupport: 14, currentSupport: 14, seats: 0, funds: 500,
  },
  {
    id: 'progressive', name: 'Green Party', abbreviation: 'GRN', color: '#6AB023',
    ideology: 'left', leader: 'Imogen Hale',
    description: 'Climate action, public ownership and electoral reform.',
    baseSupport: 7, currentSupport: 7, seats: 0, funds: 350,
  },
];

export const INITIAL_RELATIONS: Relation[] = [
  { from: 'reform', to: 'conservative', score: -55 },
  { from: 'reform', to: 'liberty', score: 25 },
  { from: 'reform', to: 'populist', score: -70 },
  { from: 'reform', to: 'progressive', score: 45 },
  { from: 'conservative', to: 'reform', score: -55 },
  { from: 'conservative', to: 'liberty', score: 10 },
  { from: 'conservative', to: 'populist', score: 55 },
  { from: 'conservative', to: 'progressive', score: -35 },
  { from: 'liberty', to: 'reform', score: 20 },
  { from: 'liberty', to: 'conservative', score: 10 },
  { from: 'liberty', to: 'populist', score: -60 },
  { from: 'liberty', to: 'progressive', score: 50 },
  { from: 'populist', to: 'reform', score: -70 },
  { from: 'populist', to: 'conservative', score: 50 },
  { from: 'populist', to: 'liberty', score: -65 },
  { from: 'populist', to: 'progressive', score: -55 },
  { from: 'progressive', to: 'reform', score: 40 },
  { from: 'progressive', to: 'conservative', score: -30 },
  { from: 'progressive', to: 'liberty', score: 45 },
  { from: 'progressive', to: 'populist', score: -60 },
];

export interface Region {
  id: string;
  name: string;
  seats: number;
  support: Record<string, number>;
}

export const REGIONS: Region[] = [
  { id: 'london', name: 'London', seats: 75, support: { conservative: 20, reform: 44, liberty: 22, populist: 5, progressive: 7 } },
  { id: 'south-east', name: 'South East England', seats: 91, support: { conservative: 31, reform: 28, liberty: 23, populist: 12, progressive: 5 } },
  { id: 'south-west', name: 'South West England', seats: 58, support: { conservative: 27, reform: 27, liberty: 30, populist: 10, progressive: 5 } },
  { id: 'east', name: 'East of England', seats: 61, support: { conservative: 31, reform: 33, liberty: 15, populist: 15, progressive: 5 } },
  { id: 'midlands', name: 'Midlands', seats: 104, support: { conservative: 27, reform: 39, liberty: 9, populist: 17, progressive: 5 } },
  { id: 'north', name: 'North of England', seats: 154, support: { conservative: 21, reform: 45, liberty: 10, populist: 17, progressive: 6 } },
  { id: 'scotland', name: 'Scotland', seats: 57, support: { conservative: 16, reform: 30, liberty: 13, populist: 9, progressive: 6 } },
  { id: 'wales', name: 'Wales', seats: 32, support: { conservative: 20, reform: 43, liberty: 9, populist: 15, progressive: 5 } },
  { id: 'ni', name: 'Northern Ireland', seats: 18, support: { conservative: 12, reform: 8, liberty: 12, populist: 6, progressive: 4 } },
];

export const BACKGROUNDS = [
  'Seasoned cabinet minister',
  'Former broadcast journalist',
  'Trade union organiser',
  'Business leader',
  'Academic economist',
  'Military veteran',
];

export const EVENTS: GameEvent[] = [
  {
    id: 'evt-secret-talks',
    title: 'Secret Talks',
    summary: 'The Conservative leadership is quietly courting Reform UK over a right-of-centre pact.',
    sourceParty: 'conservative',
    severity: 4,
    dialogs: [
      { speaker: null, text: 'An aide slips you a note: Conservative and Reform UK whips met privately about standing aside in a dozen marginal seats.' },
      { speaker: 'conservative', text: '\u2018Crossley\u2019s voters are real. If we split the right on our terms, we control the damage.\u2019' },
    ],
    choices: [
      { id: 'encourage', text: 'Quietly encourage the pact', consequence: 'Negotiations accelerate, but centrist Conservative donors are spooked.', effects: { supportDelta: { conservative: 3, populist: 5, reform: -3 }, approval: -2, mediaAttention: 10 } },
      { id: 'block', text: 'Block it', consequence: 'The talks stall. Reform UK feels snubbed, but the Conservative brand stays intact.', effects: { supportDelta: { populist: -3, reform: 2 }, approval: 1, mediaAttention: 5 } },
      { id: 'leak', text: 'Leak it to the press', consequence: 'The story dominates the news cycle, wounding both right-of-centre parties.', effects: { supportDelta: { conservative: -6, populist: -5, reform: 3, liberty: 3 }, approval: 3, mediaAttention: 25 } },
    ],
  },
  {
    id: 'evt-rail-strike',
    title: 'Signals Failure',
    summary: 'The rail unions, led by Labour\u2019s Grace O\u2019Donnell, threaten a national walkout.',
    sourceParty: 'reform',
    severity: 3,
    dialogs: [
      { speaker: null, text: 'Picket lines are forming outside depots from Crewe to Carlisle. The unions have given the government 72 hours to return to the table.' },
      { speaker: 'reform', text: '\u2018Months of real-terms cuts, understaffed shifts, and ministers who won\u2019t pick up the phone.\u2019' },
    ],
    choices: [
      { id: 'support', text: 'Side with the unions', consequence: 'The unions welcome the intervention, but business groups cry betrayal.', effects: { supportDelta: { reform: 5, progressive: 2, conservative: -3 }, approval: -1, economy: -6, publicServices: 3 } },
      { id: 'negotiate', text: 'Force a compromise settlement', consequence: 'A deal is patched together after days of talks.', effects: { supportDelta: { reform: 1, conservative: 1 }, approval: 2, economy: -2, publicServices: 1 } },
      { id: 'legislate', text: 'Minimum-service legislation', consequence: 'The walkout is blunted, but industrial relations sour badly.', effects: { supportDelta: { reform: -5, conservative: 2, populist: 2 }, approval: -2, economy: 3, publicServices: -4 } },
    ],
  },
  {
    id: 'evt-nhs-winter',
    title: 'Winter Pressures',
    summary: 'Hospitals are declaring critical incidents as flu and staffing shortages bite.',
    severity: 5,
    dialogs: [
      { speaker: null, text: 'The NHS chief executive has warned that emergency departments are at breaking point, with corridors full and ambulances queuing.' },
      { speaker: null, text: 'The opposition is demanding emergency funding. Your Chancellor is warning about the cost.' },
    ],
    choices: [
      { id: 'fund', text: 'Announce emergency funding', consequence: 'Frontline staff and the public cheer, but the deficit worsens.', effects: { approval: 5, publicServices: 8, economy: -4, partyConfidence: 3, fundsDelta: -300 } },
      { id: 'reform', text: 'Fund, but demand reform', consequence: 'A balanced package lands well with voters but angers some in your own party.', effects: { approval: 3, publicServices: 5, economy: -2, partyConfidence: -2, fundsDelta: -150 } },
      { id: 'hold', text: 'Hold the line on spending', consequence: 'The markets are calm, but public anger mounts.', effects: { approval: -6, publicServices: -5, economy: 3, partyConfidence: -3 } },
    ],
  },
  {
    id: 'evt-trade-row',
    title: 'Trade Dispute',
    summary: 'Brussels has threatened retaliatory tariffs over new border checks.',
    severity: 3,
    dialogs: [
      { speaker: null, text: 'A terse communiqu\u00e9 from the Commission warns of tariffs on British exports within a fortnight.' },
      { speaker: 'liberty', text: '\u2018This is exactly the cost of needless friction. The Prime Minister must de-escalate.\u2019' },
    ],
    choices: [
      { id: 'deescalate', text: 'Seek a diplomatic reset', consequence: 'Relations thaw, though sovereignty hawks accuse you of weakness.', effects: { approval: 2, economy: 4, supportDelta: { liberty: 3, populist: -3 } } },
      { id: 'retaliate', text: 'Match tariff for tariff', consequence: 'You look strong, but exporters and the City take fright.', effects: { approval: 1, economy: -5, security: 2, supportDelta: { populist: 3, liberty: -3 } } },
    ],
  },
];
