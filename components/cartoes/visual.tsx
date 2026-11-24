// ⭐⭐⭐ CARTÕES v3 — as peças visuais DA LEI (docs/cartoes-referencia.html, R44–R52 · 24/11/2026).
//
// Puras (props → markup): a página e a fatura montam com elas, e o guard tela × lei RENDERIZA
// cada uma com dado de verdade e confere o que sai (uso, não menção).
// Visual da lei: sombras SEM borda (`--cart-sombra`), chip por banco em GRADIENTE sem logo
// (`GRADIENTE_DO_BANCO`), cifras grandes, selo do ciclo, escala única nas barras.
// ⚠️ Celular (R52): nada aqui tem largura mínima maior que a tela; texto longo trunca.

import type { ReactNode } from 'react'
import { formatBRL } from '@/lib/format/money'
import {
  brl0, venceEm, diasAte, rotuloFatura, rotuloMes, rotuloMesAno, classeDoBanco, GRADIENTE_DO_BANCO,
  datasDoCiclo, mesSoma, type EstadoCiclo,
} from '@/lib/credit-card-pj/ciclo'
import type { Carteira, CartaoNaCarteira } from '@/lib/credit-card-pj/carteira'

export const SOMBRA = { boxShadow: 'var(--cart-sombra)' }
export const SOMBRA_CC = { boxShadow: 'var(--cart-sombra-cc)' }
export const ROT = 'text-[9.5px] font-extrabold uppercase tracking-[0.08em]'
const ddmmm = (iso: string) => `${iso.slice(8, 10)}/${rotuloMes(iso.slice(0, 7))}`

