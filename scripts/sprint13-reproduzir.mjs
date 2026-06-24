// Sprint 13 — reproduzir "This page couldn't load" no Contas a Pagar
// Captura: URL, status HTTP, console errors, network failures, SW.

import { chromium } from 'playwright'

const PROD = 'https://contaia.com.br' // resolvido via /etc/hosts override no chromium
const EMAIL = 'yussefmusa5522@gmail.com'
const PWD = 'DiagSprint13Temp!'

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

  const consoleMessages = []
  const networkFails = []
  const responses = []

  page.on('console', (msg) =>
    consoleMessages.push({ type: msg.type(), text: msg.text() }),
  )
  page.on('pageerror', (err) =>
    consoleMessages.push({ type: 'pageerror', text: err.message }),
  )
  page.on('requestfailed', (req) =>
    networkFails.push({ url: req.url(), failure: req.failure()?.errorText }),
  )
  page.on('response', (res) => {
    const u = res.url()
    if (u.includes('/contas-a-pagar') || u.includes('/api/contas-a-pagar')) {
      responses.push({
        url: u,
        status: res.status(),
        method: res.request().method(),
      })
    }
  })

  console.log('━━━ 1. Login ━━━')
  await page.goto(`${PROD}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PWD)
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 10_000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`  ✓ login OK → ${page.url()}`)

  // Verifica SW registrado
  const swInfo = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false }
    const regs = await navigator.serviceWorker.getRegistrations()
    return {
      supported: true,
      count: regs.length,
      registrations: regs.map((r) => ({ scope: r.scope, active: !!r.active })),
    }
  })
  console.log('  SW:', JSON.stringify(swInfo))

  console.log('\n━━ 2. Ir para Contas a Pagar ━━━')
  const cacula = { id: 'cmq17yapb00gnrndlh33sctbo' } // sabido do Sprint 12
  await page.goto(`${PROD}/contas-a-pagar?empresaId=${cacula.id}`, {
    waitUntil: 'networkidle',
  })
  console.log(`  URL atual: ${page.url()}`)
  console.log(`  title: ${await page.title()}`)

  console.log('\n━━ 3. Ir pra "Nova" e criar ━━━')
  await page.goto(`${PROD}/contas-a-pagar/nova?empresaId=${cacula.id}`, {
    waitUntil: 'networkidle',
  })
  console.log(`  URL nova: ${page.url()}`)

  await page.fill(
    'input[placeholder*="Energia"]',
    `SPRINT13_DIAG_${Date.now()}`,
  )
  // Valor
  await page.fill('input[type="number"]', '0.01')
  // Vencimento — hoje
  const today = new Date().toISOString().slice(0, 10)
  await page.fill('input[type="date"]', today)

  // Pre-submit snapshot
  const preSubmitUrl = page.url()
  const preSubmitErrors = consoleMessages.length
  responses.length = 0

  console.log(`  Vai clicar "Criar conta a pagar"…`)
  await page.click('button:has-text("Criar conta a pagar")')

  // Espera transição
  await page.waitForTimeout(3500)

  const postSubmitUrl = page.url()
  console.log(`  pre-submit URL:  ${preSubmitUrl}`)
  console.log(`  post-submit URL: ${postSubmitUrl}`)
  console.log(`  title: ${await page.title()}`)

  // Capturar texto da page completo
  const bodyText = (await page
    .locator('body')
    .innerText()
    .catch(() => '')).slice(0, 1500)
  console.log(`\n  ─── BODY TEXT (1500 chars) ───`)
  console.log(bodyText)

  console.log(`\n  ─── RESPONSES ───`)
  for (const r of responses) console.log(`  ${r.method} ${r.status} ${r.url}`)

  console.log(`\n  ─── CONSOLE (novas mensagens pós-submit) ───`)
  for (const m of consoleMessages.slice(preSubmitErrors)) {
    console.log(`  [${m.type}] ${m.text.slice(0, 300)}`)
  }

  console.log(`\n  ─── NETWORK FAILURES ───`)
  for (const f of networkFails.slice(-5)) console.log(`  ${f.url} ← ${f.failure}`)

  // Screenshot
  await page.screenshot({
    path: '/tmp/sprint13-pos-criar.png',
    fullPage: true,
  })

  await browser.close()
}

main().catch((e) => {
  console.error('🚨', e.message)
  process.exit(1)
})
