'use client'

// ESTOQUE FASE 2 item 2.0 — editar ficha técnica (salvar cria versão nova se mudou o corpo).

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FichaEditor } from '@/components/estoque/ficha-editor'
import { destinoDeVolta } from '@/lib/stock/producao/voltar-ficha'

// ⚠️ respeita `?voltar=` pela mesma razão da página `nova`: quem abriu a ficha sabe pra
// onde a pessoa volta; a tela não adivinha.
export default function EditarFichaPage({ params }: { params: Promise<{ id: string; fichaId: string }> }) {
  const { id, fichaId } = use(params)
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const voltar = destinoDeVolta(id, { voltar: qp?.get('voltar'), complemento: qp?.get('complemento') })
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={voltar} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar</a>
      <h1 className="text-xl font-semibold text-slate-900">Editar ficha técnica</h1>
      <FichaEditor companyId={id} fichaId={fichaId} voltarPara={voltar} />
    </div>
  )
}
