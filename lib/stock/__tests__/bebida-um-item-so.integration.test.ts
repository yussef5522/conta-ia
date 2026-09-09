// ⛔⛔⛔ BEBIDA TEM UM ITEM SÓ (09/09/2026) — "COCA COLA 2L aparece 2× na busca da receita".
//
// **MEDIDO EM PROD ANTES DE MEXER, e a 1ª hipótese caiu:** a busca **não** mistura ficha com
// item — ela lista só `stock_item`. As duas COCA eram **dois itens de verdade**:
//
//   [cmt6ugy5t…] "COCA-COLA  2L" · REVENDA       · via CONFERENCIA · 560 un de NF
//   [cmts4gqv9…] "COCA COLA 2L"  · PRODUTO_FINAL · via MANUAL      · criado pela FICHA
//
// **O ESTRAGO QUE ISSO CAUSOU, medido:** a contagem oferecia OS DOIS, e as garrafas foram
// contadas na linha do INVÓLUCRO (saldo de sistema **0**) → **9 ajustes fantasma**
// (+154 Coca 2L · +67 Coca lata · +62 Coca 600 · +43 · +33 · +7 …), enquanto o item real
// seguia com o saldo da nota. E ao mesclar dois deles, o fantasma foi **pra dentro** do item
// real: `COCA-COLA 2L` foi de 560 pra **714** com 154 garrafas na geladeira.
//
// ⭐ As três travas abaixo são o red-then-green que o dono pediu.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, FichaError, itemDeEstoqueComMesmoNome } from '../producao/fichas'
import { involucrosPassaDireto } from '../passa-direto-de-revenda'
import { seContaFisicamente, CATEGORIAS_SEM_PRATELEIRA } from '../tipos-ficha'
import { getQuadro } from '../contagem'
import { listPosicao } from '../posicao'

const CNPJ = '55901224000188'
let companyId = ''
let garrafa = ''
let userId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: 'bebida@teste.local' } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BEBIDA' } })).id
  userId = (await prisma.user.create({ data: { email: 'bebida@teste.local', name: 'Yussef', password: 'x' } })).id
  // a garrafa que a NOTA alimenta — o único item que existe na geladeira
  garrafa = (await prisma.stockItem.create({
    data: { companyId, nome: 'COCA-COLA  2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
  })).id
  await prisma.stockMovement.create({
    data: { companyId, itemId: garrafa, tipo: 'ENTRADA_NF', quantidade: 560, custoUnitario: 8.08, custoTotal: 4524.8, origem: 'SEFAZ' },
  })
})

