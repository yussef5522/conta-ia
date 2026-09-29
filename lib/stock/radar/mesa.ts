/**
 * ⭐⭐⭐ A MESA DE PERÍCIA — REAL × TEÓRICO v2 (29/09/2026)
 *
 * **A lei do dono, e ela é o arquivo inteiro:** *"a tela Real × Teórico passa a ler
 * EXCLUSIVAMENTE o motor do Radar — o cálculo próprio que ela tem hoje MORRE. Duas telas,
 * uma verdade."*
 *
 * ⛔⛔ **POR ISSO AQUI NÃO EXISTE UMA CONTA.** Este arquivo é **tradução**: ele pega a
 * `LinhaDoRadar` que `calcularFechamentoDoDia` devolveu e a arruma em colunas. Nenhuma
 * consulta ao banco, nenhuma soma sobre o ledger, nenhum `saldoInicial` recalculado.
 *
 * ⚠️⚠️ **E ISSO NÃO É PREFERÊNCIA DE ESTILO — as duas telas DISCORDAVAM, e dá pra dizer
 * onde:** o `calcularRealVsTeorico` que morre somava **TODOS os `AJUSTE_CONTAGEM` do
 * período**, enquanto o Radar usa a **ÚLTIMA contagem** de cada item (`refPorItem`
 * sobrescreve). Item contado **duas vezes** no mesmo período dava números diferentes nas
 * duas telas — e nenhuma das duas dizia qual era a certa.
 *
 * ⛔ **O GUARD DE PÁGINA PASSA POR CONSTRUÇÃO, não por sorte:** `variancia` é o
 * `conta.faltou` do motor, sem tocar. Se um dia alguém recalcular aqui, o teste que compara
 * Σ(mesa) com Σ(Radar) fica vermelho no mesmo commit.
 */
import type { LinhaDoRadar, TotalDaSecao } from './fechamento'
import { totalDaSecao } from './fechamento'

/**
 * ⭐ AS COLUNAS, com os nomes de mercado que o dono pediu — **lista fechada e ordenada**.
 *
 * ⚠️ `padrao: false` em **R$ e %** é decisão dele: *"esta tela olha QUANTIDADE"*. O dinheiro
 * continua existindo (e o Radar continua ordenando por ele); o que muda é o que a mesa abre
 * mostrando.
 */
export const COLUNAS = [
  { chave: 'inicio', rotulo: 'INÍCIO', ajuda: 'estoque no começo da janela (Beginning Inventory)', tipo: 'qtd', padrao: true },
  { chave: 'entrou', rotulo: 'ENTROU', ajuda: 'compras e entradas', tipo: 'qtd', padrao: true },
  { chave: 'produziu', rotulo: 'PRODUZIDO', ajuda: 'geração de produção (+) · nos insumos, o separado aparece com sinal −', tipo: 'qtd', padrao: true },
  { chave: 'vendeu', rotulo: 'VENDEU', ajuda: 'baixas de venda, pelas fichas', tipo: 'qtd', padrao: true },
  { chave: 'perdeu', rotulo: 'PERDEU', ajuda: 'perdas e uso interno lançados', tipo: 'qtd', padrao: false },
  { chave: 'teorico', rotulo: 'TEÓRICO', ajuda: 'o que devia ter no fim', tipo: 'qtd', padrao: true },
  { chave: 'real', rotulo: 'REAL', ajuda: 'o que foi contado (última contagem dentro do período)', tipo: 'qtd', padrao: true },
  { chave: 'variancia', rotulo: 'VARIÂNCIA', ajuda: 'real − teórico', tipo: 'qtd', padrao: true },
  { chave: 'valor', rotulo: 'R$', ajuda: 'a variância em dinheiro', tipo: 'dinheiro', padrao: false },
  { chave: 'pct', rotulo: '%', ajuda: 'variância sobre o que rotacionou', tipo: 'pct', padrao: false },
] as const

export type ChaveColuna = (typeof COLUNAS)[number]['chave']
export const COLUNAS_PADRAO: ChaveColuna[] = COLUNAS.filter((c) => c.padrao).map((c) => c.chave)

/** ⚠️ chave desconhecida (versão antiga salva, dedo no JSON) é DESCARTADA, não quebra a tela */
export function colunasValidas(escolhidas: readonly string[] | null | undefined): ChaveColuna[] {
  if (!escolhidas) return COLUNAS_PADRAO
  const conhecidas = new Set<string>(COLUNAS.map((c) => c.chave))
  const limpas = escolhidas.filter((c) => conhecidas.has(c)) as ChaveColuna[]
  // ⛔ lista vazia não vira tela sem colunas — o dono não consegue nem ligar de volta
  return limpas.length ? [...new Set(limpas)] : COLUNAS_PADRAO
}

