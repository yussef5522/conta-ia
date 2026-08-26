// IMPORT DE FATURA PDF NO PF (26/08) — preview e confirm no mesmo endpoint.
//
// ⚠️ O MESMO CAMINHO NOS DOIS (REGRA 5): `confirmar=true` roda o preview por dentro e
// recusa se a fatura não fechar. Não existe rota que grave sem passar pela conferência
// — foi assim que a PJ evitou fatura torta entrando em silêncio.
//
// ⚠️ PDF, não OFX: no Brasil fatura de cartão vem em PDF (o Banrisul não emite OFX de
// cartão). O botão dizia "Importar fatura OFX" e não levava a lugar nenhum.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { extractPdfText } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { previewFaturaPF, confirmarFaturaPF } from '@/lib/credit-card/importar-fatura-pf'
import { isCreditCardError } from '@/lib/credit-card/queries'
import { isProfileAccessError } from '@/lib/credit-card/queries'

export const runtime = 'nodejs'
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    const { id: profileId, cardId } = await params

    const form = await request.formData()
    const file = form.get('file')
    const confirmar = form.get('confirmar') === 'true'
    if (!(file instanceof File)) {
      return NextResponse.json({ erro: 'Envie o PDF da fatura' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ erro: 'PDF acima de 15 MB' }, { status: 400 })
    }
    if (!/\.pdf$/i.test(file.name)) {
      return NextResponse.json(
        { erro: 'Fatura de cartão é PDF. Se você tem um OFX, ele é do EXTRATO da conta — importe em Movimentações.' },
        { status: 400 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const texto = await extractPdfText(buf)
    if (!texto || texto.trim().length < 200) {
      return NextResponse.json(
        { erro: 'Não consegui ler o texto do PDF (arquivo digitalizado?). A leitura por imagem não está ligada.' },
        { status: 422 },
      )
    }

    if (!confirmar) {
      return NextResponse.json({ preview: await previewFaturaPF({ userId: user.sub, profileId, cardId, texto }) })
    }
    return NextResponse.json({ resultado: await confirmarFaturaPF({ userId: user.sub, profileId, cardId, texto }) })
  } catch (err) {
    if (isProfileAccessError(err)) {
      return NextResponse.json({ erro: err.message }, { status: err.code === 'NO_ACCESS' ? 404 : 403 })
    }
    if (isCreditCardError(err)) {
      return NextResponse.json({ erro: err.message, code: err.code }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao importar'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
