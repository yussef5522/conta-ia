// Placeholder do login admin — Sprint 1.3.
// Sprint 1.6 vai implementar form real conectado à tabela Gerenciador.

import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export default function AdminLoginPlaceholder() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-[400px] space-y-7">
        <Logo size="md" />

        <div className="space-y-2">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: 22, color: '#0C447C' }}
          >
            Acesso restrito
          </h1>
          <p className="text-sm text-muted-foreground">
            Login Gerenciador em desenvolvimento.
          </p>
        </div>

        <div className="rounded-md border bg-slate-50 dark:bg-slate-900/30 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 mt-0.5 text-slate-700 dark:text-slate-300 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                Sprint 1.6 — Login Gerenciador
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Tabela <code>Gerenciador</code> separada do <code>users</code>{' '}
                do app (isolamento por construção). Cookie diferente
                (<code>admin_session</code>) com <code>Domain</code> próprio.
                Login via email + senha + 2FA opcional (TODO Sprint 2).
              </p>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" className="w-full">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </div>
    </div>
  )
}
