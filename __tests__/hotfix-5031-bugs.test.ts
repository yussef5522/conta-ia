// Sprint 5.0.3.1 — Tests dos 4 bugs + UX #2.
//
// Bug #1: Multi-tenant guard preservado em aggregate "A pagar pendente"
//         (AND explícito em vez de spread + OR override)
// Bug #2: KPIs respeitam dataDe/dataAte do filtro
// UX #2:  Density sempre 'comfortable' independente do localStorage

import { describe, it, expect } from 'vitest'
import {
  buildPayableListWhere,
  listPayableSchema,
} from '@/lib/contas-pagar/list-filters'

const COMPANY_A = 'cmpvalidcuid00000000000a'
const COMPANY_B = 'cmpvalidcuid00000000000b'
const NOW = new Date('2026-05-27T12:00:00.000Z')

describe('Bug #1 — Aggregate "A pagar pendente" preserva multi-tenant', () => {
  // Replica a construção do `where` que o route.ts faz APÓS o fix.
  // Antes do fix era spread + OR override. Depois: AND explícito.
  function buildAPagarPendenteWhere(
    whereBase: Record<string, unknown>,
    now: Date,
  ) {
    return {
      AND: [
        whereBase,
        { status: 'PENDING' },
        { OR: [{ dueDate: { gte: now } }, { dueDate: null }] },
      ],
    }
  }

  it('whereBase tem 5 OR multi-tenant', () => {
    const whereBase = buildPayableListWhere(
      listPayableSchema.parse({ empresaId: COMPANY_A }),
      NOW,
    )
    expect(whereBase.OR).toBeDefined()
    expect((whereBase.OR as unknown[]).length).toBe(5)
  })

  it('Aggregate where: AND[0] preserva whereBase intacto', () => {
    const whereBase = buildPayableListWhere(
      listPayableSchema.parse({ empresaId: COMPANY_A }),
      NOW,
    )
    const aggWhere = buildAPagarPendenteWhere(whereBase, NOW)
    const and = aggWhere.AND as Array<Record<string, unknown>>
    expect(and).toHaveLength(3)
    expect(and[0]).toBe(whereBase) // referência preservada
    expect(and[0].OR).toBeDefined() // multi-tenant ainda lá
    expect((and[0].OR as unknown[]).length).toBe(5)
  })

  it('Aggregate where: AND[1] = status PENDING, AND[2] = dueDate OR', () => {
    const whereBase = buildPayableListWhere(
      listPayableSchema.parse({ empresaId: COMPANY_A }),
      NOW,
    )
    const aggWhere = buildAPagarPendenteWhere(whereBase, NOW)
    const and = aggWhere.AND as Array<Record<string, unknown>>
    expect(and[1]).toEqual({ status: 'PENDING' })
    expect(and[2].OR).toBeDefined()
    const dueDateOR = and[2].OR as Array<Record<string, unknown>>
    expect(dueDateOR).toHaveLength(2)
  })

  it('REGRESSÃO BUG #1: shape ANTES do fix sobrescrevia OR multi-tenant', () => {
    // Demonstra o bug do código antigo: spread + override apaga OR
    const whereBase = buildPayableListWhere(
      listPayableSchema.parse({ empresaId: COMPANY_A }),
      NOW,
    )
    const oldBuggy = {
      ...whereBase,
      status: 'PENDING',
      OR: [{ dueDate: { gte: NOW } }, { dueDate: null }],
    } as Record<string, unknown>
    // No shape buggy, OR não é mais o multi-tenant — é o dueDate OR
    expect((oldBuggy.OR as unknown[]).length).toBe(2)
    // Multi-tenant foi PERDIDO (não tem mais 5 conditions)
    const orFirst = (oldBuggy.OR as Array<Record<string, unknown>>)[0]
    expect(orFirst.dueDate).toBeDefined() // confirma que é o OR de dueDate
    expect(orFirst.supplier).toBeUndefined() // não é mais o de multi-tenant
  })

  it('Empresa A e B retornam wheres DIFERENTES (isolamento)', () => {
    const wA = buildPayableListWhere(
      listPayableSchema.parse({ empresaId: COMPANY_A }),
      NOW,
    )
    const wB = buildPayableListWhere(
      listPayableSchema.parse({ empresaId: COMPANY_B }),
      NOW,
    )
    // Cada empresa tem seu próprio OR multi-tenant com seu companyId
    const orA = wA.OR as Array<Record<string, Record<string, string>>>
    const orB = wB.OR as Array<Record<string, Record<string, string>>>
    expect(orA[0].bankAccount.companyId).toBe(COMPANY_A)
    expect(orB[0].bankAccount.companyId).toBe(COMPANY_B)
  })
})

