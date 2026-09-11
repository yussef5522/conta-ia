// ESTOQUE FASE 1 item 2 — POSIÇÃO de estoque (a tela de trabalho diária). Saldo DERIVADO
// (Σ movimentos) por item, com custo médio, valor, ÚLTIMA ENTRADA (idade) e TENDÊNCIA
// do custo (subiu/desceu vs a compra anterior). Nasce vazia; enche por conferência. Só LÊ.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldosDaEmpresa } from './saldo'
import { statusEstoque, type StatusEstoqueResult } from './status-estoque'
import { seContaFisicamente } from './tipos-ficha'

type Db = PrismaClient | Prisma.TransactionClient

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno', INTERMEDIARIO: 'Intermediário', PRODUTO_FINAL: 'Produto final' }
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
    // ⛔⛔ A POSIÇÃO É A PRATELEIRA FÍSICA (09/09/2026): o invólucro de PRODUTO_FINAL e de
    // SABOR é a LINHA DO CARDÁPIO, não coisa que se estoca. Com as 25 fichas de bebida, cada
    // refrigerante passou a aparecer DUAS vezes aqui — a garrafa da nota e a linha do menu —
    // e foi na linha do menu que a contagem foi feita, criando 9 ajustes fantasma.
    db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true, categoria: true, unidadeControle: true, estoqueMin: true, estoqueMax: true, ativo: true } }),
  ])
  const byId = new Map(items.map((i) => [i.id, i]))
  // por item: última entrada + tendência (últimos 2 preços de compra)
  const entradasPorItem = new Map<string, { data: Date; preco: number }[]>()
  for (const e of entradas) {
    const arr = entradasPorItem.get(e.itemId) ?? []
    arr.push({ data: e.dataMovimento, preco: e.custoUnitario })
    entradasPorItem.set(e.itemId, arr)
  }

  /**
   * ⭐⭐⭐ A POSIÇÃO PARTE DO CATÁLOGO, NÃO DO LEDGER (11/09/2026).
   *
   * **O dono, depois de criar a receita:** *"o item produzido não está na Posição junto
   * com as outras porções"*. Medido: a lista nascia de `saldosDaEmpresa`, que é um
   * `groupBy` em `stockMovement` — **item sem nenhum movimento não existia pra ela**.
   *
   * ⛔ E não era só o dele: **9 itens ativos estavam invisíveis**, entre eles o `tomate`,
   * o `gas` e a `HEINEKEN LONG NECK ZERO` — justamente uma das bebidas que em 09/09
   * registramos como *"nasce com saldo 0 e entra na fila de contagem"*. Elas entraram na
   * contagem e **sumiram da tela onde o dono confere o estoque**: o item existe, se conta,
   * e não aparecia. É a família do *"erro disfarçado de vazio"*.
   *
   * ⭐ A RÉGUA HONESTA: a Posição é a PRATELEIRA — e prateleira com zero unidades continua
   * sendo uma linha da prateleira. Saldo 0 é um FATO ("não tem"), não uma ausência de
   * dado. ⚠️ O valor total não muda: zero não soma.
   */
  const daPrateleira = items.filter((i) => i.ativo !== false && seContaFisicamente(i.categoria))
  const saldoPorItem = new Map(saldos.map((s) => [s.itemId, s]))
  // ⚠️ E o que tem SALDO mas sumiu do cadastro continua aparecendo como "(item removido)":
  // esconder por ausência de cadastro esconderia estoque de verdade.
  const orfaosComSaldo = saldos.filter((s) => !byId.has(s.itemId))
  const universo = [
    ...daPrateleira.map((i) => saldoPorItem.get(i.id) ?? { itemId: i.id, saldo: 0, custoMedio: null, valor: 0 }),
    ...orfaosComSaldo,
  ]

  const itens: PosicaoItem[] = universo.map((s) => {
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
  })
    // ⭐ ITEM ARQUIVADO (e o MESCLADO) SAEM DA POSIÇÃO — pedido do dono: a peça comprada
    // uma vez poluía a lista pra sempre. O saldo e o histórico continuam no ledger; some
    // só da VISTA. Item que sumiu do cadastro (`ativo` ausente) continua aparecendo —
    // sumir por ausência de dado esconderia saldo de verdade.
    // ⚠️ o mesclado já sai por `ativo=false`; o filtro do Catálogo é que precisava do
    // registro próprio, porque lá o dono LIGA "mostrar inativos".
    // ⚠️ os dois filtros abaixo continuam: o universo já nasce filtrado, mas os ÓRFÃOS
    // com saldo entram por fora e passam por aqui (e é por isso que o `ativo !== false`
    // ainda usa o `?.` — item sem cadastro não é item inativo).
    .filter((i) => byId.get(i.itemId)?.ativo !== false)
    // ⛔ e o invólucro do cardápio (PRODUTO_FINAL / SABOR) sai junto: a Posição responde
    // "o que tem na prateleira", e a linha do menu não é coisa que se estoca. Mesma régua
    // da contagem — uma pergunta, uma função (`seContaFisicamente`).
    .filter((i) => seContaFisicamente(i.categoria))
    .sort((a, b) => b.valor - a.valor)

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
