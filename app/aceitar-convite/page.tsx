// Aceitar convite — Sprint 1.4.
// Página pública (whitelist em proxy.ts). Token vem na query string.

import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AceitarConviteClient } from './aceitar-convite-client'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = { title: 'Aceitar Convite' }

export default async function AceitarConvitePage({ searchParams }: PageProps) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[440px] space-y-6">
          <Logo size="md" />

          <Card className="p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950 mb-3">
              <AlertCircle className="h-5 w-5 text-rose-700 dark:text-rose-300" />
            </div>
            <h1
              className="font-medium tracking-tight"
              style={{ fontSize: 20, color: '#0C447C' }}
            >
              Link de convite incompleto
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Faltou o token de validação. Peça um novo convite ao
              administrador da empresa.
            </p>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao login
              </Link>
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return <AceitarConviteClient token={token} />
}
