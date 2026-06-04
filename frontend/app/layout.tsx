import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { SafetyStrip } from '@/components/layout/safety-strip'
import { ToastProvider } from '@/components/ui-maet/toast'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
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
  themeColor: '#05070B',
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
      className={`${inter.variable} ${jetbrains.variable} bg-maet-base`}
    >
      <body className="bg-maet-base text-maet-text antialiased">
        <ToastProvider>
          <SafetyStrip />
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
