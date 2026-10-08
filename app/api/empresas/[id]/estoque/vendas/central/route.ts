// 📥 A CENTRAL DE IMPORT — leitura do mês (08/10/2026). GET puro: ZERO escrita.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { lerCentralDeImport } from '@/lib/stock/vendas/central-de-import'

interface Params { params: Promise<{ id: string }> }

/** ⚠️ `YYYY-MM`, validado aqui: mês torto na URL faria `new Date` virar Invalid Date e a
 *  consulta devolver o mês inteiro do epoch em silêncio (a família do zero silencioso). */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const q = request.nextUrl.searchParams.get('mes')
  // ⭐ sem `?mes=`, o mês corrente do BRASIL — às 23h de São Paulo o servidor em UTC já diz
  //   o dia seguinte, e na virada do mês isso abriria a central no mês errado (a cicatriz
  //   do dia do Brasil, 13/09)
  const agora = new Date(Date.now() - 3 * 3_600_000)
  const mes = q && MES.test(q) ? q : agora.toISOString().slice(0, 7)
  if (q && !MES.test(q)) {
    return NextResponse.json({ erro: 'mês inválido — esperado YYYY-MM' }, { status: 400 })
  }

  /**
   * ⭐ O DIA DE HOJE sai DAQUI, do mesmo `agora` que decide o mês default — um desconto de 3h,
   * um lugar. ⛔ É ele que impede o dia que ainda está vendendo de aparecer como buraco coral.
   */
  return NextResponse.json(
    await lerCentralDeImport(companyId, mes, prisma, agora.toISOString().slice(0, 10)),
  )
}
