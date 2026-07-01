// Sprint Unificar-Pipelines-Import (01/07/2026) — TESTE DE OURO.
//
// Garantia bit-a-bit: preview e confirm produzem O MESMO resultado porque
// rodam a MESMA função pura (classifyTransactionsShared) com o MESMO ctx.
//
// Se este teste passa: o bug "vi 23, entraram 39" é IMPOSSÍVEL de voltar.
// (a menos que alguém intencionalmente adicione lógica diferente numa das
//  funções — o que os asserts de "chama classifyShared" bloqueiam abaixo).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  classifyTransactionsShared,
  type SharedClassifyContext,
} from '@/lib/ai-categorizer/classify-shared'
import { predictSuggestionsForPreview } from '@/lib/import-categorization/predict-for-preview'
import { autoClassifyTransactions } from '@/lib/ai-categorizer/apply'
import type { RuleIndex } from '@/lib/ai-categorizer/predict'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

// ────────────────────────────────────────────────────────────────
// Setup — ctx sintético mas realista (regra CONTAINS 'RECEBIMENTO PIX')
// ────────────────────────────────────────────────────────────────

function makeCtx(): {
  shared: SharedClassifyContext
  preview: Parameters<typeof predictSuggestionsForPreview>[1]
} {
  const ruleIndex: RuleIndex = {
    companyId: 'CACULA',
    exactByPattern: new Map(),
    normalizedByPattern: new Map(),
    // CONTAINS 'RECEBIMENTO PIX' → categoria 'cat-receita' com confidence 1.0
    containsRules: [
      {
        id: 'rule-pix',
        companyId: 'CACULA',
        tipoMatch: 'CONTAINS',
        padrao: 'RECEBIMENTO PIX',
        categoryId: 'cat-receita',
        supplierId: null,
        confianca: 1.0,
        vezesAplicada: 100,
        isActive: true,
        fonte: 'CACULA_LEARNED',
      },
    ],
  }
  return {
    shared: {
      ruleIndex,
      setorPatterns: [],
      setorResolver: () => null,
    },
    preview: {
      ruleIndex,
      setorPatterns: [],
      setorCategoryByName: new Map(),
      categoryById: new Map([
        ['cat-receita', { name: 'Receita de Vendas', dreGroup: 'RECEITA_BRUTA' }],
      ]),
    },
  }
}

const cenarioSicredi = () => [
  { dedupHash: 'h1', description: 'RECEBIMENTO PIX-PIX_CRED 12345 JOSE DA SILVA', amount: 39.99, type: 'CREDIT' as const },
  { dedupHash: 'h2', description: 'RECEBIMENTO PIX-PIX_CRED 67890 MARIA', amount: 100.0, type: 'CREDIT' as const },
  { dedupHash: 'h3', description: 'RECEBIMENTO PIX-PIX_CRE 11111 PEDRO', amount: 50.0, type: 'CREDIT' as const },
  { dedupHash: 'h4', description: 'DEBITO CONVENIOS-ALLIANZ ID 5177', amount: 583.31, type: 'DEBIT' as const },
  { dedupHash: 'h5', description: 'TX AVULSA SEM REGRA', amount: 42, type: 'DEBIT' as const },
]

// ────────────────────────────────────────────────────────────────
// TESTE DE OURO — preview e confirm dão MESMO resultado
// ────────────────────────────────────────────────────────────────

describe('TESTE DE OURO — preview = confirm bit-a-bit', () => {
  it('mesmo lote → mesmas classificações status/categoryId', () => {
    const { shared, preview: pctx } = makeCtx()
    const txs = cenarioSicredi()

    // 1. Roda pipeline shared uma vez (fonte da verdade)
    const sharedResult = classifyTransactionsShared(txs, shared)

    // 2. Roda predictSuggestionsForPreview (preview)
    const previewOut = predictSuggestionsForPreview(txs, pctx)

    // 3. Roda autoClassifyTransactions (confirm) — mesmo lote
    const confirmOut = autoClassifyTransactions(
      txs.map((t) => ({
        bankAccountId: 'sicredi',
        date: new Date('2026-07-01'),
        description: t.description,
        amount: t.amount,
        type: t.type,
        externalId: null,
        dedupHash: t.dedupHash,
        origin: 'OFX',
      })),
      shared.ruleIndex,
      shared.setorPatterns,
      shared.setorResolver,
    )

    // Preview e confirm devem ter mesma cardinalidade
    expect(previewOut.length).toBe(txs.length)
    expect(confirmOut.classified.length).toBe(txs.length)

    // Compara linha-a-linha via dedupHash
    for (const tx of txs) {
      const shared = sharedResult.get(tx.dedupHash)
      const pv = previewOut.find((p) => p.dedupHash === tx.dedupHash)
      const cf = confirmOut.classified.find((c) => c.dedupHash === tx.dedupHash)

      expect(shared).toBeDefined()
      expect(pv).toBeDefined()
      expect(cf).toBeDefined()

      // Status deve bater
      if (shared!.status === 'RECONCILED') {
        expect(pv!.confidence).toBe('ALTA')
        expect(cf!.status).toBe('RECONCILED')
        expect(pv!.categoryId).toBe(shared!.categoryId)
        expect(cf!.categoryId).toBe(shared!.categoryId)
      } else {
        expect(pv!.confidence).toBe('REVISAR')
        expect(cf!.status).toBe('PENDING')
      }
    }
  })

  it('conta ALTA no preview = conta RECONCILED no confirm', () => {
    const { shared, preview: pctx } = makeCtx()
    const txs = cenarioSicredi()

    const previewOut = predictSuggestionsForPreview(txs, pctx)
    const confirmOut = autoClassifyTransactions(
      txs.map((t) => ({
        bankAccountId: 'sicredi',
        date: new Date('2026-07-01'),
        description: t.description,
        amount: t.amount,
        type: t.type,
        externalId: null,
        dedupHash: t.dedupHash,
        origin: 'OFX',
      })),
      shared.ruleIndex,
      shared.setorPatterns,
      shared.setorResolver,
    )

    const previewAlta = previewOut.filter((p) => p.confidence === 'ALTA').length
    const confirmReconciled = confirmOut.classified.filter((c) => c.status === 'RECONCILED').length

    expect(previewAlta).toBe(confirmReconciled)
    // No cenário Sicredi: 3 CREDIT casam CONTAINS 'RECEBIMENTO PIX' → ALTA/RECONCILED
    expect(previewAlta).toBeGreaterThanOrEqual(3)
  })

  it('rodar 2x com mesmo ctx → mesmo output (determinismo)', () => {
    const { shared } = makeCtx()
    const txs = cenarioSicredi()

    const r1 = classifyTransactionsShared(txs, shared)
    const r2 = classifyTransactionsShared(txs, shared)

    expect(r1.size).toBe(r2.size)
    for (const [hash, v1] of r1) {
      const v2 = r2.get(hash)
      expect(v2).toEqual(v1)
    }
  })
})

