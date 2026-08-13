// Sprint Tela Contraparte (31/07/2026) — POST /preview.
// Recebe o PDF do extrato, extrai texto (poppler), valida cabeçalho contra a
// conta, e monta o preview do enriquecimento contra as transações JÁ EXISTENTES.
// NÃO grava nada. Funciona em tx importadas antes (não exige reimportar OFX).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractPdfText, PdfExtractError } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { banrisulPdfParser } from '@/lib/bank-statement-pdf/banrisul-parser'
import { buildEnrichmentPreview, headerMatchesAccount, type EnrichTx } from '@/lib/counterparty/build-preview'
import { resolveBankProfile } from '@/lib/bank-profiles/registry'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
    select: { id: true, name: true, bankName: true, bankCode: true, agency: true, accountNumber: true },
  })
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  // Só Banrisul tem parser determinístico por enquanto.
  const isBanrisul = /banrisul/i.test(conta.bankName ?? '') || conta.bankCode === '041'
  if (!isBanrisul) {
    return NextResponse.json(
      { erro: 'Enriquecimento por PDF disponível só pra Banrisul por enquanto.', code: 'BANK_NOT_SUPPORTED' },
      { status: 400 },
    )
  }

  let pdfBytes: Uint8Array
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'PDF não enviado' }, { status: 400 })
    }
    pdfBytes = new Uint8Array(await (file as File).arrayBuffer())
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler o arquivo enviado' }, { status: 400 })
  }

  let text: string
  try {
    text = await extractPdfText(pdfBytes)
  } catch (err) {
    if (err instanceof PdfExtractError) {
      const status = err.code === 'FILE_TOO_LARGE' || err.code === 'NOT_A_PDF' || err.code === 'NO_TEXT_LAYER' ? 400 : 500
      return NextResponse.json({ erro: err.message, code: err.code }, { status })
    }
    return NextResponse.json({ erro: 'Não foi possível ler o PDF.' }, { status: 500 })
  }

  const parsed = banrisulPdfParser.parse(text)

  // FASE 1.3a — agência + conta do PDF devem bater com a conta selecionada.
  if (!headerMatchesAccount(parsed.header, conta)) {
    return NextResponse.json(
      {
        erro: `Este PDF é de outra conta (ag ${parsed.header.agencia ?? '?'} / cc ${parsed.header.conta ?? '?'}). A conta selecionada é ag ${conta.agency ?? '?'} / cc ${conta.accountNumber ?? '?'}.`,
        code: 'ACCOUNT_MISMATCH',
      },
      { status: 400 },
    )
  }

  const txs: EnrichTx[] = await prisma.transaction.findMany({
    where: { bankAccountId: contaId },
    select: { id: true, externalId: true, amount: true, date: true, description: true, type: true, counterpartyName: true, counterpartySource: true },
  })

  // FASE 4 (13/08): o Nível 2 (chave data+valor) é ESPECÍFICO do Banrisul —
  // resolvido pelo perfil de banco (fitidStability='PER_DOWNLOAD'). Sicredi/Stone
  // têm FITID estável (STABLE) → altKey=false → comportamento idêntico ao de hoje.
  // A razão de existir o Nível 2 mora no perfil (registry.ts), não espalhada aqui.
  const profile = resolveBankProfile(conta.bankCode)
  const altKey = profile?.fitidStability === 'PER_DOWNLOAD'

  const preview = buildEnrichmentPreview(parsed, txs, { altKey })

  // Observabilidade: SÓ metadados/contagens. NUNCA nome (LGPD).
  console.log('[enriquecer-contraparte/preview]', {
    contaId, altKey, period: preview.period,
    pdfLines: preview.counts.pdfLines, pdfWithName: preview.counts.pdfWithName,
    willReceive: preview.counts.willReceive, byFitid: preview.counts.exactByFitid,
    byDateAmount: preview.counts.exactByDateAmount, ambiguousTx: preview.counts.ambiguousTx,
    outOfPeriod: preview.counts.outOfPeriod, notApplicable: preview.counts.notApplicable,
    noPdfLine: preview.counts.noPdfLine,
  })

  return NextResponse.json({
    conta: { id: conta.id, name: conta.name, agency: conta.agency, accountNumber: conta.accountNumber },
    header: parsed.header,
    ...preview,
  })
}