afterEach(async () => {
  for (const t of ['stockContagemItem', 'stockContagem', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockVendaProdutoMap', 'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

/** a ficha de revenda como o dono a fez: 1 componente, a garrafa ×1 */
async function fichaDaBebida(nome: string) {
  return criarFicha({
    companyId, userId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
    loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 17,
    componentes: [{ itemId: garrafa, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    permitirItemNovoComNomeDeEstoque: true, // ⚠️ o nome aqui é o do PDV, não o da nota
  }, prisma)
}

describe('⛔ 1. a busca da receita traz UMA COCA COLA 2L — o item', () => {
  it('⛔⛔ o invólucro PASSA-DIRETO de revenda sai da busca; a garrafa fica', async () => {
    const { itemProduzidoId } = await fichaDaBebida('COCA COLA 2L')
    const candidatos = [
      { id: garrafa, categoria: 'REVENDA' },
      { id: itemProduzidoId, categoria: 'PRODUTO_FINAL' },
    ]
    const fora = await involucrosPassaDireto(companyId, candidatos, prisma)
    expect(fora.has(itemProduzidoId), 'a linha do cardápio não é ingrediente').toBe(true)
    expect(fora.has(garrafa), 'a garrafa TEM que continuar').toBe(false)
    expect(candidatos.filter((c) => !fora.has(c.id))).toHaveLength(1)
  })

  it('⭐ mas um PRODUTO_FINAL de verdade (XIS) CONTINUA na busca — o Combo precisa dele', async () => {
    // ⚠️ afrouxar aqui esconderia um produto real da receita, que é o erro caro.
    const carne = (await prisma.stockItem.create({
      data: { companyId, nome: 'Coxão', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
    })).id
    const xis = await criarFicha({
      companyId, userId, nomeProduzido: 'XIS COMPLETO', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 34,
      componentes: [
        { itemId: carne, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 },
        { itemId: garrafa, qtdPlanejada: 1, unidade: 'UN', posicao: 1 },
      ],
    }, prisma)
    const fora = await involucrosPassaDireto(companyId, [{ id: xis.itemProduzidoId, categoria: 'PRODUTO_FINAL' }], prisma)
    expect(fora.size, 'XIS tem conteúdo próprio — fica').toBe(0)
  })

  it('⭐ e ×2 do mesmo refri também FICA — não é passa-direto', async () => {
    const combo = await criarFicha({
      companyId, userId, nomeProduzido: 'COMBO DUPLO', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 30,
      componentes: [{ itemId: garrafa, qtdPlanejada: 2, unidade: 'UN', posicao: 0 }],
    }, prisma)
    const fora = await involucrosPassaDireto(companyId, [{ id: combo.itemProduzidoId, categoria: 'PRODUTO_FINAL' }], prisma)
    expect(fora.size).toBe(0)
  })
})

describe('⛔ 2. a linha do cardápio não é prateleira — some da contagem e da Posição', () => {
  it('⛔⛔ O DEFEITO QUE CRIOU OS 9 FANTASMAS: a contagem só oferece a garrafa', async () => {
    const { itemProduzidoId } = await fichaDaBebida('COCA COLA 2L')
    const quadro = await getQuadro(companyId, new Date(), prisma)
    const ids = quadro.linhas.map((l) => l.itemId)
    expect(ids, 'a garrafa tem que estar lá — é ela que se conta').toContain(garrafa)
    expect(ids, 'a linha do menu NÃO se conta na geladeira').not.toContain(itemProduzidoId)
  })

  it('⭐ e a Posição também mostra só a garrafa', async () => {
    const { itemProduzidoId } = await fichaDaBebida('COCA COLA 2L')
    // um saldo qualquer no invólucro (foi assim que o fantasma apareceu na Posição)
    await prisma.stockMovement.create({
      data: { companyId, itemId: itemProduzidoId, tipo: 'AJUSTE_CONTAGEM', quantidade: 154, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' },
    })
    const pos = await listPosicao(companyId, prisma)
    const ids = pos.itens.map((i) => i.itemId)
    expect(ids).toContain(garrafa)
    expect(ids, 'o fantasma não pode aparecer na prateleira').not.toContain(itemProduzidoId)
  })

  it('⭐ a régua tem UM dono, e SABOR continua fora junto', async () => {
    expect(seContaFisicamente('REVENDA')).toBe(true)
    expect(seContaFisicamente('MATERIA_PRIMA')).toBe(true)
    expect(seContaFisicamente('INTERMEDIARIO')).toBe(true)
    expect(seContaFisicamente('PRODUTO_FINAL')).toBe(false)
    expect(seContaFisicamente('SABOR')).toBe(false)
    expect([...CATEGORIAS_SEM_PRATELEIRA].sort()).toEqual(['PRODUTO_FINAL', 'SABOR'])
  })
})

describe('⛔ 3. criar ficha de revenda SUGERE o item existente, não duplica', () => {
  it('⛔⛔ com o nome do item da NOTA, a criação é recusada com a saída escrita', async () => {
    await expect(
      criarFicha({
        companyId, userId, nomeProduzido: 'coca-cola 2l', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
        loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 17,
        componentes: [{ itemId: garrafa, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      }, prisma),
    ).rejects.toThrow(FichaError)
  })

  it('⭐ e a mensagem ENSINA: diz o saldo, que veio de nota, e o gesto certo', async () => {
    const erro = await criarFicha({
      companyId, userId, nomeProduzido: 'COCA-COLA  2L', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: garrafa, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    }, prisma).then(() => null).catch((e: Error) => e)
    expect(erro?.message).toContain('560')
    expect(erro?.message).toContain('nota fiscal')
    expect(erro?.message).toContain('direto nesse item')
  })

  it('⭐ nome DIFERENTE do estoque passa — o cardápio usa o nome do PDV', async () => {
    const r = await fichaDaBebida('COCA COLA 2L') // ≠ "COCA-COLA  2L"
    expect(r.fichaId).toBeTruthy()
  })

  it('⛔ e criar com o nome do estoque só passa com a decisão EXPLÍCITA', async () => {
    const r = await criarFicha({
      companyId, userId, nomeProduzido: 'COCA-COLA  2L', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: garrafa, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      permitirItemNovoComNomeDeEstoque: true,
    }, prisma)
    expect(r.fichaId).toBeTruthy()
  })

  it('⭐ o detector acha o item por canônico (caixa/espaço/acento não escondem)', async () => {
    const achado = await itemDeEstoqueComMesmoNome(companyId, '  coca-cola 2l ', prisma)
    expect(achado?.id).toBe(garrafa)
    expect(achado?.saldo).toBe(560)
    expect(achado?.temNota).toBe(true)
  })
})
