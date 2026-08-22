// ESTOQUE PARTE C — SAÍDA que não é venda (perda/uso interno). O motivo é obrigatório
// (impossível por construção: registrarSaida atômico + CHECK no banco). Baixa o estoque
// (PERDA|USO_INTERNO) com custo REAL e guarda o porquê + foto. Insumo do Real vs Teórico.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from './movement'
import { custoMedioPorItem, recomputeSaldoCache, saldoItem } from './saldo'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export class SaidaError extends Error {}

// motivo → é PERDA (desperdício) ou USO_INTERNO (uso intencional)? Separa pro relatório/DRE.
export const MOTIVOS = {
  VENCEU: 'PERDA', ESTRAGOU: 'PERDA', CAIU_QUEBROU: 'PERDA', ERRO_PREPARO: 'PERDA', OUTRO: 'PERDA',
  CONSUMO_FUNCIONARIO: 'USO_INTERNO', USO_INTERNO: 'USO_INTERNO', CORTESIA: 'USO_INTERNO',
} as const
export type Motivo = keyof typeof MOTIVOS
export const MOTIVO_LABEL: Record<Motivo, string> = {
  VENCEU: 'Venceu', ESTRAGOU: 'Estragou', CAIU_QUEBROU: 'Caiu / quebrou', ERRO_PREPARO: 'Erro de preparo',
  CONSUMO_FUNCIONARIO: 'Consumo funcionário', USO_INTERNO: 'Uso interno', CORTESIA: 'Cortesia', OUTRO: 'Outro',
}

export interface RegistrarSaidaInput {
  companyId: string
  itemId: string
  quantidade: number
  motivo: Motivo
  motivoTexto?: string | null
  fotoBase64?: string | null
  data?: string // YYYY-MM-DD (default hoje via caller)
  userId?: string
}

export async function registrarSaida(input: RegistrarSaidaInput, db: PrismaClient = defaultPrisma): Promise<{ saidaId: string; custoTotal: number }> {
  if (!(input.quantidade > 0)) throw new SaidaError('Quantidade tem que ser maior que zero.')
  if (!input.motivo || !(input.motivo in MOTIVOS)) throw new SaidaError('Motivo é obrigatório.')
  const item = await db.stockItem.findFirst({ where: { id: input.itemId, companyId: input.companyId }, select: { id: true } })
  if (!item) throw new SaidaError('Item não encontrado.')

  const tipo = MOTIVOS[input.motivo]
  const custo = (await custoMedioPorItem(db, input.companyId)).get(input.itemId) ?? 0
  const custoTotal = round2(input.quantidade * custo)
  const dataDate = input.data ? new Date(`${input.data}T12:00:00`) : new Date()

  const saidaId = await db.$transaction(async (tx) => {
    const mov = await criarMovimento(tx, { companyId: input.companyId, itemId: input.itemId, tipo, quantidade: -input.quantidade, custoUnitario: custo, custoTotal: round2(-custoTotal), origem: 'MANUAL', criadoPorId: input.userId ?? null, dataMovimento: dataDate })
    const s = await tx.stockSaida.create({
      data: { companyId: input.companyId, itemId: input.itemId, movementId: mov.id, tipoMovimento: tipo, motivo: input.motivo, motivoTexto: input.motivo === 'OUTRO' ? (input.motivoTexto ?? null) : null, quantidade: input.quantidade, custoUnitario: custo, custoTotal, fotoBase64: input.fotoBase64 ?? null, data: dataDate, criadoPorId: input.userId ?? null },
    })
    return s.id
  })
  await recomputeSaldoCache(db, input.companyId)
  return { saidaId, custoTotal }
}

export interface RelatorioPerdas {
  de: string; ate: string
  totalValor: number
  totalItens: number
  porMotivo: { motivo: Motivo; label: string; tipo: string; quantidade: number; valor: number; n: number }[]
  porItem: { itemId: string; nome: string; quantidade: number; valor: number; n: number }[]
}

export async function relatorioPerdas(companyId: string, de: string, ate: string, db: PrismaClient = defaultPrisma): Promise<RelatorioPerdas> {
  const saidas = await db.stockSaida.findMany({
    where: { companyId, data: { gte: new Date(`${de}T00:00:00`), lte: new Date(`${ate}T23:59:59`) } },
    select: { itemId: true, motivo: true, quantidade: true, custoTotal: true },
  })
  const itemIds = [...new Set(saidas.map((s) => s.itemId))]
  const nomes = new Map((itemIds.length ? await db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true } }) : []).map((i) => [i.id, i.nome]))

  const porMotivo = new Map<string, { quantidade: number; valor: number; n: number }>()
  const porItem = new Map<string, { quantidade: number; valor: number; n: number }>()
  for (const s of saidas) {
    const m = porMotivo.get(s.motivo) ?? { quantidade: 0, valor: 0, n: 0 }
    m.quantidade = round2(m.quantidade + s.quantidade); m.valor = round2(m.valor + s.custoTotal); m.n++
    porMotivo.set(s.motivo, m)
    const i = porItem.get(s.itemId) ?? { quantidade: 0, valor: 0, n: 0 }
    i.quantidade = round2(i.quantidade + s.quantidade); i.valor = round2(i.valor + s.custoTotal); i.n++
    porItem.set(s.itemId, i)
  }
  return {
    de, ate,
    totalValor: round2(saidas.reduce((s, x) => s + x.custoTotal, 0)),
    totalItens: saidas.length,
    porMotivo: [...porMotivo.entries()].map(([motivo, v]) => ({ motivo: motivo as Motivo, label: MOTIVO_LABEL[motivo as Motivo] ?? motivo, tipo: MOTIVOS[motivo as Motivo] ?? 'PERDA', ...v })).sort((a, b) => b.valor - a.valor),
    porItem: [...porItem.entries()].map(([itemId, v]) => ({ itemId, nome: nomes.get(itemId) ?? '(item)', ...v })).sort((a, b) => b.valor - a.valor),
  }
}

// helper pra o juiz: saldo atual (pra a tela avisar se a saída deixa negativo)
export async function saldoAtual(companyId: string, itemId: string, db: PrismaClient = defaultPrisma): Promise<number> {
  return (await saldoItem(db, companyId, itemId)).saldo
}
