// ESTOQUE — REGRA 1 do fix do E15 (22/08): nota que JÁ tem evento ENVIADO (Ciência OU
// Confirmação) está manifestada; tentativas ERRO anteriores (parse ruim / seq 594) são
// ruído. E15 só flagra nota SEM nenhuma manifestação registrada. Caso real: 2 notas da
// Caçula em ERRO >24h que já tinham 135/210200 — o E15 gritava à toa.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { checkStockInvariants } from '../stock-invariants'

const CNPJ = '80808080000180'
let companyId: string
const CHAVE_OK = '43260880808080000180550100000000011111100011' // tem ENVIADO
const CHAVE_RUIM = '43260880808080000180550100000000022222200022' // só ERRO
const velho = new Date(Date.now() - 48 * 3600_000) // > 24h

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'E15' } })
  companyId = c.id
})
afterEach(async () => {
  await prisma.stockSefazEvent.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const e15DaEmpresa = async () => (await checkStockInvariants(prisma)).filter((f) => f.invariante === 'E15' && f.companyId === companyId)

describe('E15 — nota manifestada não grita', () => {
  it('nota com ERRO antigo MAS com ENVIADO (sucesso) → E15 NÃO dispara', async () => {
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_OK, tpEvento: '210210', nSeqEvento: 1, status: 'ERRO', xMotivo: 'sem retEnvEvento', tentativas: 1, criadoEm: velho } })
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_OK, tpEvento: '210210', nSeqEvento: 1, status: 'ENVIADO', cStat: '135', xMotivo: 'Evento registrado', criadoEm: velho } })
    expect(await e15DaEmpresa()).toHaveLength(0)
  })

  it('Confirmação (210200) ENVIADA supera Ciência (210210) em ERRO → E15 NÃO dispara', async () => {
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_OK, tpEvento: '210200', nSeqEvento: 1, status: 'ENVIADO', cStat: '135', xMotivo: 'Confirmação registrada', criadoEm: velho } })
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_OK, tpEvento: '210210', nSeqEvento: 2, status: 'ERRO', cStat: '594', xMotivo: 'seq maior que permitido', tentativas: 1, criadoEm: velho } })
    expect(await e15DaEmpresa()).toHaveLength(0)
  })

  it('nota SÓ com ERRO antigo (sem nenhuma manifestação) → E15 DISPARA', async () => {
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_RUIM, tpEvento: '210210', nSeqEvento: 1, status: 'ERRO', xMotivo: 'sem retEnvEvento', tentativas: 1, criadoEm: velho } })
    const f = await e15DaEmpresa()
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toContain(CHAVE_RUIM)
  })
})
