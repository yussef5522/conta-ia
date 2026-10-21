// SPRINT EQUIPAMENTO (20/10/2026) — GET o CADASTRO DE EQUIPAMENTOS e o total investido.
//
// ⛔ SÓ LEITURA. Quem GRAVA equipamento é o `confirmarConferencia` (a porta única, REGRA 13):
// equipamento nasce do funil da nota, nunca de um formulário à parte — senão existiriam dois
// jeitos de uma máquina entrar no cadastro, e eles divergiriam no primeiro campo novo.
//
// ⚠️ `stock.view` porque é leitura — a régua da casa (*"ler é ler"*). O guard estrutural
// `toda-rota-tem-trava` confere que todo GET de estoque se contenta com `view`.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listarEquipamentos } from '@/lib/stock/equipamento'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ lista: await listarEquipamentos(companyId, prisma) })
}
