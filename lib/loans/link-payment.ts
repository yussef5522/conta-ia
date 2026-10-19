// Sprint Casar Pagamento (04/08/2026) — FASE 4/5: split de um GRUPO de lançamentos
// (débito parcial) contra UMA parcela. Identidade validada nos 3 bancos:
//   PAGO = AMORTIZAÇÃO + JUROS + CORREÇÃO + MORA
// AMORTIZAÇÃO vem do cronograma (determinística, fora do DRE). ENCARGOS = pago −
// amortização (o residual: juros+correção+mora), despesa financeira REAL no DRE.
// Puro — sem DB.

import { validateSchedule, type ScheduleRowForValidation } from './validate-schedule'
import { descriptionMatchesContract } from './contract-core'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const TOL = 0.02

// Palavra-chave de empréstimo — lista candidatos ADICIONÁVEIS quando não há número
// na descrição (Caixa/Banrisul). NÃO pré-seleciona (evita misturar contratos da
// mesma conta).
const LOAN_KW = /empr[eé]stimo|emprestimo|amortizac|liquidac|presta|contrato|financ|parcela|pronampe/i

export interface GroupTx { id: string; description: string; amount: number; date: Date }
export interface BuildLinkGroupInput {
  /** pendentes DEBIT da conta na janela. */
  pend: GroupTx[]
  contractNumber: string | null
  /** tx que originou o clique — SEMPRE pré-selecionada (BUG 1). */
  originTxId?: string
  /** seleção explícita do usuário (toggle). Sem isso, usa o grupo auto. */
  transactionIds?: string[]
  /**
   * ⭐ os contratos CADASTRADOS da empresa — só pra decidir se um número nomeado na
   * descrição é um AUXILIAR da conta garantida (não-cadastrado) ou dinheiro que **tem
   * dono** (cadastrado, e aí segue barrado). Ver `linhasDaContaGarantida`.
   */
  contratosCadastrados?: readonly (string | null)[]
}
export interface LinkGroup {
  candidates: Array<GroupTx & { selected: boolean }>
  selectedIds: string[]
  paidTotal: number
}

/**
 * Monta o grupo do painel de vínculo. Regra:
 *  - AUTO = lançamentos que batem o contrato (Sicredi) + SEMPRE a tx clicada.
 *  - sem número (Caixa/Banrisul): grupo começa só com a tx clicada — NUNCA
 *    auto-agrupa por palavra-chave (misturaria os 2 contratos da mesma conta).
 *  - candidatos exibidos = grupo + demais lançamentos loan-ish (adicionáveis,
 *    não pré-selecionados).
 * Puro — sem DB.
 */
/**
 * ⛔⛔ A DESCRIÇÃO NOMEIA UM CONTRATO QUE NÃO É O MEU?
 *
 * O Sicredi escreve `AMORTIZACAO CONTRATO-C61021766` — o número está ali, e ele diz que
 * aquele dinheiro **tem dono**. Oferecer essa linha no vínculo de OUTRO contrato é convite
 * pra vincular errado, que é a família do caso Cancian (08/09).
 *
 * ⚠️ Sequência de 6+ dígitos serve de "identificador de terceiro" com folga: pega
 * `C61021766` e também o CNPJ do `LIQUIDACAO BOLETO- 00360305000104 CARTOES CAIXA VISA PJ`
 * — que também não é empréstimo nenhum e também tinha que sair.
 */
export function nomeiaOutroContrato(descricao: string, contractNumber: string | null): boolean {
  // sem número no contrato (Caixa/Banrisul), não dá pra afirmar que a linha é de outro
  if (!contractNumber) return false
  // a linha traz ALGUM identificador longo? sem isso, ela não nomeia contrato nenhum
  if (!/\d{6,}/.test(descricao)) return false
  // ⚠️ a pergunta vai pro matcher da casa com a DESCRIÇÃO inteira — ele é quem sabe
  // que `C61021346-2` casa com `…PARCELA-C61021346` (o sufixo do contrato não vai no
  // extrato). Passar só os dígitos soltos furava justamente o caso do dono.
  return !descriptionMatchesContract(descricao, contractNumber)
}

