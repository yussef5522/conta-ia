/**
 * ⭐⭐ LEI v7 (docs/producao-referencia.html) VIRA SISTEMA — M1, M2, M5 e as contas-pino (12/11/2026).
 *
 * M2 · TAREFA é tipo próprio: escritório cria (nome + instrução + quem/liberada + dia), cai na hora
 *      no tablet, INICIAR → cronômetro → FINALIZAR em UM toque. ⛔ SEM estoque: sem separação, sem
 *      "quantos saíram", sem lote, sem movimento. Regras herdadas: G6 (designada/liberada), G7 (uma
 *      por pessoa), G8 (recado), cancelamento pelo escritório.
 * M1 · "100 UN · 2 receitas" (unidades = receitas × rendimento) e "com {colega}" na dupla.
 * Migração · as receitas-gambiarra são DESATIVADAS, nunca apagadas.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao } from '../ordens'
import { etapasDaOrdem } from '../etapas'
import { iniciarTarefa, minhasTarefasDeHoje, TarefaError } from '../minhas-tarefas'
import { finalizarEConcluirDoTablet } from '../concluir-do-tablet'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { definirPlanoDaEtapa } from '../plano-etapas'
import { designarParticipantes } from '../participantes'
import { pedirPraFinalizar } from '../gestos-do-gerente'
import { criarTarefa, cancelarTarefa, tarefasDoEscritorio, aposentarReceitaQueEraTarefa, TarefaTipoError, TIPOS } from '../tarefa'
import { alvoDoCartao, textoDasReceitas } from '../cartao-da-cozinha'
import { relogioDaTarefa } from '../cronometro'
import { saidaEsperadaDaFicha } from '../escala-da-ordem'
import { dosesImplausiveis } from '../dose-implausivel'
import { rotuloDasConcluidas } from '../rotulos-do-painel'

const CNPJ = '16180339000888'
let companyId = ''
let michele = ''
let edmar = ''
const AGORA = new Date('2026-11-12T16:48:00.000Z') // 13:48 de Brasília
const HOJE = '2026-11-12'
const depois = (min: number) => new Date(AGORA.getTime() + min * 60_000)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LEI V7 TAREFA' } })).id
  michele = (await cadastrarPessoa({ companyId, nome: 'Michele', funcao: 'COZINHA', pin: '2468' }, prisma)).colaboradorId!
  edmar = (await cadastrarPessoa({ companyId, nome: 'Edmar', funcao: 'COZINHA', pin: '1357' }, prisma)).colaboradorId!
})
afterEach(async () => {
  for (const t of ['stockEtapaPedidoFinalizar', 'stockEtapaPlano', 'stockEtapaEncerrada', 'stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockTarefa', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockOrdemMeta', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const cartoes = (quem: string, quando = AGORA) => minhasTarefasDeHoje(companyId, quem, quando, prisma)
const contarEstoque = async () => ({
  mov: await prisma.stockMovement.count({ where: { companyId } }),
  conc: await prisma.stockProducaoConclusao.count({ where: { companyId } }),
  ordens: await prisma.stockProductionOrder.count({ where: { companyId } }),
})

describe('M2 · TAREFA: cai na hora no tablet, INICIAR → FINALIZAR em UM toque, ZERO estoque', () => {
  it('designada à Michele: cartão TAREFA com a instrução; o Edmar não vê (G6)', async () => {
    await criarTarefa({ companyId, nome: 'abrir latas de ervilha', instrucao: '5 latas', quem: michele, dia: HOJE }, prisma)
    const [c] = await cartoes(michele)
    expect(c).toMatchObject({ tipo: 'TAREFA', produto: 'ABRIR LATAS DE ERVILHA', instrucao: '5 LATAS', ultima: false, unidades: null, minha: true })
    expect(await cartoes(edmar)).toHaveLength(0)
  })

  it('INICIAR → FINALIZAR sem quantidade: etapa feita com tempo e assinatura; NENHUM movimento, conclusão ou ordem', async () => {
    const antes = await contarEstoque()
    const { etapaId, tarefaId } = await criarTarefa({ companyId, nome: 'ABRIR MILHO', instrucao: '3 LATAS', quem: michele, dia: HOJE }, prisma)
    await iniciarTarefa({ companyId, etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    expect((await cartoes(michele, depois(1)))[0].estado).toBe('EM_ANDAMENTO')
    const r = await finalizarEConcluirDoTablet({ companyId, etapaId, colaboradorId: michele, agora: depois(9) }, prisma)
    expect(r.concluida).toBeNull()
    const e = await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: etapaId } })
    expect(e.executorId).toBe(michele) // a assinatura é o PIN (G1/G12)
    expect(e.finalizadoEm!.getTime() - e.iniciadoEm!.getTime()).toBe(9 * 60_000)
    expect(await contarEstoque()).toEqual(antes)
    const [t] = await tarefasDoEscritorio(companyId, depois(10), prisma)
    expect(t).toMatchObject({ tarefaId, estado: 'FEITA', quem: ['Michele'] })
    expect(await cartoes(michele, depois(10))).toHaveLength(0)
  })

  it('⛔ tarefa NUNCA fecha lote: pedir "quantos saíram" é recusado ANTES de escrever (a etapa segue aberta)', async () => {
    const { etapaId } = await criarTarefa({ companyId, nome: 'ENCHER TUBO KETCHUP', quem: michele, dia: HOJE }, prisma)
    await iniciarTarefa({ companyId, etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    await expect(finalizarEConcluirDoTablet({ companyId, etapaId, colaboradorId: michele, qtdGerada: 12, agora: depois(5) }, prisma)).rejects.toThrow(/não fecha lote/)
    expect((await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: etapaId } })).finalizadoEm).toBeNull()
    expect((await contarEstoque()).mov).toBe(0)
    expect(TIPOS.TAREFA.fechaLote).toBe(false)
    expect(TIPOS.PRODUCAO.fechaLote).toBe(true)
  })

  it('G7 · uma por pessoa: com a tarefa rodando, a Michele não inicia outra', async () => {
    const a = await criarTarefa({ companyId, nome: 'ABRIR MILHO', quem: michele, dia: HOJE }, prisma)
    const b = await criarTarefa({ companyId, nome: 'ABRIR ERVILHA', quem: michele, dia: HOJE }, prisma)
    await iniciarTarefa({ companyId, etapaId: a.etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: b.etapaId, colaboradorId: michele, agora: depois(1) }, prisma)).rejects.toThrow('Você está com “ABRIR MILHO” em andamento. Finalize antes de começar outra.')
  })

  it('G6 · liberada pra equipe: aparece pra todos como "não é minha"; quem pega fica registrado', async () => {
    const { etapaId } = await criarTarefa({ companyId, nome: 'LAVAR CUBAS', quem: 'EQUIPE', dia: HOJE }, prisma)
    expect((await cartoes(edmar))[0]).toMatchObject({ tipo: 'TAREFA', minha: false })
    await iniciarTarefa({ companyId, etapaId, colaboradorId: edmar, agora: AGORA }, prisma)
    expect((await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: etapaId } })).colaboradorId).toBe(edmar)
  })

  it('G8 · o recado do gerente chega no cartão da tarefa', async () => {
    const { etapaId } = await criarTarefa({ companyId, nome: 'ABRIR MILHO', quem: michele, dia: HOJE }, prisma)
    await iniciarTarefa({ companyId, etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    await pedirPraFinalizar({ companyId, etapaId }, prisma)
    expect((await cartoes(michele, depois(2)))[0].pedidoPraFinalizar).toBe(true)
  })

  it('cancelar (escritório): some do tablet, a rota recusa INICIAR e a pessoa que estava nela fica livre', async () => {
    const a = await criarTarefa({ companyId, nome: 'ABRIR MILHO', quem: michele, dia: HOJE }, prisma)
    const b = await criarTarefa({ companyId, nome: 'ABRIR ERVILHA', quem: michele, dia: HOJE }, prisma)
    await iniciarTarefa({ companyId, etapaId: a.etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    await cancelarTarefa({ companyId, tarefaId: a.tarefaId, userId: 'u-escritorio' }, prisma)
    expect((await cartoes(michele, depois(1))).map((c) => c.produto)).toEqual(['ABRIR ERVILHA'])
    await expect(iniciarTarefa({ companyId, etapaId: a.etapaId, colaboradorId: edmar, agora: depois(1) }, prisma)).rejects.toBeInstanceOf(TarefaError)
    await expect(iniciarTarefa({ companyId, etapaId: b.etapaId, colaboradorId: michele, agora: depois(2) }, prisma)).resolves.toBeTruthy()
    // ⛔ nunca apaga
    expect(await prisma.stockTarefa.count({ where: { companyId } })).toBe(2)
  })

  it('recusas com frase: sem nome, sem quem', async () => {
    await expect(criarTarefa({ companyId, nome: '  ', quem: michele, dia: HOJE }, prisma)).rejects.toBeInstanceOf(TarefaTipoError)
    await expect(criarTarefa({ companyId, nome: 'X', quem: '', dia: HOJE }, prisma)).rejects.toThrow('Escolha quem faz — ou libere pra equipe.')
    expect(await prisma.stockTarefa.count({ where: { companyId } })).toBe(0)
  })

  it('tarefa de amanhã não aparece hoje; a de ontem não feita segue à vista', async () => {
    await criarTarefa({ companyId, nome: 'AMANHA', quem: michele, dia: '2026-11-13' }, prisma)
    await criarTarefa({ companyId, nome: 'ONTEM', quem: michele, dia: '2026-11-11' }, prisma)
    expect((await cartoes(michele)).map((c) => c.produto)).toEqual(['ONTEM'])
  })
})

describe('M1 · o cartão e o cronômetro mostram o ALVO e o COLEGA', () => {
  async function ordemDaMassa() {
    const farinha = await prisma.stockItem.create({ data: { companyId, nome: 'FARINHA ESPECIAL', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: farinha.id, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: 4, custoTotal: 200, origem: 'SEFAZ' } })
    const f = await criarFicha({ companyId, nomeProduzido: 'MEIA BOLINHA DE MASSA', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 50, unidadeLoteBase: 'UN', etapas: [{ nome: 'ABRIR E BOLEAR' }], componentes: [{ itemId: farinha.id, qtdPlanejada: 4.2, unidade: 'KG', posicao: 0 }] }, prisma)
    const { ordemId } = await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 2, dataProducao: AGORA }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: farinha.id, qtdSeparada: 8.4 }], prisma)
    const [e] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    return { ordemId, etapaId: e.id }
  }

  it('pino da lei: 2 receitas × 50 = 100 UN → "100 UN · 2 receitas", na lista E no cronômetro', async () => {
    const o = await ordemDaMassa()
    await definirPlanoDaEtapa({ companyId, etapaId: o.etapaId, liberadaParaEquipe: true }, prisma)
    const [c] = await cartoes(michele)
    expect(c.unidades).toBe(100)
    expect(alvoDoCartao(c)).toEqual({ unidades: '100 UN', receitas: '2 receitas' })
    await iniciarTarefa({ companyId, etapaId: o.etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    const [rodando] = await cartoes(michele, depois(3))
    expect(rodando.estado).toBe('EM_ANDAMENTO')
    expect(alvoDoCartao(rodando).unidades).toBe('100 UN')
    expect(saidaEsperadaDaFicha(2, 20)).toBe(40) // pino da calabresa: 2 × 20 = 40 UN
    expect(textoDasReceitas(1)).toBe('1 receita')
  })

  it('dupla: "com Edmar" no cartão da Michele e "com Michele" no do Edmar; sozinha = null', async () => {
    const o = await ordemDaMassa()
    await designarParticipantes({ companyId, etapaId: o.etapaId, colaboradorIds: [michele, edmar] }, prisma)
    expect((await cartoes(michele))[0].colega).toBe('Edmar')
    expect((await cartoes(edmar))[0].colega).toBe('Michele')
    await designarParticipantes({ companyId, etapaId: o.etapaId, colaboradorIds: [michele] }, prisma)
    expect((await cartoes(michele))[0].colega).toBeNull()
  })

  it('⛔ a cozinha não vê dinheiro: o cartão não carrega custo nenhum', async () => {
    const o = await ordemDaMassa()
    await definirPlanoDaEtapa({ companyId, etapaId: o.etapaId, liberadaParaEquipe: true }, prisma)
    expect(JSON.stringify(await cartoes(michele))).not.toMatch(/custo|R\$|valor/i)
  })
})

describe('as contas-pino da lei', () => {
  it('G3 · cronômetro mm:ss; passado de 60min segue em minutos — 1h15m12s = "75:12"', () => {
    expect(relogioDaTarefa(AGORA.toISOString(), AGORA.getTime() + (75 * 60 + 12) * 1000).texto).toBe('75:12')
    expect(relogioDaTarefa(AGORA.toISOString(), AGORA.getTime() + 727_000).texto).toBe('12:07')
  })
  it('guarda de dose: 1,7 → 0,0001 PERGUNTA (o retrato da Receita de produção)', () => {
    expect(dosesImplausiveis([{ itemId: 'calabresa', qtd: 1.7, versao: 1 }], [{ itemId: 'calabresa', qtd: 0.0001, unidade: 'KG' }], (x) => x)).toHaveLength(1)
    expect(dosesImplausiveis([{ itemId: 'calabresa', qtd: 1.7, versao: 1 }], [{ itemId: 'calabresa', qtd: 1.8, unidade: 'KG' }], (x) => x)).toEqual([])
  })
  it('M5 · "Concluídas" segue o filtro', () => {
    expect(rotuloDasConcluidas('hoje', null)).toBe('Concluídas hoje')
    expect(rotuloDasConcluidas('semana', null)).toBe('Concluídas na semana')
    expect(rotuloDasConcluidas('mes', null)).toBe('Concluídas no mês')
    expect(rotuloDasConcluidas('hoje', { de: '2026-11-01', ate: '2026-11-12' })).toBe('Concluídas no período')
  })
})

describe('migração das gambiarras: DESATIVA, nunca apaga', () => {
  it('ABRIR MILHO com 2 ordens de história: ficha inativa, versões e ordens intactas; idempotente', async () => {
    const milho = await prisma.stockItem.create({ data: { companyId, nome: 'MILHO VERDE', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    const f = await criarFicha({ companyId, nomeProduzido: 'ABRIR MILHO', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', etapas: [{ nome: 'produção' }], componentes: [{ itemId: milho.id, qtdPlanejada: 0.0001, unidade: 'KG', posicao: 0 }] }, prisma)
    await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 2, dataProducao: AGORA }, prisma)
    await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 1, dataProducao: AGORA }, prisma)
    const r = await aposentarReceitaQueEraTarefa(companyId, f.fichaId, prisma)
    expect(r).toMatchObject({ nome: 'ABRIR MILHO', jaEstava: false })
    const ficha = await prisma.stockFicha.findUniqueOrThrow({ where: { id: f.fichaId } })
    expect(ficha.ativo).toBe(false)
    expect(await prisma.stockFichaVersao.count({ where: { companyId, fichaId: f.fichaId } })).toBe(1)
    expect(await prisma.stockProductionOrder.count({ where: { companyId, fichaId: f.fichaId } })).toBe(2)
    expect(await aposentarReceitaQueEraTarefa(companyId, f.fichaId, prisma)).toMatchObject({ jaEstava: true })
  })
  it('receita SEM história também só desativa (nunca o DELETE do excluirFicha)', async () => {
    const f = await criarFicha({ companyId, nomeProduzido: 'ENCHER TUBO KETCHUP', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', etapas: [{ nome: 'produção' }], componentes: [{ itemId: (await prisma.stockItem.create({ data: { companyId, nome: 'CATCHUP', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id, qtdPlanejada: 0.0001, unidade: 'KG', posicao: 0 }] }, prisma)
    await aposentarReceitaQueEraTarefa(companyId, f.fichaId, prisma)
    expect(await prisma.stockFicha.count({ where: { id: f.fichaId } })).toBe(1)
  })
})

describe('⛔ estrutural: TAREFA nunca tem caminho de lote/estoque', () => {
  const sem = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const TAREFA = sem(readFileSync(join(process.cwd(), 'lib/stock/producao/tarefa.ts'), 'utf8'))
  it('o módulo da tarefa não importa nem chama nada de estoque/lote/conclusão', () => {
    expect(TAREFA).not.toMatch(/from '\.\/(ordens|conclusao|concluir-do-tablet|lotes|lista-da-separacao)'|from '@\/lib\/stock\/(movement|saldo)/)
    expect(TAREFA).not.toMatch(/stockMovement|stockProducaoConclusao|stockProductionOrder\.(create|update)|concluir\(|confirmarSeparacao\(/)
  })
})

describe('M7.e (lei v9) · o painel do escritório: tarefa com quem · hora · DURAÇÃO, e segue o período', () => {
  it('a feita traz a hora do fim e os minutos MEDIDOS; a cancelada não tem duração', async () => {
    const a = await criarTarefa({ companyId, nome: 'ABRIR MILHO', instrucao: '3 LATAS', quem: michele, dia: HOJE }, prisma)
    const b = await criarTarefa({ companyId, nome: 'ABRIR ERVILHA', quem: edmar, dia: HOJE }, prisma)
    await iniciarTarefa({ companyId, etapaId: a.etapaId, colaboradorId: michele, agora: AGORA }, prisma)
    await finalizarEConcluirDoTablet({ companyId, etapaId: a.etapaId, colaboradorId: michele, agora: depois(12) }, prisma)
    await cancelarTarefa({ companyId, tarefaId: b.tarefaId, userId: 'u-escritorio' }, prisma)
    const ts = await tarefasDoEscritorio(companyId, depois(30), prisma)
    const feita = ts.find((t) => t.tarefaId === a.tarefaId)!
    expect(feita).toMatchObject({ estado: 'FEITA', minutos: 12, finalizadoEm: depois(12).toISOString() })
    expect(ts.find((t) => t.tarefaId === b.tarefaId)).toMatchObject({ estado: 'CANCELADA', minutos: null })
  })

  it('a feita ONTEM só aparece quando o período a inclui; a viva aparece sempre', async () => {
    const ONTEM = '2026-11-11'
    const ontem = new Date('2026-11-11T15:00:00.000Z')
    const a = await criarTarefa({ companyId, nome: 'ABRIR MILHO', quem: michele, dia: ONTEM }, prisma)
    await iniciarTarefa({ companyId, etapaId: a.etapaId, colaboradorId: michele, agora: ontem }, prisma)
    await finalizarEConcluirDoTablet({ companyId, etapaId: a.etapaId, colaboradorId: michele, agora: new Date(ontem.getTime() + 7 * 60_000) }, prisma)
    const viva = await criarTarefa({ companyId, nome: 'ENCHER TUBO KETCHUP', quem: edmar, dia: ONTEM }, prisma)
    const soHoje = await tarefasDoEscritorio(companyId, AGORA, prisma)
    expect(soHoje.map((t) => t.tarefaId)).toEqual([viva.tarefaId])
    const semana = await tarefasDoEscritorio(companyId, AGORA, prisma, { de: '2026-11-06', ate: HOJE })
    expect(semana.map((t) => t.tarefaId).sort()).toEqual([a.tarefaId, viva.tarefaId].sort())
    expect(semana.find((t) => t.tarefaId === a.tarefaId)!.minutos).toBe(7)
  })
})
