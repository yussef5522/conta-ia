/**
 * 🍕 PREÇO PRATICADO POR NOME DO PDV + nomes de pizza SEM destino — read-only.
 *
 * ⛔ É o preço que decide o que é DUPLICATA DE GRAFIA (mesmo produto, dois nomes) e o que é
 * PONTO DE PREÇO DIFERENTE (promo, app) — juntar dois preços numa ficha só faria a margem
 * virar média ponderada e esconder justamente o produto de margem apertada.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const desde = new Date(Date.now() - 30 * 86_400_000)

  const [linhas, mapa] = await Promise.all([
    prisma.stockVendaLinha.groupBy({
      by: ['nomeSuitable'],
      where: { companyId: EMPRESA, data: { gte: desde } },
      _sum: { quantidade: true, valorTotal: true },
    }),
    prisma.stockVendaProdutoMap.findMany({ where: { companyId: EMPRESA } }),
  ])
  const temDestino = new Set(mapa.map((m) => m.nomeSuitable))

  const pizzas = linhas
    .filter((l) => /PIZZA|PRECINHO/i.test(l.nomeSuitable))
    .map((l) => {
      const q = l._sum.quantidade ?? 0
      const v = l._sum.valorTotal ?? 0
      return { nome: l.nomeSuitable, q, v, preco: q > 0 ? v / q : null, mapeado: temDestino.has(l.nomeSuitable) }
    })
    .sort((a, b) => b.q - a.q)

  console.log('\n═══════ PREÇO PRATICADO (30 dias) ═══════')
  for (const p of pizzas) {
    console.log(
      `  ${p.mapeado ? '✓' : '⛔'} ${String(p.q).padStart(5)} × R$ ${(p.preco ?? 0).toFixed(2).padStart(7)} = R$ ${p.v.toFixed(2).padStart(10)}  «${p.nome}»`,
    )
  }
  const semDestino = pizzas.filter((p) => !p.mapeado)
  console.log(`\n⛔ nomes de pizza SEM destino: ${semDestino.length} · ${semDestino.reduce((s, p) => s + p.q, 0)} unidades`)

  console.log('\n═══════ MESMO PREÇO = MESMO PRODUTO? (candidatos a duplicata de grafia) ═══════')
  const porPreco = new Map<string, typeof pizzas>()
  for (const p of pizzas) {
    if (p.preco == null) continue
    const k = p.preco.toFixed(2)
    if (!porPreco.has(k)) porPreco.set(k, [])
    porPreco.get(k)!.push(p)
  }
  for (const [k, g] of [...porPreco].sort((a, b) => b[1].length - a[1].length)) {
    if (g.length < 2) continue
    console.log(`  R$ ${k} → ${g.map((x) => `«${x.nome}» (${x.q})`).join(' · ')}`)
  }

  console.log('\n⭐ ZERO ESCRITA.\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