/* ── R45: chip por banco (bandeira em TEXTO, nunca logo) ── */
export function Chip({ bankName, brand, lastDigits, pequeno = false }: { bankName: string | null; brand: string | null; lastDigits: string | null; pequeno?: boolean }) {
  const [a, b] = GRADIENTE_DO_BANCO[classeDoBanco(bankName)]
  return (
    <div
      data-chip={classeDoBanco(bankName)}
      className={`relative flex flex-none flex-col justify-between overflow-hidden rounded-[12px] px-[7px] py-[5px] text-[color:var(--cart-chip-tinta)] ${pequeno ? 'h-[43px] w-[62px]' : 'h-[54px] w-[84px]'}`}
      style={{ background: `linear-gradient(135deg,${a},${b})`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22), 0 4px 10px rgba(10,15,30,.18)' }}
    >
      <span aria-hidden className="pointer-events-none absolute left-[-25%] top-[-60%] h-[160%] w-[80%] rotate-[18deg]" style={{ background: 'radial-gradient(closest-side,rgba(255,255,255,.28),transparent 70%)' }} />
      <span className="relative text-[8px] font-extrabold uppercase tracking-[0.08em] opacity-85">{brand ?? 'cartão'}</span>
      <span className="num relative text-[10.5px] font-bold tracking-[0.12em]">•••• {lastDigits ?? '----'}</span>
    </div>
  )
}

/* ── R45/R46: o selo do CICLO ── */
const SELO: Record<EstadoCiclo, { txt: string; bg: string; cor: string }> = {
  paga: { txt: '✓ Paga', bg: 'var(--esc-verde50)', cor: 'var(--esc-verde-t)' },
  aberta: { txt: '● Aberta', bg: 'var(--esc-indigo50)', cor: 'var(--esc-indigo-t)' },
  fechada: { txt: '● Fechada', bg: 'var(--esc-ambar50)', cor: 'var(--esc-ambar-t)' },
  parcial: { txt: '◐ Parcial', bg: 'var(--esc-roxo50)', cor: 'var(--esc-roxo-t)' },
}
export function Selo({ estado, className = '' }: { estado: EstadoCiclo; className?: string }) {
  const s = SELO[estado]
  return (
    <span data-selo={estado} className={`inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full px-[10px] py-[3px] text-[10.5px] font-extrabold ${className}`} style={{ background: s.bg, color: s.cor }}>
      {s.txt}
    </span>
  )
}

/* ── R44: o dinheiro na cara ── */
function Kpi({ tinta, rotCor, rot, children }: { tinta: string; rotCor: string; rot: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[20px] px-[18px] py-4" style={{ ...SOMBRA, background: tinta }}>
      <div className={ROT} style={{ color: rotCor }}>{rot}</div>
      {children}
    </div>
  )
}
export function Hero({ carteira, hrefAPagar }: { carteira: Carteira; hrefAPagar: string | null }) {
  const h = carteira.hero
  const maxm = Math.max(1, ...h.comprometido.porMes.map((m) => m.valor))
  // ⛔ R53 — o limite conta só os cartões ATIVOS (encerrado não tem limite)
  const n = h.limite.cartoes
  return (
    <div data-testid="hero-cartoes" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi tinta="var(--cart-t-amb)" rotCor="var(--esc-ambar-t)" rot="A pagar agora">
        <div className="num mt-[5px] truncate text-[20px] font-extrabold tracking-[-0.02em] sm:text-[24px]" style={{ color: 'var(--esc-ambar)' }}>{formatBRL(h.aPagar.valor)}</div>
        <div className="num mt-[3px] text-[11px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>
          {h.aPagar.banco && h.aPagar.dias != null
            ? <><b style={{ color: 'var(--esc-tinta2)' }}>{h.aPagar.banco.toLowerCase()}</b> · {venceEm(h.aPagar.dias)}{hrefAPagar && <> · <a href={hrefAPagar} className="font-extrabold no-underline" style={{ color: 'var(--esc-indigo)' }}>ver →</a></>}</>
            : 'nenhuma fatura fechada em aberto'}
        </div>
      </Kpi>
      <Kpi tinta="var(--cart-t-ind)" rotCor="var(--esc-indigo-t)" rot="Faturas abertas">
        <div className="num mt-[5px] truncate text-[20px] font-extrabold tracking-[-0.02em] sm:text-[24px]" style={{ color: 'var(--esc-tinta)' }}>{formatBRL(h.abertas.valor)}</div>
        <div className="num mt-[3px] text-[11px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>
          {h.abertas.cartoes} {h.abertas.cartoes === 1 ? 'cartão acumulando' : 'cartões acumulando'} · parcelas já lançadas · <a href="#cartoes" className="font-extrabold no-underline" style={{ color: 'var(--esc-indigo)' }}>ver →</a>
        </div>
      </Kpi>
      <Kpi tinta="var(--cart-t-rox)" rotCor="var(--esc-roxo-t)" rot="Comprometido em parcelas">
        <div className="num mt-[5px] truncate text-[20px] font-extrabold tracking-[-0.02em] sm:text-[24px]" style={{ color: 'var(--esc-tinta)' }}>{brl0(h.comprometido.valor)}</div>
        <div data-testid="mini-comprometido" className="mt-2 flex h-10 items-end gap-[5px]">
          {h.comprometido.porMes.map((m, k) => (
            <div key={m.mes} className="flex flex-1 flex-col items-center gap-[3px]" title={`${rotuloMesAno(m.mes)} · ${formatBRL(m.valor)}`}>
              <i className="block w-full rounded-t-[3px]" style={{ height: Math.round((m.valor / maxm) * 30), background: k === 0 ? 'var(--cart-barra)' : 'var(--esc-pt-borda)' }} />
              <span className="num text-[8px] font-extrabold" style={{ color: 'var(--esc-tinta3)' }}>{rotuloMes(m.mes)}</span>
            </div>
          ))}
        </div>
      </Kpi>
      <Kpi tinta="var(--cart-t-ver)" rotCor="var(--esc-verde-t)" rot={`Limite ${n === 1 ? 'do cartão' : `dos ${n} cartões`}`}>
        <div className="num mt-[5px] text-[20px] font-extrabold tracking-[-0.02em] sm:text-[24px]" style={{ color: 'var(--esc-tinta)' }}>
          {brl0(h.limite.disponivel)} <span className="text-[11px] font-extrabold" style={{ color: 'var(--esc-tinta3)' }}>livres de {brl0(h.limite.total)}</span>
        </div>
        <div className="mt-[11px] h-[10px] overflow-hidden rounded-full" style={{ background: 'var(--esc-trilho2)' }}>
          <i className="block h-full rounded-full" style={{ width: `${Math.round(h.limite.usoPct * 100)}%`, background: 'var(--cart-lim)' }} />
        </div>
        <div className="num mt-[3px] text-[11px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>{Math.round(h.limite.usoPct * 100)}% usado</div>
      </Kpi>
    </div>
  )
}

/* ── a linha do mês: fechamentos, vencimentos e "hoje" ── */
export interface EventoDoMes { dia: number; tx: string; cls: 'ok' | 'vc' | 'hoje' | '' }
export function eventosDoMes(c: Carteira): { mes: string; dias: number; eventos: EventoDoMes[] } {
  const mes = c.hoje.slice(0, 7)
  const dias = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate()
  const ev: EventoDoMes[] = []
  for (const k of c.cartoes) {
    const b = (k.bankName ?? k.name).toLowerCase()
    for (const m of [mesSoma(mes, -1), mes, mesSoma(mes, 1)]) {
      const d = datasDoCiclo(m, k.closingDay, k.dueDay)
      if (d.fechamento.startsWith(mes)) ev.push({ dia: Number(d.fechamento.slice(8, 10)), tx: d.fechamento < c.hoje ? `${b} fechou` : `${b} fecha`, cls: d.fechamento < c.hoje ? 'ok' : '' })
      if (d.vencimento.startsWith(mes)) {
        const f = k.faturas.find((x) => x.mes === m)
        ev.push(f?.estado === 'paga' ? { dia: Number(d.vencimento.slice(8, 10)), tx: `${b} paga`, cls: 'ok' } : { dia: Number(d.vencimento.slice(8, 10)), tx: `${b} vence`, cls: 'vc' })
      }
    }
  }
  ev.push({ dia: Number(c.hoje.slice(8, 10)), tx: 'hoje', cls: 'hoje' })
  ev.sort((a, b) => a.dia - b.dia)
  return { mes, dias, eventos: ev }
}
const BORDA_DO_PONTO: Record<EventoDoMes['cls'], string> = { ok: 'var(--esc-verde)', vc: 'var(--esc-ambar)', hoje: 'var(--esc-tinta)', '': 'var(--esc-indigo)' }
export function Trilho({ eventos, posicao, altura = 66, id }: { eventos: (EventoDoMes & { chave?: string })[]; posicao: (e: EventoDoMes) => number; altura?: number; id?: string }) {
  const meio = altura === 66 ? 32 : 24
  return (
    <div id={id} className="relative mx-3" style={{ height: altura }}>
      <div className="absolute left-0 right-0 h-[2px]" style={{ top: meio, background: 'var(--esc-abas)' }} />
      {eventos.map((e, i) => {
        const alt = i % 2 === 1
        const hoje = e.cls === 'hoje'
        return (
          <div key={(e.chave ?? '') + e.tx + i} data-evento={e.cls || 'futuro'} className="absolute w-0" style={{ left: `${Math.min(100, Math.max(0, posicao(e))).toFixed(1)}%`, top: meio }}>
            <div className="absolute left-0 -translate-x-1/2 rounded-full"
              style={hoje
                ? { top: -4, width: 9, height: 9, background: 'var(--esc-tinta)' }
                : { top: -6, width: 13, height: 13, background: 'var(--esc-card)', border: `3px solid ${BORDA_DO_PONTO[e.cls]}` }} />
            <div className={`num absolute left-0 -translate-x-1/2 whitespace-nowrap text-[9px] font-extrabold ${hoje || e.cls === 'vc' ? '' : 'hidden sm:block'}`}
              style={{ ...(alt ? { bottom: 13 } : { top: 13 }), color: hoje ? 'var(--esc-tinta)' : 'var(--esc-tinta2)' }}>{e.tx}</div>
          </div>
        )
      })}
    </div>
  )
}
export function LinhaDoMes({ carteira }: { carteira: Carteira }) {
  const { mes, dias, eventos } = eventosDoMes(carteira)
  const nome = rotuloFatura(mes).split('/')[0]
  return (
    <div className="mt-4 rounded-[20px] px-[18px] pb-[17px] pt-[15px]" style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
      <div className={`${ROT} mb-[10px]`} style={{ color: 'var(--esc-tinta3)' }}>{nomeCheio(nome)} · fechamentos e vencimentos</div>
      <Trilho id="trilho-mes" eventos={eventos} posicao={(e) => (e.dia / dias) * 100} />
    </div>
  )
}
const CHEIO: Record<string, string> = { Jan: 'Janeiro', Fev: 'Fevereiro', Mar: 'Março', Abr: 'Abril', Mai: 'Maio', Jun: 'Junho', Jul: 'Julho', Ago: 'Agosto', Set: 'Setembro', Out: 'Outubro', Nov: 'Novembro', Dez: 'Dezembro' }
const nomeCheio = (r: string) => CHEIO[r] ?? r

/* ── R45: o cartão-objeto ── */
export function textoDoVencimento(k: CartaoNaCarteira, hoje: string): { txt: string; tom: 'alerta' | 'ok' | 'neutro' } {
  const f = k.atual
  if (!f) return { txt: 'nenhuma fatura importada', tom: 'neutro' }
  if (f.estado === 'paga') return { txt: `paga em ${ddmmm(f.pagamentos[0]?.data ?? f.vencimento)}`, tom: 'ok' }
  if (f.estado === 'parcial') return { txt: `pagos ${formatBRL(f.pago)} · restam ${formatBRL(f.total - f.pago)}`, tom: 'neutro' }
  // fechada: sem pagamento casado — o pulso âmbar
  return { txt: `${venceEm(diasAte(hoje, f.vencimento))} · sem pagamento casado`, tom: 'alerta' }
}

/** R53 — "04/2027" */
const mmaaaa = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`
/** R53 — a régua de QUITAÇÃO do cartão encerrado (no lugar da régua do disponível) */
export function textoDaQuitacao(q: NonNullable<CartaoNaCarteira['quitacao']>): string {
  if (q.quitado) return 'quitado — nada mais a pagar'
  const n = `${q.parcelas} ${q.parcelas === 1 ? 'parcela' : 'parcelas'}`
  return `falta quitar ${formatBRL(q.falta)} · ${n}${q.ultima ? ` · última em ${mmaaaa(q.ultima)}` : ''}`
}

export function CartaoObjeto({ k, hoje, hrefFatura, menu, onMenu, onArquivar }: {
  k: CartaoNaCarteira; hoje: string; hrefFatura: string
  /** o menu ⋯ aberto (editar · arquivar · excluir), ou null */
  menu: ReactNode | null
  onMenu: () => void
  /** R53 — cartão quitado propõe arquivar com UM clique */
  onArquivar?: () => void
}) {
  const v = textoDoVencimento(k, hoje)
  const banco = k.bankName ?? k.name
  const sub = [k.name !== banco ? k.name : null, `fecha dia ${k.closingDay}`].filter(Boolean).join(' · ')
  return (
    <div data-testid="cartao-objeto" className="relative min-w-0 rounded-[22px] p-[18px]" style={{ ...SOMBRA_CC, background: 'var(--esc-card)' }}>
      <div className="flex items-center gap-3">
        <div className="relative flex-none">
          <Chip bankName={k.bankName} brand={k.brand} lastDigits={k.lastDigits} />
          {k.encerradoEm && (
            <span data-testid="selo-encerrado" className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-[7px] py-[1px] text-[8.5px] font-extrabold"
              style={{ background: 'var(--esc-tinta)', color: 'var(--esc-on)' }}>{k.quitacao?.quitado ? 'Encerrado · quitado' : 'Encerrado · em quitação'}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-extrabold" style={{ color: 'var(--esc-tinta)' }}>{banco}</div>
          <div className="truncate text-[10.5px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>{sub}</div>
        </div>
        <span className="ml-auto" />
        {k.atual && <Selo estado={k.atual.estado} />}
        <button type="button" aria-label={`opções do cartão ${banco}`} onClick={onMenu}
          className="ml-2 h-[30px] w-[30px] flex-none rounded-[10px] text-[15px] font-extrabold" style={{ background: 'var(--esc-trilho)', color: 'var(--esc-tinta3)' }}>⋯</button>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-[9px] gap-y-1">
        <span className={ROT} style={{ color: 'var(--esc-tinta3)' }}>{k.atual ? `${rotuloFatura(k.atual.mes)}${k.atual.quitacao ? ' · quitação' : ''}` : 'sem fatura'}</span>
        <span className="num whitespace-nowrap text-[24px] font-extrabold tracking-[-0.015em] sm:text-[28px]" style={{ color: 'var(--esc-tinta)' }}>{k.atual ? formatBRL(k.atual.total) : '—'}</span>
        <span data-vencimento={v.tom} className="num ml-auto inline-flex items-center gap-[6px] text-[11.5px] font-extrabold"
          style={{ color: v.tom === 'alerta' ? 'var(--esc-ambar)' : v.tom === 'ok' ? 'var(--esc-verde-t)' : 'var(--esc-tinta2)' }}>
          {v.tom === 'alerta' && <span aria-hidden className="cart-pulso h-[7px] w-[7px] rounded-full" style={{ background: 'var(--esc-ambar)' }} />}
          {v.txt}
        </span>
      </div>
      {k.quitacao ? (
        // ⭐ R53 — encerrado: a régua do disponível vira régua de QUITAÇÃO (o limite morreu com o cartão)
        <div data-testid="regua-quitacao" className="num mt-[10px] flex flex-wrap items-center gap-2 rounded-[11px] px-3 py-2 text-[11.5px] font-extrabold"
          style={k.quitacao.quitado ? { background: 'var(--esc-verde50)', color: 'var(--esc-verde-t)' } : { background: 'var(--esc-trilho)', color: 'var(--esc-tinta2)' }}>
          <span className="min-w-0 flex-1">{textoDaQuitacao(k.quitacao)}</span>
          {k.quitacao.quitado && onArquivar && (
            <button type="button" onClick={onArquivar} className="rounded-[8px] px-[10px] py-[3px] text-[11px] font-extrabold" style={{ background: 'var(--esc-verde-t)', color: 'var(--esc-on)' }}>arquivar</button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-[10px] h-[10px] overflow-hidden rounded-full" style={{ background: 'var(--esc-trilho2)' }}>
            <i className="block h-full rounded-full" style={{ width: `${Math.round(k.usoPct * 100)}%`, background: 'var(--cart-lim)' }} />
          </div>
          <div className="num mt-[5px] flex flex-wrap justify-between gap-x-3 text-[10.5px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>
            <span>{k.aberta.total > 0
              ? <><b style={{ color: 'var(--esc-tinta2)' }}>{brl0(k.aberta.total)}</b> na próxima fatura</>
              : <><b style={{ color: 'var(--esc-tinta2)' }}>{Math.round(k.usoPct * 100)}%</b> do limite</>}</span>
            <span data-testid="disponivel"><b style={{ color: 'var(--esc-tinta2)' }}>{brl0(k.disponivel)}</b> disponíveis de {brl0(k.creditLimit)}</span>
          </div>
        </>
      )}
      <div className="num mt-[10px] flex items-center gap-[7px] pt-[9px] text-[11px] font-bold" style={{ borderTop: '1px solid var(--esc-linha2)', color: 'var(--esc-tinta2)' }}>
        parcelas futuras: <b className="font-extrabold">{formatBRL(k.parcelasFuturas)}</b>
        <a href={hrefFatura} className="ml-auto text-[11px] font-extrabold no-underline" style={{ color: 'var(--esc-indigo)' }}>abrir fatura →</a>
      </div>
      {menu}
    </div>
  )
}

export function MenuDoCartao({ onEditar, onArquivar, onExcluir }: { onEditar: () => void; onArquivar: () => void; onExcluir: () => void }) {
  const b = 'block w-full rounded-[8px] border-0 bg-transparent px-[11px] py-2 text-left text-[12.5px] font-bold'
  return (
    <div role="menu" data-testid="menu-do-cartao" className="absolute right-[14px] top-[52px] z-10 min-w-[140px] rounded-[11px] border p-[5px]"
      style={{ background: 'var(--esc-card)', borderColor: 'var(--esc-linha)', boxShadow: '0 10px 28px rgba(10,15,30,.12)' }}>
      <button type="button" role="menuitem" className={b} style={{ color: 'var(--esc-tinta)' }} onClick={onEditar}>editar cartão</button>
      <button type="button" role="menuitem" className={b} style={{ color: 'var(--esc-tinta)' }} onClick={onArquivar}>arquivar</button>
      <button type="button" role="menuitem" className={b} style={{ color: 'var(--esc-perigo)' }} onClick={onExcluir}>excluir</button>
    </div>
  )
}

/** R23 — a frase da confirmação, com os NÚMEROS do que some e do que fica */
export function fraseDoExcluir(k: CartaoNaCarteira): string {
  const banco = k.bankName ?? k.name
  if (k.historia.lancamentos === 0) return `Excluir ${banco}? Ele não tem nenhum lançamento — é apagado de vez.`
  return `Excluir ${banco}? Ele tem ${k.historia.lancamentos} ${k.historia.lancamentos === 1 ? 'lançamento' : 'lançamentos'} em ${k.historia.faturas} ${k.historia.faturas === 1 ? 'fatura' : 'faturas'}: o cartão some das telas e a história fica intacta.`
}
export function fraseDoArquivar(k: CartaoNaCarteira): string {
  const banco = k.bankName ?? k.name
  return `Arquivar ${banco}? Ele sai da página e da conta do limite; os ${k.historia.lancamentos} lançamentos ficam onde estão e dá pra reativar aqui embaixo.`
}

/* ── R50: o gráfico da casa ── */
export function BarrasPorMes({ porMes, altura = 40, comValor = true }: { porMes: { mes: string; valor: number }[]; altura?: number; comValor?: boolean }) {
  const max = Math.max(1, ...porMes.map((m) => m.valor))
  return (
    <div data-testid="barras-por-mes" className="my-[6px] flex items-end gap-[7px]" style={{ height: altura + 24 }}>
      {porMes.map((m) => (
        <div key={m.mes} className="flex min-w-0 flex-1 flex-col items-center gap-[3px]">
          {comValor && <em className="num text-[8.5px] font-extrabold not-italic" style={{ color: 'var(--esc-tinta2)' }}>{(m.valor / 1000).toFixed(1).replace('.', ',')}k</em>}
          <i className="block w-full rounded-t-[4px]" style={{ height: Math.round((m.valor / max) * altura), background: 'var(--cart-barra)' }} />
          <span className="num text-[8.5px] font-extrabold" style={{ color: 'var(--esc-tinta3)' }}>{rotuloMes(m.mes)}</span>
        </div>
      ))}
    </div>
  )
}

export const COR_DA_CATEGORIA = ['var(--cart-cat1)', 'var(--cart-cat2)', 'var(--cart-cat3)', 'var(--cart-cat4)', 'var(--cart-cat5)', 'var(--cart-cat6)']
export function corDaCategoria(rank: number): string { return COR_DA_CATEGORIA[Math.min(rank, COR_DA_CATEGORIA.length - 1)] }

export function PorCategoria({ itens }: { itens: { nome: string; valor: number }[] }) {
  const positivos = itens.filter((c) => c.valor > 0)
  const max = Math.max(1, ...positivos.map((c) => c.valor))
  if (positivos.length === 0) return <p className="text-[12px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>Sem compras nesta fatura.</p>
  return (
    <div data-testid="por-categoria" className="mt-1">
      {positivos.map((c, i) => (
        <div key={c.nome} className="grid items-center gap-[9px] py-[5px]" style={{ gridTemplateColumns: '86px minmax(0,1fr) auto' }}>
          <span className="truncate text-[11px] font-extrabold" style={{ color: 'var(--esc-tinta2)' }}>{c.nome}</span>
          <span className="h-[9px] overflow-hidden rounded-full" style={{ background: 'var(--esc-trilho2)' }}>
            <i className="block h-full rounded-full" style={{ width: `${Math.round((c.valor / max) * 100)}%`, background: corDaCategoria(i) }} />
          </span>
          <span className="num text-right text-[11.5px] font-extrabold" style={{ color: 'var(--esc-tinta)' }}>{brl0(c.valor)}</span>
        </div>
      ))}
    </div>
  )
}

/** R50 — curva suave (catmull-rom → bézier) com área, a MESMA conta da lei */
export function caminhoSuave(vals: number[], w = 304, h = 70): { linha: string; area: string; pontos: [number, number][] } {
  if (vals.length === 0) return { linha: '', area: '', pontos: [] }
  const max = Math.max(...vals), min = Math.min(...vals)
  const px = (i: number) => 8 + (vals.length === 1 ? 0 : (i / (vals.length - 1)) * w)
  const py = (v: number) => h - 8 - ((v - min) / (max - min || 1)) * 52
  const P: [number, number][] = vals.map((v, i) => [px(i), py(v)])
  let path = `M ${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    path += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  const area = path + ` L ${px(vals.length - 1).toFixed(1)} 74 L ${px(0).toFixed(1)} 74 Z`
  return { linha: path, area, pontos: P }
}
export function FaturaPorMes({ evolucao }: { evolucao: { mes: string; total: number }[] }) {
  if (evolucao.length < 2) return <p className="text-[12px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>A curva aparece a partir da 2ª fatura importada.</p>
  const { linha, area, pontos } = caminhoSuave(evolucao.map((e) => e.total))
  return (
    <>
      <svg data-testid="fatura-por-mes" className="mt-1 h-[76px] w-full" viewBox="0 0 320 76" preserveAspectRatio="none" aria-label="fatura por mês">
        <defs><linearGradient id="evg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--esc-roxo)', stopOpacity: 0.22 }} /><stop offset="1" style={{ stopColor: 'var(--esc-indigo)', stopOpacity: 0 }} /></linearGradient></defs>
        <path d={area} fill="url(#evg)" />
        <path d={linha} fill="none" stroke="var(--esc-indigo)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pontos.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={i === pontos.length - 1 ? 5 : 3.5}
            fill={i === pontos.length - 1 ? 'var(--esc-indigo)' : 'var(--esc-card)'} stroke="var(--esc-indigo)" strokeWidth="2"><title>{`${rotuloMesAno(evolucao[i].mes)} · ${formatBRL(evolucao[i].total)}`}</title></circle>
        ))}
      </svg>
      <div className="num flex justify-between text-[8.5px] font-extrabold" style={{ color: 'var(--esc-tinta3)' }}>
        {evolucao.map((e) => <span key={e.mes}>{rotuloMes(e.mes)}</span>)}
      </div>
    </>
  )
}

