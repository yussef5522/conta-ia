'use client'

// Sprint Unificar Sócios — página legacy, usa NovaPonteForm extraído.
// O redirect 301 do next.config redireciona /pontes → /socios, mas
// /pontes/nova mantemos como fallback caso usuário acesse direto.

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { NovaPonteForm } from '@/components/bridges/NovaPonteForm'

export default function NovaPontePage() {
  const { id } = useParams<{ id: string }>()
  const empresaId = id

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 space-y-6">
      <div>
        <Link
          href={`/empresas/${empresaId}/socios`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Voltar pra Sócios
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Nova ponte PJ → PF
        </h1>
        <p className="text-sm text-slate-600">
          Conecta uma saída da empresa com a entrada no perfil pessoal
        </p>
      </div>
      <NovaPonteForm empresaId={empresaId} />
    </main>
  )
}
