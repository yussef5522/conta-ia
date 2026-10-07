'use client'

/**
 * ⭐⭐⭐ MARGEM & EQUILÍBRIO v3 — "QUEM PAGA A CASA" (07/10/2026). Visual v4, por TOKEN.
 *
 * ⛔⛔ **A TELA NÃO CALCULA NADA DE DINHEIRO.** Sobra, tijolos, selos, cobertura, veredito e
 * placar vêm do payload (`lerMargem`). Derivar aqui seria a 2ª resposta pra *"quem paga a
 * casa?"*, e ela divergiria do aviso do sininho, que lê a MESMA lib. A tela **formata e
 * desenha** — inclusive a casa, que é SVG sobre as frações que o servidor mandou.
 *
 * ⛔ **ZERO HEX CRAVADO**: tudo por `var(--prod-*)` e `var(--fam-*)`, que invertem nos dois
 * temas. ⚠️ E nada de `bg-[var(--x)]/70` — no Tailwind 3 opacidade sobre valor arbitrário sai
 * **transparente** (a armadilha de 05/10).
 *
 * ⛔ **UMA composição, dois viewports** (REGRA 12): o grid empilha por `lg:`; não existe bloco
 * só-celular. Duas composições do mesmo dado divergiriam no 1º selo novo.
 */

import { use, useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Flag, Home, Loader2, Sparkles, Trophy,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { LogoDaReceita } from '@/components/estoque/logo-da-receita'
import { EMOJI_DO_SELO, type AbaDaLiga } from '@/lib/margem/liga'
import type { PeriodoDaMargem } from '@/lib/margem/janela'
import type { MargemDaTela } from '@/lib/margem/leitura'

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

const pct = (n: number | null | undefined, casas = 0) =>
  n == null ? 'a apurar' : `${(n * 100).toFixed(casas)}%`
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

const PERIODOS: { k: PeriodoDaMargem; r: string }[] = [
  { k: 'HOJE', r: 'hoje' },
  { k: 'SEMANA', r: '7 dias' },
  { k: 'MES', r: 'mês' },
  { k: 'DATAS', r: 'datas' },
]

const ABAS: { k: AbaDaLiga; r: string }[] = [
  { k: 'CAIXA', r: 'encheu o caixa' },
  { k: 'MARGEM', r: 'melhor margem' },
  { k: 'VENDIDOS', r: 'mais vendidos' },
]

export default function MargemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = use(params)

  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<MargemDaTela | null>(null)
  const [periodo, setPeriodo] = useState<PeriodoDaMargem>('MES')
  const [aba, setAba] = useState<AbaDaLiga>('CAIXA')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [abrirAgrupado, setAbrirAgrupado] = useState(false)
  const [abrirFora, setAbrirFora] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    const qs = new URLSearchParams({ periodo, aba })
    if (periodo === 'DATAS' && de) qs.set('de', de)
    if (periodo === 'DATAS' && ate) qs.set('ate', ate)
    const r = await fetchComTimeout<MargemDaTela>(`/api/empresas/${empresaId}/margem?${qs}`)
    if (!r.ok || !r.data) {
      // ⛔ erro e vazio NUNCA juntos: afirmar "não há venda" a partir de uma falha de rede
      // é inventar (a lição da lixeira, 20/09)
      setErro(r.erro ?? 'não consegui carregar')
      setEstado('FALHOU')
      return
    }
    setDados(r.data)
    setEstado('OK')
  }, [empresaId, periodo, aba, de, ate])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="space-y-4" style={{ background: 'var(--prod-bg)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5" style={{ color: 'var(--prod-accent)' }} />
          <h1 className="text-base font-semibold" style={{ color: 'var(--prod-primary)' }}>
            Quem paga a casa
          </h1>
          <span className="hidden text-xs lg:inline" style={{ color: 'var(--prod-muted)' }}>
            {dados?.janela.rotulo ?? ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => setPeriodo(p.k)}
              className="h-8 rounded-md px-2.5 text-xs font-medium"
              style={
                periodo === p.k
                  ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
                  : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }
              }
            >
              {p.r}
            </button>
          ))}
          {periodo === 'DATAS' && (
            <span className="flex items-center gap-1">
              <label className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                de
                <input
                  type="date" value={de} onChange={(e) => setDe(e.target.value)}
                  className="ml-1 h-8 rounded-md border px-1.5 text-xs"
                  style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                />
              </label>
              <label className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                até
                <input
                  type="date" value={ate} onChange={(e) => setAte(e.target.value)}
                  className="ml-1 h-8 rounded-md border px-1.5 text-xs"
                  style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                />
              </label>
            </span>
          )}
        </div>
      </div>

      {estado === 'CARREGANDO' && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm" style={{ color: 'var(--prod-muted)' }}>
          <Loader2 className="h-4 w-4 animate-spin" /> lendo o período…
        </CardContent></Card>
      )}

      {estado === 'FALHOU' && (
        <Card><CardContent className="space-y-2 p-5">
          <p className="text-sm font-medium" style={{ color: 'var(--fam-coral-ink)' }}>
            Não consegui carregar: {erro}
          </p>
          <button
            type="button" onClick={() => void carregar()}
            className="h-8 rounded-md px-2.5 text-xs font-medium"
            style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}
          >
            tentar de novo
          </button>
        </CardContent></Card>
      )}

      {estado === 'OK' && dados && (
        <>
          <LinhaDeChegadaCard d={dados} />
          <CasaDeTijolos
            d={dados}
            abrirAgrupado={abrirAgrupado}
            setAbrirAgrupado={setAbrirAgrupado}
            abrirFora={abrirFora}
            setAbrirFora={setAbrirFora}
            empresaId={empresaId}
          />
          <LigaCard d={dados} aba={aba} setAba={setAba} empresaId={empresaId} />
          <FilaDeSabores d={dados} empresaId={empresaId} />
        </>
      )}
    </div>
  )
}

