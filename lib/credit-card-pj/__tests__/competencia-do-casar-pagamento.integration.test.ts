/**
 * ⛔⛔⛔ A COMPETÊNCIA DO CASAR PAGAMENTO — O CASO REAL DE 20/10/2026.
 *
 * **O que aconteceu, com a hora:** o dono subiu a fatura de OUTUBRO do Carter banrisul
 * (R$ 12.696,23); o banner azul da prévia ofereceu *"casar pagamento de fatura"* — ele clica,
 * dá ok — e **a fatura continuou ABERTA**.
 *
 * ```
 * 04:35:19  o banner casa o pagamento  → paidInvoiceMonth '2026-09'   ⛔ ERRADO
 * 04:38:41  as 36 linhas de outubro nascem (3 minutos DEPOIS)
 * ```
 *
 * **A causa, em duas metades:**
 * 1. o banner casa *"sem esperar o confirm do import"* e mandava só `{ txId }` — então o
 *    servidor tinha que **adivinhar** a competência pelo VALOR;
 * 2. no instante do gesto **nenhuma fatura batia** os 12.696,23 (outubro ainda não existia), e
 *    `pickInvoiceMonthByValue` terminava num `sort().pop()` **silencioso** → setembro.
 *
 * Resultado medido pelo juiz: **K2 "2 pagamentos vinculados (esperado 1)"** em 2026-09 (net
 * 8.626,98) e outubro ABERTA com o pagamento dela no extrato.
 *
 * ⚠️⚠️ **RODA CONTRA BANCO DE PROPÓSITO.** Um teste puro sobre `pickInvoiceMonthByValue`
 * ficaria **verde com o defeito vivo**: o que decide o estrago é o `resolvePaidInvoiceMonth`
 * lendo as linhas REAIS daquele cartão no instante do gesto, e a gravação que vem depois. O
 * que morde é executar o caminho inteiro e olhar o que ficou no banco.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { casarPagamentoDeCartao, CasarPagamentoError } from '../casar-pagamento'
import { resolvePaidInvoiceMonth } from '../resolve-paid-month'
import { competenciaDaFatura } from '../faturas-pra-quitar'
import { aplicarMarcacao } from '@/lib/ofx-v3/aplicar-marcacao'

const db = new PrismaClient()
/** ⚠️ CNPJ exclusivo — medido contra os usados no repo (a cicatriz de 21/09) */
const CNPJ = '91919191000191'

/** os números REAIS do caso, medidos em prod */
const PAGAMENTO = 12696.23
const NET_DE_SETEMBRO = 8626.98

let companyId = ''
let bankAccountId = ''
let cardId = ''

beforeAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await db.company.create({ data: { name: 'Competência do casar', cnpj: CNPJ } })
  companyId = c.id
  const b = await db.bankAccount.create({
    data: { companyId, name: 'banrisul teste', bankName: 'Banrisul', accountType: 'CHECKING' },
  })
  bankAccountId = b.id
  const card = await db.businessCreditCard.create({
    data: { companyId, name: 'Carter banrisul', creditLimit: 60000, closingDay: 5, dueDay: 15 },
  })
  cardId = card.id
})

afterAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  await db.$disconnect()
})

/**
 * ⭐ O ESTADO DO BANCO NO INSTANTE DO GESTO (04:35): **só setembro existe**. É isto que a
 * cena precisa reproduzir — outubro nasce 3 minutos depois, e é justamente por isso que o
 * fallback tinha o que escolher de errado.
 */
beforeEach(async () => {
  await db.transaction.deleteMany({ where: { OR: [{ bankAccountId }, { businessCreditCardId: cardId }] } })
  await db.transaction.create({
    data: {
      businessCreditCardId: cardId, invoiceMonth: '2026-09', isCardPayment: false,
      type: 'DEBIT', amount: NET_DE_SETEMBRO, date: new Date('2026-08-20T12:00:00Z'),
      description: 'COMPRAS DE SETEMBRO', lifecycle: 'EFFECTED', status: 'PENDING',
      origin: 'PDF_FATURA',
    },
  })
})

/** a linha do extrato que o banner oferece pra casar */
async function oPagamento() {
  return db.transaction.create({
    data: {
      bankAccountId, type: 'DEBIT', amount: PAGAMENTO,
      date: new Date('2026-10-16T12:00:00Z'), description: 'PAGAMENTO CARTAO CARTER',
      lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
    },
  })
}

