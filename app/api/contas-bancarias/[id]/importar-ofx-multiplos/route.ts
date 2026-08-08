// POST /api/contas-bancarias/[id]/importar-ofx-multiplos — Sprint 2.4 Onda 2.
//
// Recebe N arquivos via FormData (campo "files"). Processa SEQUENCIALMENTE.
//
// (07/08/2026) ROTEADO PELO runImportV2 — mesmo motor da página single. Antes
// este caminho reimplementava o import do zero (dedup próprio, saldo increment,
// tudo EFFECTED, SEM descarte de futuro) → comportava DIFERENTE da tela single.
// Agora cada arquivo passa pelo V2: descarta movimento futuro, valida LEDGERBAL,
// saldo ancorado, dedup/promoção. NÃO auto-classifica no import (igual V2) — a
// categorização é feita depois em /pendentes. Zero lógica de import duplicada.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runImportV2 } from '@/lib/reconciliation/import-orchestrator'

interface Params {
  params: Promise<{ id: string }>
}

interface FileResult {
  fileName: string
  status: 'SUCCESS' | 'FAILED' | 'EMPTY'
  importId?: string
  novas?: number
  duplicadas?: number
  descartadasFuturas?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ledgerMismatch?: any
  erro?: string
}

async function verificarAcesso(userId: string, contaId: string) {
  return prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId } } } },
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const conta = await verificarAcesso(user.sub, contaId)
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler payload' }, { status: 400 })
  }

  const files = formData.getAll('files').filter(
    (v): v is File => typeof v !== 'string' && v !== null,
  )
  if (files.length === 0) {
    return NextResponse.json({ erro: 'Nenhum arquivo enviado' }, { status: 400 })
  }
  if (files.length > 20) {
    return NextResponse.json({ erro: 'Máximo 20 arquivos por vez' }, { status: 400 })
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  const results: FileResult[] = []
  let totalNovas = 0
  let totalDup = 0
  let totalFuturas = 0

  // SEQUENCIAL: cada arquivo é 1 chamada do runImportV2 (evita race no dedup e
  // mantém o saldo consistente arquivo a arquivo). Multi-arquivo PRESERVADO.
  for (const file of files) {
    const fileName = file.name || 'extrato.ofx'
    try {
      const rawContent = await file.text()
      const result = await prisma.$transaction(
        (tx) =>
          runImportV2(tx, {
            bankAccountId: contaId,
            rawOfx: rawContent,
            userId: user.sub,
            fileName,
            ipAddress: ipAddress ?? undefined,
            userAgent: userAgent ?? undefined,
          }),
        { timeout: 30000 },
      )
      results.push({
        fileName,
        status: 'SUCCESS',
        importId: result.importId,
        novas: result.classification.effected,
        duplicadas: result.classification.skippedMatched,
        descartadasFuturas: result.discardedFuture.length,
        ledgerMismatch: result.ledgerMismatch,
      })
      totalNovas += result.classification.effected
      totalDup += result.classification.skippedMatched
      totalFuturas += result.discardedFuture.length
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      // Sem transações → EMPTY. Sem LEDGERBAL/DTASOF → mensagem CLARA (condição #3).
      if (/sem transaç/i.test(raw)) {
        results.push({ fileName, status: 'EMPTY', erro: 'Arquivo vazio ou inválido' })
      } else if (/LEDGERBAL|DTASOF/i.test(raw)) {
        results.push({
          fileName,
          status: 'FAILED',
          erro: 'Este arquivo não traz o saldo declarado pelo banco (LEDGERBAL) — não dá pra validar o import. Gere um extrato OFX com saldo.',
        })
      } else {
        console.error('[importar-ofx-multiplos] falhou:', { fileName, error: raw })
        results.push({ fileName, status: 'FAILED', erro: 'Falha ao importar este arquivo.' })
      }
    }
  }

  return NextResponse.json({
    success: true,
    results,
    resumo: {
      totalArquivos: files.length,
      sucesso: results.filter((r) => r.status === 'SUCCESS').length,
      falhados: results.filter((r) => r.status === 'FAILED').length,
      vazios: results.filter((r) => r.status === 'EMPTY').length,
      totalNovas,
      totalDuplicadas: totalDup,
      totalDescartadasFuturas: totalFuturas,
    },
  })
}
