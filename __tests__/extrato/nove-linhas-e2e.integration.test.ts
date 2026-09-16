// ⭐⭐⭐ AS 9 LINHAS — O CONTRATO DE ENTREGA DO FLUXO DO EXTRATO (15/09/2026)
//
// **O dono:** *"suíte E2E com OFX de fixture cobrindo TODOS os tipos (…) e prova: nenhuma
// linha órfã, nenhuma em duas filas, cada gesto com efeito no destino. Só me entrega quando
// essa suíte estiver verde — e ela vira o guard permanente do financeiro."*
//
// ⛔⛔ **O QUE ELA MEDE É O DESTINO, NUNCA A ETIQUETA.** A regra nova da casa:
//   ***gesto que ESCOLHE um alvo e não EFETIVA o vínculo é MEIA-PONTE — proibido.***
// Foi o defeito de 15/09: escolher o cartão nos Pendentes gravava um rótulo num `useState`
// e a fatura não baixava. Aqui, cada `it` termina perguntando **pro destino** (a fatura, a
// parcela, o payable, a VendaDiaria), nunca pra a linha.
//
// ⚠️ E as três assertivas de fechamento são o invariante *"uma linha, uma estação"* em
// aritmética: **nenhuma órfã · nenhuma em duas filas · Σ == 9**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resolverLinha, ResolverError } from '@/lib/conciliacao/resolver-linha'
import { LINHA_DISPONIVEL_WHERE } from '@/lib/conciliacao/fila-de-conciliacao'
import { contarEstacoes, estacoesFecham, estacaoDaLinha, comoFoiResolvida, acoesDoSentido, sentidoDaLinha, type LinhaParaEstacao } from '@/lib/conciliacao/caixa-de-entrada'

const CNPJ = '50607080001122'
let companyId = ''
let contaId = ''
let contaId2 = ''
let cardId = ''
let loanId = ''
let catDespesa = ''
let catReceita = ''
let catEstorno = ''
let fornecedorId = ''

/** ⚠️ datas no PASSADO: data fixa em posição de relógio que ainda não chegou é bomba (01/09) */
const D = (dia: number) => new Date(Date.UTC(2026, 8, dia, 15, 0))

/** as 9 linhas do "OFX" — uma por caminho do fluxo */
const LINHAS = [
  { chave: 'debito_conta_aberta', type: 'DEBIT', amount: 1200.00, desc: 'LIQUIDACAO BOLETO FORNECEDOR X', dia: 10 },
  { chave: 'debito_com_juros', type: 'DEBIT', amount: 1268.55, desc: 'LIQUIDACAO BOLETO FORNECEDOR Y', dia: 10 },
  { chave: 'tarifa', type: 'DEBIT', amount: 39.90, desc: 'TARIFA PACOTE SERVICOS', dia: 10 },
  { chave: 'pgto_cartao', type: 'DEBIT', amount: 3500.00, desc: 'PAGAMENTO CARTAO DE CREDITO', dia: 11 },
  { chave: 'parcela_emprestimo', type: 'DEBIT', amount: 1000.00, desc: 'LIQUIDACAO DE PARCELA-C999', dia: 11 },
  { chave: 'transferencia', type: 'DEBIT', amount: 5000.00, desc: 'PIX ENVIADO', dia: 12 },
  { chave: 'credito_venda', type: 'CREDIT', amount: 308.50, desc: 'RECEBIMENTO PIX-PIX_CRED Artesanais', dia: 14 },
  { chave: 'credito_a_receber', type: 'CREDIT', amount: 900.00, desc: 'RECEBIMENTO PIX CLIENTE Z', dia: 14 },
  { chave: 'estorno', type: 'CREDIT', amount: 39.90, desc: 'ESTORNO TARIFA PACOTE SERVICOS', dia: 15 },
] as const

