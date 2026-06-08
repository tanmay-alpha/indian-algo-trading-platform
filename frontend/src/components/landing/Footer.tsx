const GITHUB_URL = 'https://github.com/tanmay-alpha/indian-algo-trading-platform'

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl font-mono text-[11px] text-muted">
        MAET Terminal · Paper-mode research workspace · No financial advice ·{' '}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-4 hover:underline"
        >
          GitHub
        </a>
      </div>
    </footer>
  )
}
