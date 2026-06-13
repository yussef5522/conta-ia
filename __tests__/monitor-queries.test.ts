// Fase 5 — Testes das queries (smoke).
//
// Como ambiente vitest é "node" (sem Postgres), valida apenas:
// 1. Queries são STRING SQL (export const)
// 2. Todas contêm SELECT e nenhuma contém INSERT/UPDATE/DELETE
// 3. Sintaxe SQL básica (SELECT...FROM...WHERE)
//
// Validação contra DB real fica no smoke pós-deploy.

import { describe, it, expect } from 'vitest'
import { MONITOR_QUERIES, MONITOR_METRIC_LABELS } from '../lib/monitor/queries'

describe('Fase 5 — MONITOR_QUERIES (read-only)', () => {
  // ──────────────────────────────────────────────────────────
  it('Q1. Todas as 4 queries (A, B, C, D) exportadas', () => {
    expect(Object.keys(MONITOR_QUERIES).sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  // ──────────────────────────────────────────────────────────
  it('Q2. ⚠️ Todas são SELECT (READ-ONLY) — zero INSERT/UPDATE/DELETE', () => {
    for (const [key, sql] of Object.entries(MONITOR_QUERIES)) {
      // SQL contém SELECT
      expect(sql, `Query ${key} sem SELECT`).toMatch(/SELECT/i)

      // SQL NÃO contém comandos mutativos
      expect(sql, `Query ${key} tem INSERT`).not.toMatch(/\bINSERT\b/i)
      expect(sql, `Query ${key} tem UPDATE`).not.toMatch(/\bUPDATE\b/i)
      expect(sql, `Query ${key} tem DELETE`).not.toMatch(/\bDELETE\b/i)
      expect(sql, `Query ${key} tem DROP`).not.toMatch(/\bDROP\b/i)
      expect(sql, `Query ${key} tem TRUNCATE`).not.toMatch(/\bTRUNCATE\b/i)
      expect(sql, `Query ${key} tem ALTER`).not.toMatch(/\bALTER\b/i)
    }
  })

  // ──────────────────────────────────────────────────────────
  it('Q3. Sintaxe básica: cada query tem SELECT + FROM + agrupamento', () => {
    for (const [key, sql] of Object.entries(MONITOR_QUERIES)) {
      expect(sql, `Query ${key}`).toMatch(/SELECT[\s\S]+FROM[\s\S]+/i)
      expect(sql, `Query ${key} sem company_id`).toMatch(/company_id/i)
      expect(sql, `Query ${key} sem qtd`).toMatch(/qtd/i)
      expect(sql, `Query ${key} sem GROUP BY`).toMatch(/GROUP BY/i)
    }
  })

  // ──────────────────────────────────────────────────────────
  it('Labels existem pra cada chave', () => {
    expect(MONITOR_METRIC_LABELS.A).toMatch(/Excel.*EFFECTED/i)
    expect(MONITOR_METRIC_LABELS.B).toMatch(/pares.*suspeitos/i)
    expect(MONITOR_METRIC_LABELS.C).toMatch(/[Ww]arnings/)
    expect(MONITOR_METRIC_LABELS.D).toMatch(/PAYABLE/i)
  })
})