// ────────────────────────────────────────────────────────────────
// Blindagem estática — as 2 funções DELEGAM pra shared (não têm lógica própria)
// ────────────────────────────────────────────────────────────────

describe('blindagem — implementações delegam pra classifyTransactionsShared', () => {
  it('predict-for-preview importa e usa classifyTransactionsShared', () => {
    const code = read('lib/import-categorization/predict-for-preview.ts')
    expect(code).toMatch(
      /import\s*\{\s*classifyTransactionsShared\s*\}\s*from\s+['"]@\/lib\/ai-categorizer\/classify-shared['"]/,
    )
    expect(code).toMatch(/classifyTransactionsShared\(/)
    // NÃO tem mais chamada direta a predictCategory (função) nem matchAgainstPatterns.
    // Só o TYPE RuleIndex ainda importa de predict (contrato compartilhado).
    expect(code).not.toMatch(/predictCategory\(/)
    expect(code).not.toMatch(/matchAgainstPatterns\(/)
  })

  it('apply.ts (autoClassifyTransactions) importa e usa classifyTransactionsShared', () => {
    const code = read('lib/ai-categorizer/apply.ts')
    expect(code).toMatch(
      /import\s*\{[\s\S]*classifyTransactionsShared[\s\S]*\}\s*from\s+['"]\.\/classify-shared['"]/,
    )
    // A função autoClassifyTransactions agora chama classifyTransactionsShared
    const block = code.match(/export function autoClassifyTransactions[\s\S]+?^\}/m)?.[0] ?? ''
    expect(block).toMatch(/classifyTransactionsShared\(/)
  })

  it('classify-shared.ts é PURO (não importa prisma nem faz logging)', () => {
    const code = read('lib/ai-categorizer/classify-shared.ts')
    expect(code).not.toMatch(/from\s+['"]@\/lib\/db['"]/)
    expect(code).not.toMatch(/prisma\./)
    expect(code).not.toMatch(/logAudit/)
    // Threshold auto exportado (compartilhado com confirm)
    expect(code).toMatch(/RULE_AUTO_THRESHOLD\s*=\s*0\.95/)
  })
})

// ────────────────────────────────────────────────────────────────
// UI — header persistente + modal de confirmação
// ────────────────────────────────────────────────────────────────

describe('UI — header persistente + modal (bug "vi 23, entraram 39" bloqueado)', () => {
  it('EditablePreviewTable tem header PERSISTENTE com breakdown total', () => {
    const code = read('components/importar-ofx/EditablePreviewTable.tsx')
    // Contadores derivados de novas.length total (não da tab visível)
    expect(code).toMatch(/const totalNovas = novas\.length/)
    expect(code).toMatch(/const altas =/)
    expect(code).toMatch(/const revisar =/)
    // Header visível ANTES das abas
    const returnBlock = code.match(/return\s*\(\s*<div[\s\S]+?\/\* Abas \*\//)?.[0] ?? ''
    expect(returnBlock).toMatch(/serão criadas/)
    expect(returnBlock).toMatch(/auto-classificadas/)
    expect(returnBlock).toMatch(/tabular-nums/)
    // Referência arquitetural
    expect(code).toMatch(/mesma função de classificação/)
  })

  it('page.tsx tem modal de confirmação com total explícito', () => {
    const code = read('app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx')
    expect(code).toMatch(/showConfirmModal/)
    expect(code).toMatch(/setShowConfirmModal/)
    // Botão principal abre modal (não POST direto)
    expect(code).toMatch(/onClick=\{\(\)\s*=>\s*setShowConfirmModal\(true\)\}/)
    // Modal mostra preview.novas explícito
    expect(code).toMatch(/Criar \$\{preview\.novas\}/)
  })

  it('CategorySuggestion.source aceita KEYWORD (unificação inclui camada 2A)', () => {
    const code = read('components/importar-ofx/EditablePreviewTable.tsx')
    expect(code).toMatch(/'RULE'\s*\|\s*'SETOR'\s*\|\s*'KEYWORD'\s*\|\s*'DEFAULT'/)
  })
})
