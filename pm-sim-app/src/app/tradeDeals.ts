/**
 * Trade Deal Structures Module
 * UK trade agreements, tariff structures, and international commerce arrangements
 */

/** Trade deal types */
export type TradeDealType = 
  | 'free_trade'           // Comprehensive free trade agreement
  | 'customs_union'        // Customs union arrangement
  | 'partial'              // Partial trade agreement
  | 'sector_specific'      // Sector-specific (e.g. automotive)
  | 'wto_baseline';        // WTO Most Favoured Nation terms

/** Trade deal status */
export type TradeDealStatus = 'negotiating' | 'signed' | 'ratified' | 'expired' | 'withdrawn';

/** Trade partner countries/blocs */
export type TradePartner = 
  | 'eu'          // European Union
  | 'usa'         // United States
  | 'china'       // People's Republic of China
  | 'india'       // Republic of India
  | 'commonwealth'; // Commonwealth countries

/** Tariff rate structure */
export interface TariffStructure {
  baseRate: number;         // Base tariff (%)
  seasonal?: boolean;        // Whether seasonal tariffs apply
  agricultural: number;    // Agricultural product provisions
  manufacturing: number;   // Manufacturing product provisions
  services: number;        // Services provisions
  exceptions: string[];     // Product exemptions
}

/** Trade deal party information */
export interface TradeDealParty {
  partner: TradePartner;
  type: TradeDealType;
  status: TradeDealStatus;
  signedDate?: Date;        // When deal was signed
  effectiveDate?: Date;     // When deal becomes effective
  expiryDate?: Date;        // When deal expires (if any)
  tariffs: TariffStructure;
  sectors: string[];        // Covered sectors
  jointCommission?: boolean; // Ongoing cooperation commission
  parliamentaryScrutiny: boolean; // Subject to parliamentary oversight
}

/** Current UK trade deal status */
export interface UKTradeDealStatus {
  euTradeDeal: TradeDealParty | null;
  usaTradeDeal: TradeDealParty | null;
  chinaTradeDeal: TradeDealParty | null;
  indiaTradeDeal: TradeDealParty | null;
  cpTradeDeal: TradeDealParty | null; // Commonwealth partnership
  wtoBaseline: boolean;     // Falling back to WTO terms
}

/** Trade deal economic indicators */
export interface TradeDealEconomics {
  annualTradeValue: number;   // £bn
  exportGrowth: number;       // % year-on-year
  importCostChange: number;   // % change in import costs
  employmentImpact: number;   // Jobs affected (net)
  gdpImpact: number;          // GDP impact (%)
  tradeDeficitChange: number; // Change in trade balance (£bn)
}

/** Trade deal negotiation outcome */
export interface TradeDealOutcome {
  deal: TradeDealParty;
  tariffChanges: Record<string, number>; // % change per product category
  newMarkets: string[];        // New market access details
  regulatoryAlignment: string[]; // Areas of alignment/harmonisation
  disputeResolution: string;   // Mechanism for trade disputes
  reviewClause: string;        // Automatic review trigger
  politicalConditions: string[]; // Any political conditions attached
}

/** UK trade deal scenarios */
export const UK_TRADE_DEAL_SCENARIOS = {
  noDeal: {
    eu: {
      type: 'wto_baseline' as const,
      status: 'expired' as const,
      tariffs: {
        baseRate: 5.0,
        agricultural: 10.0,
        manufacturing: 2.0,
        services: 0.0,
        exceptions: ['food', 'medicine']
      }
    },
    usa: {
      type: 'wto_baseline' as const,
      status: 'expired' as const,
      tariffs: {
        baseRate: 3.5,
        agricultural: 5.0,
        manufacturing: 1.5,
        services: 0.0,
        exceptions: []
      }
    }
  },
  euCustomsUnion: {
    eu: {
      type: 'customs_union' as const,
      status: 'signed' as const,
      effectiveDate: new Date('2024-01-01'),
      tariffs: {
        baseRate: 0.0,
        agricultural: 0.0,
        manufacturing: 0.0,
        services: 0.0,
        exceptions: []
      }
    }
  }
};

