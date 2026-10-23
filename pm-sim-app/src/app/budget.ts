import type { BudgetPackage } from './types';

/**
 * Annual Budget statements the Chancellor can deliver at the dispatch box.
 * Each package trades off growth, services, tax, debt and popularity.
 */
export const BUDGET_PACKAGES: BudgetPackage[] = [
  {
    id: 'budget-restraint',
    title: 'Fiscal Restraint',
    description: 'Freeze departmental spending and hold taxes to reassure the bond markets.',
    effects: { economy: 2, publicServices: -2, debtToGdp: -1, budgetBalance: 15, approval: -2, partyConfidence: 2 },
    kicker: 'CHANCELLOR FREEZES SPENDING TO BALANCE THE BOOKS',
  },
  {
    id: 'budget-invest',
    title: 'Invest for Growth',
    description: 'Boost NHS, energy and housing capital investment, funded by borrowing.',
    effects: { publicServices: 5, economy: 2, approval: 3, budgetBalance: -25, debtToGdp: 1, giltYield: 0.1 },
    kicker: 'BUDGET UNVEILS MAJOR INVESTMENT IN SERVICES AND GROWTH',
  },
  {
    id: 'budget-middle',
    title: 'The Middle Way',
    description: 'A modest tax rise paired with targeted frontline spending.',
    effects: { publicServices: 2, economy: 1, approval: 1, budgetBalance: 5, taxRate: 1 },
    kicker: 'BUDGET: MODEST TAX RISES TO FUND FRONTLINE SERVICES',
  },
  {
    id: 'budget-taxcuts',
    title: 'Tax Cuts',
    description: 'Cut National Insurance and corporation tax, betting on growth to pay for itself.',
    effects: { economy: 4, approval: 2, taxRate: -2, budgetBalance: -20, debtToGdp: 1, publicServices: -3, unemployment: -0.3 },
    kicker: 'BUDGET SLASHES TAXES IN AN ALL-OR-NOTHING GROWTH BET',
  },
];
