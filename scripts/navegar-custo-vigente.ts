/**
 * 🧭 NAVEGAR EM PROD — REGRA 12 (os DOIS viewports) e REGRA 2 (o caminho do dono, com sessão
 * real, sem URL secreta).
 *
 * ⚠️ Mede o que PROD SERVE (status + payload das rotas que as telas chamam), não o meu
 * raciocínio. ⚠️ E o token é assinado pelo `signToken` da casa com `name` preenchido — a
 * cicatriz de 15/09: token só com `sub` derruba TODA página do dashboard com 500, porque o
 * shell faz `initials(name)`, e aí eu reportaria "prod quebrada" sobre uma sonda errada.
 */
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3001'
const UA = {
  celular: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const dono = await prisma.user.findFirstOrThrow({
    where: { companies: { some: { companyId: EMPRESA } } },
    select: { id: true, email: true, name: true },
  })
  const token = await signToken({ sub: dono.id, email: dono.email, name: dono.name ?? 'Dono', role: 'ADMIN' })
  const cookie = `${COOKIE_NAME}=${token}; current_empresa_id=${EMPRESA}`

  const massa = await prisma.stockItem.findFirstOrThrow({
    where: { companyId: EMPRESA, nome: { contains: 'metade de bolinha' } },
    select: { id: true, nome: true },
  })
  // ⭐ um item NEGATIVO de verdade (o dono pediu navegar um): o de maior dívida de saldo
  const negativo = await prisma.stockItem.findFirstOrThrow({
    where: { companyId: EMPRESA, nome: { contains: 'MOLHO TOMATE PIZZA' } },
    select: { id: true, nome: true },
  })

  const telas: [string, string][] = [
    ['margem (o montador)', `/empresas/${EMPRESA}/margem`],
    ['a massa (página do item)', `/empresas/${EMPRESA}/estoque/itens/${massa.id}`],
    ['um item NEGATIVO', `/empresas/${EMPRESA}/estoque/itens/${negativo.id}`],
    ['posição do estoque', `/empresas/${EMPRESA}/estoque/posicao`],
    ['cardápio', `/empresas/${EMPRESA}/estoque/cardapio`],
  ]

  for (const [nome, ua] of Object.entries(UA)) {
    console.log(`\n═══ ${nome.toUpperCase()} ═══`)
    for (const [rotulo, path] of telas) {
      const t0 = Date.now()
      const r = await fetch(`${BASE}${path}`, { headers: { cookie, 'user-agent': ua }, redirect: 'manual' })
      const html = r.status === 200 ? await r.text() : ''
      const ms = Date.now() - t0
      const temADefinir = /a definir|a apurar/i.test(html)
      console.log(`  ${rotulo.padEnd(26)} ${r.status} em ${String(ms).padStart(5)}ms${html ? ` · ${(html.length / 1024).toFixed(0)} KB` : ''}${temADefinir ? ' · tem "a definir/apurar" na página' : ''}`)
    }
  }

  /**
   * ⭐ O PAYLOAD DO MONTADOR — é onde o custo da base aparece pra o dono.
   *
   * ⚠️ Rota PRÓPRIA: a bancada carrega **sob demanda** (decisão de 07/10, pra não pesar o 1º
   * paint da margem), então `/api/.../margem` não traz `montador` — eu havia chutado essa chave
   * e o laço rodou zero vezes, imprimindo nada com cara de "o montador está vazio".
   */
  console.log('\n═══ O PAYLOAD DO MONTADOR (o que a bancada recebe) ═══')
  const r = await fetch(`${BASE}/api/empresas/${EMPRESA}/margem/montador`, { headers: { cookie, 'user-agent': UA.desktop } })
  console.log(`  GET /api/.../margem/montador → ${r.status}`)
  if (r.ok) {
    const j = (await r.json()) as {
      tamanhos?: { tamanho?: string; base?: { nome?: string; custo?: number | null } }[]
      sabores?: { custo?: number | null }[]
      faltando?: { frase?: string }[]
    }
    for (const t of j.tamanhos ?? []) {
      const c = t.base?.custo
      console.log(`    ${String(t.tamanho).padEnd(18)} ${c == null ? '⛔ a apurar' : `⭐ R$ ${c.toFixed(2).replace('.', ',')}`} · base «${t.base?.nome ?? '—'}»`)
    }
    const ok = (j.tamanhos ?? []).filter((t) => t.base?.custo != null).length
    console.log(`  ⭐ tamanhos com a base CUSTEADA: ${ok} de ${(j.tamanhos ?? []).length}`)
    console.log(`  sabores: ${(j.sabores ?? []).length} · sem custo: ${(j.sabores ?? []).filter((s) => s.custo == null).length}`)
    for (const f of j.faltando ?? []) console.log(`  ⚠️ falta: ${f.frase}`)
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('⛔', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
