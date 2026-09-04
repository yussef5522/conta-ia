// ⭐⭐⭐ A BAIXA DOS COMPLEMENTOS — o red-then-green combinado com o dono (03/09/2026).
//
// A regra que este arquivo trava, nas palavras dele:
//   **1 ocorrência de CALABRESA → CONSUMO de 1 UN da porção de calabresa, ZERO movimento na
//   calabresa CRUA. Saldo negativo = "vendeu sem produzir", sinal legítimo.**
//
// ⛔ E as duas armadilhas escritas no código em 02/09, antes de o problema existir:
//   1. linha de PERÍODO não baixa (baixaria o mês inteiro com cara de rotina)
//   2. reimport de dia já baixado não fica em silêncio

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { upsertComplementoMap } from '../complemento-map'
import { confirmarComplementos } from '../import-complementos'
import { montarPlanoComplementos, processarComplementos, listarDiasComplemento, BaixaComplementoError } from '../baixa-complemento'
import { saldoItem } from '../../saldo'

/** o número do saldo (a lib devolve o objeto do item) */
const saldo = async (itemId: string) => (await saldoItem(prisma, companyId, itemId)).saldo

const CNPJ = '44556677000188'
const DIA = '2026-09-03'
let companyId = ''
let calabresaCrua = ''
let itemPorcao = ''
let fichaPorcao = ''
let fichaSabor = ''

/** relatório de complementos: Descrição | Valor médio | Quantidade | Valor Total */
const html = (linhas: [string, number][]) =>
  `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>` +
  linhas.map(([nome, q]) => `<tr><td>${nome}</td><td>R$ 0,00</td><td>${q}</td><td>R$ 0,00</td></tr>`).join('') +
  `</table>`

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BAIXA' } })).id

  // a matéria-prima que a COZINHA usa (e que a venda NÃO pode tocar)
  const crua = await prisma.stockItem.create({ data: { companyId, nome: 'CALABRESA CRUA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  calabresaCrua = crua.id
  await prisma.stockMovement.create({ data: { companyId, itemId: crua.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 30, custoTotal: 300, origem: 'SEFAZ' } })

  // a receita de produção: a porção que a cozinha faz em lote
  const p = await criarFicha({
    companyId, nomeProduzido: 'porcao de calabresa 120 grama', unidadeProduzido: 'UN',
    tipoProduto: 'INTERMEDIARIO', loteBase: 10, unidadeLoteBase: 'UN',
    componentes: [{ itemId: calabresaCrua, qtdPlanejada: 1.2, unidade: 'KG', posicao: 0 }],
  }, prisma)
  fichaPorcao = p.fichaId; itemPorcao = p.itemProduzidoId
  // 20 porções produzidas e na câmara
  await prisma.stockMovement.create({ data: { companyId, itemId: itemPorcao, tipo: 'PRODUCAO_GERACAO', quantidade: 20, custoUnitario: 3.6, custoTotal: 72, origem: 'MANUAL' } })

  // o SABOR: o que a venda consome (1 UN da porção pronta)
  const s = await criarFicha({
    companyId, nomeProduzido: 'CALABRESA', unidadeProduzido: 'UN',
    tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    mapearComplemento: ['CALABRESA'],
  }, prisma)
  fichaSabor = s.fichaId
})

afterEach(async () => {
  for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoLinha', 'stockVendaComplementoNome',
    'stockVendaComplementoGrupo', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha',
    'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐⭐ 1 ocorrência = 1 explosão da ficha', () => {
  it('⭐⭐⭐ 1 CALABRESA → 1 UN da PORÇÃO, ZERO movimento na crua', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 1]]), undefined, prisma)
    const r = await processarComplementos(companyId, DIA, undefined, prisma)

    expect(r.ocorrencias).toBe(1)
    expect(r.itensBaixados).toBe(1)

    const movs = await prisma.stockMovement.findMany({ where: { companyId, tipo: 'BAIXA_VENDA' }, select: { itemId: true, quantidade: true } })
    expect(movs).toHaveLength(1)
    expect(movs[0].itemId, 'baixou o item errado').toBe(itemPorcao)
    expect(movs[0].quantidade).toBe(-1)
    // ⛔ a crua é da COZINHA: quem a consumiu foi a produção, não a venda
    expect(movs.some((m) => m.itemId === calabresaCrua), 'a venda mexeu na calabresa CRUA').toBe(false)
    expect(await saldo(calabresaCrua)).toBe(10)
    expect(await saldo(itemPorcao)).toBe(19)
  })

  it('⭐⭐ 4 ocorrências (pizza grande inteira) → 4 UN, sem fração por tamanho', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 4]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(16)
  })

  it('⭐⭐ SALDO NEGATIVO é sinal legítimo: "vendeu sem produzir"', async () => {
    // 25 ocorrências com 20 porções na câmara
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 25]]), undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.agregada[0].saldoDepois, 'a tela precisa AVISAR o negativo antes de gravar').toBe(-5)

    // ⚠️ e não bloqueia: esconder isso trocaria informação verdadeira por estoque bonito
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(-5)
  })

  it('⚠️ complemento SEM ficha não baixa e não some — fica visível', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 2], ['OREO', 7]]), undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.pendentes.map((p) => p.nomeSuitable)).toEqual(['OREO'])
    const r = await processarComplementos(companyId, DIA, undefined, prisma)
    expect(r.pendentes).toBe(1)
    expect(r.ocorrencias).toBe(2) // só as da CALABRESA
  })

  it('⭐ IGNORADO não baixa (é decisão de não baixar, não falta de ficha)', async () => {
    await upsertComplementoMap(companyId, 'GRANDE', { tipo: 'IGNORAR' }, undefined, prisma)
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 1], ['GRANDE', 9]]), undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.ignorados.map((i) => i.nomeSuitable)).toEqual(['GRANDE'])
    expect(plano.pendentes).toEqual([])
  })
})

