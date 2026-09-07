// ⭐⭐ OS DOIS GESTOS DO GERENTE, E OS 5 ESTADOS IGUAIS NAS 3 TELAS (07/09/2026).
//
// **A ordem do dono:** *"gerente NUNCA fica preso olhando uma etapa aberta sem poder agir"* e
// *"cada estado com UMA cara em TODAS as telas — 'na fila' + ordem concluída não pode existir
// por construção"*.
//
// ⛔ A diferença entre os dois gestos é a QUALIDADE DO DADO: **pedir** produz tempo MEDIDO
// (ela aperta com o PIN dela); **finalizar pelo gerente** produz tempo **A APURAR**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao } from '../ordens'
import { etapasDaOrdem, designarEtapa } from '../etapas'
import { iniciarTarefa, finalizarTarefa, minhasTarefasDeHoje, tarefasAbertasDemais } from '../minhas-tarefas'
import { concluir } from '../conclusao'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { diaAoVivo } from '../dia-ao-vivo'
import { relatorioPorPessoa } from '../relatorio-por-pessoa'
import { pedirPraFinalizar, finalizarPeloGerente, GestoError } from '../gestos-do-gerente'
import { derivarEstadoDaEtapa, rotuloDoEstado, temTempoMedido } from '../estado-da-etapa'

const CNPJ = '55901224000144'
let companyId = ''
let fichaId = ''
let acem = ''
let gordura = ''
let carlise = ''
let userGerente = ''

const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))
const AGORA = emSP(18, 0)
const DIA = '2026-09-04'

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: 'gerente-gestos@teste.local' } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'GESTOS' } })).id
  userGerente = (await prisma.user.create({ data: { email: 'gerente-gestos@teste.local', name: 'Yussef', password: 'x' } })).id
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
})

afterEach(async () => {
  for (const t of ['stockEtapaPedidoFinalizar', 'stockEtapaFinalizadaGerente', 'stockEtapaEncerrada', 'stockOrdemEtapa', 'stockProducaoDesvio', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userGerente } })
})

/** uma etapa da Carlise aberta desde as 16:38 — o cenário do caso real */
async function etapaAberta() {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: emSP(6) }, prisma)
  await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 4 }, { itemId: gordura, qtdSeparada: 1 }], prisma)
  const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
  await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
  await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
  await prisma.stockOrdemEtapa.update({ where: { id: e1.id }, data: { iniciadoEm: emSP(16, 38) } })
  return { ordemId, etapaId: e1.id }
}

describe('⭐⭐ gesto 1 — PEDIR PRA FINALIZAR (o caminho preferido)', () => {
  it('⭐⭐ o recado aparece no tablet DELA, e finalizar com o PIN dá tempo MEDIDO', async () => {
    const { ordemId, etapaId } = await etapaAberta()

    const antes = await minhasTarefasDeHoje(companyId, carlise, AGORA, prisma)
    expect(antes[0].pedidoPraFinalizar, 'nasceu com recado sem ninguém ter pedido').toBe(false)

    await pedirPraFinalizar({ companyId, etapaId, userId: userGerente }, prisma)

    const depois = await minhasTarefasDeHoje(companyId, carlise, AGORA, prisma)
    expect(depois[0].pedidoPraFinalizar, 'o recado não chegou no tablet dela').toBe(true)
    // ⚠️ é RECADO, não ordem: a tarefa continua EM_ANDAMENTO e o botão é o mesmo
    expect(depois[0].estado).toBe('EM_ANDAMENTO')

    // ⭐ ela finaliza com o PIN dela → o tempo é DELA e é MEDIDO
    await finalizarTarefa({ companyId, etapaId, colaboradorId: carlise, agora: emSP(17, 38) }, prisma)
    const [vista] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    expect(vista.estado).toBe('FEITA')
    expect(vista.minutos, '16:38 → 17:38 é uma hora medida').toBe(60)
    expect(vista.executorNome).toBe('Carlise')

    // ⭐ e o pedido fica marcado como ATENDIDO — pedido não atendido é informação de gestão
    const ped = await prisma.stockEtapaPedidoFinalizar.findFirst({ where: { companyId, etapaId } })
    expect(ped!.atendidoEm).not.toBeNull()
  })

  it('⛔ o tempo DELA entra na média — é pra isso que este gesto existe', async () => {
    const { etapaId } = await etapaAberta()
    await pedirPraFinalizar({ companyId, etapaId, userId: userGerente }, prisma)
    await finalizarTarefa({ companyId, etapaId, colaboradorId: carlise, agora: emSP(17, 38) }, prisma)
    const r = await relatorioPorPessoa({ companyId, de: DIA, ate: DIA }, prisma)
    const dela = r.pessoas.find((p) => p.colaboradorId === carlise)!
    expect(dela.minutos).toBe(60)
    expect(dela.semTempoMedido).toBe(0)
  })

  it('⚠️ pedir 2× é REENVIAR, não empilhar recado', async () => {
    const { etapaId } = await etapaAberta()
    await pedirPraFinalizar({ companyId, etapaId, userId: userGerente }, prisma)
    const p1 = await prisma.stockEtapaPedidoFinalizar.findFirst({ where: { companyId, etapaId } })
    await pedirPraFinalizar({ companyId, etapaId, userId: userGerente }, prisma)
    const todos = await prisma.stockEtapaPedidoFinalizar.findMany({ where: { companyId, etapaId } })
    expect(todos, 'três recados iguais ensinam a pessoa a ignorar recado').toHaveLength(1)
    expect(todos[0].pedidoEm.getTime()).toBeGreaterThanOrEqual(p1!.pedidoEm.getTime())
  })

  it('⛔ não dá pra pedir o que não começou nem o que já acabou', async () => {
    const { ordemId, etapaId } = await etapaAberta()
    const [, e2] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await expect(pedirPraFinalizar({ companyId, etapaId: e2.id }, prisma)).rejects.toThrow(GestoError)
    await finalizarTarefa({ companyId, etapaId, colaboradorId: carlise, agora: emSP(17) }, prisma)
    await expect(pedirPraFinalizar({ companyId, etapaId }, prisma)).rejects.toThrow(/já foi encerrada/)
  })
})

