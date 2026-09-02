// ⭐⭐ O MAPA DOS COMPLEMENTOS — os três destinos, o reversível e o aviso dos 25 (02/09).
//
// ⚠️ ESTE ARQUIVO EXISTE PORQUE O DONO COBROU: *"8.110 verdes sem nenhum deles cobrindo o
// código novo é verde dos outros"*. A suíte passava inteira com `complemento-map.ts` e
// `import-complementos.ts` sem uma linha de cobertura própria.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { upsertComplementoMap, limparComplementoMap, prateleiraDeComplementos, ComplementoMapError } from '../complemento-map'
import { criarFicha } from '../../producao/fichas'

const CNPJ = '50505050000277'
let companyId: string
let insumoId: string
let fichaSabor: string
let fichaProduto: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'COMP' } })
  companyId = c.id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'CALABRESA CRUA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  insumoId = it.id
  const comp = [{ itemId: insumoId, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }]
  // o SABOR é INTERMEDIARIO — o mapa de complementos aceita, o de produtos recusaria
  fichaSabor = (await criarFicha({ companyId, nomeProduzido: 'sabor calabresa', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: comp }, prisma)).fichaId
  fichaProduto = (await criarFicha({ companyId, nomeProduzido: 'XIS - CALABRESA', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 20, componentes: comp }, prisma)).fichaId
})
afterEach(async () => {
  for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoLinha', 'stockVendaProdutoMap',
    'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ os TRÊS destinos', () => {
  it('⭐ FICHA — aceita INTERMEDIARIO, que é o que o mapa de PRODUTOS recusaria', async () => {
    // ⛔ é a diferença que os dois guards documentam e que ninguém pode "unificar":
    // sabor é consumido pela pizza, nunca vendido solto.
    const r = await upsertComplementoMap(companyId, 'CALABRESA', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma)
    expect(r.alvoTipo).toBe('FICHA')
    expect(r.fichaId).toBe(fichaSabor)
  })

  it('⭐ FICHA — e também aceita PRODUTO_FINAL (o complemento pode ser o mesmo do combo)', async () => {
    // XIS - CALABRESA existe como produto E como complemento (32× e 21× no período real)
    const r = await upsertComplementoMap(companyId, 'XIS - CALABRESA', { tipo: 'FICHA', fichaId: fichaProduto }, undefined, prisma)
    expect(r.fichaId).toBe(fichaProduto)
  })

  it('⭐ IGNORAR — não aponta pra ficha nenhuma', async () => {
    const r = await upsertComplementoMap(companyId, 'GRANDE', { tipo: 'IGNORAR' }, undefined, prisma)
    expect(r.alvoTipo).toBe('IGNORAR')
    expect(r.fichaId).toBeNull()
  })

  it('⭐⭐ SEM MAPEAR — o estado inicial de tudo, e ele é VISÍVEL', async () => {
    const p = await prateleiraDeComplementos(companyId, [{ nomeSuitable: 'MUSSARELA', ocorrencias: 500 }], prisma)
    expect(p[0]).toMatchObject({ nomeSuitable: 'MUSSARELA', destino: 'SEM_FICHA', fichaId: null })
    // ⚠️ não some e não baixa — some seria o "estoque invisível" que o dono não aceita
    expect(p).toHaveLength(1)
  })

  it('⛔ ficha ARQUIVADA é recusada, com mensagem que ensina', async () => {
    await prisma.stockFicha.update({ where: { id: fichaSabor }, data: { ativo: false } })
    await expect(upsertComplementoMap(companyId, 'CALABRESA', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma))
      .rejects.toThrow(/arquivada/)
  })

  it('⛔ ficha de OUTRA empresa é recusada (multi-tenant)', async () => {
    await expect(upsertComplementoMap(companyId, 'X', { tipo: 'FICHA', fichaId: 'ficha-de-outra' }, undefined, prisma))
      .rejects.toThrow(ComplementoMapError)
  })
})

describe('⭐⭐ o IGNORAR é REVERSÍVEL', () => {
  it('⭐⭐ LIMPAR devolve ao estado PENDENTE — milkshake e açaí entram depois', async () => {
    await upsertComplementoMap(companyId, 'OREO', { tipo: 'IGNORAR' }, undefined, prisma)
    let p = await prateleiraDeComplementos(companyId, [{ nomeSuitable: 'OREO', ocorrencias: 10 }], prisma)
    expect(p[0].destino).toBe('IGNORAR')

    await limparComplementoMap(companyId, 'OREO', prisma)
    p = await prateleiraDeComplementos(companyId, [{ nomeSuitable: 'OREO', ocorrencias: 10 }], prisma)
    // ⚠️ volta a PENDENTE, não some: a decisão de ignorar não é definitiva, e desfazer
    // não pode exigir mexer no banco à mão.
    expect(p[0].destino).toBe('SEM_FICHA')
    expect(await prisma.stockVendaComplementoMap.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ e trocar de destino sobrescreve, sem duplicar linha', async () => {
    await upsertComplementoMap(companyId, 'CALABRESA', { tipo: 'IGNORAR' }, undefined, prisma)
    await upsertComplementoMap(companyId, 'CALABRESA', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma)
    const rows = await prisma.stockVendaComplementoMap.findMany({ where: { companyId, nomeSuitable: 'CALABRESA' } })
    expect(rows).toHaveLength(1)
    expect(rows[0].alvoTipo).toBe('FICHA')
    expect(rows[0].fichaId).toBe(fichaSabor)
  })
})

describe('⚠️ o AVISO do nome que está nos DOIS relatórios', () => {
  it('⚠️ mostra que também é produto E qual o destino de LÁ', async () => {
    // COCA COLA 2L é o caso real: 337 como produto, 134 como complemento.
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'COCA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    await prisma.stockVendaProdutoMap.create({ data: { companyId, nomeSuitable: 'COCA COLA 2L', alvoTipo: 'REVENDA', itemId: item.id } })

    const p = await prateleiraDeComplementos(companyId, [
      { nomeSuitable: 'COCA COLA 2L', ocorrencias: 134 },
      { nomeSuitable: 'CALABRESA', ocorrencias: 1220 },
    ], prisma)

    const coca = p.find((x) => x.nomeSuitable === 'COCA COLA 2L')!
    expect(coca.tambemProduto).toBe(true)
    // ⭐ o dono decide vendo os DOIS destinos — o sistema mostra, não escolhe nem bloqueia
    expect(coca.destinoComoProduto).toBe('REVENDA')
    expect(p.find((x) => x.nomeSuitable === 'CALABRESA')!.tambemProduto).toBe(false)
  })

  it('⛔ e o risco é REAL: sem destino por origem, um nome baixaria duas vezes', async () => {
    // os dois mapas são independentes — é isso que permite "produto baixa, complemento ignora"
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'COCA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    await prisma.stockVendaProdutoMap.create({ data: { companyId, nomeSuitable: 'COCA COLA 2L', alvoTipo: 'REVENDA', itemId: item.id } })
    await upsertComplementoMap(companyId, 'COCA COLA 2L', { tipo: 'IGNORAR' }, undefined, prisma)

    const p = await prateleiraDeComplementos(companyId, [{ nomeSuitable: 'COCA COLA 2L', ocorrencias: 134 }], prisma)
    expect(p[0].destino).toBe('IGNORAR')        // como complemento: não baixa
    expect(p[0].destinoComoProduto).toBe('REVENDA') // como produto: baixa a bebida
  })
})

describe('⭐ a prateleira ordena por OCORRÊNCIAS', () => {
  it('⭐⭐ CALABRESA (1.220) primeiro — o dono mapeia o que importa antes da cauda', async () => {
    const p = await prateleiraDeComplementos(companyId, [
      { nomeSuitable: 'RUCULA', ocorrencias: 3 },
      { nomeSuitable: 'CALABRESA', ocorrencias: 1220 },
      { nomeSuitable: 'FRANGO', ocorrencias: 371 },
    ], prisma)
    expect(p.map((x) => x.nomeSuitable)).toEqual(['CALABRESA', 'FRANGO', 'RUCULA'])
  })

  it('⚠️ o mesmo nome em dias diferentes SOMA — a prateleira é do período, não do dia', async () => {
    const p = await prateleiraDeComplementos(companyId, [
      { nomeSuitable: 'CALABRESA', ocorrencias: 600 },
      { nomeSuitable: 'CALABRESA', ocorrencias: 620 },
    ], prisma)
    expect(p).toHaveLength(1)
    expect(p[0].ocorrencias).toBe(1220)
  })
})

describe('⭐⭐ criar ficha PELA prateleira já nasce vinculada', () => {
  it('⭐⭐ ficha + vínculo na MESMA transação — o bug das 3 órfãs não repete', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: 'sabor frango', unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumoId, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }],
      mapearComplemento: 'FRANGO',
    }, prisma)
    expect(r.vinculadoAoPdv).toBe(true)

    const p = await prateleiraDeComplementos(companyId, [{ nomeSuitable: 'FRANGO', ocorrencias: 371 }], prisma)
    expect(p[0].destino).toBe('FICHA')
    expect(p[0].fichaId).toBe(r.fichaId)
    expect(p[0].nomeFicha).toBe('sabor frango')
  })

  it('⛔ SEM o parâmetro, a ficha nasce ÓRFÃ — o estado exato de 01/09', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: 'sabor orfao', unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumoId, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }],
    }, prisma)
    expect(r.vinculadoAoPdv).toBe(false)
    expect(await prisma.stockVendaComplementoMap.count({ where: { companyId } })).toBe(0)
  })

  it('⛔ e mandar os DOIS mapeamentos é recusado — sinal de chamada errada', async () => {
    await expect(criarFicha({
      companyId, nomeProduzido: 'confuso', unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumoId, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }],
      mapearNomeSuitable: 'X', mapearComplemento: 'Y',
    }, prisma)).rejects.toThrow(/produto e como complemento/)
  })
})
