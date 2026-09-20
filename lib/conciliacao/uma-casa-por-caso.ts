// ⭐⭐⭐ UMA PERGUNTA, UMA CASA (20/09/2026) — a régua de apresentação do dono.
//
// **O que ele viu, com o print na mão:** *"a linha FRANCIELE está na caixa COM palpite e
// botão E o card dela está no PRA TUA MÃO com [Vincular] nas duas linhas + o aviso de
// ambiguidade."*
//
// ⛔⛔⛔ **E A MINHA 1ª ENTREGA MEDIU "NENHUM PAR COM BOTÃO NAS DUAS" — porque eu olhei a
// superfície errada.** A página faz **QUATRO** chamadas (`/caixa`, `/fila`,
// `/escolher-na-mao`, `/corte`) e eu tinha ligado a régua em **duas**. Quem desenha os
// `[Vincular]` do *"pra tua mão"* é a **`/fila`** (`contasEsperandoPagamento`), que ficou de
// fora. ***Guard que roda contra as rotas separadas aprova o que o dono não vê.***
//
// ⛔⛔ **E HAVIA DUAS DEFINIÇÕES DE "CASO", o que ele apontou antes de mim:**
//   • a **fila** conta as candidatas da conta **incluindo as já categorizadas** (a régua de
//     07/09: *ter categoria não quita conta nenhuma*) → franciele tem **2** → caso existe;
//   • a minha `dividirPorCasa` contava só linhas **na caixa** → franciele tem **1** → 1↔1.
// Cada lado achava que era o dono, e **os dois desenhavam botão**.
//
// ⭐ **A DEFINIÇÃO ÚNICA, e ela é a da fila** (decisão do dono: *"se a Tiele-categorizada
// mantém o caso vivo, então o caso EXISTE e a linha da caixa vira PONTEIRO"*):
//
//   ***CASO = conta com 2+ linhas sugeridas pelo MESMO motor que desenha os [Vincular].***
//
// ⚠️ Medido em prod: a fila oferece **2** linhas pra «franciele» (a de 15/09 com score 95 e
// a Tiele de 08/09, categorizada, com 55). Não são as 8 candidatas cruas de valor+data —
// é a lista que o sistema **oferece**, que é a que produz botão.

/** ⭐ o que a FILA oferece: a conta e as linhas que ela sugere (a fonte dos `[Vincular]`) */
export interface SugestaoDaConta {
  contaId: string
  nomeDaConta: string
  linhaIds: string[]
}

/** ⭐ o que a CAIXA acende: a linha e as contas que o palpite dela aponta */
export interface PalpiteDaLinha {
  linhaId: string
  contaIds: string[]
  /** o nome do caso quando ele vai pro card (o fornecedor/conta, em geral) */
  nomeDoCaso: string
}

/**
 * ⭐⭐⭐ **TRÊS CASAS, NÃO DUAS** — e o guard da página montada é que mostrou.
 *
 * A 1ª versão mandava o ambíguo pro `CARD` e **a FILA continuava desenhando o `ParSugerido`
 * com os dois `[Vincular]`** — eram duas superfícies de novo, agora as duas do lado "pra
 * tua mão". É justamente o que o dono descreveu no print: *"o card dela está no PRA TUA MÃO
 * com [Vincular] nas duas linhas + o aviso de ambiguidade"*.
 *
 * ⭐ O **AMBÍGUO mora na FILA** (é lá que as N linhas aparecem lado a lado com o aviso);
 * o **CARD** é do que a fila não resolve — o lote N:M e quem veio pela porta.
 */
export type Casa = 'CAIXA' | 'FILA' | 'CARD'
export type MotivoDoCard = 'AMBIGUO' | 'N_PARA_M'

export interface CasoDaLinha {
  casa: Casa
  motivo?: MotivoDoCard
  nomeDoCaso?: string
  ancora?: string
  /** a conta do caso — é ela que reúne as N candidatas */
  contaDoCaso?: string
  /** ⭐ esta linha HOSPEDA o painel do caso? (só uma hospeda; as outras apontam) */
  hospeda?: boolean
}

