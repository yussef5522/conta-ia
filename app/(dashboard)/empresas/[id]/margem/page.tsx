'use client'

/**
 * ⭐⭐⭐ MARGEM & EQUILÍBRIO v3 — "QUEM PAGA A CASA", COPIADA DA REFERÊNCIA (07/10/2026).
 *
 * ⛔⛔⛔ **A LEI VISUAL DESTA TELA É `docs/margem-referencia.html`**, construída e aprovada pelo
 * dono. Layout, hierarquia, tamanhos de letra, espaçamentos, textos e comportamento são os
 * DELE — **divergência da referência é DEFEITO**, não questão de gosto. O guard
 * `__tests__/regras-ui/margem-bate-com-a-referencia.test.ts` LÊ o arquivo e compara: tom
 * ajustado "no olho" fica vermelho apontando o valor que o arquivo manda. É o mesmo protocolo
 * da Conciliação (10/09): *"enquanto o mock vivia numa pasta de downloads, «igual ao mock» era
 * MEMÓRIA MINHA — e memória é exatamente o que falhou nas voltas anteriores."*
 *
 * ⛔ **ZERO HEX CRAVADO**: os tokens genéricos do topo do CSS da referência estão mapeados 1:1
 * pros tokens da casa (`--bg`→`--prod-bg`, `--surface-2`→`--prod-surface-1`,
 * `--indigo`→`--fam-indigo-mid`, `--verde-esc`→`--fam-verde-ink`, `--text-3`→`--prod-muted`…),
 * que invertem nos dois temas. ⚠️ E nada de `bg-[var(--x)]/70` — no Tailwind 3 opacidade sobre
 * valor arbitrário sai **transparente** (a armadilha de 05/10).
 *
 * ⛔⛔ **A TELA NÃO CALCULA NADA DE DINHEIRO.** Sobra, placar, barra, carregadores, cobertura,
 * veredito e a conta da pizza vêm de lib PURA (`montarPlacar`, `montarCarregadores`,
 * `linhaDaCobertura`, `montarPizza`) — a MESMA que o teste executa. Derivar aqui seria a 2ª
 * resposta pra *"quem paga a casa?"*, e ela divergiria do aviso do sininho.
 *
 * ⛔ **UMA composição, dois viewports** (REGRA 12): o que muda entre 390px e 1280px é a
 * LARGURA de elementos (os cartões do placar empilham, o nome da linha encolhe), nunca um
 * bloco só-celular. Duas composições do mesmo dado divergiriam no 1º selo novo.
 *
 * ⚠️⚠️ **DUAS DIVERGÊNCIAS DELIBERADAS DA REFERÊNCIA, com o motivo escrito (e travadas em teste):**
 *  (a) **o botão de tema 🌙/☀️ não vem.** Na referência ele existe pra o arquivo rodar sozinho
 *      no navegador e demonstrar os dois temas; a casa já tem o tema dela (`:root`/`.dark` no
 *      `globals.css`), e um segundo interruptor aqui seria **duas portas pra a mesma decisão**.
 *  (b) **o bloco do relatório de complementos incompleto fica**, condicional. A referência
 *      mostra o estado NORMAL (sem aviso); esconder o aviso de qualidade de dado porque o
 *      exemplo não o tem seria trocar uma régua de honestidade por fidelidade de exemplo.
 */

import { use, useCallback, useEffect, useState } from 'react'
import { casaBusca } from '@/lib/busca-texto'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { EMOJI_DO_SELO, type AbaDaLiga, type SeloDoVeredito } from '@/lib/margem/liga'
import {
  linhaDaCobertura, montarCarregadores, montarPlacar,
  type Carregador, type TomDoResultado,
} from '@/lib/margem/placar'
import { montarPizza, type PizzaMontada, type SaborDisponivel } from '@/lib/margem/montador'
import type { CatalogoDoMontador } from '@/lib/margem/leitura-montador'
import type { TamanhoDePizza } from '@/lib/margem/tamanhos'
import { sanitizarQtd, valorQtd } from '@/lib/stock/quantidade'
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
  { k: 'DATAS', r: '📅 datas' },
]

const ABAS: { k: AbaDaLiga; r: string }[] = [
  { k: 'CAIXA', r: 'encheu o caixa' },
  { k: 'MARGEM', r: 'melhor margem' },
  { k: 'VENDIDOS', r: 'mais vendidos' },
]

/* ═══════════════════════ as peças da referência, uma vez só ═══════════════════════ */

/** `.card` — borda forte, raio 16, sombra, margem de 14px entre cartões */
function Cartao({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section
      id={id}
      className="mb-[14px] overflow-hidden rounded-[16px] border"
      style={{
        background: 'var(--prod-surface)',
        borderColor: 'var(--prod-line-strong)',
        boxShadow: 'var(--prod-sombra)',
      }}
    >
      {children}
    </section>
  )
}

/** `.card-head` — h2 15,5px/600 à esquerda, `.hint` 11,5px à direita */
function CabecaDoCartao({ titulo, dica }: { titulo: string; dica?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[10px] px-[18px] pb-[8px] pt-[14px]">
      <h2 className="text-[15.5px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
        {titulo}
      </h2>
      {dica != null && (
        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>
          {dica}
        </span>
      )}
    </div>
  )
}

/** `.chip` / `.chip.on` — pílula 12,5px, e a ligada troca borda por fundo índigo */
function Chip({
  on, children, onClick, titulo,
}: { on?: boolean; children: React.ReactNode; onClick?: () => void; titulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-pressed={on}
      className={`rounded-full border px-[12px] py-[5px] text-[12.5px] ${on ? 'font-semibold' : ''}`}
      style={
        on
          ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)', borderColor: 'transparent' }
          : { background: 'var(--prod-surface)', color: 'var(--prod-secondary)', borderColor: 'var(--prod-line-strong)' }
      }
    >
      {children}
    </button>
  )
}

