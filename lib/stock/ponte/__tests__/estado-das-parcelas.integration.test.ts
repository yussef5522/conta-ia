// ⭐⭐⭐ "CADÊ A 002?" — O CASO REAL DO CASPER, CONTRA O BANCO (13/09/2026).
//
// **O dono:** *"Casper NF 967122, parcela 002 (2.079,98, venc 10/09) não aparece nas notas
// abertas do card, e no Contas a Pagar eu não acho ela em estado nenhum."*
//
// Ela estava **PAGA** — conciliada com uma linha da stone — e conta conciliada **sai** do
// Contas a Pagar por decisão de 28/05 (a mesma linha em duas telas é duplicação). O dado
// estava certo; **faltava a tela responder**. Os números abaixo são os de prod, medidos
// por id antes de escrever qualquer linha de código.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { estadoDasParcelas } from '../estado-das-parcelas'

const CNPJ = '50607080000313'
const CNPJ_FORN = '88728027000147'
// nº da NF nas posições 26..34 → 000967122
const CHAVE = '43260888728027000147550010009671221621147870'

let companyId: string
let supplierId: string
let contaId: string
let nfeId: string

/** a conta a pagar da parcela (o que a ponte cria) */
async function contaAPagar(valor: number, venc: string) {
  return prisma.transaction.create({
    data: {
      description: 'CASPER — parcela', amount: valor, date: new Date(venc), dueDate: new Date(venc),
      type: 'DEBIT', lifecycle: 'PAYABLE', status: 'PENDING', origin: 'ESTOQUE_NF', supplierId,
    },
  })
}

/** a linha do extrato (o dinheiro que saiu de verdade) */
async function linhaDoExtrato(valor: number, dia: string) {
  return prisma.transaction.create({
    data: {
      description: 'PAGAMENTO BOLETO CASPER', amount: -valor, date: new Date(dia),
      type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED', origin: 'OFX', bankAccountId: contaId,
    },
  })
}

async function amarrar(nDup: string, valor: number, venc: string, txId: string) {
  await prisma.stockPayableLink.create({
    data: { companyId, origem: 'NFE', refId: nfeId, nDup, chave: CHAVE, transactionId: txId, supplierId, valor, dVenc: new Date(venc) },
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA PARCELAS' } })).id
  supplierId = (await prisma.supplier.create({ data: { companyId, razaoSocial: 'CASPER DISTRIB', cnpj: CNPJ_FORN } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'stone', bankName: 'Stone' } })).id
  nfeId = (await prisma.stockNfe.create({
    data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', temXmlCompleto: true, emitNome: 'CASPER DISTRIB', emitCnpj: CNPJ_FORN, vNF: 6239.95 },
  })).id
  // as 3 duplicatas do XML, como a SEFAZ mandou
  await prisma.stockNfeDup.createMany({
    data: [
      { companyId, nfeId, nDup: '001', vDup: 2079.99, dVenc: new Date('2026-09-03') },
      { companyId, nfeId, nDup: '002', vDup: 2079.98, dVenc: new Date('2026-09-10') },
      { companyId, nfeId, nDup: '003', vDup: 2079.98, dVenc: new Date('2026-09-17') },
    ],
  })
})