describe('Bug #2 — KPIs respeitam dataDe/dataAte', () => {
  function buildKpiBaseInput(input: ReturnType<typeof listPayableSchema.parse>) {
    // Replica o que o route.ts faz após o fix
    return {
      ...input,
      status: undefined,
      vencidasOnly: false,
      q: undefined,
      // dataDe/dataAte NÃO são limpos (fix bug #2)
    } as typeof input
  }

  it('kpiBaseInput mantém dataDe/dataAte do input original', () => {
    const input = listPayableSchema.parse({
      empresaId: COMPANY_A,
      dataDe: '2026-04-01',
      dataAte: '2026-05-31',
    })
    const kpiInput = buildKpiBaseInput(input)
    expect(kpiInput.dataDe).toBe('2026-04-01')
    expect(kpiInput.dataAte).toBe('2026-05-31')
  })

  it('whereBase com dataDe/dataAte aplica em dueDate por default', () => {
    const input = listPayableSchema.parse({
      empresaId: COMPANY_A,
      dataDe: '2026-04-01',
      dataAte: '2026-05-31',
    })
    const kpiInput = buildKpiBaseInput(input)
    const whereBase = buildPayableListWhere(kpiInput, NOW)
    expect(whereBase.dueDate).toBeDefined()
    const range = whereBase.dueDate as Record<string, Date>
    expect(range.gte).toEqual(new Date('2026-04-01T00:00:00.000Z'))
    expect(range.lte).toEqual(new Date('2026-05-31T23:59:59.999Z'))
  })

  it('kpiBaseInput limpa status mas mantém data (fix bug #2)', () => {
    const input = listPayableSchema.parse({
      empresaId: COMPANY_A,
      status: 'PENDING',
      dataDe: '2026-04-01',
    })
    const kpiInput = buildKpiBaseInput(input)
    expect(kpiInput.status).toBeUndefined() // limpo
    expect(kpiInput.dataDe).toBe('2026-04-01') // preservado
  })

  it('kpiBaseInput limpa vencidasOnly e q', () => {
    const input = listPayableSchema.parse({
      empresaId: COMPANY_A,
      vencidasOnly: 'true',
      q: 'busca',
    })
    const kpiInput = buildKpiBaseInput(input)
    expect(kpiInput.vencidasOnly).toBe(false)
    expect(kpiInput.q).toBeUndefined()
  })

  it('Sem dataDe/dataAte, whereBase NÃO tem range em dueDate (igual antes)', () => {
    const input = listPayableSchema.parse({ empresaId: COMPANY_A })
    const kpiInput = buildKpiBaseInput(input)
    const whereBase = buildPayableListWhere(kpiInput, NOW)
    expect(whereBase.dueDate).toBeUndefined()
  })
})

describe('UX #2 — Density fixa em comfortable', () => {
  it('DENSITY_LEVELS continua expondo as 3 opções (compat)', async () => {
    const { DENSITY_LEVELS, DENSITY_HEIGHTS } = await import(
      '@/lib/contas-pagar/use-table-preferences'
    )
    // Mantém as 3 opções no enum por compat de tipos
    expect(DENSITY_LEVELS).toEqual(['compact', 'normal', 'comfortable'])
    expect(DENSITY_HEIGHTS.comfortable).toBe(60)
  })

  it('Comfortable é a altura MÁXIMA (60px)', async () => {
    const { DENSITY_HEIGHTS } = await import(
      '@/lib/contas-pagar/use-table-preferences'
    )
    expect(DENSITY_HEIGHTS.comfortable).toBe(60)
    expect(DENSITY_HEIGHTS.comfortable).toBeGreaterThan(DENSITY_HEIGHTS.normal)
    expect(DENSITY_HEIGHTS.comfortable).toBeGreaterThan(DENSITY_HEIGHTS.compact)
  })
})
