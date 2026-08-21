// ESTOQUE FASE 1 — FICHA do produto. Só LÊ o ledger (stock_movement) + o item. Sem
// modelo novo: o histórico de compras JÁ está gravado (cada ENTRADA_NF). Preparada pra
// crescer (consumo/contagem/produção nas próximas fases leem os mesmos movimentos).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldoItem } from './saldo'
import { statusEstoque, type StatusEstoqueResult } from './status-estoque'

type Db = PrismaClient | Prisma.TransactionClient

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno' }

// nNF vem embutido na chave (posições 25..33, 9 dígitos).
const nNFdaChave = (chave: string | null) => (chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null)

export interface CompraLinha {
  movimentoId: string
  data: string
  tipo: string // ENTRADA_NF | ESTORNO
  estorno: boolean
  fornecedor: string | null
  notaChave: string | null
  nNF: string | null
  conferenceId: string | null // recibo daquela entrada (quando veio de conferência)
  quantidade: number
  custoUnitario: number
  custoTotal: number
}
export interface FichaItem {
  item: { id: string; nome: string; unidadeControle: string; categoria: string; categoriaLabel: string; ativo: boolean; estoqueMin: number | null; estoqueMax: number | null }
  saldo: number
  custoMedio: number | null
  valor: number
  status: StatusEstoqueResult
  compras: CompraLinha[]
  precoTempo: { data: string; preco: number }[] // só ENTRADA_NF (pra o gráfico)
}

export async function buildFichaItem(companyId: string, itemId: string, db: Db = defaultPrisma): Promise<FichaItem | null> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, nome: true, unidadeControle: true, categoria: true, ativo: true, estoqueMin: true, estoqueMax: true } })
  if (!item) return null

  const [saldo, movimentos] = await Promise.all([
    saldoItem(db, companyId, itemId),
    db.stockMovement.findMany({ where: { companyId, itemId }, orderBy: { dataMovimento: 'desc' }, select: { id: true, tipo: true, quantidade: true, custoUnitario: true, custoTotal: true, nfeChave: true, receiptId: true, dataMovimento: true } }),
  ])

  // fornecedor por chave (uma consulta pra as chaves distintas)
  const chaves = [...new Set(movimentos.map((m) => m.nfeChave).filter((c): c is string => !!c))]
  const notas = chaves.length ? await db.stockNfe.findMany({ where: { companyId, chave: { in: chaves } }, select: { chave: true, emitNome: true } }) : []
  const fornecedorPorChave = new Map(notas.map((n) => [n.chave, n.emitNome]))

  const compras: CompraLinha[] = movimentos.map((m) => ({
    movimentoId: m.id,
    data: m.dataMovimento.toISOString(),
    tipo: m.tipo,
    estorno: m.tipo === 'ESTORNO',
    fornecedor: m.nfeChave ? fornecedorPorChave.get(m.nfeChave) ?? null : null,
    notaChave: m.nfeChave,
    nNF: nNFdaChave(m.nfeChave),
    conferenceId: m.receiptId,
    quantidade: m.quantidade,
    custoUnitario: m.custoUnitario,
    custoTotal: m.custoTotal,
  }))

  const precoTempo = movimentos
    .filter((m) => m.tipo === 'ENTRADA_NF')
    .sort((a, b) => a.dataMovimento.getTime() - b.dataMovimento.getTime())
    .map((m) => ({ data: m.dataMovimento.toISOString().slice(0, 10), preco: m.custoUnitario }))

  return {
    item: { ...item, categoriaLabel: CAT_LABEL[item.categoria] ?? item.categoria },
    saldo: saldo.saldo,
    custoMedio: saldo.custoMedio,
    valor: saldo.valor,
    status: statusEstoque(saldo.saldo, item.estoqueMin, item.estoqueMax),
    compras,
    precoTempo,
  }
}
