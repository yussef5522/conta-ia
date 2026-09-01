// ESTOQUE FASE 2 item 2.5 — GOLDEN do fluxo completo (a 1ª produção real da Caçula) +
// juiz P1-P6 (cada um vermelho→verde). O fluxo verde não dispara nenhum P; cada quebra
// dispara o P certo. Roda o pipeline real (ficha→ordem→separação→conclusão) no ledger.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao } from '../ordens'
import { concluir } from '../conclusao'
import { checkProducaoInvariants } from '../producao-invariants'
import { saldosDaEmpresa } from '../../saldo'

const CNPJ = '70707070000170'
let companyId: string
let ids: Record<string, string> = {}
let fichaId: string
let produtoId: string
const COMPS = [{ nome: 'Coxão Mole', custo: 46.95 }, { nome: 'Açém', custo: 33.95 }, { nome: 'Gordura', custo: 9.6 }]

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'GOLDEN FLUXO' } })
  companyId = c.id; ids = {}
  for (const k of COMPS) {
    const it = await prisma.stockItem.create({ data: { companyId, nome: k.nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    ids[k.nome] = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: k.custo, custoTotal: k.custo * 20, origem: 'SEFAZ' } })
  }
  const f = await criarFicha({ companyId, nomeProduzido: 'Porção de carne 100g', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 15, componentes: COMPS.map((k, i) => ({ itemId: ids[k.nome], qtdPlanejada: 1, unidade: 'KG', posicao: i })) }, prisma)
  fichaId = f.fichaId; produtoId = f.itemProduzidoId
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

async function produzir(escala: number, sep: number, consumo: number, qtdGerada: number, parcial = false) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: escala, dataProducao: new Date('2026-08-21') }, prisma)
  await confirmarSeparacao(companyId, ordemId, COMPS.map((k) => ({ itemId: ids[k.nome], qtdSeparada: sep })), prisma)
  await iniciarProducao(companyId, ordemId)
  const r = await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: consumo })), qtdGerada, parcial }, prisma)
  return { ordemId, r }
}
const soP = (fails: { invariante: string }[]) => fails.filter((f) => f.invariante.startsWith('P'))

