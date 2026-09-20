// ⭐⭐ PROVA — O CASO N:M ENTROU NO CHASSI ≍ (20/09/2026).
//
// ⛔ A mudança é de TELA, então a prova é o **BUNDLE QUE PROD SERVE**, nunca o meu
// código-fonte e nunca o 1º paint (os cards nascem do `fetch`, não existem no HTML —
// a lição de 13/09, quando eu medi o lugar errado e reportei um vermelho que não existia).
//
// ⛔ READ-ONLY: só GET. Conciliar é gesto do dono.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '../lib/auth'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'

/** ⚠️ o dono opera no celular — REGRA 12: os DOIS viewports, sempre */
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  for (const [nome, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${BASE}/conciliacao?empresaId=${CO}`, {
      headers: { cookie, 'user-agent': ua }, redirect: 'manual',
    })
    const html = await r.text()
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))]
    const js = (await Promise.all(chunks.map(async (c) => (await fetch(`${BASE}${c}`)).text()))).join('')

    const kb = Math.round(js.length / 1024)
    console.log(`\nPAGE /conciliacao (${nome}) → ${r.status} em ${Date.now() - t0}ms · bundle ${kb} KB`)
    // ⭐ o chassi compartilhado desenhando o caso N:M
    console.log(`   ⭐ "O BANCO DIZ" (a coluna do chassi)          : ${js.includes('O BANCO DIZ')}`)
    console.log(`   ⭐ o rótulo do painel do N:M                    : ${js.includes('QUAIS NOTAS ESTE PAGAMENTO COBRIU')}`)
    console.log(`   ⭐ a medida do mock (empilha no celular)        : ${js.includes('min-[900px]:grid-cols-[1fr_64px_1fr]')}`)
    // ⛔ e o motor, que a ordem do dono mandou NÃO tocar
    console.log(`   ⛔ o rodapé vivo do N:M                         : ${js.includes('soma crava com o pagamento')}`)
    console.log(`   ⛔ uma linha por vez ("pular pra próxima")      : ${js.includes('pular pra próxima')}`)
    console.log(`   ⛔ um grupo por vez ("abrir o caso")            : ${js.includes('abrir o caso')}`)

    // ⭐⭐ A LIMPEZA DO TOPO (20/09) — os lemas somem, as FUNÇÕES ficam alcançáveis
    console.log(`   ⛔ lema "o banco diz o que aconteceu…"           : ${js.includes('o banco diz o que aconteceu')}  (tem que ser false)`)
    console.log(`   ⛔ lema "o banco diz o que saiu…"                : ${js.includes('o banco diz o que saiu')}  (tem que ser false)`)
    console.log(`   ⭐ o card 💤 LEVA pro Contas a Pagar             : ${js.includes('contas abertas · ver no Contas a Pagar')}`)
    console.log(`   ⭐ o rodapé discreto tem o ⚙️ mudar               : ${js.includes('⚙️ mudar')}`)
    console.log(`   ⭐ e o caminho pros sem-par                      : ${js.includes('em aberto sem par')}`)
  }

  // ⭐ E a rota que a página chama no load — os cards continuam chegando
  const r = await fetch(`${BASE}/api/conciliacao/escolher-na-mao?empresaId=${CO}`, { headers: { cookie } })
  const j = await r.json() as { cards?: { fornecedorNome: string; linha: { valor: number; conta: string | null } }[] }
  console.log(`\nROTA /escolher-na-mao → ${r.status} · ${j.cards?.length ?? 0} card(s)`)
  for (const c of (j.cards ?? []).slice(0, 4)) {
    console.log(`   · ${c.fornecedorNome} · ${c.linha.conta ?? 'conta'} · ${c.linha.valor.toFixed(2)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
