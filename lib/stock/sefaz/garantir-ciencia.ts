// ESTOQUE — GARANTIR CIÊNCIA das notas resumo-only (bug da Focatto, 23/08).
//
// O QUE ESTAVA ERRADO: o `NFeDistribuicaoDFe` só entrega o procNFe COMPLETO depois que o
// destinatário se manifesta (Ciência 210210). O cron horário só BAIXAVA — nada disparava
// a Ciência. Resultado: nota que chega só-resumo fica presa PARA SEMPRE na fila, o
// download devolve "137 Nenhum documento localizado" (não há o que baixar mesmo) e a tela
// dizia "o XML chega na próxima consulta" — mentira: sem Ciência não chega nunca.
// As 7 notas da fila da caçula estavam nesse estado, uma há 2 dias.
//
// A Ciência de fato funcionava (provada end-to-end no Frigorífico/Alan) — só que por
// SCRIPT MANUAL. O débito "sem cron de retry de evento" estava registrado e era isto.
//
// REGRA 4: esta é a função ÚNICA. O cron horário e o script manual chamam ela — não pode
// existir "o jeito do cron" e "o jeito do script" divergindo.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { enviarEvento } from './ciencia'
import { idsRecusados } from '../recusa-nota'
import { TP_EVENTO } from './evento'

type Db = PrismaClient | Prisma.TransactionClient

/** Depois de N tentativas com ERRO a gente PARA de insistir — o E10 passa a gritar.
 *  Insistir pra sempre num erro permanente só queima cota na SEFAZ e esconde o problema. */
export const MAX_TENTATIVAS_CIENCIA = 5

export interface GarantirCienciaResult {
  candidatas: number
  enviadas: number
  jaManifestadas: number
  desistidas: number // passaram do teto de tentativas — o juiz E10 reclama
  erros: { chave: string; emitNome: string | null; cStat?: string; motivo: string }[]
}

/**
 * Envia Ciência (210210) pra toda nota da FILA que veio só-resumo e ainda não tem
 * manifestação bem-sucedida. Idempotente: nota que já tem evento ENVIADO (Ciência OU
 * Confirmação — a Confirmação é mais forte e supera a Ciência) é PULADA, então rodar de
 * hora em hora não vira enxurrada de eventos nem infla o nSeqEvento.
 */
export async function garantirCienciaPendentes(input: {
  companyId: string
  db?: Db
  limite?: number
}): Promise<GarantirCienciaResult> {
  const db = input.db ?? defaultPrisma
  const limite = input.limite ?? 25

  const resumoOnly = await db.stockNfe.findMany({
    // ⛔⛔ NOTA RECUSADA NÃO RECEBE CIÊNCIA AUTOMÁTICA. Ciência é a manifestação mais fraca,
    // mas É manifestação: continuar mandando sozinho numa nota que o dono está contestando
    // seria o sistema se manifestando por conta própria sobre um documento em disputa.
    where: { companyId: input.companyId, status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false, id: { notIn: [...(await idsRecusados(db, input.companyId))] } },
    select: { chave: true, emitNome: true },
    take: limite,
  })

  const out: GarantirCienciaResult = { candidatas: resumoOnly.length, enviadas: 0, jaManifestadas: 0, desistidas: 0, erros: [] }
  if (resumoOnly.length === 0) return out

  const chaves = resumoOnly.map((n) => n.chave)
  const eventos = await db.stockSefazEvent.findMany({
    where: { companyId: input.companyId, chave: { in: chaves } },
    select: { chave: true, status: true, tpEvento: true },
  })
  const manifestada = new Set(eventos.filter((e) => e.status === 'ENVIADO').map((e) => e.chave))
  const tentativasErro = new Map<string, number>()
  for (const e of eventos) {
    if (e.status === 'ERRO' && e.tpEvento === TP_EVENTO.CIENCIA) tentativasErro.set(e.chave, (tentativasErro.get(e.chave) ?? 0) + 1)
  }

  for (const n of resumoOnly) {
    if (manifestada.has(n.chave)) { out.jaManifestadas++; continue }
    if ((tentativasErro.get(n.chave) ?? 0) >= MAX_TENTATIVAS_CIENCIA) { out.desistidas++; continue }
    try {
      const r = await enviarEvento({ companyId: input.companyId, chave: n.chave, tpEvento: TP_EVENTO.CIENCIA, db })
      if (r.ok) out.enviadas++
      else out.erros.push({ chave: n.chave, emitNome: n.emitNome, cStat: r.cStat, motivo: r.xMotivo })
    } catch (e) {
      out.erros.push({ chave: n.chave, emitNome: n.emitNome, motivo: (e as Error).message })
    }
  }
  return out
}
