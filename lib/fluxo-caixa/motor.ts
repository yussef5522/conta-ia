// FLUXO DE CAIXA — DINHEIRO VIVO (25/08). A pergunta de dono: entrou X, paguei Y, sobrou Z.
//
// ⚠️ NÃO É O DRE. O DRE é COMPETÊNCIA (quando o fato aconteceu); isto é CAIXA (quando o
// dinheiro entrou ou saiu da conta). As duas visões discordam de propósito e a diferença
// mais visível é o cartão:
//   · DRE     → a despesa é a COMPRA no cartão, no mês da compra.
//   · CAIXA   → a saída é o PAGAMENTO DA FATURA, no dia em que o banco debitou.
// Somar os dois contaria a mesma despesa duas vezes. Aqui vale o caixa, sempre.
//
// ⚠️ REGRA 4 — este é o ÚNICO lugar que decide o que é dinheiro entrando/saindo. O
// relatório `/relatorios/fluxo-caixa` (barras realizado × previsto) passou a chamar o
// MESMO `whereFluxoCaixa`: duas telas que somam o mesmo número com filtros diferentes
// divergem, e foi assim que a `/parear` dizia "nenhum par" com o banner mostrando 99%.

import type { Prisma } from '@prisma/client'

/** ⭐ Marco de fechamento do dado financeiro (CLAUDE.md: "AGOSTO/2026 É O MARCO DE
 *  REFERÊNCIA DA CAÇULA" — saldos conferidos, 0 buraco de período). Mês anterior a
 *  isto tem erro conhecido: aparece no gráfico, mas MARCADO. Nunca some. */
export const MARCO_FECHADO = '2026-08'

// Rótulos SINTÉTICOS: o banco não categoriza estas duas famílias, mas o sistema sabe o
// que elas são por ESTRUTURA (flag de fatura, vínculo de parcela). Jogá-las em
// "A CLASSIFICAR" seria esconder R$ 43 mil de agosto atrás de um rótulo de erro.
export const CAT_FATURA = 'Fatura de cartão (paga)'
export const CAT_PARCELA = 'Parcela de empréstimo'
export const CAT_SEM = 'A CLASSIFICAR'

// ⭐ ENTRADAS QUE NÃO SÃO ENTRADA (26/08, regra do dono, vale pra sempre):
// "ENTROU = só o que realmente entrou DE VENDA (+ outras receitas reais). Dinheiro de
// empréstimo não é venda, não é receita — é DÍVIDA entrando."
// Elas aparecem numa linha PRÓPRIA, informativa, FORA da soma — mesmo tratamento das
// transferências internas: visível, excluído, explicado. Somar 100 mil de empréstimo no
// "entrou" de junho faria o mês parecer o melhor do ano por causa de uma dívida.
export const CAT_LIBERACAO = 'Liberação de empréstimo'
export const CAT_APORTE = 'Aporte de capital'
/** dreGroup do aporte de sócio — dinheiro que entra e NÃO é receita. */
export const DRE_APORTE = 'APORTES_CAPITAL'

export interface LinhaFluxo {
  id: string
  date: Date
  amount: number
  type: string
  categoriaNome: string | null
  isCardPayment: boolean
  /** vínculo com parcela de empréstimo por QUALQUER das 2 portas (1:1 ou N:1) */
  ehParcelaEmprestimo: boolean
  /** esta tx É a liberação de um empréstimo (vínculo ESTRUTURAL, não categoria) */
  ehLiberacaoEmprestimo: boolean
  dreGroup: string | null
  contaNome: string
  descricao: string
}

export interface Lancamento {
  id: string
  data: string
  conta: string
  descricao: string
  valor: number
}

export interface GrupoCategoria {
  rotulo: string
  total: number
  n: number
  /** true quando o rótulo veio da estrutura, não de uma Category do banco */
  sintetico: boolean
  lancamentos: Lancamento[]
}