afterEach(async () => {
  await prisma.stockPayableLink.deleteMany({ where: { companyId } })
  await prisma.stockNfeDup.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { OR: [{ supplier: { companyId } }, { bankAccount: { companyId } }] } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ a NF 967122 conta o que houve com cada parcela', () => {
  beforeEach(async () => {
    // 001 e 002 PAGAS, cada uma conciliada com a linha da stone (com os R$ 6,86 de juros)
    for (const [nDup, valor, venc, pago, dia] of [
      ['001', 2079.99, '2026-09-03', 2086.85, '2026-09-04'],
      ['002', 2079.98, '2026-09-10', 2086.84, '2026-09-11'],
    ] as const) {
      const linha = await linhaDoExtrato(pago, dia)
      const conta = await prisma.transaction.create({
        data: {
          description: 'CASPER — parcela', amount: valor, date: new Date(venc), dueDate: new Date(venc),
          type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED', origin: 'ESTOQUE_NF', supplierId,
          paymentDate: new Date(dia), reconciledWithId: linha.id,
        },
      })
      await amarrar(nDup, valor, venc, conta.id)
    }
    // 003 em aberto — a única que o dono vê no card
    const aberta = await contaAPagar(2079.98, '2026-09-17')
    await amarrar('003', 2079.98, '2026-09-17', aberta.id)
  })

  it('⭐⭐⭐ as 3 aparecem, com o estado de cada uma — a 002 deixa de sumir', async () => {
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    expect(p).toHaveLength(3)
    expect(p.map((x) => [x.numero, x.estado])).toEqual([
      ['001', 'PAGA'],
      ['002', 'PAGA'],
      ['003', 'ABERTA'],
    ])
  })

  it('⭐⭐ a 002 diz QUANDO, POR QUAL LINHA e QUANTO de juros — a pergunta morre aqui', async () => {
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    const dois = p.find((x) => x.numero === '002')!
    expect(dois.pagaEm).toBe('2026-09-11')
    expect(dois.linha).toBeTruthy()
    expect(dois.linha!.valor).toBeCloseTo(2086.84, 2)
    expect(dois.linha!.conta).toBe('stone')
    // ⭐ os 6,86 de juros aparecem NOMEADOS — sem isso o dono vê dois números que não
    // batem (2.079,98 × 2.086,84) e nada explicando a diferença
    expect(dois.linha!.diferenca).toBeCloseTo(6.86, 2)
    expect(dois.frase).toContain('11/09')
    expect(dois.frase).toContain('juros')
  })

  it('⭐ e a 003 continua em aberto, com o vencimento — é a que o card mostra', async () => {
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    const tres = p.find((x) => x.numero === '003')!
    expect(tres.estado).toBe('ABERTA')
    expect(tres.linha).toBeNull()
    expect(tres.frase).toContain('17/09')
  })

  it('⛔ "paga sem vínculo" é estado PRÓPRIO — marcar paga na mão ≠ ter linha do extrato', async () => {
    // ⚠️ este é o estado que o juiz F1 vigia como dupla contagem: alguém disse que pagou,
    // e não existe dinheiro apontado. Chamar de PAGA esconderia exatamente isso.
    const conta = await prisma.transaction.findFirst({ where: { supplierId, lifecycle: 'PAYABLE' } })
    await prisma.transaction.update({
      where: { id: conta!.id },
      data: { lifecycle: 'EFFECTED', status: 'RECONCILED', paymentDate: new Date('2026-09-16') },
    })
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    const tres = p.find((x) => x.numero === '003')!
    expect(tres.estado).toBe('PAGA_SEM_VINCULO')
    expect(tres.linha).toBeNull()
    expect(tres.frase).toContain('sem linha do extrato')
  })

  it('⚠️ parcela que nunca foi pro financeiro diz isso, em vez de sumir', async () => {
    // o operador conferiu a nota e o dono ainda não enviou o boleto — estado REAL,
    // e o que a tela tem que dizer é o que FALTA fazer
    await prisma.stockPayableLink.deleteMany({ where: { companyId, nDup: '003' } })
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    const tres = p.find((x) => x.numero === '003')!
    expect(tres.estado).toBe('SEM_CONTA')
    expect(tres.transactionId).toBeNull()
    expect(tres.frase).toContain('Contas a Pagar')
  })

  it('⛔⛔ NÃO relê a duplicata crua — renegociar troca as parcelas que a tela mostra', async () => {
    // a régua de 29/08: quem diz "quais parcelas valem hoje" é o `combinadoDaNota`. Foi
    // ler o XML direto que fez o recibo mostrar 3 depois de uma renegociação pra 5.
    await prisma.stockParcelaCombinada.createMany({
      data: [1, 2, 3, 4, 5].map((i) => ({
        companyId, origemDoc: 'NFE', refId: nfeId, numero: `R0${i}`,
        valor: 1247.99, dVenc: new Date(`2026-10-0${i}`), origem: 'RENEGOCIADO', ativo: true,
      })),
    })
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    expect(p).toHaveLength(5)
    expect(p.every((x) => x.origem === 'RENEGOCIADO')).toBe(true)
    // ⚠️ e nenhuma herda o estado das antigas: são outras parcelas, outro combinado
    expect(p.every((x) => x.estado === 'SEM_CONTA')).toBe(true)
  })
})
