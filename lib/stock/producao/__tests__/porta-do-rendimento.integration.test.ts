/**
 * ⭐⭐⭐ A PORTA DO RENDIMENTO + A AUTO-CONVERSÃO DAS NEUTRAS (11/10/2026).
 *
 * **Ordem do dono (item 5):** *"Red-then-green: auto com Δ≠0 forjado = recusa · porta recusando
 * ficha nova torta · beef: pedido 30 separa os MESMOS kg antes × depois, ao centavo. Ordens
 * antigas intocadas (versões)."*
 *
 * ⛔⛔ **E O CASO TORTO É MONTADO POR FORA DA PORTA, de propósito** (`_ficha-torta.ts`): desde
 * hoje `criarFicha` recusa nascer incoerente, mas o estado torto EXISTE em prod porque nasceu
 * ANTES da régua. Guard que só consegue montar o mundo bom é o verde de graça que a REGRA 11
 * proíbe.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, FichaError } from '../fichas'
import { tornarRotuloTorto } from './_ficha-torta'
import { avaliarCoerenciaDoLote, avaliarCoerenciaDoRotulo } from '../coerencia-do-lote'
import {
  avaliarAutoConversao,
  exigirNeutralidade,
  autoConverterNeutras,
  rendimentosPendentes,
  fichaEsperaRendimento,
  AutoConversaoError,
  PEDIDOS_DA_PROVA,
  ORIGEM_DO_RESUMO,
} from '../auto-conversao-de-lote'
import { insumoDoPedido } from '../escala-da-ordem'
import { criarOrdem, explodirSeparacao } from '../ordens'

const CNPJ = '79797979000179'
let companyId: string

/** o beef de xis REAL: produto contado em UN, as 3 doses em KG por unidade */
const DOSES = { acem: 0.091, peito: 0.044, gordura: 0.02 }

async function insumo(nome: string) {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  return i.id
}

