/**
 * ⭐⭐ A PROVA NAVEGANDO — as ROTAS REAIS e as DUAS TELAS (REGRA 12), 09/10/2026.
 *
 * ⚠️ Só gestos que NÃO gravam: a prévia (`confirmar:false`) e as recusas — que acontecem
 * ANTES de qualquer escrita. ⛔ O POST que GRAVA fica fora: o fetch vai pro processo do
 * SERVIDOR, com conexão própria, e nenhum rollback meu o desfaz (a cicatriz de 07/10).
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '@/lib/auth'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const FLEX = 'cmshqt1hk0003cz0e11lhwwpv'
const base = process.env.BASE ?? 'http://localhost:3001'
const CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const dono = await prisma.user.findFirstOrThrow({
    where: { userCompanyRoles: { some: { companyId: CO, role: { name: 'OWNER' } } } },
    select: { id: true, email: true, name: true },
  })
  const ck = `auth_token=${await signToken({ sub: dono.id, email: dono.email, name: dono.name ?? 'x', role: 'OWNER' })}; current_empresa_id=${CO}`
  const H = (ua: string) => ({ cookie: ck, 'user-agent': ua })

  const bancario = await prisma.loan.findFirstOrThrow({
    where: { companyId: CO, scheduleSource: { not: 'FLEXIBLE' }, installments: { some: { status: { not: 'PAID' } } } },
    select: { id: true, lender: true, contractNumber: true, installments: { where: { status: { not: 'PAID' } }, orderBy: { number: 'asc' }, take: 1, select: { number: true } } },
  })
  const nBanc = bancario.installments[0].number

  console.log('═══ 1. A JANELA BANCÁRIA PELAS ROTAS REAIS ═══')
  for (const [rotulo, loanId, n] of [
    ['FLEXIBLE (Arafat)', FLEX, 4],
    [`BANCÁRIO (${bancario.lender} ${bancario.contractNumber ?? ''})`, bancario.id, nBanc],
  ] as const) {
    const r = await fetch(`${base}/api/empresas/${CO}/emprestimos/${loanId}/parcelas/${n}/candidatos`, { headers: H(DESK) })
    const j = await r.json().catch(() => ({}))
    const code = (j as { code?: string }).code
    console.log(`  GET candidatos · ${rotulo} → HTTP ${r.status}${code ? ` · code ${code}` : ''}${Array.isArray((j as { candidatos?: unknown[] }).candidatos) ? ` · ${(j as { candidatos: unknown[] }).candidatos.length} candidato(s)` : ''}`)

    const p = await fetch(`${base}/api/empresas/${CO}/emprestimos/${loanId}/parcelas/${n}`, {
      method: 'POST', headers: { ...H(DESK), 'content-type': 'application/json' },
      body: JSON.stringify({ transactionIds: ['nao-existe'] }),
    })
    const pj = await p.json().catch(() => ({}))
    console.log(`  POST marcar paga · ${rotulo} → HTTP ${p.status}${(pj as { code?: string }).code ? ` · code ${(pj as { code?: string }).code}` : ''} · ${String((pj as { erro?: string }).erro ?? '').slice(0, 90)}`)
  }

  console.log('\n═══ 2. A PORTA NOVA PELA ROTA REAL (prévia, nada gravado) ═══')
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const pv = await fetch(`${base}/api/empresas/${CO}/emprestimos/${FLEX}/devolucao`, {
    method: 'POST', headers: { ...H(CEL), 'content-type': 'application/json' },
    body: JSON.stringify({ valor: 40000, data: hoje, confirmar: false }),
  })
  const pvj = await pv.json() as Record<string, unknown>
  console.log(`  POST devolucao confirmar:false → HTTP ${pv.status}`)
  const previa = pvj.previa as Record<string, unknown> | undefined
  if (previa) {
    console.log(`  ação ${previa.acao} · ${previa.frase}`)
    console.log(`  descrição "${previa.descricao}" · referência #${(previa.referencia as { number?: number })?.number}`)
    console.log(`  candidatas ${(previa.candidatos as unknown[])?.length} · pede categoria ${previa.pedeCategoria}`)
  }
  // ⛔ recusa: no contrato BANCÁRIO a porta nova não existe
  const pb = await fetch(`${base}/api/empresas/${CO}/emprestimos/${bancario.id}/devolucao`, {
    method: 'POST', headers: { ...H(CEL), 'content-type': 'application/json' },
    body: JSON.stringify({ valor: 100, data: hoje, confirmar: false }),
  })
  const pbj = await pb.json().catch(() => ({})) as { code?: string; erro?: string }
  console.log(`  POST devolucao no BANCÁRIO → HTTP ${pb.status}${pbj.code ? ` · code ${pbj.code}` : ''} · ${String(pbj.erro ?? '').slice(0, 80)}`)

  console.log('\n═══ 3. AS TELAS NOS DOIS VIEWPORTS (REGRA 12) ═══')
  const telas: Array<[string, string]> = [
    ['empréstimo FLEXÍVEL', `/empresas/${CO}/emprestimos/${FLEX}`],
    ['empréstimo BANCÁRIO', `/empresas/${CO}/emprestimos/${bancario.id}`],
    ['carteira', `/empresas/${CO}/emprestimos`],
    ['custos fixos (compromissos)', `/empresas/${CO}/custos-fixos`],
  ]
  for (const [rot, path] of telas) {
    for (const [nome, ua] of [['celular', CEL], ['desktop', DESK]] as const) {
      const t0 = Date.now()
      const r = await fetch(`${base}${path}`, { headers: H(ua) })
      await r.text()
      console.log(`  ${rot} · ${nome} → ${r.status} em ${Date.now() - t0}ms`)
    }
  }

  console.log('\n═══ 4. AS PEÇAS NO BUNDLE QUE PROD SERVE ═══')
  const html = await (await fetch(`${base}/empresas/${CO}/emprestimos/${FLEX}`, { headers: H(CEL) })).text()
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0])
  let js = ''
  for (const c of [...new Set(chunks)]) js += await (await fetch(`${base}${c}`, { headers: H(CEL) })).text()
  const pecas: Array<[string, string]> = [
    ['Registrar devolução', 'Registrar devolu'],
    ['valor livre (campo de dinheiro)', 'sanitizarDinheiro'],
    ['prévia casando', 'é uma saída diferente'],
    ['resumo derivado', 'resumoFlex'],
    ['guard do resumo (grita se não fecha)', 'fecha'],
    ['Nª devolução', 'devolu'],
  ]
  for (const [rot, agulha] of pecas) console.log(`  ${js.includes(agulha) ? '✓' : '⛔'} ${rot}`)
  console.log(`  (chunks lidos: ${new Set(chunks).size} · ${Math.round(js.length / 1024)} KB)`)

  await prisma.$disconnect()
}
main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
