// ⛔⛔ O B1 CONTAVA A CONCILIADA — alarme vermelho em conta perfeita (05/09/2026).
//
// **O caso:** conta a pagar **É** uma `Transaction`. Marcar 8 boletos como pagos criou DUAS
// linhas por pagamento (a ex-payable e a do extrato). O **saldo** e o **fluxo de caixa** já
// descontavam a conciliada; **o B1 não** — e acusava a Stone, que bate ao centavo com o banco.
//
// ⚠️ Era o TERCEIRO leitor da pergunta *"o que conta como caixa?"* com régua própria.

import { describe, it, expect } from 'vitest'
import { avaliarConta, type LeituraConta } from '../ledgerbal-invariants'

/** o intervalo real 31/08→01/09 da Stone: o banco declarou 2.415,40 e depois 333,02 */
const base = (somaDoIntervalo: number): LeituraConta => ({
  bankAccountId: 'conta-1',
  companyId: 'empresa-1',
  contaNome: 'stone',
  balanceGravado: 769.16,
  ledgerBalVigente: 769.16,
  ledgerBalDataVigente: new Date('2026-09-05T12:00:00Z'),
  somaPosAncora: 0,
  bloqueio: null,
  conferenciaDiaria: null,
  ancoras: [
    { data: new Date('2026-08-31T12:00:00Z'), valor: 2415.40 },
    { data: new Date('2026-09-01T12:00:00Z'), valor: 333.02 },
  ],
  // ⚠️ o banco variou −2.082,38 no intervalo
  somaNoIntervalo: () => somaDoIntervalo,
  // sem blob que cubra: o B1 volta ao conservador (culpa nossa) — é o caso que interessa
  somaDoArquivoNoIntervalo: () => null,
})

describe('⛔ o intervalo que fecha não pode acusar', () => {
  it('⭐⭐ sem a conciliada, 31/08→01/09 FECHA — nenhum erro B1', () => {
    // −2.082,38 é a soma real do dia SEM a ex-payable de 1.426,38
    const erros = avaliarConta(base(-2082.38), new Date('2026-09-05T12:00:00Z')).filter((c) => c.invariante === 'B1' && c.nivel === 'erro')
    expect(erros, 'conta que bate ao centavo não pode ficar vermelha').toEqual([])
  })

  it('⛔⛔ COM a conciliada somando, o B1 acusa exatamente os R$ 1.426,38 — o alarme falso', () => {
    // era o que acontecia: a ex-payable entrava na soma do intervalo
    const erros = avaliarConta(base(-3508.76), new Date('2026-09-05T12:00:00Z')).filter((c) => c.invariante === 'B1' && c.nivel === 'erro')
    expect(erros).toHaveLength(1)
    expect(Math.abs(erros[0].diferenca ?? 0)).toBeCloseTo(1426.38, 2)
  })
})
