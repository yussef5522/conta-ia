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
import { relatorioPorPessoa } from '../relatorio-por-pessoa'
import { tarefasAbertasDemais } from '../minhas-tarefas'
import { cancelarOrdem } from '../ordens'
import { concluir } from '../conclusao'
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

describe('⛔⛔ ordem CANCELADA fica FORA do relatório por pessoa', () => {
  // **Decisão do dono (06/09):** *"trabalho em ordem que não produziu não entra na média de
  // ninguém"*. O caso real: a ordem de teste do beef foi cancelada, e a etapa de 3 segundos
  // que ficou nela entrava no TEMPO do Cristian **sem quantidade junto** — o `min/un` subia
  // por trabalho que não existiu.
  it('⛔⛔ etapa feita em ordem cancelada tem ZERO efeito no min/un', async () => {
    // 1. uma produção de VERDADE, pra existir uma média
    const boa = await ordemSeparada(5)
    const eb = await etapasDaOrdem(companyId, boa, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: eb[0].id, colaboradorId: cristian, agora: emSP(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: eb[0].id, colaboradorId: cristian, agora: emSP(9) }, prisma)
    await iniciarTarefa({ companyId, etapaId: eb[1].id, colaboradorId: cristian, agora: emSP(9) }, prisma)
    await finalizarTarefa({ companyId, etapaId: eb[1].id, colaboradorId: cristian, agora: emSP(10) }, prisma)
    await concluirDoTablet({ companyId, ordemId: boa, qtdGerada: 40, colaboradorId: cristian }, prisma)

    const antes = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    const pAntes = antes.pessoas.find((p) => p.nome === 'Cristian')!
    expect(pAntes.tarefas).toBe(2)
    expect(pAntes.minutos).toBe(120)

    // 2. agora uma ordem que ele trabalhou e o dono CANCELOU
    const ruim = await ordemSeparada(5)
    const er = await etapasDaOrdem(companyId, ruim, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: er[0].id, colaboradorId: cristian, agora: emSP(11) }, prisma)
    await finalizarTarefa({ companyId, etapaId: er[0].id, colaboradorId: cristian, agora: emSP(13) }, prisma)
    await cancelarOrdem(companyId, ruim, prisma)

    const depois = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    const pDepois = depois.pessoas.find((p) => p.nome === 'Cristian')!
    // ⭐ IDÊNTICO: as 2h da ordem cancelada não entraram em tarefa, tempo nem min/un
    expect(pDepois.tarefas, 'a etapa cancelada virou tarefa').toBe(pAntes.tarefas)
    expect(pDepois.minutos, 'as 2h da ordem cancelada entraram no tempo').toBe(pAntes.minutos)
    expect(pDepois.minPorUnidade).toBe(pAntes.minPorUnidade)
  })

  it('⛔ e a tarefa ABERTA de ordem cancelada não vira alarme', async () => {
    const ruim = await ordemSeparada()
    const er = await etapasDaOrdem(companyId, ruim, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: er[0].id, colaboradorId: cristian, agora: emSP(8) }, prisma)
    expect(await tarefasAbertasDemais(companyId, emSP(14), prisma), 'antes de cancelar, alarma').toHaveLength(1)
    await cancelarOrdem(companyId, ruim, prisma)
    expect(await tarefasAbertasDemais(companyId, emSP(14), prisma), 'ordem cancelada continuou cobrando').toHaveLength(0)
  })

  // ⛔⛔ TESTE INVERTIDO EM 06/09, COM O MOTIVO ESCRITO — a regra caiu por EVIDÊNCIA.
  //
  // Ele afirmava que a etapa **continua EM_ANDAMENTO** depois da conclusão pelo encarregado,
  // e chamava isso de "rastro honesto". **Não era honesto: era uma fresta.** O dono achou em
  // prod — a etapa da Carlise ficou aberta 7h05 **sem nenhum gesto que a resolvesse** (o
  // tablet recusa ordem encerrada, a Produção não tinha botão), e o "HOJE ao vivo" a mostrava
  // como *"fazendo há 7h05"*: o retrato do presente mentindo por uma ordem que já acabou.
  //
  // ⚠️ A metade CERTA da regra antiga fica de pé e continua travada aqui: **não se inventa
  // `finalizadoEm`** e **o alarme não cobra**. O que muda é que agora o estado tem NOME
  // (`ENCERRADA_SEM_FINALIZAR`) em vez de fingir que o trabalho segue em curso.
  it('⛔⛔ concluir pelo encarregado ENCERRA a etapa aberta — sem inventar tempo, sem cobrar', async () => {
    // ⭐ O CAMINHO DO ENCARREGADO: sobrou material → a cozinha NÃO finaliza → ele conclui
    // pela tela de Produção ajustando o consumo.
    const ordemId = await ordemSeparada(5)
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(9) }, prisma)
    await iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(9) }, prisma)
    // ⚠️ a cozinha NÃO finaliza (sobrou material). O encarregado conclui com consumo AJUSTADO:
    const r = await concluir({
      companyId, ordemId, qtdGerada: 35,
      consumo: [{ itemId: acem, qtdConsumida: 3.5 }, { itemId: gordura, qtdConsumida: 0.9 }],
    }, prisma)
    expect(r.qtdGerada).toBe(35)
    expect((await prisma.stockProductionOrder.findUnique({ where: { id: ordemId } }))!.estado).toBe('CONCLUIDA')
    // ⭐ a ordem LEVOU a etapa junto — estado próprio, e o rastro de quem começou continua
    const etapa = (await etapasDaOrdem(companyId, ordemId, emSP(20), prisma))[1]
    expect(etapa.estado, 'a etapa ficou "em andamento" pra sempre — a fresta de 06/09').toBe('ENCERRADA_SEM_FINALIZAR')
    expect(etapa.executorNome).toBe('Marcyelle')
    // ⛔ e NÃO inventou tempo: o cronômetro de 11h não virou uma medição
    expect(etapa.minutos, 'o tempo de uma etapa que ninguém finalizou virou fato').toBeNull()
    expect((await prisma.stockOrdemEtapa.findUnique({ where: { id: es[1].id } }))!.finalizadoEm).toBeNull()
    // …e continua NÃO cobrando: a ordem já fechou, não há o que fazer
    expect(await tarefasAbertasDemais(companyId, emSP(20), prisma)).toHaveLength(0)
  })

  it('⭐ ordem EM PRODUÇÃO sem conclusão CONTINUA contando — a exclusão é pelo ESTADO', async () => {
    // ⚠️ excluir "ordem sem conclusão" esconderia o trabalho em curso. A régua é o estado.
    const ordemId = await ordemSeparada()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(9) }, prisma)
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    expect(r.pessoas.find((p) => p.nome === 'Cristian')!.tarefas).toBe(1)
  })
})
