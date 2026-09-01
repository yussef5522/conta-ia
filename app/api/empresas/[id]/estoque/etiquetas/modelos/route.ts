// ⭐ MODELOS DE ETIQUETA — listar · criar · salvar · escolher padrão · testar (30/08/2026).
//
// ⚠️ `stock.manage`: desenhar a etiqueta é configuração da empresa (e mexe no que a
// Vigilância vai ver), não gesto de operação.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { BLOCOS_PADRAO, lerBlocos, gravarBlocos, avisosDoModelo, zplDosBlocos } from '@/lib/stock/etiquetas/blocos'
import { motivoParaNaoExcluir, mensagemDeRecusa } from '@/lib/stock/etiquetas/excluir-modelo'
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

// ⚠️ O TESTE IMPRIME O QUE ESTÁ NA PRÉVIA (31/08/2026). Antes ele mandava
// 'PRODUTO DE TESTE' cravado aqui — ou seja, o dono ajustava a prévia com o nome real,
// mandava imprimir e saía outra coisa. **Prévia e teste têm que ser o mesmo dado**, senão
// a etiqueta de teste não testa o caso que ele quer ver (justamente o nome comprido).
//
// ⚠️ Os limites de tamanho são de SANIDADE, não de regra de negócio: o texto vira ZPL e um
// campo de 10 mil caracteres viraria um job gigante na fila da cozinha. Quem corta de
// verdade é a impressora, e a tela já avisa disso.
const dadosPreviaSchema = z.object({
  produto: z.string().max(120).optional(),
  lote: z.string().max(60).optional(),
  fabricacao: z.string().datetime().optional(),
  validadeAte: z.string().datetime().nullable().optional(),
  estado: z.enum(['CONGELADO', 'RESFRIADO', 'AMBIENTE']).optional(),
  quantidade: z.number().finite().nullable().optional(),
  unidade: z.string().max(12).optional(),
  colaborador: z.string().max(60).optional(),
  empresa: z.string().max(80).optional(),
}).optional()

const testeSchema = z.object({
  blocos: z.array(blocoSchema).min(1).max(40),
  dados: dadosPreviaSchema,
})

/** PUT = imprimir uma etiqueta de TESTE do modelo, com os dados que estão na prévia. */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = testeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Modelo inválido.' }, { status: 400 })
  const empresa = await prisma.company.findFirst({ where: { id: companyId }, select: { tradeName: true, name: true } })
  const agora = new Date()
  const d = parsed.data.dados
  // ⚠️ campo AUSENTE cai no exemplo; campo VAZIO fica vazio de propósito — esvaziar é uma
  // decisão do dono ("quero ver a etiqueta sem o responsável"), não falta de dado.
  const zpl = zplDosBlocos(parsed.data.blocos as never, {
    produto: d?.produto ?? 'PRODUTO DE TESTE',
    lote: d?.lote ?? 'TESTE123',
    fabricacao: d?.fabricacao ? new Date(d.fabricacao) : agora,
    validadeAte: d && 'validadeAte' in d
      ? (d.validadeAte ? new Date(d.validadeAte) : null)
      : new Date(agora.getTime() + 3 * 86_400_000),
    estado: d?.estado ?? 'RESFRIADO',
    quantidade: d && 'quantidade' in d ? d.quantidade : 10,
    unidade: d?.unidade ?? 'UN',
    colaborador: d?.colaborador ?? 'teste',
    empresa: d?.empresa ?? empresa?.tradeName ?? empresa?.name ?? null,
  })
  try {
    const job = await enfileirar({ companyId, zpl, descricao: 'teste do modelo de etiqueta', userId: a.user?.sub ?? null }, prisma)
    return NextResponse.json({ ok: true, jobId: job.id })
  } catch (e) {
    if (e instanceof ImpressaoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

// ---------------------------------------------------------------------------
// ⭐ EXCLUIR — com as duas recusas que impedem a empresa de ficar sem etiqueta
// ---------------------------------------------------------------------------
//
// ⚠️ A DECISÃO É PURA (`excluir-modelo.ts`) e o SERVIDOR é quem recusa. Se a trava
// morasse só na tela, bastaria um clique fora dela pra a empresa perder o padrão — e a
// etiqueta passaria a sair com o desenho de fábrica sem ninguém saber.

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const modeloId = request.nextUrl.searchParams.get('modeloId') ?? ''
  if (!modeloId) return NextResponse.json({ erro: 'Informe o modelo.' }, { status: 400 })

  const [alvo, total] = await Promise.all([
    prisma.stockEtiquetaModelo.findFirst({ where: { id: modeloId, companyId }, select: { id: true, nome: true, padrao: true } }),
    prisma.stockEtiquetaModelo.count({ where: { companyId } }),
  ])
  if (!alvo) return NextResponse.json({ erro: 'Modelo não encontrado.' }, { status: 404 })

  const motivo = motivoParaNaoExcluir(alvo, total)
  if (motivo) {
    // ⚠️ 422 com a frase que ENSINA — nunca um botão cinza mudo
    return NextResponse.json({ erro: mensagemDeRecusa(motivo, alvo), code: motivo }, { status: 422 })
  }

  await prisma.stockEtiquetaModelo.delete({ where: { id: modeloId } })
  return NextResponse.json({ ok: true })
}
