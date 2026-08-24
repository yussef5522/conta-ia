// PONTE 1 — o juiz. O estoque ganhou permissão de escrever no financeiro; estes
// invariantes são o contrapeso: TODA linha que ele escreveu lá é conferida.
// Cada um tem red-then-green (quebra de propósito → o juiz pega → conserta → verde).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildAuthContextForTest } from '@/lib/auth/rbac'
import type { StockInvariantFail } from '../stock-invariants'
import { checkPonteInvariants, F3_DIAS } from '../ponte-invariants'
import { enviarParaContasPagar, ORIGEM_PONTE } from '../ponte-contas-pagar'

const CNPJ = '50607080000222'
const CHAVE = '43260888728027000146550010000999991234567890'
let companyId: string, userId: string, nfeId: string, sugId: string, txId: string

const soDesta = (fs: StockInvariantFail[], inv: string) => fs.filter((f) => f.companyId === companyId && f.invariante === inv)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA JUIZ PONTE' } })).id
  userId = (await prisma.user.create({ data: { email: `juizponte-${Date.now()}@teste.com`, name: 'Dono', password: 'x' } })).id
  nfeId = (await prisma.stockNfe.create({ data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', temXmlCompleto: true, emitNome: 'FORN JUIZ', emitCnpj: '88728027000146', vNF: 500 } })).id
  sugId = (await prisma.stockPayableSuggestion.create({ data: { companyId, nfeId, chave: CHAVE, supplierCnpj: '88728027000146', supplierNome: 'FORN JUIZ', nDup: '001', dVenc: new Date('2026-09-10'), valor: 500 } })).id
  const r = await enviarParaContasPagar({ companyId, suggestionIds: [sugId], cadastrarFornecedores: true, ctx: buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] }) }, prisma)
  txId = r.transactionIds[0]
})

afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { supplier: { companyId } } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  for (const t of ['stockPayableLink', 'stockPayableSuggestion', 'stockNfe'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.auditLog.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
})

describe('F1 — toda conta da ponte é rastreável e bate', () => {
  it('ponte bem-feita passa VERDE', async () => {
    expect(soDesta(await checkPonteInvariants(prisma), 'F1')).toHaveLength(0)
  })

  it('PEGA conta marcada origem=ESTOQUE_NF SEM vínculo (rastro quebrado)', async () => {
    const link = await prisma.stockPayableLink.findFirstOrThrow({ where: { companyId } })
    await prisma.stockPayableLink.delete({ where: { id: link.id } })

    const f1 = soDesta(await checkPonteInvariants(prisma), 'F1')
    expect(f1).toHaveLength(1)
    expect(f1[0].detalhe).toContain('rastro quebrado')

    await prisma.stockPayableLink.create({ data: { ...link } })
    expect(soDesta(await checkPonteInvariants(prisma), 'F1')).toHaveLength(0)
  })

  it('PEGA valor divergente (a ponte inflaria o contas a pagar)', async () => {
    await prisma.transaction.update({ where: { id: txId }, data: { amount: 5000 } })
    const f1 = soDesta(await checkPonteInvariants(prisma), 'F1')
    expect(f1).toHaveLength(1)
    expect(f1[0].detalhe).toContain('inflaria')
    await prisma.transaction.update({ where: { id: txId }, data: { amount: 500 } })
    expect(soDesta(await checkPonteInvariants(prisma), 'F1')).toHaveLength(0)
  })

  it('PEGA conta sem nota-mãe (a nota sumiu)', async () => {
    await prisma.stockPayableSuggestion.deleteMany({ where: { companyId } })
    await prisma.stockNfe.delete({ where: { id: nfeId } })
    const f1 = soDesta(await checkPonteInvariants(prisma), 'F1')
    expect(f1.some((f) => f.detalhe.includes('sem nota-mãe'))).toBe(true)
  })
})

describe('F2 — amarra órfã (a conta sumiu do financeiro)', () => {
  it('PEGA quando alguém apaga a conta pelo financeiro', async () => {
    await prisma.transaction.delete({ where: { id: txId } })
    const f2 = soDesta(await checkPonteInvariants(prisma), 'F2')
    expect(f2).toHaveLength(1)
    expect(f2[0].detalhe).toContain('não existe mais')
  })
})

describe('F3 (aviso) — boleto esquecido no estoque', () => {
  it('parcela recém-conferida NÃO vira aviso', async () => {
    expect(soDesta(await checkPonteInvariants(prisma), 'F3')).toHaveLength(0)
  })

  it(`AVISA parcela parada há mais de ${F3_DIAS} dias sem ir pro contas a pagar`, async () => {
    const nova = await prisma.stockPayableSuggestion.create({
      data: { companyId, nfeId, chave: CHAVE, supplierNome: 'ESQUECIDO', nDup: '002', dVenc: new Date('2026-09-20'), valor: 123.45, criadoEm: new Date(Date.now() - (F3_DIAS + 3) * 86_400_000) },
    })
    const f3 = soDesta(await checkPonteInvariants(prisma), 'F3')
    expect(f3).toHaveLength(1)
    expect(f3[0].detalhe).toContain('ESQUECIDO')
    expect(f3[0].detalhe).toContain('vence sem aparecer')
    expect(f3[0].nivel).toBe('aviso')

    // enviar pro contas a pagar SILENCIA o aviso
    await enviarParaContasPagar({ companyId, suggestionIds: [nova.id], cadastrarFornecedores: true, ctx: buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] }) }, prisma)
    expect(soDesta(await checkPonteInvariants(prisma), 'F3')).toHaveLength(0)
  })
})