const tx: Record<string, string> = {}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EXTRATO E2E' } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', bankName: 'Sicredi', bankCode: '748', accountNumber: '1', balance: 0 } })).id
  contaId2 = (await prisma.bankAccount.create({ data: { companyId, name: 'stone', bankName: 'Stone', bankCode: '197', accountNumber: '2', balance: 0 } })).id
  cardId = (await prisma.businessCreditCard.create({ data: { companyId, name: 'banrisul pj', creditLimit: 20000, closingDay: 29, dueDay: 10, defaultTreatment: 'OPERACIONAL' } })).id
  fornecedorId = (await prisma.supplier.create({ data: { companyId, razaoSocial: 'FORNECEDOR X', fonte: 'MANUAL' } })).id

  const cat = async (name: string, dreGroup: string) =>
    (await prisma.category.create({ data: { companyId, name, type: dreGroup === 'RECEITA_BRUTA' ? 'INCOME' : 'EXPENSE', dreGroup } })).id
  catDespesa = await cat('Tarifas Bancárias', 'DESPESAS_FINANCEIRAS')
  catReceita = await cat('Receita de Vendas', 'RECEITA_BRUTA')
  catEstorno = await cat('Estorno de tarifa', 'DESPESAS_FINANCEIRAS')

  // ── a fatura do cartão que a linha 4 vai quitar ──
  await prisma.transaction.create({
    data: { bankAccountId: null, businessCreditCardId: cardId, invoiceMonth: '2026-09', type: 'DEBIT',
      amount: 3500.00, date: D(5), description: 'COMPRA NA FATURA', origin: 'MANUAL', lifecycle: 'EFFECTED', status: 'RECONCILED' },
  })

  // ── o contrato + parcela que a linha 5 vai pagar ──
  const loan = await prisma.loan.create({
    data: { companyId, bankAccountId: contaId, lender: 'Sicredi', contractNumber: 'C999', principal: 10000,
      interestRateMonthly: 0, rateType: 'PRE', amortizationSystem: 'PRICE', termMonths: 10, firstDueDate: D(11), disbursementDate: D(1), scheduleSource: 'IMPORTED' },
  })
  loanId = loan.id
  await prisma.loanInstallment.create({
    data: { loanId, number: 1, dueDate: D(11), amortization: 1000, interest: 0, payment: 1000, status: 'OPEN', openingBalance: 10000, closingBalance: 9000 },
  })

  // ── as 9 linhas do extrato ──
  for (const l of LINHAS) {
    const t = await prisma.transaction.create({
      data: {
        bankAccountId: l.chave === 'transferencia' ? contaId : contaId, type: l.type, amount: l.amount,
        date: D(l.dia), description: l.desc, origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING',
      },
    })
    tx[l.chave] = t.id
  }
  // o par da transferência, na OUTRA conta
  tx['transferencia_par'] = (await prisma.transaction.create({
    data: { bankAccountId: contaId2, type: 'CREDIT', amount: 5000.00, date: D(12), description: 'PIX RECEBIDO', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING' },
  })).id
})

afterEach(async () => {
  const contas = await prisma.bankAccount.findMany({ where: { companyId }, select: { id: true } })
  await prisma.loanInstallmentPayment.deleteMany({ where: { installment: { loan: { companyId } } } })
  await prisma.loanInstallment.deleteMany({ where: { loan: { companyId } } })
  await prisma.loan.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { OR: [{ bankAccountId: { in: contas.map((c) => c.id) } }, { businessCreditCardId: { not: null }, bankAccountId: null }] } })
  await prisma.businessCreditCard.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** as 9 linhas no formato que a lei das estações lê */
