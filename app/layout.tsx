import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Conta IA',
    template: '%s | Conta IA',
  },
  description: 'Seu contador inteligente que nunca dorme. Gestão financeira para empresas brasileiras.',
  // Sprint 4.0.5.c — PWA
  manifest: '/manifest.json',
  applicationName: 'Conta IA',
  appleWebApp: {
    capable: true,
    title: 'Conta IA',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

// Sprint 4.0.5.c — viewport mobile-friendly
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#6366F1', // indigo-500 (brand 4.0.5.a)
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
