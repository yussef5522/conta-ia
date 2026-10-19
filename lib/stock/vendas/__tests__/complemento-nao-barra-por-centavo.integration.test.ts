// ⭐⭐⭐ A BAIXA DOS COMPLEMENTOS NÃO BARRA POR CENTAVO (19/10/2026) — contra BANCO.
//
// **O caso real:** 17/10, `porçao calabresa ralada 50 grama` com **49 UN / R$ 39,57**; a
// baixa calculava `49 × 0,81 = R$ 39,69` e o guarda do estado impossível recusava o lote
// inteiro — *"ficaria com 0 unidades e valor R$ −0,12"*.
//
// ⛔⛔ **POR QUE ESTE TESTE É DE INTEGRAÇÃO E NÃO PURO:** o defeito só existia no ENCAIXE —
// a decisão (`custoParaBaixar`) estava certa e testada desde 19/09, e o `baixa-complemento`
// simplesmente **não a chamava**. *Guard que testa a função não prova o encaixe de quem a
// chama* (a cicatriz da mediana de 03/10 e do teto ponderado de 14/10). Só rodando a
// gravação de verdade é que o lote passa ou barra.
//
// ⚠️⚠️ **E O FIXTURE ENSINA UMA COISA SOBRE O MÓDULO:** `confirmarComplementos` **JÁ BAIXA**
// (o gesto único de 07/09 — *"CONFIRMAR IMPORT = importa E BAIXA na mesma ação"*). Então o
// import NÃO mora no `beforeEach`: cada teste decide se quer o estado ANTES do gesto (as 49
// UN na prateleira) ou DEPOIS. Pôr o confirm no setup consumia as 49 antes do primeiro
// `expect` e os testes mediam o reprocesso, não a baixa.
//
// ⛔ E o GUARDA não foi afrouxado: há um teste abaixo provando que ele **continua** recusando
// o dado torto de verdade (valor negativo com saldo em pé).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { confirmarComplementos } from '../import-complementos'
import { preverBaixaDasLinhas, processarComplementos } from '../baixa-complemento'
import { saldoItem } from '../../saldo'
import { criarMovimento, MovementInvalidError } from '../../movement'

// ⚠️ 83838383000183 é do `so-espaco-nao-passa` — o guard de 12/10 pegou a colisão. Medido
// antes de escolher: este não aparece em nenhum arquivo do repo.
const CNPJ = '83838383000184'
const DIA = '2026-10-17'
let companyId = ''
let itemPorcao = ''

/** relatório de complementos: Descrição | Valor médio | Quantidade | Valor Total */
const html = (linhas: [string, number][]) =>
  `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>`
  + linhas.map(([nome, q]) => `<tr><td>${nome}</td><td>R$ 0,00</td><td>${q}</td><td>R$ 0,00</td></tr>`).join('')
  + `</table>`

/** as 3 grafias do dia real — PAULISTA 35 + ENTREVERO 11 + CHEF 3 = 49 */
const LINHAS: [string, number][] = [['PAULISTA', 35], ['ENTREVERO', 11], ['CHEF', 3]]

