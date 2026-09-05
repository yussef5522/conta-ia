// ⭐⭐ "NÃO BAIXAR — DECISÃO" (05/09/2026) — o estado que protege o alarme.
//
// Decisão do dono: as baixas começam de **04/09** pra frente. Em 02 e 03/09 a produção não
// estava montada e a baixa só criaria negativo sem significado — é a mesma disciplina do
// "AGOSTO É O PISO" das vendas.
//
// ⛔⛔ E O ESTADO EXISTE PRA O AVISO NÃO VIRAR RUÍDO: sem ele, o V2 gritaria **para sempre**
// sobre dias pulados de propósito. **Alarme falso repetido mata o alarme.**

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { dispensarDia, reverterDispensa, diasDispensados, listarDispensas, pendentesQueAvisam, HORAS_ATE_AVISAR } from '../dia-dispensado'
import { checkVendasInvariants } from '../vendas-invariants'

const CNPJ = '99887766000155'
let companyId = ''
let userId = ''

const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000)

/** um dia de complemento importado há N horas, sem baixa nenhuma */
async function diaDeComplemento(data: string, horas: number) {
  const importId = `comp-${companyId}-${data}`
  await prisma.stockVendaComplementoLinha.create({
    data: {
      companyId, importId, data: new Date(`${data}T00:00:00.000Z`),
      nomeSuitable: 'CALABRESA', ocorrencias: 62, valorTotal: 0, criadoEm: horasAtras(horas),
    },
  })
  return importId
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'DISPENSA' } })).id
  userId = (await prisma.user.create({ data: { email: `disp-${companyId}@t.com`, password: 'x', name: 'Yussef' } })).id
})

