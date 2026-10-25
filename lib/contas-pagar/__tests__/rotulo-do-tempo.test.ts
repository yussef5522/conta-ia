/**
 * ⭐⭐⭐ O RÓTULO DOS CARTÕES DO TEMPO — e o que este arquivo trava é a **PARTIÇÃO** mais a
 * **PROCEDÊNCIA DA DATA**, nunca cada texto solto.
 *
 * ⚠️⚠️ **ESTE ARQUIVO SUBSTITUI o `faixas-do-tempo.test.ts` (21/10), e a inversão tem motivo
 * escrito.** Aquele travava um vocabulário de **SEIS faixas** (`VENCIDAS · VENCE_HOJE ·
 * SETE_DIAS · RESTO_DO_MES · DEPOIS_DO_MES · SEM_VENCIMENTO`) que o dono **aposentou em
 * 23/10**: *"morrem PRÓXIMOS 7 DIAS e RESTO DO MÊS — janelas deslizantes que o dono não
 * entende"*. E havia uma razão mais dura que a preferência: ⛔ **`whereDaFaixa('VENCIDAS')`
 * era CÓPIA LITERAL de `whereDoStatus('VENCIDA')`** — duas réguas pra mesma palavra, que é
 * exatamente o defeito de 13/09 (o card dizia `34 · 48.502,57` e a tabela pintava
 * `9 · 20.635,54`). As três faixas de data só **subdividiam** o `A_PAGAR`.
 *
 * ⭐⭐ **A METADE QUE IMPORTAVA NÃO SE PERDEU — ela ficou MAIS FORTE:** o invariante do dono
 * (*"Σ dos cartões abertos == total em aberto"*) é provado em
 * `quatro-cartoes-e-a-soma-fecha.test.ts` contra os `where` do Prisma, e lá os três estados
 * são **partição POR CONSTRUÇÃO** (`]-∞,hoje[ · [hoje,amanhã[ · [amanhã,+∞[`). O que sobrou
 * pra cá é o que nasceu em 23/10: **de onde a DATA do rótulo vem.**
 *
 * ⛔⛔ **O CONTRAFACTUAL CONTINUA SENDO O CORAÇÃO:** um teste que só afirmasse *"VENCIDA sai
 * «até 20/10»"* ficaria **verde** no dia em que alguém reescrevesse "vencida" aqui com outra
 * régua. O que morde é comparar com o `statusDaConta`, que é o **dono da palavra**.
 */
import { describe, it, expect } from 'vitest'
import {
  ESCOPOS_EM_ABERTO,
  ehEscopoEmAberto,
  diaDoFiltro,
  nomeDoEscopo,
  dataDoEscopo,
  rotuloDoEscopo,
  type JanelaDeVencimento,
} from '../rotulo-do-tempo'
import { statusDaConta, type ContaParaStatus } from '../escopo'

// ⚠️ relógio FIXO e no PASSADO, com hora ALTA de propósito: às 23h30 de São Paulo o servidor
// em UTC já diz amanhã, e é essa a fronteira que costuma quebrar.
// ⛔ Data fixa no FUTURO em posição de relógio é bomba de calendário (REGRA 12, 01/09).
const NOW = new Date('2026-10-21T02:30:00.000Z') // 20/10/2026 23h30 em São Paulo

function conta(dueDate: string | null, pago = false): ContaParaStatus {
  return {
    status: pago ? 'RECONCILED' : 'PENDING',
    dueDate: dueDate ? new Date(dueDate) : null,
    paymentDate: pago ? new Date('2026-10-15T12:00:00.000Z') : null,
  }
}

const janela = (de?: string, ate?: string): JanelaDeVencimento => ({
  de: diaDoFiltro(de),
  ate: diaDoFiltro(ate),
})

describe('o vocabulário é UM — o mesmo EscopoDaLista, sem apelido novo', () => {
  it('são exatamente os TRÊS estados de aberto, na ordem do TEMPO', () => {
    // ⭐ a ordem é o que a fileira de cartões e as seções da tabela seguem
    expect(ESCOPOS_EM_ABERTO).toEqual(['VENCIDA', 'VENCE_HOJE', 'A_PAGAR'])
  })

  it('a validação da URL recusa o vocabulário MORTO e o desconhecido', () => {
    expect(ehEscopoEmAberto('VENCIDA')).toBe(true)
    expect(ehEscopoEmAberto('A_PAGAR')).toBe(true)
    // ⛔ as faixas de 21/10 não voltam por aqui: quem as traduz é o passthrough legado
    expect(ehEscopoEmAberto('SETE_DIAS')).toBe(false)
    expect(ehEscopoEmAberto('RESTO_DO_MES')).toBe(false)
    expect(ehEscopoEmAberto('xpto')).toBe(false)
    expect(ehEscopoEmAberto('')).toBe(false)
  })
})