/** o gesto do dono: confirmar o import — que JÁ baixa (07/09) */
const importar = () => confirmarComplementos(companyId, DIA, html(LINHAS), undefined, prisma)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'CENTAVO' } })).id

  // a matéria-prima que a COZINHA rala (a venda nunca a toca)
  const crua = await prisma.stockItem.create({
    data: { companyId, nome: 'CALABRESA CRUA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  await prisma.stockMovement.create({
    data: { companyId, itemId: crua.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 30, custoTotal: 300, origem: 'SEFAZ' },
  })

  // a porção pronta, com o estado EXATO de prod: 49 UN valendo R$ 39,57
  // (⚠️ é como um lote de produção aterra: custo unitário em precisão cheia, total redondo)
  const p = await criarFicha({
    companyId, nomeProduzido: 'porçao calabresa ralada 50 grama', unidadeProduzido: 'UN',
    tipoProduto: 'INTERMEDIARIO', loteBase: 49, unidadeLoteBase: 'UN',
    componentes: [{ itemId: crua.id, qtdPlanejada: 2.45, unidade: 'KG', posicao: 0 }],
  }, prisma)
  itemPorcao = p.itemProduzidoId
  await prisma.stockMovement.create({
    data: {
      companyId, itemId: itemPorcao, tipo: 'PRODUCAO_GERACAO',
      quantidade: 49, custoUnitario: 39.57 / 49, custoTotal: 39.57, origem: 'MANUAL',
    },
  })

  // os 3 sabores que consomem a porção — 35 + 11 + 3 = 49, como no dia real
  for (const nome of ['PAULISTA', 'ENTREVERO', 'CHEF']) {
    await criarFicha({
      companyId, nomeProduzido: nome, unidadeProduzido: 'UN',
      tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      mapearComplemento: [nome],
    }, prisma)
  }
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('a baixa que ZERA o item passa — e zera o valor junto', () => {
  it('⭐ o estado de partida é o de prod: 49 UN · R$ 39,57 · custo de leitura 0,81', async () => {
    const s = await saldoItem(prisma, companyId, itemPorcao)
    expect(s.saldo).toBe(49)
    expect(s.valor).toBe(39.57)
    expect(s.custoMedio).toBe(0.81) // o arredondado — era ELE que a baixa usava
  })

  it('⭐⭐ o PREVIEW do arquivo promete R$ 39,57 (não os 39,69 da aritmética antiga)', async () => {
    // ⚠️ o preview roda ANTES de o dia existir no banco — é a tela que o dono vê no upload
    const plano = await preverBaixaDasLinhas(
      companyId, DIA, 'preview',
      LINHAS.map(([nomeSuitable, ocorrencias]) => ({ nomeSuitable, ocorrencias })),
      prisma,
    )
    const linha = plano.agregada.find((a) => a.itemId === itemPorcao)!
    expect(linha.qtd).toBe(49)
    expect(linha.valor).toBe(39.57)
    expect(linha.valor).not.toBe(39.69)
    expect(linha.saldoDepois).toBe(0)
  })

  it('⭐⭐⭐ o CONFIRMAR do import GRAVA a baixa (antes o guarda recusava o lote) e o valor vai a ZERO', async () => {
    const r = await importar()

    // ⛔ a ponte é fail-soft: se a baixa falhar, o import fica e AVISA. Aqui ela tem que passar.
    expect(r.baixaFalhou).toBe(false)
    expect(r.avisoBaixa).toBeNull()
    expect(r.baixa?.ocorrencias).toBe(49)

    const s = await saldoItem(prisma, companyId, itemPorcao)
    expect(s.saldo).toBe(0)
    expect(s.valor).toBe(0) // ⛔ era −0,12, o estado impossível
  })

  it('⭐ o PREVIEW e o LEDGER dizem o mesmo número (preview == gravação)', async () => {
    const plano = await preverBaixaDasLinhas(
      companyId, DIA, 'preview',
      LINHAS.map(([nomeSuitable, ocorrencias]) => ({ nomeSuitable, ocorrencias })),
      prisma,
    )
    const prometido = plano.agregada.find((a) => a.itemId === itemPorcao)!.valor!

    const r = await importar()

    // ⚠️ soma o LÍQUIDO (movimento + estorno) — correção neste módulo é estorna-e-refaz
    const movs = await prisma.stockMovement.findMany({
      where: { companyId, itemId: itemPorcao, receiptId: r.baixa!.importId },
      select: { custoTotal: true },
    })
    const gravado = Math.abs(movs.reduce((s, m) => s + m.custoTotal, 0))
    expect(gravado).toBe(prometido)
    expect(r.baixa!.valorBaixado).toBe(prometido)
  })

  it('⭐ reprocessar é idempotente: estorna, refaz, e o valor segue ZERO', async () => {
    const r = await importar()
    await processarComplementos(companyId, DIA, undefined, prisma)

    const s = await saldoItem(prisma, companyId, itemPorcao)
    expect(s.saldo).toBe(0)
    expect(s.valor).toBe(0)

    // o par estorna-e-refaz convive; o LÍQUIDO é uma baixa só
    const movs = await prisma.stockMovement.findMany({
      where: { companyId, itemId: itemPorcao, receiptId: r.baixa!.importId },
      select: { custoTotal: true },
    })
    expect(Math.abs(movs.reduce((s, m) => s + m.custoTotal, 0))).toBe(39.57)
  })
})

describe('⛔ o GUARDA do estado impossível NÃO foi afrouxado', () => {
  it('ele continua recusando valor negativo com saldo em pé', async () => {
    // ⚠️ o caso que ISOLA o guarda: tira MAIS dinheiro do que o item tem (R$ 45,00 de um
    // item que vale 39,57) deixando 10 UN na prateleira → saldo 10 com valor −R$ 5,43.
    // ⛔ Tirar exatamente os 39,57 NÃO serve de teste: o valor fica ZERO, e zero com saldo
    // em pé é um item sem custo — estado feio, mas POSSÍVEL (o guarda só morde valor < 0).
    await expect(criarMovimento(prisma, {
      companyId, itemId: itemPorcao, tipo: 'BAIXA_VENDA',
      quantidade: -39, custoUnitario: 45 / 39, custoTotal: -45,
      origem: 'MANUAL',
    })).rejects.toThrow(MovementInvalidError)
  })

  it('⭐ e ele DEIXA PASSAR o que é só feio: saldo em pé com valor ZERO', async () => {
    // a fronteira do guarda, do outro lado — senão ele barraria baixa legítima
    const m = await criarMovimento(prisma, {
      companyId, itemId: itemPorcao, tipo: 'BAIXA_VENDA',
      quantidade: -39, custoUnitario: 39.57 / 39, custoTotal: -39.57,
      origem: 'MANUAL',
    })
    expect(m.id).toBeTruthy()
    const s = await saldoItem(prisma, companyId, itemPorcao)
    expect(s.saldo).toBe(10)
    expect(s.valor).toBe(0)
  })
})
