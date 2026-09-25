// ⭐⭐⭐ AS FATURAS QUE UMA LINHA DO EXTRATO PODE QUITAR (25/09/2026) — régua do dono.
//
// **O caso:** a linha do MERCADO PAGO (PIX 2.900,34) tinha palpite de fatura, e o chip
// *"💳 pagamento de fatura ▾"* **desaparecia** da fileira de caminhos — o filtro
// `acoes.filter(a => a.acao !== palpite.acao)` tirava justamente o gesto que permitiria
// escolher OUTRO cartão. ⛔ ***Palpite presente não esconde caminho — palpite é atalho, não
// muro.***
//
// ⚠️ **E o menu dos cartões listava só o NOME.** Escolher "mercado pago" não diz QUAL
// competência baixa — e o palpite pode ter apontado o mês errado, que é literalmente a queixa.
// Aqui a lista traz **mês · valor · vencimento**, como o menu do empréstimo traz a parcela.
//
// ⭐ **ZERO MOTOR NOVO.** O net vem do `signedFaturaAmount`/`faturaNetTotal` (o dono único da
// soma de fatura desde a REGRA 6), o "já paga" vem do VÍNCULO (`isCardPayment` +
// `paidInvoiceMonth`) e nunca de um status gravado — *a flag diz "parece", o vínculo diz "é"*.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { signedFaturaAmount } from './fatura-net-total'

export interface FaturaPraQuitar {
  /** YYYY-MM — a competência */
  invoiceMonth: string
  /** compras − estornos (a REGRA 6) */
  net: number
  /** ISO da data de vencimento, derivada do `dueDay` do cartão */
  vencimento: string | null
  /** ⭐ já tem pagamento vinculado? (pelo VÍNCULO, nunca por status gravado) */
  jaPaga: boolean
}

export interface CartaoComFaturas {
  id: string
  nome: string
  faturas: FaturaPraQuitar[]
}

/**
 * ⭐⭐ O VENCIMENTO DA COMPETÊNCIA — derivado do `dueDay`, nunca gravado.
 *
 * ⚠️ **O `invoiceMonth` É o mês do VENCIMENTO** (é assim que o módulo o define desde a Fase
 * 2: *"`invoiceMonth` YYYY-MM do vencimento"*), então o vencimento é o `dueDay` DENTRO dele —
 * não o mês seguinte. Somar um mês aqui erraria a data em toda fatura.
 *
 * ⛔ E a data é montada em **UTC**, como o resto do módulo: `new Date(ano, mes, dia)` usa o
 * fuso do processo, e o servidor roda em UTC — em São Paulo isso puxaria o dia pra trás.
 */
export function vencimentoDaCompetencia(invoiceMonth: string, dueDay: number): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(invoiceMonth)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return null
  // ⚠️ dia 31 num mês de 30 cai no último dia dele, não no 1º do seguinte
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const dia = Math.min(Math.max(1, dueDay), ultimo)
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10)
}

/**
 * ⭐⭐ Os cartões REGISTRADOS da empresa, cada um com as faturas que existem.
 *
 * ⚠️ Uma consulta pros N cartões (não uma por cartão): é a cicatriz dos 9,6 s de 10/09, e
 * esta lista abre junto com a caixa.
 *
 * ⛔ **Fatura já paga NÃO sai da lista** — ela aparece marcada. Esconder tiraria do dono a
 * chance de ver que o palpite apontou uma competência que já foi quitada, que é justamente
 * o erro que ele quer poder corrigir.
 */
