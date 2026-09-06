// ⭐⭐ TIRAR DA PRODUÇÃO — COM GUARD E COM VOLTA (06/09/2026).
//
// **O caso:** o "Cristian" colaborador (21/08, sem PIN) existe de um tempo em que o cadastro
// de gente era uma lista solta de nomes. Hoje ele **só gerencia** — tem login de gerente e
// não produz. Ficava pra sempre na Equipe como *"sem PIN — não consegue entrar"*, e
// **pendência falsa é como o dono aprende a ignorar a lista**.
//
// ⛔⛔ INATIVAR, NUNCA APAGAR: o colaborador é quem ASSINA etapa. Apagar deixaria etapa antiga
// apontando pro nada e o relatório do mês perderia o nome de quem fez.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  inativarColaborador, reativarColaborador, trabalhoPendurado, motivoParaNaoInativar,
  historicoAAvisar, ColaboradorEmUsoError,
} from '@/lib/equipe/inativar-colaborador'
import { listarEquipe, resumoDaEquipe } from '@/lib/equipe/listar-equipe'
import { cadastrarPessoa } from '@/lib/stock/producao/cadastrar-pessoa'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'

const CNPJ = '27182818000128'
let companyId = ''
let carlise = ''
let ordemId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'INATIVAR' } })).id
  const r = await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)
  carlise = r.colaboradorId!
  ordemId = `ordem-${Date.now()}`
})

