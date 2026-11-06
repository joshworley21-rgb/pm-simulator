import type { Party } from './types';

/**
 * The body that represents a party's MPs in the Commons and the rules by which
 * that party can challenge its leader.
 *
 * The game still uses one pressure counter internally, but the institutions and
 * labels are not interchangeable: the 1922 Committee is Conservative, Labour
 * MPs sit in the Parliamentary Labour Party, and a Labour challenge begins with
 * PLP nominations rather than letters to a backbench committee.
 */
export interface BackbenchBody {
  full: string;
  short: string;
  /** Capitalised for sentence starts and card labels. */
  pressureLabel: string;
  /** Short uppercase label for chips and meters. */
  pressureShort: string;
  /** Singular noun for “one more …”. */
  pressureUnit: 'letter' | 'nomination';
  ballotLabel: string;
  thresholdPct: number;
}

export function backbenchBody(party: Pick<Party, 'id'> | undefined): BackbenchBody {
  switch (party?.id) {
    case 'conservative':
      return {
        full: '1922 Committee',
        short: '1922 COMMITTEE',
        pressureLabel: 'Letters of no confidence',
        pressureShort: 'LETTERS',
        pressureUnit: 'letter',
        ballotLabel: 'confidence ballot',
        thresholdPct: 0.15,
      };
    case 'reform':
      return {
        full: 'Parliamentary Labour Party',
        short: 'PLP',
        pressureLabel: 'PLP nominations',
        pressureShort: 'NOMINATIONS',
        pressureUnit: 'nomination',
        ballotLabel: 'leadership ballot',
        thresholdPct: 0.2,
      };
    case 'liberty':
      return {
        full: 'Liberal Democrat Parliamentary Party',
        short: 'LD BACKBENCH',
        pressureLabel: 'Leadership nominations',
        pressureShort: 'NOMINATIONS',
        pressureUnit: 'nomination',
        ballotLabel: 'leadership ballot',
        thresholdPct: 0.15,
      };
    case 'populist':
      return {
        full: 'Reform UK Parliamentary Party',
        short: 'REFORM BACKBENCH',
        pressureLabel: 'Leadership nominations',
        pressureShort: 'NOMINATIONS',
        pressureUnit: 'nomination',
        ballotLabel: 'leadership ballot',
        thresholdPct: 0.15,
      };
    case 'progressive':
      return {
        full: 'Green Party Parliamentary Group',
        short: 'GREEN BACKBENCH',
        pressureLabel: 'Leadership nominations',
        pressureShort: 'NOMINATIONS',
        pressureUnit: 'nomination',
        ballotLabel: 'leadership ballot',
        thresholdPct: 0.15,
      };
    default:
      return {
        full: 'Parliamentary party',
        short: 'BACKBENCH',
        pressureLabel: 'Leadership nominations',
        pressureShort: 'NOMINATIONS',
        pressureUnit: 'nomination',
        ballotLabel: 'leadership ballot',
        thresholdPct: 0.15,
      };
  }
}

export function leadershipThreshold(seats: number, party: Pick<Party, 'id'> | undefined): number {
  const rules = backbenchBody(party);
  return Math.max(15, Math.round(seats * rules.thresholdPct));
}
