'use client'

// ESTOQUE — editar RECEITA DE PRODUÇÃO. Mesmo editor do cardápio (REGRA 4); aqui o "voltar"
// aponta pra cozinha. Salvar cria versão nova se o corpo mudou (ordens antigas preservadas).

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FichaEditor } from '@/components/estoque/ficha-editor'
import { ExcluirReceita } from '@/components/estoque/excluir-receita'

export default function EditarReceitaProducaoPage({ params }: { params: Promise<{ id: string; fichaId: string }> }) {
  const { id, fichaId } = use(params)
  const voltar = `/empresas/${id}/estoque/producao/receitas`
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <a href={voltar} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Receitas de produção</a>
      <h1 className="text-base font-semibold text-slate-900">Editar receita de produção</h1>
      <FichaEditor companyId={id} fichaId={fichaId} tipoTravado="INTERMEDIARIO" voltarPara={voltar} />

      {/*
        ⭐⭐ EXCLUIR, no PÉ da tela onde o dono trabalhou (16/09) — e **fora do card do
        editor**, separado por uma linha: gesto destrutivo não fica ao lado do "salvar",
        onde o dedo erra. ⛔ Mas fica **À VISTA** (borda e cor, nunca só-hover), porque
        *"ação escondida sem afordância não existe, principalmente no celular"* (30/08).
      */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        <p className="flex-1 text-[12px] text-slate-500">
          Não vai mais usar esta receita? Se ela nunca produziu um lote, sai de vez; se tem
          história, ela é desativada e os lotes antigos ficam.
        </p>
        <ExcluirReceita empresaId={id} fichaId={fichaId}
          aoConcluir={() => { window.location.href = voltar }} />
      </div>
    </div>
  )
}
