/**
 * ⭐⭐ SEMEAR O PLANO COM O REALIZADO — contra o banco (06/10/2026).
 *
 * ⛔⛔ **O QUE SÓ SE PROVA COM BANCO:** que a prévia **não grava**, que a gravação executa
 * **exatamente** a lista da prévia, e que ela não passa por cima de um plano declarado.
 *
 * ⚠️ Os números são os reais da Caçula (agosto): aluguel 8.614,61 · energia 6.275,05 ·
 * contador 1.621,00 — é com eles que o dono raciocina.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerCustosFixos, referenciaPadrao } from '../leitura'
import { marcarComoFixa, definirPlanejado } from '../gestos'
import { previaDaSemente, semear } from '../semear'

/**
 * ⚠️ CNPJ PRÓPRIO, não o do arquivo vizinho: a suíte roda os arquivos em PARALELO contra o
 * mesmo banco, e dois testes apagando a MESMA empresa no setup derrubam um ao outro por FK.
 * É a classe que o guard `cnpj-de-teste-nao-colide` existe pra fechar — e que mordeu aqui
 * antes de eu lembrar dela.
 */
const CNPJ = '80808080808080'
const DESTINO = '2026-09'
const REF = '2026-08'
const AGORA = new Date('2026-09-20T15:00:00Z')

let companyId = ''
let contaId = ''
let cats: Record<string, string> = {}

async function gasto(categoryId: string, amount: number, iso: string) {
  await prisma.transaction.create({
    data: {
      bankAccountId: contaId, categoryId, date: new Date(iso), description: 'gasto',
      amount, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
    } as never,
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'SEMEAR O PLANO' } })
  companyId = c.id
  const conta = await prisma.bankAccount.create({
    data: { companyId, name: 'conta', bankName: 'teste', accountType: 'CHECKING', balance: 0 },
  })
  contaId = conta.id
  cats = {}
  for (const n of ['Aluguel', 'Energia Elétrica', 'Contabilidade', 'Seguro Predial']) {
    const k = await prisma.category.create({
      data: { companyId, name: n, type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
    })
    cats[n] = k.id
    await marcarComoFixa(companyId, k.id, null)
  }
  // agosto (a referência) — o Seguro NÃO teve lançamento, de propósito
  await gasto(cats['Aluguel'], 8614.61, '2026-08-05T12:00:00Z')
  await gasto(cats['Energia Elétrica'], 6275.05, '2026-08-10T12:00:00Z')
  await gasto(cats['Contabilidade'], 1621.0, '2026-08-05T12:00:00Z')
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐ a referência padrão é o mês ANTERIOR', () => {
  it('⛔ não é o mês visto — no dia 6 o realizado dele é quase zero', () => {
    expect(referenciaPadrao('2026-09')).toBe('2026-08')
    expect(referenciaPadrao('2026-01'), 'e ela atravessa o ano').toBe('2025-12')
  })

  it('⭐ a linha carrega o realizado da referência, não só o do mês visto', async () => {
    await gasto(cats['Aluguel'], 999, '2026-09-02T12:00:00Z')
    const t = await lerCustosFixos(companyId, DESTINO, AGORA)
    const aluguel = t.linhas.find((l) => l.nome === 'Aluguel')!
    expect(t.mesReferencia).toBe(REF)
    expect(aluguel.realizado, 'setembro').toBeCloseTo(999, 2)
    expect(aluguel.realizadoReferencia, 'agosto — o número que semeia').toBeCloseTo(8614.61, 2)
  })

  it('⚠️ referência == mês corrente é marcada como PARCIAL', async () => {
    const t = await lerCustosFixos(companyId, DESTINO, AGORA, undefined, '2026-09')
    expect(t.referenciaEhParcial, 'setembro ainda está correndo').toBe(true)
    const u = await lerCustosFixos(companyId, DESTINO, AGORA)
    expect(u.referenciaEhParcial, 'agosto já fechou').toBe(false)
  })
})

describe('⛔⛔ a PRÉVIA não grava nada', () => {
  it('⭐ ela diz quem entra, com quanto, e o banco continua vazio', async () => {
    const p = await previaDaSemente(companyId, DESTINO, REF, false, AGORA)
    expect(p.quantas).toBe(3)
    expect(p.soma).toBeCloseTo(8614.61 + 6275.05 + 1621.0, 2)
    expect(await prisma.custoFixoPlanejado.count({ where: { companyId } }), 'NADA gravado').toBe(0)
  })

  it('⭐ quem fica de fora vem com o PORQUÊ escrito', async () => {
    const p = await previaDaSemente(companyId, DESTINO, REF, false, AGORA)
    const seguro = p.linhas.find((l) => l.nome === 'Seguro Predial')!
    expect(seguro.vai).toBe(false)
    expect(seguro.porque).toMatch(/nada saiu/)
    expect(p.semRealizado).toBe(1)
  })
})

