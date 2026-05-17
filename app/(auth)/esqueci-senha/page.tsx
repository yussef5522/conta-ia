// Placeholder — Sprint 1.5 vai implementar reset via email + código 6 dígitos.
// Sprint 1.2 só cria a página com mensagem amigável e link de volta.

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Esqueci minha senha | Conta IA',
}

export default function EsqueciSenhaPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-white">
      <div className="w-full max-w-[400px] space-y-6">
        <Logo size="md" />

        <div className="space-y-2">
          <h1
            className="font-medium tracking-tight"
            style={{ fontSize: 22, color: '#0C447C' }}
          >
            Esqueci minha senha
          </h1>
          <p className="text-sm text-muted-foreground">
            Em breve você poderá redefinir sua senha por aqui.
          </p>
        </div>

        <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 mt-0.5 text-blue-700 dark:text-blue-300 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Função em desenvolvimento
              </p>
              <p className="text-blue-800/80 dark:text-blue-200/80">
                A redefinição de senha por e-mail + código de 6 dígitos chega
                no <strong>Sprint 1.5</strong>. Por enquanto, se você esqueceu
                sua senha, entre em contato pelo suporte.
              </p>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao login
          </Link>
        </Button>
      </div>
    </div>
  )
}
