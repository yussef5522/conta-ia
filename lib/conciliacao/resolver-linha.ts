// ⭐⭐⭐ O CHOKE-POINT DOS GESTOS DO BALCÃO — TODO GESTO EFETIVA (15/09/2026).
//
// ═══ A REGRA NOVA DA CASA, palavras do dono ═══
//
//   ***Gesto que ESCOLHE um alvo e não EFETIVA o vínculo é MEIA-PONTE — proibido.***
//   O guard clica o gesto e confere o **EFEITO NO DESTINO**, nunca a etiqueta na linha.
//
// ⛔⛔ **O DEFEITO QUE A CRIOU, medido em 15/09:** no `pendentes-client.tsx`, o seletor de
// tipo oferecia *"Pgto cartão"* e *"Pgto empréstimo"* e o `onChange` era:
//
//     if (k === 'TRANSFER') setVincularBase(t)
//     else if (k === 'IGNORAR') ignorarTransacao(t.id)
//
// As outras duas opções **caíam no vazio** — guardavam um rótulo num `useState` local que
// não ia a lugar nenhum. O dono escolhia o cartão e a fatura não baixava; escolhia o
// contrato e o cronograma não mudava. *Não era meia-ponte: era ponte que não começa.*
//
// ⭐ **NENHUM MOTOR NOVO NASCE AQUI.** Cada ação despacha pro motor que já existe e já é
// provado — é o que garante que o balcão e as telas antigas gravem o MESMO fato:
//   CASAR_PAGAR ............ `reconcileTransactions` (a régua dos degraus, 12/09)
//   PGTO_CARTAO ............ `casarPagamentoDeCartao` (o motor do cartão, extraído 15/09)
//   PARCELA_EMPRESTIMO ..... `vincularPagamentoDeParcela` (a porta única, 11/09)
//   TRANSFERENCIA_* ........ `applyTransferCandidate` (o motor único de par)
//   CATEGORIA / VENDA ...... o update + `recomputeVendasSeVenda` (o gatilho de 25/08)
//   IGNORAR ................ `ignoredAt`

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { casarPagamentoDeCartao, CasarPagamentoError } from '@/lib/credit-card-pj/casar-pagamento'
import { vincularPagamentoDeParcela } from '@/lib/loans/vincular-pagamento'
import { recomputeVendasSeVenda } from '@/lib/vendas/recompute-hook'
import { acaoValePraSentido, sentidoDaLinha, type AcaoDoBalcao } from './caixa-de-entrada'

export class ResolverError extends Error {}

export interface ResolverInput {
  companyId: string
  txId: string
  acao: AcaoDoBalcao
  userId?: string
  /** o alvo escolhido — qual deles vale depende da ação */
  cardId?: string
  invoiceMonth?: string | null
  loanId?: string
  installmentNumber?: number
  categoryId?: string
  /** a saída original que este crédito estorna */
  estornoDeTxId?: string
  /** o par da transferência (a linha da outra conta) */
  parTxId?: string
}

export interface ResolverResultado {
  /** ⭐ o que MUDOU NO DESTINO — é isto que o guard confere, nunca a etiqueta */
  efeito: string
  /** a linha saiu da caixa de entrada? (sempre `true` num gesto que efetivou) */
  saiuDaCaixa: boolean
}

/**
 * ⭐⭐ RESOLVE UMA LINHA. Uma porta, todas as ações, todos os efeitos.
 *
 * ⛔ **A LEI DO SENTIDO É CHECADA AQUI, NO SERVIDOR** — não basta a tela oferecer o menu
 * certo: esconder o botão não impede a chamada (a lição de 06/09 e 09/09). Crédito pedindo
 * `CASAR_PAGAR` é recusado com a frase que ensina.
 */
