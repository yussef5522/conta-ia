// ⭐⭐ DESTRAVAR O DIA GRAVADO PELA METADE — A REGRA DA CONTAGEM (16/11/2026).
//
// ⛔ O CASO: 15/11 caiu na trava ("XIS COMPLETO: 88 num dia — o normal é 1", histórico envenenado por
// gêmeo de grafia) e foi gravado PELA METADE: import + linhas sim, BAIXA de produto não (114 produtos,
// 759 un). O dono já contou o estoque em 16/11 — a coca (−28) e a porção de queijo, entre outros.
//
// ⭐ A REGRA (decisão do dono, "contagem é verdade absoluta"), POR ITEM DE ESTOQUE que o dia manda baixar:
//   · teve QUALQUER contagem/ajuste (tipo AJUSTE_*) desde o início do dia (D 06:00 de Brasília) →
//     NÃO baixa: a contagem já absorveu o erro. Só lista como "coberto por contagem".
//   · não teve → aplica a baixa que faltou, DATADA no dia D (12:00 local, como toda baixa de venda),
//     no MESMO recibo (o import do dia), pela MESMA porta de custo (`estadoParaBaixa` → `custoDaBaixa`
//     → `criarMovimento`).
//   · o dia sai de AGUARDANDO_DONO como RESOLVIDO_PELA_CONTAGEM, com a frase de como foi resolvido.
// ⛔ Só roda sobre o meio-estado LEGADO (import com ZERO baixa ativa). Dia que já tem baixa é recusado —
// rodar duas vezes nunca duplica.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { montarPlanoReprocesso } from './baixa-venda'
import { criarMovimento, MovementInvalidError } from '../movement'
import { recomputeSaldoCache } from '../saldo'
import { custoDaBaixa, estadoParaBaixa } from './custo-da-baixa'
import { resolverAviso } from '@/lib/avisos/central'
import { ORIGEM_BAIXA_DO_FECHAMENTO } from './baixou-na-hora'

export const STATUS_RESOLVIDO_PELA_CONTAGEM = 'RESOLVIDO_PELA_CONTAGEM'
const ORIGEM_DIA_PARADO = 'SUIT_DIA_PARADO'

export class DiaNaoDestravavelError extends Error {
  constructor(msg: string) { super(msg); this.name = 'DiaNaoDestravavelError' }
}

export interface ItemDoDiaParado { itemId: string; nome: string; qtd: number }
export interface PlanoDoDiaParado {
  dia: string
  importId: string
  aplicar: ItemDoDiaParado[]
  cobertos: (ItemDoDiaParado & { contadoEm: string; tipo: string })[]
}

/** o início do dia operacional em Brasília (06:00 local = 09:00Z) — a partir daqui, contagem cobre */
export const inicioDoDia = (dia: string) => new Date(`${dia}T09:00:00.000Z`)

