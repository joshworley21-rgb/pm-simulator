import type { GameState, PmqQuestion, Party } from './types';

/**
 * Rich Westminster Prime Minister's Questions (PMQs) question bank.
 *
 * Covers 50 diverse departmental and political issues across every aspect
 * of UK government: economy, NHS, taxation, borrowing, migration, policing,
 * prisons, schools, universities, welfare, defence, energy, water/sewage,
 * devolution, transport, and Westminster party politics.
 */

export interface PmqTemplate {
  id: string;
  topic: string;
  /** Whether this question is preferred by Leader of the Opposition or third party */
  preferredAsker?: 'loto' | 'third' | 'both';
  /** Priority score based on live state (higher = more urgent/relevant today) */
  relevance: (s: GameState) => number;
  /** Question text, dynamically formatted with live numbers */
  question: (s: GameState, askerTitle: string) => string;
  options: {
    id: string;
    label: string;
    effects: import('./types').Effects;
  }[];
}

export const PMQ_TEMPLATES: PmqTemplate[] = [
  // 1. Inflation & Cost of Living (LOTO)
  {
    id: 'pmq-cost-of-living',
    topic: 'inflation',
    preferredAsker: 'loto',
    relevance: (s) => (s.stats.cpiInflation > 4 ? 10 : s.stats.cpiInflation > 3 ? 6 : 2),
    question: (s) =>
      `With inflation sitting at ${s.stats.cpiInflation}% and food prices rising in every supermarket, families are choosing between heating and eating. What does the Prime Minister say to working voters who feel abandoned?`,
    options: [
      { id: 'defend', label: 'Point to falling global wholesale pressures', effects: { approval: 1 } },
      { id: 'own', label: 'Acknowledge the squeeze and promise targeted relief', effects: { approval: 2, budgetBalance: -1 } },
      { id: 'attack', label: 'Blame the previous administration’s fiscal legacy', effects: { approval: -1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 2. Economic Growth & Productivity (LOTO)
  {
    id: 'pmq-economy',
    topic: 'economy',
    preferredAsker: 'loto',
    relevance: (s) => (s.stats.gdpGrowth < 1.0 ? 8 : 3),
    question: (s) =>
      `The Prime Minister promised change and growth. After months in office, annual growth is running at just ${s.stats.gdpGrowth}% and business investment is frozen. Is this really the economic revival they promised?`,
    options: [
      { id: 'defend', label: 'Insist fundamentals are sound and growth takes time', effects: { approval: -1, partyConfidence: 2 } },
      { id: 'own', label: 'Own the challenge and unveil a targeted growth strategy', effects: { approval: 2, partyConfidence: -1 } },
      { id: 'attack', label: 'Attack the opposition’s disastrous track record on productivity', effects: { approval: 0, supportDelta: { conservative: -2 } } },
    ],
  },

  // 3. NHS Waiting Lists (LOTO)
  {
    id: 'pmq-nhs',
    topic: 'nhs',
    preferredAsker: 'loto',
    relevance: (s) => (s.stats.nhsWaitingList > 7.5 ? 10 : 5),
    question: (s) =>
      `There are now ${s.stats.nhsWaitingList} million patients waiting for NHS treatment, and patients are waiting hours in ambulances outside hospitals. When will the Prime Minister finally get a grip on our broken NHS?`,
    options: [
      { id: 'defend', label: 'Highlight record capital funding and diagnostics rollout', effects: { approval: 1, publicServices: 1 } },
      { id: 'own', label: 'Acknowledge the unacceptable delays and commit extra beds', effects: { approval: 2, partyConfidence: -1 } },
      { id: 'attack', label: 'Point out the opposition voted against NHS funding increases', effects: { approval: -1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 4. Junior Doctors & NHS Staffing
  {
    id: 'pmq-nhs-doctors',
    topic: 'nhs',
    preferredAsker: 'both',
    relevance: (s) => (s.metrics.publicServices < 50 ? 7 : 3),
    question: () =>
      'Senior consultants and junior doctors are burning out and thousands of shifts remain unfilled across acute trusts. Will the Prime Minister commit to fair pay restoration to stop the exodus abroad?',
    options: [
      { id: 'defend', label: 'Defend public pay discipline to protect public finances', effects: { approval: -1, partyConfidence: 2, economy: 1 } },
      { id: 'own', label: 'Offer independent arbitration and a workforce retention package', effects: { approval: 2, budgetBalance: -2, publicServices: 2 } },
      { id: 'attack', label: 'Condemn politically motivated union walkouts during winter', effects: { approval: 1, partyConfidence: 1, supportDelta: { progressive: -2 } } },
    ],
  },

  // 5. Net Migration & Small Boats (LOTO)
  {
    id: 'pmq-immigration',
    topic: 'migration',
    preferredAsker: 'loto',
    relevance: (s) => (s.stats.netMigration > 350 ? 9 : 4),
    question: (s) =>
      `Net migration reached ${s.stats.netMigration},000 and small boat crossings continue daily across the Channel. Why should the British public believe a word the Prime Minister says about controlling our borders?`,
    options: [
      { id: 'defend', label: 'Explain that returns agreements take time to negotiate', effects: { approval: -1, supportDelta: { populist: 2 } } },
      { id: 'own', label: 'Admit numbers are too high and announce tougher caseworker quotas', effects: { approval: 2, supportDelta: { populist: -1 } } },
      { id: 'attack', label: 'Attack Reform UK and populist grandstanding on unworkable schemes', effects: { approval: 1, supportDelta: { populist: -3 } } },
    ],
  },

  // 6. Housing & Generation Rent
  {
    id: 'pmq-housing',
    topic: 'housing',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'A generation of young Britons is locked out of home ownership and facing extortionate rents. When will the Prime Minister stand up to the nimbys and build the houses this country needs?',
    options: [
      { id: 'defend', label: 'Highlight statutory planning reforms and brownfield release', effects: { approval: 1, economy: 1 } },
      { id: 'own', label: 'Commit to an uncompromising 1.5 million homes target', effects: { approval: 2, publicServices: 1, partyConfidence: -1 } },
      { id: 'attack', label: 'Blame council blockers and local opposition obstruction', effects: { approval: 1, partyConfidence: -1 } },
    ],
  },

  // 7. Gilt Yields & Bond Market (LOTO)
  {
    id: 'pmq-gilt-market',
    topic: 'gilts',
    preferredAsker: 'loto',
    relevance: (s) => (s.stats.giltYield > 5.5 ? 10 : s.stats.giltYield > 4.5 ? 6 : 1),
    question: (s) =>
      `10-year gilt yields have surged to ${s.stats.giltYield}%, driving up mortgage rates and adding billions to government debt interest. Are the international markets losing confidence in this Prime Minister?`,
    options: [
      { id: 'defend', label: 'Point to global bond market movements and US Treasury rates', effects: { approval: -1, economy: 1 } },
      { id: 'own', label: 'Recommit firmly to fiscal orthodoxy and deficit reduction', effects: { approval: 1, partyConfidence: -1 } },
      { id: 'attack', label: 'Remind the House of the disastrous mini-budget crash under their watch', effects: { approval: 1, supportDelta: { conservative: -3 } } },
    ],
  },

  // 8. National Debt & Deficit (LOTO)
  {
    id: 'pmq-national-debt',
    topic: 'debt',
    preferredAsker: 'loto',
    relevance: (s) => (s.stats.debtToGdp > 105 || s.stats.budgetBalance < -80 ? 8 : 3),
    question: (s) =>
      `Debt-to-GDP stands at ${s.stats.debtToGdp}% and the Treasury is borrowing £${Math.abs(s.stats.budgetBalance)}bn this year. Is the Prime Minister’s economic strategy just maxing out the nation's credit card?`,
    options: [
      { id: 'defend', label: 'Argue that borrowing to invest in green energy and schools pays for itself', effects: { approval: 1, economy: 1, partyConfidence: -1 } },
      { id: 'own', label: 'Commit to strict departmental spending discipline at the next Budget', effects: { approval: -1, partyConfidence: 2 } },
      { id: 'attack', label: 'Remind the public that 80% of current debt was racked up by the opposition', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 9. Stealth Taxes & Frozen Allowances (Fiscal Drag)
  {
    id: 'pmq-fiscal-drag',
    topic: 'taxes',
    preferredAsker: 'loto',
    relevance: (s) => (s.thresholdsFrozen ? 8 : 2),
    question: (s) =>
      `By freezing personal allowances during inflation, the Prime Minister has dragged millions of lower-paid nurses, teachers and police into the 40p tax band. Why won't they admit this is a massive stealth tax on workers?`,
    options: [
      { id: 'defend', label: 'Defend threshold discipline as necessary to repair the public finances', effects: { approval: -2, partyConfidence: 2 } },
      { id: 'own', label: 'Promise to unfreeze personal allowances as soon as inflation allows', effects: { approval: 3, budgetBalance: -2 } },
      { id: 'attack', label: 'Point out that tax cuts without spending control would crash the pound', effects: { approval: 1, economy: 1 } },
    ],
  },

  // 10. Prison Overcrowding & Early Releases (LOTO)
  {
    id: 'pmq-prison-crisis',
    topic: 'justice',
    preferredAsker: 'loto',
    relevance: (s) => (s.metrics.security < 50 ? 8 : 4),
    question: () =>
      'Prisons are overflowing, police are holding suspects in police station cells, and the government is letting convicted offenders out early. How can the Prime Minister claim public safety is their top priority?',
    options: [
      { id: 'defend', label: 'Highlight rapid delivery of 10,000 new permanent prison places', effects: { approval: 1, security: 2 } },
      { id: 'own', label: 'Acknowledge the immediate crisis and announce temporary military barracks', effects: { approval: 2, budgetBalance: -1 } },
      { id: 'attack', label: 'Call out 14 years of underfunding that left prisons at 99% capacity', effects: { approval: 0, supportDelta: { conservative: -2 } } },
    ],
  },

  // 11. Police Numbers & Shoplifting
  {
    id: 'pmq-policing-crime',
    topic: 'policing',
    preferredAsker: 'both',
    relevance: (s) => (s.metrics.security < 55 ? 7 : 3),
    question: () =>
      'High street shoplifting has turned into violent robbery, anti-social behaviour plagues our estates, and police rarely attend burglaries. When will the public see police back on the beat?',
    options: [
      { id: 'defend', label: 'Point to new neighbourhood policing guarantees and fast-track recruitment', effects: { approval: 2, security: 2 } },
      { id: 'own', label: 'Announce an emergency retail crime taskforce and immediate arrests blitz', effects: { approval: 2, budgetBalance: -1, security: 3 } },
      { id: 'attack', label: 'Remind the opposition they cut 20,000 experienced police officers', effects: { approval: 0, supportDelta: { conservative: -2 } } },
    ],
  },

  // 12. Schools & Special Educational Needs (SEND)
  {
    id: 'pmq-education-send',
    topic: 'education',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'Parents of children with special educational needs are forced into exhausting legal battles with councils just to get an assessment. Will the Prime Minister properly fund SEND provision in our schools?',
    options: [
      { id: 'defend', label: 'Highlight targeted SEN capital funding in every region', effects: { approval: 1, publicServices: 1 } },
      { id: 'own', label: 'Commit to an emergency overhaul of local council SEND funding', effects: { approval: 3, budgetBalance: -2, publicServices: 2 } },
      { id: 'attack', label: 'Call out council bureaucracy and systemic obstruction of parents', effects: { approval: 0, partyConfidence: -1 } },
    ],
  },

  // 13. Defence Spending & NATO 2.5% Target (LOTO)
  {
    id: 'pmq-defence-nato',
    topic: 'defence',
    preferredAsker: 'loto',
    relevance: (s) => (s.metrics.security < 55 ? 8 : 4),
    question: () =>
      'With war in Europe and growing hostility from China and Russia, our Army is at its smallest size since the Napoleonic era. Will the Prime Minister set a binding date to hit 2.5% of GDP on defence?',
    options: [
      { id: 'defend', label: 'Reaffirm the 2.5% commitment as economic conditions permit', effects: { approval: -1, economy: 1 } },
      { id: 'own', label: 'Announce a hard timeline for 2.5% funded by procurement reform', effects: { approval: 2, security: 4, partyConfidence: -1 } },
      { id: 'attack', label: 'Expose the black hole in equipment procurement left by the last government', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 14. Water Companies & Sewage Pollution (Third Party)
  {
    id: 'pmq-water-sewage',
    topic: 'water',
    preferredAsker: 'third',
    relevance: () => 7,
    question: () =>
      'Millions of litres of raw human sewage are being dumped into our rivers, chalk streams and beaches while water company bosses pocket millions in bonuses. Why won’t the government ban water company bonuses today?',
    options: [
      { id: 'defend', label: 'Point to legally binding statutory infrastructure reduction plans', effects: { approval: -1 } },
      { id: 'own', label: 'Announce emergency legislation to block water executive bonuses', effects: { approval: 4, partyConfidence: 1, supportDelta: { progressive: 2, liberty: 1 } } },
      { id: 'attack', label: 'Call out private water monopolies created by botched privatisation', effects: { approval: 2, supportDelta: { conservative: -2 } } },
    ],
  },

  // 15. Energy Standing Charges & Fuel Poverty
  {
    id: 'pmq-energy-poverty',
    topic: 'energy',
    preferredAsker: 'both',
    relevance: (s) => (s.stats.cpiInflation > 3 ? 7 : 4),
    question: () =>
      'Unfair energy standing charges mean vulnerable pensioners and low-income families pay before turning on a single heater. Will the Prime Minister abolish standing charges before winter sets in?',
    options: [
      { id: 'defend', label: 'Point to existing winter fuel support schemes and Ofgem reviews', effects: { approval: -1 } },
      { id: 'own', label: 'Cap standing charges directly and shift network costs onto suppliers', effects: { approval: 3, economy: -1, supportDelta: { progressive: 1 } } },
      { id: 'attack', label: 'Remind the House of the energy price spikes caused by global Russian aggression', effects: { approval: 0 } },
    ],
  },

  // 16. Potholes & Regional Transport / Rail
  {
    id: 'pmq-transport-roads',
    topic: 'transport',
    preferredAsker: 'both',
    relevance: () => 4,
    question: () =>
      'Local roads across Britain are crumbling with millions of potholes, while regional commuter trains are routinely cancelled or delayed. Why are motorists and rail commuters paying more for worse service?',
    options: [
      { id: 'defend', label: 'Highlight the £8bn local roads resurfacing fund redirected from HS2', effects: { approval: 1, economy: 1 } },
      { id: 'own', label: 'Fast-track rail public ownership and increase council pothole funds', effects: { approval: 3, budgetBalance: -1, publicServices: 1 } },
      { id: 'attack', label: 'Point out private rail operators failed under the opposition’s franchising model', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 17. Social Care Crisis & Hospital Bed Blocking (Third Party)
  {
    id: 'pmq-social-care',
    topic: 'social-care',
    preferredAsker: 'third',
    relevance: (s) => (s.stats.nhsWaitingList > 7.0 ? 8 : 5),
    question: () =>
      'Thousands of elderly patients are stuck in hospital beds because social care services in the community have collapsed. Cross-party talks have been promised for a decade. Will the Prime Minister finally fund social care?',
    options: [
      { id: 'defend', label: 'Point to council care grants and discharge acceleration funds', effects: { approval: 0, publicServices: 1 } },
      { id: 'own', label: 'Pledge a national care service with fair minimum pay for care staff', effects: { approval: 3, budgetBalance: -3, publicServices: 4 } },
      { id: 'attack', label: 'Call out previous prime ministers who promised to fix social care and ran away', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 18. Child Poverty & Two-Child Benefit Cap (Third Party)
  {
    id: 'pmq-child-poverty',
    topic: 'welfare',
    preferredAsker: 'third',
    relevance: () => 6,
    question: () =>
      'Over four million British children live in poverty, and paediatricians warn of malnutrition in our classrooms. Will the Prime Minister do the moral thing and scrap the two-child benefit limit?',
    options: [
      { id: 'defend', label: 'Insist that welfare expansion must be paid for before promises are made', effects: { approval: -1, partyConfidence: -2, economy: 1 } },
      { id: 'own', label: 'Commit to lifting the cap through targeted family tax reform', effects: { approval: 3, budgetBalance: -2, partyConfidence: 2, supportDelta: { progressive: 2 } } },
      { id: 'attack', label: 'Focus on getting parents into work as the only sustainable route out of poverty', effects: { approval: 1, supportDelta: { progressive: -2 } } },
    ],
  },

  // 19. Backbench Revolt & Loss of Authority (LOTO)
  {
    id: 'pmq-backbench-revolt',
    topic: 'politics',
    preferredAsker: 'loto',
    relevance: (s) => (s.metrics.partyConfidence < 40 || s.stats.lettersOfNoConfidence > 20 ? 9 : 1),
    question: (s) =>
      `The Prime Minister’s backbenchers are in open mutiny, letters are flying into the 1922 Committee, and they cannot even get their legislation through the lobbies. When will they admit they have lost control of their own party?`,
    options: [
      { id: 'defend', label: 'Insist the government is united and focused on delivery', effects: { approval: -1, partyConfidence: 2 } },
      { id: 'own', label: 'Acknowledge vigorous parliamentary debate within a broad church party', effects: { approval: 1, partyConfidence: 1 } },
      { id: 'attack', label: 'Remind the opposition leader that their party went through three PMs in two years', effects: { approval: 2, partyConfidence: 3, supportDelta: { conservative: -3 } } },
    ],
  },

  // 20. Hung Parliament & Fragile Coalition (LOTO)
  {
    id: 'pmq-coalition-weakness',
    topic: 'parliament',
    preferredAsker: 'loto',
    relevance: (s) => (s.parties.find((p) => p.id === s.player?.partyId)?.seats ?? 326) < 326 ? 8 : 1,
    question: (s) =>
      `This is a zombie government 26 seats short of a majority, propped up by backroom concessions and terrified of its own shadow. Why doesn’t the Prime Minister have the courage to call an election and face the country?`,
    options: [
      { id: 'defend', label: 'Point to stable cross-party delivery and sensible parliamentary compromise', effects: { approval: 1, partyConfidence: 1 } },
      { id: 'own', label: 'Challenge the opposition to vote down the government if they dare', effects: { approval: 2, partyConfidence: 3 } },
      { id: 'attack', label: 'Note that the opposition is terrified of an election because their polling is hollow', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 21. By-Election Defeat & Heartlands (LOTO)
  {
    id: 'pmq-by-election-loss',
    topic: 'elections',
    preferredAsker: 'loto',
    relevance: (s) => (s.byElections && s.byElections.some((b) => !b.held) ? 9 : 1),
    question: (s) => {
      const lost = s.byElections?.filter((b) => !b.held);
      const latest = lost && lost.length > 0 ? lost[lost.length - 1].regionId : 'recent seats';
      return `The government just suffered a humiliating by-election defeat in ${latest}. The voters have delivered their verdict on this Prime Minister. Is it not time to listen to them?`;
    },
    options: [
      { id: 'defend', label: 'Note that mid-term by-elections traditionally test governing parties', effects: { approval: 0, partyConfidence: 1 } },
      { id: 'own', label: 'Accept the public’s message with humility and refocus on core priorities', effects: { approval: 2, partyConfidence: -1 } },
      { id: 'attack', label: 'Point out the opposition barely scraped over the line on record low turnout', effects: { approval: -1, partyConfidence: 2 } },
    ],
  },

  // 22. Broken Manifesto Pledges (LOTO)
  {
    id: 'pmq-broken-pledges',
    topic: 'pledges',
    preferredAsker: 'loto',
    relevance: (s) => (s.pledges && s.pledges.length > 0 ? 6 : 2),
    question: (s) =>
      `The Prime Minister promised the country change in their election manifesto. Yet on pledge after pledge, targets are slipping and excuses are made. Why has their manifesto become an exercise in fiction?`,
    options: [
      { id: 'defend', label: 'Provide evidence of progress on key commitments and milestones', effects: { approval: 1, partyConfidence: 1 } },
      { id: 'own', label: 'Admit that international head-winds have required tough adjustments', effects: { approval: 1, partyConfidence: -1 } },
      { id: 'attack', label: 'Remind the opposition they offered no plan and no costings whatsoever', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 23. Ministerial Standards & Cabinet Leaks
  {
    id: 'pmq-cabinet-standards',
    topic: 'standards',
    preferredAsker: 'both',
    relevance: (s) => (s.cabinet.some((m) => m.loyalty < 45) ? 7 : 2),
    question: () =>
      'Ministers are briefing against each other in the Sunday papers, ethics investigations are dragging on, and integrity in public life is in tatters. Will the Prime Minister enforce the Ministerial Code today?',
    options: [
      { id: 'defend', label: 'Reaffirm that the independent adviser is investigating without political interference', effects: { approval: 0 } },
      { id: 'own', label: 'Warn all ministers that anyone briefing against colleagues will be sacked immediately', effects: { approval: 2, partyConfidence: -1 } },
      { id: 'attack', label: 'Contrast current transparency with the cover-ups and cronyism of past years', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 24. EU Trade Barriers & Export Friction (Third Party)
  {
    id: 'pmq-eu-trade',
    topic: 'trade',
    preferredAsker: 'third',
    relevance: () => 5,
    question: () =>
      'British farmers, fishermen and small exporters are drowning in post-Brexit red tape and veterinary checks at Dover. Will the Prime Minister seek a veterinary and sanitary agreement with the European Union?',
    options: [
      { id: 'defend', label: 'Insist on defending British sovereignty and remaining outside the single market', effects: { approval: 1, supportDelta: { populist: 1, progressive: -2 } } },
      { id: 'own', label: 'Pursue pragmatic, technical alignment with Europe to cut border friction', effects: { approval: 2, economy: 2, supportDelta: { liberty: 2, populist: -2 } } },
      { id: 'attack', label: 'Reject the third party’s desire to reopen divisive referendums', effects: { approval: 0, supportDelta: { liberty: -2 } } },
    ],
  },

  // 25. Clean Power 2030 & Green Transition (Third Party)
  {
    id: 'pmq-climate-netzero',
    topic: 'net-zero',
    preferredAsker: 'third',
    relevance: () => 5,
    question: () =>
      'Climate change is driving flash flooding and record temperatures, yet the government is issuing new fossil fuel licences. When will the Prime Minister end the climate delay and back green energy?',
    options: [
      { id: 'defend', label: 'Explain that oil and gas are needed as transitional fuel for energy security', effects: { approval: 1, security: 2, supportDelta: { progressive: -2 } } },
      { id: 'own', label: 'Double down on GB Energy and rapid onshore wind and solar rollout', effects: { approval: 2, publicServices: 1, supportDelta: { progressive: 2, populist: -1 } } },
      { id: 'attack', label: 'Call out the unaffordable green levies that would bankrupt working families', effects: { approval: 0, supportDelta: { populist: 1 } } },
    ],
  },

  // 26. Electoral Reform & House of Lords (Third Party)
  {
    id: 'pmq-electoral-reform',
    topic: 'constitution',
    preferredAsker: 'third',
    relevance: () => 4,
    question: () =>
      'Under our broken first-past-the-post electoral system, millions of votes count for nothing and an unelected House of Lords swells with political donors. Will the Prime Minister finally commit to electoral reform and an elected second chamber?',
    options: [
      { id: 'defend', label: 'Defend single-member constituency representation as the bedrock of British democracy', effects: { approval: 1, supportDelta: { liberty: -2 } } },
      { id: 'own', label: 'Commit to reforming the House of Lords and ending hereditary peers', effects: { approval: 2, supportDelta: { progressive: 1, liberty: 1 } } },
      { id: 'attack', label: 'Note that proportional representation would give disproportionate power to fringe extremists', effects: { approval: 0, partyConfidence: 1 } },
    ],
  },

  // 27. High Street Business Rates & Regeneration
  {
    id: 'pmq-business-rates',
    topic: 'high-streets',
    preferredAsker: 'both',
    relevance: () => 4,
    question: () =>
      'Local high streets are boarded up with shuttered shops while online tech giants pay virtually nothing in business taxes. When will the government scrap the archaic business rates system?',
    options: [
      { id: 'defend', label: 'Point to existing retail discount reliefs and targeted high street funds', effects: { approval: 0 } },
      { id: 'own', label: 'Pledge permanent business rates reform funded by an online sales levy', effects: { approval: 3, economy: 1, budgetBalance: -1 } },
      { id: 'attack', label: 'Call out greedy commercial landlords holding regeneration back', effects: { approval: 1 } },
    ],
  },

  // 28. Devolution & Relations with Scotland and Wales
  {
    id: 'pmq-devolution',
    topic: 'devolution',
    preferredAsker: 'third',
    relevance: () => 4,
    question: () =>
      'The government in Westminster continues to overrule the devolved parliaments in Edinburgh and Cardiff. Why is the Prime Minister treating the devolved nations as regional branch offices?',
    options: [
      { id: 'defend', label: 'Defend the integrity of the UK internal market and UK-wide funding', effects: { approval: 1, supportDelta: { conservative: 1 } } },
      { id: 'own', label: 'Establish a new Council of Nations and Regions to reset inter-governmental relations', effects: { approval: 2, partyConfidence: 1 } },
      { id: 'attack', label: 'Urge the nationalist parties to focus on failing Scottish schools and NHS waiting times', effects: { approval: 1, supportDelta: { progressive: -2 } } },
    ],
  },

  // 29. Mental Health for Young People (Third Party)
  {
    id: 'pmq-mental-health',
    topic: 'health',
    preferredAsker: 'third',
    relevance: () => 6,
    question: () =>
      'Hundreds of thousands of children are waiting over a year for adolescent mental health appointments, deteriorating while they wait. Will the Prime Minister put open-access mental health hubs in every community?',
    options: [
      { id: 'defend', label: 'Highlight funding for mental health support teams in schools', effects: { approval: 1, publicServices: 1 } },
      { id: 'own', label: 'Fund community mental health hubs directly from national reserves', effects: { approval: 3, budgetBalance: -2, publicServices: 2 } },
      { id: 'attack', label: 'Call out councils that cut youth services over the past decade', effects: { approval: 0 } },
    ],
  },

  // 30. Public Sector Ethics & Revolving Door
  {
    id: 'pmq-lobbying-ethics',
    topic: 'standards',
    preferredAsker: 'both',
    relevance: () => 3,
    question: () =>
      'Former ministers and civil servants continue to walk into lucrative lobbying jobs within weeks of leaving office. When will the Prime Minister introduce real teeth to the rules on lobbying and conflicts of interest?',
    options: [
      { id: 'defend', label: 'Point to existing ACOBA guidelines and transparency registers', effects: { approval: -1 } },
      { id: 'own', label: 'Ban former ministers from lobbying for five years and establish a statutory ethics commission', effects: { approval: 3, partyConfidence: -1 } },
      { id: 'attack', label: 'Highlight that the worst lobbying scandals in British history occurred under the opposition', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 31. NHS Dentistry Deserts (Third Party)
  {
    id: 'pmq-nhs-dentistry',
    topic: 'health',
    preferredAsker: 'both',
    relevance: (s) => (s.stats.nhsWaitingList > 7.0 ? 8 : 4),
    question: () =>
      'Millions of people across Britain cannot find an NHS dentist taking adult patients, with desperate people resorting to DIY dentistry with pliers. When will the Prime Minister scrap the broken dental contract?',
    options: [
      { id: 'defend', label: 'Highlight golden hello recruitment incentives for dentists in underserved areas', effects: { approval: 1, publicServices: 1 } },
      { id: 'own', label: 'Pledge full contract reform with guaranteed emergency NHS dental appointments', effects: { approval: 3, budgetBalance: -1, publicServices: 2 } },
      { id: 'attack', label: 'Remind the House that the dental contract disaster was imposed under the opposition', effects: { approval: 0, supportDelta: { conservative: -2 } } },
    ],
  },

  // 32. Post Office Horizon Scandal Compensation
  {
    id: 'pmq-post-office-horizon',
    topic: 'justice',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'Subpostmasters falsely convicted in the Horizon scandal are still waiting years for full financial redress, with elderly victims dying before receiving compensation. Will the Prime Minister instruct officials to pay all outstanding claims immediately?',
    options: [
      { id: 'defend', label: 'Point to independent assessment panels ensuring public money is properly audited', effects: { approval: -1 } },
      { id: 'own', label: 'Set a binding 6-month deadline for all Horizon compensation payments', effects: { approval: 4, budgetBalance: -1, partyConfidence: 1 } },
      { id: 'attack', label: 'Expose the corporate cover-up at Fujitsu and past postal ministers who ignored whistleblowers', effects: { approval: 2 } },
    ],
  },

  // 33. Infected Blood Scandal Redress
  {
    id: 'pmq-infected-blood',
    topic: 'health',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'Victims of the infected blood tragedy and their grieving families are still navigating red tape to receive the compensation promised by the public inquiry. When will the interim compensation board make final payments?',
    options: [
      { id: 'defend', label: 'Explain that complex eligibility assessments must comply with the inquiry’s legal framework', effects: { approval: -1 } },
      { id: 'own', label: 'Authorize expedited interim payments and establish a permanent compensation authority', effects: { approval: 3, budgetBalance: -2, partyConfidence: 1 } },
      { id: 'attack', label: 'Acknowledge the decades of state failure that preceded this government taking office', effects: { approval: 1 } },
    ],
  },

  // 34. Local Council Bankruptcies / Section 114 Notices
  {
    id: 'pmq-council-bankruptcies',
    topic: 'local-government',
    preferredAsker: 'both',
    relevance: (s) => (s.stats.budgetBalance < -80 ? 8 : 4),
    question: () =>
      'Dozens of local councils across England are issuing Section 114 bankruptcy notices, slashing bin collections, closing libraries, and turning off street lights. Will the Prime Minister provide emergency funding to save local councils?',
    options: [
      { id: 'defend', label: 'Insist that councils live within their means and consolidate back-office administration', effects: { approval: -2, economy: 1 } },
      { id: 'own', label: 'Provide an emergency council stabilization grant to protect frontline social care', effects: { approval: 3, budgetBalance: -3, publicServices: 2 } },
      { id: 'attack', label: 'Highlight reckless commercial property gambles by opposition-run local authorities', effects: { approval: 1, partyConfidence: 1 } },
    ],
  },

  // 35. Family Farms & Agricultural Inheritance / Subsidies (LOTO)
  {
    id: 'pmq-farming-subsidies',
    topic: 'rural',
    preferredAsker: 'loto',
    relevance: () => 6,
    question: () =>
      'British family farmers are protesting outside Parliament, warning that changes to agricultural property relief and delayed subsidy payments will force multi-generational farms to sell to corporate developers. Will the Prime Minister scrap the tractor tax?',
    options: [
      { id: 'defend', label: 'Explain that genuine family farms are protected by generous inheritance tax allowances', effects: { approval: -1, partyConfidence: 1 } },
      { id: 'own', label: 'Pause the reform for agricultural consultation and increase domestic food production grants', effects: { approval: 3, budgetBalance: -1, supportDelta: { conservative: 1 } } },
      { id: 'attack', label: 'Expose tax avoidance schemes where wealthy speculators bought farmland solely to shelter millions', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 36. British Steel & Port Talbot Industrial Transition
  {
    id: 'pmq-steel-industry',
    topic: 'industry',
    preferredAsker: 'both',
    relevance: (s) => (s.stats.unemployment > 4.5 ? 7 : 3),
    question: () =>
      'Primary blast furnaces have closed at our industrial heartlands, leaving Britain as the only G20 nation unable to make virgin steel from scratch. How does losing domestic steel capability fit into the Prime Minister\'s national security strategy?',
    options: [
      { id: 'defend', label: 'Highlight the transition to cleaner electric arc furnaces and modern green steel technology', effects: { approval: 1, economy: 1 } },
      { id: 'own', label: 'Co-invest in domestic sovereign steel manufacturing and protect primary supply chains', effects: { approval: 3, budgetBalance: -2, security: 3, supportDelta: { reform: 2 } } },
      { id: 'attack', label: 'Point out high industrial electricity costs were locked in by the previous government', effects: { approval: 0, supportDelta: { conservative: -1 } } },
    ],
  },

  // 37. University Tuition Fees & Student Loan Debt (Third Party)
  {
    id: 'pmq-university-tuition',
    topic: 'education',
    preferredAsker: 'third',
    relevance: () => 5,
    question: () =>
      'Universities are facing bankruptcy, tuition fees have climbed, and young graduates face punitive 40-year student loan repayments with extortionate interest rates. Will the government reform higher education funding?',
    options: [
      { id: 'defend', label: 'Maintain that graduates who benefit from higher earnings should contribute to their tuition', effects: { approval: -1, economy: 1 } },
      { id: 'own', label: 'Lower student loan interest rates and restore maintenance grants for low-income students', effects: { approval: 3, budgetBalance: -2, supportDelta: { liberty: 2, progressive: 1 } } },
      { id: 'attack', label: 'Remind the House that the third party once famously pledged to abolish tuition fees then trebled them', effects: { approval: 1, supportDelta: { liberty: -3 } } },
    ],
  },

  // 38. State Pension Age Rising to 68
  {
    id: 'pmq-pension-age-increase',
    topic: 'welfare',
    preferredAsker: 'both',
    relevance: () => 6,
    question: () =>
      'Proposals to accelerate the state pension age to 68 mean manual workers in northern towns with lower life expectancy will die before ever reaching retirement. Will the Prime Minister rule out raising the pension age?',
    options: [
      { id: 'defend', label: 'Note that longer life expectancy and demographic pressures require responsible long-term planning', effects: { approval: -2, partyConfidence: 1 } },
      { id: 'own', label: 'Commit to keeping the pension age stable and protecting the state pension triple lock', effects: { approval: 4, budgetBalance: -2, supportDelta: { conservative: 2 } } },
      { id: 'attack', label: 'Reject the opposition’s scaremongering on a review that has not even reported', effects: { approval: 0 } },
    ],
  },

  // 39. Free School Meals & Holiday Hunger (Third Party)
  {
    id: 'pmq-free-school-meals',
    topic: 'welfare',
    preferredAsker: 'third',
    relevance: () => 6,
    question: () =>
      'Hundreds of thousands of children in working-poor households do not qualify for free school meals because the income threshold is set at an insulting £7,400. Will the Prime Minister extend free school meals to all children on Universal Credit?',
    options: [
      { id: 'defend', label: 'Point to targeted breakfast clubs in primary schools and the holiday activities food programme', effects: { approval: 0 } },
      { id: 'own', label: 'Extend free school meal eligibility to every child in a Universal Credit family', effects: { approval: 4, budgetBalance: -1, publicServices: 2, supportDelta: { progressive: 2 } } },
      { id: 'attack', label: 'Focus on getting parents into work as the only sustainable route out of poverty', effects: { approval: 1, supportDelta: { progressive: -2 } } },
    ],
  },

  // 40. Trident Nuclear Deterrent Renewal (LOTO)
  {
    id: 'pmq-trident-deterrent',
    topic: 'defence',
    preferredAsker: 'loto',
    relevance: (s) => (s.metrics.security < 55 ? 7 : 3),
    question: () =>
      'Dreadnought submarine replacement costs are rising and naval recruitment is in crisis. Can the Prime Minister give the House an unequivocal, 100% guarantee that the UK\'s continuous-at-sea nuclear deterrent will be maintained?',
    options: [
      { id: 'defend', label: 'Give an absolute, unshakeable commitment to the continuous-at-sea nuclear deterrent', effects: { approval: 2, security: 3, partyConfidence: -1, supportDelta: { conservative: 2 } } },
      { id: 'own', label: 'Commit fully to Trident while ordering an immediate value-for-money audit on defense contractors', effects: { approval: 2, security: 2, budgetBalance: 1 } },
      { id: 'attack', label: 'Expose the opposition leader for serving alongside politicians who wanted to scrap the deterrent entirely', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 41. Foreign Aid Budget & 0.7% GNI Target
  {
    id: 'pmq-foreign-aid-budget',
    topic: 'foreign',
    preferredAsker: 'both',
    relevance: (s) => (s.stats.budgetBalance < -80 ? 7 : 4),
    question: () =>
      'While public services at home are strapped for cash, billions continue to be sent abroad in foreign aid. When will the Prime Minister restore the 0.7% GNI commitment, or will they redirect overseas aid to our domestic emergencies?',
    options: [
      { id: 'defend', label: 'Maintain the 0.5% interim ceiling until the UK structural deficit is under control', effects: { approval: 1, partyConfidence: 1 } },
      { id: 'own', label: 'Legislate to restore the 0.7% global leadership commitment by the end of the parliament', effects: { approval: -1, budgetBalance: -3, supportDelta: { progressive: 2, populist: -3 } } },
      { id: 'attack', label: 'Point out that aid spent effectively prevents refugee crises and pandemics before they reach our shores', effects: { approval: 0, security: 1 } },
    ],
  },

  // 42. Smartphones in Schools & Online Child Safety
  {
    id: 'pmq-online-safety-schools',
    topic: 'education',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'Headteachers and parents report that smartphones and social media algorithms are destroying children’s attention spans, sleep, and mental health. Will the Prime Minister mandate a nationwide statutory ban on smartphones in schools?',
    options: [
      { id: 'defend', label: 'Back headteachers to implement their own school-by-school phone-free policies', effects: { approval: 1 } },
      { id: 'own', label: 'Introduce a legally binding statutory ban on smartphones in all schools during the school day', effects: { approval: 3, partyConfidence: 1 } },
      { id: 'attack', label: 'Hold social media tech conglomerates accountable for addictive algorithm design targeting minors', effects: { approval: 2, economy: -1 } },
    ],
  },

  // 43. AI Regulation & Tech Disruption
  {
    id: 'pmq-ai-regulation',
    topic: 'technology',
    preferredAsker: 'both',
    relevance: () => 4,
    question: () =>
      'Rapid advances in generative AI threaten hundreds of thousands of white-collar and creative jobs, yet the government’s approach to AI safety and copyright protections has been sluggish. What is the Prime Minister doing to protect British workers?',
    options: [
      { id: 'defend', label: 'Support a pro-innovation regulatory sandbox to ensure Britain leads the global AI economy', effects: { approval: 1, economy: 2 } },
      { id: 'own', label: 'Legislate a worker protection charter and mandate intellectual property protections for creatives', effects: { approval: 2, economy: -1, supportDelta: { progressive: 1 } } },
      { id: 'attack', label: 'Point out that excessive red tape would simply drive frontier AI companies overseas to America or China', effects: { approval: 0, economy: 1 } },
    ],
  },

  // 44. Northern Powerhouse Rail & Transport Inequality
  {
    id: 'pmq-northern-rail',
    topic: 'transport',
    preferredAsker: 'both',
    relevance: () => 6,
    question: () =>
      'Decades of under-investment mean passengers travelling across northern cities face two-hour journeys for 40-mile distances. Will the Prime Minister build Northern Powerhouse Rail in full, with a brand-new underground station in Manchester?',
    options: [
      { id: 'defend', label: 'Point to the multi-billion pound TransPennine Route Upgrade already underway', effects: { approval: 0, economy: 1 } },
      { id: 'own', label: 'Commit to the full Northern Powerhouse line from Liverpool to Leeds and Hull', effects: { approval: 3, budgetBalance: -4, economy: 3, supportDelta: { reform: 2 } } },
      { id: 'attack', label: 'Remind the House that the opposition scrapped the northern leg of HS2 while promising money that never arrived', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },

  // 45. Scottish Devolution & Section 30 Orders (Third Party)
  {
    id: 'pmq-scottish-devolution',
    topic: 'devolution',
    preferredAsker: 'third',
    relevance: () => 5,
    question: () =>
      'A majority of Scottish voters want control of their own constitutional future, yet Westminster refuses to grant a Section 30 order. Why is the Prime Minister afraid of democracy in Scotland?',
    options: [
      { id: 'defend', label: 'Affirm that the 2014 referendum was a once-in-a-generation democratic decision', effects: { approval: 1, supportDelta: { conservative: 2 } } },
      { id: 'own', label: 'Focus on delivering tangible economic benefits, clean energy jobs, and investment across Scotland', effects: { approval: 2, economy: 1 } },
      { id: 'attack', label: 'Point out that after 17 years in power, the Scottish government has wrecked Scottish education and NHS waiting times', effects: { approval: 2, supportDelta: { progressive: -2 } } },
    ],
  },

  // 46. Council Tax Hikes & Local Bills (LOTO)
  {
    id: 'pmq-council-tax-bills',
    topic: 'local-government',
    preferredAsker: 'loto',
    relevance: () => 6,
    question: () =>
      'Average Band D council tax has breached £2,000 across England, with cash-strapped local authorities slapping maximum 5% tax rises on struggling households every spring. Will the Prime Minister freeze council tax?',
    options: [
      { id: 'defend', label: 'Note that council tax precepts are decided by locally elected councillors', effects: { approval: -2 } },
      { id: 'own', label: 'Provide direct central government funding to cap all council tax increases at inflation', effects: { approval: 4, budgetBalance: -2, supportDelta: { conservative: 1 } } },
      { id: 'attack', label: 'Remind taxpayers that opposition councils have consistently levied the highest tax rises', effects: { approval: 1, supportDelta: { conservative: -1 } } },
    ],
  },

  // 47. Minimum Wage & In-Work Poverty
  {
    id: 'pmq-living-wage',
    topic: 'work',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'Millions of hard-working Britons are trapped in low-pay, insecure gig-economy jobs, unable to cover basic bills without in-work welfare. Will the government make the Real Living Wage a statutory legal requirement?',
    options: [
      { id: 'defend', label: 'Balance national minimum wage increases against business competitiveness and inflation', effects: { approval: 0, economy: 1 } },
      { id: 'own', label: 'Raise the statutory minimum wage to the independently calculated Real Living Wage and ban exploitative zero-hours contracts', effects: { approval: 4, economy: -1, publicServices: 1, supportDelta: { progressive: 2 } } },
      { id: 'attack', label: 'Point out that small business insolvencies would rise if wage mandates ignore sector realities', effects: { approval: -1, economy: 1, partyConfidence: 1 } },
    ],
  },

  // 48. Armed Forces Covenant & Veterans Care
  {
    id: 'pmq-veteran-affairs',
    topic: 'defence',
    preferredAsker: 'both',
    relevance: () => 5,
    question: () =>
      'Thousands of military veterans face homelessness, PTSD, and substandard military housing with black mould. Will the Prime Minister fully enshrine the Armed Forces Covenant into law and fund specialist veteran healthcare?',
    options: [
      { id: 'defend', label: 'Highlight the veterans mental health service Op COURAGE and veteran employment tax breaks', effects: { approval: 1, security: 1 } },
      { id: 'own', label: 'Commit £500m to remediate military family housing and guarantee veteran NHS mental health fast-tracking', effects: { approval: 3, budgetBalance: -1, security: 2, partyConfidence: 1 } },
      { id: 'attack', label: 'Condemn defense housing contractors who profited while neglecting servicewomen and servicemen', effects: { approval: 2 } },
    ],
  },

  // 49. Green Levies & Manufacturing Competitiveness (LOTO)
  {
    id: 'pmq-green-levies',
    topic: 'energy',
    preferredAsker: 'loto',
    relevance: () => 5,
    question: () =>
      'British manufacturing pays 50% more for electricity than competitors in Germany or France due to burdensome policy costs and green levies. Why is the Prime Minister sacrificing British manufacturing on the altar of net zero?',
    options: [
      { id: 'defend', label: 'Defend green investments as the only way to escape reliance on volatile international fossil gas', effects: { approval: 0, security: 1 } },
      { id: 'own', label: 'Exempt heavy British manufacturing from electricity grid levies and subsidize clean power', effects: { approval: 2, economy: 2, budgetBalance: -1, supportDelta: { conservative: 1 } } },
      { id: 'attack', label: 'Expose the opposition’s short-sighted climate denial that leaves Britain vulnerable to foreign tyrants', effects: { approval: 1, supportDelta: { populist: -2 } } },
    ],
  },

  // 50. Civil Service Waste & Whitehall Headcount (LOTO)
  {
    id: 'pmq-civil-service-waste',
    topic: 'civil-service',
    preferredAsker: 'loto',
    relevance: () => 6,
    question: () =>
      'The civil service has grown by over 100,000 officials since 2016, working from home while public services deteriorate and bureaucracy balloons. Will the Prime Minister cut Whitehall waste and return civil service headcount to pre-pandemic levels?',
    options: [
      { id: 'defend', label: 'Defend hard-working civil servants delivering pensions, border processing and public health', effects: { approval: -1, partyConfidence: -1, publicServices: 1 } },
      { id: 'own', label: 'Institute a civil service recruitment freeze and demand 5% back-office efficiency savings across Whitehall', effects: { approval: 3, economy: 1, budgetBalance: 2, partyConfidence: 2 } },
      { id: 'attack', label: 'Remind the House of the hundreds of millions wasted on botched consulting contracts under the previous administration', effects: { approval: 1, supportDelta: { conservative: -2 } } },
    ],
  },
];

/**
 * Legacy PMQ_POOL export required by backward compatibility and existing tests.
 * Constructed from templates using default static phrasing.
 */
export const PMQ_POOL: PmqQuestion[] = PMQ_TEMPLATES.map((t) => ({
  id: t.id,
  from: t.preferredAsker === 'third' ? 'Third Party Leader' : 'Opposition Leader',
  question: t.question(
    {
      stats: { cpiInflation: 3.2, gdpGrowth: 1.1, nhsWaitingList: 7.2, giltYield: 4.5, debtToGdp: 98, budgetBalance: -75, netMigration: 380, taxRate: 33, unemployment: 4.4 } as any,
      metrics: { approval: 45, partyConfidence: 55, economy: 55, publicServices: 50, security: 55, mediaAttention: 35 } as any,
      parties: [] as any,
      thresholdsFrozen: true,
      byElections: [],
      pledges: [],
    } as any,
    'Opposition Leader',
  ),
  options: t.options,
}));
