/**
 * UK regional blocs for the FPTP seat-projection model.
 *
 * The UK is divided into 12 nations/regions. Within each bloc, seats are
 * allocated by a first-past-the-post "cube law" (vote-share raised to an
 * exponent, then apportioned) to reproduce the disproportionality of the UK
 * system — e.g. Reform UK ~14% nationally but winning only a handful of seats
 * because its support is spread thinly rather than concentrated.
 *
 * totalSeats per bloc approximates real Commons apportionment across England's
 * regions + Scotland + Wales + Northern Ireland (650 seats total).
 *
 * voterCount = approximate electorate (electors, not residents).
 * supportByParty = each party's share of the vote in that bloc (%), sum ~100.
 */
export interface RegionalBloc {
  id: string;
  name: string;
  regions: string[];
  totalSeats: number;
  voterCount: number;
  politicalTraits: string[];
  supportByParty: Record<string, number>;
}

export const REGIONAL_BLOCKS: RegionalBloc[] = [
  {
    id: 'north-east',
    name: 'North East England',
    regions: ['Northumberland', 'Tyne and Wear', 'County Durham', 'Tees Valley'],
    totalSeats: 27,
    voterCount: 1_900_000,
    politicalTraits: ['post-industrial', 'labour-heartland'],
    supportByParty: { conservative: 19, reform: 47, liberty: 8, populist: 17, progressive: 6 },
  },
  {
    id: 'north-west',
    name: 'North West England',
    regions: ['Cumbria', 'Lancashire', 'Greater Manchester', 'Merseyside', 'Cheshire'],
    totalSeats: 73,
    voterCount: 5_400_000,
    politicalTraits: ['red-wall', 'urban-labour', 'coastal-towns'],
    supportByParty: { conservative: 21, reform: 46, liberty: 11, populist: 16, progressive: 5 },
  },
  {
    id: 'yorkshire',
    name: 'Yorkshire and the Humber',
    regions: ['North Yorkshire', 'West Yorkshire', 'South Yorkshire', 'East Riding', 'North Lincolnshire'],
    totalSeats: 54,
    voterCount: 4_000_000,
    politicalTraits: ['red-wall', 'post-industrial', 'rural-conservative'],
    supportByParty: { conservative: 24, reform: 42, liberty: 9, populist: 17, progressive: 6 },
  },
  {
    id: 'east-midlands',
    name: 'East Midlands',
    regions: ['Derbyshire', 'Nottinghamshire', 'Leicestershire', 'Rutland', 'Northamptonshire', 'South Lincolnshire'],
    totalSeats: 47,
    voterCount: 3_500_000,
    politicalTraits: ['marginal', 'midlands-bellwether'],
    supportByParty: { conservative: 27, reform: 38, liberty: 9, populist: 18, progressive: 6 },
  },
  {
    id: 'west-midlands',
    name: 'West Midlands',
    regions: ['West Midlands', 'Warwickshire', 'Worcestershire', 'Staffordshire', 'Shropshire', 'Herefordshire'],
    totalSeats: 57,
    voterCount: 4_100_000,
    politicalTraits: ['urban-labour', 'rural-conservative', 'marginal'],
    supportByParty: { conservative: 28, reform: 40, liberty: 10, populist: 16, progressive: 5 },
  },
  {
    id: 'east-england',
    name: 'East of England',
    regions: ['Norfolk', 'Suffolk', 'Cambridgeshire', 'Essex', 'Hertfordshire', 'Bedfordshire'],
    totalSeats: 61,
    voterCount: 4_600_000,
    politicalTraits: ['suburban', 'rural-conservative', 'coastal-towns'],
    supportByParty: { conservative: 31, reform: 33, liberty: 15, populist: 15, progressive: 5 },
  },
  {
    id: 'london',
    name: 'London',
    regions: ['Inner London', 'Outer London'],
    totalSeats: 75,
    voterCount: 5_600_000,
    politicalTraits: ['metropolitan', 'young', 'liberal', 'cosmopolitan'],
    supportByParty: { conservative: 20, reform: 44, liberty: 22, populist: 5, progressive: 7 },
  },
  {
    id: 'south-east',
    name: 'South East England',
    regions: ['Kent', 'Surrey', 'Sussex', 'Hampshire', 'Oxfordshire', 'Buckinghamshire', 'Berkshire'],
    totalSeats: 91,
    voterCount: 6_800_000,
    politicalTraits: ['affluent', 'commuter-belt', 'conservative-shire'],
    supportByParty: { conservative: 31, reform: 28, liberty: 23, populist: 12, progressive: 5 },
  },
  {
    id: 'south-west',
    name: 'South West England',
    regions: ['Cornwall', 'Devon', 'Somerset', 'Dorset', 'Gloucestershire', 'Wiltshire'],
    totalSeats: 58,
    voterCount: 4_300_000,
    politicalTraits: ['lib-dem-revival', 'rural', 'coastal', 'university-towns'],
    supportByParty: { conservative: 27, reform: 27, liberty: 30, populist: 10, progressive: 5 },
  },
  {
    id: 'scotland',
    name: 'Scotland',
    regions: ['Highlands', 'Central Belt', 'Glasgow', 'Edinburgh', 'Aberdeen', 'Borders'],
    totalSeats: 57,
    voterCount: 4_100_000,
    politicalTraits: ['nationalist-terrain', 'labour-revival', 'unionist-divide'],
    supportByParty: { conservative: 16, reform: 30, liberty: 13, populist: 9, progressive: 6 },
  },
  {
    id: 'wales',
    name: 'Wales',
    regions: ['North Wales', 'South Wales', 'Mid Wales', 'West Wales'],
    totalSeats: 32,
    voterCount: 2_300_000,
    politicalTraits: ['post-industrial', 'labour-heartland', 'rural'],
    supportByParty: { conservative: 20, reform: 43, liberty: 9, populist: 15, progressive: 5 },
  },
  {
    id: 'northern-ireland',
    name: 'Northern Ireland',
    regions: ['Belfast', 'Antrim', 'Down', 'Armagh', 'Derry/Londonderry', 'Tyrone', 'Fermanagh'],
    totalSeats: 18,
    voterCount: 1_300_000,
    politicalTraits: ['distinct-party-system', 'unionist-nationalist-divide'],
    supportByParty: { conservative: 12, reform: 8, liberty: 12, populist: 6, progressive: 4 },
  },
];

/** Total Commons seats across all blocs (should equal 650). */
export const SEATS_TOTAL = REGIONAL_BLOCKS.reduce((sum, b) => sum + b.totalSeats, 0);

/** Bloc ID → bloc lookup. */
export const BLOCK_BY_ID: Record<string, RegionalBloc> = Object.fromEntries(
  REGIONAL_BLOCKS.map((b) => [b.id, b]),
);

/** Back-compat aliases used by the donor's config/engine imports. */
export const PROPORTIONAL_BLOCKS = REGIONAL_BLOCKS;
export const TOTAL_NPC_SEATS = SEATS_TOTAL;
