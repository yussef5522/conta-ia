// ⛔⛔⛔ A CONTAGEM DAS BEBIDAS CAIU NA LINHA ERRADA (09/09/2026) — preview + --aplicar.
//
// **O QUE ACONTECEU:** cada ficha de revenda criou um item-invólucro ao lado da garrafa que a
// NF alimenta. A contagem oferecia OS DOIS, e as garrafas foram contadas **no invólucro**,
// cujo saldo de sistema era **0** — então cada contagem virou um `+N` fantasma em vez do
// ajuste real contra o saldo da nota.
//
// ⭐ **A CONTAGEM DA MARCYELLE ESTÁ CERTA** — ela contou as garrafas de verdade. O que está
// errado é a LINHA em que o ajuste caiu. Este script **re-baseia**: leva a contagem dela pro
// item real, com o saldo de sistema certo.
//
// ⛔⛔ **O LEDGER É IMUTÁVEL: nada é editado nem apagado.** Estorno do fantasma + ajuste novo
// no item certo, com o motivo escrito. É a mesma disciplina da reunitização do pão e da
// cirurgia do ovo.
//
// ⚠️ **E O NÚMERO VAI CAIR MUITO, de propósito:** as bebidas nunca tiveram baixa de venda
// (os mapas do PDV só existem desde ontem), então o sistema segurava o saldo da NOTA inteira
// enquanto a geladeira já tinha vendido. A correção é a **primeira contagem real de bebida** —
// não é perda nova, é a diferença virando visível.
//
//   npx tsx scripts/arrumar-contagem-de-bebida.ts            (preview)
//   npx tsx scripts/arrumar-contagem-de-bebida.ts --aplicar  (grava)

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { criarMovimento, estornarMovimento } from '@/lib/stock/movement'
import { recomputeSaldoCache } from '@/lib/stock/saldo'
import { TIPO_PRODUTO_FINAL } from '@/lib/stock/tipos-ficha'

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8: por ID
const APLICAR = process.argv.includes('--aplicar')
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

interface Caso {
  involucro: { id: string; nome: string }
  garrafa: { id: string; nome: string; saldoAtual: number; custoMedio: number }
  contou: number
  fantasmas: { id: string; quantidade: number }[]
  ajusteNoReal: number
}

async function saldoDe(itemId: string) {
  const a = await prisma.stockMovement.aggregate({
    where: { companyId: COMPANY_ID, itemId, tipo: { not: 'PRODUCAO_CONSUMO' } },
    _sum: { quantidade: true, custoTotal: true },
  })
  const q = r2(a._sum.quantidade ?? 0)
  const v = r2(a._sum.custoTotal ?? 0)
  return { saldo: q, valor: v, custoMedio: q > 0 ? r2(v / q) : 0 }
}

