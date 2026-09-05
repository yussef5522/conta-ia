// ⭐⭐ O SELETOR DE FORNECEDOR ESCONDIA 63 DOS 85 (04/09/2026).
//
// ⛔ MEDIDO EM PROD ANTES DE MEXER: `stock_supplier` = 27 · `Supplier` (financeiro) = 85.
// O seletor da nota manual lia só a tabela do estoque — que **só enche quando uma nota é
// CONFERIDA** — então o dono foi cadastrar a RM2, não achou (ela nunca passou por conferência),
// e **criou uma segunda**. A duplicata é sintoma; a causa é a tela esconder o que existe.
//
// ⚠️ A BUSCA ERA O SEGUNDO PROBLEMA. Consertar só a busca (régua de 31/08) deixaria o bug
// vivo com cara de resolvido: nenhuma busca acha o que não está na lista.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  ehMesmoFornecedor, listarFornecedoresUnificados, garantirFornecedorDoEstoque,
} from '../fornecedores-unificados'
import { filtrarPorBusca } from '@/lib/busca-texto'

const CNPJ = '55667788000133'
let companyId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'FORN' } })).id
})

afterEach(async () => {
  await prisma.stockSupplier.deleteMany({ where: { companyId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ os guards da unificação — do dono, palavra por palavra', () => {
  it('⭐ CNPJ igual → é o mesmo, sem discussão', () => {
    expect(ehMesmoFornecedor(
      { razaoSocial: 'rm2', cnpj: '11222333000144' },
      { razaoSocial: 'RM2 COMERCIO DE MATERIAIS LTDA', cnpj: '11.222.333/0001-44' },
    )).toBe(true)
  })

  it('⛔⛔ os DOIS com CNPJ DIFERENTE → NUNCA une, nem com o nome idêntico', () => {
    // matriz e filial têm o mesmo nome e CNPJs diferentes; fundir mandaria a dívida
    // pro CNPJ errado, e ninguém perceberia.
    expect(ehMesmoFornecedor(
      { razaoSocial: 'CEREALISTA GIRUA LTDA', cnpj: '11222333000144' },
      { razaoSocial: 'CEREALISTA GIRUA LTDA', cnpj: '11222333000225' },
    )).toBe(false)
  })

  it('⭐ nenhum dos dois com CNPJ → une só se o normalizado for IGUAL', () => {
    expect(ehMesmoFornecedor({ razaoSocial: 'rm2', cnpj: null }, { razaoSocial: 'RM2', cnpj: null })).toBe(true)
    expect(ehMesmoFornecedor({ razaoSocial: 'RM2 COMERCIO', cnpj: null }, { razaoSocial: 'RM2', cnpj: null })).toBe(false)
  })

  it('⛔ um tem CNPJ e o outro não → não une (não há como provar)', () => {
    expect(ehMesmoFornecedor(
      { razaoSocial: 'FRIGORIFICO SILVA', cnpj: '11222333000144' },
      { razaoSocial: 'FRIGORIFICO SILVA', cnpj: null },
    )).toBe(false)
  })
})

describe('⭐⭐ a lista que o seletor mostra', () => {
  it('⭐⭐ quem só existe no FINANCEIRO aparece — era o bug da RM2', async () => {
    await prisma.stockSupplier.create({ data: { companyId, razaoSocial: 'FRIGORIFICO SILVA', cnpj: '11222333000144', criadoVia: 'CONFERENCIA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'FGTS' } })

    const lista = await listarFornecedoresUnificados(companyId, prisma)
    const nomes = lista.map((f) => f.razaoSocial)
    expect(nomes, 'o seletor continua cego pro financeiro').toContain('RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA')
    expect(nomes).toContain('FGTS')
    expect(lista).toHaveLength(3)

    // ⭐ e a origem vai marcada: o dono vê de onde cada um veio
    expect(lista.find((f) => f.razaoSocial === 'FGTS')?.origem).toBe('FINANCEIRO')
    expect(lista.find((f) => f.razaoSocial === 'FRIGORIFICO SILVA')?.origem).toBe('ESTOQUE')
  })

  it('⭐ o mesmo CNPJ nos dois lados vira UMA linha, marcada AMBOS', async () => {
    await prisma.stockSupplier.create({ data: { companyId, razaoSocial: 'rm2', cnpj: '11222333000144', criadoVia: 'CONFERENCIA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2 COMERCIO DE MATERIAIS LTDA', cnpj: '11222333000144' } })

    const lista = await listarFornecedoresUnificados(companyId, prisma)
    expect(lista).toHaveLength(1)
    expect(lista[0].origem).toBe('AMBOS')
    // o nome mais completo (o do cadastro à mão) é o que o dono reconhece
    expect(lista[0].razaoSocial).toBe('RM2 COMERCIO DE MATERIAIS LTDA')
    expect(lista[0].stockId).toBeTruthy()
    expect(lista[0].financeiroId).toBeTruthy()
  })

  it('⛔ dois CNPJs diferentes com o mesmo nome ficam como DUAS linhas, cada uma com a origem', async () => {
    await prisma.stockSupplier.create({ data: { companyId, razaoSocial: 'CEREALISTA GIRUA', cnpj: '11222333000144', criadoVia: 'CONFERENCIA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'CEREALISTA GIRUA', cnpj: '11222333000225' } })

    const lista = await listarFornecedoresUnificados(companyId, prisma)
    // ⚠️ duplicata VISÍVEL é melhor que fusão errada — a decisão é do dono, com os dois à vista
    expect(lista).toHaveLength(2)
    expect(lista.map((f) => f.origem).sort()).toEqual(['ESTOQUE', 'FINANCEIRO'])
  })
})

describe('⭐ a busca com a régua de 31/08 — pedaço, sem acento, sem caixa', () => {
  it('⭐⭐ "r" traz todos os que têm R em QUALQUER posição', async () => {
    await prisma.stockSupplier.create({ data: { companyId, razaoSocial: 'FRIGORIFICO SILVA', criadoVia: 'CONFERENCIA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2 COMERCIO DE MATERIAIS LTDA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'FGTS' } })

    const lista = await listarFornecedoresUnificados(companyId, prisma)
    const comR = filtrarPorBusca(lista, 'r', (f) => f.razaoSocial).map((f) => f.razaoSocial)
    // FRIGORIFICO tem R no meio — `<select>` nativo casava só por PREFIXO
    expect(comR).toContain('FRIGORIFICO SILVA')
    expect(comR).toContain('RM2 COMERCIO DE MATERIAIS LTDA')
    expect(comR).not.toContain('FGTS')
  })

  it('⭐⭐ RM2 e FGTS são encontráveis — os dois casos que o dono citou', async () => {
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'FGTS' } })
    const lista = await listarFornecedoresUnificados(companyId, prisma)
    const acha = (t: string) => filtrarPorBusca(lista, t, (f) => f.razaoSocial).map((f) => f.razaoSocial)

    expect(acha('rm2')).toHaveLength(1)   // minúsculo acha o maiúsculo
    expect(acha('RM2')).toHaveLength(1)
    expect(acha('fgts')).toEqual(['FGTS'])
    expect(acha('informatica')).toHaveLength(1) // pedaço do meio
    expect(acha('informática')).toHaveLength(1) // com acento acha o sem
  })
})

describe('⭐⭐ o `stock_supplier` nasce no GESTO da escolha', () => {
  it('⭐ escolher um do financeiro cria o do estoque — e NÃO escreve no financeiro', async () => {
    const fin = await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2 COMERCIO LTDA', cnpj: '11222333000144' } })
    const antes = await prisma.supplier.count({ where: { companyId } })

    const stockId = await garantirFornecedorDoEstoque(companyId, { stockId: null, financeiroId: fin.id }, prisma)
    const novo = await prisma.stockSupplier.findUniqueOrThrow({ where: { id: stockId } })
    expect(novo.razaoSocial).toBe('RM2 COMERCIO LTDA')
    expect(novo.cnpj).toBe('11222333000144')
    // ⛔ a fronteira: o financeiro não ganhou nem perdeu linha
    expect(await prisma.supplier.count({ where: { companyId } })).toBe(antes)
  })

  it('⭐ é IDEMPOTENTE: escolher duas vezes não cria duas', async () => {
    const fin = await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2', cnpj: '11222333000144' } })
    const a = await garantirFornecedorDoEstoque(companyId, { stockId: null, financeiroId: fin.id }, prisma)
    const b = await garantirFornecedorDoEstoque(companyId, { stockId: null, financeiroId: fin.id }, prisma)
    expect(b).toBe(a)
    expect(await prisma.stockSupplier.count({ where: { companyId } })).toBe(1)
  })

  it('⛔ fornecedor de OUTRA empresa é recusado (REGRA 8)', async () => {
    const outra = await prisma.company.create({ data: { cnpj: '55667788000214', name: 'OUTRA' } })
    const fin = await prisma.supplier.create({ data: { companyId: outra.id, razaoSocial: 'ALHEIA' } })
    await expect(garantirFornecedorDoEstoque(companyId, { stockId: null, financeiroId: fin.id }, prisma))
      .rejects.toThrow(/não encontrado/i)
    await prisma.supplier.deleteMany({ where: { companyId: outra.id } })
    await prisma.company.deleteMany({ where: { id: outra.id } })
  })
})

describe('⛔⛔ dois cadastros do FINANCEIRO não se fundem entre si', () => {
  it('⛔⛔ o achado do número de prod: 33 linhas com id de estoque contra 28 que existem', async () => {
    // ⚠️ sem o filtro `x.stockId`, o 1º registro do financeiro virava alvo do 2º: um sumia
    // da lista e o outro dizia "AMBOS" — mentindo sobre existir no estoque.
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'rm2' } })
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'RM2' } })

    const lista = await listarFornecedoresUnificados(companyId, prisma)
    expect(lista, 'um dos dois sumiu da lista').toHaveLength(2)
    expect(lista.map((f) => f.origem)).toEqual(['FINANCEIRO', 'FINANCEIRO'])
    expect(lista.every((f) => f.stockId === null), 'disse AMBOS sem existir no estoque').toBe(true)
    // e cada linha guarda o SEU id — senão escolher uma escreveria na outra
    expect(new Set(lista.map((f) => f.financeiroId)).size).toBe(2)
  })
})
