/**
 * ⭐⭐⭐ O ASSISTENTE DE CONVERSÃO DO LOTE — KG → UN, ficha por ficha (04/10/2026).
 *
 * **Pedido do dono:** *"Eu peço produção SEMPRE em UNIDADES (100 porções de frango, 80 de
 * coxão) — mas 36-37 fichas declaram o lote em KG. Em vez de eu abrir uma por uma: um gesto
 * guiado. Eu digito UM número → PREVIEW → eu confirmo → vira versão nova. Ficha continua sendo
 * MINHA decisão: nada converte sozinho."*
 *
 * ⚠️ É a cura NA RAIZ dos 37 achados do M5 — e o M5 é a raiz medida do caso do `beef de xis`:
 * com o lote declarado em KG num produto contado em UN, o `loteBase` **não responde** *"quantas
 * UN saem de 1 receita"*, e a conversão `pedido → escala` ficava à mercê do rendimento medido.
 *
 * ═══ ⛔⛔⛔ A FÓRMULA QUE O DONO PROPÔS NÃO SOBREVIVEU AO DADO, e isso está aqui porque
 * alguém vai reperguntar ═══
 *
 * Ele escreveu: *"qual o peso de 1 porção? ex. porcao coxao 80 grama → 0,080 KG → 12,5 UN/KG"*
 * — ou seja, dividir as doses por `1 ÷ peso`. **Medido nas 37 fichas reais da Caçula, isso
 * produz dose absurda:** a `porcao coxao 80 grama` pede **0,18 KG de coxão** por porção (perda
 * real de trim), e dividir por 12,5 daria **0,0144 KG = 14 g de coxão numa porção de 80 g**.
 *
 * ⭐⭐ **O que o dado diz:** a dose JÁ É POR UNIDADE e o `loteBase 1 KG` é só o **rótulo**
 * errado. Duas evidências independentes, medidas:
 * ```
 * dose do componente principal ÷ peso do nome  →  EXATAMENTE 1,0 em 20 das 37
 *   (calabresa ralada 50 g → 0,05 · maionese 30 g → 0,03 · aparmegiana 120 g → 0,12 · …)
 * rendimento MEDIDO (quantas UN saíram de 1 receita)  →  ≈1 em 28 das 30 com medição
 * ```
 * ⭐ E a prova de ouro é a `MAIONESE`, que é o caso INVERSO (lote `2,858 UN`, produto em KG):
 * o medido diz **2,858** no ponto.
 *
 * ⛔ **Por isso a sugestão não é uma fórmula — são TRÊS FONTES com proveniência**, e a
 * recomendação só existe quando **duas concordam**. Fonte única aqui seria chutar com cara de
 * autoridade numa decisão que muda a receita do dono.
 *
 * ⚠️⚠️ **E NA MAIORIA DAS FICHAS A SEPARAÇÃO NÃO MUDA NADA** — com `1 receita = 1 unidade`,
 * `escala = pedido ÷ 1` igual a antes e as doses ficam intactas. **O que muda é a ficha parar
 * de mentir sobre o que ela produz** (e o M5 calar). Dizer isso na tela é o que evita o dono
 * achar que vai mexer no estoque: o preview mostra a separação ANTES e DEPOIS.
 */

const round6 = (n: number) => Math.round((n + 1e-9) * 1e6) / 1e6
const round4 = (n: number) => Math.round((n + 1e-9) * 1e4) / 1e4

/**
 * ⚠️ As `porque` vão PRA TELA, e esta casa escreve número em **pt-BR** — o dono digita e lê com
 * VÍRGULA (a cicatriz do campo de quantidade, 29/09: `1.280,50` não é R$ 1,28). Interpolar o
 * número cru imprimiria `2.25` numa frase que explica a dose dele. O teste pegou isso.
 */
const br = (n: number) => round4(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 })

export interface ComponenteDaFicha {
  itemId: string
  nome: string
  unidade: string
  qtdPlanejada: number
}

export interface LoteAtual {
  loteBase: number
  unidadeLoteBase: string
  /** a unidade em que o item produzido se CONTA — o destino da conversão */
  unidadeProduto: string
  componentes: ComponenteDaFicha[]
}

export interface ComponenteConvertido extends ComponenteDaFicha {
  /** a dose nova, por 1 unidade do produto */
  qtdNova: number
  /** `true` quando a dose não se move (o caso `1 receita = 1 unidade`) */
  intacta: boolean
}

export interface ConversaoDoLote {
  /** sempre 1: a receita nova produz UMA unidade do produto */
  loteBaseNovo: number
  unidadeLoteBaseNova: string
  componentes: ComponenteConvertido[]
  /** `true` quando NENHUMA dose muda — a conversão é só de rótulo */
  soRotulo: boolean
}

/**
 * PURA. A ficha convertida: 1 receita passa a produzir **1 unidade** do produto, e cada dose é
 * dividida por quantas unidades a receita atual produzia.
 *
 * ⭐ Uma fórmula cobre os dois mundos: `unidadesPorReceita = 1` deixa as doses intactas (o caso
 * das 28 porções) e `= 2,858` as divide (o caso da MAIONESE).
 *
 * ⚠️ `null` quando o número não serve — nunca chuta: `0` ou negativo dividiria por zero, e
 * `loteBase <= 0` significa ficha sem lote declarado (aí não há o que converter).
 */
export function converterLote(atual: LoteAtual, unidadesPorReceita: number): ConversaoDoLote | null {
  if (!(unidadesPorReceita > 0) || !(atual.loteBase > 0)) return null
  const componentes = atual.componentes.map((c) => {
    const qtdNova = round6(c.qtdPlanejada / unidadesPorReceita)
    return { ...c, qtdNova, intacta: Math.abs(qtdNova - c.qtdPlanejada) < 1e-9 }
  })
  return {
    loteBaseNovo: 1,
    unidadeLoteBaseNova: atual.unidadeProduto,
    componentes,
    soRotulo: componentes.every((c) => c.intacta),
  }
}