/**
 * ⭐⭐⭐ A CONTA GARANTIDA DO SICREDI — a exceção NOMEADA ao guard do outro contrato
 * (19/10/2026, decisão do dono).
 *
 * **O caso real:** a parcela 25 do `C41022227-1` (venc 15/10) **não tem linha própria no
 * extrato de outubro** — as #23 e #24 têm (`LIQUIDACAO DE PARCELA-C41022227`). O que existe
 * é, em 16/10, o par
 *
 * ```
 * AMORTIZACAO CONTRATO-C61022527   4.257,46
 * LIQUIDACAO  CONTRATO-C61022527   2.798,29      Σ 7.055,75
 * ```
 *
 * `C61022527` **não é contrato cadastrado** e **não tem crédito nenhum na conta**: o Sicredi
 * abre um contrato AUXILIAR, paga a parcela do principal com ele, e raspa a conta pra
 * extingui-lo no mesmo dia — o dinheiro nunca passa pela conta corrente, e é por isso que a
 * linha da parcela não aparece. ⭐ Foi idêntico em julho (6 linhas de `C61021766`, R$ 7.294,40,
 * cobrindo a **#22 do MESMO principal**).
 *
 * ⛔⛔ **O `nomeiaOutroContrato` BARRAVA essas linhas — e ele está CERTO na pergunta dele:**
 * a linha nomeia outro contrato. A exceção não o afrouxa; ela é uma condição adicional, e o
 * guard Cancian continua mordendo todo o resto. **Ela só vale quando as QUATRO coisas valem:**
 *
 *  1. o padrão `(AMORTIZACAO|LIQUIDACAO) CONTRATO-<num>` — ⚠️ **nunca** `LIQUIDACAO DE
 *     PARCELA-<num>`, que é o débito PRÓPRIO de uma parcela;
 *  2. o `<num>` **não casa contrato CADASTRADO nenhum** — se casar, aquele dinheiro **tem
 *     dono** e segue barrado (é a família Cancian, 08/09);
 *  3. **a operação nasce e morre no mesmo dia**: a linha tem ao menos uma IRMÃ do MESMO
 *     auxiliar no MESMO dia (a abertura e o fechamento). ⭐ Isto se ancora no próprio extrato,
 *     sem depender de semente — o painel do empréstimo é aberto da parcela, sem `originTxId`;
 *  4. **mesma conta** — garantido por construção: `pend` já é o DEBIT da conta do contrato.
 *
 * ⚠️ **E ela OFERECE, nunca MARCA.** As linhas entram no universo como adicionáveis (só a
 * semente nasce marcada) — é o dono que aponta, a mesma disciplina do pagamento em lote
 * (09/09): *"nada pré-marcado"*. ⛔ Auxiliar com UMA linha só no dia **não** é oferecido:
 * sem a irmã não há assinatura de operação, e chutar ali é o oposto do guard.
 */
const CONTA_GARANTIDA = /\b(?:amortizacao|liquidacao)\s+contrato-\s*([A-Za-z0-9][A-Za-z0-9./-]{5,})/i

/** o número do contrato AUXILIAR que esta linha nomeia — `null` quando não é o padrão da operação */
export function contratoAuxiliarNaoCadastrado(
  descricao: string,
  contratosCadastrados: readonly (string | null)[],
): string | null {
  const m = CONTA_GARANTIDA.exec(descricao ?? '')
  if (!m) return null
  // ⚠️ a pergunta vai pro matcher da casa com a DESCRIÇÃO inteira — ele é quem sabe que
  // `C61021346-2` casa com `…-C61021346` (o sufixo não vai no extrato). Comparar os dígitos
  // soltos furaria exatamente o caso do dono.
  for (const c of contratosCadastrados) {
    if (descriptionMatchesContract(descricao, c ?? null)) return null
  }
  return m[1]
}

/** ⚠️ por DIA em UTC, nunca por instante — a cicatriz de fuso da casa */
const diaUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/** os ids das linhas que são a operação de crédito automática (abertura + fechamento no mesmo dia) */
export function linhasDaContaGarantida(
  pend: readonly GroupTx[],
  contratosCadastrados: readonly (string | null)[],
): Set<string> {
  const auxDe = new Map<string, string>()
  for (const t of pend) {
    const aux = contratoAuxiliarNaoCadastrado(t.description ?? '', contratosCadastrados)
    if (aux) auxDe.set(t.id, aux)
  }
  const porAuxEDia = new Map<string, number>()
  for (const t of pend) {
    const aux = auxDe.get(t.id)
    if (aux) {
      const k = `${aux}|${diaUTC(t.date)}`
      porAuxEDia.set(k, (porAuxEDia.get(k) ?? 0) + 1)
    }
  }
  const out = new Set<string>()
  for (const t of pend) {
    const aux = auxDe.get(t.id)
    if (aux && (porAuxEDia.get(`${aux}|${diaUTC(t.date)}`) ?? 0) >= 2) out.add(t.id)
  }
  return out
}

