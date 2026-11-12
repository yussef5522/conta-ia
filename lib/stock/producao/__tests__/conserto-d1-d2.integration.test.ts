/**
 * ⭐⭐ CONSERTO CIRÚRGICO DA PRODUÇÃO (12/11/2026) — os casos REAIS do raio-X, com os números de prod.
 *
 * D2 · 7 ordens (07–11/11) de ABRIR MILHO / ABRIR ERVILHA: a ficha tem 0,0001 KG por lote (a
 *      gambiarra da equipe pra "tarefa"), a separação saiu 0,0001–0,0003 KG; o tablet arredondava
 *      a 3 casas → 0 → 409 "informe o que foi consumido" DEPOIS de gravar a etapa → ordem aberta
 *      até o escritório fechar.
 * D1 · Pizza congelada de calabresa, 09/11 20:43: a prateleira da PORÇAO CALABRESA tinha
 *      20,003 UN / R$ 32,33 (certo); a trava somava o PRODUCAO_CONSUMO (que não mexe na
 *      prateleira) e recusava "0 UN e R$ −0,07".
 * Raiz comum · finalizar não era atômico.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, DoseImplausivelError } from '../fichas'
import { criarOrdem, confirmarSeparacao } from '../ordens'
import { etapasDaOrdem } from '../etapas'
import { iniciarTarefa } from '../minhas-tarefas'
import { finalizarEConcluirDoTablet, oQueVaiSerConsumido } from '../concluir-do-tablet'
import { concluir } from '../conclusao'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { definirPlanoDaEtapa } from '../plano-etapas'
import { ehDeOntem } from '../painel-producao'
import { dosesImplausiveis } from '../dose-implausivel'

const CNPJ = '16180339000777'
let companyId = ''
let michelle = ''
const DIA = new Date('2026-11-11T12:00:00.000Z') // 09:00 de Brasília, como o sistema grava
const emSP = (d: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, d, h + 3, m))

async function item(nome: string, un: string, custo: number | null, qtd = 100) {
  const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: un, categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  if (custo != null) await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: custo, custoTotal: qtd * custo, origem: 'SEFAZ' } })
  return it.id
}
async function liberar(ordemId: string) {
  const es = await prisma.stockOrdemEtapa.findMany({ where: { companyId, ordemId }, select: { id: true } })
  for (const e of es) await definirPlanoDaEtapa({ companyId, etapaId: e.id, liberadaParaEquipe: true }, prisma)
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONSERTO D1 D2' } })).id
  michelle = (await cadastrarPessoa({ companyId, nome: 'michelle', funcao: 'COZINHA', pin: '2468' }, prisma)).colaboradorId!
})
afterEach(async () => {
  for (const t of ['stockEtapaEncerrada', 'stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockProducaoDesvio', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** a "tarefa-gambiarra" de hoje: ficha de 0,0001 KG por lote, separada pela escala */
async function ordemDaGambiarra(nomeTarefa: string, insumo: string, custo: number | null, escala: number) {
  const ins = await item(insumo, 'KG', custo)
  const f = await criarFicha({ companyId, nomeProduzido: nomeTarefa, unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', etapas: [{ nome: 'produção' }], componentes: [{ itemId: ins, qtdPlanejada: 0.0001, unidade: 'KG', posicao: 0 }] }, prisma)
  const { ordemId } = await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: escala, dataProducao: DIA }, prisma)
  await liberar(ordemId)
  await confirmarSeparacao(companyId, ordemId, [{ itemId: ins, qtdSeparada: 0.0001 * escala }], prisma)
  const [e] = await etapasDaOrdem(companyId, ordemId, DIA, prisma)
  await iniciarTarefa({ companyId, etapaId: e.id, colaboradorId: michelle, agora: emSP(11, 14, 34) }, prisma)
  return { ordemId, etapaId: e.id, ins }
}

