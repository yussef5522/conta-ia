// ⭐⭐ PREVISÃO DE RENDIMENTO — a régua ÚNICA que converte "quantas porções" ↔ "quantos kg"
// e julga a variação na conclusão (01/09/2026).
//
// ⛔ O QUE MOTIVOU (relato do dono, com o print na mão): ordem "porção queijo 135 grama",
// ele tirou **20,85 kg** da câmara, e na conclusão a tela perguntava *"quantos saíram?"* com
// a caixa vazia e **"rendimento médio: a apurar"**. *"Ele sabe que a porção é 0,135 kg e que
// eu tirei 20,85 kg — dava pra dizer ~154 porções e não diz."* **O dado estava todo gravado:**
// `stock_producao_conclusao.rendimento` desde 21/08, a média das últimas 5 em
// `rendimentoMedioDaFicha`, e o `concluir()` já calculava `desvio`/`foraDaFaixa` — que a
// tela **descartava**. Faltava a conta e faltava mostrar.
//
// ⭐⭐ O SENTIDO PRINCIPAL É O INVERSO, e foi o dono que corrigiu: *"eu falo pro funcionário
// 'faz 200 porções'. Ele precisa saber QUANTOS KG PEGAR. Hoje ele faz a conta de cabeça."*
// Por isso a tela tem DOIS campos ligados e esta lib responde nas DUAS direções.
//
// ⭐ E A MESMA RÉGUA NOS DOIS SENTIDOS, senão a ida-e-volta não fecha. O dono escreveu
// "100 kg → ~740 porções", que é o TEÓRICO, enquanto "200 porções → 29,3 kg" é a MEDIDA;
// misturar produz `200 → 29,3 kg → 217 porções` e a tela parece defeituosa. Ele confirmou:
// *"mesma régua nos dois sentidos. A medida no campo, o teórico ao lado."*
//
// ⚠️ **"O INSUMO QUE EU DIGITO É O PRINCIPAL NAQUELE MOMENTO"** — regra do dono, escrita aqui
// porque alguém vai reperguntar daqui a meses: numa receita de N insumos, **não existe campo
// "insumo principal"** e não vai existir (exigiria coluna em `stock_ficha_componente`, e o
// isolamento do módulo proíbe ALTER). A linha que a pessoa está digitando É a régua daquele
// momento: ela reconduz o "quero fazer" e as outras linhas re-sugerem a partir dela.
//
// ⚠️ FONTE ÚNICA: `escalaDoConsumo` foi EXTRAÍDA de `concluir()` — a mesma média de razões
// que já decidia o rendimento gravado. A tela de separar tinha uma **segunda cópia** dela
// (o `escalaAviso`, que dizia "~154× a receita" e parava aí). As duas passam a chamar esta.
// O `0,135` vem sempre da FICHA; nenhuma segunda conta de "quanto sai por kg" existe.

/** ⚠️ UMA produção não é média (regra do dono). Abaixo disto, previsão e aviso usam o teórico. */
export const MIN_LOTES_PARA_MEDIA = 2

/** ±15% — a mesma faixa que o juiz P3 já usa pra achar rendimento fora do normal. */
export const DESVIO_ALERTA = 0.15

const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000

export interface LinhaConsumo {
  /** quanto foi consumido/separado de verdade */
  qtd: number
  /** quanto a ficha pede por 1× o lote base */
  porLote: number
}

/**
 * PURA. Quantas vezes a receita foi feita, a partir do que saiu da câmara.
 *
 * ⚠️ MÉDIA das razões, e é assim de propósito — é o que `concluir()` já fazia pra gravar o
 * rendimento. Se aqui fosse diferente, a previsão prometeria uma coisa e o rendimento
 * gravado mediria outra, e o desvio da tela viraria ficção.
 *
 * ⚠️ Linha com `porLote <= 0` não entra (dividir por zero inventaria escala infinita) e
 * linha não digitada (`qtd = 0`) também não — quem ainda não foi separado não vota.
 */
export function escalaDoConsumo(linhas: LinhaConsumo[]): number | null {
  const razoes = linhas
    .filter((l) => l.porLote > 0 && l.qtd > 0)
    .map((l) => l.qtd / l.porLote)
  if (!razoes.length) return null
  return round4(razoes.reduce((a, b) => a + b, 0) / razoes.length)
}

