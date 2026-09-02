// ⭐⭐ O MAPA DOS COMPLEMENTOS — destino por ORIGEM (02/09/2026).
//
// ⛔ POR QUE UM MAPA SEPARADO DO DE PRODUTOS, com número: **25 nomes aparecem nos DOIS
// relatórios** do PDV —
//     COCA COLA 2L .............. 337 como produto · 134 como complemento
//     MAIONESE CASEIRA .......... 283 · 240
//     MAIONESE CASEIRA C/ ALHO ... 31 ·  78   (o complemento é o DOBRO)
//     XIS - CALABRESA ............ 32 ·  21
// Com um mapa só (chave `companyId + nomeSuitable`), cada um teria UM destino e baixaria
// **duas vezes**. O dono decidiu: *"COCA COLA 2L como produto baixa a bebida; como
// complemento eu decido separado"*.
//
// ⚠️ E NÃO DEU PRA PÔR `origem` NA CHAVE DA TABELA EXISTENTE: seria um ALTER, e migration de
// estoque é CREATE-only (guard de CI barra). O próprio dono apontou isso quando eu propus —
// tabela espelho resolve o mesmo comportamento sem ALTER e sem backfill.
//
// ⭐ TRÊS DESTINOS:
//   FICHA    → baixa a ficha do sabor (CALABRESA → "sabor calabresa")
//   IGNORAR  → não baixa, some dos pendentes. REVERSÍVEL. É onde ficam tamanhos
//              (GRANDE/PEQUENO/MEDIO) e milkshake/açaí/doces, que entram depois.
//   ausente  → PENDENTE VISÍVEL. Não baixa, não some. Estado inicial de tudo.
//
// ⚠️ **FICHA NASCE VAZIA, NUNCA INVENTADA** (regra do dono): este módulo constrói a
// prateleira; o conteúdo das fichas de sabor é dele, preenchido na tela, uma a uma.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export class ComplementoMapError extends Error {}

export type DestinoComplemento =
  | { tipo: 'FICHA'; fichaId: string }
  | { tipo: 'IGNORAR' }

/**
 * ⛔⛔ NÃO UNIFIQUE ESTE GUARD COM O DE `venda-map.ts`. Eles parecem a mesma coisa e são
 * opostos de propósito — quem "limpar a duplicação" aqui quebra um dos dois módulos.
 *
 * ⚠️ O GUARD AQUI É DIFERENTE DO DE PRODUTOS, e a diferença é o ponto do módulo:
 * o mapa de PRODUTOS só aceita `PRODUTO_FINAL` (o que se vende) ou item `REVENDA`.
 * O complemento aponta pra uma ficha de **SABOR**, que é `INTERMEDIARIO` — sabor não se
 * vende solto, ele é consumido pela pizza. Recusar INTERMEDIARIO aqui tornaria o módulo
 * inteiro impossível.
 *
 * ⭐ E é COERENTE com a mecânica da baixa: `INTERMEDIARIO` baixa o **pack pronto** (a porção
 * de calabresa já produzida) e **nunca explode a receita dela** — a calabresa CRUA não se
 * move. Saldo negativo quando não há porção produzida é o comportamento CERTO: é o sinal de
 * "vendeu sem produzir", e esconder isso seria pior.
 *
 * ⛔ Já o mapa de PRODUTOS **precisa** recusar INTERMEDIARIO: lá o destino é o que o cliente
 * compra, e apontar uma venda pra intermediário faria cada xis baixar **carne crua** em vez
 * do beef pronto. Foi um bug real (22/08), corrigido com guard na FONTE.
 *   produto     → PRODUTO_FINAL (explode na venda)  ou item REVENDA
 *   complemento → INTERMEDIARIO (baixa o pack)      ou PRODUTO_FINAL (o mesmo do combo)
 * Mesma pergunta ("pra onde vai este nome?"), respostas legitimamente diferentes.
 */
export async function upsertComplementoMap(
  companyId: string,
  nomeSuitable: string,
  destino: DestinoComplemento,
  userId?: string,
  db: PrismaClient = defaultPrisma,
) {
  const nome = nomeSuitable.trim()
  if (!nome) throw new ComplementoMapError('Nome do complemento vazio.')

  if (destino.tipo === 'FICHA') {
    const f = await db.stockFicha.findFirst({
      where: { id: destino.fichaId, companyId },
      select: { tipoProduto: true, ativo: true },
    })
    if (!f) throw new ComplementoMapError('Ficha não encontrada.')
    if (!f.ativo) throw new ComplementoMapError('Essa ficha está arquivada — reative antes de mapear.')
    // ⚠️ aceita INTERMEDIARIO **e** PRODUTO_FINAL: um complemento pode apontar pra a MESMA
    // ficha que um produto usa (XIS - CALABRESA vendido solto E como item de combo).
  }

  return db.stockVendaComplementoMap.upsert({
    where: { companyId_nomeSuitable: { companyId, nomeSuitable: nome } },
    create: {
      companyId, nomeSuitable: nome, alvoTipo: destino.tipo,
      fichaId: destino.tipo === 'FICHA' ? destino.fichaId : null,
      criadoPorId: userId ?? null,
    },
    update: {
      alvoTipo: destino.tipo,
      fichaId: destino.tipo === 'FICHA' ? destino.fichaId : null,
    },
    select: { id: true, alvoTipo: true, fichaId: true },
  })
}