afterEach(async () => {
  await prisma.stockOrdemEtapa.deleteMany({ where: { companyId } })
  await prisma.stockProducaoConclusao.deleteMany({ where: { companyId } })
  await prisma.stockColaboradorPin.deleteMany({ where: { companyId } })
  await prisma.stockColaborador.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const etapa = (extra: Record<string, unknown>) =>
  prisma.stockOrdemEtapa.create({ data: { companyId, ordemId, posicao: 0, nome: 'gessado', ...extra } })

describe('⛔⛔ o guard: não se tira da produção quem está no meio do trabalho', () => {
  it('⛔⛔ etapa EM ANDAMENTO impede — e a mensagem diz quantas', async () => {
    await etapa({ colaboradorId: carlise, executorId: carlise, iniciadoEm: new Date('2026-09-04T12:00:00Z') })
    await expect(inativarColaborador(companyId, carlise, prisma)).rejects.toThrow(ColaboradorEmUsoError)
    await expect(inativarColaborador(companyId, carlise, prisma)).rejects.toThrow(/1 etapa\(s\) em andamento/)
    // ⛔ e nada mudou: recusar tem que ser recusa inteira
    expect((await prisma.stockColaborador.findUnique({ where: { id: carlise } }))!.ativo).toBe(true)
  })

  it('⛔ tarefa DESIGNADA e não finalizada também impede', async () => {
    await etapa({ colaboradorId: carlise })
    await expect(inativarColaborador(companyId, carlise, prisma)).rejects.toThrow(/designada/)
  })

  it('⛔⛔ conclusão NÃO impede — ela é HISTÓRICO, e o guard barrava pelo motivo errado', async () => {
    // ⛔ ACHADO NA 1ª RODADA CONTRA O DADO REAL: a régua tratava conclusão como impedimento e
    // barrou o Cristian por **24 conclusões** — lotes que ele JÁ produziu. Barrar ali
    // contradiz a régua deste arquivo ("pendente ≠ histórico") e sugeria que inativar
    // apagaria aquilo. Não apaga.
    await prisma.stockProducaoConclusao.create({
      data: { companyId, ordemId, qtdGerada: 10, escalaConsumida: 1, custoLoteReal: 10, rendimento: 10, colaboradorId: carlise },
    })
    const t = await trabalhoPendurado(companyId, carlise, prisma)
    expect(t.conclusoes).toBe(1)
    expect(t.unidadesProduzidas).toBe(10)
    expect(motivoParaNaoInativar(t, 'Carlise'), 'histórico virou trava').toBeNull()
    await inativarColaborador(companyId, carlise, prisma)
    // ⭐ e a conclusão CONTINUA no nome dela
    expect(await prisma.stockProducaoConclusao.count({ where: { companyId, colaboradorId: carlise } })).toBe(1)
  })

  it('⭐⭐ mas o histórico é AVISADO — o dono decide sabendo o tamanho do que está no nome', async () => {
    await prisma.stockProducaoConclusao.create({
      data: { companyId, ordemId, qtdGerada: 105, escalaConsumida: 1, custoLoteReal: 10, rendimento: 10, colaboradorId: carlise },
    })
    const aviso = historicoAAvisar(await trabalhoPendurado(companyId, carlise, prisma), 'Carlise')
    expect(aviso).toMatch(/1 lote\(s\) concluído\(s\) \(105 un\)/)
    expect(aviso, 'o aviso tem que dizer que o rastro FICA').toMatch(/FICA/)
  })

  it('⭐ e sem histórico nenhum, não há o que avisar', async () => {
    expect(historicoAAvisar(await trabalhoPendurado(companyId, carlise, prisma), 'Carlise')).toBeNull()
  })

  it('⭐⭐ mas etapa JÁ FEITA não impede — o rastro fica, e é por isso que se inativa', async () => {
    await etapa({
      colaboradorId: carlise, executorId: carlise,
      iniciadoEm: new Date('2026-09-04T12:00:00Z'), finalizadoEm: new Date('2026-09-04T13:00:00Z'),
    })
    const t = await trabalhoPendurado(companyId, carlise, prisma)
    expect(t.etapasFeitas).toBe(1)
    expect(motivoParaNaoInativar(t, 'Carlise'), 'histórico não é pendência').toBeNull()
    await inativarColaborador(companyId, carlise, prisma)
    // ⭐ e a etapa antiga CONTINUA apontando pra ele — o relatório do mês não perde o nome
    const e = await prisma.stockOrdemEtapa.findFirst({ where: { companyId, executorId: carlise } })
    expect(e, 'inativar apagou o rastro').toBeTruthy()
  })
})

describe('⭐⭐ inativar tira do tablet, e a volta existe', () => {
  it('⛔⛔ inativo NÃO entra no tablet (duas camadas, e vale dizer quais)', async () => {
    expect((await quemEstaComOPin(companyId, '4726', prisma))?.nome).toBe('Carlise')
    await inativarColaborador(companyId, carlise, prisma)
    expect(await quemEstaComOPin(companyId, '4726', prisma), 'inativo continuou entrando no tablet').toBeNull()
    // ⚠️ MEDIDO na REGRA 11: removendo a revogação do PIN, ESTE teste segue verde — porque
    // `quemEstaComOPin` também filtra colaborador ativo. São duas camadas, e é bom que
    // sejam; quem PROVA a revogação é o teste da volta (o PIN velho não pode ressuscitar).
    const pinAtivo = await prisma.stockColaboradorPin.count({ where: { companyId, colaboradorId: carlise, revogadoEm: null } })
    expect(pinAtivo, 'a revogação em si — a 2ª camada, agora afirmada').toBe(0)
  })

  it('⭐ some da lista do dia a dia, mas aparece quando se pede', async () => {
    await inativarColaborador(companyId, carlise, prisma)
    expect((await listarEquipe(companyId, prisma)).some((p) => p.nome === 'Carlise')).toBe(false)
    const comInativos = await listarEquipe(companyId, prisma, true)
    const c = comInativos.find((p) => p.nome === 'Carlise')!
    expect(c.tipo).toBe('INATIVO')
    // ⚠️ INATIVO vence "sem PIN": cobrar PIN de quem saiu é o alarme falso que mata a lista
    expect(c.detalhe).toMatch(/inativo/)
    expect(resumoDaEquipe(comInativos)).toMatchObject({ total: 0, cozinha: 0, inativos: 1 })
  })

  it('⭐⭐ trazer de volta funciona — e ele volta SEM PIN, como pendência honesta', async () => {
    await inativarColaborador(companyId, carlise, prisma)
    await reativarColaborador(companyId, carlise, prisma)
    const c = (await listarEquipe(companyId, prisma)).find((p) => p.nome === 'Carlise')!
    expect(c.tipo).toBe('SEM_ACESSO')
    // ⛔ o PIN antigo NÃO ressuscita: quem volta depois de meses não volta com o segredo velho
    expect(await quemEstaComOPin(companyId, '4726', prisma)).toBeNull()
  })

  it('⭐ inativar duas vezes é no-op (idempotente), não erro', async () => {
    await inativarColaborador(companyId, carlise, prisma)
    await expect(inativarColaborador(companyId, carlise, prisma)).resolves.toBeUndefined()
  })

  it('⛔ REGRA 8: id de outra empresa é recusado, não obedecido', async () => {
    await expect(inativarColaborador('empresa-que-nao-e-essa', carlise, prisma))
      .rejects.toThrow(/não é desta empresa/)
    expect((await prisma.stockColaborador.findUnique({ where: { id: carlise } }))!.ativo).toBe(true)
  })
})
