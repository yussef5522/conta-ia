// Os CORTES da SuitAPI — módulo PURO (a tela também lê). Dono único das duas datas.
/** ⛔ PRODUTOS pela API a partir deste dia (decisão do dono, 10/11). ≤08/11 é XLS. */
export const CORTE_API = '2026-11-09'
/** ⛔ COMPLEMENTOS pela API a partir deste dia: o 1º sem XLS de complementos no banco (09/11 tem). */
export const CORTE_COMPLEMENTOS = '2026-11-10'
/** "10/11" */
export const diaCurto = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
