// ⭐⭐⭐ A LEITURA DA CAIXA DE ENTRADA — UM DONO SÓ (faxina de 15/09/2026).
//
// **Por que isto existe:** o badge do menu e a TELA respondem a MESMA pergunta —
// *"quantas linhas ainda esperam decisão minha?"*. Enquanto a consulta viveu dentro da
// rota, o badge só tinha duas saídas: chamar a rota por HTTP (caro, a cada 60 s) ou
// escrever a **segunda consulta** — que é como o menu passou meses dizendo um número e a
// tela mostrando outro (o defeito de 10/09, medido: o badge contava os pares 1:1 **sem os
// lotes**).
//
// ⛔ **A régua da fila mora aqui e em lugar nenhum mais.** Quem quiser contar linha
// esperando decisão chama `contarLinhasEsperandoDecisao`; quem quiser desenhar chama
// `lerCaixa`. As duas leem o MESMO recorte — inclusive o corte de época e o teto de 400.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { contarEstacoes, type ContadoresDoBalcao, type LinhaParaEstacao } from './caixa-de-entrada'

/** ⚠️ o que basta ler pra a lei das estações decidir — nada além disso */
export const SELECT_DA_CAIXA = {
  id: true, type: true, amount: true, date: true, description: true, counterpartyName: true,
  categoryId: true, reconciledWithId: true, isCardPayment: true, businessCreditCardId: true, transferGroupId: true,
  isInternalTransfer: true, pendingTransfer: true, ignoredAt: true, bankAccountId: true,
  reconciledFrom: { select: { id: true } },
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true } },
  /**
   * ⭐⭐ 25/09 — o VÍNCULO com o contrato de investimento, no MESMO select.
   * ⚠️ Sem ele `temAporteVinculado` seria `false` pra toda linha e **todo aporte voltaria
   * pra caixa** — a doença do select incompleto, que este arquivo já documenta logo abaixo.
   */
  investmentContribution: { select: { id: true } },
  /**
   * ⭐⭐ 25/09 — O GRUPO DO DRE vem JUNTO, no mesmo select.
   *
   * ⛔ Sem o campo, `categoriaResolveSozinha` receberia `undefined` pra TODA linha e — como
   * a régua trata ausência como *"não resolve"* — o arquivo inteiro voltaria pra caixa. É a
   * doença do **select incompleto** (o PIX de 7.000, 17/08): o motor decide com um campo
   * que a consulta não trouxe, e **não dá erro: dá silêncio**.
   */
  category: { select: { dreGroup: true } },
} as const

/**
 * ⚠️ TETO DE LEITURA. A caixa é fila de TRABALHO, não arquivo: 400 linhas cobrem semanas
 * de extrato das cinco contas. ⛔ E ele é o MESMO pros dois leitores de propósito — badge
 * com teto diferente da tela é a divergência de novo, com outra roupa.
 */
export const TETO_DA_CAIXA = 400

export type LinhaCrua = {
  id: string; type: string; amount: number; date: Date
  description: string | null; counterpartyName: string | null
  categoryId: string | null; reconciledWithId: string | null; isCardPayment: boolean
  businessCreditCardId: string | null
  transferGroupId: string | null; isInternalTransfer: boolean; pendingTransfer: boolean
  ignoredAt: Date | null
  /** ⚠️ NULL de verdade: compra de cartão nasce sem conta bancária (o consumidor já trata) */
  bankAccountId: string | null
  reconciledFrom: { id: string }[]
  loanInstallmentPaid: { id: string } | null
  loanInstallmentPayments: { id: string }[]
  /** ⭐ 25/09 — o grupo do DRE da categoria, que decide se ela encerra a linha */
  category?: { dreGroup: string | null } | null
  /**
   * ⭐ 25/09 — a decisão *"esta saída não tem nota"*, INJETADA pela leitura.
   *
   * ⚠️ Não é coluna de `transactions`: ela vive em `conciliacao_avulsa_confirmada`, porque
   * decisão tem AUTOR e DATA (e um boolean não guarda nem um nem outro). Quem junta é a
   * `lerCaixa`, num lugar só — cada leitor buscando por conta própria é como dois deles
   * discordam sobre a mesma linha.
   */
  avulsaConfirmada?: boolean
  investmentContribution?: { id: string } | null
}

/** ⭐ a tradução da linha crua pra o que a LEI lê — um lugar só, senão as duas divergem */
export function paraLei(r: LinhaCrua): LinhaParaEstacao {
  return {
    categoryId: r.categoryId,
    dreGroupDaCategoria: r.category?.dreGroup ?? null,
    avulsaConfirmada: r.avulsaConfirmada ?? false,
    temAporteVinculado: r.investmentContribution != null,
    reconciledWithId: r.reconciledWithId,
    temReconciledFrom: r.reconciledFrom.length > 0,
    isCardPayment: r.isCardPayment,
    faturaVinculada: !!r.businessCreditCardId,
    temParcelaVinculada: !!r.loanInstallmentPaid || r.loanInstallmentPayments.length > 0,
    transferGroupId: r.transferGroupId,
    isInternalTransfer: r.isInternalTransfer,
    pendingTransfer: r.pendingTransfer,
    ignoredAt: r.ignoredAt,
    tipo: r.type,
  }
}