/** Default trade deal status for new game */
export const DEFAULT_TRADE_DEAL_STATUS: UKTradeDealStatus = {
  euTradeDeal: {
    partner: 'eu',
    type: 'customs_union',
    status: 'signed',
    signedDate: new Date('2024-01-01'),
    effectiveDate: new Date('2024-01-01'),
    tariffs: {
      baseRate: 0.0,
      agricultural: 0.0,
      manufacturing: 0.0,
      services: 0.0,
      exceptions: []
    },
    sectors: ['all'],
    jointCommission: true,
    parliamentaryScrutiny: true
  },
  usaTradeDeal: {
    partner: 'usa',
    type: 'free_trade',
    status: 'signed',
    signedDate: new Date('2023-11-15'),
    effectiveDate: new Date('2023-12-01'),
    tariffs: {
      baseRate: 0.0,
      agricultural: 0.0,
      manufacturing: 0.0,
      services: 0.0,
      exceptions: []
    },
    sectors: ['all'],
    jointCommission: true,
    parliamentaryScrutiny: true
  },
  chinaTradeDeal: {
    partner: 'china',
    type: 'partial',
    status: 'negotiating',
    tariffs: {
      baseRate: 5.0,
      agricultural: 8.0,
      manufacturing: 2.0,
      services: 3.0,
      exceptions: ['medical_equipment']
    },
    sectors: ['manufacturing', 'services'],
    parliamentaryScrutiny: true
  },
  indiaTradeDeal: {
    partner: 'india',
    type: 'partial',
    status: 'ratified',
    effectiveDate: new Date('2023-06-01'),
    tariffs: {
      baseRate: 3.0,
      agricultural: 6.0,
      manufacturing: 1.5,
      services: 2.0,
      exceptions: ['pharmaceuticals']
    },
    sectors: ['services', 'agriculture'],
    parliamentaryScrutiny: true
  },
  cpTradeDeal: {
    partner: 'commonwealth',
    type: 'free_trade',
    status: 'signed',
    effectiveDate: new Date('2023-03-01'),
    tariffs: {
      baseRate: 0.0,
      agricultural: 0.0,
      manufacturing: 0.0,
      services: 0.0,
      exceptions: ['sensitive_agriculture']
    },
    sectors: ['all'],
    jointCommission: false,
    parliamentaryScrutiny: false
  },
  wtoBaseline: false
};

