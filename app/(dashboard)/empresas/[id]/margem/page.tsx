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
import { montarPlacar, montarCarregadores, type TomDoResultado } from '@/lib/margem/placar'
import { montarPizza, type PizzaMontada, type SaborDisponivel } from '@/lib/margem/montador'
import type { CatalogoDoMontador } from '@/lib/margem/leitura-montador'
import type { TamanhoDePizza } from '@/lib/margem/tamanhos'
import { sanitizarQtd, valorQtd } from '@/lib/stock/quantidade'
import { filtrarPorBusca } from '@/lib/busca-texto'
import { COBERTURA_MINIMA } from '@/lib/margem/casa'
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
          <PlacarDaCasa d={dados} />
          <QuemCarregouACasa
            d={dados}
            abrirResto={abrirAgrupado}
            setAbrirResto={setAbrirAgrupado}
            abrirFora={abrirFora}
            setAbrirFora={setAbrirFora}
            empresaId={empresaId}
          />
          <MontadorDePizza empresaId={empresaId} />
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

/* ───────────────── 2. O PLACAR DA CASA (v2 — os tijolos SVG morreram) ───────────────── */

/**
 * ⛔⛔ A CASA DE TIJOLOS SVG MORREU AQUI (07/10, v2) — o dono reprovou por ILEGIBILIDADE, e a
 * prova em prod já tinha mostrado o custo estrutural dela: com a sobra em 152% da casa a pilha
 * estourava o telhado e os tijolos de cima se sobrepunham. **Três números e uma barra dizem o
 * mesmo em um olhar.**
 *
 * ⭐ A tela NÃO calcula: `montarPlacar` é lib PURA e é a MESMA que o teste executa. A conta dos
 * três cartões FECHA na tela (`sobra − casa = resultado`), que é o que torna o número defensável.
 */
function PlacarDaCasa({ d }: { d: MargemDaTela }) {
  const c = d.casa
  const p = montarPlacar(c)

  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
            o placar do período · {c.dias} dia{c.dias > 1 ? 's' : ''}
          </p>
          {/* ⛔ a tela DIZ a composição dos chips — o mesmo mês custa números diferentes */}
          <span className="text-[11px]" style={{ color: 'var(--prod-accent)' }}>
            {c.composicao.texto}
          </span>
        </div>

        {/* ───────── os 3 cartões — no celular empilham ───────── */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <CartaoDoPlacar c={p.sobra} />
          <CartaoDoPlacar c={p.casa} />
          <CartaoDoPlacar
            c={p.resultado}
            tom={p.resultado.tom}
            ressalva={p.resultado.ressalva}
            prefixo={p.resultado.tom === 'PAGOU' ? '+' : undefined}
          />
        </div>

        {/* ───────── a barra: índigo até a bandeira, verde no transbordo ───────── */}
        {p.barra && (
          <div className="space-y-1">
            <div
              className="flex h-7 w-full overflow-hidden rounded-md"
              style={{ background: 'var(--prod-surface-1)' }}
              role="img"
              aria-label={
                p.barra.bandeira
                  ? `A casa foi paga e sobrou ${p.barra.rotuloTransbordo}`
                  : `Pago ${p.barra.rotuloParcial}`
              }
            >
              <div
                className="flex items-center justify-end gap-1 px-1.5"
                style={{ width: `${Math.max(2, p.barra.pago * 100)}%`, background: 'var(--fam-indigo-mid)' }}
              >
                {p.barra.rotuloParcial && (
                  <span className="truncate text-[11px] font-medium" style={{ color: 'var(--prod-acao-ink)' }}>
                    {p.barra.rotuloParcial}
                  </span>
                )}
                {p.barra.bandeira && <span className="text-[12px] leading-none">🏁</span>}
              </div>
              {p.barra.transbordo > 0 && (
                <div
                  className="flex items-center px-1.5"
                  style={{ width: `${p.barra.transbordo * 100}%`, background: 'var(--fam-verde-mid)' }}
                >
                  <span className="truncate text-[11px] font-medium" style={{ color: 'var(--prod-acao-ink)' }}>
                    {p.barra.rotuloTransbordo}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
              🏁 = a casa paga · o verde depois dela é o que sobrou
            </p>
          </div>
        )}

        {/* ───────── a conta, aberta — com o complemento NOMEADO ───────── */}
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

        {/* ───────── o placar do dia D, gateado pela cobertura ───────── */}
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
      </CardContent>
    </Card>
  )
}

/** ⚠️ `valor` nulo vira **"a apurar"**, nunca R$ 0,00 — ausência de plano não é casa de graça */
function CartaoDoPlacar({
  c, tom, ressalva, prefixo,
}: {
  c: { rotulo: string; valor: number | null; sublinha: string }
  tom?: TomDoResultado
  ressalva?: string | null
  prefixo?: string
}) {
  const fundo =
    tom === 'PAGOU' ? 'var(--fam-verde-bg)' : tom === 'EM_OBRA' ? 'var(--prod-surface-1)' : 'var(--prod-surface-1)'
  const tinta = tom === 'PAGOU' ? 'var(--fam-verde-ink)' : 'var(--prod-primary)'
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ background: fundo, borderColor: 'var(--prod-line)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
        {c.rotulo}
      </p>
      <p className="text-[21px] font-semibold tabular-nums" style={{ color: tinta }}>
        {c.valor == null ? 'a apurar' : `${prefixo ?? ''}${formatBRL(c.valor)}`}
      </p>
      <p className="text-[11.5px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>
        {c.sublinha}
      </p>
      {/* ⛔⛔ o veredito NUNCA aparece seco sobre dado parcial — o guard de v1 que não cai */}
      {ressalva && (
        <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--prod-accent)' }}>
          {ressalva}
        </p>
      )}
    </div>
  )
}

