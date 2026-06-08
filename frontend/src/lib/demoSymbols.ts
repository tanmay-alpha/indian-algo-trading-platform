export const DEMO_SYMBOLS = [
  { sym: 'RELIANCE', name: 'Reliance Industries', price: 2847.50, chg: 1.24, open: 2811.00, high: 2861.80, low: 2796.40, vol: 4821903 },
  { sym: 'SBIN', name: 'State Bank of India', price: 792.30, chg: 0.68, open: 786.50, high: 797.10, low: 783.20, vol: 9143220 },
  { sym: 'HDFCBANK', name: 'HDFC Bank', price: 1641.75, chg: -0.33, open: 1647.00, high: 1655.00, low: 1634.00, vol: 3287540 },
  { sym: 'INFY', name: 'Infosys', price: 1538.45, chg: 2.11, open: 1509.00, high: 1548.00, low: 1504.00, vol: 2941850 },
  { sym: 'TCS', name: 'Tata Consultancy', price: 3421.00, chg: -0.78, open: 3447.00, high: 3458.00, low: 3404.00, vol: 1204730 },
  { sym: 'WIPRO', name: 'Wipro Ltd', price: 488.60, chg: 0.44, open: 485.00, high: 492.00, low: 483.50, vol: 5632100 },
  { sym: 'ICICIBANK', name: 'ICICI Bank', price: 1298.40, chg: 1.05, open: 1283.00, high: 1304.00, low: 1278.00, vol: 4102880 },
  { sym: 'NIFTY50', name: 'Nifty 50 Index', price: 23847.60, chg: 0.42, open: 23746.00, high: 23920.00, low: 23710.00, vol: 0 },
] as const

export type DemoSymbol = typeof DEMO_SYMBOLS[number]

export function formatINR(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
