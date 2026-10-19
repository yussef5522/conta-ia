/**
 * ⭐⭐⭐ A PARCELA PAGA EM PEDAÇOS — CONTRA BANCO, COM O CASO REAL DE 16/10 (19/10/2026)
 *
 * ⚠️ **Por que integração e não puro:** o que o brief pediu pra travar é uma afirmação sobre o
 * **estado gravado** — *"parcela 25 PAGA · capital 4.385,96 · encargos 2.669,79 · saldo devedor
 * 144.736,96"* —, e as três travas novas dependem de ler o banco (os vínculos que JÁ existem, o
 * status da parcela, a elegibilidade da transação). *Teste puro aprovaria uma gravação que não
 * acontece* — a cicatriz de 14/09 (testei o modal e não o botão que o abre).
 *
 * **O caso, medido em prod antes de a fixture ser escrita:**
 * ```
 * C41022227-1 · POS · taxa 1,72076372375527%/mês · agenda IMPORTED (amort-only, interest 0)
 * parcela 25 · venc 15/10 · capital 4.385,96 · abertura 149.122,92 · fecha 144.736,96
 * 16/10  DEBIT 4.257,46  "AMORTIZACAO CONTRATO-C61022527"   ⎫ a conta garantida: o banco abre
 * 16/10  DEBIT 2.798,29  "LIQUIDACAO CONTRATO-C61022527"    ⎭ um auxiliar, usa e extingue no dia
 *                                     Σ 7.055,75 − 4.385,96 = 2.669,79 de encargos
 * ```
 * ⛔⛔ **Os rótulos do banco NÃO mapeiam capital/juros** — *"AMORTIZACAO"* não é a amortização
 * da parcela (4.257,46 ≠ 4.385,96) e *"LIQUIDACAO"* não é o juros. **Só a SOMA fecha**, e é por
 * isso que o split sai do cronograma, nunca da palavra que o banco escreveu. *Heurística sobre
 * texto livre pode SUGERIR, nunca DECIDIR* (a régua de 29/08).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { vincularPagamentoDeParcela, VinculoDeParcelaError } from '../vincular-pagamento'
import { saldoDevedorAtual } from '../saldo'
import { estadoDaParcela, rotuloDoGesto } from '../estado-da-parcela'

/** ⚠️ CNPJ MEDIDO como livre no repo (o guard `cnpj-de-teste-nao-colide` cobra isso) */
const CNPJ = '50607080002277'

const TAXA = 0.0172076372375527
const CAPITAL = 4385.96
const ABERTURA_25 = 149122.92
const FECHA_25 = 144736.96

let companyId: string
let contaId: string
let loanId: string
let parcela25: string
/** as duas linhas reais de 16/10 */
let txAmort: string
let txLiquid: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'PEDACOS' } })
  companyId = c.id
  const b = await prisma.bankAccount.create({
    data: { companyId, name: 'sicredi', accountType: 'CHECKING', balance: 0 },
  })
  contaId = b.id

  const loan = await prisma.loan.create({
    data: {
      companyId,
      bankAccountId: contaId,
      lender: 'Sicredi',
      contractNumber: 'C41022227-1',
      principal: 240000,
      interestRateMonthly: TAXA,
      rateType: 'POS',
      termMonths: 60,
      disbursementDate: new Date('2024-09-15T00:00:00Z'),
      firstDueDate: new Date('2024-10-15T00:00:00Z'),
      amortizationSystem: 'SAC',
      scheduleSource: 'IMPORTED',
      installmentsPaidBefore: 20,
      status: 'ACTIVE',
    },
  })
  loanId = loan.id

  /**
   * ⚠️ A AGENDA NASCE COM `interest: 0` — e isso **não é fixture preguiçosa, é o dado real**:
   * agenda importada de pós-fixado é amort-only por desenho (*"o juros do mês só se conhece no
   * vencimento"*, 10/09). É justamente esse 0 que faz o `encargosSaoApurados` existir e que
   * obriga o teto a derivar o juros do SALDO.
   */
  for (const [n, abertura] of [[24, 153508.88], [25, ABERTURA_25], [26, FECHA_25]] as const) {
    const i = await prisma.loanInstallment.create({
      data: {
        loanId,
        number: n,
        dueDate: new Date(`2026-${n === 24 ? '09' : n === 25 ? '10' : '11'}-15T00:00:00Z`),
        openingBalance: abertura,
        interest: 0,
        amortization: CAPITAL,
        correcao: 0,
        payment: CAPITAL,
        closingBalance: Math.round((abertura - CAPITAL) * 100) / 100,
        status: 'OPEN',
      },
    })
    if (n === 25) parcela25 = i.id
  }

  const mk = async (desc: string, amount: number) =>
    (await prisma.transaction.create({
      data: {
        bankAccountId: contaId,
        date: new Date('2026-10-16T12:00:00Z'),
        description: desc,
        amount,
        type: 'DEBIT',
        status: 'PENDING',
        lifecycle: 'EFFECTED',
        origin: 'OFX',
      },
    })).id
  txAmort = await mk('AMORTIZACAO CONTRATO-C61022527', 4257.46)
  txLiquid = await mk('LIQUIDACAO CONTRATO-C61022527', 2798.29)
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