describe('D2 · as 7 ordens reais (07–11/11) fecham NO TABLET, pela funcionária', () => {
  const REAIS: [string, string, string, number | null, number][] = [
    ['c8128b', 'ABRIR MILHO', 'MILHO VERDE', null, 2], ['4m99qc', 'ABRIR ERVILHA', 'ERVILHA', 11.57, 3],
    ['08mwq2', 'ABRIR MILHO', 'MILHO VERDE', null, 2], ['1qerkl', 'ABRIR ERVILHA', 'ERVILHA', 11.57, 1],
    ['y6jn72', 'ABRIR MILHO', 'MILHO VERDE', null, 2], ['7omdpo', 'ABRIR ERVILHA', 'ERVILHA', 11.57, 1],
    ['unijgp', 'ABRIR MILHO', 'MILHO VERDE', null, 1],
  ]
  it.each(REAIS)('ordem %s · %s ×%s: separou 0,000x KG → consumo CRU → conclui (antes: 409 e ordem aberta)', async (_suf, tarefa, insumo, custo, escala) => {
    const o = await ordemDaGambiarra(tarefa, insumo, custo, escala)
    // ⭐ UMA REGRA DE CONSUMO: o tablet manda o MESMO valor cru que a tela do escritório
    const consumo = await oQueVaiSerConsumido(companyId, o.ordemId, prisma)
    expect(consumo).toHaveLength(1)
    expect(consumo[0].itemId).toBe(o.ins)
    expect(consumo[0].qtd).toBeCloseTo(0.0001 * escala, 8) // nunca 0 (antes: Math.round(…×1000)/1000 = 0)
    const r = await finalizarEConcluirDoTablet({ companyId, etapaId: o.etapaId, colaboradorId: michelle, qtdGerada: escala, agora: emSP(11, 14, 44) }, prisma)
    expect(r.concluida?.qtdGerada).toBe(escala)
    const ordem = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: o.ordemId } })
    expect(ordem.estado).toBe('CONCLUIDA')
    const conc = await prisma.stockProducaoConclusao.findFirstOrThrow({ where: { ordemId: o.ordemId } })
    expect(conc.colaboradorId).toBe(michelle) // fechou pela cozinha, não pelo escritório
    const mov = await prisma.stockMovement.findFirstOrThrow({ where: { receiptId: o.ordemId, tipo: 'PRODUCAO_CONSUMO' } })
    expect(mov.quantidade).toBeCloseTo(-0.0001 * escala, 8)
  })
})

describe('FINALIZAR É UM ATO SÓ — recusou, NADA gravou, e ela pode tentar de novo', () => {
  it('a conclusão recusa → a etapa NÃO fica finalizada (antes: etapa fechada, ordem aberta, 2º clique "já foi finalizada")', async () => {
    const o = await ordemDaGambiarra('ABRIR MILHO', 'MILHO VERDE', null, 2)
    // o material some da ordem (devolvido por fora) → a conclusão tem que recusar
    await prisma.stockMovement.create({ data: { companyId, itemId: o.ins, tipo: 'DEVOLUCAO_PRODUCAO', quantidade: 0.0002, custoUnitario: 0, custoTotal: 0, receiptId: o.ordemId, origem: 'MANUAL' } })
    await expect(finalizarEConcluirDoTablet({ companyId, etapaId: o.etapaId, colaboradorId: michelle, qtdGerada: 2, agora: emSP(11, 15, 6) }, prisma))
      .rejects.toThrow(/Não há material separado/)
    const e = await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: o.etapaId } })
    expect(e.finalizadoEm).toBeNull()
    expect((await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: o.ordemId } })).estado).not.toBe('CONCLUIDA')
    // o 2º clique dá A MESMA razão — nunca "essa tarefa já foi finalizada"
    await expect(finalizarEConcluirDoTablet({ companyId, etapaId: o.etapaId, colaboradorId: michelle, qtdGerada: 2, agora: emSP(11, 15, 7) }, prisma))
      .rejects.toThrow(/Não há material separado/)
  })

  it('etapa intermediária (sem "quantos saíram") só finaliza a etapa — como sempre', async () => {
    const o = await ordemDaGambiarra('ABRIR ERVILHA', 'ERVILHA', 11.57, 1)
    const r = await finalizarEConcluirDoTablet({ companyId, etapaId: o.etapaId, colaboradorId: michelle, agora: emSP(11, 15, 22) }, prisma)
    expect(r.concluida).toBeNull()
    expect((await prisma.stockOrdemEtapa.findUniqueOrThrow({ where: { id: o.etapaId } })).finalizadoEm).not.toBeNull()
  })
})

