// ⛔⛔ A SEQUÊNCIA DAS ETAPAS É DO SERVIDOR, E O LOTE FECHA NA PONTA (06/09/2026).
//
// **BUG PROVADO EM PROD:** na ordem do beef de hambúrguer, a etapa 2 ("beef") foi iniciada E
// finalizada às 15:19 com a etapa 1 ("gessado") ainda **AGUARDANDO**. O tablet mostrava
// *"depois de gessado"* e o botão INICIAR funcionava — **a trava era só visual**. É a classe
// "o menu esconde e a rota nega": esconder o botão não impede a chamada.
//
// ⚠️ E aqui o estrago é de DADO: moldar beef antes de existir gessado registra uma produção
// que não pode ter acontecido, e o tempo dessa etapa entra na média como se fosse real.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao } from '../ordens'
import { etapasDaOrdem, designarEtapa } from '../etapas'
import { minhasTarefasDeHoje, iniciarTarefa, finalizarTarefa, TarefaError } from '../minhas-tarefas'
import { concluirDoTablet, quemFechouOLote, oQueVaiSerConsumido } from '../concluir-do-tablet'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { saldoItem } from '../../saldo'

const CNPJ = '16180339000188'
let companyId = ''
let fichaId = ''
let produtoId = ''
let acem = ''
let gordura = ''
let cristian = ''
let marcyelle = ''

/** ⚠️ dia no PASSADO: data fixa em posição de relógio que ainda não chegou é bomba */
const HOJE = new Date('2026-09-04T17:00:00.000Z')
const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SEQUENCIA' } })).id
  for (const [nome, custo] of [['Acém', 33.95], ['Gordura', 9.6]] as const) {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    if (nome === 'Acém') acem = it.id; else gordura = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: custo, custoTotal: custo * 50, origem: 'SEFAZ' } })
  }
  const f = await criarFicha({
    companyId, nomeProduzido: 'Beef de hambúrguer', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 10,
    etapas: [{ nome: 'gessado' }, { nome: 'beef' }],
    componentes: [
      { itemId: acem, qtdPlanejada: 0.8, unidade: 'KG', posicao: 0 },
      { itemId: gordura, qtdPlanejada: 0.2, unidade: 'KG', posicao: 1 },
    ],
  }, prisma)
  fichaId = f.fichaId; produtoId = f.itemProduzidoId
  cristian = (await cadastrarPessoa({ companyId, nome: 'Cristian', funcao: 'COZINHA', pin: '4726' }, prisma)).colaboradorId!
  marcyelle = (await cadastrarPessoa({ companyId, nome: 'Marcyelle', funcao: 'COZINHA', pin: '5813' }, prisma)).colaboradorId!
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  for (const t of ['stockOrdemEtapa', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** uma ordem com material separado, pronta pra produzir */
async function ordemSeparada(escala = 5) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: escala, dataProducao: HOJE }, prisma)
  await confirmarSeparacao(companyId, ordemId, [
    { itemId: acem, qtdSeparada: 0.8 * escala },
    { itemId: gordura, qtdSeparada: 0.2 * escala },
  ], prisma)
  return ordemId
}

describe('⛔⛔ a sequência é imposta pelo SERVIDOR, não só pela tela', () => {
  it('⛔⛔ iniciar a etapa 2 com a 1 AGUARDANDO é recusado — o bug de 06/09', async () => {
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    expect(es.map((e) => e.nome)).toEqual(['gessado', 'beef'])
    await expect(iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(15) }, prisma))
      .rejects.toThrow(/“gessado” precisa ser feita antes/)
    // ⛔ e NADA foi gravado: recusar tem que ser recusa inteira
    const depois = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    expect(depois[1].estado).toBe('AGUARDANDO')
    expect(depois[1].executorId).toBeNull()
  })

  it('⛔ com a 1 EM ANDAMENTO também recusa — e a frase é outra', async () => {
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(15) }, prisma))
      .rejects.toThrow(/ainda está em andamento/)
  })

  it('⭐⭐ finalizar a 1 DESTRAVA a 2 — e a tela para de segurar o botão', async () => {
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await designarEtapa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle }, prisma)
    // antes: a tela desabilita (esperandoEtapaAnterior preenchido)
    const antes = (await minhasTarefasDeHoje(companyId, marcyelle, HOJE, prisma))[0]
    expect(antes.esperandoEtapaAnterior).toBe('gessado')

    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(15) }, prisma)

    const depois = (await minhasTarefasDeHoje(companyId, marcyelle, HOJE, prisma))[0]
    expect(depois.esperandoEtapaAnterior, 'a tela continuaria segurando o botão').toBeNull()
    await expect(iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(15, 5) }, prisma))
      .resolves.toBeTruthy()
  })

  it('⭐ a PRIMEIRA etapa nunca é bloqueada (não há anterior)', async () => {
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(14) }, prisma))
      .resolves.toBeTruthy()
  })
})

