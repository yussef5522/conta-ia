/**
 * ⭐⭐⭐ A PROVA NAVEGANDO — PELAS ROTAS REAIS, NOS DOIS VIEWPORTS (09/10/2026, item 5).
 *
 * ⛔⛔ **A FRONTEIRA SE PROVA NO QUE A ROTA DEVOLVE, nunca no que o componente desenha.** O
 * veredito do fiscal é **cola de prova** (a lei de 05/10): se o GET da fila respondesse a quem
 * só tem `stock.view`, o número esperado viajaria no JSON até o tablet da cozinha e estaria a
 * um DevTools de distância. Então a prova pede a MESMA rota com DUAS sessões.
 *
 * ⚠️ E ela mede o BUNDLE que prod serve, não o meu código-fonte — a cicatriz de 10/09 (medir no
 * lugar errado dá um vermelho tão convincente quanto um defeito real).
 */
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const base = process.env.BASE ?? 'http://localhost:3001'

const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)

  /** ⭐ o DONO (OWNER, tem `stock.manage`) e o TABLET (só `stock.view`/`operate`) */
  const dono = await prisma.user.findFirstOrThrow({
    where: { userCompanyRoles: { some: { companyId: CO, role: { name: 'OWNER' } } } },
    select: { id: true, email: true, name: true },
  })
  const tablet = await prisma.user.findFirst({
    where: { userCompanyRoles: { some: { companyId: CO, role: { name: { in: ['OPERADOR_ESTOQUE', 'EXECUTOR_PRODUCAO', 'LEITURA_ESTOQUE'] } } } } },
    select: { id: true, email: true, name: true, userCompanyRoles: { where: { companyId: CO }, select: { role: { select: { name: true } } } } },
  })

  const cookieDe = async (u: { id: string; email: string; name: string | null }) =>
    `auth_token=${await signToken({ sub: u.id, email: u.email, name: u.name ?? 'x', role: 'OWNER' })}; current_empresa_id=${CO}`

  const ckDono = await cookieDe(dono)
  console.log(`\nDONO: ${dono.email}`)
  console.log(`TABLET: ${tablet ? `${tablet.email} (${tablet.userCompanyRoles.map((r: { role: { name: string } }) => r.role.name).join(', ')})` : '— nenhum papel de operação cadastrado'}`)

  // ───────────── 1. O GATE DO PAYLOAD (a lei de 05/10) ─────────────
  console.log('\n═══ 1. O GATE DO PAYLOAD — a fila é SÓ de quem gerencia ═══')
  const rDono = await fetch(`${base}/api/empresas/${CO}/estoque/producao/conferencia`, { headers: { cookie: ckDono } })
  const jDono = rDono.ok ? await rDono.json() : null
  console.log(`  GERENTE → HTTP ${rDono.status} · aguardando ${jDono?.aguardando ?? '—'} · atrasados ${jDono?.atrasados ?? '—'}`)
  const temFiscalNoPayload = JSON.stringify(jDono ?? {}).includes('fiscalFrase')
  console.log(`  o veredito do fiscal no payload do GERENTE: ${temFiscalNoPayload ? '⭐ SIM (é a casa dele)' : '⛔ não veio'}`)

  if (tablet) {
    const ck = await cookieDe(tablet)
    const r = await fetch(`${base}/api/empresas/${CO}/estoque/producao/conferencia`, { headers: { cookie: ck } })
    const corpo = await r.text()
    console.log(`  TABLET  → HTTP ${r.status} ${r.status === 403 ? '⭐ NEGADO (a cola não viaja)' : '⛔⛔ RESPONDEU — a cola vazou!'}`)
    console.log(`    corpo: ${corpo.slice(0, 160)}`)
    /** ⛔ e a lista de ordens (que o tablet LÊ) não pode carregar número de fiscal nenhum */
    const ro = await fetch(`${base}/api/empresas/${CO}/estoque/producao/ordens?periodo=hoje`, { headers: { cookie: ck } })
    if (ro.ok) {
      const t = await ro.text()
      const vazou = ['fiscalFrase', 'permitido', 'pctFisico'].filter((k) => t.includes(k))
      console.log(`  a lista do tablet carrega ${vazou.length ? `⛔ ${vazou.join(', ')}` : '⭐ só o booleano (nenhum número de fiscal)'}`)
      console.log(`  e o SELO da conferência viaja nela: ${t.includes('conferencia') ? '⭐ sim (é estado, não número esperado)' : 'não'}`)
    } else {
      console.log(`  a lista do tablet → HTTP ${ro.status}`)
    }
  }

  // ───────────── 2. A RECUSA DO POST (sem PIN válido, nada grava) ─────────────
  console.log('\n═══ 2. O POST RECUSA E ENSINA (nada gravado) ═══')
  const antes = await prisma.stockConclusaoConferida.count({ where: { companyId: CO } })
  const alvo = jDono?.cartoes?.[0]
  if (alvo) {
    const r = await fetch(`${base}/api/empresas/${CO}/estoque/producao/conferencia`, {
      method: 'POST',
      headers: { cookie: ckDono, 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'CONFIRMAR', conclusaoId: alvo.conclusaoId, pin: '0000' }),
    })
    console.log(`  PIN errado → HTTP ${r.status} · ${(await r.text()).slice(0, 140)}`)
    const r2 = await fetch(`${base}/api/empresas/${CO}/estoque/producao/conferencia`, {
      method: 'POST',
      headers: { cookie: ckDono, 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'CORRIGIR', conclusaoId: alvo.conclusaoId, qtdCerta: 1, motivo: 'OUTRO', pin: '1234' }),
    })
    console.log(`  «outro» SEM texto → HTTP ${r2.status} · ${(await r2.text()).slice(0, 160)}`)
    /** ⭐ e a PRÉVIA é leitura pura — pode rodar sem gravar nada */
    const r3 = await fetch(`${base}/api/empresas/${CO}/estoque/producao/conferencia`, {
      method: 'POST',
      headers: { cookie: ckDono, 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'PREVER_CORRECAO', conclusaoId: alvo.conclusaoId, qtdCerta: Math.max(1, Math.round(alvo.declarado / 2)) }),
    })
    console.log(`  PREVER_CORRECAO → HTTP ${r3.status} · ${(await r3.text()).slice(0, 200)}`)
  }
  const depois = await prisma.stockConclusaoConferida.count({ where: { companyId: CO } })
  console.log(`  carimbos: ${antes} → ${depois} ${antes === depois ? '⭐ nada gravado' : '⛔ GRAVOU'}`)

  // ───────────── 3. AS TELAS, NOS DOIS VIEWPORTS (REGRA 12) ─────────────
  console.log('\n═══ 3. AS TELAS — celular e desktop (REGRA 12) ═══')
  const PECAS = [
    ['a seção do gerente', 'Conferência do dia'],
    ['a âncora do aviso', 'conferencia-do-dia'],
    ['o selo aguardando', 'aguardando conferência'],
    ['o selo conferido', 'conferido'],
    ['o selo corrigido', 'corrigido e conferido'],
    ['o painel único', 'seu PIN'],
    ['os motivos', 'contou errado'],
    ['a razão do PIN', 'quem declarou não confere a própria produção'],
  ] as const

  for (const [rotulo, ua] of [['CELULAR', CELULAR], ['DESKTOP', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${base}/empresas/${CO}/estoque/producao`, { headers: { cookie: ckDono, 'user-agent': ua } })
    const html = await r.text()
    const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0])
    let js = ''
    for (const c of [...new Set(chunks)]) js += await (await fetch(base + c, { headers: { cookie: ckDono } })).text()
    console.log(`\n  ${rotulo} /estoque/producao → HTTP ${r.status} em ${Date.now() - t0}ms · ${(js.length / 1024).toFixed(0)} KB de JS`)
    for (const [nome, frase] of PECAS) {
      console.log(`    ${js.includes(frase) || html.includes(frase) ? '✓' : '⛔'} ${nome}`)
    }
    /** ⛔ e a COLA não pode estar no bundle da home (ela é da fila, que vem por fetch) */
    const cola = ['o material dava', 'a receita permite ~'].filter((k) => js.includes(k) || html.includes(k))
    console.log(`    ${cola.length ? `⚠️ frases do fiscal no bundle: ${cola.join(' · ')} (a tela da fila é a casa delas)` : '⭐ nenhuma frase de fiscal no bundle'}`)
  }

  // a página da ordem (item 3)
  const ordem = jDono?.cartoes?.[0]?.ordemId
  if (ordem) {
    for (const [rotulo, ua] of [['CELULAR', CELULAR], ['DESKTOP', DESKTOP]] as const) {
      const r = await fetch(`${base}/empresas/${CO}/estoque/producao/${ordem}`, { headers: { cookie: ckDono, 'user-agent': ua } })
      console.log(`  ${rotulo} /producao/<ordem> → HTTP ${r.status}`)
    }
    const ro = await fetch(`${base}/api/empresas/${CO}/estoque/producao/ordens/${ordem}`, { headers: { cookie: ckDono } })
    const jo = ro.ok ? await ro.json() : null
    const c0 = jo?.conclusoes?.[0]
    console.log(`  o carimbo no payload da ORDEM: ${c0 ? JSON.stringify(c0.conferencia) : '—'}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
