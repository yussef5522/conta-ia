// ESTOQUE FASE 1 item 4 — persistência de UM doc SEFAZ como stock_nfe (fonte ÚNICA,
// REGRA 4/5): o download (loop NSU) E a busca por chave ("chegou sem aparecer na fila")
// passam por aqui — impossível os dois gravarem a nota de jeitos diferentes. Idempotente
// (upsert por chave; só evolui resumo → completo). Status pela DATA DE CORTE.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { SefazDoc } from './parse-response'
import { statusForNfe, type NfeStatus } from './corte'
import { saveNfeCompleta } from './persist-nfe'

type Db = PrismaClient | Prisma.TransactionClient

export interface PersistDocResult { nfeId: string | null; status: NfeStatus | null; parsed: boolean }

/** Persiste um doc NFe (resumo|completo). Evento/desconhecido/sem-chave → não grava. */
export async function persistSefazDoc(db: Db, companyId: string, doc: SefazDoc, corte: Date): Promise<PersistDocResult> {
  if (doc.tipo === 'evento' || doc.tipo === 'desconhecido') return { nfeId: null, status: null, parsed: false }
  if (!doc.chave) return { nfeId: null, status: null, parsed: false }

  const dataEmissao = doc.dataEmissao ? new Date(doc.dataEmissao) : null
  const status = statusForNfe(dataEmissao, corte)

  const row = await db.stockNfe.upsert({
    where: { companyId_chave: { companyId, chave: doc.chave } },
    create: {
      companyId, chave: doc.chave, nsu: doc.nsu, emitCnpj: doc.emitCnpj ?? null, emitNome: doc.emitNome ?? null,
      vNF: doc.vNF ?? null, dataEmissao, cSitNFe: doc.cSitNFe ?? null, tpNF: doc.tpNF ?? null, status,
      temXmlCompleto: doc.tipo === 'completo', schema: doc.schema || null, docXml: doc.xml || null,
    },
    update: {
      // idempotente: só evolui de resumo → completo; nunca reclassifica HISTORICA/nova
      nsu: doc.nsu,
      ...(doc.tipo === 'completo' ? { temXmlCompleto: true, schema: doc.schema || null, docXml: doc.xml || null } : {}),
    },
    select: { id: true },
  })

  // NOVA com XML completo → parseia itens/duplicatas/emitente (histórica NÃO parseia)
  let parsed = false
  if (status === 'AGUARDANDO_MERCADORIA' && doc.tipo === 'completo' && doc.xml) {
    try { await saveNfeCompleta({ nfeId: row.id, companyId, chave: doc.chave, xml: doc.xml, db }); parsed = true } catch { /* XML atípico — fica na fila sem itens */ }
  }
  return { nfeId: row.id, status, parsed }
}
