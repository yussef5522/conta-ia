// Sprint Entrada-Fixa-Ponte (13/08/2026) — REGRA 3: executa o comportamento real
// (DB de teste) e prova as garantias que o Yussef pediu:
//   1) perfil PF novo NASCE com a canônica (systemSlug BRIDGE_ENTRY)
//   2) toda ponte usa a MESMA categoria de entrada (resolvida no servidor) —
//      independente de qualquer categoria que o caller tentasse passar
//   3) RENOMEAR a canônica NÃO cria outra (get-or-create acha por slug, não nome)
//   4) get-or-create é idempotente (nunca duplica)
//
// Os 3 caminhos de UI (NovaPonteForm, WithdrawalPanel, BridgeSuggestionCard) e o
// batch POSTam pro /api/pontes SEM pfCategoryId → todos passam por createBridge,
// que resolve via getOrCreateBridgeEntryCategory. Testar createBridge cobre os 3.

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createBridge } from '@/lib/bridges/create'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'
import {
  getOrCreateBridgeEntryCategory,
  BRIDGE_ENTRY_SLUG,
  BRIDGE_ENTRY_DEFAULT_NAME,
} from '@/lib/bridges/entry-category'

const PREFIX = `entry-fixed-${Date.now()}-${process.pid}`

let userA: { id: string }
let companyId: string
let bankAccountId: string
let profileA: { id: string }
let pfAccount: { id: string }

async function newPjDebit(amount: number) {
  return prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date('2026-05-20'),
      description: `Pix retirada ${amount}`,
      amount,
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
    },
  })
}

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}@x.local`, password: pwd },
  })
  const c = await prisma.company.create({
    data: {
      name: `${PREFIX}-co`,
      cnpj: `07${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: { create: [{ userId: userA.id, role: 'OWNER' }] },
    },
  })
  companyId = c.id
  const ba = await prisma.bankAccount.create({
    data: { companyId, name: 'Banrisul', accountType: 'CHECKING' },
  })
  bankAccountId = ba.id
  profileA = await createProfile({ userId: userA.id, name: 'Yussef PF', cpf: '11144477735' })
  const acc = await createAccount({
    userId: userA.id,
    profileId: profileA.id,
    name: 'Nubank PF',
    accountType: 'CHECKING',
  })
  pfAccount = { id: acc.id }
})

afterAll(async () => {
  await prisma.pJtoPFBridge.deleteMany({ where: { companyId } })
  await prisma.personalTransaction.deleteMany({ where: { profileId: profileA.id } })
  await prisma.transaction.deleteMany({ where: { bankAccountId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.personalCategory.deleteMany({ where: { profileId: profileA.id } })
  await prisma.personalBankAccount.deleteMany({ where: { profileId: profileA.id } })
  await prisma.userPersonalProfile.deleteMany({ where: { userId: userA.id } })
  await prisma.personalProfile.deleteMany({ where: { id: profileA.id } })
  await prisma.user.deleteMany({ where: { id: userA.id } })
})

describe('1) perfil PF novo nasce com a canônica', () => {
  test('createProfile semeia exatamente UMA INCOME com systemSlug BRIDGE_ENTRY', async () => {
    const canon = await prisma.personalCategory.findMany({
      where: { profileId: profileA.id, systemSlug: BRIDGE_ENTRY_SLUG },
    })
    expect(canon).toHaveLength(1)
    expect(canon[0].type).toBe('INCOME')
    expect(canon[0].name).toBe(BRIDGE_ENTRY_DEFAULT_NAME)
  })
})

describe('2) toda ponte usa a MESMA categoria de entrada (servidor resolve)', () => {
  test('2 pontes → mesmo categoryId = a canônica do perfil', async () => {
    const pj1 = await newPjDebit(1000)
    const pj2 = await newPjDebit(2000)
    const r1 = await createBridge({
      userId: userA.id, companyId, pjTransactionId: pj1.id,
      profileId: profileA.id, pfBankAccountId: pfAccount.id, kind: 'DISTRIBUICAO',
    })
    const r2 = await createBridge({
      userId: userA.id, companyId, pjTransactionId: pj2.id,
      profileId: profileA.id, pfBankAccountId: pfAccount.id, kind: 'PRO_LABORE',
    })
    const t1 = await prisma.personalTransaction.findUnique({ where: { id: r1.pfTransactionId } })
    const t2 = await prisma.personalTransaction.findUnique({ where: { id: r2.pfTransactionId } })
    const canon = await prisma.personalCategory.findFirst({
      where: { profileId: profileA.id, systemSlug: BRIDGE_ENTRY_SLUG },
    })
    expect(t1!.categoryId).toBe(canon!.id)
    expect(t2!.categoryId).toBe(canon!.id) // mesmo kind DIFERENTE → mesma entrada
  })
})

describe('3) RENOMEAR a canônica não cria outra (acha por slug, não nome)', () => {
  test('renomeia → próxima ponte reusa a mesma, e só existe UMA BRIDGE_ENTRY', async () => {
    const canonBefore = await prisma.personalCategory.findFirst({
      where: { profileId: profileA.id, systemSlug: BRIDGE_ENTRY_SLUG },
    })
    // usuário renomeia pra "Retirada da Caçula"
    await prisma.personalCategory.update({
      where: { id: canonBefore!.id },
      data: { name: 'Retirada da Caçula' },
    })
    const pj3 = await newPjDebit(3000)
    const r3 = await createBridge({
      userId: userA.id, companyId, pjTransactionId: pj3.id,
      profileId: profileA.id, pfBankAccountId: pfAccount.id, kind: 'DISTRIBUICAO',
    })
    const t3 = await prisma.personalTransaction.findUnique({ where: { id: r3.pfTransactionId } })
    expect(t3!.categoryId).toBe(canonBefore!.id) // MESMA, apesar do nome novo

    const all = await prisma.personalCategory.findMany({
      where: { profileId: profileA.id, systemSlug: BRIDGE_ENTRY_SLUG },
    })
    expect(all).toHaveLength(1) // NUNCA duplicou
    expect(all[0].name).toBe('Retirada da Caçula') // o nome renomeado persiste
  })
})

describe('4) get-or-create idempotente', () => {
  test('chamar 2× devolve o mesmo id, sem criar linha nova', async () => {
    const a = await getOrCreateBridgeEntryCategory(profileA.id)
    const b = await getOrCreateBridgeEntryCategory(profileA.id)
    expect(a).toBe(b)
    const count = await prisma.personalCategory.count({
      where: { profileId: profileA.id, systemSlug: BRIDGE_ENTRY_SLUG },
    })
    expect(count).toBe(1)
  })
})