export async function cartoesComFaturas(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<CartaoComFaturas[]> {
  const cartoes = await db.businessCreditCard.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, dueDay: true },
    orderBy: { name: 'asc' },
  })
  if (!cartoes.length) return []

  const ids = cartoes.map((c) => c.id)
  const [itens, pagamentos] = await Promise.all([
    db.transaction.findMany({
      where: { businessCreditCardId: { in: ids }, invoiceMonth: { not: null }, isCardPayment: false },
      select: { businessCreditCardId: true, invoiceMonth: true, type: true, amount: true },
    }),
    // ⭐ o VÍNCULO: pagamento marcado E apontando a competência
    db.transaction.findMany({
      where: { businessCreditCardId: { in: ids }, isCardPayment: true, paidInvoiceMonth: { not: null } },
      select: { businessCreditCardId: true, paidInvoiceMonth: true },
    }),
  ])

  const net = new Map<string, Map<string, number>>()
  for (const it of itens) {
    const porCartao = net.get(it.businessCreditCardId!) ?? new Map<string, number>()
    const m = it.invoiceMonth as string
    porCartao.set(m, (porCartao.get(m) ?? 0) + signedFaturaAmount({ type: it.type, amount: it.amount, isCardPayment: false }))
    net.set(it.businessCreditCardId!, porCartao)
  }
  const pagas = new Set(pagamentos.map((p) => `${p.businessCreditCardId}|${p.paidInvoiceMonth}`))
  const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

  return cartoes.map((c) => ({
    id: c.id,
    nome: c.name,
    faturas: [...(net.get(c.id) ?? new Map<string, number>())]
      // ⭐ a mais recente primeiro: é a que o dono quita no dia a dia
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([invoiceMonth, valor]) => ({
        invoiceMonth,
        net: round2(valor),
        vencimento: vencimentoDaCompetencia(invoiceMonth, c.dueDay),
        jaPaga: pagas.has(`${c.id}|${invoiceMonth}`),
      })),
  }))
}

/** o formato que o `MenuDoChip` desenha — mesmo shape do menu de contrato/parcela */
export interface SecaoDeFatura {
  titulo: string
  itens: { id: string; nome: string; detalhe?: string }[]
}

/** ⚠️ dia/mês curto, o mesmo recorte do retrato do palpite (`vence DD/MM`) */
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * ⭐⭐ **O MENU DE CARTÃO/COMPETÊNCIA TEM UM DONO SÓ — e isso nasceu de uma cópia minha.**
 *
 * A tela montava estas seções **duas vezes**: no chip *"💳 pagamento de fatura ▾"* e no
 * *"não é essa — escolher outro cartão/fatura →"* do palpite. ⛔ É a mesma pergunta
 * (*"qual cartão, qual competência?"*) derivada em dois lugares — e duas derivações
 * divergem no primeiro ajuste (bastaria alguém acrescentar o "já paga" num só).
 *
 * ⭐ **O ID É COMPOSTO (`cartão|competência`) DE PROPÓSITO:** pedir o cartão num toque e a
 * competência noutro seria o *gesto pela metade* que o menu do empréstimo já resolveu em
 * 18/09. Um toque diz as duas coisas.
 *
 * ⚠️ **Cartão SEM fatura importada continua na lista**, marcado — o dono pode estar quitando
 * uma competência que ele ainda vai importar, e sumir com o cartão seria a lista mentindo
 * sobre o que existe.
 */
export function secoesDeFatura(
  cartoes: readonly CartaoComFaturas[],
  brl: (n: number) => string,
): SecaoDeFatura[] {
  const comFatura = cartoes
    .filter((k) => k.faturas.length > 0)
    .map((k) => ({
      titulo: `💳 ${k.nome}`,
      itens: k.faturas.map((f) => ({
        id: `${k.id}|${f.invoiceMonth}`,
        nome: `fatura ${f.invoiceMonth}`,
        // ⭐ valor E vencimento — a mesma honestidade do retrato da conta a pagar
        detalhe: `${brl(f.net)}${f.vencimento ? ` · vence ${diaCurto(f.vencimento)}` : ''}${f.jaPaga ? ' · já paga' : ''}`,
      })),
    }))
  const semFatura = cartoes.filter((k) => k.faturas.length === 0)
    .map((k) => ({ id: k.id, nome: k.nome, detalhe: 'sem fatura importada' }))
  return semFatura.length
    ? [...comFatura, { titulo: '💳 sem fatura importada', itens: semFatura }]
    : comFatura
}

/**
 * ⭐ O id composto volta a ser as duas respostas. Sem `|` é cartão sem competência — e aí
 * quem resolve a competência é o servidor, como antes.
 */
export function alvoDaFatura(id: string): { cardId: string; invoiceMonth?: string } {
  const [cardId, invoiceMonth] = id.split('|')
  return invoiceMonth ? { cardId, invoiceMonth } : { cardId }
}
