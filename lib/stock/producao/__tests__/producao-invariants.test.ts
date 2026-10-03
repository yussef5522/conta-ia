// ESTOQUE FASE 2 item 2.5 — GOLDEN do fluxo completo (a 1ª produção real da Caçula) +
// juiz P1-P6 (cada um vermelho→verde). O fluxo verde não dispara nenhum P; cada quebra
// dispara o P certo. Roda o pipeline real (ficha→ordem→separação→conclusão) no ledger.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao } from '../ordens'
import { concluir } from '../conclusao'
import { checkProducaoInvariants } from '../producao-invariants'
import type { StockInvariantFail } from '../../stock-invariants'
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
  // ⚠️⚠️ `stockProducaoDesvio` FALTAVA NESTA LISTA, e o P8 (que lê essa tabela) denunciou:
  // o `it` seguinte via o julgamento congelado dos anteriores como se fosse dele. É a classe
  // das linhas órfãs de 03/10 — tabela `stock_*` não tem cascade (o isolamento proíbe
  // `@relation`), então o que não está nesta lista SOBREVIVE à empresa.
  for (const t of ['stockProducaoDesvio', 'stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
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
const soP = (fails: StockInvariantFail[]) => fails.filter((f) => f.invariante.startsWith('P'))
/**
 * ⚠️⚠️ **ESCOPO POR EMPRESA, e isto me pegou escrevendo o teste do P8.** O juiz é GLOBAL por
 * desenho (varre o banco inteiro, todas as empresas), então `toHaveLength(0)` sem filtro mede
 * o lixo das outras suítes rodando em paralelo — e o meu P8 "disparava" num lote de 90% que
 * estava correto. É a MESMA classe do `snapshotClosedModules` global (23/08) e das 161.810
 * linhas órfãs de 03/10: **asserção de CONTAGEM sobre varredura global precisa de escopo.**
 * Os testes antigos escapam porque usam `.some(...)`, que tolera linha de fora.
 */
const soMinhas = (fails: StockInvariantFail[], inv: string) =>
  fails.filter((f) => f.invariante === inv && f.companyId === companyId)

describe('GOLDEN fluxo completo + juiz P1-P6', () => {
  it('1ª produção real (1kg de cada → 25 UN, 3,62/un) → 0 P falhos, P1 fecha', async () => {
    const { r } = await produzir(100, 1, 1, 25)
    expect(r.rendimento).toBe(25)
    expect(r.custoUnitarioReal).toBe(3.62) // 90,50 / 25
    expect((await prisma.stockItem.findFirst({ where: { id: produtoId } }))!.nome).toContain('carne')
    /**
     * ⚠️⚠️ **ESCOPADO POR EMPRESA (03/10), e a troca não afrouxa nada.** A asserção era
     * global (`soP(...)` sem filtro) e passava por SORTE: enquanto nenhum P disparava pra
     * outra empresa, 0 global == 0 desta. O P8 quebrou esse acaso — ele lê
     * `stock_producao_desvio`, tabela que acumula órfã de toda suíte (sem cascade, por
     * isolamento). **A pergunta que este teste quer fazer sempre foi "o MEU fluxo correto não
     * dispara nada"**, e agora ela está escrita assim.
     */
    const fails = soP(await checkProducaoInvariants(prisma, new Date('2026-08-21')))
      .filter((f) => f.companyId === companyId)
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

  /**
   * ⭐⭐⭐ P8 — A EFICIÊNCIA CAIU (item 2 da decisão do dono, 03/10/2026).
   *
   * *"Aviso no juiz quando a eficiência cai (<85%) — me DENUNCIA, não me corrige."*
   *
   * ⛔⛔ **É A CONTRAPARTIDA DE TIRAR O RENDIMENTO DA SEPARAÇÃO.** Enquanto a medição dividia
   * o pedido, render mal se autocorrigia em silêncio. Com a separação fixa pela ficha, render
   * mal **sobra** — e sobrar só vale se alguém for avisado.
   */
  it('⭐⭐ P8: lote abaixo de 85% do que a receita promete → dispara AVISO', async () => {
    // consumo de 1 KG de cada (porLote 1) → a receita promete 1 unidade; saíram 0,8 = 80%
    await produzir(1, 1, 1, 0.8)
    const p8 = soMinhas(await checkProducaoInvariants(prisma, new Date('2026-08-21')), 'P8')
    expect(p8).toHaveLength(1)
    expect(p8[0].nivel).toBe('aviso') // ⛔ nunca ERRO: é fato da operação, não defeito de dado
    expect(p8[0].detalhe).toContain('80%')
    expect(p8[0].detalhe).toContain('abaixo de 85%')
  })

  it('⭐ P8 NÃO dispara dentro da faixa — 90% é a vida real da cozinha', async () => {
    /** ⚠️ É a mesma razão por que o dono chamou o `beef de hamburger` (94-99%) de "OK". */
    await produzir(1, 1, 1, 0.9)
    expect(soMinhas(await checkProducaoInvariants(prisma, new Date('2026-08-21')), 'P8')).toHaveLength(0)
  })

  it('⛔⛔ P8 CALA o P3 no mesmo lote — uma causa, um alarme', async () => {
    /**
     * ⚠️ Sem isto o mesmo lote ruim sairia duas vezes no e-mail: *"saiu 50% do que a receita
     * promete"* (P8) e *"desvia 50% da sua média"* (P3). É a régua do N1/N3 do juiz de infra —
     * **alarme repetido é como o dono para de ler o e-mail** (a lição dos 111 falsos).
     */
    await produzir(1, 1, 1, 1)         // 100% — vira a referência
    const { r } = await produzir(1, 1, 1, 0.5) // 50% da receita E −50% da média
    const fails = await checkProducaoInvariants(prisma, new Date('2026-08-21'))

    /**
     * ⚠️⚠️ **A MINHA PREMISSA ESTAVA ERRADA E O TESTE CORRIGIU:** eu esperava `P3` ZERADO na
     * empresa. Mas o P3 compara cada lote com a média dos OUTROS — então com dois lotes
     * (1 e 0,5) **cada um destoa do outro** e ele fala dos dois. A supressão é por LOTE, não
     * por empresa: *"uma causa, um alarme"* vale pro lote que o P8 já denunciou.
     */
    const p8 = soMinhas(fails, 'P8')
    expect(p8).toHaveLength(1)
    expect(p8[0].detalhe).toContain(r.conclusaoId) // ⭐ é o lote ruim
    // ⭐ e o P3 NÃO repete esse mesmo lote
    expect(soMinhas(fails, 'P3').some((f) => f.detalhe.includes(r.conclusaoId))).toBe(false)
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
