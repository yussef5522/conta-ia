// Sprint 5.0.2.j — Detecta transferência entre contas da MESMA empresa.
//
// Caso comum (Yussef tem Cacula Mix com 3 contas: Sicredi/Banrisul/Stone):
// PIX entre essas contas é movimentação interna do MESMO CNPJ — não é receita
// nem despesa, não deveria inflar DRE.
//
// Detecção determinística:
//   1. Tx tem PIX/TED na descrição
//   2. Existe outra conta da MESMA empresa com tx de:
//      - Valor exato
//      - Tipo oposto (DEBIT ↔ CREDIT)
//      - Data ±1 dia
//      - Ainda não conciliada
//   3. Concilia atomic + marca ambas isInternalTransfer=true
//
// Funciona SEM cadastro manual — sistema já sabe que as contas pertencem
// à mesma empresa (bankAccount.companyId).

import { prisma } from '@/lib/db'

export interface SameCompanyMatchInput {
  transactionId: string
  bankAccountId: string
  companyId: string
  type: string // CREDIT | DEBIT
  amount: number
  /** Data efetiva (paymentDate || date) */
  date: Date
  description: string | null
}

export interface SameCompanyMatchResult {
  matched: boolean
  linkedTransactionId?: string
  linkedBankAccountId?: string
  reason?: 'not-pix' | 'no-other-accounts' | 'no-candidate-found'
}

const PIX_KEYWORDS = ['pix', 'transferencia', 'transfer ', 'transf ', 'ted ', 'doc ']

/**
 * Identifica par entre contas da mesma empresa e concilia atomic.
 * Retorna info do match (ou motivo de não conciliar).
 *
 * Pra usar no pipeline: chame ANTES do detect-pix-relacionado externo, pois
 * transferência interna NÃO precisa de cadastros de pessoas vinculadas.
 */
export async function matchSameCompanyTransfer(
  input: SameCompanyMatchInput,
): Promise<SameCompanyMatchResult> {
  // 1. Só procura pra tx que parece Pix/TED/transferência
  const desc = (input.description ?? '').toLowerCase()
  const isPixLike = PIX_KEYWORDS.some((k) => desc.includes(k))
  if (!isPixLike) return { matched: false, reason: 'not-pix' }

  // 2. Busca outras contas da MESMA empresa
  const outrasContas = await prisma.bankAccount.findMany({
    where: {
      companyId: input.companyId,
      id: { not: input.bankAccountId },
      isActive: true,
    },
    select: { id: true },
  })
  if (outrasContas.length === 0) {
    return { matched: false, reason: 'no-other-accounts' }
  }

  // 3. Janela ±1 dia, valor exato, tipo oposto
  const dataMin = new Date(input.date)
  dataMin.setDate(dataMin.getDate() - 1)
  const dataMax = new Date(input.date)
  dataMax.setDate(dataMax.getDate() + 1)

  const tipoOposto = input.type === 'DEBIT' ? 'CREDIT' : 'DEBIT'

  const candidata = await prisma.transaction.findFirst({
    where: {
      bankAccountId: { in: outrasContas.map((c) => c.id) },
      type: tipoOposto,
      amount: input.amount,
      OR: [
        { paymentDate: { gte: dataMin, lte: dataMax } },
        { date: { gte: dataMin, lte: dataMax } },
      ],
      isInternalTransfer: false,
      linkedTransactionId: null,
      id: { not: input.transactionId },
    },
    orderBy: { date: 'desc' },
    select: { id: true, bankAccountId: true },
  })

  if (!candidata) {
    return { matched: false, reason: 'no-candidate-found' }
  }

  // 4. Concilia atomic
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: input.transactionId },
      data: {
        isInternalTransfer: true,
        linkedTransactionId: candidata.id,
      },
    }),
    prisma.transaction.update({
      where: { id: candidata.id },
      data: {
        isInternalTransfer: true,
        linkedTransactionId: input.transactionId,
      },
    }),
  ])

  return {
    matched: true,
    linkedTransactionId: candidata.id,
    linkedBankAccountId: candidata.bankAccountId ?? undefined,
  }
}
