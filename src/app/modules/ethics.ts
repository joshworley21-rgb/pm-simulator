import type { Effects } from '../types';

export interface Investigation {
  id: string;
  severity: number;
  weeksRemaining: number;
}

export interface EthicsState {
  standardsRisk: number;
  mediaHeat: number;
  activeInvestigations: Investigation[];
  coverUpActive: boolean;
  deferredScandalDamage: number;
  pendingApprovalDelta: number;
}

export interface EthicsFinding {
  id: string;
  severity: number;
  approvalHit: number;
  mediaAttentionHit: number;
  lettersDelta: number;
  factionUnrestHit: number;
}

export interface AdvanceEthicsResult {
  state: EthicsState;
  findings: EthicsFinding[];
  logs: string[];
  approvalDelta: number;
  factionUnrestDelta: number;
}

const INVESTIGATION_MATURITY_WEEKS = 3;
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function createDefaultEthics(): EthicsState {
  return {
    standardsRisk: 10,
    mediaHeat: 10,
    activeInvestigations: [],
    coverUpActive: false,
    deferredScandalDamage: 0,
    pendingApprovalDelta: 0,
  };
}

export function beginInvestigation(
  ethics: EthicsState,
  investigation: Pick<Investigation, 'id' | 'severity'>,
): EthicsState {
  return {
    ...ethics,
    activeInvestigations: [
      ...ethics.activeInvestigations,
      {
        id: investigation.id,
        severity: clamp(investigation.severity, 0, 100),
        weeksRemaining: INVESTIGATION_MATURITY_WEEKS,
      },
    ],
  };
}

/**
 * Come clean: drop the investigation now and take a bounded hit, rather than
 * letting it mature (or covering it up and risking the deferred damage).
 */
export function admitInvestigation(
  ethics: EthicsState,
  investigationId: string,
): { state: EthicsState; effects: Effects } {
  const investigation = ethics.activeInvestigations.find((i) => i.id === investigationId);
  if (!investigation) return { state: ethics, effects: {} };
  const severity = clamp(investigation.severity, 0, 100);
  return {
    state: {
      ...ethics,
      activeInvestigations: ethics.activeInvestigations.filter((i) => i.id !== investigationId),
      standardsRisk: clamp(ethics.standardsRisk - 2, 0, 100),
      coverUpActive: false,
    },
    effects: {
      approval: -Math.max(1, Math.round(severity * 0.25)),
      mediaAttention: Math.max(1, Math.round(severity * 0.5)),
      lettersDelta: severity >= 40 ? 1 : 0,
    },
  };
}

export function startCoverUp(ethics: EthicsState): EthicsState {
  if (ethics.coverUpActive) return ethics;
  return { ...ethics, coverUpActive: true, pendingApprovalDelta: 2 };
}

export function endCoverUp(ethics: EthicsState): EthicsState {
  return { ...ethics, coverUpActive: false };
}

function makeFinding(id: string, severity: number): EthicsFinding {
  const boundedSeverity = clamp(severity, 0, 100);
  return {
    id,
    severity: boundedSeverity,
    approvalHit: -Math.max(1, Math.round(boundedSeverity * 0.5)),
    mediaAttentionHit: Math.max(1, Math.round(boundedSeverity * 1.5)),
    lettersDelta: boundedSeverity >= 40 ? 2 : 1,
    factionUnrestHit: Math.max(1, Math.round(boundedSeverity * 0.1)),
  };
}

/** Advance investigations and resolve any one-shot cover-up benefit. */
export function advanceEthics(ethics: EthicsState, seed: number): AdvanceEthicsResult {
  const findings: EthicsFinding[] = [];
  const logs: string[] = [];
  let deferredScandalDamage = ethics.deferredScandalDamage;

  const activeInvestigations: Investigation[] = [];
  for (const investigation of ethics.activeInvestigations) {
    const weeksRemaining = investigation.weeksRemaining - 1;
    if (weeksRemaining > 0) {
      activeInvestigations.push({ ...investigation, weeksRemaining });
      continue;
    }

    if (ethics.coverUpActive) {
      deferredScandalDamage += investigation.severity;
      logs.unshift(`ETHICS: Finding in ${investigation.id} has been suppressed.`);
    } else {
      findings.push(makeFinding(investigation.id, investigation.severity));
      logs.unshift(`ETHICS: Investigation ${investigation.id} has published its finding.`);
    }
  }

  // A local deterministic draw exposes deferred damage after a cover-up ends.
  const normalizedSeed = Number.isFinite(seed) ? seed >>> 0 : 0;
  const exposureDraw =
    (Math.imul(normalizedSeed, 1664525) + 1013904223) >>> 0;
  if (
    !ethics.coverUpActive &&
    deferredScandalDamage > 0 &&
    exposureDraw / 4294967296 < 0.25
  ) {
    findings.push(makeFinding('cover-up-exposed', Math.min(100, deferredScandalDamage)));
    logs.unshift('ETHICS: The cover-up has been exposed; deferred findings are now public.');
    deferredScandalDamage = 0;
  }

  const standardsRisk = clamp(
    ethics.standardsRisk +
      activeInvestigations.length * 0.5 +
      (ethics.coverUpActive ? 2 : 0),
    0,
    100,
  );
  const mediaHeat = clamp(ethics.mediaHeat + (standardsRisk - ethics.mediaHeat) * 0.15, 0, 100);
  const approvalDelta = ethics.pendingApprovalDelta;

  return {
    state: {
      ...ethics,
      standardsRisk,
      mediaHeat,
      activeInvestigations,
      deferredScandalDamage,
      pendingApprovalDelta: 0,
    },
    findings,
    logs,
    approvalDelta,
    factionUnrestDelta: ethics.coverUpActive ? 0.5 : 0,
  };
}
