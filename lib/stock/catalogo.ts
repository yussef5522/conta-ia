// ESTOQUE PARTE B — CATÁLOGO de itens. Mostra TODOS (inclusive saldo zero, que a Posição
// esconde — ela só lista quem tem movimento). Item manual nasce SEM saldo e SEM custo ("a
// definir"); saldo só por nota/produção/contagem — o ledger é a única fonte. Só LÊ.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { custoMedioPorItem, saldosDaEmpresa } from './saldo'

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno', INTERMEDIARIO: 'Intermediário', PRODUTO_FINAL: 'Produto final' }

export interface CatalogoItem {
  id: string
  nome: string
  unidadeControle: string
  categoria: string
  categoriaLabel: string
  produzido: boolean // INTERMEDIARIO|PRODUTO_FINAL (só via ficha, não editável aqui)
  ativo: boolean
  saldo: number
  custoMedio: number | null
  estoqueMin: number | null
  estoqueMax: number | null
  criadoVia: string
}

export async function listCatalogo(companyId: string, db: PrismaClient = defaultPrisma): Promise<CatalogoItem[]> {
  const [itens, saldos, custoMap] = await Promise.all([
    db.stockItem.findMany({ where: { companyId }, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }], select: { id: true, nome: true, unidadeControle: true, categoria: true, ativo: true, estoqueMin: true, estoqueMax: true, criadoVia: true } }),
    saldosDaEmpresa(db, companyId),
    custoMedioPorItem(db, companyId),
  ])
  const saldoDe = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  return itens.map((i) => ({
    id: i.id, nome: i.nome, unidadeControle: i.unidadeControle, categoria: i.categoria,
    categoriaLabel: CAT_LABEL[i.categoria] ?? i.categoria,
    produzido: i.categoria === 'INTERMEDIARIO' || i.categoria === 'PRODUTO_FINAL',
    ativo: i.ativo, saldo: saldoDe.get(i.id) ?? 0, custoMedio: custoMap.get(i.id) ?? null,
    estoqueMin: i.estoqueMin, estoqueMax: i.estoqueMax, criadoVia: i.criadoVia,
  }))
}
