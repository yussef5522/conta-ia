// ⭐⭐ UMA LINHA POR SABOR, SEM FUNDIR O DADO (03/09/2026).
//
// O PDV manda o mesmo sabor com grafias diferentes — MEDIDO no relatório real: **31 grupos**,
// com `CALABRESA`(1.220) + `Calabresa`(1) + `calabresa`(1) e
// `FRANGO COM BACON`(14) + `frango com bacon`(1). Pro dono é UM sabor: uma linha, soma.
//
// ⛔⛔ E O NOME CRU CONTINUA GRAVADO COMO VEIO: é ele que casa com o relatório de amanhã.
// Fundir no dado faria a importação do dia seguinte não reconhecer a grafia que sumiu — e a
// venda deixaria de baixar **em silêncio**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { agruparPorDestino, cardsDaPrateleira, secoesDaPrateleira } from '../painel-complementos'
import type { LinhaPrateleira } from '../complemento-map'
import { upsertComplementoMap, limparComplementoMap, prateleiraDeComplementos } from '../complemento-map'
import { criarFicha } from '../../producao/fichas'

const l = (p: Partial<LinhaPrateleira> & { nomeSuitable: string; ocorrencias: number }): LinhaPrateleira => ({
  destino: 'SEM_FICHA', fichaId: null, nomeFicha: null, tambemProduto: false,
  destinoComoProduto: null, grupo: 'OUTRO', grupoDoDono: false, ...p,
})