export interface Divisao {
  /** por linha da caixa: quem é o dono da decisão */
  linhas: Map<string, CasoDaLinha>
  /**
   * ⭐⭐ O CASO INTEIRO, por conta — pra ele ser **renderizado DENTRO do cartão ≍** em vez
   * de virar seção separada (régua do dono, 20/09: *"uma decisão aparece UMA vez na página,
   * SEMPRE no mesmo modelo visual"*).
   */
  casos: Map<string, SugestaoDaConta>
  /**
   * ⭐ qual linha de cada caso **hospeda** o painel. As outras dizem "parte do caso acima".
   * ⛔ Sem isso, um caso com 2 linhas na caixa renderizaria o mesmo painel duas vezes —
   * a duplicação de novo, agora dentro do modelo certo.
   */
  anfitriaDoCaso: Map<string, string>
  /**
   * ⭐ as contas cujo caso mora na CAIXA — a fila **não pode** desenhar botão pra elas.
   *
   * ⛔ São DUAS famílias: o **1↔1** (o palpite resolve na própria linha) e o **ambíguo
   * HOSPEDADO** (o painel do caso renderiza dentro do cartão ≍ da linha anfitriã). O que
   * sobra pra fila é o caso **sem nenhuma linha na caixa** — que, sem ela, ficaria invisível.
   */
  contasQueMoramNaCaixa: Set<string>
}

/** ⭐ as âncoras — um lugar só, senão os dois lados escrevem ids diferentes */
export const ancoraDoCard = (linhaId: string) => `card-${linhaId}`
/** ⭐ o par da FILA é ancorado pela CONTA: é ela que reúne as N linhas do caso */
export const ancoraDoPar = (contaId: string) => `par-${contaId}`

/**
 * ⭐⭐ A DIVISÃO — pura, e é a MESMA função que as TRÊS superfícies consultam.
 *
 * ⛔ Uma régua por rota é o defeito que este arquivo existe pra matar: elas divergiram no
 * primeiro caso de borda (franciele) e o dono viu botão nos dois lados.
 */
export function dividir(entrada: {
  sugestoesPorConta: readonly SugestaoDaConta[]
  palpites: readonly PalpiteDaLinha[]
}): Divisao {
  const porConta = new Map(entrada.sugestoesPorConta.map((s) => [s.contaId, s]))
  const linhas = new Map<string, CasoDaLinha>()
  const contasQueMoramNaCaixa = new Set<string>()
  const casos = new Map<string, SugestaoDaConta>()
  const anfitriaDoCaso = new Map<string, string>()

  for (const p of entrada.palpites) {
    if (!p.contaIds.length) { linhas.set(p.linhaId, { casa: 'CAIXA' }); continue }
    // ⛔ o palpite traz várias contas: a decisão é de LOTE, e lote se resolve no card
    if (p.contaIds.length > 1) {
      linhas.set(p.linhaId, { casa: 'CARD', motivo: 'N_PARA_M', nomeDoCaso: p.nomeDoCaso, ancora: ancoraDoCard(p.linhaId) })
      continue
    }
    const contaId = p.contaIds[0]
    const s = porConta.get(contaId)
    // ⭐⭐ O CASO É DA FILA: 2+ linhas oferecidas pra mesma conta → a caixa só APONTA
    if (s && s.linhaIds.length > 1) {
      casos.set(contaId, s)
      // ⭐ a PRIMEIRA linha do caso que aparece hospeda o painel; as outras apontam pra ela
      if (!anfitriaDoCaso.has(contaId)) anfitriaDoCaso.set(contaId, p.linhaId)
      /**
       * ⭐⭐⭐ O CASO HOSPEDADO **SAI DA FILA** (20/09) — ele passou a morar DENTRO do
       * cartão ≍ daquela linha. ⛔ Sem isto, a mesma decisão apareceria no cartão **e** na
       * seção de baixo: foi exatamente o que o dono viu, *"a mesma coisa duas vezes, em
       * dois MODELOS visuais diferentes"*.
       */
      contasQueMoramNaCaixa.add(contaId)
      linhas.set(p.linhaId, {
        casa: 'FILA', motivo: 'AMBIGUO',
        nomeDoCaso: s.nomeDaConta || p.nomeDoCaso,
        ancora: ancoraDoPar(contaId),
        contaDoCaso: contaId,
        hospeda: anfitriaDoCaso.get(contaId) === p.linhaId,
      })
      continue
    }
    /**
     * ⭐ 1↔1: a CAIXA é a dona — e a fila tem que ESCONDER esta conta.
     *
     * ⚠️ Só reivindicamos a conta quando a fila de fato a oferece **pra esta linha**. Se ela
     * oferecesse outra, esconder faria o par sumir das DUAS superfícies — *e some dos dois é
     * pior que aparecer nos dois*.
     */
    linhas.set(p.linhaId, { casa: 'CAIXA' })
    if (s && s.linhaIds.length === 1 && s.linhaIds[0] === p.linhaId) contasQueMoramNaCaixa.add(contaId)
  }
  return { linhas, contasQueMoramNaCaixa, casos, anfitriaDoCaso }
}