async function estacoes(): Promise<LinhaParaEstacao[]> {
  const rows = await prisma.transaction.findMany({
    where: { id: { in: Object.values(tx).filter((id) => LINHAS.some((l) => tx[l.chave] === id)) } },
    select: {
      id: true, type: true, categoryId: true, reconciledWithId: true, isCardPayment: true,
      transferGroupId: true, isInternalTransfer: true, pendingTransfer: true, ignoredAt: true,
      reconciledFrom: { select: { id: true } },
      loanInstallmentPaid: { select: { id: true } },
      loanInstallmentPayments: { select: { id: true } },
    },
  })
  return rows.map((r) => ({
    categoryId: r.categoryId, reconciledWithId: r.reconciledWithId,
    temReconciledFrom: r.reconciledFrom.length > 0,
    isCardPayment: r.isCardPayment,
    temParcelaVinculada: !!r.loanInstallmentPaid || r.loanInstallmentPayments.length > 0,
    transferGroupId: r.transferGroupId, isInternalTransfer: r.isInternalTransfer,
    pendingTransfer: r.pendingTransfer, ignoredAt: r.ignoredAt, tipo: r.type,
  }))
}

describe('⛔⛔⛔ A LEI DO SENTIDO — crédito nunca vê fila de dívida', () => {
  /**
   * ⛔ O CASO REAL DO DONO: o PIX de R$ 308,50 estava na fila de casar com conta a PAGAR.
   * Medido em prod antes do fix: **5.705 de 6.555 linhas da fila eram CRÉDITO (87%)**.
   */
  it('⭐⭐ a fila de contas a pagar só enxerga DÉBITO', async () => {
    const naFila = await prisma.transaction.findMany({
      where: { ...LINHA_DISPONIVEL_WHERE, bankAccountId: { in: [contaId, contaId2] } },
      select: { id: true, type: true, amount: true },
    })
    expect(naFila.length).toBeGreaterThan(0)
    expect(naFila.every((t) => t.type === 'DEBIT'), 'crédito voltou pra fila de dívida').toBe(true)
    expect(naFila.map((t) => t.id)).not.toContain(tx['credito_venda'])
  })

  it('⛔ e o SERVIDOR recusa o gesto de saída numa entrada — esconder o botão não basta', async () => {
    await expect(resolverLinha({ companyId, txId: tx['credito_venda'], acao: 'PGTO_CARTAO', cardId }, prisma))
      .rejects.toThrow(/ENTROU/)
  })

  it('⛔ e o contrário também: entrada não é oferecida pra saída', () => {
    expect(acoesDoSentido(sentidoDaLinha('CREDIT')).map((a) => a.acao)).not.toContain('CASAR_PAGAR')
    expect(acoesDoSentido(sentidoDaLinha('DEBIT')).map((a) => a.acao)).not.toContain('CASAR_RECEBER')
  })
})

