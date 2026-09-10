// ⭐⭐ PROVA "REGRA 2" — o dono abre /conciliacao e OS CARDS ESTÃO LÁ (10/09/2026).
//
// ⛔ O defeito era de TELA, não de motor: o card existia e ninguém chegava nele. Então a
// prova não pode ser "a função devolve certo" — tem que ser **o que a tela carrega ao
// abrir**: a PÁGINA responde, o BUNDLE que ela serve tem o card e não tem mais a frase
// antiga, e a ROTA que ela chama no load devolve os cards com as notas e a conta viva.
//
// ⛔ READ-ONLY: só GET. Conciliar é gesto do dono.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '../lib/auth'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

/** ⚠️ o celular do dono: a tela é a MESMA, o que muda é o viewport — provo os dois UAs */
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  // 1. A PÁGINA abre — nos dois aparelhos
  for (const [nome, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const r = await fetch(`${BASE}/conciliacao?empresaId=${CO}`, {
      headers: { cookie, 'user-agent': ua }, redirect: 'manual',
    })
    console.log(`PAGE /conciliacao (${nome}) → ${r.status}`)
  }

  // 2. O BUNDLE que a página serve: tem o card, não tem a frase antiga
  const html = await (await fetch(`${BASE}/conciliacao?empresaId=${CO}`, { headers: { cookie } })).text()
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0])
  let temCard = false, temFraseAntiga = false, temEscondido = false
  for (const c of [...new Set(chunks)]) {
    const js = await (await fetch(`${BASE}${c}`)).text()
    if (js.includes('PRONTOS PRA CONFIRMAR') || js.includes('esperando você dizer quais notas')) temCard = true
    if (js.includes('nomeiam um fornecedor')) temFraseAntiga = true
    if (js.includes('escolher na mão') && js.includes('abrindo…')) temEscondido = true
  }
  console.log(`\nBUNDLE servido (${chunks.length} chunks)`)
  console.log(`   ⭐ texto dos cards novos presente: ${temCard}`)
  console.log(`   ⛔ frase antiga ("nomeiam um fornecedor"): ${temFraseAntiga}`)
  console.log(`   ⛔ botão do segundo clique ("abrindo…"): ${temEscondido}`)

  // 3. A ROTA que a tela chama NO LOAD (sem extratoId, sem URL secreta)
  const r = await fetch(`${BASE}/api/conciliacao/escolher-na-mao?empresaId=${CO}`, { headers: { cookie } })
  const { cards } = await r.json() as { cards: {
    linha: { descricao: string; valor: number; data: string; conta: string | null }
    fornecedorNome: string
    vencidas: { descricao: string; emAberto: number; vencimento: string; sugerida: boolean }[]
    aVencer: { descricao: string; emAberto: number; vencimento: string; sugerida: boolean }[]
    atalho: { resumo: string; ambiguo: boolean } | null
  }[] }
  console.log(`\nGET /api/conciliacao/escolher-na-mao?empresaId=… → ${r.status} · ${cards.length} cards`)
  for (const c of cards) {
    const notas = [...c.vencidas, ...c.aVencer]
    const soma = Math.round(notas.reduce((s, n) => s + n.emAberto, 0) * 100) / 100
    console.log(`\n  ▸ ${c.fornecedorNome.toUpperCase()} — linha ${brl(c.linha.valor)} · ${dia(c.linha.data)} · ${c.linha.conta ?? '—'}`)
    console.log(`    ${c.vencidas.length} vencida(s) + ${c.aVencer.length} a vencer = ${notas.length} caixinhas · somam ${brl(soma)}`)
    console.log(`    conta viva se marcar tudo: ${brl(Math.round((c.linha.valor - soma) * 100) / 100)} de diferença`)
    console.log(`    atalho ⭐: ${c.atalho ? (c.atalho.ambiguo ? `AMBÍGUO — ${c.atalho.resumo}` : c.atalho.resumo) : 'nenhum'}`)
    for (const n of notas.slice(0, 4)) {
      console.log(`      [${n.sugerida ? 'x' : ' '}] ${brl(n.emAberto)} · ${n.descricao.slice(0, 46)} · vence ${dia(n.vencimento)}`)
    }
    if (notas.length > 4) console.log(`      … +${notas.length - 4}`)
  }
}

main().finally(() => prisma.$disconnect())