/**
 * ⭐⭐ A DUPLA (`.duo` da referência v3.1) — dois cartões lado a lado em **≥1024px**, pra usar
 * a largura **com conteúdo, não com linha esticada**. Abaixo de 1024 ela empilha, igual a
 * antes: é uma composição só, o CSS escolhe (REGRA 12).
 *
 * ⛔ `.duo .card{margin-bottom:0}` do arquivo mora aqui, por **seletor de filho**, e não como
 * uma prop que cada chamador tem que lembrar de passar — *disciplina virada impossibilidade*
 * (REGRA 5). Sem zerar a margem, a coluna mais curta empurraria a linha seguinte.
 *
 * ⚠️ `items-start` é o que mantém os dois cartões no topo: sem ele o mais curto esticaria pra
 * a altura do vizinho e a borda de baixo dele mentiria sobre onde o conteúdo acaba.
 */
function Duo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[14px] lg:grid lg:grid-cols-2 lg:items-start lg:gap-[14px] lg:[&>section]:mb-0">
      {children}
    </div>
  )
}

/** `.dot` — a bolinha de 10px da família, a MESMA cor que o payload mandou */
function Bolinha({ familia }: { familia: string }) {
  return (
    <span
      className="h-[10px] w-[10px] flex-none rounded-full"
      style={{ background: `var(--fam-${familia}-mid)` }}
      aria-hidden
    />
  )
}

/* ══════════════════════════════════ a página ══════════════════════════════════ */

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

  /**
   * ⭐⭐ A LEI DE LAYOUT (v3.1, escrita no CSS da referência): *"a tela ocupa a largura útil do
   * conteúdo do dashboard (ao lado da sidebar), como as telas profissionais — **NUNCA uma
   * coluna estreita centralizada com vazio dos dois lados**. Teto 1440px só pra monitores
   * gigantes."* ⛔ A coluna de 860px do v3 morreu aqui, e o guard afirma que ela não volta.
   *
   * ⚠️ O shell do dashboard já põe `px-4 lg:px-6` por fora (o molde de 23/08), então o respiro
   * real soma o dele ao nosso. Os 4 números do padding são os do ARQUIVO, escritos literais.
   */
  return (
    <div className="mx-auto max-w-[1440px] px-[28px] pb-[64px] pt-[22px] max-[700px]:px-[14px] max-[700px]:pb-[56px] max-[700px]:pt-[16px]">
      {/* ───────── CABEÇALHO (page-head da referência) ───────── */}
      <div className="mb-[14px] flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <h1 className="text-[20px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
            Quem paga a casa
          </h1>
          <p className="mt-[2px] text-[13px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
            {dados?.janela.rotulo ?? '…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {PERIODOS.map((p) => (
            <Chip key={p.k} on={periodo === p.k} onClick={() => setPeriodo(p.k)}>
              {p.r}
              {periodo === p.k && p.k !== 'DATAS' ? ' ✓' : ''}
            </Chip>
          ))}
          {periodo === 'DATAS' && (
            <span className="flex items-center gap-1">
              <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                de
                <input
                  type="date" value={de} onChange={(e) => setDe(e.target.value)}
                  className="ml-1 rounded-[8px] border px-1.5 py-[3px] text-[12.5px]"
                  style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                />
              </label>
              <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                até
                <input
                  type="date" value={ate} onChange={(e) => setAte(e.target.value)}
                  className="ml-1 rounded-[8px] border px-1.5 py-[3px] text-[12.5px]"
                  style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                />
              </label>
            </span>
          )}
        </div>
      </div>

      {estado === 'CARREGANDO' && (
        <Cartao>
          <p className="flex items-center gap-[8px] px-[18px] py-5 text-[13px]" style={{ color: 'var(--prod-muted)' }}>
            <Loader2 className="h-4 w-4 animate-spin" /> lendo o período…
          </p>
        </Cartao>
      )}

      {estado === 'FALHOU' && (
        <Cartao>
          <div className="space-y-2 px-[18px] py-5">
            <p className="text-[13px] font-medium" style={{ color: 'var(--fam-coral-ink)' }}>
              Não consegui carregar: {erro}
            </p>
            <button
              type="button" onClick={() => void carregar()}
              className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-medium"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}
            >
              tentar de novo
            </button>
          </div>
        </Cartao>
      )}

      {estado === 'OK' && dados && (
        <>
          <LinhaDeChegadaCard d={dados} />
          <PlacarDaCasa d={dados} />
          <Duo>
            <QuemCarregouACasa
              d={dados}
              abrirResto={abrirAgrupado}
              setAbrirResto={setAbrirAgrupado}
              empresaId={empresaId}
            />
            <LigaCard d={dados} aba={aba} setAba={setAba} empresaId={empresaId} />
          </Duo>
          <Duo>
            <MontadorDePizza empresaId={empresaId} />
            <FilaDeSabores d={dados} empresaId={empresaId} />
          </Duo>
        </>
      )}
    </div>
  )
}

/* ═══════════════ 1 · A LINHA DE CHEGADA DO DIA ═══════════════ */

/**
 * ⚠️ Mostra o ÚLTIMO DIA FECHADO, e a **ressalva é obrigatória** quando esse dia não é hoje:
 * medido em prod, o relatório de 06/10 entrou às 03:48 do dia 07/10 — sem a frase o dono abre
 * a tela à tarde e lê o dia de ontem como se fosse o de hoje.
 *
 * ⛔ A manchete vem PARTIDA da lib (`manchete.prefixo` + `manchete.destaque`): recortar a
 * frase aqui pra pintar o valor de verde seria a 2ª régua da própria frase.
 */