/**
 * ⚠️ `saldoDevedorAtual` é função PURA `(loan, installments)` — ela NÃO recebe `db`.
 * Chamá-la como `(prisma, loanId)` devolve **NaN**, que é um número plausível com
 * cara de saldo quebrado: é a cicatriz de 07/10 ("sonda errada dá um vermelho tão
 * convincente quanto um defeito real"), cometida aqui por mim. O helper existe pra
 * o teste ler o contrato pelo MESMO caminho que a tela lê.
 */
async function saldoDoContrato(): Promise<number> {
  const loan = await prisma.loan.findUniqueOrThrow({
    where: { id: loanId },
    select: {
      principal: true,
      installmentsPaidBefore: true,
      interestRateMonthly: true,
      rateType: true,
      scheduleSource: true,
    },
  })
  const parcelas = await prisma.loanInstallment.findMany({
    where: { loanId },
    select: {
      number: true,
      status: true,
      openingBalance: true,
      interest: true,
      amortization: true,
      correcao: true,
      payment: true,
      closingBalance: true,
    },
  })
  return saldoDevedorAtual(loan, parcelas)
}

/**
 * ⚠️ O `Intl` põe ESPAÇO NÃO-QUEBRÁVEL depois de "R$" (a cicatriz de 24/09), então
 * comparar com literal digitado NUNCA casa — e o vermelho sai com as duas strings
 * visualmente IDÊNTICAS, que é o pior tipo de falso negativo. A asserção usa o
 * MESMO formatador da lib.
 */
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const vincular = (ids: string[], numero = 25) =>
  vincularPagamentoDeParcela({
    db: prisma, companyId, loanId, installmentNumber: numero, transactionIds: ids,
  })

