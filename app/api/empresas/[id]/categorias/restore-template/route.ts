import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  computeTemplateDiff,
  templateToFlat,
} from '@/lib/categories/template-diff'
import { restoreSchema, validarRestorePayload } from '@/lib/categories/restore-validation'
import { regimesToJson } from '@/lib/categories/regimes'
import type { CategoryFlat } from '@/lib/categories/buildTree'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/empresas/[id]/categorias/restore-template
// Aplica o diff aprovado pelo usuário em transação atômica + cria audit log.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('category.restore_template')

    // Carrega empresa pra obter o tipo (setor) — multi-tenant já validado em getAuthContext
    const company = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { id: true, type: true },
    })
    if (!company) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const data = restoreSchema.parse(body)

    if (
      data.revertEdited.length === 0 &&
      data.removeCustom.length === 0 &&
      data.addMissing.length === 0
    ) {
      return NextResponse.json({ erro: 'Nenhuma mudança selecionada' }, { status: 400 })
    }

    const setor = company.type
    const template = templateToFlat(setor)
    if (template.length === 0) {
      return NextResponse.json(
        { erro: `Setor "${setor}" não tem template definido.` },
        { status: 400 },
      )
    }

    // Recalcula diff (server confia em SI mesmo, não no body)
    const cats = await prisma.category.findMany({
      where: { companyId: empresaId },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        dreGroup: true,
        code: true,
        description: true,
        color: true,
        icon: true,
        order: true,
        visibleInRegimes: true,
        isActive: true,
        isSystemDefault: true,
        templateKey: true,
        _count: { select: { transactions: true, children: true } },
      },
    })

    const diff = computeTemplateDiff(cats, template)

    // Map id → cat com counts
    const catsById = new Map<
      string,
      CategoryFlat & { _count: { transactions: number; children: number } }
    >(cats.map((c) => [c.id, c]))

    // Valida payload contra diff atual
    const erros = validarRestorePayload(data, diff, catsById)
    if (erros.length > 0) {
      return NextResponse.json(
        {
          erro: 'Algumas mudanças não puderam ser aplicadas',
          detalhes: erros,
        },
        { status: 400 },
      )
    }

    // Mapeia templateKey → templateOriginal das edited (pra reverter)
    const editedTemplateById = new Map(
      diff.edited.map((e) => [e.category.id, e.templateOriginal]),
    )

    // Mapeia templateKey → TemplateCategory das missing (pra adicionar)
    const missingByKey = new Map(diff.missing.map((m) => [m.templateKey, m]))

    // Pra resolver parentId ao adicionar missing: precisamos mapear
    // parentTemplateKey → categoryId existente. Categorias do template
    // que JÁ estão na empresa têm o templateKey preenchido.
    const idByTemplateKey = new Map<string, string>()
    for (const c of cats) {
      if (c.templateKey) idByTemplateKey.set(c.templateKey, c.id)
    }

    // Snapshot pra audit log
    const snapshot = {
      reverted: [] as Array<{ id: string; before: Record<string, unknown>; after: Record<string, unknown> }>,
      removed: [] as Array<{ id: string; name: string }>,
      added: [] as Array<{ templateKey: string; name: string }>,
    }

    // Transação atômica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert edited: volta valores ao template
      for (const id of data.revertEdited) {
        const tpl = editedTemplateById.get(id)
        const original = catsById.get(id)
        if (!tpl || !original) continue

        // Resolve novo parentId baseado em parentTemplateKey
        const novoParentId = tpl.parentTemplateKey
          ? (idByTemplateKey.get(tpl.parentTemplateKey) ?? null)
          : null

        await tx.category.update({
          where: { id },
          data: {
            name: tpl.name,
            dreGroup: tpl.dreGroup,
            type: tpl.type,
            parentId: novoParentId,
          },
        })

        snapshot.reverted.push({
          id,
          before: {
            name: original.name,
            dreGroup: original.dreGroup,
            type: original.type,
            parentId: original.parentId,
          },
          after: {
            name: tpl.name,
            dreGroup: tpl.dreGroup,
            type: tpl.type,
            parentId: novoParentId,
          },
        })
      }

      // 2. Remove custom (hard delete — já validamos sem transações/filhos)
      for (const id of data.removeCustom) {
        const cat = catsById.get(id)
        if (!cat) continue
        await tx.category.delete({ where: { id } })
        snapshot.removed.push({ id, name: cat.name })
      }

      // 3. Add missing: cria categoria do template
      // Ordena por profundidade (raízes antes de filhos) pra resolver parentId
      const addedKeys = data.addMissing
        .map((k) => missingByKey.get(k))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .sort((a, b) => {
          const depthA = a.parentTemplateKey ? 1 : 0
          const depthB = b.parentTemplateKey ? 1 : 0
          return depthA - depthB
        })

      for (const tpl of addedKeys) {
        // parentId resolvido via parentTemplateKey (se já existe na empresa)
        const parentId = tpl.parentTemplateKey
          ? (idByTemplateKey.get(tpl.parentTemplateKey) ?? null)
          : null

        // order: max(order) atual + 1 dentro do parent
        const maxOrder = await tx.category.aggregate({
          where: { companyId: empresaId, parentId },
          _max: { order: true },
        })

        const novaCat = await tx.category.create({
          data: {
            companyId: empresaId,
            name: tpl.name,
            type: tpl.type,
            dreGroup: tpl.dreGroup,
            parentId,
            color: tpl.defaultColor ?? '#10b981',
            icon: tpl.defaultIcon,
            code: tpl.defaultCode,
            order: (maxOrder._max.order ?? 0) + 1,
            visibleInRegimes: regimesToJson(null),
            isActive: true,
            isSystemDefault: true,
            templateKey: tpl.templateKey,
          },
          select: { id: true },
        })

        // Registra no map pra que filhos subsequentes encontrem o parent
        idByTemplateKey.set(tpl.templateKey, novaCat.id)
        snapshot.added.push({ templateKey: tpl.templateKey, name: tpl.name })
      }

      // 4. Audit log específico de Restaurar Padrão (CategoryRestoreLog)
      const log = await tx.categoryRestoreLog.create({
        data: {
          companyId: empresaId,
          userId: ctx.user.id,
          revertedCount: snapshot.reverted.length,
          removedCount: snapshot.removed.length,
          addedCount: snapshot.added.length,
          details: JSON.stringify(snapshot),
        },
        select: { id: true },
      })

      // 5. Audit log genérico (5.3.A) — participa da mesma transação via tx
      await logAudit(
        ctx,
        {
          action: 'RESTORE_TEMPLATE',
          entityType: 'Company',
          entityId: empresaId,
          metadata: {
            revertedCount: snapshot.reverted.length,
            removedCount: snapshot.removed.length,
            addedCount: snapshot.added.length,
            categoryRestoreLogId: log.id,
          },
          request,
        },
        tx,
      )

      return {
        applied: {
          reverted: snapshot.reverted.length,
          removed: snapshot.removed.length,
          added: snapshot.added.length,
        },
        logId: log.id,
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}
