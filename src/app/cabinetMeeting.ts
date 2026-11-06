import type { Effects, GameState, Minister } from './types';

/**
 * Cabinet meetings.
 *
 * This is the one place where the whole cabinet is in the room at once. The
 * agenda is derived from the live state, every minister gets a line, and the
 * signatures on the decisions are the player's choices. Nothing here mutates
 * the game; `resolveCabinetMeeting` returns effects the engine applies.
 */

export type MeetingTone = 'support' | 'caution' | 'challenge';

export interface CabinetAttendee {
  id: string;
  name: string;
  role: string;
  kind: 'pm' | 'minister' | 'official';
  faction?: string;
  loyalty?: number;
  coalition?: boolean;
}

export interface CabinetContribution {
  id: string;
  name: string;
  role: string;
  tone: MeetingTone;
  line: string;
}

export interface CabinetMeetingOption {
  id: string;
  label: string;
  summary: string;
  effects: Effects;
  cohesionDelta: number;
  /** Loyalty changes keyed by exact cabinet post. */
  loyaltyByPost?: Record<string, number>;
  factionUnrestDelta?: number;
}

export interface CabinetMeetingItem {
  id: string;
  title: string;
  lead: string;
  brief: string;
  contributions: CabinetContribution[];
  options: CabinetMeetingOption[];
}

export interface CabinetBilateral {
  id: string;
  title: string;
  personName: string;
  personRole: string;
  brief: string;
  options: CabinetMeetingOption[];
}

export interface CabinetQuad {
  title: string;
  brief: string;
  attendees: string[];
  options: CabinetMeetingOption[];
}

export interface CabinetMeeting {
  week: number;
  attendees: CabinetAttendee[];
  bilaterals: CabinetBilateral[];
  quad: CabinetQuad;
  items: CabinetMeetingItem[];
}

export interface CabinetMeetingDecision {
  itemId: string;
  optionId: string;
}

export interface CabinetMeetingPlan {
  decisions: CabinetMeetingDecision[];
  bilateralChoices?: Record<string, string>;
  quadOptionId?: string;
  collectiveResponsibility?: 'united' | 'free';
}

export interface CabinetMeetingRecord {
  week: number;
  items: { title: string; choice: string }[];
  bilaterals: { title: string; choice: string }[];
  quad: { title: string; choice: string } | null;
  collectiveResponsibility?: 'united' | 'free';
  effects: Effects;
  cohesionDelta: number;
  factionUnrestDelta: number;
  loyaltyChanges: { name: string; delta: number }[];
  summary: string;
}

export interface CabinetMeetingOutcome {
  effects: Effects;
  cohesionDelta: number;
  factionUnrestDelta: number;
  loyaltyByName: Record<string, number>;
  summary: string;
  log: string[];
  record: CabinetMeetingRecord;
}

const POSTS = {
  chancellor: 'Chancellor of the Exchequer',
  home: 'Home Secretary',
  health: 'Health Secretary',
  education: 'Education Secretary',
  business: 'Business Secretary',
  defence: 'Defence Secretary',
  foreign: 'Foreign Secretary',
} as const;

const OFFICIALS: CabinetAttendee[] = [
  { id: 'cabinet-secretary', name: 'Sir Oliver Wren KCB', role: 'Cabinet Secretary', kind: 'official' },
  { id: 'chief-whip', name: 'Dame Fiona Kerr', role: 'Chief Whip', kind: 'official' },
  { id: 'attorney-general', name: 'Ruth Calder KC', role: 'Attorney General', kind: 'official' },
  { id: 'national-security', name: 'Sir Iain Mercer', role: 'National Security Adviser', kind: 'official' },
];

const NUMERIC_EFFECT_KEYS: (keyof Effects)[] = [
  'approval',
  'economy',
  'publicServices',
  'security',
  'partyConfidence',
  'mediaAttention',
  'cpiInflation',
  'gdpGrowth',
  'giltYield',
  'nhsWaitingList',
  'netMigration',
  'lettersDelta',
  'taxRate',
  'debtToGdp',
  'unemployment',
  'budgetBalance',
  'fundsDelta',
];

const money = (value: number): string => `${value >= 0 ? '+' : '-'}£${Math.abs(value).toFixed(1)}bn`;

