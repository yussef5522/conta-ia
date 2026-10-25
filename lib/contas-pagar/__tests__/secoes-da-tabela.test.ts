/**
 * ⭐⭐ AS LINHAS-CABEÇALHO DE FAIXA DENTRO DA TABELA.
 *
 * Duas travas sustentam o resto:
 *
 * ⛔⛔ **(1) SEÇÃO SÓ EM ORDEM DE VENCIMENTO.** Ordenado por valor, as faixas se intercalam e
 * cada troca abriria um cabeçalho com subtotal PARCIAL — aí o invariante *"Σ das faixas == Σ
 * das linhas"* fica visivelmente FALSO na tela, com os números à vista.
 *
 * ⛔⛔ **(2) O SUBTOTAL É O DA FAIXA INTEIRA (agregado do servidor), nunca a soma da página.**
 * A lista pagina: somar o visível faria o cabeçalho dizer `R$ 20 mil` e o chip do topo
 * `R$ 40 mil` pra a MESMA faixa, dois números do mesmo fato a dez centímetros um do outro.
 * ⚠️ E quando a página corta a faixa, o cabeçalho **DIZ** — truncagem silenciosa é a classe
 * do `take: 50` que escondeu o fermento (16/09).
 */
import { describe, it, expect } from 'vitest'
import {
  secoesDasLinhas,
  ordenadoPorVencimento,
  type LinhaParaSecao,
  type TotalDoEstado,
} from '../secoes-da-tabela'
import type { EscopoEmAberto } from '../rotulo-do-tempo'

const NOW = new Date('2026-10-21T02:30:00.000Z') // 20/10 23h30 em SP

function linha(id: string, dueDate: string | null, pago = false): LinhaParaSecao {
  return {
    id,
    status: pago ? 'RECONCILED' : 'PENDING',
    dueDate,
    paymentDate: pago ? '2026-10-15' : null,
  }
}

/**
 * ⚠️ 23/10 — o vocabulário das SEIS faixas morreu e o corte voltou aos TRÊS estados de
 * aberto (`VENCIDA | VENCE_HOJE | A_PAGAR`), que são **partição** por construção desde
 * 26/09. ⛔ E a medida agora carrega o **RÓTULO**: ele vem do SERVIDOR, no mesmo instante
 * do agregado — *um relógio só manda*. Derivar a janela aqui ressuscitaria o segundo
 * relógio que o `secoesDasLinhas` acabou de aposentar.
 */
const TOTAIS: Partial<Record<EscopoEmAberto, TotalDoEstado>> = {
  VENCIDA: { contagem: 3, total: 9_581.08, rotulo: 'VENCIDAS · até 20/10' },
  VENCE_HOJE: { contagem: 1, total: 1_940.59, rotulo: 'VENCE HOJE · ter · 21/10' },
  A_PAGAR: { contagem: 5, total: 20_000, rotulo: 'A VENCER · 22 A 31/10' },
}

describe('as seções agrupam na ordem em que a tabela desenha', () => {
  it('abre uma seção por estado, na ordem das linhas', () => {
    const s = secoesDasLinhas(
      [
        linha('a', '2026-10-01'),
        linha('b', '2026-10-19'),
        linha('c', '2026-10-20'),
        linha('d', '2026-10-24'),
      ],
      TOTAIS,
      { porVencimento: true },
      NOW,
    )!
    expect(s.map((x) => x.escopo)).toEqual(['VENCIDA', 'VENCE_HOJE', 'A_PAGAR'])
    expect(s[0].ids).toEqual(['a', 'b'])
    expect(s[1].ids).toEqual(['c'])
  })

  it('⛔ FORA da ordem de vencimento NÃO agrupa — devolve null e a tabela fica plana', () => {
    const s = secoesDasLinhas([linha('a', '2026-10-01')], TOTAIS, { porVencimento: false }, NOW)
    expect(s).toBeNull()
  })

  it('⛔ o subtotal é o da FAIXA INTEIRA, não a soma da página', () => {
    // só UMA das 3 vencidas está na página; o cabeçalho ainda diz os R$ 9.581,08 do chip
    const s = secoesDasLinhas([linha('b', '2026-10-19')], TOTAIS, { porVencimento: true }, NOW)!
    expect(s[0].subtotal).toBe(9_581.08)
    expect(s[0].contagem).toBe(3)
    expect(s[0].ids).toHaveLength(1)
    // ⭐ e a parcialidade é DITA
    expect(s[0].parcial).toBe(true)
  })

  it('estado inteiro na página NÃO é parcial', () => {
    const s = secoesDasLinhas(
      [linha('c', '2026-10-20')],
      { VENCE_HOJE: { contagem: 1, total: 1_940.59, rotulo: 'VENCE HOJE · ter · 21/10' } },
      { porVencimento: true },
      NOW,
    )!
    expect(s[0].parcial).toBe(false)
  })

  it('⚠️ agregado AUSENTE não finge parcialidade ao contrário', () => {
    // sem agregado, `contagem` é 0 e `ids` tem 1 — `>` (e não `!==`) impede o "parcial"
    // invertido, que mandaria o dono procurar linha que não existe
    const s = secoesDasLinhas([linha('b', '2026-10-19')], {}, { porVencimento: true }, NOW)!
    expect(s[0].parcial).toBe(false)
    expect(s[0].subtotal).toBe(0)
  })

  it('conta PAGA não abre seção — ela fica em cauda sem cabeçalho', () => {
    const s = secoesDasLinhas(
      [linha('a', '2026-10-19'), linha('p', '2026-10-01', true), linha('c', '2026-10-20')],
      TOTAIS,
      { porVencimento: true },
      NOW,
    )!
    const ids = s.flatMap((x) => x.ids)
    expect(ids).not.toContain('p')
    // ⭐ e a conta depois da paga abre seção nova em vez de entrar na anterior
    expect(s.map((x) => x.escopo)).toEqual(['VENCIDA', 'VENCE_HOJE'])
  })

  it('o mesmo estado voltando depois de uma paga abre OUTRA seção (a ordem manda)', () => {
    const s = secoesDasLinhas(
      [linha('a', '2026-10-19'), linha('p', '2026-10-01', true), linha('b', '2026-10-18')],
      TOTAIS,
      { porVencimento: true },
      NOW,
    )!
    expect(s).toHaveLength(2)
    expect(s.every((x) => x.escopo === 'VENCIDA')).toBe(true)
  })

  it('o rótulo do cabeçalho é o MESMO do chip (um texto, um dono)', () => {
    const s = secoesDasLinhas([linha('d', '2026-10-24')], TOTAIS, { porVencimento: true }, NOW)!
    expect(s[0].rotulo).toMatch(/\d{2}\/\d{2}/)
  })
})

describe('ordenadoPorVencimento', () => {
  it('sorting vazio é SIM — o default da tabela é dueDate asc', () => {
    // ⚠️ se fosse NÃO, a tela abriria sem seção nenhuma no estado mais comum
    expect(ordenadoPorVencimento([])).toBe(true)
    expect(ordenadoPorVencimento(undefined)).toBe(true)
  })

  it('ordenado por outra coluna é NÃO', () => {
    expect(ordenadoPorVencimento([{ id: 'amount' }])).toBe(false)
    expect(ordenadoPorVencimento([{ id: 'favorecido' }])).toBe(false)
  })

  it('ordenado por dueDate é SIM (em qualquer direção)', () => {
    expect(ordenadoPorVencimento([{ id: 'dueDate' }])).toBe(true)
  })
})
