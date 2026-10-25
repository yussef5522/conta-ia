/**
 * ⭐⭐⭐ O LOTE AGE NAS 81 — a prova do item 3 do dono (23/10).
 *
 * **A CAÇA respondeu a pergunta dele antes da cura, e o resultado mudou o alvo do sprint:**
 * *"com 81 selecionadas em 2 páginas, o que «Marcar como pagas» e «Excluir» fazem HOJE — agem
 * nas 81 ou só nas da página?"* ⭐ **Medido no código em prod (`8d46351d`): elas SEMPRE agiram
 * nas 81.** `selectedIds` vem de um `Record<string, boolean>` que **sobrevive à paginação**, e
 * a rota de bulk recebe **IDS EXPLÍCITOS** sem resolver filtro nenhum no servidor. ⛔ **Não era
 * o defeito grave de "ação parcial dizendo total".**
 *
 * ⛔⛔ **O DEFEITO ESTAVA UM DEGRAU ANTES, e era DOIS:**
 *  1. **não havia caminho pra selecionar as 81** — o checkbox do cabeçalho era
 *     `toggleAllPageRowsSelected`, que alcança só as ~50 da página;
 *  2. ⛔ **e o total da barra era a soma da PÁGINA** (`selecaoNaPagina.reduce(…)`) enquanto a
 *     contagem e as ações falavam das 81. **Esse MENTIA** — medido em prod: a barra escondia
 *     31 contas e R$ 44.533,81.
 *
 * ⭐ **Então este arquivo trava as DUAS metades**, porque uma sem a outra não serve: o lote
 * continua agindo em TODAS as selecionadas (o que já era verdade, e que um refactor poderia
 * quebrar em silêncio) **e** a seleção do filtro inteiro entrega os pares `{id, amount}` que
 * fazem o total ser o agregado por construção.
 *
 * ⛔⛔ **E ELE EXECUTA O SCHEMA E A LIB, nunca grep** (REGRA 3): grep não distingue *"a rota
 * aceita 81 ids"* de *"a rota tem a palavra 81 num comentário"*.
 */
import { describe, it, expect } from 'vitest'
import {
  bulkActionSchema,
  validateBulkMarkPaid,
  blockedMessage,
  type BulkInputTx,
} from '../bulk-actions'
import {
  recortarSelecao,
  avisoDoTeto,
  TETO_DO_LOTE,
  type ParDeSelecao,
} from '../selecao-do-filtro'

/** os números REAIS do print do dono (23/10 01:56 · filtro 1–31/10 · Pendentes) */
const CONTAS_NO_FILTRO = 81
const TOTAL_DO_FILTRO = 97_313.25
/** a lista pagina em 50 — é essa fronteira que criava a mentira */
const POR_PAGINA = 50

/** ids com a forma que o `z.string().cuid()` aceita (o schema é executado de verdade) */
const cuid = (n: number) => `c${String(n).padStart(24, 'a')}`

function paresDoFiltro(quantas = CONTAS_NO_FILTRO): ParDeSelecao[] {
  // valores que SOMAM exatamente o total do print, pra o invariante não depender de fixture bonita
  const cada = Math.round((TOTAL_DO_FILTRO / quantas) * 100) / 100
  const pares = Array.from({ length: quantas }, (_, i) => ({ id: cuid(i), amount: cada }))
  const resto = Math.round((TOTAL_DO_FILTRO - cada * quantas) * 100) / 100
  pares[0] = { ...pares[0], amount: Math.round((cada + resto) * 100) / 100 }
  return pares
}

const semBanco = (ids: string[]): BulkInputTx[] =>
  ids.map((id) => ({ id, bankAccountId: null, paymentDate: null }))

describe('⭐⭐ a SELEÇÃO é do FILTRO inteiro, nunca da página', () => {
  it('seleciona as 81 e o total É o agregado do servidor — por construção', () => {
    const sel = recortarSelecao(paresDoFiltro(), CONTAS_NO_FILTRO)

    expect(sel.pares).toHaveLength(81)
    expect(sel.totalNoFiltro).toBe(81)
    expect(sel.truncado).toBe(false)
    expect(avisoDoTeto(sel)).toBeNull()

    // ⭐ a soma dos pares É o total do filtro: o cliente não precisa somar página nenhuma
    const soma = sel.pares.reduce((a, p) => a + p.amount, 0)
    expect(Math.round(soma * 100) / 100).toBe(TOTAL_DO_FILTRO)
  })

  it('⛔ CONTRAFACTUAL — a soma da PÁGINA é o defeito, e ela mente por R$ 44 mil', () => {
    const pares = paresDoFiltro()
    const soDaPagina = pares.slice(0, POR_PAGINA).reduce((a, p) => a + p.amount, 0)

    // é EXATAMENTE o que a barra fazia: contagem/ações das 81, dinheiro de 50
    expect(soDaPagina).toBeLessThan(TOTAL_DO_FILTRO)
    expect(Math.round((TOTAL_DO_FILTRO - soDaPagina) * 100) / 100).toBeGreaterThan(30_000)
    expect(pares.length - POR_PAGINA).toBe(31)
  })

  it('⛔ o `amount` VIAJA com o id — sem ele a barra volta a somar só a página', () => {
    const sel = recortarSelecao(paresDoFiltro(3), 3)
    for (const p of sel.pares) {
      expect(typeof p.amount, 'par sem valor: o total da barra deixaria de ser agregado')
        .toBe('number')
    }
  })
})

