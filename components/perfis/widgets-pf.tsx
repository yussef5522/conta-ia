'use client'

// ⭐⭐⭐ OS WIDGETS DA PF — UM SÓ POR PERGUNTA, DUAS COMPOSIÇÕES (13/09/2026).
//
// **O dono:** *"os widgets são OS MESMOS componentes do mobile (fonte única de widget! —
// muda o LAYOUT, nunca o conteúdo)"*.
//
// ⛔⛔ **É a lição do B1 aplicada à TELA:** se o celular e o desktop tivessem cada um o seu
// card de cartões, eles divergiriam no primeiro selo novo — e o dono veria um número no
// bolso e outro no monitor, sobre o mesmo dinheiro. Aqui o layout é a única coisa que muda.

import Link from 'next/link'
import type { DashboardPF } from '@/lib/pf-dashboard/dashboard'

/** ⭐ os tokens do mock (`docs/mocks/pf-dashboard-mock.html`), literais */
export const M = {
  bg: '#f4f4f8', card: '#fff', ink: '#1c2030', sub: '#7a8095', line: '#ebebf2',
  roxo: '#534AB7', roxo2: '#6f63d8', roxoFraco: '#eeecfa',
  verde: '#16a34a', verdeFraco: '#e8f7ee', coral: '#e5484d', coralFraco: '#fdecec',
  ambar: '#d97706', ambarFraco: '#fdf3e3',
  sombra: '0 1px 3px rgba(28,32,48,.06), 0 6px 20px rgba(28,32,48,.05)',
} as const

export const GRADIENTE_HERO = 'linear-gradient(150deg,#4c42b3 0%,#6f63d8 60%,#8b7ee6 100%)'
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const andar = (m: string, n: number) => { const dt = new Date(`${m}-15T12:00:00Z`); dt.setUTCMonth(dt.getUTCMonth() + n); return dt.toISOString().slice(0, 7) }
export const nomeMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1]
export const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite' }

export interface Dados extends DashboardPF {
  nome: string
  contas: { id: string; name: string; balance: number }[]
  ultimos: { id: string; data: string; descricao: string; valorComSinal: number; categoriaNome: string | null; ehPagamentoDeFatura: boolean; temPonte: boolean; casou: boolean }[]
}
export interface Fmt { brl: (n: number, semSimbolo?: boolean) => string; curto: (n: number) => string; oculto: boolean }

/**
 * ⚠️ `hover` só no desktop (`lg:`): no celular o :hover de touch GRUDA — o card fica com a
 * sombra levantada depois do toque e parece selecionado. Desktop tem mouse; celular não.
 */
export function Card({ children, estilo, clicavel }: { children: React.ReactNode; estilo?: React.CSSProperties; clicavel?: boolean }) {
  return (
    <div className={`mb-3 rounded-[18px] p-4 lg:mb-0 lg:transition-shadow ${clicavel ? 'lg:hover:shadow-lg lg:cursor-pointer' : 'lg:hover:shadow-md'}`}
      style={{ background: M.card, boxShadow: M.sombra, ...estilo }}>{children}</div>
  )
}

export function H3({ children, link }: { children: React.ReactNode; link?: { href: string; texto: string } }) {
  return (
    <h3 className="mb-3 flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[.04em]" style={{ color: M.sub }}>
      {children}
      {link && <Link href={link.href} className="text-[11.5px] font-bold normal-case tracking-normal hover:underline" style={{ color: M.roxo }}>{link.texto}</Link>}
    </h3>
  )
}

/** ⭐ o SALDO — banner no celular, CARD ROXO no cockpit. Mesmo conteúdo. */
export function WSaldo({ d, f, comoCard }: { d: Dados | null; f: Fmt; comoCard?: boolean }) {
  const corpo = (
    <>
      <div className="text-[11.5px] tracking-[.03em] opacity-80">SALDO NAS CONTAS</div>
      <div className="my-0.5 text-[34px] font-extrabold tracking-[-.01em]">
        {f.oculto ? '••••••' : (
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
          🔮 previsto pro fim do mês: <b>{f.brl(d.previstoFimDoMes)}</b>{d.faturasNoPrevisto > 0 && ' (após faturas)'}
        </span>
      )}
    </>
  )
  if (!comoCard) return <div className="text-center">{corpo}</div>
  return (
    <div className="rounded-[18px] p-5 text-white lg:transition-shadow lg:hover:shadow-lg"
      style={{ background: GRADIENTE_HERO, boxShadow: M.sombra }}>{corpo}</div>
  )
}

