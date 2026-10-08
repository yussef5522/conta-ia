/**
 * 🍕 RETRATO DAS BASES DE PIZZA — read-only, ZERO escrita.
 *
 * ⛔ Mede ANTES de propor: quais fichas são candidatas a base, o que cada uma pede,
 * quais nomes do PDV apontam pra elas, e o custo de cada componente pelo ledger.
 *
 * REGRA 8b: prova em qual banco está antes de concluir.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number | null) => (n == null ? 'a definir' : `R$ ${n.toFixed(2)}`)

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  const [ctx, custoDe, fichas, bases, regras, mapProd] = await Promise.all([
    montarCtx(EMPRESA, prisma),
    custoMedioPorItem(prisma, EMPRESA),
    prisma.stockFicha.findMany({ where: { companyId: EMPRESA, ativo: true } }),
    prisma.stockBaseDoTamanho.findMany({ where: { companyId: EMPRESA } }),
    prisma.stockRegraSaboresTamanho.findMany({ where: { companyId: EMPRESA } }),
    prisma.stockVendaProdutoMap.findMany({ where: { companyId: EMPRESA } }),
  ])

  const itens = await prisma.stockItem.findMany({
    where: { companyId: EMPRESA },
    select: { id: true, nome: true, unidadeControle: true, categoria: true },
  })
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const unItem = new Map(itens.map((i) => [i.id, i.unidadeControle]))
  const nomeDaFicha = (fid: string) => {
    const f = fichas.find((x) => x.id === fid)
    return f ? (nomeItem.get(f.itemProduzidoId) ?? '(sem item)') : '(ficha inexistente)'
  }

  const custoDeUma = (fichaId: string) => {
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId }, 1, ctx, acc)
    if (acc.size === 0) return { custo: null as number | null, folhas: [] as [string, number][] }
    let t = 0
    let incompleto = false
    for (const [itemId, q] of acc) {
      const c = custoDe.get(itemId)
      if (c == null) incompleto = true
      else t += c * q
    }
    return { custo: incompleto ? null : Math.round(t * 100) / 100, folhas: [...acc] }
  }

  console.log('\n═══════ 1. OS ITENS QUE A COMPOSIÇÃO CANÔNICA PEDE ═══════')
  const alvos = ['massa', 'queijo 135', 'caixa', 'molho']
  for (const a of alvos) {
    const achados = itens.filter((i) => i.nome.toLowerCase().includes(a))
    console.log(`\n  «${a}» → ${achados.length}`)
    for (const i of achados) {
      console.log(
        `    [${i.id.slice(-6)}] ${i.nome} · ${i.unidadeControle} · ${i.categoria} · custo ${brl(custoDe.get(i.id) ?? null)}`,
      )
    }
  }

  console.log('\n═══════ 2. REGRAS DE SABORES E BASES APONTADAS HOJE ═══════')
  console.log(`  regras: ${regras.map((r) => `${r.tamanho}=${r.sabores}`).join(' · ') || 'NENHUMA'}`)
  console.log(`  bases:  ${bases.length}`)
  for (const b of bases) {
    const c = custoDeUma(b.fichaId)
    console.log(`    ${b.tamanho} → «${nomeDaFicha(b.fichaId)}» [${b.fichaId.slice(-6)}] custo ${brl(c.custo)}`)
  }

  console.log('\n═══════ 3. TODAS AS FICHAS COM CARA DE BASE DE PIZZA ═══════')
  const candidatas = fichas.filter((f) => {
    const n = (nomeItem.get(f.itemProduzidoId) ?? '').toUpperCase()
    return n.includes('PIZZA') || n.includes('PRECINHO')
  })
  console.log(`  ${candidatas.length} candidatas\n`)
  for (const f of candidatas) {
    const nome = nomeItem.get(f.itemProduzidoId) ?? '(sem item)'
    const v = await prisma.stockFichaVersao.findFirst({
      where: { companyId: EMPRESA, fichaId: f.id, versao: f.versaoAtual },
    })
    const comps = v
      ? await prisma.stockFichaComponente.findMany({
          where: { companyId: EMPRESA, versaoId: v.id },
          orderBy: { posicao: 'asc' },
        })
      : []
    const c = custoDeUma(f.id)
    const nomesPdv = mapProd.filter((m) => m.alvoTipo === 'FICHA' && m.fichaId === f.id).map((m) => m.nomeSuitable)
    console.log(`  ─── «${nome}» [${f.id.slice(-6)}] v${f.versaoAtual} · tipo ${f.tipoProduto} · custo ${brl(c.custo)}`)
    console.log(`      lote base: ${v?.loteBase ?? '?'} ${v?.unidadeLoteBase ?? ''}`)
    if (!comps.length) console.log('      ⛔ SEM COMPONENTE')
    for (const cp of comps) {
      const cu = custoDe.get(cp.itemId)
      console.log(
        `      · ${cp.qtdPlanejada} ${cp.unidade} de «${nomeItem.get(cp.itemId) ?? cp.itemId}» (${unItem.get(cp.itemId) ?? '?'}) → ${cu == null ? 'sem custo' : `R$ ${(cu * cp.qtdPlanejada).toFixed(2)}`}`,
      )
    }
    console.log(`      PDV aponta: ${nomesPdv.length ? nomesPdv.join(' | ') : '(nenhum)'}`)
  }

  console.log('\n═══════ 4. NOMES DO PDV COM "PIZZA/PRECINHO" (todos os destinos) ═══════')
  const pdvPizza = mapProd.filter((m) => /PIZZA|PRECINHO/i.test(m.nomeSuitable))
  console.log(`  ${pdvPizza.length} nomes`)
  for (const m of pdvPizza) {
    const dest =
      m.alvoTipo === 'FICHA' && m.fichaId
        ? `FICHA «${nomeDaFicha(m.fichaId)}» [${m.fichaId.slice(-6)}]`
        : `${m.alvoTipo}${m.itemId ? ` item «${nomeItem.get(m.itemId) ?? m.itemId}»` : ''}`
    console.log(`    «${m.nomeSuitable}» → ${dest}`)
  }

  console.log('\n═══════ 5. VENDAS POR NOME DO PDV (30 dias) ═══════')
  const desde = new Date(Date.now() - 30 * 86_400_000)
  const linhas = await prisma.stockVendaLinha.groupBy({
    by: ['nomeSuitable'],
    where: { companyId: EMPRESA, data: { gte: desde } },
    _sum: { quantidade: true },
  })
  const vendidas = linhas
    .filter((l) => /PIZZA|PRECINHO/i.test(l.nomeSuitable))
    .sort((a, b) => (b._sum.quantidade ?? 0) - (a._sum.quantidade ?? 0))
  for (const v of vendidas) console.log(`    ${String(v._sum.quantidade ?? 0).padStart(5)} × «${v.nomeSuitable}»`)
  console.log(`  total de pizzas vendidas (30d): ${vendidas.reduce((s, v) => s + (v._sum.quantidade ?? 0), 0)}`)

  console.log('\n⭐ ZERO ESCRITA — só leitura.\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
