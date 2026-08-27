// ESTOQUE — REUNITIZAR ITEM (27/08): trocar a UNIDADE DE CONTROLE de um item que nasceu
// na unidade de COMPRA quando devia estar na unidade de CONSUMO.
//
// ⚠️ O CASO REAL QUE PEDIU ISTO (o dono pegou montando a ficha do xis):
// "PAO TRADICIONAL GERGELIM CT PC/12 UN (900G) CX/16 PC" entrou controlado em **PACOTE**
// (64 PC a R$ 27,75). Na receita usa-se **1 PÃO** (R$ 2,31). Pôr `1` na ficha baixaria um
// pacote inteiro por xis — **12× a mais**, e o Real vs Teórico apontaria um rombo que não
// existe. É a MESMA família do fator da Skol (1 CX = 20 garrafas), só que ali a conversão
// acontece na conferência e aqui o item já nasceu errado.
//
// ⭐ A INVARIANTE QUE TRAVA TUDO: **o VALOR em R$ não muda**. Só a régua muda —
//    quantidade × fator · custo unitário ÷ fator · valor idêntico ao centavo.
//    Se o valor mudasse, a reunitização estaria inventando ou destruindo dinheiro.
//
// ⚠️ O LEDGER É IMUTÁVEL: a correção é **ESTORNO + movimento novo** (a mesma disciplina de
// toda correção do módulo), nunca UPDATE. O histórico de compras continua legível — cada
// compra vira um par (estorno + a mesma compra relida na unidade nova), preservando data,
// nota e fornecedor pelo `receiptId`/`nfeChave`.
//
// ⚠️ CUSTO EM PRECISÃO CHEIA, sem arredondar: 27,75 ÷ 12 = 2,3125. Arredondar pra 2,31
// faria 768 × 2,31 = 1.774,08 ≠ 1.776,00 e o CHECK do banco recusaria a linha (foi o que
// mordeu na conclusão de produção). Quem arredonda é a TELA, não o ledger.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento, estornarMovimento } from './movement'
import { saldoItem, recomputeSaldoCache } from './saldo'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export class ReunitizarError extends Error {}

export interface ReunitizarInput {
  companyId: string
  itemId: string
  /** quantas unidades NOVAS cabem em 1 unidade atual (pacote de 12 pães → 12) */
  fator: number
  /** unidade de controle nova (default: mantém a atual — pão continua UN) */
  unidadeControle?: 'KG' | 'UN' | 'LT'
  /** renomear pra o nome dizer a unidade (o nome antigo mente depois da troca) */
  novoNome?: string
  /** também corrige o fator APRENDIDO das notas, pra a próxima entrar convertida */
  ajustarFatorDasNotas?: boolean
  userId?: string
}

export interface ReunitizarResultado {
  itemId: string
  nome: string
  unidadeControle: string
  antes: { saldo: number; custoMedio: number | null; valor: number }
  depois: { saldo: number; custoMedio: number | null; valor: number }
  movimentosConvertidos: number
  mapasAtualizados: { cProd: string; fatorAntes: number; fatorDepois: number }[]
}

/** Prévia SEM gravar — o dono vê o antes/depois antes de confirmar. */
export async function previewReunitizar(
  companyId: string, itemId: string, fator: number, db: PrismaClient = defaultPrisma,
): Promise<{ nome: string; unidadeControle: string; antes: { saldo: number; custoMedio: number | null; valor: number }; depois: { saldo: number; custoMedio: number | null; valor: number }; movimentos: number; mapas: { cProd: string; xProd: string | null; unidadeNota: string | null; fatorAntes: number; fatorDepois: number }[] }> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId } })
  if (!item) throw new ReunitizarError('Item não encontrado nesta empresa.')
  validarFator(fator)

  const s = await saldoItem(db, companyId, itemId)
  const movimentos = await db.stockMovement.count({ where: { companyId, itemId } })
  const mapas = await db.stockSupplierProduct.findMany({
    where: { companyId, itemId },
    select: { cProd: true, xProd: true, unidadeNota: true, fatorConversao: true },
  })
  return {
    nome: item.nome,
    unidadeControle: item.unidadeControle,
    antes: { saldo: s.saldo, custoMedio: s.custoMedio, valor: s.valor },
    // o VALOR é o mesmo dos dois lados — é isso que prova que a conta só mudou de régua
    depois: {
      saldo: round2(s.saldo * fator),
      custoMedio: s.custoMedio != null ? s.custoMedio / fator : null,
      valor: s.valor,
    },
    movimentos,
    mapas: mapas.map((m) => ({ cProd: m.cProd, xProd: m.xProd, unidadeNota: m.unidadeNota, fatorAntes: m.fatorConversao, fatorDepois: round2(m.fatorConversao * fator) })),
  }
}

function validarFator(fator: number) {
  if (!Number.isFinite(fator) || fator <= 0) throw new ReunitizarError('O fator tem que ser maior que zero.')
  if (fator === 1) throw new ReunitizarError('Fator 1 não muda nada — informe quantas unidades novas cabem em 1 atual.')
  if (fator > 100000) throw new ReunitizarError('Fator absurdo — confira o número.')
}

