/**
 * ⭐⭐⭐ A ESTRELA DO DONO — contra banco (12/10/2026).
 *
 * **O vermelho CRÍTICO que o dono pediu:** *"marcar/desmarcar NÃO cria linha nova de versão de
 * ficha e NÃO muda o custo do lote (conta versões e custo antes/depois — iguais = verde;
 * diferente = vermelho)"*.
 *
 * ⚠️ Ele é o teste mais importante do sprint porque a estrela encosta na RECEITA — e receita é
 * lei: uma versão a mais faria a ordem antiga apontar pra um snapshot que ninguém mudou, e um
 * custo a mais envenenaria o cardápio e o CMV. A conta é feita pelo MESMO `listFichas` que a
 * tela carrega, nunca por uma leitura própria (senão o teste aprovaria um custo que a tela não
 * mostra — a lição do "guard que testa a lib e aprova a tela que a ignora").
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, listFichas } from '../fichas'
import { criarMovimento } from '@/lib/stock/movement'
import { marcarReceitaPrincipal, principaisDaEmpresa, ReceitaPrincipalError } from '../receita-principal'
import { montarListaDeReceitas } from '../lista-de-receitas'

const CNPJ = '81818181000181'
let companyId: string

async function insumo(nome: string, custo: number) {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  /**
   * ⭐ o custo médio é DERIVADO dos movimentos (a mesma fonte da Posição) — sem a entrada, a
   * ficha sairia "a definir" e o teste do custo não teria número pra comparar.
   * ⚠️ Pela porta da casa (`criarMovimento`), nunca por `create` cru: ela valida o ledger
   * (`|custoTotal − qtd×unit| ≤ 0,01`) e é o que o resto do módulo usa.
   */
  await criarMovimento(prisma, {
    companyId, itemId: i.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: custo,
    origem: 'MANUAL', dataMovimento: new Date('2026-10-01T12:00:00Z'),
  })
  return i.id
}

/** uma receita de produção coerente (produto em UN, dose em KG por unidade) */
async function receita(nome: string, dose = 0.1) {
  const i = await insumo(`insumo de ${nome}`, 30)
  const f = await criarFicha({
    companyId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId: i, qtdPlanejada: dose, unidade: 'KG', posicao: 0 }],
  }, prisma)
  return f.fichaId
}

const foto = async () => {
  const fichas = await listFichas(companyId, prisma)
  const versoes = await prisma.stockFichaVersao.count({ where: { companyId } })
  const componentes = await prisma.stockFichaComponente.count({ where: { companyId } })
  return {
    versoes,
    componentes,
    custos: fichas.map((f) => ({ id: f.id, custoLote: f.custoLote, versaoAtual: f.versaoAtual })).sort((a, b) => a.id.localeCompare(b.id)),
  }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'ESTRELA DO DONO' } })
  companyId = c.id
})
afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.stockReceitaPrincipal.deleteMany({ where: { companyId } })
})

describe('⛔⛔⛔ ESTRELA É ROUPA — a receita NÃO se mexe (o vermelho crítico)', () => {
  it('⭐⭐ marcar e desmarcar NÃO cria versão e NÃO muda o custo do lote', async () => {
    const a = await receita('beef de xis')
    await receita('porcao bacon 80 grama')

    const antes = await foto()
    expect(antes.versoes).toBe(2)
    expect(antes.custos.every((c) => c.custoLote != null)).toBe(true)

    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: true }, prisma)
    const marcado = await foto()
    expect(marcado.versoes, 'marcar criou versão nova — estrela virou receita').toBe(antes.versoes)
    expect(marcado.componentes, 'marcar mexeu nos componentes').toBe(antes.componentes)
    expect(marcado.custos, 'marcar mudou o custo do lote').toEqual(antes.custos)

    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: false }, prisma)
    const desmarcado = await foto()
    expect(desmarcado.versoes).toBe(antes.versoes)
    expect(desmarcado.componentes).toBe(antes.componentes)
    expect(desmarcado.custos).toEqual(antes.custos)
  })

  it('⭐ a marca mora na IDENTIDADE: 10 idas e voltas = 1 linha, e a versão segue 1', async () => {
    const a = await receita('porçao queijo 135 grama')
    for (let i = 0; i < 10; i++) {
      await marcarReceitaPrincipal({ companyId, fichaId: a, principal: i % 2 === 0 }, prisma)
    }
    expect(await prisma.stockReceitaPrincipal.count({ where: { companyId } })).toBe(1)
    expect(await prisma.stockFichaVersao.count({ where: { companyId, fichaId: a } })).toBe(1)
  })
})

