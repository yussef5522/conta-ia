// Fase 5 — Script cron diário: roda 4 queries SELECT, grava snapshot,
// detecta alertas vs ontem.
//
// Crontab: 0 6 * * * cd /opt/conta-ia && /usr/bin/npx tsx scripts/monitor-dups-daily.ts
//
// READ-ONLY nas transações. Único INSERT é em monitor_metrics e monitor_alerts.

import { PrismaClient } from '@prisma/client'
import { MONITOR_QUERIES, type MonitorMetricKey } from '../lib/monitor/queries'
import { detectAlerts, type MetricSnapshot } from '../lib/monitor/detect-alerts'

const prisma = new PrismaClient()

async function runDaily() {
  const startedAt = new Date()
  console.log(`[monitor] start ${startedAt.toISOString()}`)

  // 1. Roda as 4 queries
  const todaySnapshots: MetricSnapshot[] = []

  for (const [key, sql] of Object.entries(MONITOR_QUERIES)) {
    type Row = { company_id: string | null; qtd: bigint }
    const rows = await prisma.$queryRawUnsafe<Row[]>(sql)

    console.log(`[monitor] query ${key}: ${rows.length} grupos`)

    for (const row of rows) {
      const value = Number(row.qtd)
      todaySnapshots.push({
        metricKey: key as MonitorMetricKey,
        companyId: row.company_id,
        value,
      })

      // Persiste snapshot
      await prisma.monitorMetric.create({
        data: {
          metricKey: key,
          companyId: row.company_id,
          value,
        },
      })
    }
  }

  console.log(`[monitor] ${todaySnapshots.length} medições gravadas`)

  // 2. Busca medições de ontem (24-48h atrás) pra comparar
  const ontemFim = new Date(startedAt.getTime() - 12 * 3600_000)  // -12h: pega "ontem"
  const ontemInicio = new Date(ontemFim.getTime() - 48 * 3600_000)

  const yesterdayRaw = await prisma.monitorMetric.findMany({
    where: { measuredAt: { gte: ontemInicio, lt: ontemFim } },
    orderBy: { measuredAt: 'desc' },
  })

  // Pega medição MAIS RECENTE de ontem por (metricKey, companyId)
  const yesterdayMap = new Map<string, MetricSnapshot>()
  for (const m of yesterdayRaw) {
    const key = `${m.metricKey}:${m.companyId ?? ''}`
    if (!yesterdayMap.has(key)) {
      yesterdayMap.set(key, {
        metricKey: m.metricKey,
        companyId: m.companyId,
        value: m.value,
      })
    }
  }
  const yesterdaySnapshots = Array.from(yesterdayMap.values())
  console.log(`[monitor] ontem (24-48h atrás): ${yesterdaySnapshots.length} medições`)

  // 3. Detecta alertas (SÓ quando SOBE)
  const alerts = detectAlerts(todaySnapshots, yesterdaySnapshots)
  console.log(`[monitor] ${alerts.length} alertas (métricas que pioraram)`)

  // 4. Persiste alertas (multi-tenant — só com companyId set)
  for (const alert of alerts) {
    if (!alert.companyId) continue
    await prisma.monitorAlert.create({
      data: {
        metricKey: alert.metricKey,
        companyId: alert.companyId,
        valueOntem: alert.valueOntem,
        valueHoje: alert.valueHoje,
        delta: alert.delta,
      },
    })
    console.log(
      `[alert] ${alert.metricKey} empresa=${alert.companyId.slice(0, 8)} ${alert.valueOntem} → ${alert.valueHoje} (+${alert.delta})`,
    )
  }

  const elapsed = Date.now() - startedAt.getTime()
  console.log(`[monitor] done em ${elapsed}ms`)
}

runDaily()
  .catch((err) => {
    console.error('[monitor] ERRO:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