describe('⛔ CONTRAFACTUAL — o rótulo CONCORDA com o dono da palavra', () => {
  it('a data de VENCIDA/VENCE HOJE bate com o `statusDaConta` na fronteira do dia', () => {
    // é a trava que impede uma SEGUNDA definição de "vencida"/"vence hoje" nascer aqui
    const ontem = conta('2026-10-19')
    const hoje = conta('2026-10-20')
    expect(statusDaConta(ontem, NOW)).toBe('VENCIDA')
    expect(statusDaConta(hoje, NOW)).toBe('VENCE_HOJE')

    // ⭐ e o rótulo fala do MESMO corte: vencida termina ONTEM, vence-hoje é HOJE
    expect(dataDoEscopo('VENCIDA', NOW)).toBe('até 19/10')
    expect(dataDoEscopo('VENCE_HOJE', NOW)).toContain('20/10')
  })

  it('o dia é o do BRASIL, não o do servidor em UTC', () => {
    // às 23h30 de SP (02h30 UTC do dia seguinte) o "hoje" ainda é 20/10.
    // ⛔ Pelo relógio UTC o rótulo diria 21/10 e a conta de hoje apareceria como vencida.
    expect(dataDoEscopo('VENCE_HOJE', NOW)).toBe('ter · 20/10')
    expect(dataDoEscopo('A_PAGAR', NOW)).toBe('a partir de 21/10')
  })
})

describe('⭐⭐ a data do «A VENCER» é a INTERSEÇÃO com a janela do filtro', () => {
  it('o rótulo do pedido do dono sai ao caractere', () => {
    // o caso que ele escreveu: filtro 01–31/10, estado começa AMANHÃ (24/10)
    const now = new Date('2026-10-24T02:30:00.000Z') // 23/10 23h30 em SP
    expect(rotuloDoEscopo('A_PAGAR', now, janela('2026-10-01', '2026-10-31')))
      .toBe('A VENCER · 24 a 31/10')
  })

  it('⛔ sem a interseção o rótulo prometeria mais do que a lista entrega', () => {
    // o estado começa em AMANHÃ e vai até +∞; o FILTRO para em 31/10.
    // Dizer "a partir de 21/10" numa lista que para no dia 31 é promessa que a tabela não cumpre.
    const comFiltro = dataDoEscopo('A_PAGAR', NOW, janela('2026-10-01', '2026-10-31'))
    const semFiltro = dataDoEscopo('A_PAGAR', NOW)
    expect(semFiltro).toBe('a partir de 21/10')
    expect(comFiltro).toBe('21 a 31/10')
    expect(comFiltro).not.toBe(semFiltro)
  })

  it('o COMEÇO é o mais TARDE entre amanhã e o início do filtro', () => {
    // filtro começa depois de amanhã → manda o filtro
    expect(dataDoEscopo('A_PAGAR', NOW, janela('2026-11-01', '2026-11-30'))).toBe('01 a 30/11')
    // filtro começa no PASSADO → amanhã manda (o estado não alcança o passado)
    expect(dataDoEscopo('A_PAGAR', NOW, janela('2026-09-01', '2026-10-31'))).toBe('21 a 31/10')
  })

  it('o mês aparece nas DUAS pontas quando a janela atravessa o mês', () => {
    expect(dataDoEscopo('A_PAGAR', NOW, janela('2026-10-01', '2026-11-15'))).toBe('21/10 a 15/11')
  })

  it('⛔ janela inteiramente no PASSADO não inventa data — devolve o nome sozinho', () => {
    // nenhum dia do estado cabe no filtro → dizer um intervalo ali seria afirmar o que não existe
    expect(dataDoEscopo('A_PAGAR', NOW, janela('2026-09-01', '2026-09-30'))).toBeNull()
    expect(rotuloDoEscopo('A_PAGAR', NOW, janela('2026-09-01', '2026-09-30'))).toBe('A VENCER')
  })

  it('⚠️ VENCIDAS e VENCE HOJE ficam INTOCADOS pela janela (ordem do dono)', () => {
    const j = janela('2026-10-01', '2026-10-31')
    expect(dataDoEscopo('VENCIDA', NOW, j)).toBe(dataDoEscopo('VENCIDA', NOW))
    expect(dataDoEscopo('VENCE_HOJE', NOW, j)).toBe(dataDoEscopo('VENCE_HOJE', NOW))
  })
})

describe('o rótulo é NOME + data, e os dois têm um dono só', () => {
  it('todo estado sai com o nome e com data', () => {
    for (const e of ESCOPOS_EM_ABERTO) {
      const r = rotuloDoEscopo(e, NOW)
      expect(r).toContain(nomeDoEscopo(e))
      expect(r, `${e} saiu sem data no rótulo: ${r}`).toMatch(/\d{2}\/\d{2}/)
    }
  })

  it('o nome é o que o dono lê — os 3 que ele entende', () => {
    expect(nomeDoEscopo('VENCIDA')).toBe('VENCIDAS')
    expect(nomeDoEscopo('VENCE_HOJE')).toBe('VENCE HOJE')
    expect(nomeDoEscopo('A_PAGAR')).toBe('A VENCER')
  })
})

describe('diaDoFiltro — montado do TEXTO, nunca de `new Date(iso)` com hora', () => {
  it('devolve o dia de CALENDÁRIO em 00:00Z', () => {
    const d = diaDoFiltro('2026-10-31')!
    expect(d.toISOString()).toBe('2026-10-31T00:00:00.000Z')
    // ⚠️ a cicatriz de 14/09: em fuso negativo o dia rolava pra trás
    expect(d.getUTCDate()).toBe(31)
  })

  it('ausente ou torto devolve null, nunca uma data chutada', () => {
    expect(diaDoFiltro(undefined)).toBeNull()
    expect(diaDoFiltro('')).toBeNull()
    expect(diaDoFiltro('xpto')).toBeNull()
  })
})
