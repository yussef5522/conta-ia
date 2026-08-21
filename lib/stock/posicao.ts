// ESTOQUE FASE 1 item 2 — POSIÇÃO de estoque (a tela de trabalho diária). Saldo DERIVADO
// (Σ movimentos) por item, com custo médio, valor, ÚLTIMA ENTRADA (idade) e TENDÊNCIA
// do custo (subiu/desceu vs a compra anterior). Nasce vazia; enche por conferência. Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldosDaEmpresa } from './saldo'
import { statusEstoque, type StatusEstoqueResult } from './status-estoque'

type Db = PrismaClient | Prisma.TransactionClient

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno' }
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface PosicaoItem {
  itemId: string
  nome: string
  categoria: string
  categoriaLabel: string
  unidadeControle: string
  saldo: number
  custoMedio: number | null
  valor: number
  negativo: boolean
  ultimaEntrada: string | null // ISO
  ultimaEntradaDias: number | null
  custoTendencia: 'subiu' | 'desceu' | 'igual' | null // último preço de compra vs o anterior
  estoqueMin: number | null
  estoqueMax: number | null
  status: StatusEstoqueResult // fonte única (lib/stock/status-estoque)
}
export interface PosicaoData {
  itens: PosicaoItem[]
  valorTotal: number
  porCategoria: { categoria: string; label: string; valor: number; itens: number }[]
}

export async function listPosicao(companyId: string, db: Db = defaultPrisma, agora = new Date()): Promise<PosicaoData> {
  const [saldos, entradas, items] = await Promise.all([
    saldosDaEmpresa(db, companyId),
    db.stockMovement.findMany({ where: { companyId, tipo: 'ENTRADA_NF' }, select: { itemId: true, custoUnitario: true, dataMovimento: true }, orderBy: { dataMovimento: 'asc' } }),
    db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true, categoria: true, unidadeControle: true, estoqueMin: true, estoqueMax: true } }),
  ])
  const byId = new Map(items.map((i) => [i.id, i]))
  // por item: última entrada + tendência (últimos 2 preços de compra)
  const entradasPorItem = new Map<string, { data: Date; preco: number }[]>()
  for (const e of entradas) {
    const arr = entradasPorItem.get(e.itemId) ?? []
    arr.push({ data: e.dataMovimento, preco: e.custoUnitario })
    entradasPorItem.set(e.itemId, arr)
  }

  const itens: PosicaoItem[] = saldos.map((s) => {
    const it = byId.get(s.itemId)
    const ent = entradasPorItem.get(s.itemId) ?? []
    const ultima = ent[ent.length - 1]
    let tendencia: PosicaoItem['custoTendencia'] = null
    if (ent.length >= 2) {
      const dif = round2(ent[ent.length - 1].preco - ent[ent.length - 2].preco)
      tendencia = dif > 0.001 ? 'subiu' : dif < -0.001 ? 'desceu' : 'igual'
    }
    return {
      itemId: s.itemId,
      nome: it?.nome ?? '(item removido)',
      categoria: it?.categoria ?? 'USO_INTERNO',
      categoriaLabel: CAT_LABEL[it?.categoria ?? 'USO_INTERNO'] ?? it?.categoria ?? '—',
      unidadeControle: it?.unidadeControle ?? '—',
      saldo: s.saldo,
      custoMedio: s.custoMedio,
      valor: s.valor,
      negativo: s.saldo < 0,
      ultimaEntrada: ultima?.data.toISOString() ?? null,
      ultimaEntradaDias: ultima ? Math.floor((agora.getTime() - ultima.data.getTime()) / 86_400_000) : null,
      custoTendencia: tendencia,
      estoqueMin: it?.estoqueMin ?? null,
      estoqueMax: it?.estoqueMax ?? null,
      status: statusEstoque(s.saldo, it?.estoqueMin ?? null, it?.estoqueMax ?? null),
    }
  }).sort((a, b) => b.valor - a.valor)

  const catMap = new Map<string, { valor: number; itens: number }>()
  for (const i of itens) {
    const c = catMap.get(i.categoria) ?? { valor: 0, itens: 0 }
    c.valor = round2(c.valor + i.valor); c.itens++
    catMap.set(i.categoria, c)
  }

  return {
    itens,
    valorTotal: round2(itens.reduce((s, i) => s + i.valor, 0)),
    porCategoria: [...catMap.entries()].map(([categoria, v]) => ({ categoria, label: CAT_LABEL[categoria] ?? categoria, valor: v.valor, itens: v.itens })).sort((a, b) => b.valor - a.valor),
  }
}

const STATUS_CSV: Record<string, string> = { ABAIXO: 'abaixo do mínimo', DENTRO: 'dentro da faixa', ACIMA: 'acima do máximo', SEM_MIN: 'sem mínimo' }

/** CSV da posição (o dono exporta pra planilha). ; + vírgula decimal + BOM = Excel BR. */
export function posicaoToCsv(data: PosicaoData): string {
  const head = ['Item', 'Categoria', 'Unidade', 'Saldo', 'Mínimo', 'Máximo', 'Status', 'Custo médio', 'Valor']
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
  const dec = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))
  const rows = data.itens.map((i) => [
    i.nome, i.categoriaLabel, i.unidadeControle, dec(i.saldo), dec(i.estoqueMin), dec(i.estoqueMax),
    STATUS_CSV[i.status.status] ?? i.status.status, i.custoMedio != null ? i.custoMedio.toFixed(2).replace('.', ',') : '', i.valor.toFixed(2).replace('.', ','),
  ].map(esc).join(';'))
  return [head.map(esc).join(';'), ...rows].join('\n')
}
