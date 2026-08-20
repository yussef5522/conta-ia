// ESTOQUE FASE 0 item 2 — integração do LOOP de download (fake pager, sem SEFAZ real).
// Prova: status por DATA DE CORTE, paginação, idempotência, bloqueio 656, ISOLAMENTO.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { downloadSefaz, type SefazPager } from '../download'
import { buildSefazReport } from '../report'
import { snapshotClosedModules, isolationHeld } from '../../stock-invariants'
import type { SefazResponse, SefazDoc } from '../parse-response'

const CNPJ = '55666777000188'
const CORTE = new Date('2026-08-19T00:00:00Z')
let companyId: string

const doc = (chave: string, dataEmissao: string, tipo: SefazDoc['tipo'] = 'resumo', extra: Partial<SefazDoc> = {}): SefazDoc => ({
  nsu: chave.slice(-3), schema: 'resNFe_v1.01.xsd', tipo, chave, emitCnpj: '11222333000181', emitNome: 'FORNECEDOR X', vNF: 100, dataEmissao, xml: '<resNFe/>', ...extra,
})

beforeAll(async () => {
  await prisma.stockNfe.deleteMany({ where: { emitNome: 'FORNECEDOR X' } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA SEFAZ TESTE', state: 'RS' } })
  companyId = c.id
})
afterAll(async () => {
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.stockSefazLog.deleteMany({ where: { companyId } })
  await prisma.stockSefazState.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})
beforeEach(async () => {
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.stockSefazLog.deleteMany({ where: { companyId } })
  await prisma.stockSefazState.deleteMany({ where: { companyId } })
  await prisma.stockSefazState.create({ data: { companyId, dataCorte: CORTE, ultNSU: '000000000000000', maxNSU: '000000000000000' } })
})

describe('downloadSefaz — LOOP', () => {
  it('classifica por DATA DE CORTE (histórica vs nova) e conta evento', async () => {
    const pager: SefazPager = async () => ({
      cStat: '138', xMotivo: 'ok', ultNSU: '000000000000003', maxNSU: '000000000000003',
      docs: [
        doc('43260600000000000000000000000000000000000001', '2026-06-10T09:00:00-03:00'), // histórica
        doc('43260800000000000000000000000000000000000002', '2026-08-19T09:00:00-03:00'), // nova (== corte)
        { ...doc('43260800000000000000000000000000000000000003', '2026-08-19T10:00:00-03:00'), tipo: 'evento', chave: undefined },
      ],
    })
    const r = await downloadSefaz({ companyId, pager, now: new Date('2026-08-19T12:00:00Z') })
    expect(r.novas).toBe(1)
    expect(r.historicas).toBe(1)
    expect(r.eventos).toBe(1)
    const linhas = await prisma.stockNfe.findMany({ where: { companyId }, orderBy: { dataEmissao: 'asc' } })
    expect(linhas.map((l) => l.status)).toEqual(['HISTORICA', 'AGUARDANDO_MERCADORIA'])
  })

  it('pagina do ultNSU até o maxNSU', async () => {
    let chamada = 0
    const pager: SefazPager = async () => {
      chamada++
      if (chamada === 1) return { cStat: '138', xMotivo: 'ok', ultNSU: '000000000000002', maxNSU: '000000000000004', docs: [doc('43260800000000000000000000000000000000000010', '2026-08-19T09:00:00-03:00')] }
      return { cStat: '138', xMotivo: 'ok', ultNSU: '000000000000004', maxNSU: '000000000000004', docs: [doc('43260800000000000000000000000000000000000011', '2026-08-19T09:00:00-03:00')] }
    }
    const r = await downloadSefaz({ companyId, pager, now: new Date() })
    expect(r.paginas).toBe(2)
    expect(await prisma.stockNfe.count({ where: { companyId } })).toBe(2)
  })

  it('idempotência: rodar 2× com os mesmos docs = 0 nota nova', async () => {
    const pager: SefazPager = async () => ({ cStat: '137', xMotivo: 'vazio', ultNSU: '000000000000001', maxNSU: '000000000000001', docs: [doc('43260800000000000000000000000000000000000020', '2026-08-19T09:00:00-03:00')] })
    await downloadSefaz({ companyId, pager, now: new Date() })
    await prisma.stockSefazState.update({ where: { companyId }, data: { ultNSU: '000000000000000' } }) // "re-download do zero"
    await downloadSefaz({ companyId, pager, now: new Date() })
    expect(await prisma.stockNfe.count({ where: { companyId } })).toBe(1) // upsert por (companyId,chave)
  })

  it('cStat 656 (consumo indevido) → bloqueia 1h e a próxima rodada sai cedo', async () => {
    const pager: SefazPager = async () => ({ cStat: '656', xMotivo: 'Consumo Indevido', ultNSU: '000000000000000', maxNSU: '000000000000000', docs: [] })
    const now = new Date('2026-08-19T12:00:00Z')
    const r1 = await downloadSefaz({ companyId, pager, now })
    expect(r1.blocked).toBe(true)
    const st = await prisma.stockSefazState.findUnique({ where: { companyId } })
    expect(st?.blockedUntil).toBeTruthy()
    // próxima rodada dentro da 1h → sai cedo, nem chama o pager
    let chamou = false
    const pager2: SefazPager = async () => { chamou = true; return { cStat: '137', xMotivo: '', ultNSU: '0', maxNSU: '0', docs: [] } }
    const r2 = await downloadSefaz({ companyId, pager: pager2, now: new Date(now.getTime() + 10 * 60000) })
    expect(r2.blocked).toBe(true)
    expect(chamou).toBe(false)
  })

  it('ISOLAMENTO: baixar da SEFAZ não muda nenhum módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma)
    const pager: SefazPager = async () => ({ cStat: '138', xMotivo: 'ok', ultNSU: '000000000000001', maxNSU: '000000000000001', docs: [doc('43260800000000000000000000000000000000000030', '2026-08-19T09:00:00-03:00')] })
    await downloadSefaz({ companyId, pager, now: new Date() })
    const depois = await snapshotClosedModules(prisma)
    expect(isolationHeld(antes, depois)).toBe(true)
  })

  it('relatório agrega histórica vs nova + período', async () => {
    const pager: SefazPager = async () => ({
      cStat: '137', xMotivo: 'ok', ultNSU: '000000000000002', maxNSU: '000000000000002',
      docs: [
        doc('43260600000000000000000000000000000000000040', '2026-06-01T09:00:00-03:00'),
        { ...doc('43260800000000000000000000000000000000000041', '2026-08-19T09:00:00-03:00'), vNF: 250 },
      ],
    })
    await downloadSefaz({ companyId, pager, now: new Date() })
    const rep = await buildSefazReport(companyId, prisma)
    expect(rep.total).toBe(2)
    expect(rep.historicas).toBe(1)
    expect(rep.novas).toBe(1)
    expect(rep.valorTotalNovas).toBe(250)
    expect(rep.periodo.de).toBe('2026-06-01')
    expect(rep.dataCorte).toBe('2026-08-19')
  })
})
