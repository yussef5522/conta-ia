// ⭐⭐⭐ A LIXEIRA DAS CONTAS A PAGAR (20/09/2026) — "eu NÃO lembro de ter apagado".
//
// **O dono:** *"o total de vencidas BAIXOU e eu não sei quais contas sumiram — a auditoria
// de 13/09 diz que 26 foram apagadas «por mim», mas eu não lembro disso, e hoje adicionei
// contas que podem ser as mesmas de novo."*
//
// ⭐⭐ **O QUE A MEDIÇÃO RESPONDEU (30 dias de auditoria, por dia e caminho):**
// ```
// 02/09  1 · nura                    DELETE/Transaction
// 09/09  4 · Yussef                  DELETE/Transaction
// 13/09 26 · Yussef · TODAS às 19:09 DELETE/Transaction · source "contas-a-pagar DELETE"
// 14/09  1 · Yussef                  DELETE/Transaction
// ```
// **Não existe caminho que apague sem gesto** — o `DELETE` é um por vez, com dialog de
// confirmação, e não há ação em massa. As 26 foram 26 cliques confirmados em um minuto,
// **todas do mesmo fornecedor (ODISSEA)**: tem cara de faxina de duplicata, que é
// exatamente o tipo de gesto que não fica na memória como *"apaguei contas"*.
//
// ⛔⛔ **MAS O SISTEMA NÃO TINHA ONDE MOSTRAR ISSO** — e é esse o defeito. A auditoria
// guardava, e nenhuma tela lia: *"o dono precisa VER o que sumiu pra reconhecer"*. Registro
// que ninguém desenha é a mesma família da porta sem maçaneta.
//
// ⚠️ **E O QUE ELA GUARDAVA NÃO BASTAVA PRA RESTAURAR**: só `description`, `amount` e
// `lifecycle`. Sem fornecedor, vencimento e categoria, restaurar seria **redigitar**. O
// `DELETE` passou a guardar o retrato inteiro da linha — e as 26 antigas entram com o que
// existe, marcadas como **restauração parcial**, nunca fingindo um dado que ninguém gravou.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export interface ContaRemovida {
  auditId: string
  /** o id que a conta tinha — serve pra reencontrar a amarra do estoque */
  idOriginal: string | null
  removidaEm: Date
  quem: string
  /** o caminho pelo qual ela saiu ("contas-a-pagar DELETE") */
  caminho: string
  descricao: string
  valor: number
  vencimento: Date | null
  fornecedorId: string | null
  fornecedorNome: string | null
  categoriaId: string | null
  bankAccountId: string | null
  competenceDate: Date | null
  /** ⚠️ dá pra restaurar com tudo, ou só com o que a auditoria antiga guardou? */
  restauracaoCompleta: boolean
  /** ⭐ o estoque tinha uma amarra apontando pra ela? (as órfãs do F2) */
  temAmarraDoEstoque: boolean
}

interface MetaDoDelete {
  description?: unknown; amount?: unknown; lifecycle?: unknown; source?: unknown
  supplierId?: unknown; dueDate?: unknown; categoryId?: unknown
  bankAccountId?: unknown; competenceDate?: unknown
}

const str = (v: unknown) => (typeof v === 'string' ? v : null)
const dat = (v: unknown) => (typeof v === 'string' && v ? new Date(v) : null)

/**
 * ⭐⭐ O QUE SUMIU — lido da AUDITORIA, que é onde sempre esteve.
 *
 * ⛔ Não existe tabela nova de lixeira, e é de propósito: uma cópia da conta apagada seria
 * uma **segunda fonte** do mesmo fato, e ela divergiria do audit no primeiro caso de borda.
 * O audit já é o registro; o que faltava era alguém **ler**.
 */
export async function contasRemovidas(
  companyId: string, dias = 90, db: PrismaClient = defaultPrisma,
): Promise<ContaRemovida[]> {
  const desde = new Date(Date.now() - dias * 86_400_000)
  const logs = await db.auditLog.findMany({
    where: { companyId, action: 'DELETE', entityType: 'Transaction', timestamp: { gte: desde } },
    orderBy: { timestamp: 'desc' },
    select: { id: true, entityId: true, timestamp: true, userName: true, userEmail: true, metadata: true },
  })
  if (!logs.length) return []

  const metas = logs.map((l) => (l.metadata ?? {}) as MetaDoDelete)
  const fornIds = [...new Set(metas.map((m) => str(m.supplierId)).filter((x): x is string => !!x))]
  const forn = fornIds.length
    ? new Map((await db.supplier.findMany({ where: { id: { in: fornIds } }, select: { id: true, razaoSocial: true, nomeFantasia: true } }))
        .map((f) => [f.id, f.nomeFantasia ?? f.razaoSocial]))
    : new Map<string, string>()

  // ⭐ a amarra do estoque apontando pra conta que sumiu é o F2 — e ela AJUDA a reconhecer:
  //   "esta veio de uma nota" é a informação que faz o dono lembrar do que se trata.
  const ids = logs.map((l) => l.entityId).filter((x): x is string => !!x)
  const comAmarra = ids.length
    ? new Set((await db.stockPayableLink.findMany({ where: { companyId, transactionId: { in: ids } }, select: { transactionId: true } }))
        .map((a) => a.transactionId))
    : new Set<string>()

  return logs.map((l, i): ContaRemovida => {
    const m = metas[i]
    const temTudo = !!str(m.supplierId) || !!dat(m.dueDate)
    const fid = str(m.supplierId)
    return {
      auditId: l.id,
      idOriginal: l.entityId ?? null,
      removidaEm: l.timestamp,
      quem: l.userName ?? l.userEmail ?? '—',
      caminho: str(m.source) ?? 'desconhecido',
      descricao: str(m.description) ?? '(sem descrição)',
      valor: typeof m.amount === 'number' ? m.amount : 0,
      vencimento: dat(m.dueDate),
      fornecedorId: fid,
      fornecedorNome: fid ? forn.get(fid) ?? null : null,
      categoriaId: str(m.categoryId),
      bankAccountId: str(m.bankAccountId),
      competenceDate: dat(m.competenceDate),
      restauracaoCompleta: temTudo,
      temAmarraDoEstoque: !!l.entityId && comAmarra.has(l.entityId),
    }
  })
}

