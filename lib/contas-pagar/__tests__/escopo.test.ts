// ⭐⭐⭐ OS TRÊS NÚMEROS DO TOPO BRIGAVAM — uma régua, um dono (13/09/2026).
//
// **O print do dono:** `VENCIDAS: 34 · R$ 48.502,57` × `Análise de inadimplência: 9 ·
// R$ 20.635,54` × lista visível: muito menos.
//
// **MEDIDO EM PROD, e fecha ao centavo:** o KPI usava `dueDate < now` (um TIMESTAMP) e o
// aging usava comparação por **DIA**. A diferença eram as **25 contas que vencem HOJE**
// (R$ 27.867,03): `9 + 25 = 34` e `20.635,54 + 27.867,03 = 48.502,57`.

import { describe, it, expect } from 'vitest'
import { statusDaConta, whereDoStatus, inicioDoDiaBrasil, textoDoPrazo, diasAteVencer } from '../escopo'

/** 23h12 de São Paulo em 13/09 — o instante exato da medição em prod */
const NOITE_DE_13 = new Date('2026-09-14T02:12:37.007Z')
const conta = (dueDate: string | null, extra: Partial<{ status: string; paymentDate: string | null }> = {}) => ({
  status: extra.status ?? 'PENDING',
  dueDate,
  paymentDate: extra.paymentDate ?? null,
})

describe('⛔⛔ "vencida" é UMA régua, e ela é por DIA DO BRASIL', () => {
  it('⭐⭐ às 23h de 13/09, a conta que vence 14/09 é A PAGAR — não vencida', () => {
    // ⚠️ ERA ISTO QUE INFLAVA O CARD: o servidor roda em UTC e às 23h12 de São Paulo o
    // `new Date()` já diz 14/09. O dono via 25 contas vermelhas que ele ainda tinha o dia
    // inteiro pra pagar — o mesmo fuso que fazia o cartão PF mentir 3 horas por dia.
    expect(statusDaConta(conta('2026-09-14'), NOITE_DE_13)).toBe('A_PAGAR')
    expect(inicioDoDiaBrasil(NOITE_DE_13).toISOString().slice(0, 10)).toBe('2026-09-13')
  })

  it('⭐ vencimento ANTERIOR a hoje é VENCIDA', () => {
    expect(statusDaConta(conta('2026-09-12'), NOITE_DE_13)).toBe('VENCIDA')
  })

  it('⭐ vence HOJE ainda é A PAGAR — o dia não acabou', () => {
    expect(statusDaConta(conta('2026-09-13'), NOITE_DE_13)).toBe('A_PAGAR')
  })

  it('⛔⛔ PAGA ganha de tudo — paga com atraso NÃO é vencida', () => {
    // não há ação pendente quando o dinheiro já saiu (a régua do card do cartão, 09/09)
    expect(statusDaConta(conta('2026-08-01', { paymentDate: '2026-09-10' }), NOITE_DE_13)).toBe('PAGA')
  })

  it('⚠️ conta SEM vencimento é A PAGAR, nunca vencida — não há data pra ter passado', () => {
    expect(statusDaConta(conta(null), NOITE_DE_13)).toBe('A_PAGAR')
  })

  it('⛔⛔ os três status COBREM TUDO e não se sobrepõem — a soma tem que fechar', () => {
    // ⚠️ era exatamente isto que o 4º card quebrava: "A VENCER (3d)" é um SUBCONJUNTO de
    // "A PAGAR", então pendente + vencido + pagas + aVencer3d contava a mesma conta 2×.
    const amostra = [
      conta('2026-09-12'), conta('2026-09-13'), conta('2026-09-14'), conta(null),
      conta('2026-08-01', { paymentDate: '2026-09-10' }),
    ]
    const contagem = { VENCIDA: 0, A_PAGAR: 0, PAGA: 0 }
    for (const c of amostra) contagem[statusDaConta(c, NOITE_DE_13)]++
    expect(contagem.VENCIDA + contagem.A_PAGAR + contagem.PAGA).toBe(amostra.length)
    expect(contagem).toEqual({ VENCIDA: 1, A_PAGAR: 3, PAGA: 1 })
  })
})

describe('⭐⭐ o `where` diz a MESMA coisa que a função — o número É o filtro', () => {
  it('⭐ VENCIDA no where usa a mesma fronteira do dia do Brasil', () => {
    const w = whereDoStatus('VENCIDA', NOITE_DE_13) as { dueDate: { lt: Date } }
    expect(w.dueDate.lt.toISOString().slice(0, 10)).toBe('2026-09-13')
  })

  it('⛔ e VENCIDA exige paymentDate NULL — paga-sem-vínculo é assunto do card PAGAS', () => {
    // ⚠️ o KPI antigo não tinha isso: uma conta marcada paga (com data) mas ainda PENDING
    // entrava como vencida, e o dono via dívida que ele já pagou
    expect(whereDoStatus('VENCIDA', NOITE_DE_13)).toMatchObject({ paymentDate: null })
  })

  it('⭐ A PAGAR carrega a SEM VENCIMENTO junto — senão a soma dos três não fecha', () => {
    const w = whereDoStatus('A_PAGAR', NOITE_DE_13) as { OR: Array<Record<string, unknown>> }
    expect(w.OR.some((o) => o.dueDate === null)).toBe(true)
  })
})

describe('⭐ "vence em 2 dias" é texto da DATA, nunca um status', () => {
  it('⭐⭐ o prazo vira sufixo curto colado no vencimento', () => {
    expect(textoDoPrazo('2026-09-15', NOITE_DE_13)).toBe('em 2d')
    expect(textoDoPrazo('2026-09-14', NOITE_DE_13)).toBe('amanhã')
    expect(textoDoPrazo('2026-09-13', NOITE_DE_13)).toBe('hoje')
    expect(textoDoPrazo('2026-09-12', NOITE_DE_13)).toBe('há 1 dia')
    expect(textoDoPrazo('2026-09-10', NOITE_DE_13)).toBe('há 3 dias')
  })

  it('⚠️ sem data o texto DIZ isso — em vez de sumir a coluna', () => {
    expect(textoDoPrazo(null, NOITE_DE_13)).toBe('sem data')
    expect(diasAteVencer(null, NOITE_DE_13)).toBeNull()
  })
})
