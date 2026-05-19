// Placeholder do dashboard admin — Sprint 1.3.
// Sprint 1.6 vai implementar:
//   - Login Gerenciador (tabela separada)
//   - Dashboard MRR, contagens, clientes ativos
//   - CRUD de cupons (Sprint 1.7)

import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/logo'

export default function AdminHome() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-[420px] space-y-7">
        <Logo size="md" />

        <div className="space-y-2">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: 24, color: '#0C447C' }}
          >
            CAIXAOS Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Painel gerenciador interno.
          </p>
        </div>

        <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Em desenvolvimento
              </p>
              <p className="text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                Login Gerenciador e dashboard (MRR, métricas, cupons) chegam
                no <strong>Sprint 1.6</strong>. Esta página é um placeholder
                pra confirmar que o subdomínio <code>admin.caixaos.com.br</code>{' '}
                está roteando corretamente.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/admin/login"
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: '#185FA5' }}
        >
          Ir pro placeholder de login admin
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