/* ───────────────── 3. QUEM CARREGOU A CASA ───────────────── */

/**
 * ⭐ A lista que substituiu os tijolos: bolinha da família + nome + barra + "% da casa · R$ X".
 * ⚠️ A barra de cada linha é relativa ao MAIOR (não à casa): com a casa paga, metade das linhas
 * encostaria no fim e a comparação entre produtos — que é a pergunta desta lista — sumiria.
 */
function QuemCarregouACasa({
  d, abrirResto, setAbrirResto, abrirFora, setAbrirFora, empresaId,
}: {
  d: MargemDaTela
  abrirResto: boolean
  setAbrirResto: (v: boolean) => void
  abrirFora: boolean
  setAbrirFora: (v: boolean) => void
  empresaId: string
}) {
  const l = montarCarregadores(d.casa, d.saboresSemFicha.length)
  const linhas = abrirResto ? [...l.visiveis, ...l.resto] : l.visiveis

  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-2 p-4">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
          quem carregou a casa
        </p>

        {linhas.length === 0 && (
          <p className="text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
            nenhum produto com custo conhecido vendeu neste período
          </p>
        )}

        <ul className="space-y-1">
          {linhas.map((x) => (
            <li key={x.chave}>
              <a
                href={`/empresas/${empresaId}/estoque/cardapio/${encodeURIComponent(x.chave)}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:underline"
              >
                <LogoDaReceita nome={x.nome} tamanho={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                      {x.rei ? '👑 ' : ''}{x.nome}
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
                      {x.pctDaCasa == null ? '' : `${pct(x.pctDaCasa, 1)} da casa · `}
                      {formatBRL(x.sobraTotal)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--prod-surface-1)' }}>
                    <span style={{ width: `${Math.max(2, x.pctDaBarra * 100)}%`, background: `var(--fam-${x.familia}-mid)` }} />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        {l.resto.length > 0 && (
          <button type="button" onClick={() => setAbrirResto(!abrirResto)} aria-expanded={abrirResto}
            className="rounded-md border px-2 py-1 text-[11.5px]"
            style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-secondary)' }}>
            {abrirResto ? 'mostrar só os 6 maiores' : `+${l.resto.length} produtos · ver todos`}
          </button>
        )}

        {/* ───────── o rodapé âmbar: o que está fora e o que destrava a cobertura ───────── */}
        <div className="rounded-md border px-2.5 py-2" style={{ borderColor: 'var(--fam-ambar-mid)' }}>
          <p className="text-[12px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>
            🪑 {l.rodape.foraDaObra} fora da obra · {l.rodape.saboresSemFicha} sabores sem ficha — criar
            fichas sobe a cobertura ({pct(l.rodape.cobertura)} → meta {pct(COBERTURA_MINIMA)})
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <a href={`/empresas/${empresaId}/estoque/cardapio`}
              className="rounded-md border px-2 py-0.5 text-[11.5px] hover:underline"
              style={{ borderColor: 'var(--fam-ambar-mid)', color: 'var(--fam-ambar-ink)' }}>
              ir pra fila das fichas <ArrowRight className="inline h-3 w-3" />
            </a>
            {d.casa.fora.length > 0 && (
              <button type="button" onClick={() => setAbrirFora(!abrirFora)} aria-expanded={abrirFora}
                className="rounded-md border px-2 py-0.5 text-[11.5px]"
                style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-secondary)' }}>
                {abrirFora ? 'fechar' : 'ver quem está fora da obra'}
              </button>
            )}
          </div>
          {abrirFora && (
            <ul className="mt-1.5 space-y-1">
              {d.casa.fora.map((f) => (
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
      </CardContent>
    </Card>
  )
}

/* ───────────────── 4. O MONTADOR DE PIZZA DE TESTE ───────────────── */

/**
 * ⭐⭐ A BANCADA — escolho o tamanho, toco na fatia, vejo o custo e a sobra por canal.
 *
 * ⛔⛔ **SÓ SIMULAÇÃO: nada grava, nada baixa estoque.** A garantia é de forma — o único POST
 * desta seção é o da CONFIG (semear canais / apontar a base), nunca uma gravação de pizza.
 *
 * ⭐ A conta é a lib PURA `montarPizza`, a mesma que o teste executa: a regra de 02/09 vale
 * aqui tanto quanto na baixa — **1 ocorrência = 1 explosão, SEM fator por tamanho**.
 *
 * ⚠️ O catálogo carrega sob demanda (abrir a seção) pra não pesar o 1º paint da tela.
 */
function MontadorDePizza({ empresaId }: { empresaId: string }) {
  const [aberto, setAberto] = useState(false)
  const [cat, setCat] = useState<CatalogoDoMontador | null>(null)
  const [estado, setEstado] = useState<'VAZIO' | 'CARREGANDO' | 'FALHOU' | 'OK'>('VAZIO')
  const [erro, setErro] = useState('')
  const [tamanhoSel, setTamanhoSel] = useState<string | null>(null)
  const [escolhas, setEscolhas] = useState<(SaborDisponivel | null)[]>([])
  const [fatiaAberta, setFatiaAberta] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [precoTxt, setPrecoTxt] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    const r = await fetchComTimeout<CatalogoDoMontador>(
      `/api/empresas/${empresaId}/margem/montador`,
    )
    if (!r.ok || !r.data) {
      setErro(r.erro ?? 'não consegui carregar a bancada')
      setEstado('FALHOU')
      return
    }
    setCat(r.data)
    setEstado('OK')
    // ⭐ abre no 1º tamanho PRONTO (a lib já ordena os prontos primeiro)
    const pronto = r.data.tamanhos.find((t) => t.sabores > 0 && t.base != null) ?? r.data.tamanhos[0]
    if (pronto) {
      setTamanhoSel(pronto.tamanho)
      setEscolhas(Array.from({ length: Math.max(0, pronto.sabores) }, () => null))
    }
  }, [empresaId])

  useEffect(() => {
    if (aberto && estado === 'VAZIO') void carregar()
  }, [aberto, estado, carregar])

  async function semear() {
    setSalvando(true)
    const r = await fetchComTimeout<{ efeito: string }>(
      `/api/empresas/${empresaId}/margem/config`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acao: 'SEMEAR' }),
        timeoutMs: 60_000,
      },
    )
    setSalvando(false)
    if (!r.ok) {
      setErro(r.erro ?? 'não consegui semear a config')
      return
    }
    setEstado('VAZIO')
    void carregar()
  }

  const tamanho = cat?.tamanhos.find((t) => t.tamanho === tamanhoSel) ?? null
  const pizza = tamanho
    ? montarPizza({
        tamanho,
        escolhas,
        precoVenda: valorQtd(precoTxt),
        canais: cat?.canais ?? [],
      })
    : null

  function trocarTamanho(t: TamanhoDePizza) {
    setTamanhoSel(t.tamanho)
    // ⚠️ as escolhas RESETAM: a grande de 2 sabores virando família de 3 deixaria uma fatia
    // órfã, e a conta somaria um sabor que a tela não desenha mais
    setEscolhas(Array.from({ length: Math.max(0, t.sabores) }, () => null))
    setFatiaAberta(null)
  }

  const saboresFiltrados = cat ? filtrarPorBusca(cat.sabores, busca, (s) => s.nome) : []

  return (
    <Card style={{ background: 'var(--prod-surface)' }}>
      <CardContent className="space-y-3 p-4">
        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto}
          className="flex w-full items-center justify-between gap-2 text-left">
          <span>
            <span className="block text-[13px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
              🍕 montar uma pizza de teste
            </span>
            <span className="block text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
              quanto custa e quanto sobra, por canal — só simulação, nada grava
            </span>
          </span>
          <span className="text-[12px]" style={{ color: 'var(--prod-accent)' }}>
            {aberto ? 'fechar' : 'abrir'}
          </span>
        </button>

        {aberto && estado === 'CARREGANDO' && (
          <p className="text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>carregando a bancada…</p>
        )}

        {aberto && estado === 'FALHOU' && (
          <div className="space-y-1.5">
            <p className="text-[12.5px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>
            <button type="button" onClick={() => void carregar()}
              className="h-8 rounded-md px-2.5 text-xs font-medium"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              tentar de novo
            </button>
          </div>
        )}

        {aberto && estado === 'OK' && cat && (
          <div className="space-y-3">
            {/* ⚠️ o que falta, NOMEADO — bancada vazia sem motivo é indistinguível de quebrada */}
            {cat.faltando.length > 0 && (
              <div className="space-y-1.5 rounded-md border px-2.5 py-2" style={{ borderColor: 'var(--fam-ambar-mid)' }}>
                {cat.faltando.map((f) => (
                  <p key={f.oQue} className="text-[11.5px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>
                    {f.frase}
                  </p>
                ))}
                {cat.faltando.some((f) => f.oQue === 'canais' || f.oQue === 'sabores-por-tamanho') && (
                  <button type="button" disabled={salvando} onClick={() => void semear()}
                    className="h-7 rounded-md px-2 text-[11.5px] font-medium disabled:opacity-50"
                    style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
                    {salvando ? 'semeando…' : 'usar os padrões (balcão 0% · tele própria 0% · iFood 20% · pequena 1 · grande 2 · família 3)'}
                  </button>
                )}
              </div>
            )}

            {/* ───────── os tamanhos ───────── */}
            <div className="flex flex-wrap gap-1.5">
              {cat.tamanhos.map((t) => {
                const on = t.tamanho === tamanhoSel
                const pronto = t.sabores > 0 && t.base != null
                return (
                  <button key={t.tamanho} type="button" onClick={() => trocarTamanho(t)}
                    className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
                    style={{
                      background: on ? 'var(--prod-acao-bg)' : 'transparent',
                      color: on ? 'var(--prod-acao-ink)' : 'var(--prod-secondary)',
                      borderColor: pronto ? 'var(--prod-line)' : 'var(--fam-ambar-mid)',
                    }}>
                    {t.tamanho}
                    {t.sabores > 0 && <span className="ml-1 opacity-70">· {t.sabores} sabor{t.sabores > 1 ? 'es' : ''}</span>}
                    {!pronto && <span className="ml-1">⚠️</span>}
                  </button>
                )
              })}
            </div>
            {tamanho?.derivadoDe && (
              <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                o nº de sabores veio de {tamanho.derivadoDe} (precinho segue o tamanho)
              </p>
            )}

            {pizza && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr] lg:items-start">
                {/* ───────── a pizza, em fatias ───────── */}
                <div className="mx-auto w-full max-w-[260px]">
                  <PizzaEmFatias
                    pizza={pizza}
                    aoTocar={(i) => setFatiaAberta(fatiaAberta === i ? null : i)}
                    fatiaAberta={fatiaAberta}
                  />
                </div>

                {/* ───────── a conta + os canais ───────── */}
                <div className="space-y-2">
                  <dl className="space-y-1 text-[12.5px]">
                    <Conta
                      rotulo={`base${tamanho?.base ? ` (${tamanho.base.nome})` : ''}`}
                      valor={pizza.custoBase == null ? 'a declarar' : formatBRL(pizza.custoBase)}
                    />
                    <Conta
                      rotulo={`+ ${pizza.fatias.length} sabor${pizza.fatias.length > 1 ? 'es' : ''} (1 ocorrência cada)`}
                      valor={pizza.custoSabores == null ? 'a apurar' : formatBRL(pizza.custoSabores)}
                    />
                    <Conta
                      rotulo="= custo da pizza"
                      valor={pizza.custoTotal == null ? 'a apurar' : formatBRL(pizza.custoTotal)}
                      forte
                    />
                  </dl>

                  {/* ⛔ o parcial aparece como PISO, nunca como o custo */}
                  {pizza.custoTotal == null && pizza.custoParcial > 0 && (
                    <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                      pelo menos {formatBRL(pizza.custoParcial)} — falta o resto pra fechar
                    </p>
                  )}
                  {pizza.incompleto.map((i, k) => (
                    <p key={`${i.motivo}-${k}`} className="text-[11.5px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>
                      ⚠️ {i.frase}
                    </p>
                  ))}

                  {/* ───────── o preço e a sobra por canal ───────── */}
                  <div className="space-y-1.5 border-t pt-2" style={{ borderColor: 'var(--prod-line)' }}>
                    <label className="block text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                      vendendo a
                      <input
                        value={precoTxt}
                        onChange={(e) => setPrecoTxt(sanitizarQtd(e.target.value, 'KG'))}
                        inputMode="decimal"
                        placeholder="ex.: 89,90"
                        className="ml-1.5 w-24 rounded-md border px-1.5 py-0.5 text-[12.5px] tabular-nums"
                        style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }}
                      />
                    </label>
                    {pizza.canais.length === 0 && (
                      <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                        nenhum canal cadastrado — sem eles não dá pra dizer quanto sobra no iFood
                      </p>
                    )}
                    <ul className="space-y-0.5">
                      {pizza.canais.map((c) => (
                        <li key={c.canal} className="flex items-baseline justify-between gap-2 text-[12px]">
                          <span style={{ color: 'var(--prod-muted)' }}>
                            sobra no {c.canal}
                            {c.taxaValor != null && c.taxaValor > 0 && (
                              <span className="opacity-70"> (o canal levou {formatBRL(c.taxaValor)})</span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums font-medium"
                            style={{ color: c.sobra == null ? 'var(--prod-muted)' : c.sobra >= 0 ? 'var(--fam-verde-ink)' : 'var(--fam-coral-ink)' }}>
                            {c.sobra == null ? 'a apurar' : formatBRL(c.sobra)}
                            {c.margemPct != null && <span className="ml-1 opacity-70">{pct(c.margemPct)}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {pizza.canais.some((c) => c.porque) && (
                      <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                        {pizza.canais.find((c) => c.porque)!.porque}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ───────── a lista de sabores da fatia tocada ───────── */}
            {fatiaAberta != null && pizza && (
              <div className="space-y-1.5 rounded-md border px-2.5 py-2" style={{ borderColor: 'var(--prod-line)' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                    sabor da fatia {fatiaAberta + 1} de {pizza.fatias.length}
                  </p>
                  <input
                    value={busca} onChange={(e) => setBusca(e.target.value)}
                    placeholder="buscar sabor"
                    aria-label="buscar sabor"
                    className="w-40 rounded-md border px-1.5 py-0.5 text-[12px]"
                    style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }}
                  />
                </div>
                <ul className="max-h-60 space-y-0.5 overflow-y-auto">
                  {saboresFiltrados.map((s) => (
                    <li key={s.fichaId || `sem:${s.nome}`}>
                      {s.temFicha ? (
                        <button type="button"
                          onClick={() => {
                            setEscolhas((a) => { const b = [...a]; b[fatiaAberta] = s; return b })
                            setFatiaAberta(null)
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:underline">
                          <LogoDaReceita nome={s.nome} tamanho={32} />
                          <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--prod-primary)' }}>
                            {s.nome}
                          </span>
                          <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
                            {s.custo == null ? 'custo a apurar' : formatBRL(s.custo)}
                          </span>
                        </button>
                      ) : (
                        /* ⭐ sabor sem ficha NÃO é escondido: tocar nele é o atalho que sobe a cobertura */
                        <a href={`/empresas/${empresaId}/estoque/cardapio?sabor=${encodeURIComponent(s.nome)}`}
                          className="flex w-full items-center gap-2 rounded-md border border-dashed px-1.5 py-1 hover:underline"
                          style={{ borderColor: 'var(--fam-ambar-mid)' }}>
                          <LogoDaReceita nome={s.nome} tamanho={32} alerta={{ titulo: 'este sabor ainda não tem ficha' }} />
                          <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--fam-ambar-ink)' }}>
                            {s.nome}
                          </span>
                          <span className="shrink-0 text-[11px]" style={{ color: 'var(--fam-ambar-ink)' }}>
                            sem ficha — criar <ArrowRight className="inline h-3 w-3" />
                          </span>
                        </a>
                      )}
                    </li>
                  ))}
                  {saboresFiltrados.length === 0 && (
                    <li className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                      nada com «{busca}» entre os {cat.sabores.length} sabores
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * ⭐ A PIZZA EM FATIAS — SVG, fatia por setor circular, cada uma tocável.
 *
 * ⚠️ `viewBox` + `w-full`: no celular ela encolhe sem cortar (REGRA 12). E o custo só é escrito
 * dentro da fatia quando ela tem 3 ou menos vizinhas — com 6 fatias o número não caberia e
 * viraria rabisco; aí ele fica na lista ao lado.
 */
function PizzaEmFatias({
  pizza, aoTocar, fatiaAberta,
}: {
  pizza: PizzaMontada
  aoTocar: (i: number) => void
  fatiaAberta: number | null
}) {
  const n = pizza.fatias.length
  const R = 46
  const C = 50
  if (n === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-[11.5px]"
        style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-muted)' }}>
        declare quantos sabores este tamanho obriga
      </div>
    )
  }
  const setor = (i: number) => {
    if (n === 1) return `M ${C - R} ${C} A ${R} ${R} 0 1 1 ${C + R} ${C} A ${R} ${R} 0 1 1 ${C - R} ${C} Z`
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
    const x0 = C + R * Math.cos(a0)
    const y0 = C + R * Math.sin(a0)
    const x1 = C + R * Math.cos(a1)
    const y1 = C + R * Math.sin(a1)
    const grande = a1 - a0 > Math.PI ? 1 : 0
    return `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${grande} 1 ${x1} ${y1} Z`
  }
  const meio = (i: number) => {
    const a = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2
    const r = n === 1 ? 0 : R * 0.58
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full" role="img"
      aria-label={`Pizza ${pizza.tamanho} com ${n} fatia${n > 1 ? 's' : ''}`}>
      <circle cx={C} cy={C} r={R + 2.5} fill="var(--fam-ambar-bg)" stroke="var(--fam-ambar-mid)" strokeWidth="1" />
      {pizza.fatias.map((f) => {
        const m = meio(f.indice)
        const vazia = f.sabor == null
        return (
          <g key={f.indice} onClick={() => aoTocar(f.indice)} style={{ cursor: 'pointer' }}>
            <path
              d={setor(f.indice)}
              fill={vazia ? 'var(--prod-surface-1)' : `var(--fam-${f.sabor!.familia}-mid)`}
              stroke={fatiaAberta === f.indice ? 'var(--prod-acao-bg)' : 'var(--prod-surface)'}
              strokeWidth={fatiaAberta === f.indice ? 2 : 1}
            />
            {n <= 4 && (
              <text x={m.x} y={m.y} fontSize="5.5" textAnchor="middle"
                fill={vazia ? 'var(--prod-muted)' : 'var(--prod-acao-ink)'}>
                {vazia ? '+ sabor' : f.custo == null ? '?' : formatBRL(f.custo).replace(/\s/g, ' ')}
              </text>
            )}
            {n > 4 && (
              <text x={m.x} y={m.y} fontSize="6" textAnchor="middle"
                fill={vazia ? 'var(--prod-muted)' : 'var(--prod-acao-ink)'}>
                {f.indice + 1}
              </text>
            )}
          </g>
        )
      })}
    </svg>
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
