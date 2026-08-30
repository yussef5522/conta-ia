'use client'

// ESTOQUE FASE 2 item 2.3 — ETIQUETA da conclusão (imprimível + ZPL). Produto, lote,
// manipulação, validade, qtd, colaborador, QR do lote. Por LOTE (1) ou por UNIDADE (N).
// O ZPL cru sai pra Zebra (agente USB é frente à parte); a tela imprime em qualquer papel.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Printer, Download, Tag, Usb, Check, AlertTriangle } from 'lucide-react'

interface Etq { conclusaoId: string; produto: string; lote: string; manipulacao: string; validade: string; qtdGerada: number; unidade: string; colaborador: string | null }

const AGENTE_KEY = 'zebra_agente_url'

export default function EtiquetaPage({ params }: { params: Promise<{ id: string; conclusaoId: string }> }) {
  const { id, conclusaoId } = use(params)
  const [e, setE] = useState<Etq | null | undefined>(undefined)
  const [copias, setCopias] = useState(1)
  const [zpl, setZpl] = useState('')
  const [modo, setModo] = useState<'lote' | 'unidade'>('lote')
  const [zebra, setZebra] = useState<{ estado: 'idle' | 'enviando' | 'ok' | 'erro'; msg?: string }>({ estado: 'idle' })
  // ⭐ fila de impressão (30/08) — REGRA 9: hook no topo
  const [fila, setFila] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle')
  const [filaMsg, setFilaMsg] = useState<string | null>(null)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/producao/conclusoes/${conclusaoId}/etiqueta?modo=${modo}`).then((r) => r.json()).then((j) => { setE(j.etiqueta ?? null); setCopias(j.copias ?? 1); setZpl(j.zpl ?? '') }).catch(() => setE(null))
  }, [id, conclusaoId, modo])

  const imprimirZebra = async (zplAtual: string) => {
    const url = (typeof window !== 'undefined' && localStorage.getItem(AGENTE_KEY)) || 'http://localhost:9100'
    setZebra({ estado: 'enviando' })
    try {
      const r = await fetch(`${url}/print`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: zplAtual })
      if (r.ok) setZebra({ estado: 'ok', msg: 'Etiqueta enviada pra Zebra.' })
      else setZebra({ estado: 'erro', msg: (await r.json().catch(() => null))?.erro ?? 'A Zebra recusou.' })
    } catch {
      setZebra({ estado: 'erro', msg: 'Agente da Zebra offline. Rode `node scripts/zebra-agent.mjs` no PC do estoque.' })
    }
  }

  const enfileirar = async () => {
    setFila('enviando'); setFilaMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/impressao`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zpl, descricao: `etiqueta do lote ${conclusaoId.slice(-6)}` }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setFila('erro'); setFilaMsg(j?.erro ?? 'Não consegui enfileirar.'); return }
      setFila('ok'); setFilaMsg('Na fila — o agente imprime em segundos.')
    } catch {
      setFila('erro'); setFilaMsg('Sem conexão com o servidor.')
    }
  }

  // auto-imprime na Zebra se veio da conclusão com ?print=zebra e o zpl carregou
  useEffect(() => {
    if (searchParams?.get('print') === 'zebra' && zpl && zebra.estado === 'idle') imprimirZebra(zpl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zpl])

  if (e === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!e) return <div className="p-6 text-sm text-slate-500">Etiqueta não encontrada.</div>

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 print:hidden"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra produção</a>

      <div className="flex items-center gap-2 print:hidden">
        <Tag className="h-6 w-6 text-[#185FA5]" />
        <h1 className="flex-1 text-lg font-semibold text-slate-900">Etiqueta</h1>
        <select value={modo} onChange={(ev) => setModo(ev.target.value as 'lote' | 'unidade')} className="rounded-lg border border-slate-300 py-1.5 px-2 text-sm"><option value="lote">1 por lote</option><option value="unidade">1 por unidade</option></select>
      </div>
      {modo === 'unidade' && <p className="text-xs text-slate-400 print:hidden">{copias} etiquetas (uma por {e.unidade}).</p>}

      {/* preview 60x60 */}
      <div className="flex justify-center">
        <div className="w-[240px] rounded-lg border-2 border-dashed border-slate-300 p-4 print:border-solid">
          <p className="text-base font-bold text-slate-900">{e.produto}</p>
          <div className="mt-2 space-y-0.5 text-sm text-slate-700">
            <p>Lote: <b>{e.lote}</b></p>
            <p>Manipulação: {e.manipulacao}</p>
            <p className="text-base font-semibold">Validade: {e.validade}</p>
            <p>Qtd: {e.qtdGerada} {e.unidade}</p>
            {e.colaborador && <p className="text-xs text-slate-500">{e.colaborador}</p>}
          </div>
          <div className="mt-2 flex justify-end">
            <img alt="QR do lote" width={72} height={72} src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(e.lote)}`} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        {/* ⭐⭐ ENFILEIRA (30/08) — é o que faz o CELULAR imprimir. O agente puxa da fila e
            manda pra Zebra; se a impressora estiver ocupada ou sem papel, a etiqueta
            espera em vez de sumir. O caminho antigo (agente em localhost) só funcionava no
            PC com o cabo — do celular, nunca. */}
        <button onClick={enfileirar} disabled={fila === 'enviando' || !zpl} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{fila === 'enviando' ? <Loader2 className="h-4 w-4 animate-spin" /> : fila === 'ok' ? <Check className="h-4 w-4" /> : <Printer className="h-4 w-4" />} Imprimir na Zebra</button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> Imprimir (papel)</button>
        <a href={`/api/empresas/${id}/estoque/producao/conclusoes/${conclusaoId}/etiqueta?modo=${modo}&formato=zpl`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> Baixar ZPL</a>
      </div>
      {fila === 'ok' && <p className="flex items-center justify-center gap-1 text-center text-xs text-emerald-600 print:hidden"><Check className="h-3.5 w-3.5" /> {filaMsg}</p>}
      {fila === 'erro' && <p className="flex items-center justify-center gap-1 text-center text-xs text-rose-600 print:hidden"><AlertTriangle className="h-3.5 w-3.5" /> {filaMsg}</p>}
      {zebra.estado === 'ok' && <p className="flex items-center justify-center gap-1 text-center text-xs text-emerald-600 print:hidden"><Check className="h-3.5 w-3.5" /> {zebra.msg}</p>}
      {zebra.estado === 'erro' && <p className="flex items-center justify-center gap-1 text-center text-xs text-rose-600 print:hidden"><AlertTriangle className="h-3.5 w-3.5" /> {zebra.msg}</p>}
      <p className="text-center text-[11px] text-slate-400 print:hidden">A etiqueta vai pra <a href={`/empresas/${id}/estoque/impressao`} className="underline hover:text-slate-600">fila de impressão</a> — funciona do celular. (modo antigo: o agente local (`node scripts/zebra-agent.mjs` no PC do estoque). <button onClick={() => { const u = prompt('Endereço do agente da Zebra:', localStorage.getItem(AGENTE_KEY) || 'http://localhost:9100'); if (u) localStorage.setItem(AGENTE_KEY, u) }} className="underline hover:text-slate-600">configurar agente</button></p>

      <Card className="print:hidden"><CardContent className="p-4 text-xs text-slate-500">
        <p><b>Rastro:</b> essa etiqueta carrega o LOTE ({e.lote}) — o mesmo id da ordem de produção. Da etiqueta no freezer até a nota do fornecedor, o caminho está no ledger.</p>
      </CardContent></Card>
    </div>
  )
}
