// ⭐⭐ A LISTA DE CARTÕES COM O ESTADO DA FATURA (09/09/2026).
//
// ⚠️ TRÊS QUERIES, NÃO UMA POR CARTÃO: cartões, faturas e pagamentos vêm em lote e o
// casamento roda em memória. Uma ida ao banco por cartão pra desenhar uma lista é o padrão
// que já custou 9,6 s na fila de Conciliação.
//
// ⛔ E O ESTADO NÃO É GRAVADO EM LUGAR NENHUM: ele é derivado a cada leitura por
// `estadoDaFaturaNoCard`. Campo gravado de estado envelhece — a `CreditCardInvoice.status`
// é a prova viva disso: ela existe desde a Fatia 2 e **ninguém a transiciona com o tempo**,
// então uma fatura importada nasce OPEN e continua OPEN depois de vencer.

import { prisma } from '@/lib/db'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import {
  estadoDaFaturaNoCard, diasEntre, hojeNoBrasil,
  type EstadoNoCard, type FaturaConhecida,
} from './estado-da-fatura-no-card'
import { JANELA_DIAS, TOLERANCIA } from './casar-pagamento-pf'

export interface CartaoComEstado {
  id: string
  name: string
  bankName: string | null
  lastDigits: string | null
  brand: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  closingDayRule: string
  /** ⭐ a linha nova do card */
  fatura: EstadoNoCard
  /**
   * ⭐⭐ O DÉBITO QUE PARECE O PAGAMENTO DESTA FATURA — sugestão, nunca vínculo.
   *
   * **O dono:** *"pago = pagamento REGISTRADO (…) o dia que o extrato entrar com a linha,
   * vira paga sozinha"*. A parte que o sistema NÃO pode fazer sozinho é decidir **qual
   * débito pagou qual cartão**: ele tem 4 cartões e os valores podem se parecer. Casar por
   * conta própria marcaria uma fatura como paga com o dinheiro de outra.
   *
   * Então o card **mostra o candidato com o motivo** e o dono confirma em 1 clique — e a
   * partir daí o estado PAGA é derivado sozinho, sem ele tocar em mais nada.
   */
  pagamentoSugerido: {
    transacaoId: string
    data: string
    descricao: string
    valor: number
    contaNome: string | null
    valorExato: boolean
    distanciaDias: number
  } | null
}

