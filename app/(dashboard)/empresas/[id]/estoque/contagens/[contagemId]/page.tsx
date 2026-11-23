'use client'
// ⭐ R42 — o recibo da sessão (o histórico de sessões aponta pra cá).
import { use, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ReciboDaSessao } from '@/components/estoque/contagem/recibo-da-sessao'
import type { Recibo } from '@/lib/stock/contagem/direcao-dados'

export default function ReciboPage({ params }: { params: Promise<{ id: string; contagemId: string }> }) {
  const { id, contagemId } = use(params)
  const [r, setR] = useState<Recibo | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/contagem/recibo?contagemId=${contagemId}`)
      .then(async (x) => { const j = await x.json().catch(() => ({})); if (!x.ok) { setErro(j.erro ?? 'O sistema falhou ao montar o recibo — isso é defeito nosso.'); setR(null) } else setR(j.recibo) })
      .catch(() => { setErro('A rede falhou ao buscar o recibo — tente de novo.'); setR(null) })
  }, [id, contagemId])
  return (
    <div className="space-y-3 pb-8">
      <div className="flex items-center gap-4 text-xs font-extrabold">
        <a href={`/empresas/${id}/estoque/contagem`} style={{ color: 'var(--fam-indigo-ink)' }}>← contagem</a>
        <a href={`/empresas/${id}/estoque/contagens`} style={{ color: 'var(--fam-indigo-ink)' }}>Sessões →</a>
      </div>
      {r === undefined && <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--prod-muted)' }} />}
      {erro && <p className="text-sm" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>}
      {r && <ReciboDaSessao r={r} empresaId={id} />}
    </div>
  )
}
