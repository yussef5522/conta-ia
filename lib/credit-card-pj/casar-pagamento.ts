// ⭐⭐ A ÚNICA PORTA QUE FAZ UMA LINHA DO EXTRATO QUITAR UMA FATURA (15/09/2026).
//
// ⛔ Ela nasceu EXTRAÍDA da rota `/cartoes/[cardId]/casar-pagamento`, que era o único
// caminho — e por isso o gesto do balcão não tinha como reusá-la sem copiar. **Copiar seria
// a segunda porta de gravação do mesmo fato**, exatamente o que o `vincularPagamentoDeParcela`
// (11/09) existe pra impedir do lado do empréstimo.
//
// ⚠️ A rota continua viva como CASCA FINA sobre esta função (REGRA 4: uma lógica, N chamadores).

import type { PrismaClient, Prisma } from '@prisma/client'
import { formatBRL } from '@/lib/format/money'
import { resolvePaidInvoiceMonth } from './resolve-paid-month'
import { pagoDaFatura, estadoCiclo, type EstadoCiclo } from './ciclo'
import { faturaNetTotal } from './fatura-net-total'

/**
 * ⭐⭐⭐ R48 (24/11/2026) — UMA PORTA DE CONCILIAÇÃO, e agora ela é a ÚNICA de verdade.
 *
 * ⛔ O dossiê de 23/11 achou o caminho duplo: a pergunta do topo do import ("Algum destes é o
 * pagamento desta fatura?") gravava pelo `confirm`, com um `update` próprio **sem
 * `paidInvoiceMonth`** — o pagamento saía do DRE e a fatura **nunca virava Paga**. O import de
 * OFX (`aplicar-marcacao`) tinha o terceiro `update` igual. Os três agora chamam ESTA função.
 *
 * ⭐ E ela grava o ANTES (`cardPaymentPrevCategoryId` + `cardPaymentPrevFlag`) — é o que faz o
 * desfazer devolver tudo, categoria inclusa. Re-casar uma linha já casada NÃO sobrescreve o antes.
 */
type Db = PrismaClient | Prisma.TransactionClient

export class CasarPagamentoError extends Error {}

export interface CasarPagamentoResultado {
  transactionId: string
  paidInvoiceMonth: string | null
  previousCategoryId: string | null
  deltaDespesaRemovidoDoDRE: number
  /** R48 — o que a fatura ficou depois do gesto (Paga/Parcial NA HORA) */
  fatura: { id: string | null; total: number; pago: number; estado: EstadoCiclo }
}

/** R46/R48 — o estado da fatura (cartão, competência) lido do vínculo — a MESMA conta da tela */
export async function estadoDaFatura(db: Db, cardId: string, mes: string): Promise<CasarPagamentoResultado['fatura']> {
  const [registro, linhas, pagamentos] = await Promise.all([
    db.faturaCartaoPJ.findUnique({ where: { cardId_mes: { cardId, mes } }, select: { id: true } }),
    db.transaction.findMany({ where: { businessCreditCardId: cardId, invoiceMonth: mes, isCardPayment: false }, select: { type: true, amount: true } }),
    db.transaction.findMany({ where: { businessCreditCardId: cardId, isCardPayment: true, paidInvoiceMonth: mes }, select: { amount: true } }),
  ])
  const total = faturaNetTotal(linhas).net
  const pago = pagoDaFatura(total, pagamentos.map((p) => p.amount))
  return { id: registro?.id ?? null, total, pago, estado: estadoCiclo({ total, pago, fechada: linhas.length > 0 }) }
}

