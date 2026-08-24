'use client'

// ESTOQUE FASE 1 item 2 — conferência da NOTA REAL (aberta pelo card da fila). Read-only:
// vê os itens, mapeia, testa divergência — mas NÃO grava (o CONFIRMAR liga depois que o
// dono aprovar o fluxo no celular E no notebook). Casca fina do ConferenciaView.

import { useEffect, useState, use } from 'react'
import { Loader2, ArrowLeft } from 'lucide-react'
import { ConferenciaView, type ConferenciaData, type ItemExistente } from '@/components/estoque/conferencia-view'

export default function ConferenciaRealPage({ params }: { params: Promise<{ id: string; nfeId: string }> }) {
  const { id, nfeId } = use(params)
  const [data, setData] = useState<{ conference: ConferenciaData; itensExistentes: ItemExistente[]; podeEnviarBoletos?: boolean } | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/recebimentos/${nfeId}`).then((r) => r.json())
      .then((j) => setData(j.conference ? { conference: j.conference, itensExistentes: j.itensExistentes } : null))
      .catch(() => setData(null))
  }, [id, nfeId])

  if (data === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!data) return <div className="p-6 text-sm text-slate-500">Nota não encontrada.</div>
  return (
    <div className="space-y-2">
      {/* passe de densidade: o link era `mx-auto max-w-md` — ficava boiando no
       * meio da tela agora que a conferência é largura total */}
      <a href={`/empresas/${id}/estoque/recebimentos`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra fila</a>
      <ConferenciaView data={{ ...data.conference, podeEnviarBoletos: data.podeEnviarBoletos }} itensExistentes={data.itensExistentes} companyId={id} nfeId={nfeId} podeConfirmar />
    </div>
  )
}