async function levantar(): Promise<Caso[]> {
  const itens = await prisma.stockItem.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true, nome: true, categoria: true, criadoVia: true },
  })
  const casos: Caso[] = []

  for (const iv of itens.filter((i) => i.categoria === TIPO_PRODUTO_FINAL && i.criadoVia === 'MANUAL')) {
    const ficha = await prisma.stockFicha.findFirst({
      where: { companyId: COMPANY_ID, itemProduzidoId: iv.id },
      select: { id: true, versaoAtual: true },
    })
    if (!ficha) continue
    const versao = await prisma.stockFichaVersao.findFirst({
      where: { fichaId: ficha.id, versao: ficha.versaoAtual }, select: { id: true },
    })
    if (!versao) continue
    const comps = await prisma.stockFichaComponente.findMany({
      where: { versaoId: versao.id }, select: { itemId: true, qtdPlanejada: true },
    })
    // ⛔ só o PASSA-DIRETO de revenda: 1 componente ×1 que é item REVENDA. Ficha com
    // conteúdo de verdade (XIS) não entra nesta arrumação nem por acidente.
    if (comps.length !== 1 || comps[0].qtdPlanejada !== 1) continue
    const alvo = itens.find((i) => i.id === comps[0].itemId)
    if (!alvo || alvo.categoria !== 'REVENDA') continue

    // a contagem que caiu na linha errada
    const ci = await prisma.stockContagemItem.findFirst({
      where: { companyId: COMPANY_ID, itemId: iv.id }, select: { qtdContada: true },
    })
    if (!ci) continue

    // os ajustes fantasma que ainda VALEM (já estornados não entram de novo)
    const ajustes = await prisma.stockMovement.findMany({
      where: { companyId: COMPANY_ID, tipo: 'AJUSTE_CONTAGEM', OR: [{ itemId: iv.id }, { receiptId: iv.id }] },
      select: { id: true, quantidade: true, itemId: true },
    })
    // ⚠️ a mescla MOVEU o fantasma pro item real (estorno no invólucro + movimento igual no
    // sobrevivente) — então o fantasma a estornar pode estar em QUALQUER um dos dois.
    const doInvolucro = ajustes.filter((m) => m.itemId === iv.id)
    const noReal = await prisma.stockMovement.findMany({
      where: { companyId: COMPANY_ID, itemId: alvo.id, tipo: 'AJUSTE_CONTAGEM' },
      select: { id: true, quantidade: true },
    })
    const jaEstornados = new Set(
      (await prisma.stockMovement.findMany({
        where: { companyId: COMPANY_ID, tipo: 'ESTORNO', estornoDeId: { in: [...doInvolucro, ...noReal].map((m) => m.id) } },
        select: { estornoDeId: true },
      })).map((e) => e.estornoDeId),
    )
    const fantasmas = [...doInvolucro, ...noReal]
      .filter((m) => !jaEstornados.has(m.id) && m.quantidade === ci.qtdContada)
      .map((m) => ({ id: m.id, quantidade: m.quantidade }))

    const s = await saldoDe(alvo.id)
    // ⭐ o que o item real vai ficar DEPOIS de tirar o fantasma
    const semFantasma = r2(s.saldo - fantasmas.reduce((acc, f) => acc + f.quantidade, 0))
    casos.push({
      involucro: { id: iv.id, nome: iv.nome },
      garrafa: { id: alvo.id, nome: alvo.nome, saldoAtual: s.saldo, custoMedio: s.custoMedio },
      contou: ci.qtdContada,
      fantasmas,
      ajusteNoReal: r2(ci.qtdContada - semFantasma),
    })
  }
  return casos
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY_ID)
  const casos = await levantar()
  if (!casos.length) { console.log('\nnada a arrumar.'); return }

  console.log(`\n=== ${casos.length} bebida(s) com contagem na linha errada ===\n`)
  console.log('bebida (contagem)              contou │ item da NF                      hoje → depois │ ajuste')
  let valorMovido = 0
  for (const c of casos) {
    const depois = c.contou
    const delta = c.ajusteNoReal
    valorMovido += Math.abs(delta) * c.garrafa.custoMedio
    console.log(
      `${c.involucro.nome.slice(0, 28).padEnd(29)} ${String(c.contou).padStart(6)} │ ` +
      `${c.garrafa.nome.slice(0, 30).padEnd(31)} ${String(c.garrafa.saldoAtual).padStart(6)} → ${String(depois).padStart(6)} │ ` +
      `${delta > 0 ? '+' : ''}${delta}${c.fantasmas.length ? ` (estorna ${c.fantasmas.length})` : ''}`,
    )
  }
  console.log(`\n   valor que sai do estoque: ~R$ ${r2(valorMovido).toLocaleString('pt-BR')}`)
  console.log('   ⚠️ NÃO é perda nova: as bebidas nunca tiveram baixa de venda, então o sistema')
  console.log('      segurava a nota inteira. Isto é a 1ª contagem real de bebida virando saldo.')

  if (!APLICAR) { console.log('\n(preview — rode com --aplicar depois do pg_dump e do ok do dono)\n'); return }

  console.log('\n--- APLICANDO ---')
  for (const c of casos) {
    // 1) estorna o fantasma (ledger imutável: estorno, nunca UPDATE)
    for (const f of c.fantasmas) await estornarMovimento(prisma, f.id, { criadoPorId: null })
    // 2) o ajuste REAL, contra o saldo certo
    const s = await saldoDe(c.garrafa.id)
    const delta = r2(c.contou - s.saldo)
    if (delta !== 0) {
      const custo = s.custoMedio || 0
      await criarMovimento(prisma, {
        companyId: COMPANY_ID, itemId: c.garrafa.id, tipo: 'AJUSTE_CONTAGEM',
        quantidade: delta, custoUnitario: custo, custoTotal: r2(delta * custo),
        origem: 'MANUAL', criadoPorId: null,
      })
    }
    const fim = await saldoDe(c.garrafa.id)
    console.log(`   ${c.garrafa.nome.slice(0, 30).padEnd(31)} → ${fim.saldo} ${fim.saldo === c.contou ? '✓' : '⛔ NÃO BATEU'}`)
  }
  await recomputeSaldoCache(prisma, COMPANY_ID)
  console.log('\n✓ cache de saldo recomputado.\n')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
