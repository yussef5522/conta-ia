// Sprint 13 — reproduzir EXCLUIR + MARCAR PAGA pra confirmar não é server-side
import { chromium } from 'playwright'

const PROD = 'https://contaia.com.br'
const EMAIL = 'yussefmusa5522@gmail.com'
const PWD = 'DiagSprint13Temp!'
const CACULA = 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--host-resolver-rules=MAP contaia.com.br 198.211.103.10',
      '--ignore-certificate-errors',
    ],
  })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()

  const responses = []
  page.on('response', (res) => {
    const u = res.url()
    if (u.includes('/contas-a-pagar') || u.includes('/api/contas-a-pagar')) {
      responses.push({
        url: u.substring(u.indexOf('/', 8)),
        status: res.status(),
        method: res.request().method(),
      })
    }
  })

  // Login
  await page.goto(`${PROD}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PWD)
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 10_000 }),
    page.click('button[type="submit"]'),
  ])
  console.log('✓ login OK')

  // Cria uma tx pra excluir — via API direto com categoryId VÁLIDO
  const marcador = `SPRINT13_DEL_${Date.now()}`
  const cat = await page.evaluate(async (empresa) => {
    const r = await fetch(`/api/empresas/${empresa}/categorias?soAtivas=true`)
    const j = await r.json()
    return j.categorias?.find((c) => c.type === 'EXPENSE')?.id
  }, CACULA)
  console.log(`categoryId=${cat}`)
  const created = await page.evaluate(async ({ empresa, m, c }) => {
    const r = await fetch('/api/contas-a-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: empresa,
        description: m,
        amount: 0.01,
        dueDate: new Date().toISOString().slice(0, 10),
        categoryId: c,
      }),
    })
    return { status: r.status, ok: r.ok, body: await r.text() }
  }, { empresa: CACULA, m: marcador, c: cat })
  console.log(`POST status=${created.status} ok=${created.ok}`)

  // Agora ir pra rota /contas-a-pagar e ver se a página carrega normal
  await page.goto(`${PROD}/contas-a-pagar/nova?empresaId=${CACULA}`, {
    waitUntil: 'networkidle',
  })
  // Pular esse fluxo: vou pular pra busca direta
  await page.fill('input[placeholder*="Energia"]', `IGNORE_${Date.now()}`)
  await page.fill('input[type="number"]', '0.01')
  await page.fill('input[type="date"]', new Date().toISOString().slice(0, 10))
  console.log(`\n━━ Cria ${marcador} ━━`)
  await page.click('button:has-text("Criar conta a pagar")')
  await page.waitForURL((u) => u.toString().includes('/contas-a-pagar') && !u.toString().includes('/nova'), { timeout: 10_000 }).catch(() => {})
  console.log(`URL pós-create: ${page.url()}`)

  // Mudar filtro pra TODOS (PENDING não vai mostrar porque é RECONCILED... espera, foi criada SEM paymentDate, então fica PENDING)
  // Vou ir pra "Todas" via dropdown ou via URL
  await page.goto(`${PROD}/contas-a-pagar?empresaId=${CACULA}&status=PENDING`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(1500)

  console.log(`\n━━ Procurar a linha "${marcador}" ━━`)
  const linha = page.locator(`tr:has-text("${marcador}")`)
  const visivel = await linha.count()
  console.log(`  linhas com o marcador: ${visivel}`)
  if (visivel === 0) {
    const corpo = (await page.locator('table').innerText().catch(() => 'sem tabela')).slice(0, 800)
    console.log(`  CORPO TABELA (800 chars): ${corpo}`)
  }

  // Tentar excluir via API direto (já que UI exige interação complexa)
  // O endpoint DELETE /api/contas-a-pagar/[id] requer id. Vou pegar via search.
  const apiResp = await page.evaluate(async (m) => {
    const r = await fetch(`/api/contas-a-pagar?empresaId=cmq17yapb00gnrndlh33sctbo&status=TODOS&q=${encodeURIComponent(m)}`)
    const j = await r.json()
    return j
  }, marcador)
  console.log(`  Buscou via API: total=${apiResp.paginacao?.total ?? '?'}`)
  const txid = apiResp.items?.[0]?.id
  console.log(`  txid=${txid}`)

  if (!txid) {
    console.log('🚨 nao achou via API; abortar')
    await browser.close()
    return
  }

  // Excluir via API direto
  responses.length = 0
  console.log(`\n━━ DELETE via fetch ━━`)
  const delResp = await page.evaluate(async (id) => {
    const r = await fetch(`/api/contas-a-pagar/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return { status: r.status, ok: r.ok, body: await r.text() }
  }, txid)
  console.log(`  DELETE response: status=${delResp.status} ok=${delResp.ok} body=${delResp.body.slice(0, 200)}`)

  // Marcar paga via PATCH
  // Criar outra pra marcar paga
  const marcador2 = `SPRINT13_PAGA_${Date.now()}`
  await page.goto(`${PROD}/contas-a-pagar/nova?empresaId=${CACULA}`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="Energia"]', marcador2)
  await page.fill('input[type="number"]', '0.01')
  await page.fill('input[type="date"]', new Date().toISOString().slice(0, 10))
  console.log(`\n━━ Cria ${marcador2} ━━`)
  await page.click('button:has-text("Criar conta a pagar")')
  await page.waitForURL((u) => u.toString().includes('/contas-a-pagar') && !u.toString().includes('/nova'), { timeout: 10_000 }).catch(() => {})

  const apiResp2 = await page.evaluate(async (m) => {
    const r = await fetch(`/api/contas-a-pagar?empresaId=cmq17yapb00gnrndlh33sctbo&status=TODOS&q=${encodeURIComponent(m)}`)
    return r.json()
  }, marcador2)
  const txid2 = apiResp2.items?.[0]?.id

  const conta = await page.evaluate(async () => {
    const r = await fetch('/api/contas-bancarias')
    const j = await r.json()
    return j?.contas?.[0]?.id
  })
  console.log(`  bankAccount=${conta}`)
  console.log(`\n━━ PATCH marcar paga ━━`)
  const patchResp = await page.evaluate(async ({ id, bankId }) => {
    const r = await fetch(`/api/contas-a-pagar/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentDate: new Date().toISOString().slice(0, 10),
        bankAccountId: bankId,
      }),
    })
    return { status: r.status, ok: r.ok, body: await r.text() }
  }, { id: txid2, bankId: conta })
  console.log(`  PATCH response: status=${patchResp.status} ok=${patchResp.ok} body=${patchResp.body.slice(0, 200)}`)

  // CLEANUP: deletar a segunda também
  await page.evaluate(async (id) => {
    await fetch(`/api/contas-a-pagar/${id}`, { method: 'DELETE', credentials: 'include' })
  }, txid2)

  await browser.close()
}
main().catch((e) => { console.error('🚨', e.message); process.exit(1) })
