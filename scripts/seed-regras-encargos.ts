// ⭐ SEED DAS REGRAS DE ENCARGO DA CONTA ÚNICA (04/09/2026) — preview por padrão.
//
// O vocabulário e o PORQUÊ de cada categoria vivem em
// `lib/bank-profiles/regras-encargos-banrisul.ts` (medidos no histórico do próprio dono).
// Aqui só se resolve o id da categoria e se grava.
//
// ⛔ SEM `--apply` NÃO GRAVA. ⛔ NÃO SOBRESCREVE regra existente: se o dono já ensinou algo
// pra aquele padrão, a dele manda — seed que atropela decisão do dono é o oposto do combinado.
//
//   npx tsx scripts/seed-regras-encargos.ts [--apply]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { REGRAS_DE_ENCARGO } from '@/lib/bank-profiles/regras-encargos-banrisul'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const cats = await prisma.category.findMany({
    where: { companyId: COMPANY, isActive: true },
    select: { id: true, name: true, dreGroup: true },
  })
  const porNome = new Map(cats.map((c) => [c.name, c]))

  const existentes = await prisma.aiLearningRule.findMany({
    where: { companyId: COMPANY },
    select: { id: true, padrao: true, tipoMatch: true, vezesAplicada: true },
  })
  const jaTem = new Map(existentes.map((r) => [r.padrao.toUpperCase(), r]))

  console.log(`\n=== SEED DE ENCARGOS — ${APLICAR ? 'APLICANDO' : 'PREVIEW (nada será gravado)'} ===\n`)

  const aCriar: { padrao: string; tipoMatch: string; categoryId: string }[] = []
  for (const r of REGRAS_DE_ENCARGO) {
    const cat = porNome.get(r.categoria)
    // ⛔ categoria que não existe ABORTA tudo: criar categoria por conta própria seria o
    // sistema decidindo plano de contas, que é decisão do dono.
    if (!cat) throw new Error(`Categoria "${r.categoria}" não existe (ou está inativa) nesta empresa.`)

    const conflito = jaTem.get(r.padrao.toUpperCase())
    if (conflito) {
      console.log(`  ⏭  "${r.padrao}" — JÁ EXISTE (${conflito.tipoMatch}, ${conflito.vezesAplicada}× aplicada). A regra do dono manda; não toco.`)
      continue
    }
    console.log(`  +  "${r.padrao}" [${r.tipoMatch}] → ${cat.name} (${cat.dreGroup})`)
    console.log(`     motivo: ${r.motivo}`)
    if (r.empateNaHistoria) console.log(`     ⚠️  EMPATE na história do dono — confira no lote e troque se discordar.`)
    aCriar.push({ padrao: r.padrao, tipoMatch: r.tipoMatch, categoryId: cat.id })
  }

  console.log(`\n${aCriar.length} regra(s) a criar · ${REGRAS_DE_ENCARGO.length - aCriar.length} já existiam`)
  console.log('⚠️  Elas SUGEREM; quem confirma no lote continua sendo o dono.')

  if (!APLICAR) {
    console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply pra executar.\n')
    return
  }

  for (const r of aCriar) {
    await prisma.aiLearningRule.create({
      data: {
        companyId: COMPANY, padrao: r.padrao, tipoMatch: r.tipoMatch,
        categoryId: r.categoryId, confianca: 0.95, fonte: 'MANUAL', isActive: true,
      },
    })
  }
  console.log(`\n✓ ${aCriar.length} regra(s) criada(s).\n`)
}

main().finally(() => prisma.$disconnect())
