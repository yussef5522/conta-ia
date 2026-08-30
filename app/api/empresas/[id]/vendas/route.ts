// VENDAS FASE 1 item 6 — API da tela /vendas. Lê a VendaDiaria (derivada) e
// agrega pro mês: dias únicos + blocos (fim de semana). Só leitura. O `hoje` vem
// do relógio SÓ pra marcar AGUARDANDO na tela (nunca decide dado — CLAUDE.md).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { incluiMesAnterior } from '@/lib/vendas/janela-mes'

interface Params {
  params: Promise<{ id: string }>
}

const dia = (d: Date) => d.toISOString().slice(0, 10)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const segundaDaSemana = (d: Date) => { const off = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - off * 86400000).toISOString().slice(0, 10) }

type Balde = { samples: number; total: number; media: number }
const balde = (arr: number[]): Balde => {
  const total = round2(arr.reduce((s, v) => s + v, 0))
  return { samples: arr.length, total, media: arr.length ? round2(total / arr.length) : 0 }
}

// Perfil da semana: seg/ter/qua/qui (dias únicos) + FDS (fim de semana por semana:
// blocos + dias únicos de sex/sáb/dom, somados por semana → 1 amostra por fim de semana).
async function computePerfilSemana(companyId: string, inicio: Date) {
  const todas = await prisma.vendaDiaria.findMany({
    where: { companyId, dataCompetencia: { gte: new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate())) } },
    select: { dataCompetencia: true, dataCompetenciaFim: true, valorLiquido: true },
  })
  // 1 amostra = 1 DIA (soma dos meios), não 1 VendaDiaria por meio.
  const porDiaUnico: Record<string, number> = {} // 'YYYY-MM-DD' → total do dia (seg-qui)
  const fdsPorSemana: Record<string, number> = {} // segunda-da-semana → total do fim de semana
  for (const v of todas) {
    const wd = v.dataCompetencia.getUTCDay() // 0=dom..6=sáb
    const ehBloco = v.dataCompetencia.getTime() !== v.dataCompetenciaFim.getTime()
    if (!ehBloco && wd >= 1 && wd <= 4) {
      const k = dia(v.dataCompetencia)
      porDiaUnico[k] = round2((porDiaUnico[k] ?? 0) + v.valorLiquido)
    } else {
      // sex/sáb/dom (único) ou bloco → agrega por semana (fim de semana = 1 amostra)
      const k = segundaDaSemana(v.dataCompetencia)
      fdsPorSemana[k] = round2((fdsPorSemana[k] ?? 0) + v.valorLiquido)
    }
  }
  const semana: Record<string, number[]> = { SEG: [], TER: [], QUA: [], QUI: [] }
  for (const [k, total] of Object.entries(porDiaUnico)) {
    const wd = new Date(k + 'T12:00:00Z').getUTCDay()
    const b = wd === 1 ? 'SEG' : wd === 2 ? 'TER' : wd === 3 ? 'QUA' : 'QUI'
    semana[b].push(total) // 1 amostra por dia
  }
  return {
    SEG: balde(semana.SEG), TER: balde(semana.TER), QUA: balde(semana.QUA), QUI: balde(semana.QUI),
    FDS: balde(Object.values(fdsPorSemana)),
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    // ⛔ VAZAMENTO FECHADO (30/08/2026): `getAuthContext` só prova que a pessoa É DA

    // EMPRESA — não que ela pode ver ISTO. Faltava a permissão, e o faturamento diário é dado financeiro: quanto a loja vendeu, por dia, por meio.

    const ctx = await getAuthContext(request, companyId)

    ctx.requirePermission('transaction.view')

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

    // ⚠️ SOBREPOSIÇÃO, não pertencimento (25/08): o bloco de fim de semana começa na
    // SEXTA — se a sexta cai no mês anterior (31/07 → 01-02/08), filtrar por
    // `dataCompetencia` dentro do mês esconde o bloco INTEIRO da tela. Ver
    // `lib/vendas/janela-mes.ts`.
    const vs = await prisma.vendaDiaria.findMany({
      where: { companyId, dataCompetenciaFim: { gte: inicioMes }, dataCompetencia: { lt: fimMes } },
      orderBy: { dataCompetencia: 'asc' },
    })

    // Dias únicos (competência inicio == fim) agregados por dia + meio.
    const dias: Record<string, { total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean }> = {}
    // Blocos (fim de semana) agregados por intervalo + meio.
    const blocosMap: Record<string, { inicio: string; fim: string; total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean; incluiMesAnterior: boolean }> = {}

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
        const b = (blocosMap[k] ??= { inicio: di, fim: df, total: 0, porMeio: {}, estimado: false, confirmadoPerfil: true, incluiMesAnterior: incluiMesAnterior(v, inicioMes) })
        b.total = round2(b.total + v.valorLiquido)
        b.porMeio[v.meio] = round2((b.porMeio[v.meio] ?? 0) + v.valorLiquido)
        if (v.status === 'ESTIMADO') b.estimado = true
        b.confirmadoPerfil = b.confirmadoPerfil && v.confirmadoPerfil
      }
    }

    // PERFIL DA SEMANA (bloco 3): média por dia da semana sobre TODO o histórico
    // (>= início do módulo). Baldes: seg/ter/qua/qui + FIM DE SEMANA (sex-dom, por
    // semana). "a apurar" na tela quando amostras < 2 (histórico insuficiente).
    const perfilSemana = primeira ? await computePerfilSemana(companyId, primeira.vigenteDe) : null

    return NextResponse.json({
      mes: `${ano}-${String(mes).padStart(2, '0')}`,
      moduleInicio: primeira ? dia(primeira.vigenteDe) : null,
      hoje: dia(now), // relógio só pra marcar AGUARDANDO na tela
      dias,
      blocos: Object.values(blocosMap),
      perfilSemana,
    })
  } catch (e) {
    return handleApiError(e)
  }
}
