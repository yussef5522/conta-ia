// ⛔⛔⛔ "NÃO CONSEGUI CARREGAR." NO CLIQUE DO VERDE (20/09/2026)
//
// **O dono:** *"clico «✓ Confirmar — concilia a eliane» e aparece só «Não consegui
// carregar.» — sem motivo, sem «tentar de novo», e não sei nem O QUE falhou (o painel? a
// conciliação em si? gravou ou não?)."*
//
// **MEDIDO NA ROTA REAL, com a sessão dele:**
// ```
// POST /api/conciliacao/resolver → HTTP 500 · content-type: null · corpo: (vazio)
// ```
// O `fetchComTimeout` lê `{erro}` do corpo; **sem corpo**, cai no fallback genérico. Daí a
// frase que não diz nada.
//
// ⛔⛔ **A CAUSA É MINHA, DE ONTEM:** o `CASAR_PAGAR` chamava
// `reconcileTransactions(input, { userId, companyId } as never)` — e o reconcile usa
// **`ctx.company?.id`** e **`ctx.requirePermission()`**, que aquele objeto não tem. ***O
// `as never` calou o compilador*** e o gesto estourava em runtime. É literalmente a lição
// de 19/09 escrita neste repo — *"cast que cala o compilador é o lugar onde o contrato
// incompleto se esconde"* — cometida por mim no dia seguinte.
//
// ⚠️⚠️ **E OS MEUS TESTES DE ONTEM PASSARAM VERDES PORQUE MOCKAVAM O RECONCILE.** O mock
// aceita qualquer coisa: ele substituiu justamente a peça que cobra o contrato. ***Guard que
// troca a peça não prova o encaixe dela*** — por isso o teste daqui, em vez de ignorar o
// segundo argumento, **exige que ele seja um AuthContext de verdade**.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResolverError } from '@/lib/conciliacao/resolver-linha'

/** o que o reconcile REALMENTE usa do ctx — se faltar, ele estoura em runtime */
let ctxRecebido: unknown = null
let reconcileVaiFalhar: 'NAO' | 'DOMINIO' | 'INESPERADO' = 'NAO'

vi.mock('@/lib/conciliacao/reconcile', () => ({
  ReconciliationError: class ReconciliationError extends Error {
    constructor(public readonly reason: string, public readonly status = 422) { super(reason); this.name = 'ReconciliationError' }
  },
  reconcileTransactions: vi.fn(async (_input: unknown, ctx: { company?: { id?: string }; requirePermission?: unknown }) => {
    ctxRecebido = ctx
    // ⭐ o reconcile de verdade faz EXATAMENTE isto — o mock honra o contrato
    if (!ctx?.company?.id) throw new Error('Contexto de autenticação não corresponde à empresa')
    if (typeof ctx.requirePermission !== 'function') throw new TypeError('ctx.requirePermission is not a function')
    if (reconcileVaiFalhar === 'DOMINIO') {
      const { ReconciliationError } = await import('@/lib/conciliacao/reconcile')
      throw new ReconciliationError('Transação OFX já conciliada')
    }
    if (reconcileVaiFalhar === 'INESPERADO') throw new TypeError('quebrou no meio')
  }),
}))
vi.mock('@/lib/credit-card-pj/casar-pagamento', () => ({ CasarPagamentoError: class extends Error {}, casarPagamentoDeCartao: vi.fn() }))
vi.mock('@/lib/loans/vincular-pagamento', () => ({ VinculoDeParcelaError: class extends Error {}, vincularPagamentoDeParcela: vi.fn() }))
vi.mock('@/lib/vendas/recompute-hook', () => ({ recomputeVendasSeVenda: vi.fn(async () => {}) }))

/** as contas a pagar do cenário: id → categoryId (null = a conta não tem) */
let contas: Record<string, string | null>

const db = {
  transaction: {
    findFirst: async () => ({ id: 'linha', type: 'DEBIT', amount: 200, date: new Date('2026-09-17'), bankAccountId: 'b1', categoryId: null, ignoredAt: null }),
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.filter((id) => contas[id] === null).map((id) => ({ id, description: 'eliane ' })),
    updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { categoryId: string | null } }) => {
      for (const id of where.id.in) contas[id] = data.categoryId
      return { count: where.id.in.length }
    },
    update: async () => ({}),
  },
} as never

/** ⭐ o AuthContext REAL — a forma que a rota entrega */
const CTX_BOM = { user: { id: 'u1', name: 'Yussef', email: 'y@x.com' }, company: { id: 'emp' }, permissions: ['*'], requirePermission: () => {} }