export function buildLinkGroup(input: BuildLinkGroupInput): LinkGroup {
  const { pend, contractNumber, originTxId, transactionIds } = input
  const contractHits = contractNumber ? pend.filter((t) => descriptionMatchesContract(t.description, contractNumber)) : []
  const autoIds = new Set(contractHits.map((t) => t.id))
  // ⭐ A SEMENTE SEMPRE ENTRA e sempre marcada: ela é a linha que o dono clicou pra
  // vincular. Grupo que não contém o próprio pagamento não tem como fechar.
  if (originTxId && pend.some((t) => t.id === originTxId)) autoIds.add(originTxId)
  const selectedIds = new Set(transactionIds ?? [...autoIds])

  /**
   * ⛔⛔ O UNIVERSO É DO CONTRATO — não "toda linha com cara de empréstimo".
   *
   * Antes: `… || LOAN_KW.test(t.description)`, e a keyword casa `amortizac|liquidac|
   * presta|contrato|…` em QUALQUER linha. Medido em prod (10/09/2026), o vínculo da
   * parcela #3 do C61021346-2 oferecia **7 linhas, todas de outro contrato** (6 do
   * C61021766, de julho) mais um **pagamento de fatura de cartão**.
   *
   * ⚠️ A keyword NÃO morre: em banco que não escreve o número (Caixa `DEBITO PRESTA
   * SIEMP`, Banrisul `PREV-EMP.BBH`) ela é o único caminho. Ela só deixa de valer quando
   * já achei linha DESTE contrato — aí o número manda — e nunca vale pra linha que
   * nomeia OUTRO contrato.
   */
  // ⚠️ é `contractHits`, NÃO `autoIds`: a semente entrar no grupo não prova que eu achei
  // linha DESTE contrato — e amarrar a régua nela desligaria a keyword no Caixa, que
  // depende dela por não escrever número nenhum na descrição.
  const achouDoContrato = contractHits.length > 0
  // ⭐ a exceção NOMEADA de 19/10 — ver `linhasDaContaGarantida`. Sem `contratosCadastrados`
  // ela não roda (lista vazia ⇒ nenhum auxiliar é "não-cadastrado" com segurança).
  const garantida = input.contratosCadastrados?.length
    ? linhasDaContaGarantida(pend, input.contratosCadastrados)
    : new Set<string>()
  const universe = pend.filter((t) =>
    autoIds.has(t.id)
    || selectedIds.has(t.id)
    || garantida.has(t.id)
    || (!achouDoContrato
        && LOAN_KW.test(t.description ?? '')
        && !nomeiaOutroContrato(t.description ?? '', contractNumber)),
  )
  // ⭐ a semente PRIMEIRO: é a linha que o dono está vinculando, não uma da pilha
  const ordenado = [...universe].sort((a, b) =>
    (b.id === originTxId ? 1 : 0) - (a.id === originTxId ? 1 : 0))
  const selected = universe.filter((t) => selectedIds.has(t.id))
  return {
    candidates: ordenado.map((t) => ({ ...t, selected: selectedIds.has(t.id) })),
    selectedIds: [...selectedIds],
    paidTotal: round2(selected.reduce((s, t) => s + t.amount, 0)),
  }
}

export interface LinkSplitInput {
  installment: { amortization: number; openingBalance: number }
  rateMonthly: number
  /** soma dos lançamentos do grupo. */
  paidTotal: number
}

export interface LinkSplit {
  /** amortização aplicada (do cronograma; = pago se parcial). Fora do DRE. */
  amortization: number
  paidInterest: number
  paidCorrection: number
  paidPenalty: number
  paidTotal: number
  /** juros+correção+mora = despesa financeira no DRE. */
  encargos: number
  closingBalance: number
  /** pago < amortização prevista → parcela PARCIAL, não quita. */
  isPartial: boolean
}

