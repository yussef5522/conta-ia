// Fase 5 — Queries SQL READ-ONLY do monitoramento diário.
//
// As 4 queries são SELECT — nenhuma muta dado. Quem grava resultado é
// monitor-dups-daily.ts (script orquestrador) na tabela monitor_metrics.

export const MONITOR_QUERIES = {
  // Query A — Excel EFFECTED órfão (estado proibido pós-refactor "Excel sempre PAYABLE")
  // Hoje >0 (lixo histórico Cacula). Alerta só dispara se subir vs ontem.
  A: `
    SELECT
      COALESCE(ba."companyId", s."companyId", cu."companyId", c."companyId") AS company_id,
      COUNT(*) AS qtd
    FROM transactions t
    LEFT JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    LEFT JOIN suppliers s     ON s.id  = t."supplierId"
    LEFT JOIN customers cu    ON cu.id = t."customerId"
    LEFT JOIN categories c    ON c.id  = t."categoryId"
    WHERE t.origin = 'IMPORT_EXCEL'
      AND t.lifecycle = 'EFFECTED'
      AND t."reconciledWithId" IS NULL
      AND t."paymentDate" IS NULL
    GROUP BY company_id
  `,

  // Query B — Pares suspeitos OFX-órfã × MANUAL/Excel-órfã
  B: `
    SELECT
      ba."companyId" AS company_id,
      COUNT(DISTINCT o.id) AS qtd
    FROM transactions o
    JOIN bank_accounts ba ON ba.id = o."bankAccountId"
    JOIN transactions m ON m."bankAccountId" = o."bankAccountId"
      AND ABS(m.amount - o.amount) <= 0.02
      AND ABS(EXTRACT(epoch FROM (m.date - o.date)) / 86400) <= 1
    WHERE o.origin = 'OFX' AND o.lifecycle = 'EFFECTED'
      AND o."reconciledWithId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r."reconciledWithId" = o.id)
      AND m.origin IN ('MANUAL','IMPORT_EXCEL')
      AND m.lifecycle = 'EFFECTED'
      AND m."reconciledWithId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r."reconciledWithId" = m.id)
      AND m.id <> o.id
    GROUP BY ba."companyId"
  `,

  // Query C — import_warnings pendentes (não dismissed nem resolved)
  C: `
    SELECT
      "companyId" AS company_id,
      COUNT(*) AS qtd
    FROM import_warnings
    WHERE "dismissedAt" IS NULL AND "resolvedAt" IS NULL
    GROUP BY "companyId"
  `,

  // Query D — PAYABLE com paymentDate (estado anômalo TOZZO/RM2 dia 11)
  D: `
    SELECT
      COALESCE(ba."companyId", s."companyId", cu."companyId", c."companyId") AS company_id,
      COUNT(*) AS qtd
    FROM transactions t
    LEFT JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    LEFT JOIN suppliers s     ON s.id  = t."supplierId"
    LEFT JOIN customers cu    ON cu.id = t."customerId"
    LEFT JOIN categories c    ON c.id  = t."categoryId"
    WHERE t.lifecycle = 'PAYABLE'
      AND t."paymentDate" IS NOT NULL
    GROUP BY company_id
  `,
} as const

export type MonitorMetricKey = 'A' | 'B' | 'C' | 'D'

export const MONITOR_METRIC_LABELS: Record<MonitorMetricKey, string> = {
  A: 'Excel EFFECTED órfão (sem link nem paymentDate)',
  B: 'Pares suspeitos OFX-órfã × MANUAL/Excel-órfã',
  C: 'Warnings de duplicação pendentes',
  D: 'PAYABLE com paymentDate (estado anômalo)',
}
