// VENDAS AO VIVO — o DTO da tela (lei vendas-ao-vivo v3). stock.view.
// ⛔ V8: o DTO é montado campo a campo em lib/suit/ao-vivo.ts — nenhum campo de cliente existe.
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { montarAoVivo } from '@/lib/suit/ao-vivo'
import { lerBatimento } from '@/lib/suit/decisao'
import { lerState } from '@/lib/suit/regua-sombra'

interface Params { params: Promise<{ id: string }> }
const STATE_GUARDA = `${process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'}/suit-guarda.state`

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  let guarda = new Map<string, string>()
  try { guarda = lerState(readFileSync(STATE_GUARDA, 'utf8')) } catch { /* sem guarda ainda: selos ficam "conferindo…" */ }
  return NextResponse.json(await montarAoVivo(prisma, companyId, new Date(), { atualizado: lerBatimento(), guarda }), { headers: { 'Cache-Control': 'no-store' } })
}