describe('⭐⭐ agrupa por DESTINO', () => {
  it('⭐⭐ dois nomes na MESMA ficha viram UMA linha com a soma', () => {
    const r = agruparPorDestino([
      l({ nomeSuitable: 'FRANGO COM BACON', ocorrencias: 14, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'sabor frango c/ bacon', grupo: 'SABOR' }),
      l({ nomeSuitable: 'frango com bacon', ocorrencias: 1, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'sabor frango c/ bacon', grupo: 'SABOR' }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].titulo).toBe('sabor frango c/ bacon')
    expect(r[0].ocorrencias).toBe(15)
    // ⭐ e os nomes crus continuam à mão, do maior volume pro menor
    expect(r[0].apelidos).toEqual([
      { nomeSuitable: 'FRANGO COM BACON', ocorrencias: 14 },
      { nomeSuitable: 'frango com bacon', ocorrencias: 1 },
    ])
  })

  it('⛔ PENDENTE não se agrupa — antes de mapear ninguém sabe que são o mesmo sabor', () => {
    const r = agruparPorDestino([
      l({ nomeSuitable: 'FRANGO COM BACON', ocorrencias: 14 }),
      l({ nomeSuitable: 'frango com bacon', ocorrencias: 1 }),
    ])
    expect(r).toHaveLength(2)
    // ⚠️ juntar por parecido seria a classe do "o memo diz Transferência": sugere, nunca funde
    expect(r.every((x) => x.apelidos.length === 1)).toBe(true)
  })

  it('⛔ IGNORADO fica linha a linha: ignorar é decisão por NOME', () => {
    const r = agruparPorDestino([
      l({ nomeSuitable: 'GRANDE', ocorrencias: 149, destino: 'IGNORAR' }),
      l({ nomeSuitable: 'PEQUENO', ocorrencias: 32, destino: 'IGNORAR' }),
    ])
    expect(r).toHaveLength(2)
  })

  it('⭐ o grupo do agrupado é SABOR se QUALQUER apelido for sabor do cardápio', () => {
    const r = agruparPorDestino([
      l({ nomeSuitable: 'CALABRESA', ocorrencias: 1220, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'sabor calabresa', grupo: 'SABOR' }),
      l({ nomeSuitable: 'CALABRESA PROMO', ocorrencias: 10, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'sabor calabresa', grupo: 'OUTRO' }),
    ])
    // ⚠️ senão o agrupamento esconderia da seção de Sabores uma ficha que atende sabor
    expect(r[0].grupo).toBe('SABOR')
    expect(secoesDaPrateleira(r)[0].linhas).toHaveLength(1)
  })

  it('⚠️ o aviso "também é produto" sobrevive ao agrupamento', () => {
    const r = agruparPorDestino([
      l({ nomeSuitable: 'COCA COLA 2L', ocorrencias: 134, destino: 'FICHA', fichaId: 'f9', tambemProduto: true, destinoComoProduto: 'REVENDA' }),
      l({ nomeSuitable: 'coca cola 2l', ocorrencias: 2, destino: 'FICHA', fichaId: 'f9' }),
    ])
    expect(r[0].tambemProduto).toBe(true)
    expect(r[0].destinoComoProduto).toBe('REVENDA')
  })

  it('⭐ ordena por ocorrência SOMADA (o trabalho que mais importa primeiro)', () => {
    const r = agruparPorDestino([
      l({ nomeSuitable: 'A', ocorrencias: 10, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'ficha A' }),
      l({ nomeSuitable: 'B', ocorrencias: 9, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'ficha A' }),
      l({ nomeSuitable: 'C', ocorrencias: 15 }),
    ])
    expect(r.map((x) => x.titulo)).toEqual(['ficha A', 'C']) // 19 > 15
  })
})

describe('⭐ os cards contam coerente com a lista', () => {
  const linhas = [
    l({ nomeSuitable: 'FRANGO COM BACON', ocorrencias: 14, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'X' }),
    l({ nomeSuitable: 'frango com bacon', ocorrencias: 1, destino: 'FICHA', fichaId: 'f1', nomeFicha: 'X' }),
    l({ nomeSuitable: 'MUSSARELA', ocorrencias: 19 }),
    l({ nomeSuitable: 'GRANDE', ocorrencias: 149, destino: 'IGNORAR' }),
  ]

  it('⭐⭐ "com ficha" conta FICHAS (1), pendentes conta NOMES (1)', () => {
    const t = cardsDaPrateleira(linhas)
    expect(t.comFicha, 'contou nome em vez de ficha — o card discordaria da lista').toBe(1)
    expect(t.pendentes).toBe(1)
    expect(t.ignorados).toBe(1)
    // e o card bate com o tamanho da lista agrupada, que é o que o dono vê
    expect(agruparPorDestino(linhas)).toHaveLength(3)
  })

  it('⭐ o % coberto é por OCORRÊNCIA e não muda com o agrupamento', () => {
    expect(cardsDaPrateleira(linhas).ocorrenciasCobertas).toBe(15)
    expect(cardsDaPrateleira(linhas).ocorrenciasTotal).toBe(183)
  })
})

describe('⭐⭐ o ciclo real: mapear junta, desmapear separa', () => {
  const CNPJ = '11223344000155'
  let companyId = ''
  let fichaId = ''

  beforeEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
    companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'AGRUPA' } })).id
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'FRANGO CRU', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    fichaId = (await criarFicha({
      companyId, nomeProduzido: 'sabor frango c/ bacon', unidadeProduzido: 'UN',
      tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: item.id, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }],
    }, prisma)).fichaId
  })

  afterEach(async () => {
    for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoGrupo', 'stockFichaComponente',
      'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
      // @ts-expect-error dinâmico
      await prisma[t].deleteMany({ where: { companyId } })
    }
    await prisma.company.deleteMany({ where: { id: companyId } })
  })

  const entradas = [
    { nomeSuitable: 'FRANGO COM BACON', ocorrencias: 7 },
    { nomeSuitable: 'frango com bacon', ocorrencias: 4 },
  ]

  it('⭐⭐ os dois na mesma ficha → UMA linha com 11', async () => {
    for (const e of entradas) await upsertComplementoMap(companyId, e.nomeSuitable, { tipo: 'FICHA', fichaId }, undefined, prisma)
    const agrupado = agruparPorDestino(await prateleiraDeComplementos(companyId, entradas, prisma))
    expect(agrupado).toHaveLength(1)
    expect(agrupado[0].ocorrencias).toBe(11)
    expect(agrupado[0].titulo).toBe('sabor frango c/ bacon')
  })

  it('⭐⭐ desmapear UM deles → ele volta como linha própria pendente', async () => {
    for (const e of entradas) await upsertComplementoMap(companyId, e.nomeSuitable, { tipo: 'FICHA', fichaId }, undefined, prisma)
    await limparComplementoMap(companyId, 'frango com bacon', prisma)

    const agrupado = agruparPorDestino(await prateleiraDeComplementos(companyId, entradas, prisma))
    expect(agrupado).toHaveLength(2)
    const pendente = agrupado.find((x) => x.destino === 'SEM_FICHA')!
    expect(pendente.titulo).toBe('frango com bacon')
    expect(pendente.ocorrencias).toBe(4)
    // ⭐ e o que sobrou na ficha continua certo, sem o que saiu
    const naFicha = agrupado.find((x) => x.destino === 'FICHA')!
    expect(naFicha.ocorrencias).toBe(7)
    expect(naFicha.apelidos).toHaveLength(1)
  })

  it('⛔⛔ e o DADO nunca foi fundido: os dois nomes crus seguem gravados', async () => {
    for (const e of entradas) await upsertComplementoMap(companyId, e.nomeSuitable, { tipo: 'FICHA', fichaId }, undefined, prisma)
    const maps = await prisma.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } })
    // ⚠️ é isto que faz o relatório de AMANHÃ continuar casando com as duas grafias
    expect(maps.map((m) => m.nomeSuitable).sort()).toEqual(['FRANGO COM BACON', 'frango com bacon'])
  })
})