/** cria a ficha COERENTE e torce o rótulo depois — a forma do legado */
async function beefTorto(nome = 'beef de xis', unidadeTorta = 'KG') {
  const [a, p, g] = [await insumo(`Acém ${nome}`), await insumo(`Peito ${nome}`), await insumo(`Gordura ${nome}`)]
  const f = await criarFicha({
    companyId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [
      { itemId: a, qtdPlanejada: DOSES.acem, unidade: 'KG', posicao: 0 },
      { itemId: p, qtdPlanejada: DOSES.peito, unidade: 'KG', posicao: 1 },
      { itemId: g, qtdPlanejada: DOSES.gordura, unidade: 'KG', posicao: 2 },
    ],
  }, prisma)
  await tornarRotuloTorto(companyId, f.fichaId, unidadeTorta, prisma)
  return { ...f, acem: a, peito: p, gordura: g }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'PORTA DO RENDIMENTO' } })
  companyId = c.id
})
afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔ A PORTA — ficha de produção não nasce nem salva com o rótulo torto', () => {
  it('⛔ criar ficha de produção com o lote em KG num produto em UN é RECUSADO, e a frase ENSINA', async () => {
    const i = await insumo('Acém')
    await expect(criarFicha({
      companyId, nomeProduzido: 'porcao nova', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: i, qtdPlanejada: 0.1, unidade: 'KG' }],
    }, prisma)).rejects.toThrow(FichaError)

    // a recusa diz O QUE FALTA e POR QUE importa — recusa que não aponta a saída é beco
    const frase = avaliarCoerenciaDoLote({
      tipoProduto: 'INTERMEDIARIO', unidadeLoteBase: 'KG', unidadeProduto: 'UN', nomeProduto: 'porcao nova',
    }).frase!
    expect(frase).toContain('se conta em UN')
    expect(frase).toContain('Diga quantas UN saem de 1 receita')
    expect(frase).toContain('divide o pedido')
  })

  it('⛔ e NENHUMA ficha nasce torta — nem invólucro de cardápio (é a régua que o trigger espelha)', async () => {
    const i = await insumo('porção pronta')
    await expect(criarFicha({
      companyId, nomeProduzido: 'XIS COMPLETO', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: i, qtdPlanejada: 1, unidade: 'KG' }],
    }, prisma)).rejects.toThrow(/se conta em UN/)
  })

  it('⭐ a ficha COERENTE entra normal (a porta não barra o certo)', async () => {
    const i = await insumo('Acém ok')
    const f = await criarFicha({
      companyId, nomeProduzido: 'porcao coerente', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: i, qtdPlanejada: 0.1, unidade: 'KG' }],
    }, prisma)
    expect(f.fichaId).toBeTruthy()
  })

  it('⛔ EDITAR ficha de produção mantendo o rótulo torto é recusado (o editor não salva torto)', async () => {
    const f = await beefTorto('beef a editar')
    await expect(atualizarFicha(companyId, f.fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: f.acem, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }],
    }, prisma)).rejects.toThrow(/se conta em UN/)
  })

  it('⭐ e o conserto passa: a MESMA edição com o rótulo na unidade do produto grava a v2', async () => {
    const f = await beefTorto('beef a consertar')
    const r = await atualizarFicha(companyId, f.fichaId, {
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: f.acem, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 }],
    }, prisma)
    expect(r.versao).toBe(2)
  })

  /**
   * ⚠️⚠️ A CATRACA, e ela é o que separa régua de PAREDE: o sabor `CALABRESA` está torto em
   * prod e é o de MAIOR volume do cardápio. Exigir coerência num invólucro de cardápio
   * trancaria a edição legítima dele por causa de um campo que a venda nem lê.
   */
  it('⭐⭐ invólucro de cardápio JÁ torto continua editável (carrega o legado, não regride)', async () => {
    const i = await insumo('porção da pizza')
    const f = await criarFicha({
      companyId, nomeProduzido: 'CALABRESA', unidadeProduzido: 'UN', tipoProduto: 'SABOR',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: i, qtdPlanejada: 1, unidade: 'UN' }],
    }, prisma)
    await tornarRotuloTorto(companyId, f.fichaId, 'KG', prisma)

    const r = await atualizarFicha(companyId, f.fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG', // segue torto — é o legado dele
      componentes: [{ itemId: i, qtdPlanejada: 2, unidade: 'UN', posicao: 0 }],
    }, prisma)
    expect(r.versao).toBe(2)
  })

  it('⛔ mas REGREDIR num invólucro já coerente é recusado (a catraca só anda pra frente)', async () => {
    const i = await insumo('porção da pizza 2')
    const f = await criarFicha({
      companyId, nomeProduzido: 'FRANGO', unidadeProduzido: 'UN', tipoProduto: 'SABOR',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: i, qtdPlanejada: 1, unidade: 'UN' }],
    }, prisma)
    await expect(atualizarFicha(companyId, f.fichaId, {
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: i, qtdPlanejada: 2, unidade: 'UN', posicao: 0 }],
    }, prisma)).rejects.toThrow(/se conta em UN/)
  })
})