export function isCabinetMeetingDue(
  state: Pick<GameState, 'week' | 'lastCabinetMeetingWeek'>,
): boolean {
  return state.lastCabinetMeetingWeek === undefined || state.week > state.lastCabinetMeetingWeek;
}

export function buildCabinetAttendees(state: GameState): CabinetAttendee[] {
  const pmName = state.player
    ? `${state.player.firstName} ${state.player.lastName}`.trim()
    : 'The Prime Minister';

  return [
    { id: 'pm', name: pmName, role: 'Prime Minister', kind: 'pm' },
    ...state.cabinet.map((minister, index) => ({
      id: `minister-${index}`,
      name: minister.name,
      role: minister.post,
      kind: 'minister' as const,
      faction: minister.faction,
      loyalty: Math.round(minister.loyalty),
      coalition: minister.coalition,
    })),
    ...OFFICIALS.map((official) => ({ ...official })),
  ];
}

function byPost(state: GameState, post: string): Minister | undefined {
  return state.cabinet.find((minister) => minister.post === post);
}

function toneFor(minister: Minister | undefined): MeetingTone {
  if (!minister) return 'caution';
  if (minister.loyalty >= 65) return 'support';
  if (minister.loyalty >= 40) return 'caution';
  return 'challenge';
}

function fromMinister(
  minister: Minister,
  line: string,
  tone: MeetingTone = toneFor(minister),
): CabinetContribution {
  return {
    id: `minister-${minister.name}`,
    name: minister.name,
    role: minister.post,
    tone,
    line,
  };
}

function fromOfficial(id: string, line: string): CabinetContribution {
  const official = OFFICIALS.find((person) => person.id === id) ?? OFFICIALS[0];
  return {
    id: official.id,
    name: official.name,
    role: official.role,
    tone: 'caution',
    line,
  };
}

function chancellorLine(state: GameState): string {
  const headroom = state.obrHeadroom ?? 0;
  if (headroom <= 0) {
    return `There is no real headroom (${money(headroom)}). Any new spending is borrowing, and the market will know it.`;
  }
  return `Headroom is ${money(headroom)}. Spend it and the Autumn Statement writes itself.`;
}

function economicItem(state: GameState): CabinetMeetingItem {
  const chancellor = byPost(state, POSTS.chancellor);
  const business = byPost(state, POSTS.business);
  const contributions: CabinetContribution[] = [];

  if (chancellor) {
    contributions.push(
      fromMinister(
        chancellor,
        chancellorLine(state),
        toneFor(chancellor),
      ),
    );
  }
  if (business) {
    contributions.push(
      fromMinister(
        business,
        `Growth is ${state.stats.gdpGrowth.toFixed(1)}%. Business will invest if you give them a clear signal today, not another review.`,
      ),
    );
  }
  contributions.push(
    fromOfficial(
      'cabinet-secretary',
      `The Treasury paper is short and blunt: inflation at ${state.stats.cpiInflation.toFixed(1)}%, debt at ${state.stats.debtToGdp.toFixed(0)}% of GDP.`,
    ),
    fromOfficial('chief-whip', 'The parliamentary party will wear a hard choice, but not a surprise one.'),
  );

  return {
    id: 'economic-strategy',
    title: 'The economic strategy',
    lead: chancellor?.post ?? 'Cabinet Secretary',
    brief: `The deficit is £${Math.abs(state.stats.budgetBalance).toFixed(0)}bn and the OBR headroom is ${money(state.obrHeadroom ?? 0)}. The Cabinet must settle the line before the next fiscal event.`,
    contributions,
    options: [
      {
        id: 'fiscal-hold',
        label: 'Hold the line and bank the headroom',
        summary: 'No new spending; protect the fiscal rules and take the political hit if it comes.',
        effects: { economy: 1, partyConfidence: 2, budgetBalance: 2, approval: -1 },
        cohesionDelta: 2,
        loyaltyByPost: { [POSTS.chancellor]: 2, [POSTS.business]: -1 },
        factionUnrestDelta: 1,
      },
      {
        id: 'fiscal-invest',
        label: 'Spend the headroom on growth',
        summary: 'A visible investment package now, funded by borrowing and growth optimism.',
        effects: { economy: 2, publicServices: 2, approval: 2, budgetBalance: -3, giltYield: 0.05 },
        cohesionDelta: -1,
        loyaltyByPost: { [POSTS.chancellor]: -3, [POSTS.business]: 3 },
        factionUnrestDelta: -1,
      },
      {
        id: 'fiscal-tax',
        label: 'Announce a revenue-raising levy',
        summary: 'Repair the books before the markets force the issue.',
        effects: { budgetBalance: 4, approval: -3, partyConfidence: -2 },
        cohesionDelta: -2,
        loyaltyByPost: { [POSTS.chancellor]: 2, [POSTS.business]: -2 },
        factionUnrestDelta: 1,
      },
    ],
  };
}

