// Sprint 5.0.2.i — Concilia automaticamente transferências internas grupo.
//
// Quando Empresa A faz Pix saída pra Empresa B (mesmo grupo), buscar em B
// uma tx entrada de MESMO VALOR + data ±1d + tipo oposto. Se achar, marcar
// AMBAS como isInternalTransfer=true e linkar via linkedTransactionId.
//
// DRE e cashflow consolidado filtram isInternalTransfer=true (não inflam).

import { prisma } from '@/lib/db'

export interface MatchInternalTransferInput {
  transactionId: string
  companyId: string // empresa onde a tx vive
  type: string // CREDIT | DEBIT
  amount: number
  date: Date // data do efeito (paymentDate/effectedDate; usar date como fallback)
  relatedPartyType: string | null
  relatedPartyId: string | null
}

export interface MatchInternalTransferResult {
  matched: boolean
  linkedTransactionId?: string
  linkedCompanyId?: string
  reason?: 'not-grupo' | 'no-cnpj-in-system' | 'no-candidate-found'
}

/**
 * Procura par e concilia se achar. Atomic via prisma.$transaction.
 * Retorna info do match (ou motivo de não conciliar).
 */
export async function matchInternalTransferForTransaction(
  input: MatchInternalTransferInput,
): Promise<MatchInternalTransferResult> {
  // 1. Só procura pra tx marcadas como GRUPO_PJ
  if (input.relatedPartyType !== 'GRUPO_PJ' || !input.relatedPartyId) {
    return { matched: false, reason: 'not-grupo' }
  }

  // 2. Busca empresa relacionada cadastrada
  const empresaRel = await prisma.empresaRelacionada.findUnique({
    where: { id: input.relatedPartyId },
  })
  if (!empresaRel) return { matched: false, reason: 'not-grupo' }

  // 3. Busca o CNPJ relacionado no sistema (precisa estar cadastrado como Company
  //    no mesmo tenant do user pra match)
  const empresaSistema = await prisma.company.findUnique({
    where: { cnpj: empresaRel.cnpjRelacionado },
  })
  if (!empresaSistema) {
    return { matched: false, reason: 'no-cnpj-in-system' }
  }

  // Se a "empresa relacionada" é a própria empresa de origem (config errada),
  // ignora pra não criar loop
  if (empresaSistema.id === input.companyId) {
    return { matched: false, reason: 'not-grupo' }
  }

  // 4. Janela de tempo: ±1 dia
  const dataMin = new Date(input.date)
  dataMin.setDate(dataMin.getDate() - 1)
  const dataMax = new Date(input.date)
  dataMax.setDate(dataMax.getDate() + 1)

  const tipoOposto = input.type === 'DEBIT' ? 'CREDIT' : 'DEBIT'

  // 5. Procura candidata na empresa do grupo
  const candidata = await prisma.transaction.findFirst({
    where: {
      bankAccount: { companyId: empresaSistema.id },
      type: tipoOposto,
      amount: input.amount, // valor exato (Float; tolerância em centavos seria ideal)
      OR: [
        { paymentDate: { gte: dataMin, lte: dataMax } },
        { date: { gte: dataMin, lte: dataMax } },
      ],
      isInternalTransfer: false,
      linkedTransactionId: null,
      id: { not: input.transactionId },
    },
    orderBy: { date: 'desc' },
  })

  if (!candidata) {
    return { matched: false, reason: 'no-candidate-found' }
  }

  // 6. Concilia atomic
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
    linkedCompanyId: empresaSistema.id,
  }
}