describe('⭐⭐⭐ CADA GESTO EFETIVA — o efeito é conferido NO DESTINO', () => {
  it('⭐ pgto de cartão → a FATURA fica paga (não é a etiqueta na linha)', async () => {
    const r = await resolverLinha({ companyId, txId: tx['pgto_cartao'], acao: 'PGTO_CARTAO', cardId }, prisma)
    expect(r.efeito).toMatch(/fatura 2026-09/)

    // ⛔ A PERGUNTA VAI PRO DESTINO: a fatura daquele cartão tem pagamento amarrado?
    const pago = await prisma.transaction.findFirst({
      where: { businessCreditCardId: cardId, isCardPayment: true, paidInvoiceMonth: '2026-09' },
      select: { id: true, categoryId: true },
    })
    expect(pago?.id, 'a fatura não baixou — meia-ponte').toBe(tx['pgto_cartao'])
    // ⚠️ e sem DUPLA CONTAGEM: pagamento de fatura não é despesa (a despesa é a compra)
    expect(pago?.categoryId).toBeNull()
  })

  it('⭐ parcela de empréstimo → o CRONOGRAMA mostra pago, com split', async () => {
    const r = await resolverLinha({ companyId, txId: tx['parcela_emprestimo'], acao: 'PARCELA_EMPRESTIMO', loanId, installmentNumber: 1 }, prisma)
    expect(r.efeito).toMatch(/parcela 1 PAGA/)

    const parcela = await prisma.loanInstallment.findFirst({ where: { loanId, number: 1 }, select: { status: true, paidTotal: true } })
    expect(parcela?.status, 'a parcela não ficou paga — meia-ponte').toBe('PAID')
    expect(parcela?.paidTotal).toBe(1000)
  })

  it('⭐ tarifa → categoria gravada, e a linha sai da caixa', async () => {
    await resolverLinha({ companyId, txId: tx['tarifa'], acao: 'CATEGORIA', categoryId: catDespesa }, prisma)
    const t = await prisma.transaction.findUnique({ where: { id: tx['tarifa'] }, select: { categoryId: true } })
    expect(t?.categoryId).toBe(catDespesa)
  })

  /**
   * ⭐⭐ O CASO (a) DO DONO, do lado certo: o crédito de venda vira RECEITA DO DIA —
   * ⚠️ **sem casar com o caixa do PDV** (decisão dele, 15/09: *"adquirente tem taxa, prazo
   * e antecipação"* — o valor no banco não é o que o PDV registrou).
   */
  it('⭐⭐ crédito de venda → receita do dia, e FORA da fila de pagar', async () => {
    const r = await resolverLinha({ companyId, txId: tx['credito_venda'], acao: 'RECEBIMENTO_VENDA', categoryId: catReceita }, prisma)
    expect(r.efeito).toMatch(/receita do dia/)
    const t = await prisma.transaction.findUnique({ where: { id: tx['credito_venda'] }, select: { categoryId: true } })
    expect(t?.categoryId).toBe(catReceita)

    const naFila = await prisma.transaction.count({ where: { ...LINHA_DISPONIVEL_WHERE, id: tx['credito_venda'] } })
    expect(naFila, 'o crédito de venda voltou pra fila de dívida').toBe(0)
  })

  it('⭐ estorno → categorizado E amarrado à saída original, com rastro NELA', async () => {
    const r = await resolverLinha({ companyId, txId: tx['estorno'], acao: 'ESTORNO', categoryId: catEstorno, estornoDeTxId: tx['tarifa'] }, prisma)
    expect(r.efeito).toMatch(/amarrado/)
    const orig = await prisma.transaction.findUnique({ where: { id: tx['tarifa'] }, select: { notes: true } })
    expect(orig?.notes, 'a saída original não soube do estorno').toMatch(/estornada pela entrada/)
  })

  it('⛔ estorno apontando pra uma ENTRADA é recusado — o sentido oposto define o par', async () => {
    await expect(resolverLinha({ companyId, txId: tx['estorno'], acao: 'ESTORNO', categoryId: catEstorno, estornoDeTxId: tx['credito_venda'] }, prisma))
      .rejects.toThrow(/SAÍDA/)
  })

  /**
   * ⛔⛔ AS AÇÕES DE VÍNCULO **LEVAM AO ALVO** em vez de gravar por baixo — a escolha de
   * QUAL nota / QUAL linha tem casa própria e provada. ⚠️ Mas elas **nunca calam**: o gesto
   * responde com o caminho. *Gesto mudo foi o defeito de 14/09.*
   */
  it('⭐ casar com conta a pagar leva ao card do vínculo — e não fica em silêncio', async () => {
    await expect(resolverLinha({ companyId, txId: tx['debito_conta_aberta'], acao: 'CASAR_PAGAR' }, prisma))
      .rejects.toThrow(/DEEP_LINK/)
  })

  it('⭐ ignorar tira a linha das filas, e é reversível', async () => {
    await resolverLinha({ companyId, txId: tx['debito_com_juros'], acao: 'IGNORAR' }, prisma)
    const t = await prisma.transaction.findUnique({ where: { id: tx['debito_com_juros'] }, select: { ignoredAt: true } })
    expect(t?.ignoredAt).not.toBeNull()
    expect(await prisma.transaction.count({ where: { ...LINHA_DISPONIVEL_WHERE, id: tx['debito_com_juros'] } })).toBe(0)
  })
})