export type OrigemDaSugestao = 'MEDIDO' | 'UM_POR_RECEITA' | 'NOME'

export interface SugestaoDaConversao {
  origem: OrigemDaSugestao
  valor: number
  /** a frase que a tela mostra — diz DE ONDE o número veio */
  porque: string
}

export interface LeituraDasSugestoes {
  /** ⚠️ na ORDEM da força da evidência — a tela desenha nesta ordem */
  candidatas: SugestaoDaConversao[]
  /**
   * ⭐ A recomendada só existe quando DUAS fontes independentes concordam. Discordância não
   * ganha vencedor: a tela mostra as duas e o preview da dose decide (foi assim que a fórmula
   * do nome caiu — o dono veria 14 g de coxão numa porção de 80 g).
   */
  recomendada: SugestaoDaConversao | null
  /** `true` quando há 2+ fontes e elas NÃO concordam — a tela tem que DIZER */
  fontesDiscordam: boolean
}

/** ⚠️ ±10%: duas fontes "concordam" quando apontam o mesmo número de unidades por receita. */
export const CONCORDANCIA_DAS_FONTES = 0.1

/**
 * PURA. Quantas gramas/ml o NOME do produto declara. `null` quando o nome não diz.
 *
 * ⚠️ Só casa `g`/`gr`/`grama(s)`/`ml` — **`kg` fica de fora de propósito**: `"QUEIJO 2KG"` é o
 * tamanho da EMBALAGEM que entra, não o peso de uma porção que sai, e ler isso como porção
 * inverteria a conta por 1000.
 */
export function pesoDoNome(nome: string): number | null {
  const m = nome.match(/(\d+(?:[.,]\d+)?)\s*(gramas?|gr|g|ml)\b/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  return n > 0 ? round6(n / 1000) : null
}

export interface EntradaDasSugestoes {
  nomeProduto: string
  /** a maior dose da ficha — é com ela que o peso do nome se compara */
  dosePrincipal: number | null
  /** a mediana do rendimento medido (quantas UN saíram de 1 receita); `null` sem histórico */
  medido: number | null
  lotes: number
  loteBase: number
}

/**
 * PURA. As três fontes, cada uma com a sua proveniência escrita.
 *
 * ⚠️ **A ORDEM É A DA FORÇA DA EVIDÊNCIA**, e o `MEDIDO` vem primeiro porque ele responde
 * LITERALMENTE a pergunta que está sendo feita (*"quantas UN saíram de 1 receita?"*) — é
 * medição, não inferência. O `NOME` vem por último porque foi ele que falhou no dado real.
 *
 * ⛔ E o `MEDIDO` entra **só com 2+ lotes**: *uma produção não é média* (a régua de 01/09), e
 * aqui ela decidiria a receita do dono.
 */
export function sugestoesDaConversao(e: EntradaDasSugestoes): LeituraDasSugestoes {
  const candidatas: SugestaoDaConversao[] = []

  if (e.medido != null && e.medido > 0 && e.lotes >= 2) {
    candidatas.push({
      origem: 'MEDIDO',
      valor: round4(e.medido),
      porque: `os seus últimos ${e.lotes} lotes renderam ${br(e.medido)} por receita — é a medição da própria pergunta`,
    })
  }

  /**
   * ⭐ "1 receita = 1 unidade" — a hipótese que o dado sustenta em 28 de 30 fichas. Ela é
   * CONFIRMADA quando a dose principal bate com o peso do nome (razão ~1): aí a dose já é
   * por unidade, e a conversão é só de rótulo.
   */
  const peso = pesoDoNome(e.nomeProduto)
  const razaoDosePeso = peso && e.dosePrincipal ? e.dosePrincipal / peso : null
  const doseJaEhPorUnidade = razaoDosePeso != null && razaoDosePeso >= 0.9
  candidatas.push({
    origem: 'UM_POR_RECEITA',
    valor: 1,
    porque: doseJaEhPorUnidade
      ? `a dose principal (${br(e.dosePrincipal!)}) já é do tamanho de 1 unidade — o nome diz ${br(peso!)} e a receita pede ${br(razaoDosePeso!)}× isso (perda de trim)`
      : '1 receita produz 1 unidade — as doses ficam intactas, muda só o rótulo do lote',
  })

  if (peso && peso > 0) {
    candidatas.push({
      origem: 'NOME',
      valor: round4(1 / peso),
      porque: `o nome diz ${br(peso)} por unidade, então ${br(e.loteBase)} de lote renderia ${br(1 / peso)} unidades — ⚠️ confira a dose no preview antes de aceitar`,
    })
  }

  /**
   * ⭐⭐ A RECOMENDAÇÃO EXIGE DUAS FONTES CONCORDANDO. Com uma só (ou com elas discordando)
   * não há recomendada — e isso é a disciplina do empate: *"não sei qual é"* é resposta.
   */
  let recomendada: SugestaoDaConversao | null = null
  let fontesDiscordam = false
  if (candidatas.length >= 2) {
    const pares = candidatas.flatMap((a, i) => candidatas.slice(i + 1).map((b) => [a, b] as const))
    const concorda = pares.find(([a, b]) => Math.abs(a.valor - b.valor) / Math.max(a.valor, b.valor) <= CONCORDANCIA_DAS_FONTES)
    if (concorda) recomendada = concorda[0]
    else fontesDiscordam = true
  }
  return { candidatas, recomendada, fontesDiscordam }
}
