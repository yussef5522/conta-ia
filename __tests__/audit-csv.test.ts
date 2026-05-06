import { describe, it, expect } from 'vitest'
import { generateAuditCSV } from '../lib/audit-csv'

const sample = {
  id: 'log1',
  timestamp: new Date('2026-05-04T14:32:00Z'),
  userName: 'Yussef',
  userEmail: 'yussef@test.com',
  action: 'UPDATE',
  entityType: 'Category',
  entityId: 'cat-123',
  fieldsChanged: JSON.stringify({
    name: { before: 'Aluguel', after: 'Aluguel TESTE' },
  }),
  metadata: null,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
}

describe('generateAuditCSV', () => {
  it('inclui BOM UTF-8 no início', () => {
    const csv = generateAuditCSV([sample])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('inclui headers em PT-BR', () => {
    const csv = generateAuditCSV([sample])
    expect(csv).toContain('Data/Hora')
    expect(csv).toContain('Usuário')
    expect(csv).toContain('Ação')
  })

  it('escapa vírgulas em valores', () => {
    const log = { ...sample, userName: 'Silva, João' }
    const csv = generateAuditCSV([log])
    expect(csv).toContain('"Silva, João"')
  })

  it('escapa aspas dobrando-as', () => {
    const log = { ...sample, userName: 'Test "User"' }
    const csv = generateAuditCSV([log])
    expect(csv).toContain('"Test ""User"""')
  })

  it('retorna apenas BOM + headers se logs vazio', () => {
    const csv = generateAuditCSV([])
    expect(csv.startsWith('﻿Data/Hora')).toBe(true)
  })

  it('formata fieldsChanged como texto legível', () => {
    const csv = generateAuditCSV([sample])
    expect(csv).toContain('Nome:')
    expect(csv).toContain('Aluguel')
    expect(csv).toContain('Aluguel TESTE')
  })

  it('traduz action pra PT-BR', () => {
    const csv = generateAuditCSV([sample])
    expect(csv).toContain('Atualizou')
  })

  it('traduz entityType pra PT-BR', () => {
    const csv = generateAuditCSV([sample])
    expect(csv).toContain('Categoria')
  })

  it('inclui IP', () => {
    const csv = generateAuditCSV([sample])
    expect(csv).toContain('192.168.1.1')
  })

  it('múltiplos logs gerados em linhas separadas', () => {
    const csv = generateAuditCSV([sample, { ...sample, id: 'log2' }])
    const lines = csv.split('\r\n')
    // 1 header + 2 rows = 3 linhas
    expect(lines.length).toBe(3)
  })
})
