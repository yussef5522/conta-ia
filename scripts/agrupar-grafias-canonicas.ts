// ⭐⭐ O RETROATIVO do agrupamento por grafia (08/09/2026) — decisão do dono.
//
// *"Varre os pendentes atuais e auto-mapeia os canônico-igual com ficha existente (frango
// com catupiry, calabresa acebolada, Filé com Palha, milho com bacon…). Me lista o que
// mapeou."*
//
// ⛔ A régua é a MESMA do import e do nascimento da ficha (`planoDeAgrupamento`) — este
// script não tem lógica própria, ele só é a terceira porta. Régua copiada aqui viraria a
// que ninguém atualiza.
//
// ⚠️ Mostra também o que NÃO entrou e por quê: sufixo de tamanho (sugestão, espera clique)
// e conflito de grafia (o mesmo canônico em fichas diferentes — o script se recusa a
// escolher). Ausência silenciosa é a doença que este módulo mais paga.
//
// USO:  npx tsx scripts/agrupar-grafias-canonicas.ts [--aplicar]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { planoDeAgrupamento, aplicarAgrupamento } from '@/lib/stock/vendas/aplicar-agrupamento'
import { sugestoesDeTamanho, conflitosDeGrafia } from '@/lib/stock/vendas/grafia-canonica'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  // ── o contexto, pelas mesmas leituras do motor ────────────────────────────
  const [catalogo, mapeados, fichas] = await Promise.all([
    prisma.stockVendaComplementoNome.findMany({ where: { companyId: COMPANY }, select: { nomeSuitable: true } }),
    prisma.stockVendaComplementoMap.findMany({
      where: { companyId: COMPANY, alvoTipo: 'FICHA', fichaId: { not: null } },
      select: { nomeSuitable: true, fichaId: true },
    }),
    prisma.stockFicha.findMany({ where: { companyId: COMPANY, ativo: true }, select: { id: true, itemProduzidoId: true } }),
  ])
  const itens = await prisma.stockItem.findMany({
    where: { companyId: COMPANY, id: { in: fichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true },
  })
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeDaFicha = new Map(fichas.map((f) => [f.id, nomeItem.get(f.itemProduzidoId) ?? '(ficha)']))
  const jaMapeadas = mapeados
    .filter((m) => m.fichaId && nomeDaFicha.has(m.fichaId))
    .map((m) => ({ nomeSuitable: m.nomeSuitable, fichaId: m.fichaId!, nomeFicha: nomeDaFicha.get(m.fichaId!)! }))
  const resolvidos = new Set((await prisma.stockVendaComplementoMap.findMany({
    where: { companyId: COMPANY }, select: { nomeSuitable: true },
  })).map((m) => m.nomeSuitable))

  // ocorrências reais, pra ordenar por peso de verdade
  const linhas = await prisma.stockVendaComplementoLinha.groupBy({
    by: ['nomeSuitable'], where: { companyId: COMPANY }, _sum: { ocorrencias: true },
  })
  const ocorr = new Map(linhas.map((l) => [l.nomeSuitable, l._sum.ocorrencias ?? 0]))
  const pendentes = catalogo
    .filter((c) => !resolvidos.has(c.nomeSuitable))
    .map((c) => ({ nomeSuitable: c.nomeSuitable, ocorrencias: ocorr.get(c.nomeSuitable) ?? 0 }))

  // ── 1. CONFLITO primeiro: se houver, o automático não é confiável ─────────
  const conflitos = conflitosDeGrafia(jaMapeadas)
  if (conflitos.length) {
    console.log('\n⛔ CONFLITO DE GRAFIA — o mesmo canônico apontando pra fichas diferentes:')
    for (const c of conflitos) {
      console.log(`   "${c.canonico}"`)
      for (const f of c.fichas) console.log(`      "${f.nomeSuitable}" → ${f.nomeFicha} [${f.fichaId}]`)
    }
    console.log('   ⚠️ o script NÃO escolhe: resolva na tela antes de aplicar.\n')
  }

  // ── 2. O QUE ENTRA SOZINHO ────────────────────────────────────────────────
  const plano = await planoDeAgrupamento(COMPANY, prisma)
  // reordena pelo volume real (o motor não conhece as ocorrências)
  const comVolume = plano
    .map((a) => ({ ...a, ocorrencias: ocorr.get(a.nomeSuitable) ?? 0 }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias)

  console.log(`\n=== ENTRAM SOZINHAS (canônico já tem ficha): ${comVolume.length} ===`)
  for (const a of comVolume) {
    console.log(`   "${a.nomeSuitable}" (${a.ocorrencias} ocorr.) → ${a.nomeFicha}`)
    console.log(`      via a irmã "${a.viaGrafia}"`)
  }
  if (!comVolume.length) console.log('   nenhuma — todo canônico pendente ainda não tem ficha.')

  // ── 3. O QUE CONTINUA PEDINDO CLIQUE ──────────────────────────────────────
  const tamanhos = sugestoesDeTamanho(pendentes, jaMapeadas)
  console.log(`\n=== SUGESTÃO DE TAMANHO/PROMO (espera o clique do dono): ${tamanhos.length} ===`)
  for (const s of tamanhos) {
    console.log(`   "${s.nomeSuitable}" (${s.ocorrencias} ocorr.) — ${s.frase}`)
  }

  const naoEntram = pendentes.filter((p) =>
    !comVolume.some((a) => a.nomeSuitable === p.nomeSuitable)
    && !tamanhos.some((t) => t.nomeSuitable === p.nomeSuitable))
  console.log(`\n=== SEGUEM PENDENTES (sem irmã com ficha): ${naoEntram.length} ===`)
  for (const p of naoEntram.sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 25)) {
    console.log(`   "${p.nomeSuitable}" (${p.ocorrencias} ocorr.)`)
  }
  if (naoEntram.length > 25) console.log(`   … e mais ${naoEntram.length - 25}`)

  if (!APLICAR) {
    console.log('\n⛔ NADA FOI GRAVADO. Rode com --aplicar.\n')
    return
  }
  const n = await aplicarAgrupamento(COMPANY, plano, 'RETROATIVO', undefined, prisma)
  console.log(`\n✓ ${n} grafia(s) entraram no mapa, com rastro "agrupada por grafia".\n`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
