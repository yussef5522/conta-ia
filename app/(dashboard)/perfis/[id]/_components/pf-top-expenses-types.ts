// Sprint Dashboard PF — Tipos compartilhados entre componentes da Zona 2.

export interface ExpenseItem {
  categoryId: string | null
  name: string
  color: string | null
  total: number
  percent: number
}
