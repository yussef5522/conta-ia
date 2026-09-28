// ⭐⭐⭐ O GESTO TERMINA O SERVIÇO — o carimbo do que o sistema já resolveu (27/09/2026)
//
// **O dono:** *"Conciliar pelo gesto 🏦/💳/📈 CARIMBA a transação (…) status resolvido (nunca
// mais «Pendente»)."*
//
// ⛔ **A CAUSA, medida:** os três ramos do `resolverLinha` criavam o vínculo e voltavam **sem
// tocar no `status`** — a transação seguia `PENDING`, e a tela de Transações cobrava uma
// decisão que já havia sido tomada. Em prod: **58 linhas** nesse estado (48 de empréstimo, 10
// de fatura), R$ 192.679,93.
//
// ⭐⭐ **DUAS DECISÕES DE DESENHO, e as duas importam:**
//
// **(1) O CARIMBO É DERIVADO DO VÍNCULO, NUNCA DA INTENÇÃO DA AÇÃO.** Esta função **relê os
// vínculos depois do gesto** e só carimba se eles existirem de fato. Confiar em *"a ação era
// PARCELA_EMPRESTIMO, logo está resolvida"* seria a **flag** de novo — e foi assim que a
// fatura do Carter ficou OPEN com o pagamento dela no extrato (20/09). Se o gesto não gravou
// vínculo, a linha **continua pendente**, que é a verdade.
//
// **(2) ELA MORA NUM CHOKE-POINT, fora dos ramos.** São **11 ações** e o próximo gesto
// nasceria sem carimbo — a doença *"N caminhos, 1 esquecido"* que custou o gatilho de vendas,
// o split do empréstimo e o `rawOfxBlob`. Aqui o gesto novo é carimbado **de graça** (REGRA 5:
// disciplina virou impossibilidade), e o gesto que NÃO cria vínculo não é afetado.

import type { PrismaClient, Prisma } from '@prisma/client'
import { seloDoSistema, STATUS_DE_QUEM_TEM_VINCULO, type SeloDoSistema } from './selo-do-sistema'

/**
 * ⚠️ O `select` que responde a pergunta. **As duas portas do empréstimo** estão aqui porque
 * checar só a 1:1 foi o bug de 14/08 — e na Caçula **47 de 53** parcelas vêm pela N:1.
 */
export const SELECT_DO_VINCULO = {
  id: true,
  status: true,
  type: true,
  transferGroupId: true,
  isCardPayment: true,
  businessCreditCardId: true,
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true }, take: 1 },
  investmentContribution: { select: { id: true } },
  loanDisbursement: { select: { id: true } },
} as const

type LinhaCrua = {
  id: string
  status: string
  type: string
  transferGroupId: string | null
  isCardPayment: boolean
  businessCreditCardId: string | null
  loanInstallmentPaid: { id: string } | null
  loanInstallmentPayments: { id: string }[]
  investmentContribution: { id: string } | null
  loanDisbursement: { id: string } | null
}

/** ⭐ a tradução do Prisma pra pergunta — **um lugar só**, senão cada andar monta o seu e erra */
export function paraSelo(t: LinhaCrua) {
  return {
    isCardPayment: t.isCardPayment,
    faturaVinculada: !!t.businessCreditCardId,
    temParcelaVinculada: !!t.loanInstallmentPaid || t.loanInstallmentPayments.length > 0,
    temAporteVinculado: !!t.investmentContribution,
    ehLiberacaoEmprestimo: !!t.loanDisbursement,
    ehTransferencia: t.type === 'TRANSFER' || !!t.transferGroupId,
  }
}

export interface Carimbo {
  selo: SeloDoSistema | null
  /** `true` quando o `status` mudou nesta chamada */
  carimbou: boolean
}

/**
 * ⭐ Carimba a linha SE ela tiver vínculo de gesto. Idempotente: já `RECONCILED` devolve
 * `carimbou: false` e não escreve — é o que faz o retroativo poder rodar quantas vezes quiser.
 *
 * ⛔⛔ **A CATEGORIA NÃO É TOCADA, e o porquê está em `selo-do-sistema.ts`:** categoria gravada
 * viraria tag fantasma em relatório por categoria (a decisão de 06/08 que zera o `categoryId`
 * da transferência), envelheceria se o vínculo fosse desfeito, e arriscaria contar a despesa
 * **duas vezes** — o DRE já trata os três por fontes que não mentem (`paidInterest`, a
 * competência da compra, `nonDreGroups`). *O rótulo é derivado; o que se grava é o estado.*
 */
export async function carimbarSeTemVinculo(
  db: PrismaClient | Prisma.TransactionClient,
  txId: string,
  companyId: string,
): Promise<Carimbo> {
  const t = (await db.transaction.findFirst({
    // ⛔ REGRA 8: o escopo de empresa entra na leitura, nunca só no id
    where: { id: txId, bankAccount: { companyId } },
    select: SELECT_DO_VINCULO,
  })) as LinhaCrua | null
  if (!t) return { selo: null, carimbou: false }

  const selo = seloDoSistema(paraSelo(t))
  if (!selo) return { selo: null, carimbou: false }
  if (t.status === STATUS_DE_QUEM_TEM_VINCULO) return { selo, carimbou: false }

  /**
   * ⚠️ **IGNORED não se mexe.** *"Ignorar"* é decisão explícita do dono (reversível, com
   * rastro) — sobrescrevê-la seria o sistema desfazendo uma escolha dele em silêncio, que é o
   * oposto da régua da casa desde 17/08.
   */
  if (t.status === 'IGNORED') return { selo, carimbou: false }

  await db.transaction.update({
    where: { id: t.id },
    data: { status: STATUS_DE_QUEM_TEM_VINCULO },
  })
  return { selo, carimbou: true }
}

/**
 * ⭐ O `select` MÍNIMO pra responder *"tem vínculo de gesto?"* — pros chamadores da escada de
 * status, que não precisam do resto.
 *
 * ⚠️ **Campo de vínculo que falta no `select` é decisão tomada com dado que a query não trouxe,
 * em silêncio** — a doença do PIX de 7.000 (17/08). Por isso ele mora aqui, num lugar só, e
 * cada chamador espalha o objeto em vez de listar os campos à mão.
 */
export const SELECT_VINCULO_MINIMO = {
  type: true,
  transferGroupId: true,
  isCardPayment: true,
  businessCreditCardId: true,
  loanInstallmentPaid: { select: { id: true } },
  loanInstallmentPayments: { select: { id: true }, take: 1 },
  investmentContribution: { select: { id: true } },
  loanDisbursement: { select: { id: true } },
} as const

type LinhaComVinculoCrua = Omit<LinhaCrua, 'id' | 'status'>

/** ⭐ `true` quando o sistema já sabe o que a linha é — a pergunta que a escada de status faz */
export function temVinculoDeGesto(t: LinhaComVinculoCrua): boolean {
  return seloDoSistema(paraSelo({ ...t, id: '', status: '' } as LinhaCrua)) !== null
}