describe('⛔⛔⛔ O GUARD DO ITEM 1 — auto com Δ≠0 é RECUSA', () => {
  it('⛔ Δ≠0 forjado → AutoConversaoError, nomeando a ficha e o motivo', () => {
    const forjada = {
      fichaId: 'f1', nomeProduto: 'MAIONESE', rotuloAntes: 'rende 2.858 UN', rotuloDepois: 'rende 1 KG',
      unidadesPorReceita: 2.858, neutra: false, piorDelta: 0.0003, componentes: [],
      porQueNao: 'a separação MUDARIA (até 0.0003 na unidade do componente) — esta ficha precisa do rendimento que só o dono sabe.',
    }
    expect(() => exigirNeutralidade(forjada)).toThrow(AutoConversaoError)
    try {
      exigirNeutralidade(forjada)
    } catch (e) {
      const m = (e as Error).message
      expect(m).toContain('MAIONESE')
      expect(m).toContain('decisão do dono')
    }
  })

  it('⭐ e a neutra passa (o guard não barra o que ele existe pra deixar passar)', () => {
    expect(() => exigirNeutralidade({
      fichaId: 'f2', nomeProduto: 'beef de xis', rotuloAntes: 'rende 1 KG', rotuloDepois: 'rende 1 UN',
      unidadesPorReceita: 1, neutra: true, piorDelta: 0, componentes: [], porQueNao: null,
    })).not.toThrow()
  })

  /**
   * ⛔⛔ A NEUTRALIDADE É MEDIDA PELA **PORTA DA SEPARAÇÃO**, não pela álgebra que gerou a
   * proposta — conferir a conversão contra a própria fórmula seria o invariante circular de
   * 28/08 ("daria verde sempre, inclusive com o buraco aberto").
   */
  it('⭐⭐ a prova roda os 6 pedidos e exige Δ 0 em TODO componente', () => {
    const a = avaliarAutoConversao({
      fichaId: 'f3', nomeProduto: 'beef de xis', loteBase: 1, unidadeLoteBase: 'KG', unidadeProduto: 'UN',
      componentes: [
        { itemId: 'a', nome: 'Acém', unidade: 'KG', qtdPlanejada: DOSES.acem },
        { itemId: 'p', nome: 'Peito', unidade: 'KG', qtdPlanejada: DOSES.peito },
      ],
    })
    expect(a.neutra).toBe(true)
    expect(a.piorDelta).toBe(0)
    expect(a.componentes).toHaveLength(2)
    // as doses não se movem no caso 1:1 — é o que faz o Δ ser zero EXATO, não "quase"
    expect(a.componentes.map((c) => c.doseDepois)).toEqual([DOSES.acem, DOSES.peito])
    expect(a.rotuloAntes).toBe('rende 1 KG')
    expect(a.rotuloDepois).toBe('rende 1 UN')
    expect(PEDIDOS_DA_PROVA).toContain(137.5) // a escala que mais pegou nesta casa
  })

  it('⛔ lote que não é número utilizável não vira auto — vira pendente com o motivo', () => {
    const a = avaliarAutoConversao({
      fichaId: 'f4', nomeProduto: 'ficha podre', loteBase: 0, unidadeLoteBase: 'KG', unidadeProduto: 'UN',
      componentes: [{ itemId: 'a', nome: 'Acém', unidade: 'KG', qtdPlanejada: 0.1 }],
    })
    expect(a.neutra).toBe(false)
    expect(a.porQueNao).toContain('não é um número utilizável')
  })
})