export interface ContaParecida { id: string; descricao: string; valor: number; vencimento: Date | null; criadaEm: Date }

/**
 * ⭐⭐ O AVISO DE DUPLICATA — *"eu já recriei parecida hoje"*.
 *
 * ⚠️ A régua é **fornecedor + valor + vencimento**, e não o texto: a conta recriada à mão
 * quase nunca tem a mesma descrição da que veio da nota (*"ODISSEA — NF 710 (parcela 001)"*
 * contra *"odissea"*). Casar por descrição deixaria passar exatamente o caso que o dono
 * teme.
 *
 * ⛔ E ela **avisa, não bloqueia**: duas contas iguais existem no mundo real (duas notas do
 * mesmo valor no mesmo dia). Quem decide é ele, com as duas lado a lado.
 */
export async function parecidasComARemovida(
  companyId: string, r: ContaRemovida, db: PrismaClient = defaultPrisma,
): Promise<ContaParecida[]> {
  const contas = await db.bankAccount.findMany({ where: { companyId }, select: { id: true } })
  const achadas = await db.transaction.findMany({
    where: {
      lifecycle: 'PAYABLE',
      amount: { gte: r.valor - 0.01, lte: r.valor + 0.01 },
      ...(r.fornecedorId ? { supplierId: r.fornecedorId } : {}),
      ...(r.vencimento
        ? { dueDate: { gte: new Date(r.vencimento.getTime() - 2 * 86_400_000), lte: new Date(r.vencimento.getTime() + 2 * 86_400_000) } }
        : {}),
      OR: [{ bankAccountId: { in: contas.map((c) => c.id) } }, { bankAccountId: null }],
    },
    select: { id: true, description: true, amount: true, dueDate: true, createdAt: true },
    take: 5,
  })
  return achadas.map((a) => ({ id: a.id, descricao: a.description ?? '', valor: a.amount, vencimento: a.dueDate, criadaEm: a.createdAt }))
}

export class RestaurarError extends Error {}

/**
 * ⭐⭐ RESTAURAR — recria a conta pela **porta única** (`createContaPendente`).
 *
 * ⛔ **Não é um "undelete"**: a linha original foi apagada e o id não volta (o `delete` do
 * Prisma não guarda). O que volta é a CONTA, com os dados que a auditoria guardou — e ela
 * nasce pelo mesmo caminho do formulário, então herda todas as regras (o guard de vínculo,
 * o gatilho de vendas, o lifecycle). *Uma segunda porta de criação seria a doença que esta
 * casa mais paga.*
 *
 * ⚠️ **Sem vencimento não dá pra restaurar sozinho** — `dueDate` é o que alimenta o fluxo
 * de caixa e o DRE, e chutá-lo criaria uma conta que vence num dia que ninguém decidiu. As
 * 26 de 13/09 caem aqui: a auditoria antiga não guardava a data. A tela pede ao dono.
 */
export async function restaurarConta(
  input: { companyId: string; auditId: string; dueDate?: Date | null; categoryId?: string | null; userId: string },
  ctx: Parameters<typeof import('@/lib/contas-ap-ar/create').createContaPendente>[1],
  db: PrismaClient = defaultPrisma,
) {
  const { createContaPendente } = await import('@/lib/contas-ap-ar/create')
  const log = await db.auditLog.findFirst({
    where: { id: input.auditId, companyId: input.companyId, action: 'DELETE', entityType: 'Transaction' },
    select: { metadata: true, entityId: true },
  })
  if (!log) throw new RestaurarError('Não achei o registro dessa remoção.')
  const m = (log.metadata ?? {}) as MetaDoDelete

  const venc = input.dueDate ?? dat(m.dueDate)
  if (!venc) {
    throw new RestaurarError(
      'Essa remoção é antiga e o sistema não guardava o vencimento na época. ' +
      'Diga a data de vencimento pra eu recriar a conta — sem ela, o fluxo de caixa ficaria com uma data inventada.',
    )
  }
  const valor = typeof m.amount === 'number' ? m.amount : 0
  if (!(valor > 0)) throw new RestaurarError('O registro não guardou o valor dessa conta.')

  return createContaPendente({
    companyId: input.companyId,
    lifecycle: 'PAYABLE',
    description: str(m.description) ?? 'conta restaurada',
    amount: valor,
    dueDate: venc,
    supplierId: str(m.supplierId),
    categoryId: input.categoryId ?? str(m.categoryId),
    competenceDate: dat(m.competenceDate),
    // ⛔ nasce SEM conta bancária e SEM pagamento: restaurar é trazer a obrigação de volta,
    //    nunca reafirmar que ela foi paga — quem diz isso é a conciliação.
    bankAccountId: null,
    notes: `restaurada da lixeira em ${new Date().toISOString().slice(0, 10)} (removida antes por gesto registrado na auditoria)`,
  }, ctx)
}
