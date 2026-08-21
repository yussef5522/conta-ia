// Sprint Fase 3 CAMADA 3 (17/08/2026) — estado do SELO do juiz, função PURA.
// Bug pego pelo teste do amarelo (16/08): "sem relatório < 24h" e "sem relatório
// nenhum" viravam o MESMO cinza "nunca rodou" — quando o cron morrer de verdade
// e o último envelhecer, o selo mentiria "nunca" e esconderia DESDE QUANDO parou.
// 4 estados DISTINTOS; a query pega o ÚLTIMO relatório SEM filtro de data e a
// IDADE decide a cor. Dono único (o componente é casca fina) + REGRA 1 test.

export type SeloTone = 'green' | 'red' | 'yellow' | 'gray'
export interface SeloState { tone: SeloTone; label: string }

export interface SeloLatest {
  runAt: string
  passed: boolean
  totalContracts: number
  totalFail: number
  balanceIssues: number
  // I10 (17/08) — duplicatas de tx. Opcional pra compat com relatórios antigos
  // (antes da coluna): ausente = 0.
  dupIssues?: number
  vendaIssues?: number // V1-V4 (17/08) — invariantes de venda
  cardIssues?: number // K1-K7 (18/08) — invariantes de cartão
  stockIssues?: number // E1-E15 (20/08) — invariantes de estoque (tabela isolada stock_judge_report)
}

const hh = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** nowMs injetado pra ser testável (relógio só pra IDADE de exibição, nunca decisão de dado). */
export function judgeSeloState(latest: SeloLatest | null, nowMs: number): SeloState {
  // CINZA — zero relatórios na tabela (só no 1º dia, antes da 1ª rodada)
  if (!latest) return { tone: 'gray', label: 'Juiz nunca rodou' }

  const ageH = (nowMs - new Date(latest.runAt).getTime()) / 3_600_000

  // AMARELO — existe relatório mas o último passou de 24h (cron parado = falha
  // SILENCIOSA; o selo é o único que avisa DESDE QUANDO). Distinto do cinza.
  if (ageH > 24) return { tone: 'yellow', label: `Juiz não roda desde ${diaHora(latest.runAt)}` }

  // VERDE — último < 24h e 0 falhas (incl. estoque, que vive em tabela isolada)
  if (latest.passed && (latest.stockIssues ?? 0) === 0) return { tone: 'green', label: `Juiz ${latest.totalContracts - latest.totalFail}/${latest.totalContracts} · ${hh(latest.runAt)}` }

  // VERMELHO — último < 24h e N falhas (inclui I10 duplicatas + V1-V4 venda + E-estoque)
  const n = latest.totalFail + latest.balanceIssues + (latest.dupIssues ?? 0) + (latest.vendaIssues ?? 0) + (latest.cardIssues ?? 0) + (latest.stockIssues ?? 0)
  return { tone: 'red', label: `Juiz: ${n} falha${n === 1 ? '' : 's'}` }
}
