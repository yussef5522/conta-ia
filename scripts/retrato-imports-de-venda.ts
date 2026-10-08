/**
 * 📥 RETRATO DE COMO OS IMPORTS DE VENDA VIVEM HOJE — read-only, ZERO escrita.
 *
 * ⛔ Responde o item 0 do pedido ANTES de qualquer linha de tela: o que é guardado, o que
 * NÃO é, e como o re-import se comporta de fato.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const ISO = (d: Date) => d.toISOString().slice(0, 10)
const brl = (n: number) => `R$ ${n.toFixed(2)}`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  const imports = await prisma.stockVendaImport.findMany({
    where: { companyId: EMPRESA },
    orderBy: { data: 'desc' },
  })
  const linhas = await prisma.stockVendaLinha.groupBy({
    by: ['data'],
    where: { companyId: EMPRESA },
    _sum: { quantidade: true, valorTotal: true },
    _count: { _all: true },
  })
  const comp = await prisma.stockVendaComplementoLinha.groupBy({
    by: ['data'],
    where: { companyId: EMPRESA },
    _sum: { ocorrencias: true, valorTotal: true },
    _count: { _all: true },
  })
  const compImportIds = await prisma.stockVendaComplementoLinha.findMany({
    where: { companyId: EMPRESA },
    distinct: ['importId'],
    select: { importId: true, data: true, criadoEm: true },
    orderBy: { data: 'desc' },
  })
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } })
  const nomeUser = new Map(users.map((u) => [u.id, u.name ?? u.email]))

  console.log('\n═══════ 1. IMPORT DE PRODUTOS — o que a tabela guarda ═══════')
  console.log(`  ${imports.length} dias em stock_venda_import`)
  console.log('  colunas: data · totalLinhas · totalUnidades · status · criadoPorId · criadoEm')
  console.log('  ⛔ NÃO guarda: nome do arquivo · Σ em R$ do ARQUIVO')
  const semAutor = imports.filter((i) => !i.criadoPorId).length
  console.log(`  sem criadoPorId: ${semAutor} de ${imports.length}`)
  const porLinhas = new Map(linhas.map((l) => [ISO(l.data), l]))
  for (const i of imports.slice(0, 12)) {
    const k = ISO(i.data)
    const l = porLinhas.get(k)
    const somaGravada = l?._sum.valorTotal ?? 0
    const unGravada = l?._sum.quantidade ?? 0
    const bateLinhas = (l?._count._all ?? 0) === i.totalLinhas
    const bateUn = unGravada === i.totalUnidades
    console.log(
      `   ${k} · meta ${i.totalLinhas}L/${i.totalUnidades}un · linhas ${l?._count._all ?? 0}L/${unGravada}un ${bateLinhas && bateUn ? '✓' : '⛔'} · Σ gravado ${brl(somaGravada)} · ${i.status} · ${i.criadoPorId ? (nomeUser.get(i.criadoPorId) ?? '?') : 'SEM AUTOR'} · ${i.criadoEm.toISOString().slice(0, 16)}`,
    )
  }

  console.log('\n═══════ 2. IMPORT DE COMPLEMENTOS — NÃO existe tabela de import ═══════')
  console.log('  só stock_venda_complemento_linha (importId é string SINTÉTICA, não FK)')
  console.log('  ⛔ NÃO guarda: autor do import · hora do import · nome do arquivo · Σ declarado')
  console.log(`  ${comp.length} dias com ocorrências · ${compImportIds.length} importIds distintos`)
  for (const c of compImportIds.slice(0, 8)) {
    console.log(`   «${c.importId}» · data ${ISO(c.data)} · 1ª linha criada ${c.criadoEm.toISOString().slice(0, 16)}`)
  }
  const periodo = compImportIds.filter((c) => c.importId.startsWith('comp-periodo-'))
  console.log(`  ⚠️ importIds de PERÍODO (a baixa recusa): ${periodo.length}`)

  console.log('\n═══════ 3. O PAR produtos × complementos, por dia ═══════')
  const compPorDia = new Map(comp.map((c) => [ISO(c.data), c]))
  const dias = [...new Set([...porLinhas.keys(), ...compPorDia.keys()])].sort().reverse()
  console.log(`  ${dias.length} dias com algum dado`)
  let soProd = 0, soComp = 0, ambos = 0
  for (const d of dias) {
    const p = porLinhas.get(d)
    const c = compPorDia.get(d)
    if (p && c) ambos++
    else if (p) soProd++
    else soComp++
  }
  console.log(`  com OS DOIS: ${ambos} · só PRODUTOS: ${soProd} · só COMPLEMENTOS: ${soComp}`)
  console.log('\n  os 14 dias mais recentes:')
  for (const d of dias.slice(0, 14)) {
    const p = porLinhas.get(d)
    const c = compPorDia.get(d)
    const pizzas = await prisma.stockVendaLinha.aggregate({
      where: { companyId: EMPRESA, data: p?.data ?? new Date(`${d}T12:00:00`), nomeSuitable: { contains: 'PIZZA' } },
      _sum: { quantidade: true },
    })
    const nPizza = pizzas._sum.quantidade ?? 0
    const nOc = c?._sum.ocorrencias ?? 0
    const razao = nPizza > 0 ? nOc / nPizza : null
    const selo = !p
      ? 'SÓ COMPLEMENTOS'
      : nPizza > 0 && nOc === 0
        ? '✗ SABORES NÃO IMPORTADOS'
        : razao != null && razao < 1
          ? '⚠ COMPLEMENTOS INCOMPLETOS'
          : '✓ completo'
    console.log(
      `   ${d} · ${selo.padEnd(26)} · prod ${String(p?._count._all ?? 0).padStart(3)}L/${String(p?._sum.quantidade ?? 0).padStart(5)}un ${brl(p?._sum.valorTotal ?? 0).padStart(14)} · comp ${String(c?._count._all ?? 0).padStart(3)}L/${String(nOc).padStart(4)}oc · pizzas ${String(nPizza).padStart(4)} · razão ${razao == null ? '—' : razao.toFixed(2)}`,
    )
  }

  console.log('\n═══════ 4. BURACO: dias de venda SEM importação ═══════')
  // ⚠️ "dia de venda" = dia em que o calendário de vendas (VendaDiaria) tem movimento
  const vd = await prisma.vendaDiaria.findMany({
    where: { companyId: EMPRESA },
    select: { dataCompetencia: true, dataCompetenciaFim: true },
    orderBy: { dataCompetencia: 'desc' },
    take: 60,
  })
  const diasDeVenda = new Set<string>()
  for (const v of vd) {
    const ini = v.dataCompetencia
    const fim = v.dataCompetenciaFim ?? v.dataCompetencia
    for (let t = ini.getTime(); t <= fim.getTime(); t += 86_400_000) diasDeVenda.add(ISO(new Date(t)))
  }
  const comImport = new Set(porLinhas.keys())
  const buracos = [...diasDeVenda].filter((d) => !comImport.has(d)).sort().reverse()
  console.log(`  dias de venda (pelo calendário): ${diasDeVenda.size} · SEM import de produtos: ${buracos.length}`)
  console.log(`  os 12 mais recentes: ${buracos.slice(0, 12).join(' · ') || '(nenhum)'}`)

  console.log('\n═══════ 5. RE-IMPORT: como funciona HOJE (lido no código, conferido no dado) ═══════')
  console.log('  PRODUTOS    : upsert no import (unique companyId+data) + deleteMany/createMany nas linhas')
  console.log('                + ESTORNA as BAIXA_VENDA ativas daquele import e refaz → SUBSTITUI')
  console.log('  ⚠️ o update do upsert NÃO mexe em criadoPorId/criadoEm → "quem · hora" é do PRIMEIRO import')
  console.log('  COMPLEMENTOS: deleteMany where {companyId, data} + createMany → SUBSTITUI')
  // ⚠️ `stock_movement` não tem @relation (o isolamento proíbe), então o par estorno↔original
  //    se resolve pelos IDS, nunca por join
  const todasBaixas = await prisma.stockMovement.findMany({ where: { companyId: EMPRESA, tipo: 'BAIXA_VENDA' }, select: { id: true } })
  const idsBaixa = new Set(todasBaixas.map((b) => b.id))
  const todosEstornos = await prisma.stockMovement.findMany({ where: { companyId: EMPRESA, tipo: 'ESTORNO' }, select: { estornoDeId: true } })
  const estornos = todosEstornos.filter((e) => e.estornoDeId && idsBaixa.has(e.estornoDeId)).length
  const baixas = todasBaixas.length
  console.log(`  no ledger: ${baixas} BAIXA_VENDA · ${estornos} estornadas → ${baixas - estornos} vivas`)

  console.log('\n═══════ 6. Σ DO ARQUIVO: guardado em algum lugar? ═══════')
  console.log('  ⛔ NÃO. `totalUnidades`/`totalLinhas` são contagem; o Σ em R$ só existe')
  console.log('     DERIVADO das linhas gravadas — ou seja, é o Σ GRAVADO, não o do ARQUIVO.')
  console.log('     Logo: pros dias antigos a conferência só pode dizer "Σ gravado", honesto.')

  console.log('\n⭐ ZERO ESCRITA — só leitura.\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
