// ESTOQUE FASE 2 item 2.0 — cadastros mínimos que a produção vai usar: SETOR (só COZINHA
// por enquanto) e COLABORADOR (só nome, lista simples). Sem RH complexo. Só stock_.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export async function listSetores(companyId: string, db: Db = defaultPrisma) {
  return db.stockSetor.findMany({ where: { companyId }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, ativo: true } })
}
export async function criarSetor(companyId: string, nome: string, db: Db = defaultPrisma) {
  const n = nome.trim()
  if (!n) throw new Error('Nome do setor é obrigatório.')
  return db.stockSetor.upsert({ where: { companyId_nome: { companyId, nome: n } }, create: { companyId, nome: n }, update: { ativo: true }, select: { id: true, nome: true, ativo: true } })
}
export async function setSetorAtivo(companyId: string, id: string, ativo: boolean, db: Db = defaultPrisma) {
  await db.stockSetor.updateMany({ where: { companyId, id }, data: { ativo } })
}

export async function listColaboradores(companyId: string, db: Db = defaultPrisma) {
  return db.stockColaborador.findMany({ where: { companyId }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, ativo: true } })
}
export async function criarColaborador(companyId: string, nome: string, db: Db = defaultPrisma) {
  const n = nome.trim()
  if (!n) throw new Error('Nome do colaborador é obrigatório.')
  return db.stockColaborador.create({ data: { companyId, nome: n }, select: { id: true, nome: true, ativo: true } })
}
export async function setColaboradorAtivo(companyId: string, id: string, ativo: boolean, db: Db = defaultPrisma) {
  await db.stockColaborador.updateMany({ where: { companyId, id }, data: { ativo } })
}
