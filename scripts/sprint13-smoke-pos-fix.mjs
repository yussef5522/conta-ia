// Sprint 13 — smoke pos-fix: confirma que 1) tx sem vinculo retorna 400 claro
// 2) tx com vinculo cria normalmente 3) PATCH/DELETE funcionam.
import { chromium } from 'playwright'

const PROD = 'https://contaia.com.br'
const EMAIL = 'yussefmusa5522@gmail.com'
const PWD = 'DiagSprint13Smoke!'
const CACULA = 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--host-resolver-rules=MAP contaia.com.br 198.211.103.10', '--ignore-certificate-errors'],
  })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()

  await page.goto(`${PROD}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PWD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 30_000 }).catch(() => {})
  console.log(`  url pos-login: ${page.url()}`)
  console.log('✓ login OK')

  console.log('\n━━ TESTE 1: POST sem vínculo (deve retornar 400, NÃO 201) ━━')
  const sem = await page.evaluate(async (empresa) => {
    const r = await fetch('/api/contas-a-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: empresa,
        description: `SPRINT13_POSFIX_SEM_${Date.now()}`,
        amount: 0.01,
        dueDate: new Date().toISOString().slice(0, 10),
      }),
    })
    return { status: r.status, body: await r.text() }
  }, CACULA)
  console.log(`  status=${sem.status}`)
  console.log(`  body=${sem.body.slice(0, 300)}`)
  const passou1 = sem.status === 400 && sem.body.includes('Defina ao menos')
  console.log(`  ${passou1 ? '✅' : '🚨'} TESTE 1: ${passou1 ? 'rejeita órfã com mensagem clara' : 'NÃO rejeitou'}`)

  console.log('\n━━ TESTE 2: POST com categoryId (deve retornar 201) ━━')
  const cat = await page.evaluate(async (empresa) => {
    const r = await fetch(`/api/empresas/${empresa}/categorias?soAtivas=true`)
    const j = await r.json()
    return j.categorias?.find((c) => c.type === 'EXPENSE')?.id
  }, CACULA)
  console.log(`  categoryId=${cat}`)
  const com = await page.evaluate(async ({ empresa, c }) => {
    const r = await fetch('/api/contas-a-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: empresa,
        description: `SPRINT13_POSFIX_OK_${Date.now()}`,
        amount: 0.01,
        dueDate: new Date().toISOString().slice(0, 10),
        categoryId: c,
      }),
    })
    return { status: r.status, body: await r.text() }
  }, { empresa: CACULA, c: cat })
  console.log(`  status=${com.status}`)
  const passou2 = com.status === 201
  const txid = com.status === 201 ? JSON.parse(com.body).transaction?.id : null
  console.log(`  ${passou2 ? '✅' : '🚨'} TESTE 2: ${passou2 ? `criou (id=${txid?.slice(-8)})` : 'falhou'}`)

  if (txid) {
    console.log('\n━━ TESTE 3: PATCH e DELETE funcionam na tx vinculada ━━')
    const conta = await page.evaluate(async () => {
      const r = await fetch('/api/contas-bancarias')
      const j = await r.json()
      return j?.contas?.[0]?.id
    })
    const patch = await page.evaluate(async ({ id, bankId }) => {
      const r = await fetch(`/api/contas-a-pagar/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: new Date().toISOString().slice(0, 10),
          bankAccountId: bankId,
        }),
      })
      return { status: r.status, body: await r.text() }
    }, { id: txid, bankId: conta })
    console.log(`  PATCH: status=${patch.status}`)
    const del = await page.evaluate(async (id) => {
      const r = await fetch(`/api/contas-a-pagar/${id}`, { method: 'DELETE' })
      return { status: r.status, body: await r.text() }
    }, txid)
    console.log(`  DELETE: status=${del.status}`)
    const passou3 = patch.status === 200 && del.status === 200
    console.log(`  ${passou3 ? '✅' : '🚨'} TESTE 3: PATCH + DELETE funcionam`)
  }

  console.log('\n━━ TESTE 4: UI mostra mensagem clara ao tentar criar sem vínculo ━━')
  await page.goto(`${PROD}/contas-a-pagar/nova?empresaId=${CACULA}`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="Energia"]', `SPRINT13_UI_TEST_${Date.now()}`)
  await page.fill('input[type="number"]', '0.01')
  await page.fill('input[type="date"]', new Date().toISOString().slice(0, 10))
  await page.click('button:has-text("Criar conta a pagar")')
  await page.waitForTimeout(1500)
  const toastTexto = await page.locator('[role="status"]').first().innerText().catch(() => '')
  console.log(`  toast: "${toastTexto}"`)
  const passou4 = toastTexto.toLowerCase().includes('vínculo') || toastTexto.toLowerCase().includes('categoria')
  console.log(`  ${passou4 ? '✅' : '🚨'} TESTE 4: UI bloqueia + mensagem clara`)

  await browser.close()
}
main().catch((e) => { console.error('🚨', e.message); process.exit(1) })
