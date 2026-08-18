// VENDAS FASE 1 item 3 — roda o recompute da Cacula, prova idempotência (conteúdo
// igual na 2ª rodada) e mostra a venda por dia pra bater com o golden.
// Uso: npx tsx scripts/recompute-vendas-cacula.ts

import { PrismaClient } from '@prisma/client'
import { recomputeVendas } from '../lib/vendas/recompute-vendas'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const INICIO = new Date('2026-08-12T00:00:00Z')
const dia = (d: Date) => d.toISOString().slice(0, 10)

async function snapshot(): Promise<string> {
  const vs = await prisma.vendaDiaria.findMany({ where: { companyId: CO }, orderBy: [{ dataCompetencia: 'asc' }, { meio: 'asc' }] })
  return vs
    .map((v) => `${dia(v.dataCompetencia)}..${dia(v.dataCompetenciaFim)}|${v.meio}|${v.tipo}|${v.valorLiquido.toFixed(2)}|bloco=${v.isBloco}|${v.origem}`)
    .join('\n')
}

async function main() {
  const r1 = await recomputeVendas(prisma, CO, INICIO)
  console.log('1ª rodada:', JSON.stringify(r1))
  const snap1 = await snapshot()
  const r2 = await recomputeVendas(prisma, CO, INICIO)
  console.log('2ª rodada:', JSON.stringify(r2))
  const snap2 = await snapshot()
  console.log('\nIDEMPOTÊNCIA (conteúdo idêntico na 2ª rodada):', snap1 === snap2 ? 'OK ✓' : 'FALHOU ✗')

  // Agregação por dia pra bater com o golden
  const vs = await prisma.vendaDiaria.findMany({ where: { companyId: CO }, orderBy: [{ dataCompetencia: 'asc' }] })
  const porDia: Record<string, Record<string, number>> = {}
  const blocos: { iv: string; meio: string; valor: number }[] = []
  for (const v of vs) {
    if (v.isBloco && dia(v.dataCompetencia) !== dia(v.dataCompetenciaFim)) {
      blocos.push({ iv: `${dia(v.dataCompetencia)}..${dia(v.dataCompetenciaFim)}`, meio: v.meio, valor: v.valorLiquido })
    } else {
      const d = dia(v.dataCompetencia)
      porDia[d] = porDia[d] || {}
      porDia[d][v.meio] = round2((porDia[d][v.meio] || 0) + v.valorLiquido)
    }
  }
  console.log('\n===== VENDA POR DIA (VendaDiaria dia único) =====')
  for (const d of Object.keys(porDia).sort()) {
    const m = porDia[d]
    const tot = round2(Object.values(m).reduce((s, x) => s + x, 0))
    console.log(`  ${d}: ${tot.toFixed(2).padStart(11)}  [${Object.entries(m).map(([k, x]) => k + ' ' + x.toFixed(2)).join(' · ')}]`)
  }
  console.log('\n===== BLOCOS (cartão fim de semana) =====')
  for (const b of blocos) console.log(`  ${b.iv} ${b.meio}: ${b.valor.toFixed(2)}`)
  const somaBloco = round2(blocos.reduce((s, b) => s + b.valor, 0))
  const soma1416 = round2(['2026-08-14', '2026-08-15', '2026-08-16'].reduce((s, d) => s + Object.values(porDia[d] || {}).reduce((a, x) => a + x, 0), 0))
  console.log(`\n  FIM DE SEMANA {14..16} = únicos ${soma1416.toFixed(2)} + bloco ${somaBloco.toFixed(2)} = ${round2(soma1416 + somaBloco).toFixed(2)}`)
  console.log('  GOLDEN esperado: 12/08=11919.65 · 13/08=10468.80 · fim de semana=62090.93')
  await prisma.$disconnect()
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
main().catch((e) => { console.error('[recompute-vendas] erro:', (e as Error).message); process.exit(1) })
