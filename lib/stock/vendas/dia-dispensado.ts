// ⭐⭐ "NÃO BAIXAR — DECISÃO" (05/09/2026) — regra do dono.
//
// > *"As baixas começam de ONTEM (04/09) pra frente. Os dias 02 e 03/09 NÃO serão baixados —
// > naquele período a produção/estoque não estava montado e a baixa só criaria negativo sem
// > significado."*
//
// ⛔ É A MESMA DISCIPLINA DO "AGOSTO É O PISO" das vendas: o passado que não estava fechado
// **não se conserta retroativamente**; marca-se onde a régua começa e segue-se em frente.
//
// ⛔⛔ E O ESTADO EXISTE PRA PROTEGER O ALARME: sem ele, o aviso de *"importado sem baixar"*
// gritaria **para sempre** sobre dias pulados de propósito. **Alarme falso repetido mata o
// alarme** — foi assim que os 111 falsos do juiz de vendas quase o tornaram ilegível, e é a
// razão de o N1 não empilhar sobre o N3 no juiz de infra.
//
// ⚠️ DISPENSAR É DECISÃO, e decisão tem DONO e DATA — e é **reversível**: reverter não apaga
// a linha, carimba `revertidoEm`. O rastro fica nos dois sentidos (o desenho da recusa de
// nota, de 04/09).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class DispensaError extends Error {}

export const ESCOPOS = ['COMPLEMENTO', 'PRODUTO'] as const
export type EscopoDaDispensa = (typeof ESCOPOS)[number]

/** o dia em UTC puro — a chave é o DIA, nunca o instante */
export const diaUtc = (data: string) => new Date(`${data}T00:00:00.000Z`)

export interface Dispensa {
  data: string
  escopo: EscopoDaDispensa
  motivo: string | null
  em: string
  porNome: string | null
}

/**
 * ⭐ A RÉGUA ÚNICA: quais dias estão dispensados AGORA.
 *
 * Todo leitor (a tela, o juiz, o aviso) passa por aqui — uma função, uma verdade. É o mesmo
 * desenho do `idsRecusados` das notas: em vez de um `where` copiado em 3 lugares, que é como
 * um deles fica pra trás.
 */
export async function diasDispensados(
  db: Db, companyId: string, escopo: EscopoDaDispensa,
): Promise<Set<string>> {
  const rows = await db.stockVendaDiaDispensado.findMany({
    where: { companyId, escopo, revertidoEm: null },
    select: { data: true },
  })
  return new Set(rows.map((r) => r.data.toISOString().slice(0, 10)))
}

/** A lista com o rastro, pra tela mostrar quem decidiu e quando. */
export async function listarDispensas(
  companyId: string, escopo: EscopoDaDispensa, db: PrismaClient = defaultPrisma,
): Promise<Dispensa[]> {
  const rows = await db.stockVendaDiaDispensado.findMany({
    where: { companyId, escopo, revertidoEm: null },
    orderBy: { data: 'desc' },
  })
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.dispensadoPorId).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  })
  const nome = new Map(users.map((u) => [u.id, u.name]))
  return rows.map((r) => ({
    data: r.data.toISOString().slice(0, 10),
    escopo: r.escopo as EscopoDaDispensa,
    motivo: r.motivo,
    em: r.criadoEm.toISOString(),
    porNome: r.dispensadoPorId ? nome.get(r.dispensadoPorId) ?? null : null,
  }))
}

/**
 * DISPENSA o dia. Idempotente por construção (índice único parcial: 1 ativa por dia+escopo).
 *
 * ⛔ NÃO desfaz baixa nenhuma: dispensar é dizer *"este dia não vai baixar"*, não *"apague o
 * que baixou"*. Dia que já baixou não se dispensa — a saída ali é estornar, que é outro
 * gesto, com outro nome.
 */
export async function dispensarDia(
  input: { companyId: string; escopo: EscopoDaDispensa; data: string; importId?: string | null; motivo?: string | null; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ dispensaId: string; jaEstava: boolean }> {
  if (!ESCOPOS.includes(input.escopo)) throw new DispensaError('Escopo inválido.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) throw new DispensaError('Escolha o dia.')

  const ja = await db.stockVendaDiaDispensado.findFirst({
    where: { companyId: input.companyId, escopo: input.escopo, data: diaUtc(input.data), revertidoEm: null },
    select: { id: true },
  })
  if (ja) return { dispensaId: ja.id, jaEstava: true }

  const r = await db.stockVendaDiaDispensado.create({
    data: {
      companyId: input.companyId, escopo: input.escopo, data: diaUtc(input.data),
      importId: input.importId ?? null, motivo: input.motivo?.trim() || null,
      dispensadoPorId: input.userId ?? null,
    },
    select: { id: true },
  })
  return { dispensaId: r.id, jaEstava: false }
}

/** REVERTE: o dia volta a ser pendência e o aviso volta a valer. O rastro fica. */
export async function reverterDispensa(
  companyId: string, escopo: EscopoDaDispensa, data: string, userId?: string, db: PrismaClient = defaultPrisma,
): Promise<{ revertida: boolean }> {
  const r = await db.stockVendaDiaDispensado.findFirst({
    where: { companyId, escopo, data: diaUtc(data), revertidoEm: null }, select: { id: true },
  })
  if (!r) throw new DispensaError('Este dia não está dispensado.')
  await db.stockVendaDiaDispensado.update({
    where: { id: r.id }, data: { revertidoEm: new Date(), revertidoPorId: userId ?? null },
  })
  return { revertida: true }
}

/** ⚠️ o aviso só vale depois de 24h — importar e baixar no mesmo minuto não é pendência */
export const HORAS_ATE_AVISAR = 24

export interface DiaPendente {
  data: string
  escopo: EscopoDaDispensa
  importId: string
  ocorrencias: number
  importadoEm: Date
}

/**
 * O QUE O AVISO DEVE MOSTRAR. PURA — a mesma função alimenta a tela e o juiz, senão eles
 * discordam sobre o que é pendência (a doença dos 7 detectores de par).
 */
export function pendentesQueAvisam(
  dias: DiaPendente[], dispensados: Set<string>, agora: Date,
): DiaPendente[] {
  return dias.filter((d) => {
    if (dispensados.has(d.data)) return false
    const horas = (agora.getTime() - d.importadoEm.getTime()) / 3_600_000
    return horas >= HORAS_ATE_AVISAR
  })
}