describe('⛔ o resolvedor por VALOR — nenhuma fatura batendo é NULL, nunca a mais recente', () => {
  it('⭐⭐ o caso de 20/10: 12.696,23 com só setembro no banco → NULL', async () => {
    expect(await resolvePaidInvoiceMonth(db, cardId, PAGAMENTO)).toBeNull()
  })

  it('⭐ e ele continua ACHANDO quando a fatura existe (a régua não afrouxou)', async () => {
    expect(await resolvePaidInvoiceMonth(db, cardId, NET_DE_SETEMBRO)).toBe('2026-09')
  })
})

describe('⛔⛔ a PORTA ÚNICA recusa ensinando — e NÃO grava meia-marca', () => {
  it('⭐⭐ sem competência resolvível: RECUSA, e a linha fica INTACTA', async () => {
    const tx = await oPagamento()
    await expect(
      casarPagamentoDeCartao({ companyId, cardId, txId: tx.id }, db),
    ).rejects.toThrow(CasarPagamentoError)

    const depois = await db.transaction.findUniqueOrThrow({
      where: { id: tx.id },
      select: { isCardPayment: true, businessCreditCardId: true, paidInvoiceMonth: true, categoryId: true },
    })
    /**
     * ⛔⛔ ESTA É A ASSERÇÃO QUE IMPORTA MAIS. Gravar cartão com `paidInvoiceMonth` NULO é
     * **pior que o mês errado**: `faturaVinculada` olha só o `businessCreditCardId`, então a
     * linha sairia pro ARQUIVO com selo de *"fatura paga"* e a fatura ficaria OPEN **pra
     * sempre** — e nem o K2 do juiz acusa. É o bug do Carter (20/09).
     */
    expect(depois.businessCreditCardId, 'meia-marca gravada: cartão sem competência').toBeNull()
    expect(depois.isCardPayment).toBe(false)
    expect(depois.paidInvoiceMonth).toBeNull()
  })

  it('⭐ a recusa ENSINA a saída, com o valor na frase', async () => {
    const tx = await oPagamento()
    await casarPagamentoDeCartao({ companyId, cardId, txId: tx.id }, db).then(
      () => expect.fail('devia ter recusado'),
      (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        expect(msg).toContain('12.696,23')
        expect(msg).toMatch(/confirme o import/i)
        expect(msg, 'a frase tem que dizer o EFEITO de gravar assim').toMatch(/aberta pra sempre/i)
      },
    )
  })
})

describe('⭐⭐⭐ o CONSERTO: o banner manda a competência do PDF', () => {
  it('⭐⭐ o caso real conserta: a prévia diz 2026-10 e o pagamento quita OUTUBRO', async () => {
    const tx = await oPagamento()
    /**
     * ⭐ `competenciaDaFatura` é a MESMA função que o confirm do import usa pra gravar o
     * `invoiceMonth` das 36 linhas — então o pagamento e as compras **não têm como cair em
     * competências diferentes**.
     */
    const doPdf = competenciaDaFatura('2026-10-16')
    expect(doPdf).toBe('2026-10')

    const r = await casarPagamentoDeCartao(
      { companyId, cardId, txId: tx.id, invoiceMonth: doPdf },
      db,
    )
    expect(r.paidInvoiceMonth, '⛔ o defeito de 20/10: caía em 2026-09').toBe('2026-10')

    const depois = await db.transaction.findUniqueOrThrow({
      where: { id: tx.id },
      select: { isCardPayment: true, businessCreditCardId: true, paidInvoiceMonth: true },
    })
    expect(depois.isCardPayment).toBe(true)
    expect(depois.businessCreditCardId).toBe(cardId)
    expect(depois.paidInvoiceMonth).toBe('2026-10')
  })

  it('⛔ e a competência da TELA ganha do resolvedor — inclusive quando o valor bateria noutro mês', async () => {
    // o dono manda 2026-10 numa linha cujo valor casa setembro ao centavo
    const tx = await db.transaction.create({
      data: {
        bankAccountId, type: 'DEBIT', amount: NET_DE_SETEMBRO,
        date: new Date('2026-10-16T12:00:00Z'), description: 'PAGAMENTO CARTAO',
        lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
      },
    })
    const r = await casarPagamentoDeCartao(
      { companyId, cardId, txId: tx.id, invoiceMonth: '2026-10' },
      db,
    )
    expect(r.paidInvoiceMonth, 'quem aponta a competência é o dono/PDF, não a aritmética').toBe('2026-10')
  })

  it('⛔ setembro NÃO fica com dois pagamentos — o K2 do juiz era isso', async () => {
    const tx = await oPagamento()
    await casarPagamentoDeCartao({ companyId, cardId, txId: tx.id, invoiceMonth: '2026-10' }, db)
    const emSetembro = await db.transaction.count({
      where: { businessCreditCardId: cardId, isCardPayment: true, paidInvoiceMonth: '2026-09' },
    })
    expect(emSetembro, 'K2: "2 pagamentos vinculados (esperado 1)"').toBe(0)
  })
})

