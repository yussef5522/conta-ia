// ⛔⛔ O CARD DIZIA "DIVERGENTE EM R$ 1.700,00" — E ERA O BLOQUEIO (01/09/2026).
//
// Achado pelo dono na tela de Contas, minutos depois de o saldo passar a ser derivado do
// ledger: *"o badge do card compara contábil (−3.225,96) contra LEDGERBAL (−4.925,96) — o
// mesmo número que a gente tirou do gate do import, mas o card tem caminho próprio e ainda
// usa."*
//
// ⛔ ERA O **B2**: `balance` (−3.225,96, agora CERTO) × `ledgerBal + posterior` (−4.925,96)
// = 1.700 de "diferença", com a instrução **"recalcule o saldo da conta"** — alarme falso
// sobre um saldo correto. E `checkSaldosBancarios` roda no **juiz das 3h**, então o e-mail
// gritaria isso toda noite. Alarme falso repetido mata o alarme.
//
// ⭐ A CURA É FONTE ÚNICA, não um caso especial: quando existe conferência DIA A DIA, é ela
// que decide — no card E no juiz —, e as checagens contra LEDGERBAL nem rodam.

import { describe, it, expect } from 'vitest'
import { avaliarConta, estadoDaConferencia, type LeituraConta } from '../ledgerbal-invariants'

const HOJE = new Date('2026-09-01T12:00:00Z')

/** a conta do Banrisul como ficou depois da âncora: saldo contábil, LEDGERBAL disponível */
const base = (over: Partial<LeituraConta> = {}): LeituraConta => ({
  bankAccountId: 'b1',
  contaNome: 'banrisul',
  companyId: 'c1',
  ancoras: [{ data: new Date('2026-09-01T00:00:00Z'), valor: -4925.96 }],
  somaNoIntervalo: () => 0,
  balanceGravado: -3225.96, // ⭐ o CONTÁBIL, derivado do nosso ledger
  ledgerBalVigente: -4925.96, // o DISPONÍVEL que o banco declara
  ledgerBalDataVigente: new Date('2026-09-01T00:00:00Z'),
  somaPosAncora: 0,
  bloqueio: { valor: 1700, em: new Date('2026-09-01T14:01:00Z') },
  ...over,
})

const DIARIA_OK = {
  conferivel: true, diasConferidos: 22, diasQueFecham: 22,
  primeiroQueNaoFecha: null, ate: '2026-09-01',
}

describe('⛔⛔ o alarme falso de R$ 1.700', () => {
  it('⛔⛔ SEM a conferência diária, o B2 acusa 1.700 e manda "recalcule" (o bug)', () => {
    const checks = avaliarConta(base({ conferenciaDiaria: null }), HOJE)
    const b2 = checks.find((c) => c.invariante === 'B2')
    expect(b2?.nivel).toBe('erro')
    expect(b2?.diferenca).toBeCloseTo(1700, 2)
    expect(estadoDaConferencia(base({ conferenciaDiaria: null }), HOJE).rotulo).toContain('divergente')
  })

  it('⭐⭐ COM os 22/22 dias fechando, some o erro e o card diz "conferido"', () => {
    const l = base({ conferenciaDiaria: DIARIA_OK })
    expect(avaliarConta(l, HOJE).filter((c) => c.nivel === 'erro')).toHaveLength(0)
    const e = estadoDaConferencia(l, HOJE)
    expect(e.conferido).toBe(true)
    expect(e.rotulo).toBe('conferido com o banco em 01/09/2026')
    expect(e.diferenca).toBe(0)
  })

  it('⭐ e o BLOQUEIO vai junto, como informação DATADA — nunca como divergência', () => {
    const e = estadoDaConferencia(base({ conferenciaDiaria: DIARIA_OK }), HOJE)
    expect(e.bloqueio).toEqual({ valor: 1700, em: new Date('2026-09-01T14:01:00Z') })
    expect(e.rotulo).not.toContain('divergente')
    expect(e.rotulo).not.toContain('1.700')
  })
})

describe('⭐ mas a conferência diária MORDE quando um dia não fecha', () => {
  const RUIM = { ...DIARIA_OK, diasQueFecham: 21, primeiroQueNaoFecha: { data: '2026-08-13', diferenca: 1463.71 } }

  it('⭐ o juiz aponta o DIA e o VALOR — nunca um total sem endereço', () => {
    const c = avaliarConta(base({ conferenciaDiaria: RUIM }), HOJE).find((x) => x.nivel === 'erro')
    expect(c?.invariante).toBe('B1')
    expect(c?.detalhe).toContain('13/08')
    expect(c?.detalhe).toContain('21 de 22')
  })

  it('⭐ e o card diz o mesmo, com a mesma fonte', () => {
    const e = estadoDaConferencia(base({ conferenciaDiaria: RUIM }), HOJE)
    expect(e.conferido).toBe(false)
    expect(e.rotulo).toContain('13/08/2026 não fecha')
    expect(e.dias).toEqual({ conferidos: 22, fecham: 21 })
  })
})

describe('⚠️ conta SEM régua diária segue no caminho antigo, intacta', () => {
  it('⚠️ cofre/banco caixa: nada muda (nem selo diário, nem bloqueio)', () => {
    const cofre = base({
      conferenciaDiaria: null, ancoras: [], ledgerBalVigente: null,
      ledgerBalDataVigente: null, bloqueio: null, balanceGravado: 39714.73,
    })
    const checks = avaliarConta(cofre, HOJE)
    expect(checks.filter((c) => c.nivel === 'erro')).toHaveLength(0)
    expect(estadoDaConferencia(cofre, HOJE).rotulo).toContain('nunca conferida')
  })
})