export interface LinhaDaMesa {
  itemId: string
  nome: string
  unidade: string
  /** ⭐ a JANELA REAL desta linha, escrita — duas linhas podem falar de janelas diferentes */
  desde: string | null
  ate: string | null
  diasDaJanela: number | null
  inicio: number | null
  entrou: number
  produziu: number
  vendeu: number
  perdeu: number
  /** ⚠️ separado pra produção: sai da prateleira do INSUMO (sinal −) e vira geração na porção */
  separado: number
  teorico: number | null
  /** ⛔ `null` = falta contar. NUNCA zero — zero afirmaria que bateu. */
  real: number | null
  variancia: number | null
  varianciaValor: number | null
  /** |variância| sobre o que rotacionou — `null` quando não rotacionou nada */
  pct: number | null
  /**
   * ⭐⭐ O QUE A LINHA **NÃO CONSEGUE EXPLICAR** (29/09/2026, achado na prova em prod).
   *
   * ⛔ A mesa fecha na horizontal (`início + entrou + produzido + vendeu + perdeu +
   * separado == teórico`) — **menos quando o motor já sabe que não fecha**: movimento com
   * data fora de ordem, ajuste avulso no meio. Medido em prod na «porçao queijo 135
   * grama»: as colunas somam 937 e o teórico é 934.
   *
   * ⚠️ Sem este campo a tabela mostraria os dois números e **nada explicando os 3** — o
   * dono faria a conta no dedo e acharia um furo que não é furo. A conta de padeiro já
   * dizia isso ao abrir; agora a LINHA admite sozinha. *Número que não soma é como a
   * confiança na tela se perde.*
   */
  naoExplicado: number
  veredito: LinhaDoRadar['veredito']
  custoMedio: number | null
  /** ⚠️ a conta de padeiro vem inteira: a mesa NÃO a remonta (é o mesmo componente) */
  conta: LinhaDoRadar['conta']
  ultimaContagem: string | null
}

const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
const EPS = 0.0001

function qtdDoBalde(l: LinhaDoRadar, chave: string): number {
  return l.conta?.baldes.find((b) => b.chave === chave)?.qtd ?? 0
}

/**
 * ⭐⭐ A TRADUÇÃO — e ela é só leitura de campo, de propósito.
 *
 * ⚠️ **O SINAL É O DO LEDGER** (vendeu e perdeu vêm negativos). Não é detalhe de exibição:
 * é o que faz `INÍCIO + ENTROU + PRODUZIDO + VENDEU + PERDEU + SEPARADO == TEÓRICO` fechar
 * na horizontal. *Linha de números que não soma é como a confiança na tela se perde* — e
 * aqui o dono vai conferir no dedo.
 */
export function linhaDaMesa(l: LinhaDoRadar): LinhaDaMesa {
  const c = l.conta
  const vendeu = qtdDoBalde(l, 'vendeu')
  const perdeu = qtdDoBalde(l, 'perdas')
  const separado = qtdDoBalde(l, 'devolveu')
  const rotacao = Math.abs(vendeu) + Math.abs(perdeu) + Math.abs(separado)
  return {
    itemId: l.itemId,
    nome: l.nome,
    unidade: l.unidadeControle,
    desde: c?.desde ?? null,
    ate: c?.ate ?? null,
    diasDaJanela: c?.diasDaJanela ?? null,
    inicio: c ? c.tinha : null,
    entrou: qtdDoBalde(l, 'comprou'),
    produziu: qtdDoBalde(l, 'produziu'),
    vendeu,
    perdeu,
    separado,
    teorico: c ? c.deviaTer : null,
    real: c?.contamos ?? null,
    // ⛔ a variância É a do motor, sem recálculo — é isto que faz Σ(mesa) == Σ(Radar)
    variancia: l.faltou,
    varianciaValor: l.faltouValor,
    naoExplicado: c?.naoExplicado ?? 0,
    pct: l.faltou != null && rotacao > EPS ? round3(Math.abs(l.faltou) / rotacao) : null,
    veredito: l.veredito,
    custoMedio: l.custoMedio,
    conta: l.conta,
    ultimaContagem: l.ultimaContagem,
  }
}

export interface SecaoDaMesa {
  chave: 'revenda' | 'caros' | 'porcoes'
  titulo: string
  icone: string
  linhas: LinhaDaMesa[]
  /** ⚠️ o subtotal é o do MOTOR (`totalDaSecao`) — UN e KG nunca somam num número só */
  total: TotalDaSecao
}

