/**
 * ⭐⭐ ROTINAS (lei docs/rotinas-referencia.html, R25–R31, 13/11/2026) — EXECUTADO contra o banco.
 *
 * R25 semeadura idempotente (2× = mesma contagem) · pausada não semeia · regra que não cai hoje não semeia
 * R26 grupo: tique assina com o PIN, conclui SOZINHO no último, nunca com item aberto, sem INICIAR/FINALIZAR
 * R27 atrasada âmbar no dia; o dia seguinte nasce limpo (rotina não migra; avulsa continua migrando)
 * R28 designada → só ela tica; livre → quem chegar
 * R29 excluir: sem história apaga de vez; com história some das telas e as tarefas ficam
 * R31 a tela Rotinas não cria tarefa avulsa: toda tarefa que ela faz nascer tem a origem guardada
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { criarTarefa, tarefasDoEscritorio } from '../tarefa'
import { minhasTarefasDeHoje, iniciarTarefa, finalizarTarefa, TarefaError } from '../minhas-tarefas'
import { tarefasDoPainel } from '../linha-da-tarefa'
import { aoVivo } from '../ao-vivo'
import {
  criarRotina, editarRotina, pausarRotina, excluirRotina, previaExclusaoRotina, semearRotinasDoDia,
  listarRotinas, ticarItem, RotinaError,
} from '../rotinas-do-banco'

const CNPJ = '16180339000925'
let companyId = ''
let michele = ''
let edmar = ''
let userId = ''
// sexta 13/11/2026, 10:40 de Brasília (a amostra da lei)
const AGORA = new Date('2026-11-13T13:40:00.000Z')
const HOJE = '2026-11-13'
const AMANHA = '2026-11-14'
const AS = (hhmm: string, dia = HOJE) => new Date(`${dia}T${hhmm}:00.000-03:00`)

beforeEach(async () => {
  await limpar()
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'ROTINAS V1' } })).id
  michele = (await cadastrarPessoa({ companyId, nome: 'Michele', funcao: 'COZINHA', pin: '2468' }, prisma)).colaboradorId!
  edmar = (await cadastrarPessoa({ companyId, nome: 'Edmar', funcao: 'COZINHA', pin: '1357' }, prisma)).colaboradorId!
  userId = 'u-dono'
})
async function limpar() {
  if (!companyId) return
  // ⚠️ ordem: a tarefa (cascata: vínculo + itens) antes da rotina (FK RESTRICT do vínculo)
  for (const t of ['stockEtapaPlano', 'stockEtapaEncerrada', 'stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockTarefa', 'stockRotina', 'stockColaboradorPin', 'stockColaborador'] as const) {
    await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
}
afterEach(limpar)

const ABERTURA = ['Ligar fritadeiras e chapa', 'Conferir gás e exaustor', 'Água nova do banho-maria', 'Descongelar beef do dia', 'Abastecer molhos da bancada', 'Temperatura do freezer anotada']
const contar = async () => ({
  tarefas: await prisma.stockTarefa.count({ where: { companyId } }),
  vinculos: await prisma.stockTarefaRotina.count({ where: { companyId } }),
  itens: await prisma.stockTarefaItem.count({ where: { companyId } }),
})
const novaAbertura = (extra: Partial<Parameters<typeof criarRotina>[0]> = {}) =>
  criarRotina({ companyId, userId, nome: 'abertura da cozinha', regra: { tipo: 'diaria' }, ate: '11:00', quem: 'LIVRE', itens: ABERTURA, agora: AGORA, ...extra }, prisma)

describe('R25 — semeadura idempotente', () => {
  it('rodar 2× não duplica: a contagem da 1ª e da 2ª rodada é IGUAL', async () => {
    await criarRotina({ companyId, userId, nome: 'temperatura das geladeiras', regra: { tipo: 'diaria' }, ate: '09:00', quem: michele, itens: ['geladeira 1', 'geladeira 2', 'geladeira 3'], agora: AS('00:00') }, prisma)
    await prisma.stockTarefa.deleteMany({ where: { companyId } }) // começa o dia sem nada semeado
    const r1 = await semearRotinasDoDia(companyId, HOJE, prisma)
    const c1 = await contar()
    const r2 = await semearRotinasDoDia(companyId, HOJE, prisma)
    const c2 = await contar()
    expect(r1.criadas).toBe(1)
    expect(r2.criadas).toBe(0)
    expect(c1).toEqual({ tarefas: 1, vinculos: 1, itens: 3 })
    expect(c2).toEqual(c1)
  })

  it('dois disparos AO MESMO TEMPO (agendador + leitura) também não duplicam', async () => {
    await novaAbertura({ regra: { tipo: 'semanal', dow: 6 } }) // sábado: não cai hoje
    await Promise.all([semearRotinasDoDia(companyId, AMANHA, prisma), semearRotinasDoDia(companyId, AMANHA, prisma)])
    expect((await contar()).vinculos).toBe(1)
  })

  it('pausada NÃO semeia; retomar semeia hoje', async () => {
    const { rotinaId } = await novaAbertura({ regra: { tipo: 'semanal', dow: 6 } })
    await pausarRotina({ companyId, rotinaId, userId, pausar: true }, prisma)
    expect((await semearRotinasDoDia(companyId, AMANHA, prisma)).criadas).toBe(0)
    expect((await contar()).tarefas).toBe(0)
    await pausarRotina({ companyId, rotinaId, userId, pausar: false, agora: AS('09:00', AMANHA) }, prisma)
    expect((await contar()).tarefas).toBe(1)
  })

  it('toda segunda NÃO semeia sexta; dias da semana seg–sex semeia sexta e não sábado', async () => {
    await novaAbertura({ nome: 'troca do óleo', regra: { tipo: 'semanal', dow: 1 }, itens: ['trocar o óleo'] })
    expect((await contar()).tarefas).toBe(0)
    await novaAbertura({ nome: 'seg a sex', regra: { tipo: 'dias', dows: [1, 2, 3, 4, 5] }, itens: ['x'] })
    expect((await contar()).tarefas).toBe(1)
    expect((await semearRotinasDoDia(companyId, AMANHA, prisma)).criadas).toBe(0)
  })
})

describe('R31 — a rotina SEMEIA tarefa NORMAL com a origem guardada; nunca nasce avulsa dela', () => {
  it('toda tarefa nascida da tela Rotinas tem vínculo; a avulsa do Painel não tem', async () => {
    await novaAbertura()
    await criarTarefa({ companyId, nome: 'abrir milho', instrucao: '3 latas', quem: michele, dia: HOJE }, prisma)
    const ts = await prisma.stockTarefa.findMany({ where: { companyId }, include: { rotina: true } })
    expect(ts.map((t) => [t.nome, !!t.rotina]).sort()).toEqual([['ABERTURA DA COZINHA', true], ['ABRIR MILHO', false]])
    const esc = await tarefasDoEscritorio(companyId, AGORA, prisma)
    expect(esc.map((t) => [t.nome, t.origem]).sort()).toEqual([['ABERTURA DA COZINHA', 'ROTINA'], ['ABRIR MILHO', 'AVULSA']])
  })

  it('rotina de 1 item vira cartão NORMAL (sem itens; INICIAR → FINALIZAR de sempre)', async () => {
    await criarRotina({ companyId, userId, nome: 'troca do óleo da fritadeira', regra: { tipo: 'diaria' }, ate: null, quem: edmar, itens: ['óleo novo nas duas cubas'], agora: AGORA }, prisma)
    const [c] = await minhasTarefasDeHoje(companyId, edmar, AGORA, prisma)
    expect(c).toMatchObject({ tipo: 'TAREFA', produto: 'TROCA DO ÓLEO DA FRITADEIRA', instrucao: 'ÓLEO NOVO NAS DUAS CUBAS', rotina: { limite: null, atrasada: false, itens: [] } })
    await iniciarTarefa({ companyId, etapaId: c.etapaId, colaboradorId: edmar, agora: AGORA }, prisma)
    await finalizarTarefa({ companyId, etapaId: c.etapaId, colaboradorId: edmar, agora: AS('10:52') }, prisma)
    const [l] = await listarRotinas(companyId, AS('10:53'), prisma)
    expect(l.hoje).toMatchObject({ feitas: 1, total: 1, fim: '10:52' })
  })
})

describe('R26/R28 — o grupo na Janela: tiques assinados pelo PIN, conclui sozinho no último', () => {
  it('cartão único com 6 itens; cada tique grava quem e quando; 4/6 não conclui; o 6º conclui', async () => {
    await novaAbertura()
    const [c] = await minhasTarefasDeHoje(companyId, michele, AGORA, prisma)
    expect(c.rotina!.itens).toHaveLength(6)
    const ids = c.rotina!.itens.map((i) => i.id)
    for (const [k, quem] of [[0, michele], [1, michele], [2, edmar], [3, edmar]] as const) {
      const r = await ticarItem({ companyId, colaboradorId: quem, etapaId: c.etapaId, itemId: ids[k], agora: AS(`06:1${k}`) }, prisma)
      expect(r.concluiu).toBe(false)
    }
    const [c2] = await minhasTarefasDeHoje(companyId, michele, AS('06:20'), prisma)
    expect(c2.rotina!.itens.map((i) => [i.feito, i.quem, i.hora])).toEqual([
      [true, 'Michele', '06:10'], [true, 'Michele', '06:11'], [true, 'Edmar', '06:12'], [true, 'Edmar', '06:13'], [false, null, null], [false, null, null],
    ])
    // ⛔ o grupo NUNCA conclui com item aberto — nem pelo FINALIZAR, nem pelo INICIAR
    await expect(finalizarTarefa({ companyId, etapaId: c.etapaId, colaboradorId: michele, agora: AS('06:30') }, prisma)).rejects.toBeInstanceOf(TarefaError)
    await expect(iniciarTarefa({ companyId, etapaId: c.etapaId, colaboradorId: michele, agora: AS('06:30') }, prisma)).rejects.toBeInstanceOf(TarefaError)
    expect((await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: c.etapaId } })).finalizadoEm).toBeNull()
    await ticarItem({ companyId, colaboradorId: michele, etapaId: c.etapaId, itemId: ids[4], agora: AS('06:40') }, prisma)
    const fim = await ticarItem({ companyId, colaboradorId: michele, etapaId: c.etapaId, itemId: ids[5], agora: AS('06:45') }, prisma)
    expect(fim).toEqual({ concluiu: true, progresso: '6/6' })
    const e = await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: c.etapaId } })
    expect([e.iniciadoEm, e.finalizadoEm, e.executorId]).toEqual([AS('06:10'), AS('06:45'), michele])
    // feita: some da Janela e entra nas Tarefas concluídas do Painel
    expect(await minhasTarefasDeHoje(companyId, michele, AS('06:50'), prisma)).toHaveLength(0)
    const p = tarefasDoPainel(await tarefasDoEscritorio(companyId, AS('06:50'), prisma), AS('06:50'))
    expect(p.abertas).toHaveLength(0)
    expect(p.concluidas.map((t) => t.nome)).toEqual(['ABERTURA DA COZINHA'])
  })

  it('⛔ tique SEM PIN (sem quem) não grava nada', async () => {
    await novaAbertura()
    const [c] = await minhasTarefasDeHoje(companyId, michele, AGORA, prisma)
    await expect(ticarItem({ companyId, colaboradorId: '', etapaId: c.etapaId, itemId: c.rotina!.itens[0].id, agora: AGORA }, prisma)).rejects.toBeInstanceOf(RotinaError)
    expect(await prisma.stockTarefaItem.count({ where: { companyId, feitoEm: { not: null } } })).toBe(0)
  })

  it('R28 designada à Michele: só ela vê e só ela tica; o Edmar é recusado', async () => {
    await novaAbertura({ quem: michele })
    expect(await minhasTarefasDeHoje(companyId, edmar, AGORA, prisma)).toHaveLength(0)
    const [c] = await minhasTarefasDeHoje(companyId, michele, AGORA, prisma)
    await expect(ticarItem({ companyId, colaboradorId: edmar, etapaId: c.etapaId, itemId: c.rotina!.itens[0].id, agora: AGORA }, prisma)).rejects.toThrow('outra pessoa')
    expect((await ticarItem({ companyId, colaboradorId: michele, etapaId: c.etapaId, itemId: c.rotina!.itens[0].id, agora: AGORA }, prisma)).progresso).toBe('1/6')
  })
})

describe('R27 — hora limite honesta e o dia seguinte limpo', () => {
  it('10:40 no prazo; 11:20 com 4/6 é atrasada (Janela, Painel e lista); terminada nunca atrasa', async () => {
    await novaAbertura()
    const [c] = await minhasTarefasDeHoje(companyId, michele, AGORA, prisma)
    for (const i of c.rotina!.itens.slice(0, 4)) await ticarItem({ companyId, colaboradorId: michele, etapaId: c.etapaId, itemId: i.id, agora: AS('06:30') }, prisma)
    expect((await minhasTarefasDeHoje(companyId, michele, AGORA, prisma))[0].rotina!.atrasada).toBe(false)
    const tarde = AS('11:20')
    expect((await minhasTarefasDeHoje(companyId, michele, tarde, prisma))[0].rotina!.atrasada).toBe(true)
    const [linha] = tarefasDoPainel(await tarefasDoEscritorio(companyId, tarde, prisma), tarde).abertas
    expect(linha).toMatchObject({ atrasada: true, origem: 'ROTINA' })
    expect(linha.apoio).toContain('rotina · até 11:00')
    expect(linha.apoio).toContain('4/6 feitos')
    expect((await listarRotinas(companyId, tarde, prisma))[0].hoje).toMatchObject({ feitas: 4, total: 6, atrasada: true })
    for (const i of c.rotina!.itens.slice(4)) await ticarItem({ companyId, colaboradorId: michele, etapaId: c.etapaId, itemId: i.id, agora: AS('11:30') }, prisma)
    expect((await listarRotinas(companyId, AS('11:40'), prisma))[0].hoje).toMatchObject({ feitas: 6, total: 6, fim: '11:30', atrasada: false })
  })

  it('ontem não feita NÃO migra: amanhã a Janela e o Painel mostram SÓ a de amanhã, sem atraso herdado; a avulsa vencida segue migrando', async () => {
    await novaAbertura()
    await criarTarefa({ companyId, nome: 'abrir milho', instrucao: null, quem: 'EQUIPE', dia: HOJE }, prisma)
    const manha = AS('09:00', AMANHA)
    await semearRotinasDoDia(companyId, AMANHA, prisma)
    const cartoes = await minhasTarefasDeHoje(companyId, michele, manha, prisma)
    expect(cartoes.map((c) => c.produto).sort()).toEqual(['ABERTURA DA COZINHA', 'ABRIR MILHO'])
    const ab = cartoes.find((c) => c.produto === 'ABERTURA DA COZINHA')!
    expect(ab.rotina).toMatchObject({ atrasada: false })
    expect(ab.rotina!.itens.every((i) => !i.feito)).toBe(true)
    const p = tarefasDoPainel(await tarefasDoEscritorio(companyId, manha, prisma), manha)
    expect(p.abertas.map((t) => t.nome).sort()).toEqual(['ABERTURA DA COZINHA', 'ABRIR MILHO'])
    // a de ontem continua no banco, "não feita" no dia dela
    expect(await prisma.stockTarefaRotina.count({ where: { companyId } })).toBe(2)
    // e o item de ontem não se tica mais
    const ontem = await prisma.stockTarefaRotina.findFirstOrThrow({ where: { companyId, dia: { lt: AS('00:00', AMANHA) } }, include: { tarefa: { include: { itens: true } } } })
    const etOntem = await prisma.stockOrdemEtapa.findFirstOrThrow({ where: { ordemId: ontem.tarefaId } })
    await expect(ticarItem({ companyId, colaboradorId: michele, etapaId: etOntem.id, itemId: ontem.tarefa.itens[0].id, agora: manha }, prisma)).rejects.toThrow('outro dia')
  })
})

describe('R27 no AO VIVO — atrasada âmbar mesmo sem ninguém com ela na mão', () => {
  it('10:40 nada; 11:20 a ABERTURA aparece atrasada com 0/6; concluída sai', async () => {
    await novaAbertura()
    expect((await aoVivo(companyId, AGORA, prisma)).rotinasAtrasadas).toEqual([])
    const r = await aoVivo(companyId, AS('11:20'), prisma)
    expect(r.rotinasAtrasadas).toEqual([expect.objectContaining({ oQue: 'ABERTURA DA COZINHA', limite: '11:00', progresso: '0/6', quem: 'livre' })])
    const [c] = await minhasTarefasDeHoje(companyId, michele, AGORA, prisma)
    for (const i of c.rotina!.itens) await ticarItem({ companyId, colaboradorId: michele, etapaId: c.etapaId, itemId: i.id, agora: AS('11:25') }, prisma)
    expect((await aoVivo(companyId, AS('11:30'), prisma)).rotinasAtrasadas).toEqual([])
  })
})

describe('R29 — pausar, editar e excluir de verdade', () => {
  it('nunca semeou → apaga DE VEZ', async () => {
    const { rotinaId } = await novaAbertura({ regra: { tipo: 'mensal', dia: 1 } })
    const p = await previaExclusaoRotina(companyId, rotinaId, prisma)
    expect(p).toMatchObject({ semeadas: 0, destino: 'apagar' })
    await excluirRotina({ companyId, rotinaId, userId }, prisma)
    expect(await prisma.stockRotina.count({ where: { id: rotinaId } })).toBe(0)
  })

  it('com história → some das telas e para de semear; as tarefas já semeadas ficam intactas', async () => {
    const { rotinaId } = await novaAbertura()
    const p = await previaExclusaoRotina(companyId, rotinaId, prisma)
    expect(p).toMatchObject({ semeadas: 1, feitas: 0, destino: 'arquivar' })
    expect(p.frase).toContain('já caiu 1 vez')
    await excluirRotina({ companyId, rotinaId, userId }, prisma)
    expect(await listarRotinas(companyId, AGORA, prisma)).toHaveLength(0)
    expect((await contar()).tarefas).toBe(1)
    expect((await semearRotinasDoDia(companyId, AMANHA, prisma)).criadas).toBe(0)
  })

  it('editar muda pra frente: a tarefa de hoje fica como nasceu', async () => {
    const { rotinaId } = await novaAbertura()
    await editarRotina({ companyId, rotinaId, userId, nome: 'abertura', regra: { tipo: 'diaria' }, ate: '10:00', quem: 'LIVRE', itens: ['a', 'b'], agora: AGORA }, prisma)
    expect(await contar()).toEqual({ tarefas: 1, vinculos: 1, itens: 6 })
    const [r] = await listarRotinas(companyId, AGORA, prisma)
    expect(r).toMatchObject({ nome: 'ABERTURA', ate: '10:00', itens: ['a', 'b'], hoje: { total: 6 } })
  })
})