export async function resolverLinha(input: ResolverInput, db: PrismaClient = defaultPrisma): Promise<ResolverResultado> {
  const tx = await db.transaction.findFirst({
    where: { id: input.txId, bankAccount: { companyId: input.companyId } },
    select: { id: true, type: true, amount: true, date: true, bankAccountId: true, categoryId: true, ignoredAt: true },
  })
  if (!tx) throw new ResolverError('Linha do extrato não encontrada.')

  const sentido = sentidoDaLinha(tx.type)
  if (!acaoValePraSentido(input.acao, sentido)) {
    throw new ResolverError(
      sentido === 'ENTRADA'
        ? 'Esta linha é dinheiro que ENTROU — ela não paga conta nem fatura. Use os caminhos de entrada (receber, venda, transferência, estorno).'
        : 'Esta linha é dinheiro que SAIU — ela não recebe. Use os caminhos de saída (pagar, fatura, parcela, transferência).',
    )
  }

  switch (input.acao) {
    case 'PGTO_CARTAO': {
      if (!input.cardId) throw new ResolverError('Escolha o cartão cuja fatura este pagamento quita.')
      try {
        const r = await casarPagamentoDeCartao({ companyId: input.companyId, cardId: input.cardId, txId: tx.id, invoiceMonth: input.invoiceMonth }, db)
        // ⭐ o efeito NOMEIA a fatura que baixou — "marquei como pagamento" não seria efeito
        return { efeito: `fatura ${r.paidInvoiceMonth ?? '(sem competência)'} do cartão quitada por esta linha`, saiuDaCaixa: true }
      } catch (e) {
        if (e instanceof CasarPagamentoError) throw new ResolverError(e.message)
        throw e
      }
    }

    case 'PARCELA_EMPRESTIMO': {
      if (!input.loanId || input.installmentNumber == null) throw new ResolverError('Escolha o contrato e a parcela que esta linha paga.')
      const r = await vincularPagamentoDeParcela({
        db, companyId: input.companyId, loanId: input.loanId,
        installmentNumber: input.installmentNumber, transactionIds: [tx.id],
      })
      return { efeito: `parcela ${input.installmentNumber} ${r.status === 'PAID' ? 'PAGA' : 'parcialmente paga'} · split ${r.splitInjected ? 'aplicado' : 'não aplicável'}`, saiuDaCaixa: true }
    }

    case 'CATEGORIA':
    case 'RECEBIMENTO_VENDA': {
      if (!input.categoryId) throw new ResolverError('Escolha a categoria.')
      await db.transaction.update({ where: { id: tx.id }, data: { categoryId: input.categoryId, status: 'RECONCILED' } })
      /**
       * ⭐⭐ O GATILHO DE VENDAS RODA AQUI (a régua de 25/08: *"listar os caminhos que
       * CRIAM, não só os que importam"*). ⚠️ Ele é **fail-soft** e no-op quando a categoria
       * não é de venda — o juiz noturno pega o que escapar.
       */
      await recomputeVendasSeVenda(db, input.companyId, [input.categoryId], 'balcao').catch(() => {})
      return { efeito: input.acao === 'RECEBIMENTO_VENDA' ? 'receita do dia registrada' : 'categoria gravada', saiuDaCaixa: true }
    }

    case 'ESTORNO': {
      if (!input.categoryId) throw new ResolverError('Escolha a categoria do estorno.')
      /**
       * ⚠️ O VÍNCULO COM A SAÍDA ORIGINAL É OPCIONAL, por decisão do dono (15/09): *"quando
       * houver par; sem par, categoria 'estorno' e segue"*. Exigir o par travaria o estorno
       * de uma compra que nunca entrou no extrato.
       */
      await db.transaction.update({ where: { id: tx.id }, data: { categoryId: input.categoryId, status: 'RECONCILED' } })
      if (input.estornoDeTxId) {
        const orig = await db.transaction.findFirst({
          where: { id: input.estornoDeTxId, bankAccount: { companyId: input.companyId } },
          select: { id: true, type: true, amount: true, notes: true },
        })
        if (!orig) throw new ResolverError('A saída original não foi encontrada.')
        // ⛔ estorno é CRÉDITO contra um DÉBITO: o sentido oposto é o que define o par
        if (orig.type !== 'DEBIT') throw new ResolverError('O estorno aponta pra uma SAÍDA — a linha escolhida é uma entrada.')
        const marca = `estornada pela entrada de ${tx.date.toISOString().slice(0, 10)} (R$ ${tx.amount.toFixed(2)})`
        await db.transaction.update({ where: { id: orig.id }, data: { notes: orig.notes ? `${orig.notes} · ${marca}` : marca } })
        return { efeito: `estorno amarrado à saída original · rastro gravado nela`, saiuDaCaixa: true }
      }
      return { efeito: 'estorno categorizado (sem par no extrato)', saiuDaCaixa: true }
    }

    case 'IGNORAR': {
      await db.transaction.update({ where: { id: tx.id }, data: { ignoredAt: new Date() } })
      return { efeito: 'linha fora das filas, reversível', saiuDaCaixa: true }
    }

    /**
     * ⛔⛔ AS TRÊS QUE NÃO GRAVAM AQUI — e isso é DESENHO, não buraco.
     *
     * `CASAR_PAGAR`, `CASAR_RECEBER` e as duas transferências precisam do **alvo escolhido
     * na tela do par** (qual nota, quais notas, qual linha da outra conta) — e essa escolha
     * já tem casa própria, provada: o card do "escolher na mão" e o `/parear`. Mandar o
     * balcão gravar por baixo seria a **segunda porta** do mesmo vínculo.
     *
     * ⚠️ Por isso elas devolvem um `href` em vez de um efeito — e o guard sabe disso: ele
     * exige que a ação **leve ao lugar onde o vínculo acontece**, nunca que ela cale.
     */
    case 'CASAR_PAGAR':
    case 'CASAR_RECEBER':
    case 'TRANSFERENCIA_ENVIADA':
    case 'TRANSFERENCIA_RECEBIDA':
      throw new ResolverError('DEEP_LINK')
  }
}

/** ⭐ pra onde a ação leva, quando ela é de VÍNCULO (a escolha do alvo tem casa própria) */
export function destinoDaAcao(acao: AcaoDoBalcao, empresaId: string, txId: string): string | null {
  switch (acao) {
    case 'CASAR_PAGAR': return `/conciliacao?empresaId=${empresaId}&abrir=${txId}`
    case 'CASAR_RECEBER': return `/empresas/${empresaId}/contas-a-receber?extrato=${txId}`
    case 'TRANSFERENCIA_ENVIADA':
    case 'TRANSFERENCIA_RECEBIDA': return `/empresas/${empresaId}/transferencias/parear?abrir=${txId}`
    default: return null
  }
}