export async function casarPagamentoDeCartao(
  input: { companyId: string; cardId: string; txId: string; invoiceMonth?: string | null },
  db: Db,
): Promise<CasarPagamentoResultado> {
  const card = await db.businessCreditCard.findFirst({ where: { id: input.cardId, companyId: input.companyId }, select: { id: true } })
  if (!card) throw new CasarPagamentoError('Cartão não encontrado.')

  const tx = await db.transaction.findFirst({
    where: { id: input.txId, bankAccount: { companyId: input.companyId } },
    select: { id: true, type: true, amount: true, categoryId: true, isCardPayment: true, businessCreditCardId: true },
  })
  if (!tx) throw new CasarPagamentoError('Transação não encontrada.')
  // ⛔ o sentido manda: crédito não paga fatura. A mesma lei do balcão, na FONTE.
  if (tx.type === 'CREDIT') throw new CasarPagamentoError('Só uma SAÍDA pode ser pagamento de cartão.')

  /**
   * ⚠️ A competência que o pagamento quita sai da fn ÚNICA (`resolvePaidInvoiceMonth`), a
   * MESMA que o import usa — e ela casa por **VALOR**, nunca por "a mais recente".
   *
   * ⛔⛔⛔ **COMPETÊNCIA IRRESOLVÍVEL RECUSA ENSINANDO (20/10/2026).** Até hoje o resolvedor
   * terminava num `sort().pop()` silencioso e esta linha gravava **o que viesse** — foi assim
   * que o pagamento de R$ 12.696,23 (banner da prévia do import, que casa ANTES de a fatura
   * existir) foi pra **2026-09** e deixou setembro com DOIS pagamentos e outubro ABERTA.
   *
   * ⛔ E a recusa é obrigatória por um motivo estrutural, não de gosto: `faturaVinculada` olha
   * **só o `businessCreditCardId`** (régua de 20/09 — *"a flag diz 'parece', o vínculo diz
   * 'é'"*). Gravar cartão com `paidInvoiceMonth` NULO manda a linha pro ARQUIVO com selo de
   * "fatura paga" e **deixa a fatura OPEN pra sempre** — o bug do Carter, pior que o mês
   * errado, porque nem o K2 do juiz acusa.
   *
   * ⭐ Quem passa `input.invoiceMonth` (a tela, o banner da prévia, a conciliação) **manda**:
   * ali o dono — ou o PDF que ele acabou de subir — já disse a competência.
   */
  const paidInvoiceMonth = input.invoiceMonth ?? await resolvePaidInvoiceMonth(db, input.cardId, tx.amount)
  if (!paidInvoiceMonth) {
    throw new CasarPagamentoError(
      `Não achei fatura de ${formatBRL(tx.amount)} neste cartão — confirme o import da fatura primeiro, ` +
      `ou escolha a competência na mão. Marcar o pagamento sem dizer QUAL fatura ele quita deixaria ` +
      `a fatura aberta pra sempre.`,
    )
  }

  const updated = await db.transaction.update({
    where: { id: tx.id },
    data: {
      isCardPayment: true,
      businessCreditCardId: input.cardId,
      paidInvoiceMonth,
      // ⚠️ zera a categoria: pagamento de fatura NÃO é despesa (a despesa é a compra, no
      // mês em que ela foi feita) — contá-lo seria a mesma saída duas vezes no DRE.
      categoryId: null,
      // ⭐ R48 — o ANTES, só na 1ª vez (re-casar não apaga o que o desfazer precisa devolver)
      ...(tx.businessCreditCardId == null
        ? { cardPaymentPrevCategoryId: tx.categoryId, cardPaymentPrevFlag: tx.isCardPayment }
        : {}),
    },
    select: { id: true, paidInvoiceMonth: true },
  })
  // ⭐ o pino `casar()` da lei generalizado a N pagamentos (`pagoDaFatura` = min(Σ, total)):
  // a fatura sai do gesto já Paga/Parcial — lida do MESMO vínculo que a tela lê
  const f = await estadoDaFatura(db, input.cardId, paidInvoiceMonth)
  return {
    transactionId: updated.id,
    paidInvoiceMonth: updated.paidInvoiceMonth,
    previousCategoryId: tx.categoryId,
    /**
     * ⚠️ **SÓ É DELTA SE HAVIA O QUE REMOVER** (achado em 20/09): este campo devolvia
     * `tx.amount` SEMPRE — e a tela leu *"R$ 8.626,98 removidos do DRE"* numa linha que
     * **nunca teve categoria** (nada saiu de lugar nenhum). *Número que afirma um efeito
     * que não houve é a família do "número sem régua em tela de dinheiro".*
     *
     * ⚠️ Ressalva honesta: categoria de grupo não-DRE (transferência) ainda contaria aqui
     * — o que a régua garante é que **sem categoria o delta é ZERO**.
     */
    deltaDespesaRemovidoDoDRE: tx.categoryId ? tx.amount : 0,
    fatura: f,
  }
}

