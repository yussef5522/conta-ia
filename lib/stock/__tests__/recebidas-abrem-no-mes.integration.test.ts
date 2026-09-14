// ⭐⭐⭐ "RECEBIDAS" ABRE NO MÊS; A FILA NÃO (14/09/2026) — a régua dos dois tempos.
//
// **Medido em prod:** **123 conferências desde sempre · 80 em setembro.** A lista crescia
// pra sempre e o card dizia um número que não responde pergunta nenhuma do mês.
//
// ⛔⛔ **E A FILA É O CONTRAFACTUAL QUE SEGURA A RÉGUA:** "na fila" e "pra depois" são
// TRABALHO PENDENTE, não fluxo. Recortá-los por mês esconderia a nota de agosto esperando
// conferência — **foi assim que 21 notas ficaram invisíveis** (o F5 de 03/09).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { listRecebimentos } from '@/lib/stock/sefaz/recebimentos'

const CNPJ = '50607080000616'
let companyId = ''

/** uma nota + a conferência que a recebeu (o FATO que aconteceu no tempo) */
async function notaRecebidaEm(confirmadoEm: string, sufixo: string) {
  const chave = `4326088872802700014755001000009671221621147${sufixo}`
  const nfe = await prisma.stockNfe.create({
    data: { companyId, chave, nsu: sufixo, status: 'CONFIRMADA', temXmlCompleto: true, emitNome: 'FORNECEDOR', vNF: 100 },
  })
  await prisma.stockReceiptConference.create({
    data: { companyId, nfeId: nfe.id, chave, status: 'CONFIRMADA', confirmadoEm: new Date(confirmadoEm) },
  })
  return nfe.id
}

/** uma nota ESPERANDO mercadoria — trabalho pendente, de qualquer mês */
async function notaNaFila(dataEmissao: string, sufixo: string) {
  const chave = `4326088872802700014755001000009671221621148${sufixo}`
  return (await prisma.stockNfe.create({
    data: { companyId, chave, nsu: sufixo, status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitNome: 'FORNECEDOR', vNF: 50, dataEmissao: new Date(dataEmissao) },
  })).id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA MES' } })).id
  await notaRecebidaEm('2026-09-10', '101') // no mês
  await notaRecebidaEm('2026-09-02', '102') // no mês
  await notaRecebidaEm('2026-08-20', '103') // mês anterior
  await notaNaFila('2026-08-05', '201')     // ⛔ trabalho de AGOSTO esperando
})

afterEach(async () => {
  for (const t of ['stockReceiptConference', 'stockNfe'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ o mês recorta as RECEBIDAS', () => {
  it('⭐⭐ setembro traz as 2 do mês, não as 3 de sempre', async () => {
    const r = await listRecebimentos(companyId, prisma, new Date('2026-09-14T12:00:00Z'), '2026-09')
    expect(r.recebidas).toHaveLength(2)
  })

  it('⭐ ‹ agosto recalcula — traz a do mês passado', async () => {
    const r = await listRecebimentos(companyId, prisma, new Date('2026-09-14T12:00:00Z'), '2026-08')
    expect(r.recebidas).toHaveLength(1)
    expect(r.recebidas[0].confirmadoEm?.slice(0, 7)).toBe('2026-08')
  })

  it('⚠️ sem mês, o histórico INTEIRO — o caminho de quem quer o total', async () => {
    const r = await listRecebimentos(companyId, prisma, new Date('2026-09-14T12:00:00Z'), null)
    expect(r.recebidas).toHaveLength(3)
  })

  it('⭐⭐ o recorte é por QUANDO EU RECEBI, não por quando o fornecedor emitiu', async () => {
    // ⚠️ nota emitida em agosto e conferida em setembro é recebimento DE SETEMBRO — a
    // `dataEmissao` é do fornecedor; o fato que aconteceu comigo é a CONFERÊNCIA
    const chave = `4326088872802700014755001000009671221621147999`
    const nfe = await prisma.stockNfe.create({
      data: { companyId, chave, nsu: '999', status: 'CONFIRMADA', temXmlCompleto: true, emitNome: 'X', vNF: 10, dataEmissao: new Date('2026-08-01') },
    })
    await prisma.stockReceiptConference.create({
      data: { companyId, nfeId: nfe.id, chave, status: 'CONFIRMADA', confirmadoEm: new Date('2026-09-11') },
    })
    const r = await listRecebimentos(companyId, prisma, new Date('2026-09-14T12:00:00Z'), '2026-09')
    expect(r.recebidas.some((x) => x.nfeId === nfe.id), 'nota de agosto conferida em setembro sumiu').toBe(true)
  })
})

describe('⛔⛔ a FILA ignora o mês — trabalho pendente não expira', () => {
  it('⭐⭐ a nota de AGOSTO esperando mercadoria aparece em setembro', async () => {
    // ⛔ é este teste que segura a régua: sem ele, alguém "uniformizaria" o recorte e a
    // nota esperando sumiria da tela — exatamente as 21 notas invisíveis de 03/09
    const r = await listRecebimentos(companyId, prisma, new Date('2026-09-14T12:00:00Z'), '2026-09')
    expect(r.fila, 'o mês vazou pra fila e escondeu trabalho').toHaveLength(1)
  })

  it('⭐ e ela aparece igual em qualquer mês escolhido', async () => {
    for (const m of ['2026-07', '2026-08', '2026-09', '2026-10']) {
      const r = await listRecebimentos(companyId, prisma, new Date('2026-09-14T12:00:00Z'), m)
      expect(r.fila, `a fila mudou em ${m}`).toHaveLength(1)
    }
  })
})