/** ⭐ ENTROU · SAIU · SOBROU — dois cards no celular, um bloco de fluxo no cockpit */
export function WFluxo({ d, f, comCard }: { d: Dados | null; f: Fmt; comCard?: boolean }) {
  const linha = (
    <div className="flex gap-2.5">
      <Duo icone="📈" fundo={M.verdeFraco} rotulo="RECEITAS" valor={f.brl(d?.entrou ?? 0)} cor={M.verde} solto={!comCard} />
      <Duo icone="📉" fundo={M.coralFraco} rotulo="DESPESAS" valor={f.brl(d?.saiu ?? 0)} cor={M.coral} solto={!comCard} />
    </div>
  )
  if (!comCard) return linha
  return (
    <Card>
      <H3>Fluxo do mês</H3>
      {linha}
      <div className="mt-3 flex items-baseline justify-between border-t pt-3" style={{ borderColor: M.line }}>
        <span className="text-[12px] font-semibold" style={{ color: M.sub }}>SOBROU</span>
        <span className="text-[22px] font-extrabold" style={{ color: (d?.sobrou ?? 0) >= 0 ? M.verde : M.coral }}>{f.brl(d?.sobrou ?? 0)}</span>
      </div>
    </Card>
  )
}

function Duo({ icone, fundo, rotulo, valor, cor, solto }: { icone: string; fundo: string; rotulo: string; valor: string; cor: string; solto?: boolean }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-3"
      style={solto ? { background: M.card, boxShadow: M.sombra } : { background: M.bg }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[17px]" style={{ background: fundo }}>{icone}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold" style={{ color: M.sub }}>{rotulo}</div>
        <div className="truncate text-[16.5px] font-extrabold" style={{ color: cor }}>{valor}</div>
      </div>
    </div>
  )
}

export function WEmpresa({ d, f }: { d: Dados; f: Fmt }) {
  if (d.recebidoDaEmpresa.transferencias === 0) return null
  return (
    <Card estilo={{ background: 'linear-gradient(135deg,#eeecfa,#e8f7ee)' }}>
      <H3>💼 Recebido da empresa</H3>
      <div className="text-[23px] font-extrabold">{f.brl(d.recebidoDaEmpresa.total)}</div>
      <div className="mt-0.5 text-[12px]" style={{ color: M.sub }}>
        {d.recebidoDaEmpresa.transferencias} transferência{d.recebidoDaEmpresa.transferencias > 1 ? 's' : ''} no mês · espelhadas na empresa ✓
      </div>
    </Card>
  )
}

