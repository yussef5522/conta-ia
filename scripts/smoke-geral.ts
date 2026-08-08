// Smoke geral (08/08) — telas principais carregando + DRE jun/jul da caçula.
// Assina um auth_token do dono da caçula e bate nos endpoints REAIS. NUNCA imprime
// o token. Uso: DATABASE_URL=<prod> JWT_SECRET=<...> npx tsx scripts/smoke-geral.ts
// (rodar no servidor via loadEnvConfig pra pegar JWT_SECRET do .env)

import { PrismaClient } from '@prisma/client'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { signToken } from '../lib/auth'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://localhost:3001'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  const uc = await prisma.userCompany.findFirst({ where: { companyId: CO }, include: { user: true } })
  if (!uc) throw new Error('UserCompany da caçula não encontrado')
  const u = uc.user
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as any).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const pages: Array<[string, string]> = [
    ['Dashboard', '/dashboard'],
    ['Pendentes', `/empresas/${CO}/pendentes`],
    ['Movimentações', '/transacoes'],
    ['Empréstimos', `/empresas/${CO}/emprestimos`],
    ['Conciliação', '/conciliacao'],
    ['Transferências', `/empresas/${CO}/transferencias`],
    ['Relatórios', `/empresas/${CO}/relatorios`],
    ['DRE', `/empresas/${CO}/relatorios/dre-gerencial`],
  ]
  console.log('=== TELAS (200 = carrega) ===')
  for (const [nome, p] of pages) {
    try {
      const r = await fetch(BASE + p, { headers: { cookie }, redirect: 'manual' })
      console.log(`  ${r.status}  ${nome.padEnd(16)} ${p}`)
    } catch (e) { console.log(`  ERR  ${nome} ${(e as Error).message}`) }
  }

  for (const [label, s, e] of [['JUNHO', '2026-06-01', '2026-06-30'], ['JULHO', '2026-07-01', '2026-07-31']] as const) {
    const url = `${BASE}/api/empresas/${CO}/dre?startDate=${s}T00:00:00.000Z&endDate=${e}T23:59:59.999Z&regime=cash`
    const r = await fetch(url, { headers: { cookie } })
    console.log(`\n═══════ DRE ${label} (status ${r.status}) ═══════`)
    if (r.status !== 200) { console.log('  ', (await r.text()).slice(0, 240)); continue }
    const d = await r.json()
    const t = d.totals
    console.log(`  Receita Bruta:            ${brl(t.receitaBruta)}`)
    console.log(`  Resultado Operacional:    ${brl(t.resultadoOperacional)}`)
    console.log(`  Receitas Financeiras:     ${brl(t.receitasFinanceiras)}`)
    console.log(`  (-) Despesas Financeiras: ${brl(t.despesasFinanceiras)}`)
    console.log(`  Resultado Financeiro:     ${brl(t.resultadoFinanceiro)}`)
    console.log(`  Lucro Líquido:            ${brl(t.lucroLiquido)}`)
    const g = (d.groups as any[]).find((x) => x.group === 'DESPESAS_FINANCEIRAS')
    console.log(`  ── composição Despesas Financeiras (total ${brl(g?.total ?? 0)}) ──`)
    const cats = g?.categories ?? []
    if (cats.length === 0) console.log(`      [DEBUG g keys: ${Object.keys(g ?? {}).join(',')}] [total=${g?.total}]`)
    for (const c of cats) console.log(`      ${String(c.category?.name ?? c.category?.label ?? JSON.stringify(c.category)).padEnd(30)} ${brl(c.total)} ${c.children?.length ? '(+'+c.children.length+' filhos)' : ''}`)
    // loan encargos reinjetados (não-categoria): diferença total − Σcategorias
    const somaCats = cats.reduce((s: number, c: any) => s + (c.total ?? 0), 0)
    const reinjetado = Math.round((g?.total - somaCats) * 100) / 100
    if (Math.abs(reinjetado) > 0.01) console.log(`      → encargo de empréstimo reinjetado (vínculos): ${brl(reinjetado)}`)
  }
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
