// Sprint 5.0.2.s — Migra categorias antigas (Fornecedor X) pras novas
// contábeis (Matéria-Prima X) baseado no setor da empresa.
//
// Uso: npx tsx scripts/migrate-categorias-contabeis.ts <companyId>
//   ou: npx tsx scripts/migrate-categorias-contabeis.ts --all
//
// Comportamento:
//   1. Garante que o plano de contas setorial existe (cria categorias novas)
//   2. Para cada categoria legada que tem mapping no setor da empresa:
//      a. Move TODAS as transactions pra categoria nova
//      b. Atualiza AiLearningRule.categoryId pra apontar pra nova
//      c. Desativa a categoria antiga (NÃO deleta — histórico/audit)
//   3. Imprime relatório por empresa.

import { PrismaClient } from '@prisma/client'
import { ensureAllSystemCategories } from '../lib/categorias/ensure-system-categories'
import {
  mapearCategoriaLegada,
  type SetorPlano,
} from '../prisma/seeds/plano-contas-setorial'

const prisma = new PrismaClient()

const VALID_SETORES = new Set([
  'RESTAURANTE',
  'ACADEMIA',
  'COMERCIO_ROUPA',
  'VAREJO_GERAL',
])

interface Stats {
  companyId: string
  companyName: string
  setor: string | null
  categoriasMigradas: number
  transactionsMigradas: number
  rulesMigradas: number
  categoriasInativadas: number
  pulado: boolean
  motivo?: string
}

async function migrarEmpresa(companyId: string): Promise<Stats> {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, setor: true },
  })
  if (!empresa) {
    return {
      companyId,
      companyName: '(não encontrada)',
      setor: null,
      categoriasMigradas: 0,
      transactionsMigradas: 0,
      rulesMigradas: 0,
      categoriasInativadas: 0,
      pulado: true,
      motivo: 'empresa não encontrada',
    }
  }
  if (!empresa.setor || !VALID_SETORES.has(empresa.setor)) {
    return {
      companyId,
      companyName: empresa.name,
      setor: empresa.setor,
      categoriasMigradas: 0,
      transactionsMigradas: 0,
      rulesMigradas: 0,
      categoriasInativadas: 0,
      pulado: true,
      motivo: 'sem setor cadastrado ou inválido',
    }
  }

  const setor = empresa.setor as SetorPlano

  // 1. Garante plano de contas setorial
  await ensureAllSystemCategories(empresa.id, setor)

  // 2. Lista categorias existentes
  const cats = await prisma.category.findMany({
    where: { companyId: empresa.id, isActive: true },
    select: { id: true, name: true, dreGroup: true },
  })
  const byName = new Map<string, string>()
  for (const c of cats) byName.set(c.name, c.id)

  let categoriasMigradas = 0
  let transactionsMigradas = 0
  let rulesMigradas = 0
  let categoriasInativadas = 0

  for (const cat of cats) {
    const nomeNovo = mapearCategoriaLegada(cat.name, setor)
    if (!nomeNovo) continue
    if (nomeNovo === cat.name) continue // já está com nome novo

    const idNovo = byName.get(nomeNovo)
    if (!idNovo) {
      console.warn(
        `[MIGRATE] ${empresa.name}: categoria nova "${nomeNovo}" não existe (esperada de ensure)`,
      )
      continue
    }

    // Move transactions
    const txResult = await prisma.transaction.updateMany({
      where: { categoryId: cat.id, bankAccount: { companyId: empresa.id } },
      data: { categoryId: idNovo },
    })
    transactionsMigradas += txResult.count

    // Move rules
    const ruleResult = await prisma.aiLearningRule.updateMany({
      where: { categoryId: cat.id, companyId: empresa.id },
      data: { categoryId: idNovo },
    })
    rulesMigradas += ruleResult.count

    // Inativa antiga (NÃO deleta — preserva audit log)
    await prisma.category.update({
      where: { id: cat.id },
      data: { isActive: false },
    })
    categoriasInativadas++
    categoriasMigradas++
  }

  return {
    companyId,
    companyName: empresa.name,
    setor,
    categoriasMigradas,
    transactionsMigradas,
    rulesMigradas,
    categoriasInativadas,
    pulado: false,
  }
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Uso: npx tsx scripts/migrate-categorias-contabeis.ts <companyId|--all>')
    process.exit(1)
  }

  const targets =
    arg === '--all'
      ? (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id)
      : [arg]

  console.log(`[MIGRATE] Empresas alvo: ${targets.length}\n`)

  for (const id of targets) {
    const stats = await migrarEmpresa(id)
    if (stats.pulado) {
      console.log(`⏭  ${stats.companyName}: ${stats.motivo}`)
    } else {
      console.log(
        `✓ ${stats.companyName} (${stats.setor}): ${stats.categoriasMigradas} cats migradas · ` +
          `${stats.transactionsMigradas} tx · ${stats.rulesMigradas} regras`,
      )
    }
  }
}

main()
  .catch((err) => {
    console.error('[MIGRATE] erro:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
