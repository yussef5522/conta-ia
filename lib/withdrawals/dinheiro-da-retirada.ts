/**
 * ⭐⭐⭐ A FILA DE RETIRADAS ENXERGA DINHEIRO, NÃO LINHA (05/11/2026)
 *
 * ⛔⛔ **O DEFEITO, medido em prod em 04/11 (zero escrita):** uma retirada vive em **DUAS
 * linhas conciliadas** — a `MANUAL` que o dono digitou e a `OFX` que o banco mandou, casadas
 * por `reconciledWithId`. É **um dinheiro**. Mas a ponte PJ→PF é `@unique` por
 * `pjTransactionId` — **uma ponte por LINHA** —, e a fila excluía por `bridge: { is: null }`
 * **na própria linha**. Resultado: o dono resolveu o lado `OFX` (3 pontes de 04/11, todas
 * corretas) e **a fila devolveu a gêmea `MANUAL`** pedindo a mesma coisa de novo:
 *
 *   escola 100,00 · escola 1.318,57 · carro 2.845,00   ← 3 fantasmas, já resolvidos
 *   formatura 190,00 ×2 · camiseta 59,00 ×2            ← os DOIS lados do par, lado a lado
 *
 * ⚠️ E não era só cosmético: o guard de `create.ts` era por linha também, então confirmar o
 * lote **criaria uma 2ª entrada no PF do mesmo dinheiro** — R$ 249,00 dobrados na hora, só
 * nos dois pares. Zero duplicata havia sido gravada (provado no banco) porque o dono foi
 * avisado a não confirmar.
 *
 * ⭐ **A unidade passa a ser o DINHEIRO: a linha e seu par conciliado.** Um dinheiro tem
 * ponte se QUALQUER um dos dois lados tem, e aparece na fila UMA vez.
 *
 * ⚠️ **Qual lado o gesto usa:** o do **extrato**, quando existir — é o valor que saiu do
 * banco de verdade, e é onde o dono já criou as 3 pontes de 04/11. O **rótulo** vem da
 * `MANUAL`, que é onde está a palavra humana (*"carro"*, *"escola"*) contra um
 * *"LM TRANSP INTER SERV COM S A - Pagamento"*. ⛔ Medido: no carro os dois valores
 * divergem (MANUAL 2.845,00 · OFX 2.849,00) — e **o PF recebeu 2.849,00**, o do extrato.
 * *Rótulo humano, número do banco.*
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { WITHDRAWAL_DRE_GROUPS } from './is-orphan'
import { ehLinhaDeExtrato } from '@/lib/conciliacao/origem-do-extrato'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⭐ O LADO DE UM DINHEIRO — uma das duas linhas conciliadas (ou a única, quando não há par).
 */
export interface LadoDaRetirada {
  id: string
  date: Date
  amount: number
  description: string
  origin: string
  temPonte: boolean
  bankAccountId: string | null
  bankAccountName: string | null
  categoryId: string | null
  categoryName: string | null
}

/** ⭐ UM DINHEIRO — o que a fila oferece, e o que o guard protege */
export interface DinheiroDaRetirada {
  /** a linha que o gesto deve usar: o lado do EXTRATO quando existir */
  id: string
  /** a gêmea conciliada, quando existe — `null` numa retirada de uma linha só */
  idDaGemea: string | null
  /** o valor REAL que saiu do banco (lado do extrato quando existir) */
  amount: number
  /** o rótulo que o dono reconhece (lado MANUAL quando existir) */
  description: string
  date: Date
  bankAccountId: string | null
  bankAccountName: string | null
  categoryId: string | null
  categoryName: string | null
  /** true quando este dinheiro tem DUAS linhas — útil pra tela explicar o colapso */
  colapsado: boolean
}

/**
 * ⭐ As LINHAS candidatas. Deliberadamente **sem** o filtro de ponte: quem decide se o
 * dinheiro está resolvido é {@link colapsarEmDinheiros}, olhando os DOIS lados.
 *
 * ⛔ Filtrar ponte aqui foi exatamente o defeito: a linha sem ponte entrava mesmo quando a
 * gêmea tinha. *A pergunta "este dinheiro tem ponte?" não cabe num filtro por linha.*
 */
export function linhasCandidatasWhere(companyId: string): Prisma.TransactionWhereInput {
  return {
    bankAccount: { companyId },
    type: 'DEBIT',
    lifecycle: 'EFFECTED',
    isInternalTransfer: false,
    transferGroupId: null,
    category: { dreGroup: { in: Array.from(WITHDRAWAL_DRE_GROUPS) } },
  }
}

const SELECT_DO_LADO = {
  id: true,
  date: true,
  amount: true,
  description: true,
  origin: true,
  bankAccountId: true,
  bankAccount: { select: { name: true } },
  categoryId: true,
  category: { select: { name: true } },
  reconciledWithId: true,
  bridge: { select: { id: true } },
  reconciledFrom: { select: { id: true, bridge: { select: { id: true } } } },
} as const

