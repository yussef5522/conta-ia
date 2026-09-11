// ESTOQUE FASE 1 item 2 — o EXTRATO do estoque (lê o ledger). Filtros item/tipo/período,
// referência clicável, estorno destacado, quem lançou. Só LÊ.
//
// ⛔⛔ **A MESMA MENTIRA DO HISTÓRICO DO ITEM VIVIA AQUI (corrigido 08/09/2026):** a
// `referencia` colapsava **tudo** que não tinha nota em `{ tipo: 'conferencia', label:
// 'conferência' }` — então movimento de produção, contagem e baixa de venda apareciam como
// "conferência" no extrato. Duas telas, a mesma pergunta, duas respostas erradas.
//
// ⭐ Agora as duas leem `movimento-explicado.ts` (REGRA 4). A `referencia` continua no
// payload **só pra não quebrar o consumidor atual**, derivada da explicação.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { explicarMovimentos, dobrarProducao, colapsarAnulados, anotarSaldo, somaDasLinhas, type ParAnulado } from './movimento-explicado'
import { saldosDaEmpresa } from './saldo'

type Db = PrismaClient | Prisma.TransactionClient

export interface MovimentoLinha {
  id: string
  data: string
  tipo: string
  estorno: boolean
  estornoDeId: string | null
  itemId: string
  itemNome: string
  quantidade: number
  custoUnitario: number
  custoTotal: number
  referencia: { tipo: 'nota' | 'conferencia' | null; label: string; nfeId: string | null }
  quem: string
  /** ⭐ o TIPO real com a cara dele (chip), o de-onde-veio e o link — o dono único */
  chip: string
  detalhe: string
  href: string | null
  /** ⛔ esta linha mexeu no saldo? (a MESMA pergunta do `saldo.ts`) */
  movePrateleira: boolean
  /** a história do que saiu pra produção, dentro da linha da separação */
  dentroDaProducao: { separado: number; consumido: number; devolvido: number; emProducao: number } | null
  /** ⭐ par movimento+estorno colapsado numa linha fina (null = linha normal) */
  anulado: ParAnulado | null
  /** ⭐ quanto o ITEM tinha depois desta linha · `null` quando o recorte não permite afirmar */
  saldoApos: number | null
}

export interface MovimentosFiltro {
  itemId?: string; tipo?: string; de?: string; ate?: string; limite?: number
  /**
   * ⭐ MODO FORENSE (11/09): abre os pares que se anulam. O padrão é CLEAN — par desfeito
   * por inteiro vira UMA linha fina, porque pra entender "o que aconteceu com meu estoque"
   * ele é ruído. ⛔ Nada é apagado: o forense devolve a lista crua.
   */
  forense?: boolean
}

