// ⭐ AO VIVO (lei R1–R8, 13/11/2026) — a tela pede a cada 30s; a leitura é LEVE (dia + em andamento).
// ⛔ stock.manage: o tempo de cada pessoa contra a mediana é conversa de GESTÃO (a régua do placar, 06/09).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { garantirSemeaduraDeHoje } from '@/lib/stock/producao/rotinas-do-banco'
import { aoVivo } from '@/lib/stock/producao/ao-vivo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  // ⭐ R25 — disparo da LEITURA: se o agendador da meia-noite falhou, a primeira leitura do dia semeia
  await garantirSemeaduraDeHoje(companyId, new Date(), prisma)
  return NextResponse.json(await aoVivo(companyId, new Date(), prisma))
}
