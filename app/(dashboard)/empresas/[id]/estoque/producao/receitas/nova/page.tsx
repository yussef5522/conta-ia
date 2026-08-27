'use client'

// ESTOQUE — nova RECEITA DE PRODUÇÃO (mundo da cozinha). Editor ÚNICO (REGRA 4), aberto com
// o tipo TRAVADO em INTERMEDIARIO: produto que se VENDE se monta no Cardápio, não aqui.

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FichaEditor } from '@/components/estoque/ficha-editor'

export default function NovaReceitaProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const voltar = `/empresas/${id}/estoque/producao/receitas`
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <a href={voltar} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Receitas de produção</a>
      <div>
        <h1 className="text-base font-semibold text-slate-900">Nova receita de produção</h1>
        <p className="text-xs text-slate-400">O que a cozinha faz em lote e vira estoque (gessado, beef, porção)</p>
      </div>
      <FichaEditor companyId={id} tipoTravado="INTERMEDIARIO" voltarPara={voltar} />
    </div>
  )
}