export interface CoberturaDaCaixa {
  lidas: number
  totalNoPeriodo: number
  truncado: boolean
  desde: Date | null
}

export interface CaixaLida {
  rows: LinhaCrua[]
  contadores: ContadoresDoBalcao
  /** ⭐ a tela DIZ de quando ela conta — fila que mostra menos precisa dizer por quê */
  corte: Date | null
  /** ⭐ 30/09: quantas linhas o teto alcançou — truncar em silêncio afirma que se olhou tudo */
  cobertura: CoberturaDaCaixa
  /** nome de cada conta, pra tela nomear de onde a linha veio */
  nomeConta: Map<string, string>
}

/**
 * ⭐⭐ A LEITURA ÚNICA.
 *
 * ⚠️ **O CORTE DE ÉPOCA VALE AQUI** (decisão do dono, 15/09): *"os créditos históricos já
 * categorizados nascem em PAZ no arquivo, não como pendência retroativa"*. Sem ele, a
 * caixa abriria com anos de extrato pedindo decisão que o dono já tomou.
 */
export async function lerCaixa(empresaId: string, db: PrismaClient = defaultPrisma): Promise<CaixaLida> {
  const contas = await db.bankAccount.findMany({ where: { companyId: empresaId }, select: { id: true, name: true } })
  const empresa = await db.company.findUnique({ where: { id: empresaId }, select: { conciliarAPartirDe: true } })
  const corte = empresa?.conciliarAPartirDe ?? null

  const rows = (await db.transaction.findMany({
    where: {
      bankAccountId: { in: contas.map((c) => c.id) },
      origin: 'OFX', lifecycle: 'EFFECTED',
      ...(corte ? { date: { gte: corte } } : {}),
    },
    select: SELECT_DA_CAIXA,
    orderBy: { date: 'desc' },
    take: TETO_DA_CAIXA,
  })) as unknown as LinhaCrua[]

  /**
   * ⭐ UMA consulta pra todas as linhas, não uma por linha — a lição do badge que virou
   * 1,3 s (11/09). E ela roda depois do `take`, então só busca o que a tela vai desenhar.
   */
  const avulsas = rows.length
    ? new Set((await db.conciliacaoAvulsaConfirmada.findMany({
        where: { companyId: empresaId, transactionId: { in: rows.map((r) => r.id) } },
        select: { transactionId: true },
      })).map((a) => a.transactionId))
    : new Set<string>()
  for (const r of rows) r.avulsaConfirmada = avulsas.has(r.id)

  /**
   * ⭐⭐⭐ O TETO PASSOU A MORDER — e a tela tem que DIZER (30/09/2026).
   *
   * ⚠️ **Medido em prod:** 452 linhas ≥ corte e o teto lê 400 → **52 invisíveis**. O contador
   * dizia *"12 na caixa · 388 no arquivo · 400 no período"* como se 400 fosse tudo que
   * existe. **O número estava certo sobre as 400 lidas e errado sobre o período.**
   *
   * ⭐ Medido também o que importa: das 52 invisíveis, **ZERO pedem decisão** (todas já
   * resolvidas) — então o teto **não está escondendo trabalho hoje**. Mas é a 4ª vez que um
   * teto de leitura esconde linha nesta casa (o fermento em 16/09, a ordem do ano 202 em
   * 19/09, o recebimento em 23/09), e as três anteriores só apareceram quando alguém
   * reclamou de um sumiço.
   *
   * ⛔ **O conserto não é subir o teto** (ele protege a consulta e a tela); é a leitura DIZER
   * quantas ficaram fora, como o detector de transferência já faz com `coverage/truncated`
   * desde 13/09. *Truncar em silêncio é afirmar que se olhou tudo.*
   */
  const totalNoPeriodo = await db.transaction.count({
    where: {
      bankAccountId: { in: contas.map((c) => c.id) },
      origin: 'OFX', lifecycle: 'EFFECTED',
      ...(corte ? { date: { gte: corte } } : {}),
    },
  })
  const cobertura = {
    lidas: rows.length,
    totalNoPeriodo,
    truncado: totalNoPeriodo > rows.length,
    /** ⭐ o dia mais ANTIGO que o teto alcança — é o que diz ATÉ ONDE a tela olhou */
    desde: rows.length ? rows[rows.length - 1]!.date : null,
  }

  return {
    rows,
    contadores: contarEstacoes(rows.map(paraLei)),
    corte,
    cobertura,
    nomeConta: new Map(contas.map((c) => [c.id, c.name])),
  }
}

/**
 * ⭐ O NÚMERO DO BADGE — **a mesma leitura que a tela desenha**.
 *
 * ⛔ Conta LINHAS do extrato esperando decisão. Ele **não soma** com
 * `contarVinculosEsperandoDecisao`, que conta **CONTAS a pagar** sem par: casar uma linha
 * com uma conta apaga as duas de uma vez, e somar seria dupla contagem.
 */
export async function contarLinhasEsperandoDecisao(empresaId: string, db: PrismaClient = defaultPrisma): Promise<number> {
  const { contadores } = await lerCaixa(empresaId, db)
  return contadores.saidas + contadores.entradas
}
