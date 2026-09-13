'use client'

// ⭐⭐⭐ O PAINEL DO MÊS DA PF (13/09) — a tela-mãe. Padrão Organizze: o número grande em
// cima, e o trabalho logo embaixo. **Zero orçamento/metas nesta fase** (ordem do dono:
// *"primeiro o dado entra e fica bonito; meta sem histórico é chute"*).

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchJson } from '@/lib/http/fetch-json'
import type { PainelDoMes } from '@/lib/pf-extrato/painel-do-mes'

interface Dados extends PainelDoMes {
  lista: { id: string; data: string; descricao: string; valorComSinal: number; categoriaNome: string | null; ehPagamentoDeFatura: boolean }[]
  contas: { id: string; name: string; bankName: string | null; balance: number; conferencia: { estado: string; frase: string } | null }[]
  cartoes: { id: string; name: string; lastDigits: string | null; dueDay: number; fatura: { referencia: string; status: string; total: number; pago: number; vencimento: string } | null }[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const mesAnterior = (m: string) => { const d = new Date(`${m}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7) }
const mesSeguinte = (m: string) => { const d = new Date(`${m}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7) }
const nomeDoMes = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function PainelDoMesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // ⚠️ REGRA 9: todo hook antes de qualquer early return
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await fetchJson<Dados>(`/api/perfis/${id}/painel-do-mes?mes=${mes}`)
    // ⛔ erro nunca vira vazio: "sem lançamento" é uma afirmação e precisa ser verdade
    if (!r.ok || !r.data) { setErro(r.message ?? 'resposta vazia'); return }
    setErro(null); setD(r.data)
  }, [id, mes])
  useEffect(() => { void carregar() }, [carregar])

  return (
    <div className="mx-auto max-w-[760px] pb-12">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setMes(mesAnterior(mes))} className="h-8 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-600">‹</button>
        <h1 className="flex-1 text-center text-base font-bold capitalize text-slate-800">{nomeDoMes(mes)}</h1>
        <button onClick={() => setMes(mesSeguinte(mes))} className="h-8 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-600">›</button>
      </div>

      {erro && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          não consegui carregar: {erro} — <b>ausência aqui não é prova de que não houve movimento</b>.
        </div>
      )}

      {d && (
        <>
          {/* ── ENTROU · SAIU · SOBROU ─────────────────────────────────────── */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <Numero rotulo="Entrou" valor={d.entrou} cor="#177245" />
            <Numero rotulo="Saiu" valor={d.saiu} cor="#b3382c" />
            <Numero rotulo="Sobrou" valor={d.sobrou} cor={d.sobrou >= 0 ? '#1f2430' : '#b3382c'} destaque />
          </div>

          {d.vazio ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-[13px] italic text-slate-500">{d.vazio}</p>
          ) : (
            <>
              {/* ⭐ A EXCLUSÃO APARECE — a régua do Fluxo da PJ (25/08): esconder a exclusão
                  é tão ruim quanto não excluir */}
              {d.pagamentosDeFatura.quantos > 0 && (
                <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[12px] text-slate-600">
                  + {d.pagamentosDeFatura.quantos} pagamento(s) de fatura: <b>{brl(d.pagamentosDeFatura.total)}</b>
                  {' '}— <b>fora do SAIU</b>, senão a compra do cartão contaria duas vezes
                </p>
              )}

              <Bloco titulo="Gastos por categoria">
                {d.gastosPorCategoria.map((g) => (
                  <div key={g.categoriaId ?? 'sem'} className="flex items-center gap-2.5 py-1.5">
                    <span className="w-[128px] shrink-0 truncate text-[13px]" style={{ fontStyle: g.categoriaId ? undefined : 'italic', color: g.categoriaId ? '#1f2430' : '#6b7280' }}>{g.nome}</span>
                    <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <i className="block h-full rounded-full" style={{ width: `${Math.round(g.proporcao * 100)}%`, background: g.categoriaId ? '#534AB7' : '#cbd5e1' }} />
                    </span>
                    <span className="w-[88px] shrink-0 text-right text-[12.5px] font-bold tabular-nums">{brl(g.total)}</span>
                  </div>
                ))}
                {d.semCategoria.quantos > 0 && (
                  <p className="mt-1.5 text-[11.5px] text-slate-500">
                    {d.semCategoria.quantos} lançamento(s) sem categoria — <b>contam no SAIU</b> e ficam à vista até você classificar
                  </p>
                )}
              </Bloco>
            </>
          )}

          <Bloco titulo="Contas">
            {d.contas.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="flex-1">{c.name}</span>
                <span className="font-bold tabular-nums">{brl(c.balance)}</span>
                {/* ⭐ a conferência mora AQUI, no card da conta — uma casa só (10/09) */}
                <span className="w-[150px] shrink-0 text-right text-[11px]"
                  style={{ color: c.conferencia?.estado === 'BATE' ? '#177245' : c.conferencia ? '#b45309' : '#94a3b8' }}>
                  {c.conferencia ? `${c.conferencia.estado === 'BATE' ? '✓' : '⚠'} ${c.conferencia.frase}` : '○ nunca conferida'}
                </span>
              </div>
            ))}
            <Link href={`/perfis/${id}/extrato`} className="mt-2 inline-block text-[12.5px] font-semibold" style={{ color: '#534AB7' }}>
              importar extrato da conta →
            </Link>
          </Bloco>

          <Bloco titulo="Cartões">
            {d.cartoes.map((c) => (
              <Link key={c.id} href={`/perfis/${id}/cartoes/${c.id}`} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="flex-1">{c.name} <small className="text-slate-400">••••{c.lastDigits}</small></span>
                {c.fatura ? (
                  <>
                    <span className="tabular-nums">{brl(c.fatura.total - c.fatura.pago)}</span>
                    <span className="w-[74px] shrink-0 text-right text-[11px] font-bold"
                      style={{ color: c.fatura.status === 'PAID' ? '#177245' : '#b45309' }}>
                      {c.fatura.status === 'PAID' ? 'paga ✓' : `vence ${dia(c.fatura.vencimento)}`}
                    </span>
                  </>
                ) : <span className="text-[11px] italic text-slate-400">sem fatura importada</span>}
              </Link>
            ))}
          </Bloco>

          <Bloco titulo={`Extrato de ${nomeDoMes(mes)}`}>
            {d.lista.length === 0
              ? <p className="text-[13px] italic text-slate-500">nada aqui ainda</p>
              : d.lista.map((l) => (
                <div key={l.id} className="flex items-center gap-2 border-t border-slate-100 py-1.5 text-[13px] first:border-t-0">
                  <span className="w-[42px] shrink-0 text-[11.5px] text-slate-400">{dia(l.data)}</span>
                  <span className="min-w-0 flex-1 truncate">{l.descricao}</span>
                  <span className="w-[104px] shrink-0 truncate text-right text-[11px]"
                    style={{ color: l.categoriaNome ? '#6b7280' : '#94a3b8', fontStyle: l.categoriaNome ? undefined : 'italic' }}>
                    {l.ehPagamentoDeFatura ? 'pagto de fatura' : l.categoriaNome ?? 'a classificar'}
                  </span>
                  <span className="w-[88px] shrink-0 text-right font-bold tabular-nums"
                    style={{ color: l.valorComSinal >= 0 ? '#177245' : '#1f2430' }}>{brl(l.valorComSinal)}</span>
                </div>
              ))}
          </Bloco>
        </>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, cor, destaque }: { rotulo: string; valor: number; cor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border bg-white px-3.5 py-3" style={{ borderColor: destaque ? '#534AB7' : '#e2e8f0' }}>
      <div className="text-[10.5px] font-bold uppercase tracking-[.04em] text-slate-500">{rotulo}</div>
      <div className="mt-0.5 text-[21px] font-bold tabular-nums" style={{ color: cor }}>{brl(valor)}</div>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[.03em] text-slate-500">{titulo}</h3>
      {children}
    </div>
  )
}
