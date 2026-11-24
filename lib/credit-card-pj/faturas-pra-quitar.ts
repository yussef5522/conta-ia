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
// ⭐ as datas do ciclo moram no módulo PURO (`ciclo.ts`) — a tela também precisa delas; aqui só reexporta
export { vencimentoDaCompetencia, fechamentoDaCompetencia } from './ciclo'
import { vencimentoDaCompetencia, fechamentoDaCompetencia, excessoDoPagamento } from './ciclo'
import { lerCarteira } from './carteira'
import { diaDoBrasil } from '@/lib/margem/dia'

export interface FaturaPraQuitar {
  /** YYYY-MM — a competência */
  invoiceMonth: string
  /** compras − estornos (a REGRA 6) */
  net: number
  /** ISO da data de vencimento, derivada do `dueDay` do cartão */
  vencimento: string | null
  /** ⭐ já tem pagamento vinculado? (pelo VÍNCULO, nunca por status gravado) */
  jaPaga: boolean
  /** ⭐ 24/11 — o estado do ciclo e o que FALTA pagar (a conta da carteira, `contaDaFatura`) */
  estado: 'aberta' | 'fechada' | 'parcial' | 'paga'
  falta: number
  /** vencida sem estar paga (o destaque da lista) */
  vencida: boolean
  /** R53 — fatura de quitação (cartão encerrado) */
  quitacao: boolean
}

export interface CartaoComFaturas {
  id: string
  nome: string
  faturas: FaturaPraQuitar[]
}


/**
 * ⭐⭐ O INVERSO — A COMPETÊNCIA A PARTIR DO VENCIMENTO DO DOCUMENTO (20/10/2026).
 *
 * `invoiceMonth` **É** o mês do vencimento (a definição do módulo desde a Fase 2), então a
 * conta é um recorte — e é justamente por ser trivial que ela precisa de **um dono**: ela
 * vivia escrita à mão dentro do confirm do import (`body.dueDate.slice(0, 7)`), e copiá-la
 * pro banner da prévia criaria a **2ª derivação** da mesma data. *Duas réguas pra "de que mês
 * é esta fatura?" divergem no primeiro formato novo de data, e aí o banner casa o pagamento
 * numa competência e o import grava as linhas em outra* — que é exatamente o estrago de
 * 20/10 por outro caminho.
 *
 * ⛔ **Recorte, nunca `new Date()`:** parsear pra objeto e reformatar passa pelo fuso do
 * processo e pode puxar o dia 1º pro mês anterior. O formato é fechado (`YYYY-MM-DD`), então
 * o que não casa devolve `null` — **a competência não se adivinha**.
 */
export function competenciaDaFatura(dueDate: string | null | undefined): string | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null
  const mes = Number(dueDate.slice(5, 7))
  if (mes < 1 || mes > 12) return null
  return dueDate.slice(0, 7)
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
  hoje: string = diaDoBrasil(new Date()),
): Promise<CartaoComFaturas[]> {
  /**
   * ⛔⛔ 24/11 — A LISTA PULAVA A FATURA DE QUITAÇÃO. Ela montava as faturas SÓ das linhas
   * (`invoiceMonth` das compras): a quitação do Mercado Pago (R$ 430,51, semeada das parcelas,
   * SEM linhas) não existia aqui — o grupo parava em 2026-10. Era a 2ª régua de "que faturas
   * existem", paralela ao registro.
   * ⭐ Agora a lista é VISTA da carteira (`lerCarteira`): TODA fatura do registro, de qualquer
   * origem, com o estado e o que falta pela MESMA conta da página.
   */
  const cart = await lerCarteira(companyId, hoje, db)
  return cart.cartoes.map((c) => ({
    id: c.id,
    nome: c.name,
    faturas: ordenarFaturasPraQuitar(c.faturas.map((f) => ({
      invoiceMonth: f.mes,
      net: Math.round((f.total + f.acrescimo) * 100) / 100,
      vencimento: f.vencimento,
      jaPaga: f.estado === 'paga',
      estado: f.estado,
      falta: f.falta,
      vencida: f.estado !== 'paga' && f.vencimento < hoje,
      quitacao: f.quitacao,
    }))),
  }))
}

/**
 * ⭐ 24/11 — A ORDEM DA LISTA: não pagas primeiro (a vencida mais antiga no topo), pagas depois
 * (a mais recente primeiro). É a fatura que o dono quita hoje que tem que estar à mão.
 */
export function ordenarFaturasPraQuitar(fs: FaturaPraQuitar[]): FaturaPraQuitar[] {
  const abertas = fs.filter((f) => !f.jaPaga).sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? '') || a.invoiceMonth.localeCompare(b.invoiceMonth))
  const pagas = fs.filter((f) => f.jaPaga).sort((a, b) => b.invoiceMonth.localeCompare(a.invoiceMonth))
  return [...abertas, ...pagas]
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
        nome: `${f.jaPaga ? '✓ ' : f.vencida ? '⚠ ' : ''}fatura ${f.invoiceMonth}`,
        // ⭐ valor E vencimento — a mesma honestidade do retrato da conta a pagar
        // ⭐ 24/11 — o ESTADO na linha: vencida em destaque, parcial diz o que falta, paga diz que é paga
        detalhe: `${brl(f.net)}${f.vencimento ? ` · vence ${diaCurto(f.vencimento)}` : ''}${
          f.jaPaga ? ' · já paga' : f.vencida ? ' · ⚠ VENCIDA' : ''}${!f.jaPaga && f.estado === 'parcial' ? ` · faltam ${brl(f.falta)}` : ''}${f.quitacao ? ' · quitação' : ''}`,
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

/**
 * ⭐⭐ 24/11 — O QUE PERGUNTAR ANTES DE QUITAR (puro; a caixa de entrada e o guard decidem por aqui).
 *  · fatura JÁ PAGA → pergunta antes (2º pagamento na mesma fatura é raro, merece confirmação);
 *  · pagamento MAIOR que o que falta → o dono declara o que são os R$ a mais (vai pelo gesto);
 *  · senão → direto.
 * A medida do excesso é a MESMA da porta (`excessoDoPagamento`) — a tela não pergunta o que o
 * servidor não cobra, nem deixa passar o que ele recusa.
 */
export type PerguntaAntesDeQuitar =
  | { tipo: 'DIRETO' }
  | { tipo: 'JA_PAGA'; excesso: number; falta: number }
  | { tipo: 'A_MAIOR'; excesso: number; falta: number }
export function perguntaAntesDeQuitar(valorDaLinha: number, f: FaturaPraQuitar | undefined): PerguntaAntesDeQuitar {
  if (!f) return { tipo: 'DIRETO' }
  const excesso = excessoDoPagamento(valorDaLinha, f.falta)
  if (f.jaPaga) return { tipo: 'JA_PAGA', excesso, falta: f.falta }
  return excesso > 0 ? { tipo: 'A_MAIOR', excesso, falta: f.falta } : { tipo: 'DIRETO' }
}
