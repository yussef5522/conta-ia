/**
 * ⛔⛔⛔ UMA RÉGUA, TODOS OS ANDARES (27/09/2026) — o guard que o dono pediu no item 4.
 *
 * **Pedido, ao pé da letra:** *"transação com vínculo de gesto aparecendo «sem categoria» ou
 * «pendente» em QUALQUER tela = vermelho (uma régua, todos os andares — Transações, Fluxo,
 * A CLASSIFICAR)."*
 *
 * **O defeito, medido em prod:** `LIQUIDACAO DE PARCELA-C41033828` (R$ 2.665,44) e
 * `AMORTIZACAO CONTRATO-C41033828` (R$ 7.568,91), 25/09 — vinculadas à parcela #22 pela porta
 * **N:1**, e as duas `PENDING` + `categoryId: null`. O Fluxo já as chamava de *"Parcela de
 * empréstimo"*; a tela de Transações cobrava categoria. **58 linhas** nesse estado
 * (R$ 192.679,93).
 *
 * ⚠️⚠️ **E ELE RODA CONTRA BANCO DE PROPÓSITO.** Um teste puro sobre `seloDoSistema` ficaria
 * **verde com o defeito vivo**: o que separava os andares não era a régua — era o `select` de
 * cada um e o `status` gravado. O que morde é executar **o caminho de cada andar** sobre a MESMA
 * linha e exigir que os três concordem.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { seloDoSistema } from '../selo-do-sistema'
import { carimbarSeTemVinculo, paraSelo, SELECT_DO_VINCULO, temVinculoDeGesto, SELECT_VINCULO_MINIMO } from '../carimbar-vinculo'
import { whereFluxoCaixa, SELECT_FLUXO, paraLinha, rotularLinha, CAT_SEM } from '@/lib/fluxo-caixa/motor'
import { NEEDS_REVIEW_WHERE_PRISMA, enforceStatusLadder } from '@/lib/transacoes/needs-review'
import { resolverLinha } from '../resolver-linha'
import { janelaDoMes } from '@/lib/periodo/mes-corrente'

const db = new PrismaClient()
/** ⭐ o mês do caso, pela régua da casa — fim EXCLUSIVO, então o `ate` do Fluxo é 1ms antes */
const JANELA = janelaDoMes('2026-09')
/** ⚠️ CNPJ exclusivo — conferido contra os usados no repo (a cicatriz de 21/09) */
const CNPJ = '65656565000165'

let companyId = ''
let bankAccountId = ''
let loanId = ''
let cardId = ''
let contractId = ''

beforeAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await db.company.create({ data: { name: 'Uma régua', cnpj: CNPJ } })
  companyId = c.id
  const b = await db.bankAccount.create({
    data: { companyId, name: 'sicredi teste', bankName: 'Sicredi', accountType: 'CHECKING' },
  })
  bankAccountId = b.id

  const l = await db.loan.create({
    data: {
      companyId, bankAccountId, lender: 'Sicredi', contractNumber: 'C41033828-8',
      principal: 100000, interestRateMonthly: 1, termMonths: 24,
      firstDueDate: new Date('2025-02-25'), disbursementDate: new Date('2025-01-10'),
      amortizationSystem: 'PRICE', status: 'ACTIVE',
    },
  })
  loanId = l.id
  await db.loanInstallment.create({
    data: { loanId, number: 22, dueDate: new Date('2026-09-25'), openingBalance: 50000, interest: 2665.44, amortization: 7568.91, payment: 10234.35, closingBalance: 42431.09, status: 'OPEN' },
  })

  const card = await db.businessCreditCard.create({
    data: { companyId, name: 'sicredi visa', creditLimit: 50000, closingDay: 5, dueDay: 13 },
  })
  cardId = card.id

  const ct = await db.investmentContract.create({
    data: { companyId, nome: 'Consórcio Teste', tipo: 'CONSORCIO', valorParcela: 1478.51, diaDoMes: 9 },
  })
  contractId = ct.id
})

afterAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  await db.$disconnect()
})

/** uma linha de extrato crua — `PENDING` e sem categoria, como ela chega do import */
async function linha(valor: number, desc: string, data = new Date('2026-09-25T12:00:00Z')) {
  return db.transaction.create({
    data: {
      bankAccountId, type: 'DEBIT', amount: valor, date: data, description: desc,
      lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
    },
  })
}

