import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

// Sprint Landing v3.2 (31/05/2026): voltou a Inter como ÚNICA família.
// Instrument Serif (editorial) ficou "desenhada demais" pro feedback do
// Yussef — preferiu vibe SaaS tech limpa estilo Conta Azul. Mantemos
// var --font-display pra não quebrar referências, mas aponta pra Inter.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Sprint Brand CAIXAOS (29/05/2026): título/metadata/favicon trocados pra
// nova identidade. theme-color violet-600 (#7c3aed) bate com logo.
export const metadata: Metadata = {
  title: {
    default: 'CAIXAOS',
    template: '%s | CAIXAOS',
  },
  description: 'Sistema operacional do seu caixa. Gestão financeira com IA pra PMEs brasileiras.',
  // Sprint 4.0.5.c — PWA
  manifest: '/manifest.json',
  applicationName: 'CAIXAOS',
  appleWebApp: {
    capable: true,
    title: 'CAIXAOS',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

// Sprint 4.0.5.c — viewport mobile-friendly
// Sprint Brand CAIXAOS — themeColor agora bate com logo violet-600
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#7c3aed',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
