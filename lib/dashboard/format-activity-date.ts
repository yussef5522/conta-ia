// Formatação de data relativa pro Recent Activity — Sprint 1 Dia 5.
// Função PURA.
//
// ⚠️ ACEITA Date | string POR DESIGN (não bug):
// Server components que consomem unstable_cache do Next 15+ recebem campos
// Date como string ISO (cache serializa via JSON; Date não é preservado).
// Aceitar string + normalizar internamente é defesa em profundidade:
// caller esquece de reidratar, função não quebra.
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

// Normaliza Date | string pra Date. Lança se input inválido.
function toDate(value: Date | string): Date {
  if (value instanceof Date) return value
  const d = new Date(value)
  if (isNaN(d.getTime())) {
    throw new Error(`formatActivityDate: data inválida: ${String(value)}`)
  }
  return d
}

export function formatActivityDate(
  date: Date | string,
  refDate: Date | string = new Date(),
): string {
  const d = toDate(date)
  const r = toDate(refDate)
  const diff = calendarDaysDiff(d, r)

  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff > 1 && diff <= 7) return `Há ${diff} dias`

  // >7 dias OU no futuro (negativo): mostra data formatada
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')

  const refYear = r.getUTCFullYear()
  const dateYear = d.getUTCFullYear()

  if (dateYear !== refYear) {
    return `${day}/${month}/${dateYear}`
  }
  return `${day}/${month}`
}