describe('⛔⛔ o IMPORT (aplicar-marcacao) também não grava meia-marca', () => {
  /** o que o orquestrador passa pro `aplicarMarcacao` */
  async function alvo(txId: string) {
    return db.transaction.findUniqueOrThrow({
      where: { id: txId },
      select: {
        id: true, type: true, amount: true, description: true, date: true, categoryId: true,
        isCardPayment: true, businessCreditCardId: true, transferGroupId: true, status: true,
        ignoredAt: true, cashCoded: true,
      },
    })
  }

  it('⭐⭐ sem competência → desfecho `sem-competencia`, e NADA gravado', async () => {
    const tx = await oPagamento()
    const r = await aplicarMarcacao(
      await alvo(tx.id) as never, 'PAGAMENTO_CARTAO', { cardId }, companyId, 'user-teste', db,
    )
    /**
     * ⛔ `'sem-competencia'` existe porque colapsá-lo em `'skipped'` faria o LOG MENTIR: o
     * orquestrador escreve *"motivo: já estava aplicada (idempotente)"* no ramo do skip, e
     * aqui nada estava aplicado — a marcação foi RECUSADA.
     */
    expect(r).toBe('sem-competencia')

    const depois = await db.transaction.findUniqueOrThrow({
      where: { id: tx.id },
      select: { isCardPayment: true, businessCreditCardId: true, paidInvoiceMonth: true },
    })
    expect(depois.businessCreditCardId, 'o import gravou cartão sem competência').toBeNull()
    expect(depois.isCardPayment).toBe(false)
  })

  it('⭐ e ele continua aplicando quando a fatura existe', async () => {
    const tx = await db.transaction.create({
      data: {
        bankAccountId, type: 'DEBIT', amount: NET_DE_SETEMBRO,
        date: new Date('2026-09-15T12:00:00Z'), description: 'PAGAMENTO CARTAO',
        lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
      },
    })
    const r = await aplicarMarcacao(
      await alvo(tx.id) as never, 'PAGAMENTO_CARTAO', { cardId }, companyId, 'user-teste', db,
    )
    expect(r).toBe('applied')
    const depois = await db.transaction.findUniqueOrThrow({
      where: { id: tx.id }, select: { paidInvoiceMonth: true },
    })
    expect(depois.paidInvoiceMonth).toBe('2026-09')
  })
})

describe('⭐ `competenciaDaFatura` — a porta única, por RECORTE', () => {
  it('o vencimento manda: o `invoiceMonth` É o mês do vencimento', () => {
    expect(competenciaDaFatura('2026-10-16')).toBe('2026-10')
    expect(competenciaDaFatura('2026-01-05')).toBe('2026-01')
    // ⚠️ dia 1º: recorte não passa por fuso, então não escorrega pro mês anterior
    expect(competenciaDaFatura('2026-10-01')).toBe('2026-10')
  })

  it('⛔ formato que não casa devolve NULL — a competência não se adivinha', () => {
    expect(competenciaDaFatura(null)).toBeNull()
    expect(competenciaDaFatura(undefined)).toBeNull()
    expect(competenciaDaFatura('')).toBeNull()
    expect(competenciaDaFatura('16/10/2026')).toBeNull()
    expect(competenciaDaFatura('2026-10')).toBeNull()
    expect(competenciaDaFatura('2026-13-01'), 'mês 13 não existe').toBeNull()
  })
})
