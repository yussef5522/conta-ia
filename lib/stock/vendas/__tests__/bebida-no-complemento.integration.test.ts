// ⛔⛔⛔ A BEBIDA VENDIDA COMO COMPLEMENTO NÃO BAIXAVA (12/09/2026)
//
// **O dono:** *"COCA 2L é produto no cardápio E complemento quando o cliente adiciona. A do
// relatório de Produtos baixa certinho; a MESMA bebida no relatório de Complementos não
// baixa nada."*
//
// ⚠️ **A aposta dele ("complemento = sabor") foi REFUTADA pelo dado:** não há régua barrando.
// São **dois mapas** e ninguém preencheu o de complementos — das 18 bebidas do relatório,
// **18 pendentes**, e 7 já com ficha no mapa de produtos.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { upsertVendaMap } from '../venda-map'
import { heranciasDisponiveis, aplicarHerancas } from '../bebida-no-complemento'
import { preverBaixaDasLinhas } from '../baixa-complemento'
import { saldoItem } from '../../saldo'

const CNPJ = '10203040000188'
let companyId = ''
let garrafaId = ''
let fichaCocaId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BEBIDA TESTE' } })).id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'COCA-COLA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' } })
  garrafaId = it.id
  await prisma.stockMovement.create({ data: { companyId, itemId: garrafaId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 8.08, custoTotal: 808, origem: 'SEFAZ' } })
  // a ficha de REVENDA (1 componente ×1) — o caminho único de 09/09
  const f = await criarFicha({
    companyId, nomeProduzido: 'COCA COLA 2L', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
    loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: garrafaId, qtdPlanejada: 1, unidade: 'UN' }],
  }, prisma)
  fichaCocaId = f.fichaId
  // o mapa de PRODUTOS (o cardápio) — é ele que já baixava
  await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'FICHA', fichaId: fichaCocaId }, 'u', prisma)

  // as linhas do relatório de COMPLEMENTOS do dia
  const dia = new Date('2026-09-10T12:00:00Z')
  const imp = 'comp-2026-09-10'
  for (const [nome, oc] of [['COCA COLA 2L', 4], ['COCA LATA MAIS MINI FRITAS', 3], ['CALABRESA', 7]] as [string, number][]) {
    await prisma.stockVendaComplementoLinha.create({ data: { companyId, importId: imp, data: dia, nomeSuitable: nome, ocorrencias: oc } })
  }
})

afterEach(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_update;').catch(() => {})
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;').catch(() => {})
  for (const t of ['stockMovement', 'stockVendaComplementoLinha', 'stockVendaComplementoMap', 'stockVendaProdutoMap',
    'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } }).catch(() => {})
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const plano = () => preverBaixaDasLinhas(companyId, '2026-09-10', 'comp-2026-09-10',
  [{ nomeSuitable: 'COCA COLA 2L', ocorrencias: 4 }], prisma)

describe('⛔⛔ a bebida do complemento baixa a MESMA garrafa do cardápio', () => {
  it('⛔ ANTES de herdar, a COCA do complemento é PENDENTE e não baixa nada', async () => {
    const p = await plano()
    expect(p.pendentes.map((x) => x.nomeSuitable)).toContain('COCA COLA 2L')
    expect(p.agregada).toHaveLength(0)
  })

  it('⭐⭐ a herança acha o destino pelo canônico já mapeado no cardápio', async () => {
    const h = await heranciasDisponiveis(companyId, prisma)
    const coca = h.find((x) => x.nomeSuitable === 'COCA COLA 2L')!
    expect(coca).toBeDefined()
    expect(coca.fichaId).toBe(fichaCocaId)
    expect(coca.ocorrencias).toBe(4)
  })

  it('⛔⛔ e o COMBO não herda — "COCA LATA MAIS MINI FRITAS" é outro produto', async () => {
    const h = await heranciasDisponiveis(companyId, prisma)
    expect(h.map((x) => x.nomeSuitable)).not.toContain('COCA LATA MAIS MINI FRITAS')
    // ⚠️ tem fritas dentro: herdar por "parece" seria baixar só a lata e esquecer a batata
  })

  it('⭐⭐⭐ DEPOIS de herdar, a COCA do complemento baixa a garrafa', async () => {
    await aplicarHerancas(companyId, 'u', prisma)
    const p = await plano()
    expect(p.pendentes).toHaveLength(0)
    expect(p.agregada).toHaveLength(1)
    expect(p.agregada[0].itemId).toBe(garrafaId)
    expect(p.agregada[0].qtd).toBe(4)
  })

  it('⭐⭐⭐ PRODUTO + COMPLEMENTO no mesmo dia = DUAS baixas da mesma garrafa', async () => {
    // é a régua do dono: são duas vendas diferentes do mesmo refrigerante
    await aplicarHerancas(companyId, 'u', prisma)
    const antes = (await saldoItem(prisma, companyId, garrafaId)).saldo
    // 6 pelo cardápio (o caminho que já funcionava)
    await prisma.stockMovement.create({ data: { companyId, itemId: garrafaId, tipo: 'BAIXA_VENDA', quantidade: -6, custoUnitario: 8.08, custoTotal: -48.48, origem: 'MANUAL', receiptId: 'venda-2026-09-10' } })
    // 4 pelo complemento
    const p = await plano()
    expect(p.agregada[0].qtd).toBe(4)
    expect(antes - 6 - p.agregada[0].qtd).toBe(90)   // 100 − 6 − 4
  })

  it('⛔ decisão do dono NÃO é sobrescrita: nome já IGNORADO fica ignorado', async () => {
    await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'COCA COLA 2L', alvoTipo: 'IGNORAR' } })
    const h = await heranciasDisponiveis(companyId, prisma)
    expect(h.map((x) => x.nomeSuitable)).not.toContain('COCA COLA 2L')
    await aplicarHerancas(companyId, 'u', prisma)
    const m = await prisma.stockVendaComplementoMap.findFirst({ where: { companyId, nomeSuitable: 'COCA COLA 2L' } })
    expect(m!.alvoTipo).toBe('IGNORAR')
  })

  it('⭐ o canônico ignora caixa e acento — a régua de 08/09, sem afrouxar', async () => {
    await prisma.stockVendaComplementoLinha.create({ data: { companyId, importId: 'comp-x', data: new Date('2026-09-11T12:00:00Z'), nomeSuitable: 'coca cola 2l', ocorrencias: 2 } })
    const h = await heranciasDisponiveis(companyId, prisma)
    expect(h.map((x) => x.nomeSuitable)).toContain('coca cola 2l')
  })
})