describe('⛔⛔ gesto 2 — FINALIZAR PELO GERENTE (sem inventar tempo)', () => {
  it('⛔⛔ estado próprio, tempo A APURAR, e o rastro diz QUEM apertou', async () => {
    const { ordemId, etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)

    const [vista] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    expect(vista.estado).toBe('FINALIZADA_PELO_GERENTE')
    expect(vista.minutos, 'o gerente não sabe quando ela parou — tempo não se inventa').toBeNull()
    // ⭐ o rastro: por X em nome de Y — NUNCA "entrar na conta dela"
    expect(vista.finalizadaPorNome).toBe('Yussef')
    expect(vista.emNomeDeNome).toBe('Carlise')
    expect(vista.rotulo).toBe('finalizada por Yussef em nome de Carlise · tempo a apurar')

    // ⛔⛔ E O `finalizadoEm` DA ETAPA CONTINUA NULL — é isso que mantém o tempo fora de
    // TODA média por construção, e não uma lista de exceções que alguém esquece de copiar.
    const etapa = await prisma.stockOrdemEtapa.findUnique({ where: { id: etapaId } })
    expect(etapa!.finalizadoEm, 'carimbou um fim que ninguém mediu').toBeNull()
  })

  it('⛔⛔ a tarefa CONTA no dia dela, mas o tempo NÃO entra na média', async () => {
    const { etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)
    const r = await relatorioPorPessoa({ companyId, de: DIA, ate: DIA }, prisma)
    const dela = r.pessoas.find((p) => p.colaboradorId === carlise)!
    expect(dela.tarefas, 'a tarefa dela sumiu do relatório').toBe(1)
    expect(dela.minutos, '1h22 de cronômetro entraram como tempo medido').toBe(0)
    expect(dela.semTempoMedido).toBe(1)
    // ⛔⛔ E A TAXA NÃO EXISTE: contar as UNIDADES sem os MINUTOS faria ela parecer MAIS
    // RÁPIDA justamente na tarefa em que ninguém cronometrou nada.
    expect(dela.minPorUnidade, 'a taxa nasceu de um numerador que ninguém mediu').toBeNull()
  })

  it('⛔⛔ O CASO QUE MORDE — uma tarefa MEDIDA + uma do gerente: a taxa não pode melhorar', async () => {
    // ⚠️⚠️ REGRA 11, e o guard anterior passava pelo MOTIVO ERRADO: com só a tarefa do
    // gerente, `minutosMedidos` fica 0 e a taxa sai null de qualquer jeito — repor o defeito
    // deixava os 16 testes VERDES. O cenário que executa a linha é o MISTO: um numerador que
    // já existe (a tarefa medida) e as unidades da tarefa do gerente entrando no denominador.
    // Aí ela apareceria MAIS RÁPIDA justamente onde ninguém cronometrou nada.
    const a = await etapaAberta()
    await finalizarTarefa({ companyId, etapaId: a.etapaId, colaboradorId: carlise, agora: emSP(17, 38) }, prisma)
    await concluir({
      companyId, ordemId: a.ordemId, qtdGerada: 60, userId: userGerente,
      consumo: [{ itemId: acem, qtdConsumida: 4 }, { itemId: gordura, qtdConsumida: 1 }],
    }, prisma)

    const b = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId: b.etapaId, userId: userGerente }, prisma)
    await concluir({
      companyId, ordemId: b.ordemId, qtdGerada: 60, userId: userGerente,
      consumo: [{ itemId: acem, qtdConsumida: 4 }, { itemId: gordura, qtdConsumida: 1 }],
    }, prisma)

    const r = await relatorioPorPessoa({ companyId, de: DIA, ate: DIA }, prisma)
    const dela = r.pessoas.find((p) => p.colaboradorId === carlise)!
    expect(dela.tarefas, 'as duas tarefas contam no dia dela').toBe(2)
    expect(dela.semTempoMedido).toBe(1)
    // ⭐ a taxa é 60min ÷ 60 un = 1,0 min/un — só a ordem MEDIDA entra nos dois lados.
    // ⛔ Com as unidades da tarefa do GERENTE no denominador daria 60 ÷ 120 = 0,5: ela
    // pareceria DUAS VEZES mais rápida por causa de trabalho que ninguém mediu.
    expect(dela.minPorUnidade, 'as unidades da tarefa sem tempo entraram na taxa').toBe(1)
    // ⚠️ e o VOLUME total continua contando as DUAS — o que sai da conta é a TAXA, não a
    // produção: ela produziu mesmo, o que falta é a medição do tempo.
    expect(dela.produziu).toBe(120)
  })

  it('⭐ e o "mais rápido em cada tarefa" também não a premia', async () => {
    const { etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)
    const r = await relatorioPorPessoa({ companyId, de: DIA, ate: DIA }, prisma)
    const gessado = r.porTarefaEquipe.find((t) => t.tarefa === 'gessado')
    expect(gessado?.maisRapido ?? null, 'coroou quem teve o gerente finalizando por ela').toBeNull()
  })

  it('⭐ sai do AGORA e para de cobrar no alarme de 4h', async () => {
    const { etapaId } = await etapaAberta()
    // ⚠️ 16:38 → 23:00 são 6h22: passou das 4h do alarme
    const TARDE = emSP(23, 0)
    expect(await tarefasAbertasDemais(companyId, TARDE, prisma), 'antes do gesto o alarme TEM que morder').toHaveLength(1)
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)
    expect(await tarefasAbertasDemais(companyId, TARDE, prisma)).toHaveLength(0)
    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora).toHaveLength(0)
    // ⚠️ mas a tarefa CONTA como feita no dia dela (decisão do dono)
    expect(d.pessoas.find((p) => p.colaboradorId === carlise)).toMatchObject({ fazendo: 0, feitas: 1 })
  })

  it('⭐ some do tablet dela — o botão que o servidor recusaria não é oferecido', async () => {
    const { etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)
    const t = await minhasTarefasDeHoje(companyId, carlise, AGORA, prisma)
    expect(t.find((x) => x.etapaId === etapaId), 'o tablet ofereceu FINALIZAR numa tarefa já fechada').toBeUndefined()
  })

  it('⛔⛔ finalizar 2× é impossível — a trava é do banco', async () => {
    const { etapaId, ordemId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)
    await expect(prisma.stockEtapaFinalizadaGerente.create({
      data: { companyId, etapaId, ordemId, finalizadaPorId: userGerente },
    })).rejects.toThrow()
  })

  it('⭐ o pedido pendente some quando o gerente finaliza — o recado perdeu o sentido', async () => {
    const { etapaId } = await etapaAberta()
    await pedirPraFinalizar({ companyId, etapaId, userId: userGerente }, prisma)
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)
    const ped = await prisma.stockEtapaPedidoFinalizar.findFirst({ where: { companyId, etapaId } })
    expect(ped!.atendidoEm, 'o tablet dela seguiria pedindo pra finalizar o que já fechou').not.toBeNull()
  })
})

