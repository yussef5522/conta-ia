// Layout do grupo (auth) — Sprint 1.2.
// Sprint Perf P3 (31/05/2026): inclui <Toaster /> aqui — login, cadastro
// e esqueci-senha disparam toast; landing (/) não precisa.

import { Toaster } from '@/components/ui/toaster'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <Toaster />
    </div>
  )
}