async function resolver(extra: Record<string, unknown>) {
  const { resolverLinha } = await import('@/lib/conciliacao/resolver-linha')
  return resolverLinha({ companyId: 'emp', txId: 'linha', acao: 'CASAR_PAGAR', userId: 'u1', contaIds: ['conta1'], ...extra } as never, db)
}

beforeEach(() => { ctxRecebido = null; reconcileVaiFalhar = 'NAO'; contas = { conta1: 'cat_ja_tinha' } })

// ═══════════════════════════════════════════════════════════════════════════════
describe('⛔⛔⛔ o CASAR entrega um AuthContext de verdade ao reconcile', () => {
  it('⭐ o caso da ELIANE: com o ctx real, o gesto CONCILIA', async () => {
    const r = await resolver({ authCtx: CTX_BOM })
    expect(r.saiuDaCaixa).toBe(true)
    expect(r.efeito).toContain('conciliada')
  })

  it('⭐⭐ e o ctx que chega no reconcile tem company.id E requirePermission', () => {
    // (o `it` acima já chamou; aqui é a asserção sobre o CONTRATO)
    return resolver({ authCtx: CTX_BOM }).then(() => {
      const c = ctxRecebido as { company?: { id?: string }; requirePermission?: unknown }
      expect(c?.company?.id, 'era `{userId, companyId} as never` — e o reconcile lê company.id').toBe('emp')
      expect(typeof c?.requirePermission, 'sem isso o reconcile estoura TypeError em runtime').toBe('function')
    })
  })

  it('⛔ sem contexto, a recusa ENSINA (422 com corpo) em vez de estourar 500 mudo', async () => {
    await expect(resolver({})).rejects.toMatchObject({ code: 'CONTEXTO_INCOMPLETO' })
    await expect(resolver({ authCtx: { userId: 'u1', companyId: 'emp' } })).rejects.toBeInstanceOf(ResolverError)
  })
})

describe('⛔⛔ NADA GRAVA PELA METADE — a categoria aprendida é compensada', () => {
  it('⭐ conta sem categoria + reconcile FALHA → a categoria volta a null', async () => {
    contas = { conta1: null }
    reconcileVaiFalhar = 'DOMINIO'
    await expect(resolver({ authCtx: CTX_BOM, categoryId: 'cat_nova' })).rejects.toBeInstanceOf(ResolverError)
    expect(contas.conta1, 'a conta ficou categorizada sem a conciliação ter acontecido — meia-gravação')
      .toBeNull()
  })

  it('⭐ e quando o reconcile PASSA, a categoria aprendida FICA na conta', async () => {
    contas = { conta1: null }
    await resolver({ authCtx: CTX_BOM, categoryId: 'cat_nova' })
    expect(contas.conta1).toBe('cat_nova')
  })

  it('⭐⭐ a recusa do reconcile vira frase que DIZ o que falhou', async () => {
    reconcileVaiFalhar = 'DOMINIO'
    await expect(resolver({ authCtx: CTX_BOM })).rejects.toMatchObject({
      code: 'RECONCILE_RECUSOU',
      message: expect.stringContaining('A conciliação não gravou'),
    })
  })

  it('⛔ e o inesperado continua subindo — ali o genérico é honesto', async () => {
    reconcileVaiFalhar = 'INESPERADO'
    await expect(resolver({ authCtx: CTX_BOM })).rejects.toBeInstanceOf(TypeError)
  })
})

describe('⭐ a ROTA nunca mais devolve 500 sem corpo, e a TELA tem saída', () => {
  const fonte = (arq: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), arq), 'utf-8')

  it('⛔ o `throw e` mudo morreu — o inesperado responde JSON', () => {
    const r = fonte('app/api/conciliacao/resolver/route.ts')
    expect(r, 'voltou o throw solto — o Next devolve HTML e a tela cai no genérico')
      .not.toMatch(/^\s*throw e\s*$/m)
    expect(r).toMatch(/code: 'FALHA_INESPERADA'/)
    expect(r, 'o ctx real precisa chegar na lib').toMatch(/authCtx: ctx/)
  })

  it('⭐ e o cartão da linha oferece "tentar de novo" com o MESMO gesto', () => {
    const t = fonte('components/conciliacao/caixa-de-entrada.tsx')
    expect(t).toMatch(/onTentarDeNovo/)
    expect(t, 'o retry tem que repetir a ação e o alvo, não recarregar a tela')
      .toMatch(/const e = erroDaLinha; void gesto\(l, e\.acao, e\.alvo\)/)
    expect(t, 'a frase genérica do helper não pode chegar crua na tela')
      .toMatch(/r\.erro !== 'Não consegui carregar\.'/)
  })
})
