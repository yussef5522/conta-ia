// ⛔⛔⛔ "EU NÃO LEMBRO DE TER APAGADO" — A LIXEIRA (20/09/2026)
//
// **Medido em prod, 30 dias de auditoria:**
// ```
// 02/09  1 · nura     ·  09/09  4 · Yussef  ·  13/09 26 · Yussef (TODAS às 19:09)  ·  14/09  1
// ```
// As 26 saíram pelo `source: "contas-a-pagar DELETE"`, **todas do mesmo fornecedor**, e o
// DELETE é **um por vez com dialog de confirmação** — não existe ação em massa. Foram 26
// cliques confirmados num minuto: faxina de duplicata, o tipo de gesto que não fica na
// memória como *"apaguei contas"*.
//
// ⛔ **O defeito não era o delete — era não ter onde VER.** A auditoria guardava; nenhuma
// tela lia.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*--.*$/gm, '')

function usosDe(src: string, simbolo: string): number {
  return src.split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

describe('⭐⭐ o DELETE guarda o bastante pra DESFAZER', () => {
  const r = fonte('app/api/contas-a-pagar/[id]/route.ts')

  it('⛔ o retrato inteiro da linha — sem isso restaurar é redigitar', () => {
    for (const campo of ['supplierId', 'dueDate', 'categoryId', 'competenceDate']) {
      expect(r, `o DELETE parou de guardar ${campo} — a lixeira não consegue restaurar`).toMatch(new RegExp(`${campo}: tx\\.`))
    }
  })

  it('⭐⭐ e AVISA O ESTOQUE (o conserto do F2, na origem)', () => {
    expect(usosDe(r, 'avisarEstoqueQueContaFoiRemovida'), 'a amarra volta a virar órfã sem explicação').toBeGreaterThan(0)
    // ⚠️ fail-soft: o estoque não pode derrubar um gesto do financeiro
    expect(r).toMatch(/try \{[\s\S]{0,200}avisarEstoqueQueContaFoiRemovida[\s\S]{0,120}catch/)
  })
})

describe('⛔⛔ o F2 cala com EXPLICAÇÃO, nunca por perder a evidência', () => {
  const j = fonte('lib/stock/ponte-invariants.ts')

  it('⭐ a órfã explicada sai do alarme', () => {
    expect(j).toMatch(/!existentes\.has\(l\.transactionId\) && !explicadas\.has\(l\.id\)/)
  })

  it('⛔ mas a AMARRA continua existindo — apagá-la faria a nota ser reenviada', () => {
    const l = fonte('lib/stock/ponte/conta-removida.ts')
    expect(l, 'apagar a amarra some com a prova de que a nota já foi').not.toMatch(/stockPayableLink\.delete/)
    expect(l).toMatch(/stockContaRemovida\.upsert/)
  })

  it('⭐ e a migration é CREATE-only, com unique por amarra', () => {
    const m = fonte('prisma/migrations/20260920010000_stock_conta_removida/migration.sql')
    expect(m).not.toMatch(/ALTER TABLE|DROP TABLE/)
    expect(m).toMatch(/CREATE UNIQUE INDEX .*payableLinkId/)
  })
})

describe('⭐⭐ a lixeira LÊ a auditoria — nenhuma segunda fonte nasceu', () => {
  const l = fonte('lib/contas-pagar/lixeira.ts')

  it('⛔ nada de tabela de lixeira: ela seria uma 2ª verdade do mesmo fato', () => {
    expect(l).toMatch(/auditLog\.findMany/)
    expect(l, 'uma cópia da conta apagada divergiria do audit no 1º caso de borda')
      .not.toMatch(/model .*Lixeira|contaRemovida\.create/)
  })

  it('⭐ restaurar passa pela PORTA ÚNICA de criação', () => {
    expect(l).toMatch(/createContaPendente/)
    expect(l, 'restaurar não pode reafirmar que a conta foi paga').toMatch(/bankAccountId: null/)
  })

  it('⛔ e sem vencimento ela RECUSA ensinando — data inventada é pior que recusa', () => {
    expect(l).toMatch(/RestaurarError/)
    expect(l).toMatch(/Diga a data de vencimento/)
  })

  it('⭐ a duplicata é por fornecedor+valor+vencimento, NUNCA pela descrição', () => {
    const f = l.slice(l.indexOf('export async function parecidasComARemovida'))
    expect(f).toMatch(/supplierId: r\.fornecedorId/)
    expect(f).toMatch(/amount: \{ gte: r\.valor/)
    expect(f, 'a conta recriada à mão quase nunca tem a mesma descrição da que veio da nota')
      .not.toMatch(/description: \{ contains/)
  })
})

describe('⭐ a tela existe e tem PORTA', () => {
  it('⛔ o link mora no Contas a Pagar e não depende de haver algo removido', () => {
    const t = fonte('app/(dashboard)/contas-a-pagar/page.tsx')
    expect(t, 'porta escondida atrás de contador é a lição de 12/09').toMatch(/\/contas-a-pagar\/removidas/)
    expect(t).not.toMatch(/removidas.*&&.*\/contas-a-pagar\/removidas/)
  })

  it('⭐ a tela mostra quando/quem/caminho e avisa a duplicata ANTES do clique', () => {
    const t = fonte('app/(dashboard)/contas-a-pagar/removidas/page.tsx')
    expect(t).toMatch(/quando, quem e por onde/)
    expect(t).toMatch(/já existe conta parecida — restaurar criaria duas/)
    // ⛔ falha de carga nunca vira "nada foi removido"
    expect(t).toMatch(/isso não quer dizer que nada foi removido/)
  })

  it('⛔ e a restauração antiga PEDE o vencimento em vez de inventar', () => {
    expect(fonte('app/(dashboard)/contas-a-pagar/removidas/page.tsx')).toMatch(/!r\.vencimento && \(/)
  })
})
