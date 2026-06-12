// Sub-fase 2D — Endpoint /v2-confirm.
//
// Substitui o /confirm legado SÓ quando flag IMPORT_PREVIEW_V2=true em prod.
// O legado continua intacto pra rollback rápido (desliga flag).
//
// Body: multipart/form-data com:
//   - file: arquivo OFX (re-anexado pra anti-forge)
//   - body: JSON string com V2ConfirmRequestBody

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import {
  applyV2Confirm,
  validateIntegrity,
  computeExpectedDelta,
  V2ConfirmError,
  type V2ConfirmRequestBody,
} from '@/lib/ofx/v2-confirm'

interface Params { params: Promise<{ id: string }> }

async function verificarAcesso(userId: string, contaId: string) {
  return prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId } } } },
    select: { id: true, companyId: true, balance: true },
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const conta = await verificarAcesso(user.sub, contaId)
  if (!conta) {
    return NextResponse.json(
      { erro: 'Conta não encontrada', code: 'CONTA_NOT_FOUND' },
      { status: 404 },
    )
  }

  // Modo dry-run (decisão Yussef): ?dry-run=true → simula sem commit
  const isDryRun = request.nextUrl.searchParams.get('dry-run') === 'true'

  // ───── Lê multipart
  let rawContent: string
  let body: V2ConfirmRequestBody
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const bodyStr = formData.get('body')
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { erro: 'Arquivo OFX não enviado', code: 'FILE_MISSING' },
        { status: 400 },
      )
    }
    if (!bodyStr || typeof bodyStr !== 'string') {
      return NextResponse.json(
        { erro: 'Body JSON não enviado', code: 'BODY_MISSING' },
        { status: 400 },
      )
    }
    rawContent = await (file as File).text()
    body = JSON.parse(bodyStr) as V2ConfirmRequestBody
  } catch {
    return NextResponse.json(
      { erro: 'Erro ao ler request', code: 'REQUEST_PARSE_ERROR' },
      { status: 400 },
    )
  }

  // ───── Re-parseia OFX (defesa anti-forge)
  const { transactions } = parseOFX(rawContent)

  try {
    // Integridade: cada decisions[i].rawTx bate com tx[ofxIndex] do arquivo
    validateIntegrity(body.decisions, transactions)

    // Confere expectedDelta passado bate com o que computamos
    const computedDelta = computeExpectedDelta(body.decisions)
    if (Math.abs(computedDelta - body.expectedDeltaImportProposto) > 0.02) {
      throw new V2ConfirmError(
        'EXPECTED_DELTA_MISMATCH',
        `expectedDeltaImportProposto enviado (${body.expectedDeltaImportProposto.toFixed(
          2,
        )}) diverge do computado (${computedDelta.toFixed(2)})`,
        422,
      )
    }

    if (isDryRun) {
      // Simula sem commit — calcula balance pós, lista o que faria, retorna 200
      const deltaSimulado = computedDelta
      const balancePosSimulado = conta.balance + deltaSimulado
      const ledgerDiff =
        body.ledgerBalAmount !== null ? body.ledgerBalAmount - balancePosSimulado : 0
      const ledgerBate =
        body.ledgerBalAmount !== null ? Math.abs(ledgerDiff) <= 0.02 : false

      return NextResponse.json({
        dryRun: true,
        wouldApply: body.decisions.length,
        balancePre: conta.balance,
        balancePosSimulado,
        deltaSimulado,
        ledgerBalCheck: {
          available: body.ledgerBalAmount !== null,
          bate: ledgerBate,
          diff: ledgerDiff,
          wouldRollback:
            body.ledgerBalAmount !== null &&
            !ledgerBate &&
            !body.acceptHistoricalDivergence,
        },
        counts: {
          skip: body.decisions.filter((d) => d.action === 'SKIP').length,
          create: body.decisions.filter((d) => d.action === 'CREATE').length,
          replaceManual: body.decisions.filter((d) => d.action === 'REPLACE_MANUAL').length,
          conciliatePayable: body.decisions.filter((d) => d.action === 'CONCILIATE_PAYABLE').length,
        },
      })
    }

    // ───── Atomic real
    const result = await applyV2Confirm(prisma, {
      decisions: body.decisions,
      contaId,
      contaCompanyId: conta.companyId,
      userId: user.sub,
      userName: user.email ?? 'unknown',
      userEmail: user.email ?? 'unknown',
      ledgerBalAmount: body.ledgerBalAmount,
      expectedDelta: computedDelta,
      acceptHistoricalDivergence: body.acceptHistoricalDivergence,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof V2ConfirmError) {
      return NextResponse.json(
        { erro: err.message, code: err.code, detail: err.detail },
        { status: err.status },
      )
    }
    return NextResponse.json(
      {
        erro: 'Erro interno',
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
