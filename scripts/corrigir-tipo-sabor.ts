// Move pra `SABOR` as fichas que são SABOR e nasceram INTERMEDIARIO (03/09/2026).
//
// ⭐ Elas são reconhecíveis por FATO, não por nome: são alvo de um mapeamento de
// COMPLEMENTO. Não há adivinhação — o dono apontou cada uma na prateleira.
//
// ⛔ NÃO TOCA em ficha que a cozinha produz: se a ficha já tem ordem de produção ou
// movimento de PRODUCAO_GERACAO, ela É uma receita de verdade (o dono pode ter mapeado um
// complemento direto numa receita, caminho legítimo) → o script RECUSA e nomeia.
//
// USO:  npx tsx scripts/corrigir-tipo-sabor.ts [--aplicar]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { ehReceitaDeProducao } from '@/lib/stock/producao/tipo-receita'
import { TIPO_SABOR, TIPO_INTERMEDIARIO } from '@/lib/stock/tipos-ficha'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const maps = await prisma.stockVendaComplementoMap.findMany({
    where: { companyId: COMPANY, alvoTipo: 'FICHA', fichaId: { not: null } },
    select: { nomeSuitable: true, fichaId: true },
  })
  const fichas = await prisma.stockFicha.findMany({
    where: { companyId: COMPANY, id: { in: maps.map((m) => m.fichaId!) } },
    select: { id: true, tipoProduto: true, itemProduzidoId: true },
  })
  const itens = await prisma.stockItem.findMany({
    where: { companyId: COMPANY, id: { in: fichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true, categoria: true },
  })
  const nome = new Map(itens.map((i) => [i.id, i.nome]))

  const cozinhaAntes = (await prisma.stockFicha.findMany({
    where: { companyId: COMPANY }, select: { tipoProduto: true, ativo: true },
  })).filter(ehReceitaDeProducao).length

  console.log('\n=== FICHAS MAPEADAS COMO COMPLEMENTO ===')
  const mover: typeof fichas = []
  for (const f of fichas) {
    const rotulo = maps.find((m) => m.fichaId === f.id)!.nomeSuitable
    // ⛔ a trava: isto aqui é uma receita que a cozinha produz de verdade?
    const [ordens, geracoes] = await Promise.all([
      prisma.stockProductionOrder.count({ where: { companyId: COMPANY, fichaId: f.id } }),
      prisma.stockMovement.count({ where: { companyId: COMPANY, itemId: f.itemProduzidoId, tipo: 'PRODUCAO_GERACAO' } }),
    ])
    const produzDeVerdade = ordens > 0 || geracoes > 0
    const alvo = f.tipoProduto === TIPO_SABOR ? '(já é SABOR)' : produzDeVerdade ? '⛔ NÃO MEXO' : `${f.tipoProduto} → ${TIPO_SABOR}`
    console.log(`  "${rotulo}" → ficha "${nome.get(f.itemProduzidoId)}" · ${alvo}`)
    if (produzDeVerdade) console.log(`     ⛔ tem ${ordens} ordem(ns) e ${geracoes} geração(ões): é receita da cozinha, fica como está`)
    if (!produzDeVerdade && f.tipoProduto === TIPO_INTERMEDIARIO) mover.push(f)
  }

  console.log(`\nreceitas na cozinha hoje: ${cozinhaAntes}`)
  console.log(`fichas a mover: ${mover.length}`)
  if (!mover.length) { console.log('\nnada a fazer.'); return }
  if (!APLICAR) { console.log('\n(sem --aplicar: NADA foi tocado)'); return }

  await prisma.$transaction(async (tx) => {
    for (const f of mover) {
      await tx.stockFicha.update({ where: { id: f.id }, data: { tipoProduto: TIPO_SABOR } })
      // o item produzido nasce com `categoria = tipoProduto` — anda junto, senão o Catálogo
      // segue etiquetando o invólucro como "Intermediário"
      await tx.stockItem.update({ where: { id: f.itemProduzidoId }, data: { categoria: TIPO_SABOR } })
    }
  })

  const cozinhaDepois = (await prisma.stockFicha.findMany({
    where: { companyId: COMPANY }, select: { tipoProduto: true, ativo: true },
  })).filter(ehReceitaDeProducao).length

  console.log('\n=== FEITO ===')
  console.log(`  movidas: ${mover.length} · receitas na cozinha: ${cozinhaAntes} → ${cozinhaDepois}`)
  if (cozinhaDepois !== cozinhaAntes - mover.length) {
    throw new Error('⛔ a conta da cozinha não fechou — restaure o dump.')
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
