import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MAET Terminal - Institutional Trading Platform',
  description: 'Professional algorithmic trading terminal for Indian equity markets',
}

export const viewport: Viewport = {
  themeColor: '#0b0e14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased overflow-hidden">{children}</body>
    </html>
  )
}
