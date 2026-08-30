// ⭐ A PORTA DO AGENTE (30/08/2026) — a ÚNICA rota do estoque sem sessão de navegador.
//
// O agente roda num PC/Raspberry da cozinha e não tem cookie de login. Ele se identifica
// por um TOKEN próprio, por impressora.
//
// ⚠️ O QUE ESTA ROTA PODE FAZER É DE PROPÓSITO MÍNIMO: pegar o próximo ZPL da fila DAQUELA
// empresa e dizer se imprimiu. Não lê estoque, não lê nota, não lê dinheiro. Se o token
// vazar (ele vive num arquivo de config num PC de cozinha), o estrago é imprimir etiqueta
// — não é ver o financeiro. Escopo curto porque o segredo mora num lugar exposto.
//
// ⚠️ E ele nunca diz "token existe mas está inativo": 401 seco pra qualquer token que não
// resolve numa impressora ativa. Mensagem de erro que diferencia é oráculo pra quem testa.
//
//   GET  /api/estoque/agente-impressao        → { job } | { job: null }
//   POST /api/estoque/agente-impressao        → { jobId, ok, erro? }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { impressoraPorToken, proximoJob, registrarResultado, pingImpressora } from '@/lib/stock/impressao/fila'

function tokenDe(request: NextRequest): string {
  const h = request.headers.get('authorization') ?? ''
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim()
  return request.headers.get('x-agente-token')?.trim() ?? ''
}

export async function GET(request: NextRequest) {
  const imp = await impressoraPorToken(tokenDe(request), prisma)
  if (!imp) return NextResponse.json({ erro: 'token inválido' }, { status: 401 })

  // ⭐ o GET também é o PING: se o agente está perguntando, ele está vivo — e a tela
  // mostra "online" sem precisar de um segundo mecanismo (REGRA 4).
  await pingImpressora(imp.id, prisma)

  const job = await proximoJob(imp.companyId, imp.id, prisma)
  return NextResponse.json({
    impressora: { id: imp.id, nome: imp.nome, tipo: imp.tipo, host: imp.host, porta: imp.porta, filaUsb: imp.filaUsb },
    job: job ? { id: job.id, zpl: job.zpl, copias: job.copias, descricao: job.descricao } : null,
  })
}

const schema = z.object({ jobId: z.string().min(1), ok: z.boolean(), erro: z.string().max(400).nullish() })

export async function POST(request: NextRequest) {
  const imp = await impressoraPorToken(tokenDe(request), prisma)
  if (!imp) return NextResponse.json({ erro: 'token inválido' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'payload inválido' }, { status: 400 })
  await registrarResultado({ companyId: imp.companyId, ...parsed.data }, prisma)
  return NextResponse.json({ ok: true })
}
