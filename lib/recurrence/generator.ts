// Sprint 4.0.1.b — gerador automático de Transactions a partir de RecurringSchedules.
//
// Lógica:
//   1. Busca todos RecurringSchedule active=true cuja vigência cobre HOJE
//   2. Pra cada um: calcula próximas dueDates na janela [hoje, hoje+windowDays]
//   3. Tenta criar Transaction lifecycle=PAYABLE/RECEIVABLE pra cada dueDate
//   4. Constraint @@unique([recurringScheduleId, dueDate]) garante idempotência
//      (se já gerou pra essa data, INSERT falha silenciosamente)
//   5. Atualiza lastGeneratedAt
//
// Pode ser chamado por:
//   - node-cron diário (lib/recurrence/scheduler.ts)
//   - Endpoint manual /api/recorrentes/generate-now (smoke test)

import { prisma } from '@/lib/db'
import {
  calculateNextDueDates,
  type RecurrenceConfig,
  type Frequency,
} from './next-date'
import type { Lifecycle } from '@/lib/lifecycle'

export interface GenerateResult {
  schedulesProcessed: number
  generated: number
  skippedDuplicate: number
  errors: number
  errorDetails: Array<{ scheduleId: string; error: string }>
}

const DEFAULT_WINDOW_DAYS = 7

export async function generateRecurringTransactions(options?: {
  referenceDate?: Date
  windowDays?: number
  companyId?: string // se setado, processa só essa empresa
}): Promise<GenerateResult> {
  const referenceDate = options?.referenceDate ?? new Date()
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS
  const windowEnd = new Date(referenceDate.getTime())
  windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays)

  const result: GenerateResult = {
    schedulesProcessed: 0,
    generated: 0,
    skippedDuplicate: 0,
    errors: 0,
    errorDetails: [],
  }

  const where: Record<string, unknown> = { active: true }
  if (options?.companyId) where.companyId = options.companyId

  const schedules = await prisma.recurringSchedule.findMany({ where })

  for (const schedule of schedules) {
    result.schedulesProcessed++

    try {
      const config: RecurrenceConfig = {
        frequency: schedule.frequency as Frequency,
        dayOfMonth: schedule.dayOfMonth,
        dayOfWeek: schedule.dayOfWeek,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
      }

      // Calcula candidatos na janela
      const candidates = calculateNextDueDates(config, referenceDate, 100).filter(
        (d) => d <= windowEnd,
      )

      let generatedForThisSchedule = 0
      const type = schedule.type === 'PAYABLE' ? 'DEBIT' : 'CREDIT'
      const lifecycle: Lifecycle = schedule.type === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE'

      for (const dueDate of candidates) {
        try {
          await prisma.transaction.create({
            data: {
              date: dueDate,
              competenceDate: dueDate,
              dueDate,
              description: schedule.description,
              amount: schedule.amount,
              type,
              status: 'PENDING',
              origin: 'MANUAL',
              lifecycle,
              recurringScheduleId: schedule.id,
              supplierId: schedule.supplierId,
              customerId: schedule.customerId,
              categoryId: schedule.categoryId,
              notes: schedule.notes,
            },
          })
          generatedForThisSchedule++
          result.generated++
        } catch (e) {
          // P2002 = unique constraint violation = já gerou pra essa dueDate
          if (isUniqueConstraintError(e)) {
            result.skippedDuplicate++
          } else {
            throw e
          }
        }
      }

      if (generatedForThisSchedule > 0) {
        await prisma.recurringSchedule.update({
          where: { id: schedule.id },
          data: { lastGeneratedAt: new Date() },
        })
      }
    } catch (e) {
      result.errors++
      result.errorDetails.push({
        scheduleId: schedule.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return result
}

function isUniqueConstraintError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: string }).code
  return code === 'P2002'
}
