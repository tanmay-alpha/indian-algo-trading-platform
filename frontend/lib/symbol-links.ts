/**
 * Normalizes exchange symbol and creates links for TradingView and Angel One
 */

export function normalizeExchangeSymbol(symbol: string, exchange?: string): { symbol: string; exchange: string } {
  if (!symbol) return { symbol: '', exchange: 'NSE' }
  
  let cleanSymbol = symbol.trim().toUpperCase()
  let cleanExchange = (exchange || 'NSE').trim().toUpperCase()

  // Remove exchange prefix if it is embedded (e.g. "NSE:SBIN" or "SBIN-EQ" or "SBIN-NSE")
  if (cleanSymbol.includes(':')) {
    const parts = cleanSymbol.split(':')
    cleanExchange = parts[0]
    cleanSymbol = parts[1]
  }

  // Strip common suffixes
  if (cleanSymbol.endsWith('-EQ')) {
    cleanSymbol = cleanSymbol.slice(0, -3)
  }

  return { symbol: cleanSymbol, exchange: cleanExchange }
}

export function toTradingViewSymbol(symbol: string, exchange?: string): string {
  const norm = normalizeExchangeSymbol(symbol, exchange)
  if (!norm.symbol) return ''

  const s = norm.symbol
  // Special index mapping
  if (s === 'NIFTY' || s === 'NIFTY 50' || s === 'NIFTY_50' || s === 'NIFTY50') {
    return 'NSE:NIFTY'
  }
  if (s === 'BANKNIFTY' || s === 'NIFTY BANK' || s === 'NIFTY_BANK' || s === 'NIFTYBANK') {
    return 'NSE:BANKNIFTY'
  }
  if (s === 'SENSEX' || s === 'BSE SENSEX' || s === 'BSE_SENSEX') {
    return 'BSE:SENSEX'
  }

  // Default to NSE unless specified BSE
  const ex = norm.exchange === 'BSE' ? 'BSE' : 'NSE'
  return `${ex}:${s}`
}

export function getTradingViewChartUrl(symbol: string, exchange?: string): string {
  const tvSymbol = toTradingViewSymbol(symbol, exchange)
  if (!tvSymbol) return '#'
  return `https://in.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`
}

export function getAngelOneChartUrl(symbol: string, exchange?: string): string {
  void symbol
  void exchange

  // Safe fallback to Angel One trading chart
  return 'https://www.angelone.in/trade/watchlist/chart'
}
