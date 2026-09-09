// ⛔⛔ SUMIR COM O ITEM — a régua é do DINHEIRO, e ela já existia (09/09/2026).
//
// **O dono:** *"Cadastrei errado, quero SUMIR com o item."*
//
// ⭐ **MEDIDO ANTES DE CODAR: o servidor já tinha a régua inteira** (`situacaoDoItem`,
// `excluirItem`, `arquivarItem`, desde 29-30/08) — sem movimento apaga de verdade, com
// movimento recusa oferecendo mesclar/arquivar, e a checagem é server-side. **O que faltava
// era a TELA oferecer o gesto**: o menu do Catálogo tinha "Desativar", nunca "sumir".
//
// ⚠️ Este arquivo trava o COMPORTAMENTO da régua (o que a tela obedece), não a tela.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { situacaoDoItem, excluirItem, arquivarItem, ArquivarError } from '../arquivar'

const CNPJ = '55901224000222'
let companyId = ''
let userId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SUMIR' } })).id
  userId = 'u'
})
afterEach(async () => {
  for (const t of ['stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const novoItem = (nome: string, categoria = 'MATERIA_PRIMA') =>
  prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'KG', categoria, criadoVia: 'MANUAL' } })

describe('⭐ a régua do dinheiro decide entre apagar e arquivar', () => {
  it('⭐⭐ VIRGEM: sem movimento nenhum, some do BANCO', async () => {
    const it = await novoItem('TOMATE ERRADO')
    const s = await situacaoDoItem(companyId, it.id, prisma)
    expect(s.podeExcluir, 'nunca foi usado — apagar não reescreve passado').toBe(true)
    expect(s.caminho).toBe('EXCLUIR')

    await excluirItem({ companyId, itemId: it.id }, prisma)
    expect(await prisma.stockItem.findUnique({ where: { id: it.id } }), 'saiu do banco').toBeNull()
  })

  it('⛔⛔ COM NOTA: excluir é RECUSADO e a mensagem oferece os dois caminhos', async () => {
    const it = await novoItem('TOMATE')
    await prisma.stockMovement.create({
      data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 50, origem: 'SEFAZ' },
    })
    const s = await situacaoDoItem(companyId, it.id, prisma)
    expect(s.podeExcluir).toBe(false)
    await expect(excluirItem({ companyId, itemId: it.id }, prisma)).rejects.toThrow(ArquivarError)
    const erro = await excluirItem({ companyId, itemId: it.id }, prisma).then(() => null).catch((e: Error) => e)
    expect(erro!.message).toContain('MESCLAR')
    expect(erro!.message).toContain('ARQUIVAR')
    // ⭐ e a história continua lá
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: it.id } })).toBe(1)
  })

  it('⭐⭐ COM NOTA: arquivar SOME das listas e é REVERSÍVEL', async () => {
    const it = await novoItem('TOMATE')
    await prisma.stockMovement.create({
      data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 50, origem: 'SEFAZ' },
    })
    // ⚠️ saldo ≠ 0 gera AVISO — e o aviso exige confirmação, não passa calado
    await expect(arquivarItem({ companyId, itemId: it.id, arquivar: true }, prisma)).rejects.toThrow(ArquivarError)

    await arquivarItem({ companyId, itemId: it.id, arquivar: true, confirmado: true }, prisma)
    expect((await prisma.stockItem.findUnique({ where: { id: it.id }, select: { ativo: true } }))!.ativo).toBe(false)
    const { listPosicao } = await import('@/lib/stock/posicao')
    expect((await listPosicao(companyId, prisma)).itens.some((i) => i.itemId === it.id), 'sumiu da Posição').toBe(false)

    // ⭐ volta pelo "mostrar inativos"
    await arquivarItem({ companyId, itemId: it.id, arquivar: false }, prisma)
    expect((await prisma.stockItem.findUnique({ where: { id: it.id }, select: { ativo: true } }))!.ativo).toBe(true)
  })

  it('⛔⛔ COM FICHA APONTANDO: o aviso NOMEIA a receita — "troque o componente antes"', async () => {
    const insumo = await novoItem('TOMATE')
    const produzido = await novoItem('MOLHO', 'INTERMEDIARIO')
    const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: produzido.id, tipoProduto: 'INTERMEDIARIO' } })
    const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'KG' } })
    await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: insumo.id, qtdPlanejada: 0.2, unidade: 'KG', posicao: 0 } })

    const s = await situacaoDoItem(companyId, insumo.id, prisma)
    expect(s.podeExcluir, 'ficha usando impede apagar').toBe(false)
    expect(s.fichas.map((x) => x.nome)).toContain('MOLHO')
    expect(s.avisos.join(' ')).toContain('MOLHO')
    await expect(arquivarItem({ companyId, itemId: insumo.id, arquivar: true }, prisma)).rejects.toThrow(/MOLHO/)
  })

  it('⛔ a checagem é do SERVIDOR — a situação vem dele, não do que a tela acha', async () => {
    const it = await novoItem('TOMATE')
    await prisma.stockMovement.create({
      data: { companyId, itemId: it.id, tipo: 'AJUSTE_CONTAGEM', quantidade: 3, custoUnitario: 1, custoTotal: 3, origem: 'MANUAL' },
    })
    // ⚠️ mesmo com saldo pequeno e nenhuma nota, UM movimento já impede: o ledger não perde linha
    expect((await situacaoDoItem(companyId, it.id, prisma)).podeExcluir).toBe(false)
  })
})
