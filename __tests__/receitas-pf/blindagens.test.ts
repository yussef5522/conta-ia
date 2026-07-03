// Sprint Receitas-PF (02/07/2026) — blindagem.
//
// Cobre 5 grupos:
// (a) Backend: income-breakdown filtra type=CREDIT + originFilter bridge|externa|both
// (b) Backend: include bridge.pjTransaction.bankAccount.company (selo de empresa)
// (c) Backend: endpoints /receitas + /receitas/transacoes com OWNER guard
// (d) UI: hero com "% que veio da empresa" + cores tendência INVERTIDAS
// (e) Sidebar: item "Receitas" pra PF workspace

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Backend — income-breakdown com filtros', () => {
  const p = 'lib/dashboard-pf/income-breakdown.ts'
  it('existe', () => expect(existsSync(root(p))).toBe(true))
  const code = read(p)

  it('filtro base type=CREDIT', () => {
    expect(code).toMatch(/type:\s*['"]CREDIT['"]/)
  })

  it('NÃO filtra isInvoicePayment no where (só receita — só aplica pra despesa)', () => {
    // Não usa como filtro. O comentário do arquivo pode citar o nome (ex: "SEM isInvoicePayment").
    expect(code).not.toMatch(/isInvoicePayment:\s*(true|false)/)
    expect(code).not.toMatch(/where[\s\S]{0,50}isInvoicePayment/)
  })

  it('NÃO envolve em unstable_cache (lição Fix-Cache-Despesas)', () => {
    expect(code).not.toMatch(/unstable_cache\(/)
    expect(code).not.toMatch(/from\s+['"]next\/cache['"]/)
  })

  it('originFilter bridge / externa / both', () => {
    expect(code).toMatch(/originFilter\s*===\s*['"]bridge['"]/)
    expect(code).toMatch(/originFilter\s*===\s*['"]externa['"]/)
    // 'bridge' filter usa bridge: { isNot: null } (Prettier pode quebrar linha)
    expect(code).toMatch(/where\.bridge\s*=\s*\{\s*isNot:\s*null\s*\}/)
    // 'externa' filter usa bridge: null
    expect(code).toMatch(/where\.bridge\s*=\s*null/)
  })

  it('groupBy categoryId + variação vs mês anterior', () => {
    expect(code).toMatch(/prisma\.personalTransaction\.groupBy/)
    expect(code).toMatch(/by:\s*\[['"]categoryId['"]\]/)
    expect(code).toMatch(/VARIACAO_THRESHOLD\s*=\s*0\.15/)
  })

  it('tendência: subiu/caiu/estavel/nova (semântica de receita)', () => {
    expect(code).toMatch(/tendencia\s*=\s*['"]subiu['"]/)
    expect(code).toMatch(/tendencia\s*=\s*['"]caiu['"]/)
    expect(code).toMatch(/tendencia\s*=\s*['"]nova['"]/)
  })
})

describe('b) Backend — include bridge.pjTransaction.bankAccount.company', () => {
  const code = read('lib/dashboard-pf/income-breakdown.ts')

  it('drill-down inclui caminho até company', () => {
    const drillFn = code.match(/getPersonalIncomeTransactions[\s\S]+?^\}/m)?.[0] ?? ''
    expect(drillFn).toMatch(/bridge:\s*\{[\s\S]{0,600}pjTransaction/)
    expect(drillFn).toMatch(/bankAccount:\s*\{[\s\S]{0,200}company/)
    expect(drillFn).toMatch(/tradeName/)
  })

  it('mapeamento tx.origem = { bridgeId, kind, empresaId, empresaName, pjDescription, pjDate }', () => {
    expect(code).toMatch(/origem:\s*PersonalIncomeTransactionItem\['origem'\]\s*=\s*null/)
    expect(code).toMatch(/empresaName:\s*empresa\?\.tradeName\s*\?\?\s*empresa\?\.name/)
  })
})

describe('c) Backend — endpoints com OWNER guard', () => {
  it('GET /receitas usa checkProfileAccess OWNER e reusa getPersonalCashFlow', () => {
    const code = read('app/api/perfis/[id]/receitas/route.ts')
    expect(code).toMatch(/checkProfileAccess\(ctx\.user\.id,\s*profileId,\s*['"]OWNER['"]\)/)
    expect(code).toMatch(/getPersonalIncomeBreakdown/)
    expect(code).toMatch(/getPersonalCashFlow/)
  })

  it('GET /receitas/transacoes suporta categoryId=null', () => {
    const code = read('app/api/perfis/[id]/receitas/transacoes/route.ts')
    expect(code).toMatch(/checkProfileAccess\(ctx\.user\.id,\s*profileId,\s*['"]OWNER['"]\)/)
    expect(code).toMatch(/categoryIdRaw\s*===\s*['"]null['"]/)
  })

  it('NÃO cria endpoint recategorizar duplicado (reusa o de despesas)', () => {
    // Não deve haver /api/perfis/[id]/receitas/recategorizar
    const p = 'app/api/perfis/[id]/receitas/recategorizar/route.ts'
    expect(existsSync(root(p))).toBe(false)
    // Cliente chama o endpoint de despesas
    const clientCode = read('app/(dashboard)/perfis/[id]/receitas/receitas-pf-client.tsx')
    expect(clientCode).toMatch(/\/api\/perfis\/\$\{profileId\}\/despesas\/recategorizar/)
  })
})

describe('d) UI — hero "% empresa" + tendência INVERTIDA', () => {
  const code = read('app/(dashboard)/perfis/[id]/receitas/receitas-pf-client.tsx')

  it('hero mostra número heroi "Entrou este mês" grande', () => {
    expect(code).toMatch(/Entrou este mês/)
    expect(code).toMatch(/text-4xl.*tabular-nums/)
  })

  it('DIFERENCIAL: mostra "% que veio da empresa"', () => {
    expect(code).toMatch(/Renda que veio da empresa/)
    expect(code).toMatch(/pctPJ/)
    expect(code).toMatch(/entrouBridge\s*\/\s*entrou\s*\)\s*\*\s*100/)
  })

  it('quebra Retiradas PJ vs Outras rendas', () => {
    expect(code).toMatch(/Retiradas do PJ/)
    expect(code).toMatch(/Outras rendas/)
    expect(code).toMatch(/entrouOutros/)
  })

  it('cores da tendência INVERTIDAS (subiu=verde, caiu=vermelho)', () => {
    // Em receita: subiu é BOM (mais renda) → emerald
    // caiu é RUIM (menos renda) → rose
    expect(code).toMatch(
      /tendencia\s*===\s*['"]subiu['"][\s\S]{0,120}text-emerald/,
    )
    expect(code).toMatch(
      /tendencia\s*===\s*['"]caiu['"][\s\S]{0,120}text-rose/,
    )
  })

  it('selo "Retirada · {empresa} · {data}" nas tx com origem', () => {
    expect(code).toMatch(/tx\.origem/)
    expect(code).toMatch(/Retirada · /)
    expect(code).toMatch(/empresaName/)
  })

  it('selo "Renda própria" nas tx sem bridge', () => {
    expect(code).toMatch(/Renda própria/)
  })

  it('botão "+ Nova receita" visível', () => {
    expect(code).toMatch(/Nova receita/)
    expect(code).toMatch(/NovaReceitaModal/)
  })

  it('modal Nova Receita força type=CREDIT (sem toggle Conta/Cartão)', () => {
    expect(code).toMatch(/type:\s*['"]CREDIT['"]/)
    // Modal NÃO tem toggle source (só receita em conta bancária)
    const modalBlock = code.match(/function NovaReceitaModal[\s\S]+?^\}/m)?.[0] ?? ''
    expect(modalBlock).not.toMatch(/setSource/)
    expect(modalBlock).not.toMatch(/creditCardId/)
  })

  it('filtros: período + Todas/Retiradas PJ/Externas + busca', () => {
    expect(code).toMatch(/originFilter/)
    expect(code).toMatch(/Retiradas PJ/)
    expect(code).toMatch(/Externas/)
    expect(code).toMatch(/Buscar descrição/)
  })

  it('recategorizar via CategoryCombobox com refresh real-time', () => {
    expect(code).toMatch(/recategorize\(/)
    expect(code).toMatch(/void reload\(\)/)
  })
})

describe('e) Sidebar — item Receitas irmão do Despesas', () => {
  const code = read('components/sidebar/global-sidebar.tsx')

  it('item Receitas condicional workspaceType=pf + currentProfileId', () => {
    expect(code).toMatch(
      /workspaceType\s*===\s*['"]pf['"]\s*&&\s*currentProfileId[\s\S]{0,600}\/perfis\/\$\{currentProfileId\}\/receitas/,
    )
  })

  it('label "Receitas" com ícone TrendingUp', () => {
    // Bloco Receitas usa TrendingUp icon
    const receitasBlock = code.match(/label="Receitas"[\s\S]{0,300}icon=\{TrendingUp\}|icon=\{TrendingUp\}[\s\S]{0,300}label="Receitas"/)
    expect(receitasBlock).toBeTruthy()
  })

  it('isActive detecta /perfis/[id]/receitas', () => {
    expect(code).toMatch(/\/\^\\\/perfis\\\/\[\^\/\]\+\\\/receitas/)
  })
})
