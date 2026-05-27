// Sprint 5.0.2.1 — Decide qual empty state mostrar em /contas-a-pagar:
//   - "empresa zerada" (CTA de Import Excel) quando filtro está em padrão E
//     KPIs zerados (nenhuma conta PENDING ou VENCIDA)
//   - "filtro vazio" (check verde) quando empresa TEM contas mas nenhuma
//     bate o filtro atual
//
// PURO/testável. Sem deps. Sem state.

export interface EmptyStateInput {
  /** Filtro atual de status. */
  status: string
  /** Toggle "só vencidas". */
  vencidasOnly: boolean
  /** KPIs agregados da empresa. */
  kpis: {
    countPendente: number
    countVencido: number
  }
}

const FILTRO_PADRAO_STATUS = 'PENDING'

/**
 * Retorna true quando a empresa NÃO tem nenhuma conta cadastrada
 * (nem pendente nem vencida) E o filtro está no padrão (PENDING + sem
 * "só vencidas"). Esse é o gatilho pra mostrar o empty state de
 * descoberta com CTA "Importar planilha Excel".
 *
 * Quando a empresa TEM contas mas o filtro atual não bate nenhuma
 * (ex: filtrou RECONCILED em empresa que só tem PENDING), retorna false
 * → mantém o empty state verde "Nada no filtro atual".
 */
export function isEmpresaZerada(input: EmptyStateInput): boolean {
  const filtroPadrao =
    input.status === FILTRO_PADRAO_STATUS && !input.vencidasOnly
  const totalKpi = input.kpis.countPendente + input.kpis.countVencido
  return filtroPadrao && totalKpi === 0
}
