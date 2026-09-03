// ⭐⭐ SUGESTÃO DE GRUPO DE GRAFIA — sugere, o dono confirma (03/09/2026).
//
// Sem isto, limpar a prateleira exigiria mapear **grafia por grafia**: 31 grupos no relatório
// real, 31 viagens ao editor pra dizer 31 vezes a mesma coisa.
//
// ⛔ E a linha vermelha do módulo continua: **heurística nunca funde sozinha.** Dois sabores
// diferentes na mesma ficha baixam o insumo errado, em silêncio.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { sugerirGruposDeGrafia, difereSoEmDigito, distancia, comecaIgual } from '../sugerir-grupos'
import { criarFicha } from '../../producao/fichas'
import { prateleiraDeComplementos, upsertComplementoMap } from '../complemento-map'
import { agruparPorDestino } from '../painel-complementos'

const n = (nomeSuitable: string, ocorrencias: number) => ({ nomeSuitable, ocorrencias })

describe('⭐⭐ o grupo AUTOMÁTICO é só o que não exige julgamento', () => {
  it('⭐⭐ caixa e acento: as 3 grafias viram UM grupo', () => {
    const g = sugerirGruposDeGrafia([
      n('STROGONOFF DE CARNE', 115), n('Strogonoff de Carne', 1), n('strogonoff de carne', 1),
    ])
    expect(g).toHaveLength(1)
    expect(g[0].nomes.map((x) => x.nomeSuitable)).toEqual(['STROGONOFF DE CARNE', 'Strogonoff de Carne', 'strogonoff de carne'])
    expect(g[0].ocorrencias).toBe(117)
    expect(g[0].titulo).toBe('STROGONOFF DE CARNE') // o de maior volume é o rótulo
  })

  it('⭐ espaço repetido também é a mesma grafia', () => {
    const g = sugerirGruposDeGrafia([n('FRANGO  COM   BACON', 2), n('FRANGO COM BACON', 14)])
    expect(g[0].nomes).toHaveLength(2)
    expect(g[0].ocorrencias).toBe(16)
  })
})

