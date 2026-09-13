// ⛔⛔ O EDITOR DE RECEITA PERDE COMPONENTE DEPOIS DE UMA MESCLA? (13/09/2026)
//
// **A pergunta do dono, ao pé da letra:** *"ficha com componente X → mescla o item X em
// outro → abre a ficha, salva sem mexer → o componente sumiu?"*
//
// **O QUE MOTIVOU:** a ficha da MAIONESE perdeu o vinagre entre a v1 e a v2, na mesma noite
// em que três vinagres foram mesclados. ⚠️ **A cronologia já descarta a mescla como causa**
// (v2 nasceu 19:23, a mescla foi 19:58 — 35 min DEPOIS), mas cronologia prova *aquele* caso,
// não a *classe*. Este teste prova a classe: ele roda o caminho REAL — o mesmo `getFicha`
// que a tela carrega e o mesmo `atualizarFicha` que o PATCH chama — e exige que **salvar sem
// mexer devolva a receita intacta**.
//
// ⭐ E ele cobre o round-trip SEM mescla também: se o editor perdesse componente por outro
// motivo (item sem custo, item manual), o defeito continuaria vivo com a mescla inocentada.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, getFicha } from '../fichas'
import { mesclarItens } from '@/lib/stock/itens/mesclar'

const companyId = `ed-comp-${Date.now()}`

/** o payload que a TELA monta a partir do que `getFicha` devolveu — sem mexer em nada */
function comoATelaSalva(f: NonNullable<Awaited<ReturnType<typeof getFicha>>>['ficha']) {
  return {
    loteBase: f.loteBase,
    unidadeLoteBase: f.unidadeLoteBase,
    componentes: f.componentes.map((c, i) => ({ itemId: c.itemId, qtdPlanejada: c.qtdPlanejada, unidade: c.unidade, posicao: i })),
    modoPreparo: f.modoPreparo,
    tempoPreparoMin: f.tempoPreparoMin,
    etapas: f.etapas.map((e: { nome: string }) => ({ nome: e.nome })),
    validadeDias: f.validadeDias,
  }
}

const criarItem = (nome: string, unidade = 'LT', categoria = 'MATERIA_PRIMA', criadoVia = 'MANUAL') =>
  prisma.stockItem.create({ data: { companyId, nome, unidadeControle: unidade, categoria, criadoVia }, select: { id: true } })

afterAll(async () => {
  await prisma.stockFichaComponente.deleteMany({ where: { companyId } })
  await prisma.stockFichaVersao.deleteMany({ where: { companyId } })
  await prisma.stockFicha.deleteMany({ where: { companyId } })
  await prisma.stockItemMesclado.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
})

