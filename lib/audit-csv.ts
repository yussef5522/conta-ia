// Geração de CSV pra export de audit log (Sub-sub-etapa 5.3.C1).
// Formato compatível com Excel BR (BOM UTF-8 + separador vírgula).

import { ACTION_LABELS, ENTITY_LABELS, FIELD_LABELS } from './audit-formatters'

interface AuditLogRow {
  id: string
  timestamp: Date
  userName: string
  userEmail: string
  action: string
  entityType: string
  entityId: string
  fieldsChanged: string | null
  metadata: string | null
  ipAddress: string | null
  userAgent: string | null
}

export function generateAuditCSV(logs: AuditLogRow[]): string {
  const headers = [
    'Data/Hora',
    'Usuário',
    'Email',
    'Ação',
    'Entidade',
    'ID Entidade',
    'Campos Alterados',
    'IP',
  ]

  const rows = logs.map((log) => [
    formatDate(log.timestamp),
    log.userName,
    log.userEmail,
    ACTION_LABELS[log.action]?.verb ?? log.action,
    ENTITY_LABELS[log.entityType] ?? log.entityType,
    log.entityId,
    formatFieldsChanged(log.fieldsChanged),
    log.ipAddress ?? '',
  ])

  // BOM UTF-8 pra Excel BR abrir com acentuação correta
  const BOM = '﻿'

  return (
    BOM +
    [headers, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
  )
}

function escapeCsvField(value: string): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatFieldsChanged(jsonStr: string | null): string {
  if (!jsonStr) return ''
  try {
    const obj = JSON.parse(jsonStr) as Record<string, { before: unknown; after: unknown }>
    return Object.entries(obj)
      .map(([field, change]) => {
        const label = FIELD_LABELS[field] ?? field
        const before = formatValue(change.before)
        const after = formatValue(change.after)
        return `${label}: "${before}" → "${after}"`
      })
      .join(' | ')
  } catch {
    return jsonStr
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(vazio)'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
