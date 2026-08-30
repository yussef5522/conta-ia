// ⛔ CIRURGIA — O ESTOQUE FANTASMA DO OVO (30/08/2026). AUTORIZADA PELO DONO.
//
// O QUE ACONTECEU: o dono ajustou a quantidade de 12 pra 360 (12 cartelas × 30 ovos — a
// conta CERTA) e o sistema manteve o custo por CARTELA (18,00) em cada OVO. Resultado:
// 360 × 18 = 6.480 por nota, contra os 216 que a nota declara. Duas notas → R$ 12.528,00
// de estoque que não existe.
//
// O QUE ESTA CIRURGIA FAZ: estorna as 2 entradas erradas e relança 12 × 18 por nota —
// exatamente o que o XML diz. **Nada de UPDATE**: o ledger é imutável e correção é
// estorno + movimento novo, a mesma disciplina de todo o módulo.
//
// ⚠️ NÃO CONVERTE PRA OVO AQUI. O dono faz isso depois, pela ficha ("A unidade está
// errada?" → fator 30), com o custo CERTO por baixo. Fazer as duas coisas no mesmo gesto
// misturaria "consertar o erro" com "mudar a régua" — e se algo desse errado ninguém
// saberia qual das duas foi.
//
//   DRY-RUN (padrão):  npx tsx scripts/cirurgia-ovo-fantasma.ts
//   APLICAR:           npx tsx scripts/cirurgia-ovo-fantasma.ts --aplicar

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { PrismaClient } from '@prisma/client'
import { criarMovimento, estornarMovimento } from '../lib/stock/movement'
import { saldoItem, recomputeSaldoCache } from '../lib/stock/saldo'
import { checkStockInvariants } from '../lib/stock/stock-invariants'

const db = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const ITEM = 'cmtd9y6hl000fek1coug3vx21' // OVO BRANCO CARTELA GRAUDO
const APLICAR = process.argv.includes('--aplicar')

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function estado(titulo: string) {
  const s = await saldoItem(db, CO, ITEM)
  const e16 = (await checkStockInvariants(db)).filter((f) => f.invariante === 'E16' && f.companyId === CO)
  console.log(`\n=== ${titulo} ===`)
  console.log(`  saldo: ${s.saldo} UN · valor: ${brl(s.valor)} · custo médio: ${s.custoMedio != null ? brl(s.custoMedio) : '—'}`)
  console.log(`  E16 (entrada × nota): ${e16.length} achado(s)`)
  for (const f of e16) console.log(`    ⚠️ ${f.detalhe.slice(0, 120)}…`)
  return s
}

async function main() {
  console.log('\n⛔ CIRURGIA — ESTOQUE FANTASMA DO OVO' + (APLICAR ? '  [APLICANDO]' : '  [DRY-RUN]'))
  const antes = await estado('ANTES')

  // as entradas erradas: quantidade convertida, custo por cartela
  const movimentos = await db.stockMovement.findMany({
    where: { companyId: CO, itemId: ITEM, tipo: 'ENTRADA_NF' },
    orderBy: { criadoEm: 'asc' },
  })
  const errados = movimentos.filter((m) => m.quantidade === 360 && m.custoUnitario === 18)

  console.log(`\n=== O PLANO (${errados.length} entrada(s) a corrigir) ===`)
  for (const m of movimentos) {
    const nf = m.nfeChave?.slice(25, 34) ?? '—'
    const ehErrado = errados.some((x) => x.id === m.id)
    console.log(
      `  NF ${nf}: ${m.quantidade} × ${brl(m.custoUnitario)} = ${brl(m.custoTotal)}` +
      (ehErrado ? '   ❌ estorna e relança 12 × 18,00 = 216,00' : '   ✓ correto, não se toca'),
    )
  }
  if (errados.length === 0) { console.log('\n  nada a fazer.'); await db.$disconnect(); return }

  const depoisEsperado = {
    saldo: antes.saldo - errados.reduce((s, m) => s + m.quantidade, 0) + errados.length * 12,
    valor: Math.round((antes.valor - errados.reduce((s, m) => s + m.custoTotal, 0) + errados.length * 216) * 100) / 100,
  }
  console.log(`\n  depois: ${depoisEsperado.saldo} UN · ${brl(depoisEsperado.valor)}  (sai ${brl(antes.valor - depoisEsperado.valor)} de fantasma)`)

  if (!APLICAR) {
    console.log('\n  (dry-run — rode com --aplicar depois do pg_dump)\n')
    await db.$disconnect()
    return
  }

  for (const m of errados) {
    await db.$transaction(async (tx) => {
      // ⚠️ estorno + novo, NUNCA update — e o novo carrega a MESMA nfeChave, pra o E16
      // conseguir fechar a conta por nota.
      await estornarMovimento(tx as unknown as PrismaClient, m.id)
      await criarMovimento(tx as unknown as PrismaClient, {
        companyId: CO, itemId: ITEM, tipo: 'ENTRADA_NF',
        quantidade: 12, custoUnitario: 18, custoTotal: 216,
        receiptId: m.receiptId, nfeChave: m.nfeChave, nItem: m.nItem,
        origem: m.origem, dataMovimento: m.dataMovimento,
      })
    })
    console.log(`  ✓ NF ${m.nfeChave?.slice(25, 34)}: estornado 6.480,00 · relançado 216,00`)
  }
  await recomputeSaldoCache(db, CO)

  const depois = await estado('DEPOIS')
  const ok = Math.abs(depois.valor - depoisEsperado.valor) < 0.01
  console.log(ok ? '\n✅ fechou com o previsto\n' : `\n❌ esperado ${brl(depoisEsperado.valor)}, veio ${brl(depois.valor)}\n`)
  await db.$disconnect()
  process.exit(ok ? 0 : 1)
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
