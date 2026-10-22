import type { GameState } from '../types';
import { initialParties } from './parties';
import { initialRelations } from './relations';
import { initialMetrics, initialDistricts } from './market';
import {
  runElectionV2,
  formGovernment,
  initializeCommittees,
  generatePersonalities,
  initializeFactions,
} from '../engine';
import { createInitialMemory } from '../engine/worldMemory';
import { createInitialDramaState } from '../engine/dramaEngine';

/**
 * Creates the initial UK game state:
 *   - Full 650-seat FPTP election
 *   - Labour (id 'reform') forms the government
 *   - 5-party committees, personalities and factions initialised
 *
 * The player becomes Prime Minister at character creation (see the UI hook:
 * set the player's chosen party/name into `government`).
 */
export function createInitialState(): GameState {
  const base: GameState = {
    parties: JSON.parse(JSON.stringify(initialParties)),
    relations: JSON.parse(JSON.stringify(initialRelations)),
    metrics: JSON.parse(JSON.stringify(initialMetrics)),
    districts: JSON.parse(JSON.stringify(initialDistricts)),
    events: [],
    government: null,
    committees: [],
    bills: [],
    pendingIntents: [],
    mpPersonalities: {},
    playerConfig: null,
    currentAIEvents: [],
    currentDay: 1,
    turn: 1,
    turnsUntilElection: 60, // 5-year Parliament, 1-month turns
    isElectionCampaign: false,
    worldMemory: createInitialMemory(),
    dramaState: createInitialDramaState(),
  };

  // Full 650-seat FPTP election (the player is PM, not a separate +1 seat).
  const electionResult = runElectionV2(
    base.parties,
    base.districts,
    base.metrics.totalSeats,       // 650
    base.metrics.majorityThreshold, // 326
    {},
    false,
  );

  for (const pr of electionResult.partyResults) {
    const party = base.parties.find((p) => p.id === pr.partyId);
    if (party) party.projectedSeats = pr.seats;
  }

  // Labour (id 'reform') forms the government. For a dynamic winner, replace
  // ['reform'] with [electionResult.majorityPartyId ?? 'reform'].
  base.government = formGovernment(
    ['reform'],
    base.parties,
    base.relations,
    electionResult,
    base.turn,
  );

  base.committees = initializeCommittees(
    base.parties,
    base.relations,
    electionResult,
    base.government.rulingCoalition,
  );

  base.mpPersonalities = generatePersonalities(
    base.parties,
    base.committees,
    electionResult,
    base.government,
  );

  const factionsByParty = initializeFactions(base.parties, base.mpPersonalities, base.government);

  for (const party of base.parties) {
    party.factions = factionsByParty[party.id] ?? [];
  }

  for (const party of base.parties) {
    for (const faction of party.factions ?? []) {
      for (const memberKey of faction.members) {
        const mp = base.mpPersonalities[memberKey];
        if (mp) mp.factionId = faction.id;
      }
    }
  }

  base.metrics.leadingCoalitionSeats = base.government.rulingCoalition.reduce((sum, pid) => {
    const r = electionResult.partyResults.find((er) => er.partyId === pid);
    return sum + (r?.seats ?? 0);
  }, 0);

  return base;
}