/* ─────────────────────────── 1. A LINHA DE CHEGADA ─────────────────────────── */

/**
 * ⚠️ **SEM fundo escuro e SEM itálico** (ordem do dono). E **sem hora**: a venda chega
 * agregada por DIA (`data` é 15:00Z cravado) e o dia corrente fica vazio até a madrugada —
 * projetar `~HH:MM` sobre um total diário seria fabricar precisão. O cartão diz QUAL dia é.
 */
function LinhaDeChegadaCard({ d }: { d: MargemDaTela }) {
  const l = d.linhaDeChegada
  const bateu = l.bateu
  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
            <Flag className="h-3.5 w-3.5" style={{ color: 'var(--prod-accent)' }} />
            a linha de chegada do dia
          </p>
          {l.dia && (
            <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
              {l.ehHoje ? 'hoje' : ddmm(l.dia)}
            </span>
          )}
        </div>

        {/* a barra: enche com a sobra do dia contra a casa do dia */}
        <div className="relative h-7 w-full overflow-hidden rounded-lg" style={{ background: 'var(--prod-surface-1)' }}>
          <div
            className="h-full rounded-lg transition-all"
            style={{
              width: `${Math.max(2, (l.pct ?? 0) * 100)}%`,
              background: bateu ? 'var(--fam-verde-mid)' : 'var(--fam-indigo-mid)',
            }}
          />
          {/* ⭐ a bandeirinha do equilíbrio fica no 100%, não no fim da barra */}
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[13px]" aria-hidden>
            {bateu ? '🏁' : ''}
          </span>
        </div>

        <p className="text-[13px] font-medium" style={{ color: bateu ? 'var(--fam-verde-ink)' : 'var(--prod-primary)' }}>
          {l.frase}
        </p>
        <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
          casa do dia {l.casaDoDia == null ? 'a apurar' : formatBRL(l.casaDoDia)}
          {l.sobra != null && ` · sobra do dia ${formatBRL(l.sobra)}`}
          {l.unidades > 0 && ` · ${l.unidades} un`}
        </p>
        {/* ⚠️ a ressalva é obrigatória quando o dia mostrado não é hoje */}
        {l.ressalva && (
          <p className="text-[11.5px]" style={{ color: 'var(--prod-accent)' }}>{l.ressalva}</p>
        )}
      </CardContent>
    </Card>
  )
}

