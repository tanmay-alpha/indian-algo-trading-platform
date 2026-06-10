import Link from 'next/link'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function Nav() {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border bg-base">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm font-medium text-text-primary" aria-label="MAET home">
          <span>MAET</span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/terminal"
            className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            Open terminal
          </Link>
        </div>
      </div>
    </header>
  )
}
