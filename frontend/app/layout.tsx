import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/ui-maet/toast'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-ui',
})

const jetbrains = JetBrains_Mono({
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
      className={`${dmSans.variable} ${jetbrains.variable} bg-base`}
    >
      <body className="bg-base text-primary antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
