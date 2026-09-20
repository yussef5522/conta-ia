// ⛔⛔⛔ NADA SAI DA CAIXA SEM CATEGORIA (20/09/2026)
//
// **A regra do dono:** *"linha resolvida SEMPRE termina com categoria — casar com conta a
// pagar → HERDA da conta; ⛔ se a conta casada NÃO TEM categoria, o confirmar pede ali
// («essa conta não tem categoria — qual é?») e grava NA CONTA (aprende pra próxima);
// despesa avulsa → o chip que já existe; fatura/empréstimo/transferência → categoria
// estrutural deles. **Guard: movimentação nascida da caixa sem categoria = vermelho.**"*
//
// ⭐⭐ **O QUE CONTA COMO "TEM CATEGORIA" NÃO É UM SEGUNDO CRITÉRIO INVENTADO AQUI.** Quem
// responde *"esta linha tem nome?"* é o `rotularLinha` do Fluxo de Caixa (26/08), e ele já
// conhece as famílias que o banco não categoriza mas o sistema sabe pela ESTRUTURA: fatura
// de cartão (`isCardPayment`) e parcela de empréstimo (o vínculo). `A CLASSIFICAR` é
// exatamente o balde de quem não tem nem categoria nem estrutura — ***é ele o vermelho***.
// Escrever uma régua nova aqui faria a caixa e o Fluxo discordarem sobre a mesma linha.
//
// ⛔ **E O GUARD EXECUTA O GESTO** (REGRA 3): roda `resolverLinha` de verdade pra cada ação
// que tira a linha da caixa e olha o ESTADO em que a linha ficou — não procura string.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rotularLinha, CAT_SEM, type LinhaFluxo } from '@/lib/fluxo-caixa/motor'
import { ResolverError } from '@/lib/conciliacao/resolver-linha'

vi.mock('@/lib/credit-card-pj/casar-pagamento', () => ({
  CasarPagamentoError: class extends Error {},
  casarPagamentoDeCartao: vi.fn(async () => {
    estado.isCardPayment = true          // ⭐ é ISTO que dá nome à linha da fatura
    return { paidInvoiceMonth: '2026-09' }
  }),
}))
vi.mock('@/lib/loans/vincular-pagamento', () => ({
  VinculoDeParcelaError: class extends Error {},
  vincularPagamentoDeParcela: vi.fn(async () => {
    estado.ehParcelaEmprestimo = true    // ⭐ o vínculo com a parcela é a estrutura
    return { status: 'PAID', splitInjected: true }
  }),
}))
vi.mock('@/lib/conciliacao/reconcile', () => ({
  // ⭐ o reconcile HERDA a categoria da conta casada — é o comportamento real dele
  reconcileTransactions: vi.fn(async ({ candidateId }: { candidateId: string }) => {
    estado.categoriaNome = contas[candidateId] ?? null
  }),
}))
vi.mock('@/lib/vendas/recompute-hook', () => ({ recomputeVendasSeVenda: vi.fn(async () => {}) }))

/** o estado em que a LINHA DO BANCO ficou depois do gesto */
let estado: { categoriaNome: string | null; isCardPayment: boolean; ehParcelaEmprestimo: boolean; ignorada: boolean }
/** as contas a pagar do cenário: id → nome da categoria (null = a conta não tem) */
let contas: Record<string, string | null>

beforeEach(() => {
  estado = { categoriaNome: null, isCardPayment: false, ehParcelaEmprestimo: false, ignorada: false }
  contas = {}
})

/** ⭐ a MESMA pergunta do Fluxo de Caixa, sobre a linha que o gesto deixou pra trás */
function linhaTemNome(): boolean {
  const l = {
    categoriaNome: estado.categoriaNome, isCardPayment: estado.isCardPayment,
    ehParcelaEmprestimo: estado.ehParcelaEmprestimo,
  } as unknown as LinhaFluxo
  return rotularLinha(l).rotulo !== CAT_SEM
}

const CATEGORIAS: Record<string, string> = { cat_mp: 'Matéria-Prima - Alimentos', cat_venda: 'Receita de Vendas' }

/** db duck-typed: só o que o resolver toca, com o efeito visível no `estado` */
const db = {
  transaction: {
    findFirst: async ({ where }: { where: { id: string } }) =>
      where.id === 'linha_saida'
        ? { id: 'linha_saida', type: 'DEBIT', amount: 200, date: new Date('2026-09-17'), bankAccountId: 'b1', categoryId: null, ignoredAt: null }
        : { id: 'linha_entrada', type: 'CREDIT', amount: 200, date: new Date('2026-09-17'), bankAccountId: 'b1', categoryId: null, ignoredAt: null },
    update: async ({ data }: { data: { categoryId?: string; ignoredAt?: Date } }) => {
      if (data.categoryId) estado.categoriaNome = CATEGORIAS[data.categoryId] ?? 'categoria'
      if (data.ignoredAt) estado.ignorada = true
      return {}
    },
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.filter((id) => contas[id] == null).map((id) => ({ id, description: 'ELIANE GARCIA' })),
    updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { categoryId: string } }) => {
      for (const id of where.id.in) contas[id] = CATEGORIAS[data.categoryId] ?? 'categoria'
      return { count: where.id.in.length }
    },
  },
} as never

