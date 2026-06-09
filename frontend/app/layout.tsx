import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/ui-maet/toast'
import { SebiWarningBanner } from '@/components/ui-maet/sebi-warning-banner'
import { ErrorBoundary } from '@/components/effects/error-boundary'
import './globals.css'

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-sans',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'MAET Terminal OS',
  description: 'Safety-first market analytics for Indian markets.',
  icons: {
    icon: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0d12',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${mono.variable} ${sans.variable}`}
    >
      <body className="bg-base text-text-primary antialiased">
        <ToastProvider>
          <SebiWarningBanner />
          <ErrorBoundary boundaryName="Application shell">
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  )
}
