// READ-ONLY — de onde vêm os "121 complementos · CALABRESA 115" da prateleira (02/09).
//
// ⚠️ REGRA 8b: prova em qual banco está antes de medir; zero silencioso é indistinguível
// de "não tem" (foi assim que eu concluí por escrito que 4 mapeamentos tinham sumido).
//
// NÃO ESCREVE NADA.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { prateleiraDeComplementos } from '@/lib/stock/vendas/complemento-map'
import { prateleiraGravada } from '@/lib/stock/vendas/import-complementos'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  // 1. o que está GRAVADO na tabela de linhas de complemento
  const linhas = await prisma.stockVendaComplementoLinha.findMany({
    where: { companyId: COMPANY },
    select: { data: true, importId: true, nomeSuitable: true, ocorrencias: true, valorTotal: true },
  })
  console.log(`\n=== 1. stock_venda_complemento_linha ===`)
  console.log(`linhas gravadas: ${linhas.length}`)
  console.log(`nomes distintos: ${new Set(linhas.map((l) => l.nomeSuitable)).size}`)
  console.log(`Σ ocorrências: ${linhas.reduce((s, l) => s + l.ocorrencias, 0)}`)

  const porDia = new Map<string, { linhas: number; ocorrencias: number; importId: string }>()
  for (const l of linhas) {
    const k = l.data.toISOString().slice(0, 10)
    const a = porDia.get(k) ?? { linhas: 0, ocorrencias: 0, importId: l.importId }
    a.linhas++; a.ocorrencias += l.ocorrencias
    porDia.set(k, a)
  }
  console.log(`\npor DIA importado:`)
  for (const [d, a] of [...porDia.entries()].sort()) console.log(`  ${d}  ${a.linhas} linhas · ${a.ocorrencias} ocorrências`)

  const cal = linhas.filter((l) => l.nomeSuitable === 'CALABRESA')
  console.log(`\nCALABRESA: ${cal.length} linha(s), Σ ${cal.reduce((s, l) => s + l.ocorrencias, 0)} ocorrências`)
  console.log(`  ${cal.map((l) => `${l.data.toISOString().slice(0, 10)}=${l.ocorrencias}`).join(' · ')}`)

  // as 5 maiores, pra comparar com o gabarito da fixture (CALABRESA 1220, FRANGO 371, BACON 328)
  const soma = new Map<string, number>()
  for (const l of linhas) soma.set(l.nomeSuitable, (soma.get(l.nomeSuitable) ?? 0) + l.ocorrencias)
  console.log(`\ntop 8 da tabela:`)
  for (const [n, o] of [...soma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${o.toString().padStart(5)}  ${n}`)

  // 2. o que a PRATELEIRA devolve (o que a tela mostra)
  const p = await prateleiraGravada(COMPANY, prisma)
  console.log(`\n=== 2. prateleiraGravada (o que a aba mostra) ===`)
  console.log(`linhas: ${p.length} · Σ ocorrências: ${p.reduce((s, x) => s + x.ocorrencias, 0)}`)
  console.log(`topo: ${p.slice(0, 3).map((x) => `${x.nomeSuitable}=${x.ocorrencias}`).join(' · ')}`)

  // 3. o MAPA — nome que já tem destino mas cuja linha não existe mais some da prateleira?
  const maps = await prisma.stockVendaComplementoMap.findMany({
    where: { companyId: COMPANY }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true },
  })
  const nomesLinha = new Set(linhas.map((l) => l.nomeSuitable))
  const orfaos = maps.filter((m) => !nomesLinha.has(m.nomeSuitable))
  console.log(`\n=== 3. mapa de complementos ===`)
  console.log(`mapeamentos: ${maps.length} (FICHA ${maps.filter((m) => m.alvoTipo === 'FICHA').length} · IGNORAR ${maps.filter((m) => m.alvoTipo === 'IGNORAR').length})`)
  console.log(`⚠️ mapeados SEM linha (invisíveis na prateleira hoje): ${orfaos.length}`)
  if (orfaos.length) console.log(`   ${orfaos.map((o) => o.nomeSuitable).join(' · ')}`)

  // 4. contrafactual: a prateleira depende de PERÍODO em algum lugar?
  const soDoDia = linhas.filter((l) => l.data.toISOString().slice(0, 10) === [...porDia.keys()].sort().pop())
  const pDia = await prateleiraDeComplementos(COMPANY, soDoDia.map((l) => ({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias })), prisma)
  console.log(`\n=== 4. contrafactual (só o último dia) ===`)
  console.log(`só o último dia daria: ${pDia.length} nomes · CALABRESA ${pDia.find((x) => x.nomeSuitable === 'CALABRESA')?.ocorrencias ?? 0}`)

  // 5. o outro relatório (produtos), pra comparar o período
  const prod = await prisma.stockVendaLinha.findMany({ where: { companyId: COMPANY }, select: { data: true, nomeSuitable: true } })
  const diasProd = [...new Set(prod.map((l) => l.data.toISOString().slice(0, 10)))].sort()
  console.log(`\n=== 5. relatório de PRODUTOS (comparação) ===`)
  console.log(`linhas: ${prod.length} · nomes distintos: ${new Set(prod.map((l) => l.nomeSuitable)).size} · dias: ${diasProd.join(', ')}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
