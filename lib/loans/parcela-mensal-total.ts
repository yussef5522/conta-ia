// ⭐ "PARCELA MENSAL TOTAL" — o agregado do topo da carteira, com DONO ÚNICO (01/09/2026).
//
// ⛔ POR QUE ISTO VIROU FUNÇÃO: a soma vivia solta dentro do laço da rota
// (`totalParcelaMensalRec += forecast.valor`), e o único teste que a guardava fazia
// **grep da string "Parcela mensal total" no fonte da página**. Grep não confere número —
// e o vermelho dele passou dias fingindo ser regressão (REGRA 3). Com a régua aqui, o
// teste roda a soma de verdade e afirma o total.
//
// ⭐ A RÉGUA, e cada cláusula tem motivo:
//   · **PREVISÃO, não a agenda nominal** — 5 dos 8 contratos são PÓS-FIXADOS: a parcela
//     nominal mente pra baixo (a agenda importada nasce com juros 0). O `forecastProxima`
//     devolve o valor da última parcela CASADA, que é o que o banco vai debitar.
//   · **só ACTIVE** — contrato quitado não compromete o mês que vem.
//   · **FLEXIBLE fica FORA** — o mútuo sem prazo (Arafat, 0%) tem agenda só nominal e a
//     devolução é conforme caixa; somá-lo faria a tela prometer um compromisso mensal que
//     não existe.
//   · **sem previsão NÃO entra e NÃO vira zero** — contrato pós-fixado sem parcela casada
//     é "a apurar"; contar como 0 baixaria o total em silêncio, que é pior que faltar.

export interface LinhaParcelaMensal {
  /** `Loan.status` — só ACTIVE compromete o mês */
  status: string
  /** `scheduleSource === 'FLEXIBLE'` — mútuo sem prazo fixo */
  flexible: boolean
  /** saída de `forecastProxima().valor` — `null` quando é "a apurar" */
  forecastValor: number | null
}

export interface ParcelaMensalTotal {
  /** a soma que vai pro card, em centavos fechados */
  total: number
  /** quantos contratos ATIVOS não puderam ser previstos ("a apurar") */
  semPrevisao: number
}

/** PURA. Soma a previsão mensal recorrente da carteira. */
export function parcelaMensalTotal(linhas: LinhaParcelaMensal[]): ParcelaMensalTotal {
  let total = 0
  let semPrevisao = 0
  for (const l of linhas) {
    if (l.flexible || l.status !== 'ACTIVE') continue
    if (l.forecastValor == null) {
      semPrevisao++ // "a apurar" — nunca vira 0 caladamente
      continue
    }
    total += l.forecastValor
  }
  return { total: Math.round(total * 100) / 100, semPrevisao }
}