function publicServicesItem(state: GameState): CabinetMeetingItem {
  const health = byPost(state, POSTS.health);
  const education = byPost(state, POSTS.education);
  const chancellor = byPost(state, POSTS.chancellor);
  const contributions: CabinetContribution[] = [];

  if (health) {
    contributions.push(
      fromMinister(
        health,
        `The waiting list is ${state.stats.nhsWaitingList.toFixed(1)}m. Every winter we promise a plan and every winter we reopen the same argument.`,
      ),
    );
  }
  if (education) {
    contributions.push(
      fromMinister(
        education,
        'Schools can absorb one more year of flat budgets. They cannot absorb the blame for it.',
      ),
    );
  }
  if (chancellor) {
    contributions.push(
      fromMinister(
        chancellor,
        'Anything new for the NHS or schools has to come from somewhere. I will not sign a blank cheque.',
      ),
    );
  }
  contributions.push(
    fromOfficial('cabinet-secretary', 'The delivery boards are already behind on their winter milestones.'),
  );

  return {
    id: 'public-services',
    title: 'Public services and the winter ahead',
    lead: health?.post ?? 'Cabinet Secretary',
    brief: `Public services sit at ${Math.round(state.metrics.publicServices)}/100, with NHS waiting lists at ${state.stats.nhsWaitingList.toFixed(1)}m. The room agrees the problem; the argument is the money.`,
    contributions,
    options: [
      {
        id: 'services-cash',
        label: 'Release emergency capacity funding',
        summary: 'Buy beds, staff and school places now; find the savings later.',
        effects: { publicServices: 4, approval: 2, nhsWaitingList: -0.2, budgetBalance: -2 },
        cohesionDelta: 1,
        loyaltyByPost: { [POSTS.health]: 3, [POSTS.chancellor]: -2, [POSTS.education]: 2 },
        factionUnrestDelta: -1,
      },
      {
        id: 'services-reform',
        label: 'Reform first, fund the winners',
        summary: 'Tie new money to delivery milestones and productivity.',
        effects: { publicServices: 1, economy: 1, budgetBalance: 1, partyConfidence: -1 },
        cohesionDelta: -1,
        loyaltyByPost: { [POSTS.health]: -1, [POSTS.chancellor]: 2, [POSTS.education]: -2 },
      },
      {
        id: 'services-hold',
        label: 'Hold the settlement and demand efficiency',
        summary: 'Protect the Treasury and tell departments to live within their budgets.',
        effects: { budgetBalance: 2, publicServices: -2, approval: -2 },
        cohesionDelta: -2,
        loyaltyByPost: { [POSTS.health]: -3, [POSTS.education]: -3, [POSTS.chancellor]: 2 },
        factionUnrestDelta: 1,
      },
    ],
  };
}

function homeItem(state: GameState): CabinetMeetingItem {
  const home = byPost(state, POSTS.home);
  const contributions: CabinetContribution[] = [];

  if (home) {
    contributions.push(
      fromMinister(
        home,
        `Small-boat arrivals are running at ${Math.round(state.stats.netMigration)}k a year. The public wants a decision, not another taskforce.`,
      ),
    );
  }
  contributions.push(
    fromOfficial('attorney-general', 'Whatever we announce has to survive a legal challenge. I will not defend a headline we cannot implement.'),
    fromOfficial('chief-whip', `We have ${state.stats.lettersOfNoConfidence} letters and a party that wants a fight it can win.`),
  );

  return {
    id: 'home-affairs',
    title: 'Home affairs and the Union',
    lead: home?.post ?? 'Chief Whip',
    brief: 'The Home Office wants a visible enforcement offer. The lawyers want it lawful. The whips want it to land before the next by-election.',
    contributions,
    options: [
      {
        id: 'home-enforce',
        label: 'Back a visible enforcement plan',
        summary: 'More powers, more removals, a clear message to the public.',
        effects: { security: 3, approval: 1, partyConfidence: 1, budgetBalance: -1 },
        cohesionDelta: 1,
        loyaltyByPost: { [POSTS.home]: 3 },
        factionUnrestDelta: 1,
      },
      {
        id: 'home-community',
        label: 'Fund a community-led settlement',
        summary: 'Slower, cheaper and less likely to be struck down in court.',
        effects: { security: 1, publicServices: 1, approval: 1, partyConfidence: -1 },
        cohesionDelta: 0,
        loyaltyByPost: { [POSTS.home]: -1 },
        factionUnrestDelta: -1,
      },
      {
        id: 'home-review',
        label: 'Commission a cross-party review',
        summary: 'Take the immediate heat out of the issue and defer the decision.',
        effects: { security: -1, approval: -1, partyConfidence: -1 },
        cohesionDelta: -2,
        loyaltyByPost: { [POSTS.home]: -2 },
        factionUnrestDelta: 1,
      },
    ],
  };
}

