/**
 * 🔬 PERÍCIA DO REPLAY — read-only, imprime o custo médio ANDANDO pela história do item.
 *
 * ⚠️ Existe porque o preview do backfill devolveu **R$ 0,47** pra a «metade de bolinha massa
 * de pizza» e o dono esperava **~0,54**. Diferença de número do dono não se aceita nem se
 * contesta: **mede-se**. Este script não decide nada — ele mostra, passo a passo, de onde o
 * replay tira a resposta, pra o número ser defensável (ou o defeito aparecer).
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { idsDeEstornoInterno, movePrateleira } from '@/lib/stock/prateleira'
import { TIPOS_COM_CUSTO_CONHECIDO } from '@/lib/stock/contagem-ancora'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const ALVOS = (process.env.ALVOS ?? 'metade de bolinha,CUBA MAIONESE,fermento').split(',')
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const brl = (n: number | null) => (n == null ? 'a definir' : `R$ ${n.toFixed(4)}`)

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const itens = await prisma.stockItem.findMany({
    where: { companyId: EMPRESA },
    select: { id: true, nome: true, unidadeControle: true },
  })

  for (const alvo of ALVOS) {
    const it = itens.find((i) => i.nome.toLowerCase().includes(alvo.trim().toLowerCase()))
    if (!it) { console.log(`\n⚠️ não achei item com «${alvo}»`); continue }

    const fora = await idsDeEstornoInterno(prisma, EMPRESA, it.id)
    const movs = await prisma.stockMovement.findMany({
      where: { companyId: EMPRESA, itemId: it.id, id: { notIn: fora.length ? fora : ['-'] } },
      orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }],
      select: { id: true, tipo: true, quantidade: true, custoTotal: true, dataMovimento: true },
    })

    console.log(`\n═══ ${it.nome} (${it.unidadeControle}) · ${movs.length} movimento(s) na prateleira ═══`)
    let q = 0, v = 0, memoria: number | null = null
    for (const m of movs) {
      if (!movePrateleira(m.tipo)) continue
      const qAntes = q, vAntes = v
      q = r2(q + m.quantidade)
      v = r2(v + m.custoTotal)

      // a MESMA lei do replay: saldo > 0 → valor/saldo; senão a entrada que ensina
      let nota = ''
      if (q > 0) {
        const c = r2(v / q)
        if (c > 0) { memoria = c; nota = '← média do momento' }
      } else if (TIPOS_COM_CUSTO_CONHECIDO.includes(m.tipo) && m.quantidade > 0 && m.custoTotal > 0) {
        const c = qAntes > 0 ? r2((vAntes + m.custoTotal) / (qAntes + m.quantidade)) : r2(m.custoTotal / m.quantidade)
        if (c > 0) { memoria = c; nota = '← ENTRADA que ensina (saldo ≤ 0)' }
      }
      const d = m.dataMovimento.toISOString().slice(0, 10)
      console.log(
        `  ${d} ${m.tipo.padEnd(20)} qtd ${String(m.quantidade).padStart(11)} · R$ ${m.custoTotal.toFixed(2).padStart(10)}` +
        ` → saldo ${String(q).padStart(10)} · valor ${v.toFixed(2).padStart(10)} · memória ${brl(memoria).padStart(14)} ${nota}`,
      )
    }
    console.log(`  ⭐ VEREDITO DO REPLAY: ${brl(memoria)} · saldo final ${q} · valor final ${v.toFixed(2)}`)
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('⛔', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
