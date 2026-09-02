// SEMEIA a prateleira de complementos com o relatório de PERÍODO — pelo ENDPOINT REAL.
//
// ⭐ Roda o mesmo caminho que a tela roda (rota + guard de permissão + preview + confirm),
// nunca uma cópia da lógica: script que replica o handler prova o script, não o sistema.
//
// ⚠️ MODO PERÍODO: as linhas ficam marcadas `comp-periodo-…` e a baixa (quando existir) as
// RECUSA. O relatório do Suitable não traz data nenhuma — a data aqui é RÓTULO do seed, não
// afirmação de que as vendas aconteceram naquele dia.
//
// USO:  npx tsx scripts/semear-complementos-periodo.ts [--confirmar]
//       sem --confirmar só mostra o preview (não grava nada).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '@/lib/auth'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const EMAIL = 'yussefmusa5522@gmail.com'
const DATA_ROTULO = '2026-08-31'
const BASE = 'http://127.0.0.1:3001'
const CONFIRMAR = process.argv.includes('--confirmar')

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, email: true, name: true, role: true } })
  if (!user) throw new Error(`usuário ${EMAIL} não existe neste banco — abortando`)
  const token = await signToken({ sub: user.id, email: user.email, name: user.name, role: user.role })

  const html = readFileSync(join(process.cwd(), 'lib/stock/vendas/__tests__/fixtures/fixture-complementos-agrupado.xls'), 'utf-8')

  const chamar = async (confirmar: boolean) => {
    const r = await fetch(`${BASE}/api/empresas/${COMPANY}/estoque/vendas/complementos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${token}` },
      body: JSON.stringify({ data: DATA_ROTULO, html, confirmar, modo: 'PERIODO' }),
    })
    const j = await r.json().catch(() => null)
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j)}`)
    return j
  }

  const p = await chamar(false)
  console.log('\n=== PREVIEW (nada gravado) ===')
  console.log(`linhas: ${p.totalLinhas} · ocorrências: ${p.totalOcorrencias}`)
  console.log(`com destino: ${p.comDestino} · pendentes: ${p.pendentes} · nos dois relatórios: ${p.nosDoisRelatorios}`)
  console.log(`já importado neste rótulo? ${p.jaImportado ? 'SIM (confirmar substitui)' : 'não'}`)
  console.log(`topo: ${p.prateleira.slice(0, 5).map((l: { nomeSuitable: string; ocorrencias: number }) => `${l.nomeSuitable}=${l.ocorrencias}`).join(' · ')}`)

  if (!CONFIRMAR) { console.log('\n(sem --confirmar: nada foi gravado)'); return }

  const c = await chamar(true)
  console.log('\n=== CONFIRMADO ===')
  console.log(`importId: ${c.importId} · modo: ${c.modo} · linhas: ${c.linhas} · ocorrências: ${c.ocorrencias} · substituiu: ${c.substituiu}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
