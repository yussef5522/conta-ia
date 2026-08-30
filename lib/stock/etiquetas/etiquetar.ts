// ⭐⭐ A TORNEIRA (30/08/2026) — a cozinha escolhe o produto e imprime a etiqueta.
//
// A fila e o agente são o CANO. Isto é o que a cozinha usa: quais produtos podem ser
// etiquetados, com que validade por estado, e o gesto de imprimir (que vira registro).
//
// ⭐ 3 TOQUES: produto → confere a prévia → imprimir. Nada de formulário.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { enfileirar } from '../impressao/fila'
import {
  montarZpl, calcularValidade, SUGESTAO_DIAS, MODELO_PADRAO,
  type EstadoConservacao, type DadosEtiqueta, type CampoId,
} from './modelo'

export class EtiquetaError extends Error {}

const loteDe = (semente: string) => semente.slice(-8).toUpperCase()

export interface ProdutoEtiquetavel {
  itemId: string
  nome: string
  categoria: string
  unidade: string
  /** dias por estado — do item, ou a sugestão quando ele ainda não tem os dele */
  dias: Record<EstadoConservacao, number | null>
  /** algum estado já foi definido pelo dono? (a tela marca "sugerido" quando não) */
  temValidadePropria: boolean
  /** saldo atual — a cozinha etiqueta o que existe */
  saldo: number
}

/**
 * Quais produtos aparecem no grid.
 *
 * ⚠️ NÃO É "todo item do catálogo": etiqueta é pra o que a cozinha MANIPULA — o que ela
 * produz (intermediário/produto final) e a matéria-prima que se porciona/descongela.
 * Material de limpeza e uso interno ficam fora; oferecer tudo transformaria o grid num
 * catálogo de 90 linhas e a tela deixaria de ser de 3 toques.
 */
export async function produtosEtiquetaveis(
  companyId: string, db: PrismaClient = defaultPrisma,
): Promise<ProdutoEtiquetavel[]> {
  const CATS = ['INTERMEDIARIO', 'PRODUTO_FINAL', 'MATERIA_PRIMA']
  const [itens, validades, saldos, mesclados] = await Promise.all([
    db.stockItem.findMany({
      where: { companyId, ativo: true, categoria: { in: CATS } },
      select: { id: true, nome: true, categoria: true, unidadeControle: true },
      orderBy: { nome: 'asc' },
    }),
    db.stockItemValidade.findMany({ where: { companyId } }),
    db.stockSaldoCache.findMany({ where: { companyId }, select: { itemId: true, saldo: true } }),
    db.stockItemMesclado.findMany({ where: { companyId }, select: { itemId: true } }),
  ])
  const fora = new Set(mesclados.map((m) => m.itemId))
  const saldoDe = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  const porItem = new Map<string, Record<string, number>>()
  for (const v of validades) {
    const atual = porItem.get(v.itemId) ?? {}
    atual[v.estado] = v.dias
    porItem.set(v.itemId, atual)
  }

  return itens
    .filter((i) => !fora.has(i.id))
    .map((i) => {
      const meus = porItem.get(i.id) ?? {}
      return {
        itemId: i.id, nome: i.nome, categoria: i.categoria, unidade: i.unidadeControle,
        dias: {
          CONGELADO: meus.CONGELADO ?? null,
          RESFRIADO: meus.RESFRIADO ?? null,
          AMBIENTE: meus.AMBIENTE ?? null,
        },
        temValidadePropria: Object.keys(meus).length > 0,
        saldo: saldoDe.get(i.id) ?? 0,
      }
    })
}

/** dias que valem pra este item+estado: o do dono, senão a sugestão (marcada como tal) */
export function diasDoEstado(p: ProdutoEtiquetavel, estado: EstadoConservacao): { dias: number; sugerido: boolean } {
  const meu = p.dias[estado]
  if (meu != null) return { dias: meu, sugerido: false }
  return { dias: SUGESTAO_DIAS[estado], sugerido: true }
}

// ---------------------------------------------------------------------------
// IMPRIMIR
// ---------------------------------------------------------------------------

