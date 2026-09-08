// ⛔⛔⛔ O CABEÇALHO AFIRMAVA UM NÚMERO QUE NINGUÉM CONSEGUIA DEFENDER (07/09/2026)
// — e depois ACUSAVA uma diferença que a casa já sabia explicar (08/09).
//
// A fixture é o dado REAL da Caçula, medido em prod. Duas correções, dois blocos:
//
//  1. o cabeçalho antigo dizia *"saldo do extrato R$ 33.046,25 × saldo no sistema
//     −R$ 128.404,22"*, e a soma dos cards é **−R$ 74.190,46** — nem um nem outro.
//     A régua que sobrou é `balance` × `ledgerBal`, **por conta**.
//
//  2. o ⚠ do Banrisul era o **BLOQUEIO +24h**, a mania nº 1 que a ficha do banco
//     já conhece (`ledgerBalReliable: false`). Medido: a diferença de R$ 1.700,00
//     é **exatamente** o `blockedAmount` declarado. *"Alarme âmbar em diferença
//     esperada e explicável vira ruído."* — o dono.
//
// ⛔ E A REGRA É DA FICHA, NUNCA UM `if (Banrisul)`. Estes testes provam isso
// trocando SÓ a ficha e SÓ o bloqueio, com o nome do banco fora da conta.

import { describe, it, expect } from 'vitest'
import { conferirSaldos } from '../fila-de-conciliacao'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** o default é "banco comum": declarado é régua, sem bloqueio declarado */
const conta = (over: Partial<Parameters<typeof conferirSaldos>[0][number]> & { name: string; balance: number }) => ({
  id: over.name.trim(), ledgerBal: null, ledgerBalDate: null,
  declaradoEhRegua: true, blockedAmount: null, blockedAt: null, ...over,
})

// as 5 contas da Caçula com os números medidos em prod em 07-08/09/2026
const CONTAS = [
  conta({ name: 'banco caixa      ', balance: -3248.46, declaradoEhRegua: false }),
  conta({
    name: 'banrisul         ', balance: -6647.67,
    ledgerBal: -8347.67, ledgerBalDate: d('2026-09-04'),
    declaradoEhRegua: false,              // ⛔ vem da ficha, não do nome
    blockedAmount: 1700, blockedAt: d('2026-09-05'),
  }),
  conta({ name: 'caixa loja/cofre ', balance: 6953.03 }),
  conta({ name: 'sicredi          ', balance: -72016.52, ledgerBal: -72016.52, ledgerBalDate: d('2026-09-04') }),
  conta({ name: 'stone            ', balance: 769.16, ledgerBal: 769.16, ledgerBalDate: d('2026-09-05') }),
]

describe('a conferência de saldo — a única versão defensável', () => {
  it('⭐ confere POR CONTA, e só as que têm declaração do banco', () => {
    const r = conferirSaldos(CONTAS)
    expect(r.contas.map((c) => c.nome).sort()).toEqual(['banrisul', 'sicredi', 'stone'])
  })

  it('⛔ conta SEM extrato importado fica FORA — e nomeada, não escondida', () => {
    const r = conferirSaldos(CONTAS)
    expect(r.semExtrato.map((c) => c.nome)).toEqual(['banco caixa', 'caixa loja/cofre'])
    // ⚠️ o teste que morde: ela NÃO pode ser contada como "bate". Sem declaração
    // do banco não existe conferência, e dizer que bate é inventar o outro lado.
    expect(r.batem).toBe(2)
    expect(r.contas.some((c) => c.nome === 'caixa loja/cofre')).toBe(false)
  })

  it('⚠️ centavo de arredondamento não vira divergência (mas 1 centavo vira)', () => {
    const quase = conferirSaldos([conta({ name: 'x', balance: 100.004, ledgerBal: 100, ledgerBalDate: d('2026-09-01') })])
    expect(quase.contas[0].estado).toBe('BATE')
    const umCentavo = conferirSaldos([conta({ name: 'x', balance: 100.01, ledgerBal: 100, ledgerBalDate: d('2026-09-01') })])
    expect(umCentavo.contas[0].estado).toBe('DIVERGE')
    expect(umCentavo.contas[0].diferenca).toBe(0.01)
  })

  it('empresa sem conta nenhuma: zero é zero, não erro', () => {
    const r = conferirSaldos([])
    expect(r).toEqual({ contas: [], semExtrato: [], batem: 0, explicadas: 0, naoBatem: 0 })
  })
})