/** Desfaz o IGNORAR (ou o mapeamento) — volta pro estado PENDENTE. */
export async function limparComplementoMap(companyId: string, nomeSuitable: string, db: PrismaClient = defaultPrisma) {
  // ⚠️ REVERSÍVEL de propósito: IGNORAR não é decisão definitiva. Milkshake e açaí entram
  // depois, e a volta não pode exigir mexer no banco à mão.
  await db.stockVendaComplementoMap.deleteMany({ where: { companyId, nomeSuitable: nomeSuitable.trim() } })
}

export interface LinhaPrateleira {
  nomeSuitable: string
  /** ocorrências no período — a ordem de prioridade do dono */
  ocorrencias: number
  destino: 'SEM_FICHA' | 'FICHA' | 'IGNORAR'
  fichaId: string | null
  nomeFicha: string | null
  /** ⚠️ este nome também existe no relatório de PRODUTOS (risco de baixa dupla) */
  tambemProduto: boolean
  /** o que o mapa de PRODUTOS faz com ele, quando existe nos dois */
  destinoComoProduto: string | null
}

/**
 * A prateleira: um complemento por linha, ordenada por OCORRÊNCIAS DESC.
 *
 * ⭐ A ordem não é estética: das 215 linhas, **100 têm 10+ ocorrências e carregam 7.269 das
 * 7.648** (95%). CALABRESA (1.220) primeiro faz o dono mapear o que importa antes da cauda.
 */
export async function prateleiraDeComplementos(
  companyId: string,
  linhas: readonly { nomeSuitable: string; ocorrencias: number }[],
  db: PrismaClient = defaultPrisma,
): Promise<LinhaPrateleira[]> {
  const nomes = [...new Set(linhas.map((l) => l.nomeSuitable))]
  const [maps, mapsProduto] = await Promise.all([
    db.stockVendaComplementoMap.findMany({ where: { companyId, nomeSuitable: { in: nomes } } }),
    // ⚠️ o AVISO dos 25: mostra os DOIS destinos, e a decisão de cada nome é do dono —
    // o sistema não escolhe nem bloqueia.
    db.stockVendaProdutoMap.findMany({ where: { companyId, nomeSuitable: { in: nomes } }, select: { nomeSuitable: true, alvoTipo: true } }),
  ])
  const porNome = new Map(maps.map((m) => [m.nomeSuitable, m]))
  const comoProduto = new Map(mapsProduto.map((m) => [m.nomeSuitable, m.alvoTipo]))

  const fichaIds = maps.map((m) => m.fichaId).filter((x): x is string => !!x)
  const fichas = fichaIds.length
    ? await db.stockFicha.findMany({ where: { companyId, id: { in: fichaIds } }, select: { id: true, itemProduzidoId: true } })
    : []
  const itens = fichas.length
    ? await db.stockItem.findMany({ where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } }, select: { id: true, nome: true } })
    : []
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeDaFicha = new Map(fichas.map((f) => [f.id, nomeItem.get(f.itemProduzidoId) ?? null]))

  // soma ocorrências por nome (o relatório pode repetir o mesmo nome em períodos)
  const agrupado = new Map<string, number>()
  for (const l of linhas) agrupado.set(l.nomeSuitable, (agrupado.get(l.nomeSuitable) ?? 0) + l.ocorrencias)

  return [...agrupado.entries()]
    .map(([nomeSuitable, ocorrencias]) => {
      const m = porNome.get(nomeSuitable)
      return {
        nomeSuitable,
        ocorrencias,
        destino: (m ? (m.alvoTipo === 'IGNORAR' ? 'IGNORAR' : 'FICHA') : 'SEM_FICHA') as LinhaPrateleira['destino'],
        fichaId: m?.fichaId ?? null,
        nomeFicha: m?.fichaId ? nomeDaFicha.get(m.fichaId) ?? null : null,
        tambemProduto: comoProduto.has(nomeSuitable),
        destinoComoProduto: comoProduto.get(nomeSuitable) ?? null,
      }
    })
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
}