/**
 * ⭐⭐⭐ O TETO DA SOMA — porque o excedente sobre o capital vira DESPESA FINANCEIRA
 * no DRE, e hoje ele não tem limite nenhum (19/10/2026).
 *
 * ⛔⛔ **O furo medido:** `computeLinkSplit` faz `encargos = pago − capital`. Pagar
 * R$ 20.000 numa parcela de capital R$ 4.385,96 cria **R$ 15.614 de "encargo"** que
 * ninguém explica — e ele flui pro resultado como juros.
 *
 * ⚠️ **No pós-fixado NÃO existe "o total" conhecido:** a agenda importada nasce
 * amort-only (juros 0 nas abertas, por desenho — *o juros do mês só se conhece no
 * vencimento*), então o devido só se sabe depois do pagamento. Por isso o teto não pode
 * ser o `payment` da agenda: ele seria o capital, e **toda** parcela POS estouraria.
 *
 * ⭐ A régua é o **juros ESPERADO do mês** — `max(juros da agenda, saldo × taxa)` — com
 * folga pra correção monetária e mora. **A folga saiu do histórico REAL do contrato, não
 * da minha cabeça:**
 *
 * ```
 * #23  encargos 2.949,89  ÷ nominal 2.717,00  = 1,09×
 * #24  encargos 2.517,49  ÷ nominal 2.641,52  = 0,95×
 * #25  encargos 2.669,79  ÷ nominal 2.566,14  = 1,04×
 * ```
 *
 * Com `FOLGA = 2` o caso real passa com **mais de 80% de margem** e o absurdo (6,1×) bate.
 * ⛔ Não é teto apertado de propósito: alarme em desvio de 5% viraria ruído, e *alarme
 * falso repetido é como um alarme morre*.
 *
 * ⚠️ **Taxa 0% (mútuo FLEXIBLE) NÃO tem teto** — pagar R$ 45.000 numa parcela nominal de
 * R$ 41.428,57 é legítimo e documentado desde 06/08; ali todo valor é amortização. E
 * `jurosEsperado <= 0` também devolve `null`: sem saber o juros não dá pra dizer o teto, e
 * inventar um barraria pagamento verdadeiro.
 */
export const FOLGA_DO_TETO = 2

export function tetoDoPagamento(input: {
  /** capital da parcela (do cronograma) */
  amortization: number
  /** juros da AGENDA — 0 nas abertas do pós-fixado */
  interest: number
  openingBalance: number
  rateMonthly: number
}): { teto: number | null; jurosEsperado: number } {
  if (input.rateMonthly === 0) return { teto: null, jurosEsperado: 0 }
  const jurosEsperado = round2(Math.max(input.interest, input.openingBalance * input.rateMonthly))
  if (jurosEsperado <= 0) return { teto: null, jurosEsperado }
  return {
    teto: round2(round2(input.amortization) + jurosEsperado * FOLGA_DO_TETO),
    jurosEsperado,
  }
}

/**
 * ⭐⭐⭐ O QUE BARRA O VÍNCULO — UMA RÉGUA, DUAS PONTAS (19/10/2026)
 *
 * ⛔⛔ **O item 4 do brief é literal: *"preview mostra exatamente o que será gravado (porta
 * única nos dois)"*.** Se a recusa morasse só na PORTA, o painel acenderia o botão, o dono
 * clicaria, e o servidor diria não — *fazer o dono clicar pra levar um «não» é trabalho que
 * dava pra poupar* (a régua do seletor da caixa, 20/09). E se a recusa fosse **reescrita** no
 * preview, as duas divergiriam no primeiro degrau novo: a tela ofereceria um vínculo que a
 * gravação recusa, que é a doença mais caras desta casa (*"preview e confirm discordando"*,
 * 17/08 — custou o import de OFX inteiro).
 *
 * ⚠️ **PURA de propósito:** ela recebe os FATOS (já lidos do banco por quem tem banco) e
 * devolve o veredito. Consultar aqui faria a decisão nascer em dois lugares com duas consultas,
 * e elas divergiriam no primeiro `select` incompleto (a cicatriz do PIX de 7.000).
 *
 * ⛔ **O `TX_INELIGIBLE` fica FORA**, e isso é escolha: ele depende de ler cada transação no
 * banco pra DIZER qual dos três motivos foi (conta errada · já vinculada · é entrada), e o
 * preview só oferece candidatas que já passaram pelo `CANDIDATO_WHERE` — ali ele é
 * inalcançável por construção.
 */
