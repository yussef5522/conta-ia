'use client'

// ESTOQUE FASE 1 item 4 — RECIBO do recebimento (URL estável, acessível depois). Mostra
// o que aquela conferência fez no estoque: itens conferidos (nota vs recebido, divergência),
// movimentos gerados (o que entrou), duplicatas sugeridas. Link da nota, da ficha, das Recebidas.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Receipt, Loader2, ArrowLeft, Package, CheckCircle2, AlertTriangle, Camera } from 'lucide-react'

interface ReciboItem {
  xProd: string; itemNome: string | null; itemId: string | null; qtdNota: number; qtdRecebida: number | null
  unidadeNota: string | null; divergencia: boolean; motivo: string | null; temFoto: boolean
  quantidade: number | null; custoUnitario: number | null; custoTotal: number | null
}
interface Recibo {
  conferenceId: string; nfeId: string; chave: string; nNF: string | null; status: string; divergente: boolean
  confirmadoEm: string | null; fornecedor: { nome: string | null; cnpj: string | null }
  valorEntrada: number; vNF: number | null
  itens: ReciboItem[]; duplicatas: { nDup: string | null; dVenc: string | null; valor: number }[]; conferidoPor: string | null
}

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }))
const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const fmtDia = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')

export default function ReciboPage({ params }: { params: Promise<{ id: string; conferenceId: string }> }) {
  const { id, conferenceId } = use(params)
  const [r, setR] = useState<Recibo | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/recibos/${conferenceId}`).then((x) => x.json()).then((j) => setR(j.recibo ?? null)).catch(() => setR(null))
  }, [id, conferenceId])

  if (r === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!r) return <div className="p-6 text-sm text-slate-500">Recibo não encontrado.</div>

  const diff = r.vNF != null ? Math.round((r.vNF - r.valorEntrada) * 100) / 100 : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/recebimentos`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pros recebimentos</a>

      {/* cabeçalho */}
      <div className="flex items-start gap-3">
        <Receipt className="h-7 w-7 shrink-0 text-[#185FA5]" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Recibo de recebimento</h1>
          <p className="text-sm text-slate-500">{r.fornecedor.nome ?? 'Fornecedor'}{r.nNF ? ` · nota nº ${r.nNF}` : ''} · {fmtData(r.confirmadoEm)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${r.divergente ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {r.divergente ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{r.divergente ? 'Com divergência' : 'Conferida'}
        </span>
      </div>

      {/* resumo de valores */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Entrou no estoque</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(r.valorEntrada)}</p><p className="text-[10px] text-slate-400">valor da mercadoria (vProd)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total da nota</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(r.vNF)}</p><p className="text-[10px] text-slate-400">com impostos (a pagar)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Diferença</p><p className="text-lg font-semibold tabular-nums text-slate-700">{brl(diff)}</p><p className="text-[10px] text-slate-400">ST / frete / IPI</p></CardContent></Card>
      </div>

      {/* itens */}
      <Card><CardContent className="p-0">
        <table className="hidden w-full text-sm sm:table">
          <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
            <th className="p-3 font-medium">Item</th><th className="p-3 text-right font-medium">Nota</th>
            <th className="p-3 text-right font-medium">Recebido</th><th className="p-3 text-right font-medium">Custo un.</th>
            <th className="p-3 text-right font-medium">Entrou</th>
          </tr></thead>
          <tbody>
            {r.itens.map((it, k) => (
              <tr key={k} className={`border-b border-slate-50 last:border-0 ${it.divergencia ? 'bg-amber-50/40' : ''}`}>
                <td className="p-3">
                  {it.itemId ? <a href={`/empresas/${id}/estoque/itens/${it.itemId}`} className="font-medium text-[#185FA5] hover:underline">{it.itemNome ?? it.xProd}</a> : <span className="font-medium text-slate-800">{it.xProd}</span>}
                  {it.divergencia && <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">{it.motivo}{it.temFoto && <Camera className="h-3 w-3" />}</span>}
                </td>
                <td className="p-3 text-right tabular-nums text-slate-500">{num(it.qtdNota)} {it.unidadeNota}</td>
                <td className={`p-3 text-right tabular-nums ${it.divergencia ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>{num(it.qtdRecebida)}</td>
                <td className="p-3 text-right tabular-nums text-slate-600">{brl(it.custoUnitario)}</td>
                <td className="p-3 text-right font-medium tabular-nums text-slate-900">{brl(it.custoTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* mobile */}
        <div className="divide-y divide-slate-50 sm:hidden">
          {r.itens.map((it, k) => (
            <div key={k} className={`p-4 ${it.divergencia ? 'bg-amber-50/40' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                {it.itemId ? <a href={`/empresas/${id}/estoque/itens/${it.itemId}`} className="font-medium text-[#185FA5]">{it.itemNome ?? it.xProd}</a> : <span className="font-medium text-slate-800">{it.xProd}</span>}
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{brl(it.custoTotal)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">nota {num(it.qtdNota)} {it.unidadeNota} · recebido <span className={it.divergencia ? 'font-semibold text-amber-700' : ''}>{num(it.qtdRecebida)}</span> · {brl(it.custoUnitario)}/un</div>
              {it.divergencia && <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"><AlertTriangle className="h-3 w-3" />{it.motivo}{it.temFoto && <Camera className="h-3 w-3" />}</div>}
            </div>
          ))}
        </div>
      </CardContent></Card>

      {/* duplicatas (contas a pagar sugeridas) */}
      {r.duplicatas.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Package className="h-4 w-4" /> Contas a pagar sugeridas</h2>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {r.duplicatas.map((d, k) => (
                  <tr key={k} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 text-slate-600">Parcela {d.nDup ?? k + 1}</td>
                    <td className="p-3 text-slate-500">vence {fmtDia(d.dVenc)}</td>
                    <td className="p-3 text-right font-medium tabular-nums text-slate-900">{brl(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          <p className="mt-1 text-[11px] text-slate-400">Sugestão do estoque — a ponte pro financeiro está desligada (não lança sozinho).</p>
        </div>
      )}

      <p className="text-xs text-slate-400">Conferido por {r.conferidoPor ?? '—'} · chave {r.chave}</p>
    </div>
  )
}
