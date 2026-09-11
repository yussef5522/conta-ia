// ESTOQUE FASE 1 item 2 — o extrato do estoque: lê o ledger, resolve referência (nota),
// destaca estorno, filtra, exporta CSV.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, estornarMovimento } from '../movement'
import { listMovimentos, movimentosToCsv } from '../movimentos'

// ⚠️ CNPJ ÚNICO NA SUÍTE (06/09): este arquivo dividia o CNPJ com outro, e os dois, em
// PARALELO, apagavam a empresa um do outro no `beforeEach` (FK violation intermitente).
// Só aparece na suíte inteira — rodando o arquivo sozinho passa sempre.
const CNPJ = '50607080000270'
const CHAVE = '43260850607080000199550100000000011234500017'
let companyId: string
let itemId: string

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA EXTRATO' } })
  companyId = c.id
  const item = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  itemId = item.id
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', emitNome: 'FRIGORIFICO SILVA' } })
  const mov = await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 28, custoUnitario: 40, nfeChave: CHAVE, origem: 'SEFAZ' })
  await estornarMovimento(prisma, mov.id)
})
afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('listMovimentos', () => {
  // ⚠️ INVERTIDO COM O MOTIVO (11/09): o extrato passou a nascer no modo CLEAN, e esta cena
  // é uma entrada 100% estornada — ou seja, exatamente o par que colapsa. O teste é sobre a
  // REFERÊNCIA da linha, então pede o forense (a lista crua de sempre). O clean ganhou teste
  // próprio logo abaixo.
  it('lista com referência da nota (fornecedor + nº) e destaca o estorno', async () => {
    const ms = await listMovimentos(companyId, { forense: true })
    expect(ms).toHaveLength(2) // entrada + estorno
    const entrada = ms.find((m) => m.tipo === 'ENTRADA_NF')!
    expect(entrada.referencia.tipo).toBe('nota')
    expect(entrada.referencia.label).toContain('FRIGORIFICO SILVA')
    expect(entrada.referencia.nfeId).toBeTruthy()
    const estorno = ms.find((m) => m.tipo === 'ESTORNO')!
    expect(estorno.estorno).toBe(true)
    expect(estorno.quantidade).toBe(-28)
  })
  it('filtra por tipo', async () => {
    expect(await listMovimentos(companyId, { tipo: 'ESTORNO', forense: true })).toHaveLength(1)
  })

  it('⭐⭐ MODO CLEAN (padrão): a entrada estornada vira UMA linha fina, sem valor somando', async () => {
    const ms = await listMovimentos(companyId, {})
    expect(ms).toHaveLength(1)
    expect(ms[0].anulado).not.toBeNull()
    expect(ms[0].anulado!.frase).toContain('estornada em')
    expect([ms[0].quantidade, ms[0].custoTotal, ms[0].movePrateleira]).toEqual([0, 0, false])
  })

  it('⛔⛔ e a soma do extrato NÃO muda entre clean e forense', async () => {
    const { somaDoExtrato } = await import('../movimentos')
    expect(somaDoExtrato(await listMovimentos(companyId, {})))
      .toEqual(somaDoExtrato(await listMovimentos(companyId, { forense: true })))
  })

  it('⛔ o filtro por TIPO não colapsa meio par — estorno sozinho na lista fica à vista', async () => {
    // o original não entra no recorte, então não há par: esconder aqui seria sumir com o dado
    const so = await listMovimentos(companyId, { tipo: 'ESTORNO' })
    expect(so).toHaveLength(1)
    expect(so[0].anulado).toBeNull()
  })
  // ⭐ o CSV é SEMPRE forense (a rota força): arquivo é pra auditoria, e lá o par vai inteiro.
  it('CSV tem cabeçalho + linhas com ; e vírgula decimal', async () => {
    const csv = movimentosToCsv(await listMovimentos(companyId, { forense: true }))
    expect(csv.split('\n')[0]).toContain('Data')
    expect(csv).toContain('"40,00"') // custo unit com vírgula
  })
})

describe('⭐⭐ coluna SALDO no extrato — só quando dá pra AFIRMAR', () => {
  it('⭐ lista contígua (sem filtro): a linha mais recente vale o saldo de hoje', async () => {
    const { saldosDaEmpresa } = await import('../saldo')
    const ms = await listMovimentos(companyId, {})
    const saldos = new Map((await saldosDaEmpresa(prisma, companyId)).map((s) => [s.itemId, s.saldo]))
    expect(ms[0].saldoApos).toBe(saldos.get(ms[0].itemId))
  })

  it('⛔⛔ FILTRO POR TIPO não dá saldo — o recorte não permite afirmar', async () => {
    const ms = await listMovimentos(companyId, { tipo: 'ESTORNO', forense: true })
    expect(ms).toHaveLength(1)
    expect(ms[0].saldoApos).toBeNull()
  })

  it('⛔⛔ PERÍODO que fecha antes de hoje não dá saldo', async () => {
    const ms = await listMovimentos(companyId, { ate: '2026-09-30', forense: true })
    for (const m of ms) expect(m.saldoApos).toBeNull()
  })

  // ⚠️⚠️ INVERTIDO PELA PROVA EM PROD (11/09): eu tinha barrado o limite estourado, e a
  // Caçula tem 1.013 movimentos contra um teto de 500 — a coluna inteira nascia "—" na tela
  // em que ela mais serve. Truncar corta o PASSADO, e o passado não entra nesta conta: o
  // saldo desce do topo, e o topo está inteiro.
  it('⭐⭐ LIMITE estourado CONTINUA dando saldo — truncar corta o passado, não o presente', async () => {
    const { saldosDaEmpresa } = await import('../saldo')
    const saldos = new Map((await saldosDaEmpresa(prisma, companyId)).map((s) => [s.itemId, s.saldo]))
    const ms = await listMovimentos(companyId, { limite: 1, forense: true })
    expect(ms).toHaveLength(1)
    expect(ms[0].saldoApos).toBe(saldos.get(ms[0].itemId))
  })

  it('⭐ filtro DE (corta o passado) também continua dando saldo', async () => {
    const ms = await listMovimentos(companyId, { de: '2020-01-01', forense: true })
    expect(ms.every((m) => m.saldoApos != null)).toBe(true)
  })
})