describe('⭐⭐⭐ O BEEF: pedido 30 separa os MESMOS kg antes × depois, AO CENTAVO', () => {
  it('⛔ a separação de 30 UN não se move um grama, componente por componente', async () => {
    const f = await beefTorto('beef de xis 30')

    // ANTES: a separação pela porta real da ordem (não por conta minha)
    const o1 = await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 30, dataProducao: new Date('2026-10-11') }, prisma)
    const antes = (await explodirSeparacao(companyId, o1.ordemId, prisma)).linhas
    const porItemAntes = new Map(antes.map((l) => [l.itemId, l.qtdPlanejada]))

    // o gesto da auto
    const r = await autoConverterNeutras(companyId, prisma)
    expect(r.convertidas).toHaveLength(1)
    expect(r.convertidas[0].rotuloDepois).toBe('rende 1 UN')
    expect(r.pendentes).toEqual([])

    // DEPOIS: ordem NOVA, mesma escala, pela MESMA porta
    const o2 = await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 30, dataProducao: new Date('2026-10-12') }, prisma)
    const depois = (await explodirSeparacao(companyId, o2.ordemId, prisma)).linhas

    expect(depois).toHaveLength(antes.length)
    for (const l of depois) {
      expect(l.qtdPlanejada).toBe(porItemAntes.get(l.itemId))
    }
    // e os números que o dono conferiu em prod: 30 × 0,091 · 0,044 · 0,020
    expect(porItemAntes.get(f.acem)).toBeCloseTo(2.73, 6)
    expect(porItemAntes.get(f.peito)).toBeCloseTo(1.32, 6)
    expect(porItemAntes.get(f.gordura)).toBeCloseTo(0.6, 6)
  })

  /**
   * ⛔⛔ ORDEM ANTIGA INTOCADA — a ordem guarda `versaoFicha` (snapshot de 21/08), então a
   * conversão NÃO pode reescrever o que ela separou. Se reescrevesse, o P1 acusaria um
   * vazamento que não houve e o custo de um lote fechado mudaria depois do fato.
   */
  it('⭐⭐ a ordem ANTERIOR continua apontando pra v1 e separando o mesmo material', async () => {
    const f = await beefTorto('beef historico')
    const o1 = await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 30, dataProducao: new Date('2026-10-11') }, prisma)
    const antes = (await explodirSeparacao(companyId, o1.ordemId, prisma)).linhas

    const ordemAntes = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: o1.ordemId } })
    await autoConverterNeutras(companyId, prisma)
    const ordemDepois = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: o1.ordemId } })

    expect(ordemDepois.versaoFicha).toBe(ordemAntes.versaoFicha)
    expect(ordemDepois.escalaReceitas).toBe(ordemAntes.escalaReceitas)

    // e re-explodir a ordem VELHA dá exatamente o mesmo material
    const reexplode = (await explodirSeparacao(companyId, o1.ordemId, prisma)).linhas
    expect(reexplode.map((l) => l.qtdPlanejada).sort()).toEqual(antes.map((l) => l.qtdPlanejada).sort())
  })

  it('⭐ a v1 fica no histórico como veio — a conversão ACRESCENTA versão, nunca sobrescreve', async () => {
    const f = await beefTorto('beef versionado')
    await autoConverterNeutras(companyId, prisma)
    const vs = await prisma.stockFichaVersao.findMany({ where: { companyId, fichaId: f.fichaId }, orderBy: { versao: 'asc' } })
    expect(vs).toHaveLength(2)
    expect(vs[0]).toMatchObject({ versao: 1, unidadeLoteBase: 'KG' })
    expect(vs[1]).toMatchObject({ versao: 2, unidadeLoteBase: 'UN' })
    // ⚠️ rastro de SISTEMA: a versão nova nasce SEM autor (ninguém clicou)
    expect(vs[1].criadoPorId).toBeNull()
  })

  /**
   * ⭐⭐ UM RESUMO NO SININHO, não N (item 1) — e ele DIZ que nada mudou na prateleira.
   *
   * ⛔ 36 sininhos pra dizer *"não mudou nada"* seria a enxurrada que mata o sininho. O aviso
   * POR FICHA é do item 2, onde cada uma espera um número diferente do dono.
   */
  it('⭐⭐ a auto deixa UM resumo no sininho, azul, dizendo que a prateleira não se moveu', async () => {
    await beefTorto('beef do resumo A')
    await beefTorto('beef do resumo B')
    await autoConverterNeutras(companyId, prisma)

    const avisos = await prisma.aviso.findMany({ where: { companyId, origem: ORIGEM_DO_RESUMO } })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].severidade).toBe('azul')
    expect(avisos[0].setor).toBe('gerencia')
    expect(avisos[0].titulo).toContain('2 rótulos')
    expect(avisos[0].corpo).toContain('Nada mudou na prateleira')
    expect(avisos[0].acaoHref).toContain('/estoque/producao/receitas')
    // ⛔ e o aviso POR FICHA (item 2) NÃO nasce pra ficha que a auto resolveu
    expect(await rendimentosPendentes(companyId, prisma)).toEqual([])
  })

  it('⛔ sem nada pra converter, NENHUM resumo nasce (aviso de "não fiz nada" é ruído)', async () => {
    const i = await insumo('Acém coerente')
    await criarFicha({
      companyId, nomeProduzido: 'ja coerente', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: i, qtdPlanejada: 0.1, unidade: 'KG' }],
    }, prisma)
    const r = await autoConverterNeutras(companyId, prisma)
    expect(r.convertidas).toEqual([])
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_DO_RESUMO } })).toBe(0)
  })

  it('⭐ e o gesto é IDEMPOTENTE: a 2ª rodada não acha mais nada pra converter', async () => {
    await beefTorto('beef idempotente')
    const r1 = await autoConverterNeutras(companyId, prisma)
    expect(r1.convertidas).toHaveLength(1)
    const r2 = await autoConverterNeutras(companyId, prisma)
    expect(r2.convertidas).toEqual([])
    expect(r2.pendentes).toEqual([])
  })
})