describe('⭐⭐⭐ O CASO REAL: duas linhas do banco → UMA parcela', () => {
  it('⭐⭐⭐ as duas num gesto só → PAGA · capital 4.385,96 · encargos 2.669,79 · fecha 144.736,96', async () => {
    const r = await vincular([txAmort, txLiquid])
    expect(r.linked).toBe(2)

    const p = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 },
      select: {
        status: true, paidTotal: true, paidDate: true, paidInterest: true, paidCorrection: true,
        amortization: true, closingBalance: true, _count: { select: { payments: true } },
      },
    })
    expect(p.status, 'a soma dos pedaços deixou de quitar a parcela').toBe('PAID')
    expect(p.paidTotal).toBe(7055.75)
    expect(p._count.payments, 'as duas mordidas viraram vínculos N:1').toBe(2)
    expect(p.paidDate?.toISOString().slice(0, 10)).toBe('2026-10-16')

    // ⭐ o capital é o do CRONOGRAMA, não o rótulo "AMORTIZACAO" do banco (4.257,46)
    expect(p.amortization).toBe(CAPITAL)
    // ⭐ e os encargos são a DIFERENÇA: 7.055,75 − 4.385,96
    const encargos = Math.round(((p.paidInterest ?? 0) + (p.paidCorrection ?? 0)) * 100) / 100
    expect(encargos, 'os encargos deixaram de ser pago − capital').toBe(2669.79)
    expect(p.closingBalance).toBe(FECHA_25)

    const saldo = await saldoDoContrato()
    expect(saldo, 'o saldo devedor não fechou no número do dono').toBe(FECHA_25)
  })

  it('⭐⭐ EM DOIS GESTOS dá o MESMO resultado — o `paidTotal` é a Σ de TODOS os vínculos', async () => {
    /**
     * ⛔⛔ **É o defeito de 02/10 e o cenário mais provável do caso real:** o dono vincula uma
     * linha, volta, vincula a outra. A versão antiga **sobrescrevia** o `paidTotal` com a Σ do
     * GESTO e perdia a primeira — a #22 do C41033828 ficou com 2.665,44 de 10.234,35 e a tela
     * disse *"Atrasada"* com os dois pagamentos desenhados abaixo.
     *
     * ⚠️ E foi exatamente por dois gestos que o dono resolveu o caso real (medido em prod: 2
     * pagamentos na #25, pelo chip 🏦 da caixa, uma linha por vez).
     */
    const r1 = await vincular([txAmort])
    expect(r1.linked).toBe(1)
    const meio = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 }, select: { status: true, paidTotal: true },
    })
    expect(meio.status, 'a 1ª mordida já quitou a parcela (ela não deveria)').toBe('PARTIAL')
    expect(meio.paidTotal).toBe(4257.46)

    await vincular([txLiquid])
    const fim = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 },
      select: { status: true, paidTotal: true, paidInterest: true, paidCorrection: true, closingBalance: true },
    })
    expect(fim.paidTotal, 'o 2º gesto sobrescreveu o 1º — o defeito de 02/10 voltou').toBe(7055.75)
    expect(fim.status).toBe('PAID')
    const encargos = Math.round(((fim.paidInterest ?? 0) + (fim.paidCorrection ?? 0)) * 100) / 100
    expect(encargos).toBe(2669.79)
    expect(fim.closingBalance).toBe(FECHA_25)
    expect(await saldoDoContrato()).toBe(FECHA_25)
  })

  it('⭐⭐⭐ depois da 1ª mordida o selo DIZ que faltam encargos — não só os R$ 128,50 de capital', async () => {
    /**
     * ⛔⛔⛔ **O 3º furo do brief, medido:** depois de 4.257,46 de um capital de 4.385,96 o selo
     * dizia ***"faltam R$ 128,50"*** — e o banco levou **R$ 2.798,29**. ⭐ *O número não estava
     * errado por conta: ele respondia outra pergunta* (faltava de CAPITAL, não de pagamento),
     * porque no pós-fixado o `payment` da agenda é capital puro.
     *
     * ⚠️ Consertar o `devido` seria inventar o juros antes do pagamento; o que dá é **dizer**.
     */
    await vincular([txAmort])
    const i = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 },
      select: { dueDate: true, payment: true, interest: true, status: true, paidTotal: true, payments: { select: { amount: true } } },
    })
    const v = estadoDaParcela(
      {
        dueDate: i.dueDate, payment: i.payment, interest: i.interest, status: i.status,
        paidTotal: i.paidTotal, pagamentos: i.payments, valorDoVinculo11: null,
      },
      { flexible: false, hoje: new Date('2026-10-17T12:00:00Z'), rateMonthly: TAXA },
    )
    expect(v.estado).toBe('PARCIAL')
    expect(v.falta, 'o que falta de CAPITAL continua sendo 128,50').toBe(128.5)
    expect(v.encargosAApurar, 'o pós-fixado deixou de ser reconhecido').toBe(true)
    expect(v.selo).toContain('de capital')
    expect(v.selo, 'o selo voltou a prometer um total que ninguém sabe').toContain('encargos a apurar no pagamento')

    // ⭐ e o BOTÃO carrega a mesma ressalva — consertar só o selo seria consertar metade
    expect(rotuloDoGesto(v)).toBe(`completar — faltam ${brl(128.5)} de capital + encargos`)
  })

  it('⭐ num contrato PRÉ (com juros na agenda) o selo NÃO ganha a ressalva', async () => {
    /**
     * ⚠️ A ressalva não pode vazar pro caso comum: onde a agenda **tem** juros, *"faltam X"* é
     * o total de verdade, e acrescentar *"+ encargos"* ali inventaria uma cobrança a mais.
     */
    const v = estadoDaParcela(
      {
        dueDate: new Date('2026-10-15T00:00:00Z'), payment: 10234.35, interest: 505.01,
        status: 'PARTIAL', paidTotal: 7568.91, pagamentos: [{ amount: 7568.91 }], valorDoVinculo11: null,
      },
      { flexible: false, hoje: new Date('2026-10-17T12:00:00Z'), rateMonthly: TAXA },
    )
    expect(v.encargosAApurar).toBeFalsy()
    expect(v.selo).not.toContain('de capital')
    expect(rotuloDoGesto(v)).toBe(`completar — faltam ${brl(2665.44)}`)
  })
})