export interface ReguaRendimento {
  /** o que a ficha promete por 1× a receita (`loteBase`) */
  teorico: number
  /** o que a cozinha entrega de verdade, média das últimas 5 conclusões */
  medido: number | null
  /** quantas conclusões compõem a média */
  lotes: number
}

export interface Regua {
  /** o rendimento por receita que MANDA na conta */
  valor: number
  /** `true` quando a régua é a média medida; `false` quando ainda é a ficha */
  daMedia: boolean
  lotes: number
  /** medido ÷ teórico — o "92%" da tela. `null` sem média. */
  pct: number | null
  /**
   * ⭐⭐ `true` quando existe medição mas ela DISCORDA tanto da ficha que o sistema **recusou
   * usá-la** e voltou pro declarado. A tela tem que DIZER isso — ver `DISCORDANCIA_MAXIMA`.
   */
  discordante: boolean
}

/**
 * ⛔⛔⛔ A FAIXA DE CONCORDÂNCIA — a 2ª camada da cura do `beef de xis` (03/10/2026).
 *
 * **A régua nova, e ela é a disciplina da casa:** a **observação** (o rendimento medido) não
 * sobrescreve a **declaração do dono** (o `loteBase` da ficha) **em silêncio**. Ela substitui
 * quando CONCORDA; quando destoa, vale o declarado e o sistema **AVISA**.
 *
 * ⚠️ É a mesma régua de *"categoria é decisão do dono — o sistema PERGUNTA quando estranha,
 * nunca reclassifica sozinho"* (17/08), aplicada ao rendimento. O `loteBase` é o que ele
 * escreveu; a média é o que a cozinha fez. **Divergência grande é sinal de que um dos dois
 * está errado — e escolher calado é o que produziu o caso de hoje.**
 *
 * ⭐ Medido na Caçula (43 fichas de produção): **13 passam de ±20%**, e a pior é
 * `QUEIJO CHEDDAR FATIADO` com **medido 10,2704 contra teórico 1 — 1027%**. Pedir 10 ali
 * separaria material pra **1 unidade**. Era bomba armada, e a faixa a desarma.
 *
 * ⚠️ **E o número NÃO foi escolhido a dedo:** ±20% é a MESMA faixa do M2 (plausibilidade da
 * dose, 02/10), pelo mesmo motivo — abaixo dela está a folga real de trim/manipulação que a
 * cozinha tem todo dia (o `beef de hamburger` roda em 93-95% e é legítimo, por isso o dono o
 * chamou de "OK"); acima dela, é dado torto.
 *
 * ⛔ **E ela NÃO contradiz a decisão de 01/09** (*"a medida no campo, o teórico ao lado"*, que
 * nasceu porque pelo teórico a `porção de queijo` fazia **faltar**): aquela ficha roda em
 * **101%** do teórico — dentro da faixa, segue usando a medida. O que a faixa barra é a média
 * **envenenada**, não a correção fina.
 */
export const DISCORDANCIA_MAXIMA = 0.2

/**
 * PURA. Qual rendimento manda: a média medida (a partir de 2 lotes) ou a ficha.
 *
 * ⚠️ ≥2 É DECISÃO DO DONO e vale **só pra previsão e aviso** — *"custo é 'quanto custou',
 * previsão é 'quanto vai sair'; são perguntas diferentes"*. O custo por unidade da ficha
 * continua usando a medição desde o 1º lote (uma medição real é melhor que "a definir").
 */
export function reguaDoRendimento(r: ReguaRendimento): Regua {
  const pct = r.medido != null && r.teorico > 0 ? round4(r.medido / r.teorico) : null
  const temMedia = r.medido != null && r.medido > 0 && r.lotes >= MIN_LOTES_PARA_MEDIA
  /**
   * ⭐ A medição DISCORDA do declarado? Então ela não manda — e o fato fica marcado pra a
   * tela dizer. ⚠️ Sem `pct` (teórico ≤ 0) não há como comparar: aí a média é tudo que existe
   * e usá-la é melhor que nada.
   */
  const discordante = temMedia && pct != null && Math.abs(pct - 1) > DISCORDANCIA_MAXIMA
  const usaMedia = temMedia && !discordante
  return {
    valor: usaMedia ? (r.medido as number) : r.teorico,
    daMedia: usaMedia,
    lotes: r.lotes,
    pct,
    discordante,
  }
}