/** ⭐ pergunta a CADA andar o que ele diz sobre a MESMA linha */
async function osTresAndares(txId: string) {
  // ANDAR 1 — a tela de Transações (o payload que ela recebe)
  const t = await db.transaction.findUniqueOrThrow({
    where: { id: txId },
    select: { ...SELECT_DO_VINCULO, categoryId: true },
  })
  const selo = seloDoSistema(paraSelo(t as never))

  // ANDAR 2 — o Fluxo de Caixa (o motor real, com o where e o select dele)
  const doFluxo = await db.transaction.findFirst({
    where: {
      AND: [
        /**
         * ⚠️ A janela vem da **régua da casa** (`janelaDoMes`), não de datas cravadas: o guard
         * `sem-data-fixa-no-futuro` reprovou a 1ª versão deste arquivo — e com razão, porque
         * `ate: '2026-09-30'` é uma data que o calendário alcança (a régua de 01/09).
         */
        whereFluxoCaixa(companyId, { de: JANELA.de, ate: new Date(JANELA.ate.getTime() - 1) }),
        { id: txId },
      ],
    },
    select: SELECT_FLUXO,
  })
  const rotuloDoFluxo = doFluxo ? rotularLinha(paraLinha(doFluxo)).rotulo : null

  // ANDAR 3 — o A CLASSIFICAR / fila de pendências (a fonte única do "espera decisão")
  const naFila = await db.transaction.count({
    where: { AND: [{ ...NEEDS_REVIEW_WHERE_PRISMA }, { bankAccount: { companyId } }, { id: txId }] },
  })

  return { selo, status: t.status, categoryId: t.categoryId, rotuloDoFluxo, naFila }
}

