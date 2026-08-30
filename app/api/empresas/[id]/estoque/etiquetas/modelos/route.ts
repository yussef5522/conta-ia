// ⭐ MODELOS DE ETIQUETA — listar · criar · salvar · escolher padrão · testar (30/08/2026).
//
// ⚠️ `stock.manage`: desenhar a etiqueta é configuração da empresa (e mexe no que a
// Vigilância vai ver), não gesto de operação.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { BLOCOS_PADRAO, lerBlocos, gravarBlocos, avisosDoModelo, zplDosBlocos } from '@/lib/stock/etiquetas/blocos'
import { enfileirar, ImpressaoError } from '@/lib/stock/impressao/fila'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const modelos = await prisma.stockEtiquetaModelo.findMany({ where: { companyId }, orderBy: { criadoEm: 'asc' } })
  return NextResponse.json({
    modelos: modelos.map((m) => ({ id: m.id, nome: m.nome, padrao: m.padrao, blocos: lerBlocos(m.blocos) })),
    // ⚠️ empresa sem nenhum modelo ainda não é erro: ela usa os blocos de fábrica. A tela
    // abre com eles e o 1º "salvar" materializa o modelo dela.
    padraoDeFabrica: BLOCOS_PADRAO,
  })
}

const blocoSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(['campo', 'texto', 'qr']),
  campo: z.string().optional(),
  texto: z.string().max(120).optional(),
  rotulo: z.string().max(40),
  fonte: z.number().int().min(0).max(120),
  negrito: z.boolean().optional(),
  destaque: z.boolean().optional(),
  ativo: z.boolean(),
  qrTamanho: z.number().int().min(1).max(10).optional(),
})

const salvarSchema = z.object({
  modeloId: z.string().nullish(),
  nome: z.string().min(1).max(60),
  blocos: z.array(blocoSchema).min(1).max(40),
  padrao: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = salvarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Modelo inválido — dê um nome e deixe ao menos um bloco.' }, { status: 400 })
  const { modeloId, nome, blocos, padrao } = parsed.data

  const salvo = await prisma.$transaction(async (tx) => {
    // ⚠️ o "padrão" é único por empresa (índice parcial no banco). Tirar o dos outros ANTES
    // é o que evita a corrida com o índice — e dois padrões seriam ambiguidade silenciosa
    // na hora de imprimir.
    if (padrao) await tx.stockEtiquetaModelo.updateMany({ where: { companyId, padrao: true }, data: { padrao: false } })
    const dados = { nome: nome.trim(), blocos: gravarBlocos(blocos as never), padrao: !!padrao }
    if (modeloId) {
      const existe = await tx.stockEtiquetaModelo.findFirst({ where: { id: modeloId, companyId }, select: { id: true } })
      if (existe) return tx.stockEtiquetaModelo.update({ where: { id: modeloId }, data: dados })
    }
    return tx.stockEtiquetaModelo.create({ data: { companyId, ...dados, criadoPorId: a.user?.sub ?? null } })
  })

  // ⚠️ os avisos VÃO JUNTO com o ok: o modelo salva mesmo sem validade (decisão do dono),
  // mas ele vê o que abriu mão de ter.
  return NextResponse.json({ ok: true, modeloId: salvo.id, avisos: avisosDoModelo(blocos as never) })
}

const testeSchema = z.object({ blocos: z.array(blocoSchema).min(1).max(40) })

/** PUT = imprimir uma etiqueta de TESTE do modelo, com dados de exemplo. */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = testeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Modelo inválido.' }, { status: 400 })
  const empresa = await prisma.company.findFirst({ where: { id: companyId }, select: { tradeName: true, name: true } })
  const agora = new Date()
  const zpl = zplDosBlocos(parsed.data.blocos as never, {
    produto: 'PRODUTO DE TESTE',
    lote: 'TESTE123',
    fabricacao: agora,
    validadeAte: new Date(agora.getTime() + 3 * 86_400_000),
    estado: 'RESFRIADO',
    quantidade: 10,
    unidade: 'UN',
    colaborador: 'teste',
    empresa: empresa?.tradeName ?? empresa?.name ?? null,
  })
  try {
    const job = await enfileirar({ companyId, zpl, descricao: 'teste do modelo de etiqueta', userId: a.user?.sub ?? null }, prisma)
    return NextResponse.json({ ok: true, jobId: job.id })
  } catch (e) {
    if (e instanceof ImpressaoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
