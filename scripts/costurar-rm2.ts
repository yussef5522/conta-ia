// ⭐⭐ COSTURA DA DUPLICATA DA RM2 — autorizada pelo dono em 04/09/2026.
//
// *"CONFIRMO — mesma empresa. Move a transação de R$ 417,40 pra RM2 COMERCIO DE MATERIAIS
// PARA INFORMATICA LTDA e desativa o 'rm2'."*
//
// ⚠️ A duplicata nasceu do seletor que escondia 63 dos 85 fornecedores (corrigido no mesmo
// dia). Esta costura limpa o estrago; o que impede o próximo é o fix da tela.
//
// ⛔ SEM `--apply` NÃO GRAVA NADA. Resolve tudo por ID (REGRA 8) e prova o banco antes de
// medir (REGRA 8b) — `findMany` num banco errado devolve zero em silêncio.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'                 // Caçula Mix
const ORIGINAL_FIN = 'cmq8g05kk00bnuuadk1wmu8q0'            // RM2 COMERCIO … LTDA (10/06, MANUAL)
const DUP_FIN = 'cmtncqmq6025a109f0aqmspxq'                 // "rm2" (04/09, ESTOQUE_NF)
const DUP_STOCK = 'cmtncqmka021l109f83l152qj'               // stock_supplier "rm2"

const APLICAR = process.argv.includes('--apply')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const [original, dup, dupStock] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: ORIGINAL_FIN, companyId: COMPANY } }),
    prisma.supplier.findFirst({ where: { id: DUP_FIN, companyId: COMPANY } }),
    prisma.stockSupplier.findFirst({ where: { id: DUP_STOCK, companyId: COMPANY } }),
  ])
  // ⛔ ABORTA em vez de "seguir com o que achou": id que não resolve é sinal de que o mundo
  // mudou desde o preview, e costurar às cegas é como duplicata vira perda.
  if (!original || !dup || !dupStock) {
    throw new Error(`Algum dos IDs não existe nesta empresa — original=${!!original} dup=${!!dup} dupStock=${!!dupStock}`)
  }

  // ⚠️ TRÊS tabelas apontam pra `suppliers`, não só `transactions` — mover uma e esquecer as
  // outras deixaria regra/recorrência apontando pra um fornecedor desativado, em silêncio.
  const [txs, regras, recorrentes] = await Promise.all([
    prisma.transaction.findMany({
      where: { supplierId: DUP_FIN },
      select: { id: true, date: true, amount: true, description: true, lifecycle: true, status: true },
      orderBy: { date: 'asc' },
    }),
    prisma.aiLearningRule.findMany({ where: { supplierId: DUP_FIN }, select: { id: true, padrao: true } }),
    prisma.recurringSchedule.findMany({ where: { supplierId: DUP_FIN }, select: { id: true, description: true } }),
  ])
  const entradas = await prisma.stockEntradaManual.findMany({
    where: { companyId: COMPANY, supplierId: DUP_STOCK },
    select: { id: true, data: true, fornecedorNome: true, valorTotal: true },
  })

  console.log(`\n=== COSTURA DA RM2 — ${APLICAR ? 'APLICANDO' : 'PREVIEW (nada será gravado)'} ===\n`)
  console.log(`MANTÉM  [financeiro] ${original.razaoSocial}`)
  console.log(`        id=${original.id} · cnpj=${original.cnpj ?? '— (o dono vai preencher com a próxima nota)'}`)
  console.log(`DESATIVA[financeiro] ${dup.razaoSocial}  id=${dup.id}\n`)

  console.log(`transações a mover: ${txs.length}`)
  for (const t of txs) console.log(`  · ${t.date.toISOString().slice(0, 10)} · ${brl(t.amount)} · ${t.lifecycle}/${t.status} · "${t.description}" · ${t.id}`)
  console.log(`regras de aprendizado a mover: ${regras.length}${regras.map((r) => `\n  · ${r.padrao}`).join('')}`)
  console.log(`recorrências a mover: ${recorrentes.length}${recorrentes.map((r) => `\n  · ${r.description}`).join('')}`)

  console.log(`\nRENOMEIA[estoque] "${dupStock.razaoSocial}" → "${original.razaoSocial}"  id=${dupStock.id}`)
  console.log(`  ⚠️ o estoque NÃO tem coluna de "ativo" (o isolamento proíbe ALTER), e este é o ÚNICO`)
  console.log(`     RM2 de lá — renomear é o que faz os dois lados se reconhecerem pelo nome`)
  console.log(`     enquanto não houver CNPJ. Entradas manuais que herdam o nome: ${entradas.length}`)
  for (const e of entradas) console.log(`  · ${e.data.toISOString().slice(0, 10)} · ${brl(e.valorTotal)} · snapshot "${e.fornecedorNome}"`)

  if (!APLICAR) {
    console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply pra executar.\n')
    return
  }

  const r = await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.updateMany({ where: { supplierId: DUP_FIN }, data: { supplierId: ORIGINAL_FIN } })
    const g = await tx.aiLearningRule.updateMany({ where: { supplierId: DUP_FIN }, data: { supplierId: ORIGINAL_FIN } })
    const c = await tx.recurringSchedule.updateMany({ where: { supplierId: DUP_FIN }, data: { supplierId: ORIGINAL_FIN } })

    // ⚠️ DESATIVA, não apaga: o rastro de que existiu (e de que foi costurado) é o que
    // responde "cadê a outra RM2?" daqui a três meses.
    await tx.supplier.update({
      where: { id: DUP_FIN },
      data: {
        isActive: false,
        notes: [dup.notes, `duplicata costurada em 04/09/2026 — ${t.count} transação(ões) movida(s) pra ${ORIGINAL_FIN} (confirmado pelo dono: mesma empresa)`]
          .filter(Boolean).join(' · '),
      },
    })

    await tx.stockSupplier.update({ where: { id: DUP_STOCK }, data: { razaoSocial: original.razaoSocial } })
    const e = await tx.stockEntradaManual.updateMany({
      where: { companyId: COMPANY, supplierId: DUP_STOCK }, data: { fornecedorNome: original.razaoSocial },
    })
    return { tx: t.count, regras: g.count, recorrentes: c.count, entradas: e.count }
  })

  // ⭐ CONFERÊNCIA DEPOIS, medida — não "prometida"
  const [sobrouNoDup, noOriginal, dupDepois, stockDepois] = await Promise.all([
    prisma.transaction.count({ where: { supplierId: DUP_FIN } }),
    prisma.transaction.count({ where: { supplierId: ORIGINAL_FIN } }),
    prisma.supplier.findUniqueOrThrow({ where: { id: DUP_FIN }, select: { isActive: true } }),
    prisma.stockSupplier.findUniqueOrThrow({ where: { id: DUP_STOCK }, select: { razaoSocial: true } }),
  ])
  console.log(`\n✓ movidas: ${r.tx} tx · ${r.regras} regra(s) · ${r.recorrentes} recorrência(s) · ${r.entradas} snapshot(s)`)
  console.log(`✓ sobrou no duplicado: ${sobrouNoDup} (tem que ser 0) · no original agora: ${noOriginal}`)
  console.log(`✓ duplicado ativo? ${dupDepois.isActive} (tem que ser false)`)
  console.log(`✓ estoque agora: "${stockDepois.razaoSocial}"\n`)
}

main().finally(() => prisma.$disconnect())
