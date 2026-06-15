// Sprint Filtro de Data Parte B (15/06/2026) — leitura uniforme de date range
// dos query params do request. Aceita 4 conjuntos de aliases pra compatibilidade
// retroativa:
//
//   inicio/fim       — convenção nova (Parte A: /pendentes, /conciliacao, /transferencias)
//   dataDe/dataAte   — contas-a-pagar legacy
//   startDate/endDate — DRE / fluxo-caixa
//   from/to          — relatórios fornecedores/funcionarios/categorias
//
// Precedência: inicio/fim > dataDe/dataAte > startDate/endDate > from/to.
//
// Retorna strings ISO YYYY-MM-DD (vazias se ausente). Caller decide como parsear
// (new Date + range gte/lte ou validador zod).

export interface DateRangeParams {
  inicio: string
  fim: string
}

export function readDateRangeParams(sp: URLSearchParams): DateRangeParams {
  const inicio =
    sp.get('inicio') ??
    sp.get('dataDe') ??
    sp.get('startDate') ??
    sp.get('from') ??
    ''
  const fim =
    sp.get('fim') ??
    sp.get('dataAte') ??
    sp.get('endDate') ??
    sp.get('to') ??
    ''
  return { inicio, fim }
}
