/**
 * ⛔⛔⛔ O CASO DA STONE, REPRODUZIDO CONTRA BANCO REAL (30/09/2026)
 *
 * **O que aconteceu em prod:** a conta stone tinha `ledgerBal 168,36` declarado em 25/09 e
 * ZERO lançamentos depois disso — então o saldo tinha que ser **168,36**. Estava
 * **2.280,36**. Os 2.112,00 de diferença eram uma venda em dinheiro lançada à mão com data
 * **17/09** e criada em **28/09**: anterior à âncora, somada por cima de um saldo que o
 * banco já declarava.
 *
 * O import seguinte leu essa diferença como *"saldo previsto × extrato do banco"* e acusou
 * um descolamento no EXTRATO, apontando 13-17/08. O dono foi caçar agosto por um defeito
 * que era nosso e tinha dois dias.
 *
 * ⭐ **Este teste é o red-then-green do item 4**, e ele mede COMPORTAMENTO, não forma: com
 * o `increment` de volta na porta, o saldo fica 2.112,00 acima da régua e a asserção
 * quebra. É o contrafactual que mantém o guard estrutural honesto — sem ele, o guard de
 * forma poderia passar verde sobre uma derivação errada.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { recalcularSaldoConta, reAncorarContas, calcularSaldo } from '../recalcular'

const CNPJ = '71717171000171'
let companyId = ''
let contaAncorada = ''
let contaSemAncora = ''

/** o mesmo formato que a aplicação grava (meio-dia UTC) — fixture com meia-noite
 *  esconderia a convenção real e foi o que fez um teste passar sobre a âncora errada. */
const dia = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({
    data: { name: 'Drift Teste', cnpj: CNPJ, state: 'RS' },
    select: { id: true },
  })
  companyId = c.id

  // ⭐ a conta ANCORADA: o banco declarou 168,36 em 25/09 (o retrato da stone real)
  const a = await prisma.bankAccount.create({
    data: {
      companyId,
      name: 'stone (fixture)',
      bankCode: '197',
      accountType: 'CHECKING',
      balance: 168.36,
      ledgerBal: 168.36,
      ledgerBalDate: dia('2026-09-25'),
    },
    select: { id: true },
  })
  contaAncorada = a.id

  const b = await prisma.bankAccount.create({
    data: { companyId, name: 'cofre (fixture)', accountType: 'CASH', balance: 0 },
    select: { id: true },
  })
  contaSemAncora = b.id
})

afterAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

const saldo = async (id: string) =>
  (await prisma.bankAccount.findUniqueOrThrow({ where: { id }, select: { balance: true } })).balance

describe('⛔⛔⛔ lançamento RETROATIVO não drifta mais o saldo (o caso da Stone)', () => {
  it('⭐⭐ venda de R$ 2.112,00 com data ANTERIOR à âncora → saldo continua 168,36', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          bankAccountId: contaAncorada,
          date: dia('2026-09-17'), // ⚠️ ANTES da âncora de 25/09 — o coração do caso
          description: 'receita de venda dinheiro',
          amount: 2112,
          type: 'CREDIT',
          status: 'RECONCILED',
          lifecycle: 'EFFECTED',
          origin: 'MANUAL',
        },
      })
      await reAncorarContas(tx, [contaAncorada])
    })

    // ⛔ com o `increment` de antes, aqui daria 2.280,36 — o número EXATO que prod mostrava.
    expect(await saldo(contaAncorada)).toBe(168.36)
  })

  it('⭐ e o lançamento POSTERIOR à âncora entra normal (a régua não virou parede)', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          bankAccountId: contaAncorada,
          date: dia('2026-09-28'), // depois da âncora
          description: 'venda de 28/09',
          amount: 500,
          type: 'CREDIT',
          status: 'RECONCILED',
          lifecycle: 'EFFECTED',
          origin: 'MANUAL',
        },
      })
      await reAncorarContas(tx, [contaAncorada])
    })
    expect(await saldo(contaAncorada)).toBe(668.36)
  })

  it('⭐⭐ a derivação é IDEMPOTENTE — rodar 3× dá o mesmo número', async () => {
    /**
     * ⚠️ É esta propriedade que autoriza chamar a re-ancoragem no fim de QUALQUER gesto sem
     * medo. Com delta, chamar duas vezes dobrava o efeito — e por isso cada porta tinha que
     * lembrar de somar exatamente uma vez, o que é disciplina, não construção.
     */
    const antes = await saldo(contaAncorada)
    await recalcularSaldoConta(prisma, contaAncorada)
    await recalcularSaldoConta(prisma, contaAncorada)
    await recalcularSaldoConta(prisma, contaAncorada)
    expect(await saldo(contaAncorada)).toBe(antes)
  })

  it('⛔ APAGAR uma linha retroativa também não drifta (o mesmo bug na direção oposta)', async () => {
    const t = await prisma.transaction.create({
      data: {
        bankAccountId: contaAncorada,
        date: dia('2026-09-10'),
        description: 'erro a apagar',
        amount: 999,
        type: 'DEBIT',
        status: 'RECONCILED',
        lifecycle: 'EFFECTED',
        origin: 'MANUAL',
      },
    })
    await reAncorarContas(prisma, [contaAncorada])
    const depoisDeCriar = await saldo(contaAncorada)

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: t.id } })
      await reAncorarContas(tx, [contaAncorada])
    })
    // a linha era anterior à âncora: nem criar nem apagar mexe no saldo
    expect(depoisDeCriar).toBe(668.36)
    expect(await saldo(contaAncorada)).toBe(668.36)
  })

  it('⭐ conta SEM âncora (cofre) soma tudo — e o retroativo CONTA lá, como deve', async () => {
    /**
     * ⚠️ A régua não é "ignorar o passado": é "não recontar o que o banco já declarou".
     * No cofre não há declaração de banco nenhuma, então Σ(todas) é a verdade — inclusive
     * a linha antiga. Se este teste falhasse, a cura teria virado uma doença nova
     * (esconder dinheiro de conta manual).
     */
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          bankAccountId: contaSemAncora,
          date: dia('2026-01-05'),
          description: 'venda antiga em dinheiro',
          amount: 300,
          type: 'CREDIT',
          status: 'RECONCILED',
          lifecycle: 'EFFECTED',
          origin: 'MANUAL',
        },
      })
      await reAncorarContas(tx, [contaSemAncora])
    })
    expect(await saldo(contaSemAncora)).toBe(300)
  })

  it('⛔⛔ CONTRAFACTUAL — com o `increment` de volta, o saldo drifta 2.112,00', () => {
    /**
     * ⭐ O contrafactual é o que impede este arquivo de ser uma afirmação sobre o mundo bom.
     * Ele roda a aritmética ANTIGA sobre o MESMO estado e mostra o número de prod.
     */
    const ancora = 168.36
    const posAncora = 500 // a venda de 28/09
    const pelaRegua = calcularSaldo({
      ledgerBal: ancora,
      usaAnchor: true,
      txs: [
        {
          id: 'x', date: dia('2026-09-28'), createdAt: new Date(), type: 'CREDIT', amount: 500,
          bankAccountId: 'c', transferGroupId: null, transferDirection: null, lifecycle: 'EFFECTED',
        },
      ],
      bankAccountId: 'c',
    }).saldo
    expect(pelaRegua).toBe(ancora + posAncora)

    // a régua VELHA: cache + delta da linha retroativa (que a âncora já continha)
    const comIncrementDaRetroativa = pelaRegua + 2112
    expect(comIncrementDaRetroativa).toBe(2780.36)
    expect(comIncrementDaRetroativa - pelaRegua).toBe(2112)
  })
})
