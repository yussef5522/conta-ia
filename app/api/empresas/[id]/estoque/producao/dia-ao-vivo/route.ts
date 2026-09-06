// "HOJE" AO VIVO — só stock.manage. ⛔ Mostra o ritmo de cada um lado a lado: conversa de
// gestão, nunca telão de cozinha. A janela do tablet continua mostrando só as tarefas de quem
// está com o PIN.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { diaAoVivo } from '@/lib/stock/producao/dia-ao-vivo'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  // ⚠️ o dia vem de São Paulo, não de UTC — foi o bug que fazia a conclusão das 21h sumir
  const dia = request.nextUrl.searchParams.get('dia') || diaEmSaoPaulo()
  return NextResponse.json(await diaAoVivo({ companyId, dia, agora: new Date() }, prisma))
}