/** ⭐ DRY-RUN: o que seria baixado e o que está coberto por contagem. Só lê. */
export async function planoDoDiaParado(companyId: string, dia: string, db: PrismaClient = defaultPrisma): Promise<PlanoDoDiaParado> {
  const mat = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { status: true, importId: true } })
  if (!mat || mat.status !== 'AGUARDANDO_DONO' || !mat.importId) throw new DiaNaoDestravavelError(`o dia ${dia} não está parado com as vendas gravadas pela metade`)
  const ativas = await db.stockMovement.count({ where: { companyId, receiptId: mat.importId, tipo: 'BAIXA_VENDA' } })
  if (ativas > 0) throw new DiaNaoDestravavelError(`o dia ${dia} já tem ${ativas} baixas no recibo — destravar baixaria duas vezes`)
  const r = await montarPlanoReprocesso(companyId, dia, db)
  if (!r) throw new DiaNaoDestravavelError(`o dia ${dia} não tem import`)
  const itens = r.plano.agregada.filter((a) => a.qtd > 0)
  const contagens = itens.length ? await db.stockMovement.findMany({
    where: { companyId, itemId: { in: itens.map((i) => i.itemId) }, tipo: { startsWith: 'AJUSTE' }, dataMovimento: { gte: inicioDoDia(dia) } },
    select: { itemId: true, tipo: true, dataMovimento: true }, orderBy: { dataMovimento: 'asc' },
  }) : []
  const primeira = new Map<string, { tipo: string; dataMovimento: Date }>()
  for (const c of contagens) if (!primeira.has(c.itemId)) primeira.set(c.itemId, c)
  const aplicar: ItemDoDiaParado[] = []
  const cobertos: PlanoDoDiaParado['cobertos'] = []
  for (const a of itens) {
    const c = primeira.get(a.itemId)
    if (c) cobertos.push({ itemId: a.itemId, nome: a.nome, qtd: a.qtd, contadoEm: c.dataMovimento.toISOString(), tipo: c.tipo })
    else aplicar.push({ itemId: a.itemId, nome: a.nome, qtd: a.qtd })
  }
  return { dia, importId: mat.importId, aplicar, cobertos }
}

const diaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** ⭐ APLICA a regra da contagem (a escrita autorizada do dono). Tudo-ou-nada numa transação. */
export async function destravarDiaParadoPelaContagem(
  companyId: string, dia: string, aplicadoEm: string, db: PrismaClient = defaultPrisma,
): Promise<PlanoDoDiaParado & { movimentos: number; barrados: { nome: string; motivo: string }[] }> {
  const plano = await planoDoDiaParado(companyId, dia, db)
  const dataDate = new Date(`${dia}T12:00:00`)
  const barrados: { nome: string; motivo: string }[] = []
  let movimentos = 0
  await db.$transaction(async (tx) => {
    // ⛔ confere DE NOVO dentro da transação: ninguém baixou este recibo no meio
    const ativas = await tx.stockMovement.count({ where: { companyId, receiptId: plano.importId, tipo: 'BAIXA_VENDA' } })
    if (ativas > 0) throw new DiaNaoDestravavelError(`o dia ${dia} ganhou baixas no meio — nada foi gravado`)
    const estado = await estadoParaBaixa(tx, companyId)
    for (const a of plano.aplicar) {
      const { custoUnitario, custoTotal } = custoDaBaixa(a.itemId, a.qtd, estado)
      try {
        await criarMovimento(tx, { companyId, itemId: a.itemId, tipo: 'BAIXA_VENDA', quantidade: -a.qtd, custoUnitario, custoTotal, receiptId: plano.importId, origem: ORIGEM_BAIXA_DO_FECHAMENTO, criadoPorId: null, dataMovimento: dataDate })
        movimentos++
      } catch (e) {
        if (e instanceof MovementInvalidError) { barrados.push({ nome: e.culpado?.nome ?? a.nome, motivo: e.message }); continue }
        throw e
      }
    }
    // ⛔ item barrado não passa calado: a transação inteira volta e a lista sobe
    if (barrados.length) throw new DiaNaoDestravavelError(`${barrados.length} itens barrados: ${barrados.map((b) => b.nome).join(', ')} — nada foi gravado`)
    await tx.suitDiaMaterializado.update({
      where: { companyId_dia: { companyId, dia } },
      data: {
        status: STATUS_RESOLVIDO_PELA_CONTAGEM,
        motivo: `baixa do dia parado, aplicada em ${diaBr(aplicadoEm)}: ${plano.aplicar.length} itens baixados · ${plano.cobertos.length} cobertos por contagem (não baixados)`,
        atualizadoEm: new Date(),
      },
    })
  }, { timeout: 60_000, maxWait: 10_000 })
  await recomputeSaldoCache(db, companyId)
  await resolverAviso(companyId, ORIGEM_DIA_PARADO, dia, db)
  return { ...plano, movimentos, barrados }
}