function externalItem(state: GameState): CabinetMeetingItem {
  const defence = byPost(state, POSTS.defence);
  const foreign = byPost(state, POSTS.foreign);
  const contributions: CabinetContribution[] = [];

  if (defence) {
    contributions.push(
      fromMinister(
        defence,
        'The Chiefs can hold the line, but they need a decision on the defence settlement before the next planning round.',
      ),
    );
  }
  if (foreign) {
    contributions.push(
      fromMinister(
        foreign,
        `We have ${state.foreignIssues.length} live diplomatic file${state.foreignIssues.length === 1 ? '' : 's'}. Britain is being watched for what it does, not what it says.`,
      ),
    );
  }
  contributions.push(
    fromOfficial('national-security', 'The threat picture is deteriorating. The Cabinet should not leave this to the weekend.'),
  );

  return {
    id: 'external-policy',
    title: 'Defence and the world',
    lead: foreign?.post ?? defence?.post ?? 'National Security Adviser',
    brief: `Security sits at ${Math.round(state.metrics.security)}/100. The room must choose between hard power, diplomacy and staying out of the next crisis.`,
    contributions,
    options: [
      {
        id: 'external-hard',
        label: 'Project hard power',
        summary: 'Reinforce the defence line and signal that Britain will act.',
        effects: { security: 3, economy: 1, approval: 1, budgetBalance: -2 },
        cohesionDelta: 1,
        loyaltyByPost: { [POSTS.defence]: 3, [POSTS.foreign]: 1 },
        factionUnrestDelta: 1,
      },
      {
        id: 'external-diplo',
        label: 'Lead with a diplomatic off-ramp',
        summary: 'Work the phones, convene allies and keep the military option in reserve.',
        effects: { security: 1, economy: 1, approval: 2, budgetBalance: -1 },
        cohesionDelta: 0,
        loyaltyByPost: { [POSTS.defence]: -1, [POSTS.foreign]: 3 },
        factionUnrestDelta: -1,
      },
      {
        id: 'external-restraint',
        label: 'Stay out of the next crisis',
        summary: 'Keep the money at home and accept the reputational cost abroad.',
        effects: { security: -2, approval: -1, partyConfidence: -1 },
        cohesionDelta: -1,
        loyaltyByPost: { [POSTS.defence]: -2, [POSTS.foreign]: -2 },
      },
    ],
  };
}

