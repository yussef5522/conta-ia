// Sprint Fase 2 Empréstimos (15/08/2026) — card "Vence este mês".
//
// Soma as parcelas que VENCEM no mês de referência, em 4 baldes (não 3): a
// parcela vencida-e-não-debitada (venc já passou, mas a tx ainda não entrou —
// ex: extrato ainda não reimportado) NÃO é "a vencer" (futuro) nem "já debitado".
// Precisa de estado próprio "vencida, aguardando débito/import" — senão ou some
// da conta ou finge que vai debitar no futuro.
//
// Valor: POS usa a PREVISÃO (última parcela casada, valor real); PRE usa o
// nominal da agenda (fato). Ver lib/loans/forecast.ts (mesma regra/trava).

import { isCasada, type ForecastInstallment } from './forecast'

export interface VenceMesLoan {
  rateType: string | null
  flexible: boolean
  installments: ForecastInstallment[]
}

export type VenceBucket = 'debitado' | 'vencida' | 'aVencer'

export interface VenceLinha {
  contractIndex: number
  number: number
  dueDate: Date
  valor: number | null
  bucket: VenceBucket
  isForecast: boolean
}

export interface VenceMesResult {
  previsto: number
  debitado: number
  vencida: number
  aVencer: number
  linhas: VenceLinha[]
}

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const ym = (d: Date) => d.toISOString().slice(0, 7)

/** Valor previsto de uma parcela OPEN: POS = última casada (real); PRE = nominal. */
function valorPrevisto(loan: VenceMesLoan, open: ForecastInstallment): number | null {
  if (loan.rateType !== 'POS') return open.payment // PRE = fato
  const base = [...loan.installments]
    .filter(isCasada)
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0]
  return base ? (base.paidTotal ?? base.payment) : null // sem casada → a apurar
}

/**
 * Baldes do mês de `refDate`. Parcela OPEN com dueDate < refDate (dia) e ainda
 * não paga = "vencida, aguardando". Função pura.
 */
export function computeVenceMes(loans: VenceMesLoan[], refDate: Date): VenceMesResult {
  const mesRef = ym(refDate)
  // Comparação por DIA (UTC) — dueDate é UTC-midnight; refDate qualquer hora.
  const refDia = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate())
  let previsto = 0, debitado = 0, vencida = 0, aVencer = 0
  const linhas: VenceLinha[] = []

  loans.forEach((loan, contractIndex) => {
    if (loan.flexible) return
    for (const i of loan.installments) {
      if (ym(i.dueDate) !== mesRef) continue
      if (i.status === 'PAID') {
        const v = i.paidTotal ?? i.payment
        debitado = r2(debitado + v); previsto = r2(previsto + v)
        linhas.push({ contractIndex, number: i.number, dueDate: i.dueDate, valor: v, bucket: 'debitado', isForecast: false })
        continue
      }
      // OPEN
      const v = valorPrevisto(loan, i)
      const isForecast = loan.rateType === 'POS'
      const diaVenc = Date.UTC(i.dueDate.getUTCFullYear(), i.dueDate.getUTCMonth(), i.dueDate.getUTCDate())
      const passou = diaVenc < refDia
      if (passou) { vencida = r2(vencida + (v ?? 0)); linhas.push({ contractIndex, number: i.number, dueDate: i.dueDate, valor: v, bucket: 'vencida', isForecast }) }
      else { aVencer = r2(aVencer + (v ?? 0)); linhas.push({ contractIndex, number: i.number, dueDate: i.dueDate, valor: v, bucket: 'aVencer', isForecast }) }
      previsto = r2(previsto + (v ?? 0))
    }
  })

  return { previsto, debitado, vencida, aVencer, linhas }
}