export async function reunitizarItem(input: ReunitizarInput, db: PrismaClient = defaultPrisma): Promise<ReunitizarResultado> {
  const { companyId, itemId, fator } = input
  validarFator(fator)

  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId } })
  if (!item) throw new ReunitizarError('Item não encontrado nesta empresa.')

  // ⛔ item já usado em ficha/contagem: a receita foi escrita na régua ANTIGA e passaria a
  // significar outra coisa em silêncio. Recusa com instrução, não converte por debaixo.
  const emFicha = await db.stockFichaComponente.count({ where: { companyId, itemId } })
  if (emFicha > 0) {
    throw new ReunitizarError(
      `Este item já é componente de ${emFicha} ficha(s) — as quantidades de lá foram escritas na unidade atual. ` +
      'Tire o item das fichas (ou ajuste as quantidades depois) antes de trocar a unidade.',
    )
  }

  const antes = await saldoItem(db, companyId, itemId)

  const resultado = await db.$transaction(async (tx) => {
    // 1) cada movimento vivo é ESTORNADO e recriado na régua nova (ledger imutável)
    const movs = await tx.stockMovement.findMany({
      where: { companyId, itemId, tipo: { not: 'ESTORNO' } },
      orderBy: { criadoEm: 'asc' },
    })
    let convertidos = 0
    for (const m of movs) {
      // já estornado antes (correção anterior) → o efeito dele no saldo é zero, pula
      const jaEstornado = await tx.stockMovement.findFirst({ where: { estornoDeId: m.id, tipo: 'ESTORNO' } })
      if (jaEstornado) continue
      await estornarMovimento(tx as unknown as PrismaClient, m.id, { criadoPorId: input.userId ?? null })
      await criarMovimento(tx as unknown as PrismaClient, {
        companyId, itemId, tipo: m.tipo,
        quantidade: round2(m.quantidade * fator),
        custoUnitario: m.custoUnitario / fator, // precisão CHEIA — quem arredonda é a tela
        custoTotal: m.custoTotal, // o dinheiro é o MESMO; é a âncora da conversão
        receiptId: m.receiptId, nfeChave: m.nfeChave, nItem: m.nItem,
        origem: m.origem, criadoPorId: input.userId ?? null, dataMovimento: m.dataMovimento,
      })
      convertidos++
    }

    // 2) o item passa a falar a régua nova
    await tx.stockItem.update({
      where: { id: itemId },
      data: {
        ...(input.unidadeControle ? { unidadeControle: input.unidadeControle } : {}),
        ...(input.novoNome?.trim() ? { nome: input.novoNome.trim() } : {}),
        // mín/máx foram escritos na régua antiga → convertem junto, senão viram alarme falso
        ...(item.estoqueMin != null ? { estoqueMin: round2(item.estoqueMin * fator) } : {}),
        ...(item.estoqueMax != null ? { estoqueMax: round2(item.estoqueMax * fator) } : {}),
      },
    })

    // 3) o fator APRENDIDO das notas: sem isto a PRÓXIMA nota volta a entrar na régua antiga
    const mapasAtualizados: ReunitizarResultado['mapasAtualizados'] = []
    if (input.ajustarFatorDasNotas !== false) {
      const mapas = await tx.stockSupplierProduct.findMany({ where: { companyId, itemId } })
      for (const mp of mapas) {
        const novo = round2(mp.fatorConversao * fator)
        await tx.stockSupplierProduct.update({ where: { id: mp.id }, data: { fatorConversao: novo } })
        mapasAtualizados.push({ cProd: mp.cProd, fatorAntes: mp.fatorConversao, fatorDepois: novo })
      }
    }
    return { convertidos, mapasAtualizados }
  })

  await recomputeSaldoCache(db, companyId)
  const depois = await saldoItem(db, companyId, itemId)
  const atual = await db.stockItem.findUnique({ where: { id: itemId }, select: { nome: true, unidadeControle: true } })

  // ⭐ a prova, verificada em runtime: o dinheiro não mudou.
  if (Math.abs(depois.valor - antes.valor) > 0.01) {
    throw new ReunitizarError(
      `INVARIANTE QUEBRADA: o valor mudou de ${antes.valor.toFixed(2)} pra ${depois.valor.toFixed(2)}. ` +
      'A reunitização só troca a régua — se o dinheiro muda, algo está errado.',
    )
  }

  return {
    itemId, nome: atual?.nome ?? item.nome, unidadeControle: atual?.unidadeControle ?? item.unidadeControle,
    antes: { saldo: antes.saldo, custoMedio: antes.custoMedio, valor: antes.valor },
    depois: { saldo: depois.saldo, custoMedio: depois.custoMedio, valor: depois.valor },
    movimentosConvertidos: resultado.convertidos,
    mapasAtualizados: resultado.mapasAtualizados,
  }
}