describe('⭐ A PORTA — o que ela grava, e o que ela recusa', () => {
  it('⭐ receita nunca marcada nasce false — NUNCA null/undefined', async () => {
    await receita('nunca marcada')
    const [f] = await listFichas(companyId, prisma)
    expect(f.principal).toBe(false)
    expect(f.principal).not.toBeNull()
    // e o banco está VAZIO: "ausência = não é principal", por construção
    expect(await prisma.stockReceitaPrincipal.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ marcar → o payload da tela vem com `principal: true`', async () => {
    const a = await receita('beef de hamburger')
    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: true }, prisma)
    const fichas = await listFichas(companyId, prisma)
    expect(fichas.find((f) => f.id === a)!.principal).toBe(true)
  })

  it('⭐⭐ a leitura NÃO confunde "tem linha" com "é principal" (o defeito do `?? CAIXA`)', async () => {
    const a = await receita('desmarcada mas com rastro')
    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: true }, prisma)
    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: false }, prisma)

    // a LINHA continua (é o rastro de quem tirou), mas ela NÃO é principal
    expect(await prisma.stockReceitaPrincipal.count({ where: { companyId } })).toBe(1)
    expect([...(await principaisDaEmpresa(companyId, prisma))]).toEqual([])
    const [f] = await listFichas(companyId, prisma)
    expect(f.principal).toBe(false)
  })

  it('⭐ o rastro diz QUEM mexeu por último — inclusive no desmarcar', async () => {
    const a = await receita('com rastro')
    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: true, userId: 'u-dono' }, prisma)
    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: false, userId: 'u-gerente' }, prisma)
    const l = await prisma.stockReceitaPrincipal.findFirst({ where: { companyId, fichaId: a } })
    expect(l!.marcadoPorId).toBe('u-gerente')
    expect(l!.principal).toBe(false)
  })

  it('⛔⛔ REGRA 8 — ficha de OUTRA empresa é RECUSADA (sem o companyId no where, marcaria a do vizinho)', async () => {
    const outra = await prisma.company.create({ data: { cnpj: '82828282000182', name: 'VIZINHA' } })
    try {
      const item = await prisma.stockItem.create({
        data: { companyId: outra.id, nome: 'x', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
      })
      const f = await criarFicha({
        companyId: outra.id, nomeProduzido: 'receita da vizinha', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
        loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: item.id, qtdPlanejada: 1, unidade: 'KG' }],
      }, prisma)

      await expect(marcarReceitaPrincipal({ companyId, fichaId: f.fichaId, principal: true }, prisma))
        .rejects.toThrow(ReceitaPrincipalError)
      expect(await prisma.stockReceitaPrincipal.count({})).toBe(0)
    } finally {
      await prisma.stockReceitaPrincipal.deleteMany({ where: { companyId: outra.id } })
      await prisma.company.delete({ where: { id: outra.id } })
    }
  })

  it('⛔ id que não existe → recusa que ENSINA, e nada gravado', async () => {
    await expect(marcarReceitaPrincipal({ companyId, fichaId: 'nao-existe', principal: true }, prisma))
      .rejects.toThrow('Receita não encontrada.')
    expect(await prisma.stockReceitaPrincipal.count({ where: { companyId } })).toBe(0)
  })
})

describe('⭐ O CICLO DA TELA — estrela liga, a receita sobe de bloco e o chip conta +1', () => {
  it('⭐⭐ ponta a ponta pelo MESMO caminho que a tela usa (listFichas → régua)', async () => {
    await receita('Água com gás')
    const bacon = await receita('porcao bacon 80 grama')
    await receita('Zucchini grelhado')

    const antes = montarListaDeReceitas({ receitas: await listFichas(companyId, prisma) })
    expect(antes.contadores.principais).toBe(0)
    expect(antes.blocos[0].convite).toContain('toque na estrela')
    // ⭐ e a ordem alfabética pt-BR já vale no bloco de baixo
    expect(antes.blocos[1].receitas.map((f) => f.nomeProduzido))
      .toEqual(['Água com gás', 'porcao bacon 80 grama', 'Zucchini grelhado'])

    await marcarReceitaPrincipal({ companyId, fichaId: bacon, principal: true }, prisma)
    const depois = montarListaDeReceitas({ receitas: await listFichas(companyId, prisma) })
    expect(depois.contadores.principais).toBe(1)
    expect(depois.blocos[0].receitas.map((f) => f.nomeProduzido)).toEqual(['porcao bacon 80 grama'])
    expect(depois.blocos[0].convite).toBeNull()

    await marcarReceitaPrincipal({ companyId, fichaId: bacon, principal: false }, prisma)
    const voltou = montarListaDeReceitas({ receitas: await listFichas(companyId, prisma) })
    expect(voltou.contadores.principais).toBe(0)
    expect(voltou.blocos[0].receitas).toHaveLength(0)
  })

  it('⭐ a marca é DA CASA: a leitura não filtra por usuário', async () => {
    const a = await receita('da casa')
    await marcarReceitaPrincipal({ companyId, fichaId: a, principal: true, userId: 'u-gerente' }, prisma)
    // o DONO (outro usuário) lê a mesma lista — nada de `userId` no where
    expect([...(await principaisDaEmpresa(companyId, prisma))]).toEqual([a])
  })
})