function buildBilaterals(state: GameState): CabinetBilateral[] {
  const chancellor = byPost(state, POSTS.chancellor);
  const bilaterals: CabinetBilateral[] = [];

  if (chancellor) {
    bilaterals.push({
      id: 'bilateral-chancellor',
      title: 'A word with the Chancellor',
      personName: chancellor.name,
      personRole: chancellor.post,
      brief: 'Before the full Cabinet, the Chancellor wants to know whether the fiscal rule is still the anchor of the government.',
      options: [
        {
          id: 'bilateral-chancellor-reassure',
          label: 'Reassure them on the fiscal rule',
          summary: 'The Treasury line holds; no surprise spending today.',
          effects: { partyConfidence: 1 },
          cohesionDelta: 1,
          loyaltyByPost: { [POSTS.chancellor]: 2 },
        },
        {
          id: 'bilateral-chancellor-savings',
          label: 'Demand savings before new money',
          summary: 'Put the burden on departments to find efficiency first.',
          effects: { budgetBalance: 1, economy: 1 },
          cohesionDelta: -1,
          loyaltyByPost: { [POSTS.chancellor]: -2, [POSTS.business]: -1 },
          factionUnrestDelta: 1,
        },
        {
          id: 'bilateral-chancellor-surprise',
          label: 'Promise no surprise tax rises',
          summary: 'Steady the party before the meeting, whatever the books say.',
          effects: { approval: 1, partyConfidence: 1 },
          cohesionDelta: 0,
          loyaltyByPost: { [POSTS.chancellor]: 1 },
        },
      ],
    });
  }

  bilaterals.push({
    id: 'bilateral-whip',
    title: 'A word with the Chief Whip',
    personName: 'Dame Fiona Kerr',
    personRole: 'Chief Whip',
    brief: 'The Chief Whip has the numbers in front of them and wants to know how much political capital the PM is prepared to spend.',
    options: [
      {
        id: 'bilateral-whip-reward',
        label: 'Promise rewards for loyalty',
        summary: 'Patronage and a quiet word for the loyalists.',
        effects: { partyConfidence: 2, approval: -1 },
        cohesionDelta: 1,
        factionUnrestDelta: -1,
      },
      {
        id: 'bilateral-whip-discipline',
        label: 'Warn the party of discipline',
        summary: 'Make clear that collective responsibility is not optional.',
        effects: { partyConfidence: 1 },
        cohesionDelta: -1,
        factionUnrestDelta: 1,
      },
      {
        id: 'bilateral-whip-listen',
        label: 'Hear the backbenches out',
        summary: 'Listen first, decide later. It buys goodwill but not votes.',
        effects: { approval: 1 },
        cohesionDelta: 0,
        factionUnrestDelta: -1,
      },
    ],
  });

  return bilaterals;
}

function buildQuad(state: GameState): CabinetQuad {
  const chancellor = byPost(state, POSTS.chancellor);
  const home = byPost(state, POSTS.home);
  const foreign = byPost(state, POSTS.foreign) ?? byPost(state, POSTS.defence);
  const attendees = [
    'Prime Minister',
    chancellor?.name ?? 'Chancellor',
    home?.name ?? 'Home Secretary',
    foreign?.name ?? 'Foreign Secretary',
  ];

  const loyaltyByPost: Record<string, number> = {};
  const setLoyalty = (post: string | undefined, delta: number) => {
    if (post) loyaltyByPost[post] = delta;
  };
  setLoyalty(chancellor?.post, 1);
  setLoyalty(home?.post, 1);

  return {
    title: 'The Quad',
    brief: 'The PM, Chancellor, Home Secretary and senior foreign or defence minister meet first to set the strategic line for the full Cabinet.',
    attendees,
    options: [
      {
        id: 'quad-fiscal',
        label: 'Fiscal discipline first',
        summary: 'The books lead. Everything else is funded only after the rules are safe.',
        effects: { budgetBalance: 2, economy: 1, partyConfidence: 1, approval: -1 },
        cohesionDelta: 1,
        loyaltyByPost: { ...loyaltyByPost, ...(chancellor ? { [chancellor.post]: 2 } : {}) },
        factionUnrestDelta: 1,
      },
      {
        id: 'quad-services',
        label: 'Public services first',
        summary: 'The country feels the state of public services before it reads the fiscal rules.',
        effects: { publicServices: 2, approval: 2, budgetBalance: -2 },
        cohesionDelta: 0,
        loyaltyByPost: { ...loyaltyByPost, ...(chancellor ? { [chancellor.post]: -1 } : {}) },
        factionUnrestDelta: -1,
      },
      {
        id: 'quad-security',
        label: 'Security first',
        summary: 'The world is dangerous; protect the defence and security settlement.',
        effects: { security: 2, approval: 1, budgetBalance: -1 },
        cohesionDelta: 0,
        loyaltyByPost: { ...loyaltyByPost, ...(home ? { [home.post]: 1 } : {}), ...(foreign ? { [foreign.post]: 1 } : {}) },
        factionUnrestDelta: 1,
      },
    ],
  };
}

