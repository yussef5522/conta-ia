'use client'
// ⭐ R36/R40 — NUNCA CONTADOS: os candidatos a grupo A (itens que giram e nunca foram contados),
// maior giro primeiro. A decisão é do DONO: aceitar → vira A · ignorar → sai da fila.
import { use, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import type { Posto } from '@/lib/stock/contagem/direcao-dados'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function CandidatosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { pode } = usePermissoes(id)
  const [p, setP] = useState<Posto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<Record<string, 'A' | 'ignorado'>>({})
  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/contagem/posto`).then((r) => r.json()).then((j) => setP(j.posto ?? null)).catch(() => setErro('A rede falhou ao carregar.'))
  }, [id])
  async function decidir(itemId: string, grupo: 'A' | null) {
    setErro(null)
    const r = await fetch(`/api/empresas/${id}/estoque/contagem/grupo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, grupo }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.erro ?? 'O sistema falhou e não devolveu o motivo — isso é defeito nosso, não seu.'); return }
    setFeito((f) => ({ ...f, [itemId]: grupo ? 'A' : 'ignorado' }))
  }
  if (!p) return <div className="p-6">{erro ?? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--prod-muted)' }} />}</div>
  const c = p.nuncaContados.candidatos
  return (
    <div className="space-y-3 pb-8" data-testid="candidatos">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-[21px] font-extrabold" style={{ color: 'var(--prod-primary)' }}>Nunca contados</h1>
        <a href={`/empresas/${id}/estoque/contagem`} className="ml-auto text-xs font-extrabold" style={{ color: 'var(--fam-indigo-ink)' }}>← contagem</a>
      </div>
      <p className="text-xs" style={{ color: 'var(--prod-muted)' }}>
        {p.nuncaContados.total} itens nunca foram contados. Estes {c.length} giram (venderam ou saíram nos últimos 30 dias) —
        são candidatos a grupo A. Aceitar põe o item na contagem de todo dia; ignorar tira da fila (ele continua em “contar tudo”).
      </p>
      {erro && <p className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>{erro}</p>}
      <div className="rounded-[12px] border" style={{ borderColor: 'var(--prod-line-strong)' }}>
        {c.length === 0 && <p className="p-4 text-sm" style={{ color: 'var(--prod-muted)' }}>Nenhum candidato agora ✓</p>}
        {c.map((x) => (
          <div key={x.itemId} className="flex flex-wrap items-center gap-2.5 border-b px-3 py-2.5 last:border-b-0" style={{ borderColor: 'var(--prod-line)' }}>
            <span className="flex-1 text-[13px] font-bold" style={{ color: 'var(--prod-primary)' }}>{x.nome}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--prod-secondary)' }}>{brl(x.giro30)} / 30 dias</span>
            {feito[x.itemId]
              ? <span className="text-xs font-extrabold" style={{ color: feito[x.itemId] === 'A' ? 'var(--fam-verde-ink)' : 'var(--prod-muted)' }}>{feito[x.itemId] === 'A' ? 'virou A ✓' : 'ignorado'}</span>
              : pode('stock.manage') && (
                <>
                  <button onClick={() => decidir(x.itemId, 'A')} className="h-8 rounded-lg px-3 text-xs font-extrabold" style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>aceitar → A</button>
                  <button onClick={() => decidir(x.itemId, null)} className="h-8 rounded-lg border px-3 text-xs font-bold" style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>ignorar</button>
                </>
              )}
          </div>
        ))}
      </div>
    </div>
  )
}
