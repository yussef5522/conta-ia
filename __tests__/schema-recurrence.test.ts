// Sprint 4.0.1.b — verifica schema RecurringSchedule + Transaction novos campos via DMMF.

import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('schema RecurringSchedule (Sprint 4.0.1.b)', () => {
  const rec = Prisma.dmmf.datamodel.models.find((m) => m.name === 'RecurringSchedule')

  it('model RecurringSchedule existe', () => {
    expect(rec).toBeDefined()
  })

  it('tem campos essenciais', () => {
    const names = rec!.fields.map((f) => f.name)
    expect(names).toContain('companyId')
    expect(names).toContain('description')
    expect(names).toContain('type')
    expect(names).toContain('amount')
    expect(names).toContain('frequency')
    expect(names).toContain('dayOfMonth')
    expect(names).toContain('dayOfWeek')
    expect(names).toContain('startDate')
    expect(names).toContain('endDate')
    expect(names).toContain('active')
    expect(names).toContain('lastGeneratedAt')
    expect(names).toContain('supplierId')
    expect(names).toContain('customerId')
    expect(names).toContain('categoryId')
    expect(names).toContain('createdById')
  })

  it('active default true', () => {
    const f = rec!.fields.find((f) => f.name === 'active')
    expect(f?.default).toBe(true)
  })

  it('description required', () => {
    expect(rec!.fields.find((f) => f.name === 'description')?.isRequired).toBe(true)
  })

  it('dayOfMonth opcional', () => {
    expect(rec!.fields.find((f) => f.name === 'dayOfMonth')?.isRequired).toBe(false)
  })

  it('dayOfWeek opcional', () => {
    expect(rec!.fields.find((f) => f.name === 'dayOfWeek')?.isRequired).toBe(false)
  })

  it('endDate opcional', () => {
    expect(rec!.fields.find((f) => f.name === 'endDate')?.isRequired).toBe(false)
  })

  it('mapeia pra tabela recurring_schedules', () => {
    expect(rec!.dbName).toBe('recurring_schedules')
  })
})

describe('schema Transaction.recurringScheduleId (Sprint 4.0.1.b)', () => {
  const tx = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Transaction')

  it('Transaction.recurringScheduleId opcional', () => {
    const f = tx!.fields.find((f) => f.name === 'recurringScheduleId')
    expect(f).toBeDefined()
    expect(f?.isRequired).toBe(false)
  })

  it('@@unique [recurringScheduleId, dueDate] presente', () => {
    const uniques = tx!.uniqueFields
    const hasIt = uniques.some(
      (u) =>
        u.length === 2 &&
        u.includes('recurringScheduleId') &&
        u.includes('dueDate'),
    )
    expect(hasIt).toBe(true)
  })
})

describe('Migration SQL Sprint 4.0.1.b', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20260523010000_sprint_4_0_1_b_recurrence',
      'migration.sql',
    ),
    'utf-8',
  )

  it('cria tabela recurring_schedules', () => {
    expect(sql).toMatch(/CREATE TABLE "recurring_schedules"/i)
  })

  it('cria índice (companyId, active)', () => {
    expect(sql).toMatch(/CREATE INDEX "recurring_schedules_companyId_active_idx"/i)
  })

  it('adiciona recurringScheduleId em transactions', () => {
    expect(sql).toMatch(/ADD COLUMN "recurringScheduleId" TEXT/i)
  })

  it('cria unique anti-dup (recurringScheduleId, dueDate)', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "transactions_recurringScheduleId_dueDate_key"/i,
    )
  })
})