describe('⛔⛔ o bloqueio +24h é EXPLICADO, não alarme', () => {
  it('⭐ a diferença do Banrisul bate AO CENTAVO com o bloqueio declarado → EXPLICADO', () => {
    const r = conferirSaldos(CONTAS)
    const banrisul = r.contas.find((c) => c.nome === 'banrisul')!
    expect(banrisul.diferenca).toBe(1700)          // −6.647,67 − (−8.347,67)
    expect(banrisul.estado).toBe('EXPLICADO')
    expect(banrisul.explicacao).toContain('bloqueio +24h declarado')
    expect(banrisul.explicacao).toContain('1.700,00')
    // ⚠️ com a DATA do bloqueio, que é de 05/09 — não a do saldo (04/09). O
    // bloqueio muda todo dia; datar errado faria um número velho passar por atual.
    expect(banrisul.explicacao).toContain('05/09')
    expect(r.explicadas).toBe(1)
    expect(r.naoBatem).toBe(0)   // ⛔ nada pede ação — era o ruído a ser removido
  })

  it('⛔⛔ REPONDO O DEFEITO: sem a ficha, o mesmo Banrisul volta a acusar ⚠', () => {
    // a ÚNICA coisa trocada é a ficha. Se o estado mudar, a regra é da ficha.
    const semFicha = CONTAS.map((c) => (c.name.trim() === 'banrisul' ? { ...c, declaradoEhRegua: true } : c))
    const r = conferirSaldos(semFicha)
    expect(r.contas.find((c) => c.nome === 'banrisul')!.estado).toBe('DIVERGE')
    expect(r.naoBatem).toBe(1)
  })

  it('⛔⛔ O PASSE LIVRE NÃO EXISTE: ficha `false` com bloqueio que NÃO fecha continua ⚠', () => {
    // a ficha explica POR QUE a comparação não fecha; ela não explica ESTE número.
    const bloqueioErrado = CONTAS.map((c) =>
      c.name.trim() === 'banrisul' ? { ...c, blockedAmount: 500 } : c)
    const r = conferirSaldos(bloqueioErrado)
    const b = r.contas.find((c) => c.nome === 'banrisul')!
    expect(b.estado).toBe('DIVERGE')
    expect(b.explicacao).toContain('não foi medido')
    expect(r.naoBatem).toBe(1)
  })

  it('⛔ ficha `false` SEM bloqueio medido também não vira EXPLICADO', () => {
    const semBloqueio = CONTAS.map((c) =>
      c.name.trim() === 'banrisul' ? { ...c, blockedAmount: null, blockedAt: null } : c)
    const b = conferirSaldos(semBloqueio).contas.find((c) => c.nome === 'banrisul')!
    expect(b.estado).toBe('DIVERGE')
    // ⚠️ e a frase ensina a saída, em vez de só acusar
    expect(b.explicacao).toContain('dia a dia contra o PDF')
  })

  it('⭐ QUALQUER banco com a mesma mania ganha o mesmo tratamento — não é o nome', () => {
    // um banco inventado, com a ficha `false` e o bloqueio fechando: EXPLICADO.
    const outro = conferirSaldos([conta({
      name: 'banco novo', balance: -1000, ledgerBal: -1250, ledgerBalDate: d('2026-09-04'),
      declaradoEhRegua: false, blockedAmount: 250, blockedAt: d('2026-09-04'),
    })])
    expect(outro.contas[0].estado).toBe('EXPLICADO')
    expect(outro.explicadas).toBe(1)
  })

  it('⚠️ quem PEDE AÇÃO vem primeiro; o explicado desce junto do que bate', () => {
    const r = conferirSaldos([
      ...CONTAS,
      conta({ name: 'divergente', balance: 10, ledgerBal: 999, ledgerBalDate: d('2026-09-04') }),
    ])
    expect(r.contas[0].nome).toBe('divergente')
    expect(r.contas[0].estado).toBe('DIVERGE')
  })
})

