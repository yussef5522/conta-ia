/** Prova em prod do v2 — navegando, 2 viewports. O passo 3 ESCREVE config (gesto do dono). */
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { lerMargem } from '@/lib/margem/leitura'
import { lerMontador } from '@/lib/margem/leitura-montador'
import { montarPlacar, montarCarregadores } from '@/lib/margem/placar'
import { montarPizza } from '@/lib/margem/montador'
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const brl = (n: number | null | undefined) => (n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const base = 'http://localhost:3001'

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirst({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u!.id, email: u!.email, name: u!.name ?? 'dono', role: 'OWNER' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  console.log('═══ 1. A TELA, NOS DOIS VIEWPORTS')
  const chunks: Record<string, string> = {}
  for (const [nome, ua] of [['CELULAR', CEL], ['DESKTOP', DESK]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${base}/empresas/${CO}/margem`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    console.log(`  ${nome}  ${r.status} em ${Date.now() - t0}ms`)
    let meu = ''
    for (const s of [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1])) {
      const t = await (await fetch(base + s, { headers: { cookie } })).text()
      if (t.includes('Quem paga a casa')) meu += t
    }
    chunks[nome] = meu
    let css = ''
    for (const c of [...html.matchAll(/href="(\/_next\/static\/[^"]*\.css)"/g)].map((m) => m[1])) {
      css += await (await fetch(base + c, { headers: { cookie } })).text()
    }
    chunks[nome + '_CSS'] = css
  }
  const PECAS: [string, string][] = [
    ['o que as vendas deixaram', 'cartão 1'], ['a casa custou', 'cartão 2'],
    ['daqui pra frente é lucro', 'resultado verde'], ['🏁', 'a bandeira'],
    ['quem carregou a casa', 'a lista'], ['ver todos', 'o expande'],
    ['ir pra fila das fichas', 'o rodapé âmbar'], ['montar uma pizza de teste', 'o montador'],
    ['só simulação, nada grava', 'a garantia'], ['sem ficha — criar', 'o selo âmbar'],
    ['ocorr', 'a regra de 02/09'], ['precinho segue o tamanho', 'a derivação'],
  ]
  for (const v of ['CELULAR', 'DESKTOP'] as const) {
    const faltam = PECAS.filter(([f]) => !chunks[v].includes(f))
    console.log(`  ${v}: ${PECAS.length - faltam.length}/${PECAS.length}` + (faltam.length ? ` ⛔ FALTAM ${faltam.map((f) => f[1]).join(', ')}` : ' ✓'))
  }
  const hex = [...chunks.CELULAR.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0])
  console.log(`  ⛔ hex de cor no chunk DESTA tela: ${hex.length === 0 ? '0 ✓' : hex.slice(0, 5).join(' ')}`)
  const TOKENS = ['--fam-indigo-mid', '--fam-verde-mid', '--fam-ambar-bg', '--prod-acao-ink', '--prod-surface-1']
  const faltaT = TOKENS.filter((t) => (chunks.CELULAR_CSS.split(t + ':').length - 1) < 2)
  console.log(`  ${faltaT.length === 0 ? '✓' : '⛔'} tokens novos nos DOIS temas (${faltaT.join(' ') || 'todos ok'})`)
  console.log(`  ⛔ os tijolos SVG: ${chunks.CELULAR.includes('TELHADO') || chunks.CELULAR.includes('polygon') ? 'AINDA LÁ' : 'MORRERAM ✓'}`)

  console.log('\n═══ 2. O PLACAR E A LISTA, no dado real')
  const m = await lerMargem(CO, 'MES', new Date(), {}, prisma)
  const p = montarPlacar(m.casa)
  console.log(`  [${p.sobra.rotulo}] ${brl(p.sobra.valor)}  · ${p.sobra.sublinha}`)
  console.log(`  [${p.casa.rotulo}] ${brl(p.casa.valor)}  · ${p.casa.sublinha}`)
  console.log(`  [${p.resultado.rotulo}] ${p.resultado.tom === 'PAGOU' ? '+' : ''}${brl(p.resultado.valor)}  · ${p.resultado.sublinha}`)
  if (p.resultado.ressalva) console.log(`     ressalva: ${p.resultado.ressalva}`)
  const fecha = p.sobra.valor != null && p.casa.valor != null && p.resultado.valor != null
    && Math.abs(Math.abs(p.sobra.valor - p.casa.valor) - p.resultado.valor) < 0.02
  console.log(`  ⛔ a conta dos 3 cartões FECHA? ${fecha ? '⭐ SIM' : 'NÃO'}`)
  if (p.barra) console.log(`  BARRA: pago ${(p.barra.pago * 100).toFixed(1)}% + transbordo ${(p.barra.transbordo * 100).toFixed(1)}% = ${((p.barra.pago + p.barra.transbordo) * 100).toFixed(1)}% · ${p.barra.rotuloTransbordo ?? p.barra.rotuloParcial} · bandeira ${p.barra.bandeira}`)
  const l = montarCarregadores(m.casa, m.saboresSemFicha.length)
  const soma = [...l.visiveis, ...l.resto].reduce((a, x) => a + x.sobraTotal, 0)
  console.log(`  Σ(carregadores) ${brl(Math.round(soma * 100) / 100)} × sobra bruta ${brl(m.casa.sobraTotal)} → ${Math.abs(soma - m.casa.sobraTotal) < 0.02 ? '⭐ FECHA' : 'NÃO'}`)
  console.log(`  visíveis ${l.visiveis.length} · atrás do "+N" ${l.resto.length}`)
  for (const x of l.visiveis) console.log(`     ${x.rei ? '👑' : '  '} ${x.nome} · ${x.pctDaCasa == null ? '' : (x.pctDaCasa * 100).toFixed(1) + '% da casa · '}${brl(x.sobraTotal)} · barra ${(x.pctDaBarra * 100).toFixed(0)}%`)
  console.log(`  rodapé: 🪑 ${l.rodape.foraDaObra} fora · ${l.rodape.saboresSemFicha} sabores sem ficha · cobertura ${l.rodape.cobertura == null ? 'a apurar' : (l.rodape.cobertura * 100).toFixed(1) + '%'}`)

  console.log('\n═══ 3. A BANCADA — o catálogo')
  let cat = await lerMontador(CO, prisma)
  console.log(`  canais ${cat.canais.length} · tamanhos ${cat.tamanhos.length} · sabores ${cat.sabores.length} (com ficha: ${cat.sabores.filter((s) => s.temFicha).length})`)
  for (const f of cat.faltando) console.log(`  ⚠️ ${f.frase}`)

  if (cat.canais.length === 0 || cat.tamanhos.length === 0) {
    console.log('\n  ⭐ SEMEANDO pela ROTA REAL (gesto do dono, com rastro)')
    const r = await fetch(`${base}/api/empresas/${CO}/margem/config`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'SEMEAR' }),
    })
    console.log(`     HTTP ${r.status} · ${JSON.stringify(await r.json())}`)
    cat = await lerMontador(CO, prisma)
  }
  console.log(`  canais: ${cat.canais.map((c) => `${c.nome}=${c.taxaPct == null ? 'a declarar' : (c.taxaPct * 100) + '%'}`).join(' · ')}`)
  console.log(`  tamanhos: ${cat.tamanhos.map((t) => `${t.tamanho}(${t.sabores}${t.derivadoDe ? `←${t.derivadoDe}` : ''}${t.base ? ' base✓' : ' SEM BASE'})`).join(' · ')}`)
  console.log(`  os 3 sabores mais caros: ${cat.sabores.filter((s) => s.custo != null).sort((a, b) => b.custo! - a.custo!).slice(0, 3).map((s) => `${s.nome} ${brl(s.custo)}`).join(' · ')}`)
  console.log(`  sabores SEM ficha na lista: ${cat.sabores.filter((s) => !s.temFicha).length}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error('FALHOU:', e?.message ?? e); process.exit(1) })
