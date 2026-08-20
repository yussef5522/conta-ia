'use client'

// ESTOQUE FASE 0 item 5 — tela RECEBIMENTOS. A fila (AGUARDANDO_MERCADORIA) nasce
// VAZIA e enche sozinha (cron horário) quando um fornecedor emitir nota a partir do
// corte. As históricas (antes do corte) ficam num painel à parte: visíveis, SEM ação.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Inbox, PackageOpen, Archive, Info, Loader2, Clock } from 'lucide-react'

interface Card_ {
  id: string
  emitNome: string | null
  emitCnpj: string | null
  vNF: number | null
  dataEmissao: string | null
  nItens: number
  cancelada: boolean
  esperandoDias: number | null
}
interface Recebimentos {
  dataCorte: string | null
  ultimoDownload: string | null
  fila: Card_[]
  historicasCount: number
  historicasPeriodo: { de: string | null; ate: string | null }
}
interface Relatorio {
  total: number
  historicas: number
  novas: number
  fornecedoresDistintos: number
  valorTotalNovas: number
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')
const fmtDataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const fmtCnpj = (c: string | null) => (c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—')

export default function RecebimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ recebimentos: Recebimentos; relatorio: Relatorio } | null | undefined>(undefined)
  const [verHistoricas, setVerHistoricas] = useState(false)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/recebimentos`)
      .then((r) => r.json())
      .then((j) => setData(j.recebimentos ? j : null))
      .catch(() => setData(null))
  }, [id])

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card><CardContent className="flex items-center gap-2 p-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</CardContent></Card>
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card><CardContent className="p-6 text-sm text-slate-500">Não consegui carregar os recebimentos.</CardContent></Card>
      </div>
    )
  }

  const { recebimentos: r, relatorio: rel } = data

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-7 w-7 text-[#185FA5]" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Recebimentos</h1>
          <p className="text-sm text-slate-500">
            Notas fiscais emitidas contra o CNPJ da empresa, direto da SEFAZ. A fila nasce vazia e
            enche sozinha quando um fornecedor emitir a partir de {fmt(r.dataCorte)}.
          </p>
        </div>
      </div>

      {/* Resumo do que a SEFAZ devolveu */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 p-6 text-sm sm:grid-cols-4">
          <Stat label="Na fila" value={String(r.fila.length)} accent="text-[#185FA5]" />
          <Stat label="Históricas" value={String(r.historicasCount)} />
          <Stat label="Total baixado" value={String(rel.total)} />
          <Stat label="Último download" value={fmtDataHora(r.ultimoDownload)} small />
        </CardContent>
      </Card>

      {/* FILA */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <PackageOpen className="h-4 w-4" /> Aguardando mercadoria ({r.fila.length})
        </h2>
        {r.fila.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <Inbox className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">A fila está vazia — e é assim que começa.</p>
              <p className="max-w-md text-xs text-slate-500">
                Nada do que já passou entra no estoque. Quando um fornecedor emitir uma nota a partir de{' '}
                {fmt(r.dataCorte)}, ela aparece aqui sozinha (o sistema consulta a SEFAZ de hora em hora).
                Aí você confere a mercadoria e confirma.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {r.fila.map((n) => (
              <Card key={n.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{n.emitNome ?? '(sem nome)'}</p>
                    <p className="text-xs text-slate-500">
                      {fmtCnpj(n.emitCnpj)} · {fmt(n.dataEmissao)} · {n.nItens} {n.nItens === 1 ? 'item' : 'itens'}
                      {n.cancelada && <span className="ml-1 font-semibold text-rose-600">· CANCELADA</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{n.vNF != null ? brl(n.vNF) : '—'}</span>
                    {n.esperandoDias != null && n.esperandoDias > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                        <Clock className="h-3 w-3" /> {n.esperandoDias}d esperando
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* HISTÓRICAS — visíveis, sem ação */}
      <div>
        <button
          onClick={() => setVerHistoricas((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
        >
          <span className="flex items-center gap-2">
            <Archive className="h-4 w-4" /> {r.historicasCount} notas históricas (antes de {fmt(r.dataCorte)})
          </span>
          <span className="text-xs text-slate-400">{verHistoricas ? 'ocultar' : 'ver'}</span>
        </button>
        {verHistoricas && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-slate-50 p-4 text-xs text-slate-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {r.historicasCount} notas de {fmt(r.historicasPeriodo.de)} a {fmt(r.historicasPeriodo.ate)} — a mercadoria
              delas já foi recebida e consumida. Ficam aqui só pra consulta: <b>não entram no estoque</b> (senão
              criariam estoque fantasma). O estoque começa do zero, daqui pra frente.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent, small }: { label: string; value: string; accent?: string; small?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold tabular-nums ${small ? 'text-sm' : 'text-lg'} ${accent ?? 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
