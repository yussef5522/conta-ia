// ESTOQUE ↔ FINANCEIRO — PONTE 1. REGRA 3: cria conta a pagar DE VERDADE (a mesma função
// do formulário do financeiro), contra o banco.
//
// O teste mais importante deste arquivo é o de ISOLAMENTO: o estoque ganhou permissão de
// escrever em DUAS tabelas fechadas, e a única coisa que impede isso de virar um vazamento
// silencioso é provar que NENHUM outro caminho do estoque escreve lá.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildAuthContextForTest } from '@/lib/auth/rbac'
import { listarPendentes, enviarParaContasPagar, enviarEntradaManual, PonteError, ORIGEM_PONTE } from '../ponte-contas-pagar'
import { registrarSaida } from '../saida'
import { registrarEntradaManual } from '../entrada-manual'
import { iniciarContagem, contarLinha } from '../contagem'
import { criarMovimento } from '../movement'

const CNPJ = '50607080000211'
const CNPJ_FORN = '88728027000146'
const CHAVE = '43260888728027000146550010000123451234567890'
let companyId: string
let nfeId: string
let itemId: string
let sug1: string
let sug2: string
let userId: string

// o ctx precisa de um User REAL: `createContaPendente` grava audit log com FK pro usuário
// (em prod vem da sessão; aqui tem que existir de verdade, senão o FK derruba a criação)
const ctx = () => buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] })