describe('GOLDEN fluxo completo + juiz P1-P6', () => {
  it('1ª produção real (1kg de cada → 25 UN, 3,62/un) → 0 P falhos, P1 fecha', async () => {
    const { r } = await produzir(100, 1, 1, 25)
    expect(r.rendimento).toBe(25)
    expect(r.custoUnitarioReal).toBe(3.62) // 90,50 / 25
    expect((await prisma.stockItem.findFirst({ where: { id: produtoId } }))!.nome).toContain('carne')
    // nenhum invariante de produção falha no fluxo correto
    const fails = soP(await checkProducaoInvariants(prisma, new Date('2026-08-21')))
    expect(fails).toHaveLength(0)
  })

  it('E1: separação/conclusão recomputam o cache — cache == Σ movimentos (não drifta)', async () => {
    await produzir(100, 1, 1, 25)
    const derivados = await saldosDaEmpresa(prisma, companyId)
    const caches = await prisma.stockSaldoCache.findMany({ where: { companyId } })
    // todo item com movimento tem cache, e o cache bate com o derivado (o que o juiz E1 exige)
    for (const d of derivados) {
      const c = caches.find((x) => x.itemId === d.itemId)
      expect(c, `item ${d.itemId} sem cache`).toBeTruthy()
      expect(Math.round(c!.saldo * 100) / 100).toBe(d.saldo)
    }
    // o produto produzido tem cache (era o que faltava)
    expect(caches.find((c) => c.itemId === produtoId)?.saldo).toBe(25)
  })

  it('P4 (vazamento): ordem CONCLUIDA com em-produção preso → dispara', async () => {
    const { ordemId } = await produzir(1, 1, 1, 20)
    // injeta uma SEPARACAO extra sem consumir/devolver (simula vazamento)
    await prisma.stockMovement.create({ data: { companyId, itemId: ids['Coxão Mole'], tipo: 'SEPARACAO_SAIDA', quantidade: -0.5, custoUnitario: 46.95, custoTotal: -23.48, receiptId: ordemId, origem: 'MANUAL' } })
    const p = soP(await checkProducaoInvariants(prisma, new Date('2026-08-21')))
    expect(p.some((f) => f.invariante === 'P4')).toBe(true)
  })

  it('P1: ordem CONCLUIDA com separado ≠ consumido+devolvido → dispara', async () => {
    const { ordemId } = await produzir(1, 1, 1, 20)
    // injeta um CONSUMO a mais (quebra Σ SEP == Σ CON + Σ DEV)
    await prisma.stockMovement.create({ data: { companyId, itemId: ids['Açém'], tipo: 'PRODUCAO_CONSUMO', quantidade: -0.3, custoUnitario: 33.95, custoTotal: -10.19, receiptId: ordemId, origem: 'MANUAL' } })
    const p = soP(await checkProducaoInvariants(prisma, new Date('2026-08-21')))
    expect(p.some((f) => f.invariante === 'P1')).toBe(true)
  })

  it('P3: 2ª produção com rendimento > ±25% da média → dispara', async () => {
    await produzir(1, 1, 1, 25) // rendimento 25
    await produzir(1, 1, 1, 10) // rendimento 10 (−60% da média 25)
    const p = soP(await checkProducaoInvariants(prisma, new Date('2026-08-21')))
    expect(p.some((f) => f.invariante === 'P3')).toBe(true)
  })

  it('P2: ordem em aberto parada > 24h → dispara (now no futuro)', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date('2026-08-21') }, prisma)
    expect(ordemId).toBeTruthy()
    // ⛔⛔ BOMBA-RELÓGIO QUE EXPLODIU (01/09/2026): aqui era `new Date('2026-09-01')` fixo,
    // com o comentário "11 dias depois". Mas o P2 mede `now − atualizadoEm`, e
    // `atualizadoEm` é o relógio REAL de quando a linha nasceu (Prisma `@updatedAt`).
    // Enquanto o calendário estava em agosto, 01/09 era futuro e o teste passava. **No dia
    // 01/09 a diferença virou ZERO** e o teste ficou vermelho sozinho.
    //
    // ⚠️ 3ª ocorrência da mesma classe em um dia (real-vs-teorico, e a janela fixa da
    // detecção de empréstimo em 26/08). **"Futuro" tem que ser relativo ao relógio de
    // quem roda — data fixa não é futuro, é uma data que o calendário alcança.**
    const daquiA11Dias = new Date(Date.now() + 11 * 86_400_000)
    const p = soP(await checkProducaoInvariants(prisma, daquiA11Dias))
    expect(p.some((f) => f.invariante === 'P2')).toBe(true)
  })

  it('P5: produto final sem preço há > 14 dias → dispara; P6: componente sem custo > 7 dias', async () => {
    // produto final sem preço
    await criarFicha({ companyId, nomeProduzido: 'Prato sem preço', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: ids['Coxão Mole'], qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    // ficha com componente sem custo (item sem ENTRADA_NF)
    const semCusto = await prisma.stockItem.create({ data: { companyId, nome: 'Sal', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await criarFicha({ companyId, nomeProduzido: 'Tempero', unidadeProduzido: 'LT', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'LT', componentes: [{ itemId: semCusto.id, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    // ⚠️ relativo ao relógio, pelo mesmo motivo do P2 acima — este aqui ainda não tinha
    // explodido, mas explodiria em 30/09. Bomba desarmada antes de tocar.
    const p = soP(await checkProducaoInvariants(prisma, new Date(Date.now() + 20 * 86_400_000)))
    expect(p.some((f) => f.invariante === 'P5')).toBe(true)
    expect(p.some((f) => f.invariante === 'P6')).toBe(true)
  })
})