describe('⛔⛔⛔ OS 3 ANDARES CONCORDAM — o gesto termina o serviço', () => {
  it('⭐⭐ 🏦 PARCELA (porta N:1, a que a Caçula usa): resolvida nos três, nunca "pendente"', async () => {
    /**
     * ⭐ Os números são os REAIS do caso do dono: a parcela #22 do C41033828-8 paga em dois
     * débitos no mesmo dia (2.665,44 + 7.568,91 = 10.234,35).
     */
    const tx = await linha(2665.44, 'LIQUIDACAO DE PARCELA-C41033828')

    const antes = await osTresAndares(tx.id)
    expect(antes.selo, 'sem vínculo ainda — não pode ter selo').toBeNull()
    expect(antes.status).toBe('PENDING')
    expect(antes.naFila, 'sem vínculo, ela DEVE estar na fila — é trabalho de verdade').toBe(1)

    // o gesto do dono, pelo caminho REAL
    const r = await resolverLinha({
      txId: tx.id, companyId, acao: 'PARCELA_EMPRESTIMO', loanId, installmentNumber: 22,
    }, db)
    expect(r.saiuDaCaixa).toBe(true)

    const depois = await osTresAndares(tx.id)
    // ANDAR 1 — Transações
    expect(depois.selo?.familia).toBe('PARCELA_EMPRESTIMO')
    expect(depois.status, '⛔ o defeito de 27/09: o gesto vinculava e deixava PENDING').toBe('RECONCILED')
    // ANDAR 2 — Fluxo
    expect(depois.rotuloDoFluxo).toBe('Parcela de empréstimo')
    expect(depois.rotuloDoFluxo, 'o Fluxo jogou no balde de erro o que o vínculo resolveu').not.toBe(CAT_SEM)
    // ANDAR 3 — A CLASSIFICAR
    expect(depois.naFila, '⛔ a fila continua cobrando o que já foi decidido').toBe(0)
    // ⛔ e a categoria continua NULA — de propósito (ver `selo-do-sistema.ts`)
    expect(depois.categoryId, 'o carimbo inventou uma categoria de despesa').toBeNull()
  })

  it('⭐ 💳 FATURA: o vínculo resolve os três andares', async () => {
    const tx = await linha(3194.35, 'DEB.CTA.FATURA-030129693')
    const r = await resolverLinha({ txId: tx.id, companyId, acao: 'PGTO_CARTAO', cardId }, db)
    expect(r.saiuDaCaixa).toBe(true)

    const d = await osTresAndares(tx.id)
    expect(d.selo?.familia).toBe('FATURA_CARTAO')
    expect(d.status).toBe('RECONCILED')
    expect(d.rotuloDoFluxo).toBe('Fatura de cartão (paga)')
    expect(d.naFila).toBe(0)
  })

  it('⭐ 📈 APORTE: idem — e o rótulo NOMEIA a família certa', async () => {
    const tx = await linha(1478.51, 'PAGAMENTO CONSORCIO')
    const r = await resolverLinha({ txId: tx.id, companyId, acao: 'APORTE_INVESTIMENTO', contractId }, db)
    expect(r.saiuDaCaixa).toBe(true)

    const d = await osTresAndares(tx.id)
    expect(d.selo?.familia).toBe('APORTE_INVESTIMENTO')
    expect(d.status).toBe('RECONCILED')
    expect(d.rotuloDoFluxo).toBe('Aporte em investimento')
    expect(d.naFila).toBe(0)
  })

  it('⛔⛔ A FLAG SOZINHA NÃO RESOLVE NADA — a linha FICA na fila, onde o gesto a alcança', async () => {
    /**
     * ⭐ É a régua de 20/09: ***a flag diz "parece", o vínculo diz "é"***. A linha
     * `PAGAMENTO CARTAO DE CREDITO` de 8.626,98 tinha `isCardPayment: true` por heurística de
     * descrição e `businessCreditCardId: null` — e a lei antiga a declarava resolvida, deixando
     * a fatura **OPEN com o pagamento dela no extrato** e nenhuma tela onde agir.
     */
    const tx = await db.transaction.create({
      data: {
        bankAccountId, type: 'DEBIT', amount: 8626.98, date: new Date('2026-09-17T12:00:00Z'),
        description: 'PAGAMENTO CARTAO DE CREDITO', lifecycle: 'EFFECTED', status: 'PENDING',
        origin: 'OFX', isCardPayment: true, // ⚠️ a flag, SEM o vínculo
      },
    })
    const d = await osTresAndares(tx.id)
    expect(d.selo, 'a flag voltou a valer como vínculo').toBeNull()
    expect(d.rotuloDoFluxo, 'o Fluxo deu linha própria pra quem não quita nada').toBe(CAT_SEM)
    expect(d.naFila, 'a linha saiu da fila sem estar resolvida — a porta sem maçaneta').toBe(1)
  })

  it('⛔ o carimbo é IDEMPOTENTE — rodar o retroativo 2× não muda nada', async () => {
    const tx = await linha(70.02, 'CAPITALIZACAO RG')
    await db.investmentContribution.create({
      data: { contractId, transactionId: tx.id, competencia: '2026-09', valor: 70.02 },
    })
    const a = await carimbarSeTemVinculo(db, tx.id, companyId)
    const b = await carimbarSeTemVinculo(db, tx.id, companyId)
    expect(a.carimbou).toBe(true)
    expect(b.carimbou, 'a 2ª passada escreveu de novo').toBe(false)
    expect(b.selo?.familia).toBe('APORTE_INVESTIMENTO')
  })

  it('⛔⛔ IGNORED não é sobrescrito — decisão do dono não se desfaz em silêncio', async () => {
    const tx = await db.transaction.create({
      data: {
        bankAccountId, type: 'DEBIT', amount: 500, date: new Date('2026-09-20T12:00:00Z'),
        description: 'linha ignorada', lifecycle: 'EFFECTED', status: 'IGNORED',
        ignoredAt: new Date(), origin: 'OFX',
      },
    })
    await db.loanInstallment.create({
      data: { loanId, number: 23, dueDate: new Date('2026-10-25'), openingBalance: 42431.09, interest: 100, amortization: 400, payment: 500, closingBalance: 42031.09, status: 'OPEN', reconciledTransactionId: tx.id },
    })
    const r = await carimbarSeTemVinculo(db, tx.id, companyId)
    expect(r.selo?.familia, 'o vínculo existe e tem que ser reconhecido').toBe('PARCELA_EMPRESTIMO')
    expect(r.carimbou, 'sobrescreveu o IGNORED do dono').toBe(false)
    const d = await db.transaction.findUniqueOrThrow({ where: { id: tx.id }, select: { status: true } })
    expect(d.status).toBe('IGNORED')
  })

  it('⭐⭐ E O CARIMBO SOBREVIVE A UMA EDIÇÃO POSTERIOR — a escada conhece o vínculo', async () => {
    /**
     * ⛔⛔ **Era aqui que o defeito voltaria sozinho.** `enforceStatusLadder` roda no fim de todo
     * create/update e devolvia `PENDING` pra toda linha sem categoria — então **mudar a descrição**
     * de um pagamento de empréstimo o devolvia pra "Pendente", *em silêncio*.
     */
    const tx = await linha(4092.02, 'EMPRESTIMO')
    await db.loanInstallment.create({
      data: { loanId, number: 24, dueDate: new Date('2026-11-25'), openingBalance: 42031.09, interest: 592.02, amortization: 3500, payment: 4092.02, closingBalance: 38531.09, status: 'OPEN', reconciledTransactionId: tx.id },
    })
    await carimbarSeTemVinculo(db, tx.id, companyId)

    const v = await db.transaction.findUniqueOrThrow({ where: { id: tx.id }, select: SELECT_VINCULO_MINIMO })
    const status = enforceStatusLadder({
      intendedStatus: 'PENDING', // ⚠️ o que um update qualquer mandaria
      categoryId: null,
      accountType: 'CHECKING',
      temVinculoDeGesto: temVinculoDeGesto(v),
    })
    expect(status, 'a escada devolveu a linha pra "Pendente" — o defeito voltaria sozinho')
      .toBe('RECONCILED')
  })

  it('⛔ e a linha SEM vínculo nenhum continua esperando a palavra do dono — o número é honesto', async () => {
    const tx = await linha(24226.67, 'PAGAMENTO PIX-PIX_DEB   fornecedor qualquer')
    const d = await osTresAndares(tx.id)
    expect(d.selo).toBeNull()
    expect(d.status).toBe('PENDING')
    expect(d.rotuloDoFluxo).toBe(CAT_SEM)
    expect(d.naFila, 'a fila deixou de cobrar o que REALMENTE espera decisão').toBe(1)
  })
})

