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
import { vincularPagamentoDeParcela, VinculoDeParcelaError } from '@/lib/loans/vincular-pagamento'
import { recomputeVendasSeVenda } from '@/lib/vendas/recompute-hook'
import { acaoValePraSentido, sentidoDaLinha, type AcaoDoBalcao } from './caixa-de-entrada'
import { reconcileTransactions } from './reconcile'

export class ResolverError extends Error {
  /** ⭐ o código deixa a tela oferecer o gesto certo (ex.: abrir o chip de categoria) */
  readonly code?: string
  constructor(message: string, code?: string) { super(message); this.name = 'ResolverError'; this.code = code }
}

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
  /** ⭐ a(s) conta(s) a pagar/receber escolhida(s) — o palpite já as traz POR ID */
  contaIds?: string[]
  /** o aceite da diferença nomeada (juros/tarifa), quando ela existe */
  diferencaAceita?: number
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
      /**
       * ⛔⛔ **A RECUSA DO VÍNCULO VIRAVA 500 SEM CORPO** (19/09). `VinculoDeParcelaError`
       * não é `ResolverError`, então escapava pelo `throw e` da rota — o cliente recebia um
       * 500 vazio e a tela dizia o genérico. **O dono leu isso como "nada aconteceu".**
       * Traduzir aqui é o mesmo desenho do tradutor 422 do estoque: erro de domínio vira
       * mensagem; o que ninguém previu continua 500, que ali é honesto.
       */
      try {
        const r = await vincularPagamentoDeParcela({
          db, companyId: input.companyId, loanId: input.loanId,
          installmentNumber: input.installmentNumber, transactionIds: [tx.id],
        })
        return { efeito: `parcela ${input.installmentNumber} ${r.status === 'PAID' ? 'PAGA' : 'parcialmente paga'} · split ${r.splitInjected ? 'aplicado' : 'não aplicável'}`, saiuDaCaixa: true }
      } catch (e) {
        if (e instanceof VinculoDeParcelaError) throw new ResolverError(e.message)
        throw e
      }
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
    /**
     * ⭐ CASAR pede o alvo **na própria caixa** (o painel abre embaixo da linha desde
     * 17/09) — então, chamado sem alvo, o servidor recusa **ensinando**, como todos os
     * outros gestos que pedem alvo. Ele nunca mais devolve um caminho: os dois que ele
     * devolvia estavam quebrados (um 404, o outro recarregando a própria tela).
     */
    /**
     * ⭐⭐⭐ COM O ALVO, EFETIVA AQUI MESMO (20/09) — o fim da segunda régua.
     *
     * ⛔⛔ **O defeito, na descrição do dono:** a linha da ELIANE acendia o palpite
     * (*"eliane · valor exato · 1 dia depois do vencimento"*) e o botão verde abria o
     * painel **VAZIO** — *"0 ranqueados · nenhuma conta bate com ELIANE GARCIA"*.
     *
     * **A causa:** o palpite tinha o candidato **POR ID** (`alvo.contaId`) e o botão o
     * **descartava**, mandando reabrir a busca — que procura **POR NOME** do extrato. Medido
     * em prod: não existe fornecedor nem conta a pagar com "eliane" no nome. *Duas réguas
     * pra mesma pergunta, e a segunda jogava fora a resposta que a primeira já tinha.*
     *
     * ⭐ **E ISTO NÃO É UMA SEGUNDA PORTA DE GRAVAÇÃO:** delega ao MESMO
     * `reconcileTransactions` que o Find & Match usa — o balcão passa o id, a régua é a de
     * sempre (degraus, teto, diferença nomeada). Sem alvo, a recusa continua ENSINANDO.
     */
    case 'CASAR_PAGAR':
    case 'CASAR_RECEBER': {
      const contas = input.contaIds ?? []
      if (!contas.length) {
        throw new ResolverError(
          input.acao === 'CASAR_PAGAR'
            ? 'Escolha a(s) conta(s) a pagar no painel desta linha.'
            : 'Escolha a(s) conta(s) a receber no painel desta linha.',
        )
      }
      /**
       * ⛔⛔⛔ NADA SAI DA CAIXA SEM CATEGORIA (20/09) — regra do dono.
       *
       * A linha conciliada **HERDA a categoria da conta** (é o que o reconcile já faz). Mas
       * se a conta casada **não tem categoria**, a linha sairia da caixa sem nenhuma — e a
       * despesa não apareceria em DRE nenhum. *Resolver é terminar com a linha classificada;
       * o contrário é empurrar o trabalho pra frente e esquecer dele.*
       *
       * ⭐ E a recusa ENSINA, com o `categoryId` do gesto sendo gravado **NA CONTA**: a
       * próxima nota daquele fornecedor já vem classificada (aprende, não repete a pergunta).
       */
      const semCategoria = await db.transaction.findMany({
        where: { id: { in: contas }, categoryId: null },
        select: { id: true, description: true },
      })
      if (semCategoria.length && !input.categoryId) {
        throw new ResolverError(
          `A conta «${semCategoria[0].description ?? 'sem descrição'}» não tem categoria — ` +
          'diga qual é pra eu conciliar. Ela fica gravada na conta, e a próxima do mesmo fornecedor já vem com ela.',
          'PEDE_CATEGORIA',
        )
      }
      if (semCategoria.length && input.categoryId) {
        // ⭐ grava NA CONTA (aprende), não só na linha do banco
        await db.transaction.updateMany({ where: { id: { in: semCategoria.map((c) => c.id) } }, data: { categoryId: input.categoryId } })
      }

      const grupo = contas.length > 1 ? `caixa-${input.txId}` : null
      for (const contaId of contas) {
        await reconcileTransactions({
          ofxTransactionId: input.txId, candidateId: contaId,
          allowMultiReconcile: contas.length > 1, reconcileGroupId: grupo,
          diferencaAceita: input.diferencaAceita,
        }, { userId: input.userId ?? '', companyId: input.companyId } as never)
      }
      return { efeito: `linha conciliada com ${contas.length} conta(s)`, saiuDaCaixa: true }
    }

    case 'TRANSFERENCIA_ENVIADA':
    case 'TRANSFERENCIA_RECEBIDA':
      throw new ResolverError('DEEP_LINK')
  }
}