export function buildCabinetMeeting(state: GameState): CabinetMeeting {
  const items = [economicItem(state), publicServicesItem(state), homeItem(state), externalItem(state)];

  // Every minister must be in the room, even if their post does not own one of
  // the four set-piece agenda items. Give the remainder a line under home affairs.
  const used = new Set(items.flatMap((item) => item.contributions.map((person) => person.name)));
  const extras = state.cabinet.filter((minister) => !used.has(minister.name));
  if (extras.length > 0) {
    items[2].contributions.push(
      ...extras.map((minister) =>
        fromMinister(
          minister,
          `${minister.post}: my department needs a decision today, not a paragraph in the communique.`,
        ),
      ),
    );
  }

  return {
    week: state.week,
    attendees: buildCabinetAttendees(state),
    bilaterals: buildBilaterals(state),
    quad: buildQuad(state),
    items,
  };
}

function mergeEffects(target: Effects, effects: Effects): void {
  const writable = target as Record<string, unknown>;
  for (const key of NUMERIC_EFFECT_KEYS) {
    const value = effects[key];
    if (typeof value !== 'number') continue;
    const current = writable[key];
    writable[key] = (typeof current === 'number' ? current : 0) + value;
  }
  if (effects.supportDelta) {
    const support = { ...(target.supportDelta ?? {}) };
    for (const [partyId, delta] of Object.entries(effects.supportDelta)) {
      support[partyId] = (support[partyId] ?? 0) + delta;
    }
    target.supportDelta = support;
  }
}

export function resolveCabinetMeeting(
  meeting: CabinetMeeting,
  plan: CabinetMeetingPlan,
  state: GameState,
): CabinetMeetingOutcome | null {
  const effects: Effects = {};
  const loyaltyByName: Record<string, number> = {};
  const summaries: string[] = [];
  const itemMinutes: { title: string; choice: string }[] = [];
  const bilateralMinutes: { title: string; choice: string }[] = [];
  let cohesionDelta = 0;
  let factionUnrestDelta = 0;

  const applyOption = (option: CabinetMeetingOption, label: string) => {
    mergeEffects(effects, option.effects);
    cohesionDelta += option.cohesionDelta;
    factionUnrestDelta += option.factionUnrestDelta ?? 0;

    for (const [post, delta] of Object.entries(option.loyaltyByPost ?? {})) {
      const minister = state.cabinet.find((entry) => entry.post === post);
      if (minister) {
        loyaltyByName[minister.name] = (loyaltyByName[minister.name] ?? 0) + delta;
      }
    }

    summaries.push(`${label}: ${option.label}`);
  };

  for (const bilateral of meeting.bilaterals) {
    const optionId = plan.bilateralChoices?.[bilateral.id];
    const option = bilateral.options.find((entry) => entry.id === optionId);
    if (!option) return null;
    applyOption(option, bilateral.title);
    bilateralMinutes.push({ title: bilateral.title, choice: option.label });
  }

  const quadOption = meeting.quad.options.find((entry) => entry.id === plan.quadOptionId);
  if (!quadOption) return null;
  applyOption(quadOption, meeting.quad.title);

  for (const item of meeting.items) {
    const decision = plan.decisions.find((entry) => entry.itemId === item.id);
    if (!decision) return null;
    const option = item.options.find((entry) => entry.id === decision.optionId);
    if (!option) return null;
    applyOption(option, item.title);
    itemMinutes.push({ title: item.title, choice: option.label });
  }

  if (plan.collectiveResponsibility === 'united') {
    mergeEffects(effects, { partyConfidence: 2, approval: -1 });
    cohesionDelta += 2;
    factionUnrestDelta -= 1;
    summaries.push('Collective responsibility: united front');
  } else if (plan.collectiveResponsibility === 'free') {
    mergeEffects(effects, { approval: 1, partyConfidence: -2 });
    cohesionDelta -= 3;
    factionUnrestDelta += 2;
    summaries.push('Collective responsibility: ministers free to speak');
  }

  const summary = `Cabinet meeting: ${summaries.join('; ')}.`;
  const record: CabinetMeetingRecord = {
    week: meeting.week,
    items: itemMinutes,
    bilaterals: bilateralMinutes,
    quad: { title: meeting.quad.title, choice: quadOption.label },
    collectiveResponsibility: plan.collectiveResponsibility,
    effects,
    cohesionDelta,
    factionUnrestDelta,
    loyaltyChanges: Object.entries(loyaltyByName).map(([name, delta]) => ({ name, delta })),
    summary,
  };

  return {
    effects,
    cohesionDelta,
    factionUnrestDelta,
    loyaltyByName,
    summary,
    log: [`CABINET MEETING: ${summaries.join('; ')}.`],
    record,
  };
}