describe('⭐⭐⭐ as AÇÕES EM LOTE agem nas 81, nunca nas 50 da página', () => {
  it('MARCAR PAGAS: o schema aceita os 81 ids e a validação libera os 81', () => {
    const ids = paresDoFiltro().map((p) => p.id)

    const parsed = bulkActionSchema.safeParse({
      action: 'mark_paid',
      transactionIds: ids,
      paymentDate: '2026-10-23',
    })
    expect(parsed.success, 'a rota recusou as 81 — o lote viraria parcial').toBe(true)
    if (parsed.success) expect(parsed.data.transactionIds).toHaveLength(81)

    const { allowed, blocked } = validateBulkMarkPaid(semBanco(ids))
    expect(allowed).toHaveLength(81)
    expect(blocked).toHaveLength(0)
  })

  it('EXCLUIR: o schema aceita os 81 ids', () => {
    const parsed = bulkActionSchema.safeParse({
      action: 'delete',
      transactionIds: paresDoFiltro().map((p) => p.id),
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.transactionIds).toHaveLength(81)
  })

  it('⛔ ALL-OR-NOTHING: uma já efetivada BLOQUEIA o lote inteiro, nomeando o número', () => {
    const ids = paresDoFiltro().map((p) => p.id)
    const txs = semBanco(ids)
    txs[7] = { id: ids[7], bankAccountId: cuid(999), paymentDate: '2026-10-20' }

    const { allowed, blocked } = validateBulkMarkPaid(txs)
    expect(blocked).toEqual([ids[7]])
    expect(allowed).toHaveLength(80)

    // ⚠️ e a recusa DIZ o número — "não deu" sem o quanto manda o dono caçar às cegas
    expect(blockedMessage(blocked.length, txs.length)).toContain('1 de 81')
  })

  it('⛔ a ação NUNCA resolve filtro no servidor — o campo é a LISTA DE IDS', () => {
    /**
     * ⛔⛔ Se a rota aceitasse um FILTRO, **um bug no filtro apagaria a linha errada** sem
     * ninguém ter visto a lista. Mandar `filtro` em vez de `transactionIds` tem que ser
     * recusado pelo schema.
     */
    const comFiltro = bulkActionSchema.safeParse({
      action: 'delete',
      filtro: { status: 'PENDING', dataDe: '2026-10-01', dataAte: '2026-10-31' },
    })
    expect(comFiltro.success, 'a rota passou a resolver filtro — um bug nele apaga a conta errada')
      .toBe(false)

    const vazio = bulkActionSchema.safeParse({ action: 'delete', transactionIds: [] })
    expect(vazio.success, 'lote vazio passou: gesto que não age em nada não é gesto').toBe(false)
  })
})

describe('⛔⛔ o TETO tem um DONO SÓ, e ele é DITO', () => {
  it('⭐ as TRÊS formas concordam — o `.max()` DERIVA de `TETO_DO_LOTE`', () => {
    const ids = Array.from({ length: TETO_DO_LOTE }, (_, i) => cuid(i))

    expect(bulkActionSchema.safeParse({ action: 'delete', transactionIds: ids }).success)
      .toBe(true)
    expect(
      bulkActionSchema.safeParse({
        action: 'mark_paid',
        transactionIds: ids,
        paymentDate: '2026-10-23',
      }).success,
    ).toBe(true)

    // ⛔ UM acima do teto é recusado nas DUAS ações — o teto é real, não decorativo
    const umAMais = [...ids, cuid(TETO_DO_LOTE)]
    expect(bulkActionSchema.safeParse({ action: 'delete', transactionIds: umAMais }).success)
      .toBe(false)
    expect(
      bulkActionSchema.safeParse({
        action: 'mark_paid',
        transactionIds: umAMais,
        paymentDate: '2026-10-23',
      }).success,
    ).toBe(false)
  })

  it('⭐ filtro acima do teto TRUNCA e a barra DIZ o que ficou fora', () => {
    const total = 812
    const sel = recortarSelecao(paresDoFiltro(total), total)

    expect(sel.pares).toHaveLength(TETO_DO_LOTE)
    expect(sel.truncado).toBe(true)
    expect(sel.foraDoTeto).toBe(total - TETO_DO_LOTE)

    const aviso = avisoDoTeto(sel)
    expect(aviso, 'truncou CALADO — a classe do `take: 50` que escondeu o fermento').not.toBeNull()
    expect(aviso).toContain('500')
    expect(aviso).toContain('812')
    expect(aviso).toContain('312')
  })

  it('⛔ e as 500 que ele marcou SÃO aceitas pela rota — o teto não é um beco', () => {
    const total = 812
    const sel = recortarSelecao(paresDoFiltro(total), total)
    const parsed = bulkActionSchema.safeParse({
      action: 'delete',
      transactionIds: sel.pares.map((p) => p.id),
    })
    expect(parsed.success, 'a porta entrega mais ids do que a rota aceita — o gesto morre').toBe(
      true,
    )
  })
})
