// Sprint Reconcile Transfer Identity — FASE B (18/06/2026).
//
// PREVINE duplicação quando OFX da ORIGEM chegou ANTES do OFX do DESTINO.
//
// Cenário: detector cria contraparte Stone (TRANSFER IN, origin=MANUAL,
// externalId=null) ao importar OFX Banrisul/Sicredi. Memo é herdado da
// origem ("PIX ENVIADO" etc), NÃO do extrato Stone real ("YUSSEF...").
// Quando OFX Stone chega depois, contentHash NÃO bate -> gate marca como
// NOVA -> duplica.
//
// Solução: ANTES do gate, pra cada linha incoming, procurar PLACEHOLDER
// compatível (mesma conta, valor exato, data ±1d, TRANSFER, transferGroupId
// NOT NULL, externalId=null). Match ÚNICO -> RECONCILIA in-place
// (atualiza description + externalId + fitidKey + contentHash + ledger).
// Não insere nova tx.
//
// Guards estritos:
//   - SO reconcilia TRANSFER com transferGroupId NOT NULL.
//   - externalId DEVE ser null no placeholder (já tem identidade = não toca).
//   - Match TEM que ser único (>1 placeholders compatíveis -> não reconcilia,
//     deixa o gate normal decidir).
//
// 2 PIX maquininha R$ 48,75 mesmo dia (CREDIT normal): nunca vira candidato
// porque não é TRANSFER e não tem transferGroupId.

import type { PrismaClient } from '@prisma/client'
import type { OFXTransaction } from '@/lib/ofx/parser'
import { computeIdentity } from './compute-identity'

export interface ReconcilePlaceholderInput {
  bankAccountId: string
  companyId: string
  /** importBatchId do batch atual — pra criar entry no ledger se faltar */
  importBatchId: string
}

export interface ReconciledTx {
  /** id da Transaction (placeholder original) que foi reconciliada */
  transactionId: string
  /** linha OFX que reconciliou */
  ofxTx: OFXTransaction
  /** contentHash novo (recalculado com memo do OFX) */
  contentHash: string
  /** fitidKey novo (null se FITID não confiável) */
  fitidKey: string | null
}

export interface ReconcileResult {
  /** Placeholders reconciliados (não devem entrar no gate/insert) */
  reconciled: ReconciledTx[]
  /** OFX tx que NÃO encontraram placeholder — seguem fluxo normal (gate + insert) */
  remaining: OFXTransaction[]
}

const DAY_MS = 86400 * 1000

/**
 * Reconcilia placeholders TRANSFER existentes com as linhas OFX da conta
 * destino. Função usa PrismaClient (DB), executa UPDATEs in-place.
 *
 * Atomic por placeholder (cada match dentro de prisma.$transaction).
 */
export async function reconcileTransferPlaceholders(
  prisma: PrismaClient,
  incoming: OFXTransaction[],
  input: ReconcilePlaceholderInput,
): Promise<ReconcileResult> {
  const reconciled: ReconciledTx[] = []
  const remaining: OFXTransaction[] = []
  const usedPlaceholderIds = new Set<string>()

  for (const ofxTx of incoming) {
    // 1) Busca placeholders compatíveis na MESMA conta
    // Critério: mesma conta + mesmo amount (CREDIT positivo, é entrada)
    //   + data ±1d + type=TRANSFER + transferGroupId NOT NULL + externalId=null
    const dayMin = new Date(ofxTx.datePosted.getTime() - DAY_MS)
    const dayMax = new Date(ofxTx.datePosted.getTime() + DAY_MS)

    const matches = await prisma.transaction.findMany({
      where: {
        bankAccountId: input.bankAccountId,
        type: 'TRANSFER',
        transferGroupId: { not: null },
        externalId: null,
        amount: ofxTx.amount,
        date: { gte: dayMin, lte: dayMax },
        id: { notIn: Array.from(usedPlaceholderIds) },
      },
      select: { id: true, date: true, transferDirection: true, transferGroupId: true },
      take: 5,
    })

    // 2) Guard: match único E lado IN (faz sentido pra OFX positive=entrada).
    //    Se >1 placeholders compatíveis ou nenhum, não reconcilia.
    const inMatches = matches.filter((m) => m.transferDirection === 'IN' || m.transferDirection === null)
    if (inMatches.length !== 1) {
      remaining.push(ofxTx)
      continue
    }
    const placeholder = inMatches[0]

    // 3) Calcula nova identidade
    const newIdent = computeIdentity({
      accountId: input.bankAccountId,
      fitid: ofxTx.fitid,
      date: ofxTx.datePosted,
      amount: ofxTx.amount,
      type: 'TRANSFER',
      memo: ofxTx.memo,
    })

    // 4) UPDATE atomic: Transaction + ImportedIdentity
    try {
      await prisma.$transaction(async (db) => {
        await db.transaction.update({
          where: { id: placeholder.id },
          data: {
            description: ofxTx.memo,
            externalId: ofxTx.fitid,
            fitidKey: newIdent.fitidKey,
            contentHash: newIdent.contentHash,
          },
        })

        // Atualiza ledger: prefere update da entry existente (1 só esperada)
        const existing = await db.importedIdentity.findFirst({
          where: { transactionId: placeholder.id },
          select: { id: true },
        })
        if (existing) {
          await db.importedIdentity.update({
            where: { id: existing.id },
            data: {
              fitidKey: newIdent.fitidKey,
              contentHash: newIdent.contentHash,
              tombstone: false,
            },
          })
        } else {
          await db.importedIdentity.create({
            data: {
              companyId: input.companyId,
              bankAccountId: input.bankAccountId,
              importBatchId: input.importBatchId,
              fitidKey: newIdent.fitidKey,
              contentHash: newIdent.contentHash,
              transactionId: placeholder.id,
              tombstone: false,
            },
          })
        }
      })

      usedPlaceholderIds.add(placeholder.id)
      reconciled.push({
        transactionId: placeholder.id,
        ofxTx,
        contentHash: newIdent.contentHash,
        fitidKey: newIdent.fitidKey,
      })
    } catch (e) {
      // Falha aqui não trava o import — placeholder fica, OFX vai pro gate
      console.error('[reconcileTransferPlaceholders] falhou:', e)
      remaining.push(ofxTx)
    }
  }

  return { reconciled, remaining }
}