export interface FatosDoVinculo {
  installmentNumber: number
  /** o vínculo 1:1 já existe? (as duas portas são mutuamente exclusivas — o trigger recusa) */
  temVinculo11: boolean
  status: string
  /** quantos pagamentos N:1 JÁ existem, e quanto eles somam */
  jaVinculados: { quantos: number; soma: number }
  /** a Σ de TODOS os vínculos depois deste gesto */
  paidTotal: number
  amortization: number
  /** juros da AGENDA — 0 nas abertas do pós-fixado */
  interest: number
  openingBalance: number
  rateMonthly: number
}

export interface BloqueioDoVinculo {
  code: 'JA_VINCULADA_1_1' | 'JA_QUITADA' | 'SOMA_ESTOUROU'
  mensagem: string
}

export function bloqueioDoVinculo(f: FatosDoVinculo): BloqueioDoVinculo | null {
  if (f.temVinculo11) {
    return {
      code: 'JA_VINCULADA_1_1',
      mensagem: 'Esta parcela já tem vínculo 1:1 — desfaça antes de vincular pelo grupo',
    }
  }

  /**
   * ⛔⛔⛔ PEDAÇO NOVO EM PARCELA JÁ QUITADA POR VÍNCULO = BARRADO.
   *
   * ⚠️ **E a trava é "quitada POR VÍNCULO", não "PAID" seco — de propósito.** Há **180
   * parcelas `PAID` sem vínculo nenhum** (pagas por documento, histórico anterior ao
   * sistema), e a **#22 deste mesmo contrato** é uma delas: a conta garantida de julho a
   * deixou paga sem transação. Barrar `PAID` seco tornaria **impossível** anexar depois a
   * transação verdadeira — e essa correção é justamente uma decisão em aberto do dono.
   */
  if (f.status === 'PAID' && f.jaVinculados.quantos > 0) {
    const ja = round2(f.jaVinculados.soma)
    return {
      code: 'JA_QUITADA',
      mensagem:
        `A parcela ${f.installmentNumber} já está quitada por ${f.jaVinculados.quantos} pagamento(s) somando ${brl(ja)}. `
        + 'Somar outro pedaço aqui viraria encargo que ninguém explica — se algum vínculo está errado, desfaça primeiro.',
    }
  }

  const { teto, jurosEsperado } = tetoDoPagamento(f)
  if (teto != null && round2(f.paidTotal) > teto + 0.02) {
    return {
      code: 'SOMA_ESTOUROU',
      mensagem:
        `A soma dos pedaços (${brl(round2(f.paidTotal))}) passa do teto desta parcela (${brl(teto)} = capital `
        + `${brl(round2(f.amortization))} + ${FOLGA_DO_TETO}× o juros do mês ${brl(jurosEsperado)}). `
        + 'Confira se alguma linha não é desta parcela; se a diferença é mora acima disso, corrija a agenda '
        + 'antes — somar aqui vira despesa financeira que ninguém explica.',
    }
  }

  return null
}

export function computeLinkSplit(input: LinkSplitInput): LinkSplit {
  const amortSched = round2(input.installment.amortization)
  const paidTotal = round2(input.paidTotal)
  const opening = round2(input.installment.openingBalance)

  // Empréstimo SEM JUROS (taxa 0% — mútuo Arafat / FLEXIBLE): NÃO há encargo. Todo
  // valor pago é amortização, independente da parcela nominal. Sem isso, pagar
  // R$ 45.000 numa parcela nominal de R$ 41.428 criaria R$ 3.571 de despesa
  // financeira inexistente. Ver CLAUDE.md (gap Arafat).
  if (input.rateMonthly === 0) {
    return {
      amortization: paidTotal, paidInterest: 0, paidCorrection: 0, paidPenalty: 0,
      paidTotal, encargos: 0, closingBalance: round2(opening - paidTotal), isPartial: false,
    }
  }

  // Parcial: pagou menos que a amortização prevista → tudo vira principal, sem
  // encargos, e a parcela NÃO quita (FASE 4.4).
  if (paidTotal < amortSched - TOL) {
    return {
      amortization: paidTotal, paidInterest: 0, paidCorrection: 0, paidPenalty: 0,
      paidTotal, encargos: 0, closingBalance: round2(opening - paidTotal), isPartial: true,
    }
  }

  const encargos = round2(paidTotal - amortSched)
  // Juros nominais = saldo × taxa; correção+mora = o que sobra dos encargos.
  // Clamp pra ambos >= 0 e soma == encargos (o DRE usa só o total).
  const interest = Math.min(round2(opening * input.rateMonthly), encargos)
  const correcao = round2(encargos - interest)
  return {
    amortization: amortSched, paidInterest: interest, paidCorrection: correcao, paidPenalty: 0,
    paidTotal, encargos, closingBalance: round2(opening - amortSched), isPartial: false,
  }
}

