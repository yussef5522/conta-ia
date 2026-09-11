// ⭐⭐⭐ O CORTE NA FILA INTEIRA, contra o banco (11/09/2026).
//
// **O dono:** *"Linha de extrato ANTERIOR a 01/09 sai da fila: não vira card, não entra em
// 'pra tua mão', não conta no badge. Continua existindo nas Movimentações como despesa
// categorizada, e o Find & Match manual ainda ACHA ela se EU procurar."*
//
// ⚠️ A cena é a real: o **IVAN** com pagamentos de **24/08, 31/08 e setembro** — depois do
// corte, só os de setembro são oferecidos.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { contasEsperandoPagamento, lotesDaFila, contarVinculosEsperandoDecisao } from '../fila-de-conciliacao'

const db = new PrismaClient()
let companyId = ''
let contaId = ''
let fornId = ''

const linha = (desc: string, valor: number, dia: string) => db.transaction.create({
  data: {
    description: desc, amount: valor, type: 'DEBIT', date: new Date(`${dia}T12:00:00.000Z`),
    lifecycle: 'EFFECTED', status: 'RECONCILED', origin: 'OFX', bankAccountId: contaId,
  },
})
const nota = (desc: string, valor: number, venc: string) => db.transaction.create({
  data: {
    description: desc, amount: valor, type: 'DEBIT', date: new Date(`${venc}T12:00:00.000Z`),
    dueDate: new Date(`${venc}T00:00:00.000Z`), lifecycle: 'PAYABLE', status: 'PENDING',
    origin: 'MANUAL', supplierId: fornId,
  },
})

beforeAll(async () => {
  const c = await db.company.create({ data: { name: 'Corte teste', cnpj: `${Date.now()}`.slice(-14).padStart(14, '7') } })
  companyId = c.id
  contaId = (await db.bankAccount.create({ data: { companyId, name: 'stone', bankName: 'Stone', accountNumber: '1', balance: 0 } })).id
  fornId = (await db.supplier.create({ data: { companyId, razaoSocial: 'MAURO IVAN LUNARDI' } })).id

  // as notas do Ivan — uma vencendo em agosto, duas em setembro
  await nota('NF 39 IVAN', 625, '2026-08-24')
  await nota('NF 41 IVAN', 613.50, '2026-09-05')
  await nota('NF 42 IVAN', 350, '2026-09-14')
  // os pagamentos no extrato: dois de AGOSTO (a época que ele decidiu deixar pra trás)
  await linha('MAURO IVAN LUNARDI - Pagamento', 625, '2026-08-24')
  await linha('MAURO IVAN LUNARDI - Pagamento', 1743.25, '2026-08-31')
  // e um de SETEMBRO
  await linha('MAURO IVAN LUNARDI - Pagamento', 613.50, '2026-09-05')
})

afterAll(async () => {
  await db.transaction.deleteMany({ where: { OR: [{ bankAccount: { companyId } }, { supplier: { companyId } }] } })
  await db.bankAccount.deleteMany({ where: { companyId } })
  await db.supplier.deleteMany({ where: { companyId } })
  await db.company.deleteMany({ where: { id: companyId } })
  await db.$disconnect()
})

const definirCorte = (d: string | null) =>
  db.company.update({ where: { id: companyId }, data: { conciliarAPartirDe: d ? new Date(`${d}T00:00:00.000Z`) : null } })

describe('⛔⛔ a fila para de oferecer linha anterior ao corte', () => {
  it('⭐ SEM corte, a fila enxerga agosto (o comportamento de sempre)', async () => {
    await definirCorte(null)
    const contas = await contasEsperandoPagamento(companyId, db)
    const datas = contas.flatMap((c) => c.sugestoes.map((s) => s.extrato.data))
    expect(datas.some((d) => d < new Date('2026-09-01'))).toBe(true)
  })

  it('⛔⛔ COM corte em 01/09, NENHUMA linha pré-corte é oferecida', async () => {
    await definirCorte('2026-09-01')
    const contas = await contasEsperandoPagamento(companyId, db)
    const oferecidas = contas.flatMap((c) => c.sugestoes.map((s) => s.extrato.data))
    expect(oferecidas.length).toBeGreaterThan(0)                       // ⭐ a fila não secou
    expect(oferecidas.every((d) => d >= new Date('2026-09-01'))).toBe(true)
  })

  it('⛔ o LOTE também respeita o corte — ele oferece as mesmas linhas por outro caminho', async () => {
    await definirCorte('2026-09-01')
    const { lotes, naoFecham } = await lotesDaFila(companyId, db)
    const datas = [...lotes.map((l) => l.linha.data), ...naoFecham.map((n) => n.data)]
    expect(datas.every((d) => d >= new Date('2026-09-01'))).toBe(true)
  })

  it('⭐⭐ o BADGE deriva do mesmo corte — menu e tela não podem divergir', async () => {
    await definirCorte(null)
    const semCorte = await contarVinculosEsperandoDecisao(companyId, db)
    await definirCorte('2026-09-01')
    const comCorteAplicado = await contarVinculosEsperandoDecisao(companyId, db)
    expect(comCorteAplicado).toBeLessThanOrEqual(semCorte)
  })

  it('⛔⛔ e a LINHA DE AGOSTO CONTINUA EXISTINDO — o corte é da vitrine, não do dado', async () => {
    await definirCorte('2026-09-01')
    const viva = await db.transaction.findFirst({
      where: { bankAccountId: contaId, date: { lt: new Date('2026-09-01') }, description: { contains: 'IVAN' } },
    })
    expect(viva).not.toBeNull()          // ⭐ nas Movimentações, no DRE, e achável na busca
    expect(viva!.amount).toBe(625)
  })
})
