// VENDAS FASE 1 item 6 — API da tela /vendas. Lê a VendaDiaria (derivada) e
// agrega pro mês: dias únicos + blocos (fim de semana). Só leitura. O `hoje` vem
// do relógio SÓ pra marcar AGUARDANDO na tela (nunca decide dado — CLAUDE.md).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const dia = (d: Date) => d.toISOString().slice(0, 10)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    await getAuthContext(request, companyId)

    const mesParam = request.nextUrl.searchParams.get('mes') // 'YYYY-MM'
    const now = new Date()
    const [ano, mes] = mesParam
      ? mesParam.split('-').map(Number)
      : [now.getUTCFullYear(), now.getUTCMonth() + 1]
    const inicioMes = new Date(Date.UTC(ano, mes - 1, 1))
    const fimMes = new Date(Date.UTC(ano, mes, 1))

    // Início do módulo = 1ª vigência do perfil (12/08 na Cacula). Sem perfil → null.
    const primeira = await prisma.regraRecebimento.findFirst({
      where: { companyId }, orderBy: { vigenteDe: 'asc' }, select: { vigenteDe: true },
    })

    const vs = await prisma.vendaDiaria.findMany({
      where: { companyId, dataCompetencia: { gte: inicioMes, lt: fimMes } },
      orderBy: { dataCompetencia: 'asc' },
    })

    // Dias únicos (competência inicio == fim) agregados por dia + meio.
    const dias: Record<string, { total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean }> = {}
    // Blocos (fim de semana) agregados por intervalo + meio.
    const blocosMap: Record<string, { inicio: string; fim: string; total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean }> = {}

    for (const v of vs) {
      const di = dia(v.dataCompetencia)
      const df = dia(v.dataCompetenciaFim)
      if (di === df) {
        const d = (dias[di] ??= { total: 0, porMeio: {}, estimado: false, confirmadoPerfil: true })
        d.total = round2(d.total + v.valorLiquido)
        d.porMeio[v.meio] = round2((d.porMeio[v.meio] ?? 0) + v.valorLiquido)
        if (v.status === 'ESTIMADO') d.estimado = true
        d.confirmadoPerfil = d.confirmadoPerfil && v.confirmadoPerfil
      } else {
        const k = `${di}|${df}`
        const b = (blocosMap[k] ??= { inicio: di, fim: df, total: 0, porMeio: {}, estimado: false, confirmadoPerfil: true })
        b.total = round2(b.total + v.valorLiquido)
        b.porMeio[v.meio] = round2((b.porMeio[v.meio] ?? 0) + v.valorLiquido)
        if (v.status === 'ESTIMADO') b.estimado = true
        b.confirmadoPerfil = b.confirmadoPerfil && v.confirmadoPerfil
      }
    }

    return NextResponse.json({
      mes: `${ano}-${String(mes).padStart(2, '0')}`,
      moduleInicio: primeira ? dia(primeira.vigenteDe) : null,
      hoje: dia(now), // relógio só pra marcar AGUARDANDO na tela
      dias,
      blocos: Object.values(blocosMap),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
