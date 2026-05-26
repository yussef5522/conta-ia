// Sprint 5.0.2.l — Recategorização RETROATIVA completa de transações pendentes.
//
// Pipeline 5 fases (ordem de prioridade, primeiro que casa "vence"):
//   FASE 0 — Same-company transfer (Sprint j)
//   FASE 1 — Pix relacionado: sócio PF / empresa do grupo (Sprint i)
//   FASE 2 — Regras de aprendizado da empresa EXACT/NORMALIZED/CONTAINS (Sprint k)
//   FASE 3 — Padrões universais BR (Sprint l, NOVO — DARF, INSS, Stone, Celesc, Uber etc)
//   FASE 4 — (Claude AI fica de fora; é lazy via UI /pendentes — caro pra bulk)
//
// Diferente de /recategorize-pix (que SÓ rodava 0 + 1), este endpoint
// ataca TODA pendência categorizável sem AI.
//
// Resposta: contadores por fase + IDs amostrados pra revert se precisar.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { ensureAllSystemCategories } from '@/lib/categorias/ensure-system-categories'
import { detectAndPlanPixApply } from '@/lib/pix-detection/auto-apply-pix'
import { matchInternalTransferForTransaction } from '@/lib/conciliation/match-internal-transfer'
import { matchSameCompanyTransfer } from '@/lib/conciliation/match-same-company-transfer'
import {
  matchUniversalPattern,
  resolveUniversalCategoryId,
} from '@/lib/categorization/apply-universal-patterns'
import { loadActiveRules, buildRuleIndex } from '@/lib/ai-categorizer/apply'
import { predictCategory } from '@/lib/ai-categorizer/predict'
import { extractDescriptionStem } from '@/lib/rules/extract-stem'

interface Params {
  params: Promise<{ id: string }>
}

