// Sprint PF Fatia 4 — Testes find-candidate-profile.
// Integração com DB SQLite (dev). Cobre privacidade multi-sócio.

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  findCandidateProfile,
  normalizeCpf,
} from '@/lib/bridges/find-candidate-profile'
import { createProfile } from '@/lib/personal-profile/queries'

const PREFIX = `bridge-fcp-${Date.now()}-${process.pid}`

let userA: { id: string }  // Yussef (dono perfil A)
let userB: { id: string }  // João (sócio da mesma empresa, dono perfil B)
let userC: { id: string }  // Outro user sem nenhum vínculo
let companyId: string      // PROFIT (compartilhada A+B)
let bankAccountId: string  // Conta PJ da PROFIT
let socioA: { id: string }  // SocioPF Yussef (CPF 600.258.890-60)
let socioB: { id: string }  // SocioPF João
let profileA: { id: string }  // Perfil PF Yussef (CPF idêntico ao socioA)
let profileB: { id: string }  // Perfil PF João (CPF idêntico ao socioB)
let pjTxAEffective: { id: string }  // Pix DEBIT pra socioA
let pjTxBEffective: { id: string }  // Pix DEBIT pra socioB
let pjTxCredit: { id: string }   // CREDIT (não pode virar ponte)
let pjTxNoRelated: { id: string } // sem relatedPartyType
let pjTxInternalTransfer: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A Yussef', email: `${PREFIX}-a@x.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B Joao', email: `${PREFIX}-b@x.local`, password: pwd },
  })
  userC = await prisma.user.create({
    data: { name: 'C Outro', email: `${PREFIX}-c@x.local`, password: pwd },
  })

  // Empresa compartilhada A+B (A criou, B foi adicionado depois)
  const company = await prisma.company.create({
    data: {
      name: `${PREFIX}-profit`,
      cnpj: `00${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: { create: [{ userId: userA.id, role: 'OWNER' }, { userId: userB.id, role: 'OWNER' }] },
    },
  })
  companyId = company.id

  const bank = await prisma.bankAccount.create({
    data: {
      companyId,
      name: 'Banrisul PJ',
      bankName: 'Banrisul',
      accountType: 'CHECKING',
    },
  })
  bankAccountId = bank.id

  socioA = await prisma.socioPF.create({
    data: { companyId, nome: 'Yussef Sócio', cpf: '60025889060', papel: 'SOCIO' },
  })
  socioB = await prisma.socioPF.create({
    data: { companyId, nome: 'Joao Sócio', cpf: '11122233344', papel: 'ADMINISTRADOR' },
  })

  profileA = await createProfile({
    userId: userA.id, name: 'Yussef', cpf: '60025889060',
  })
  profileB = await createProfile({
    userId: userB.id, name: 'Joao', cpf: '11122233344',
  })

  // Tx PJ DEBIT pareadas
  pjTxAEffective = await prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date('2026-05-28'),
      description: 'Pix Yussef Musa CPF 600.258.890-60',
      amount: 10000,
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
      relatedPartyType: 'SOCIO_PF',
      relatedPartyId: socioA.id,
    },
  })
  pjTxBEffective = await prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date('2026-05-28'),
      description: 'Pix Joao Silva CPF 111.222.333-44',
      amount: 5000,
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
      relatedPartyType: 'SOCIO_PF',
      relatedPartyId: socioB.id,
    },
  })
  pjTxCredit = await prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date(),
      description: 'Recebimento de cliente',
      amount: 5000,
      type: 'CREDIT',
      lifecycle: 'EFFECTED',
    },
  })
  pjTxNoRelated = await prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date(),
      description: 'Pgto fornecedor',
      amount: 1000,
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
    },
  })
  pjTxInternalTransfer = await prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date(),
      description: 'TED entre contas',
      amount: 2000,
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
      isInternalTransfer: true,
    },
  })
})

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.socioPF.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.personalCategory.deleteMany({
    where: { profileId: { in: [profileA.id, profileB.id] } },
  })
  await prisma.personalBankAccount.deleteMany({
    where: { profileId: { in: [profileA.id, profileB.id] } },
  })
  await prisma.userPersonalProfile.deleteMany({
    where: { userId: { in: [userA.id, userB.id, userC.id] } },
  })
  await prisma.personalProfile.deleteMany({
    where: { id: { in: [profileA.id, profileB.id] } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: [userA.id, userB.id, userC.id] } },
  })
})

describe('normalizeCpf', () => {
  test('Remove pontos e traços', () => {
    expect(normalizeCpf('600.258.890-60')).toBe('60025889060')
  })
  test('Mantém só dígitos', () => {
    expect(normalizeCpf('60025889060')).toBe('60025889060')
  })
  test('CPF inválido (<11 dígitos) → null', () => {
    expect(normalizeCpf('600258890')).toBeNull()
  })
  test('CPF >11 dígitos → null', () => {
    expect(normalizeCpf('600258890601')).toBeNull()
  })
  test('null/undefined → null', () => {
    expect(normalizeCpf(null)).toBeNull()
    expect(normalizeCpf(undefined)).toBeNull()
    expect(normalizeCpf('')).toBeNull()
  })
})

describe('findCandidateProfile — caminho feliz', () => {
  test('Yussef vê candidate pra tx pro próprio CPF', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxAEffective.id,
      userId: userA.id,
    })
    expect(c).not.toBeNull()
    expect(c!.profile.id).toBe(profileA.id)
    expect(c!.socioPF.id).toBe(socioA.id)
    expect(c!.suggestedKind).toBe('DISTRIBUICAO') // socioA papel=SOCIO
    expect(c!.suggestedAccountId).toBeNull() // sem conta PF criada
    expect(c!.suggestedCategoryId).not.toBeNull() // tem categorias default
  })

  test('João vê candidate pra tx pro próprio CPF (Yussef admin tem PF João?)', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxBEffective.id,
      userId: userB.id,
    })
    expect(c).not.toBeNull()
    expect(c!.profile.id).toBe(profileB.id)
    expect(c!.socioPF.id).toBe(socioB.id)
    expect(c!.suggestedKind).toBe('PRO_LABORE') // socioB papel=ADMINISTRADOR
  })
})

describe('🔒 PRIVACIDADE MULTI-SÓCIO — find-candidate', () => {
  test('🚨 João NÃO vê candidate pra tx pro CPF do Yussef (mesma empresa)', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxAEffective.id,
      userId: userB.id,
    })
    expect(c).toBeNull()
  })

  test('🚨 Yussef NÃO vê candidate pra tx pro CPF do João (mesma empresa)', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxBEffective.id,
      userId: userA.id,
    })
    expect(c).toBeNull()
  })

  test('🚨 User C (sem perfil) NÃO recebe candidate de ninguém', async () => {
    const cA = await findCandidateProfile({
      pjTransactionId: pjTxAEffective.id,
      userId: userC.id,
    })
    const cB = await findCandidateProfile({
      pjTransactionId: pjTxBEffective.id,
      userId: userC.id,
    })
    expect(cA).toBeNull()
    expect(cB).toBeNull()
  })
})

describe('findCandidateProfile — bloqueios', () => {
  test('Tx CREDIT → null', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxCredit.id,
      userId: userA.id,
    })
    expect(c).toBeNull()
  })
  test('Tx sem relatedPartyType → null', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxNoRelated.id,
      userId: userA.id,
    })
    expect(c).toBeNull()
  })
  test('Tx isInternalTransfer → null', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: pjTxInternalTransfer.id,
      userId: userA.id,
    })
    expect(c).toBeNull()
  })
  test('Tx inexistente → null', async () => {
    const c = await findCandidateProfile({
      pjTransactionId: 'cmfakeXXXXXXXXXX',
      userId: userA.id,
    })
    expect(c).toBeNull()
  })
  test('Tx já tem bridge → null', async () => {
    // cria bridge temporária pra simular
    const profileBank = await prisma.personalBankAccount.create({
      data: { profileId: profileA.id, name: 'Nubank PF', accountType: 'CHECKING' },
    })
    const pfTx = await prisma.personalTransaction.create({
      data: {
        profileId: profileA.id,
        bankAccountId: profileBank.id,
        date: new Date('2026-05-28'),
        description: 'Test',
        amount: 10000,
        type: 'CREDIT',
        status: 'RECONCILED',
        origin: 'AI',
      },
    })
    const bridge = await prisma.pJtoPFBridge.create({
      data: {
        pjTransactionId: pjTxAEffective.id,
        companyId,
        pfTransactionId: pfTx.id,
        profileId: profileA.id,
        kind: 'DISTRIBUICAO',
        amount: 10000,
        date: new Date('2026-05-28'),
        createdById: userA.id,
        createdVia: 'CREATED_MANUAL',
      },
    })

    const c = await findCandidateProfile({
      pjTransactionId: pjTxAEffective.id,
      userId: userA.id,
    })
    expect(c).toBeNull()

    // cleanup
    await prisma.pJtoPFBridge.delete({ where: { id: bridge.id } })
    await prisma.personalTransaction.delete({ where: { id: pfTx.id } })
    await prisma.personalBankAccount.delete({ where: { id: profileBank.id } })
  })
})
