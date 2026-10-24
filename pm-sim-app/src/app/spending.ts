import type { SpendingDept } from './types';

/**
 * Government departments whose budgets the PM can adjust.
 * Raising a budget costs the Exchequer but delivers its `benefit` per +1 step.
 */
export const INITIAL_DEPARTMENTS: SpendingDept[] = [
  {
    id: 'nhs', name: 'NHS & Social Care', budget: 190, min: 150, max: 230, step: 5,
    desc: 'Health, hospitals, GP services and social care.',
    benefit: { publicServices: 2, nhsWaitingList: -0.3, approval: 1 },
  },
  {
    id: 'education', name: 'Education & Skills', budget: 80, min: 55, max: 105, step: 5,
    desc: 'Schools, colleges, apprenticeships and universities.',
    benefit: { publicServices: 2, economy: 1 },
  },
  {
    id: 'defence', name: 'Defence', budget: 55, min: 40, max: 85, step: 5,
    desc: 'Armed forces, procurement and international security.',
    benefit: { security: 3, approval: 0 },
  },
  {
    id: 'homejustice', name: 'Home Office & Justice', budget: 35, min: 25, max: 55, step: 5,
    desc: 'Policing, courts, borders and prisons.',
    benefit: { security: 2 },
  },
  {
    id: 'transport', name: 'Transport & Infrastructure', budget: 30, min: 18, max: 50, step: 5,
    desc: 'Roads, rail, ports and net-zero infrastructure.',
    benefit: { economy: 2 },
  },
  {
    id: 'workpensions', name: 'Work & Pensions', budget: 120, min: 95, max: 140, step: 5,
    desc: 'Welfare, state pension and out-of-work support.',
    benefit: { approval: 2, publicServices: 1 },
  },
];
