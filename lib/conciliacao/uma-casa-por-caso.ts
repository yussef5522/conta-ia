// ⭐⭐⭐ UMA PERGUNTA, UMA CASA (20/09/2026) — a régua de apresentação do dono.
//
// **O que ele viu:** *"a linha FRANCIELE está na caixa COM palpite e o MESMO par aparece
// embaixo como card no PRA TUA MÃO (com botões próprios)."*
//
// ⛔⛔ **A CAUSA É ESTRUTURAL: as duas superfícies decidem sozinhas.** A caixa monta os
// palpites; o card monta a escolha manual; **nenhuma das duas sabe da outra**. Duas telas
// com botão pro MESMO par é a família do caso Cancian (08/09), em que a nota errada foi
// vinculada porque dois cards ficaram quase idênticos — *o desenho certo é nem criar a
// disputa visual*.
//
// ⭐ **A DIVISÃO:**
//   **1↔1 com palpite aceso** → mora **SÓ na linha da caixa** (o card não repete).
//   **AMBÍGUO** (2+ linhas da caixa disputando a MESMA conta) → mora **SÓ no card**, e a
//     linha na caixa perde o botão e ganha *"faz parte do caso «X» → resolver lá"*.
//   **N:M** (o palpite traz 2+ contas — lote) → idem: a decisão é do card.
//
// ⚠️⚠️ **A AMBIGUIDADE É MEDIDA SOBRE QUEM ESTÁ NA CAIXA, e isso foi escolha, não descuido.**
// A conta «franciele» tem **8 linhas candidatas** por valor+data (medido em prod) — se
// "2+ candidatas" bastasse pra chamar de ambíguo, **toda** conta viraria caso de card e o
// palpite nunca mais teria botão. O que produz duas telas brigando é duas linhas **em
// aberto** reivindicando a mesma conta; candidata que já foi resolvida não disputa nada.

/** o que a régua precisa saber de cada linha da caixa */
export interface LinhaComAlvo {
  linhaId: string
  /** as contas a pagar que o palpite dela aponta (vazio = sem palpite) */
  contaIds: string[]
  /** o nome que o caso leva quando ele vai pro card (fornecedor, em geral) */
  nomeDoCaso: string
}

export type Casa = 'CAIXA' | 'CARD'
export type MotivoDoCard = 'AMBIGUO' | 'N_PARA_M'

export interface CasoDaLinha {
  casa: Casa
  motivo?: MotivoDoCard
  /** ⭐ o nome que a linha da caixa imprime ao apontar pro card */
  nomeDoCaso?: string
  /** ⭐ a âncora — a linha aponta pro card, em vez de mandar o dono procurar */
  ancora?: string
}

/** ⭐ a âncora do card daquela linha — um lugar só, senão os dois lados escrevem ids diferentes */
export const ancoraDoCard = (linhaId: string) => `card-${linhaId}`

/**
 * ⭐⭐ A DIVISÃO — pura, e é a MESMA função que a caixa e os cards consultam.
 *
 * ⛔ Uma régua em cada rota seria o defeito de novo, com outra roupa: elas divergiriam no
 * primeiro caso de borda e voltaríamos a ter duas telas com botão pro mesmo par.
 */
export function dividirPorCasa(linhas: readonly LinhaComAlvo[]): Map<string, CasoDaLinha> {
  /** quantas linhas EM ABERTO reivindicam cada conta */
  const disputas = new Map<string, string[]>()
  for (const l of linhas)
    for (const c of l.contaIds) disputas.set(c, [...(disputas.get(c) ?? []), l.linhaId])

  const out = new Map<string, CasoDaLinha>()
  for (const l of linhas) {
    if (!l.contaIds.length) { out.set(l.linhaId, { casa: 'CAIXA' }); continue }
    // ⛔ o palpite traz várias contas: a decisão é de LOTE, e lote se resolve no card
    if (l.contaIds.length > 1) {
      out.set(l.linhaId, { casa: 'CARD', motivo: 'N_PARA_M', nomeDoCaso: l.nomeDoCaso, ancora: ancoraDoCard(l.linhaId) })
      continue
    }
    const disputantes = disputas.get(l.contaIds[0]) ?? []
    out.set(l.linhaId, disputantes.length > 1
      // ⛔ duas linhas pra mesma conta: **só uma pode ser**, e quem escolhe é o card
      ? { casa: 'CARD', motivo: 'AMBIGUO', nomeDoCaso: l.nomeDoCaso, ancora: ancoraDoCard(l.linhaId) }
      : { casa: 'CAIXA' })
  }
  return out
}

/** ⭐ a frase que a linha da caixa imprime quando o caso mora no card */
export function fraseDoCasoNoCard(c: CasoDaLinha): string {
  const porque = c.motivo === 'AMBIGUO'
    ? 'mais de uma linha pode ser o pagamento desta conta'
    : 'este pagamento cobre mais de uma nota'
  return `faz parte do caso «${c.nomeDoCaso}» — ${porque}. Resolver lá →`
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐ A CANDIDATA QUE JÁ FOI CATEGORIZADA — a pergunta do dono, respondida com o efeito
// ═══════════════════════════════════════════════════════════════════════════════
//
// **Ele perguntou:** *"a linha da Tiele de 08/09 JÁ está resolvida como Salários (avulsa) —
// ela ainda deve ser oferecida como candidata da conta franciele?"*
//
// ⭐ **SIM, e a régua da casa já dizia isso desde 07/09:** *"ter categoria não quita conta
// nenhuma"*. Tirá-la da lista esconderia justamente o caso em que o pagamento verdadeiro foi
// lançado como despesa avulsa — que é o buraco que produz **dupla contagem**.
//
// ⚠️⚠️ **MAS A CONSEQUÊNCIA QUE O DONO ESCREVEU PRECISA DE UMA CORREÇÃO, E ELA É MEDIDA:**
// vincular **NÃO desfaz** a categoria. O backfill é **cooperativo** (só preenche o que está
// `null`), então a Tiele continuaria "Salários". O que muda é outra coisa, e é o que importa:
// a conta **deixa de estar em aberto** e aquela linha passa a ser **o pagamento dela** — a
// despesa para de existir em dois lugares.

export interface ConsequenciaDeVincular {
  /** a linha já tem categoria? (então o aviso é obrigatório) */
  precisaAvisar: boolean
  texto: string
}

export function consequenciaDeVincular(
  categoriaDaLinha: string | null,
  nomeDaConta: string,
): ConsequenciaDeVincular {
  if (!categoriaDaLinha) {
    return { precisaAvisar: false, texto: `vira o pagamento de «${nomeDaConta}»` }
  }
  return {
    precisaAvisar: true,
    texto: `já categorizada como ${categoriaDaLinha} — vincular aqui faz ela virar o pagamento de `
      + `«${nomeDaConta}» (a conta sai do "em aberto"; a categoria dela fica)`,
  }
}
