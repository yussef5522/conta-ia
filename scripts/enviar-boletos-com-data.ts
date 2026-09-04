// Manda pro financeiro as parcelas COM DATA que ficaram presas na fila aposentada (04/09).
//
// ⭐ POR QUE ELAS EXISTEM: até hoje, confirmar a conferência criava a parcela e ela esperava
// uma SEGUNDA aprovação numa tela separada. O dono aposentou essa fila —
// *"quando eu confirmo a nota, eu JÁ aprovei"* — então **pelo desenho novo estas contas já
// estariam no financeiro desde a conferência**. Isto é a regularização do passado.
//
// ⛔ SÓ AS QUE TÊM DATA. As "A DEFINIR" continuam esperando o dono combinar o vencimento —
// e quando ele definir, vão direto, sem passar por fila nenhuma.
//
// USO:  npx tsx scripts/enviar-boletos-com-data.ts [--aplicar]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { listarPendentes } from '@/lib/stock/ponte-contas-pagar'
import { signToken } from '@/lib/auth'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const EMAIL = 'yussefmusa5522@gmail.com'
const APLICAR = process.argv.includes('--aplicar')
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const pend = await listarPendentes(COMPANY, prisma)
  const comData = pend.filter((p) => p.dVenc)
  const semData = pend.length - comData.length

  const hoje = new Date().toISOString().slice(0, 10)
  console.log('\n=== PARCELAS COM DATA (vão pro financeiro) ===')
  for (const p of comData) {
    const d = String(p.dVenc).slice(0, 10)
    console.log(`  ${d} ${d < hoje ? '(VENCIDA)' : '         '} · R$ ${r2(p.valor).toFixed(2).padStart(9)} · ${p.fornecedorNome}${p.fornecedorNoFinanceiro ? '' : ' · ⚠️ fornecedor novo no financeiro'}`)
  }
  console.log(`\n  ${comData.length} parcela(s) · R$ ${r2(comData.reduce((s, p) => s + p.valor, 0)).toFixed(2)}`)
  console.log(`  (${semData} sem data continuam esperando você combinar o vencimento — não entram aqui)`)
  if (!comData.length || !APLICAR) { console.log(APLICAR ? '' : '\n(sem --aplicar: NADA foi enviado)'); return }

  // ⭐ pelo ENDPOINT REAL (mesma rota que a tela usava), com sessão assinada: o contexto de
  // permissão só existe dentro de um request, e replicar a lógica aqui provaria o script,
  // não o sistema.
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { id: true, email: true, name: true, role: true } })
  const token = await signToken({ sub: user.id, email: user.email, name: user.name, role: user.role })
  const res = await fetch(`http://127.0.0.1:3001/api/empresas/${COMPANY}/estoque/contas-a-pagar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${token}` },
    body: JSON.stringify({ suggestionIds: comData.map((p) => p.suggestionId), cadastrarFornecedores: true }),
  })
  const r = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(r)}`)
  console.log(`\n=== FEITO === criadas ${r.criadas} · puladas ${r.puladas} · fornecedores cadastrados ${r.fornecedoresCadastrados} · R$ ${r2(r.valorTotal).toFixed(2)}`)
  if (r.erros.length) console.log('erros:', r.erros.join(' | '))
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
