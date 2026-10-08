/**
 * ⭐⭐⭐ A FOTO DO ANTES × DEPOIS DA NORMALIZAÇÃO DAS BASES (08/10/2026).
 *
 * **Ordem do dono (item 4 do pedido de 07/10):** *"Red-then-green: custo da GRANDE antes ×
 * depois conferido NA MÃO contra `explodirReceita`, e a liga recalculando."*
 *
 * ⭐⭐ O "NA MÃO" É LITERAL: o script soma `qtd × custoMedio` componente a componente, **sem
 * passar pelo motor**, e exige que bata ao centavo com o que a PORTA ÚNICA (`explodir`, a mesma
 * que a baixa de venda executa) devolve. ⛔ Sem isso eu conferiria o motor contra ele mesmo — o
 * invariante circular de 28/08, que dá verde de graça.
 *
 * ⚠️ READ-ONLY. Rode ANTES de aplicar e DEPOIS, e compare as duas saídas.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { checkBaseInvariants } from '@/lib/margem/base-invariants'
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { lerMargem } from '@/lib/margem/leitura'
import { TAMANHOS_CANONICOS } from '@/lib/margem/bases-canonicas'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number | null | undefined) =>
  n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const p1 = (n: number | null | undefined) => (n == null ? 'a apurar' : `${(n * 100).toFixed(1)}%`)

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[antes/depois] ${nome.trim()}\n`)

  /* ══════════ 1. O JUIZ — B1/B2 ══════════ */
  console.log('═══ 1. O GUARD DO DONO (B1 erro · B2 aviso)')
  const falhas = (await checkBaseInvariants(prisma)).filter((f) => f.companyId === CO)
  const b1 = falhas.filter((f) => f.invariante === 'B1')
  const b2 = falhas.filter((f) => f.invariante === 'B2')
  console.log(`  B1: ${b1.length} · B2: ${b2.length}`)
  for (const f of [...b1, ...b2]) console.log(`   ${f.invariante} ${f.detalhe}`)

  /* ══════════ 2. AS BASES APONTADAS E O CUSTO, CONFERIDO NA MÃO ══════════ */
  console.log('\n═══ 2. AS BASES APONTADAS — custo PELA PORTA × somado NA MÃO')
  const bases = await prisma.stockBaseDoTamanho.findMany({
    where: { companyId: CO },
    select: { tamanho: true, fichaId: true },
  })
  const porTamanho = new Map(bases.map((b) => [b.tamanho, b.fichaId]))
  const custos = await custoMedioPorItem(prisma, CO)
  const ctx = await montarCtx(CO, prisma)

  for (const t of TAMANHOS_CANONICOS) {
    const fichaId = porTamanho.get(t)
    if (!fichaId) { console.log(`  ${t.padEnd(8)} — ⚠️ nenhuma base apontada`); continue }

    const ficha = await prisma.stockFicha.findUnique({
      where: { id: fichaId },
      select: { versaoAtual: true, itemProduzidoId: true },
    })
    const prod = await prisma.stockItem.findUnique({
      where: { id: ficha!.itemProduzidoId },
      select: { nome: true },
    })
    const v = await prisma.stockFichaVersao.findFirst({
      where: { fichaId, versao: ficha!.versaoAtual },
      select: { id: true, versao: true },
    })
    const comps = await prisma.stockFichaComponente.findMany({
      where: { versaoId: v!.id },
      select: { itemId: true, qtdPlanejada: true },
    })
    const itens = await prisma.stockItem.findMany({
      where: { id: { in: comps.map((c) => c.itemId) } },
      select: { id: true, nome: true },
    })
    const nomeDe = new Map(itens.map((i) => [i.id, i.nome]))

    /** ⭐ A SOMA NA MÃO — componente a componente, sem o motor no meio */
    let naMao = 0
    const linhas: string[] = []
    for (const c of comps) {
      const cm = custos.get(c.itemId) ?? null
      const sub = cm == null ? null : c.qtdPlanejada * cm
      if (sub != null) naMao += sub
      linhas.push(`      ${c.qtdPlanejada} × «${nomeDe.get(c.itemId)}» @ ${brl(cm)} = ${brl(sub)}`)
    }

    /** ⭐ A PORTA ÚNICA — a MESMA explosão que a baixa de venda executa */
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId }, 1, ctx, acc)
    let pelaPorta = 0
    for (const [itemId, qtd] of acc) {
      const cm = custos.get(itemId)
      if (cm != null) pelaPorta += qtd * cm
    }

    const bate = Math.abs(naMao - pelaPorta) < 0.005
    console.log(`  ${t.padEnd(8)} «${prod!.nome}» v${v!.versao} · ${comps.length} componentes`)
    for (const l of linhas) console.log(l)
    console.log(
      `      NA MÃO ${brl(naMao)} × PELA PORTA ${brl(pelaPorta)} → ${bate ? '⭐ BATE ao centavo' : '⛔ NÃO BATE'}`,
    )
  }

  /* ══════════ 3. A CASA E A LIGA — leitura ao vivo ══════════ */
  console.log('\n═══ 3. A CASA E A LIGA (leitura ao vivo — é o que recalcula sozinho)')
  const m = await lerMargem(CO, 'MES', new Date(), {}, prisma)
  const c = m.casa
  console.log(`  sobra BRUTA ${brl(c.sobraTotal)} · complementos ${brl(c.complementos.custo)} (piso: ${c.complementos.ocorrenciasSemCusto} ocorrências sem ficha) · LÍQUIDA ${brl(c.sobraLiquida)}`)
  console.log(`  a casa custou ${brl(c.custoFixo)} · ${c.composicao.texto}`)
  console.log(`  veredito ${c.veredito.estado} · cobertura ${p1(c.cobertura.pct)} · pago ${p1(c.pctPago)}`)
  console.log('  os 5 primeiros tijolos (quem carregou a casa):')
  for (const t of c.tijolos.slice(0, 5)) {
    console.log(`   ${t.nome.slice(0, 30).padEnd(30)} ${p1(t.pctDaCasa)} da casa · ${brl(t.sobraTotal)}`)
  }
  console.log(`  a liga (aba ${m.liga.aba}, Σ ${brl(m.liga.somaDaAba)}):`)
  for (const l of m.liga.linhas.slice(0, 6)) {
    console.log(`   ${l.nome.slice(0, 30).padEnd(30)} ${brl(l.sobraTotal).padStart(13)} · ${l.selo}`)
  }
  const fecha = Math.abs(m.liga.somaDaAba - c.sobraTotal) < 0.01
  console.log(`  ⛔ GUARD DO DONO: Σ(liga) ${brl(m.liga.somaDaAba)} == sobra bruta ${brl(c.sobraTotal)} → ${fecha ? '⭐ FECHA' : '⛔ NÃO FECHA'}`)

  /* ══════════ 4. CONTABILIDADE ══════════ */
  console.log('\n═══ 4. CONTABILIDADE')
  console.log(`  versões de ficha: ${await prisma.stockFichaVersao.count()}`)
  console.log(`  componentes:      ${await prisma.stockFichaComponente.count()}`)
  console.log(`  bases apontadas:  ${await prisma.stockBaseDoTamanho.count({ where: { companyId: CO } })}`)
  console.log(`  doses a declarar: ${await prisma.stockDoseADeclarar.count({ where: { companyId: CO } })}`)
  console.log(`  movimentos:       ${await prisma.stockMovement.count({ where: { companyId: CO } })}`)
}

main()
  .catch((e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