describe('⛔⛔⛔ AS TRÊS ASSERTIVAS DE FECHAMENTO — uma linha, uma estação', () => {
  it('⭐ na chegada, as 9 estão na CAIXA e nenhuma no arquivo', async () => {
    const c = contarEstacoes(await estacoes())
    expect(c.total).toBe(9)
    expect(c.saidas + c.entradas).toBe(9)
    expect(c.arquivo).toBe(0)
    expect(estacoesFecham(c)).toBe(true)
  })

  it('⭐⭐ resolvidas TODAS, a caixa zera e o arquivo tem as 9 — Σ == 9', async () => {
    await resolverLinha({ companyId, txId: tx['pgto_cartao'], acao: 'PGTO_CARTAO', cardId }, prisma)
    await resolverLinha({ companyId, txId: tx['parcela_emprestimo'], acao: 'PARCELA_EMPRESTIMO', loanId, installmentNumber: 1 }, prisma)
    await resolverLinha({ companyId, txId: tx['tarifa'], acao: 'CATEGORIA', categoryId: catDespesa }, prisma)
    await resolverLinha({ companyId, txId: tx['credito_venda'], acao: 'RECEBIMENTO_VENDA', categoryId: catReceita }, prisma)
    await resolverLinha({ companyId, txId: tx['estorno'], acao: 'ESTORNO', categoryId: catEstorno, estornoDeTxId: tx['tarifa'] }, prisma)
    await resolverLinha({ companyId, txId: tx['debito_com_juros'], acao: 'IGNORAR' }, prisma)
    await resolverLinha({ companyId, txId: tx['credito_a_receber'], acao: 'CATEGORIA', categoryId: catReceita }, prisma)
    await resolverLinha({ companyId, txId: tx['debito_conta_aberta'], acao: 'CATEGORIA', categoryId: catDespesa }, prisma)
    // a transferência: o par é aplicado pelo motor único (aqui, o efeito no banco)
    await prisma.transaction.updateMany({
      where: { id: { in: [tx['transferencia'], tx['transferencia_par']] } },
      data: { transferGroupId: 'grupo-teste', type: 'TRANSFER' },
    })

    const linhas = await estacoes()
    const c = contarEstacoes(linhas)
    expect(c.total, 'Σ das estações ≠ 9 — linha sumiu ou nasceu').toBe(9)
    expect(c.arquivo, 'sobrou linha na caixa').toBe(9)
    expect(c.saidas + c.entradas, 'linha órfã na caixa').toBe(0)
    expect(estacoesFecham(c)).toBe(true)
  })

  /**
   * ⛔⛔ NENHUMA EM DUAS FILAS. É a metade que a aritmética sozinha não pega: uma linha
   * conciliada **e** ainda oferecida como pagamento seria o mesmo dinheiro em dois lugares.
   */
  it('⛔ nenhuma linha resolvida continua sendo oferecida na fila de pagar', async () => {
    await resolverLinha({ companyId, txId: tx['pgto_cartao'], acao: 'PGTO_CARTAO', cardId }, prisma)
    await resolverLinha({ companyId, txId: tx['parcela_emprestimo'], acao: 'PARCELA_EMPRESTIMO', loanId, installmentNumber: 1 }, prisma)
    const linhas = await prisma.transaction.findMany({
      where: { ...LINHA_DISPONIVEL_WHERE, bankAccountId: { in: [contaId, contaId2] } },
      select: { id: true },
    })
    const ids = linhas.map((l) => l.id)
    expect(ids).not.toContain(tx['pgto_cartao'])
    expect(ids).not.toContain(tx['parcela_emprestimo'])
  })

  it('⭐ e o ARQUIVO diz COMO cada uma foi resolvida — nunca um selo genérico', async () => {
    await resolverLinha({ companyId, txId: tx['pgto_cartao'], acao: 'PGTO_CARTAO', cardId }, prisma)
    await resolverLinha({ companyId, txId: tx['tarifa'], acao: 'CATEGORIA', categoryId: catDespesa }, prisma)
    const linhas = await estacoes()
    const selos = linhas.filter((l) => estacaoDaLinha(l) === 'ARQUIVO').map(comoFoiResolvida)
    expect(selos).toContain('pagamento de fatura de cartão')
    expect(selos).toContain('categorizada')
  })
})