describe('⛔⛔ o que NÃO entra sozinho', () => {
  it('⛔⛔ o TYPO fica de fora, como "parecida" — CARNEE × CARNE', () => {
    const g = sugerirGruposDeGrafia([
      n('STROGONOFF DE CARNE', 115), n('strogonoff de carne', 1), n('STROGONOFF DE CARNEE', 1),
    ])
    const grupo = g.find((x) => x.titulo === 'STROGONOFF DE CARNE')!
    expect(grupo.nomes.map((x) => x.nomeSuitable)).not.toContain('STROGONOFF DE CARNEE')
    expect(grupo.parecidas.map((p) => p.nomeSuitable)).toContain('STROGONOFF DE CARNEE')
    expect(grupo.parecidas[0].motivo).toBe('quase igual')
  })

  it('⛔ a PROMOÇÃO fica de fora — CALABRESA BLACK FRIDAY', () => {
    const g = sugerirGruposDeGrafia([n('CALABRESA', 1220), n('CALABRESA BLACK FRIDAY', 194)])
    const grupo = g.find((x) => x.titulo === 'CALABRESA')!
    expect(grupo.nomes).toHaveLength(1)
    expect(grupo.parecidas.map((p) => p.nomeSuitable)).toEqual(['CALABRESA BLACK FRIDAY'])
    expect(grupo.parecidas[0].motivo).toBe('começa igual')
  })

  it('⛔⛔ DIFERENÇA EM DÍGITO nem como parecida — 4 QUEIJOS × 5 QUEIJOS', () => {
    // ⚠️ distância 1, e são sabores DIFERENTES. Sugerir isso seria alarme falso no 1º uso.
    expect(distancia('4 QUEIJOS', '5 QUEIJOS')).toBe(1)
    expect(difereSoEmDigito('4 QUEIJOS', '5 QUEIJOS')).toBe(true)
    const g = sugerirGruposDeGrafia([n('4 QUEIJOS', 243), n('5 QUEIJOS', 166)])
    expect(g).toHaveLength(2)
    expect(g.every((x) => x.parecidas.length === 0), '4 e 5 QUEIJOS viraram sugestão').toBe(true)
  })

  it('⛔ e tamanho também não: PIZZA PEQUENA 25CM × 45CM', () => {
    const g = sugerirGruposDeGrafia([n('PIZZA PEQUENA 25CM', 20), n('PIZZA PEQUENA 45CM', 18)])
    expect(g.every((x) => x.parecidas.length === 0)).toBe(true)
  })

  it('⛔⛔ SUFIXO não é parentesco — "frango com bacon" NÃO é grafia de "bacon"', () => {
    // ⚠️ medido nos 183 pendentes reais: a régua com sufixo trazia `frango com bacon` e
    // `XIS - BACON` como parecidas de `bacon`. Nome de complemento se COMPÕE.
    const g = sugerirGruposDeGrafia([n('BACON', 328), n('FRANGO COM BACON', 14), n('XIS - BACON', 21)])
    expect(g.find((x) => x.titulo === 'BACON')!.parecidas).toEqual([])
  })

  it('⛔⛔ "X COM Y" é outro produto — BORDA MUSSARELA não puxa 8 candidatas', () => {
    const g = sugerirGruposDeGrafia([
      n('BORDA MUSSARELA', 5), n('BORDA MUSSARELA COM ALHO', 3), n('BORDA MUSSARELA COM CATUPIRY', 2),
      n('BORDA MUSSARELA FAMILIA', 1), n('BORDA MUSSARELA GRANDE', 1),
    ])
    expect(g.find((x) => x.titulo === 'BORDA MUSSARELA')!.parecidas).toEqual([])
  })

  it('⭐ mas o sufixo de PROMOÇÃO continua sendo oferecido (o caso do dono)', () => {
    expect(comecaIgual('CALABRESA', 'CALABRESA BLACK FRIDAY')).toBe(true)
    expect(comecaIgual('BORDA MUSSARELA', 'BORDA MUSSARELA COM ALHO')).toBe(false)
    expect(comecaIgual('BORDA MUSSARELA', 'BORDA MUSSARELA FAMILIA')).toBe(false)
    expect(comecaIgual('BACON', 'FRANGO COM BACON')).toBe(false)
  })

  it('⚠️ a candidata aparece UMA vez só, no grupo de maior volume', () => {
    const g = sugerirGruposDeGrafia([n('STROGONOFF DE CARNE', 115), n('STROGONOFF DE CARNEE', 1)])
    const total = g.reduce((s, x) => s + x.parecidas.length, 0)
    expect(total, 'a mesma dupla apareceu dos dois lados').toBe(1)
  })
})

