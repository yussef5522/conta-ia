// ⛔⛔ A FRESTA ENTRE OS DOIS CAMINHOS (06/09/2026).
//
// **CASO REAL:** etapa iniciada com o PIN da Carlise às 16:38; a ordem foi concluída pela
// **tela de Produção** (o caminho do encarregado). A etapa ficou **aberta há 7h05 e sem
// nenhum gesto que a resolvesse** — o tablet recusa (ordem encerrada) e a Produção não tinha
// botão. E o "HOJE ao vivo" a contava no AGORA: *"Carlise · fazendo há 7h05"* — o retrato do
// presente mentindo por causa de uma ordem que já acabou.
//
// ⛔ **NÃO É "FINALIZAR POR ELA":** sem `finalizadoEm`, tempo = a apurar, fora das médias.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, cancelarOrdem } from '../ordens'
import { etapasDaOrdem, designarEtapa } from '../etapas'
import { iniciarTarefa, finalizarTarefa, tarefasAbertasDemais } from '../minhas-tarefas'
import { concluir } from '../conclusao'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { diaAoVivo } from '../dia-ao-vivo'
import { relatorioPorPessoa } from '../relatorio-por-pessoa'
import { etapasAbertasDaOrdem, avisoDeEtapasAbertas } from '../encerrar-etapas-abertas'

const CNPJ = '30447291000133'
let companyId = ''
let fichaId = ''
let acem = ''
let gordura = ''
let carlise = ''
let nadine = ''

/** ⚠️ dia no PASSADO: data fixa em posição de relógio que ainda não chegou é bomba */
const DIA = '2026-09-04'
const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))
const AGORA = emSP(23, 43) // 7h05 depois das 16:38 — o instante exato do caso real

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'FRESTA' } })).id
  for (const [nome, custo] of [['Acém', 33.95], ['Gordura', 9.6]] as const) {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    if (nome === 'Acém') acem = it.id; else gordura = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 200, custoUnitario: custo, custoTotal: custo * 200, origem: 'SEFAZ' } })
  }
  fichaId = (await criarFicha({
    companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 10, unidadeLoteBase: 'KG', validadeDias: 10,
    etapas: [{ nome: 'gessado' }, { nome: 'moldar beef' }],
    componentes: [
      { itemId: acem, qtdPlanejada: 0.8, unidade: 'KG', posicao: 0 },
      { itemId: gordura, qtdPlanejada: 0.2, unidade: 'KG', posicao: 1 },
    ],
  }, prisma)).fichaId
  carlise = (await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)).colaboradorId!
  nadine = (await cadastrarPessoa({ companyId, nome: 'Nadine', funcao: 'COZINHA', pin: '5813' }, prisma)).colaboradorId!
})

