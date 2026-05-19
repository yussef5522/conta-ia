// Layout do painel admin (admin.caixaos.com.br) — Sprint 1.6 (dark premium).
// robots noindex/nofollow + nginx serve robots.txt embutido.
// Sprint 1.3 deixou versão light; Sprint 1.6 substituiu por dark vibe Linear.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Painel administrativo restrito.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#0a0a0a',
        color: '#e5e5e5',
        colorScheme: 'dark',
      }}
    >
      {children}
    </div>
  )
}
