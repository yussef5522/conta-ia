// ⭐⭐ OS PALPITES DA CAIXA — a camada de IO que só CHAMA quem já existe (16/09/2026).
//
// ⛔⛔ **ZERO RÉGUA DE MATCH AQUI.** Este arquivo busca o que os motores precisam, chama
// os motores, e traduz a saída deles pro `CandidatoBruto` que a régua pura ordena:
//
//   PGTO_CARTAO ......... `resolvePaidInvoiceMonth` — a competência que o VALOR quita
//   PARCELA_EMPRESTIMO .. `sugerirVinculoEmprestimo` — contrato + parcela
//   CASAR_PAGAR ......... `sugerirVinculos` — a régua dos degraus (FECHA/OFERECE/PERGUNTA)
//
// ⚠️ **FAIL-SOFT POR CONSTRUÇÃO:** palpite é bônus. Se um matcher estourar, a linha
// aparece **sem** palpite e com os chips de sempre — nunca derruba a caixa. A caixa sem
// palpite é a tela de ontem, que funciona.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { sentidoDaLinha } from './caixa-de-entrada'
import { escolherPalpite, type CandidatoBruto, type PalpiteDaLinha } from './palpite-da-linha'
import { sugerirVinculos } from './sugestao-de-vinculo'
import { fornecedoresDaEmpresa, paresRecusados, padroesDeProcessadora } from './fila-de-conciliacao'
import { sugerirVinculoEmprestimo, type ParcelaLite } from '@/lib/loans/sugerir-vinculo'
/**
 * ⛔ **`mesQueBateOValor`, NÃO `resolvePaidInvoiceMonth`** — a diferença é de contrato e
 * foi medida em prod no 1º uso: aquele tem FALLBACK pra a fatura mais recente (correto
 * quando o dono já escolheu o cartão) e devolvia `2026-08` pros QUATRO cartões da Caçula
 * com um valor que não bate nenhum. Palpite com fallback é palpite inventado.
 */
import { mesQueBateOValor } from '@/lib/credit-card-pj/fatura-net-total'
import { signedFaturaAmount } from '@/lib/credit-card-pj/fatura-net-total'
import type { LinhaCrua } from './leitura-da-caixa'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/')

/**
 * ⭐⭐ O PALPITE DE CADA LINHA DA CAIXA.
 *
 * ⚠️ **Só as linhas que ESTÃO na caixa** entram — palpitar sobre o arquivo seria trabalho
 * (e consulta) pra quem já está resolvido.
 */