describe('⛔⛔ 3+ grafias e a FICHA QUE JÁ EXISTE (o beco de 03/09)', () => {
  it('⭐⭐ 3 grafias do mesmo nome → UM grupo com as 3', () => {
    const g = sugerirGruposDeGrafia([n('bacon', 2), n('Bacon', 2), n('BACON', 328)])
    expect(g).toHaveLength(1)
    expect(g[0].nomes).toHaveLength(3)
    expect(g[0].ocorrencias).toBe(332)
  })

  it('⭐ e 4 também (não há limite de membros)', () => {
    const g = sugerirGruposDeGrafia([n('bacon', 1), n('Bacon', 1), n('BACON', 1), n('  bacon  ', 1)])
    expect(g[0].nomes).toHaveLength(4)
  })

  it('⛔⛔ com uma IRMÃ já mapeada, o grupo aponta a ficha em vez de mandar criar outra', () => {
    // ⚠️ ERA O BUG REAL: `BACON` já estava numa ficha de uma tentativa anterior; sobravam
    // `bacon` e `Bacon` pendentes. O botão dizia "criar ficha pra todas" e o salvar recusava
    // com "já existe essa ficha" — recusa CERTA, botão errado.
    const g = sugerirGruposDeGrafia(
      [n('bacon', 2), n('Bacon', 2)],
      [{ nomeSuitable: 'BACON', fichaId: 'f-bacon', nomeFicha: 'sabor bacon' }],
    )
    expect(g).toHaveLength(1)
    expect(g[0].fichaIrma).toEqual({ fichaId: 'f-bacon', nomeFicha: 'sabor bacon', viaGrafia: 'BACON' })
    // as pendentes continuam sendo o trabalho; a irmã é CONTEXTO, não membro
    expect(g[0].nomes.map((x) => x.nomeSuitable)).toEqual(['bacon', 'Bacon'])
  })

  it('⭐ sem irmã mapeada, segue sendo "criar ficha"', () => {
    const g = sugerirGruposDeGrafia([n('bacon', 2), n('Bacon', 2)], [])
    expect(g[0].fichaIrma).toBeNull()
  })

  it('⚠️ irmã de OUTRO nome não conta (não é a mesma grafia)', () => {
    const g = sugerirGruposDeGrafia(
      [n('bacon', 2), n('Bacon', 2)],
      [{ nomeSuitable: 'BACON ACEBOLADO', fichaId: 'f-outro', nomeFicha: 'outro' }],
    )
    expect(g[0].fichaIrma).toBeNull()
  })
})

describe('⭐⭐ o ciclo: um grupo → uma ficha → uma linha', () => {
  const CNPJ = '22334455000166'
  let companyId = ''
  let insumo = ''

  beforeEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
    companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'GRUPOS' } })).id
    insumo = (await prisma.stockItem.create({ data: { companyId, nome: 'CARNE', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
  })
  afterEach(async () => {
    for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoGrupo', 'stockFichaComponente',
      'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
      // @ts-expect-error dinâmico
      await prisma[t].deleteMany({ where: { companyId } })
    }
    await prisma.company.deleteMany({ where: { id: companyId } })
  })

  const entradas = [n('STROGONOFF DE CARNE', 115), n('Strogonoff de Carne', 1), n('strogonoff de carne', 1)]

  it('⭐⭐ UM "criar ficha pra todas" mapeia as 3 e a tela mostra UMA linha', async () => {
    const grupo = sugerirGruposDeGrafia(entradas)[0]
    // é exatamente isto que o link do botão manda pro editor (um `complemento=` por grafia)
    const r = await criarFicha({
      companyId, nomeProduzido: 'sabor strogonoff de carne', unidadeProduzido: 'UN',
      tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo, qtdPlanejada: 0.12, unidade: 'KG', posicao: 0 }],
      mapearComplemento: grupo.nomes.map((x) => x.nomeSuitable),
    }, prisma)
    expect(r.vinculadoAoPdv).toBe(true)

    // as 3 gravadas, cada uma com o nome CRU (é o que casa com o relatório de amanhã)
    const maps = await prisma.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, fichaId: true } })
    expect(maps).toHaveLength(3)
    expect(new Set(maps.map((m) => m.fichaId)).size).toBe(1)

    // e a tela: UMA linha, 117
    const agrupado = agruparPorDestino(await prateleiraDeComplementos(companyId, entradas, prisma))
    expect(agrupado).toHaveLength(1)
    expect(agrupado[0].ocorrencias).toBe(117)
    expect(agrupado[0].apelidos).toHaveLength(3)
  })

  it('⭐ com o typo INCLUÍDO por clique, ele entra na mesma ficha', async () => {
    const comTypo = [...entradas, n('STROGONOFF DE CARNEE', 1)]
    const grupo = sugerirGruposDeGrafia(comTypo)[0]
    // o dono clicou "incluir no grupo" → o link leva as 4
    const nomes = [...grupo.nomes.map((x) => x.nomeSuitable), 'STROGONOFF DE CARNEE']
    await criarFicha({
      companyId, nomeProduzido: 'sabor strogonoff de carne', unidadeProduzido: 'UN',
      tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo, qtdPlanejada: 0.12, unidade: 'KG', posicao: 0 }],
      mapearComplemento: nomes,
    }, prisma)
    const agrupado = agruparPorDestino(await prateleiraDeComplementos(companyId, comTypo, prisma))
    expect(agrupado).toHaveLength(1)
    expect(agrupado[0].ocorrencias).toBe(118)
  })

  it('⛔ sem o clique, o typo continua pendente — o sistema não decidiu por ele', async () => {
    const comTypo = [...entradas, n('STROGONOFF DE CARNEE', 1)]
    const grupo = sugerirGruposDeGrafia(comTypo)[0]
    await criarFicha({
      companyId, nomeProduzido: 'sabor strogonoff de carne', unidadeProduzido: 'UN',
      tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo, qtdPlanejada: 0.12, unidade: 'KG', posicao: 0 }],
      mapearComplemento: grupo.nomes.map((x) => x.nomeSuitable),
    }, prisma)
    const agrupado = agruparPorDestino(await prateleiraDeComplementos(companyId, comTypo, prisma))
    expect(agrupado).toHaveLength(2)
    expect(agrupado.find((x) => x.destino === 'SEM_FICHA')!.titulo).toBe('STROGONOFF DE CARNEE')
  })
})

