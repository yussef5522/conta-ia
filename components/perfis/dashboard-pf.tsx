'use client'

// ⭐⭐⭐ O DASHBOARD DA PF (13/09) — régua: `docs/mocks/pf-dashboard-mock.html`.
//
// **O dono:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido."* Os tokens
// e medidas abaixo são LITERAIS do arquivo, e há guard que lê o HTML e compara.
//
// ⭐ A conta NÃO mora aqui: vem de `montarDashboard`, que chama a MESMA `painelDoMes` —
// fonte única. A tela só pinta.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchJson } from '@/lib/http/fetch-json'
import type { DashboardPF } from '@/lib/pf-dashboard/dashboard'
import { LancamentoRapido } from './lancamento-rapido'

/** ⭐ os tokens do mock, literais */
const M = {
  bg: '#f4f4f8', card: '#fff', ink: '#1c2030', sub: '#7a8095', line: '#ebebf2',
  roxo: '#534AB7', roxo2: '#6f63d8', roxoFraco: '#eeecfa',
  verde: '#16a34a', verdeFraco: '#e8f7ee', coral: '#e5484d', coralFraco: '#fdecec',
  ambar: '#d97706', ambarFraco: '#fdf3e3',
  sombra: '0 1px 3px rgba(28,32,48,.06), 0 6px 20px rgba(28,32,48,.05)',
} as const

interface Dados extends DashboardPF {
  nome: string
  contas: { id: string; name: string; balance: number }[]
  ultimos: { id: string; data: string; descricao: string; valorComSinal: number; categoriaNome: string | null; ehPagamentoDeFatura: boolean; temPonte: boolean; casou: boolean }[]
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// ⚠️ `dt` e não `d`: `d` é o nome do PAYLOAD nesta tela, e reusá-lo aqui confundia o guard
// de contrato tanto quanto confundiria quem lê
const andar = (m: string, n: number) => { const dt = new Date(`${m}-15T12:00:00Z`); dt.setUTCMonth(dt.getUTCMonth() + n); return dt.toISOString().slice(0, 7) }
const nomeMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1]
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite' }