describe('⛔⛔ ARMADILHA 1 — linha de PERÍODO não baixa', () => {
  it('⛔⛔ import de PERÍODO é RECUSADO, com a saída na mensagem', async () => {
    await confirmarComplementos(companyId, '2026-08-31', html([['CALABRESA', 1220]]), undefined, prisma, 'PERIODO')
    const plano = await montarPlanoComplementos(companyId, '2026-08-31', prisma)
    expect(plano.ehPeriodo).toBe(true)

    await expect(processarComplementos(companyId, '2026-08-31', undefined, prisma))
      .rejects.toThrow(/PERÍODO/)
    // ⛔ e o ledger continua intocado — 1.220 ocorrências NÃO viraram baixa
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
    expect(await saldo(itemPorcao)).toBe(20)
  })

  it('⭐ e o mesmo arquivo como DIA baixa normalmente', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 3]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(17)
  })
})

describe('⛔⛔ ARMADILHA 2 — reimport de dia JÁ BAIXADO', () => {
  it('⛔⛔ reimportar com número diferente ACENDE "precisa reprocessar"', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 10]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(10)

    // o PDV corrigiu o dia: agora são 7
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 7]]), undefined, prisma)

    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    // ⚠️ sem esta marca ficariam LINHA NOVA (7) + MOVIMENTO VELHO (10) convivendo em
    // silêncio: o estoque baixou 3 a mais do que o relatório atual diz.
    expect(plano.precisaReprocessar, 'o dia mudou e ninguém foi avisado').toBe(true)
    expect(plano.jaBaixado).toBe(true)
    const dias = await listarDiasComplemento(companyId, prisma)
    expect(dias[0].precisaReprocessar, 'a tela precisa mostrar isso na lista de dias').toBe(true)
  })

  it('⭐⭐ o reprocesso ESTORNA e refaz — e o saldo fica o do relatório novo', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 10]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 7]]), undefined, prisma)

    const r = await processarComplementos(companyId, DIA, undefined, prisma)
    expect(r.estornou).toBe(1)
    expect(await saldo(itemPorcao)).toBe(13) // 20 − 7, não 20 − 17

    // ⭐ e o ledger guarda a história inteira: baixa velha + estorno + baixa nova
    const movs = await prisma.stockMovement.findMany({ where: { companyId, itemId: itemPorcao }, select: { tipo: true, quantidade: true } })
    expect(movs.filter((m) => m.tipo === 'BAIXA_VENDA')).toHaveLength(2)
    expect(movs.filter((m) => m.tipo === 'ESTORNO')).toHaveLength(1)
    // nada foi apagado — movimento é imutável
    expect(await montarPlanoComplementos(companyId, DIA, prisma).then((p) => p.precisaReprocessar)).toBe(false)
  })

  it('⭐ rodar a baixa 2× sem mudar nada é IDEMPOTENTE no saldo', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 5]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(15)
  })

  it('⭐ mapear uma ficha DEPOIS e reprocessar traz o que faltava', async () => {
    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 2], ['OREO', 3]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(18)

    // o dono mapeia OREO na mesma porção (só pra provar o caminho) e reprocessa
    await upsertComplementoMap(companyId, 'OREO', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma)
    const plano = await montarPlanoComplementos(companyId, DIA, prisma)
    expect(plano.precisaReprocessar).toBe(true)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(15) // 20 − (2+3)
  })
})

describe('⭐ o motor é o MESMO da baixa de produtos', () => {
  it('⭐ ficha de sabor com 2 componentes baixa os dois, na proporção', async () => {
    const molho = await prisma.stockItem.create({ data: { companyId, nome: 'MOLHO', unidadeControle: 'LT', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: molho.id, tipo: 'ENTRADA_NF', quantidade: 5, custoUnitario: 20, custoTotal: 100, origem: 'SEFAZ' } })
    await prisma.stockFicha.update({ where: { id: fichaSabor }, data: { versaoAtual: 2 } })
    const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: fichaSabor, versao: 2, loteBase: 1, unidadeLoteBase: 'UN' } })
    await prisma.stockFichaComponente.createMany({ data: [
      { companyId, versaoId: v.id, itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 },
      { companyId, versaoId: v.id, itemId: molho.id, qtdPlanejada: 0.02, unidade: 'LT', posicao: 1 },
    ] })

    await confirmarComplementos(companyId, DIA, html([['CALABRESA', 10]]), undefined, prisma)
    await processarComplementos(companyId, DIA, undefined, prisma)
    expect(await saldo(itemPorcao)).toBe(10)
    expect(await saldo(molho.id)).toBe(4.8) // 5 − 0,2
  })

  it('⛔ dia sem nenhuma ficha mapeada recusa com mensagem, sem gravar', async () => {
    await prisma.stockVendaComplementoMap.deleteMany({ where: { companyId } })
    await confirmarComplementos(companyId, DIA, html([['OREO', 3]]), undefined, prisma)
    await expect(processarComplementos(companyId, DIA, undefined, prisma)).rejects.toThrow(BaixaComplementoError)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
  })
})