describe('⛔⛔ salvar a ficha sem mexer NÃO pode perder componente', () => {
  it('⭐⭐ O CASO DO DONO: componente → MESCLA do item → abre e salva → o componente CONTINUA', async () => {
    const oleo = await criarItem('oleo do teste')
    const vinagreVelho = await criarItem('vinagre velho')
    const vinagreNovo = await criarItem('vinagre novo')

    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'maionese do teste', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 3, unidadeLoteBase: 'KG',
      componentes: [
        { itemId: oleo.id, qtdPlanejada: 3, unidade: 'LT', posicao: 0 },
        { itemId: vinagreVelho.id, qtdPlanejada: 0.02, unidade: 'LT', posicao: 1 },
      ],
    }, prisma)

    // ⭐ a MESCLA: o vinagre velho vira parte do novo
    await mesclarItens({ companyId, sobreviventeId: vinagreNovo.id, absorvidoId: vinagreVelho.id }, prisma)

    // ⭐ a tela ABRE a ficha (o MESMO loader do editor)
    const aberta = await getFicha(companyId, fichaId, prisma)
    expect(aberta, 'a ficha não abriu').not.toBeNull()
    expect(aberta!.ficha.componentes, 'o componente sumiu AO ABRIR').toHaveLength(2)
    // ⭐ e já vem repontado pro sobrevivente — a mescla migra a ficha
    expect(aberta!.ficha.componentes.map((c) => c.itemId)).toContain(vinagreNovo.id)
    expect(aberta!.ficha.componentes.map((c) => c.itemId)).not.toContain(vinagreVelho.id)

    // ⭐ e SALVA sem mexer em nada
    await atualizarFicha(companyId, fichaId, comoATelaSalva(aberta!.ficha), prisma)

    const depois = await getFicha(companyId, fichaId, prisma)
    expect(depois!.ficha.versaoAtual, 'não versionou').toBe(2)
    expect(depois!.ficha.componentes, '⛔ O COMPONENTE SUMIU AO SALVAR').toHaveLength(2)
    expect(depois!.ficha.componentes.map((c) => c.itemId).sort()).toEqual([oleo.id, vinagreNovo.id].sort())
    // ⚠️ e a quantidade sobreviveu inteira — perder o 0,02 seria a mesma perda com outra cara
    expect(depois!.ficha.componentes.find((c) => c.itemId === vinagreNovo.id)!.qtdPlanejada).toBe(0.02)
  })

  it('⭐ o round-trip SEM mescla também é fiel — inclusive com item SEM CUSTO e MANUAL', async () => {
    // ⚠️ era o estado exato do vinagre fantasma quando a v2 nasceu: item MANUAL, sem nota,
    // sem custo. Se o editor perdesse componente por AÍ, a mescla estaria inocentada e o
    // defeito seguiria vivo — por isso este caso existe separado.
    const base = await criarItem('base do teste')
    const semCusto = await criarItem('tempero sem nota')
    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'molho do teste', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [
        { itemId: base.id, qtdPlanejada: 1, unidade: 'LT', posicao: 0 },
        { itemId: semCusto.id, qtdPlanejada: 0.03, unidade: 'KG', posicao: 1 },
      ],
    }, prisma)

    const aberta = await getFicha(companyId, fichaId, prisma)
    // ⭐ "sem custo" aparece como tal, mas o componente ESTÁ lá
    expect(aberta!.ficha.componentes).toHaveLength(2)
    expect(aberta!.ficha.componentes.find((c) => c.itemId === semCusto.id)!.custoMedio).toBeNull()

    await atualizarFicha(companyId, fichaId, comoATelaSalva(aberta!.ficha), prisma)
    const depois = await getFicha(companyId, fichaId, prisma)
    expect(depois!.ficha.componentes, '⛔ o item sem custo sumiu ao salvar').toHaveLength(2)
  })

  it('⛔ COMPONENTE DE ITEM DESATIVADO sobrevive ao round-trip', async () => {
    // ⚠️⚠️ ESTE CASO NASCEU DA REGRA 11: repus "o load descarta componente de item inativo"
    // e os 4 testes ficaram VERDES — porque depois da mescla o componente aponta pro
    // SOBREVIVENTE, que está ativo. O estado que morde é outro: item **arquivado** com a
    // ficha ainda apontando pra ele. Sem este caso, o guard inocentava o defeito.
    const base = await criarItem('base 4 do teste')
    const arquivado = await criarItem('item que sera arquivado')
    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'caldo do teste', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [
        { itemId: base.id, qtdPlanejada: 1, unidade: 'LT', posicao: 0 },
        { itemId: arquivado.id, qtdPlanejada: 0.5, unidade: 'KG', posicao: 1 },
      ],
    }, prisma)
    await prisma.stockItem.update({ where: { id: arquivado.id }, data: { ativo: false } })

    const aberta = await getFicha(companyId, fichaId, prisma)
    expect(aberta!.ficha.componentes, '⛔ o componente arquivado sumiu AO ABRIR').toHaveLength(2)
    await atualizarFicha(companyId, fichaId, comoATelaSalva(aberta!.ficha), prisma)
    const depois = await getFicha(companyId, fichaId, prisma)
    expect(depois!.ficha.componentes, '⛔ o componente arquivado sumiu AO SALVAR').toHaveLength(2)
  })

  it('⛔⛔ mudar o corpo SEM mandar os componentes HERDA a receita — não a esvazia', async () => {
    // ⚠️⚠️ TAMBÉM DA REGRA 11: o teste do "salvar só o preço" NÃO alcançava a linha de
    // herança — `valorVenda` sozinho não muda o corpo, então `atualizarFicha` retorna cedo e
    // nem chega lá. Repondo "componentes ausente vira []" tudo ficava verde. O que executa a
    // herança é mudar o corpo (aqui, o modo de preparo) sem mandar a lista.
    const base = await criarItem('base 5 do teste')
    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'creme do teste', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: base.id, qtdPlanejada: 1, unidade: 'LT', posicao: 0 }],
    }, prisma)

    await atualizarFicha(companyId, fichaId, { modoPreparo: 'mexer devagar' }, prisma)
    const depois = await getFicha(companyId, fichaId, prisma)
    expect(depois!.ficha.versaoAtual, 'não versionou — o corpo mudou').toBe(2)
    expect(depois!.ficha.componentes, '⛔ mudar o preparo apagou a receita').toHaveLength(1)
    expect(depois!.ficha.modoPreparo).toBe('mexer devagar')
  })

  it('⛔ e salvar SÓ o preço não pode apagar a receita (o campo ausente vira vazio)', async () => {
    // ⚠️ irmão do bug das etapas, já documentado: `componentes` ausente no input tem que
    // HERDAR a versão anterior, nunca virar lista vazia.
    const base = await criarItem('base 2 do teste')
    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'pizza do teste', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: base.id, qtdPlanejada: 2, unidade: 'LT', posicao: 0 }],
    }, prisma)

    await atualizarFicha(companyId, fichaId, { valorVenda: 42 }, prisma)
    const depois = await getFicha(companyId, fichaId, prisma)
    expect(depois!.ficha.componentes, '⛔ salvar o preço apagou a receita').toHaveLength(1)
    expect(depois!.ficha.valorVenda).toBe(42)
  })

  it('⛔⛔ ficha SEM componente nenhum é recusada — nunca gravada vazia em silêncio', async () => {
    const base = await criarItem('base 3 do teste')
    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'sopa do teste', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: base.id, qtdPlanejada: 1, unidade: 'LT', posicao: 0 }],
    }, prisma)
    await expect(atualizarFicha(companyId, fichaId, { componentes: [] }, prisma)).rejects.toThrow(/ao menos um componente/i)
    const depois = await getFicha(companyId, fichaId, prisma)
    expect(depois!.ficha.componentes).toHaveLength(1)
  })
})
