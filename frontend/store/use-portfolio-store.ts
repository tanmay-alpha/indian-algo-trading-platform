import { useTerminalStore } from './terminal-store-core'
import type { TerminalStore } from './terminal-store-core'

export type PortfolioStore = Pick<
  TerminalStore,
  | 'portfolio'
  | 'portfolioSummary'
  | 'positions'
  | 'holdings'
  | 'equityCurve'
  | 'reconciliationStatus'
  | 'portfolioLoading'
  | 'portfolioError'
  | 'portfolioLastUpdated'
  | 'setPortfolio'
  | 'fetchPortfolioSummary'
  | 'fetchPositions'
  | 'fetchHoldings'
  | 'fetchEquityCurve'
  | 'fetchReconciliationStatus'
  | 'refreshPortfolio'
>

export function usePortfolioStore<T>(selector: (state: PortfolioStore) => T): T {
  return useTerminalStore(selector as (state: TerminalStore) => T)
}
