// ⭐⭐ A ESCRITA DO PLANO DA ETAPA — UMA PORTA SÓ (15/09/2026).
//
// A régua PURA mora em `plano-da-etapa.ts` (quem vê, em que dia, quanto tempo). Aqui fica a
// gravação — e ela é **uma função**, porque quem define o plano são três gestos diferentes
// (planejar a ordem, mudar o dia de uma etapa, liberar pra equipe) e três upserts soltos
// divergiriam no primeiro campo novo.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'

type Db = PrismaClient | Prisma.TransactionClient

export class PlanoEtapaError extends Error {}

export interface PlanoGravado {
  etapaId: string
  diaPrevisto: Date | null
  liberadaParaEquipe: boolean
}

/**
 * Grava (ou atualiza) o plano de UMA etapa.
 *
 * ⚠️ Campo ausente = **não mexe**: mudar o dia não pode desligar a liberação sem querer, e
 * liberar não pode apagar o dia que o dono escolheu. `null` explícito é que limpa.
 */
export async function definirPlanoDaEtapa(
  input: {
    companyId: string
    etapaId: string
    /** `YYYY-MM-DD` · `null` limpa (volta pro dia da ordem) · ausente não mexe */
    diaPrevisto?: string | null
    liberadaParaEquipe?: boolean
    userId?: string
  },
  db: Db = defaultPrisma,
): Promise<PlanoGravado> {
  const etapa = await db.stockOrdemEtapa.findFirst({
    where: { id: input.etapaId, companyId: input.companyId },
    select: { id: true, finalizadoEm: true },
  })
  if (!etapa) throw new PlanoEtapaError('Etapa não encontrada.')
  // ⛔ etapa FEITA não se replaneja: o plano é sobre o futuro, e mexer no dia de um trabalho
  // que já aconteceu moveria o fato pra um dia em que ele não ocorreu.
  if (etapa.finalizadoEm) throw new PlanoEtapaError('Essa etapa já foi feita — o plano vale pro que ainda não aconteceu.')

  if (input.diaPrevisto !== undefined && input.diaPrevisto !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.diaPrevisto)) {
    throw new PlanoEtapaError('Data inválida.')
  }
  // ⚠️ o dia vira o MEIO-DIA de São Paulo, como o resto do módulo: meia-noite UTC cairia no
  // dia anterior pra quem lê em -03:00, e a etapa apareceria no HOJE errado.
  const dia = input.diaPrevisto === undefined
    ? undefined
    : input.diaPrevisto === null ? null : janelaDoDiaSP(input.diaPrevisto, input.diaPrevisto).de

  const dados = {
    ...(dia !== undefined ? { diaPrevisto: dia } : {}),
    ...(input.liberadaParaEquipe !== undefined ? { liberadaParaEquipe: input.liberadaParaEquipe } : {}),
  }
  const r = await db.stockEtapaPlano.upsert({
    where: { etapaId: input.etapaId },
    create: {
      companyId: input.companyId, etapaId: input.etapaId,
      diaPrevisto: dia ?? null,
      liberadaParaEquipe: input.liberadaParaEquipe ?? false,
      definidoPorId: input.userId ?? null,
    },
    update: dados,
    select: { etapaId: true, diaPrevisto: true, liberadaParaEquipe: true },
  })
  return r
}

/** Os planos de um conjunto de etapas, indexados por `etapaId`. */
export async function planosDasEtapas(
  companyId: string, etapaIds: readonly string[], db: Db = defaultPrisma,
): Promise<Map<string, PlanoGravado>> {
  if (!etapaIds.length) return new Map()
  const rows = await db.stockEtapaPlano.findMany({
    where: { companyId, etapaId: { in: [...etapaIds] } },
    select: { etapaId: true, diaPrevisto: true, liberadaParaEquipe: true },
  })
  return new Map(rows.map((r) => [r.etapaId, r]))
}
