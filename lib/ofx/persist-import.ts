// Sprint rawOfxBlob (13/08/2026) — PONTO OBRIGATÓRIO de persistência de import.
//
// PROBLEMA: o blob (OFX cru) era gravado num único lugar (orchestrator, só V2) →
// 21/122 imports salvaram (83% sem). Sem o blob, bug futuro fica cego. E a lição
// do motor de transferência: não basta a lib compartilhada, precisa de um PONTO
// OBRIGATÓRIO de passagem, senão cada caminho reimplementa (e esquece).
//
// REGRA: todo caminho que aceita um OFX cria o registro por AQUI. `createOfxImportRecord`
// EXIGE o `rawOfx` (o blob) — impossível criar sem gravar. Guard ESLint bane
// `prisma.ofxImport.create(` fora deste arquivo. Gravado CEDO (status PROCESSING),
// logo após a validação (banco/conta conferem), ANTES de decidir V1/V2/0-novas —
// então o blob sobrevive mesmo se o processamento não criar transação nenhuma.
//
// 2.4 — CONTEXTO DA DECISÃO: o `finalize` grava o que o SISTEMA entendeu (âncora,
// perfil de banco, LEDGERBAL fechou?, contadores). Vale mais que o blob sozinho:
// mostra a decisão sem reprocessar. O blob diz o que o banco mandou; o contexto,
// o que o sistema entendeu.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export interface CreateOfxImportInput {
  bankAccountId: string
  userId: string
  fileName: string
  fileSize: number
  /** O BLOB — obrigatório. O TypeScript não deixa criar sem ele. */
  rawOfx: string
  fileHash?: string | null
  /** OFX | PDF | EXCEL — canal de origem. Default OFX. */
  source?: string
  ipAddress?: string | null
  userAgent?: string | null
  totalTransactions?: number
  duplicates?: number
  periodStart?: Date | null
  periodEnd?: Date | null
}

/**
 * Cria o registro de import JÁ com o blob (status PROCESSING). ÚNICO ponto de
 * criação de OfxImport — todos os caminhos passam por aqui. Retorna o id pra o
 * processamento atualizar depois (finalizeOfxImport).
 */
export async function createOfxImportRecord(
  db: Db,
  input: CreateOfxImportInput,
): Promise<{ id: string }> {
  return db.ofxImport.create({
    data: {
      bankAccountId: input.bankAccountId,
      userId: input.userId,
      status: 'PROCESSING',
      fileName: input.fileName,
      fileSize: input.fileSize,
      rawOfxBlob: input.rawOfx, // ← SEMPRE grava o cru
      fileHash: input.fileHash ?? null,
      source: input.source ?? 'OFX',
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      totalTransactions: input.totalTransactions ?? 0,
      duplicates: input.duplicates ?? 0,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
    },
    select: { id: true },
  })
}

export interface FinalizeOfxImportInput {
  status?: 'SUCCESS' | 'FAILED'
  totalTransactions?: number
  newTransactions?: number
  duplicates?: number
  autoClassified?: number
  futureDiscarded?: number
  periodStart?: Date | null
  periodEnd?: Date | null
  errorMessage?: string | null
  // 2.4 — contexto da decisão (o que o sistema entendeu)
  anchorDate?: Date | null
  anchorRule?: string | null
  bankProfile?: string | null
  ledgerBalAmount?: number | null
  ledgerBalMatched?: boolean | null
  ledgerBalDiff?: number | null
}

/** Fecha o import: status + contadores + CONTEXTO DA DECISÃO (2.4). */
export async function finalizeOfxImport(
  db: Db,
  importId: string,
  input: FinalizeOfxImportInput,
): Promise<void> {
  await db.ofxImport.update({
    where: { id: importId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.totalTransactions !== undefined ? { totalTransactions: input.totalTransactions } : {}),
      ...(input.newTransactions !== undefined ? { newTransactions: input.newTransactions } : {}),
      ...(input.duplicates !== undefined ? { duplicates: input.duplicates } : {}),
      ...(input.autoClassified !== undefined ? { autoClassified: input.autoClassified } : {}),
      ...(input.futureDiscarded !== undefined ? { futureDiscarded: input.futureDiscarded } : {}),
      ...(input.periodStart !== undefined ? { periodStart: input.periodStart } : {}),
      ...(input.periodEnd !== undefined ? { periodEnd: input.periodEnd } : {}),
      ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
      ...(input.anchorDate !== undefined ? { anchorDate: input.anchorDate } : {}),
      ...(input.anchorRule !== undefined ? { anchorRule: input.anchorRule } : {}),
      ...(input.bankProfile !== undefined ? { bankProfile: input.bankProfile } : {}),
      ...(input.ledgerBalAmount !== undefined ? { ledgerBalAmount: input.ledgerBalAmount } : {}),
      ...(input.ledgerBalMatched !== undefined ? { ledgerBalMatched: input.ledgerBalMatched } : {}),
      ...(input.ledgerBalDiff !== undefined ? { ledgerBalDiff: input.ledgerBalDiff } : {}),
    },
  })
}