describe('D1 · a ordem real de 09/11 (Pizza congelada de calabresa ×20) conclui — e o estoque da porção fica INTACTO', () => {
  it('prateleira 20,003 UN / R$ 32,33 no clique: o consumo (fora da prateleira) não é julgado como baixa; nenhum ajuste nasce', async () => {
    const porcao = await item('PORÇAO CALABRESA 85g congelada', 'UN', null)
    const queijo = await item('porçao queijo 130 grama', 'UN', 3.88)
    const massa = await item('metade de bolinha massa de pizza', 'UN', 0.55)
    const f = await criarFicha({ companyId, nomeProduzido: 'Pizza congelada de calabresa', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', etapas: [{ nome: 'produção' }], componentes: [
      { itemId: porcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }, { itemId: queijo, qtdPlanejada: 1, unidade: 'UN', posicao: 1 }, { itemId: massa, qtdPlanejada: 2, unidade: 'UN', posicao: 2 },
    ] }, prisma)
    const { ordemId } = await criarOrdem({ companyId, fichaId: f.fichaId, escalaReceitas: 20, dataProducao: new Date('2026-11-09T12:00:00Z') }, prisma)
    // ⭐ o ESTADO EXATO de prod às 20:43:14 (sonda read-only de 12/11): a porção entrou depois de
    //    separada, a custo médio diferente — prateleira 40,003 UN / R$ 64,73 antes da separação
    await prisma.stockMovement.create({ data: { companyId, itemId: porcao, tipo: 'PRODUCAO_GERACAO', quantidade: 40.003, custoUnitario: 64.73 / 40.003, custoTotal: 64.73, origem: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: porcao, tipo: 'SEPARACAO_SAIDA', quantidade: -20, custoUnitario: 1.62, custoTotal: -32.4, receiptId: ordemId, origem: 'MANUAL' } })
    for (const [it_, q, c] of [[queijo, 20, 3.88], [massa, 40, 0.55]] as const) await prisma.stockMovement.create({ data: { companyId, itemId: it_, tipo: 'SEPARACAO_SAIDA', quantidade: -q, custoUnitario: c, custoTotal: -q * c, receiptId: ordemId, origem: 'MANUAL' } })
    await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'EM_PRODUCAO' } })
    const prat = () => prisma.stockMovement.aggregate({ where: { companyId, itemId: porcao, tipo: { notIn: ['PRODUCAO_CONSUMO'] } }, _sum: { quantidade: true, custoTotal: true } })
    const antes = await prat()
    expect([Math.round(antes._sum.quantidade! * 1000) / 1000, Math.round(antes._sum.custoTotal! * 100) / 100]).toEqual([20.003, 32.33])

    const r = await concluir({ companyId, ordemId, qtdGerada: 20, consumo: [{ itemId: porcao, qtdConsumida: 20 }, { itemId: queijo, qtdConsumida: 20 }, { itemId: massa, qtdConsumida: 40 }] }, prisma)
    expect(r.estado).toBe('CONCLUIDA')
    const depois = await prat()
    expect(depois._sum).toEqual(antes._sum) // a prateleira da porção não mudou um centavo
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: porcao, tipo: { in: ['AJUSTE_RESIDUO', 'AJUSTE_CONTAGEM'] } } })).toBe(0) // nenhum ajuste inventado
  })

  it('a trava CONTINUA inteira pra quem mexe na prateleira: baixa que deixaria 0 UN com valor negativo é recusada', async () => {
    const x = await item('ITEM DA TRAVA', 'UN', null)
    await prisma.stockMovement.create({ data: { companyId, itemId: x, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 1.6165, custoTotal: 32.33, origem: 'SEFAZ' } })
    const { criarMovimento } = await import('../../movement')
    await expect(criarMovimento(prisma, { companyId, itemId: x, tipo: 'SAIDA_MANUAL', quantidade: -20, custoUnitario: 1.62, custoTotal: -32.4, origem: 'MANUAL' }))
      .rejects.toThrow(/dinheiro negativo com saldo positivo/)
  })
})

