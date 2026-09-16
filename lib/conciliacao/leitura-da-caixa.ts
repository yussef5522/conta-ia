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
  categoryId: true, reconciledWithId: true, isCardPayment: true, transferGroupId: true,
  isInternalTransfer: true, pendingTransfer: true, ignoredAt: true, bankAccountId: true,
  reconciledFrom: { select: { id: true } },
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true } },
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
  transferGroupId: string | null; isInternalTransfer: boolean; pendingTransfer: boolean
  ignoredAt: Date | null; bankAccountId: string
  reconciledFrom: { id: string }[]
  loanInstallmentPaid: { id: string } | null
  loanInstallmentPayments: { id: string }[]
}

/** ⭐ a tradução da linha crua pra o que a LEI lê — um lugar só, senão as duas divergem */
export function paraLei(r: LinhaCrua): LinhaParaEstacao {
  return {
    categoryId: r.categoryId,
    reconciledWithId: r.reconciledWithId,
    temReconciledFrom: r.reconciledFrom.length > 0,
    isCardPayment: r.isCardPayment,
    temParcelaVinculada: !!r.loanInstallmentPaid || r.loanInstallmentPayments.length > 0,
    transferGroupId: r.transferGroupId,
    isInternalTransfer: r.isInternalTransfer,
    pendingTransfer: r.pendingTransfer,
    ignoredAt: r.ignoredAt,
    tipo: r.type,
  }
}

export interface CaixaLida {
  rows: LinhaCrua[]
  contadores: ContadoresDoBalcao
  /** ⭐ a tela DIZ de quando ela conta — fila que mostra menos precisa dizer por quê */
  corte: Date | null
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

  return { rows, contadores: contarEstacoes(rows.map(paraLei)), corte, nomeConta: new Map(contas.map((c) => [c.id, c.name])) }
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
