const GITHUB_URL = 'https://github.com/tanmay-alpha/indian-algo-trading-platform'

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-5 text-center font-mono text-[11px] text-text-hint">
      MAET Terminal | Paper-mode research workspace | Not SEBI registered | No financial advice |{' '}
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
    </footer>
  )
}