/** Calculate new trade deal status after diplomatic action */
export function calculateTradeDealChange(
  currentStatus: UKTradeDealStatus,
  diplomaticAction: 'ratify' | 'expand' | 'conclude' | 'suspend' | 'withdraw',
  target: 'eu' | 'usa' | 'china' | 'india' | 'commonwealth'
): UKTradeDealStatus {
  const newStatus = { ...currentStatus };
  
  switch (target) {
    case 'eu':
      if (diplomaticAction === 'ratify' && !newStatus.euTradeDeal) {
        newStatus.euTradeDeal = {
          partner: 'eu',
          type: 'free_trade',
          status: 'signed',
          signedDate: new Date(),
          tariffs: {
            baseRate: 0.0,
            agricultural: 0.0,
            manufacturing: 0.0,
            services: 0.0,
            exceptions: []
          },
          sectors: ['all'],
          parliamentaryScrutiny: true
        };
      } else if (diplomaticAction === 'expand' && newStatus.euTradeDeal) {
        newStatus.euTradeDeal!.type = 'free_trade';
        newStatus.euTradeDeal!.tariffs.baseRate = 0.0;
      } else if (diplomaticAction === 'suspend' && newStatus.euTradeDeal) {
        newStatus.euTradeDeal!.status = 'expired';
        newStatus.euTradeDeal!.tariffs.baseRate = 5.0;
        newStatus.euTradeDeal!.tariffs.agricultural = 10.0;
        newStatus.euTradeDeal!.tariffs.manufacturing = 2.0;
      } else if (diplomaticAction === 'withdraw' && newStatus.euTradeDeal) {
        newStatus.euTradeDeal = null;
        newStatus.wtoBaseline = true;
      }
      break;
      
    case 'usa':
      if (diplomaticAction === 'ratify' && !newStatus.usaTradeDeal) {
        newStatus.usaTradeDeal = {
          partner: 'usa',
          type: 'free_trade',
          status: 'signed',
          signedDate: new Date(),
          tariffs: {
            baseRate: 0.0,
            agricultural: 0.0,
            manufacturing: 0.0,
            services: 0.0,
            exceptions: []
          },
          sectors: ['all'],
          parliamentaryScrutiny: true
        };
      } else if (diplomaticAction === 'conclude' && newStatus.usaTradeDeal) {
        newStatus.usaTradeDeal!.status = 'ratified';
      }
      break;
      
    case 'china':
      if (diplomaticAction === 'ratify' && !newStatus.chinaTradeDeal) {
        newStatus.chinaTradeDeal = {
          partner: 'china',
          type: 'partial',
          status: 'ratified',
          tariffs: {
            baseRate: 2.0,
            agricultural: 4.0,
            manufacturing: 1.0,
            services: 1.0,
            exceptions: ['medical_equipment']
          },
          sectors: ['manufacturing'],
          parliamentaryScrutiny: true
        };
      }
      break;
      
    case 'india':
      if (diplomaticAction === 'ratify' && !newStatus.indiaTradeDeal) {
        newStatus.indiaTradeDeal = {
          partner: 'india',
          type: 'partial',
          status: 'ratified',
          effectiveDate: new Date(),
          tariffs: {
            baseRate: 2.0,
            agricultural: 4.0,
            manufacturing: 1.0,
            services: 1.5,
            exceptions: ['pharmaceuticals']
          },
          sectors: ['services', 'agriculture'],
          parliamentaryScrutiny: true
        };
      }
      break;
      
    case 'commonwealth':
      if (diplomaticAction === 'ratify' && !newStatus.cpTradeDeal) {
        newStatus.cpTradeDeal = {
          partner: 'commonwealth',
          type: 'free_trade',
          status: 'signed',
          effectiveDate: new Date(),
          tariffs: {
            baseRate: 0.0,
            agricultural: 0.0,
            manufacturing: 0.0,
            services: 0.0,
            exceptions: ['sensitive_agriculture']
          },
          sectors: ['all'],
          parliamentaryScrutiny: false
        };
      }
      break;
  }
  
  return newStatus;
}

