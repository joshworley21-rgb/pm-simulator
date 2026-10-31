import type { Dossier } from './types';

/**
 * One-off Red Box warning for a minority government.
 *
 * It is not part of the random dossier pools: the engine injects it
 * deterministically (see the opposition-business step in engine.ts) the first
 * time a no-confidence motion is tabled while the government has fewer than 326
 * seats and no confidence-and-supply partner.
 *
 * The paper only points the player at the existing Confidence and Supply
 * negotiation on the Government tab. Its choices carry no effects: it never
 * creates a deal, changes seat totals or guarantees survival.
 */
export const CONFIDENCE_WARNING_ID = 'dos-confidence-warning';

export const CONFIDENCE_WARNING_DOSSIER: Dossier = {
  id: CONFIDENCE_WARNING_ID,
  title: 'Confidence Vote Being Organised',
  department: 'Number 10',
  urgent: true,
  // Survives the two weeks between tabling and the division.
  weeksRemaining: 4,
  leadParagraph:
    'The opposition has tabled a motion of no confidence and the division is scheduled for next month. Whips report that unaligned parties are being courted to vote the government down.',
  body:
    'You do not currently command 326 votes and no partner is committed to confidence and supply. There is still time to negotiate before the division: a partner who signs a confidence-and-supply agreement will vote with you on money and confidence, at a price.',
  choices: [
    {
      id: 'confidence-open-talks',
      label: 'Open confidence-and-supply talks',
      summary: 'Use Confidence and Supply on the Government tab to buy a partner\u2019s votes before the division.',
      advice: 'A partner votes with you on money and confidence. The price is set by their willingness and seats.',
      effects: {},
    },
    {
      id: 'confidence-face-division',
      label: 'Face the division as things stand',
      summary: 'Gamble that enough MPs abstain or stay loyal without a formal deal.',
      advice: 'No deal, no safety net. The numbers decide it.',
      effects: {},
    },
  ],
};

/**
 * Urgent Red Box ultimatum issued when an existing confidence-and-supply
 * agreement frays due to falling government approval (< 30%).
 *
 * Provides advance notice and an actionable chance to grant concessions
 * before support is pulled, rather than abruptly withdrawing silently.
 */
export const SUPPLY_ULTIMATUM_ID = 'dos-supply-ultimatum';

export function createSupplyUltimatumDossier(partnerName: string, partnerAbbr: string): Dossier {
  return {
    id: SUPPLY_ULTIMATUM_ID,
    title: `${partnerName} Threatens Confidence & Supply Agreement`,
    department: 'Number 10',
    urgent: true,
    weeksRemaining: 2,
    leadParagraph: `With government approval falling below 30%, ${partnerName} leadership warns that their party cannot continue propping up an unpopular administration without fresh concessions.`,
    body: `The whips report that ${partnerName} backbenchers are restive. They demand an emergency £2bn funding concession to justify continued support. If you refuse or ignore this ultimatum, they will pull the plug on confidence and supply immediately.`,
    choices: [
      {
        id: 'supply-concede',
        label: `Grant £2bn emergency concession to ${partnerName}`,
        summary: 'Protect the confidence-and-supply agreement with targeted funding.',
        advice: 'Preserves your parliamentary majority, but adds £2bn to the deficit and frustrates your own backbenchers.',
        effects: { budgetBalance: -2, partyConfidence: -1, approval: 1 },
      },
      {
        id: 'supply-reject',
        label: 'Refuse concessions and let the partner walk',
        summary: 'Reject the ultimatum and prepare to govern without a formal deal.',
        advice: `Maintains fiscal discipline, but ${partnerName} will withdraw support immediately, leaving you exposed in the Commons.`,
        effects: { partyConfidence: 1 },
      },
    ],
  };
}
