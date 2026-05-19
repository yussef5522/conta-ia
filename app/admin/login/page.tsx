// Login admin — Sprint 1.6.
// Vibe Linear/Vercel: minimalista, dark, sem brand chamativo.

import type { Metadata } from 'next'
import { AdminLoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[340px] space-y-7">
        {/* Brand discreto — apenas "ADMIN" mono */}
        <div className="text-center">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.3em]"
            style={{ color: '#737373' }}
          >
            CAIXAOS
          </p>
          <h1
            className="font-mono mt-1 text-xs uppercase tracking-[0.3em]"
            style={{ color: '#525252' }}
          >
            admin
          </h1>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  )
}
