const GITHUB_URL = 'https://github.com/tanmay-alpha/indian-algo-trading-platform'

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center">
      <div className="font-mono text-[11px] text-text-hint">
        MAET Terminal · Paper-mode workspace · No financial advice ·{' '}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          GitHub
        </a>
      </div>
    </footer>
  )
}
