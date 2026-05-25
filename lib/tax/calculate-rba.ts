// Sprint 5.0.1 — helper Receita Bruta Acumulada últimos 12 meses.
//
// Considera apenas:
//   - lifecycle = EFFECTED (já entrou no caixa, não projeções)
//   - type = CREDIT (entradas)
//   - status != IGNORED
//   - reconciledWithId IS NULL (evita dupla contagem PAYABLE/RECEIVABLE conciliada)
//   - exclui transferências internas (Sprint 0.5)
//
// Multi-tenant via OR de relações (PAYABLE poderia não ter bankAccount).

import { prisma } from '@/lib/db'

/**
 * Soma receitas (CREDIT EFFECTED) dos 12 meses anteriores ao mês de
 * referência (NÃO inclui o próprio mês — engine soma separadamente).
 *
 * @param companyId Empresa
 * @param refYear Ano do mês de competência (ex: 2026)
 * @param refMonth Mês de competência (1-12)
 */
export async function calculateRBA12m(
  companyId: string,
  refYear: number,
  refMonth: number,
): Promise<number> {
  // Mês de referência: dia 1 às 00:00 UTC
  // Janela de 12 meses ANTERIORES: refMonth-12 até refMonth-1 (inclusivo)
  const startMonth = refMonth - 12 // pode ser negativo (subtraído do ano)
  const startYear = refYear + Math.floor((startMonth - 1) / 12)
  const startMonthAdj = ((startMonth - 1 + 12 * 12) % 12) + 1

  const startDate = new Date(Date.UTC(startYear, startMonthAdj - 1, 1))
  const endDate = new Date(Date.UTC(refYear, refMonth - 1, 1)) // exclusivo

  const result = await prisma.transaction.aggregate({
    where: {
      OR: [
        { bankAccount: { companyId } },
        { supplier: { companyId } },
        { customer: { companyId } },
        { category: { companyId } },
      ],
      lifecycle: 'EFFECTED',
      type: 'CREDIT',
      reconciledWithId: null,
      status: { not: 'IGNORED' },
      date: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
  })

  return Math.round((result._sum.amount ?? 0) * 100) / 100
}