/* ─────────────────────────── 2. A CASA DE TIJOLOS ─────────────────────────── */

/**
 * ⭐⭐ A casa é **SVG responsivo** sobre as frações que o servidor mandou — `pctDaSobra` é a
 * ALTURA de cada tijolo, empilhada da base (maior contribuinte) ao telhado.
 *
 * ⚠️ `viewBox` + `width:100%` é o que a faz legível em 390px sem uma 2ª composição.
 */
function CasaDeTijolos({
  d, abrirAgrupado, setAbrirAgrupado, abrirFora, setAbrirFora, empresaId,
}: {
  d: MargemDaTela
  abrirAgrupado: boolean
  setAbrirAgrupado: (v: boolean) => void
  abrirFora: boolean
  setAbrirFora: (v: boolean) => void
  empresaId: string
}) {
  const c = d.casa
  const L = 300 // largura do viewBox
  const H = 260 // altura das PAREDES (o telhado fica acima)
  const TELHADO = 46

  // ⭐⭐ A PILHA OCUPA O NÍVEL PAGO, e cada tijolo é a fatia DELE dentro desse nível.
  //
  // ⛔ Até 07/10 a altura era `pctDaSobra × H` com o pct dividido pelo CUSTO FIXO: com a casa
  // paga (prod: sobra 152% da casa) a pilha passava do telhado, o `Math.max(0, y)` clampava e
  // os tijolos de cima **se sobrepunham**. Agora a proporção entre tijolos é intocada e quem
  // decide a altura TOTAL é o `pctPago` (que já vem clampado em 1) — o transbordo é a faixa
  // própria logo abaixo, nunca tijolo saindo do desenho.
  const alturaPaga = Math.min(H, (c.pctPago ?? (c.sobraTotal > 0 ? 1 : 0)) * H)
  let y = H
  const desenho = c.tijolos.map((t) => {
    const h = Math.max(3, Math.min(H, t.pctDaSobra * alturaPaga))
    y -= h
    return { t, y: Math.max(0, y), h }
  })

  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
            a casa do período · custo fixo {c.custoFixo == null ? 'a apurar' : formatBRL(c.custoFixo)}
          </p>
          {/* ⛔ a tela DIZ a composição dos chips — o mesmo mês custa números diferentes */}
          <span className="text-[11px]" style={{ color: 'var(--prod-accent)' }}>
            {c.composicao.texto}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          {/* ───────── o desenho ───────── */}
          <div className="mx-auto w-full max-w-[320px]">
            <svg viewBox={`0 0 ${L} ${H + TELHADO}`} className="w-full" role="img"
              aria-label={`A casa do período: ${c.pctPago == null ? 'a apurar' : pct(c.pctPago)} paga`}>
              {/* telhado = 100% do custo fixo */}
              <polygon
                points={`${L / 2},2 ${L - 6},${TELHADO} 6,${TELHADO}`}
                fill={c.veredito.estado === 'PAGA' ? 'var(--fam-verde-mid)' : 'var(--prod-line-strong)'}
              />
              {/* paredes (o vazio, pra o que falta ficar visível) */}
              <rect x="6" y={TELHADO} width={L - 12} height={H} rx="4"
                fill="var(--prod-surface-1)" stroke="var(--prod-line)" strokeWidth="1" />
              {/* os tijolos */}
              {desenho.map(({ t, y: ty, h }) => (
                <g key={t.chave}>
                  <rect
                    x="10" y={TELHADO + ty} width={L - 20} height={Math.max(2, h - 1.5)} rx="2.5"
                    fill={`var(--fam-${t.familia}-mid)`}
                  />
                  {h >= 26 && (
                    <text x="20" y={TELHADO + ty + h / 2 + 4} fontSize="11" fontWeight="600"
                      fill="var(--prod-acao-ink)">
                      {t.rei ? '👑 ' : ''}{t.nome.length > 24 ? `${t.nome.slice(0, 23)}…` : t.nome}
                    </text>
                  )}
                  {h >= 26 && t.pctDaCasa != null && (
                    <text x={L - 20} y={TELHADO + ty + h / 2 + 4} fontSize="10" textAnchor="end"
                      fill="var(--prod-acao-ink)">
                      {pct(t.pctDaCasa)}
                    </text>
                  )}
                  {h >= 12 && h < 26 && (
                    <text x="20" y={TELHADO + ty + h / 2 + 3.5} fontSize="9" fill="var(--prod-acao-ink)">
                      {t.nome.length > 18 ? `${t.nome.slice(0, 17)}…` : t.nome}
                    </text>
                  )}
                </g>
              ))}
              {/* a linha do que falta pra fechar o telhado */}
              {c.falta != null && (
                <line x1="6" y1={TELHADO + (H - alturaPaga)} x2={L - 6} y2={TELHADO + (H - alturaPaga)}
                  stroke="var(--fam-coral-mid)" strokeWidth="1.5" strokeDasharray="4 3" />
              )}
            </svg>

            {/* o transbordo fica ACIMA do telhado, em faixa verde */}
            {c.transbordo != null && (
              <p className="mt-1 rounded-md px-2 py-1 text-center text-[12px] font-semibold"
                style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}>
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                já transbordou +{formatBRL(c.transbordo)}
              </p>
            )}
          </div>

          {/* ───────── os números ───────── */}
          <div className="space-y-2.5">
            <div>
              <p className="text-[22px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                {c.pctPago == null ? 'a apurar' : pct(c.pctPago, 1)}
                <span className="ml-1.5 text-[12px] font-normal" style={{ color: 'var(--prod-muted)' }}>
                  da casa
                </span>
              </p>
              <p className="text-[13px] font-medium"
                style={{ color: c.veredito.estado === 'PAGA' ? 'var(--fam-verde-ink)' : 'var(--prod-secondary)' }}>
                {c.veredito.estado === 'PAGA'
                  ? '✓ casa paga'
                  : c.veredito.estado === 'EM_OBRA'
                    ? `casa em obra — faltam ${formatBRL(c.falta ?? 0)} pra fechar o telhado`
                    : 'declare o plano dos custos fixos'}
              </p>
              {/* ⛔⛔ o veredito NUNCA aparece seco sobre dado parcial */}
              {c.veredito.ressalva && (
                <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--prod-accent)' }}>
                  {c.veredito.ressalva}
                </p>
              )}
            </div>

            {/* a conta, aberta — incluindo o complemento NOMEADO */}
            <dl className="space-y-1 text-[12.5px]">
              <Conta rotulo="sobra dos produtos" valor={formatBRL(c.sobraTotal)} />
              <Conta
                rotulo={`− complementos (${c.complementos.ocorrenciasComCusto} ocorrências)`}
                valor={`−${formatBRL(c.complementos.custo)}`}
                tom="coral"
              />
              <Conta rotulo="= sobra que paga a casa" valor={formatBRL(c.sobraLiquida)} forte />
              <Conta rotulo="a casa custa" valor={c.custoFixo == null ? 'a apurar' : formatBRL(c.custoFixo)} />
            </dl>
            {/* ⚠️ o custo do complemento é um PISO — a tela diz */}
            {c.complementos.ocorrenciasSemCusto > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                ⚠️ {c.complementos.ocorrenciasSemCusto} ocorrências de complemento ainda sem ficha — o
                custo acima é o mínimo, não o total
              </p>
            )}

            {/* o placar */}
            <div className="rounded-md px-2.5 py-2" style={{ background: 'var(--prod-surface-1)' }}>
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                {c.placar.dia
                  ? `🏁 a casa deste período se pagou no dia ${ddmm(c.placar.dia)}`
                  : 'o dia em que a casa se pagou: a apurar'}
              </p>
              {c.placar.porque && (
                <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>{c.placar.porque}</p>
              )}
            </div>

            {/* cobertura */}
            <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
              cobertura: {pct(c.cobertura.pct)} das unidades vendidas têm custo ·{' '}
              {c.cobertura.produtosDentro} na obra · {c.cobertura.produtosFora} fora
            </p>
          </div>
        </div>

        {/* ───────── o tijolo agrupado ───────── */}
        {c.tijolos.at(-1)?.agrupado && (
          <div className="border-t pt-2" style={{ borderColor: 'var(--prod-line)' }}>
            <button type="button" onClick={() => setAbrirAgrupado(!abrirAgrupado)}
              aria-expanded={abrirAgrupado}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px]"
              style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-secondary)' }}>
              {abrirAgrupado ? 'fechar' : `ver os ${c.tijolos.at(-1)!.agrupado!.quantos} produtos do tijolo agrupado`}
            </button>
            {abrirAgrupado && (
              <ul className="mt-1.5 space-y-0.5">
                {c.tijolos.at(-1)!.agrupado!.itens.map((i) => (
                  <li key={i.chave} className="flex items-baseline justify-between gap-2 text-[12px]">
                    <a href={`/empresas/${empresaId}/estoque/cardapio/${encodeURIComponent(i.chave)}`}
                      className="truncate hover:underline" style={{ color: 'var(--prod-primary)' }}>
                      {i.nome}
                    </a>
                    <span className="tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                      {formatBRL(i.sobraTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ───────── 🪑 FORA DA OBRA ───────── */}
        {c.fora.length > 0 && (
          <div className="border-t pt-2" style={{ borderColor: 'var(--prod-line)' }}>
            <button type="button" onClick={() => setAbrirFora(!abrirFora)} aria-expanded={abrirFora}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px]"
              style={{ borderColor: 'var(--fam-ambar-mid)', color: 'var(--fam-ambar-ink)' }}>
              🪑 {c.fora.length} produto{c.fora.length > 1 ? 's' : ''} fora da obra — vendem e eu
              não sei o custo {abrirFora ? '▴' : '▾'}
            </button>
            {abrirFora && (
              <ul className="mt-1.5 space-y-1">
                {c.fora.map((f) => (
                  <li key={f.chave} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5
                    rounded-md border border-dashed px-2 py-1.5"
                    style={{ borderColor: 'var(--prod-line-strong)' }}>
                    <a href={`/empresas/${empresaId}/estoque/cardapio/${encodeURIComponent(f.chave)}`}
                      className="text-[12.5px] font-medium hover:underline" style={{ color: 'var(--prod-primary)' }}>
                      {f.nome} <ArrowRight className="inline h-3 w-3" style={{ color: 'var(--prod-accent)' }} />
                    </a>
                    <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                      {f.unidades} un
                    </span>
                    <p className="w-full text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                      {f.porque}
                      {f.custoParcial != null && ` · já sei ${formatBRL(f.custoParcial)} do custo`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Conta({ rotulo, valor, forte, tom }: { rotulo: string; valor: string; forte?: boolean; tom?: 'coral' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt style={{ color: tom === 'coral' ? 'var(--fam-coral-ink)' : 'var(--prod-muted)' }}>{rotulo}</dt>
      <dd className={`tabular-nums ${forte ? 'font-semibold' : ''}`}
        style={{ color: forte ? 'var(--prod-primary)' : tom === 'coral' ? 'var(--fam-coral-ink)' : 'var(--prod-secondary)' }}>
        {valor}
      </dd>
    </div>
  )
}

/* ─────────────────────────── 3. A LIGA ─────────────────────────── */

function LigaCard({
  d, aba, setAba, empresaId,
}: { d: MargemDaTela; aba: AbaDaLiga; setAba: (a: AbaDaLiga) => void; empresaId: string }) {
  const l = d.liga
  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
            <Trophy className="h-3.5 w-3.5" style={{ color: 'var(--prod-accent)' }} />
            a liga do período
          </p>
          <div className="flex gap-1">
            {ABAS.map((a) => (
              <button key={a.k} type="button" onClick={() => setAba(a.k)}
                className="h-7 rounded-md px-2 text-[11.5px] font-medium"
                style={aba === a.k
                  ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
                  : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>
                {a.r}
              </button>
            ))}
          </div>
        </div>

        {l.cortes.sobra != null && (
          <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
            os selos cortam pela MEDIANA do período: sobra {formatBRL(l.cortes.sobra)} · {l.cortes.unidades} un
          </p>
        )}

        {l.linhas.length === 0 ? (
          <p className="py-4 text-center text-[13px]" style={{ color: 'var(--prod-muted)' }}>
            nenhum produto com custo conhecido neste período
          </p>
        ) : (
          <ul>
            {l.linhas.map((x, i) => (
              <li key={x.chave}
                className="grid grid-cols-1 gap-x-3 gap-y-1 border-t px-1 py-2 lg:grid-cols-[1fr_190px_150px] lg:items-center"
                style={{ borderColor: 'var(--prod-line)', background: i % 2 ? 'var(--prod-surface-1)' : undefined }}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-center text-[13px]" aria-hidden>
                    {x.medalha ? ['🥇', '🥈', '🥉'][x.medalha - 1] : <span style={{ color: 'var(--prod-muted)' }}>{x.posicao}</span>}
                  </span>
                  {/* ⭐ REGRA 4: o logo deriva do NOME pela MESMA `caraDaReceita` que o
                      servidor usou pro `familia`/`icone` do payload — passar `forcar` aqui
                      seria uma 2ª derivação da mesma pergunta, e elas divergiriam no 1º
                      grupo novo do mapa. */}
                  <LogoDaReceita nome={x.nome} tamanho={32} />
                  <div className="min-w-0">
                    <a href={`/empresas/${empresaId}/estoque/cardapio/${encodeURIComponent(x.chave)}`}
                      className="block truncate text-[13.5px] font-medium hover:underline"
                      style={{ color: 'var(--prod-primary)' }}>
                      {x.nome}
                    </a>
                    <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                      {EMOJI_DO_SELO[x.selo]} {x.frase}
                    </p>
                  </div>
                </div>
                {/* a barra proporcional ao 1º da aba */}
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--prod-surface-1)' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.max(2, x.barra * 100)}%`, background: `var(--fam-${x.familia}-mid)` }} />
                </div>
                <div className="text-[13px] tabular-nums lg:text-right">
                  <span className="font-semibold" style={{ color: 'var(--prod-primary)' }}>
                    {aba === 'VENDIDOS' ? `${x.unidades} un` : aba === 'MARGEM' ? pct(x.margemPct, 1) : formatBRL(x.sobraTotal)}
                  </span>
                  <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                    {formatBRL(x.sobraUn)}/un · {x.unidades} un · {pct(x.margemPct, 0)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/* ─────────────────────────── 8. A FILA DE SABORES ─────────────────────────── */

function FilaDeSabores({ d, empresaId }: { d: MargemDaTela; empresaId: string }) {
  if (d.saboresSemFicha.length === 0 && d.diasComRelatorioSuspeito.length === 0) return null
  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-2 p-4">
        {d.saboresSemFicha.length > 0 && (
          <>
            <p className="text-[12.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
              🧩 {d.saboresSemFicha.length} sabores vendidos sem ficha
            </p>
            <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
              cada um que ganhar ficha entra na obra e a cobertura sobe
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {d.saboresSemFicha.slice(0, 24).map((s) => (
                <li key={s.nomeSuitable}>
                  <a href={`/empresas/${empresaId}/estoque/cardapio?sabor=${encodeURIComponent(s.nomeSuitable)}`}
                    className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] hover:underline"
                    style={{ borderColor: 'var(--fam-ambar-mid)', color: 'var(--fam-ambar-ink)' }}>
                    <span className="tabular-nums">{s.ocorrencias}×</span> {s.nomeSuitable}
                  </a>
                </li>
              ))}
            </ul>
            {d.saboresSemFicha.length > 24 && (
              <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                e mais {d.saboresSemFicha.length - 24} — os de maior volume aparecem primeiro
              </p>
            )}
          </>
        )}

        {/* ⚠️ o aviso de QUALIDADE DE DADO (item 1 do dono): razão sabor/pizza impossível */}
        {d.diasComRelatorioSuspeito.length > 0 && (
          <div className="rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--fam-coral-mid)' }}>
            <p className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--fam-coral-ink)' }}>
              <AlertTriangle className="h-3.5 w-3.5" /> relatório de complementos possivelmente incompleto
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {d.diasComRelatorioSuspeito.map((x) => (
                <li key={x.dia} className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                  {ddmm(x.dia)}: {x.pizzas} pizzas × {x.sabores} sabores no relatório — toda pizza
                  obriga ao menos 1 sabor
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