export function DashboardPFView({ profileId }: { profileId: string }) {
  // ⚠️ REGRA 9: todo hook antes de qualquer early return
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  /** ⭐ o olhinho esconde TODOS os números da tela, não só o hero (régua do dono) */
  const [oculto, setOculto] = useState(false)
  const [fab, setFab] = useState(false)

  const carregar = useCallback(async () => {
    const r = await fetchJson<Dados>(`/api/perfis/${profileId}/dashboard?mes=${mes}`)
    // ⛔ erro NUNCA vira vazio: "sem lançamento" é uma afirmação e precisa ser verdade
    if (!r.ok || !r.data) { setErro(r.message ?? 'resposta vazia'); return }
    setErro(null); setD(r.data)
  }, [profileId, mes])
  useEffect(() => { void carregar() }, [carregar])

  const brl = useCallback((n: number, semSimbolo = false) => oculto ? '••••'
    : (semSimbolo ? Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })), [oculto])
  const curto = useCallback((n: number) => oculto ? '••'
    : Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
      : n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), [oculto])

  return (
    <div className="mx-auto max-w-[480px] pb-[90px]" style={{ background: M.bg, color: M.ink }}>
      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <div className="rounded-b-[28px] px-[18px] pb-[54px] pt-5 text-white"
        style={{ background: 'linear-gradient(150deg,#4c42b3 0%,#6f63d8 60%,#8b7ee6 100%)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] opacity-[.85]">{saudacao()} 👋<b className="block text-[16px] opacity-100">{d?.nome ?? ''}</b></div>
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full font-extrabold" style={{ background: 'rgba(255,255,255,.2)' }}>
            {(d?.nome ?? '?').slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="mb-2.5 flex items-center justify-center gap-[18px] text-[14.5px] font-bold">
          <button onClick={() => setMes(andar(mes, -1))} className="text-[13px] font-normal opacity-[.55]">‹ {nomeMes(andar(mes, -1))}</button>
          <span>{nomeMes(mes)}</span>
          <button onClick={() => setMes(andar(mes, 1))} className="text-[13px] font-normal opacity-[.55]">{nomeMes(andar(mes, 1))} ›</button>
        </div>
        <div className="text-center">
          <button onClick={() => setOculto((v) => !v)} className="text-[11.5px] tracking-[.03em] opacity-80">
            SALDO NAS CONTAS {oculto ? '🙈' : '👁'}
          </button>
          <div className="my-0.5 text-[34px] font-extrabold tracking-[-.01em]">
            {oculto ? '••••••' : (
              <>
                <small className="text-[18px] opacity-75">R$ </small>
                {Math.floor(d?.saldoNasContas ?? 0).toLocaleString('pt-BR')}
                <small className="text-[18px] opacity-75">,{String(Math.round((((d?.saldoNasContas ?? 0) % 1) * 100))).padStart(2, '0')}</small>
              </>
            )}
          </div>
          {/* ⭐ o previsto só conta FATURA CONHECIDA — nada de projetar gasto inventado */}
          {d && (
            <span className="mt-1 inline-block rounded-full px-3 py-1 text-[12px]" style={{ background: 'rgba(255,255,255,.16)' }}>
              🔮 previsto pro fim do mês: <b>{brl(d.previstoFimDoMes)}</b>{d.faturasNoPrevisto > 0 && ' (após faturas)'}
            </span>
          )}
        </div>
      </div>

      {/* ── RECEITAS × DESPESAS ─────────────────────────────────────────────── */}
      <div className="mx-[14px] mb-3 mt-[-38px] flex gap-2.5">
        <Duo icone="📈" fundo={M.verdeFraco} rotulo="RECEITAS" valor={brl(d?.entrou ?? 0)} cor={M.verde} />
        <Duo icone="📉" fundo={M.coralFraco} rotulo="DESPESAS" valor={brl(d?.saiu ?? 0)} cor={M.coral} />
      </div>

      <div className="px-[14px]">
        {erro && <Card><p className="text-[13px]" style={{ color: M.ambar }}>não consegui carregar: {erro} — <b>ausência aqui não é prova de que não houve movimento</b>.</p></Card>}

        {d && (
          <>
            {/* ── RECEBIDO DA EMPRESA ─────────────────────────────────────── */}
            {d.recebidoDaEmpresa.transferencias > 0 && (
              <Card estilo={{ background: 'linear-gradient(135deg,#eeecfa,#e8f7ee)' }}>
                <H3>💼 Recebido da empresa</H3>
                <div className="text-[23px] font-extrabold">{brl(d.recebidoDaEmpresa.total)}</div>
                <div className="mt-0.5 text-[12px]" style={{ color: M.sub }}>
                  {d.recebidoDaEmpresa.transferencias} transferência{d.recebidoDaEmpresa.transferencias > 1 ? 's' : ''} no mês · espelhadas na empresa ✓
                </div>
              </Card>
            )}

            {/* ── DONUT ───────────────────────────────────────────────────── */}
            {/* ⛔ zero widget sem dado: sem gasto, o donut não aparece */}
            {d.donut.length > 0 && (
              <Card>
                <H3>Despesas por categoria</H3>
                <div className="flex items-center gap-4">
                  <Donut fatias={d.donut} total={d.saiu} rotuloTotal={curto(d.saiu)} />
                  <div className="min-w-0 flex-1">
                    {d.donut.map((f) => (
                      <div key={f.nome} className="mb-[7px] flex items-center gap-2 text-[12.5px]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: f.cor }} />
                        <span className="min-w-0 flex-1 truncate" style={{ color: f.semCategoria ? M.ambar : M.ink, fontWeight: f.semCategoria ? 700 : 400 }}>
                          {f.nome}{f.semCategoria && ' ⚠'}
                        </span>
                        <span className="font-extrabold">{f.pct}%</span>
                        <span className="w-[58px] text-right text-[11.5px]" style={{ color: M.sub }}>{curto(f.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* ── CARTÕES ─────────────────────────────────────────────────── */}
            {d.cartoes.length > 0 && (
              <Card>
                <H3 link={{ href: `/perfis/${profileId}/cartoes`, texto: 'ver todos →' }}>Meus cartões</H3>
                {d.cartoes.map((c, i) => (
                  <div key={c.cardId} className="py-[11px]" style={{ borderTop: i ? `1px solid ${M.line}` : undefined, paddingTop: i ? undefined : 2 }}>
                    <div className="flex items-center gap-2.5">
                      <span className="h-[27px] w-10 shrink-0 rounded-[7px]" style={{ background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)' }} />
                      <span className="min-w-0 flex-1 text-[14px] font-bold">
                        {c.nome}{c.lastDigits && <span style={{ color: M.sub }}> ••••{c.lastDigits}</span>}
                        <small className="block text-[11px] font-medium" style={{ color: M.sub }}>fecha dia {c.fechaDia}</small>
                      </span>
                      <div className="text-right text-[14.5px] font-extrabold"
                        style={{ color: c.estado === 'VENCIDA' ? M.coral : c.estado === 'PAGA' ? M.verde : M.ink }}>
                        {brl(c.emAberto, true)}
                        <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                          style={c.estado === 'VENCIDA' ? { background: M.coralFraco, color: M.coral }
                            : c.estado === 'PAGA' ? { background: M.verdeFraco, color: M.verde }
                              : { background: M.roxoFraco, color: M.roxo }}>{c.selo}</span>
                      </div>
                    </div>
                    {/* ⛔ SEM LIMITE INFORMADO = SEM BARRA. Nunca um teto inventado. */}
                    {c.usoPct != null ? (
                      <>
                        <div className="mt-2 h-[7px] overflow-hidden rounded-full" style={{ background: M.line }}>
                          <i className="block h-full rounded-full" style={{
                            width: `${Math.min(100, c.usoPct)}%`,
                            background: c.usoPct >= 70 ? 'linear-gradient(90deg,#e5484d,#f87171)'
                              : c.usoPct >= 40 ? 'linear-gradient(90deg,#534AB7,#8b7ee6)'
                                : 'linear-gradient(90deg,#16a34a,#4ade80)',
                          }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[10.5px]" style={{ color: M.sub }}>
                          <span>{c.usoPct}% do limite usado</span><span>disponível {brl(c.disponivel!)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-[10.5px]" style={{ color: M.sub }}>
                        sem limite cadastrado — <Link href={`/perfis/${profileId}/cartoes/${c.cardId}/editar`} style={{ color: M.roxo }}>informar</Link>
                      </p>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {/* ── BALANÇO ─────────────────────────────────────────────────── */}
            <Card>
              <H3>Balanço mensal</H3>
              <Balanco meses={d.balanco} oculto={oculto} sobrou={d.sobrou} curto={curto} />
            </Card>

            {/* ── A VENCER ────────────────────────────────────────────────── */}
            {/* ⛔ só fatura CONHECIDA — recorrente é Fase 2, sem placeholder fingindo */}
            {d.aVencer.length > 0 && (
              <Card>
                <H3>Contas a vencer</H3>
                {d.aVencer.map((a, i) => {
                  const v = new Date(a.vencimento)
                  const atrasada = a.diasDeAtraso > 0
                  return (
                    <div key={i} className="flex items-center gap-[11px] py-[9px] text-[13.5px]" style={{ borderTop: i ? `1px solid ${M.line}` : undefined }}>
                      <span className="w-[42px] shrink-0 rounded-[11px] py-1 text-center text-[13px] font-extrabold"
                        style={atrasada ? { background: M.coralFraco, color: M.coral } : { background: M.bg }}>
                        {atrasada ? 'HOJE' : v.getUTCDate()}
                        {!atrasada && <small className="block text-[8.5px] font-bold uppercase" style={{ color: M.sub }}>{MESES[v.getUTCMonth()].slice(0, 3)}</small>}
                      </span>
                      <span className="flex-1 font-semibold">
                        {a.nome}{a.estimada && <small style={{ color: M.sub }}> (estimada)</small>}
                        {atrasada && <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: M.coralFraco, color: M.coral }}>atrasada {a.diasDeAtraso}d</span>}
                      </span>
                      <span className="font-extrabold">{a.estimada && '~'}{brl(a.valor, true)}</span>
                    </div>
                  )
                })}
              </Card>
            )}

            {/* ── ÚLTIMOS LANÇAMENTOS ─────────────────────────────────────── */}
            {d.ultimos.length > 0 && (
              <Card>
                <H3 link={{ href: `/perfis/${profileId}/transacoes`, texto: 'extrato →' }}>Últimos lançamentos</H3>
                {d.ultimos.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-[11px] py-[9px]" style={{ borderTop: i ? `1px solid ${M.line}` : undefined }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
                      style={{ background: t.valorComSinal >= 0 ? M.verdeFraco : M.roxoFraco }}>
                      {t.ehPagamentoDeFatura ? '💳' : t.temPonte ? '💼' : t.valorComSinal >= 0 ? '📈' : '🛒'}
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold">
                      <span className="truncate">{t.descricao}</span>
                      {/* ⭐ os selos de vínculo — só quando o vínculo EXISTE */}
                      {t.casou && <Selo>casou ✓</Selo>}
                      {t.temPonte && !t.casou && <Selo>ponte PJ ✓</Selo>}
                      <small className="block text-[11px] font-medium" style={{ color: M.sub }}>
                        {dia(t.data)}{t.categoriaNome ? ` · ${t.categoriaNome}` : ''}
                      </small>
                    </span>
                    <span className="whitespace-nowrap text-[13.5px] font-extrabold" style={{ color: t.valorComSinal >= 0 ? M.verde : M.ink }}>
                      {t.valorComSinal >= 0 ? '+ ' : '− '}{brl(t.valorComSinal, true)}
                    </span>
                  </div>
                ))}
              </Card>
            )}

            {d.vazio && <Card><p className="text-center text-[13px] italic" style={{ color: M.sub }}>{d.vazio}</p></Card>}
          </>
        )}
      </div>

      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      <button onClick={() => setFab(true)}
        className="fixed bottom-[22px] right-[18px] flex h-14 w-14 items-center justify-center rounded-full text-[28px] text-white sm:right-[calc(50%-220px)]"
        style={{ background: `linear-gradient(140deg,${M.roxo},${M.roxo2})`, boxShadow: '0 8px 22px rgba(83,74,183,.4)' }}>
        ＋
      </button>
      {fab && <LancamentoRapido profileId={profileId} contas={d?.contas ?? []} aoFechar={() => setFab(false)} aoSalvar={() => { setFab(false); void carregar() }} />}
    </div>
  )
}

function Card({ children, estilo }: { children: React.ReactNode; estilo?: React.CSSProperties }) {
  return <div className="mb-3 rounded-[18px] p-4" style={{ background: M.card, boxShadow: M.sombra, ...estilo }}>{children}</div>
}
function H3({ children, link }: { children: React.ReactNode; link?: { href: string; texto: string } }) {
  return (
    <h3 className="mb-3 flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[.04em]" style={{ color: M.sub }}>
      {children}
      {link && <Link href={link.href} className="text-[11.5px] font-bold normal-case tracking-normal" style={{ color: M.roxo }}>{link.texto}</Link>}
    </h3>
  )
}
function Duo({ icone, fundo, rotulo, valor, cor }: { icone: string; fundo: string; rotulo: string; valor: string; cor: string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: M.card, boxShadow: M.sombra }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[17px]" style={{ background: fundo }}>{icone}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold" style={{ color: M.sub }}>{rotulo}</div>
        <div className="truncate text-[16.5px] font-extrabold" style={{ color: cor }}>{valor}</div>
      </div>
    </div>
  )
}
function Selo({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 rounded-full px-1.5 py-px align-middle text-[9px] font-extrabold" style={{ background: M.verdeFraco, color: M.verde }}>{children}</span>
}

/** ⭐ o donut do mock — SVG puro, fatias na ordem e cores do arquivo */
function Donut({ fatias, total, rotuloTotal }: { fatias: { valor: number; cor: string }[]; total: number; rotuloTotal: string }) {
  const C = 2 * Math.PI * 46
  let acc = 0
  return (
    <svg viewBox="0 0 120 120" style={{ width: 118, flexShrink: 0 }}>
      <circle cx="60" cy="60" r="46" fill="none" stroke={M.line} strokeWidth="16" />
      {fatias.map((f, i) => {
        const len = total > 0 ? (f.valor / total) * C : 0
        const off = -acc
        acc += len
        return <circle key={i} cx="60" cy="60" r="46" fill="none" stroke={f.cor} strokeWidth="16"
          strokeDasharray={`${len} ${C}`} strokeDashoffset={off} transform="rotate(-90 60 60)" strokeLinecap="round" />
      })}
      <text x="60" y="56" textAnchor="middle" fontSize="11" fill={M.sub} fontWeight="600">total</text>
      <text x="60" y="72" textAnchor="middle" fontSize="14" fontWeight="800" fill={M.ink}>{rotuloTotal}</text>
    </svg>
  )
}

/** ⭐ o balanço dos 4 meses — barras verde/coral, o mês atual em cor cheia */
function Balanco({ meses, sobrou, curto, oculto }: {
  meses: { rotulo: string; entrou: number; saiu: number; atual: boolean }[]
  sobrou: number; curto: (n: number) => string; oculto: boolean
}) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.entrou, m.saiu]))
  const alt = (v: number) => Math.max(3, Math.round((v / max) * 92))
  return (
    <svg viewBox="0 0 420 150" className="block w-full">
      {meses.map((m, i) => {
        const x = 30 + i * 100
        return (
          <g key={m.rotulo}>
            <rect x={x} y={120 - alt(m.entrou)} width="26" height={alt(m.entrou)} rx="6" fill={m.atual ? '#16a34a' : '#4ade80'} />
            <rect x={x + 30} y={120 - alt(m.saiu)} width="26" height={alt(m.saiu)} rx="6" fill={m.atual ? '#e5484d' : '#fca5a5'} />
            <text x={x + 28} y="138" fontSize="11" fill={M.sub} textAnchor="middle" fontWeight="600">{m.rotulo}</text>
          </g>
        )
      })}
      {!oculto && (
        <text x="358" y="20" fontSize="10.5" fontWeight="800" fill={sobrou >= 0 ? M.verde : M.coral} textAnchor="middle">
          {sobrou >= 0 ? 'sobrou' : 'faltou'} {curto(sobrou)} {sobrou >= 0 ? '⭐' : '⚠'}
        </text>
      )}
    </svg>
  )
}
