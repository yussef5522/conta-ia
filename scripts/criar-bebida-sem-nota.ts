// ⭐⭐ BEBIDA QUE EXISTE NA GELADEIRA MAS NUNCA VEIO EM NOTA (09/09/2026).
//
// **O dono:** *"Começamos há 1 semana — essas bebidas estão na geladeira, só nunca veio NF
// delas. Cria o item (REVENDA, UN, custo 0 até a primeira NF ensinar o preço), cria a ficha
// de revenda (1 componente ×1) e aponta o produto do cardápio nela. Saldo NÃO se chuta: os 3
// nascem com saldo 0 e entram na minha fila de contagem."*
//
// ⛔⛔ **SALDO NASCE ZERO, e isso é o ponto.** Item sem movimento não é item sem estoque — é
// item **sem contagem**. Chutar 12 garrafas porque "deve ter umas 12" poria número inventado
// no lugar onde a régua do Real vs Teórico vai medir. A contagem é que dá o saldo.
//
// ⚠️ **O NOME DO ITEM ≠ O NOME DO CARDÁPIO, de propósito:** o item leva o nome descritivo
// (`FANTA LARANJA LATA 350ML`) e a ficha leva o nome do PDV (`FANTA LARANJA LATA`). Além de
// ser o desenho ("item = o que está na geladeira; ficha = a linha do menu"), evita a colisão
// que o guard de 09/09 recusa — e que foi o que criou os invólucros duplicados.
//
//   npx tsx scripts/criar-bebida-sem-nota.ts            (preview)
//   npx tsx scripts/criar-bebida-sem-nota.ts --aplicar  (grava)

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { criarFicha } from '@/lib/stock/producao/fichas'
import { upsertVendaMap } from '@/lib/stock/vendas/venda-map'
import { normalizarBusca } from '@/lib/busca-texto'

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8: por ID
const APLICAR = process.argv.includes('--aplicar')

/** os 3 que a auditoria de 09/09 achou vendendo sem item no estoque */
const ALVOS = [
  { nomePdv: 'FANTA LARANJA LATA', nomeItem: 'FANTA LARANJA LATA 350ML', preco: 9 },
  { nomePdv: 'FRUKI ZERO 2L', nomeItem: 'FRUKI GUARANA ZERO 2L', preco: 17 },
  { nomePdv: 'HEINEKEN LONG ZERO', nomeItem: 'HEINEKEN LONG NECK ZERO 330ML', preco: 12 },
] as const

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY_ID)

  const itens = await prisma.stockItem.findMany({
    where: { companyId: COMPANY_ID, ativo: true }, select: { id: true, nome: true },
  })
  const jaExiste = (n: string) => itens.find((i) => normalizarBusca(i.nome) === normalizarBusca(n))
  const maps = await prisma.stockVendaProdutoMap.findMany({ where: { companyId: COMPANY_ID }, select: { nomeSuitable: true } })
  const jaMapeado = new Set(maps.map((m) => m.nomeSuitable))

  console.log('\n=== o que vai ser criado ===\n')
  const fazer: typeof ALVOS[number][] = []
  for (const a of ALVOS) {
    const item = jaExiste(a.nomeItem)
    const mapeado = jaMapeado.has(a.nomePdv)
    if (item || mapeado) {
      console.log(`   ⏭️  ${a.nomePdv.padEnd(22)} já resolvido (${item ? 'item existe' : 'já mapeado'}) — pulo`)
      continue
    }
    console.log(`   ⭐ ${a.nomePdv.padEnd(22)} → item "${a.nomeItem}" (REVENDA/UN, custo 0, saldo 0)`)
    console.log(`      ${''.padEnd(22)}   ficha "${a.nomePdv}" = ${a.nomeItem} ×1 · preço ${a.preco}`)
    fazer.push(a)
  }
  if (!fazer.length) { console.log('\nnada a fazer.'); return }

  console.log('\n   ⚠️ saldo nasce 0 — os 3 entram na fila de contagem e o saldo vem de lá.')
  if (!APLICAR) { console.log('\n(preview — rode com --aplicar)\n'); return }

  console.log('\n--- APLICANDO ---')
  for (const a of fazer) {
    // 1) o item de prateleira — sem movimento nenhum (saldo 0, custo "a definir")
    const item = await prisma.stockItem.create({
      data: {
        companyId: COMPANY_ID, nome: a.nomeItem, unidadeControle: 'UN',
        categoria: 'REVENDA', criadoVia: 'MANUAL',
      },
    })
    // 2) a ficha de revenda + 3) o vínculo com o PDV, na MESMA transação (`mapearNomeSuitable`)
    const f = await criarFicha({
      companyId: COMPANY_ID, nomeProduzido: a.nomePdv, unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: a.preco,
      componentes: [{ itemId: item.id, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      mapearNomeSuitable: a.nomePdv,
    }, prisma)
    console.log(`   ✓ ${a.nomePdv.padEnd(22)} item ${item.id.slice(-6)} · ficha ${f.fichaId.slice(-6)} · vínculo PDV: ${f.vinculadoAoPdv ? 'sim' : '⛔ NÃO'}`)
  }

  // ⚠️ o vínculo pode não ter sido criado se o nome já estivesse mapeado — confere e reporta
  for (const a of fazer) {
    const m = await prisma.stockVendaProdutoMap.findFirst({ where: { companyId: COMPANY_ID, nomeSuitable: a.nomePdv }, select: { alvoTipo: true } })
    if (!m) console.log(`   ⛔ "${a.nomePdv}" ficou SEM vínculo — a venda não vai baixar. Apontar na tela.`)
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
