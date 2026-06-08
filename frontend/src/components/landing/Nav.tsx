import Link from 'next/link'

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-base/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-mono text-sm font-semibold text-primary" aria-label="MAET home">
          MAET
        </Link>
        <Link
          href="/terminal"
          className="inline-flex h-8 items-center justify-center rounded-sm bg-accent px-3 font-sans text-[13px] font-medium text-white transition-colors hover:bg-[#2563EB] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base"
        >
          Open terminal
        </Link>
      </div>
    </header>
  )
}
