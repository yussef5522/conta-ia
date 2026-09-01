// ESTOQUE FASE 3 — REAL vs TEÓRICO contra banco real (REGRA 3: roda o pipeline).
// O invariante mais importante deste arquivo: saldoInicial + movimentos + ajustes ==
// saldoFinal. Se ele quebrar, algum tipo de movimento ficou FORA dos baldes e o relatório
// passa a mentir em silêncio — é o mesmo risco do "esqueci o transferDirection no select".

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { saldoItem } from '../saldo'
import { calcularRealVsTeorico, interpretar, PISO_DADOS } from '../real-vs-teorico'
import { iniciarContagem, contarLinha } from '../contagem'

const CNPJ = '50607080000199'
const DE = '2026-08-12'

/**
 * ⛔⛔ BOMBA-RELÓGIO QUE EXPLODIU (01/09/2026). Este `ATE` era **`'2026-08-31'` fixo**, e o
 * teste passou verde durante todo agosto — porque o `AJUSTE_CONTAGEM` é carimbado com
 * **AGORA** (é o certo: em produção o ajuste acontece no instante da contagem), e "agora"
 * caía dentro da janela. **Virou o dia 01/09 e os 5 testes ficaram vermelhos de uma vez**,
 * sem ninguém ter mexido em nada.
 *
 * ⚠️ E o pior não foi quebrar: foi eu ter olhado 5 vermelhos e concluído "poluição do
 * dev.db" duas vezes, sem medir. A causa apareceu em 30 segundos quando eu finalmente
 * imprimi a data do movimento:
 *     ENTRADA_NF 20 data=2026-08-13 | AJUSTE_CONTAGEM -2 data=2026-09-01
 *
 * ⭐ É a MESMA classe da janela fixa `01/07–31/08` da detecção de empréstimo (26/08), que
 * ia parar de funcionar em silêncio. **Teste que fixa data de fim e depende de "hoje"
 * estar dentro dela não é determinístico — é um relógio esperando.**
 *
 * ⚠️ A TELA DO PRODUTO SEMPRE ESTEVE CERTA: ela usa `ate = hoje()`. Quem dependia do
 * calendário era só o teste.
 */
const ATE = new Date().toISOString().slice(0, 10)
const dia = (d: string) => new Date(`${d}T10:00:00`)

