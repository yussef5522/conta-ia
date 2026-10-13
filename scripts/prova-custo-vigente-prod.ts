/**
 * 🔬 A PROVA EM PROD DO CUSTO COM MEMÓRIA — read-only, pelas MESMAS funções que as telas chamam.
 *
 * ⚠️ Não reimplementa régua nenhuma: `saldosDaEmpresa` (a porta), `lerMontador` (a bancada da
 * margem), `buildFichaItem` (a página do item) e `checkCustoVigenteInvariants` (o juiz E17).
 * Medir por um caminho próprio seria provar o meu raciocínio, não o que o dono vai ver.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { saldosDaEmpresa, saldoItem } from '@/lib/stock/saldo'
import { lerMontador } from '@/lib/margem/leitura-montador'
import { buildFichaItem } from '@/lib/stock/ficha-item'
import { checkCustoVigenteInvariants } from '@/lib/stock/custo-vigente-invariants'
import { memoriaDoLedger } from '@/lib/stock/custo-vigente'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number | null) => (n == null ? 'a definir' : `R$ ${n.toFixed(2).replace('.', ',')}`)

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  // ─────────── 1. A PORTA: quantos itens tinham custo ANTES e têm AGORA ───────────
  const saldos = await saldosDaEmpresa(prisma, EMPRESA)
  const zerados = saldos.filter((s) => s.saldo <= 0)
  const comMemoria = zerados.filter((s) => s.custoMedio != null)
  console.log(`\n═══ 1. A PORTA (saldosDaEmpresa — o que ficha/cardápio/margem leem) ═══`)
  console.log(`  itens com movimento ............ ${saldos.length}`)
  console.log(`  com saldo ≤ 0 .................. ${zerados.length}`)
  console.log(`  ⭐ destes, COM custo agora ...... ${comMemoria.length}   (pela lei velha: 0)`)
  console.log(`  segue "a definir" .............. ${zerados.length - comMemoria.length} (nunca tiveram entrada com valor)`)

  // ─────────── 2. O CASO DA MASSA, pelo caminho da tela do item ───────────
  const massa = await prisma.stockItem.findFirst({
    where: { companyId: EMPRESA, nome: { contains: 'metade de bolinha' } },
    select: { id: true, nome: true },
  })
  if (massa) {
    const s = await saldoItem(prisma, EMPRESA, massa.id)
    const f = await buildFichaItem(EMPRESA, massa.id, prisma)
    console.log(`\n═══ 2. «${massa.nome}» — o caso que motivou o sprint ═══`)
    console.log(`  saldo ${s.saldo} · valor ${brl(s.valor)} · ⭐ CUSTO LIDO ${brl(s.custoMedio)}`)
    console.log(`  a página do item mostra ........ ${brl(f?.custoMedio ?? null)}`)
    console.log(`  o replay do ledger diz ......... ${brl(await memoriaDoLedger(prisma, EMPRESA, massa.id))}`)
  }

  // ─────────── 3. AS BASES DE PIZZA (o montador) ───────────
  const m = await lerMontador(EMPRESA, prisma)
  console.log(`\n═══ 3. O MONTADOR — as bases de pizza reacenderam? ═══`)
  for (const t of m.tamanhos) {
    const c = (t as { base?: { nome?: string; custo?: number | null } }).base
    console.log(`  ${String((t as { tamanho?: string }).tamanho ?? '?').padEnd(18)} base «${c?.nome ?? '(sem base)'}» → ${brl(c?.custo ?? null)}`)
  }
  const comCusto = m.tamanhos.filter((t) => (t as { base?: { custo?: number | null } }).base?.custo != null).length
  console.log(`  ⭐ tamanhos com a base CUSTEADA: ${comCusto} de ${m.tamanhos.length}`)
  if (m.faltando.length) for (const x of m.faltando) console.log(`  ⚠️ falta: ${x.frase}`)

  const saboresSemCusto = m.sabores.filter((s) => (s as { custo?: number | null }).custo == null).length
  console.log(`  sabores: ${m.sabores.length} · sem custo: ${saboresSemCusto}`)

  // ─────────── 4. O JUIZ E17 ───────────
  const fails = await checkCustoVigenteInvariants(prisma, [EMPRESA])
  const e17 = fails.filter((f) => f.invariante === 'E17')
  console.log(`\n═══ 4. O JUIZ E17 (o campo-fonte é auditado) ═══`)
  console.log(`  achados: ${e17.length}`)
  for (const f of e17.slice(0, 6)) console.log(`  [${f.nivel ?? 'erro'}] ${f.detalhe.slice(0, 150)}`)

  // ─────────── 5. ITEM 4 DO DONO — a baixa com saldo negativo lança valor? ───────────
  console.log(`\n═══ 5. INVESTIGAR E SÓ RELATAR: com saldo negativo, a baixa lança valor? ═══`)
  const negativos = zerados.filter((s) => s.saldo < 0)
  console.log(`  itens com saldo NEGATIVO hoje: ${negativos.length}`)
  let comValor = 0, semValor = 0, somaSemValor = 0
  for (const n of negativos) {
    const movs = await prisma.stockMovement.findMany({
      where: { companyId: EMPRESA, itemId: n.itemId, tipo: { in: ['BAIXA_VENDA', 'PRODUCAO_CONSUMO', 'SEPARACAO_SAIDA'] } },
      orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }],
      select: { tipo: true, quantidade: true, custoTotal: true, dataMovimento: true },
    })
    // ⚠️ o que interessa é a saída DEPOIS de o saldo já estar no chão — as de antes são normais
    let saldo = 0
    const todas = await prisma.stockMovement.findMany({
      where: { companyId: EMPRESA, itemId: n.itemId },
      orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }],
      select: { tipo: true, quantidade: true, custoTotal: true },
    })
    for (const t of todas) {
      const antes = saldo
      saldo += t.quantidade
      const ehSaida = t.quantidade < 0 && ['BAIXA_VENDA', 'PRODUCAO_CONSUMO', 'SEPARACAO_SAIDA'].includes(t.tipo)
      if (ehSaida && antes <= 0) {
        if (t.custoTotal === 0) { semValor++; somaSemValor += Math.abs(t.quantidade) }
        else comValor++
      }
    }
    void movs
  }
  console.log(`  saídas lançadas COM o saldo já ≤ 0:`)
  console.log(`    com valor (custoTotal ≠ 0) ... ${comValor}`)
  console.log(`    ⭐ a ZERO (custoTotal = 0) .... ${semValor}  · quantidade somada: ${somaSemValor.toFixed(3)}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('⛔', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
