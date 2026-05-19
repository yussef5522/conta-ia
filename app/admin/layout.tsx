// Layout do painel admin (admin.caixaos.com.br) — Sprint 1.3.
// robots noindex/nofollow garante que Google NUNCA indexe este host.
// nginx também serve um robots.txt embutido como defesa em profundidade.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CAIXAOS Admin',
  description: 'Painel gerenciador interno.',
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
  return <div className="min-h-screen bg-white">{children}</div>
}
