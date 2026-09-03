// Costura os produtos que ficaram órfãos por mapeamento com CHAVE INTERNA (03/09/2026).
//
// ⛔ O QUE ACONTECEU: a tela do produto mandava a chave do hub (`nome:GRANDE PRECINHO`) no
// lugar do nome do PDV. O sistema gravou o mapeamento com um nome que **não existe em
// relatório nenhum** — a ficha ficou órfã e o banco ficou com lixo com cara de vínculo.
// A fonte já recusa isso desde hoje; aqui é o rastro que ficou.
//
// ⭐ USA O ESCRITOR REAL (`upsertVendaMap`), não um INSERT à mão: ele carrega o guard dos 3
// níveis (nada de matéria-prima, nada de intermediário) — script que replica a lógica prova
// o script, não o sistema.
//
// USO:  npx tsx scripts/costurar-mapa-nome-prefixado.ts [--aplicar]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { upsertVendaMap } from '@/lib/stock/vendas/venda-map'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const APLICAR = process.argv.includes('--aplicar')
const PREFIXO = /^(nome|ficha|item):/

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const maps = await prisma.stockVendaProdutoMap.findMany({
    where: { companyId: COMPANY },
    select: { id: true, nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true },
  })
  const lixo = maps.filter((m) => PREFIXO.test(m.nomeSuitable))
  if (!lixo.length) { console.log('nenhum mapeamento com chave interna — nada a fazer.'); return }

  const plano: { velho: string; novo: string; fichaId: string }[] = []
  console.log('\n=== O QUE VAI SER COSTURADO ===')
  for (const m of lixo) {
    const [, prefixo] = m.nomeSuitable.match(PREFIXO)!
    const real = m.nomeSuitable.slice(prefixo.length + 1)

    // ⛔ só a chave `nome:` carrega um nome de PDV. `ficha:`/`item:` seriam outro bug e o
    // script NÃO adivinha o que fazer com eles.
    if (prefixo !== 'nome') { console.log(`  ⛔ "${m.nomeSuitable}" — chave "${prefixo}:" não carrega nome de PDV. PULADO, precisa de olho humano.`); continue }
    if (!m.fichaId) { console.log(`  ⛔ "${m.nomeSuitable}" — aponta pra item, não pra ficha. PULADO.`); continue }

    const vendas = await prisma.stockVendaLinha.count({ where: { companyId: COMPANY, nomeSuitable: real } })
    const jaExiste = maps.find((x) => x.nomeSuitable === real)
    console.log(`  "${m.nomeSuitable}" → "${real}"  ·  ${vendas} linha(s) de venda com esse nome`)
    if (jaExiste) { console.log(`     ⛔ JÁ EXISTE mapeamento para "${real}" (→ ${jaExiste.fichaId ?? jaExiste.itemId}). PULADO — decidir à mão qual vale.`); continue }
    if (vendas === 0) console.log(`     ⚠️ o nome real não aparece em venda nenhuma (ainda) — o vínculo entra assim mesmo, pra quando aparecer`)
    plano.push({ velho: m.nomeSuitable, novo: real, fichaId: m.fichaId })
  }

  console.log(`\ncosturas a fazer: ${plano.length}`)
  if (!plano.length || !APLICAR) { console.log(APLICAR ? '' : '\n(sem --aplicar: NADA foi tocado)'); return }

  for (const p of plano) {
    // ⭐ escreve pelo caminho real (com guard), depois remove o lixo
    await upsertVendaMap(COMPANY, p.novo, { tipo: 'FICHA', fichaId: p.fichaId }, undefined, prisma)
    await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId: COMPANY, nomeSuitable: p.velho } })
    console.log(`  ✓ "${p.novo}" → ficha ${p.fichaId}  (lixo "${p.velho}" removido)`)
  }

  const sobrou = (await prisma.stockVendaProdutoMap.findMany({ where: { companyId: COMPANY }, select: { nomeSuitable: true } }))
    .filter((m) => PREFIXO.test(m.nomeSuitable))
  console.log(`\n=== FEITO === mapeamentos com chave interna restantes: ${sobrou.length}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
