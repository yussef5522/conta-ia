// Mapeia as grafias que ficaram penduradas quando a irmã já tinha ficha (03/09/2026).
//
// ⛔ O QUE ACONTECEU: o dono clicou "criar ficha pra todas" num grupo cuja ficha **já
// existia** (uma grafia irmã tinha sido mapeada numa tentativa anterior). A gravação recusou
// — corretamente, nunca criar segunda ficha do mesmo nome — e o gesto morreu ali. Ficaram
// grafias pendentes com a irmã já resolvida. **Nenhuma ficha órfã**: só trabalho parado.
//
// ⭐ A régua é a MESMA da tela (`normalizarNome`): a grafia pendente vai pra ficha da irmã
// que é a mesma string ignorando caixa/acento/espaço. Nada de parecido, nada de typo — só
// o que a tela já agruparia sozinha, sem julgamento.
//
// ⚠️ Escreve pelo `upsertComplementoMap` (o escritor real, com guard), nunca por INSERT.
//
// USO:  npx tsx scripts/costurar-grafias-irmas.ts [--aplicar]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { normalizarNome } from '@/lib/stock/vendas/grupo-complemento'
import { upsertComplementoMap } from '@/lib/stock/vendas/complemento-map'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const [maps, catalogo, fichas, itens] = await Promise.all([
    prisma.stockVendaComplementoMap.findMany({ where: { companyId: COMPANY }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true } }),
    prisma.stockVendaComplementoNome.findMany({ where: { companyId: COMPANY }, select: { nomeSuitable: true } }),
    prisma.stockFicha.findMany({ where: { companyId: COMPANY }, select: { id: true, itemProduzidoId: true, ativo: true } }),
    prisma.stockItem.findMany({ where: { companyId: COMPANY }, select: { id: true, nome: true } }),
  ])
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeFicha = new Map(fichas.map((f) => [f.id, nomeItem.get(f.itemProduzidoId) ?? '(ficha)']))
  const ativa = new Map(fichas.map((f) => [f.id, f.ativo]))

  // irmã por forma normalizada — só as que apontam pra FICHA (IGNORAR não é destino a herdar)
  const irma = new Map<string, { fichaId: string; via: string }>()
  for (const m of maps) {
    if (m.alvoTipo !== 'FICHA' || !m.fichaId) continue
    const k = normalizarNome(m.nomeSuitable)
    if (!irma.has(k)) irma.set(k, { fichaId: m.fichaId, via: m.nomeSuitable })
  }

  const mapeados = new Set(maps.map((m) => m.nomeSuitable))
  const plano: { nome: string; fichaId: string; via: string }[] = []
  console.log('\n=== GRAFIAS PENDENTES COM IRMÃ JÁ RESOLVIDA ===')
  for (const c of catalogo) {
    if (mapeados.has(c.nomeSuitable)) continue
    const i = irma.get(normalizarNome(c.nomeSuitable))
    if (!i) continue
    if (!ativa.get(i.fichaId)) { console.log(`  ⛔ "${c.nomeSuitable}" — a ficha da irmã está ARQUIVADA. PULADO.`); continue }
    console.log(`  "${c.nomeSuitable}"  →  ficha "${nomeFicha.get(i.fichaId)}"  (via irmã "${i.via}")`)
    plano.push({ nome: c.nomeSuitable, fichaId: i.fichaId, via: i.via })
  }

  console.log(`\ngrafias a mapear: ${plano.length}`)
  console.log(`fichas envolvidas: ${new Set(plano.map((p) => p.fichaId)).size} · fichas criadas: 0 (nenhuma ficha nova, só vínculo)`)
  if (!plano.length || !APLICAR) { console.log(APLICAR ? '' : '\n(sem --aplicar: NADA foi tocado)'); return }

  const fichasAntes = await prisma.stockFicha.count({ where: { companyId: COMPANY } })
  for (const p of plano) {
    await upsertComplementoMap(COMPANY, p.nome, { tipo: 'FICHA', fichaId: p.fichaId }, undefined, prisma)
    console.log(`  ✓ "${p.nome}" → "${nomeFicha.get(p.fichaId)}"`)
  }
  const fichasDepois = await prisma.stockFicha.count({ where: { companyId: COMPANY } })

  console.log(`\n=== FEITO === ${plano.length} grafias mapeadas`)
  // ⛔ a costura NÃO pode criar ficha: se criou, algo saiu do roteiro
  if (fichasDepois !== fichasAntes) throw new Error(`⛔ o número de fichas mudou (${fichasAntes} → ${fichasDepois}). Restaure o dump.`)
  console.log(`fichas: ${fichasAntes} antes, ${fichasDepois} depois (inalterado, como tem que ser)`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
