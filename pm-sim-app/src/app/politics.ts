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
  { name: 'Aisha Rahman', post: 'Chancellor of the Exchequer', partyId: 'reform', loyalty: 78, competence: 85, faction: 'Soft Left' },
  { name: 'Tom Calloway', post: 'Home Secretary', partyId: 'reform', loyalty: 88, competence: 72, faction: 'Centrist' },
  { name: 'Grace O\u2019Donnell', post: 'Health Secretary', partyId: 'reform', loyalty: 70, competence: 80, faction: 'Left' },
  { name: 'James Whitfield', post: 'Education Secretary', partyId: 'reform', loyalty: 82, competence: 74, faction: 'Soft Left' },
  { name: 'Priya Nair', post: 'Business Secretary', partyId: 'reform', loyalty: 75, competence: 88, faction: 'Centrist' },
  { name: 'Oliver Stanmore', post: 'Defence Secretary', partyId: 'reform', loyalty: 80, competence: 68, faction: 'Centrist' },
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

/** PMQs exchanges: the opposition leader and a backbench question. */
export const PMQ_POOL: PmqQuestion[] = [
  {
    id: 'pmq-economy',
    from: 'Opposition Leader',
    question: 'The Prime Minister promised growth. After a year in office, inflation is up, wages are flat, and the economy is stagnant. Is this really \u201cchange\u201d the country can feel?',
    options: [
      { id: 'defend', label: 'Blame the inherited mess', effects: { approval: -1, partyConfidence: 2, mediaAttention: 8 } },
      { id: 'own', label: 'Own it and point to the plan', effects: { approval: 2, partyConfidence: -1, mediaAttention: 10 } },
      { id: 'attack', label: 'Attack the opposition record', effects: { approval: 0, mediaAttention: 12, supportDelta: { conservative: -2 } } },
    ],
  },
  {
    id: 'pmq-nhs',
    from: 'Backbench MP',
    question: 'My local hospital has an 18-hour A&E wait. When will the Prime Minister finally get a grip on the NHS they promised to save?',
    options: [
      { id: 'defend', label: 'Highlight record funding', effects: { approval: 1, publicServices: 1 } },
      { id: 'own', label: 'Acknowledge the pressure and pledge action', effects: { approval: 2, partyConfidence: -1 } },
      { id: 'attack', label: 'Blame the previous government', effects: { approval: -1, mediaAttention: 8 } },
    ],
  },
  {
    id: 'pmq-immigration',
    from: 'Opposition Leader',
    question: 'Net migration is up again and small boats keep coming. The Prime Minister said they would get numbers down. Why should anyone believe them now?',
    options: [
      { id: 'defend', label: 'Blame the broken system inherited', effects: { approval: -1, supportDelta: { populist: 2 } } },
      { id: 'own', label: 'Admit it is too high, promise action', effects: { approval: 1, supportDelta: { populist: -1 } } },
      { id: 'attack', label: 'Turn it on Reform UK', effects: { approval: 1, supportDelta: { populist: -3 } } },
    ],
  },
  {
    id: 'pmq-cost-of-living',
    from: 'Opposition Leader',
    question: 'Families are choosing between heating and eating. Mortgage rates are stuck high. What does the Prime Minister say to voters who feel abandoned?',
    options: [
      { id: 'defend', label: 'Point to falling inflation', effects: { approval: 1, economy: 0 } },
      { id: 'own', label: 'Acknowledge the squeeze and announce help', effects: { approval: 2, fundsDelta: -100 } },
      { id: 'attack', label: 'Blame global shocks', effects: { approval: -1 } },
    ],
  },
  {
    id: 'pmq-housing',
    from: 'Backbench MP',
    question: 'Young people in my constituency cannot afford a home. When will the Prime Minister stand up to the nimbys and build houses?',
    options: [
      { id: 'defend', label: 'Highlight planning reform', effects: { approval: 1, economy: 1 } },
      { id: 'own', label: 'Commit to a 1.5m home target', effects: { approval: 2, publicServices: 1, partyConfidence: -1 } },
      { id: 'attack', label: 'Blame council blockers', effects: { approval: 0, mediaAttention: 8 } },
    ],
  },
];
