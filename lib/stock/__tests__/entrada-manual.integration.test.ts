// ESTOQUE — ENTRADA MANUAL (compra sem nota). REGRA 3: roda o pipeline real contra banco.
// O que importa provar: é COMPRA (o custo médio se move), não ajuste; o item novo nasce
// na hora; a parcela é opt-in (à vista não gera); e o isolamento continua de pé.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { montarPreview, registrarEntradaManual, getEntradaManual, listarEntradasManuais, EntradaManualError } from '../entrada-manual'
import { saldoItem, custoMedioPorItem } from '../saldo'
import { criarMovimento } from '../movement'
import { snapshotClosedModules, isolationHeld } from '../stock-invariants'

const CNPJ = '50607080000177'
let companyId: string
let itemExistente: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA ENTRADA MANUAL' } })).id
  itemExistente = (await prisma.stockItem.create({ data: { companyId, nome: 'Tomate', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
  // já tinha 10 KG a R$ 5 (custo médio 5,00)
  await criarMovimento(prisma, { companyId, itemId: itemExistente, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, origem: 'SEFAZ' })
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockEntradaManualItem', 'stockEntradaManual', 'stockMovement', 'stockSaldoCache', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('montarPreview (puro) — a tela e o servidor mostram o MESMO número', () => {
  it('soma o total', () => {
    const p = montarPreview([
      { itemId: 'a', quantidade: 3, custoUnitario: 10 },
      { itemId: 'b', quantidade: 2, custoUnitario: 7.5 },
    ], new Map([['a', 'Tomate'], ['b', 'Cebola']]))
    expect(p.valorTotal).toBe(45)
    expect(p.linhas[0].nome).toBe('Tomate')
  })
  it('recusa lista vazia', () => expect(() => montarPreview([])).toThrow(EntradaManualError))
  it('recusa item sem produto escolhido', () => expect(() => montarPreview([{ quantidade: 1, custoUnitario: 1 }])).toThrow(/catálogo/))
  it('recusa catálogo E novo ao mesmo tempo', () => {
    expect(() => montarPreview([{ itemId: 'a', novo: { nome: 'X', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA' }, quantidade: 1, custoUnitario: 1 }])).toThrow(/não os dois/)
  })
  it('recusa quantidade zero', () => expect(() => montarPreview([{ itemId: 'a', quantidade: 0, custoUnitario: 1 }])).toThrow(/maior que zero/))
  it('aceita custo ZERO (bonificação)', () => {
    expect(montarPreview([{ itemId: 'a', quantidade: 5, custoUnitario: 0 }]).valorTotal).toBe(0)
  })
})

describe('registrarEntradaManual — é COMPRA de verdade', () => {
  it('sobe o estoque com ENTRADA_MANUAL e MOVE o custo médio', async () => {
    const r = await registrarEntradaManual({
      companyId, fornecedor: { nome: 'SEU ZE PRODUTOR RURAL' }, data: '2026-08-23',
      itens: [{ itemId: itemExistente, quantidade: 10, custoUnitario: 9 }], userId: 'u1', userName: 'Yussef',
    }, prisma)

    expect(r.movimentos).toBe(1)
    expect(r.valorTotal).toBe(90)

    const mov = await prisma.stockMovement.findFirst({ where: { companyId, tipo: 'ENTRADA_MANUAL' } })
    expect(mov).toBeTruthy()
    expect(mov!.quantidade).toBe(10)
    expect(mov!.receiptId).toBe(r.entradaId) // ref da entrada, mesmo padrão de conferência/ordem

    // 10 KG a 5 + 10 KG a 9 = 20 KG, R$ 140 → custo médio 7,00 (é compra, não ajuste)
    const s = await saldoItem(prisma, companyId, itemExistente)
    expect(s.saldo).toBe(20)
    expect(s.valor).toBe(140)
    expect((await custoMedioPorItem(prisma, companyId)).get(itemExistente)).toBe(7)
  })

  it('cria o fornecedor na hora quando ele não existe', async () => {
    await registrarEntradaManual({
      companyId, fornecedor: { nome: 'FEIRA DO CENTRO', cnpj: null }, data: '2026-08-23',
      itens: [{ itemId: itemExistente, quantidade: 1, custoUnitario: 5 }],
    }, prisma)
    const f = await prisma.stockSupplier.findFirst({ where: { companyId, razaoSocial: 'FEIRA DO CENTRO' } })
    expect(f).toBeTruthy()
    expect(f!.criadoVia).toBe('MANUAL')
  })

  it('cria o ITEM na hora (produto que não está no catálogo)', async () => {
    const r = await registrarEntradaManual({
      companyId, fornecedor: { nome: 'SEU ZE' }, data: '2026-08-23',
      itens: [{ novo: { nome: 'Couve Manteiga', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA' }, quantidade: 30, custoUnitario: 2.5 }],
    }, prisma)
    expect(r.itensCadastrados).toBe(1)
    const novo = await prisma.stockItem.findFirst({ where: { companyId, nome: 'Couve Manteiga' } })
    expect(novo).toBeTruthy()
    expect((await saldoItem(prisma, companyId, novo!.id)).saldo).toBe(30)
  })

  it('recusa item de OUTRA empresa (REGRA 8 — resolve por id, escopado)', async () => {
    const outra = await prisma.company.create({ data: { cnpj: '50607080000188', name: 'OUTRA' } })
    const itemOutra = await prisma.stockItem.create({ data: { companyId: outra.id, nome: 'Alheio', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await expect(registrarEntradaManual({
      companyId, fornecedor: { nome: 'X' }, data: '2026-08-23',
      itens: [{ itemId: itemOutra.id, quantidade: 1, custoUnitario: 1 }],
    }, prisma)).rejects.toThrow(/não é desta empresa/)
    await prisma.stockItem.deleteMany({ where: { companyId: outra.id } })
    await prisma.company.delete({ where: { id: outra.id } })
  })
})

describe('parcela (contas a pagar) é OPT-IN', () => {
  it('compra à vista NÃO gera parcela', async () => {
    const r = await registrarEntradaManual({
      companyId, fornecedor: { nome: 'MERCADO' }, data: '2026-08-23',
      itens: [{ itemId: itemExistente, quantidade: 2, custoUnitario: 10 }],
    }, prisma)
    expect(r.payableGerada).toBe(false)
    const e = await getEntradaManual(companyId, r.entradaId, prisma)
    expect(e!.geraPayable).toBe(false)
    expect(e!.payableVenc).toBeNull()
  })

  it('a prazo grava vencimento e valor', async () => {
    const r = await registrarEntradaManual({
      companyId, fornecedor: { nome: 'SEU ZE' }, data: '2026-08-23',
      itens: [{ itemId: itemExistente, quantidade: 10, custoUnitario: 9 }],
      payable: { vencimento: '2026-09-23', valor: 90 },
    }, prisma)
    expect(r.payableGerada).toBe(true)
    const e = await getEntradaManual(companyId, r.entradaId, prisma)
    expect(e!.payableValor).toBe(90)
    expect(e!.payableVenc).toContain('2026-09-23')
  })

  it('recusa parcela sem vencimento válido', async () => {
    await expect(registrarEntradaManual({
      companyId, fornecedor: { nome: 'X' }, data: '2026-08-23',
      itens: [{ itemId: itemExistente, quantidade: 1, custoUnitario: 1 }],
      payable: { vencimento: 'nao-e-data', valor: 10 },
    }, prisma)).rejects.toThrow(/vencimento/)
  })
})

describe('recibo e listagem', () => {
  it('o recibo traz os itens e o fornecedor', async () => {
    const r = await registrarEntradaManual({
      companyId, fornecedor: { nome: 'SEU ZE PRODUTOR' }, data: '2026-08-23',
      itens: [{ itemId: itemExistente, quantidade: 4, custoUnitario: 6 }], userName: 'Yussef',
    }, prisma)
    const e = await getEntradaManual(companyId, r.entradaId, prisma)
    expect(e!.fornecedorNome).toBe('SEU ZE PRODUTOR')
    expect(e!.itens).toHaveLength(1)
    expect(e!.itens[0].nome).toBe('Tomate')
    expect(e!.itens[0].custoTotal).toBe(24)
    expect(e!.criadoPorNome).toBe('Yussef')
  })

  it('aparece na listagem (seção Recebidas, marcada MANUAL)', async () => {
    await registrarEntradaManual({ companyId, fornecedor: { nome: 'A' }, data: '2026-08-23', itens: [{ itemId: itemExistente, quantidade: 1, custoUnitario: 1 }] }, prisma)
    const l = await listarEntradasManuais(companyId, prisma)
    expect(l).toHaveLength(1)
    expect(l[0].fornecedorNome).toBe('A')
  })
})

describe('ISOLAMENTO', () => {
  it('entrada manual não muda nenhum módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma, companyId)
    await registrarEntradaManual({
      companyId, fornecedor: { nome: 'SEU ZE' }, data: '2026-08-23',
      itens: [{ novo: { nome: 'Abobrinha', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA' }, quantidade: 5, custoUnitario: 4 }],
      payable: { vencimento: '2026-09-01', valor: 20 },
    }, prisma)
    expect(isolationHeld(antes, await snapshotClosedModules(prisma, companyId))).toBe(true)
  })
})