describe('⛔⛔ os 5 estados: UMA derivação, a mesma cara nas 3 telas', () => {
  it('⛔⛔ "na fila" + ordem CONCLUÍDA é impossível por construção — a contradição do print', async () => {
    const { ordemId } = await etapaAberta()
    // a etapa 2 nunca foi iniciada — antes ela ficava "na fila" pra sempre
    await concluir({
      companyId, ordemId, qtdGerada: 40, userId: userGerente,
      consumo: [{ itemId: acem, qtdConsumida: 4 }, { itemId: gordura, qtdConsumida: 1 }],
    }, prisma)

    const etapas = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    for (const e of etapas) {
      expect(e.estado, `“${e.nome}” continuou aberta numa ordem concluída`).toBe('ENCERRADA_SEM_FINALIZAR')
    }
    // ⭐ e o texto distingue quem COMEÇOU de quem nunca pegou — a diferença importa pra
    // quem confere o dia
    expect(etapas[0].rotulo).toBe('ficou aberta — a ordem foi concluída pela Produção')
    expect(etapas[1].rotulo).toBe('não foi feita — a ordem foi concluída pela Produção')

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const dela = d.pessoas.find((p) => p.colaboradorId === carlise)!
    expect(dela.naFila, 'o card da pessoa ainda dizia "na fila" numa ordem concluída').toBe(0)
    expect(dela.fazendo).toBe(0)
  })

  it('⭐⭐ o ESTADO e o RÓTULO da tela da ordem são os MESMOS do "HOJE ao vivo"', async () => {
    // ⚠️ é a lição do B1: duas derivações da mesma pergunta discordam no 1º caso de borda.
    // Este teste roda os DOIS caminhos reais e compara etapa por etapa.
    const { ordemId, etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)

    const daOrdem = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    const doDia = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const noDia = new Map(doDia.pessoas.flatMap((p) => p.tarefas).map((t) => [t.etapaId, t]))
    for (const e of daOrdem) {
      const t = noDia.get(e.id)
      if (!t) continue
      expect(t.estado, `estados diferentes pra “${e.nome}”`).toBe(e.estado)
      expect(t.rotulo, `rótulos diferentes pra “${e.nome}”`).toBe(e.rotulo)
    }
  })

  it('⭐ a derivação PURA cobre os cinco casos, na ordem certa', () => {
    const base = { iniciadoEm: emSP(8), finalizadoEm: null, finalizadaPeloGerente: false, ordemViva: true }
    expect(derivarEstadoDaEtapa({ ...base, iniciadoEm: null })).toBe('AGUARDANDO')
    expect(derivarEstadoDaEtapa(base)).toBe('EM_ANDAMENTO')
    expect(derivarEstadoDaEtapa({ ...base, finalizadoEm: emSP(9) })).toBe('FEITA')
    // ⚠️ o gesto do gerente é MAIS ESPECÍFICO que "a ordem levou junto" — vem primeiro
    expect(derivarEstadoDaEtapa({ ...base, finalizadaPeloGerente: true, ordemViva: false })).toBe('FINALIZADA_PELO_GERENTE')
    expect(derivarEstadoDaEtapa({ ...base, ordemViva: false })).toBe('ENCERRADA_SEM_FINALIZAR')
    // ⛔ e a etapa que nunca começou, em ordem morta, TAMBÉM não volta a ser "na fila"
    expect(derivarEstadoDaEtapa({ ...base, iniciadoEm: null, ordemViva: false })).toBe('ENCERRADA_SEM_FINALIZAR')
  })

  it('⛔ SÓ "FEITA" tem tempo medido — os outros quatro são "a apurar"', () => {
    expect(temTempoMedido('FEITA')).toBe(true)
    for (const e of ['AGUARDANDO', 'EM_ANDAMENTO', 'FINALIZADA_PELO_GERENTE', 'ENCERRADA_SEM_FINALIZAR'] as const) {
      expect(temTempoMedido(e), `${e} entrou na média como tempo medido`).toBe(false)
    }
  })

  it('⭐ o rótulo do gerente cai pra frase genérica quando não há nome', () => {
    expect(rotuloDoEstado('FINALIZADA_PELO_GERENTE')).toBe('finalizada pelo gerente · tempo a apurar')
    expect(rotuloDoEstado('ENCERRADA_SEM_FINALIZAR', { iniciou: true, ordemCancelada: true }))
      .toBe('ficou aberta — a ordem foi cancelada')
  })
})
