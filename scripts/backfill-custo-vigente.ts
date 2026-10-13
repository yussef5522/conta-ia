/**
 * ⭐⭐ BACKFILL DA MEMÓRIA DO CUSTO (13/10/2026) — **escrita AUTORIZADA pelo dono.**
 *
 * *"Para cada item com custo nulo hoje mas com histórico de movimento com valor, preencher
 * custoMedioVigente com o último custo médio que o item teve."*
 *
 * ⛔ **E ELE NÃO INVENTA NADA:** o número vem de `memoriaDoLedger`, que replaya a MESMA lei
 * que o writer executa — então o backfill é literalmente *"o que o writer teria gravado se ele
 * existisse desde o começo"*. Item sem entrada com valor na história **fica sem linha**, e a
 * porta continua dizendo *"a definir"* (o honesto).
 *
 * ⚠️ PREVIEW por default. `--aplicar` grava. `pg_dump` ANTES, conferido pelo TAMANHO do
 * arquivo (a cicatriz de 28/09: *dump de 0 byte é indistinguível de dump feito*).
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { saldosDaEmpresa } from '@/lib/stock/saldo'
import { lembrarCustoVigente, memoriaDoLedger } from '@/lib/stock/custo-vigente'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const APLICAR = process.argv.includes('--aplicar')
const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const saldos = await saldosDaEmpresa(prisma, EMPRESA)
  const nomes = new Map(
    (await prisma.stockItem.findMany({
      where: { companyId: EMPRESA },
      select: { id: true, nome: true, unidadeControle: true },
    })).map((i) => [i.id, i]),
  )
  const jaTem = await prisma.stockItemCustoVigente.count({ where: { companyId: EMPRESA } })

  console.log(`\n${APLICAR ? '⚠️  MODO APLICAR' : '🔎 PREVIEW (nada grava)'} · itens com movimento: ${saldos.length} · memórias já gravadas: ${jaTem}`)

  const recuperam: { itemId: string; nome: string; un: string; saldo: number; custo: number }[] = []
  const semHistoria: { nome: string; saldo: number }[] = []
  let comSaldoEmPe = 0

  for (const s of saldos) {
    // ⭐ o alvo é EXATAMENTE quem a porta hoje responde "a definir": saldo ≤ 0 e sem memória
    if (s.saldo > 0) { comSaldoEmPe++; continue }
    if (s.custoMedio != null) continue // já tem memória (ou foi aprendida pelo writer)
    const doLedger = await memoriaDoLedger(prisma, EMPRESA, s.itemId)
    const it = nomes.get(s.itemId)
    if (doLedger == null) {
      semHistoria.push({ nome: it?.nome ?? s.itemId, saldo: s.saldo })
      continue
    }
    recuperam.push({ itemId: s.itemId, nome: it?.nome ?? s.itemId, un: it?.unidadeControle ?? '', saldo: s.saldo, custo: doLedger })
  }

  recuperam.sort((a, b) => b.custo - a.custo)

  console.log(`\n═══ RECUPERAM CUSTO: ${recuperam.length} item(ns) ═══`)
  for (const r of recuperam) {
    console.log(`  ${brl(r.custo)}/${r.un.padEnd(2)} · saldo ${String(r.saldo).padStart(9)} · ${r.nome}`)
  }

  console.log(`\n═══ SEGUEM "A DEFINIR": ${semHistoria.length} item(ns) (nunca tiveram entrada com valor) ═══`)
  for (const s of semHistoria.slice(0, 20)) console.log(`  saldo ${String(s.saldo).padStart(9)} · ${s.nome}`)
  if (semHistoria.length > 20) console.log(`  … e mais ${semHistoria.length - 20}`)

  console.log(`\n⭐ itens com saldo EM PÉ (custo é o derivado, backfill não os toca): ${comSaldoEmPe}`)

  // ⭐ o caso que motivou o sprint, nomeado
  const massa = recuperam.find((r) => /metade de bolinha/i.test(r.nome))
  if (massa) console.log(`\n⭐⭐ O CASO DA MASSA: «${massa.nome}» · saldo ${massa.saldo} → custo ${brl(massa.custo)}`)
  else console.log('\n⚠️ «metade de bolinha massa de pizza» NÃO está na lista — conferir por quê antes de aplicar')

  if (!APLICAR) {
    console.log('\n🔎 PREVIEW — nada gravado. Rode com --aplicar depois do pg_dump.')
    return
  }

  let gravados = 0
  for (const r of recuperam) {
    // ⛔ movimentoId NULL de propósito: o backfill replaya a história INTEIRA e não tem um
    //    movimento único pra apontar. Carimbar um inventaria o rastro.
    await lembrarCustoVigente(prisma, { companyId: EMPRESA, itemId: r.itemId, custoMedio: r.custo, movimentoId: null })
    gravados++
  }
  const fim = await prisma.stockItemCustoVigente.count({ where: { companyId: EMPRESA } })
  console.log(`\n⭐ APLICADO: ${gravados} memória(s) gravada(s) · tabela ${jaTem} → ${fim}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('⛔', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