/**
 * ⭐ A MESA INTEIRA. `filtroItens` vazio/nulo = as watchlists do Radar, inteiras.
 *
 * ⛔ O filtro recorta **depois** do motor, de propósito: o motor decide a janela e a
 * variância de cada item sem saber o que a tela vai mostrar. Recortar antes mudaria o
 * placar do Radar dependendo do filtro — duas telas, duas verdades de novo.
 */
export function montarMesa(
  radar: { caros: LinhaDoRadar[]; revenda: LinhaDoRadar[]; porcoes: LinhaDoRadar[] },
  filtroItens?: readonly string[] | null,
): SecaoDaMesa[] {
  const filtro = filtroItens && filtroItens.length ? new Set(filtroItens) : null
  const recorte = (ls: LinhaDoRadar[]) => (filtro ? ls.filter((l) => filtro.has(l.itemId)) : ls)
  const secao = (chave: SecaoDaMesa['chave'], titulo: string, icone: string, ls: LinhaDoRadar[]): SecaoDaMesa => {
    const dentro = recorte(ls)
    return { chave, titulo, icone, linhas: dentro.map(linhaDaMesa), total: totalDaSecao(dentro) }
  }
  return [
    secao('revenda', 'revenda', '🥤', radar.revenda),
    secao('caros', 'os caros', '💰', radar.caros),
    secao('porcoes', 'porções', '🍳', radar.porcoes),
  ]
}

/**
 * ⭐⭐ O RODAPÉ HONESTO DE CADA SEÇÃO.
 *
 * ⛔ *"2 sem contagem — fora dos totais"*: item sem contagem **não entra na soma** e a tela
 * **DIZ** que não entrou. Somar zero afirmaria que ele bateu; calar esconderia o tamanho do
 * que não foi medido — as duas mentiras que esta tela existe pra não contar.
 */
export function frasesDoRodape(t: TotalDaSecao): string[] {
  const fr: string[] = []
  const porUn = (m: Record<string, number>) =>
    Object.entries(m).map(([un, q]) => `${q.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${un}`).join(' · ')
  if (Object.keys(t.faltouPorUnidade).length) fr.push(`faltou ${porUn(t.faltouPorUnidade)}`)
  if (Object.keys(t.sobrouPorUnidade).length) fr.push(`sobrou ${porUn(t.sobrouPorUnidade)}`)
  if (!fr.length && t.itensContados > 0) fr.push('nada faltou')
  if (t.itensSemContagem > 0) fr.push(`${t.itensSemContagem} sem contagem — fora dos totais`)
  return fr
}

/**
 * ⭐⭐⭐ O INVARIANTE DA TELA, em função PURA pra o teste poder executá-lo.
 *
 * **A ordem do dono:** *"Σ(Real×Teórico) == Σ(Radar) pro mesmo recorte/itens; qualquer
 * divergência = vermelho"*. Sem filtro, a mesa tem que somar exatamente o que o placar do
 * Radar soma — se um dia alguém puser uma conta aqui, isto fica vermelho.
 */
export function somaDaMesa(secoes: SecaoDaMesa[]): {
  /** ⭐ a soma ASSINADA — negativo é furo, positivo é sobra */
  valor: number
  /**
   * ⚠️⚠️ **O PLACAR DO RADAR É `Math.abs`, com o sinal vivendo no `tom`** (desenho de
   * 20/09). Descobri isto porque o guard da lei 0 ficou vermelho comparando `-6` com `6`
   * — e o certo era eu ALINHAR a comparação com a régua dele, não "consertar" o placar.
   * Por isso a mesa devolve os dois: o número assinado, que ela mostra, e o par
   * `absoluto`+`tom`, que é o que se compara com o Radar campo a campo.
   */
  absoluto: number
  tom: 'FALTOU' | 'SOBROU' | 'BATEU' | 'SEM_CONTAGEM'
  itensContados: number
} {
  let valor = 0, itensContados = 0
  for (const s of secoes) {
    for (const l of s.linhas) {
      if (l.varianciaValor == null) continue
      valor += l.varianciaValor
      itensContados++
    }
  }
  const v = Math.round((valor + 1e-9) * 100) / 100
  return {
    valor: v,
    absoluto: Math.abs(v),
    // ⚠️ a MESMA derivação do placar (mesmos limiares) — se divergirem, as duas telas
    // pintam o mesmo fato de cores diferentes
    tom: itensContados === 0 ? 'SEM_CONTAGEM' : v < -0.005 ? 'FALTOU' : v > 0.005 ? 'SOBROU' : 'BATEU',
    itensContados,
  }
}