describe('"ATRASADA" no fuso de Brasília, pelo dia de negócio da ordem', () => {
  it('ordem de hoje às 21h30 de Brasília NÃO é atrasada (antes: o dia em UTC já tinha virado)', () => {
    expect(ehDeOntem(DIA, emSP(11, 21, 30))).toBe(false)
    expect(ehDeOntem(DIA, emSP(11, 23, 59))).toBe(false)
    expect(ehDeOntem(DIA, emSP(12, 0, 1))).toBe(true)
    expect(ehDeOntem(new Date('2026-11-09T12:00:00Z'), emSP(10, 19, 25))).toBe(true) // o D1 de verdade
  })
})

describe('DOSE IMPLAUSÍVEL pede confirmação na PORTA do editor (não bloqueia)', () => {
  it('o caso real: ABRIR MILHO 2 KG → 0,0001 KG (06/11) pergunta, mostrando antes → depois', async () => {
    const milho = await item('MILHO VERDE', 'KG', null)
    const f = await criarFicha({ companyId, nomeProduzido: 'ABRIR MILHO', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: milho, qtdPlanejada: 3, unidade: 'KG', posicao: 0 }] }, prisma)
    await atualizarFicha(companyId, f.fichaId, { componentes: [{ itemId: milho, qtdPlanejada: 2, unidade: 'KG', posicao: 0 }] }, prisma) // 3 → 2: mesma família
    const tentativa = atualizarFicha(companyId, f.fichaId, { componentes: [{ itemId: milho, qtdPlanejada: 0.0001, unidade: 'KG', posicao: 0 }] }, prisma)
    await expect(tentativa).rejects.toBeInstanceOf(DoseImplausivelError)
    await expect(atualizarFicha(companyId, f.fichaId, { componentes: [{ itemId: milho, qtdPlanejada: 0.0001, unidade: 'KG', posicao: 0 }] }, prisma))
      .rejects.toMatchObject({ code: 'DOSE_IMPLAUSIVEL', doses: [{ nome: 'MILHO VERDE', antes: 2, depois: 0.0001, unidade: 'KG' }] })
    const v = await prisma.stockFicha.findUniqueOrThrow({ where: { id: f.fichaId } })
    expect(v.versaoAtual).toBe(2) // a recusa não gravou nada
    // confirmou → grava (a gambiarra continua possível, só não é mais calada)
    await expect(atualizarFicha(companyId, f.fichaId, { componentes: [{ itemId: milho, qtdPlanejada: 0.0001, unidade: 'KG', posicao: 0 }], confirmouDose: true }, prisma)).resolves.toMatchObject({ versao: 3 })
  })

  it('a régua pura: fora de [menor ÷ 10, maior × 10] do histórico do insumo; insumo novo passa', () => {
    const h = [{ itemId: 'a', qtd: 0.08, versao: 1 }, { itemId: 'a', qtd: 0.1, versao: 2 }]
    expect(dosesImplausiveis(h, [{ itemId: 'a', qtd: 0.12, unidade: 'KG' }], (x) => x)).toEqual([])
    expect(dosesImplausiveis(h, [{ itemId: 'a', qtd: 0.007, unidade: 'KG' }], (x) => x)).toHaveLength(1)
    expect(dosesImplausiveis(h, [{ itemId: 'a', qtd: 1.5, unidade: 'KG' }], (x) => x)).toHaveLength(1)
    expect(dosesImplausiveis(h, [{ itemId: 'b', qtd: 999, unidade: 'KG' }], (x) => x)).toEqual([])
  })
})
