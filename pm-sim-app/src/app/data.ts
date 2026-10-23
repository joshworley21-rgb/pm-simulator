import type { Party, Relation, Dossier } from './types';

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
  'City financier',
  'Academic economist',
  'Military veteran',
];

/** Rich pool of Whitehall departmental crisis dossiers. */
export const DOSSIER_POOL: Dossier[] = [
  {
    id: 'dos-junior-doctors',
    title: 'Junior Doctors Strike Mandate',
    department: 'DHSC (Health)',
    urgent: true,
    weeksRemaining: 2,
    leadParagraph: 'BMA Junior Doctors Committee has voted 92% in favour of an immediate five-day walkout over pay restoration.',
    body: 'The NHS Confederation warns 250,000 appointments and elective surgeries will be cancelled. Waiting lists will breach record highs. The BMA demands a 22% pay rise, while HM Treasury insists public pay caps cannot be breached.',
    choices: [
      {
        id: 'settle-above',
        label: 'Offer an 11% consolidated settlement',
        summary: 'Call off the strike with a compromise deal.',
        advice: 'Treasury warns of borrowing pressure, but NHS trusts will avert total paralysis.',
        effects: { approval: 4, publicServices: 6, economy: -3, nhsWaitingList: -0.2, fundsDelta: -250 },
      },
      {
        id: 'resist-strike',
        label: 'Hold the 5% line and condemn the strike',
        summary: 'Stand firm against union pay demands.',
        advice: 'Averts borrowing spikes, but hospital waiting lists and public fury will surge.',
        effects: { approval: -5, publicServices: -8, economy: 2, nhsWaitingList: 0.4, lettersDelta: 3 },
      },
      {
        id: 'independent-review',
        label: 'Refer to an emergency pay review body',
        summary: 'Kick the can down the road while offering a one-off bonus.',
        advice: 'Halts industrial action temporarily, but backbenchers view it as indecisive.',
        effects: { approval: 1, publicServices: 1, partyConfidence: -2, fundsDelta: -100 },
      },
    ],
  },
  {
    id: 'dos-gilt-panic',
    title: 'Sterling & Gilt Yield Spike',
    department: 'HM Treasury',
    urgent: true,
    weeksRemaining: 1,
    leadParagraph: '10-year Gilt yields have spiked 65 basis points following debt forecast leaks. International bond vigilantes are testing UK credit.',
    body: 'The Governor of the Bank of England has telephoned Number 10. Pension funds face collateral calls. You must decide whether to announce immediate spending cuts or defend your growth programme.',
    choices: [
      {
        id: 'fiscal-retrenchment',
        label: 'Announce emergency £12bn departmental spending cuts',
        summary: 'Soothe the markets with strict fiscal orthodoxy.',
        advice: 'Calms gilt yields immediately, but severely depresses public services and backbench loyalty.',
        effects: { approval: -4, economy: 5, publicServices: -6, giltYield: -0.5, partyConfidence: -4, lettersDelta: 4 },
      },
      {
        id: 'tax-the-rich',
        label: 'Introduce windfall & wealth levy to balance the books',
        summary: 'Close the fiscal gap through targeted progressive taxes.',
        advice: 'Popular with the public and unions; triggers fierce backlash from the City and The Courier.',
        effects: { approval: 3, economy: -2, fundsDelta: 400, supportDelta: { populist: 2, conservative: -2 } },
      },
      {
        id: 'hold-nerve',
        label: 'Defend your programme and urge market calm',
        summary: 'Refuse panic measures and insist fundamentals are sound.',
        advice: 'High-stakes gamble: inflation and borrowing costs may surge if the market tests your resolve.',
        effects: { approval: -2, economy: -5, giltYield: 0.4, cpiInflation: 0.3, lettersDelta: 6 },
      },
    ],
  },
  {
    id: 'dos-channel-crossings',
    title: 'Channel Crossing Surge',
    department: 'Home Office',
    urgent: false,
    weeksRemaining: 3,
    leadParagraph: 'Calm weather has seen over 2,200 small boat arrivals over the past 72 hours, overwhelming Kent processing facilities.',
    body: 'Hotels are at capacity and local councils are in open revolt. Reform UK is surging in coastal polling, demanding naval interceptions, while civil liberties groups warn against breaches of human rights conventions.',
    choices: [
      {
        id: 'border-bilateral',
        label: 'Agree a £180m joint interception pact with France',
        summary: 'Pay Paris for beefed-up beach patrols and drone surveillance.',
        advice: 'Moderately stems flows, but critics claim Britain is subsidising French gendarmes.',
        effects: { approval: 2, netMigration: -20, fundsDelta: -180, supportDelta: { populist: -2, reform: 1 } },
      },
      {
        id: 'hardline-deterrence',
        label: 'Deploy military logistics and offshore holding barges',
        summary: 'Visible, tough deterrent posture to stop crossings.',
        advice: 'Rallies right-leaning voters, but draws immediate legal challenges and protests.',
        effects: { approval: 1, security: 4, supportDelta: { populist: -4, progressive: -2 }, lettersDelta: -2 },
      },
      {
        id: 'asylum-fasttrack',
        label: 'Open safe processing centres and clear caseworker backlog',
        summary: 'Focus on bureaucratic processing and returns of failed claimants.',
        advice: 'Praised by human rights groups; condemned by right-wing tabloids as an open-door policy.',
        effects: { approval: -3, publicServices: 3, supportDelta: { populist: 4, liberty: 2 } },
      },
    ],
  },
  {
    id: 'dos-prison-capacity',
    title: 'Prisons at 99.4% Capacity',
    department: 'Home Office',
    urgent: true,
    weeksRemaining: 2,
    leadParagraph: 'The Governor of Wandsworth Prison warns operational capacity will be exhausted by Friday.',
    body: 'Police custody suites are being used as overflow cells, meaning officers cannot make routine arrests. Ministry of Justice officials urge an emergency early release scheme for non-violent offenders serving under 4 years.',
    choices: [
      {
        id: 'early-release',
        label: 'Authorise emergency early release at 40% of sentence',
        summary: 'Release up to 3,000 non-violent prisoners to avert custody gridlock.',
        advice: 'Averts police operational collapse, but the tabloids will have a field day.',
        effects: { approval: -5, security: -4, publicServices: 3, mediaAttention: 15, lettersDelta: 2 },
      },
      {
        id: 'emergency-pre-fabs',
        label: 'Requisition disused military barracks for temporary detention',
        summary: 'Erect secure temporary accommodation under emergency powers.',
        advice: 'Costly and slow to staff, but avoids releasing convicted offenders early.',
        effects: { approval: 1, security: 2, fundsDelta: -120 },
      },
    ],
  },
  {
    id: 'dos-nato-spending',
    title: 'NATO 2.5% Defence Spending Commitment',
    department: 'Ministry of Defence',
    urgent: false,
    weeksRemaining: 3,
    leadParagraph: 'At the upcoming Washington summit, the US Administration will demand all allies set a hard timeline for 2.5% of GDP on defence.',
    body: 'Chief of the Defence Staff briefs that Army equipment programmes are hollowed out. Meeting 2.5% requires an additional £6bn annually from the Treasury.',
    choices: [
      {
        id: 'pledge-immediate',
        label: 'Commit to 2.5% within 24 months, funded by foreign aid reallocation',
        summary: 'Firmly align with Washington and bolster British global standing.',
        advice: 'Delights the MoD and Washington; deeply controversial among progressive backbenchers.',
        effects: { approval: 2, security: 8, partyConfidence: -1, supportDelta: { progressive: -2, conservative: 1 } },
      },
      {
        id: 'aspirational-target',
        label: 'Maintain as an aspirational target \u201cwhen economic conditions permit\u201d',
        summary: 'Resist committing fresh billions while paying diplomatic lip service.',
        advice: 'Protects the fiscal baseline, but risks open US criticism.',
        effects: { approval: -1, security: -3, economy: 2 },
      },
    ],
  },
  {
    id: 'dos-energy-bills',
    title: 'Winter Energy Price Cap Spike',
    department: 'Energy & Net Zero',
    urgent: true,
    weeksRemaining: 2,
    leadParagraph: 'Ofgem forecasts a 14% rise in household energy price caps as global wholesale gas markets tighten.',
    body: 'National Energy Action projects 4.8 million households will be pushed into fuel poverty as temperatures plummet. Backbenchers demand universal energy bill rebates.',
    choices: [
      {
        id: 'targeted-rebates',
        label: 'Launch £250 targeted fuel support for low-income pensioners and families',
        summary: 'Provide focused relief without blowing the Treasury budget.',
        advice: 'Praised for fiscal prudence; middle earners complain of being forgotten.',
        effects: { approval: 3, economy: -2, fundsDelta: -350, cpiInflation: -0.2 },
      },
      {
        id: 'subsidise-wholesale',
        label: 'Freeze the price cap directly for all households',
        summary: 'Massive £2.5bn intervention to halt inflation in its tracks.',
        advice: 'Broad public acclaim; economists warn of substantial borrowing risks.',
        effects: { approval: 7, economy: -6, cpiInflation: -0.6, fundsDelta: -1200, partyConfidence: 3 },
      },
      {
        id: 'market-discipline',
        label: 'Rely on existing welfare buffers and advise energy efficiency',
        summary: 'Refuse expensive market subsidies.',
        advice: 'Protects state finances, but faces brutal public outrage and plummeting polls.',
        effects: { approval: -8, economy: 1, cpiInflation: 0.4, lettersDelta: 5 },
      },
    ],
  },
];
