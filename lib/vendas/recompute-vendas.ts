// VENDAS FASE 1 item 3 (17/08) — recompute idempotente da VendaDiaria. Deriva de
// Transaction (fonte primária), NUNCA o contrário. Roda após cada import de extrato
// e após categorização que toque venda. Rodar 2× = 0 mudança de conteúdo (a função
// pura é determinística; aqui delete+insert só do EXTRATO_INFERIDO, AJUSTE_DONO
// intocado). ⭐ Competência < moduleInicio (12/08) é descartada pela função pura.

import type { PrismaClient, Prisma } from '@prisma/client'
import { computeVendasDiarias, type VendaTxInput } from './compute-vendas-diarias'
import { feriadosNacionaisAnos } from './feriados-nacionais'
import type { Meio, RegraRecebimento } from './perfil-recebimento'

type Db = PrismaClient | Prisma.TransactionClient

export interface RecomputeResult {
  vendasCriadas: number
  origensLinkadas: number
  valorTotal: number
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function recomputeVendas(
  db: Db,
  companyId: string,
  moduleInicio: Date,
): Promise<RecomputeResult> {
  // 1. Perfil (regras) → meio por conta.
  const regrasDb = await db.regraRecebimento.findMany({ where: { companyId } })
  const regras: RegraRecebimento[] = regrasDb.map((r) => ({
    bankAccountId: r.bankAccountId, meio: r.meio as Meio, diasUteisAtraso: r.diasUteisAtraso,
    recebeSabDom: r.recebeSabDom, vigenteDe: r.vigenteDe, vigenteAte: r.vigenteAte,
    origemHint: r.origemHint, confirmadoPeloDono: r.confirmadoPeloDono,
  }))
  const meioPorConta = new Map<string, Meio>()
  for (const r of regras) meioPorConta.set(r.bankAccountId, r.meio as Meio)
  const contasVenda = [...meioPorConta.keys()]
  if (contasVenda.length === 0) return { vendasCriadas: 0, origensLinkadas: 0, valorTotal: 0 }

  // 2. Categorias de venda (RECEITA_BRUTA) da empresa; estorno pelo NOME.
  const cats = await db.category.findMany({ where: { companyId, dreGroup: 'RECEITA_BRUTA' }, select: { id: true, name: true } })
  const catIds = cats.map((c) => c.id)
  const estornoCatIds = new Set(cats.filter((c) => /estorno/i.test(c.name)).map((c) => c.id))

  // 3. Transactions de venda das contas com regra, a partir do início do módulo.
  const txs = await db.transaction.findMany({
    where: { bankAccountId: { in: contasVenda }, categoryId: { in: catIds }, date: { gte: meiaNoite(moduleInicio) } },
    select: { id: true, bankAccountId: true, date: true, amount: true, type: true, categoryId: true, createdAt: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  const inputs: VendaTxInput[] = txs.map((t) => {
    const isEstorno = (t.categoryId && estornoCatIds.has(t.categoryId)) || t.type !== 'CREDIT'
    const signed = t.type === 'CREDIT' ? t.amount : -t.amount
    return {
      id: t.id,
      bankAccountId: t.bankAccountId!,
      meio: meioPorConta.get(t.bankAccountId!) ?? 'OUTRO',
      date: t.date,
      valorLiquido: signed,
      tipo: isEstorno ? 'ESTORNO' : 'VENDA',
      createdAt: t.createdAt,
    }
  })

  // 4. Anos de feriados que a janela toca (competência pode voltar ao ano anterior).
  const anos = new Set<number>()
  for (const t of txs) { anos.add(t.date.getUTCFullYear()); anos.add(t.date.getUTCFullYear() - 1) }
  const feriados = feriadosNacionaisAnos([...anos])

  const computadas = computeVendasDiarias(inputs, regras, feriados, moduleInicio)

  // 5. Persistência: apaga só EXTRATO_INFERIDO >= moduleInicio (AJUSTE_DONO intocado),
  //    insere as novas. Determinístico → idempotente.
  await db.vendaDiaria.deleteMany({
    where: { companyId, origem: 'EXTRATO_INFERIDO', dataCompetencia: { gte: meiaNoite(moduleInicio) } },
  })

  let origensLinkadas = 0
  let valorTotal = 0
  for (const v of computadas) {
    await db.vendaDiaria.create({
      data: {
        companyId,
        dataCompetencia: v.dataCompetencia,
        dataCompetenciaFim: v.dataCompetenciaFim,
        meio: v.meio,
        tipo: v.tipo,
        valorLiquido: v.valorLiquido,
        origem: 'EXTRATO_INFERIDO',
        status: v.status,
        isBloco: v.isBloco,
        confirmadoPerfil: v.confirmado,
        origens: { create: v.origens.map((o) => ({ transactionId: o.transactionId, valor: o.valor })) },
      },
    })
    origensLinkadas += v.origens.length
    valorTotal = round2(valorTotal + v.valorLiquido)
  }

  return { vendasCriadas: computadas.length, origensLinkadas, valorTotal }
}

const meiaNoite = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