export interface ResultadoFluxo {
  entrou: number
  saiu: number
  resultado: number
  entradas: GrupoCategoria[]
  saidas: GrupoCategoria[]
  aClassificar: { n: number; entrada: number; saida: number }
  /** dinheiro que ENTROU na conta mas NÃO é receita — visível, fora da soma */
  informativas: GrupoCategoria[]
  /** soma das informativas (só pra tela dizer o tamanho do que ficou de fora) */
  totalInformativo: number
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * O WHERE do dinheiro vivo. Todas as regras de honestidade moram aqui — uma vez.
 *
 * ⚠️ `isCardPayment` é INCLUÍDO (é dinheiro saindo do banco) e a COMPRA no cartão é
 * EXCLUÍDA. Auditado em prod (25/08): toda tx com `businessCreditCardId` E conta
 * bancária é pagamento de fatura (7 de 7); a compra nasce com `bankAccountId` null.
 * O `OR` cobre o caso de uma compra ganhar conta por engano — não conta como saída.
 */
export function whereFluxoCaixa(
  companyId: string,
  periodo: { de: Date; ate: Date },
): Prisma.TransactionWhereInput {
  if (!companyId) throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  if (periodo.de.getTime() > periodo.ate.getTime()) throw new Error('período invertido')

  return {
    bankAccount: { companyId },
    // 1) transferência entre contas PRÓPRIAS não é entrada nem saída — as 3 marcas
    //    que o sistema usa pra isso (o par TRANSFER, a categoria de transferência, o
    //    par entre CNPJs do grupo) + a tx marcada "aguardando par".
    type: { not: 'TRANSFER' },
    isInternalTransfer: false,
    pendingTransfer: false,
    NOT: { category: { dreGroup: 'TRANSFERENCIA' } },
    // 2) só o que REALMENTE saiu/entrou: conta a pagar em aberto não é caixa.
    lifecycle: 'EFFECTED',
    // 3) anti-dupla-contagem: a PAYABLE conciliada com a OFX aponta pra ela; a OFX
    //    (o lado real) entra, a conciliada não.
    reconciledWithId: null,
    // 4) cartão: entra o PAGAMENTO da fatura, sai a COMPRA (competência, não caixa).
    OR: [{ businessCreditCardId: null }, { isCardPayment: true }],
    date: { gte: periodo.de, lte: periodo.ate },
  }
}

/** O `select` que o motor precisa. Fica junto do where pra não nascer um caller que
 *  esquece o vínculo de empréstimo e joga 4 parcelas em "A CLASSIFICAR". */
export const SELECT_FLUXO = {
  id: true,
  date: true,
  amount: true,
  type: true,
  description: true,
  isCardPayment: true,
  category: { select: { name: true, dreGroup: true } },
  bankAccount: { select: { name: true } },
  // ⚠️ MARCADOR ESTRUTURAL, não categoria: `Loan.disbursementTransactionId` é a
  // MESMA fonte que o DRE usa pra não tratar liberação como receita. Categoria é
  // decisão do dono e pode estar errada (a do C61021346 estava em "Aporte de
  // Capital"); o vínculo com o contrato não mente.
  loanDisbursement: { select: { id: true } },
  // ⚠️ AS DUAS PORTAS. Checar só `loanInstallmentPaid` foi o bug documentado no
  // CLAUDE.md (14/08): "linked" tem 1:1 E N:1, e na Cacula as 4 parcelas de agosto
  // estão TODAS pela porta N:1 — só a primeira porta acharia zero.
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true }, take: 1 },
} as const

/** Converte a linha crua do Prisma pro formato do motor. */
export function paraLinha(t: {
  id: string; date: Date; amount: number; type: string; description: string
  isCardPayment: boolean
  category: { name: string; dreGroup: string | null } | null
  bankAccount: { name: string } | null
  loanInstallmentPaid: { id: string } | null
  loanInstallmentPayments: { id: string }[]
  loanDisbursement?: { id: string } | null
}): LinhaFluxo {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    type: t.type,
    categoriaNome: t.category?.name ?? null,
    isCardPayment: t.isCardPayment,
    ehParcelaEmprestimo: !!t.loanInstallmentPaid || t.loanInstallmentPayments.length > 0,
    ehLiberacaoEmprestimo: !!t.loanDisbursement,
    dreGroup: t.category?.dreGroup ?? null,
    contaNome: t.bankAccount?.name?.trim() || '(sem conta)',
    descricao: t.description,
  }
}

/**
 * O rótulo da linha. A categoria do dono manda; os dois sintéticos entram só quando
 * ela não existe — categorizar é decisão do dono e o sistema não sobrescreve.
 */
export function rotularLinha(l: LinhaFluxo): { rotulo: string; sintetico: boolean } {
  if (l.categoriaNome) return { rotulo: l.categoriaNome, sintetico: false }
  if (l.isCardPayment) return { rotulo: CAT_FATURA, sintetico: true }
  if (l.ehParcelaEmprestimo) return { rotulo: CAT_PARCELA, sintetico: true }
  return { rotulo: CAT_SEM, sintetico: true }
}

/**
 * Uma ENTRADA de dinheiro que NÃO é receita? Devolve o rótulo informativo; null = é
 * entrada de verdade e soma no ENTROU.
 *
 * ⚠️ ORDEM IMPORTA: o vínculo ESTRUTURAL com o contrato vem primeiro. A liberação do
 * C61021346 estava categorizada como "Aporte de Capital" — se a categoria mandasse, a
 * tela chamaria uma DÍVIDA de aporte de sócio. O vínculo com o Loan não mente.
 */
export function entradaInformativa(l: LinhaFluxo): string | null {
  if (l.type !== 'CREDIT') return null
  if (l.ehLiberacaoEmprestimo) return CAT_LIBERACAO
  if (l.dreGroup === DRE_APORTE) return CAT_APORTE
  return null
}

