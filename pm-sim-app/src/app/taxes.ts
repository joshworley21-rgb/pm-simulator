import type { TaxLever } from './types';

/**
 * The six headline UK taxes the PM / Chancellor can adjust.
 *
 * `popularityWeight` scales the public approval effect of a 1-point rate
 * change (higher = the public cares more about this tax). `rate` is the
 * current headline rate (%).
 */
export const INITIAL_TAXES: TaxLever[] = [
  { id: 'income', name: 'Income Tax (basic)', rate: 20, min: 15, max: 28, step: 1, popularityWeight: 2.0 },
  { id: 'ni', name: 'National Insurance', rate: 8, min: 4, max: 14, step: 1, popularityWeight: 1.8 },
  { id: 'vat', name: 'VAT', rate: 20, min: 15, max: 25, step: 1, popularityWeight: 1.6 },
  { id: 'corporation', name: 'Corporation Tax', rate: 25, min: 15, max: 35, step: 1, popularityWeight: 0.9 },
  { id: 'capgains', name: 'Capital Gains Tax', rate: 20, min: 10, max: 28, step: 1, popularityWeight: 0.6 },
  { id: 'inheritance', name: 'Inheritance Tax', rate: 40, min: 0, max: 50, step: 1, popularityWeight: 0.4 },
];

/**
 * Rough fiscal yield of a 1-point rate change across the whole tax (\u00a3bn/yr).
 * Used to translate tax lever movement into the budget balance.
 */
export const TAX_YIELD_PER_POINT: Record<string, number> = {
  income: 6,
  ni: 8,
  vat: 7,
  corporation: 3,
  capgains: 1,
  inheritance: 1,
};
