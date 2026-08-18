// VENDAS FASE 1 (17/08/2026) — matemática de dia útil. Puro, testável. As datas
// são tratadas em UTC (o dia canônico é 'YYYY-MM-DD' UTC — não o dia local). O
// `feriados` já inclui nacional + municipal (montado pelo caller).

import { diaUTC } from './feriados-nacionais'

/** Sábado (6) ou domingo (0) em UTC. */
export function isFimDeSemana(d: Date): boolean {
  const wd = d.getUTCDay()
  return wd === 0 || wd === 6
}

/** Dia útil BANCÁRIO: não é fim de semana e não é feriado. */
export function isDiaUtil(d: Date, feriados: Set<string>): boolean {
  return !isFimDeSemana(d) && !feriados.has(diaUTC(d))
}

/** Volta `n` dias ÚTEIS a partir de `d` (n=0 → o próprio dia). Determinístico. */
export function voltarDiasUteis(d: Date, n: number, feriados: Set<string>): Date {
  let cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  let restam = n
  while (restam > 0) {
    cur = new Date(cur.getTime() - 86_400_000)
    if (isDiaUtil(cur, feriados)) restam--
  }
  return cur
}

/** Avança 1 dia (UTC), útil pra iterar intervalos. */
export function proximoDia(d: Date): Date {
  return new Date(d.getTime() + 86_400_000)
}
