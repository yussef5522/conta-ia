// Sprint Gestão de Conta — Cascade da exclusão User (integração real).
// Usa SQLite dev DB. Cria fixtures isolados, valida 0 órfãos.

import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { deleteUserCascade } from '@/lib/admin-clientes/delete-user-cascade'

const TEST_PREFIX = `cascade-test-${Date.now()}-${process.pid}`
const createdUsers: string[] = []
const createdCompanies: string[] = []

let cnpjCounter = 0
function uniqueCnpj() {
  cnpjCounter += 1
  // CNPJ field no schema é VARCHAR @unique sem regex check — passa qualquer string.
  // Concatena counter + nanotime + random pra unicidade real.
  const nano = process.hrtime.bigint().toString()
  return `T${cnpjCounter}-${nano.slice(-10)}-${Math.random().toString(36).slice(2, 8)}`
}

async function createUserCompany(suffix: string) {
  const user = await prisma.user.create({
    data: {
      name: `Test ${suffix}`,
      email: `${TEST_PREFIX}-${suffix}-${cnpjCounter}@test.dev`,
      password: await bcrypt.hash('SenhaForte123!', 10),
    },
  })
  const company = await prisma.company.create({
    data: {
      cnpj: uniqueCnpj(),
      name: `Empresa ${suffix}`,
    },
  })
  await prisma.userCompany.create({
    data: { userId: user.id, companyId: company.id, role: 'OWNER' },
  })
  createdUsers.push(user.id)
  createdCompanies.push(company.id)
  return { user, company }
}

afterAll(async () => {
  // Cleanup geral (idempotente — alguns IDs podem já ter sido apagados)
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
  await prisma.company
    .deleteMany({ where: { cnpj: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

beforeEach(() => {
  createdUsers.length = 0
  createdCompanies.length = 0
})

describe('deleteUserCascade — cenários reais', () => {
  test('user único dono: apaga company + retorna ids', async () => {
    const { user, company } = await createUserCompany('solo')

    const result = await prisma.$transaction(async (tx) => {
      return deleteUserCascade(tx, user.id)
    })

    expect(result.companiesDeleted).toContain(company.id)
    expect(result.companiesKept).toEqual([])
    expect(result.userEmail).toBe(user.email)

    // Confirma 0 órfãos
    const u = await prisma.user.findUnique({ where: { id: user.id } })
    expect(u).toBeNull()
    const c = await prisma.company.findUnique({ where: { id: company.id } })
    expect(c).toBeNull()
  })

  test('company multi-dono: NÃO apaga company, só vínculo do user', async () => {
    const { user: user1, company } = await createUserCompany('multi1')
    const user2 = await prisma.user.create({
      data: {
        name: 'User Multi 2',
        email: `${TEST_PREFIX}-multi2@test.dev`,
        password: await bcrypt.hash('SenhaForte123!', 10),
      },
    })
    createdUsers.push(user2.id)
    await prisma.userCompany.create({
      data: { userId: user2.id, companyId: company.id, role: 'OWNER' },
    })

    const result = await prisma.$transaction(async (tx) => {
      return deleteUserCascade(tx, user1.id)
    })

    expect(result.companiesDeleted).toEqual([])
    expect(result.companiesKept).toContain(company.id)

    // Company preservada, user2 ainda dono
    const c = await prisma.company.findUnique({ where: { id: company.id } })
    expect(c).not.toBeNull()
    const link = await prisma.userCompany.findFirst({
      where: { userId: user2.id, companyId: company.id },
    })
    expect(link).not.toBeNull()
  })

  test('FK Restrict OfxImport.revertedById → setNull não bloqueia', async () => {
    const { user, company } = await createUserCompany('ofx')
    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId: company.id,
        name: 'Conta Teste',
        bankName: 'Banco Teste',
        agency: '0001',
        accountNumber: '12345-6',
      },
    })
    // Cria um SEGUNDO user pra ser dono da company E do OfxImport
    // (assim o OfxImport sobrevive — só o revertedById do user1 precisa nular)
    const user2 = await prisma.user.create({
      data: {
        name: 'Other',
        email: `${TEST_PREFIX}-ofx2-${Date.now()}@test.dev`,
        password: await bcrypt.hash('SenhaForte123!', 10),
      },
    })
    createdUsers.push(user2.id)
    await prisma.userCompany.create({
      data: { userId: user2.id, companyId: company.id },
    })

    const ofx = await prisma.ofxImport.create({
      data: {
        bankAccountId: bankAccount.id,
        userId: user2.id, // ⚠️ user2 dono do OFX (sobrevive)
        fileName: 'test.ofx',
        fileSize: 1024,
        totalTransactions: 0,
        newTransactions: 0,
        duplicates: 0,
        revertedById: user.id, // user (a apagar) reverteu — FK Restrict precisa nular
      },
    })

    const result = await prisma.$transaction(async (tx) => {
      return deleteUserCascade(tx, user.id)
    })

    expect(result.countOfxImportsRevertedNulled).toBeGreaterThanOrEqual(1)
    // OfxImport sobrevive (multi-dono preservou a company); revertedById nulado
    const ofxAfter = await prisma.ofxImport.findUnique({ where: { id: ofx.id } })
    expect(ofxAfter).not.toBeNull()
    expect(ofxAfter?.revertedById).toBeNull()
  })

  test('FK Restrict RecurringSchedule.createdById → DELETE não bloqueia', async () => {
    const { user, company } = await createUserCompany('rec')
    // Cria 2 schedules
    await prisma.recurringSchedule.createMany({
      data: [
        {
          companyId: company.id,
          description: 'Aluguel',
          type: 'PAYABLE',
          amount: 1000,
          frequency: 'MONTHLY',
          dayOfMonth: 5,
          startDate: new Date(),
          createdById: user.id,
        },
        {
          companyId: company.id,
          description: 'Internet',
          type: 'PAYABLE',
          amount: 200,
          frequency: 'MONTHLY',
          dayOfMonth: 10,
          startDate: new Date(),
          createdById: user.id,
        },
      ],
    })

    const result = await prisma.$transaction(async (tx) => {
      return deleteUserCascade(tx, user.id)
    })

    expect(result.countRecurringSchedulesDeleted).toBeGreaterThanOrEqual(2)
    const remaining = await prisma.recurringSchedule.count({
      where: { createdById: user.id },
    })
    expect(remaining).toBe(0)
  })

  test('throws se user não existe', async () => {
    await expect(
      prisma.$transaction((tx) => deleteUserCascade(tx, 'inexistente-id-xyz')),
    ).rejects.toThrow(/não encontrado/)
  })

  test('retorna snapshot completo com email/name pré-exclusão', async () => {
    const { user } = await createUserCompany('snap')

    const result = await prisma.$transaction(async (tx) => {
      return deleteUserCascade(tx, user.id)
    })

    expect(result.userId).toBe(user.id)
    expect(result.userEmail).toBe(user.email)
    expect(result.userName).toBe(user.name)
    expect(typeof result.countOfxImportsRevertedNulled).toBe('number')
    expect(typeof result.countTaxProfilesCreatedByNulled).toBe('number')
    expect(typeof result.countRecurringSchedulesDeleted).toBe('number')
  })
})