/* ── R47: o painel do comprometido ── */
export function PainelFuturo({ futuras, limite = 4, verTodas, onVerTodas }: {
  futuras: { total: number; porMes: { mes: string; valor: number }[]; compras: { descricao: string; valor: number; faltam: number; ate: string }[] }
  limite?: number; verTodas: boolean; onVerTodas: () => void
}) {
  const lista = verTodas ? futuras.compras : futuras.compras.slice(0, limite)
  return (
    <div data-testid="painel-futuro">
      {futuras.porMes.length === 0
        ? <p className="text-[12px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>Nenhuma parcela por vir neste cartão.</p>
        : <BarrasPorMes porMes={futuras.porMes.slice(0, 6)} />}
      {futuras.compras.length > 0 && (
        <div className="mt-2 pt-1" style={{ borderTop: '1px solid var(--esc-linha2)' }}>
          {lista.map((c, i) => (
            <div key={c.descricao + i} className="num flex items-baseline gap-2 py-[6px] text-[12px] font-bold">
              <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--esc-tinta)' }}>{c.descricao} <small className="text-[10px] font-extrabold" style={{ color: 'var(--esc-tinta3)' }}>{c.faltam === 1 ? `falta 1 · ${rotuloMes(c.ate)}` : `faltam ${c.faltam} · até ${rotuloMesAno(c.ate)}`}</small></span>
              <span className="whitespace-nowrap font-extrabold" style={{ color: 'var(--esc-tinta)' }}>{c.faltam === 1 ? formatBRL(c.valor) : `${formatBRL(c.valor)}/mês`}</span>
            </div>
          ))}
          <div data-testid="soma-do-futuro" className="num flex justify-between pt-1 text-[11.5px] font-extrabold" style={{ borderTop: '1px solid var(--esc-linha2)', color: 'var(--esc-tinta2)' }}>
            <span>soma do que já está comprometido</span><span>{formatBRL(futuras.total)}</span>
          </div>
          {futuras.compras.length > limite && (
            <button type="button" onClick={onVerTodas} className="mt-[9px] text-[11.5px] font-extrabold" style={{ color: 'var(--esc-indigo)' }}>
              {verTodas ? 'mostrar menos' : `ver as ${futuras.compras.length} compras parceladas →`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
