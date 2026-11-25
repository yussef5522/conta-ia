// ⭐⭐⭐ EMPRÉSTIMOS v1 — AS PEÇAS DA LEI (docs/emprestimos-referencia.html, 25/11/2026).
//
// Hero de 4 (R56), a MONTANHA empilhada por credor com hover/toque (R57), o COMPROMISSO mês a mês
// com o pico (R58), o pódio do custo real (R59, mútuo fora declarado — R61), custo por credor,
// cheque especial por conta (R64), cards de contrato com chip do credor e "~" em toda estimativa (R62).
// ⚠️ S15 TELA MUDA: nenhuma prosa de regra na tela — explicação só no ⓘ.
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  fmt, fmtR, fmtK, rotuloEstimado, linhaResumo, rotuloMesCurto, pico, progresso, rankingDeCusto,
  ORDEM_DO_CREDOR, COR_DO_CREDOR, PALETA, GRADIENTE_DA_SERIE, GRADIENTE_DO_CHIP, NOME_DO_CREDOR,
  type Credor, type CarteiraDeEmprestimos, type ContratoNaCarteira, type MesDoCompromisso,
} from '@/lib/loans/carteira'

export const SH = 'var(--emp-sh)'
const tinta = (t: 'ind' | 'amb' | 'rox' | 'ver') => `var(--emp-t-${t})`
const ICO: Record<'ind' | 'amb' | 'rox' | 'ver', string> = {
  ind: PALETA.icoInd, amb: PALETA.ouro,
  rox: PALETA.icoRox, ver: PALETA.icoVer,
}