/** ⭐ o DONUT — no cockpit ele cresce e a legenda fica ao lado; o conteúdo é o mesmo */
export function WDonut({ d, f, grande }: { d: Dados; f: Fmt; grande?: boolean }) {
  // ⛔ zero widget sem dado: sem gasto, o donut não aparece
  if (d.donut.length === 0) return null
  return (
    <Card>
      <H3>Despesas por categoria</H3>
      <div className="flex items-center gap-4">
        <Donut fatias={d.donut} total={d.saiu} rotuloTotal={f.curto(d.saiu)} tamanho={grande ? 168 : 118} />
        <div className="min-w-0 flex-1">
          {d.donut.map((x) => (
            <div key={x.nome} className="mb-[7px] flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: x.cor }} />
              <span className="min-w-0 flex-1 truncate" style={{ color: x.semCategoria ? M.ambar : M.ink, fontWeight: x.semCategoria ? 700 : 400 }}>
                {x.nome}{x.semCategoria && ' ⚠'}
              </span>
              <span className="font-extrabold">{x.pct}%</span>
              <span className="w-[58px] text-right text-[11.5px]" style={{ color: M.sub }}>{f.curto(x.valor)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export function WCartoes({ d, f, profileId }: { d: Dados; f: Fmt; profileId: string }) {
  if (d.cartoes.length === 0) return null
  return (
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
              {f.brl(c.emAberto, true)}
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
                <span>{c.usoPct}% do limite usado</span><span>disponível {f.brl(c.disponivel!)}</span>
              </div>
            </>
          ) : (
            <p className="mt-1 text-[10.5px]" style={{ color: M.sub }}>
              sem limite cadastrado — <Link href={`/perfis/${profileId}/cartoes/${c.cardId}/editar`} className="hover:underline" style={{ color: M.roxo }}>informar</Link>
            </p>
          )}
        </div>
      ))}
    </Card>
  )
}

/** ⭐ o BALANÇO — 4 meses no bolso, 6 no monitor. O PAYLOAD é o mesmo; a tela corta. */
export function WBalanco({ d, f, meses }: { d: Dados; f: Fmt; meses: number }) {
  const lista = d.balanco.slice(-meses)
  const max = Math.max(1, ...lista.flatMap((m) => [m.entrou, m.saiu]))
  const alt = (v: number) => Math.max(3, Math.round((v / max) * 92))
  const passo = 400 / Math.max(1, lista.length)
  return (
    <Card>
      <H3>Balanço mensal</H3>
      <svg viewBox="0 0 420 150" className="block w-full">
        {lista.map((m, i) => {
          const x = 20 + i * passo
          const larg = Math.min(26, passo / 2.6)
          return (
            <g key={m.mes}>
              <rect x={x} y={120 - alt(m.entrou)} width={larg} height={alt(m.entrou)} rx="6" fill={m.atual ? '#16a34a' : '#4ade80'} />
              <rect x={x + larg + 4} y={120 - alt(m.saiu)} width={larg} height={alt(m.saiu)} rx="6" fill={m.atual ? '#e5484d' : '#fca5a5'} />
              <text x={x + larg + 2} y="138" fontSize="11" fill={M.sub} textAnchor="middle" fontWeight="600">{m.rotulo}</text>
            </g>
          )
        })}
        {!f.oculto && (
          <text x="358" y="20" fontSize="10.5" fontWeight="800" fill={d.sobrou >= 0 ? M.verde : M.coral} textAnchor="middle">
            {d.sobrou >= 0 ? 'sobrou' : 'faltou'} {f.curto(d.sobrou)} {d.sobrou >= 0 ? '⭐' : '⚠'}
          </text>
        )}
      </svg>
    </Card>
  )
}

export function WAVencer({ d, f }: { d: Dados; f: Fmt }) {
  // ⛔ só fatura CONHECIDA — recorrente é Fase 2, sem placeholder fingindo
  if (d.aVencer.length === 0) return null
  return (
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
            <span className="font-extrabold">{a.estimada && '~'}{f.brl(a.valor, true)}</span>
          </div>
        )
      })}
    </Card>
  )
}

export function WUltimos({ d, f, profileId }: { d: Dados; f: Fmt; profileId: string }) {
  if (d.ultimos.length === 0) return null
  return (
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
            {t.valorComSinal >= 0 ? '+ ' : '− '}{f.brl(t.valorComSinal, true)}
          </span>
        </div>
      ))}
    </Card>
  )
}

function Selo({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 rounded-full px-1.5 py-px align-middle text-[9px] font-extrabold" style={{ background: M.verdeFraco, color: M.verde }}>{children}</span>
}

function Donut({ fatias, total, rotuloTotal, tamanho }: { fatias: { valor: number; cor: string }[]; total: number; rotuloTotal: string; tamanho: number }) {
  const C = 2 * Math.PI * 46
  let acc = 0
  return (
    <svg viewBox="0 0 120 120" style={{ width: tamanho, flexShrink: 0 }}>
      <circle cx="60" cy="60" r="46" fill="none" stroke={M.line} strokeWidth="16" />
      {fatias.map((x, i) => {
        const len = total > 0 ? (x.valor / total) * C : 0
        const off = -acc
        acc += len
        return <circle key={i} cx="60" cy="60" r="46" fill="none" stroke={x.cor} strokeWidth="16"
          strokeDasharray={`${len} ${C}`} strokeDashoffset={off} transform="rotate(-90 60 60)" strokeLinecap="round" />
      })}
      <text x="60" y="56" textAnchor="middle" fontSize="11" fill={M.sub} fontWeight="600">total</text>
      <text x="60" y="72" textAnchor="middle" fontSize="14" fontWeight="800" fill={M.ink}>{rotuloTotal}</text>
    </svg>
  )
}