afterEach(async () => {
  for (const t of ['stockVendaDiaDispensado', 'stockVendaComplementoLinha', 'stockVendaImport', 'stockMovement'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const avisosDaEmpresa = async () =>
  (await checkVendasInvariants(prisma)).filter((f) => f.companyId === companyId && f.invariante === 'V2')

describe('⛔⛔ o dia dispensado SAI do aviso e do juiz', () => {
  it('⛔⛔ importado há 48h sem baixar → o juiz AVISA', async () => {
    await diaDeComplemento('2026-09-02', 48)
    const avisos = await avisosDaEmpresa()
    expect(avisos, 'o dia parado tem que aparecer').toHaveLength(1)
    expect(avisos[0].detalhe).toMatch(/2026-09-02/)
    expect(avisos[0].detalhe, 'a frase tem que ensinar a saída').toMatch(/não baixar/)
    expect(avisos[0].nivel, 'decidir é do dono — o juiz só lembra').toBe('aviso')
  })

  it('⭐⭐ depois de dispensado, o juiz CALA', async () => {
    await diaDeComplemento('2026-09-02', 48)
    await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-02', motivo: 'produção não estava montada', userId }, prisma)
    expect(await avisosDaEmpresa(), 'ruído permanente sobre dia pulado de propósito').toHaveLength(0)
  })

  it('⭐⭐ e REVERTER devolve a cobrança', async () => {
    await diaDeComplemento('2026-09-02', 48)
    await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-02', userId }, prisma)
    await reverterDispensa(companyId, 'COMPLEMENTO', '2026-09-02', userId, prisma)
    expect(await avisosDaEmpresa()).toHaveLength(1)
  })

  it('⭐⭐ dia NOVO importado sem baixa continua avisando — a dispensa é por DIA, não geral', async () => {
    await diaDeComplemento('2026-09-02', 48)
    await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-02', userId }, prisma)
    await diaDeComplemento('2026-09-06', 48) // um dia novo, não dispensado
    const avisos = await avisosDaEmpresa()
    expect(avisos).toHaveLength(1)
    expect(avisos[0].detalhe).toMatch(/2026-09-06/)
  })
})

describe('⚠️ as bordas do aviso', () => {
  it('⚠️ importado há 2h NÃO avisa — importar e baixar no mesmo minuto não é pendência', async () => {
    await diaDeComplemento('2026-09-06', 2)
    expect(await avisosDaEmpresa()).toHaveLength(0)
  })

  it('⛔ PERÍODO nunca avisa: ele existe pra montar a lista de sabores, não pra baixar', async () => {
    await prisma.stockVendaComplementoLinha.create({
      data: {
        companyId, importId: `comp-periodo-${companyId}-2026-08-29`, data: new Date('2026-08-29T00:00:00.000Z'),
        nomeSuitable: 'CALABRESA', ocorrencias: 1220, valorTotal: 0, criadoEm: horasAtras(48),
      },
    })
    expect(await avisosDaEmpresa(), 'cobrar o que o desenho proíbe').toHaveLength(0)
  })

  it('⭐ dia COM baixa ativa não é pendência', async () => {
    const importId = await diaDeComplemento('2026-09-04', 48)
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'porcao', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' } })
    await prisma.stockMovement.create({
      data: { companyId, itemId: item.id, tipo: 'BAIXA_VENDA', quantidade: -103, custoUnitario: 1, custoTotal: -103, receiptId: importId, origem: 'MANUAL' },
    })
    expect(await avisosDaEmpresa()).toHaveLength(0)
    await prisma.stockItem.deleteMany({ where: { companyId } })
  })
})

describe('⭐ o rastro e a idempotência', () => {
  it('⭐ dispensar guarda QUEM e QUANDO, e é reversível sem perder o histórico', async () => {
    await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-03', motivo: 'produção não montada', userId }, prisma)
    const [d] = await listarDispensas(companyId, 'COMPLEMENTO', prisma)
    expect(d.data).toBe('2026-09-03')
    expect(d.motivo).toBe('produção não montada')
    expect(d.porNome).toBe('Yussef')

    await reverterDispensa(companyId, 'COMPLEMENTO', '2026-09-03', userId, prisma)
    expect(await listarDispensas(companyId, 'COMPLEMENTO', prisma)).toHaveLength(0)
    // ⚠️ reverter NÃO apaga: a linha fica, carimbada — o rastro vale nos dois sentidos
    expect(await prisma.stockVendaDiaDispensado.count({ where: { companyId } })).toBe(1)
  })

  it('⭐ dispensar duas vezes o mesmo dia não cria duas (índice único parcial)', async () => {
    const a = await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-02', userId }, prisma)
    const b = await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-02', userId }, prisma)
    expect(b.jaEstava).toBe(true)
    expect(b.dispensaId).toBe(a.dispensaId)
    expect(await prisma.stockVendaDiaDispensado.count({ where: { companyId, revertidoEm: null } })).toBe(1)
  })

  it('⛔ e o escopo separa os dois relatórios: dispensar complemento não dispensa produto', async () => {
    await dispensarDia({ companyId, escopo: 'COMPLEMENTO', data: '2026-09-02', userId }, prisma)
    expect(await diasDispensados(prisma, companyId, 'COMPLEMENTO')).toEqual(new Set(['2026-09-02']))
    expect(await diasDispensados(prisma, companyId, 'PRODUTO')).toEqual(new Set())
  })

  it('⭐ a régua pura do aviso: dispensado sai, novo fica, recente espera', () => {
    const dias = [
      { data: '2026-09-02', escopo: 'COMPLEMENTO' as const, importId: 'a', ocorrencias: 1, importadoEm: horasAtras(48) },
      { data: '2026-09-06', escopo: 'COMPLEMENTO' as const, importId: 'b', ocorrencias: 1, importadoEm: horasAtras(48) },
      { data: '2026-09-07', escopo: 'COMPLEMENTO' as const, importId: 'c', ocorrencias: 1, importadoEm: horasAtras(2) },
    ]
    const r = pendentesQueAvisam(dias, new Set(['2026-09-02']), new Date())
    expect(r.map((d) => d.data)).toEqual(['2026-09-06'])
    expect(HORAS_ATE_AVISAR).toBe(24)
  })
})
