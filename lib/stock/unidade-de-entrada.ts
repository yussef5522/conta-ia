// ⭐⭐⭐ A NOTA É FATO; A ENTRADA É COMBINADO (05/09/2026) — regra do dono.
//
// **CASO REAL, medido na nota do ALAN SALBEGO de 05/09:**
//
//     cProd 12457 · "LEITE EM PO INTEGRAL AURORA 400G" · 12 KG × 15,99 = 191,88 · trib 12 UN
//
// São **12 latas de 400 g**, não 12 quilos. O fornecedor digitou a unidade errada — e a
// própria nota **se contradiz**: a unidade COMERCIAL diz `KG` e a **TRIBUTÁRIA diz `UN`**.
//
// ⭐ ESSA CONTRADIÇÃO É O SINAL, e ele é MEDIDO, não palpite: quando `uCom ≠ uTrib` e a
// tributária bate com a unidade do item de destino, o sistema **sugere** a correção com o
// motivo à vista. É a mesma disciplina do fator (22/08): *qTrib/uTrib primeiro, palpite por
// último*.
//
// ⛔⛔ O QUE NÃO MUDA NUNCA: **a nota fica como veio** (12 KG, assinada pela SEFAZ). O que
// se corrige é a ENTRADA — e o rastro fica gravado ("a nota dizia 12 KG; entrada conferida
// como 12 UN, por Fulano"). Reescrever o documento fiscal seria mentir sobre um fato
// assinado; é a mesma regra dos itens digitados do DANFE e do combinado × duplicata.
//
// ⛔ E O GUARD DO DONO (item 4): trocar a unidade **não afrouxa o fator**. Identidade
// (fator 1) só entre unidades IGUAIS; entre unidades diferentes exige fator conhecido —
// **nada de fator 1 silencioso entre KG e UN**, que é como 12 quilos de leite em pó viram
// 12 latas sem ninguém decidir.

/** normaliza a sigla da unidade: maiúscula, sem ponto/espaço, e os apelidos mais comuns */
export function normalizarUnidade(u: string | null | undefined): string {
  const s = (u ?? '').toUpperCase().replace(/[^A-Z]/g, '')
  if (s === 'UND' || s === 'UNID' || s === 'PC' || s === 'PCT') return 'UN'
  if (s === 'KGS' || s === 'QUILO') return 'KG'
  if (s === 'LTS' || s === 'LITRO' || s === 'L') return 'LT'
  return s
}

export interface EntradaParaAvaliar {
  /** `uCom` — o que a nota declara (imutável) */
  unidadeNota: string | null | undefined
  /** `uTrib` — a unidade tributária da MESMA linha (o desempate) */
  unidadeTributaria?: string | null
  /** o que o dono conferiu; ausente = segue a nota */
  unidadeEntrada?: string | null
  /** a unidade de controle do item de destino */
  unidadeItem: string | null | undefined
  /** o fator declarado na tela (unidade de entrada → unidade do item) */
  fator?: number | null
}

export interface AvaliacaoDaEntrada {
  /** a unidade que vai valer na entrada (normalizada) */
  unidade: string
  /** o dono trocou a unidade em relação à nota? (é o que vira RASTRO) */
  corrigida: boolean
  /** dá pra confirmar esta linha? */
  ok: boolean
  /** ⛔ por que não dá — a frase que a tela mostra em âmbar */
  bloqueio: string | null
  /** ⭐ o que o sistema SUGERE, com o motivo medido (nunca decide sozinho) */
  sugestao: string | null
}

/**
 * A régua da unidade de entrada. PURA.
 *
 * ⚠️ Ela NÃO escolhe por ninguém: devolve `sugestao` quando há evidência no próprio
 * documento, e `bloqueio` quando a combinação escolhida é impossível de provar.
 */
export function avaliarUnidadeDeEntrada(e: EntradaParaAvaliar): AvaliacaoDaEntrada {
  const daNota = normalizarUnidade(e.unidadeNota)
  const trib = normalizarUnidade(e.unidadeTributaria)
  const item = normalizarUnidade(e.unidadeItem)
  const escolhida = e.unidadeEntrada ? normalizarUnidade(e.unidadeEntrada) : daNota
  const corrigida = !!escolhida && !!daNota && escolhida !== daNota

  // ⭐ A SUGESTÃO SAI DA PRÓPRIA NOTA: comercial diverge da tributária, e a tributária é a
  // unidade do item. É o caso do leite em pó — e o motivo vai junto, senão vira palpite
  // com cara de autoridade.
  let sugestao: string | null = null
  if (!e.unidadeEntrada && daNota && trib && daNota !== trib && trib === item) {
    sugestao = `A nota diz ${daNota}, mas a unidade TRIBUTÁRIA da mesma linha é ${trib} — `
      + `e o item de destino é em ${item}. Conferir a entrada como ${trib}?`
  }

  const fator = e.fator ?? null

  // ⛔ REGRA DO DONO: identidade só entre unidades IGUAIS.
  if (escolhida === item) {
    return { unidade: escolhida, corrigida, ok: true, bloqueio: null, sugestao }
  }

  // unidades DIFERENTES: exige fator conhecido e > 0
  if (!fator || fator <= 0) {
    return {
      unidade: escolhida, corrigida, ok: false, sugestao,
      bloqueio: `A entrada está em ${escolhida || '—'} e o item é controlado em ${item || '—'}: `
        + `informe quantos ${item} tem 1 ${escolhida}. Sem esse número não dá pra dar entrada — `
        + `assumir 1 aqui transformaria ${escolhida} em ${item} sem ninguém decidir.`,
    }
  }
  return { unidade: escolhida, corrigida, ok: true, bloqueio: null, sugestao }
}

/**
 * O custo unitário na unidade de ENTRADA — o denominador muda, o valor da nota NUNCA.
 *
 * ⭐ Caso real: R$ 191,88 ÷ 12 latas = **R$ 15,99 por LATA** (não por kg). Se um dia vierem
 * 24 latas nos mesmos 12 "KG" (fator 2), o mesmo total vira R$ 7,995 por lata — o valor da
 * nota é o mesmo, o que muda é por quantas coisas ele se divide.
 *
 * ⚠️ PRECISÃO CHEIA de propósito: quem arredonda é a leitura. Arredondar aqui faria
 * `qtd × custo ≠ vProd` e o CHECK do ledger recusaria a linha (a lição da conclusão de
 * produção e da reunitização do pão).
 */
export function custoNaUnidadeDeEntrada(vUnCom: number, fator: number): number {
  return vUnCom / (fator || 1)
}

/** A frase do rastro — o que fica gravado e aparece quando a nota é reaberta. */
export function rastroDaCorrecao(
  qtdNota: number, unidadeNota: string, qtdEntrada: number, unidadeEntrada: string, quem: string | null,
): string {
  const n = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return `A nota dizia ${n(qtdNota)} ${normalizarUnidade(unidadeNota)}; `
    + `entrada conferida como ${n(qtdEntrada)} ${normalizarUnidade(unidadeEntrada)}${quem ? `, por ${quem}` : ''}.`
}