async function resolver(acao: string, alvo: Record<string, unknown> = {}, txId = 'linha_saida') {
  const { resolverLinha } = await import('@/lib/conciliacao/resolver-linha')
  return resolverLinha({ companyId: 'emp', txId, userId: 'u1', acao, ...alvo } as never, db)
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('⛔⛔⛔ toda linha que SAI da caixa termina com nome', () => {
  it('⭐ despesa avulsa: o chip de categoria grava e a linha tem nome', async () => {
    const r = await resolver('CATEGORIA', { categoryId: 'cat_mp' })
    expect(r.saiuDaCaixa).toBe(true)
    expect(linhaTemNome(), 'a linha saiu da caixa como A CLASSIFICAR').toBe(true)
  })

  it('⭐ casar com conta a pagar: HERDA a categoria da conta', async () => {
    contas['conta_1'] = 'Matéria-Prima - Alimentos'
    const r = await resolver('CASAR_PAGAR', { contaIds: ['conta_1'] })
    expect(r.saiuDaCaixa).toBe(true)
    expect(estado.categoriaNome).toBe('Matéria-Prima - Alimentos')
    expect(linhaTemNome()).toBe(true)
  })

  it('⛔⛔ conta SEM categoria: o confirmar PERGUNTA em vez de deixar passar', async () => {
    contas['conta_eliane'] = null
    await expect(resolver('CASAR_PAGAR', { contaIds: ['conta_eliane'] }))
      .rejects.toMatchObject({ code: 'PEDE_CATEGORIA' })
    // ⛔ e NADA foi conciliado — a linha continua na caixa esperando a resposta
    expect(estado.categoriaNome).toBeNull()
  })

  it('⭐⭐ e a resposta grava NA CONTA — a próxima do mesmo fornecedor já vem com ela', async () => {
    contas['conta_eliane'] = null
    const r = await resolver('CASAR_PAGAR', { contaIds: ['conta_eliane'], categoryId: 'cat_mp' })
    expect(r.saiuDaCaixa).toBe(true)
    expect(contas['conta_eliane'], 'gravou só na linha do banco — a conta continua órfã')
      .toBe('Matéria-Prima - Alimentos')
    expect(linhaTemNome()).toBe(true)
  })

  it('⭐ fatura de cartão: a categoria é ESTRUTURAL (o vínculo com o cartão)', async () => {
    const r = await resolver('PGTO_CARTAO', { cardId: 'card1' })
    expect(r.saiuDaCaixa).toBe(true)
    expect(rotularLinha({ categoriaNome: null, isCardPayment: true } as unknown as LinhaFluxo))
      .toMatchObject({ rotulo: 'Fatura de cartão (paga)', sintetico: true })
    expect(linhaTemNome()).toBe(true)
  })

  it('⭐ parcela de empréstimo: idem — quem dá o nome é o vínculo com a parcela', async () => {
    const r = await resolver('PARCELA_EMPRESTIMO', { loanId: 'l1', installmentNumber: 3 })
    expect(r.saiuDaCaixa).toBe(true)
    expect(linhaTemNome()).toBe(true)
  })

  it('⭐ estorno e recebimento de venda também terminam com nome', async () => {
    await resolver('ESTORNO', { categoryId: 'cat_mp' }, 'linha_entrada')
    expect(linhaTemNome()).toBe(true)
    estado.categoriaNome = null
    await resolver('RECEBIMENTO_VENDA', { categoryId: 'cat_venda' }, 'linha_entrada')
    expect(linhaTemNome()).toBe(true)
  })

  /**
   * ⛔ IGNORAR é a ÚNICA saída sem categoria — e é legítima: ela não vira movimentação,
   * sai das filas (`ignoredAt`) e é reversível. Exigir categoria de uma linha que o dono
   * disse "isso não é pra cá" seria cobrar classificação do que ele já classificou como
   * nada.
   */
  it('⛔ IGNORAR é a exceção NOMEADA — some das filas, não vira movimentação', async () => {
    const r = await resolver('IGNORAR')
    expect(r.saiuDaCaixa).toBe(true)
    expect(estado.ignorada).toBe(true)
    expect(estado.categoriaNome).toBeNull()
  })

  it('⛔ nenhum gesto grava categoria vazia — sem alvo, a recusa ENSINA', async () => {
    for (const acao of ['CATEGORIA', 'RECEBIMENTO_VENDA', 'ESTORNO']) {
      await expect(resolver(acao, {}, 'linha_entrada')).rejects.toThrow(ResolverError)
    }
    expect(estado.categoriaNome).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('⭐ e a TELA oferece onde responder — recusa sem gesto é porta pintada', () => {
  const t = readFileSync(join(process.cwd(), 'components/conciliacao/caixa-de-entrada.tsx'), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⭐ o code PEDE_CATEGORIA abre o chip na linha, não um texto vermelho', () => {
    expect(t, 'a recusa vira erro morto — o dono lê "diga qual é" e não tem onde dizer')
      .toMatch(/PEDE_CATEGORIA'\)?\s*\{?\s*[\s\S]{0,160}setPedeCategoria/)
    expect(t).toMatch(/pedeCategoria\?\.linha\.id === l\.id/)
  })

  it('⭐⭐ e a escolha REENVIA O MESMO GESTO — nenhum caminho novo de gravação', () => {
    expect(t).toMatch(/gesto\(l, pedeCategoria\.acao, \{ \.\.\.pedeCategoria\.alvo, categoryId: id \}\)/)
  })
})