describe('⭐⭐ o lote fecha na ponta, pelo MESMO motor', () => {
  it('⭐⭐ o fluxo real: gessado (A) → beef (B) → quantos saíram → ordem CONCLUÍDA', async () => {
    const ordemId = await ordemSeparada(5)
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)

    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(15) }, prisma)
    await iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(15, 5) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(16) }, prisma)

    const r = await concluirDoTablet({ companyId, ordemId, qtdGerada: 40, colaboradorId: marcyelle }, prisma)
    expect(r.qtdGerada).toBe(40)

    const ordem = await prisma.stockProductionOrder.findUnique({ where: { id: ordemId }, select: { estado: true } })
    expect(ordem!.estado).toBe('CONCLUIDA')
    // ⭐ o produto ENTROU no estoque com o custo real, pelo motor de sempre
    expect((await saldoItem(prisma, companyId, produtoId)).saldo).toBe(40)
    // 4 kg de acém (33,95) + 1 kg de gordura (9,60) = 145,40 → 3,635/un
    expect(r.custoLoteReal).toBeCloseTo(145.4, 2)
    expect(r.custoUnitarioReal).toBeCloseTo(3.64, 2)
  })

  it('⭐⭐ "quem produziu" DERIVA das etapas — quem fechou o lote assina', async () => {
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(15) }, prisma)
    await iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(15, 5) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(16) }, prisma)

    // ⚠️ a conclusão comporta UM nome: grava quem FECHOU. A atribuição por mão vive nas
    // etapas, e é dela que o relatório por pessoa tira tempo e volume.
    expect(await quemFechouOLote(companyId, ordemId, prisma)).toBe(marcyelle)
    const r = await concluirDoTablet({ companyId, ordemId, qtdGerada: 30, colaboradorId: cristian }, prisma)
    const c = await prisma.stockProducaoConclusao.findUnique({ where: { id: r.conclusaoId }, select: { colaboradorId: true } })
    expect(c!.colaboradorId, 'gravou quem passou no argumento, não quem fechou').toBe(marcyelle)
  })

  it('⛔⛔ consome TUDO que foi separado — e a tela mostra isso ANTES de perguntar', async () => {
    const ordemId = await ordemSeparada(5)
    const consumo = await oQueVaiSerConsumido(companyId, ordemId, prisma)
    expect(consumo.map((c) => c.nome).sort()).toEqual(['Acém', 'Gordura'])
    expect(consumo.find((c) => c.nome === 'Acém')!.qtd).toBeCloseTo(4, 3)
    // ⚠️ quem está no tablet não pesa sobra: se sobrou, ele NÃO finaliza — a tela diz isso.
    const r = await concluirDoTablet({ companyId, ordemId, qtdGerada: 40, colaboradorId: cristian }, prisma)
    expect(r.custoLoteReal).toBeCloseTo(145.4, 2)
    // e o em-produção zera (nada ficou pendurado)
    expect(await oQueVaiSerConsumido(companyId, ordemId, prisma)).toEqual([])
  })

  it('⛔ ordem sem material separado é recusada com frase que ensina', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: HOJE }, prisma)
    await expect(concluirDoTablet({ companyId, ordemId, qtdGerada: 10, colaboradorId: cristian }, prisma))
      .rejects.toThrow(/Não há material separado/)
  })

  it('⭐ a lista do tablet diz qual etapa é a ÚLTIMA (é ela que pergunta o número)', async () => {
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await designarEtapa({ companyId, etapaId: es[0].id, colaboradorId: cristian }, prisma)
    await designarEtapa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle }, prisma)
    expect((await minhasTarefasDeHoje(companyId, cristian, HOJE, prisma))[0].ultima, 'gessado não é a última').toBe(false)
    expect((await minhasTarefasDeHoje(companyId, marcyelle, HOJE, prisma))[0].ultima, 'beef é a última').toBe(true)
  })

  it('⭐ receita sem etapas: a etapa única É a última — o fluxo vale igual', async () => {
    const sem = await criarFicha({
      companyId, nomeProduzido: 'Porção avulsa', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: acem, qtdPlanejada: 1, unidade: 'KG', posicao: 0 }],
    }, prisma)
    const { ordemId } = await criarOrdem({ companyId, fichaId: sem.fichaId, escalaReceitas: 2, dataProducao: HOJE }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 2 }], prisma)
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await designarEtapa({ companyId, etapaId: es[0].id, colaboradorId: cristian }, prisma)
    expect((await minhasTarefasDeHoje(companyId, cristian, HOJE, prisma))[0].ultima).toBe(true)
  })
})
