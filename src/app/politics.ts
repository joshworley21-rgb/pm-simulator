import type { Minister, ForeignIssue, PmqQuestion, Backbencher } from './types';

/** Backbench Labour MPs available for promotion to cabinet. */
export const BACKBENCHERS: Backbencher[] = [
  { name: 'Chloe Hartigan', partyId: 'reform', faction: 'Soft Left', loyalty: 72, competence: 76, ambition: 81 },
  { name: 'Marcus Drey', partyId: 'reform', faction: 'Centrist', loyalty: 84, competence: 71, ambition: 68 },
  { name: 'Elena Marchetti', partyId: 'reform', faction: 'Soft Left', loyalty: 66, competence: 82, ambition: 79 },
  { name: 'Dev Patel', partyId: 'reform', faction: 'Left', loyalty: 55, competence: 79, ambition: 88 },
  { name: 'Rachel Osei', partyId: 'reform', faction: 'Centrist', loyalty: 81, competence: 74, ambition: 71 },
  { name: 'Tom Ashworth', partyId: 'reform', faction: 'Left', loyalty: 60, competence: 66, ambition: 75 },
];

/** Initial cabinet for a Labour PM (the default starting majority). */
export const DEFAULT_CABINET: Minister[] = [
  { name: 'Aisha Rahman', post: 'Chancellor of the Exchequer', partyId: 'reform', loyalty: 78, competence: 85, faction: 'Soft Left', publicProfile: 82 },
  { name: 'Tom Calloway', post: 'Home Secretary', partyId: 'reform', loyalty: 88, competence: 72, faction: 'Centrist', publicProfile: 74 },
  { name: 'Grace O\u2019Donnell', post: 'Health Secretary', partyId: 'reform', loyalty: 70, competence: 80, faction: 'Left', publicProfile: 79 },
  { name: 'James Whitfield', post: 'Education Secretary', partyId: 'reform', loyalty: 82, competence: 74, faction: 'Soft Left', publicProfile: 66 },
  { name: 'Priya Nair', post: 'Business Secretary', partyId: 'reform', loyalty: 75, competence: 88, faction: 'Centrist', publicProfile: 71 },
  { name: 'Nadia Okonkwo', post: 'Foreign Secretary', partyId: 'reform', loyalty: 74, competence: 83, faction: 'Centrist', publicProfile: 86, ambition: 66 },
  { name: 'Oliver Stanmore', post: 'Defence Secretary', partyId: 'reform', loyalty: 80, competence: 68, faction: 'Centrist', publicProfile: 69 },
  { name: 'Ruth Adeyemi', post: 'Justice Secretary', partyId: 'reform', loyalty: 76, competence: 81, faction: 'Soft Left', publicProfile: 72 },
  { name: 'Callum Fraser', post: 'Work and Pensions Secretary', partyId: 'reform', loyalty: 72, competence: 70, faction: 'Centrist', publicProfile: 58 },
  { name: 'Meera Shah', post: 'Transport Secretary', partyId: 'reform', loyalty: 84, competence: 76, faction: 'Left', publicProfile: 63 },
  { name: 'Edward Bryce', post: 'Environment Secretary', partyId: 'reform', loyalty: 68, competence: 73, faction: 'Soft Left', publicProfile: 61 },
  { name: 'Lydia Marsh', post: 'Culture Secretary', partyId: 'reform', loyalty: 79, competence: 69, faction: 'Centrist', publicProfile: 77 },
];

/** Foreign issues the PM can confront, each with a full choice set. */
export const FOREIGN_POOL: ForeignIssue[] = [
  {
    id: 'fi-sec-state-trade',
    leader: 'Secretary Kincaid',
    country: 'United States',
    topic: 'US tariff threat on British steel and cars',
    options: [
      { id: 'soft', label: 'Offer a narrow trade carve-out', summary: 'Preserve UK exports while conceding limited market access.', effects: { economy: 2, approval: 1, security: -1 } },
      { id: 'firm', label: 'Threaten reciprocal tariffs', summary: 'Show resolve, but rattle the City and exporters.', effects: { economy: -3, security: 2, approval: -1 } },
    ],
  },
  {
    id: 'fi-president-macron',
    leader: 'Pr\u00e9sident Moreau',
    country: 'France',
    topic: 'Small-boat returns agreement',
    options: [
      { id: 'pay', label: 'Pay for joint patrols', summary: 'Pay Paris for beach patrols and drones.', effects: { netMigration: -20, fundsDelta: -180, approval: 1 } },
      { id: 'refuse', label: 'Refuse extra cash, demand EU burden-sharing', summary: 'Save money but risk the deal collapsing.', effects: { netMigration: 5, fundsDelta: 0, approval: -2 } },
    ],
  },
  {
    id: 'fi-chancellor-brandt',
    leader: 'Kanzler Brandt',
    country: 'Germany',
    topic: 'Energy security and gas imports',
    options: [
      { id: 'lng', label: 'Strike a long-term LNG import deal', summary: 'Secure supply, slightly higher prices.', effects: { security: 4, cpiInflation: 0.2, economy: 1 } },
      { id: 'renewables', label: 'Pivot to a joint renewables corridor', summary: 'Political win, slower near-term relief.', effects: { economy: 2, cpiInflation: 0.1 } },
    ],
  },
  {
    id: 'fi-pm-trudeau-ca',
    leader: 'Prime Minister Lalonde',
    country: 'Canada',
    topic: 'Post-Brexit trade deal ratification',
    options: [
      { id: 'sign', label: 'Sign the rollover trade deal', summary: 'Lock in tariff-free access with a major partner.', effects: { economy: 3, approval: 1 } },
      { id: 'renegotiate', label: 'Demand better agriculture terms', summary: 'Risk delay for a better deal.', effects: { economy: -1, approval: -1, publicServices: 0 } },
    ],
  },
  {
    id: 'fi-president-saudi',
    leader: 'Crown Prince Faisal',
    country: 'Saudi Arabia',
    topic: 'Arms sales and human rights pressure',
    options: [
      { id: 'sell', label: 'Approve the arms sale', summary: 'Jobs and influence, but reputational cost.', effects: { economy: 2, approval: -2, security: 2 } },
      { id: 'block', label: 'Block on human-rights grounds', summary: 'Moral win, strains an ally.', effects: { approval: 2, economy: -2 } },
    ],
  },
];

export { PMQ_POOL, PMQ_TEMPLATES } from './pmqData';