afterEach(async () => {
  for (const t of ['stockEtapaEncerrada', 'stockOrdemEtapa', 'stockProducaoDesvio', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

async function ordemSeparada(escala = 5) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: escala, dataProducao: emSP(6) }, prisma)
  await confirmarSeparacao(companyId, ordemId, [
    { itemId: acem, qtdSeparada: 0.8 * escala },
    { itemId: gordura, qtdSeparada: 0.2 * escala },
  ], prisma)
  return ordemId
}

/** o cenário do caso real: a etapa da Carlise aberta desde as 16:38 */
async function ordemComEtapaAberta() {
  const ordemId = await ordemSeparada()
  const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
  await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
  await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
  await prisma.stockOrdemEtapa.update({ where: { id: e1.id }, data: { iniciadoEm: emSP(16, 38) } })
  return { ordemId, etapaId: e1.id }
}

const concluirPelaProducao = (ordemId: string, escala = 5) => concluir({
  companyId, ordemId, qtdGerada: 40, userId: 'user-encarregado',
  consumo: [{ itemId: acem, qtdConsumida: 0.8 * escala }, { itemId: gordura, qtdConsumida: 0.2 * escala }],
}, prisma)

describe('⛔⛔ a ordem LEVA a etapa aberta junto — e registra que levou', () => {
  it('⛔⛔ concluir pela Produção com etapa aberta → ENCERRADA_SEM_FINALIZAR, com rastro', async () => {
    const { ordemId, etapaId } = await ordemComEtapaAberta()
    await concluirPelaProducao(ordemId)

    const reg = await prisma.stockEtapaEncerrada.findFirst({ where: { companyId, etapaId } })
    expect(reg, 'a ordem encerrou e a etapa ficou órfã, sem registro nenhum').toBeTruthy()
    expect(reg!.motivo).toBe('ORDEM_CONCLUIDA')
    expect(reg!.encerradaPorId, 'sem autor não há rastro').toBe('user-encarregado')

    // ⛔ E NÃO INVENTOU TEMPO: sem `finalizadoEm`, o tempo é "a apurar"
    const etapa = await prisma.stockOrdemEtapa.findUnique({ where: { id: etapaId } })
    expect(etapa!.finalizadoEm, 'carimbou um fim que ninguém mediu').toBeNull()
    expect(etapa!.executorId, 'o rastro de quem começou não se apaga').toBeTruthy()

    const [vista] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    expect(vista.estado).toBe('ENCERRADA_SEM_FINALIZAR')
    expect(vista.minutos, '7h05 de cronômetro viraram um tempo medido').toBeNull()
    expect(vista.encerradaPor).toBe('ORDEM_CONCLUIDA')
  })

  it('⛔ cancelar também leva junto — e diz que foi cancelamento', async () => {
    const { ordemId, etapaId } = await ordemComEtapaAberta()
    await cancelarOrdem(companyId, ordemId, prisma, 'user-encarregado')
    const reg = await prisma.stockEtapaEncerrada.findFirst({ where: { companyId, etapaId } })
    expect(reg?.motivo).toBe('ORDEM_CANCELADA')
  })

  it('⚠️ conclusão PARCIAL não encerra — o trabalho continua', async () => {
    // ⛔ encerrar aqui mataria a etapa de quem ainda está com a mão na massa
    const { ordemId, etapaId } = await ordemComEtapaAberta()
    await concluir({
      companyId, ordemId, qtdGerada: 10, parcial: true, userId: 'u',
      consumo: [{ itemId: acem, qtdConsumida: 1 }],
    }, prisma)
    expect(await prisma.stockEtapaEncerrada.count({ where: { companyId, etapaId } })).toBe(0)
    const [vista] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    expect(vista.estado, 'a parcial encerrou uma etapa que ainda está sendo feita').toBe('EM_ANDAMENTO')
  })

  it('⭐ ordem SEM etapa aberta conclui sem registrar nada', async () => {
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await finalizarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await concluirPelaProducao(ordemId)
    expect(await prisma.stockEtapaEncerrada.count({ where: { companyId } })).toBe(0)
    const [vista] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    expect(vista.estado, 'etapa finalizada no tablet virou "encerrada sem finalizar"').toBe('FEITA')
  })

  it('⛔⛔ encerrar a MESMA etapa 2× é impossível — a trava é do banco', async () => {
    const { ordemId, etapaId } = await ordemComEtapaAberta()
    await concluirPelaProducao(ordemId)
    await expect(prisma.stockEtapaEncerrada.create({
      data: { companyId, etapaId, ordemId, motivo: 'ORDEM_CANCELADA' },
    }), 'duas verdades sobre o mesmo encerramento').rejects.toThrow()
  })
})

describe('⛔⛔ o AGORA volta a ser o retrato do presente', () => {
  it('⛔⛔ a etapa da ordem encerrada SAI do AGORA — não é mais "fazendo há 7h05"', async () => {
    const { ordemId } = await ordemComEtapaAberta()

    const antes = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(antes.agora, 'com a ordem VIVA ela tem que estar no AGORA').toHaveLength(1)
    expect(antes.agora[0].tarefa.abertaDemais).toBe(true)

    await concluirPelaProducao(ordemId)

    const depois = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(depois.agora, 'ordem encerrada seguiu no retrato do presente').toHaveLength(0)
    expect(depois.abertasDemais).toBe(0)
  })

  it('⭐ mas ela APARECE no dia da pessoa, rotulada pelo que é', async () => {
    // ⚠️ sumir seria esconder que alguém começou um trabalho; dizer "fazendo há 7h05" é o
    // retrato mentindo. A saída é o rótulo honesto.
    const { ordemId } = await ordemComEtapaAberta()
    await concluirPelaProducao(ordemId)

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const dela = d.pessoas.find((p) => p.colaboradorId === carlise)!
    expect(dela.tarefas).toHaveLength(1)
    expect(dela.tarefas[0].estado).toBe('ENCERRADA_SEM_FINALIZAR')
    expect(dela.tarefas[0].rotulo).toBe('ficou aberta — a ordem foi concluída pela Produção')
    // ⚠️ e o CABEÇALHO fecha com a lista: uma linha visível que o resumo não conta é a
    // mesma doença do card `PRONTOS −72`.
    expect(dela).toMatchObject({ fazendo: 0, naFila: 0, feitas: 0, encerradas: 1 })
  })

  it('⭐ e na linha do tempo o INICIOU fica, com o rótulo ao lado', async () => {
    const { ordemId } = await ordemComEtapaAberta()
    await concluirPelaProducao(ordemId)
    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const iniciou = d.linhaDoTempo.find((e) => e.tipo === 'INICIOU')!
    expect(iniciou, 'apagar o INICIOU esconderia trabalho que aconteceu').toBeTruthy()
    expect(iniciou.rotulo).toMatch(/concluída pela Produção/)
  })

  it('⭐ etapa de ordem VIVA continua contando normal — a trava é estreita', async () => {
    await ordemComEtapaAberta()
    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora).toHaveLength(1)
    expect(d.agora[0].tarefa.estado).toBe('EM_ANDAMENTO')
    expect(d.pessoas.find((p) => p.colaboradorId === carlise)).toMatchObject({ fazendo: 1, encerradas: 0 })
  })

  it('⛔⛔ e o RETROATIVO sai de graça: a tela já fala a verdade sem o registro', async () => {
    // ⚠️ o estado é derivado da ORDEM, não do registro — então a etapa da Carlise (aberta
    // antes deste fix existir) já aparece certa mesmo sem `stock_etapa_encerrada`. O registro
    // acrescenta o RASTRO; ele nunca é o que impede a tela de mentir.
    const { ordemId, etapaId } = await ordemComEtapaAberta()
    await concluirPelaProducao(ordemId)
    await prisma.stockEtapaEncerrada.deleteMany({ where: { companyId, etapaId } })

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora, 'sem o registro a tela voltou a dizer "fazendo"').toHaveLength(0)
    expect(d.pessoas.find((p) => p.colaboradorId === carlise)!.tarefas[0].estado).toBe('ENCERRADA_SEM_FINALIZAR')
  })
})

