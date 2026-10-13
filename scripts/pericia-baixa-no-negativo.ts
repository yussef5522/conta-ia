/**
 * 🔬 ITEM 4 DO DONO — **INVESTIGAR E SÓ RELATAR** (nada se corrige aqui).
 *
 * *"Com saldo negativo, a baixa de venda/produção lança valor como hoje? Números no relatório
 * — decisão do dono depois."*
 *
 * ⚠️ A resposta do CÓDIGO já é conhecida: `custoParaBaixar(valor, saldo)` devolve **0** quando
 * `saldo <= 0` (`lib/stock/residuo-de-centavos.ts`, usado na baixa de venda). O que faltava era
 * o TAMANHO disso em prod — e é o que este script mede, sem tocar em nada.
 *
 * ⚠️ O "deixou de lançar" usa a MEMÓRIA do item como referência de preço (o custo que o sprint
 * de 13/10 passou a guardar). ⛔ É uma ESTIMATIVA de ordem de grandeza, nunca um lançamento:
 * o custo real daquela saída não existe em lugar nenhum — ela saiu a zero.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { saldosDaEmpresa } from '@/lib/stock/saldo'
import { custoVigentePorItem } from '@/lib/stock/custo-vigente'
import { movePrateleira } from '@/lib/stock/prateleira'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const SAIDAS = ['BAIXA_VENDA', 'PRODUCAO_CONSUMO', 'SEPARACAO_SAIDA']
const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const saldos = await saldosDaEmpresa(prisma, EMPRESA)
  const memorias = await custoVigentePorItem(prisma, EMPRESA)
  const nomes = new Map(
    (await prisma.stockItem.findMany({ where: { companyId: EMPRESA }, select: { id: true, nome: true, unidadeControle: true } }))
      .map((i) => [i.id, i]),
  )

  let zeroN = 0, zeroQtd = 0, zeroEstimado = 0, comValorN = 0, comValorR$ = 0
  const porItem: { nome: string; un: string; n: number; qtd: number; estimado: number }[] = []
  const porTipo = new Map<string, { n: number; qtd: number }>()

  for (const s of saldos) {
    const movs = await prisma.stockMovement.findMany({
      where: { companyId: EMPRESA, itemId: s.itemId },
      orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }],
      select: { tipo: true, quantidade: true, custoTotal: true, dataMovimento: true },
    })
    const mem = memorias.get(s.itemId) ?? null
    let saldo = 0, n = 0, qtd = 0, est = 0
    for (const m of movs) {
      if (!movePrateleira(m.tipo)) continue
      const antes = saldo
      saldo = Math.round((saldo + m.quantidade) * 1000) / 1000
      if (!(m.quantidade < 0 && SAIDAS.includes(m.tipo))) continue
      if (antes > 0) continue // saída com estoque em pé: lança valor normalmente
      if (m.custoTotal === 0) {
        zeroN++; n++
        zeroQtd += Math.abs(m.quantidade); qtd += Math.abs(m.quantidade)
        if (mem != null) { const v = Math.abs(m.quantidade) * mem; zeroEstimado += v; est += v }
        const t = porTipo.get(m.tipo) ?? { n: 0, qtd: 0 }
        porTipo.set(m.tipo, { n: t.n + 1, qtd: t.qtd + Math.abs(m.quantidade) })
      } else {
        comValorN++; comValorR$ += Math.abs(m.custoTotal)
      }
    }
    if (n > 0) {
      const it = nomes.get(s.itemId)
      porItem.push({ nome: it?.nome ?? s.itemId, un: it?.unidadeControle ?? '', n, qtd, estimado: est })
    }
  }

  porItem.sort((a, b) => b.estimado - a.estimado)

  console.log('\n═══ SAÍDAS LANÇADAS COM O SALDO JÁ NO CHÃO (saldo ≤ 0 antes do movimento) ═══')
  console.log(`  ⭐ a CUSTO ZERO ....... ${zeroN} movimento(s) · ${zeroQtd.toFixed(3)} de quantidade`)
  console.log(`     estimativa do custo que NÃO foi lançado (qtd × memória): ${brl(zeroEstimado)}`)
  console.log(`  com valor ............. ${comValorN} movimento(s) · ${brl(comValorR$)}`)
  console.log('\n  por TIPO de movimento (os a custo zero):')
  for (const [t, v] of [...porTipo].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`    ${t.padEnd(20)} ${String(v.n).padStart(4)} mov · qtd ${v.qtd.toFixed(3)}`)
  }
  console.log('\n  os 10 itens com mais dinheiro estimado fora do CMV:')
  for (const p of porItem.slice(0, 10)) {
    console.log(`    ${brl(p.estimado).padStart(12)} · ${String(p.n).padStart(3)} mov · ${p.qtd.toFixed(3)} ${p.un.padEnd(2)} · ${p.nome}`)
  }
  console.log(`\n  itens afetados: ${porItem.length}`)
  console.log('\n⚠️ NADA FOI ALTERADO — este script é read-only. A decisão é do dono.')
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('⛔', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
