// ⭐ (lei v7 M5, vassoura do dossiê 12/11) o rótulo do cartão "Concluídas" SEGUE O FILTRO.
// Antes dizia "Concluídas hoje" com o filtro em semana/mês — o número era da semana e o rótulo
// mentia sobre o que ele conta. PURA, testada.
export function rotuloDasConcluidas(periodo: 'hoje' | 'semana' | 'mes', custom: { de: string; ate: string } | null): string {
  if (custom) return 'Concluídas no período'
  if (periodo === 'semana') return 'Concluídas na semana'
  if (periodo === 'mes') return 'Concluídas no mês'
  return 'Concluídas hoje'
}
