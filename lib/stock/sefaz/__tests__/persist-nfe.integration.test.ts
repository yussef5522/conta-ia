// ESTOQUE FASE 0 item 3 — integração do persist da NF-e completa. Grava itens/dup/emit
// da NF-e real anonimizada, prova IDEMPOTÊNCIA (2× = mesma contagem) e ISOLAMENTO.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/db'
import { saveNfeCompleta } from '../persist-nfe'
import { snapshotClosedModules, isolationHeld } from '../../stock-invariants'

const xml = readFileSync(join(__dirname, 'fixtures/nfe-completa-real.xml'), 'utf-8')
const CNPJ = '66777888000199'
let companyId: string
let nfeId: string

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA PERSIST TESTE' } })
  companyId = c.id
  const nfe = await prisma.stockNfe.create({ data: { companyId, chave: '42260511222333000181550020063812691168173940', nsu: '000000000000001', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true } })
  nfeId = nfe.id
})
afterAll(async () => {
  await prisma.stockNfeItem.deleteMany({ where: { companyId } })
  await prisma.stockNfeDup.deleteMany({ where: { companyId } })
  await prisma.stockNfeEmit.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('saveNfeCompleta — persist', () => {
  it('grava itens, duplicatas e emitente da nota', async () => {
    await saveNfeCompleta({ nfeId, companyId, chave: '42260511222333000181550020063812691168173940', xml, db: prisma })
    expect(await prisma.stockNfeItem.count({ where: { nfeId } })).toBe(1)
    const item = await prisma.stockNfeItem.findFirst({ where: { nfeId } })
    expect(item?.xProd).toContain('OLEO DE SOJA')
    expect(item?.vProd).toBe(926.4)
    const dup = await prisma.stockNfeDup.findFirst({ where: { nfeId } })
    expect(dup?.vDup).toBe(926.4)
    const emit = await prisma.stockNfeEmit.findUnique({ where: { nfeId } })
    expect(emit?.xNome).toBe('FORNECEDOR TESTE LTDA')
    expect(emit?.uf).toBe('SC')
  })

  it('idempotente: parsear 2× = 1 item, 1 dup (apaga e recria)', async () => {
    await saveNfeCompleta({ nfeId, companyId, chave: '42260511222333000181550020063812691168173940', xml, db: prisma })
    expect(await prisma.stockNfeItem.count({ where: { nfeId } })).toBe(1)
    expect(await prisma.stockNfeDup.count({ where: { nfeId } })).toBe(1)
    expect(await prisma.stockNfeEmit.count({ where: { nfeId } })).toBe(1)
  })

  it('ISOLAMENTO: parsear não muda módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma)
    await saveNfeCompleta({ nfeId, companyId, chave: '42260511222333000181550020063812691168173940', xml, db: prisma })
    expect(isolationHeld(antes, await snapshotClosedModules(prisma))).toBe(true)
  })
})