export async function listMovimentos(companyId: string, filtro: MovimentosFiltro = {}, db: Db = defaultPrisma): Promise<MovimentoLinha[]> {
  const where: Prisma.StockMovementWhereInput = { companyId }
  if (filtro.itemId) where.itemId = filtro.itemId
  if (filtro.tipo) where.tipo = filtro.tipo
  if (filtro.de || filtro.ate) where.dataMovimento = { ...(filtro.de ? { gte: new Date(`${filtro.de}T00:00:00`) } : {}), ...(filtro.ate ? { lte: new Date(`${filtro.ate}T23:59:59`) } : {}) }

  const limite = filtro.limite ?? 500
  const movs = await db.stockMovement.findMany({ where, orderBy: { dataMovimento: 'desc' }, take: limite })

  /**
   * ⛔⛔ A COLUNA SALDO SÓ EXISTE QUANDO A LISTA É CONTÍGUA ATÉ HOJE.
   *
   * O saldo de um instante desce do saldo de HOJE descontando tudo que veio depois — então
   * se o recorte **não tem** todas as linhas mais recentes daquele item, o número não é
   * derivável. Filtro por TIPO, período que fecha antes de hoje ou limite estourado quebram
   * a contiguidade. ⚠️ Nesses casos a coluna vem `null` e a tela diz "—": um número de
   * estoque plausível e errado é a mentira mais cara que esta tela poderia contar.
   */
  const contiguo = !filtro.tipo && !filtro.ate && movs.length < limite

  const itemIds = [...new Set(movs.map((m) => m.itemId))]
  const chaves = [...new Set(movs.map((m) => m.nfeChave).filter((c): c is string => !!c))]
  const [items, notas, explicadasCruas, saldosHoje] = await Promise.all([
    itemIds.length ? db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true } }) : Promise.resolve([]),
    chaves.length ? db.stockNfe.findMany({ where: { companyId, chave: { in: chaves } }, select: { id: true, chave: true } }) : Promise.resolve([]),
    explicarMovimentos(companyId, movs, db).then(dobrarProducao).then((ls) => (filtro.forense ? ls : colapsarAnulados(ls))),
    contiguo ? saldosDaEmpresa(db, companyId) : Promise.resolve([]),
  ])
  const explicadas = contiguo
    ? anotarSaldo(explicadasCruas, new Map(saldosHoje.map((s) => [s.itemId, s.saldo])))
    : explicadasCruas
  const itemNome = new Map(items.map((i) => [i.id, i.nome]))
  const nfeIdPorChave = new Map(notas.map((n) => [n.chave, n.id]))
  const expPorId = new Map(explicadas.map((e) => [e.movimentoId, e]))

  // ⛔⛔ A REGRA DO HISTÓRICO HONESTO vale AQUI TAMBÉM (09/09): o consumo de produção some da
  // lista (dobrado dentro da separação) porque não move o saldo. Extrato que soma o que o
  // saldo não conta mente com cara de contabilidade.
  // ⚠️ A LISTA NASCE DAS LINHAS EXPLICADAS, não de `movs`: a linha ANULADA é sintética
  // (id `anulado:<id>`) e não existe no cru — montar a partir de `movs` a deixaria de fora,
  // que é o bug de "some da tela" que esta tela inteira existe pra não ter.
  const cruPorId = new Map(movs.map((m) => [m.id, m]))
  return explicadas.map((e) => {
    const m = cruPorId.get(e.movimentoId)
    return {
      id: e.movimentoId,
      data: e.data + 'T12:00:00.000Z',
      tipo: e.tipo,
      estorno: e.tipo === 'ESTORNO',
      estornoDeId: e.estornoDe?.movimentoId ?? null,
      itemId: e.itemId,
      itemNome: itemNome.get(e.itemId) ?? '(item removido)',
      quantidade: e.quantidade,
      custoUnitario: e.custoUnitario,
      custoTotal: e.custoTotal,
      // ⚠️ compat: `referencia` sobrevive pro CSV e pro consumidor atual, mas o LABEL agora
      // vem da explicação — nunca mais "conferência" em cima de uma ordem de produção.
      referencia: {
        tipo: m?.nfeChave ? 'nota' : m?.receiptId ? 'conferencia' : null,
        label: e.detalhe,
        nfeId: m?.nfeChave ? nfeIdPorChave.get(m.nfeChave) ?? null : null,
      },
      // ⚠️ sem autor, a origem ('SEFAZ'/'MANUAL') diz de ONDE veio em vez de inventar um nome
      quem: e.quem ?? m?.origem ?? '—',
      chip: e.chip,
      detalhe: e.detalhe,
      href: e.href,
      movePrateleira: e.movePrateleira,
      dentroDaProducao: e.dentroDaProducao,
      anulado: e.anulado,
      saldoApos: e.saldoApos,
    }
  })
}

/** ⭐ a soma que o extrato exibe — a mesma régua do saldo (o teste trava a igualdade) */
export function somaDoExtrato(linhas: MovimentoLinha[]): { quantidade: number; valor: number } {
  return somaDasLinhas(linhas.map((l) => ({ ...l, movimentoId: l.id }) as never))
}

/** CSV do extrato (o dono exporta pra planilha). */
export function movimentosToCsv(linhas: MovimentoLinha[]): string {
  const head = ['Data', 'Tipo', 'Item', 'Quantidade', 'Custo unit.', 'Custo total', 'Referência', 'Quem']
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const rows = linhas.map((l) => [
    l.data.slice(0, 10).split('-').reverse().join('/'), l.tipo, l.itemNome,
    String(l.quantidade).replace('.', ','), l.custoUnitario.toFixed(2).replace('.', ','), l.custoTotal.toFixed(2).replace('.', ','),
    l.referencia.label, l.quem,
  ].map(esc).join(';'))
  return [head.map(esc).join(';'), ...rows].join('\n')
}
