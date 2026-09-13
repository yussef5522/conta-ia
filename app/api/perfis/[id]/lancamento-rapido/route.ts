// ⭐⭐ O LANÇAMENTO POR FRASE (13/09) — o FAB do dashboard.
//
// **GET** = lê a frase e devolve o que deu pra montar + a categoria SUGERIDA.
// **POST** = grava o que o dono confirmou no preview.
//
// ⛔ **A IA SUGERE, O DONO CONFIRMA** — a régua da casa. E a sugestão vem das regras
// aprendidas DO PERFIL (`profileId`), nunca das da empresa: PF não usa categoria de DRE.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import { lerFrase } from '@/lib/pf-dashboard/frase'
import { normalizarBusca } from '@/lib/busca-texto'

/** ⭐ a categoria sugerida: regra aprendida do PERFIL, depois o nome da categoria no texto */
async function sugerirCategoria(profileId: string, texto: string, sentido: 'ENTRADA' | 'SAIDA') {
  const alvo = normalizarBusca(texto)
  if (!alvo) return null
  const regras = await prisma.aiLearningRule.findMany({
    where: { profileId, personalCategoryId: { not: null }, isActive: true },
    select: { padrao: true, personalCategoryId: true }, orderBy: { vezesAplicada: 'desc' },
  })
  const r = regras.find((x) => alvo.includes(normalizarBusca(x.padrao)))
  if (r?.personalCategoryId) return { id: r.personalCategoryId, porQue: 'você já classificou assim antes' }

  // ⚠️ o 2º degrau é o NOME da categoria aparecer na frase ("farmácia" → Saúde não; mas
  // "alimentação" → Alimentação sim). É literal de propósito: adivinhar por semelhança
  // poria uma categoria errada com cara de fato, e a categoria é decisão do dono.
  const cats = await prisma.personalCategory.findMany({
    where: { profileId, isActive: true, type: sentido === 'ENTRADA' ? 'INCOME' : 'EXPENSE' },
    select: { id: true, name: true },
  })
  const c = cats.find((x) => alvo.includes(normalizarBusca(x.name)))
  return c ? { id: c.id, porQue: 'o nome da categoria está na frase' } : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  try { await checkProfileAccess(user.sub, profileId) }
  catch { return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 }) }

  const frase = request.nextUrl.searchParams.get('frase') ?? ''
  const lida = lerFrase(frase)
  const sugestao = lida.descricao ? await sugerirCategoria(profileId, lida.descricao, lida.sentido) : null
  const categorias = await prisma.personalCategory.findMany({
    where: { profileId, isActive: true }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' },
  })
  return NextResponse.json({ ...lida, sugestao, categorias })
}

const corpo = z.object({
  valor: z.number().positive(),
  descricao: z.string().min(1),
  sentido: z.enum(['ENTRADA', 'SAIDA']),
  categoriaId: z.string().nullable(),
  contaId: z.string().nullable(),
  data: z.string().optional(),
  /** ⭐ "errei a categoria, troco e a regra aprende" — ordem do dono */
  aprender: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  try { await checkProfileAccess(user.sub, profileId) }
  catch { return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 }) }

  const p = corpo.safeParse(await request.json())
  if (!p.success) return NextResponse.json({ erro: 'Faltou o valor ou a descrição.' }, { status: 400 })
  const b = p.data

  const tx = await prisma.personalTransaction.create({
    data: {
      profileId, bankAccountId: b.contaId, categoryId: b.categoriaId,
      date: b.data ? new Date(`${b.data}T12:00:00.000Z`) : new Date(),
      description: b.descricao, amount: b.valor,
      type: b.sentido === 'ENTRADA' ? 'CREDIT' : 'DEBIT',
      // ⚠️ o PF não tem lifecycle: tudo nasce realizado (a fragilidade registrada em 07/08).
      // Aqui isso é o certo — lançamento rápido é coisa que JÁ aconteceu.
      status: 'RECONCILED', origin: 'MANUAL', classifiedBy: b.categoriaId ? 'MANUAL' : null,
    },
    select: { id: true },
  })

  // ⭐ E A REGRA APRENDE — a próxima frase parecida já vem classificada
  if (b.aprender && b.categoriaId) {
    const padrao = b.descricao.trim()
    const ja = await prisma.aiLearningRule.findFirst({ where: { profileId, padrao, personalCategoryId: b.categoriaId }, select: { id: true } })
    if (ja) await prisma.aiLearningRule.update({ where: { id: ja.id }, data: { vezesAplicada: { increment: 1 } } })
    else {
      await prisma.aiLearningRule.create({
        data: { profileId, padrao, tipoMatch: 'CONTAINS', personalCategoryId: b.categoriaId, fonte: 'MANUAL', vezesAplicada: 1 },
      })
    }
  }
  return NextResponse.json({ ok: true, id: tx.id })
}
