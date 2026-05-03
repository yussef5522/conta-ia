// Backfill de empresas existentes para o Plano de Contas profissional (Fase B / Etapa 2.4).
//
// Pra cada empresa:
//   1. Migra taxRegime legacy (SIMPLES_NACIONAL → SIMPLES_NACIONAL_III; null → SIMPLES_NACIONAL_III)
//   2. Aplica template correto (idempotente — rodar 2x não duplica)
//   3. Mapeia categorias antigas (sem dreGroup) via heurística por nome
//   4. Preserva todas as transações (não toca em categoryId)
//
// Uso: npx tsx scripts/backfill-templates.ts
//
// Garantias:
//   - Atomicidade: cada empresa em prisma.$transaction (rollback se falhar)
//   - Idempotência: rodar várias vezes não duplica nem altera estado já correto
//   - Preserva transações: não há SQL nem ORM call que mexa em transactions
//   - Logs detalhados por empresa

import { PrismaClient } from '@prisma/client'
import { aplicarTemplate } from '../lib/categories/defaults'

const prisma = new PrismaClient()

// =============================================================================
// PURE FUNCTIONS (testáveis como unit)
// =============================================================================

const REGIMES_GRANULARES = new Set([
  'SIMPLES_NACIONAL_I',
  'SIMPLES_NACIONAL_II',
  'SIMPLES_NACIONAL_III',
  'SIMPLES_NACIONAL_IV',
  'SIMPLES_NACIONAL_V',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'MEI',
])

const REGIME_LEGACY_MAPPING: Record<string, string> = {
  // Default seguro: serviço Anexo III (mais comum em PMEs brasileiras)
  SIMPLES_NACIONAL: 'SIMPLES_NACIONAL_III',
}

export function normalizarTaxRegime(legacy: string | null | undefined): string {
  if (!legacy) return 'SIMPLES_NACIONAL_III'
  if (REGIMES_GRANULARES.has(legacy)) return legacy
  return REGIME_LEGACY_MAPPING[legacy] ?? 'SIMPLES_NACIONAL_III'
}

interface HeuristicaDre {
  regex: RegExp
  dreGroup:
    | 'RECEITA_BRUTA'
    | 'DEDUCOES'
    | 'CUSTO_PRODUTO_VENDIDO'
    | 'DESPESAS_COMERCIAIS'
    | 'DESPESAS_ADMINISTRATIVAS'
    | 'DESPESAS_PESSOAL'
    | 'RECEITAS_FINANCEIRAS'
    | 'DESPESAS_FINANCEIRAS'
    | 'OUTRAS_RECEITAS'
    | 'OUTRAS_DESPESAS'
    | 'IMPOSTOS_SOBRE_LUCRO'
    | 'DISTRIBUICAO_LUCROS'
    | 'INVESTIMENTOS'
    | 'TRANSFERENCIA'
}

