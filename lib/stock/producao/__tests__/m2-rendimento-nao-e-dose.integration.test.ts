/**
 * ⛔⛔⛔ M2 — RENDIMENTO NÃO É DOSE. O teste que isola o defeito do CHAMADOR (02/10/2026).
 *
 * ⚠️⚠️ **REGRA 11 ME CORRIGIU DUAS VEZES NO MESMO INVARIANTE.** O M2 puro
 * (`plausibilidade-da-dose.test.ts`) **recebe** o denominador por parâmetro — então ele passa
 * verde mesmo que o juiz mande o denominador ERRADO. Foi exatamente o que aconteceu: a 1ª
 * versão do juiz dividia por `qtdGerada` e, repondo o defeito, **os 9 testes puros seguiram
 * verdes**. Guard que testa a função não prova o encaixe de quem a chama — a lição de 16/09.
 *
 * ⭐ Este arquivo monta a cena que SÓ existe com a ficha real da Caçula: **1 receita → 25
 * porções** (rendimento 25). A ordem consome **exatamente** o que a ficha manda, e o M2 tem
 * que **CALAR**. Com `qtdGerada` no denominador a razão vira `1/25 = 0,04` → **−96%** e o
 * juiz acusa uma ordem perfeita.
 *
 * ⚠️ E era o tamanho do estrago em prod: **107 de 319 conclusões** acusadas, na pergunta que
 * o P3 já fazia.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { checkProducaoInvariants } from '../producao-invariants'
import { criarFicha } from '../fichas'

const CNPJ = '76767676000176'
let companyId = ''

const M2 = async () =>
  (await checkProducaoInvariants(prisma, new Date('2026-09-21T12:00:00Z'))).filter(
    (f) => f.invariante === 'M2' && f.companyId === companyId,
  )

/**
 * Cria a ordem + conclusão com o consumo EXATO da ficha.
 * @param escala quantos lotes a ORDEM mandou fazer
 * @param rendimento quantas unidades sai de CADA lote (25 = a porção de queijo real)
 */
async function ordemLimpa(escala: number, rendimento: number, dose: number) {
  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: 'QUEIJO MUSSARELA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumo.id, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: 31.9, custoTotal: 15950, origem: 'SEFAZ' },
  })
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: `porção de queijo ${rendimento}`,
      unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO',
      loteBase: 1,
      unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo.id, qtdPlanejada: dose, unidade: 'KG' }],
    },
    prisma,
  )
  const ficha = await prisma.stockFicha.findUniqueOrThrow({
    where: { id: f.fichaId },
    select: { versaoAtual: true, itemProduzidoId: true },
  })
  const ordem = await prisma.stockProductionOrder.create({
    data: {
      companyId, fichaId: f.fichaId, versaoFicha: ficha.versaoAtual,
      itemProduzidoId: ficha.itemProduzidoId,
      escalaReceitas: escala, estado: 'CONCLUIDA',
      dataProducao: new Date('2026-09-20T15:00:00Z'),
    },
  })
  // ⭐ o consumo EXATO que a ficha manda: dose × escala
  const consumo = dose * escala
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumo.id, tipo: 'SEPARACAO_SAIDA', quantidade: -consumo, custoUnitario: 31.9, custoTotal: -consumo * 31.9, receiptId: ordem.id, origem: 'MANUAL' },
  })
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumo.id, tipo: 'PRODUCAO_CONSUMO', quantidade: -consumo, custoUnitario: 31.9, custoTotal: -consumo * 31.9, receiptId: ordem.id, origem: 'MANUAL' },
  })
  const qtdGerada = escala * rendimento
  await prisma.stockProducaoConclusao.create({
    data: {
      companyId, ordemId: ordem.id, qtdGerada,
      escalaConsumida: escala, rendimento,
      custoLoteReal: consumo * 31.9,
      custoUnitarioReal: (consumo * 31.9) / qtdGerada,
    },
  })
  return { ordemId: ordem.id, insumoId: insumo.id, consumo }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'M2 RENDIMENTO' } })
  companyId = c.id
})

afterEach(async () => {
  /**
   * ⚠️⚠️ APAGA AS TABELAS `stock_*` EXPLICITAMENTE — `company.deleteMany` NÃO cascateia aqui.
   * O isolamento do módulo proíbe `@relation` às tabelas fechadas (o `companyId` é VALOR
   * indexado), então não existe cascade. A 1ª versão deste arquivo só apagava a empresa e
   * deixou **32 ordens órfãs no dev.db** — e como `checkProducaoInvariants` varre o banco
   * INTEIRO, o golden da produção (que não filtra empresa) ficou vermelho por sujeira minha.
   * É a mesma classe do `snapshotClosedModules` global (23/08) e do CNPJ colidindo (13/09):
   * teste que não limpa o que cria envenena o vizinho.
   */
  for (const t of ['stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap', 'stockVendaComplementoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔⛔ a ficha de rendimento 25 consumindo EXATO: o M2 tem que CALAR', () => {
  it('⭐ 1 receita → 25 porções, consumo exato → ZERO aviso', async () => {
    /**
     * ⛔ É O TESTE QUE MORDE O DEFEITO DO CHAMADOR: com `qtdGerada` (250 unidades) no
     * denominador, a razão vira 0,04 e o M2 grita −96% numa ordem perfeita.
     */
    await ordemLimpa(10, 25, 0.135)
    expect(await M2()).toEqual([])
  })

  it('⭐ e rendimento FRACIONÁRIO (1 receita → 0,6 un, o caso da massa) também cala', async () => {
    // medido em prod: o rendimento da Caçula vai de 0,0386 a 3,78 — os dois extremos quebram
    // a régua antiga, em direções opostas.
    await ordemLimpa(300, 0.62, 0.15)
    expect(await M2()).toEqual([])
  })

  it('⛔⛔ e com a dose TORTA de verdade (consumiu 40% a mais) ele ACENDE', async () => {
    /**
     * ⚠️ A outra metade do guard: calar sempre também seria defeito. Aqui o consumo não é o
     * da ficha — e o M2 acende nomeando a dose, com rendimento 25 no meio do caminho.
     */
    const o = await ordemLimpa(10, 25, 0.135)
    await prisma.stockMovement.create({
      data: {
        companyId, itemId: o.insumoId, tipo: 'PRODUCAO_CONSUMO',
        quantidade: -o.consumo * 0.4, custoUnitario: 31.9, custoTotal: -o.consumo * 0.4 * 31.9,
        receiptId: o.ordemId, origem: 'MANUAL',
      },
    })
    const m = await M2()
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBe('aviso')
    expect(m[0].detalhe).toContain('+40%')
  })
})
