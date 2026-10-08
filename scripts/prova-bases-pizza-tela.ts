/**
 * 🖥️ PROVA EM PROD, NAVEGANDO — REGRA 12 (celular + computador).
 *
 * ⚠️ Mede no BUNDLE QUE PROD SERVE, não no meu código-fonte: a tela é client-side e as
 * frases dela não existem no 1º paint (a cicatriz de 04/09, em que eu conferi o HTML e
 * concluí "o botão não está no card").
 */
import { signToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'

const CELULAR =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

/** ⚠️ o minificador escapa acento como \xNN — a cicatriz do `Sa\xeddas:` de 15/09 */
function temFrase(texto: string, frase: string): boolean {
  if (texto.includes(frase)) return true
  const escapado = [...frase]
    .map((ch) => (ch.charCodeAt(0) > 127 ? `\\x${ch.charCodeAt(0).toString(16)}` : ch))
    .join('')
  return texto.includes(escapado)
}

async function bundleDaPagina(url: string, ua: string, cookie: string) {
  const r = await fetch(url, { headers: { 'user-agent': ua, cookie } })
  const html = await r.text()
  const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0]))]
  let js = ''
  for (const c of chunks) {
    const rr = await fetch(`${BASE}${c}`, { headers: { cookie } })
    if (rr.ok) js += await rr.text()
  }
  return { status: r.status, html, js, chunks: chunks.length }
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'admin@contaia.com.br' }, select: { id: true, name: true, email: true } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name ?? 'Dono', role: 'USER' })
  const cookie = `auth_token=${token}; current_empresa_id=${EMPRESA}`

  const telas: { nome: string; url: string; frases: string[] }[] = [
    {
      nome: 'MARGEM (a bancada)',
      url: `${BASE}/empresas/${EMPRESA}/margem`,
      frases: ['buscar sabor', 'nenhum dos', 'casa com'],
    },
  ]

  for (const [rotulo, ua] of [['CELULAR', CELULAR], ['DESKTOP', DESKTOP]] as const) {
    console.log(`\n═══════ ${rotulo} ═══════`)
    for (const t of telas) {
      const b = await bundleDaPagina(t.url, ua, cookie)
      console.log(`  ${t.nome} → ${b.status} · ${b.chunks} chunks · ${Math.round(b.js.length / 1024)} KB de JS`)
      for (const f of t.frases) {
        console.log(`     ${temFrase(b.js, f) ? '✓' : '⛔'} «${f}»`)
      }
    }
  }

  // ⭐ a rota do produto do cardápio tem que devolver o campo novo (contrato, não promessa)
  const chave = 'ficha:cmtxfkc2w0001mz3gt41bf7'
  const r = await fetch(`${BASE}/api/empresas/${EMPRESA}/estoque/cardapio/${encodeURIComponent(chave)}`, {
    headers: { cookie, 'user-agent': DESKTOP },
  })
  console.log(`\n═══════ CONTRATO da rota do produto → ${r.status} ═══════`)
  if (r.ok) {
    const j = (await r.json()) as { dosesADeclarar?: unknown[] }
    console.log(`  campo dosesADeclarar presente: ${j.dosesADeclarar !== undefined ? '✓' : '⛔'} (${(j.dosesADeclarar ?? []).length} pendência(s))`)
  }

  console.log('')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