// Ordem importa: regras mais específicas primeiro.
const HEURISTICAS_DRE_GROUP: HeuristicaDre[] = [
  { regex: /^Mensalidades/i, dreGroup: 'RECEITA_BRUTA' },
  { regex: /^Serviços prestados/i, dreGroup: 'RECEITA_BRUTA' },
  { regex: /^Consultas/i, dreGroup: 'RECEITA_BRUTA' },
  { regex: /^Outros recebimentos/i, dreGroup: 'OUTRAS_RECEITAS' },
  { regex: /^ISS/i, dreGroup: 'DEDUCOES' },
  { regex: /^Impostos/i, dreGroup: 'DEDUCOES' },
  { regex: /^Tarifas bancárias/i, dreGroup: 'DESPESAS_FINANCEIRAS' },
  { regex: /^Salários/i, dreGroup: 'DESPESAS_PESSOAL' },
  { regex: /^Aluguel/i, dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { regex: /^Água, luz/i, dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { regex: /^Material/i, dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { regex: /^Equipamentos/i, dreGroup: 'INVESTIMENTOS' },
  { regex: /^Marketing/i, dreGroup: 'DESPESAS_COMERCIAIS' },
  { regex: /^Outras despesas/i, dreGroup: 'OUTRAS_DESPESAS' },
  { regex: /^Transferência/i, dreGroup: 'TRANSFERENCIA' },
]

export function inferirDreGroup(nome: string): string | null {
  for (const { regex, dreGroup } of HEURISTICAS_DRE_GROUP) {
    if (regex.test(nome)) return dreGroup
  }
  return null
}

// =============================================================================
// EXECUÇÃO (efeito colateral em DB)
// =============================================================================

interface BackfillLog {
  empresa: string
  id: string
  typeOriginal: string
  typeNormalizado: string
  taxRegimeAntes: string
  taxRegimeDepois: string
  categoriasCriadasPeloTemplate: number
  categoriasAntigasMapeadas: number
  categoriasAntigasSemMatch: number
  transacoesPreservadas: number
  semMatchNomes: string[]
}

async function backfillEmpresa(companyId: string): Promise<BackfillLog> {
  return prisma.$transaction(async (tx) => {
    const empresa = await tx.company.findUnique({ where: { id: companyId } })
    if (!empresa) throw new Error(`Empresa ${companyId} não encontrada`)

    const typeNormalizado = (empresa.type ?? '').toLowerCase().trim()
    const taxRegimeNormalizado = normalizarTaxRegime(empresa.taxRegime)

    // 1. Atualiza taxRegime se legacy
    if (taxRegimeNormalizado !== empresa.taxRegime) {
      await tx.company.update({
        where: { id: companyId },
        data: { taxRegime: taxRegimeNormalizado },
      })
    }

    // 2. Aplica template (idempotente: pula categorias com mesmo (companyId, parentId, name))
    const r = await aplicarTemplate(tx, companyId, empresa.type)

    // 3. Mapeia categorias antigas que ainda estão sem dreGroup
    const antigas = await tx.category.findMany({
      where: { companyId, dreGroup: null },
      select: { id: true, name: true, _count: { select: { transactions: true } } },
    })

    const semMatchNomes: string[] = []
    let mapeadas = 0
    let semMatch = 0
    let txPreservadas = 0

    for (const cat of antigas) {
      txPreservadas += cat._count.transactions
      const dreGroup = inferirDreGroup(cat.name)
      if (dreGroup) {
        await tx.category.update({
          where: { id: cat.id },
          data: {
            dreGroup,
            isSystemDefault: false,
            visibleInRegimes: null,
          },
        })
        mapeadas++
      } else {
        semMatch++
        semMatchNomes.push(cat.name)
      }
    }

    return {
      empresa: empresa.tradeName ?? empresa.name,
      id: empresa.id,
      typeOriginal: empresa.type,
      typeNormalizado,
      taxRegimeAntes: empresa.taxRegime,
      taxRegimeDepois: taxRegimeNormalizado,
      categoriasCriadasPeloTemplate: r.inseridas,
      categoriasAntigasMapeadas: mapeadas,
      categoriasAntigasSemMatch: semMatch,
      transacoesPreservadas: txPreservadas,
      semMatchNomes,
    }
  })
}

async function main() {
  console.log('🔄 Backfill de Templates Profissionais — Etapa 2.4\n')

  const empresas = await prisma.company.findMany({
    select: { id: true, name: true, tradeName: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`📋 ${empresas.length} empresa(s) encontrada(s).\n`)
  console.log('─'.repeat(72))

  let totalCriadas = 0
  let totalMapeadas = 0
  let totalSemMatch = 0
  let totalTx = 0

  for (const empresa of empresas) {
    try {
      const log = await backfillEmpresa(empresa.id)
      console.log(`\n✅ ${log.empresa}`)
      console.log(`   id: ${log.id}`)
      console.log(`   type: "${log.typeOriginal}" → "${log.typeNormalizado}"`)
      console.log(`   taxRegime: "${log.taxRegimeAntes}" → "${log.taxRegimeDepois}"`)
      console.log(`   categorias do template criadas: ${log.categoriasCriadasPeloTemplate}`)
      console.log(`   antigas mapeadas (dreGroup): ${log.categoriasAntigasMapeadas}`)
      console.log(`   antigas sem match (revisão manual): ${log.categoriasAntigasSemMatch}`)
      if (log.semMatchNomes.length > 0) {
        console.log(`     ↳ ${log.semMatchNomes.join(', ')}`)
      }
      console.log(`   transações preservadas: ${log.transacoesPreservadas}`)

      totalCriadas += log.categoriasCriadasPeloTemplate
      totalMapeadas += log.categoriasAntigasMapeadas
      totalSemMatch += log.categoriasAntigasSemMatch
      totalTx += log.transacoesPreservadas
    } catch (e) {
      console.error(`\n❌ Erro em ${empresa.tradeName ?? empresa.name}:`, e)
      throw e
    }
  }

  console.log('\n' + '─'.repeat(72))
  console.log('📊 Totais:')
  console.log(`   categorias criadas (templates):           ${totalCriadas}`)
  console.log(`   categorias antigas mapeadas pra dreGroup: ${totalMapeadas}`)
  console.log(`   categorias antigas sem match:             ${totalSemMatch}`)
  console.log(`   transações preservadas (intactas):        ${totalTx}`)
  console.log('\n✨ Backfill concluído. Idempotente — rodar de novo dá o mesmo resultado.\n')
}

// Permite import sem executar (pra testes)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