describe('⛔ fora das médias, e fora do alarme', () => {
  it('⛔⛔ o tempo NÃO entra no relatório por pessoa', async () => {
    const { ordemId } = await ordemComEtapaAberta()
    await concluirPelaProducao(ordemId)
    const r = await relatorioPorPessoa({ companyId, de: DIA, ate: DIA }, prisma)
    const dela = r.pessoas.find((p) => p.colaboradorId === carlise)
    expect(dela, '7h05 de cronômetro entraram na média de min/un dela').toBeUndefined()
  })

  it('⭐ e o alarme de 4h também não a cobra — não há o que cobrar', async () => {
    const { ordemId } = await ordemComEtapaAberta()
    expect(await tarefasAbertasDemais(companyId, AGORA, prisma), 'com a ordem viva o alarme TEM que morder').toHaveLength(1)
    await concluirPelaProducao(ordemId)
    expect(await tarefasAbertasDemais(companyId, AGORA, prisma)).toHaveLength(0)
  })
})

describe('⭐ o aviso no caminho do encarregado', () => {
  it('⭐⭐ a tela sabe QUAIS etapas serão levadas, com nome e pessoa', async () => {
    const { ordemId } = await ordemComEtapaAberta()
    const abertas = await etapasAbertasDaOrdem(companyId, ordemId, prisma)
    expect(abertas).toHaveLength(1)
    expect(abertas[0]).toMatchObject({ nome: 'gessado', executorNome: 'Carlise' })
  })

  it('⭐ e a frase ENSINA A SAÍDA — aviso que só comunica estrago é aviso que se ignora', async () => {
    const frase = avisoDeEtapasAbertas([{ nome: 'gessado', executorNome: 'Carlise' }])!
    expect(frase).toContain('“gessado” (Carlise)')
    expect(frase).toContain('sem tempo medido')
    expect(frase, 'o aviso não diz o que fazer').toMatch(/finalizar no tablet primeiro/)
  })

  it('⭐ sem etapa aberta não há aviso — e etapa que nunca começou não conta', async () => {
    const ordemId = await ordemSeparada()
    const [, e2] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e2.id, colaboradorId: nadine }, prisma)
    // designada mas NUNCA iniciada: não há nada pendurado nela
    expect(await etapasAbertasDaOrdem(companyId, ordemId, prisma)).toHaveLength(0)
    expect(avisoDeEtapasAbertas([])).toBeNull()
  })

  it('⚠️ duas etapas abertas → a frase vai no plural, com as duas', async () => {
    const frase = avisoDeEtapasAbertas([
      { nome: 'gessado', executorNome: 'Carlise' }, { nome: 'moldar beef', executorNome: null },
    ])!
    expect(frase).toContain('As etapas')
    expect(frase).toContain('“gessado” (Carlise) e “moldar beef”')
    expect(frase).toContain('estão abertas')
  })
})
