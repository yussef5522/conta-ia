// ⭐⭐ O MAPA DOS COMPLEMENTOS — os três destinos, o reversível e o aviso dos 25 (02/09).
//
// ⚠️ ESTE ARQUIVO EXISTE PORQUE O DONO COBROU: *"8.110 verdes sem nenhum deles cobrindo o
// código novo é verde dos outros"*. A suíte passava inteira com `complemento-map.ts` e
// `import-complementos.ts` sem uma linha de cobertura própria.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { upsertComplementoMap, limparComplementoMap, prateleiraDeComplementos, ComplementoMapError } from '../complemento-map'
import { prateleiraGravada, confirmarComplementos, ehLinhaDePeriodo, importIdDe } from '../import-complementos'
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
  for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoLinha', 'stockVendaComplementoGrupo', 'stockVendaProdutoMap',
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

describe('⛔⛔ NOME CONHECIDO NÃO SOME POR CAUSA DE DATA (02/09)', () => {
  // regra do dono: "mapear é trabalho independente de período — a prateleira mostra TODOS
  // os nomes conhecidos sempre".
  const html = (nome: string, qtd: number) =>
    `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>` +
    `<tr><td>${nome}</td><td>R$ 0,00</td><td>${qtd}</td><td>R$ 0,00</td></tr></table>`

  it('⛔⛔ o mapeado que perdeu a linha no REIMPORT continua visível, com 0', async () => {
    await confirmarComplementos(companyId, '2026-08-29', html('CALABRESA', 115), undefined, prisma)
    await upsertComplementoMap(companyId, 'CALABRESA', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma)

    // reimporta o MESMO dia sem a CALABRESA (o PDV corrigiu o dia) → a linha dela some
    await confirmarComplementos(companyId, '2026-08-29', html('FRANGO', 30), undefined, prisma)
    expect(await prisma.stockVendaComplementoLinha.count({ where: { companyId, nomeSuitable: 'CALABRESA' } })).toBe(0)

    const { prateleira } = await prateleiraGravada(companyId, prisma)
    const cal = prateleira.find((l) => l.nomeSuitable === 'CALABRESA')
    // ⚠️ sem a união ela sumiria da tela com o mapeamento VIVO no banco — invisível e valendo
    expect(cal, 'CALABRESA sumiu da prateleira com o mapeamento vivo').toBeTruthy()
    expect(cal!.destino).toBe('FICHA')
    expect(cal!.ocorrencias).toBe(0)
  })

  it('⭐ e a prateleira diz o PERÍODO dela, não o do relatório de produtos', async () => {
    await confirmarComplementos(companyId, '2026-08-29', html('CALABRESA', 115), undefined, prisma)
    const { periodo } = await prateleiraGravada(companyId, prisma)
    expect(periodo).toEqual({ de: '2026-08-29', ate: '2026-08-29', dias: 1 })
  })

  it('⭐ sem import nenhum, o período é null (não inventa data)', async () => {
    expect((await prateleiraGravada(companyId, prisma)).periodo).toBeNull()
  })
})

describe('⭐⭐ o sabor do cardápio que ainda NÃO vendeu aparece com 0', () => {
  // ⚠️ pedido do dono: "não quero descobrir na primeira venda deles que não tinham ficha"
  const htmlCardapio = (nomes: string[]) =>
    `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>` +
    nomes.map((n, i) => `<tr><td>${n}</td><td>R$ 0,00</td><td>${i + 1}</td><td>R$ 0,00</td></tr>`).join('') +
    `</table>`

  it('⭐⭐ com o cardápio PROVADO pelo relatório, os 5 que não venderam entram com 0', async () => {
    // 12 sabores do cardápio real → passa do mínimo de evidência
    await confirmarComplementos(companyId, '2026-08-29', htmlCardapio([
      'CALABRESA', 'FRANGO', 'BACON', 'PAULISTA', 'MUSSARELA', 'PORTUGUESA',
      'MARGHERITA', 'NAPOLITANA', '4 QUEIJOS', '5 QUEIJOS', 'ENTREVERO', 'BASCA',
    ]), undefined, prisma)

    const { prateleira } = await prateleiraGravada(companyId, prisma)
    const nomes = prateleira.map((l) => l.nomeSuitable)
    for (const s of ['PIZZA ATUM', 'MEXICANA', 'HOT DOG', 'CHOCOLATE PRETO', 'KIT KAT']) {
      expect(nomes, s).toContain(s)
      const l = prateleira.find((x) => x.nomeSuitable === s)!
      expect(l.ocorrencias).toBe(0)
      expect(l.destino).toBe('SEM_FICHA')
      expect(l.grupo).toBe('SABOR') // cai na seção de sabores, mapeável hoje
    }
  })

  it('⛔⛔ SEM evidência do cardápio, NÃO injeta nada — outra empresa não herda pizza', async () => {
    // uma lanchonete que vende BACON e FRANGO não é a Caçula
    await confirmarComplementos(companyId, '2026-08-29', htmlCardapio(['BACON', 'FRANGO']), undefined, prisma)
    const { prateleira } = await prateleiraGravada(companyId, prisma)
    expect(prateleira.map((l) => l.nomeSuitable).sort()).toEqual(['BACON', 'FRANGO'])
  })
})

describe('⛔⛔ PERÍODO não é um dia de venda', () => {
  const html = `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>` +
    `<tr><td>CALABRESA</td><td>R$ 0,00</td><td>1220</td><td>R$ 0,00</td></tr></table>`

  it('⛔⛔ a linha de período é RECONHECÍVEL — a baixa tem como recusar', async () => {
    const r = await confirmarComplementos(companyId, '2026-08-31', html, undefined, prisma, 'PERIODO')
    expect(r.modo).toBe('PERIODO')
    expect(ehLinhaDePeriodo(r.importId)).toBe(true)
    const linha = await prisma.stockVendaComplementoLinha.findFirst({ where: { companyId, nomeSuitable: 'CALABRESA' } })
    // ⚠️ sem esta marca, "processar o dia 31/08" baixaria o MÊS INTEIRO com cara de rotina
    expect(ehLinhaDePeriodo(linha!.importId)).toBe(true)
  })

  it('⭐ o import de DIA continua sendo dia (o caminho normal não muda)', async () => {
    const r = await confirmarComplementos(companyId, '2026-08-29', html, undefined, prisma)
    expect(r.modo).toBe('DIA')
    expect(ehLinhaDePeriodo(r.importId)).toBe(false)
    expect(importIdDe(companyId, '2026-08-29', 'DIA')).toBe(`comp-${companyId}-2026-08-29`)
  })

  it('⭐ e período e dia CONVIVEM: são chaves diferentes, um não apaga o outro', async () => {
    await confirmarComplementos(companyId, '2026-08-29', html, undefined, prisma)
    await confirmarComplementos(companyId, '2026-08-31', html, undefined, prisma, 'PERIODO')
    const ids = (await prisma.stockVendaComplementoLinha.findMany({ where: { companyId }, select: { importId: true } })).map((l) => l.importId)
    expect(new Set(ids).size).toBe(2)
    expect(ids.filter(ehLinhaDePeriodo)).toHaveLength(1)
  })
})
