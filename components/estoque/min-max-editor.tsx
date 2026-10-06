'use client'

// ESTOQUE FASE 1 item 3 — definir mín/máx do item (na ficha). Salva via PATCH; valida
// mín < máx no servidor. Mostra a barra de status atual. Simples: dois campos + salvar.
//
// ⭐ v4 (06/10/2026): roupa por TOKEN (os dois temas de graça) + a SUGESTÃO de mínimo, que
// **sugere e nunca grava** — ordem do dono: *"o campo é meu"*.

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Gauge, Loader2, Check, Lightbulb } from 'lucide-react'
import { StatusBar, StatusDot } from '@/components/estoque/status-bar'
import type { StatusEstoqueResult } from '@/lib/stock/status-estoque'
import type { MinimoSugerido } from '@/lib/stock/item/consumo-e-cobertura'

const parseNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const n3 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function MinMaxEditor({
  companyId, itemId, unidade, estoqueMin, estoqueMax, status, sugestao, onSalvo,
}: {
  companyId: string; itemId: string; unidade: string
  estoqueMin: number | null; estoqueMax: number | null; status: StatusEstoqueResult
  /** ⭐ a sugestão calculada; `minimo: null` = sem dado suficiente, e aí nada aparece */
  sugestao?: MinimoSugerido
  onSalvo: (min: number | null, max: number | null) => void
}) {
  const [min, setMin] = useState(estoqueMin != null ? String(estoqueMin) : '')
  const [max, setMax] = useState(estoqueMax != null ? String(estoqueMax) : '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const salvar = async () => {
    setErro(null); setOk(false)
    const mn = parseNum(min), mx = parseNum(max)
    if (mn != null && mx != null && mn >= mx) { setErro('O mínimo tem que ser menor que o máximo.'); return }
    setSalvando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estoqueMin: mn, estoqueMax: mx }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar.'); return }
      onSalvo(mn, mx); setOk(true); setTimeout(() => setOk(false), 2000)
    } catch { setErro('Falha de conexão.') } finally { setSalvando(false) }
  }

  const campo = 'mt-1 block w-28 rounded-lg py-2 px-3 text-sm tabular-nums'
  const estiloCampo = { border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }

  return (
    <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}><CardContent className="p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}><Gauge className="h-4 w-4" /> Faixa de estoque (mín / máx)</p>
      <div className="mb-3"><StatusBar status={status} /><div className="mt-1.5"><StatusDot status={status} /></div></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs" style={{ color: 'var(--prod-muted)' }}>Mínimo ({unidade})
          <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="—" className={campo} style={estiloCampo} />
        </label>
        <label className="text-xs" style={{ color: 'var(--prod-muted)' }}>Máximo ({unidade})
          <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="opcional" className={campo} style={estiloCampo} />
        </label>
        <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null}{ok ? 'Salvo' : 'Salvar'}
        </button>
      </div>

      {/*
        ⭐⭐ A SUGESTÃO DE MÍNIMO — a conta clássica do setor, com a CONTA ESCRITA.
        ⛔⛔ Ela **SUGERE, NUNCA GRAVA** (ordem do dono: *"o campo é meu"*): o botão só PREENCHE
            o campo, e salvar continua sendo o clique dele. Gravar sozinho poria um mínimo que
            ele não escolheu disparando alarme todo dia.
        ⚠️ E sem consumo OU sem prazo medido ela não aparece — número de reposição chutado é
            pior que ausência, porque PARECE régua (a lição do `fatorConversao` chutado).
      */}
      {sugestao?.minimo != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--fam-indigo-bg)' }}>
          <Lightbulb className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fam-indigo-mid)' }} />
          <p className="min-w-0 flex-1 text-[12px] leading-snug" style={{ color: 'var(--fam-indigo-ink)' }}>
            sugestão: <b className="tabular-nums">~{n3(sugestao.minimo)} {unidade}</b>
            <span className="opacity-80"> — {sugestao.conta}</span>
          </p>
          <button onClick={() => setMin(String(sugestao.minimo))}
            className="shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: 'var(--prod-surface)', color: 'var(--fam-indigo-ink)', boxShadow: 'inset 0 0 0 1px var(--fam-indigo-mid)' }}>
            usar no campo
          </button>
        </div>
      )}

      {erro && <p className="mt-2 text-xs" style={{ color: 'var(--prod-coral)' }}>{erro}</p>}
      <p className="mt-2 text-[11px]" style={{ color: 'var(--prod-muted)' }}>O mínimo dispara o aviso &quot;abaixo do mínimo&quot; na posição. O máximo é opcional (evita comprar demais).</p>
    </CardContent></Card>
  )
}