/**
 * ⭐⭐ O DINHEIRO PENDENTE — a porta ÚNICA. Lista e contagem saem daqui, pela MESMA
 * derivação: esta lib nasceu porque dois endpoints respondiam diferente à mesma pergunta, e
 * colapsar só na lista reabriria isso (o banner diria 4 e a tela mostraria 2).
 */
export async function dinheirosDeRetiradaPendentes(db: Db, companyId: string): Promise<DinheiroDaRetirada[]> {
  const linhas = await db.transaction.findMany({
    where: linhasCandidatasWhere(companyId),
    select: SELECT_DO_LADO,
    orderBy: { date: 'desc' },
  })

  const lados = new Map<string, LadoDaRetirada>()
  /** quem é o par de quem — nos DOIS sentidos, porque `reconciledWithId` só aponta num */
  const par = new Map<string, string>()

  for (const r of linhas) {
    lados.set(r.id, {
      id: r.id,
      date: r.date,
      amount: r.amount,
      description: r.description,
      origin: r.origin,
      temPonte: r.bridge != null,
      bankAccountId: r.bankAccountId ?? null,
      bankAccountName: r.bankAccount?.name ?? null,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
    })
    if (r.reconciledWithId) {
      par.set(r.id, r.reconciledWithId)
      par.set(r.reconciledWithId, r.id)
    }
    for (const f of r.reconciledFrom) {
      par.set(r.id, f.id)
      par.set(f.id, r.id)
    }
  }

  /**
   * ⚠️ O par pode estar FORA das candidatas (categoria diferente, ou já é outra coisa) — aí
   * ele não está em `lados` e precisa ser lido à parte. ⛔ Ignorá-lo faria o dinheiro
   * resolvido voltar à fila quando a gêmea não casa o filtro: *ausência da gêmea na lista
   * não é ausência de ponte*.
   */
  const faltantes = [...new Set([...par.values()].filter((id) => !lados.has(id)))]
  if (faltantes.length) {
    const extras = await db.transaction.findMany({
      where: { id: { in: faltantes } },
      select: SELECT_DO_LADO,
    })
    for (const r of extras) {
      lados.set(r.id, {
        id: r.id, date: r.date, amount: r.amount, description: r.description, origin: r.origin,
        temPonte: r.bridge != null,
        bankAccountId: r.bankAccountId ?? null,
        bankAccountName: r.bankAccount?.name ?? null,
        categoryId: r.categoryId, categoryName: r.category?.name ?? null,
      })
    }
  }

  const out: DinheiroDaRetirada[] = []
  const visto = new Set<string>()

  // ⚠️ itera sobre as CANDIDATAS (não sobre `lados`): a gêmea trazida à parte entra como
  // par, nunca como uma retirada própria.
  for (const r of linhas) {
    if (visto.has(r.id)) continue
    const eu = lados.get(r.id)!
    const gemeaId = par.get(r.id) ?? null
    const gemea = gemeaId ? lados.get(gemeaId) ?? null : null

    visto.add(r.id)
    if (gemea) visto.add(gemea.id)

    // ⛔⛔ O CORAÇÃO: o dinheiro está resolvido se QUALQUER lado tem ponte.
    if (eu.temPonte || gemea?.temPonte) continue

    out.push(montarDinheiro(eu, gemea))
  }

  return out
}

/**
 * ⭐ O COLAPSO, puro e testável: número do extrato, rótulo da mão.
 * ⚠️ Sem par, o lado único responde pelos dois — e `colapsado` fica `false`, porque não
 * houve colapso nenhum. *Rótulo não promete o que não entrega.*
 */
export function montarDinheiro(eu: LadoDaRetirada, gemea: LadoDaRetirada | null): DinheiroDaRetirada {
  if (!gemea) {
    return {
      id: eu.id, idDaGemea: null, amount: eu.amount, description: eu.description,
      date: eu.date, bankAccountId: eu.bankAccountId, bankAccountName: eu.bankAccountName,
      categoryId: eu.categoryId, categoryName: eu.categoryName, colapsado: false,
    }
  }

  const doExtrato = ehLinhaDeExtrato(eu.origin) ? eu : ehLinhaDeExtrato(gemea.origin) ? gemea : null
  const daMao = doExtrato ? (doExtrato.id === eu.id ? gemea : eu) : eu

  // ⚠️ sem lado de extrato (duas manuais conciliadas), o gesto fica em `eu` e o número é o
  // dele: inventar um "lado preferido" sem régua seria heurística decidindo em silêncio.
  const alvo = doExtrato ?? eu
  const rotulo = daMao.description || alvo.description

  return {
    id: alvo.id,
    idDaGemea: alvo.id === eu.id ? gemea.id : eu.id,
    amount: alvo.amount,
    description: rotulo,
    date: alvo.date,
    bankAccountId: alvo.bankAccountId,
    bankAccountName: alvo.bankAccountName,
    categoryId: alvo.categoryId ?? daMao.categoryId,
    categoryName: alvo.categoryName ?? daMao.categoryName,
    colapsado: true,
  }
}
