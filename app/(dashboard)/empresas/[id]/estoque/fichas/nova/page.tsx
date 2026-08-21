'use client'

// ESTOQUE FASE 2 item 2.0 — nova ficha técnica.

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FichaEditor } from '@/components/estoque/ficha-editor'

export default function NovaFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/fichas`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pras fichas</a>
      <h1 className="text-xl font-semibold text-slate-900">Nova ficha técnica</h1>
      <FichaEditor companyId={id} />
    </div>
  )
}