// ────────────────────────────────────────────────────────────────
// ⭐⭐ O RESUMO DAS CONTAS SEM PAR (08/09/2026) — a lista saiu, o número ficou.
//
// *"Conta em aberto sem par no extrato é o estado NORMAL de uma conta que ainda
// não foi paga — não é pendência de conciliação."* — o dono.
//
// ⛔ E o número CRU seria o badge que todo mundo ignora. Medido na Caçula em
// 08/09: das 109, **67 nem venceram**, **34 venceram depois do último extrato
// importado (04/09)** — essas esperam ARQUIVO, não decisão — e só **8** têm o
// extrato do período já dentro. Este teste trava a quebra.
// ────────────────────────────────────────────────────────────────

import { resumirSemPar } from '../fila-de-conciliacao'

const conteudo = (venc: string, sugestoes: number, situacao: 'EM_ABERTO' | 'DUPLA_CONTAGEM' = 'EM_ABERTO') => ({
  conta: { id: venc + sugestoes + situacao, descricao: 'x', valor: 10, data: d(venc), tipo: 'DEBIT' as const, fornecedorId: null, contaBancariaId: null },
  situacao, fornecedor: null,
  sugestoes: Array.from({ length: sugestoes }, () => ({}) as never),
})

describe('o resumo das contas sem par', () => {
  const HOJE = d('2026-09-08')
  const ULTIMO_EXTRATO = d('2026-09-04')

  it('⭐ quebra o número em três: não venceu · espera o extrato · extrato já veio', () => {
    const r = resumirSemPar([
      conteudo('2026-11-10', 0),  // parcela pra novembro — nem venceu
      conteudo('2026-09-20', 0),  // ainda não venceu
      conteudo('2026-09-06', 0),  // venceu, mas o extrato de 06/09 não entrou
      conteudo('2026-09-03', 0),  // venceu e o extrato de 03/09 já está aqui
    ], HOJE, ULTIMO_EXTRATO)
    expect(r).toEqual({
      total: 4, naoVenceram: 2, aguardandoExtrato: 1, comExtratoImportado: 1,
      ultimoExtrato: ULTIMO_EXTRATO,
    })
  })

  it('⛔ conta COM par sugerido não é "sem par" — ela está na fila de decisão', () => {
    const r = resumirSemPar([conteudo('2026-09-03', 1)], HOJE, ULTIMO_EXTRATO)
    expect(r.total).toBe(0)
  })

  it('⛔⛔ DUPLA CONTAGEM fica FORA do resumo mesmo sem par — é anomalia, não espera', () => {
    // ⚠️ o teste que morde: contá-la aqui a esconderia atrás de um número de
    // informação, e ela é o oposto — dinheiro em duas linhas, que continua na tela.
    const r = resumirSemPar([conteudo('2026-09-03', 0, 'DUPLA_CONTAGEM')], HOJE, ULTIMO_EXTRATO)
    expect(r.total).toBe(0)
  })

  it('⚠️ sem extrato NENHUM importado, tudo que venceu aguarda ARQUIVO', () => {
    const r = resumirSemPar([conteudo('2026-09-03', 0)], HOJE, null)
    expect(r.aguardandoExtrato).toBe(1)
    expect(r.comExtratoImportado).toBe(0)
  })
})