export interface ImprimirInput {
  companyId: string
  itemId: string
  estado: EstadoConservacao
  copias: number
  /** dias escolhidos na tela (pode ser a sugestão aceita ou um valor digitado) */
  dias?: number | null
  quantidade?: number | null
  colaborador?: string | null
  /** lote de uma produção existente; sem isso, gera um lote da manipulação */
  lote?: string | null
  origem?: 'PRODUCAO' | 'MANIPULACAO' | 'AVULSA'
  camposDesligados?: CampoId[]
  userId?: string | null
  agora?: Date
}

export async function imprimirEtiqueta(input: ImprimirInput, db: PrismaClient = defaultPrisma) {
  const item = await db.stockItem.findFirst({
    where: { id: input.itemId, companyId: input.companyId },
    select: { id: true, nome: true, unidadeControle: true },
  })
  if (!item) throw new EtiquetaError('Produto não encontrado.')
  if (!(input.copias > 0 && input.copias <= 200)) throw new EtiquetaError('Quantidade de etiquetas fora do razoável (1 a 200).')

  const empresa = await db.company.findFirst({ where: { id: input.companyId }, select: { tradeName: true, name: true } })
  const fabricacao = input.agora ?? new Date()
  const validadeAte = calcularValidade(fabricacao, input.dias ?? null)
  // ⚠️ o lote da manipulação nasce do INSTANTE: dois lotes do mesmo produto no mesmo dia
  // são coisas diferentes (descongelou de manhã ≠ descongelou à tarde) e precisam de
  // etiquetas distinguíveis, senão o rastro do QR aponta pra dois pacotes.
  const lote = input.lote?.trim() || loteDe(`${fabricacao.getTime().toString(36)}${item.id}`)

  const dados: DadosEtiqueta = {
    produto: item.nome,
    lote,
    fabricacao,
    validadeAte,
    estado: input.estado,
    quantidade: input.quantidade ?? null,
    unidade: item.unidadeControle,
    colaborador: input.colaborador ?? null,
    empresa: empresa?.tradeName ?? empresa?.name ?? null,
  }

  const zplUnit = montarZpl(dados, MODELO_PADRAO, input.camposDesligados ?? [])
  const job = await enfileirar(
    {
      companyId: input.companyId,
      zpl: zplUnit,
      copias: input.copias,
      descricao: `${item.nome} · lote ${lote}`,
      userId: input.userId ?? null,
    },
    db,
  )

  // ⭐ TODA ETIQUETA IMPRESSA VIRA REGISTRO — é o que faz o painel "vence hoje" existir.
  // Sem isto a etiqueta sairia e o sistema não saberia que ela existe.
  const registro = await db.stockEtiqueta.create({
    data: {
      companyId: input.companyId, itemId: item.id, produto: item.nome, lote,
      estado: input.estado, fabricacao, validadeAte,
      quantidade: input.quantidade ?? null, unidade: item.unidadeControle,
      colaborador: input.colaborador ?? null, copias: input.copias,
      jobId: job.id, origem: input.origem ?? 'MANIPULACAO', criadoPorId: input.userId ?? null,
    },
  })

  return { etiquetaId: registro.id, jobId: job.id, lote, validadeAte, zpl: zplUnit }
}

// ---------------------------------------------------------------------------
// VALIDADE POR ESTADO — o cadastro
// ---------------------------------------------------------------------------

export async function definirValidade(
  input: { companyId: string; itemId: string; estado: EstadoConservacao; dias: number; userId?: string | null },
  db: PrismaClient = defaultPrisma,
) {
  if (!(input.dias > 0 && input.dias <= 3650)) throw new EtiquetaError('Informe de 1 a 3650 dias.')
  const item = await db.stockItem.findFirst({ where: { id: input.itemId, companyId: input.companyId }, select: { id: true } })
  if (!item) throw new EtiquetaError('Produto não encontrado.')
  return db.stockItemValidade.upsert({
    where: { companyId_itemId_estado: { companyId: input.companyId, itemId: input.itemId, estado: input.estado } },
    create: { companyId: input.companyId, itemId: input.itemId, estado: input.estado, dias: input.dias, criadoPorId: input.userId ?? null },
    update: { dias: input.dias },
  })
}
