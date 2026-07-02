// Sprint Despesas-PF (02/07/2026) — blindagem.
//
// Cobre 5 grupos:
// (a) Backend: getPersonalExpenseBreakdown filtra type=DEBIT + isInvoicePayment=false
// (b) Backend: cashflow calcula entrou/saiu/sobrou + bônus PJ vs próprio
// (c) Backend: recategorizar endpoint com OWNER guard
// (d) UI: page.tsx renderiza DespesasPFClient
// (e) Sidebar: item "Despesas" pra PF workspace

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Backend — breakdown com anti-duplicação', () => {
  const p = 'lib/dashboard-pf/expenses-breakdown.ts'
  it('existe', () => expect(existsSync(root(p))).toBe(true))
  const code = read(p)

  it('regra anti-duplicação: type=DEBIT + isInvoicePayment=false', () => {
    expect(code).toMatch(/type:\s*['"]DEBIT['"]/)
    expect(code).toMatch(/isInvoicePayment:\s*false/)
  })

  it('NÃO envolve em unstable_cache (lição Fix-Cache-Despesas)', () => {
    // Não deve invocar unstable_cache nem importar de next/cache.
    expect(code).not.toMatch(/unstable_cache\(/)
    expect(code).not.toMatch(/from\s+['"]next\/cache['"]/)
  })

  it('groupBy categoryId + agrega _sum/_count', () => {
    expect(code).toMatch(/prisma\.personalTransaction\.groupBy/)
    expect(code).toMatch(/by:\s*\[['"]categoryId['"]\]/)
  })

  it('sourceFilter: card / account / both — coerção de creditCardId', () => {
    expect(code).toMatch(/sourceFilter\s*===\s*['"]card['"]/)
    expect(code).toMatch(/sourceFilter\s*===\s*['"]account['"]/)
    expect(code).toMatch(/where\.creditCardId\s*=\s*\{\s*not:\s*null\s*\}/)
  })

  it('onlyBridgeSpend filtra bridgeAsSpend não-null', () => {
    expect(code).toMatch(/bridgeAsSpend:\s*\{\s*isNot:\s*null\s*\}/)
  })

  it('variação vs mês anterior: threshold ±15%', () => {
    expect(code).toMatch(/VARIACAO_THRESHOLD\s*=\s*0\.15/)
    expect(code).toMatch(/tendencia\s*=\s*['"]subiu['"]/)
    expect(code).toMatch(/tendencia\s*=\s*['"]caiu['"]/)
    expect(code).toMatch(/tendencia\s*=\s*['"]nova['"]/)
  })

  it('include bridgeAsSpend nas transactions do drill-down', () => {
    expect(code).toMatch(/bridgeAsSpend:\s*\{[\s\S]{0,300}pjTransaction/)
  })
})

describe('b) Backend — cashflow (entrou/saiu/sobrou + PJ vs próprio)', () => {
  const code = read('lib/dashboard-pf/expenses-breakdown.ts')

  it('função getPersonalCashFlow existe', () => {
    expect(code).toMatch(/export async function getPersonalCashFlow/)
  })

  it('entrou = CREDIT total', () => {
    expect(code).toMatch(/type:\s*['"]CREDIT['"]/)
  })

  it('entrou_bridge = filtro bridge isNot null', () => {
    expect(code).toMatch(/bridge:\s*\{\s*isNot:\s*null\s*\}/)
  })

  it('saiu SEMPRE exclui isInvoicePayment=true (senão duplicaria)', () => {
    // Todas as 3 aggregates de DEBIT devem filtrar isInvoicePayment: false
    const block = code.match(/export async function getPersonalCashFlow[\s\S]+?^\}/m)?.[0] ?? ''
    const debitBlocks = block.match(/type:\s*['"]DEBIT['"]/g) ?? []
    expect(debitBlocks.length).toBeGreaterThanOrEqual(2)
    const invoicePaymentGuards = block.match(/isInvoicePayment:\s*false/g) ?? []
    expect(invoicePaymentGuards.length).toBe(debitBlocks.length)
  })

  it('sobrou = entrou - saiu', () => {
    expect(code).toMatch(/sobrou:\s*entrou\s*-\s*saiu/)
  })
})

describe('c) Backend — endpoints com OWNER guard', () => {
  it('POST recategorizar exige OWNER', () => {
    const code = read('app/api/perfis/[id]/despesas/recategorizar/route.ts')
    expect(code).toMatch(/checkProfileAccess\(ctx\.user\.id,\s*profileId,\s*['"]OWNER['"]\)/)
    expect(code).toMatch(/classifiedBy:\s*['"]MANUAL['"]/)
    expect(code).toMatch(/aiConfidence:\s*input\.novaCategoriaId\s*\?\s*1\.0/)
    // Multi-tenant guard: where inclui profileId
    expect(code).toMatch(/where:\s*\{\s*id:\s*\{\s*in:\s*ownedIds\s*\},\s*profileId\s*\}/)
  })

  it('GET breakdown default é mês atual', () => {
    const code = read('app/api/perfis/[id]/despesas/route.ts')
    expect(code).toMatch(/checkProfileAccess\(ctx\.user\.id,\s*profileId,\s*['"]OWNER['"]\)/)
    // Default periodo = mês atual
    expect(code).toMatch(/getUTCMonth\(\),\s*1/)
    expect(code).toMatch(/getUTCMonth\(\)\s*\+\s*1,\s*1/)
  })

  it('GET transacoes suporta categoryId=null (bucket Sem categoria)', () => {
    const code = read('app/api/perfis/[id]/despesas/transacoes/route.ts')
    expect(code).toMatch(/categoryIdRaw\s*===\s*['"]null['"]/)
  })
})

describe('d) UI — page + client existem', () => {
  it('page.tsx é wrapper client', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/page.tsx')
    expect(code).toMatch(/DespesasPFClient/)
    expect(code).toMatch(/'use client'/)
  })

  it('client tem botão "+ Nova despesa" visível', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx')
    expect(code).toMatch(/Nova despesa/)
    expect(code).toMatch(/setShowNovaModal/)
    expect(code).toMatch(/NovaDespesaModal/)
  })

  it('Hero com entrou/saiu/sobrou + PJ vs próprio', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx')
    expect(code).toMatch(/Entrou/)
    expect(code).toMatch(/Saiu/)
    expect(code).toMatch(/Sobrou/)
    expect(code).toMatch(/retiradas PJ/)
    expect(code).toMatch(/outras rendas/)
  })

  it('marcador "Retirada PJ" na linha da tx', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx')
    expect(code).toMatch(/tx\.bridgeSpend/)
    expect(code).toMatch(/Retirada PJ/)
  })

  it('filtros: período + toggle Cartão/Conta/Ambos + só retiradas + busca', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx')
    expect(code).toMatch(/sourceFilter/)
    expect(code).toMatch(/onlyBridgeSpend/)
    expect(code).toMatch(/Só retiradas/)
    expect(code).toMatch(/Buscar descrição/)
  })

  it('recategorizar via CategoryCombobox com refresh real-time', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx')
    expect(code).toMatch(/recategorize\(/)
    expect(code).toMatch(/void reload\(\)/)
  })

  it('variação/tendência: subiu/caiu/nova/estável', () => {
    const code = read('app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx')
    expect(code).toMatch(/tendencia === 'subiu'/)
    expect(code).toMatch(/tendencia === 'caiu'/)
    expect(code).toMatch(/tendencia === 'nova'/)
    expect(code).toMatch(/vs mês anterior/)
  })
})

describe('e) Sidebar — Despesas PF adicionado', () => {
  const code = read('components/sidebar/global-sidebar.tsx')

  it('item Despesas condicional pra workspaceType=pf + currentProfileId', () => {
    expect(code).toMatch(
      /workspaceType\s*===\s*['"]pf['"]\s*&&\s*currentProfileId[\s\S]{0,600}\/perfis\/\$\{currentProfileId\}\/despesas/,
    )
  })

  it('isActive detecta /perfis/[id]/despesas', () => {
    expect(code).toMatch(/\/\^\\\/perfis\\\/\[\^\/\]\+\\\/despesas/)
  })
})