describe('⛔⛔ a gravação executa EXATAMENTE a lista da prévia', () => {
  it('⭐ o que entrou é o que a prévia prometeu, ao centavo', async () => {
    const p = await previaDaSemente(companyId, DESTINO, REF, false, AGORA)
    const r = await semear(companyId, DESTINO, REF, false, 'quem-1', AGORA)

    expect(r.aplicados).toBe(p.quantas)
    const gravados = await prisma.custoFixoPlanejado.findMany({ where: { companyId, mes: DESTINO } })
    expect(gravados.length).toBe(p.quantas)
    for (const l of p.linhas.filter((x) => x.vai)) {
      const g = gravados.find((x) => x.categoryId === l.categoryId)!
      expect(g.valor, l.nome).toBeCloseTo(l.valor, 2)
    }
  })

  it('⭐ e o RASTRO fica em cada linha (quem/quando)', async () => {
    await semear(companyId, DESTINO, REF, false, 'quem-1', AGORA)
    const g = await prisma.custoFixoPlanejado.findFirst({ where: { companyId, mes: DESTINO } })
    expect(g?.definidoPorId).toBe('quem-1')
    expect(g?.definidoEm).toBeInstanceOf(Date)
  })

  it('⛔⛔ NÃO passa por cima de plano declarado — a decisão do dono não se apaga em lote', async () => {
    await definirPlanejado(companyId, cats['Aluguel'], DESTINO, 9000, 'o-dono')
    const p = await previaDaSemente(companyId, DESTINO, REF, false, AGORA)
    const aluguel = p.linhas.find((l) => l.nome === 'Aluguel')!
    expect(aluguel.vai).toBe(false)
    expect(aluguel.porque).toMatch(/já tem plano/)
    expect(p.jaTemPlano).toBe(1)

    await semear(companyId, DESTINO, REF, false, 'quem-1', AGORA)
    const g = await prisma.custoFixoPlanejado.findFirst({ where: { companyId, categoryId: cats['Aluguel'], mes: DESTINO } })
    expect(g?.valor, 'o número dele ficou').toBeCloseTo(9000, 2)
  })

  it('⭐ com o toggle explícito, ele substitui — e aí a prévia MOSTRA o antes → depois', async () => {
    await definirPlanejado(companyId, cats['Aluguel'], DESTINO, 9000, 'o-dono')
    const p = await previaDaSemente(companyId, DESTINO, REF, true, AGORA)
    const aluguel = p.linhas.find((l) => l.nome === 'Aluguel')!
    expect(aluguel.vai).toBe(true)
    expect(aluguel.planoAtual).toBeCloseTo(9000, 2)
    expect(aluguel.valor).toBeCloseTo(8614.61, 2)

    await semear(companyId, DESTINO, REF, true, 'quem-1', AGORA)
    const g = await prisma.custoFixoPlanejado.findFirst({ where: { companyId, categoryId: cats['Aluguel'], mes: DESTINO } })
    expect(g?.valor).toBeCloseTo(8614.61, 2)
  })

  it('⚠️ "já tem plano" ganha de "não houve realizado" no motivo — senão o dono caça o erro errado', async () => {
    await definirPlanejado(companyId, cats['Seguro Predial'], DESTINO, 1700, 'o-dono')
    const p = await previaDaSemente(companyId, DESTINO, REF, false, AGORA)
    const seguro = p.linhas.find((l) => l.nome === 'Seguro Predial')!
    expect(seguro.porque, 'o problema dele é o plano, não o lançamento').toMatch(/já tem plano/)
  })

  it('⭐ semear é IDEMPOTENTE: rodar duas vezes não cria uma 2ª linha nem muda o valor', async () => {
    await semear(companyId, DESTINO, REF, true, 'quem-1', AGORA)
    await semear(companyId, DESTINO, REF, true, 'quem-1', AGORA)
    const n = await prisma.custoFixoPlanejado.count({ where: { companyId, mes: DESTINO } })
    expect(n).toBe(3)
  })

  it('⭐⭐ depois de semear, o cartão (a) continua sendo a Σ das linhas', async () => {
    await semear(companyId, DESTINO, REF, false, 'quem-1', AGORA)
    const t = await lerCustosFixos(companyId, DESTINO, AGORA)
    const soma = t.linhas.reduce((s, l) => s + (l.planejado ?? 0), 0)
    expect(t.casaCustaMes).toBeCloseTo(soma, 2)
    expect(t.casaCustaMes).toBeCloseTo(16510.66, 2)
    // ⚠️ e o Seguro segue sem plano — semear não inventa número onde não houve gasto
    expect(t.semPlano.n).toBe(1)
  })
})
