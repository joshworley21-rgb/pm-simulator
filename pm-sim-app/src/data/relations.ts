import type { RelationEntry } from '../types';

/**
 * UK party relationship matrix.
 * score: -100 (hostile) .. +100 (alliance)
 *   >= 60 alliance | >= 20 friendly | >= -20 neutral | >= -50 tense | < -50 hostile
 *
 * Party IDs are kept from the donor engine:
 *   conservative → Conservative, reform → Labour, liberty → Lib Dem,
 *   populist → Reform UK, progressive → Green
 */
export const initialRelations: RelationEntry[] = [
  // ===== Labour (reform) =====
  { from: 'reform', to: 'conservative', score: -55, type: 'hostile', description: 'Simmering Cabinet-vs-opposition rivalry across tax, public services and the economy.' },
  { from: 'reform', to: 'liberty', score: 25, type: 'friendly', description: 'Cordial, with shared interest in public-service reform, though Labour distrusts Lib Dem coalition instincts.' },
  { from: 'reform', to: 'populist', score: -70, type: 'hostile', description: 'Reform UK competes openly for Labour\u2019s red-wall voters; the hostility is personal as much as political.' },
  { from: 'reform', to: 'progressive', score: 45, type: 'friendly', description: 'Aligned on climate and social justice, but Labour keeps electoral distance from the Greens\u2019 more radical flank.' },

  // ===== Conservative =====
  { from: 'conservative', to: 'reform', score: -55, type: 'hostile', description: 'Main-party enmity, sharpened by years of attack lines over the economy and public trust.' },
  { from: 'conservative', to: 'liberty', score: 10, type: 'neutral', description: 'Historical coalition partners; now wary, with limited appetite for formal cooperation.' },
  { from: 'conservative', to: 'populist', score: 55, type: 'friendly', description: 'Reform UK courts disaffected Tory voters, leaving the relationship awkwardly close on tax and immigration.' },
  { from: 'conservative', to: 'progressive', score: -35, type: 'tense', description: 'Deep policy disagreement on climate and redistribution, though it rarely spills into outright hostility.' },

  // ===== Liberal Democrats (liberty) =====
  { from: 'liberty', to: 'reform', score: 20, type: 'friendly', description: 'Content to cooperate on civil liberties and devolution where Labour is willing.' },
  { from: 'liberty', to: 'conservative', score: 10, type: 'neutral', description: 'Alliance possible in the abstract, but years of government austerity left lasting distrust.' },
  { from: 'liberty', to: 'populist', score: -60, type: 'hostile', description: 'Polar opposites on Europe, immigration and the rule of law.' },
  { from: 'liberty', to: 'progressive', score: 50, type: 'friendly', description: 'Natural progressive allies, strongest where both compete for university-town and suburban liberal voters.' },

  // ===== Reform UK (populist) =====
  { from: 'populist', to: 'reform', score: -70, type: 'hostile', description: 'Seeks to replace Labour in the post-industrial North and Midlands; the two are in open electoral combat.' },
  { from: 'populist', to: 'conservative', score: 50, type: 'friendly', description: 'Overlapping voters make a tacit right-of-centre pact tempting, though mutual suspicion runs high.' },
  { from: 'populist', to: 'liberty', score: -65, type: 'hostile', description: 'Dismisses the Lib Dems as metropolitan, pro-EU and out of touch with ordinary voters.' },
  { from: 'populist', to: 'progressive', score: -55, type: 'hostile', description: 'Fights the Greens over whose diagnosis of England\u2019s decline resonates in market towns.' },

  // ===== Green (progressive) =====
  { from: 'progressive', to: 'reform', score: 40, type: 'friendly', description: 'Views Labour as the viable vehicle for climate action, but pressures it from the left.' },
  { from: 'progressive', to: 'conservative', score: -30, type: 'tense', description: 'Clashes on net-zero and taxation, though neither sees the other as its primary rival.' },
  { from: 'progressive', to: 'liberty', score: 45, type: 'friendly', description: 'Fellow travellers on electoral reform and climate, wary only of Lib Dem centrism.' },
  { from: 'progressive', to: 'populist', score: -60, type: 'hostile', description: 'Anti-immigration and anti-climate positions make cooperation impossible.' },
];
