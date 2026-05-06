import type { Metadata } from 'next'
import { AceitarConviteClient } from './aceitar-convite-client'

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = { title: 'Aceitar Convite' }

export default async function AceitarConvitePage({ searchParams }: PageProps) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">⚠️ Token ausente</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de convite está incompleto. Peça um novo ao administrador.
          </p>
        </div>
      </div>
    )
  }

  return <AceitarConviteClient token={token} />
}