/** Calculate trade deal economic impact */
export function calculateTradeDealEconomics(
  dealStatus: UKTradeDealStatus
): TradeDealEconomics {
  const euImpact = dealStatus.euTradeDeal 
    ? { annualTradeValue: 150, exportGrowth: 8, importCostChange: -3, employmentImpact: 5, gdpImpact: 1.5, tradeDeficitChange: -5 }
    : { annualTradeValue: 95, exportGrowth: 3, importCostChange: 5, employmentImpact: -8, gdpImpact: -0.8, tradeDeficitChange: 8 };
  
  const usaImpact = dealStatus.usaTradeDeal
    ? { annualTradeValue: 75, exportGrowth: 6, importCostChange: -2, employmentImpact: 3, gdpImpact: 1.0, tradeDeficitChange: -3 }
    : { annualTradeValue: 45, exportGrowth: 1, importCostChange: 8, employmentImpact: -5, gdpImpact: -0.3, tradeDeficitChange: 4 };
  
  const chinaImpact = dealStatus.chinaTradeDeal
    ? { annualTradeValue: 60, exportGrowth: 5, importCostChange: 2, employmentImpact: -2, gdpImpact: 0.5, tradeDeficitChange: 3 }
    : { annualTradeValue: 35, exportGrowth: 1, importCostChange: 6, employmentImpact: -4, gdpImpact: -0.2, tradeDeficitChange: 2 };
  
  const indiaImpact = dealStatus.indiaTradeDeal
    ? { annualTradeValue: 25, exportGrowth: 4, importCostChange: -1, employmentImpact: 2, gdpImpact: 0.3, tradeDeficitChange: -1 }
    : { annualTradeValue: 15, exportGrowth: 1, importCostChange: 3, employmentImpact: -2, gdpImpact: -0.1, tradeDeficitChange: 1 };
  
  const cpImpact = dealStatus.cpTradeDeal
    ? { annualTradeValue: 15, exportGrowth: 3, importCostChange: -1, employmentImpact: 1, gdpImpact: 0.2, tradeDeficitChange: -0.5 }
    : { annualTradeValue: 8, exportGrowth: 0, importCostChange: 4, employmentImpact: -1, gdpImpact: -0.05, tradeDeficitChange: 0.5 };
  
  let totalAnnualTrade = 0;
  let totalExportGrowth = 0;
  let totalImportCostChange = 0;
  let totalEmploymentImpact = 0;
  let totalGdpImpact = 0;
  let totalTradeDeficitChange = 0;
  
  if (dealStatus.euTradeDeal) {
    totalAnnualTrade += euImpact.annualTradeValue;
    totalExportGrowth += euImpact.exportGrowth;
    totalImportCostChange += euImpact.importCostChange;
    totalEmploymentImpact += euImpact.employmentImpact;
    totalGdpImpact += euImpact.gdpImpact;
    totalTradeDeficitChange += euImpact.tradeDeficitChange;
  }
  if (dealStatus.usaTradeDeal) {
    totalAnnualTrade += usaImpact.annualTradeValue;
    totalExportGrowth += usaImpact.exportGrowth;
    totalImportCostChange += usaImpact.importCostChange;
    totalEmploymentImpact += usaImpact.employmentImpact;
    totalGdpImpact += usaImpact.gdpImpact;
    totalTradeDeficitChange += usaImpact.tradeDeficitChange;
  }
  if (dealStatus.chinaTradeDeal) {
    totalAnnualTrade += chinaImpact.annualTradeValue;
    totalExportGrowth += chinaImpact.exportGrowth;
    totalImportCostChange += chinaImpact.importCostChange;
    totalEmploymentImpact += chinaImpact.employmentImpact;
    totalGdpImpact += chinaImpact.gdpImpact;
    totalTradeDeficitChange += chinaImpact.tradeDeficitChange;
  }
  if (dealStatus.indiaTradeDeal) {
    totalAnnualTrade += indiaImpact.annualTradeValue;
    totalExportGrowth += indiaImpact.exportGrowth;
    totalImportCostChange += indiaImpact.importCostChange;
    totalEmploymentImpact += indiaImpact.employmentImpact;
    totalGdpImpact += indiaImpact.gdpImpact;
    totalTradeDeficitChange += indiaImpact.tradeDeficitChange;
  }
  if (dealStatus.cpTradeDeal) {
    totalAnnualTrade += cpImpact.annualTradeValue;
    totalExportGrowth += cpImpact.exportGrowth;
    totalImportCostChange += cpImpact.importCostChange;
    totalEmploymentImpact += cpImpact.employmentImpact;
    totalGdpImpact += cpImpact.gdpImpact;
    totalTradeDeficitChange += cpImpact.tradeDeficitChange;
  }
  
  return {
    annualTradeValue: totalAnnualTrade,
    exportGrowth: Math.round(totalExportGrowth),
    importCostChange: Math.round(totalImportCostChange),
    employmentImpact: totalEmploymentImpact,
    gdpImpact: Math.round(totalGdpImpact * 10) / 10,
    tradeDeficitChange: Math.round(totalTradeDeficitChange)
  };
}