export interface Previsao {
  /** o número que vai NO CAMPO (pela régua vigente) */
  esperado: number
  /** o que a ficha prometia — sempre visível ao lado */
  teorico: number
  /** o que a média diz; `null` sem histórico */
  medido: number | null
}

/** PURA. `escala` × rendimento → quantas unidades saem. (kg digitado → porções) */
export function preverSaida(escala: number, r: ReguaRendimento): Previsao {
  const regua = reguaDoRendimento(r)
  return {
    esperado: round4(escala * regua.valor),
    teorico: round4(escala * r.teorico),
    medido: r.medido != null ? round4(escala * r.medido) : null,
  }
}

/**
 * PURA. O INVERSO — quantas receitas pra sair a quantidade desejada.
 * (porções digitadas → escala → kg de cada insumo)
 *
 * ⭐ É o sentido principal do dono: *"faz 200 porções"* → quanto pegar. E é por isso que a
 * régua tem que ser a MEDIDA: pelo teórico (0,135 × 200 = 27 kg) **ele pega pouco e falta**.
 */
export function escalaParaSaida(qtdDesejada: number, r: ReguaRendimento): number | null {
  const regua = reguaDoRendimento(r)
  if (!(qtdDesejada > 0) || !(regua.valor > 0)) return null
  return round4(qtdDesejada / regua.valor)
}

/** PURA. Quanto pegar de UM insumo pra fazer `qtdDesejada`. */
export function insumoParaSaida(qtdDesejada: number, porLote: number, r: ReguaRendimento): number | null {
  const escala = escalaParaSaida(qtdDesejada, r)
  return escala == null ? null : round4(escala * porLote)
}

export type FaixaVariacao = 'NORMAL' | 'ABAIXO' | 'ACIMA' | 'SEM_REGUA'

export interface Variacao {
  /** saiu ÷ teórico — o "78%" */
  pctTeorico: number | null
  /** saiu ÷ média medida; `null` enquanto não há média */
  pctMedia: number | null
  /** o "92%" da régua, pra tela dizer "sua média é 92%" */
  pctMediaDaFicha: number | null
  faixa: FaixaVariacao
  /** `true` só quando há régua medida e o desvio passa de ±15% */
  alerta: boolean
}

/**
 * PURA. Julga o que saiu contra o esperado. **SUGERE, NUNCA DECIDE** — não trava conclusão.
 *
 * ⚠️ O julgamento é contra a MÉDIA quando ela existe (≥2 lotes) e contra o teórico enquanto
 * não existe. Com 1 lote só, `faixa` fica NORMAL: chamar de "abaixo do normal" quando o
 * "normal" é uma medição única seria inventar uma régua — e alarme falso repetido mata o
 * alarme.
 */
export function avaliarVariacao(qtdGerada: number, escala: number, r: ReguaRendimento): Variacao {
  const regua = reguaDoRendimento(r)
  const esperadoTeorico = escala * r.teorico
  const esperadoMedio = r.medido != null ? escala * r.medido : null
  const pctTeorico = esperadoTeorico > 0 ? round4(qtdGerada / esperadoTeorico) : null
  const pctMedia = esperadoMedio != null && esperadoMedio > 0 ? round4(qtdGerada / esperadoMedio) : null

  if (!regua.daMedia || pctMedia == null) {
    return { pctTeorico, pctMedia, pctMediaDaFicha: regua.pct, faixa: 'SEM_REGUA', alerta: false }
  }
  const desvio = pctMedia - 1
  const faixa: FaixaVariacao = desvio < -DESVIO_ALERTA ? 'ABAIXO' : desvio > DESVIO_ALERTA ? 'ACIMA' : 'NORMAL'
  return { pctTeorico, pctMedia, pctMediaDaFicha: regua.pct, faixa, alerta: faixa !== 'NORMAL' }
}
