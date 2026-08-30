// ⭐⭐ MESCLAR + ARQUIVAR — os casos reais da Posição (29/08/2026).
//
// 1. as 2 BOBINAS: a mesma nota criou o item duas vezes (0,93 e 0,926 UN)
// 2. a peça da câmara fria: comprada uma vez, poluindo a Posição pra sempre

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../../movement'
import { previewMesclagem, mesclarItens, MesclarError } from '../mesclar'
import { situacaoDoItem, arquivarItem, excluirItem, ArquivarError } from '../arquivar'
import { listPosicao } from '../../posicao'
import { saldoItem } from '../../saldo'

const CNPJ = '53535353000153'
let companyId: string, bobA: string, bobB: string

const criarItem = (nome: string, un = 'UN', cat = 'EMBALAGEM') =>
  prisma.stockItem.create({ data: { companyId, nome, unidadeControle: un, categoria: cat, criadoVia: 'CONFERENCIA' } })

const entrada = (itemId: string, quantidade: number, custoUnitario: number, chave = 'CHAVE1') =>
  criarMovimento(prisma, {
    companyId, itemId, tipo: 'ENTRADA_NF', quantidade, custoUnitario,
    custoTotal: Math.round(quantidade * custoUnitario * 100) / 100,
    nfeChave: chave, receiptId: null, nItem: null, origem: 'SEFAZ',
  })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'MESCLA TESTE' } })).id
  // os números REAIS de prod
  bobA = (await criarItem('BOBINA 02 LITROS 21X31CM LINHA LEVE 2.8')).id
  bobB = (await criarItem('BOBINA 02 LITROS 21X31CM LINHA LEVE 2.8')).id
  await entrada(bobA, 0.93, 38.4)   // 35,71
  await entrada(bobB, 0.926, 38.4)  // 35,56
})

afterEach(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockSupplierProduct.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockFichaComponente.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockFichaVersao.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockFicha.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ 1 — mesclar as 2 BOBINAS', () => {
  it('⭐⭐ saldo soma, valor soma AO CENTAVO, custo médio vira ponderado', async () => {
    const previa = await previewMesclagem(companyId, bobA, bobB, prisma)
    // ⚠️ 1,86 e não 1,856: a régua de saldo do módulo é 2 casas (`saldoItem`), e a prévia
    // fala a MESMA língua da Posição. O ledger guarda a precisão cheia; quem arredonda é
    // a leitura — a mesma regra do custo.
    expect(previa.depois.saldo).toBe(1.86)
    expect(previa.depois.valor).toBe(71.27) // 35,71 + 35,56

    const r = await mesclarItens({ companyId, sobreviventeId: bobA, absorvidoId: bobB }, prisma)
    expect(r.movimentosTransferidos).toBe(1)

    const s = await saldoItem(prisma, companyId, bobA)
    expect(s.saldo).toBe(1.86)
    expect(s.valor).toBe(71.27) // ⭐ o dinheiro em estoque NÃO mudou
    // ⚠️ 38,32 e não 38,40: o custo médio é DERIVADO (valor ÷ saldo) e o saldo anda em 2
    // casas — 71,27 ÷ 1,86. Os 8 centavos de deriva vêm do denominador arredondado, não
    // da mescla inventando dinheiro. **A garantia é o VALOR** (71,27, conferido acima e
    // em runtime pela própria função); o custo médio é leitura, e leitura arredonda.
    expect(s.custoMedio).toBe(38.32)

    const absorvido = await saldoItem(prisma, companyId, bobB)
    expect(absorvido.saldo).toBe(0) // zerado pelos estornos
  })

  it('⭐⭐ o duplicado SOME da Posição (mas continua no ledger)', async () => {
    await mesclarItens({ companyId, sobreviventeId: bobA, absorvidoId: bobB }, prisma)
    const pos = await listPosicao(companyId, prisma)
    const linhas = pos.itens.filter((i) => i.nome.startsWith('BOBINA'))
    expect(linhas).toHaveLength(1)
    expect(linhas[0].itemId).toBe(bobA)
    // ⚠️ o ledger não perdeu linha nenhuma: 2 originais + 1 estorno + 1 transferida
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(4)
  })

  it('⭐ o E16 continua fechando — mesclar não vira alarme', async () => {
    // as duas entradas somam 71,27 na chave CHAVE1; depois da mescla o líquido é o mesmo
    const antes = await prisma.stockMovement.aggregate({ where: { companyId, nfeChave: 'CHAVE1' }, _sum: { custoTotal: true } })
    await mesclarItens({ companyId, sobreviventeId: bobA, absorvidoId: bobB }, prisma)
    const depois = await prisma.stockMovement.aggregate({ where: { companyId, nfeChave: 'CHAVE1' }, _sum: { custoTotal: true } })
    expect(Math.round((depois._sum.custoTotal ?? 0) * 100)).toBe(Math.round((antes._sum.custoTotal ?? 0) * 100))
  })

  it('⭐ o mapeamento do fornecedor MIGRA — a próxima nota cai no item certo', async () => {
    await prisma.stockSupplierProduct.create({
      data: { companyId, supplierCnpj: '09021586000145', cProd: 'BOB02', xProd: 'BOBINA', itemId: bobB, fatorConversao: 1 },
    })
    await mesclarItens({ companyId, sobreviventeId: bobA, absorvidoId: bobB }, prisma)
    const mp = await prisma.stockSupplierProduct.findFirstOrThrow({ where: { companyId, cProd: 'BOB02' } })
    expect(mp.itemId).toBe(bobA)
  })

  it('⛔ unidades diferentes NÃO mesclam (somar KG com UN inventaria número)', async () => {
    const kg = (await criarItem('BOBINA EM KG', 'KG')).id
    await entrada(kg, 5, 10)
    await expect(mesclarItens({ companyId, sobreviventeId: bobA, absorvidoId: kg }, prisma)).rejects.toThrow(/unidades diferentes/)
  })

  it('⛔ não mescla item consigo mesmo', async () => {
    await expect(mesclarItens({ companyId, sobreviventeId: bobA, absorvidoId: bobA }, prisma)).rejects.toThrow(MesclarError)
  })

  it('⚠️ nomes diferentes AVISAM (mas não travam — pode ser o mesmo produto)', async () => {
    const outro = (await criarItem('BOBINA 2L LINHA LEVE')).id
    await entrada(outro, 1, 10)
    const p = await previewMesclagem(companyId, bobA, outro, prisma)
    expect(p.avisos.join(' ')).toMatch(/nomes são diferentes/i)
  })
})

