import type { PoliticalEvent } from '../types';

/**
 * UK political event library.
 *
 * Same event schema as the donor engine, rethemed to Westminster. Party IDs
 * are kept: conservative / reform (Labour) / liberty (Lib Dem) /
 * populist (Reform UK) / progressive (Green).
 */
export const mockEvents: PoliticalEvent[] = [
  // ===== Event 1: Conservative–Reform UK backroom pact =====
  {
    id: 'evt-coalition-backroom',
    title: 'Secret Talks',
    summary: 'The Conservative leadership is privately courting Reform UK over a right-of-centre pact',
    sourceParty: 'conservative',
    severity: 4,
    dialogs: [
      {
        speaker: null,
        text: "Late in the evening, in a private members\u2019 club off Whitehall, two aides exchange a single envelope. Inside is a draft of talking points: the Conservative Party is exploring a non-aggression pact with Reform UK in a dozen marginal seats.",
      },
      {
        speaker: 'conservative',
        text: "\u2018Nigel Crossley is volatile, but his voters are real. If we stand aside in the right seats, we could split the right on our terms \u2014 not his.\u2019",
      },
      {
        speaker: null,
        text: "Richard Hartley\u2019s team knows the risk: Reform UK\u2019s brand is toxic to moderate Conservative voters in the shires, yet the arithmetic in the Midlands and coastal seats is tempting.",
      },
      {
        speaker: null,
        text: 'As Prime Minister, the intelligence lands on your desk. How far do you let this go?',
      },
    ],
    choices: [
      {
        id: 'accept-alliance',
        text: 'Quietly encourage the pact to consolidate the right',
        consequence: 'Negotiations accelerate, but word leaks and spooks centrist Conservative donors.',
        effects: {
          supportDelta: { conservative: 3, populist: 5, reform: -3, liberty: -2, progressive: -2 },
          relationDelta: {
            'conservative>populist': 25, 'populist>conservative': 20,
            'reform>conservative': -10, 'liberty>conservative': -8,
          },
          metricsDelta: { socialStabilityIndex: -5, mediaAttention: 20 },
        },
      },
      {
        id: 'reject-alliance',
        text: 'Block it \u2014 keep the Conservatives from legitimising Reform UK',
        consequence: 'The talks stall. Reform UK feels snubbed, but the Conservative brand stays intact.',
        effects: {
          supportDelta: { conservative: -1, populist: -3, reform: 2 },
          relationDelta: { 'conservative>populist': -20, 'populist>conservative': -25 },
          metricsDelta: { socialStabilityIndex: 2, mediaAttention: 8 },
        },
      },
      {
        id: 'leak-to-press',
        text: 'Leak the discussions to derail both parties',
        consequence: 'The story dominates the news cycle, wounding both right-of-centre parties. Labour and the Lib Dems benefit.',
        effects: {
          supportDelta: { conservative: -6, populist: -5, reform: 3, liberty: 3, progressive: 2 },
          relationDelta: { 'conservative>populist': -30, 'populist>conservative': -35 },
          metricsDelta: { mediaAttention: 30, socialStabilityIndex: -3 },
        },
      },
    ],
  },

  // ===== Event 2: National rail strike =====
  {
    id: 'evt-rail-strike',
    title: 'Signals Failure',
    summary: "The rail unions, led by Labour\u2019s Grace O\u2019Donnell, threaten a national walkout",
    sourceParty: 'reform',
    severity: 3,
    dialogs: [
      {
        speaker: null,
        text: "Picket lines are forming outside depots from Crewe to Carlisle. Grace O\u2019Donnell, the union\u2019s general secretary, has given the government 72 hours to return to the table over pay and conditions.",
      },
      {
        speaker: 'reform',
        text: "\u2018We didn\u2019t ask for this. Months of real-terms cuts, understaffed shifts, and ministers who won\u2019t pick up the phone \u2014 that\u2019s what brought us here.\u2019",
      },
      {
        speaker: null,
        text: 'The railways, already fragile, cannot absorb a weeks-long stoppage. Commuters are furious; the economy is watching. The choice of how to respond is yours.',
      },
    ],
    choices: [
      {
        id: 'support-strike',
        text: 'Side publicly with the unions and pressure the rail operators',
        consequence: 'The unions welcome the intervention, but business groups and the right cry betrayal.',
        effects: {
          supportDelta: { reform: 5, progressive: 2, conservative: -3, liberty: -2, populist: -1 },
          relationDelta: {
            'reform>progressive': 5, 'reform>conservative': -10, 'reform>liberty': -5,
          },
          metricsDelta: { economicIndex: -6, socialStabilityIndex: -4, mediaAttention: 22 },
        },
      },
      {
        id: 'negotiate',
        text: 'Convene emergency talks to force a compromise settlement',
        consequence: 'A deal is patched together after days of talks. No one is delighted, but the strikes are called off.',
        effects: {
          supportDelta: { reform: 1, conservative: 1, liberty: 1, progressive: 1 },
          metricsDelta: { economicIndex: -2, socialStabilityIndex: -2, mediaAttention: 10 },
        },
      },
      {
        id: 'suppress-strike',
        text: 'Announce minimum-service legislation and tough enforcement',
        consequence: 'The walkout is blunted, but the unions are enraged and the industrial-relations battle escalates.',
        effects: {
          supportDelta: { reform: -5, progressive: -2, conservative: 2, populist: 2, liberty: 1 },
          relationDelta: { 'reform>conservative': -12, 'reform>liberty': -8 },
          metricsDelta: { economicIndex: 3, socialStabilityIndex: -8, mediaAttention: 18 },
        },
      },
    ],
  },

  // ===== Event 3: Reform UK donor scandal =====
  {
    id: 'evt-donor-scandal',
    title: 'Money Trail',
    summary: 'Nigel Crossley is accused of accepting undeclared overseas donations',
    sourceParty: 'populist',
    severity: 5,
    dialogs: [
      {
        speaker: null,
        text: "A cache of documents, passed to three news desks at once, appears to show Reform UK\u2019s leader accepting several large donations routed through an offshore trust. Nigel Crossley denies everything at a hastily arranged press conference.",
      },
      {
        speaker: 'populist',
        text: "\u2018This is the establishment closing ranks. Every penny was declared, every rule followed \u2014 and they know it.\u2019",
      },
      {
        speaker: null,
        text: 'The documents tell a messier story. Whether or not the payments were legal, the optics are brutal. As Prime Minister, how you handle this will shape the political weather for months.',
      },
    ],
    choices: [
      {
        id: 'expose-full',
        text: 'Call for a full Electoral Commission investigation and let it run',
        consequence: 'Reform UK\u2019s poll rating dips sharply. The right fragments, but the affair dominates parliament.',
        effects: {
          supportDelta: { populist: -8, conservative: 2, reform: 3, liberty: 2, progressive: 1 },
          fundsDelta: { populist: -200 },
          relationDelta: { 'populist>conservative': -10, 'conservative>populist': -8 },
          metricsDelta: { socialStabilityIndex: -4, mediaAttention: 35 },
        },
      },
      {
        id: 'blackmail',
        text: 'Hold the evidence privately and extract a concession on a flagship bill',
        consequence: 'Reform UK softens its opposition in exchange for silence \u2014 but the threat never fully goes away.',
        effects: {
          supportDelta: { populist: -2 },
          relationDelta: { 'populist>reform': 8, 'reform>populist': 5 },
          fundsDelta: { populist: -80 },
          metricsDelta: { mediaAttention: 10 },
        },
      },
      {
        id: 'bury-evidence',
        text: 'Quietly make the story go away in exchange for a private understanding',
        consequence: 'The scandal fades, but Reform UK now holds leverage over you.',
        effects: {
          supportDelta: { populist: 2 },
          relationDelta: { 'populist>reform': 12, 'reform>populist': 10 },
          metricsDelta: { mediaAttention: -5 },
        },
      },
    ],
  },
];
