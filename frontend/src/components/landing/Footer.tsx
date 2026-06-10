import { ProductRiskFooter } from '@/components/compliance/ProductRiskFooter'

const GITHUB_URL = 'https://github.com/tanmay-alpha/indian-algo-trading-platform'

export function Footer() {
  return (
    <footer className="border-t border-border text-center">
      <div className="px-6 py-5 font-mono text-[11px] text-text-hint">
        MAET Terminal | Paper-mode research workspace |{' '}
        <a href="/docs" className="text-accent hover:underline">
          User docs
        </a>{' '}
        |{' '}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          GitHub
        </a>
      </div>
      <ProductRiskFooter />
    </footer>
  )
}