describe('⛔⛔ A RÉGUA TEM UM DONO — nenhum andar pode ter a própria', () => {
  const ler = (p: string) => require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf-8')
  /** ⚠️ sem comentário: o arquivo que DOCUMENTA a régua velha não pode ser o que a reprova */
  const semComentario = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⭐ o Fluxo e a caixa DELEGAM pro `seloDoSistema`, em vez de repetir os `if`', () => {
    for (const f of ['lib/fluxo-caixa/motor.ts', 'lib/conciliacao/caixa-de-entrada.ts']) {
      const src = semComentario(ler(f))
      const usos = (src.match(/seloDoSistema\(/g) ?? []).length
      expect(usos, `${f} não chama o dono da pergunta — a régua voltou a ser cópia`).toBeGreaterThanOrEqual(1)
    }
  })

  it('⛔⛔ e a régua VELHA (a flag decidindo sozinha) não volta em andar nenhum', () => {
    /**
     * ⚠️ O que morde é o padrão `isCardPayment` **decidindo** sem o vínculo ao lado. Conta o USO
     * dentro do arquivo sem comentário — a lição *"menção, não uso"*, que esta casa já pagou
     * sete vezes.
     */
    for (const f of ['lib/fluxo-caixa/motor.ts', 'lib/conciliacao/caixa-de-entrada.ts']) {
      const src = semComentario(ler(f))
      expect(src, `${f} voltou a resolver pela FLAG (a fatura do Carter, 20/09)`)
        .not.toMatch(/if\s*\(\s*l\.isCardPayment\s*\)/)
    }
  })

  it('⭐ a fila de pendências exclui TODAS as famílias de vínculo — lista que envelhece cobra o já decidido', () => {
    const W = NEEDS_REVIEW_WHERE_PRISMA as Record<string, unknown>
    // as 5 famílias do `seloDoSistema` + a transferência
    expect(W.loanInstallmentPaid).toEqual({ is: null })
    expect(W.loanInstallmentPayments).toEqual({ none: {} })
    // ⭐ o PAGAMENTO com vínculo sai; a COMPRA de cartão FICA (ela espera categoria de verdade)
    expect(W.NOT).toEqual({ AND: [{ isCardPayment: true }, { businessCreditCardId: { not: null } }] })
    expect(W.investmentContribution).toEqual({ is: null })
    expect(W.loanDisbursement).toEqual({ is: null })
    expect(W.transferGroupId).toBe(null)
  })

  it('⛔⛔ e a COMPRA de cartão CONTINUA na fila — ela é que espera a palavra do dono', async () => {
    /**
     * ⚠️⚠️ **ESTE TESTE NASCEU DE UM ERRO MEU, medido em prod antes de o dono ver.** A 1ª versão
     * do fix excluía a fila por `businessCreditCardId: null` — o que tirava **toda linha de
     * cartão**, inclusive as COMPRAS. Medido na hora: 0 compras sem categoria na Caçula hoje,
     * então nada sumiu de fato; mas a **próxima fatura importada** teria compras invisíveis.
     */
    const compra = await db.transaction.create({
      data: {
        businessCreditCardId: cardId, type: 'DEBIT', amount: 89.9,
        date: new Date('2026-09-12T12:00:00Z'), description: 'MERCADO LIVRE*LOJA',
        lifecycle: 'EFFECTED', status: 'PENDING', invoiceMonth: '2026-10',
      },
    })
    const naFila = await db.transaction.count({
      where: { AND: [{ ...NEEDS_REVIEW_WHERE_PRISMA }, { id: compra.id }] },
    })
    expect(naFila, 'a COMPRA de cartão sumiu da fila — ela espera categoria de verdade').toBe(1)
  })

  it('⛔ a tela de Transações NÃO deriva o selo — ele vem pronto do servidor', () => {
    /**
     * ⚠️ Se a tela derivasse, nasceria a **4ª régua** da mesma pergunta — e ela divergiria no
     * primeiro gesto novo, que é exatamente o defeito que este sprint conserta.
     */
    const tela = semComentario(ler('app/(dashboard)/transacoes/page.tsx'))
    expect(tela, 'a tela passou a montar o selo por conta própria').not.toContain('seloDoSistema')
    expect(tela, 'a tela tem que LER o selo do payload').toContain('t.selo')
  })
})
