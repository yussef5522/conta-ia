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

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⭐⭐ OS DOIS CAMINHOS BAIXAM IGUAL — e por isso o SELO pôde unificar (09/09/2026).
//
// **O dono:** *"SKOL e FRUKI aparecem com selo 'revenda' e as outras 'completa'. Confirma que
// os DOIS caminhos baixam certo na venda — e se sim, unifica o selo (pro dono importa 'baixa
// e tem custo', não o caminho interno). Se algum NÃO baixa, me conta antes de unificar."*
//
// **MEDIDO EM PROD com o planejador REAL (dry-run, nada gravado):**
//   SKOL           (mapa direto no item) → CERV SKOL 600ML       −10 · custo 6,21
//   FRUKI 600ML    (mapa direto no item) → FRUKI GUARANA 600ML    −5 · custo 3,75
//   COCA COLA 2L   (mapa na FICHA)       → COCA-COLA  2L          −8 · custo 8,09
//   COCA ZERO LATA (mapa na FICHA)       → CC Zero LT 350ml       −3 · custo 2,90
// Os dois caem no MESMO item de estoque, com custo. **Só por isso o selo uniu.**
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('⭐ os dois caminhos de revenda baixam o MESMO item', () => {
  it('⭐⭐ mapa DIRETO no item e mapa na FICHA baixam a mesma garrafa, com custo', async () => {
    const { montarPlanoDeLinhas } = await import('../vendas/baixa-venda')
    const { upsertVendaMap } = await import('../vendas/venda-map')

    // caminho A: o nome do PDV aponta DIRETO no item de revenda
    await upsertVendaMap(companyId, 'COCA DIRETO', { tipo: 'REVENDA', itemId: garrafa }, userId, prisma)
    // caminho B: o nome do PDV aponta numa FICHA de 1 componente ×1
    const f = await fichaDaBebida('COCA PELA FICHA')
    await upsertVendaMap(companyId, 'COCA PELA FICHA', { tipo: 'FICHA', fichaId: f.fichaId }, userId, prisma)

    const plano = await montarPlanoDeLinhas(companyId, '2026-09-09', [
      { produto: 'COCA DIRETO', quantidade: 4, valorTotal: 68 },
      { produto: 'COCA PELA FICHA', quantidade: 6, valorTotal: 102 },
    ], null, prisma)

    // ⭐ tudo cai NA GARRAFA — 4 + 6 — e nada fica pendente
    expect(plano.pendentes).toHaveLength(0)
    expect(plano.agregada).toHaveLength(1)
    expect(plano.agregada[0].itemId).toBe(garrafa)
    expect(plano.agregada[0].qtd).toBe(10)
    expect(plano.agregada[0].custoMedio, 'os dois têm custo — é o que o selo promete').toBeGreaterThan(0)
  })

  it('⭐ o selo é o MESMO nos dois — fala do resultado, não do caminho', async () => {
    const { ROTULO } = await import('../cardapio/hub')
    expect(ROTULO.REVENDA).toBe(ROTULO.FICHA_OK)
    expect(ROTULO.REVENDA).toBe('baixa certo')
    // ⛔ mas o que NÃO baixa continua com selo próprio — unificar não pode apagar problema
    expect(ROTULO.SEM_DESTINO).not.toBe(ROTULO.FICHA_OK)
    expect(ROTULO.FICHA_INCOMPLETA).not.toBe(ROTULO.FICHA_OK)
    expect(ROTULO.SEM_FICHA).not.toBe(ROTULO.FICHA_OK)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⭐⭐ BEBIDA QUE EXISTE NA GELADEIRA MAS NUNCA VEIO EM NOTA (09/09/2026).
//
// **O dono:** *"Começamos há 1 semana — essas bebidas estão na geladeira, só nunca veio NF.
// Cria o item, cria a ficha, aponta o cardápio. Saldo NÃO se chuta: nascem com 0 e entram na
// minha fila de contagem."*
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('⭐ o caminho "existe na geladeira, nunca veio nota"', () => {
  async function criarSemNota(nomePdv: string, nomeItem: string) {
    const { upsertVendaMap } = await import('../vendas/venda-map')
    const item = await prisma.stockItem.create({
      data: { companyId, nome: nomeItem, unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' },
    })
    const f = await criarFicha({
      companyId, userId, nomeProduzido: nomePdv, unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 9,
      componentes: [{ itemId: item.id, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    }, prisma)
    await upsertVendaMap(companyId, nomePdv, { tipo: 'FICHA', fichaId: f.fichaId }, userId, prisma)
    return { item, fichaId: f.fichaId }
  }

  it('⭐⭐ a venda de FANTA LARANJA LATA passa a baixar o item novo', async () => {
    const { montarPlanoDeLinhas } = await import('../vendas/baixa-venda')
    const { item } = await criarSemNota('FANTA LARANJA LATA', 'FANTA LARANJA LATA 350ML')

    const plano = await montarPlanoDeLinhas(companyId, '2026-09-09', [
      { produto: 'FANTA LARANJA LATA', quantidade: 3, valorTotal: 27 },
    ], null, prisma)
    expect(plano.pendentes, 'não pode mais cair na fila de "sem destino"').toHaveLength(0)
    expect(plano.agregada).toHaveLength(1)
    expect(plano.agregada[0].itemId).toBe(item.id)
    expect(plano.agregada[0].qtd).toBe(3)
  })

  it('⛔⛔ SALDO NASCE ZERO — nada é chutado', async () => {
    const { item } = await criarSemNota('FRUKI ZERO 2L', 'FRUKI GUARANA ZERO 2L')
    const movs = await prisma.stockMovement.count({ where: { companyId, itemId: item.id } })
    expect(movs, 'item novo não nasce com movimento inventado').toBe(0)
  })

  it('⭐⭐ e ele entra na FILA DE CONTAGEM — é dali que o saldo vem', async () => {
    const { item } = await criarSemNota('HEINEKEN LONG ZERO', 'HEINEKEN LONG NECK ZERO 330ML')
    const quadro = await getQuadro(companyId, new Date(), prisma)
    const linha = quadro.linhas.find((l) => l.itemId === item.id)
    expect(linha, 'a garrafa nova tem que aparecer pra contar').toBeTruthy()
    // ⚠️ "sem contagem" ≠ zero: o saldo de sistema é 0 porque nada entrou, e a contagem é
    // que vai dizer quantas existem. Chutar aqui seria inventar estoque.
    expect(linha!.saldoSistema).toBe(0)
    // ⛔ e o invólucro do cardápio NÃO entra na fila junto
    const f = await prisma.stockFicha.findFirst({ where: { companyId, tipoProduto: 'PRODUTO_FINAL' }, orderBy: { criadoEm: 'desc' }, select: { itemProduzidoId: true } })
    expect(quadro.linhas.map((l) => l.itemId)).not.toContain(f!.itemProduzidoId)
  })

  it('⭐ a busca acha a garrafa nova por extenso', async () => {
    await criarSemNota('FANTA LARANJA LATA', 'FANTA LARANJA LATA 350ML')
    const itens = await prisma.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true } })
    const { filtrarPorBusca } = await import('@/lib/busca-texto')
    expect(filtrarPorBusca(itens, 'fanta laranja lata', (i) => i.nome).length).toBeGreaterThan(0)
  })
})
