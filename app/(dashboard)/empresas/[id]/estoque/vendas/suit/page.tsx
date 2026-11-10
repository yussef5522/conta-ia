'use client'

// SUITAPI — os dias que entraram sozinhos pela Suit e a DECISÃO sobre pedido que mudou na Suit
// depois que o dia já tinha entrado (10/11/2026). É a maçaneta do aviso "manter ou atualizar":
// o dono vê o pedido (número, hora, valor) e decide o DIA — manter como entrou ou refazer com a Suit.

import { useCallback, useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Zap, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { EstadoSuitDTO } from '@/components/estoque/faixa-da-suit'

type Evento = { id: string; dia: string; tipo: string; pedido: string; hora: string | null; tipoPedido: string | null; totalCent: number; deltaCent: number; deltaUn: number }
type Estado = EstadoSuitDTO & { eventos: Evento[] }

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDia = (d: string) => d.split('-').reverse().join('/')
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—')
const STATUS: Record<string, { rotulo: string; cor: string }> = {
  MATERIALIZADO: { rotulo: 'Entrou', cor: 'bg-emerald-100 text-emerald-800' },
  AGUARDANDO_DONO: { rotulo: 'Esperando você confirmar', cor: 'bg-amber-100 text-amber-800' },
  XLS_POR_CIMA: { rotulo: 'Trocado pelo arquivo', cor: 'bg-slate-100 text-slate-700' },
}

export default function VendasDaSuitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/empresas/${id}/estoque/vendas/suit`)
    const j = await r.json().catch(() => null)
    if (!r.ok || !j) { setErro(j?.erro ?? 'Não consegui ler os dias da Suit.'); return }
    setEstado(j)
  }, [id])
  useEffect(() => { void carregar() }, [carregar])

  async function decidir(dia: string, decisao: 'MANTER' | 'ATUALIZAR') {
    setOcupado(`${dia}:${decisao}`); setErro(null); setFeito(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/suit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia, decisao }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui aplicar a decisão.'); return }
      const aguarda = j?.reentrega?.status === 'AGUARDANDO_DONO'
      setFeito(decisao === 'MANTER' ? `${fmtDia(dia)}: mantido como entrou.` : aguarda ? `${fmtDia(dia)}: refeito com a Suit — a baixa espera você confirmar em Vendas.` : `${fmtDia(dia)}: refeito com a Suit e o estoque do dia acertado.`)
      await carregar()
    } finally { setOcupado(null) }
  }

  const dias = [...new Set((estado?.eventos ?? []).map((e) => e.dia))]
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Link href={`/empresas/${id}/estoque/vendas`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Voltar pra Vendas</Link>
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-[var(--fam-azul-mid)]" />
        <h1 className="text-base font-semibold text-slate-900">Vendas que entram pela Suit</h1>
      </div>
      <p className="text-xs text-slate-500">Desde 09/11 as vendas de produtos do dia entram sozinhas às 3h10 da manhã, pela mesma esteira do arquivo. Os complementos seguem pelo arquivo.</p>
      {erro && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {feito && <p className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{feito}</p>}
      {!estado ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</p>
      ) : (
        <>
          {estado.parado && <p className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />A ligação com a Suit está parada{estado.ultimaLeitura ? ` desde ${new Date(estado.ultimaLeitura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}.</p>}

          {dias.map((dia) => {
            const evs = estado.eventos.filter((e) => e.dia === dia)
            const delta = evs.reduce((s, e) => s + e.deltaCent, 0)
            return (
              <Card key={dia} data-testid={`decidir-${dia}`} className="border-amber-300">
                <CardContent className="space-y-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{fmtDia(dia)} — {evs.length} pedido{evs.length > 1 ? 's' : ''} mudou na Suit depois que o dia entrou</p>
                    <p className="text-xs text-slate-500">Se atualizar, o dia muda <span className="font-semibold tabular-nums">{brl(delta)}</span> e o estoque do dia é refeito.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs tabular-nums">
                      <thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Pedido</th><th className="pr-3">Hora</th><th className="pr-3">O que houve</th><th className="pr-3 text-right">Valor do pedido</th><th className="text-right">Muda no dia</th></tr></thead>
                      <tbody>
                        {evs.map((e) => (
                          <tr key={e.id} className="border-t border-slate-100">
                            <td className="py-1 pr-3 font-medium">#{e.pedido}</td>
                            <td className="pr-3">{hora(e.hora)}</td>
                            <td className="pr-3">{e.tipo === 'APAGADO' ? 'apagado na Suit' : 'itens mudaram'}</td>
                            <td className="pr-3 text-right">{brl(e.totalCent)}</td>
                            <td className={`text-right font-semibold ${e.deltaCent < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(e.deltaCent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={!!ocupado} onClick={() => void decidir(dia, 'MANTER')} className="h-9 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50">{ocupado === `${dia}:MANTER` ? 'Mantendo…' : 'Manter o dia como entrou'}</button>
                    <button disabled={!!ocupado} onClick={() => void decidir(dia, 'ATUALIZAR')} className="h-9 rounded-md bg-[var(--fam-azul-solid)] px-3 text-sm font-medium text-[var(--fam-azul-on)] hover:opacity-90 disabled:opacity-50">{ocupado === `${dia}:ATUALIZAR` ? 'Atualizando…' : 'Atualizar o dia com a Suit'}</button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {dias.length === 0 && <p className="text-sm text-slate-500">Nenhum pedido mudou na Suit depois de o dia entrar. Nada pra decidir.</p>}

          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">Dias que entraram pela Suit</p>
              {estado.dias.length === 0 ? <p className="text-xs text-slate-500">Nenhum dia ainda — o primeiro entra às 3h10 depois que o dia fecha.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Dia</th><th className="pr-3">Situação</th><th className="pr-3 text-right">Pedidos</th><th className="pr-3 text-right">Unidades</th><th className="text-right">Valor</th></tr></thead>
                    <tbody>
                      {estado.dias.map((d) => (
                        <tr key={d.dia} className="border-t border-slate-100">
                          <td className="py-1 pr-3 font-medium">{fmtDia(d.dia)}</td>
                          <td className="pr-3"><span className={`rounded px-1.5 py-0.5 ${STATUS[d.status]?.cor ?? 'bg-slate-100'}`}>{STATUS[d.status]?.rotulo ?? d.status}</span></td>
                          <td className="pr-3 text-right">{d.pedidos}</td>
                          <td className="pr-3 text-right">{d.unidades}</td>
                          <td className="text-right">{brl(d.totalCent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {estado.dias.some((d) => d.status === 'AGUARDANDO_DONO') && <p className="mt-2 text-xs text-amber-700">Dia “esperando você”: a esteira fez uma pergunta (quantidade fora do normal ou item barrado). Abra <Link className="underline" href={`/empresas/${id}/estoque/vendas`}>Vendas</Link> e reprocesse o dia para responder.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
