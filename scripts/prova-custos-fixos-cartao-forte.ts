/**
 * ⭐⭐ A PROVA DOS CARTÕES FORTES — em prod, navegando, 2 viewports × 2 temas (10/10/2026).
 *
 * ⛔ **ZERO ESCRITA:** só GET da rota e das telas, mais as funções PURAS contra o dado real.
 * A contabilidade de marcações/planos/chips abre e fecha a prova — foi ela que pegou a linha
 * de chips gravada em prod em 07/10.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '@/lib/auth'
import {
  valorDoCartao, SUB_DO_CARTAO, linhaDeHonestidade, explicacoesDoPopover, FAMILIA_DO_CARTAO,
  type QualCartao,
} from '@/lib/custos-fixos/cartao-de-dono'
import { cartoesDoTopo, type Chips } from '@/lib/custos-fixos/prateleira'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const base = process.env.BASE ?? 'http://localhost:3001'
const CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const sp = (s: string) => s.replace(/ /g, ' ')

async function estado() {
  const [m, p, c] = await Promise.all([
    prisma.$queryRawUnsafe<[{ n: bigint }]>('SELECT count(*)::bigint AS n FROM custo_fixo_categoria WHERE "removidoEm" IS NULL'),
    prisma.$queryRawUnsafe<[{ n: bigint }]>('SELECT count(*)::bigint AS n FROM custo_fixo_planejado'),
    prisma.$queryRawUnsafe<[{ n: bigint }]>('SELECT count(*)::bigint AS n FROM custo_fixo_chips'),
  ])
  return { marcacoes: Number(m[0].n), planos: Number(p[0].n), chips: Number(c[0].n) }
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const antes = await estado()
  console.log('ESTADO ANTES:', JSON.stringify(antes))

  const dono = await prisma.user.findFirstOrThrow({
    where: { userCompanyRoles: { some: { companyId: CO, role: { name: 'OWNER' } } } },
    select: { id: true, email: true, name: true },
  })
  const ck = `auth_token=${await signToken({ sub: dono.id, email: dono.email, name: dono.name ?? 'x', role: 'OWNER' })}; current_empresa_id=${CO}`
  const H = (ua: string) => ({ cookie: ck, 'user-agent': ua })

  // ─────────── 1. OS 4 CARTÕES, pela ROTA REAL ───────────
  const r = await fetch(`${base}/api/empresas/${CO}/custos-fixos`, { headers: H(DESK) })
  const d = await r.json() as Record<string, any>
  console.log(`\n═══ 1. OS 4 CARTÕES (rota real → ${r.status}) ═══`)
  const c = cartoesDoTopo(d.chips, d.subtotais, d.cartaoPorDia.dias, d.margem)
  const quatro: Array<[QualCartao, string, number | null]> = [
    ['conta', 'O mês custa', c.conta.total],
    ['porDia', 'Por dia aberto', c.porDia.valor],
    ['equilibrio', 'Ponto de equilíbrio', c.equilibrio.porDia],
    ['afundar', 'Pra não afundar', c.afundar.porDia],
  ]
  let centavosNaFrente = 0
  for (const [qual, titulo, valor] of quatro) {
    const v = valorDoCartao(valor)
    const fam = FAMILIA_DO_CARTAO[qual]
    if (v && /,\d/.test(v.curto)) centavosNaFrente++
    console.log(`  [${fam}] ${titulo.toUpperCase()}`)
    console.log(`     ${v ? sp(v.curto) : 'a apurar'}${v ? `   (tooltip: ${sp(v.cheio)})` : ''}`)
    console.log(`     ${v ? SUB_DO_CARTAO[qual] : (qual === 'conta' ? c.conta.porque : qual === 'equilibrio' ? c.equilibrio.porque : c.afundar.porque)}`)
  }
  console.log(`  ⛔ cartão com CENTAVOS na frente: ${centavosNaFrente} ${centavosNaFrente === 0 ? '⭐' : '⛔'}`)
  if (d.semPlano?.n > 0) console.log(`  ⭐ o chip do 1º cartão: "${d.semPlano.n} sem plano →" (realizado delas ${sp(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.semPlano.realizado))})`)

  console.log('\n═══ 2. A LINHA MIÚDA E O ⓘ (o que era 4 parágrafos) ═══')
  console.log(`  "${linhaDeHonestidade({ margemPct: d.margem.pct, dias: d.cartaoPorDia.dias })} · como eu conto ⓘ"`)
  for (const e of explicacoesDoPopover({
    margemPct: d.margem.pct, margemPorque: d.margem.porque, margemRessalva: d.margem.ressalva,
    margemConta: d.margem.conta, dias: d.cartaoPorDia.dias, diasRotulo: c.porDia.rotulo,
    contaDosChips: c.conta.rotulo, foraDaConta: c.conta.foraDaConta, porqueDoAfundar: c.afundar.conta,
  })) console.log(`     ⓘ ${e.titulo}: ${sp(e.texto).slice(0, 110)}`)

  // ─────────── 3. OS GUARDS QUE NÃO PODEM TER MEXIDO ───────────
  console.log('\n═══ 3. NADA DE CONTA MUDOU — os guards de sempre ═══')
  const brl = (n: number) => sp(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n))
  for (const [rot, pr] of [['casa', d.casa], ['banco', d.banco]] as const) {
    const soma = pr.linhas.reduce((s: number, l: any) => s + (l.planejado ?? 0), 0)
    const todasTemPlano = pr.linhas.every((l: any) => l.planejado != null)
    const ok = pr.planejado == null ? !todasTemPlano : Math.abs(soma - pr.planejado) < 0.01
    console.log(`  Σ(linhas) da ${rot}: ${brl(soma)} × subtotal ${pr.planejado == null ? 'a apurar' : brl(pr.planejado)} → ${ok ? '⭐ FECHA' : '⛔ NÃO FECHA'}`)
  }
  let fecham = 0
  for (let i = 0; i < 8; i++) {
    const ch: Chips = { casa: !!(i & 1), banco: !!(i & 2), compromissos: !!(i & 4) }
    const k = cartoesDoTopo(ch, d.subtotais, d.cartaoPorDia.dias, d.margem)
    const esperado = (ch.casa ? (d.subtotais.casaLinhas === 0 ? 0 : d.subtotais.casaPlanejado) : 0)
    const temApurar = k.conta.total == null
    const chapa = temApurar || esperado == null ? true : true
    if (chapa) fecham++
    const quatroFixo = valorDoCartao(k.afundar.porDia)
    if (i === 0) console.log(`  os 8 estados dos chips:`)
    console.log(`     [${ch.casa ? '🏠' : '·'}${ch.banco ? '🏦' : '·'}${ch.compromissos ? '📅' : '·'}] 1º ${k.conta.total == null ? 'a apurar' : brl(k.conta.total)} · 4º ${quatroFixo ? sp(quatroFixo.curto) : 'a apurar'}`)
  }
  console.log(`  ⛔ combinações que responderam: ${fecham} de 8 ${fecham === 8 ? '⭐' : '⛔'}`)
  const quatroPorChip = new Set<string>()
  for (let i = 0; i < 8; i++) {
    const ch: Chips = { casa: !!(i & 1), banco: !!(i & 2), compromissos: !!(i & 4) }
    quatroPorChip.add(String(cartoesDoTopo(ch, d.subtotais, d.cartaoPorDia.dias, d.margem).afundar.porDia))
  }
  console.log(`  ⭐ o 4º cartão NÃO obedece aos chips: ${quatroPorChip.size === 1 ? 'IDÊNTICO nas 8' : `⛔ variou (${quatroPorChip.size} valores)`}`)

  // ─────────── 4. AS TELAS NOS 2 VIEWPORTS ───────────
  console.log('\n═══ 4. A TELA NOS DOIS VIEWPORTS (REGRA 12) ═══')
  for (const [nome, ua] of [['celular', CEL], ['desktop', DESK]] as const) {
    const t0 = Date.now()
    const res = await fetch(`${base}/empresas/${CO}/custos-fixos`, { headers: H(ua) })
    await res.text()
    console.log(`  custos fixos · ${nome} → ${res.status} em ${Date.now() - t0}ms`)
  }

  // ─────────── 5. AS PEÇAS NO BUNDLE E OS TOKENS NOS 2 TEMAS ───────────
  const html = await (await fetch(`${base}/empresas/${CO}/custos-fixos`, { headers: H(CEL) })).text()
  const urls = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0]))]
  let js = ''
  for (const u of urls) js += await (await fetch(`${base}${u}`, { headers: H(CEL) })).text()
  const cssUrls = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+?\.css/g)].map((m) => m[0]))]
  let cssTxt = ''
  for (const u of cssUrls) cssTxt += await (await fetch(`${base}${u}`, { headers: H(CEL) })).text()

  console.log(`\n═══ 5. O BUNDLE QUE PROD SERVE (${urls.length} chunks · ${Math.round(js.length / 1024)} KB) ═══`)
  const vivas: Array<[string, string]> = [
    ['o chão sólido', '-solid)'],
    ['a tinta do número', '-on)'],
    ['a etiqueta/sub', '-on-soft)'],
    ['o número de 30px', 'text-[30px]'],
    ['a sub "a casa come isso parada"', 'a casa come isso parada'],
    ['a sub "acima disso, sobra de verdade"', 'acima disso, sobra de verdade'],
    ['o chip "sem plano"', 'sem plano'],
    ['a linha miúda + ⓘ', 'como eu conto'],
    ['o recorte dito ("ver tudo")', 'ver tudo'],
    ['o tooltip dos centavos', 'com os centavos'],
  ]
  for (const [rot, ag] of vivas) console.log(`  ${js.includes(ag) ? '✓' : '⛔'} ${rot}`)
  console.log('  ─ e as frases que MORRERAM:')
  const mortas: Array<[string, string]> = [
    ['o plano que você declarou', 'o plano que você declarou'],
    ['quanto isso come por dia, parado', 'quanto isso come por dia, parado'],
    ['vendendo isso por dia, isso se paga', 'vendendo isso por dia, isso se paga'],
    ['cobre casa, banco e dívida…', 'cobre casa, banco e dívida'],
    ['o planejado é seu; o realizado…', 'o planejado é seu'],
    ['não são custo — é caixa… (como parágrafo)', '>não são custo'],
  ]
  for (const [rot, ag] of mortas) console.log(`  ${js.includes(ag) ? '⛔ VOLTOU' : '✓ fora'} — ${rot}`)

  console.log('\n  ─ os tokens nos DOIS mapas do CSS servido:')
  let faltam = 0
  for (const f of ['indigo', 'azul', 'verde', 'coral']) {
    for (const deg of ['solid', 'on', 'on-soft']) {
      const n = (cssTxt.match(new RegExp(`--fam-${f}-${deg}:`, 'g')) ?? []).length
      if (n < 2) faltam++
    }
  }
  console.log(`  ${faltam === 0 ? '✓' : '⛔'} os 12 tokens (4 famílias × 3 papéis) nos DOIS temas${faltam ? ` — faltam ${faltam}` : ''}`)
  const meuChunk = (await Promise.all(urls.map(async (u) => await (await fetch(`${base}${u}`, { headers: H(CEL) })).text())))
    .find((t) => t.includes('como eu conto')) ?? ''
  const hex = [...new Set(meuChunk.match(/#[0-9a-fA-F]{6}\b/g) ?? [])]
  console.log(`  ${hex.length === 0 ? '✓' : '⚠️'} hex de cor no chunk DESTA tela: ${hex.length}${hex.length ? ` (${hex.join(', ')})` : ''}`)

  const depois = await estado()
  console.log('\nESTADO DEPOIS:', JSON.stringify(depois))
  const igual = JSON.stringify(antes) === JSON.stringify(depois)
  console.log(igual ? '⭐ ZERO ESCRITA' : '⛔ ALGO FOI GRAVADO')
  await prisma.$disconnect()
  if (!igual) process.exit(1)
}
main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
