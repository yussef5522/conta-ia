// ⭐⭐⭐ OS TRÊS NÚMEROS DO TOPO BRIGAVAM — uma régua, um dono (13/09/2026).
//
// **O print do dono:** `VENCIDAS: 34 · R$ 48.502,57` × `Análise de inadimplência: 9 ·
// R$ 20.635,54` × lista visível: muito menos.
//
// **MEDIDO EM PROD, e fecha ao centavo:** o KPI usava `dueDate < now` (um TIMESTAMP) e o
// aging usava comparação por **DIA**. A diferença eram as **25 contas que vencem HOJE**
// (R$ 27.867,03): `9 + 25 = 34` e `20.635,54 + 27.867,03 = 48.502,57`.

import { describe, it, expect } from 'vitest'
import { statusDaConta, whereDoStatus, ehFluxo, inicioDoDiaBrasil, textoDoPrazo, diasAteVencer } from '../escopo'
import { resumirSemPar } from '@/lib/conciliacao/fila-de-conciliacao'
import { mesCorrente, mesVizinho, rotuloDoMes, janelaDoMes } from '@/lib/periodo/mes-corrente'

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

  it('⛔⛔ vence HOJE NÃO é vencida — o dia não acabou', () => {
    /**
     * ⚠️⚠️ **INVERTIDO em 26/09, com a metade CERTA preservada.** Ele afirmava
     * `toBe('A_PAGAR')`, que era a lei da época: só havia três estados. ⭐ **A metade que
     * importa — *"o dia não acabou, então não é VENCIDA"* — continua sendo o que ele
     * prova**, e essa nunca mudou: é a fronteira do dia do Brasil.
     *
     * O que mudou é que *hoje* ganhou estado PRÓPRIO (o 4º card, decisão do dono), porque
     * muda a AÇÃO: vencida já passou, a pagar ainda dá tempo, e hoje é o dia de agir.
     */
    const st = statusDaConta(conta('2026-09-13'), NOITE_DE_13)
    expect(st, 'a conta de hoje voltou a ser tratada como vencida às 23h').not.toBe('VENCIDA')
    expect(st).toBe('VENCE_HOJE')
  })

  it('⛔⛔ PAGA ganha de tudo — paga com atraso NÃO é vencida', () => {
    // não há ação pendente quando o dinheiro já saiu (a régua do card do cartão, 09/09)
    expect(statusDaConta(conta('2026-08-01', { paymentDate: '2026-09-10' }), NOITE_DE_13)).toBe('PAGA')
  })

  it('⚠️ conta SEM vencimento é A PAGAR, nunca vencida — não há data pra ter passado', () => {
    expect(statusDaConta(conta(null), NOITE_DE_13)).toBe('A_PAGAR')
  })

  it('⛔⛔ os status COBREM TUDO e não se sobrepõem — a soma tem que fechar', () => {
    /**
     * ⚠️ era exatamente isto que o card *"A VENCER (3d)"* quebrava em 13/09: ele era um
     * **SUBCONJUNTO** de A PAGAR, então a soma contava a mesma conta 2×.
     *
     * ⭐⭐ **26/09 — `VENCE_HOJE` entrou e a soma CONTINUA fechando**, porque ele é uma
     * PARTIÇÃO, não um subconjunto: a conta de hoje **sai** do A PAGAR. É essa a diferença
     * entre um card legítimo e o que morreu.
     */
    const amostra = [
      conta('2026-09-12'), conta('2026-09-13'), conta('2026-09-14'), conta(null),
      conta('2026-08-01', { paymentDate: '2026-09-10' }),
    ]
    const contagem = { VENCIDA: 0, VENCE_HOJE: 0, A_PAGAR: 0, PAGA: 0 }
    for (const c of amostra) contagem[statusDaConta(c, NOITE_DE_13)]++
    expect(contagem.VENCIDA + contagem.VENCE_HOJE + contagem.A_PAGAR + contagem.PAGA).toBe(amostra.length)
    // ⭐ a de 13/09 saiu do A_PAGAR e virou VENCE_HOJE — 3 → 2
    expect(contagem).toEqual({ VENCIDA: 1, VENCE_HOJE: 1, A_PAGAR: 2, PAGA: 1 })
  })

  it('⭐⭐ VENCE HOJE é o dia do BRASIL inteiro — inclusive às 23h', () => {
    /**
     * ⚠️ O servidor roda em UTC: às 23h de São Paulo o `new Date()` já diz o dia seguinte.
     * ⛔ Sem a fronteira do Brasil, a conta que vence HOJE viraria "vencida" às 21h e o
     * dono veria dívida vermelha que ele ainda tinha o dia inteiro pra pagar.
     */
    expect(statusDaConta(conta('2026-09-13'), NOITE_DE_13)).toBe('VENCE_HOJE')
    // ⭐ e amanhã ela é A PAGAR, nunca "vence hoje"
    expect(statusDaConta(conta('2026-09-14'), NOITE_DE_13)).toBe('A_PAGAR')
    // ⛔ e ontem é VENCIDA
    expect(statusDaConta(conta('2026-09-12'), NOITE_DE_13)).toBe('VENCIDA')
  })

  it('⛔⛔ e o `where` dos três de ABERTO não se sobrepõe — a dupla contagem é impossível', () => {
    const hoje = whereDoStatus('VENCE_HOJE', NOITE_DE_13) as { dueDate: { gte: Date; lt: Date } }
    const vencida = whereDoStatus('VENCIDA', NOITE_DE_13) as { dueDate: { lt: Date } }
    const aPagar = whereDoStatus('A_PAGAR', NOITE_DE_13) as { OR: Array<{ dueDate?: { gte?: Date } | null }> }
    // ⭐ VENCIDA termina onde VENCE_HOJE começa
    expect(vencida.dueDate.lt.getTime()).toBe(hoje.dueDate.gte.getTime())
    // ⭐ e A PAGAR começa onde VENCE_HOJE termina
    const comeco = aPagar.OR.find((o) => o.dueDate?.gte)?.dueDate?.gte
    expect(comeco?.getTime(), 'A PAGAR voltou a incluir o dia de hoje — dupla contagem')
      .toBe(hoje.dueDate.lt.getTime())
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

  it('⭐ A PAGAR carrega a SEM VENCIMENTO junto — senão a soma não fecha', () => {
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

// ⭐⭐⭐ AS DUAS TELAS, UMA VERDADE (13/09) — pedido do dono:
// *"'vencidas' daqui = 'sem pagamento vencidas' da Conciliação no mesmo recorte"*.
describe('⛔⛔ Contas a Pagar e Conciliação usam a MESMA fronteira', () => {
  it('⭐⭐ a Conciliação conta "não venceu" pelo dia do Brasil, igual ao Contas a Pagar', () => {
    // ⛔ era `c.conta.data > agora` (TIMESTAMP): às 23h de São Paulo o servidor em UTC já
    // dizia "amanhã", e a conta que vence amanhã contava como vencida numa tela e não na
    // outra. Um número, duas respostas.
    const contaDeAmanha = { conta: { id: 'x', descricao: 'x', valor: 100, data: new Date('2026-09-14'), tipo: 'DEBIT' as const, fornecedorId: null, contaBancariaId: null }, situacao: 'EM_ABERTO' as const, fornecedor: null, sugestoes: [] }
    const r = resumirSemPar([contaDeAmanha], NOITE_DE_13, null)
    expect(r.naoVenceram, 'a Conciliação achou vencida o que o Contas a Pagar chama de A PAGAR').toBe(1)
    // ⭐ e o outro lado diz a MESMA coisa
    expect(statusDaConta(conta('2026-09-14'), NOITE_DE_13)).toBe('A_PAGAR')
  })

  it('⭐ e a que venceu de verdade conta como vencida nas duas', () => {
    const contaVencida = { conta: { id: 'y', descricao: 'y', valor: 100, data: new Date('2026-09-12'), tipo: 'DEBIT' as const, fornecedorId: null, contaBancariaId: null }, situacao: 'EM_ABERTO' as const, fornecedor: null, sugestoes: [] }
    const r = resumirSemPar([contaVencida], NOITE_DE_13, null)
    expect(r.naoVenceram).toBe(0)
    expect(statusDaConta(conta('2026-09-12'), NOITE_DE_13)).toBe('VENCIDA')
  })
})

// ⭐⭐⭐ A REGRA DOS DOIS TEMPOS (14/09/2026) — pra não esconder dívida.
//
// **O dono:** *"PAGAS: recorte do período, padrão MÊS CORRENTE. VENCIDAS e A PAGAR são
// ESTOQUE, não fluxo — dívida aberta não expira com a virada do mês; esconder vencida de
// agosto seria mentir que não devo."*
describe('⛔⛔ fluxo abre no mês; estoque mostra o estado de agora', () => {
  it('⭐⭐ PAGAS recorta no mês — é o número que muda com o filtro', () => {
    const w = whereDoStatus('PAGA', NOITE_DE_13, '2026-09') as { paymentDate: { gte: Date; lt: Date } }
    expect(w.paymentDate.gte.toISOString().slice(0, 10)).toBe('2026-09-01')
    // ⚠️ o fim é EXCLUSIVO: `lte` no último dia às 23:59:59 perde o último segundo
    expect(w.paymentDate.lt.toISOString().slice(0, 10)).toBe('2026-10-01')
  })

  it('⛔⛔ VENCIDAS IGNORA o mês — mesmo recebendo um, mostra TUDO em aberto', () => {
    // ⚠️ a decisão mora na FUNÇÃO, não em cada tela: se dependesse de o chamador lembrar
    // de não passar o mês, a primeira tela nova esconderia dívida em silêncio
    const semMes = whereDoStatus('VENCIDA', NOITE_DE_13)
    const comMes = whereDoStatus('VENCIDA', NOITE_DE_13, '2026-09')
    expect(comMes, 'o mês vazou pro estoque — vencida de agosto sumiria').toEqual(semMes)
    expect(comMes).not.toHaveProperty('paymentDate.gte')
  })

  it('⛔ A PAGAR também ignora — conta de outubro não some em setembro', () => {
    expect(whereDoStatus('A_PAGAR', NOITE_DE_13, '2026-09'))
      .toEqual(whereDoStatus('A_PAGAR', NOITE_DE_13))
  })

  it('⭐ quem é FLUXO tem um dono só — não é um booleano solto por tela', () => {
    expect(ehFluxo('PAGA')).toBe(true)
    expect(ehFluxo('VENCIDA')).toBe(false)
    expect(ehFluxo('A_PAGAR')).toBe(false)
  })

  it('⚠️ sem mês nenhum, PAGAS volta a somar TUDO — por isso a rota nunca deixa vir vazio', () => {
    // ⛔ é o estado antigo (R$ 220 mil "desde sempre"); ele continua alcançável pra quem
    // quiser o total histórico, mas a tela SEMPRE manda um mês
    expect(whereDoStatus('PAGA', NOITE_DE_13)).toEqual({ paymentDate: { not: null } })
  })
})

describe('⭐ o mês é o do BRASIL, e navega', () => {
  it('⛔⛔ 1º de outubro às 00h30 de São Paulo ainda é SETEMBRO', () => {
    // ⚠️ o servidor roda em UTC: `2026-10-01T03:30Z` é 00h30 do dia 1º em SP — mas às
    // 21h30 de 30/09 o UTC já dizia outubro. Mesmo fuso do `inicioDoDiaBrasil`.
    expect(mesCorrente(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09')
    expect(mesCorrente(new Date('2026-10-01T04:00:00Z'))).toBe('2026-10')
  })

  it('⭐ ‹ › anda no calendário, inclusive na virada do ano', () => {
    expect(mesVizinho('2026-09', -1)).toBe('2026-08')
    expect(mesVizinho('2026-12', 1)).toBe('2027-01')
    expect(mesVizinho('2026-01', -1)).toBe('2025-12')
  })

  it('⭐ o rótulo esconde o ano corrente e MOSTRA o de fora — senão o dono se perde', () => {
    expect(rotuloDoMes('2026-09', NOITE_DE_13)).toBe('setembro')
    expect(rotuloDoMes('2025-09', NOITE_DE_13)).toBe('setembro de 2025')
  })

  it('⛔ dezembro fecha em 1º de janeiro do ano seguinte', () => {
    expect(janelaDoMes('2026-12').ate.toISOString().slice(0, 10)).toBe('2027-01-01')
  })
})
