'use client'

// ESTOQUE FASE 1 item 2 — PREVIEW (modo teste) da conferência. Casca fina: busca a nota
// ilustrativa e renderiza o ConferenciaView (o mesmo da nota real). Serve pra treinar.

import { useEffect, useState, use } from 'react'
import { Loader2 } from 'lucide-react'
import { ConferenciaView, type ConferenciaData, type ItemExistente } from '@/components/estoque/conferencia-view'

export default function ConferenciaPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ preview: ConferenciaData; itensExistentes: ItemExistente[] } | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/recebimentos/preview`).then((r) => r.json())
      .then((j) => setData(j.preview ? { preview: { ...j.preview, modoTeste: true }, itensExistentes: j.itensExistentes } : null))
      .catch(() => setData(null))
  }, [id])

  if (data === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!data) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o preview.</div>
  return <ConferenciaView data={data.preview} itensExistentes={data.itensExistentes} />
}