export async function palpitesDaCaixa(
  empresaId: string,
  linhas: readonly LinhaCrua[],
  db: PrismaClient = defaultPrisma,
): Promise<Map<string, PalpiteDaLinha>> {
  const fora = new Map<string, PalpiteDaLinha>()
  if (linhas.length === 0) return fora

  const debitos = linhas.filter((l) => l.type === 'DEBIT')

  // ── o que cada motor precisa, buscado UMA vez ─────────────────────────────
  const [cartoes, loans, fornecedores, recusados, padroes] = await Promise.all([
    db.businessCreditCard.findMany({ where: { companyId: empresaId, isActive: true }, select: { id: true, name: true } }),
    /**
     * ⛔⛔⛔ **O `status` FALTAVA NESTE SELECT — e isso matava TODO palpite de empréstimo**
     * (achado em prod, 19/09). `detectLoanPayment` começa com
     * `loans.filter(l => l.status === 'ACTIVE' || l.status === 'LATE')`: com o campo
     * **undefined**, a lista ficava **vazia**, nenhum contrato casava, e a caixa nunca
     * mostrou um palpite de parcela — nem pra `LIQUIDACAO DE PARCELA-C41022570`, que a lib
     * resolve sozinha (medido: contrato `C41022570-0`, parcela 14).
     *
     * ⚠️⚠️ **É a doença do SELECT INCOMPLETO, a mesma do PIX de 7.000 (17/08)**: o motor
     * decide com um campo que a consulta não trouxe, e **não dá erro** — dá silêncio. O que
     * deixou passar foi o `as never` no call-site (removido abaixo): sem o cast, o
     * TypeScript teria acusado o campo faltando.
     */
    db.loan.findMany({
      where: { companyId: empresaId, status: { not: 'PAID' } },
      select: { id: true, contractNumber: true, lender: true, bankAccountId: true, status: true },
    }),
    fornecedoresDaEmpresa(db, empresaId),
    paresRecusados(db, empresaId),
    padroesDeProcessadora(db, empresaId),
  ])

  /**
   * ⭐ O NET DE CADA FATURA, buscado UMA vez pros N cartões.
   * ⚠️ A versão anterior consultava por LINHA × CARTÃO — 400 linhas × 4 cartões = 1.600
   * consultas numa rota que a tela abre a cada visita. É a regressão de 9,6 s de 10/09
   * esperando pra acontecer.
   */
  const netPorMes = new Map<string, Map<string, number>>()
  if (cartoes.length > 0) {
    const itens = await db.transaction.findMany({
      where: { businessCreditCardId: { in: cartoes.map((c) => c.id) }, invoiceMonth: { not: null }, isCardPayment: false },
      select: { businessCreditCardId: true, invoiceMonth: true, type: true, amount: true },
    })
    for (const it of itens) {
      const porCartao = netPorMes.get(it.businessCreditCardId!) ?? new Map<string, number>()
      const m = it.invoiceMonth as string
      porCartao.set(m, (porCartao.get(m) ?? 0) + signedFaturaAmount({ type: it.type, amount: it.amount, isCardPayment: false }))
      netPorMes.set(it.businessCreditCardId!, porCartao)
    }
  }

  const parcelasPorLoan: Record<string, ParcelaLite[]> = {}
  if (loans.length > 0) {
    const parcelas = await db.loanInstallment.findMany({
      where: { loanId: { in: loans.map((l) => l.id) }, status: { not: 'PAID' } },
      select: { loanId: true, number: true, dueDate: true, payment: true, paidTotal: true, status: true },
    })
    for (const p of parcelas) (parcelasPorLoan[p.loanId] ??= []).push(p as unknown as ParcelaLite)
  }

  /**
   * ⭐ AS CONTAS A PAGAR EM ABERTO — o universo do `sugerirVinculos`.
   * ⚠️ A janela sai das próprias linhas (±45d), como na fila: buscar o histórico inteiro
   * pra palpitar sobre 400 linhas seria a regressão de 9,6 s de 10/09.
   */
  const datas = linhas.map((l) => l.date.getTime())
  const janela = 45 * 86_400_000
  const contas = await db.transaction.findMany({
    where: {
      lifecycle: 'PAYABLE', status: 'PENDING',
      OR: [{ supplier: { companyId: empresaId } }, { bankAccount: { companyId: empresaId } }, { category: { companyId: empresaId } }],
      dueDate: { gte: new Date(Math.min(...datas) - janela), lte: new Date(Math.max(...datas) + janela) },
    },
    select: {
      id: true, description: true, amount: true, dueDate: true, date: true, supplierId: true,
      supplier: { select: { razaoSocial: true, nomeFantasia: true } },
    },
    take: 500,
  })

  for (const l of linhas) {
    const candidatos: CandidatoBruto[] = []
    const sentido = sentidoDaLinha(l.type)
    const descricao = l.description ?? ''

    // ── 1. FATURA DE CARTÃO (só débito) ────────────────────────────────────
    if (l.type === 'DEBIT' && cartoes.length > 0) {
      for (const c of cartoes) {
        try {
          const mes = mesQueBateOValor(netPorMes.get(c.id) ?? new Map(), l.amount)
          if (!mes) continue
          candidatos.push({
            acao: 'PGTO_CARTAO',
            familia: '💳 PAGAMENTO DE FATURA',
            titulo: `Fatura do cartão ${c.name}`,
            /** ⚠️ a competência aparece NOMEADA — foi a régua de 17/08 (casa por VALOR, nunca "a mais recente") */
            detalhe: `fatura ${mes} · ${brl(l.amount)}`,
            diferenca: 0, // ⭐ o `resolvePaidInvoiceMonth` só devolve o mês cujo NET BATE
            confianca: 'ALTA',
            alvo: { cardId: c.id, invoiceMonth: mes },
          })
        } catch { /* fail-soft: sem palpite de cartão nesta linha */ }
      }
    }

    // ── 2. PARCELA DE EMPRÉSTIMO (só débito) ───────────────────────────────
    if (l.type === 'DEBIT' && loans.length > 0) {
      try {
        /**
         * ⛔ **SEM `as never`, de propósito.** Era o cast que escondia o `status` faltando
         * no select — o TypeScript tinha como pegar e foi calado. `dueDay` é sinal
         * auxiliar de ranking e não existe em `Loan`; vai `null` explícito, que é o que
         * ele significa aqui (a identificação vem do NÚMERO do contrato na descrição).
         */
        const s = sugerirVinculoEmprestimo(
          { description: descricao, type: l.type, date: l.date, amount: l.amount },
          loans.map((x) => ({ id: x.id, contractNumber: x.contractNumber, lender: x.lender, status: x.status, dueDay: null })),
          parcelasPorLoan,
        )
        if (s && s.kind === 'SUGERIDO') {
          candidatos.push({
            acao: 'PARCELA_EMPRESTIMO',
            familia: '🏦 PARCELA DE EMPRÉSTIMO',
            titulo: `Contrato ${s.contractNumber} — parcela ${s.installmentNumber}`,
            detalhe: `${s.lender} · ${s.parcial ? `parcial: faltam ${brl(s.faltaDepois)}` : brl(l.amount)}`,
            diferenca: 0,
            // ⚠️ parcial é palpite legítimo, mas não é "fecha" — desce um degrau de confiança
            confianca: s.parcial ? 'MEDIA' : 'ALTA',
            alvo: { loanId: s.loanId, installmentNumber: s.installmentNumber },
          })
        }
      } catch { /* fail-soft */ }
    }

    // ── 3. CONTA A PAGAR (só débito) ───────────────────────────────────────
    if (l.type === 'DEBIT' && contas.length > 0) {
      try {
        const sugs = sugerirVinculos({
          extrato: { id: l.id, descricao, valor: l.amount, data: l.date, fornecedorId: null, tipo: l.type },
          contas: contas.map((c) => ({
            id: c.id, descricao: c.description ?? '', valor: c.amount,
            data: c.dueDate ?? c.date, fornecedorId: c.supplierId, tipo: 'DEBIT',
          })) as never,
          fornecedores, recusados, padroes,
        } as never)
        const top = sugs[0]
        if (top) {
          const conta = contas.find((c) => c.id === top.contaId)
          const nome = conta?.supplier?.nomeFantasia ?? conta?.supplier?.razaoSocial ?? conta?.description ?? 'conta'
          candidatos.push({
            acao: 'CASAR_PAGAR',
            familia: '🧾 CASAR COM CONTA A PAGAR',
            titulo: nome,
            /** ⛔ o `porQue` é OBRIGATÓRIO na tela — sugestão sem motivo não existe (07/09) */
            detalhe: top.porQue,
            diferenca: top.diferenca,
            // ⚠️ o `GrauDeConfianca` da sugestão é MINÚSCULO ('alta'|'media'|'baixa') e o do
            // palpite é MAIÚSCULO — comparar sem traduzir seria o no-op silencioso que a
            // lista de qualificadores do estoque já pagou (14/09). O TS pegou; fica escrito.
            confianca: top.confianca === 'alta' ? 'ALTA' : top.confianca === 'media' ? 'MEDIA' : 'BAIXA',
            alvo: { contaId: top.contaId },
            alvoNome: conta?.description ?? nome,
          })
        }
      } catch { /* fail-soft */ }
    }

    const p = escolherPalpite(candidatos, sentido, l.amount)
    if (p) fora.set(l.id, p)
  }

  void debitos
  return fora
}
