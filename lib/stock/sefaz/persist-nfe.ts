// ESTOQUE FASE 0 item 3 — grava os itens/duplicatas/emitente da NF-e completa.
// Idempotente: re-parsear a mesma nota apaga e recria (0 duplicação de item).

import type { PrismaClient, Prisma } from '@prisma/client'
import { parseNfeCompleta, type NfeCompleta } from './parse-nfe'

type Db = PrismaClient | Prisma.TransactionClient

/** Parseia + grava os detalhes de UMA nota completa. Retorna a estrutura parseada. */
export async function saveNfeCompleta(input: { nfeId: string; companyId: string; chave: string; xml: string; db: Db }): Promise<NfeCompleta> {
  const { nfeId, companyId, chave, xml, db } = input
  const nfe = parseNfeCompleta(xml)

  // ⚠️ NOTA JÁ CONFERIDA: o XML chegou DEPOIS de o dono digitar os itens do DANFE de papel
  // e confirmar o recebimento. Aqui o XML só ENRIQUECE (fica guardado pra auditoria) —
  // reescrever os itens agora quebraria a conferência já feita: os movimentos do ledger
  // (imutáveis) apontam pro que foi CONFERIDO, e o E2 confere item×movimento. Este
  // deleteMany/createMany apagaria os itens digitados e recriaria os do XML, deixando a
  // conferência órfã. O emitente segue sendo atualizado (dado do fornecedor, inofensivo).
  const nota = await db.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { status: true } })
  if (nota?.status === 'CONFIRMADA') {
    await upsertEmit(db, { nfeId, companyId, nfe })
    return nfe
  }

  // idempotente: limpa o que já havia desta nota antes de recriar
  await db.stockNfeItem.deleteMany({ where: { companyId, nfeId } })
  await db.stockNfeDup.deleteMany({ where: { companyId, nfeId } })

  if (nfe.itens.length) {
    await db.stockNfeItem.createMany({
      data: nfe.itens.map((i) => ({
        companyId, nfeId, chave, nItem: i.nItem, cProd: i.cProd ?? null, cEAN: i.cEAN ?? null, xProd: i.xProd,
        ncm: i.ncm ?? null, cest: i.cest ?? null, cfop: i.cfop ?? null, uCom: i.uCom ?? null,
        qCom: i.qCom, vUnCom: i.vUnCom, vProd: i.vProd, uTrib: i.uTrib ?? null, qTrib: i.qTrib,
      })),
    })
  }
  if (nfe.duplicatas.length) {
    await db.stockNfeDup.createMany({
      data: nfe.duplicatas.map((d) => ({ companyId, nfeId, nDup: d.nDup ?? null, dVenc: d.dVenc ? new Date(d.dVenc) : null, vDup: d.vDup })),
    })
  }
  await upsertEmit(db, { nfeId, companyId, nfe })

  return nfe
}

async function upsertEmit(db: Db, { nfeId, companyId, nfe }: { nfeId: string; companyId: string; nfe: NfeCompleta }) {
  await db.stockNfeEmit.upsert({
    where: { nfeId },
    create: { companyId, nfeId, cnpj: nfe.emit.cnpj ?? null, cpf: nfe.emit.cpf ?? null, xNome: nfe.emit.xNome, xFant: nfe.emit.xFant ?? null, ie: nfe.emit.ie ?? null, uf: nfe.emit.uf ?? null, xMun: nfe.emit.xMun ?? null, cMun: nfe.emit.cMun ?? null },
    update: { xNome: nfe.emit.xNome, xFant: nfe.emit.xFant ?? null, ie: nfe.emit.ie ?? null, uf: nfe.emit.uf ?? null },
  })
}