describe('⭐⭐ o fluxo que morria no erro, agora termina', () => {
  const CNPJ = '33445566000177'
  let companyId = ''
  let insumo = ''

  beforeEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
    companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BECO' } })).id
    insumo = (await prisma.stockItem.create({ data: { companyId, nome: 'BACON CRU', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
  })
  afterEach(async () => {
    for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoGrupo', 'stockFichaComponente',
      'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
      // @ts-expect-error dinâmico
      await prisma[t].deleteMany({ where: { companyId } })
    }
    await prisma.company.deleteMany({ where: { id: companyId } })
  })

  const entradas = [n('BACON', 328), n('bacon', 2), n('Bacon', 2)]

  it('⛔⛔ criar a 2ª ficha do mesmo nome continua RECUSADO (a trava está certa)', async () => {
    await criarFicha({
      companyId, nomeProduzido: 'sabor bacon', unidadeProduzido: 'UN', tipoProduto: 'SABOR',
      loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumo, qtdPlanejada: 0.08, unidade: 'KG', posicao: 0 }],
      mapearComplemento: ['BACON'],
    }, prisma)
    await expect(criarFicha({
      companyId, nomeProduzido: 'sabor bacon', unidadeProduzido: 'UN', tipoProduto: 'SABOR',
      loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumo, qtdPlanejada: 0.08, unidade: 'KG', posicao: 0 }],
      mapearComplemento: ['bacon', 'Bacon'],
    }, prisma)).rejects.toThrow()
  })

  it('⭐⭐ e o caminho novo TERMINA o trabalho: as 3 grafias na MESMA ficha', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: 'sabor bacon', unidadeProduzido: 'UN', tipoProduto: 'SABOR',
      loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumo, qtdPlanejada: 0.08, unidade: 'KG', posicao: 0 }],
      mapearComplemento: ['BACON'],
    }, prisma)

    // a tela vê a irmã e oferece mapear nela
    const prateleira = await prateleiraDeComplementos(companyId, entradas, prisma)
    const pendentes = prateleira.filter((l) => l.destino === 'SEM_FICHA').map((l) => ({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias }))
    const mapeadas = prateleira.filter((l) => l.destino === 'FICHA' && l.fichaId)
      .map((l) => ({ nomeSuitable: l.nomeSuitable, fichaId: l.fichaId!, nomeFicha: l.nomeFicha ?? l.nomeSuitable }))
    const grupo = sugerirGruposDeGrafia(pendentes, mapeadas)[0]
    expect(grupo.fichaIrma?.fichaId).toBe(r.fichaId)

    // o clique: mapeia as pendentes na ficha existente
    for (const x of grupo.nomes) await upsertComplementoMap(companyId, x.nomeSuitable, { tipo: 'FICHA', fichaId: grupo.fichaIrma!.fichaId }, undefined, prisma)

    const agrupado = agruparPorDestino(await prateleiraDeComplementos(companyId, entradas, prisma))
    expect(agrupado).toHaveLength(1)
    expect(agrupado[0].ocorrencias).toBe(332)
    expect(agrupado[0].apelidos).toHaveLength(3)
    expect(await prisma.stockFicha.count({ where: { companyId } }), 'criou ficha duplicada').toBe(1)
  })
})