let companyId: string
let carne: string
let refri: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA RVT' } })).id
  carne = (await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })).id
  refri = (await prisma.stockItem.create({ data: { companyId, nome: 'Coca 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })).id
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockContagemItem', 'stockContagem', 'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const linhaDe = (r: Awaited<ReturnType<typeof calcularRealVsTeorico>>, itemId: string) => r.linhas.find((l) => l.itemId === itemId)!

describe('sem contagem não existe "real"', () => {
  it('item com movimento mas SEM contagem tem variância null (nunca zero)', async () => {
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 40, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    const r = await calcularRealVsTeorico({ companyId, de: DE, ate: ATE }, prisma)
    const l = linhaDe(r, carne)
    expect(l.entradas).toBe(30)
    expect(l.variancia).toBeNull() // zero afirmaria que bateu
    expect(l.varianciaValor).toBeNull()
    expect(r.resumo.itensSemContagem).toBeGreaterThan(0)
    expect(r.resumo.avisos.join(' ')).toContain('marco zero')
  })
})

describe('a variância É o ajuste da contagem', () => {
  it('faltou 2 KG: variância −2 e −R$ 80, com a composição explicando o período', async () => {
    // entrou 30, vendeu 10 → teórico 20; a contagem acha 18
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 40, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'BAIXA_VENDA', quantidade: -10, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-14') })

    const s = await iniciarContagem(companyId, { userId: 'u1', userName: 'Cristian' }, prisma)
    await contarLinha({ companyId, contagemId: s.id, itemId: carne, qtdContada: 18, confirmarFreio: true, userId: 'u1', userName: 'Cristian' }, prisma)

    const l = linhaDe(await calcularRealVsTeorico({ companyId, de: DE, ate: ATE }, prisma), carne)
    expect(l.entradas).toBe(30)
    expect(l.vendas).toBe(10)
    expect(l.saldoTeorico).toBe(20)
    expect(l.variancia).toBe(-2)
    expect(l.varianciaValor).toBe(-80) // 2 KG × R$ 40
    expect(l.saldoFinal).toBe(18)
    expect(l.contagensNoPeriodo).toBe(1)
    expect(interpretar(l)).toContain('faltou estoque')
  })

  it('sobrou: variância positiva e leitura de "sobrou"', async () => {
    await criarMovimento(prisma, { companyId, itemId: refri, tipo: 'ENTRADA_NF', quantidade: 24, custoUnitario: 8, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    const s = await iniciarContagem(companyId, { userId: 'u1' }, prisma)
    await contarLinha({ companyId, contagemId: s.id, itemId: refri, qtdContada: 26, confirmarFreio: true }, prisma)

    const l = linhaDe(await calcularRealVsTeorico({ companyId, de: DE, ate: ATE }, prisma), refri)
    expect(l.variancia).toBe(2)
    expect(l.varianciaValor).toBe(16)
    expect(interpretar(l)).toContain('sobrou estoque')
  })

  it('contou e BATEU: variância 0 (não é null — houve contagem)', async () => {
    await criarMovimento(prisma, { companyId, itemId: refri, tipo: 'ENTRADA_NF', quantidade: 24, custoUnitario: 8, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    const s = await iniciarContagem(companyId, { userId: 'u1' }, prisma)
    await contarLinha({ companyId, contagemId: s.id, itemId: refri, qtdContada: 24 }, prisma)

    const l = linhaDe(await calcularRealVsTeorico({ companyId, de: DE, ate: ATE }, prisma), refri)
    expect(l.variancia).toBe(0)
    expect(l.contagensNoPeriodo).toBe(1)
    expect(interpretar(l)).toBeNull()
  })
})

describe('INVARIANTE — os baldes fecham com o ledger', () => {
  it('saldoInicial + movimentos + ajustes == saldoFinal == saldo derivado', async () => {
    // um de cada tipo que mexe na prateleira, pra nenhum ficar fora dos baldes
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: 40, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_MANUAL', quantidade: 10, custoUnitario: 42, origem: 'MANUAL', dataMovimento: dia('2026-08-14') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'BAIXA_VENDA', quantidade: -8, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-15') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'PERDA', quantidade: -3, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-16') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'USO_INTERNO', quantidade: -1, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-16') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'SEPARACAO_SAIDA', quantidade: -12, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-17') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'DEVOLUCAO_PRODUCAO', quantidade: 2, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-17') })
    // PRODUCAO_CONSUMO é transferência interna — NÃO pode entrar na conta (senão dobra)
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'PRODUCAO_CONSUMO', quantidade: -10, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-17') })

    const s = await iniciarContagem(companyId, { userId: 'u1' }, prisma)
    await contarLinha({ companyId, contagemId: s.id, itemId: carne, qtdContada: 36, confirmarFreio: true }, prisma)

    const l = linhaDe(await calcularRealVsTeorico({ companyId, de: DE, ate: ATE }, prisma), carne)

    // teórico: 0 + 50 + 10 − 8 − 3 − 1 − (12 − 2) = 38
    expect(l.entradas).toBe(60)
    expect(l.vendas).toBe(8)
    expect(l.perdas).toBe(4) // PERDA + USO_INTERNO
    expect(l.consumoProducao).toBe(10) // 12 separados − 2 devolvidos
    expect(l.saldoTeorico).toBe(38)
    expect(l.variancia).toBe(-2) // contou 36
    expect(l.saldoFinal).toBe(36)

    // e o saldo do relatório é o MESMO do ledger (nenhum tipo ficou fora dos baldes)
    expect((await saldoItem(prisma, companyId, carne)).saldo).toBe(36)
  })

  it('saldo ANTES do período entra como saldoInicial (não como entrada)', async () => {
    await criarMovimento(prisma, { companyId, itemId: refri, tipo: 'ENTRADA_NF', quantidade: 12, custoUnitario: 8, origem: 'SEFAZ', dataMovimento: dia('2026-08-12') })
    const r = await calcularRealVsTeorico({ companyId, de: '2026-08-20', ate: ATE }, prisma)
    const l = linhaDe(r, refri)
    expect(l.saldoInicial).toBe(12)
    expect(l.entradas).toBe(0)
  })
})

describe('PISO DOS DADOS (12/08) — não olha pra trás', () => {
  it('período anterior ao piso é AJUSTADO e avisa o porquê', async () => {
    const r = await calcularRealVsTeorico({ companyId, de: '2026-06-01', ate: ATE }, prisma)
    expect(r.resumo.de).toBe(PISO_DADOS)
    expect(r.resumo.avisos.join(' ')).toContain('erro conhecido')
  })

  it('movimento de julho NÃO entra nos baldes (fica no saldo inicial)', async () => {
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 99, custoUnitario: 10, origem: 'SEFAZ', dataMovimento: dia('2026-07-15') })
    const l = linhaDe(await calcularRealVsTeorico({ companyId, de: '2026-06-01', ate: ATE }, prisma), carne)
    expect(l.entradas).toBe(0)
    expect(l.saldoInicial).toBe(99)
  })
})

describe('resumo — o número que paga o módulo', () => {
  it('separa perda não explicada (negativa) de sobra (positiva)', async () => {
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 40, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    await criarMovimento(prisma, { companyId, itemId: refri, tipo: 'ENTRADA_NF', quantidade: 24, custoUnitario: 8, origem: 'SEFAZ', dataMovimento: dia('2026-08-13') })
    await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'BAIXA_VENDA', quantidade: -5, custoUnitario: 40, origem: 'MANUAL', dataMovimento: dia('2026-08-14') })

    const s = await iniciarContagem(companyId, { userId: 'u1' }, prisma)
    await contarLinha({ companyId, contagemId: s.id, itemId: carne, qtdContada: 12, confirmarFreio: true }, prisma) // −3 KG = −120
    await contarLinha({ companyId, contagemId: s.id, itemId: refri, qtdContada: 26, confirmarFreio: true }, prisma) // +2 UN = +16

    const r = await calcularRealVsTeorico({ companyId, de: DE, ate: ATE }, prisma)
    expect(r.resumo.itensContados).toBe(2)
    expect(r.resumo.varianciaNegativaValor).toBe(-120)
    expect(r.resumo.varianciaPositivaValor).toBe(16)
    expect(r.resumo.varianciaLiquidaValor).toBe(-104)
    expect(r.resumo.consumoValor).toBeGreaterThan(0)
  })
})
