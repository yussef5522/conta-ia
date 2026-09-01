// ⛔⛔ INCIDENTE 01/09 — A CARTEIRA QUEBROU COM UM CONTRATO SEM CONTA.
//
// Depois de `loans.bankAccountId` virar nullable, `/emprestimos` deu **"This page couldn't
// load"**. A rota respondia **200** e o `pm2 logs` ficava **limpo**: crash de CLIENTE, no
// `{l.bankAccount.name}` sobre um `bankAccount` que agora vem `null`.
//
// ⚠️⚠️ POR QUE OS TESTES QUE EXISTIAM NÃO PEGARAM — e é a lição que importa:
//   1. a auditoria varreu **`bankAccountId`** (o escalar); o que quebrou usa **`bankAccount`**
//      (a relação). Identificador diferente, grep cego.
//   2. o TypeScript aprovou, porque a página declara a forma do payload numa **interface
//      escrita à mão** sem `| null` — tipo à mão sobre resposta de API é promessa, não prova.
//   3. e não havia teste com um contrato SEM CONTA na base: até 01/09 esse estado era
//      impossível (NOT NULL), então nenhuma fixture jamais o produziu.
//
// ⭐ Este arquivo cria o contrato sem conta DE VERDADE e exerce os dois caminhos: a query
// que a rota faz (o payload chega com `bankAccount: null`?) e a régua que a tela usa.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { rotuloDaConta, semTransitoPorConta } from '../rotulo-conta'
import { exigeContaDoEmprestimo, MutuoSemContaError } from '../exige-conta'

const CNPJ = '50505050000211'
let companyId: string
let contaId: string
let semContaId: string
let comContaId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CARTEIRA' } })
  companyId = c.id
  const b = await prisma.bankAccount.create({ data: { companyId, name: 'cofre' } })
  contaId = b.id
  const base = {
    companyId, lender: 'Arafat (arafet thalji)', principal: 110000, interestRateMonthly: 0,
    termMonths: 7, amortizationSystem: 'SAC', rateType: 'PRE',
    firstDueDate: new Date('2027-04-15T00:00:00Z'), disbursementDate: new Date('2026-08-28T00:00:00Z'),
    scheduleSource: 'FLEXIBLE', status: 'ACTIVE',
  }
  // ⭐ o contrato que quebrou a tela: SEM conta
  const sem = await prisma.loan.create({ data: { ...base, contractNumber: 'Arafat — forno (2ª tranche)', bankAccountId: null } })
  semContaId = sem.id
  const com = await prisma.loan.create({ data: { ...base, contractNumber: 'com conta', bankAccountId: contaId } })
  comContaId = com.id
})
afterEach(async () => {
  await prisma.loan.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ a query da carteira com um contrato SEM CONTA', () => {
  it('⛔⛔ o payload traz `bankAccount: null` — e é isso que o cliente recebia e derrubava', async () => {
    // ⚠️ EXATAMENTE o `select` da rota `/api/empresas/[id]/emprestimos`
    const loans = await prisma.loan.findMany({
      where: { companyId },
      include: { bankAccount: { select: { id: true, name: true, bankName: true } } },
      orderBy: { contractNumber: 'asc' },
    })
    expect(loans).toHaveLength(2)
    const sem = loans.find((l) => l.id === semContaId)!
    const com = loans.find((l) => l.id === comContaId)!
    expect(sem.bankAccount).toBeNull()          // ⛔ o null que chegava na tela
    expect(com.bankAccount?.name).toBe('cofre')

    // ⛔ RED: era isto que a tela fazia — `.name` sobre null
    expect(() => (sem.bankAccount as unknown as { name: string }).name).toThrow(TypeError)

    // ⭐ GREEN: a régua da tela sobrevive aos dois
    expect(rotuloDaConta(sem)).toBe('sem trânsito por conta')
    expect(rotuloDaConta(com)).toBe('cofre')
  })

  it('⭐ a carteira INTEIRA renderiza sem estourar — a linha do sem-conta inclusive', async () => {
    const loans = await prisma.loan.findMany({
      where: { companyId }, include: { bankAccount: { select: { id: true, name: true, bankName: true } } },
    })
    // o que o componente faz por linha (sem jsdom no projeto: exercemos a régua, não o DOM)
    const linhas = loans.map((l) => `${l.contractNumber} · ${rotuloDaConta(l)}`)
    expect(linhas).toHaveLength(2)
    expect(linhas.some((t) => t.includes('sem trânsito por conta'))).toBe(true)
    expect(linhas.every((t) => !t.includes('null') && !t.includes('undefined'))).toBe(true)
  })

  it('⭐ e a tela sabe DISTINGUIR o caso, não só evitar o crash', () => {
    expect(semTransitoPorConta({ bankAccount: null })).toBe(true)
    expect(semTransitoPorConta({ bankAccount: { name: 'cofre' } })).toBe(false)
  })
})

describe('⛔ e o contrato sem conta segue RECUSANDO conciliação (não virou permissivo)', () => {
  it('⛔ nenhum caminho de vínculo aceita o mútuo sem trânsito', async () => {
    const sem = await prisma.loan.findUnique({ where: { id: semContaId }, select: { bankAccountId: true } })
    expect(sem!.bankAccountId).toBeNull()
    expect(() => exigeContaDoEmprestimo(sem!, 'vincular a parcela')).toThrow(MutuoSemContaError)

    const com = await prisma.loan.findUnique({ where: { id: comContaId }, select: { bankAccountId: true } })
    expect(exigeContaDoEmprestimo(com!, 'vincular a parcela')).toBe(contaId)
  })
})
