// ⭐⭐ PREVISÃO DE RENDIMENTO — a régua que julga o que SAIU, e o ESPELHO da medição.
//
// ⛔⛔⛔ **ESTE ARQUIVO PERDEU O PODER DE DECIDIR SEPARAÇÃO EM 03/10/2026 (decisão do dono).**
// *"Receita é lei, rendimento é só relatório. A separação é SEMPRE ficha × pedido, SEM
// rendimento no meio — ele NUNCA multiplica nem divide nada."* Motivo de dono: *"se
// funcionário rende mal ou rouba, um sistema que adapta a separação pela medição APRENDE o
// roubo como normal e passa a cobrir ele."*
//
// **O que SAIU daqui** (apagado, não desativado — função sem chamador é função que alguém
// religa por descuido): `escalaParaSaida` · `insumoParaSaida` · `reguaDoRendimento` /
// `Regua` · `DISCORDANCIA_MAXIMA`. Quem converte pedido→separação agora é
// **`escala-da-ordem.ts`**, cujo tipo **não tem campo de rendimento** (REGRA 5: o erro ficou
// impossível, não improvável).
//
// ⚠️ A `DISCORDANCIA_MAXIMA` (faixa de ±20%) morreu porque ela existia pra decidir QUAL
// rendimento mandava. Com a ficha mandando sempre, não há o que escolher — e escolher era o
// problema. O que sobrou da medição é `eficienciaMedia` (espelho) e `avaliarVariacao`
// (veredito contra a FICHA).
//
// ⭐ O que CONTINUA aqui e por quê: `escalaDoConsumo` (quantas receitas saíram do que foi
// consumido de verdade — é o que o `concluir()` grava, não é separação) e o julgamento do
// lote. Veja `eficiencia-da-ordem.ts` pro espelho por ordem e o juiz **P8**.
//
// ───────────────────────────────────────────────────────────────────────────────────────────
// Histórico do arquivo (01/09/2026), preservado porque explica os campos:
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

export interface EficienciaMedia {
  /** medido ÷ teórico — o "92%" da tela */
  pct: number
  lotes: number
}

/**
 * PURA. O ESPELHO: quanto a cozinha vem rendendo, em % do que a ficha promete.
 *
 * ⛔⛔ **ELA NÃO ENTRA EM CONTA NENHUMA.** É um número pra LER — na tela de criar a ordem
 * (*"os últimos N lotes renderam 125% do que a ficha promete"*) e no juiz. Antes isto era um
 * PARÂMETRO que dividia o pedido e **sumia dentro da escala**; agora é texto.
 *
 * ⚠️ `null` com menos de 2 lotes: *uma produção não é média* (regra do dono, 01/09) — e
 * chamar um lote único de "a sua média" é inventar uma referência.
 */
export function eficienciaMedia(r: ReguaRendimento): EficienciaMedia | null {
  if (r.medido == null || !(r.medido > 0) || !(r.teorico > 0)) return null
  if (r.lotes < MIN_LOTES_PARA_MEDIA) return null
  return { pct: round4(r.medido / r.teorico), lotes: r.lotes }
}

export interface Previsao {
  /**
   * ⭐ O que a FICHA promete pra essa escala — **a única expectativa que existe**.
   *
   * ⚠️ O campo se chama assim de propósito: o antigo `esperado` saía da "régua vigente" (média
   * ou ficha, o sistema escolhia) e era exatamente o lugar onde a medição entrava calada.
   * Nome novo pra que o `tsc` ache todo mundo que lia o antigo (REGRA 4 de graça).
   */
  esperadoDaFicha: number
  /** o que a média histórica diria — ESPELHO, ao lado, nunca na conta. `null` sem histórico. */
  medido: number | null
}

/** PURA. `escala` × o que a ficha promete → quantas unidades devem sair. */
export function preverSaida(escala: number, r: ReguaRendimento): Previsao {
  return {
    esperadoDaFicha: round4(escala * r.teorico),
    medido: r.medido != null ? round4(escala * r.medido) : null,
  }
}

export type FaixaVariacao = 'NORMAL' | 'ABAIXO' | 'ACIMA' | 'SEM_REGUA'

export interface Variacao {
  /** saiu ÷ o que a ficha prometia — **a eficiência**, o "78%" */
  pctFicha: number | null
  /** saiu ÷ média medida — ESPELHO ("contra o que você costuma fazer"). `null` sem média. */
  pctMedia: number | null
  /** o "92%" do espelho, pra tela dizer "sua média é 92%" */
  pctMediaDaFicha: number | null
  faixa: FaixaVariacao
  /** `true` quando a EFICIÊNCIA passa de ±15% do que a receita promete */
  alerta: boolean
}

/**
 * PURA. Julga o que saiu **contra a FICHA**. SUGERE, NUNCA trava a conclusão.
 *
 * ⛔⛔ **A RÉGUA MUDOU EM 03/10 (decisão do dono) e a mudança é o ponto do sprint:** antes o
 * veredito era contra a MÉDIA (e ficava `SEM_REGUA` enquanto não houvesse 2 lotes). Medir
 * contra a média é perguntar *"você produziu como costuma produzir?"* — pergunta que sempre
 * responde SIM, porque a referência anda junto com o desvio. **Agora a referência é a receita**,
 * que não anda: *"pedi 10 · produziu 9 → 90%"*, desde o PRIMEIRO lote.
 *
 * ⚠️ `SEM_REGUA` sobrou só pro caso em que não há o que comparar (`teorico <= 0`) — ficha com
 * lote base zerado. Ali inventar porcentagem seria pior que dizer "não sei".
 */
export function avaliarVariacao(qtdGerada: number, escala: number, r: ReguaRendimento): Variacao {
  const esperadoFicha = escala * r.teorico
  const esperadoMedio = r.medido != null ? escala * r.medido : null
  const pctFicha = esperadoFicha > 0 ? round4(qtdGerada / esperadoFicha) : null
  const pctMedia = esperadoMedio != null && esperadoMedio > 0 ? round4(qtdGerada / esperadoMedio) : null
  const espelho = eficienciaMedia(r)

  if (pctFicha == null) {
    return { pctFicha, pctMedia, pctMediaDaFicha: espelho?.pct ?? null, faixa: 'SEM_REGUA', alerta: false }
  }
  const desvio = pctFicha - 1
  const faixa: FaixaVariacao = desvio < -DESVIO_ALERTA ? 'ABAIXO' : desvio > DESVIO_ALERTA ? 'ACIMA' : 'NORMAL'
  return { pctFicha, pctMedia, pctMediaDaFicha: espelho?.pct ?? null, faixa, alerta: faixa !== 'NORMAL' }
}
