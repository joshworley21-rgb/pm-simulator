/**
 * Game world configuration.
 *
 * Setting: United Kingdom, near-present fictional politics.
 * System: parliamentary (Westminster), House of Commons as the playable chamber.
 * Term: up to 5 years = 60 monthly turns (early dissolution is allowed).
 *
 * All politicians and media outlets are original fictional characters/outlets;
 * no real politicians or organisations are represented.
 */
import { REGIONAL_BLOCKS } from '../config/districtConfig';

const REGION_TO_BLOC: Record<string, string> = Object.fromEntries(
  REGIONAL_BLOCKS.flatMap((b) => b.regions.map((r) => [r, b.id])),
);

export const WORLD_CONFIG = {
  country: 'United Kingdom',

  year: 2028,

  politicalSystem: 'parliamentary' as const,

  parliament: {
    name: 'House of Commons',
    isUpperHouse: false,
  },

  term: {
    years: 5,
    totalTurns: 60,
    turnDuration: '1 month' as const,
  },

  coreThemes: [
    'Westminster politics',
    'Faction and backbench management',
    'Coalition building',
    'PMQs and the media',
    'Government departments',
    'Election campaigning',
  ],

  get regions() {
    return REGIONAL_BLOCKS.flatMap((b) => b.regions);
  },

  regionalBlocs: REGIONAL_BLOCKS.map((b) => ({
    id: b.id,
    name: b.name,
    regions: b.regions,
    totalSeats: b.totalSeats,
    politicalTraits: b.politicalTraits,
  })),

  regionToBloc: REGION_TO_BLOC,

  governmentAgencies: [
    'Number 10 Downing Street',
    'HM Treasury',
    'Foreign, Commonwealth & Development Office',
    'Home Office',
    'Ministry of Defence',
    'Department of Health and Social Care',
    'Department for Education',
    'Ministry of Housing, Communities and Local Government',
    'Department for Transport',
    'Department for Energy Security and Net Zero',
    'Department for Business and Trade',
    'Department for Work and Pensions',
    'Ministry of Justice',
    'Scotland Office',
    'Wales Office',
    'Northern Ireland Office',
    'Cabinet Office',
  ],
} as const;

export type WorldConfig = typeof WORLD_CONFIG;