const BATCH_CAP = 3000

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const t0 = Date.now()

    // Pre-load tudo que precisamos
    const [socios, empresas, systemCategories, activeRules] = await Promise.all([
      prisma.socioPF.findMany({ where: { companyId } }),
      prisma.empresaRelacionada.findMany({ where: { companyId } }),
      ensureAllSystemCategories(companyId),
      loadActiveRules(companyId),
    ])
    const ruleIndex = buildRuleIndex(companyId, activeRules)

    // Pega TODAS as pendentes (sem categoria, status PENDING, lifecycle effected)
    // — não filtra por PIX agora; queremos atacar tudo.
    const pendentes = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        categoryId: null,
        status: 'PENDING',
        lifecycle: 'EFFECTED',
        type: { not: 'TRANSFER' },
      },
      select: {
        id: true,
        description: true,
        type: true,
        amount: true,
        date: true,
        paymentDate: true,
        dedupHash: true,
        bankAccountId: true,
      },
      take: BATCH_CAP,
    })

    const sociosMapped = socios.map((s) => ({
      id: s.id,
      nome: s.nome,
      cpf: s.cpf,
      pixKeys: safeArray(s.pixKeys),
      papel: s.papel,
    }))
    const empresasMapped = empresas.map((e) => ({
      id: e.id,
      nomeFantasia: e.nomeFantasia,
      cnpjRelacionado: e.cnpjRelacionado,
      pixKeys: safeArray(e.pixKeys),
      relacao: e.relacao,
    }))

    // Build regras CONTAINS index (predict.ts cobre EXACT/NORMALIZED só;
    // CONTAINS é matched manualmente abaixo com substring).
    // Cast: TipoMatch type só tem 'EXACT'|'NORMALIZED' por compat Sprint 3,
    // mas schema permite 'CONTAINS' (Sprint 5.0.2.k cria via raw).
    const containsRules = activeRules.filter(
      (r) => (r.tipoMatch as string) === 'CONTAINS' && r.categoryId && r.isActive,
    )

    let sameCompanyCount = 0
    let pixSocioPFCount = 0
    let pixGrupoPJCount = 0
    let ruleExactCount = 0
    let ruleContainsCount = 0
    let universalCount = 0
    let conciliacoesExternas = 0

    const sampleSameCompany: string[] = []
    const samplePixSocio: string[] = []
    const samplePixGrupo: string[] = []
    const sampleRule: string[] = []
    const sampleUniversal: string[] = []

    for (const tx of pendentes) {
      const dateForMatch = tx.paymentDate ?? tx.date

      // ───────────────────────────────────────────────────────────
      // FASE 0 — Same-company transfer (sem cadastro)
      // ───────────────────────────────────────────────────────────
      const sameCompany = await matchSameCompanyTransfer({
        transactionId: tx.id,
        bankAccountId: tx.bankAccountId ?? '',
        companyId,
        type: tx.type,
        amount: tx.amount,
        date: dateForMatch,
        description: tx.description,
      })
      if (sameCompany.matched) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            categoryId: systemCategories.transferenciaInternaId,
            status: 'RECONCILED',
            classificationSource: 'AI',
            aiConfidence: 1.0,
          },
        })
        if (sameCompany.linkedTransactionId) {
          await prisma.transaction.update({
            where: { id: sameCompany.linkedTransactionId },
            data: {
              categoryId: systemCategories.transferenciaInternaId,
              status: 'RECONCILED',
              classificationSource: 'AI',
              aiConfidence: 1.0,
            },
          })
        }
        sameCompanyCount++
        if (sampleSameCompany.length < 5) sampleSameCompany.push(tx.id)
        continue
      }

      // ───────────────────────────────────────────────────────────
      // FASE 1 — Pix relacionado (sócio/grupo)
      // ───────────────────────────────────────────────────────────
      if (
        (sociosMapped.length > 0 || empresasMapped.length > 0) &&
        tx.description &&
        /PIX/i.test(tx.description)
      ) {
        const plan = detectAndPlanPixApply(
          tx,
          sociosMapped,
          empresasMapped,
          systemCategories,
        )
        if (plan.apply && plan.patch) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: plan.patch,
          })
          if (plan.patch.relatedPartyType === 'SOCIO_PF') {
            pixSocioPFCount++
            if (samplePixSocio.length < 5) samplePixSocio.push(tx.id)
          } else if (plan.patch.relatedPartyType === 'GRUPO_PJ') {
            pixGrupoPJCount++
            if (samplePixGrupo.length < 5) samplePixGrupo.push(tx.id)
            const matchResult = await matchInternalTransferForTransaction({
              transactionId: tx.id,
              companyId,
              type: tx.type,
              amount: tx.amount,
              date: dateForMatch,
              relatedPartyType: 'GRUPO_PJ',
              relatedPartyId: plan.patch.relatedPartyId,
            })
            if (matchResult.matched) conciliacoesExternas++
          }
          continue
        }
      }

      // ───────────────────────────────────────────────────────────
      // FASE 2 — Regras aprendidas EXACT/NORMALIZED (Sprint k via predict)
      // ───────────────────────────────────────────────────────────
      if (tx.description) {
        const pred = predictCategory({ description: tx.description }, ruleIndex)
        if (pred && pred.categoryId && pred.confidence >= 0.95) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              categoryId: pred.categoryId,
              status: 'RECONCILED',
              classificationSource: 'RULE',
              classifiedByRuleId: pred.ruleId,
              aiConfidence: pred.confidence,
            },
          })
          await prisma.aiLearningRule.update({
            where: { id: pred.ruleId },
            data: { vezesAplicada: { increment: 1 } },
          })
          ruleExactCount++
          if (sampleRule.length < 5) sampleRule.push(tx.id)
          continue
        }

        // CONTAINS rules (substring case-insensitive, mesmo type)
        const descUpper = tx.description.toUpperCase()
        let matchedContains: typeof containsRules[number] | null = null
        for (const r of containsRules) {
          if (descUpper.includes(r.padrao.toUpperCase())) {
            matchedContains = r
            break
          }
        }
        if (matchedContains && matchedContains.categoryId) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              categoryId: matchedContains.categoryId,
              status: 'RECONCILED',
              classificationSource: 'RULE',
              classifiedByRuleId: matchedContains.id,
              aiConfidence: matchedContains.confianca,
            },
          })
          await prisma.aiLearningRule.update({
            where: { id: matchedContains.id },
            data: { vezesAplicada: { increment: 1 } },
          })
          ruleContainsCount++
          if (sampleRule.length < 5) sampleRule.push(tx.id)
          continue
        }
      }

      // ───────────────────────────────────────────────────────────
      // FASE 3 — Padrões universais BR (Sprint l, NOVO)
      //   No bulk retroativo, aceitamos AUTO + SUGGEST tiers.
      // ───────────────────────────────────────────────────────────
      const universal = matchUniversalPattern({
        description: tx.description,
        type: tx.type,
      })
      if (universal) {
        const categoryId = resolveUniversalCategoryId(systemCategories.list, {
          categoryNameHint: universal.pattern.categoryNameHint,
          dreGroup: universal.pattern.dreGroup,
        })
        if (categoryId) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              categoryId,
              status: 'RECONCILED',
              classificationSource: 'UNIVERSAL',
              aiConfidence: universal.pattern.confidence,
            },
          })
          universalCount++
          if (sampleUniversal.length < 5) sampleUniversal.push(tx.id)
          continue
        }
      }

      // Sem match em nenhuma fase → continua PENDING
    }

    const elapsedMs = Date.now() - t0

    const totalCategorizadas =
      sameCompanyCount +
      pixSocioPFCount +
      pixGrupoPJCount +
      ruleExactCount +
      ruleContainsCount +
      universalCount

    console.log(
      `[RECATEGORIZE-ALL] company=${companyId} analisadas=${pendentes.length} ` +
        `categorizadas=${totalCategorizadas} ` +
        `[sc=${sameCompanyCount} pix_socio=${pixSocioPFCount} pix_grupo=${pixGrupoPJCount} ` +
        `rule_exact=${ruleExactCount} rule_contains=${ruleContainsCount} ` +
        `universal=${universalCount}] elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      analisadas: pendentes.length,
      totalCategorizadas,
      sameCompany: sameCompanyCount,
      pixSocioPF: pixSocioPFCount,
      pixGrupoPJ: pixGrupoPJCount,
      ruleExact: ruleExactCount,
      ruleContains: ruleContainsCount,
      universal: universalCount,
      conciliacoesExternas,
      sampleIds: {
        sameCompany: sampleSameCompany,
        pixSocio: samplePixSocio,
        pixGrupo: samplePixGrupo,
        rule: sampleRule,
        universal: sampleUniversal,
      },
      elapsedMs,
      breakdown: {
        fase0_sameCompany: sameCompanyCount,
        fase1_pix: pixSocioPFCount + pixGrupoPJCount,
        fase2_rules: ruleExactCount + ruleContainsCount,
        fase3_universal: universalCount,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function safeArray(stored: string): string[] {
  try {
    const r = JSON.parse(stored)
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

// extractDescriptionStem reservado pra futura Fase 3.5 (sugestão de regras STEM
// em bulk). Mantido import pra evitar dead-code warning quando essa fase entrar.
void extractDescriptionStem