/**
 * ⭐ PRA ONDE A AÇÃO LEVA — e **todo destino daqui é provado** (rota existe E a tela
 * consome o parâmetro). O guard de família cobra os dois lados.
 *
 * ⛔⛔ **DUAS PORTAS PINTADAS MORRERAM AQUI (17/09), as duas medidas em prod:**
 *
 *  1. `CASAR_RECEBER` apontava pra `/empresas/<id>/contas-a-receber` — **rota que não
 *     existe** (a tela real é `/contas-a-receber`, global). O chip dava **404**.
 *  2. `CASAR_PAGAR` apontava pra `/conciliacao?abrir=` — a rota existe e o card abre, mas
 *     é a **PRÓPRIA TELA**: o `window.location` recarregava tudo, o cartão ≍ fechava, o
 *     scroll ia pro topo e o painel ficava abaixo da dobra. *"Não abre painel nenhum —
 *     pior: a tela SAI/fecha o cartão."*
 *
 * ⭐ As duas agora resolvem **onde o gesto nasceu** (o `FindAndMatchPanel` embaixo da
 * própria linha), então elas deixam de ser caminho e voltam a ser o que sempre foram: um
 * gesto que **precisa do alvo**. A recusa ENSINA, como as outras — nunca aponta pro vazio.
 *
 * ⚠️ Só as transferências continuam levando pra outra tela, porque o par mora mesmo lá —
 * e o `/parear` passou a **consumir o `?abrir=`** no mesmo commit; deep-link que abre a
 * tela sem o alvo é porta pintada na parede (a régua de 13/09).
 */
export function destinoDaAcao(acao: AcaoDoBalcao, empresaId: string, txId: string): string | null {
  switch (acao) {
    case 'TRANSFERENCIA_ENVIADA':
    case 'TRANSFERENCIA_RECEBIDA': return `/empresas/${empresaId}/transferencias/parear?abrir=${txId}`
    default: return null
  }
}