describe('⛔⛔⛔ OS VERMELHOS DO MOTOR DE PEDAÇOS', () => {
  it('⛔⛔ a MESMA transação duas vezes é barrada — e o motivo diz ONDE ela está', async () => {
    /**
     * ⭐ A trava é estrutural, não um check: o `where` da porta exige
     * `loanInstallmentPayments: { none: {} }`, então a tx já vinculada **não é encontrada** e a
     * recusa nomeia a parcela e o contrato (a régua *"recusa ensina a saída"*).
     */
    await vincular([txAmort])
    await expect(vincular([txAmort])).rejects.toThrow(VinculoDeParcelaError)
    await expect(vincular([txAmort])).rejects.toThrow(/já está vinculada à parcela 25 do contrato C41022227-1/)

    // ⛔ e nada foi somado duas vezes
    const p = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 }, select: { paidTotal: true, _count: { select: { payments: true } } },
    })
    expect(p.paidTotal).toBe(4257.46)
    expect(p._count.payments).toBe(1)
  })

  it('⛔⛔⛔ PEDAÇO NOVO em parcela já quitada POR VÍNCULO = barrado, e nada grava', async () => {
    /**
     * ⛔⛔ **O furo medido:** não havia check de `status`. Um 3º pedaço somava no `paidTotal` e o
     * excedente virava **encargo fantasma no DRE** — a dupla contagem que o `ofereceMarcarPaga`
     * tirou da TELA em 02/10 e que a PORTA ainda aceitava. *Trava de tela é combinado; trava de
     * porta é impossibilidade.*
     */
    await vincular([txAmort, txLiquid])
    const terceira = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, date: new Date('2026-10-17T12:00:00Z'),
        description: 'LIQUIDACAO CONTRATO-C61022527', amount: 500,
        type: 'DEBIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'OFX',
      },
    })
    await expect(vincular([terceira.id])).rejects.toThrow(/já está quitada por 2 pagamento\(s\)/)

    const p = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 }, select: { paidTotal: true, _count: { select: { payments: true } } },
    })
    expect(p.paidTotal, 'o 3º pedaço entrou e virou encargo fantasma').toBe(7055.75)
    expect(p._count.payments).toBe(2)
  })

  it('⭐⭐ mas a parcela `PAID` SEM vínculo nenhum aceita o 1º — são 180 assim, e a #22 é uma delas', async () => {
    /**
     * ⛔⛔ **É a metade que impede a trava de virar parede.** A #22 deste contrato está `PAID`
     * sem transação (a conta garantida de julho a deixou assim). Barrar `PAID` seco tornaria
     * **impossível** anexar a transação verdadeira — e essa correção é decisão em aberto do dono.
     */
    await prisma.loanInstallment.update({ where: { id: parcela25 }, data: { status: 'PAID' } })
    const r = await vincular([txAmort, txLiquid])
    expect(r.linked, 'barrar PAID seco tornou a correção da #22 impossível').toBe(2)
  })

  it('⛔⛔ a SOMA que estoura o teto é barrada — com os números na frase, e nada grava', async () => {
    /**
     * ⚠️ 20.000 contra um teto de 9.518,06 (capital 4.385,96 + 2× o juros do mês 2.566,05).
     * Linha de outra parcela entrando no grupo viraria **despesa financeira que ninguém
     * explica** — e o DRE não tem como perguntar depois.
     */
    const grande = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, date: new Date('2026-10-16T12:00:00Z'),
        description: 'AMORTIZACAO CONTRATO-C61022527', amount: 20000,
        type: 'DEBIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'OFX',
      },
    })
    await expect(vincular([grande.id])).rejects.toThrow(/passa do teto desta parcela/)

    const p = await prisma.loanInstallment.findUniqueOrThrow({
      where: { id: parcela25 }, select: { paidTotal: true, status: true, _count: { select: { payments: true } } },
    })
    expect(p._count.payments, 'a soma absurda foi gravada').toBe(0)
    expect(p.paidTotal).toBeNull()
    expect(p.status).toBe('OPEN')
  })

  it('⭐ e o teto NÃO aperta o legítimo: a mora de 1,04× do caso real passa', async () => {
    /**
     * ⚠️⚠️ **A folga é MEDIDA, não escolhida** — as razões reais deste contrato são 1,09× ·
     * 0,95× · 1,04×. *Invariante que falha no caso legítimo é pior que invariante nenhum.*
     */
    const r = await vincular([txAmort, txLiquid])
    expect(r.linked).toBe(2)
  })
})
