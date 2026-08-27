'use client'

// ESTOQUE — editar RECEITA DE PRODUÇÃO. Mesmo editor do cardápio (REGRA 4); aqui o "voltar"
// aponta pra cozinha. Salvar cria versão nova se o corpo mudou (ordens antigas preservadas).

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FichaEditor } from '@/components/estoque/ficha-editor'

export default function EditarReceitaProducaoPage({ params }: { params: Promise<{ id: string; fichaId: string }> }) {
  const { id, fichaId } = use(params)
  const voltar = `/empresas/${id}/estoque/producao/receitas`
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <a href={voltar} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Receitas de produção</a>
      <h1 className="text-base font-semibold text-slate-900">Editar receita de produção</h1>
      <FichaEditor companyId={id} fichaId={fichaId} tipoTravado="INTERMEDIARIO" voltarPara={voltar} />
    </div>
  )
}