function LinhaDeChegadaCard({ d }: { d: MargemDaTela }) {
  const l = d.linhaDeChegada
  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-[12px] px-[18px] pb-[8px] pt-[14px]">
        <div className="min-w-0">
          <p
            className="text-[11.5px] font-semibold tracking-[0.06em]"
            style={{ color: 'var(--prod-secondary)' }}
          >
            🏁 A LINHA DE CHEGADA{l.dia ? ` · ${l.ehHoje ? 'hoje' : ddmm(l.dia)}` : ''}
          </p>
          <p className="mt-[4px] text-[21px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
            {l.manchete.prefixo}
            {l.manchete.destaque && (
              <span className="tabular-nums" style={{ color: 'var(--fam-verde-ink)' }}>
                {l.manchete.destaque}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px]" style={{ color: 'var(--prod-secondary)' }}>casa do dia</p>
          <p className="text-[19px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
            {l.casaDoDia == null ? 'a apurar' : formatBRL(l.casaDoDia)}
          </p>
        </div>
      </div>

      {/* `.trilho` 12px: índigo até a sobra do dia, a bandeirinha verde marca o 100% */}
      {l.pct != null && (
        <div
          className="relative mx-[18px] mt-[6px] h-[12px] rounded-full border"
          style={{ background: 'var(--prod-surface-1)', borderColor: 'var(--prod-line)' }}
          role="img"
          aria-label={`barra do dia: ${pct(l.pct)} da casa do dia`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.max(2, l.pct * 100)}%`, background: 'var(--fam-indigo-mid)' }}
          />
          <span
            className="absolute -top-[5px] right-[-1px] h-[22px] w-[3px] rounded-sm"
            style={{ background: 'var(--fam-verde-ink)' }}
            aria-hidden
          />
        </div>
      )}

      <div
        className="flex flex-wrap justify-between gap-[8px] px-[18px] pb-[14px] pt-[8px] text-[12px] tabular-nums"
        style={{ color: 'var(--prod-secondary)' }}
      >
        <span>
          sobra do dia{' '}
          <b style={{ color: 'var(--prod-primary)' }}>
            {l.sobra == null ? 'a apurar' : formatBRL(l.sobra)}
          </b>
          {l.unidades > 0 && ` · ${l.unidades} un`}
        </span>
        {l.lucroDaquiPraFrente && (
          <span className="font-semibold" style={{ color: 'var(--fam-verde-ink)' }}>
            daqui pra frente cada venda é lucro
          </span>
        )}
      </div>

      {l.ressalva && (
        <p className="px-[18px] pb-[12px] text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
          {l.ressalva}
        </p>
      )}
    </Cartao>
  )
}

/* ═══════════════ 2 · O PLACAR DO PERÍODO ═══════════════ */

/**
 * ⭐⭐ REGRA DE OURO: **cartão 1 − cartão 2 = cartão 3**, e isso é travado em teste — é o que
 * torna o número defensável quando o dono soma na mão. É por isso que o 1º cartão mostra a
 * sobra **LÍQUIDA** (já abatidos os complementos) e DIZ o abatimento na sublinha.
 *
 * ⛔ A barra vem da lib com os dois pedaços somando 1 POR CONSTRUÇÃO — a tela não normaliza
 * nem clampa, que foi exatamente como a antiga pilha de tijolos estourou o telhado.
 */
function PlacarDaCasa({ d }: { d: MargemDaTela }) {
  const c = d.casa
  const p = montarPlacar(c)
  const cobertura = linhaDaCobertura(c)

  return (
    <Cartao>
      <CabecaDoCartao
        titulo={`O placar de ${d.janela.rotuloCurto}`}
        dica={`custo fixo: ${c.composicao.texto}`}
      />

      {/* `.placar-grid` — 3 colunas; abaixo de 640px empilham (REGRA 12, composição única) */}
      <div className="grid grid-cols-1 gap-[10px] px-[18px] pb-[12px] pt-[4px] sm:grid-cols-3">
        <CartaoDoPlacar c={p.sobra} />
        <CartaoDoPlacar c={p.casa} />
        <CartaoDoPlacar
          c={p.resultado}
          tom={p.resultado.tom}
          ressalva={p.resultado.ressalva}
          prefixo={p.resultado.tom === 'PAGOU' ? '+' : undefined}
        />
      </div>

      {/* `.barra-casa` 16px — índigo = casa (até a 🏁), verde = transbordo, cinza = o que falta */}
      {p.barra && (
        <>
          <div
            className="mx-[18px] flex h-[16px] overflow-hidden rounded-full border"
            style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}
            role="img"
            aria-label={
              p.barra.bandeira
                ? `a casa se enchendo: ${pct(p.barra.pago)} índigo até a bandeira, ${pct(p.barra.transbordo)} verde de lucro`
                : `a casa se enchendo: ${p.barra.rotuloParcial}`
            }
          >
            <div style={{ width: `${Math.max(2, p.barra.pago * 100)}%`, background: 'var(--fam-indigo-mid)' }} />
            {p.barra.transbordo > 0 && (
              <div style={{ width: `${p.barra.transbordo * 100}%`, background: 'var(--fam-verde-mid)' }} />
            )}
          </div>

          <div
            className="flex flex-wrap justify-between gap-[8px] px-[18px] pb-[14px] pt-[6px] text-[11.5px]"
            style={{ color: 'var(--prod-secondary)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--fam-indigo-mid)' }}>
              a casa se enchendo
            </span>
            <span>🏁 a bandeira é 100% = casa paga</span>
            {p.barra.bandeira ? (
              <span className="font-semibold tabular-nums" style={{ color: 'var(--fam-verde-ink)' }}>
                o verde é o lucro ({p.barra.rotuloTransbordo})
              </span>
            ) : (
              <span className="tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                {p.barra.rotuloParcial} · o cinza é o que falta
              </span>
            )}
          </div>
        </>
      )}

      {/* `.cobertura-line` — o pé do placar: é ela que impede o veredito de ficar seco */}
      <p
        className="border-t px-[18px] py-[9px] text-[12px] tabular-nums"
        style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
      >
        {cobertura.map((x, i) =>
          x.forte ? (
            <b key={i} style={{ color: 'var(--prod-primary)' }}>{x.texto}</b>
          ) : (
            <span key={i}>{x.texto}</span>
          ),
        )}
      </p>
    </Cartao>
  )
}

/**
 * `.pcard` — lbl 12px/600 · val 26px/700 · sub 11px.
 *
 * ⚠️ `valor` nulo vira **"a apurar"**, nunca R$ 0,00 — ausência de plano não é casa de graça.
 * ⛔⛔ E o veredito NUNCA aparece seco sobre dado parcial: a `ressalva` da cobertura vem com
 * ele e a tela é obrigada a desenhá-la (o guard de v1 que não cai).
 */
function CartaoDoPlacar({
  c, tom, ressalva, prefixo,
}: {
  c: { rotulo: string; valor: number | null; sublinha: string }
  tom?: TomDoResultado
  ressalva?: string | null
  prefixo?: string
}) {
  const vencedor = tom === 'PAGOU'
  const faltando = tom === 'EM_OBRA'
  const fundo = vencedor
    ? 'var(--fam-verde-bg)'
    : faltando
      ? 'var(--fam-ambar-bg)'
      : 'var(--prod-surface-1)'
  const tintaForte = vencedor
    ? 'var(--fam-verde-ink)'
    : faltando
      ? 'var(--fam-ambar-ink)'
      : 'var(--prod-primary)'
  const tintaFraca = vencedor
    ? 'var(--fam-verde-ink)'
    : faltando
      ? 'var(--fam-ambar-ink)'
      : 'var(--prod-secondary)'

  return (
    <div className="rounded-[12px] px-[15px] py-[13px]" style={{ background: fundo }}>
      <p className="text-[12px] font-semibold" style={{ color: tintaFraca }}>{c.rotulo}</p>
      <p
        className="mt-[4px] text-[26px] font-bold tabular-nums tracking-[-0.01em]"
        style={{ color: tintaForte }}
      >
        {c.valor == null ? 'a apurar' : `${prefixo ?? ''}${formatBRL(c.valor)}`}
      </p>
      <p className="mt-[2px] text-[11px] leading-snug" style={{ color: vencedor || faltando ? tintaFraca : 'var(--prod-muted)' }}>
        {c.sublinha}
      </p>
      {ressalva && (
        <p className="mt-[4px] text-[11px] leading-snug" style={{ color: 'var(--fam-indigo-mid)' }}>
          {ressalva}
        </p>
      )}
    </div>
  )
}

/* ═══════════════ 3 · QUEM CARREGOU A CASA ═══════════════ */

/**
 * ⚠️ A barra de cada linha é **RELATIVA AO MAIOR, nunca à casa**: com a casa paga, metade das
 * linhas encostaria no fim e a comparação entre produtos — que é a pergunta desta lista —
 * sumiria. O *"% da casa"* continua escrito ao lado, em número, e **pode passar de 100%**.
 *
 * ⭐ A cor da bolinha vem do `familia` do PAYLOAD, que o servidor derivou por `caraDaReceita`.
 * Derivar aqui seria a 2ª tradução de nome → cor, e elas divergiriam no 1º grupo novo do mapa.
 */
function QuemCarregouACasa({
  d, abrirResto, setAbrirResto, empresaId,
}: {
  d: MargemDaTela
  abrirResto: boolean
  setAbrirResto: (v: boolean) => void
  empresaId: string
}) {
  const l = montarCarregadores(d.casa, d.saboresSemFicha.length)
  const linhas = abrirResto ? [...l.visiveis, ...l.resto] : l.visiveis

  return (
    <Cartao>
      <CabecaDoCartao
        titulo="Quem carregou a casa"
        dica="% = quanto da casa cada um pagou · toque abre a ficha"
      />

      {linhas.length === 0 && (
        <p className="px-[18px] pb-[14px] text-[13px]" style={{ color: 'var(--prod-muted)' }}>
          nenhum produto com custo conhecido vendeu neste período
        </p>
      )}

      {linhas.map((x, i) => (
        <LinhaDaCarga key={x.chave} x={x} primeira={i === 0} empresaId={empresaId} />
      ))}

      {/* a linha do agregado: ela EXPANDE — nada some atrás dela */}
      {l.agregado && (
        <button
          type="button"
          onClick={() => setAbrirResto(!abrirResto)}
          aria-expanded={abrirResto}
          className="flex w-full items-center gap-[10px] border-t px-[18px] py-[9px] text-left text-[13.5px] hover:bg-[var(--prod-surface-1)]"
          style={{ borderColor: 'var(--prod-line)' }}
        >
          <span className="h-[10px] w-[10px] flex-none rounded-full" style={{ background: 'var(--prod-muted)' }} aria-hidden />
          <span
            className="w-[40%] min-w-0 truncate font-semibold min-[560px]:w-[200px] min-[560px]:min-w-[120px]"
            style={{ color: 'var(--prod-secondary)' }}
          >
            {abrirResto ? 'mostrar só os 6 maiores' : `+ ${l.agregado.quantos} produtos`}
          </span>
          <span className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--prod-surface-1)' }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(2, l.agregado.pctDaBarra * 100)}%`, background: 'var(--prod-muted)' }}
            />
          </span>
          <span
            className="w-auto min-w-[96px] text-right tabular-nums min-[560px]:w-[132px]"
            style={{ color: 'var(--prod-secondary)' }}
          >
            <b className="text-[13.5px]">{pct(l.agregado.pctDaCasa)}</b>{' '}
            <span className="text-[12.5px]">· {abrirResto ? 'fechar ▴' : 'ver todos ▾'}</span>
          </span>
        </button>
      )}

      {/* `.fila-foot` âmbar — o que está fora e o caminho que destrava a cobertura */}
      <div
        className="flex flex-wrap items-baseline justify-between gap-[10px] border-t px-[18px] py-[9px] text-[12px]"
        style={{ borderColor: 'var(--prod-line)', background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}
      >
        <span>
          🪑 <b>{l.rodape.foraDaObra} fora da obra</b> — vendem e o custo é desconhecido ·{' '}
          <b>{l.rodape.saboresSemFicha} sabores sem ficha</b>
        </span>
        <a
          href="#fila"
          className="font-semibold hover:underline"
          style={{ color: 'var(--fam-indigo-mid)' }}
        >
          criar fichas sobe a cobertura ({pct(l.rodape.cobertura)} → meta {pct(COBERTURA_MINIMA)}) →
        </a>
      </div>
      {/* ⚠️ o link acima leva à fila DESTA página; a tela do cardápio é onde a ficha nasce */}
      <p className="px-[18px] pb-[12px] text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
        <a href={`/empresas/${empresaId}/estoque/cardapio`} className="hover:underline">
          ou abrir o cardápio pra criar as fichas →
        </a>
      </p>
    </Cartao>
  )
}

