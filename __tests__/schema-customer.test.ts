// Sprint 4.0.1.a — verifica schema Customer + novos campos Transaction via DMMF.

import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('schema Customer (Sprint 4.0.1.a)', () => {
  const customer = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Customer')

  it('model Customer existe', () => {
    expect(customer).toBeDefined()
  })

  it('Customer tem campos essenciais', () => {
    const names = customer!.fields.map((f) => f.name)
    expect(names).toContain('companyId')
    expect(names).toContain('razaoSocial')
    expect(names).toContain('nomeFantasia')
    expect(names).toContain('cnpj')
    expect(names).toContain('cpf')
    expect(names).toContain('email')
    expect(names).toContain('phone')
    expect(names).toContain('isActive')
    expect(names).toContain('fonte')
  })

  it('razaoSocial é required', () => {
    const f = customer!.fields.find((f) => f.name === 'razaoSocial')
    expect(f?.isRequired).toBe(true)
  })

  it('cnpj é opcional', () => {
    const f = customer!.fields.find((f) => f.name === 'cnpj')
    expect(f?.isRequired).toBe(false)
  })

  it('isActive default true', () => {
    const f = customer!.fields.find((f) => f.name === 'isActive')
    expect(f?.default).toBe(true)
  })

  it('mapeia pra tabela "customers"', () => {
    expect(customer!.dbName).toBe('customers')
  })

  it('@@unique [companyId, cnpj]', () => {
    const uniques = customer!.uniqueFields
    const hasCompanyCnpj = uniques.some(
      (u) => u.length === 2 && u.includes('companyId') && u.includes('cnpj'),
    )
    expect(hasCompanyCnpj).toBe(true)
  })
})

describe('schema Transaction novos campos (Sprint 4.0.1.a)', () => {
  const tx = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Transaction')

  it('Transaction.lifecycle existe com default EFFECTED', () => {
    const f = tx!.fields.find((f) => f.name === 'lifecycle')
    expect(f?.isRequired).toBe(true)
    expect(f?.default).toBe('EFFECTED')
  })

  it('Transaction.dueDate opcional', () => {
    const f = tx!.fields.find((f) => f.name === 'dueDate')
    expect(f?.isRequired).toBe(false)
  })

  it('Transaction.reconciledWithId opcional (Fase B.3: NÃO mais unique pra suportar N:1)', () => {
    const f = tx!.fields.find((f) => f.name === 'reconciledWithId')
    expect(f?.isRequired).toBe(false)
    // Sprint A-effected Fase B.3 — @unique removido. Defesa via guards
    // reconciledFrom (3 camadas) + allowMultiReconcile flag + validação
    // de soma exata no endpoint /find-and-match/reconcile.
    expect(f?.isUnique).toBe(false)
  })

  it('Transaction.reconcileGroupId opcional (Fase B.3 N:1 group)', () => {
    const f = tx!.fields.find((f) => f.name === 'reconcileGroupId')
    expect(f?.isRequired).toBe(false)
  })

  it('Transaction.customerId opcional', () => {
    const f = tx!.fields.find((f) => f.name === 'customerId')
    expect(f?.isRequired).toBe(false)
  })

  it('Transaction.bankAccountId virou nullable (Sprint 4.0.1.a)', () => {
    const f = tx!.fields.find((f) => f.name === 'bankAccountId')
    expect(f?.isRequired).toBe(false)
  })
})

describe('Migration SQL Sprint 4.0.1.a', () => {
  it('contém criação da tabela customers', () => {
    const sql = readFileSync(
      join(
        __dirname,
        '..',
        'prisma',
        'migrations',
        '20260523000000_sprint_4_0_1_a_lifecycle_customer',
        'migration.sql',
      ),
      'utf-8',
    )
    expect(sql).toMatch(/CREATE TABLE "customers"/i)
    expect(sql).toMatch(/lifecycle.*DEFAULT 'EFFECTED'/i)
    expect(sql).toMatch(/dueDate/)
    expect(sql).toMatch(/reconciledWithId/)
    expect(sql).toMatch(/DROP NOT NULL/) // bankAccountId nullable
  })

  it('migration aplica default EFFECTED nas tx existentes', () => {
    const sql = readFileSync(
      join(
        __dirname,
        '..',
        'prisma',
        'migrations',
        '20260523000000_sprint_4_0_1_a_lifecycle_customer',
        'migration.sql',
      ),
      'utf-8',
    )
    // ALTER TABLE ADD COLUMN com DEFAULT preenche tx existentes
    expect(sql).toMatch(/ADD COLUMN "lifecycle".*DEFAULT 'EFFECTED'/i)
  })
})