export class DesfazerCasamentoError extends Error {}

/**
 * ⭐⭐⭐ R48 — DESFAZER DEVOLVE TUDO, categoria inclusa (24/11/2026).
 *
 * ⛔ Antes: o DELETE zerava só cartão + competência — `isCardPayment` ficava `true` e a categoria
 * que o casamento tirou **não voltava** (só o AuditLog lembrava dela).
 * ⭐ Agora volta o que a porta gravou como ANTES. Casamento anterior à porta (antes NULO): a
 * categoria vem do rastro do gesto (`previousCategoryId` no AuditLog, desde 20/10) e a marca fica
 * como o DELETE antigo deixava (aguardando casar) — ⚠️ honesto: sem rastro, nada se inventa.
 */
export async function desfazerCasamentoDeCartao(
  input: { companyId: string; cardId: string; txId: string },
  db: Db,
): Promise<{ transactionId: string; paidInvoiceMonthAnterior: string | null; categoriaDevolvida: string | null; origemDoAntes: 'porta' | 'rastro' | 'sem-rastro'; fatura: CasarPagamentoResultado['fatura'] | null }> {
  const tx = await db.transaction.findFirst({
    where: { id: input.txId, bankAccount: { companyId: input.companyId }, businessCreditCardId: input.cardId },
    select: { id: true, paidInvoiceMonth: true, cardPaymentPrevCategoryId: true, cardPaymentPrevFlag: true },
  })
  if (!tx) throw new DesfazerCasamentoError('Transação não encontrada ou não casada com este cartão.')
  let categoria: string | null = null
  let flag = true
  let origem: 'porta' | 'rastro' | 'sem-rastro' = 'sem-rastro'
  if (tx.cardPaymentPrevFlag != null) {
    categoria = tx.cardPaymentPrevCategoryId
    flag = tx.cardPaymentPrevFlag
    origem = 'porta'
  } else {
    const ultimo = await db.auditLog.findFirst({
      where: { companyId: input.companyId, entityType: 'Transaction', entityId: tx.id, metadata: { contains: 'casar-pagamento-de-cartao' } },
      orderBy: { timestamp: 'desc' },
      select: { metadata: true },
    })
    try {
      const m = ultimo?.metadata ? JSON.parse(ultimo.metadata) : null
      if (m && m.gesto === 'casar-pagamento-de-cartao') { categoria = m.previousCategoryId ?? null; origem = 'rastro' }
    } catch { /* rastro ilegível = sem rastro */ }
  }
  // ⚠️ a categoria devolvida só volta se ainda existe na empresa (senão a linha fica sem — e a tela diz)
  if (categoria) {
    const ok = await db.category.findFirst({ where: { id: categoria, companyId: input.companyId }, select: { id: true } })
    if (!ok) categoria = null
  }
  await db.transaction.update({
    where: { id: tx.id },
    data: {
      businessCreditCardId: null,
      paidInvoiceMonth: null,
      isCardPayment: flag,
      categoryId: categoria,
      cardPaymentPrevCategoryId: null,
      cardPaymentPrevFlag: null,
    },
  })
  return {
    transactionId: tx.id,
    paidInvoiceMonthAnterior: tx.paidInvoiceMonth,
    categoriaDevolvida: categoria,
    origemDoAntes: origem,
    fatura: tx.paidInvoiceMonth ? await estadoDaFatura(db, input.cardId, tx.paidInvoiceMonth) : null,
  }
}
