// ⭐⭐⭐ O PALPITE ACENDE — a cena do red-then-green do dono, contra BANCO (16/09/2026)
//
// **Por que este teste existe, e não só os puros:** a prova em prod mostrou *"0 de 1 linhas
// com MELHOR PALPITE"* — e isso estava **CERTO** (não há fatura de R$ 3.194,35 em cartão
// nenhum da Caçula; a de setembro ainda não foi importada). Mas *"não apareceu"* é
// ambíguo entre **"não há dado"** e **"está quebrado"**, e entregar essa ambiguidade seria
// entregar meia prova. Aqui a cena é montada e o palpite **tem** que acender.
//
// ⛔ É a lição do *"guard que testa a lib aprova a tela que ignora a lib"*: os testes puros
// provam a ESCOLHA; este prova que os motores reais, com dado real, chegam nela.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { palpitesDaCaixa } from '../palpites-da-caixa'
import { lerCaixa } from '../leitura-da-caixa'

const SUFIXO = `palpite-${Date.now()}`
let companyId = ''
let contaId = ''
let cardId = ''
let linhaDaFaturaId = ''
let linhaSemNadaId = ''

const VALOR_DA_FATURA = 3194.35

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: `Empresa ${SUFIXO}`, cnpj: `55${Date.now()}`.slice(0, 14) },
  })
  companyId = company.id
  const conta = await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', balance: 0 } })
  contaId = conta.id

  const card = await prisma.businessCreditCard.create({
    data: { companyId, name: 'sicredi', creditLimit: 20000, closingDay: 5, dueDay: 15 },
  })
  cardId = card.id

  /**
   * ⭐ A FATURA — três compras cujo NET dá exatamente o valor do pagamento.
   * ⚠️ Inclui um ESTORNO (CREDIT), porque o net é `compras − estornos`: uma fatura sem
   * estorno testaria só o caminho fácil, e foi o estorno esquecido que custou a REGRA 6.
   */
  await prisma.transaction.createMany({
    data: [
      { bankAccountId: null, businessCreditCardId: cardId, invoiceMonth: '2026-08', type: 'DEBIT', amount: 2000, date: new Date('2026-08-10T12:00:00Z'), description: 'compra A', origin: 'PDF_FATURA', lifecycle: 'EFFECTED', status: 'RECONCILED' },
      { bankAccountId: null, businessCreditCardId: cardId, invoiceMonth: '2026-08', type: 'DEBIT', amount: 1294.35, date: new Date('2026-08-12T12:00:00Z'), description: 'compra B', origin: 'PDF_FATURA', lifecycle: 'EFFECTED', status: 'RECONCILED' },
      { bankAccountId: null, businessCreditCardId: cardId, invoiceMonth: '2026-08', type: 'DEBIT', amount: 100, date: new Date('2026-08-13T12:00:00Z'), description: 'compra C', origin: 'PDF_FATURA', lifecycle: 'EFFECTED', status: 'RECONCILED' },
      { bankAccountId: null, businessCreditCardId: cardId, invoiceMonth: '2026-08', type: 'CREDIT', amount: 200, date: new Date('2026-08-14T12:00:00Z'), description: 'estorno', origin: 'PDF_FATURA', lifecycle: 'EFFECTED', status: 'RECONCILED' },
    ],
  })

  // ⭐ a linha do extrato — a do caso real do dono
  const l1 = await prisma.transaction.create({
    data: {
      bankAccountId: contaId, type: 'DEBIT', amount: VALOR_DA_FATURA, date: new Date('2026-09-14T12:00:00Z'),
      description: 'DEB.CTA.FATURA-030129693', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING',
    },
  })
  linhaDaFaturaId = l1.id

  // ⚠️ e uma linha que NÃO casa com nada — pra provar que o palpite não se inventa
  const l2 = await prisma.transaction.create({
    data: {
      bankAccountId: contaId, type: 'DEBIT', amount: 77.77, date: new Date('2026-09-14T12:00:00Z'),
      description: 'COMPRA QUALQUER SEM PAR', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING',
    },
  })
  linhaSemNadaId = l2.id
})

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ bankAccount: { companyId } }, { businessCreditCard: { companyId } }] } })
  await prisma.businessCreditCard.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐⭐ o cartão ≍ acende com o dado real', () => {
  it('⭐ a linha da fatura ganha MELHOR PALPITE com o efeito no botão', async () => {
    const { rows } = await lerCaixa(companyId)
    const palpites = await palpitesDaCaixa(companyId, rows)
    const p = palpites.get(linhaDaFaturaId)

    expect(p, 'a linha de 3.194,35 não ganhou palpite').toBeTruthy()
    expect(p!.acao).toBe('PGTO_CARTAO')
    expect(p!.familia).toContain('FATURA')
    expect(p!.titulo).toContain('sicredi')
    // ⭐ a competência NOMEADA — o dono confirma sabendo QUAL fatura baixa
    expect(p!.detalhe).toContain('2026-08')
    // ⛔ a diferença SEMPRE aparece, e aqui ela é zero
    expect(p!.diferenca).toContain('valor exato')
    // ⭐⭐ o botão diz O EFEITO
    expect(p!.botao).toBe('✓ Confirmar — baixa a fatura')
    // ⚠️ e o alvo é o que o `resolverLinha` precisa receber — senão o clique não efetiva
    expect(p!.alvo).toEqual({ cardId, invoiceMonth: '2026-08' })
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL QUE PROD ME ENSINOU. Antes do fix de 16/09 o palpite usava o
   * `resolvePaidInvoiceMonth`, que **cai na fatura mais recente** quando nada bate — e
   * devolvia um mês pros QUATRO cartões da Caçula com um valor que não batia nenhum.
   * *Palpite com fallback é palpite inventado.*
   */
  it('⛔ linha que NÃO casa com fatura nenhuma fica SEM palpite', async () => {
    const { rows } = await lerCaixa(companyId)
    const palpites = await palpitesDaCaixa(companyId, rows)
    expect(
      palpites.get(linhaSemNadaId),
      'inventou um palpite pra uma linha que não bate com nada — é o fallback de volta',
    ).toBeUndefined()
  })

  it('⭐ e o net da fatura é compras − ESTORNOS (a REGRA 6)', async () => {
    // 2000 + 1294,35 + 100 − 200 = 3194,35 — se o estorno fosse somado, não casaria
    const { rows } = await lerCaixa(companyId)
    const p = (await palpitesDaCaixa(companyId, rows)).get(linhaDaFaturaId)
    expect(p, 'o estorno foi somado em vez de subtraído — o palpite sumiu').toBeTruthy()
  })
})