/** `.carga-row` — dot · nome 200px · barra flex · valor 132px à direita */
function LinhaDaCarga({
  x, primeira, empresaId,
}: { x: Carregador; primeira: boolean; empresaId: string }) {
  return (
    <a
      href={`/empresas/${empresaId}/estoque/cardapio/${encodeURIComponent(x.chave)}`}
      className={`flex items-center gap-[10px] px-[18px] py-[9px] text-[13.5px] hover:bg-[var(--prod-surface-1)] ${primeira ? '' : 'border-t'}`}
      style={{ borderColor: 'var(--prod-line)' }}
    >
      <Bolinha familia={x.familia} />
      <span
        className="flex w-[40%] min-w-0 items-center gap-[6px] truncate font-semibold min-[560px]:w-[200px] min-[560px]:min-w-[120px]"
        style={{ color: 'var(--prod-primary)' }}
      >
        {x.rei ? '👑 ' : ''}{x.nome}
      </span>
      <span className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--prod-surface-1)' }}>
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(2, x.pctDaBarra * 100)}%`, background: `var(--fam-${x.familia}-mid)` }}
        />
      </span>
      <span className="w-auto min-w-[96px] text-right tabular-nums min-[560px]:w-[132px]">
        <b className="text-[13.5px]" style={{ color: 'var(--prod-primary)' }}>{pct(x.pctDaCasa)}</b>{' '}
        <span className="text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
          · {formatBRL(x.sobraTotal)}
        </span>
      </span>
    </a>
  )
}

/* ═══════════════ 4 · A LIGA ═══════════════ */

/** ⚠️ os selos cortam pela MEDIANA do período — a lib decide, a tela só pinta a pílula */
const TOM_DO_SELO: Record<SeloDoVeredito, { bg: string; ink: string }> = {
  ESTRELA: { bg: 'var(--fam-verde-bg)', ink: 'var(--fam-verde-ink)' },
  BURRO_DE_CARGA: { bg: 'var(--fam-ambar-bg)', ink: 'var(--fam-ambar-ink)' },
  JOIA_ESCONDIDA: { bg: 'var(--fam-indigo-bg)', ink: 'var(--fam-indigo-ink)' },
  REPENSAR: { bg: 'var(--prod-surface-1)', ink: 'var(--prod-secondary)' },
}

function LigaCard({
  d, aba, setAba, empresaId,
}: { d: MargemDaTela; aba: AbaDaLiga; setAba: (a: AbaDaLiga) => void; empresaId: string }) {
  const l = d.liga
  return (
    <Cartao>
      <CabecaDoCartao titulo="🏆 A liga do período" dica="selo = veredito · tudo clicável → ficha" />

      <div className="flex flex-wrap gap-[6px] px-[18px] pb-[8px]">
        {ABAS.map((a) => (
          <Chip key={a.k} on={aba === a.k} onClick={() => setAba(a.k)}>
            {a.r}{aba === a.k ? ' ✓' : ''}
          </Chip>
        ))}
      </div>

      {l.cortes.sobra != null && (
        <p className="px-[18px] pb-[8px] pt-[4px] text-[11.5px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>
          os selos cortam pela MEDIANA do período: sobra {formatBRL(l.cortes.sobra)} · {l.cortes.unidades} un
        </p>
      )}

      {l.linhas.length === 0 ? (
        <p className="px-[18px] pb-[16px] text-center text-[13px]" style={{ color: 'var(--prod-muted)' }}>
          nenhum produto com custo conhecido neste período
        </p>
      ) : (
        l.linhas.map((x) => (
          <a
            key={x.chave}
            href={`/empresas/${empresaId}/estoque/cardapio/${encodeURIComponent(x.chave)}`}
            className="flex items-center gap-[10px] border-t px-[18px] py-[9px] text-[13.5px] hover:bg-[var(--prod-surface-1)]"
            style={{ borderColor: 'var(--prod-line)' }}
          >
            <span className="w-[22px] flex-none text-center text-[15px] tabular-nums" aria-hidden>
              {x.medalha ? ['🥇', '🥈', '🥉'][x.medalha - 1] : (
                <span style={{ color: 'var(--prod-muted)' }}>{x.posicao}</span>
              )}
            </span>
            <Bolinha familia={x.familia} />
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-[7px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
              <span className="truncate">{x.nome}</span>
              <span
                className="whitespace-nowrap rounded-full px-[8px] py-[2px] text-[10.5px] font-bold"
                style={{ background: TOM_DO_SELO[x.selo].bg, color: TOM_DO_SELO[x.selo].ink }}
              >
                {EMOJI_DO_SELO[x.selo]} {x.frase}
              </span>
            </span>
            <span className="min-w-[120px] text-right tabular-nums">
              <b style={{ color: 'var(--fam-verde-ink)' }}>
                {aba === 'VENDIDOS' ? `${x.unidades} un` : aba === 'MARGEM' ? pct(x.margemPct, 1) : formatBRL(x.sobraTotal)}
              </b>
              <span className="block text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                {formatBRL(x.sobraUn)}/un · {x.unidades} un · {pct(x.margemPct)}
              </span>
            </span>
          </a>
        ))
      )}
    </Cartao>
  )
}

/* ═══════════════ 5 · MONTADOR DE PIZZA ═══════════════ */

/**
 * ⭐⭐ A BANCADA — escolho o tamanho, toco na fatia, vejo o custo e a sobra por canal.
 *
 * ⛔⛔ **SÓ SIMULAÇÃO: nada grava, nada baixa estoque.** A garantia é de forma — o único POST
 * desta seção é o da CONFIG (semear canais / apontar a base), nunca uma gravação de pizza.
 *
 * ⭐ A conta é a lib PURA `montarPizza`, a mesma que o teste executa: **base do tamanho +
 * Σ(1 ocorrência × ficha de cada sabor)** — a regra de 02/09, **SEM fator por tamanho**.
 * Dividir pelo nº de fatias ressuscitaria o fator que morreu em 07/10, e o relatório de
 * complementos (que é quem baixa o sabor de verdade) conta OCORRÊNCIA, nunca fração.
 *
 * ⚠️ O catálogo é uma 2ª chamada (ele lê o cardápio inteiro e o ledger), mas carrega **junto
 * com a tela**: na referência a bancada está ABERTA, e esconder atrás de um clique seria a
 * "porta sem maçaneta" que esta casa já pagou nove vezes.
 */
function MontadorDePizza({ empresaId }: { empresaId: string }) {
  const [cat, setCat] = useState<CatalogoDoMontador | null>(null)
  const [estado, setEstado] = useState<'CARREGANDO' | 'FALHOU' | 'OK'>('CARREGANDO')
  const [erro, setErro] = useState('')
  const [tamanhoSel, setTamanhoSel] = useState<string | null>(null)
  const [escolhas, setEscolhas] = useState<(SaborDisponivel | null)[]>([])
  const [fatiaAberta, setFatiaAberta] = useState<number | null>(null)
  /** ⭐ EXTRA de 07/10 (palavra do dono): 61 chips de sabor viraram parede. A régua é a
   *  `casaBusca` da casa — palavra em qualquer ordem, sem caixa e sem acento (a cicatriz de
   *  08/09, em que `contains` case-sensitive achava ZERO em prod e funcionava em dev). */
  const [buscaSabor, setBuscaSabor] = useState('')
  // ⚠️ deriva da MESMA lista que o montador usa — filtro com fonte própria divergiria
  const saboresFiltrados = (cat?.sabores ?? []).filter((s) => casaBusca(s.nome, buscaSabor))
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
    void carregar()
  }, [carregar])

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

  // ⭐ o sufixo do PISO: com fatia pendente o total é o mínimo, e a tela DIZ quantas faltam
  const pendentes = pizza ? pizza.incompleto.filter((i) => i.motivo !== 'SEM_BASE').length : 0
  const sufixo = pizza && pizza.custoTotal == null ? ` + ${pendentes} fatia(s)` : ''

  return (
    <Cartao>
      <CabecaDoCartao
        titulo="🍕 Monte uma pizza e veja o custo"
        dica="só simula — nada grava, nada baixa"
      />

      {estado === 'CARREGANDO' && (
        <p className="px-[18px] pb-[14px] text-[13px]" style={{ color: 'var(--prod-muted)' }}>
          carregando a bancada…
        </p>
      )}

      {estado === 'FALHOU' && (
        <div className="space-y-1.5 px-[18px] pb-[14px]">
          <p className="text-[13px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>
          <button type="button" onClick={() => void carregar()}
            className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-medium"
            style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
            tentar de novo
          </button>
        </div>
      )}

      {estado === 'OK' && cat && (
        <>
          {/* ⚠️ o que falta, NOMEADO — bancada vazia sem motivo é indistinguível de quebrada */}
          {cat.faltando.length > 0 && (
            <div
              className="mx-[18px] mb-2 space-y-1.5 rounded-[12px] px-2.5 py-2"
              style={{ background: 'var(--fam-ambar-bg)' }}
            >
              {cat.faltando.map((f) => (
                <p key={f.oQue} className="text-[11.5px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>
                  {f.frase}
                </p>
              ))}
              {cat.faltando.some((f) => f.oQue === 'canais' || f.oQue === 'sabores-por-tamanho') && (
                <button type="button" disabled={salvando} onClick={() => void semear()}
                  className="rounded-[8px] px-2 py-1 text-[11.5px] font-medium disabled:opacity-50"
                  style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
                  {salvando
                    ? 'semeando…'
                    : 'usar os padrões (balcão 0% · tele própria 0% · iFood 20% · pequena 1 · grande 2 · família 3)'}
                </button>
              )}
            </div>
          )}

          {/* os tamanhos, como chips (`.liga-tabs`) */}
          <div className="flex flex-wrap gap-[6px] px-[18px] pb-[8px]">
            {cat.tamanhos.map((t) => {
              const pronto = t.sabores > 0 && t.base != null
              return (
                <Chip
                  key={t.tamanho}
                  on={t.tamanho === tamanhoSel}
                  onClick={() => trocarTamanho(t)}
                  titulo={pronto ? undefined : 'este tamanho ainda não tem base apontada'}
                >
                  {t.tamanho.toLowerCase()}
                  {t.sabores > 0 && ` · ${t.sabores} sabor${t.sabores > 1 ? 'es' : ''}`}
                  {!pronto && ' ⚠️'}
                </Chip>
              )
            })}
          </div>
          {tamanho?.derivadoDe && (
            <p className="px-[18px] pb-[8px] text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
              o nº de sabores veio de {tamanho.derivadoDe} (precinho segue o tamanho)
            </p>
          )}

          {pizza && (
            <div className="flex flex-wrap items-center gap-[20px] px-[18px] pb-[16px] pt-[10px]">
              <div className="w-[170px] flex-none">
                <PizzaEmFatias
                  pizza={pizza}
                  aoTocar={(i) => setFatiaAberta(fatiaAberta === i ? null : i)}
                  fatiaAberta={fatiaAberta}
                />
              </div>

              {/* `.mont-conta` — 14px, rows justify-between, total com borda em cima */}
              <div className="min-w-[250px] flex-1 text-[14px] tabular-nums">
                <LinhaDaConta
                  rotulo={tamanho?.base ? `base ${tamanho.tamanho.toLowerCase()} (${tamanho.base.nome})` : `base ${tamanho?.tamanho.toLowerCase() ?? ''}`}
                  valor={pizza.custoBase == null ? 'a declarar' : formatBRL(pizza.custoBase)}
                />
                {pizza.fatias.map((f) => {
                  if (f.sabor == null) {
                    return (
                      <div key={f.indice} className="flex justify-between gap-[10px] py-[3px]" style={{ color: 'var(--fam-coral-ink)' }}>
                        <span><b>{f.indice + 1}º sabor — escolher</b></span>
                        <span>—</span>
                      </div>
                    )
                  }
                  if (f.custo == null) {
                    return (
                      <div key={f.indice} className="flex justify-between gap-[10px] py-[3px]">
                        <span>
                          <b style={{ color: 'var(--fam-ambar-ink)' }}>{f.sabor.nome}</b>{' '}
                          <span style={{ color: 'var(--prod-secondary)' }}>· sem ficha — tocar cria</span>
                        </span>
                        <span style={{ color: 'var(--fam-ambar-ink)' }}>a definir</span>
                      </div>
                    )
                  }
                  return (
                    <div key={f.indice} className="flex justify-between gap-[10px] py-[3px]">
                      <span>
                        <b style={{ color: 'var(--fam-indigo-mid)' }}>{f.sabor.nome}</b>{' '}
                        <span style={{ color: 'var(--prod-secondary)' }}>· 1 ocorrência</span>
                      </span>
                      <span style={{ color: 'var(--prod-primary)' }}>{formatBRL(f.custo)}</span>
                    </div>
                  )
                })}

                <div
                  className="mt-[5px] flex justify-between gap-[10px] border-t pt-[7px] font-semibold"
                  style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }}
                >
                  <span>custo da pizza</span>
                  <span className="text-[16px] font-bold">
                    {pizza.custoTotal == null
                      ? `${formatBRL(pizza.custoParcial)}${sufixo}`
                      : formatBRL(pizza.custoTotal)}
                  </span>
                </div>

                {/* o preço e a sobra por canal — a taxa incide no PREÇO, nunca na sobra */}
                {pizza.canais.length === 0 ? (
                  <div className="flex items-center gap-[6px] py-[3px]" style={{ color: 'var(--prod-secondary)' }}>
                    <span>vendendo a</span>
                    <CampoDePreco valor={precoTxt} aoMudar={setPrecoTxt} />
                    <span className="text-[11.5px]" style={{ color: 'var(--fam-ambar-ink)' }}>
                      — nenhum canal cadastrado, sem eles não dá pra dizer quanto sobra no iFood
                    </span>
                  </div>
                ) : (
                  pizza.canais.map((cn, i) => (
                    <div key={cn.canal} className="flex items-center justify-between gap-[10px] py-[3px]">
                      <span className="flex flex-wrap items-center gap-[6px]" style={{ color: 'var(--prod-secondary)' }}>
                        {i === 0 ? (
                          <>
                            vendendo a <CampoDePreco valor={precoTxt} aoMudar={setPrecoTxt} /> no {cn.canal}, sobra
                          </>
                        ) : (
                          <>
                            no {cn.canal}
                            {cn.taxaPct != null && cn.taxaPct > 0 && ` (taxa ${pct(cn.taxaPct)})`}
                          </>
                        )}
                      </span>
                      <span
                        className={cn.taxaPct ? 'font-semibold' : 'text-[16px] font-bold'}
                        style={{
                          color:
                            cn.sobra == null
                              ? 'var(--prod-muted)'
                              : cn.sobra < 0
                                ? 'var(--fam-coral-ink)'
                                : cn.taxaPct
                                  ? 'var(--fam-ambar-ink)'
                                  : 'var(--fam-verde-ink)',
                        }}
                      >
                        {cn.sobra == null ? 'a apurar' : `~${formatBRL(cn.sobra)}`}
                        {sufixo && cn.sobra != null ? ' − fatias' : ''}
                      </span>
                    </div>
                  ))
                )}

                {pizza.incompleto.map((inc, k) => (
                  <p key={`${inc.motivo}-${k}`} className="pt-[4px] text-[11.5px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>
                    ⚠️ {inc.frase}
                  </p>
                ))}
                {pizza.canais.some((cn) => cn.porque) && (
                  <p className="pt-[4px] text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                    {pizza.canais.find((cn) => cn.porque)!.porque}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* `.escolha-sabor` — os sabores como chips, COM FICHA PRIMEIRO; sem ficha = âmbar */}
          {fatiaAberta != null && pizza && (
            <div className="px-[18px] pb-[14px]">
              <p className="mb-[6px] text-[12px]" style={{ color: 'var(--prod-secondary)' }}>
                escolher o sabor da fatia <b style={{ color: 'var(--prod-primary)' }}>{fatiaAberta + 1}ª</b>{' '}
                (com ficha primeiro; âmbar = sem ficha, tocar cria):
              </p>
              {/* ⭐ a busca: 61 chips são parede. ⛔ Filtra a MESMA lista que a tela desenha
                  (nunca uma 2ª consulta) e o vazio DIZ o recorte — "nenhum sabor" sobre uma
                  busca sem resultado se leria como "o cardápio não tem sabor". */}
              <input
                value={buscaSabor}
                onChange={(e) => setBuscaSabor(e.target.value)}
                placeholder="buscar sabor (calabresa, file bacon…)"
                aria-label="buscar sabor"
                className="mb-[8px] w-full max-w-[320px] rounded-[10px] border px-[10px] py-[6px] text-[12.5px]"
                style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
              />
              <div>
                {saboresFiltrados.length === 0 && (
                  <p className="pb-[4px] text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                    nenhum dos {cat.sabores.length} sabores casa com «{buscaSabor}»
                  </p>
                )}
                {saboresFiltrados.map((s) =>
                  s.temFicha ? (
                    <button
                      key={s.fichaId}
                      type="button"
                      onClick={() => {
                        setEscolhas((a) => { const b = [...a]; b[fatiaAberta] = s; return b })
                        setFatiaAberta(null)
                      }}
                      className="mb-[6px] mr-[6px] inline-block rounded-full border px-[11px] py-[4px] text-[12.5px] hover:bg-[var(--fam-indigo-bg)]"
                      style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                    >
                      {s.nome}
                      {s.custo == null ? ' · custo a apurar' : ` · ${formatBRL(s.custo)}`}
                    </button>
                  ) : (
                    /* ⭐ sabor sem ficha NÃO é escondido: tocar nele é o atalho que sobe a cobertura */
                    <a
                      key={`sem:${s.nome}`}
                      href={`/empresas/${empresaId}/estoque/cardapio?sabor=${encodeURIComponent(s.nome)}`}
                      className="mb-[6px] mr-[6px] inline-block rounded-full border border-dashed px-[11px] py-[4px] text-[12.5px] hover:bg-[var(--fam-ambar-bg)]"
                      style={{ borderColor: 'var(--fam-ambar-mid)', color: 'var(--fam-ambar-ink)' }}
                    >
                      {s.nome} · sem ficha ⚠
                    </a>
                  ),
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Cartao>
  )
}

/** `.preco-input` — 92px, negrito, alinhado à direita. ⛔ Sanitizador da casa: vírgula não zera */
function CampoDePreco({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <input
      value={valor}
      onChange={(e) => aoMudar(sanitizarQtd(e.target.value, 'KG'))}
      inputMode="decimal"
      placeholder="89,90"
      aria-label="preço de venda da pizza"
      className="w-[92px] rounded-[8px] border px-2 py-[3px] text-right text-[14px] font-semibold tabular-nums"
      style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }}
    />
  )
}

function LinhaDaConta({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-[10px] py-[3px]">
      <span style={{ color: 'var(--prod-secondary)' }}>{rotulo}</span>
      <span style={{ color: 'var(--prod-primary)' }}>{valor}</span>
    </div>
  )
}

/**
 * ⭐ A PIZZA EM FATIAS — SVG, uma fatia por setor circular, cada uma tocável.
 *
 * ⚠️ `viewBox` + `w-full`: no celular ela encolhe sem cortar (REGRA 12). E o custo só é escrito
 * dentro da fatia quando ela tem 3 ou menos vizinhas — com 6 fatias o número não caberia e
 * viraria rabisco; aí ele fica na lista ao lado.
 *
 * ⚠️ A cor roda em 3 famílias POR ÍNDICE (como na referência), não pela família do sabor: é
 * isso que mantém duas fatias vizinhas distinguíveis mesmo quando os dois sabores são da
 * mesma família. Fatia vazia = coral; sabor sem ficha = âmbar.
 */
const CORES_DA_FATIA = ['--fam-verde-mid', '--fam-ambar-mid', '--fam-rosa-mid']

function PizzaEmFatias({
  pizza, aoTocar, fatiaAberta,
}: {
  pizza: PizzaMontada
  aoTocar: (i: number) => void
  fatiaAberta: number | null
}) {
  const n = pizza.fatias.length
  const R = 42
  const C = 50
  if (n === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-[12px] border border-dashed p-2 text-center text-[11.5px]"
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
    const r = n === 1 ? 0 : R * 0.6
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full" role="img"
      aria-label={`Pizza ${pizza.tamanho} dividida em ${n} fatia${n > 1 ? 's' : ''} clicáveis`}>
      {/* a borda da pizza: anel externo e massa */}
      <circle cx={C} cy={C} r={R + 5} fill="var(--fam-ambar-mid)" />
      <circle cx={C} cy={C} r={R + 1} fill="var(--fam-ambar-bg)" />
      {pizza.fatias.map((f) => {
        const m = meio(f.indice)
        const vazia = f.sabor == null
        const semFicha = f.sabor != null && f.custo == null
        const cor = vazia
          ? 'var(--fam-coral-mid)'
          : semFicha
            ? 'var(--fam-ambar-mid)'
            : `var(${CORES_DA_FATIA[f.indice % CORES_DA_FATIA.length]})`
        return (
          <g key={f.indice} onClick={() => aoTocar(f.indice)} style={{ cursor: 'pointer' }}>
            <path
              d={setor(f.indice)}
              fill={cor}
              stroke={fatiaAberta === f.indice ? 'var(--prod-acao-bg)' : 'var(--prod-surface)'}
              strokeWidth={fatiaAberta === f.indice ? 2.4 : 1.8}
            />
            {n <= 4 ? (
              <>
                <text x={m.x} y={m.y - 1} fontSize="6" fontWeight="800" textAnchor="middle" fill="var(--prod-acao-ink)">
                  {vazia ? '+' : semFicha ? 'a definir' : formatBRL(f.custo!)}
                </text>
                <text x={m.x} y={m.y + 6} fontSize="4.5" textAnchor="middle" fill="var(--prod-acao-ink)">
                  {vazia ? 'toque e escolha' : f.sabor!.nome.slice(0, 16)}
                </text>
              </>
            ) : (
              <text x={m.x} y={m.y + 2} fontSize="6" fontWeight="800" textAnchor="middle" fill="var(--prod-acao-ink)">
                {f.indice + 1}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ═══════════════ 6 · A FILA DOS SABORES SEM FICHA ═══════════════ */

function FilaDeSabores({ d, empresaId }: { d: MargemDaTela; empresaId: string }) {
  const [tudo, setTudo] = useState(false)
  if (d.saboresSemFicha.length === 0 && d.diasComRelatorioSuspeito.length === 0) return null
  const VISIVEIS = 24
  const lista = tudo ? d.saboresSemFicha : d.saboresSemFicha.slice(0, VISIVEIS)
  const resto = d.saboresSemFicha.length - lista.length

  return (
    <Cartao id="fila">
      {d.saboresSemFicha.length > 0 && (
        <>
          <CabecaDoCartao
            titulo={`🧩 ${d.saboresSemFicha.length} sabores vendidos sem ficha`}
            dica="cada ficha criada entra na obra e a cobertura sobe · maior volume primeiro"
          />
          <div className="flex flex-wrap gap-[6px] px-[18px] pb-[14px] pt-[6px]">
            {lista.map((s) => (
              <a
                key={s.nomeSuitable}
                href={`/empresas/${empresaId}/estoque/cardapio?sabor=${encodeURIComponent(s.nomeSuitable)}`}
                className="rounded-full border border-dashed px-[11px] py-[4px] text-[12px] hover:bg-[var(--fam-ambar-bg)]"
                style={{ borderColor: 'var(--fam-ambar-mid)', color: 'var(--fam-ambar-ink)' }}
              >
                <b className="tabular-nums">{s.ocorrencias}×</b> {s.nomeSuitable}
              </a>
            ))}
            {(resto > 0 || tudo) && (
              <button
                type="button"
                onClick={() => setTudo(!tudo)}
                aria-expanded={tudo}
                className="rounded-full border border-dashed px-[11px] py-[4px] text-[12px]"
                style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}
              >
                {tudo ? 'mostrar menos ▴' : `… e mais ${resto} ▾`}
              </button>
            )}
          </div>
        </>
      )}

      {/* ⚠️ o aviso de QUALIDADE DE DADO: razão sabor/pizza impossível naquele dia */}
      {d.diasComRelatorioSuspeito.length > 0 && (
        <div
          className="border-t px-[18px] py-[9px]"
          style={{ borderColor: 'var(--prod-line)', background: 'var(--fam-coral-bg)' }}
        >
          <p className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--fam-coral-ink)' }}>
            <AlertTriangle className="h-3.5 w-3.5" /> relatório de complementos possivelmente incompleto
          </p>
          <ul className="mt-[2px] space-y-0.5">
            {d.diasComRelatorioSuspeito.map((x) => (
              <li key={x.dia} className="text-[11.5px]" style={{ color: 'var(--fam-coral-ink)' }}>
                {ddmm(x.dia)}: {x.pizzas} pizzas × {x.sabores} sabores no relatório — toda pizza
                obriga ao menos 1 sabor
              </li>
            ))}
          </ul>
        </div>
      )}
    </Cartao>
  )
}
