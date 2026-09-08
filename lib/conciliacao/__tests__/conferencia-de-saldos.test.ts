// ⛔⛔⛔ O CABEÇALHO AFIRMAVA UM NÚMERO QUE NINGUÉM CONSEGUIA DEFENDER (07/09/2026).
//
// A fixture é o dado REAL da Caçula, medido em prod. O cabeçalho antigo dizia
// *"saldo do extrato R$ 33.046,25 × saldo no sistema −R$ 128.404,22 → R$ 161.450,47
// a conciliar"*, e a soma dos cards das contas é **−R$ 74.190,46** — nem um nem
// outro. Este teste trava a régua que sobrou: **`balance` (o número do card) contra
// `ledgerBal` (o que o banco declarou), POR CONTA**.
//
// ⚠️ E a parte que mais importa: **conta sem declaração do banco NÃO entra na
// conferência**. Dizer "bate" sem ter contra o que bater é exatamente o defeito.

import { describe, it, expect } from 'vitest'
import { conferirSaldos } from '../fila-de-conciliacao'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

// as 5 contas da Caçula, com os números medidos em prod em 07/09/2026
const CONTAS = [
  { id: 'c1', name: 'banco caixa      ', balance: -3248.46, ledgerBal: null, ledgerBalDate: null },
  { id: 'c2', name: 'banrisul         ', balance: -6647.67, ledgerBal: -8347.67, ledgerBalDate: d('2026-09-04') },
  { id: 'c3', name: 'caixa loja/cofre ', balance: 6953.03, ledgerBal: null, ledgerBalDate: null },
  { id: 'c4', name: 'sicredi          ', balance: -72016.52, ledgerBal: -72016.52, ledgerBalDate: d('2026-09-04') },
  { id: 'c5', name: 'stone            ', balance: 769.16, ledgerBal: 769.16, ledgerBalDate: d('2026-09-05') },
]

describe('a conferência de saldo — a única versão defensável', () => {
  it('⭐ confere POR CONTA, e só as que têm declaração do banco', () => {
    const r = conferirSaldos(CONTAS)
    expect(r.contas.map((c) => c.nome)).toEqual(['banrisul', 'sicredi', 'stone'])
    expect(r.batem).toBe(2)
    expect(r.naoBatem).toBe(1)
  })

  it('⛔ conta SEM extrato importado fica FORA — e nomeada, não escondida', () => {
    const r = conferirSaldos(CONTAS)
    expect(r.semExtrato.map((c) => c.nome)).toEqual(['banco caixa', 'caixa loja/cofre'])
    // ⚠️ o teste que morde: ela NÃO pode ser contada como "bate". Sem declaração
    // do banco não existe conferência, e dizer que bate é inventar o outro lado —
    // que é literalmente o defeito do cabeçalho antigo.
    expect(r.batem).toBe(2)
    expect(r.contas.some((c) => c.nome === 'caixa loja/cofre')).toBe(false)
  })

  it('a diferença do banrisul é a real, ao centavo, e vem primeiro', () => {
    const r = conferirSaldos(CONTAS)
    expect(r.contas[0].nome).toBe('banrisul')      // quem não bate encabeça
    expect(r.contas[0].diferenca).toBe(1700)       // −6.647,67 − (−8.347,67)
    expect(r.contas[0].bate).toBe(false)
    expect(r.contas[0].declaradoEm).toEqual(d('2026-09-04'))
  })

  it('⚠️ centavo de arredondamento não vira divergência (mas 1 centavo vira)', () => {
    const quase = conferirSaldos([
      { id: 'x', name: 'x', balance: 100.004, ledgerBal: 100, ledgerBalDate: d('2026-09-01') },
    ])
    expect(quase.contas[0].bate).toBe(true)
    const umCentavo = conferirSaldos([
      { id: 'x', name: 'x', balance: 100.01, ledgerBal: 100, ledgerBalDate: d('2026-09-01') },
    ])
    expect(umCentavo.contas[0].bate).toBe(false)
    expect(umCentavo.contas[0].diferenca).toBe(0.01)
  })

  it('empresa sem conta nenhuma: zero é zero, não erro', () => {
    const r = conferirSaldos([])
    expect(r).toEqual({ contas: [], semExtrato: [], batem: 0, naoBatem: 0 })
  })
})