describe('⛔⛔ o TYPO ÓRFÃO — a duplicata voltando pela porta do erro de digitação', () => {
  // CASO REAL (03/09): o grupo do STROGONOFF DE CARNE ficou todo mapeado, e o
  // `STROGONOFF DE CARNEE` sobrou SOZINHO. Sem grupo pra entrar, a única ação na linha era
  // "criar ficha" — e criar pelo typo faz uma **SEGUNDA ficha de strogonoff**, porque o nome
  // difere e o guard de duplicata (que compara NOME) não barra.

  it('⛔⛔ a grafia órfã enxerga a ficha da parecida JÁ MAPEADA', () => {
    const g = sugerirGruposDeGrafia(
      [n('STROGONOFF DE CARNEE', 1)],
      [{ nomeSuitable: 'STROGONOFF DE CARNE', fichaId: 'f-strog', nomeFicha: 'sabor strogonoff de carne' }],
    )
    expect(g).toHaveLength(1)
    expect(g[0].fichaIrma, 'não é a MESMA grafia — é parecida').toBeNull()
    expect(g[0].parecidasComFicha).toHaveLength(1)
    expect(g[0].parecidasComFicha[0]).toMatchObject({
      nomeSuitable: 'STROGONOFF DE CARNE', fichaId: 'f-strog', nomeFicha: 'sabor strogonoff de carne', motivo: 'quase igual',
    })
  })

  it('⭐ e a promoção também: CALABRESA BLACK FRIDAY acha a ficha da CALABRESA', () => {
    const g = sugerirGruposDeGrafia(
      [n('CALABRESA BLACK FRIDAY', 194)],
      [{ nomeSuitable: 'CALABRESA', fichaId: 'f-cal', nomeFicha: 'sabor calabresa' }],
    )
    expect(g[0].parecidasComFicha[0]).toMatchObject({ fichaId: 'f-cal', motivo: 'começa igual' })
  })

  it('⛔⛔ mas as travas continuam: dígito e "X COM Y" não viram sugestão', () => {
    expect(sugerirGruposDeGrafia([n('5 QUEIJOS', 166)],
      [{ nomeSuitable: '4 QUEIJOS', fichaId: 'f4', nomeFicha: 'sabor 4 queijos' }])[0].parecidasComFicha).toEqual([])
    expect(sugerirGruposDeGrafia([n('BORDA MUSSARELA COM ALHO', 3)],
      [{ nomeSuitable: 'BORDA MUSSARELA', fichaId: 'fb', nomeFicha: 'borda mussarela' }])[0].parecidasComFicha).toEqual([])
  })

  it('⛔ e nada é decidido sozinho: sem o clique, a grafia continua pendente', async () => {
    const g = sugerirGruposDeGrafia([n('STROGONOFF DE CARNEE', 1)],
      [{ nomeSuitable: 'STROGONOFF DE CARNE', fichaId: 'f-strog', nomeFicha: 'x' }])
    // a sugestão NÃO entra na lista de membros — quem mapeia é o dono
    expect(g[0].nomes.map((x) => x.nomeSuitable)).toEqual(['STROGONOFF DE CARNEE'])
  })
})