/**
 * Agrupa por categoria, dos dois lados, com os lançamentos que compõem cada linha.
 *
 * INVARIANTE (travado em teste): Σ entradas == entrou e Σ saídas == saiu — inclusive o
 * balde "A CLASSIFICAR". Se um rótulo sintético novo nascer e alguém esquecer de somá-lo,
 * o teste quebra ANTES de a tela mostrar um total que não fecha com as suas partes.
 */
export function agruparFluxo(linhas: LinhaFluxo[]): ResultadoFluxo {
  const ent = new Map<string, GrupoCategoria>()
  const sai = new Map<string, GrupoCategoria>()
  const info = new Map<string, GrupoCategoria>()
  let entrou = 0
  let saiu = 0
  let totalInformativo = 0
  const aClassificar = { n: 0, entrada: 0, saida: 0 }

  for (const l of linhas) {
    const credito = l.type === 'CREDIT'
    const debito = l.type === 'DEBIT'
    if (!credito && !debito) continue // TRANSFER já saiu no where; defesa em profundidade

    // ⭐ entrada que não é receita: sai da soma, NÃO some da tela.
    const rotuloInfo = entradaInformativa(l)
    if (rotuloInfo) {
      const g = info.get(rotuloInfo) ?? { rotulo: rotuloInfo, total: 0, n: 0, sintetico: true, lancamentos: [] }
      g.total = round2(g.total + l.amount)
      g.n++
      g.lancamentos.push({ id: l.id, data: iso(l.date), conta: l.contaNome, descricao: l.descricao, valor: round2(l.amount) })
      info.set(rotuloInfo, g)
      totalInformativo = round2(totalInformativo + l.amount)
      continue
    }

    const { rotulo, sintetico } = rotularLinha(l)
    const alvo = credito ? ent : sai
    const g = alvo.get(rotulo) ?? { rotulo, total: 0, n: 0, sintetico, lancamentos: [] }
    g.total = round2(g.total + l.amount)
    g.n++
    g.lancamentos.push({
      id: l.id, data: iso(l.date), conta: l.contaNome, descricao: l.descricao, valor: round2(l.amount),
    })
    alvo.set(rotulo, g)

    if (credito) entrou += l.amount
    else saiu += l.amount

    if (rotulo === CAT_SEM) {
      aClassificar.n++
      if (credito) aClassificar.entrada = round2(aClassificar.entrada + l.amount)
      else aClassificar.saida = round2(aClassificar.saida + l.amount)
    }
  }

  const ordenar = (m: Map<string, GrupoCategoria>) =>
    [...m.values()]
      .map((g) => ({ ...g, lancamentos: g.lancamentos.sort((a, b) => a.data.localeCompare(b.data)) }))
      .sort((a, b) => b.total - a.total)

  entrou = round2(entrou)
  saiu = round2(saiu)
  return {
    entrou, saiu, resultado: round2(entrou - saiu),
    entradas: ordenar(ent), saidas: ordenar(sai), aClassificar,
    informativas: ordenar(info), totalInformativo,
  }
}

export interface MesSerie {
  mes: string // YYYY-MM
  entrou: number
  saiu: number
  resultado: number
  /** false = não dá pra confiar no total do mês; `motivo` diz por quê */
  completo: boolean
  motivo: string | null
}

/**
 * Série mensal pro gráfico. Mês NUNCA aparece sem dizer se é confiável:
 *  · o mês corrente está EM ANDAMENTO (ainda vai entrar e sair dinheiro);
 *  · mês anterior ao marco de agosto/2026 tem erro conhecido de período.
 */
export function serieMensal(linhas: LinhaFluxo[], meses: string[], hoje: Date): MesSerie[] {
  const porMes = new Map<string, { e: number; s: number }>()
  for (const l of linhas) {
    // o gráfico usa a MESMA regra dos cards: liberação/aporte não é "entrou".
    // Sem isto, junho apareceria como o melhor mês do ano por causa de uma dívida.
    if (entradaInformativa(l)) continue
    const k = iso(l.date).slice(0, 7)
    const a = porMes.get(k) ?? { e: 0, s: 0 }
    if (l.type === 'CREDIT') a.e += l.amount
    else if (l.type === 'DEBIT') a.s += l.amount
    porMes.set(k, a)
  }
  const mesAtual = iso(hoje).slice(0, 7)
  return meses.map((m) => {
    const a = porMes.get(m) ?? { e: 0, s: 0 }
    const emAndamento = m === mesAtual
    const preMarco = m < MARCO_FECHADO
    return {
      mes: m,
      entrou: round2(a.e),
      saiu: round2(a.s),
      resultado: round2(a.e - a.s),
      completo: !emAndamento && !preMarco,
      motivo: emAndamento
        ? `em andamento (até ${iso(hoje).slice(8)}/${iso(hoje).slice(5, 7)})`
        : preMarco
          ? 'antes do marco de agosto/2026 — período com erro conhecido'
          : null,
    }
  })
}

/** Os N meses terminando no mês informado, do mais antigo pro mais novo. */
export function ultimosMeses(mes: string, n: number): string[] {
  const [a, m] = mes.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
