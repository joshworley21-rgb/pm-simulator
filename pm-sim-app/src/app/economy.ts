import type { GameState } from './types';

/**
 * Monetary & fiscal credibility engine.
 *
 * Models the three forces that actually constrain a UK Prime Minister:
 *   1. Bank of England MPC — sets interest rates INDEPENDENTLY of the PM.
 *   2. OBR fiscal rules — breach them and markets price a risk premium.
 *   3. Gilt market — the feedback loop that punishes unfunded promises.
 *
 * The core emergent loop:
 *   unfunded tax cut -> deficit widens -> rule breached -> credibility falls
 *   -> gilt yield spikes -> debt interest rises -> deficit widens further
 *   -> BoE hikes -> mortgage pain -> real wages fall -> approval crashes
 */

export const BOE_TARGET_INFLATION = 2;
/** Rough UK nominal GDP in £bn — used to convert balances to % of GDP. */
export const NOMINAL_GDP_BN = 2900;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * MPC reaction function. The PM cannot control this.
 * Simple Taylor-style rule with a recession override.
 */
export function mpcDecision(inflation: number, rate: number, growth: number): number {
  let next = rate;
  if (inflation > 3.5) next += 0.25;
  else if (inflation < 1.5) next -= 0.25;
  if (growth < 0 && inflation < 3) next -= 0.25;
  return r2(clamp(next, 0.5, 10));
}

/** Gilt yield = base rate + term premium + credibility risk premium + debt pressure. */
export function giltYield(boeRate: number, credibility: number, debtToGdp: number): number {
  const termPremium = 0.8;
  const riskPremium = ((100 - credibility) / 100) * 2.5;
  const debtPressure = Math.max(0, (debtToGdp - 90) / 100) * 1.5;
  return r2(clamp(boeRate + termPremium + riskPremium + debtPressure, 0.5, 15));
}

/** Mortgage rates track the base rate with a spread. */
export function mortgageFromBase(boeRate: number): number {
  return r2(boeRate + 1.0);
}

/** Phillips-curve-ish wage setting: tight labour market pushes pay up. */
export function wageGrowth(unemployment: number, inflation: number): number {
  const tightness = (5 - unemployment) * 0.6;
  return r1(clamp(inflation * 0.6 + tightness + 0.8, -2, 12));
}

/** House prices respond to affordability: wages up, mortgage costs down. */
export function housePrices(mortgageRate: number, wages: number): number {
  return r1(clamp(wages - mortgageRate * 0.8, -15, 15));
}

/** Two real fiscal rules the OBR would police. */
export function checkFiscalRules(debtToGdp: number, budgetBalance: number) {
  const borrowingPctGdp = (-budgetBalance / NOMINAL_GDP_BN) * 100;
  const debtFalling = debtToGdp < 100;
  const borrowingOK = borrowingPctGdp < 3;
  const breached = (debtFalling ? 0 : 1) + (borrowingOK ? 0 : 1);
  return { debtFalling, borrowingOK, breached };
}

/** OBR-style independent forecast derived from the current trajectory. */
export function obrForecast(debtToGdp: number, budgetBalance: number, gdpGrowth: number, cpiInflation: number) {
  return {
    borrowing: Math.round(-budgetBalance),
    debt: Math.round(debtToGdp + (budgetBalance < 0 ? -budgetBalance / 12 : 0)),
    growth: r1(gdpGrowth),
    inflation: r1(cpiInflation),
  };
}

/**
 * Weekly monetary/fiscal tick. Pure function.
 * Called after weeklyEconomy() in advanceWeek.
 */
export function advanceEconomy(s: GameState): GameState {
  const st = s.stats;

  // 1. MPC meets independently of the PM.
  const boeRate = mpcDecision(st.cpiInflation, st.boeRate, st.gdpGrowth);

  // 2. Fiscal rules drive market credibility.
  const rules = checkFiscalRules(st.debtToGdp, st.budgetBalance);
  let credibility = st.fiscalCredibility ?? 65;
  credibility += rules.breached > 0 ? -6 * rules.breached : 2;
  credibility = clamp(credibility, 0, 100);

  // 3. Market pricing responds to both.
  const gilt = giltYield(boeRate, credibility, st.debtToGdp);
  const mortgage = mortgageFromBase(boeRate);

  // 4. Real economy.
  const wages = wageGrowth(st.unemployment, st.cpiInflation);
  const realWages = r1(wages - st.cpiInflation);
  const hpi = housePrices(mortgage, wages);

  // 5. Debt interest spiral: higher gilts cost more to service.
  const interestCost = (st.debtToGdp / 100) * NOMINAL_GDP_BN * (gilt / 100) * 0.15;
  const budgetBalance = r1(st.budgetBalance - interestCost * 0.02);

  // 6. Inflation responds to rates with a lag.
  let inflation = st.cpiInflation;
  if (boeRate > inflation + 1) inflation -= 0.1;
  else if (boeRate < inflation - 1) inflation += 0.1;
  inflation = r1(Math.max(0.4, inflation));

  // 7. Truss-moment trigger.
  const marketCrisis = gilt > 6.0 && credibility < 30;

  // 8. Approval: real wages and mortgage pain dominate.
  let approval = s.metrics.approval;
  approval += realWages > 0 ? 1 : -2;
  if (mortgage > 5.5) approval -= 1;
  approval = clamp(approval, 0, 100);

  const obr = obrForecast(st.debtToGdp, budgetBalance, st.gdpGrowth, inflation);

  return {
    ...s,
    metrics: { ...s.metrics, approval },
    stats: {
      ...st,
      boeRate,
      giltYield: gilt,
      mortgageRate: mortgage,
      wageGrowth: wages,
      realWageGrowth: realWages,
      housePriceChange: hpi,
      fiscalCredibility: credibility,
      budgetBalance,
      cpiInflation: inflation,
      rulesBreached: rules.breached,
      marketCrisis,
      obrBorrowing: obr.borrowing,
      obrDebt: obr.debt,
      obrGrowth: obr.growth,
      obrInflation: obr.inflation,
    },
  };
}