// ── FIX matcher por data (05/08/2026) ──
// Antes o painel casava sempre com a parcela ABERTA mais antiga (openList[0]).
// Em PRICE de parcela fixa o VALOR não distingue nada, então pagamentos
// consecutivos ficavam cada um uma posição atrás. Agora casa pela DATA: a parcela
// cujo dueDate está mais próximo da data do débito.
export interface OpenInstallment { number: number; dueDate: Date; payment: number; status: string }
export interface TargetPick {
  target: OpenInstallment | null
  /** escolheu pela data porque o valor não distinguia (várias parcelas iguais). */
  byDate: boolean
  /** 2+ parcelas abertas com o MESMO valor (o valor não decide). */
  valorAmbiguo: boolean
  /** 2+ parcelas igualmente próximas por data (nem a data decide → perguntar). */
  dateAmbiguo: boolean
  /** parcelas abertas ordenadas por proximidade de data (pro usuário escolher). */
  alternatives: OpenInstallment[]
}

export function pickTargetInstallment(
  openList: OpenInstallment[],
  originDate: Date | null,
  originAmount: number | null,
): TargetPick {
  if (openList.length === 0) return { target: null, byDate: false, valorAmbiguo: false, dateAmbiguo: false, alternatives: [] }
  if (!originDate) return { target: openList[0], byDate: false, valorAmbiguo: false, dateAmbiguo: false, alternatives: openList }

  // Tolerância APERTADA (0,5%): parcela decrescente de SAC com valores distintos
  // é distinguida pelo VALOR; só PRICE fixo (ou SAC muito próximo) fica ambíguo.
  const tol = originAmount ? Math.max(1, originAmount * 0.005) : 1
  const valueMatches = originAmount != null ? openList.filter((i) => Math.abs(i.payment - originAmount) <= tol) : []
  const valorAmbiguo = valueMatches.length > 1
  // Se o valor distingue UMA parcela, usa ela. Senão (ambíguo ou nenhum bate),
  // escolhe a mais próxima por DATA entre as candidatas.
  const candidates = valueMatches.length > 0 ? valueMatches : openList

  const dist = (i: OpenInstallment) => Math.abs(i.dueDate.getTime() - originDate.getTime())
  const sorted = [...candidates].sort((a, b) => dist(a) - dist(b))
  const target = sorted[0]
  const dateAmbiguo = valorAmbiguo && sorted.length > 1 && dist(sorted[0]) === dist(sorted[1])
  return { target, byDate: valorAmbiguo, valorAmbiguo, dateAmbiguo, alternatives: [...openList].sort((a, b) => dist(a) - dist(b)) }
}

/**
 * A agenda ARMAZENADA do empréstimo (faixa rastreada) fecha? Decide se o split
 * flui pro DRE (FASE 5.3): agenda inválida → vincula mas não injeta split.
 */
/**
 * Decide se o SPLIT (juros/correção) é gravado ao vincular. FASE 5.3 travava por
 * `agendaValida` (a agenda inteira fecha) — mas o split só precisa do AMORT da
 * parcela, e em agenda IMPORTED o amort vem do PDF do banco (autoritativo). A
 * `validateSchedule` reprova a agenda quando as OPEN têm juros=0 (POS /
 * PRE-importado sem juros nas futuras), o que fazia TODA parcela POS casada pela
 * tela nascer com `paidInterest=0` (juros escondido do DRE — bug da #2 e da #23).
 * IMPORTED confia no amort; FÓRMULA mantém a trava. Função pura (dono único do
 * confirm e do preview de vincular-parcela).
 */
export function shouldWriteSplit(opts: {
  scheduleSource: string | null
  isZeroRate: boolean
  agendaValida: boolean
  isPartial: boolean
}): boolean {
  if (opts.isZeroRate) return true // 0% (Arafat): split determinístico
  if (opts.isPartial) return false // parcial não quita → não grava split
  return opts.scheduleSource === 'IMPORTED' || opts.agendaValida
}

export function storedScheduleValid(
  trackedInstallments: ScheduleRowForValidation[],
  base: number,
  ratePositive: boolean,
  isPostFixed: boolean,
): boolean {
  if (trackedInstallments.length === 0) return false
  return validateSchedule({ rows: trackedInstallments, base, ratePositive, isPostFixed }).ok
}
