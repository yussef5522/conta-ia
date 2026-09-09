// ⭐⭐⭐ UM CAMINHO SÓ: VENDA → FICHA → COMPONENTE(S) (09/09/2026) — decisão do dono.
//
// *"Três caminhos pra mesma pergunta é como a bagunça nasce — cada tela nova precisa conhecer
// os três, cada auditoria conferir os três."*
//
// **MEDIDO ANTES: a migração é MUITO menor do que parecia.**
//   caminho 1 (ficha)       42 produtos — já é o alvo
//   caminho 3 (mapa direto)  2 produtos — SKOL e FRUKI 600ML
//   caminho 2 (fundida)      2 invólucros — COCA COLA 2L e COCA LATA
// ⚠️ E as OUTRAS 6 linhas de `stock_item_mesclado` são mescla de ITEM DE VERDADE (Coxão,
// Bobina, Filé de frango…) — **não entram nesta migração**, e desfazê-las seria estrago.
//
// ⛔ **NADA TOCA NO LEDGER.** O mapa direto vira ficha (estrutura nova); a fusão se desfaz
// tirando a marca e reativando o registro. Nenhum movimento é criado, movido ou estornado —
// e o teste prova que o planejador devolve exatamente o mesmo antes e depois.
//
//   npx tsx scripts/migrar-caminho-unico.ts            (preview)
//   npx tsx scripts/migrar-caminho-unico.ts --aplicar

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { criarFicha, fichaAtivaComNome } from '@/lib/stock/producao/fichas'
import { montarPlanoDeLinhas } from '@/lib/stock/vendas/baixa-venda'

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const APLICAR = process.argv.includes('--aplicar')

/** o plano REAL de baixa de um produto — a régua do "nada muda de comportamento" */
async function planoDe(nome: string) {
  const p = await montarPlanoDeLinhas(COMPANY_ID, '2026-09-09', [{ produto: nome, quantidade: 7, valorTotal: 100 }], null, prisma)
  return p.agregada.map((a) => `${a.itemId}:${a.qtd}:${a.custoMedio ?? '-'}`).sort().join(' | ') || '(nada)'
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY_ID)

  const diretos = await prisma.stockVendaProdutoMap.findMany({
    where: { companyId: COMPANY_ID, alvoTipo: 'REVENDA' },
    select: { nomeSuitable: true, itemId: true },
  })
  const fundidos = await prisma.stockItemMesclado.findMany({ where: { companyId: COMPANY_ID }, select: { itemId: true, mescladoEmId: true } })
  const itens = await prisma.stockItem.findMany({ where: { companyId: COMPANY_ID }, select: { id: true, nome: true, categoria: true, ativo: true } })
  const invol = fundidos.filter((f) => {
    const i = itens.find((x) => x.id === f.itemId)
    return i && (i.categoria === 'PRODUTO_FINAL' || i.categoria === 'SABOR')
  })

  console.log(`\n=== 1. MAPA DIRETO → FICHA (${diretos.length}) ===`)
  const antes = new Map<string, string>()
  for (const d of diretos) {
    antes.set(d.nomeSuitable, await planoDe(d.nomeSuitable))
    console.log(`   "${d.nomeSuitable}" → hoje baixa: ${antes.get(d.nomeSuitable)}`)
  }
  console.log(`\n=== 2. DESFAZER A FUSÃO (${invol.length} invólucros; ${fundidos.length - invol.length} mesclas de item de verdade FICAM) ===`)
  for (const f of invol) {
    const i = itens.find((x) => x.id === f.itemId)!
    console.log(`   "${i.nome}" · ativo=${i.ativo} → vira item puro "${i.nome.replace(/\s*\(mesclado\)\s*/i, '')}" com a ficha apontando nele`)
  }
  if (!APLICAR) { console.log('\n(preview — rode com --aplicar)\n'); return }

  console.log('\n--- APLICANDO ---')
  for (const d of diretos) {
    const ja = await fichaAtivaComNome(COMPANY_ID, d.nomeSuitable, prisma)
    const fichaId = ja?.fichaId ?? (await criarFicha({
      companyId: COMPANY_ID, nomeProduzido: d.nomeSuitable, unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: d.itemId!, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      permitirItemNovoComNomeDeEstoque: true,
    }, prisma)).fichaId
    await prisma.stockVendaProdutoMap.update({
      where: { companyId_nomeSuitable: { companyId: COMPANY_ID, nomeSuitable: d.nomeSuitable } },
      data: { alvoTipo: 'FICHA', fichaId, itemId: null },
    })
    const depois = await planoDe(d.nomeSuitable)
    const igual = depois === antes.get(d.nomeSuitable)
    console.log(`   ${d.nomeSuitable.padEnd(14)} ficha ${fichaId.slice(-6)} · plano ${igual ? '⭐ IDÊNTICO' : `⛔ MUDOU: ${antes.get(d.nomeSuitable)} → ${depois}`}`)
  }
  for (const f of invol) {
    const i = itens.find((x) => x.id === f.itemId)!
    await prisma.$transaction(async (tx) => {
      await tx.stockItemMesclado.deleteMany({ where: { companyId: COMPANY_ID, itemId: f.itemId } })
      await tx.stockItem.update({ where: { id: f.itemId }, data: { ativo: true, nome: i.nome.replace(/\s*\(mesclado\)\s*/i, '') } })
    })
    console.log(`   ✓ "${i.nome}" → item puro, ficha intacta, ledger intocado`)
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