// ─────────────────────────── ⓘ ───────────────────────────
export function Info({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" aria-label={`sobre: ${titulo}`} onClick={() => setAberto(true)}
        className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-0 text-[12px] font-bold"
        style={{ background: 'var(--emp-neutro)', color: 'var(--emp-ink2)' }}>ⓘ</button>
      {aberto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,15,30,.35)' }} onClick={() => setAberto(false)}>
          <div className="w-full max-w-[520px] rounded-[18px] px-6 py-5 text-left" style={{ background: 'var(--emp-card)', boxShadow: '0 30px 80px rgba(10,15,30,.3)' }} onClick={(e) => e.stopPropagation()}>
            <h5 className="mb-2 text-[15px] font-bold" style={{ color: 'var(--emp-ink)' }}>{titulo}</h5>
            <div className="space-y-1.5 text-[13.5px]" style={{ color: 'var(--emp-ink2)' }}>{children}</div>
            <button type="button" className="mt-4 rounded-[12px] px-4 py-2 text-[14px] font-semibold" style={{ background: 'var(--emp-neutro)', color: 'var(--emp-ink)' }} onClick={() => setAberto(false)}>fechar</button>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────── chip do credor ───────────────────────────
export function Chip({ banco, rot, w = 54, h = 36 }: { banco: Credor; rot?: string; w?: number; h?: number }) {
  const [a, b] = GRADIENTE_DO_CHIP[banco]
  return (
    <span data-chip={banco} className="emp-chip relative flex-none overflow-hidden rounded-[9px]"
      style={{ width: w, height: h, background: `linear-gradient(135deg,${a},${b})`, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25),0 2px 6px rgba(10,15,30,.18)' }}>
      {rot && <span className="absolute bottom-[5px] left-[7px] text-[9px] font-extrabold tracking-[.06em] text-white opacity-95">{rot.toUpperCase()}</span>}
    </span>
  )
}

// ─────────────────────────── hero (R56) ───────────────────────────
function Kpi({ t, ico, k, v, s, info }: { t: 'ind' | 'amb' | 'rox' | 'ver'; ico: string; k: string; v: ReactNode; s: ReactNode; info?: ReactNode }) {
  return (
    <div data-kpi={t} className={`emp-hk t-${t} relative overflow-hidden rounded-[20px] px-5 pb-[18px] pt-4`} style={{ background: tinta(t), boxShadow: SH }}>
      <div className="flex items-center gap-2.5 text-[12px] font-bold tracking-[.04em]" style={{ color: 'var(--emp-ink2)' }}>
        <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] text-[13px] font-extrabold text-white" style={{ background: ICO[t], boxShadow: '0 3px 8px rgba(10,15,30,.18)' }}>{ico}</span>
        <span className="min-w-0 flex-1">{k}</span>
        {info}
      </div>
      {/* ⛔ S18 — dinheiro inteiro, nunca "…": a cifra quebra de linha antes de ser cortada */}
      <div className="mt-2 break-words text-[clamp(20px,2.4vw,30px)] font-extrabold tracking-[-0.02em] tabular-nums" style={{ color: 'var(--emp-ink)' }}>{v}</div>
      <div className="relative z-[1] mt-[5px] text-[12.5px]" style={{ color: 'var(--emp-ink2)' }}>{s}</div>
    </div>
  )
}

export function HeroCarteira({ c }: { c: CarteiraDeEmprestimos }) {
  const mesAtual = c.compromisso[0]
  const prox = c.compromisso[1]
  const ultimo = [...c.compromisso].reverse().find((x) => x.v > 0)
  const temEstimativa = c.compromisso.some((x) => x.est)
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Kpi t="ind" ico="R$" k="DÍVIDA TOTAL" v={fmtR(c.totais.total)}
        s={<>bancos <b>{fmtK(c.totais.bancos)}</b> · mútuo <b>{fmtK(c.totais.mutuo)}</b> · <a href="#grupos" style={{ color: 'var(--emp-ind)', fontWeight: 600 }}>ver →</a></>}
        info={<Info titulo="Dívida total">
          <p>Soma do saldo devedor de cada contrato: o fechamento da última parcela paga na agenda do banco.</p>
          <p>O mútuo é somado separado — é outra natureza (sem juros, sem prazo).</p>
        </Info>} />
      <Kpi t="amb" ico="%" k={`CUSTO DO DINHEIRO · ${c.ano}`} v={fmtR(c.custo.total)}
        s={<>contratos <b>{fmtK(c.custo.contratos)}</b> + cheque <b>{fmtK(c.custo.cheque)}</b> · agenda previa {fmtK(c.custo.agenda)}{c.custo.acima > 0 ? ` · ${fmtK(c.custo.acima)} acima` : ''} · <a href="#custo" style={{ color: 'var(--emp-ind)', fontWeight: 600 }}>ver →</a></>}
        info={<Info titulo="Custo do dinheiro">
          <p>Juros + correção + multa APURADOS no pagamento de cada parcela no ano, mais os juros de cheque especial / conta garantida das contas.</p>
          <p>A agenda do banco é previsão e aparece ao lado: quanto ela previa e quanto o pago ficou acima.</p>
        </Info>} />
      <Kpi t="rox" ico="↧" k={`COMPROMISSO · ${mesAtual ? rotuloMesCurto(mesAtual.m) : '—'}`}
        v={mesAtual ? rotuloEstimado(mesAtual.v, !!mesAtual.est) : '—'}
        s={<>{prox && <>próximo mês <b>{rotuloEstimado(prox.v, !!prox.est)}</b></>}{c.atrasado.n > 0 && <> · <span style={{ color: 'var(--emp-ros)', fontWeight: 700 }}>{c.atrasado.n} vencida(s) {fmtR(c.atrasado.v)}</span></>} · <a href="#compromisso" style={{ color: 'var(--emp-ind)', fontWeight: 600 }}>ver →</a></>}
        info={<Info titulo="Compromisso do mês">
          <p>As parcelas em aberto que vencem no mês — o MESMO valor que a Mesa e os Custos Fixos mostram.</p>
          <p>Pós-fixado sem juro conhecido leva “~”: o valor real nasce no vencimento.</p>
          {temEstimativa && <p>“~” = contém estimativa.</p>}
        </Info>} />
      <Kpi t="ver" ico="✓" k="LIVRE DA DÍVIDA EM" v={ultimo ? rotuloLongo(ultimo.m) : '—'}
        s={<>{ultimo && <>última parcela <b>{rotuloEstimado(ultimo.v, !!ultimo.est)}</b> · {c.compromisso.length} meses</>}</>}
        info={<Info titulo="Livre da dívida">
          <p>O mês da última parcela em aberto da agenda de todos os contratos. Cheque especial não tem agenda e fica fora.</p>
        </Info>} />
    </div>
  )
}
const MESES_L = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloLongo = (ym: string) => `${MESES_L[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`

// ─────────────────────────── curva suave (a da lei) ───────────────────────────
type P = [number, number]
export function smoothPath(pts: P[], abre: boolean): string {
  if (pts.length < 3) return (abre ? 'M' : 'L') + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')
  let d = `${abre ? 'M' : 'L'}${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

// ─────────────────────────── a montanha (R57) ───────────────────────────
export function Montanha({ c, mini = false }: { c: CarteiraDeEmprestimos; mini?: boolean }) {
  const { meses, series } = c.montanha
  const rotulos = ['hoje', ...meses.map(rotuloMesCurto)]
  const n = rotulos.length
  const W = mini ? 332 : 1536, H = mini ? 150 : 300
  const padL = mini ? 0 : 46, padR = mini ? 0 : 10, padT = 10, padB = 20
  const iw = W - padL - padR, ih = H - padT - padB
  const presentes = ORDEM_DO_CREDOR.filter((k) => series[k].some((v) => v > 0))
  const total = (i: number) => presentes.reduce((s, k) => s + series[k][i], 0)
  const max = Math.max(1, ...Array.from({ length: n }, (_, i) => total(i))) * 1.02
  const X = (i: number) => padL + (n > 1 ? (iw * i) / (n - 1) : 0)
  const Y = (v: number) => padT + ih * (1 - v / max)
  const [foco, setFoco] = useState<number | null>(null)

  const camadas = useMemo(() => {
    let base = new Array(n).fill(0)
    return presentes.map((k) => {
      const top = series[k].map((v, i) => base[i] + v)
      const ptsT: P[] = top.map((v, i) => [X(i), Y(v)])
      const ptsB: P[] = base.map((v, i) => [X(i), Y(v)] as P).reverse()
      base = top
      return { k, area: `${smoothPath(ptsT, true)} ${smoothPath(ptsB, false)} Z`, linha: smoothPath(ptsT, true) }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, mini])

  const indiceDe = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    return Math.max(0, Math.min(n - 1, Math.round(((x - padL) / iw) * (n - 1))))
  }
  const marcas = n > 1 ? [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1] : [0]

  return (
    <div data-montanha className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none" role="img" aria-label="saldo devedor total, mês a mês, empilhado por credor"
        onMouseMove={(e) => setFoco(indiceDe(e.clientX, e.currentTarget))} onMouseLeave={() => setFoco(null)}
        onTouchStart={(e) => setFoco(indiceDe(e.touches[0].clientX, e.currentTarget))}
        onTouchMove={(e) => setFoco(indiceDe(e.touches[0].clientX, e.currentTarget))}>
        <defs>
          {presentes.map((k) => (
            <linearGradient key={k} id={`emp-g-${mini ? 'm' : 'd'}-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GRADIENTE_DA_SERIE[k][0]} /><stop offset="1" stopColor={GRADIENTE_DA_SERIE[k][1]} />
            </linearGradient>
          ))}
        </defs>
        {!mini && [0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--emp-grade)" strokeWidth={1} />
            <text x={padL - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--emp-ink3)">{v === 0 ? '0' : fmtK(v).replace(',0k', 'k')}</text>
          </g>
        ))}
        {camadas.map((l) => (
          <g key={l.k} data-serie={l.k}>
            <path d={l.area} fill={`url(#emp-g-${mini ? 'm' : 'd'}-${l.k})`} opacity={0.95}><title>{NOME_DO_CREDOR[l.k]}</title></path>
            <path d={l.linha} fill="none" stroke={PALETA.branco} strokeWidth={mini ? 1.4 : 2} />
          </g>
        ))}
        {!mini && marcas.map((i) => (
          <text key={i} x={X(i)} y={H - 4} fontSize={11} fill="var(--emp-ink3)" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{rotulos[i]}</text>
        ))}
        {foco != null && <line x1={X(foco)} x2={X(foco)} y1={padT} y2={padT + ih} stroke="var(--emp-ink)" strokeOpacity={0.35} strokeDasharray="4 4" />}
        <circle cx={X(0)} cy={Y(total(0))} r={mini ? 3.5 : 5.5} fill={PALETA.ponto} stroke={PALETA.branco} strokeWidth={2.5} />
      </svg>
      {foco != null && (
        <div data-foco className="pointer-events-none absolute top-1 z-10 rounded-[12px] px-3 py-2 text-[12px]"
          style={{ left: `clamp(0px, calc(${(X(foco) / W) * 100}% - 90px), calc(100% - 190px))`, background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink2)', minWidth: 180 }}>
          <div className="mb-1 font-bold" style={{ color: 'var(--emp-ink)' }}>{foco === 0 ? 'hoje' : `fim de ${rotulos[foco]}`} · {fmtR(total(foco))}</div>
          {presentes.map((k) => (
            <div key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COR_DO_CREDOR[k].claro }} />{NOME_DO_CREDOR[k]}<b className="ml-auto tabular-nums" style={{ color: 'var(--emp-ink)' }}>{fmt(series[k][foco])}</b></div>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5">
        {presentes.map((k) => (
          <span key={k} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--emp-ink2)' }}>
            <span className="h-[14px] w-[14px] rounded-[5px] dark:hidden" style={{ background: COR_DO_CREDOR[k].claro }} />
            <span className="hidden h-[14px] w-[14px] rounded-[5px] dark:inline-block" style={{ background: COR_DO_CREDOR[k].escuro }} />
            {NOME_DO_CREDOR[k]} <b style={{ color: 'var(--emp-ink)' }}>{fmtK(series[k][0])}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────── o compromisso (R58) ───────────────────────────
/** os meses do PICO: o maior e o(s) colado(s) nele (≥ 98% do pico) */
export function mesesDoPico(serie: readonly MesDoCompromisso[]): Set<string> {
  if (serie.length === 0) return new Set()
  const p = pico(serie)
  return new Set(serie.filter((x) => x.v >= p.v * 0.98 && x.v > 0).map((x) => x.m))
}

export function Compromisso({ serie }: { serie: readonly MesDoCompromisso[] }) {
  const n = serie.length
  const W = 1536, H = 230, padL = 46, padR = 10, padT = 26, padB = 22
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(1, ...serie.map((x) => x.v)) * 1.05
  const step = iw / Math.max(1, n), bw = step * 0.62
  const Y = (v: number) => padT + ih * (1 - v / max)
  const picos = mesesDoPico(serie)
  const iPico = serie.findIndex((x) => picos.has(x.m))
  const nPico = serie.filter((x) => picos.has(x.m)).length
  const tituloPico = nPico > 1
    ? `O PICO · ${rotuloMesCurto([...picos][0]).split('/')[0]}–${rotuloMesCurto([...picos][nPico - 1])}`
    : iPico >= 0 ? `O PICO · ${rotuloMesCurto(serie[iPico].m)}` : ''
  const marcas = n > 1 ? [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1] : [0]
  return (
    <>
      {/* desktop: as barras */}
      <svg data-compromisso viewBox={`0 0 ${W} ${H}`} className="hidden w-full md:block" role="img" aria-label="parcelas em aberto, mês a mês">
        <defs>
          <linearGradient id="emp-gbar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={PALETA.real} /><stop offset="1" stopColor={PALETA.rox} /></linearGradient>
          <linearGradient id="emp-gbarAmb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={PALETA.pico} /><stop offset="1" stopColor={PALETA.picoClaro} /></linearGradient>
        </defs>
        {[0, max / 2, max].map((v) => (
          <g key={v}><line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--emp-grade)" /><text x={padL - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--emp-ink3)">{v === 0 ? '0' : fmtK(v).replace(',0k', 'k')}</text></g>
        ))}
        {serie.map((e, i) => {
          const x = padL + step * i + (step - bw) / 2, y = Y(e.v), h = padT + ih - y
          const amb = picos.has(e.m)
          return (
            <rect key={e.m} data-mes={e.m} data-pico={amb ? '1' : undefined} x={x} y={y} width={bw} height={Math.max(0, h)} rx={6} fill={amb ? 'url(#emp-gbarAmb)' : 'url(#emp-gbar)'}>
              <title>{`${rotuloMesCurto(e.m)} · ${rotuloEstimado(e.v, !!e.est)}`}</title>
            </rect>
          )
        })}
        {iPico >= 0 && (() => {
          const x = padL + step * (iPico + (nPico - 1) / 2) + step / 2, w = tituloPico.length * 6.6 + 24
          return <g><rect x={x - w / 2} y={0} width={w} height={21} rx={10.5} fill={PALETA.pico} /><text x={x} y={15} textAnchor="middle" fontSize={11} fontWeight={800} fill={PALETA.branco}>{tituloPico}</text></g>
        })()}
        {serie.map((e, i) => (i === 0 || picos.has(e.m) || i === n - 1) && (
          <text key={`v${e.m}`} x={padL + step * i + step / 2} y={Y(e.v) - 7} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={picos.has(e.m) ? 'var(--emp-amb)' : 'var(--emp-ink2)'}>{e.est ? '~' : ''}{fmtK(e.v)}</text>
        ))}
        {marcas.map((i) => (
          <text key={`m${i}`} x={padL + step * i + step / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--emp-ink3)">{rotuloMesCurto(serie[i].m)}</text>
        ))}
      </svg>
      {/* ⭐ celular: o compromisso vira LISTA, com o pico marcado (S18: dinheiro inteiro) */}
      <ul data-compromisso-lista className="space-y-1 md:hidden">
        {serie.map((e) => (
          <li key={e.m} className="flex items-center gap-3 rounded-[10px] px-2.5 py-1.5 text-[13px]" style={picos.has(e.m) ? { background: 'var(--emp-ambbg)' } : undefined}>
            <span className="w-14" style={{ color: 'var(--emp-ink2)' }}>{rotuloMesCurto(e.m)}</span>
            {picos.has(e.m) && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-white" style={{ background: PALETA.pico }}>PICO</span>}
            <b className="ml-auto whitespace-nowrap tabular-nums" style={{ color: picos.has(e.m) ? 'var(--emp-amb)' : 'var(--emp-ink)' }}>{rotuloEstimado(e.v, !!e.est)}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

// ─────────────────────────── card / seção ───────────────────────────
export function Card({ id, titulo, sub, dir, info, children }: { id?: string; titulo: string; sub?: ReactNode; dir?: ReactNode; info?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mb-4 rounded-[22px] px-[22px] py-5" style={{ background: 'var(--emp-card)', boxShadow: SH }}>
      <div className="mb-3 flex flex-wrap items-baseline gap-2.5">
        <h3 className="m-0 text-[16px] font-bold" style={{ color: 'var(--emp-ink)' }}>{titulo}</h3>
        {sub && <span className="text-[12.5px]" style={{ color: 'var(--emp-ink3)' }}>{sub}</span>}
        {info}
        {dir && <span className="ml-auto whitespace-nowrap text-[13px] font-semibold" style={{ color: 'var(--emp-ind)' }}>{dir}</span>}
      </div>
      {children}
    </section>
  )
}

const corDoCusto = (ef: number) => (ef >= 2.5 ? 'var(--emp-ros)' : ef >= 1.8 ? 'var(--emp-amb)' : 'var(--emp-ink)')
const pctAm = (ef: number) => `${ef.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`

/** o pódio (R59): custo real % a.m., mútuo FORA declarado (R61) */
export function Podio({ contratos }: { contratos: readonly ContratoNaCarteira[] }) {
  const rk = rankingDeCusto(contratos).slice(0, 6)
  const topo = rk.find((c) => c.ef != null)?.ef ?? 1
  return (
    <div data-podio className="flex flex-col gap-1.5">
      {rk.map((ct, i) => (
        <Link key={ct.id} href={ct.href} className="grid grid-cols-[26px_40px_1fr_84px_48px] items-center gap-2.5 rounded-[14px] px-2.5 py-[7px] no-underline md:grid-cols-[26px_44px_1fr_110px_96px_52px] md:gap-3"
          style={i === 0 ? { background: PALETA.topoDoPodio } : undefined}>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold"
            style={i === 0 ? { background: PALETA.ouro, color: PALETA.branco, boxShadow: '0 3px 8px rgba(217,119,6,.35)' } : { background: 'var(--emp-neutro)', color: 'var(--emp-ink2)' }}>{i + 1}</span>
          <Chip banco={ct.banco} w={40} h={28} />
          <div className="min-w-0 text-[13.5px] font-bold" style={{ color: 'var(--emp-ink)' }}>{ct.num}<span className="block text-[11.5px] font-normal" style={{ color: 'var(--emp-ink3)' }}>{ct.rot}</span></div>
          <div className="hidden h-2.5 overflow-hidden rounded-full md:block" style={{ background: PALETA.trilhoCusto }}><i className="block h-full rounded-full" style={{ width: `${ct.ef != null ? Math.round((ct.ef / topo) * 100) : 0}%`, background: PALETA.barraCusto }} /></div>
          <div className="whitespace-nowrap text-right text-[14px] font-extrabold" style={{ color: ct.ef != null ? corDoCusto(ct.ef) : 'var(--emp-ink3)' }}>{ct.ef != null ? pctAm(ct.ef) : 'a apurar'}</div>
          <span className="text-right text-[12.5px] font-semibold" style={{ color: 'var(--emp-ind)' }}>ver →</span>
        </Link>
      ))}
    </div>
  )
}

export function CustoPorCredor({ c }: { c: CarteiraDeEmprestimos }) {
  const max = Math.max(1, ...c.custoPorCredor.map((x) => x.v))
  return (
    <div data-custo-credor className="flex flex-col gap-1.5">
      {c.custoPorCredor.map((x) => (
        <div key={x.banco} className="grid grid-cols-[90px_1fr_120px] items-center gap-3 px-2.5 py-[7px]">
          <div className="text-[13.5px] font-bold" style={{ color: 'var(--emp-ink)' }}>{x.rot}</div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: PALETA.trilhoCusto }}><i className="block h-full rounded-full" style={{ width: `${Math.round((x.v / max) * 100)}%`, background: PALETA.barraCusto }} /></div>
          <div className="whitespace-nowrap text-right text-[14px] font-extrabold tabular-nums" style={{ color: 'var(--emp-ink)' }}>{fmtR(x.v)}</div>
        </div>
      ))}
      {c.contratos.some((k) => k.flexible) && (
        <div className="grid grid-cols-[90px_1fr_120px] items-center gap-3 px-2.5 py-[7px]">
          <div className="text-[13.5px] font-bold" style={{ color: 'var(--emp-ink)' }}>Mútuo PF<span className="block text-[11.5px] font-normal" style={{ color: 'var(--emp-ink3)' }}>sem juros</span></div>
          <div />
          <div className="text-right text-[14px] font-extrabold" style={{ color: 'var(--emp-ink3)' }}>{fmtR(0)}</div>
        </div>
      )}
    </div>
  )
}

/** R64 — cheque especial por conta: juros no ano e no mês, usado × limite quando cadastrado */
export function ChequeEspecial({ c }: { c: CarteiraDeEmprestimos }) {
  if (c.cheque.length === 0) return <p className="text-[13px]" style={{ color: 'var(--emp-ink3)' }}>sem uso de cheque especial no ano</p>
  return (
    <div data-cheque className="flex flex-col gap-1.5">
      {c.cheque.map((q) => {
        const pct = q.limite ? Math.min(100, Math.round((q.usado / q.limite) * 100)) : null
        const banco: Credor = (q.banco ?? q.conta).toLowerCase().includes('sicredi') ? 'sicredi' : (q.banco ?? q.conta).toLowerCase().includes('banrisul') ? 'banrisul' : (q.banco ?? q.conta).toLowerCase().includes('caixa') ? 'caixa' : 'outro'
        return (
          <div key={q.bankAccountId} data-conta={q.bankAccountId} className="grid grid-cols-[36px_1fr_110px] items-center gap-3 px-2.5 py-[7px] md:grid-cols-[36px_210px_1fr_120px]">
            <Chip banco={banco} w={36} h={25} />
            <div className="min-w-0 text-[13.5px] font-bold" style={{ color: 'var(--emp-ink)' }}>{q.conta}
              <span className="block text-[11.5px] font-normal" style={{ color: 'var(--emp-ink3)' }}>
                {q.usado > 0 ? (q.limite ? `usado ${fmtK(q.usado)} de ${fmtK(q.limite)} · ${pct}%` : `usado ${fmtR(q.usado)}`) : 'sem uso no momento'} · mês {fmtR(q.jurosMes)}
              </span>
            </div>
            <div className="hidden h-2.5 overflow-hidden rounded-full md:block" style={{ background: PALETA.trilhoCheque }}>{pct != null && <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: PALETA.barraCheque }} />}</div>
            <div className="whitespace-nowrap text-right text-[14px] font-extrabold tabular-nums" style={{ color: 'var(--emp-ink)' }}>{fmtR(q.jurosAno)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────── a linha de contrato ───────────────────────────
const Bdg = ({ tom, children, href }: { tom?: 'ok' | 'est' | 'err'; children: ReactNode; href?: string }) => {
  const st = tom === 'ok' ? { background: 'var(--emp-verbg)', color: 'var(--emp-ver)' }
    : tom === 'est' ? { background: PALETA.indSuave, color: 'var(--emp-ind)' }
      : tom === 'err' ? { background: 'var(--emp-rosbg)', color: 'var(--emp-ros)' }
        : { background: 'var(--emp-neutro)', color: 'var(--emp-ink2)' }
  const cls = 'rounded-full px-[9px] py-[3px] text-[11.5px] font-bold no-underline'
  return href ? <Link href={href} data-bdg={tom} className={cls} style={st}>{children}</Link> : <span data-bdg={tom} className={cls} style={st}>{children}</span>
}

/** um fato do detalhe aberto (taxa, custo pago, agenda, próxima) */
const Fato = ({ children }: { children: ReactNode }) => (
  <span data-fato className="rounded-full px-[11px] py-[5px] text-[12px]" style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink2)' }}>{children}</span>
)
const rotuloDaProxima = (k: ContratoNaCarteira) => k.prox?.estado === 'PARCIAL' ? 'falta' : k.prox?.estado === 'ATRASADA' ? 'atrasada' : 'próxima'
const BOTAO = 'block rounded-[10px] px-3 py-2 text-center text-[13px] font-semibold no-underline'

/** o detalhe que a linha abre: barra grande, os fatos e as 4 ações empilhadas (marcar paga = a porta única) */
export function DetalheDaLinha({ k, ano }: { k: ContratoNaCarteira; ano: number }) {
  const r = linhaResumo({ ...k, incompleto: k.pendencias[0]?.rotulo ?? null })
  const mut = k.banco === 'mutuo'
  const barra = mut ? PALETA.progressoVerde : PALETA.progresso
  const prox = r.prox && r.prox.v != null ? rotuloEstimado(r.prox.v, !!r.prox.est) : r.prox ? 'a apurar' : null
  const rotuloProx = rotuloDaProxima(k)
  return (
    <div data-detalhe className="rounded-b-[16px] px-[18px] py-4" style={{ borderTop: '1px solid var(--emp-line)', background: 'var(--emp-suave)' }}>
      <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[1fr_230px]">
        <div>
          <div className="mb-1.5 mt-0.5 h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--emp-trilho)' }}><i className="block h-full rounded-full" style={{ width: `${r.prog}%`, background: barra }} /></div>
          <div className="flex justify-between text-[12px]" style={{ color: 'var(--emp-ink2)' }}><span>{r.progTxt}</span><span>{r.prog}%</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mut ? <>
              <Fato>principal <b>{fmtR(k.principal)}</b></Fato>
              <Fato>devolvido <b>{fmtR(k.devolvido)}</b></Fato>
              <Fato>agenda nominal — nunca atrasa</Fato>
            </> : <>
              <Fato>taxa <b>{k.taxa}</b></Fato>
              <Fato>custo pago em {ano} <b>{fmtR(k.juros26)}</b></Fato>
              <Fato>agenda do banco <b>✓</b></Fato>
              {prox && <Fato>{rotuloProx} <b>{prox} · {k.prox?.d}</b></Fato>}
            </>}
            {r.estado === 'incompleto' && <Bdg tom="err" href={`${k.href}?editar=1`}>{k.pendencias[0].rotulo} — completar →</Bdg>}
          </div>
        </div>
        <div data-acoes className="flex flex-col gap-2">
          <Link data-acao="abrir" href={k.href} className={BOTAO} style={{ background: 'var(--emp-ind)', color: 'var(--emp-card)' }}>abrir contrato →</Link>
          {mut
            ? <Link data-acao="pagar" href={`${k.href}?devolucao=1`} className={BOTAO} style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink)' }}>registrar devolução</Link>
            : <Link data-acao="pagar" href={k.prox ? `${k.href}?pagar=${k.prox.n}` : k.href} className={BOTAO} style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink)' }}>marcar paga</Link>}
          <Link data-acao="editar" href={`${k.href}?editar=1`} className={BOTAO} style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink)' }}>editar</Link>
          <Link data-acao="excluir" href={`${k.href}?excluir=1`} className={BOTAO} style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ros)' }}>excluir</Link>
        </div>
      </div>
    </div>
  )
}

/**
 * A LINHA do contrato: chip, nº, estado, progresso, próxima e saldo SEMPRE à vista — nunca cartaz.
 * O clique abre o detalhe inline (acordeão); nenhuma nasce aberta, várias podem ficar abertas.
 * No celular a linha é mínima (chip, nº, saldo, chevron) e o toque abre o MESMO detalhe empilhado.
 */
export function LinhaContrato({ k, ano }: { k: ContratoNaCarteira; ano: number }) {
  const [aberta, setAberta] = useState(false)
  const r = linhaResumo({ ...k, incompleto: k.pendencias[0]?.rotulo ?? null })
  const mut = k.banco === 'mutuo'
  const barra = mut ? PALETA.progressoVerde : PALETA.progresso
  const prox = r.prox && r.prox.v != null ? rotuloEstimado(r.prox.v, !!r.prox.est) : r.prox ? 'a apurar' : null
  const rotuloProx = rotuloDaProxima(k)
  const alternar = () => setAberta((v) => !v)
  const sub = <div className="text-[11.5px]" style={{ color: 'var(--emp-ink3)' }}>{k.rot}{mut ? ' · mútuo' : ''}</div>
  const saldo = (tam: string) => <div data-saldo className={`whitespace-nowrap text-right font-extrabold tabular-nums ${tam}`} style={{ color: 'var(--emp-ink)' }}>{fmtR(r.saldo)}</div>
  const chev = <span aria-hidden className="text-center text-[15px] transition-transform" style={{ color: 'var(--emp-ink3)', transform: aberta ? 'rotate(180deg)' : undefined }}>⌄</span>
  return (
    <div data-contrato={k.id} data-aberta={aberta ? '1' : '0'} className="rounded-[16px]" style={{ background: 'var(--emp-card)', boxShadow: SH }}>
      <div role="button" tabIndex={0} aria-expanded={aberta} onClick={alternar} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar() } }}
        className="cursor-pointer">
        {/* computador: a linha inteira */}
        <div data-linha="larga" className="hidden items-center gap-3.5 px-4 py-3 lg:grid lg:grid-cols-[44px_minmax(150px,1.05fr)_minmax(0,1.5fr)_180px_200px_170px_26px]">
          <Chip banco={k.banco} rot={k.rot} w={44} h={30} />
          <div className="min-w-0"><div className="text-[14px] font-bold" style={{ color: 'var(--emp-ink)' }}>{k.num}</div>{sub}</div>
          <div data-estado={r.estado} className="flex min-w-0 flex-wrap gap-1.5">
            {r.estado === 'incompleto'
              ? <Bdg tom="err" href={`${k.href}?editar=1`}>{k.pendencias[0].rotulo} →</Bdg>
              : <Bdg tom="ok">{mut ? 'nominal' : 'em dia'}</Bdg>}
            {r.prox?.est && <Bdg tom="est">~ estimada</Bdg>}
            <Bdg>{k.taxa}</Bdg>
          </div>
          <div data-progresso>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--emp-trilho)' }}><i className="block h-full rounded-full" style={{ width: `${r.prog}%`, background: barra }} /></div>
            <div className="mt-1 text-[11.5px]" style={{ color: 'var(--emp-ink2)' }}>{r.progTxt} · {r.prog}%</div>
          </div>
          <div data-proxima className="flex min-w-0 flex-col gap-0.5 text-right">
            {mut ? <>
              <Link href={`${k.href}?devolucao=1`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-[13.5px] font-bold no-underline" style={{ color: 'var(--emp-ind)' }}>registrar devolução →</Link>
              <span className="text-[11.5px]" style={{ color: 'var(--emp-ink3)' }}>quando quiser</span>
            </> : prox ? <>
              <span className="whitespace-nowrap text-[13.5px] font-bold tabular-nums" style={{ color: 'var(--emp-ink)' }}>{prox}{r.prox?.enc && <span className="text-[11.5px] font-normal" style={{ color: 'var(--emp-ink3)' }}> + enc.</span>}</span>
              <span className="text-[11.5px]" style={{ color: 'var(--emp-ink3)' }}>{rotuloProx} · {k.prox?.d}</span>
            </> : <span className="text-[12px]" style={{ color: 'var(--emp-ink3)' }}>quitado</span>}
          </div>
          {saldo('text-[16.5px]')}
          {chev}
        </div>
        {/* celular: a linha mínima */}
        <div data-linha="minima" className="grid grid-cols-[38px_1fr_auto_20px] items-center gap-3 px-3 py-[11px] lg:hidden">
          <Chip banco={k.banco} rot={k.rot} w={38} h={26} />
          <div className="min-w-0"><div className="text-[14px] font-bold" style={{ color: 'var(--emp-ink)' }}>{k.num}</div>{sub}</div>
          {saldo('text-[14.5px]')}
          {chev}
        </div>
      </div>
      {aberta && <DetalheDaLinha k={k} ano={ano} />}
    </div>
  )
}

export function GrupoDoCredor({ banco, contratos, ano }: { banco: Credor; contratos: readonly ContratoNaCarteira[]; ano: number }) {
  if (contratos.length === 0) return null
  const soma = contratos.reduce((s, k) => s + k.saldo, 0)
  return (
    <div data-grupo={banco}>
      <div className="mx-0.5 mb-2.5 mt-[22px] flex flex-wrap items-baseline gap-2.5">
        <h4 className="m-0 text-[13px] font-extrabold tracking-[.1em]" style={{ color: 'var(--emp-ink2)' }}>{(banco === 'outro' ? contratos[0].rot : NOME_DO_CREDOR[banco]).toUpperCase()}</h4>
        <span className="text-[12.5px]" style={{ color: 'var(--emp-ink3)' }}>{contratos.length} contrato{contratos.length > 1 ? 's' : ''}{banco === 'mutuo' ? ' · outra natureza' : ''}</span>
        <span className="ml-auto whitespace-nowrap text-[14px] font-bold tabular-nums" style={{ color: 'var(--emp-ink)' }}>{fmtR(soma)}</span>
      </div>
      <div data-lista className="flex flex-col gap-2">
        {contratos.map((k) => <LinhaContrato key={k.id} k={k} ano={ano} />)}
      </div>
    </div>
  )
}

// ─────────────────────────── detalhe: curva real × agenda (R55) ───────────────────────────
export interface PontoDaCurva { n: number; mes: string; agenda: number; real: number | null }

export function CurvaRealAgenda({ pontos }: { pontos: readonly PontoDaCurva[] }) {
  const n = pontos.length
  if (n === 0) return null
  const W = 1536, H = 170, padL = 46, padR = 10, padT = 12, padB = 20
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(1, ...pontos.map((p) => Math.max(p.agenda, p.real ?? 0))) * 1.04
  const X = (i: number) => padL + (n > 1 ? (iw * i) / (n - 1) : 0)
  const Y = (v: number) => padT + ih * (1 - v / max)
  const dA = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(p.agenda).toFixed(1)}`).join(' ')
  const reais = pontos.map((p, i) => ({ p, i })).filter((x) => x.p.real != null)
  const ptsR: P[] = reais.map((x) => [X(x.i), Y(x.p.real!)])
  const ult = reais[reais.length - 1]
  const marcas = n > 1 ? [0, Math.round((n - 1) / 2), n - 1] : [0]
  return (
    <div data-curva>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="saldo devedor real e da agenda">
        <defs><linearGradient id="emp-gAreaReal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={PALETA.real} stopOpacity={0.22} /><stop offset="1" stopColor={PALETA.real} stopOpacity={0} /></linearGradient></defs>
        {[0, max / 2, max].map((v) => (
          <g key={v}><line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--emp-grade)" /><text x={padL - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--emp-ink3)">{v === 0 ? '0' : fmtK(v).replace(',0k', 'k')}</text></g>
        ))}
        <path data-serie="agenda" d={dA} fill="none" stroke={PALETA.agenda} strokeWidth={2} strokeDasharray="6 6" />
        {ptsR.length > 1 && <>
          <path d={`${smoothPath(ptsR, true)} L ${ptsR[ptsR.length - 1][0].toFixed(1)} ${Y(0)} L ${ptsR[0][0].toFixed(1)} ${Y(0)} Z`} fill="url(#emp-gAreaReal)" />
          <path data-serie="real" d={smoothPath(ptsR, true)} fill="none" stroke={PALETA.real} strokeWidth={2.5} />
        </>}
        {ult && <>
          <circle cx={X(ult.i)} cy={Y(ult.p.real!)} r={5} fill="var(--emp-ind)" stroke={PALETA.branco} strokeWidth={2}><title>{`parcela ${ult.p.n} · saldo ${fmtR(ult.p.real!)}`}</title></circle>
          <text x={X(ult.i) + 10} y={Y(ult.p.real!) - 8} fontSize={11.5} fontWeight={700} fill="var(--emp-ink2)">hoje · {fmtK(ult.p.real!)}</text>
        </>}
        {marcas.map((i) => <text key={i} x={X(i)} y={H - 2} fontSize={11} fill="var(--emp-ink3)" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{rotuloMesCurto(pontos[i].mes)}</text>)}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-[12.5px]" style={{ color: 'var(--emp-ink2)' }}>
        <span className="flex items-center gap-2"><span className="h-[3px] w-5 rounded" style={{ background: PALETA.real }} />real (capital pago)</span>
        <span className="flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: PALETA.agenda }} />agenda do banco</span>
      </div>
    </div>
  )
}

/** os chips do split da parcela paga (capital · juros · correção · apurado) */
export function SplitEmChips({ capital, juros, correcao, mora }: { capital: number; juros: number; correcao: number; mora: number }) {
  return (
    <div data-split className="mt-2.5 flex flex-wrap gap-2">
      <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: PALETA.indSuave, color: PALETA.capTinta }}>capital <b>{fmt(capital)}</b></span>
      <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: PALETA.jurSuave, color: PALETA.jurTinta }}>juros <b>{fmt(juros)}</b></span>
      {correcao > 0 && <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: PALETA.corSuave, color: PALETA.corTinta }}>correção <b>{fmt(correcao)}</b></span>}
      {mora > 0 && <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: 'var(--emp-rosbg)', color: 'var(--emp-ros)' }}>multa <b>{fmt(mora)}</b></span>}
      <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: PALETA.okSuave, color: PALETA.okTinta }}>encargo apurado no pagamento ✓</span>
    </div>
  )
}
