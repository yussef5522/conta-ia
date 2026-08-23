// ESTOQUE — invariante E10: nota NA FILA sem XML completo há > 24h.
//
// POR QUE ELE NÃO EXISTIA (e o selo ficava verde mentindo): a Fase 0 registrou
// "E10/E13/E14 (SEFAZ) entram no item 2" e eles NUNCA foram construídos. O juiz rodava
// 🟢 porque ninguém estava checando — verde de "não olhei", não de "está tudo bem".
// Sete notas da caçula (uma da Focatto, presa há 2 dias) estavam nesse buraco.
//
// POR QUE O E15 NÃO PEGOU: o E15 varre `stock_sefaz_event` procurando evento PENDENTE/ERRO
// há mais de 24h. Uma nota que NUNCA teve evento nenhum não tem linha nenhuma lá — é
// invisível pra ele. O estado silencioso não é "evento com erro", é "evento que nunca
// existiu". LIÇÃO: invariante que olha só a tabela de tentativas nunca vê a tentativa que
// não aconteceu — tem que olhar a tabela do FATO (a nota), não a do PROCESSO (o evento).

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from './stock-invariants'

type Db = PrismaClient | Prisma.TransactionClient

export const E10_HORAS = 24

export async function checkNfeInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const limite = new Date(now.getTime() - E10_HORAS * 3600_000)

  // A tabela do FATO: nota na fila, sem XML completo, parada há mais de 24h.
  const presas = await db.stockNfe.findMany({
    where: { status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false, criadoEm: { lt: limite } },
    select: { companyId: true, chave: true, emitNome: true, vNF: true, criadoEm: true },
  })
  if (presas.length === 0) return fails

  // ...e só DEPOIS a tabela do processo, pra dizer o PORQUÊ (alerta acionável).
  const eventos = await db.stockSefazEvent.findMany({
    where: { chave: { in: presas.map((n) => n.chave) } },
    select: { chave: true, status: true, tpEvento: true, cStat: true, xMotivo: true },
  })
  const porChave = new Map<string, typeof eventos>()
  for (const e of eventos) porChave.set(e.chave, [...(porChave.get(e.chave) ?? []), e])

  for (const n of presas) {
    const dias = Math.floor((now.getTime() - n.criadoEm.getTime()) / 86_400_000)
    const evs = porChave.get(n.chave) ?? []
    const quem = `"${n.emitNome ?? n.chave}"${n.vNF != null ? ` (R$ ${n.vNF.toFixed(2)})` : ''}`

    let porque: string
    if (evs.length === 0) {
      porque = 'NENHUMA manifestação foi enviada — sem Ciência (210210) a SEFAZ não libera o XML completo, e o download sozinho nunca vai trazer'
    } else if (evs.some((e) => e.status === 'ENVIADO')) {
      porque = 'a Ciência foi aceita mas o XML completo não chegou nas consultas seguintes — verificar o download/parse'
    } else {
      const ultimo = evs[evs.length - 1]
      porque = `a Ciência falhou (${ultimo.cStat ?? 's/ cStat'}: ${ultimo.xMotivo ?? 'sem motivo'}) — ${evs.length} tentativa(s)`
    }
    fails.push({
      invariante: 'E10',
      companyId: n.companyId,
      detalhe: `nota ${quem} está na fila há ${dias} dia(s) SEM os itens: ${porque}.`,
    })
  }
  return fails
}