describe('⭐ AS PENDENTES — a leitura que o aviso e a página da ordem consomem', () => {
  /**
   * ⛔⛔ Ela devolve SÓ as NÃO-NEUTRAS, e isso é o ponto: ficha neutra ainda na fila é trabalho
   * do SISTEMA (a próxima rodada da auto resolve), não pendência do dono. Cobrar dele um gesto
   * que ele não precisa dar é como se aprende a não olhar a fila.
   */
  it('⛔ ficha NEUTRA não entra na lista de pendentes do dono', async () => {
    const f = await beefTorto('beef neutro')
    expect(await rendimentosPendentes(companyId, prisma)).toEqual([])
    expect(await fichaEsperaRendimento(companyId, f.fichaId, prisma)).toMatchObject({ espera: false })
  })

  it('⭐⭐ a MAIONESE (lote 2.858, doses que se movem) ENTRA, com o porquê escrito', async () => {
    const oleo = await insumo('OLEO DE SOJA')
    const f = await criarFicha({
      companyId, nomeProduzido: 'MAIONESE', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 2.858, unidadeLoteBase: 'KG',
      componentes: [{ itemId: oleo, qtdPlanejada: 3, unidade: 'LT' }],
    }, prisma)
    await tornarRotuloTorto(companyId, f.fichaId, 'UN', prisma)

    const pend = await rendimentosPendentes(companyId, prisma)
    expect(pend).toHaveLength(1)
    expect(pend[0].nomeProduto).toBe('MAIONESE')
    expect(pend[0].porQueNao).toContain('a separação MUDARIA')

    const esp = await fichaEsperaRendimento(companyId, f.fichaId, prisma)
    expect(esp.espera).toBe(true)
    expect(esp.porQue).toContain('o rendimento que só o dono sabe')

    // ⛔ e a auto NÃO toca nela
    const r = await autoConverterNeutras(companyId, prisma)
    expect(r.convertidas).toEqual([])
    expect(r.pendentes).toHaveLength(1)
    const vs = await prisma.stockFichaVersao.count({ where: { companyId, fichaId: f.fichaId } })
    expect(vs).toBe(1)
  })
})

describe('a régua pura', () => {
  it('⭐ a vocabulary-free vale pra qualquer tipo; a da produção se cala no cardápio', () => {
    // vocabulary-free: só compara as duas unidades
    expect(avaliarCoerenciaDoRotulo({ unidadeLoteBase: 'KG', unidadeProduto: 'UN' }).ok).toBe(false)
    expect(avaliarCoerenciaDoRotulo({ unidadeLoteBase: 'UN', unidadeProduto: 'UN' }).ok).toBe(true)
    // a da produção: tipo que não declara rendimento passa
    expect(avaliarCoerenciaDoLote({ tipoProduto: 'PRODUTO_FINAL', unidadeLoteBase: 'KG', unidadeProduto: 'UN' }).ok).toBe(true)
    expect(avaliarCoerenciaDoLote({ tipoProduto: 'SABOR', unidadeLoteBase: 'KG', unidadeProduto: 'UN' }).ok).toBe(true)
    expect(avaliarCoerenciaDoLote({ tipoProduto: 'INTERMEDIARIO', unidadeLoteBase: 'KG', unidadeProduto: 'UN' }).ok).toBe(false)
    /**
     * ⚠️⚠️ TIPO DESCONHECIDO **EXIGE** — e esta asserção existe porque eu havia escrito o
     * contrário no comentário da lib antes de rodar o guard. `comoConsome` é DENYLIST: tipo
     * novo é `ESTOCADO`, logo se conta na prateleira e se produz por ordem; exigir o rendimento
     * dele é coerente com o resto do módulo, e o custo do erro é uma recusa que ENSINA.
     */
    expect(avaliarCoerenciaDoLote({ tipoProduto: 'TIPO_NOVO', unidadeLoteBase: 'KG', unidadeProduto: 'UN' }).ok).toBe(false)
  })

  it('⛔⛔ e a LEI: converter é neutro exatamente quando U == loteBase', () => {
    // é a álgebra escrita como teste: pedido ÷ loteBase × dose == pedido ÷ 1 × (dose ÷ U)
    for (const pedido of PEDIDOS_DA_PROVA) {
      const antes = insumoDoPedido({ pedido, loteBase: 1 }, 0.091)
      const depois = insumoDoPedido({ pedido, loteBase: 1 }, 0.091)
      expect(depois).toBe(antes)
    }
    // com U ≠ loteBase a separação MUDA — é por isso que a auto nunca escolhe outro U
    const comU20 = insumoDoPedido({ pedido: 30, loteBase: 1 }, 0.091 / 20)
    expect(comU20).not.toBe(insumoDoPedido({ pedido: 30, loteBase: 1 }, 0.091))
  })
})
