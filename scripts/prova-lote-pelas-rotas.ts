// ⭐ PROVA PELO CAMINHO DA TELA — sessão assinada, rotas reais (09/09/2026).
// ⛔ READ-ONLY: só GET. Nada é vinculado por script — vincular é gesto do dono.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '../lib/auth'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const r = await fetch(`${BASE}/api/conciliacao/fila?empresaId=${CO}`, { headers: { cookie } })
  console.log(`\nGET /api/conciliacao/fila → ${r.status}`)
  const f = await r.json()
  console.log(`   totais: ${JSON.stringify(f.totais)}`)
  for (const l of f.lotes ?? []) {
    console.log(`   ⭐ LOTE ${l.fornecedorNome} · linha ${brl(l.valorDaLinha)} de ${String(l.linha.data).slice(0, 10)} · ${l.linha.conta}`)
    console.log(`      categoria da linha HOJE: ${l.linha.categoria ?? '—'}  ⭐ (já categorizada e AINDA casável)`)
    console.log(`      ${l.notas.length} notas · soma ${brl(l.soma)} · diferença ${brl(l.diferenca)}`)
  }
  console.log(`   linhas que nomeiam fornecedor e não fecham: ${(f.lotesQueNaoFecham ?? []).length}`)
  for (const c of f.contas ?? []) {
    console.log(`   1:1 ${brl(c.conta.valor)} "${c.conta.descricao}" → ${c.sugestoes.length} sugestão(ões) · ${c.sugestoes[0]?.porQue ?? ''}`)
  }

  const r2 = await fetch(`${BASE}/api/conciliacao/sugestoes-pendentes?empresaId=${CO}`, { headers: { cookie } })
  const p = await r2.json()
  console.log(`\nGET /api/conciliacao/sugestoes-pendentes → ${r2.status}`)
  console.log(`   linhas com par 1:1: ${Object.keys(p.sugestoes ?? {}).length} · linhas que são LOTE: ${Object.keys(p.lotes ?? {}).length}`)
}

main().finally(() => prisma.$disconnect())
