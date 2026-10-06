/**
 * ⭐⭐ A PÁGINA DO ITEM v4 EM PROD — navegando, no PIOR CASO (06/10/2026).
 *
 * **Ordem do dono:** *"red-then-green NAVEGANDO na ervilha real (negativa, custo nulo — o pior
 * caso é o teste) · zero escrita em prod"*.
 *
 * ⚠️ A prova é do que a TELA carrega e do que o BUNDLE serve, nos DOIS viewports (REGRA 12) e
 * nos DOIS temas (os tokens têm que existir nos dois mapas do CSS). ⚠️ E o minificador escapa
 * não-ASCII (`produ\xe7\xe3o`) — procuro as duas formas.
 *
 * ⛔ READ-ONLY: só GET.
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { signToken } from '../lib/auth'
import { usadoEmFichas } from '../lib/stock/item/usado-em-fichas'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
/** ⭐ o pior caso: negativa, dinheiro positivo e custo médio NULO */
const ERVILHA = 'cmtepoogz000cco6n5buy5x1u'
/** ⭐ e um item SÃO, de giro alto — é nele que cobertura e mínimo sugerido aparecem */
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const n3 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

function presente(js: string, frase: string): boolean {
  if (js.includes(frase)) return true
  const esc = [...frase].map((c) => (c.charCodeAt(0) > 127 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join('')
  return js.includes(esc)
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome} (${CO})`)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const movsAntes = await prisma.stockMovement.count({ where: { companyId: CO } })

  /** ⭐ um item SÃO de verdade: o que mais girou nos últimos 30 dias */
  const giro = await prisma.stockMovement.groupBy({
    by: ['itemId'],
    where: { companyId: CO, tipo: { in: ['BAIXA_VENDA', 'SEPARACAO_SAIDA'] }, dataMovimento: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    _sum: { quantidade: true },
  })
  const candidatos = giro.sort((a, b) => Math.abs(b._sum.quantidade ?? 0) - Math.abs(a._sum.quantidade ?? 0))

  // ─────────── 1. A ROTA: o payload que a tela recebe ───────────
  for (const [rotulo, itemId] of [['ERVILHA (o pior caso)', ERVILHA], ['o item de MAIOR GIRO', candidatos[0]?.itemId ?? ERVILHA]] as const) {
    const r = await fetch(`${BASE}/api/empresas/${CO}/estoque/itens/${itemId}`, { headers: { cookie } })
    const j = await r.json()
    const f = j.ficha
    if (!f) { console.log(`\n⛔ ${rotulo}: payload vazio (HTTP ${r.status})`); continue }
    console.log(`\n══════ ${rotulo} ══════`)
    console.log(`«${f.item.nome}» · ${f.item.categoriaLabel} · controle em ${f.item.unidadeControle}`)
    console.log(`  PÍLULA: [${f.pilula.tom}] ${f.pilula.label}${f.pilula.porque ? ` — ${f.pilula.porque}` : ''}`)
    console.log(`  saldo ${n3(f.saldo)} · custo médio ${f.custoMedio != null ? brl(f.custoMedio) : '—'} · valor ${brl(f.valor)}`)
    console.log(`  COBERTURA: ${f.cobertura.dias != null ? `~${f.cobertura.dias} dias` : `— (${f.cobertura.porque})`} · consumo ${n3(f.consumo.consumoNaJanela)} em ${f.consumo.diasDaJanela}d · ${f.consumo.porDia != null ? `${n3(f.consumo.porDia)}/dia` : 'sem giro'}`)
    console.log(`  MÍNIMO SUGERIDO: ${f.sugestaoMinimo.minimo != null ? `~${n3(f.sugestaoMinimo.minimo)} ${f.item.unidadeControle}` : '— (sem dado suficiente)'}`)
    if (f.sugestaoMinimo.conta) console.log(`     conta: ${f.sugestaoMinimo.conta}`)
    console.log(`  dias sem movimento: ${f.diasSemMovimento ?? 'nunca se moveu'}`)
    console.log(`  USADO EM ${f.usoEmFichas.fichas.length} ficha(s) · suspeitas: ${f.usoEmFichas.suspeitas}`)
    for (const x of f.usoEmFichas.fichas.slice(0, 6)) {
      console.log(`     ${x.suspeita ? '⛔' : '·'} ${x.nome} [${x.tipoLabel} v${x.versao}] → ${x.doseTexto}${x.suspeita ? `  ⚠️ ${x.suspeita.frase}` : ''}`)
    }
    console.log(`  Σ DO RODAPÉ: ${n3(f.conferencia.somaQuantidade)} × saldo ${n3(f.conferencia.saldo)} · ${brl(f.conferencia.somaValor)} × ${brl(f.conferencia.valor)} → ${f.conferencia.confere ? '⭐ BATE' : '⛔ NÃO BATE'}`)
    console.log(`  histórico: ${f.historico.length} linha(s) · ${f.anulados} anulada(s) · preço no tempo: ${f.precoTempo.length} ponto(s)`)
    if (f.categoriaRastro) console.log(`  rastro da classificação: ${f.categoriaRastro.de} → ${f.categoriaRastro.para} por ${f.categoriaRastro.quem ?? '—'}`)
  }

  // ─────────── 2. A PÁGINA + O BUNDLE, nos dois viewports ───────────
  const exigidas: [string, string][] = [
    ['a pílula de estado', 'pilula'],
    ['a cobertura', 'Cobertura'],
    ['a busca reversa', 'Usado em'],
    ['a dose suspeita', 'corrigir agora'],
    ['o mínimo sugerido', 'usar no campo'],
    ['o resumo do recorte', 'fora da conta'],
    ['a LINHA DO ZERO', 'ficou negativo aqui'],
    ['o custo indisponível', 'custo indisponível'],
    ['o saldo no tempo', 'Saldo no tempo'],
    ['o Σ que bate com o saldo', 'bate com o saldo em estoque'],
    ['converter a unidade (mantido)', 'Converter a unidade'],
    ['o forense (mantido)', 'mostrar tudo (forense)'],
    ['as DUAS portas do negativo', 'contar este item'],
  ]
  const tokens = ['--prod-surface', '--prod-accent', '--prod-coral', '--fam-coral-bg', '--fam-ambar-mid', '--fam-indigo-bg', '--prod-acao-bg']

  for (const [vp, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${BASE}/empresas/${CO}/estoque/itens/${ERVILHA}`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0]))]
    const css = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.css/g)].map((m) => m[0]))]
    const js = (await Promise.all(chunks.map(async (c) => (await fetch(`${BASE}${c}`)).text()))).join('')
    const folhas = (await Promise.all(css.map(async (c) => (await fetch(`${BASE}${c}`)).text()))).join('')
    console.log(`\n── ${vp.toUpperCase()} · PAGE ${r.status} em ${Date.now() - t0}ms · JS ${(js.length / 1024).toFixed(0)} KB · CSS ${(folhas.length / 1024).toFixed(0)} KB`)
    let ok = 0
    for (const [rot, frase] of exigidas) {
      const p = presente(js, frase)
      if (p) ok++
      else console.log(`   ⛔ ${rot} ("${frase}")`)
    }
    console.log(`   ✓ ${ok}/${exigidas.length} peças no bundle`)
    /**
     * ⛔⛔ O HEX SÓ CONTA NO CHUNK **DESTA** TELA.
     *
     * ⚠️⚠️ A 1ª versão desta sonda somava os 81 chunks da página — que incluem o SHELL e os
     * outros componentes do dashboard, onde o `#185FA5` ainda vive em 49 arquivos. Ela
     * acusava "hex cravado voltou" medindo código que não é desta tela: **achado não
     * atribuível não é achado**. Agora ela acha o chunk que carrega uma frase EXCLUSIVA da
     * página e mede só ele.
     */
    const meuChunk = (await Promise.all(chunks.map(async (c) => ({ c, t: await (await fetch(`${BASE}${c}`)).text() }))))
      .filter((x) => presente(x.t, 'ficou negativo aqui'))
    const hexAqui = meuChunk.filter((x) => x.t.includes('#185FA5'))
    console.log(`   ${meuChunk.length === 0 ? '⚠️ não achei o chunk da tela' : hexAqui.length ? `⛔ hex cravado no chunk da tela (${hexAqui.length})` : `✓ zero hex no chunk da tela (${meuChunk.length} chunk)`}`)
    // ⭐ os tokens existem nos DOIS mapas do CSS (claro e escuro)
    const faltando = tokens.filter((t) => (folhas.match(new RegExp(t.replace(/-/g, '\\-'), 'g')) ?? []).length < 2)
    console.log(`   ${faltando.length === 0 ? '✓ os 7 tokens nos DOIS temas' : `⛔ só num tema: ${faltando.join(', ')}`}`)
  }

  /**
   * ⭐⭐ O MAPA DA CLASSE — quantas doses suspeitas a régua acha na empresa inteira.
   * ⚠️ Só LEITURA: a régua marca e a tela mostra; **corrigir receita é gesto do dono** (17/08).
   */
  console.log('\n══════ O MAPA DAS DOSES SUSPEITAS (empresa inteira) ══════')
  const comFicha = await prisma.stockFichaComponente.groupBy({ by: ['itemId'], where: { companyId: CO }, _count: { itemId: true } })
  let achados = 0
  for (const g of comFicha) {
    const u = await usadoEmFichas(CO, g.itemId, prisma)
    if (!u.suspeitas) continue
    const it = await prisma.stockItem.findUnique({ where: { id: g.itemId }, select: { nome: true } })
    for (const f of u.fichas.filter((x) => x.suspeita)) {
      achados++
      console.log(`  ⛔ «${it?.nome}» em «${f.nome}»: ${f.doseTexto} · ${f.suspeita!.frase}`)
    }
  }
  console.log(`  → ${achados} dose(s) suspeita(s) em ${comFicha.length} itens que são componente de alguma ficha`)

  const movsDepois = await prisma.stockMovement.count({ where: { companyId: CO } })
  console.log(`\nmovimentos ${movsAntes} → ${movsDepois} · ${movsAntes === movsDepois ? '⭐ ZERO ESCRITA (só GET)' : '⛔ algo gravou'}`)
}

main()
  .catch((e) => { console.error('⛔', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
