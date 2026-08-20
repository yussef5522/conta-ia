// ESTOQUE FASE 0 item 1 — /api/empresas/[id]/estoque/certificado
//   GET  -> status do certificado ativo (público, sem senha/pfx)
//   POST -> upload .pfx + senha -> lê CNPJ/validade, valida, cifra, grava
// Isolado: só lê Company (permissão) + grava stock_certificate. Nunca loga pfx/senha.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getCertificateStatus, saveCertificate, SaveCertificateError } from '@/lib/stock/certificate-service'
import { StockCertificateError } from '@/lib/stock/certificate'
import { StockCryptoError } from '@/lib/stock/crypto'

interface Params { params: Promise<{ id: string }> }

const MAX_PFX_BYTES = 64 * 1024 // certificado A1 é pequeno (< 10 KB tipicamente)

async function verificarEmpresa(userId: string, companyId: string) {
  return prisma.userCompany.findFirst({ where: { userId, companyId }, select: { companyId: true } })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await verificarEmpresa(user.sub, companyId))) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  const status = await getCertificateStatus(companyId)
  return NextResponse.json({ certificado: status })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await verificarEmpresa(user.sub, companyId))) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ erro: 'Envie o arquivo como multipart/form-data (campo "pfx" + "senha").' }, { status: 400 })
  }

  const file = form.get('pfx')
  const senha = form.get('senha')
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ erro: 'Anexe o arquivo .pfx no campo "pfx".' }, { status: 400 })
  }
  if (file.size > MAX_PFX_BYTES) {
    return NextResponse.json({ erro: 'Arquivo grande demais pra um certificado A1 (máx 64 KB). Confira se é o .pfx certo.' }, { status: 400 })
  }
  if (typeof senha !== 'string' || senha.length === 0) {
    return NextResponse.json({ erro: 'Informe a senha do certificado no campo "senha".' }, { status: 400 })
  }

  const pfxBuffer = Buffer.from(await file.arrayBuffer())
  try {
    const certificado = await saveCertificate({ companyId, userId: user.sub, pfxBuffer, senha })
    return NextResponse.json({ ok: true, certificado })
  } catch (e) {
    // Erros ESPERADOS viram mensagem clara na tela (nunca 500 genérico, nunca loga senha/pfx).
    if (e instanceof SaveCertificateError) {
      const status = e.code === 'CNPJ_MISMATCH' || e.code === 'VENCIDO' ? 422 : 400
      return NextResponse.json({ erro: e.message, code: e.code }, { status })
    }
    if (e instanceof StockCertificateError) {
      return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
    }
    if (e instanceof StockCryptoError) {
      return NextResponse.json({ erro: e.message, code: 'CRYPTO' }, { status: 500 })
    }
    console.error('[estoque/certificado] erro inesperado ao salvar certificado (pfx/senha NÃO logados)')
    return NextResponse.json({ erro: 'Erro inesperado ao processar o certificado.' }, { status: 500 })
  }
}