describe('⭐⭐ 2 — arquivar / excluir', () => {
  it('⭐⭐ item COM histórico: arquiva e some da Posição; o histórico fica', async () => {
    const sit = await situacaoDoItem(companyId, bobA, prisma)
    expect(sit.podeExcluir).toBe(false) // tem movimento
    await arquivarItem({ companyId, itemId: bobA, arquivar: true, confirmado: true }, prisma)

    const pos = await listPosicao(companyId, prisma)
    expect(pos.itens.find((i) => i.itemId === bobA)).toBeUndefined()
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: bobA } })).toBe(1) // intacto
  })

  it('⭐ desarquivar traz de volta', async () => {
    await arquivarItem({ companyId, itemId: bobA, arquivar: true, confirmado: true }, prisma)
    await arquivarItem({ companyId, itemId: bobA, arquivar: false }, prisma)
    const pos = await listPosicao(companyId, prisma)
    expect(pos.itens.find((i) => i.itemId === bobA)).toBeDefined()
  })

  it('⭐⭐ item SEM movimento nenhum: EXCLUI de verdade', async () => {
    const enganо = (await criarItem('CRIADO POR ENGANO')).id
    const sit = await situacaoDoItem(companyId, enganо, prisma)
    expect(sit.podeExcluir).toBe(true)
    await excluirItem({ companyId, itemId: enganо }, prisma)
    expect(await prisma.stockItem.findFirst({ where: { id: enganо } })).toBeNull()
  })

  it('⛔ item COM movimento NÃO exclui — e a mensagem ensina a saída', async () => {
    await expect(excluirItem({ companyId, itemId: bobA }, prisma)).rejects.toThrow(/ARQUIVAR/)
  })

  it('⚠️ arquivar com SALDO exige confirmação (o estoque não some junto)', async () => {
    await expect(arquivarItem({ companyId, itemId: bobA, arquivar: true }, prisma)).rejects.toThrow(ArquivarError)
    const s = await situacaoDoItem(companyId, bobA, prisma)
    expect(s.avisos.join(' ')).toMatch(/saldo/)
  })

  it('⭐ item usado em ficha ATIVA avisa ONDE está antes de arquivar', async () => {
    const produzido = (await criarItem('XIS', 'UN', 'PRODUTO_FINAL')).id
    const ficha = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: produzido, tipoProduto: 'PRODUTO_FINAL', versaoAtual: 1 } })
    const versao = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: ficha.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
    await prisma.stockFichaComponente.create({ data: { companyId, versaoId: versao.id, itemId: bobA, qtdPlanejada: 1, unidade: 'UN' } })

    const sit = await situacaoDoItem(companyId, bobA, prisma)
    expect(sit.fichas).toHaveLength(1)
    expect(sit.fichas[0].nome).toBe('XIS')
    expect(sit.avisos.join(' ')).toMatch(/XIS/)
  })
})
