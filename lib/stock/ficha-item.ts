// ESTOQUE FASE 1 — FICHA do produto. Só LÊ o ledger (stock_movement) + o item.
//
// ⛔⛔ **ELA NUNCA FOI "HISTÓRICO DE COMPRAS" (corrigido 08/09/2026).** O comentário original
// dizia *"preparada pra crescer (consumo/contagem/produção nas próximas fases leem os mesmos
// movimentos)"* — e as fases chegaram, os movimentos entraram, **e o rótulo ficou**. O
// `findMany` nunca teve filtro de tipo: o ledger inteiro caía num campo chamado `compras`,
// com interface `CompraLinha`. Medido no BACON: **16 de 19 linhas não eram compra e 14 eram
// negativas**, exibidas sob a coluna "Preço un.".
//
// ⭐ Agora é o que sempre foi: o **HISTÓRICO DO ITEM**. Quem diz o que cada linha é, quem fez
// e de onde veio é `movimento-explicado.ts` — o MESMO dono que o extrato usa (REGRA 4).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldoItem } from './saldo'
import { statusEstoque, type StatusEstoqueResult } from './status-estoque'
import { explicarMovimentos, tiposPresentes, type LinhaDoHistorico } from './movimento-explicado'

type Db = PrismaClient | Prisma.TransactionClient

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno', INTERMEDIARIO: 'Intermediário', PRODUTO_FINAL: 'Produto final' }

// nNF vem embutido na chave (posições 25..33, 9 dígitos).
const nNFdaChave = (chave: string | null) => (chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null)

export interface FichaItem {
  item: { id: string; nome: string; unidadeControle: string; categoria: string; categoriaLabel: string; ativo: boolean; estoqueMin: number | null; estoqueMax: number | null }
  saldo: number
  custoMedio: number | null
  valor: number
  status: StatusEstoqueResult
  /** ⭐ TUDO que aconteceu com este item — entradas E saídas, cada linha com tipo/quem/origem */
  historico: LinhaDoHistorico[]
  /** os tipos que existem NESTE item — o filtro não oferece opção vazia */
  tipos: { tipo: string; chip: string; n: number }[]
  precoTempo: { data: string; preco: number }[] // só ENTRADA_NF (pra o gráfico)
}

export async function buildFichaItem(companyId: string, itemId: string, db: Db = defaultPrisma): Promise<FichaItem | null> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, nome: true, unidadeControle: true, categoria: true, ativo: true, estoqueMin: true, estoqueMax: true } })
  if (!item) return null

  const [saldo, movimentos] = await Promise.all([
    saldoItem(db, companyId, itemId),
    db.stockMovement.findMany({
      where: { companyId, itemId },
      orderBy: { dataMovimento: 'desc' },
      select: {
        id: true, tipo: true, quantidade: true, custoUnitario: true, custoTotal: true,
        nfeChave: true, receiptId: true, estornoDeId: true, dataMovimento: true,
        criadoPorId: true, origem: true,
      },
    }),
  ])

  const historico = await explicarMovimentos(companyId, movimentos, db)

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
    historico,
    tipos: tiposPresentes(historico),
    precoTempo,
  }
}
