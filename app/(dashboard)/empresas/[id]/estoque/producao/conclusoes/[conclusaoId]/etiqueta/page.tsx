'use client'

// ESTOQUE FASE 2 item 2.3 — ETIQUETA da conclusão (imprimível + ZPL). Produto, lote,
// manipulação, validade, qtd, colaborador, QR do lote. Por LOTE (1) ou por UNIDADE (N).
// O ZPL cru sai pra Zebra (agente USB é frente à parte); a tela imprime em qualquer papel.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Printer, Download, Tag } from 'lucide-react'

interface Etq { conclusaoId: string; produto: string; lote: string; manipulacao: string; validade: string; qtdGerada: number; unidade: string; colaborador: string | null }

export default function EtiquetaPage({ params }: { params: Promise<{ id: string; conclusaoId: string }> }) {
  const { id, conclusaoId } = use(params)
  const [e, setE] = useState<Etq | null | undefined>(undefined)
  const [copias, setCopias] = useState(1)
  const [modo, setModo] = useState<'lote' | 'unidade'>('lote')

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/producao/conclusoes/${conclusaoId}/etiqueta?modo=${modo}`).then((r) => r.json()).then((j) => { setE(j.etiqueta ?? null); setCopias(j.copias ?? 1) }).catch(() => setE(null))
  }, [id, conclusaoId, modo])

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

      <div className="flex items-center justify-center gap-3 print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C]"><Printer className="h-4 w-4" /> Imprimir</button>
        <a href={`/api/empresas/${id}/estoque/producao/conclusoes/${conclusaoId}/etiqueta?modo=${modo}&formato=zpl`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> Baixar ZPL (Zebra)</a>
      </div>
      <p className="text-center text-[11px] text-slate-400 print:hidden">O ZPL sai no formato da Zebra 60×60. Imprimir manda pro papel/impressora do navegador.</p>

      <Card className="print:hidden"><CardContent className="p-4 text-xs text-slate-500">
        <p><b>Rastro:</b> essa etiqueta carrega o LOTE ({e.lote}) — o mesmo id da ordem de produção. Da etiqueta no freezer até a nota do fornecedor, o caminho está no ledger.</p>
      </CardContent></Card>
    </div>
  )
}
