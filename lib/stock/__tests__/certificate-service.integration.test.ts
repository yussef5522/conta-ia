// ESTOQUE FASE 0 item 1 — integração do serviço de certificado contra o DB real.
// Prova: grava/valida CNPJ, "um ativo por company", E12, e ISOLAMENTO (nenhuma
// tabela fechada muda ao subir certificado). Cria uma empresa de teste e limpa depois.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { makePfx } from './_make-pfx'
import { saveCertificate, getCertificateStatus, SaveCertificateError } from '../certificate-service'
import { checkStockInvariants, snapshotClosedModules, isolationHeld } from '../stock-invariants'

const CNPJ = '11222333000181'
const SENHA = 'senha-forte-123'
const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000)

let companyId: string
let pfxValido: Buffer

beforeAll(async () => {
  process.env.STOCK_CERT_ENC_KEY = 'chave-de-teste-scrypt-bem-longa-0987654321'
  await prisma.stockCertificate.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA TESTE ESTOQUE' } })
  companyId = c.id
  pfxValido = makePfx(`EMPRESA TESTE LTDA:${CNPJ}`, SENHA, daqui(-30), daqui(300))
}, 30_000)

afterAll(async () => {
  await prisma.stockCertificate.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('saveCertificate — integração', () => {
  it('grava o certificado ATIVO com CNPJ/validade certos', async () => {
    const st = await saveCertificate({ companyId, userId: 'user-teste', pfxBuffer: pfxValido, senha: SENHA })
    expect(st.cnpj).toBe(CNPJ)
    expect(st.razaoSocial).toBe('EMPRESA TESTE LTDA')
    expect(st.status).toBe('ATIVO')
    expect(st.vencido).toBe(false)
    const ativo = await getCertificateStatus(companyId)
    expect(ativo?.cnpj).toBe(CNPJ)
  })

  it('recusa certificado de OUTRO CNPJ (REGRA 8 fiscal)', async () => {
    const pfxOutro = makePfx('OUTRA EMPRESA:99888777000166', SENHA, daqui(-30), daqui(300))
    await expect(saveCertificate({ companyId, userId: 'u', pfxBuffer: pfxOutro, senha: SENHA }))
      .rejects.toMatchObject({ code: 'CNPJ_MISMATCH' })
  })

  it('recusa certificado VENCIDO', async () => {
    const pfxVencido = makePfx(`EMPRESA TESTE LTDA:${CNPJ}`, SENHA, daqui(-400), daqui(-1))
    await expect(saveCertificate({ companyId, userId: 'u', pfxBuffer: pfxVencido, senha: SENHA }))
      .rejects.toMatchObject({ code: 'VENCIDO' })
  })

  it('um ATIVO por company — o 2º upload desativa o 1º', async () => {
    const pfx2 = makePfx(`EMPRESA TESTE LTDA:${CNPJ}`, SENHA, daqui(-10), daqui(365))
    await saveCertificate({ companyId, userId: 'u', pfxBuffer: pfx2, senha: SENHA })
    const ativos = await prisma.stockCertificate.count({ where: { companyId, status: 'ATIVO' } })
    expect(ativos).toBe(1)
    const inativos = await prisma.stockCertificate.count({ where: { companyId, status: 'INATIVO' } })
    expect(inativos).toBeGreaterThanOrEqual(1)
  })

  it('E12 — certificado que vence em < 30 dias entra no juiz', async () => {
    // substitui por um que vence em 10 dias
    const pfxCurto = makePfx(`EMPRESA TESTE LTDA:${CNPJ}`, SENHA, daqui(-10), daqui(10))
    await saveCertificate({ companyId, userId: 'u', pfxBuffer: pfxCurto, senha: SENHA })
    const fails = await checkStockInvariants(prisma)
    const meu = fails.find((f) => f.invariante === 'E12' && f.companyId === companyId)
    expect(meu).toBeTruthy()
    expect(meu?.detalhe).toMatch(/vence em|VENCIDO/)
  })
})

describe('ISOLAMENTO — subir certificado não muda nenhum módulo fechado', () => {
  it('snapshot das tabelas fechadas idêntico antes/depois', async () => {
    const antes = await snapshotClosedModules(prisma)
    const pfx = makePfx(`EMPRESA TESTE LTDA:${CNPJ}`, SENHA, daqui(-5), daqui(200))
    await saveCertificate({ companyId, userId: 'u', pfxBuffer: pfx, senha: SENHA })
    const depois = await snapshotClosedModules(prisma)
    expect(isolationHeld(antes, depois)).toBe(true)
    expect(depois).toEqual(antes) // transaction/category/loan/... inalterados
  })
})