/**
 * ⭐⭐ QUEM DESENHA BOTÃO — as três perguntas, num lugar só.
 *
 * ⚠️⚠️ **ISTO NASCEU DE UM FURO DO MEU PRÓPRIO GUARD** (REGRA 11): o predicado do card
 * morava num `filter` dentro da rota, e o teste derivava o card da `casa` — então **repor o
 * defeito na rota passava verde**. *Guard que reimplementa a régua não testa a régua.*
 */
export const aCaixaDesenhaBotao = (c: CasoDaLinha | undefined, temAlvo: boolean) =>
  temAlvo && (c?.casa ?? 'CAIXA') === 'CAIXA'

export const aFilaDesenhaBotao = (contaId: string, d: Divisao) => !d.contasQueMoramNaCaixa.has(contaId)

/**
 * ⛔ CAIXA e FILA já são donas do caso — o card só desenha o que sobra (lote N:M).
 *
 * ⛔⛔⛔ **O `?? 'CAIXA'` ESCONDEU O CASPER** (achado pelo dono em 20/09): a linha dele
 * **não está na caixa** (é de 04/09, já categorizada), então a divisão **não a conhece** —
 * e o default tratava "desconhecida" como *"a caixa é dona"*. Resultado: o card sumiu e o
 * caso ficou **invisível na página inteira**. ***É o "some dos dois" que esta própria régua
 * proíbe, cometido pelo default dela.***
 *
 * ⭐ O default seguro é **APARECER**: quem a divisão não conhece não foi reivindicado por
 * ninguém, então o card desenha. *Duplicar é feio; sumir é perder trabalho.*
 */
export const oCardDesenhaBotao = (c: CasoDaLinha | undefined, veioPelaPorta: boolean) =>
  veioPelaPorta || !c || !['CAIXA', 'FILA'].includes(c.casa)

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
// lançado como despesa avulsa — que é o buraco que produz **dupla contagem**. ⭐⭐ E é ela
// que **mantém o caso vivo**: por isso a linha da caixa vira ponteiro em vez de ter botão.
//
// ⚠️⚠️ **MAS A CONSEQUÊNCIA QUE O DONO ESCREVEU PRECISA DE UMA CORREÇÃO, E ELA É MEDIDA:**
// vincular **NÃO desfaz** a categoria. O backfill é **cooperativo** (só preenche o que está
// `null`), então a Tiele continuaria "Salários". O que muda é outra coisa, e é o que importa:
// a conta **deixa de estar em aberto** e aquela linha passa a ser **o pagamento dela**.

export interface ConsequenciaDeVincular {
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