export async function listarCartoesComEstado(
  userId: string, profileId: string, agora: Date = new Date(),
): Promise<CartaoComEstado[]> {
  // ⛔ o dia é o DO BRASIL — ver `hojeNoBrasil`. O servidor roda em UTC, e das 21h à
  // meia-noite ele já está no dia seguinte: toda fatura que vence hoje apareceria vencida.
  const hoje = hojeNoBrasil(agora)
  await checkProfileAccess(userId, profileId)

  const cards = await prisma.creditCard.findMany({
    where: { profileId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!cards.length) return []

  const ids = cards.map((c) => c.id)
  const [faturas, pagamentos] = await Promise.all([
    prisma.creditCardInvoice.findMany({
      where: { creditCardId: { in: ids } },
      select: {
        id: true, creditCardId: true, reference: true, closingDate: true,
        dueDate: true, totalAmount: true, paidAmount: true, status: true,
      },
    }),
    // ⭐ a DATA do pagamento sai do vínculo, não de um campo da fatura: quem paga é uma
    // transação, e é ela que sabe quando o dinheiro saiu.
    prisma.personalTransaction.findMany({
      where: { profileId, isInvoicePayment: true, creditCardInvoiceId: { not: null } },
      select: { creditCardInvoiceId: true, date: true },
      orderBy: { date: 'desc' },
    }),
  ])

  const pagoEmPorFatura = new Map<string, Date>()
  for (const p of pagamentos) {
    if (p.creditCardInvoiceId && !pagoEmPorFatura.has(p.creditCardInvoiceId)) {
      pagoEmPorFatura.set(p.creditCardInvoiceId, p.date)
    }
  }

  // ⚠️ UMA query pros candidatos de TODOS os cartões — débitos do perfil, em conta
  // bancária, que ainda não pagam fatura nenhuma, na janela em volta dos vencimentos.
  const vencimentos = faturas.map((f) => f.dueDate.getTime())
  const ms = JANELA_DIAS * 86_400_000
  const candidatos = vencimentos.length
    ? await prisma.personalTransaction.findMany({
        where: {
          profileId, type: 'DEBIT', isInvoicePayment: false,
          creditCardId: null, bankAccountId: { not: null },
          date: {
            gte: new Date(Math.min(...vencimentos) - ms),
            lte: new Date(Math.max(...vencimentos) + ms),
          },
        },
        select: {
          id: true, date: true, description: true, amount: true,
          bankAccount: { select: { name: true } },
        },
      })
    : []

  const porCartao = new Map<string, FaturaConhecida[]>()
  for (const f of faturas) {
    const lista = porCartao.get(f.creditCardId) ?? []
    lista.push({
      id: f.id, reference: f.reference, closingDate: f.closingDate, dueDate: f.dueDate,
      totalAmount: f.totalAmount, paidAmount: f.paidAmount, status: f.status,
      pagoEm: pagoEmPorFatura.get(f.id) ?? null,
    })
    porCartao.set(f.creditCardId, lista)
  }

  const usados = new Set<string>()
  return cards.map((c) => {
    const fatura = estadoDaFaturaNoCard({
      card: {
        closingDay: c.closingDay, dueDay: c.dueDay,
        closingDayRule: c.closingDayRule as 'ATUAL' | 'PROXIMA',
      },
      faturas: porCartao.get(c.id) ?? [],
      hoje,
    })
    return {
      id: c.id, name: c.name, bankName: c.bankName, lastDigits: c.lastDigits,
      brand: c.brand, creditLimit: c.creditLimit,
      closingDay: c.closingDay, dueDay: c.dueDay, closingDayRule: c.closingDayRule,
      fatura,
      pagamentoSugerido: sugerirPagamento(fatura, candidatos, usados),
    }
  })
}

type Candidato = {
  id: string; date: Date; description: string; amount: number
  bankAccount: { name: string } | null
}

/**
 * ⭐ A MESMA RÉGUA do `candidatosPagamentoPF` (valor exato primeiro, depois proximidade da
 * data) — reusada, não recriada: dois rankers da mesma pergunta divergem no primeiro caso
 * de borda, que é a lição do B1.
 *
 * ⛔ E um débito só é oferecido a UM cartão: sem isso, o mesmo dinheiro apareceria como
 * "o pagamento" de duas faturas ao mesmo tempo.
 */
function sugerirPagamento(
  fatura: EstadoNoCard, candidatos: Candidato[], usados: Set<string>,
): CartaoComEstado['pagamentoSugerido'] {
  // ⚠️ só faz sentido perguntar por pagamento de fatura que JÁ FECHOU e não foi paga
  if (!['FECHADA', 'VENCE_HOJE', 'VENCIDA'].includes(fatura.estado)) return null
  if (!fatura.valor || !fatura.vencimento) return null
  const venc = new Date(`${fatura.vencimento}T00:00:00.000Z`)
  const ms = JANELA_DIAS * 86_400_000

  const melhor = candidatos
    .filter((t) => !usados.has(t.id))
    .filter((t) => Math.abs(t.date.getTime() - venc.getTime()) <= ms)
    .map((t) => ({
      t,
      valorExato: Math.abs(t.amount - fatura.valor!) <= TOLERANCIA,
      distanciaDias: Math.abs(diasEntre(venc, t.date)),
    }))
    // ⛔ SÓ o valor EXATO é oferecido. "Parecido" aqui marcaria uma fatura como paga com
    // o dinheiro errado — e desfazer isso depois é bem mais caro que um clique a mais.
    .filter((x) => x.valorExato)
    .sort((a, b) => a.distanciaDias - b.distanciaDias)[0]
  if (!melhor) return null

  usados.add(melhor.t.id)
  return {
    transacaoId: melhor.t.id,
    data: melhor.t.date.toISOString().slice(0, 10),
    descricao: melhor.t.description,
    valor: melhor.t.amount,
    contaNome: melhor.t.bankAccount?.name ?? null,
    valorExato: melhor.valorExato,
    distanciaDias: melhor.distanciaDias,
  }
}
