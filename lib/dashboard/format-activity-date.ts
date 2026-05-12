// Formatação de data relativa pro Recent Activity — Sprint 1 Dia 5.
// Função PURA.
//
// Regras:
//   mesmo dia calendário → "Hoje"
//   1 dia atrás → "Ontem"
//   2-7 dias → "Há X dias"
//   8 dias até <365 dias → "DD/MM"
//   >= 365 dias → "DD/MM/YYYY"

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Calcula a diferença em DIAS DE CALENDÁRIO (UTC) entre duas datas, ignorando
// horas. Garante que "11/05 23:50 UTC" e "12/05 00:10 UTC" sejam 1 dia (Ontem),
// não 0.34 dias.
function calendarDaysDiff(from: Date, to: Date): number {
  const fromMs = Math.floor(from.getTime() / MS_PER_DAY)
  const toMs = Math.floor(to.getTime() / MS_PER_DAY)
  return toMs - fromMs
}

export function formatActivityDate(date: Date, refDate: Date = new Date()): string {
  const diff = calendarDaysDiff(date, refDate)

  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff > 1 && diff <= 7) return `Há ${diff} dias`

  // >7 dias OU no futuro (negativo): mostra data formatada
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')

  const refYear = refDate.getUTCFullYear()
  const dateYear = date.getUTCFullYear()

  if (dateYear !== refYear) {
    return `${day}/${month}/${dateYear}`
  }
  return `${day}/${month}`
}