async function contarFinanceiro() {
  const [tx, forn] = await Promise.all([
    prisma.transaction.count({ where: { bankAccount: { companyId } } }),
    prisma.supplier.count({ where: { companyId } }),
  ])
  // transações PAYABLE nascem sem bankAccount → conta por supplier/company também
  const txPorForn = await prisma.transaction.count({ where: { supplier: { companyId } } })
  return { tx: tx + txPorForn, forn }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA PONTE' } })).id
  userId = (await prisma.user.create({ data: { email: `ponte-${Date.now()}@teste.com`, name: 'Dono Ponte', password: 'x' } })).id
  itemId = (await prisma.stockItem.create({ data: { companyId, nome: 'Coxão', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })).id
  await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 40, origem: 'SEFAZ' })
  nfeId = (await prisma.stockNfe.create({ data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', temXmlCompleto: true, emitNome: 'FRIGORIFICO SILVA', emitCnpj: CNPJ_FORN, vNF: 12012.89 } })).id
  sug1 = (await prisma.stockPayableSuggestion.create({ data: { companyId, nfeId, chave: CHAVE, supplierCnpj: CNPJ_FORN, supplierNome: 'FRIGORIFICO SILVA', nDup: '001', dVenc: new Date('2026-08-27'), valor: 6006.45 } })).id
  sug2 = (await prisma.stockPayableSuggestion.create({ data: { companyId, nfeId, chave: CHAVE, supplierCnpj: CNPJ_FORN, supplierNome: 'FRIGORIFICO SILVA', nDup: '002', dVenc: new Date('2026-09-03'), valor: 6006.44 } })).id
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.transaction.deleteMany({ where: { supplier: { companyId } } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  for (const t of ['stockPayableLink', 'stockPayableSuggestion', 'stockEntradaManualItem', 'stockEntradaManual', 'stockContagemItem', 'stockContagem', 'stockSaida', 'stockMovement', 'stockSaldoCache', 'stockNfe', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.auditLog.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
})

describe('a lista que o dono aprova', () => {
  it('mostra as parcelas pendentes e AVISA que o fornecedor não existe no financeiro', async () => {
    const ps = await listarPendentes(companyId, prisma)
    expect(ps).toHaveLength(2)
    expect(ps[0].valor).toBe(6006.45)
    expect(ps[0].nNF).toBe('12345') // extraído da chave, pro dono reconhecer
    expect(ps[0].fornecedorNoFinanceiro).toBe(false)
  })
})

describe('enviar pro contas a pagar', () => {
  it('cria as contas DE VERDADE, com origem marcada e vínculo nos dois sentidos', async () => {
    const r = await enviarParaContasPagar({ companyId, suggestionIds: [sug1, sug2], cadastrarFornecedores: true, ctx: ctx(), userId: 'u1' }, prisma)

    expect(r.criadas).toBe(2)
    expect(r.fornecedoresCadastrados).toBe(1) // um fornecedor, duas parcelas
    expect(r.valorTotal).toBe(12012.89)

    const contas = await prisma.transaction.findMany({ where: { id: { in: r.transactionIds } }, orderBy: { dueDate: 'asc' } })
    expect(contas).toHaveLength(2)
    // é conta a pagar de verdade — o financeiro não distingue de uma criada no form
    expect(contas.every((c) => c.lifecycle === 'PAYABLE')).toBe(true)
    expect(contas.every((c) => c.type === 'DEBIT' && c.status === 'PENDING')).toBe(true)
    expect(contas.every((c) => c.origin === ORIGEM_PONTE)).toBe(true)
    expect(contas.every((c) => c.bankAccountId === null)).toBe(true) // ainda não foi paga
    expect(contas[0].amount).toBe(6006.45)
    expect(contas[0].dueDate?.toISOString().slice(0, 10)).toBe('2026-08-27')
    expect(contas[0].description).toContain('FRIGORIFICO SILVA')
    expect(contas[0].description).toContain('12345')

    // vínculo de volta pra nota
    const links = await prisma.stockPayableLink.findMany({ where: { companyId } })
    expect(links).toHaveLength(2)
    expect(links.every((l) => l.refId === nfeId && l.chave === CHAVE)).toBe(true)

    // fornecedor cadastrado com o dado do XML e marcado
    const forn = await prisma.supplier.findFirst({ where: { companyId } })
    expect(forn!.razaoSocial).toBe('FRIGORIFICO SILVA')
    expect(forn!.cnpj).toBe(CNPJ_FORN)
    expect(forn!.fonte).toBe(ORIGEM_PONTE)
  })

  it('IDEMPOTENTE: mandar a mesma parcela 2× não cria a 2ª conta', async () => {
    await enviarParaContasPagar({ companyId, suggestionIds: [sug1], cadastrarFornecedores: true, ctx: ctx() }, prisma)
    const r2 = await enviarParaContasPagar({ companyId, suggestionIds: [sug1], cadastrarFornecedores: true, ctx: ctx() }, prisma)

    expect(r2.criadas).toBe(0)
    expect(r2.puladas).toBe(1)
    expect(await prisma.stockPayableLink.count({ where: { companyId } })).toBe(1)
    expect(await prisma.transaction.count({ where: { supplier: { companyId } } })).toBe(1)
  })

  it('a parcela enviada SAI da lista de pendentes', async () => {
    await enviarParaContasPagar({ companyId, suggestionIds: [sug1], cadastrarFornecedores: true, ctx: ctx() }, prisma)
    const ps = await listarPendentes(companyId, prisma)
    expect(ps.map((p) => p.suggestionId)).toEqual([sug2])
  })

  it('SEM o aceite de cadastrar fornecedor, RECUSA e não cria conta órfã', async () => {
    const r = await enviarParaContasPagar({ companyId, suggestionIds: [sug1], cadastrarFornecedores: false, ctx: ctx() }, prisma)
    expect(r.criadas).toBe(0)
    expect(r.erros[0].motivo).toContain('fornecedor no financeiro')
    expect(await prisma.transaction.count({ where: { supplier: { companyId } } })).toBe(0)
    expect(await prisma.supplier.count({ where: { companyId } })).toBe(0)
  })

  it('REUSA fornecedor que já existe (não duplica cadastro)', async () => {
    await prisma.supplier.create({ data: { companyId, cnpj: '88.728.027/0001-46', razaoSocial: 'FRIGORIFICO SILVA LTDA', fonte: 'MANUAL' } })
    const r = await enviarParaContasPagar({ companyId, suggestionIds: [sug1], cadastrarFornecedores: true, ctx: ctx() }, prisma)
    expect(r.criadas).toBe(1)
    expect(r.fornecedoresCadastrados).toBe(0) // casou pelo CNPJ mesmo com máscara diferente
    expect(await prisma.supplier.count({ where: { companyId } })).toBe(1)
  })

  it('parcela sem vencimento não vira conta (o contas a pagar precisa da data)', async () => {
    const semVenc = await prisma.stockPayableSuggestion.create({ data: { companyId, nfeId, chave: CHAVE, supplierCnpj: CNPJ_FORN, supplierNome: 'FRIGORIFICO SILVA', nDup: '003', dVenc: null, valor: 100 } })
    const r = await enviarParaContasPagar({ companyId, suggestionIds: [semVenc.id], cadastrarFornecedores: true, ctx: ctx() }, prisma)
    expect(r.criadas).toBe(0)
    expect(r.erros[0].motivo).toContain('vencimento')
  })
})

describe('entrada manual — mesmo fluxo, mesma origem', () => {
  it('compra A PRAZO gera a conta; À VISTA não gera nada', async () => {
    const aVista = await registrarEntradaManual({ companyId, fornecedor: { nome: 'SEU ZE' }, data: '2026-08-24', itens: [{ itemId, quantidade: 1, custoUnitario: 10 }] }, prisma)
    const r0 = await enviarEntradaManual({ companyId, entradaId: aVista.entradaId, cadastrarFornecedor: true, ctx: ctx() }, prisma)
    expect(r0.criadas).toBe(0)

    const aPrazo = await registrarEntradaManual({ companyId, fornecedor: { nome: 'SEU ZE PRODUTOR', cnpj: '12345678000199' }, data: '2026-08-24', itens: [{ itemId, quantidade: 10, custoUnitario: 9 }], payable: { vencimento: '2026-09-24', valor: 90 } }, prisma)
    const r1 = await enviarEntradaManual({ companyId, entradaId: aPrazo.entradaId, cadastrarFornecedor: true, ctx: ctx() }, prisma)
    expect(r1.criadas).toBe(1)
    const conta = await prisma.transaction.findUnique({ where: { id: r1.transactionIds[0] } })
    expect(conta!.origin).toBe(ORIGEM_PONTE)
    expect(conta!.amount).toBe(90)
    expect(conta!.description).toContain('sem nota')

    // idempotente também
    expect((await enviarEntradaManual({ companyId, entradaId: aPrazo.entradaId, cadastrarFornecedor: true, ctx: ctx() }, prisma)).puladas).toBe(1)
  })
})

describe('⚠️ ISOLAMENTO — a exceção tem o TAMANHO que foi nomeado', () => {
  it('NENHUM outro caminho do estoque escreve em transactions/suppliers', async () => {
    const antes = await contarFinanceiro()

    // saída (perda)
    await registrarSaida({ companyId, itemId, quantidade: 1, motivo: 'ESTRAGOU' }, prisma)
    // contagem com ajuste
    const s = await iniciarContagem(companyId, { userId: 'u1' }, prisma)
    await contarLinha({ companyId, contagemId: s.id, itemId, qtdContada: 20, confirmarFreio: true }, prisma)
    // entrada manual À VISTA (sem parcela)
    await registrarEntradaManual({ companyId, fornecedor: { nome: 'FEIRA' }, data: '2026-08-24', itens: [{ novo: { nome: 'Couve', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA' }, quantidade: 5, custoUnitario: 2 }] }, prisma)
    // movimento cru
    await criarMovimento(prisma, { companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -2, custoUnitario: 40, origem: 'MANUAL' })

    const depois = await contarFinanceiro()
    expect(depois, 'nenhuma operação de estoque pode tocar o financeiro').toEqual(antes)
  })

  it('SÓ a ponte escreve — e escreve exatamente 1 conta + 1 fornecedor', async () => {
    const antes = await contarFinanceiro()
    await enviarParaContasPagar({ companyId, suggestionIds: [sug1], cadastrarFornecedores: true, ctx: ctx() }, prisma)
    const depois = await contarFinanceiro()
    expect(depois.tx).toBe(antes.tx + 1)
    expect(depois.forn).toBe(antes.forn + 1)
  })
})
