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
  for (const t of ['stockPayableLink', 'stockPayableSuggestion', 'stockParcelaCombinada', 'stockNfe'] as const) {
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

// ---------------------------------------------------------------------------
// F4 (29/08/2026) — a régua mudou: o COMBINADO, não a duplicata crua do XML
// ---------------------------------------------------------------------------
describe('⭐⭐ F4 — o combinado vigente fecha com o que o financeiro vai cobrar', () => {
  /** renegocia a nota do fixture (1 parcela de 500 já enviada) pra 2 de 250 */
  const renegociar = async (parcelas: Array<{ valor: number; dVenc: string }>, motivo?: string) => {
    const { renegociarParcelasDaNota } = await import('../ponte/renegociar-enviadas')
    return renegociarParcelasDaNota(
      { companyId, nfeId, parcelas, motivo, ctx: buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] }), userId },
      prisma,
    )
  }

  it('⭐⭐ renegociação BEM-FEITA é VERDE — a régua velha (contra o XML) acusaria erro aqui', async () => {
    // ⚠️ ESTE é o teste que justifica a mudança: a nota tem UMA duplicata de 500; o
    // combinado passa a ter DUAS de 250. Medir contra o XML chamaria isso de defeito, e o
    // dono receberia e-mail de erro toda vez que renegociasse — alarme falso é como um
    // alarme morre.
    const r = await renegociar([{ valor: 250, dVenc: '2026-09-10' }, { valor: 250, dVenc: '2026-10-10' }])
    expect(r.contasCanceladas).toBe(1)
    expect(r.contasCriadas).toBe(2)
    expect(soDesta(await checkPonteInvariants(prisma), 'F4')).toHaveLength(0)
    expect(soDesta(await checkPonteInvariants(prisma), 'F1')).toHaveLength(0)
  })

  it('⭐⭐ PEGA o combinado discordando do financeiro (alguém mexeu na conta por fora)', async () => {
    await renegociar([{ valor: 250, dVenc: '2026-09-10' }, { valor: 250, dVenc: '2026-10-10' }])
    // o financeiro passa a cobrar 400 numa das contas — o combinado diz 250
    const conta = await prisma.transaction.findFirstOrThrow({ where: { supplier: { companyId }, origin: ORIGEM_PONTE } })
    await prisma.transaction.update({ where: { id: conta.id }, data: { amount: 400 } })
    // (F1 pega o valor da conta × amarra; F4 pega o TOTAL combinado × total do financeiro)
    const link = await prisma.stockPayableLink.findFirstOrThrow({ where: { transactionId: conta.id } })
    await prisma.stockPayableLink.update({ where: { id: link.id }, data: { valor: 400 } })

    const f4 = soDesta(await checkPonteInvariants(prisma), 'F4')
    expect(f4).toHaveLength(1)
    expect(f4[0].detalhe).toContain('discordam')
  })

  it('⚠️ soma diferente da NOTA sem motivo é AVISO — não erro (desconto/juros existem)', async () => {
    await renegociar([{ valor: 200, dVenc: '2026-09-10' }, { valor: 200, dVenc: '2026-10-10' }], 'desconto negociado')
    const comMotivo = soDesta(await checkPonteInvariants(prisma), 'F4')
    expect(comMotivo).toHaveLength(0) // motivo escrito → nada a cobrar

    // apaga o motivo: o juiz passa a pedir o porquê, como AVISO
    await prisma.stockParcelaCombinada.updateMany({ where: { companyId, refId: nfeId, ativo: true }, data: { motivo: null } })
    const semMotivo = soDesta(await checkPonteInvariants(prisma), 'F4')
    expect(semMotivo).toHaveLength(1)
    expect(semMotivo[0].nivel).toBe('aviso')
    expect(semMotivo[0].detalhe).toMatch(/motivo/)
  })

  it('nota SEM renegociação nem entra na conta do F4 (custo zero pro caso comum)', async () => {
    expect(soDesta(await checkPonteInvariants(prisma), 'F4')).toHaveLength(0)
  })
})
