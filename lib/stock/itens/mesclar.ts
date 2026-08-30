// ⭐⭐ MESCLAR ITENS DUPLICADOS (29/08/2026) — o caso das 2 BOBINAS.
//
// CASO REAL: a MESMA nota trouxe o produto em duas linhas separadas; o mapeamento criou
// **dois itens iguais** — "BOBINA 02 LITROS 21X31CM LINHA LEVE 2.8", 0,93 e 0,926 UN,
// R$ 35,71 e R$ 35,56. Duas linhas na Posição pro mesmo rolo de saco.
//
// ⭐ A INVARIANTE QUE TRAVA TUDO (a mesma da reunitização): **o VALOR EM R$ NÃO MUDA**.
// Mesclar é juntar duas pilhas que já existem, não criar nem destruir estoque. Saldo soma,
// valor soma, custo médio vira o PONDERADO — e é conferido em runtime, não prometido.
//
// ⚠️ O LEDGER É IMUTÁVEL: cada movimento do absorvido vira **ESTORNO no absorvido +
// movimento igual no sobrevivente**, preservando `nfeChave`, `receiptId` e o tipo. Nunca
// um UPDATE de `itemId`. Efeito colateral bom: como o par estorno/entrada mantém a chave
// da nota, o **E16 continua fechando** (Σ por nota não muda) — mesclar não vira alarme.
//
// ⚠️ UNIDADE DIFERENTE NÃO MESCLA: somar 5 KG com 3 UN é inventar número. A saída é
// reunitizar um dos dois primeiro, e a mensagem diz isso.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento, estornarMovimento } from '../movement'
import { saldoItem, recomputeSaldoCache } from '../saldo'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export class MesclarError extends Error {}

export interface PreviaMesclagem {
  sobrevivente: { id: string; nome: string; saldo: number; valor: number; custoMedio: number | null; movimentos: number }
  absorvido: { id: string; nome: string; saldo: number; valor: number; custoMedio: number | null; movimentos: number }
  depois: { saldo: number; valor: number; custoMedio: number | null }
  unidadeControle: string
  /** o que MIGRA junto (o dono vê antes de confirmar) */
  mapasDeNota: number
  mapasDeVenda: number
  fichasQueApontam: { fichaId: string; nome: string }[]
  avisos: string[]
}

async function ler(db: PrismaClient, companyId: string, itemId: string) {
  const item = await db.stockItem.findFirst({
    where: { id: itemId, companyId },
    select: { id: true, nome: true, unidadeControle: true, ativo: true },
  })
  if (!item) throw new MesclarError('Item não encontrado nesta empresa.')
  const s = await saldoItem(db, companyId, itemId)
  const movimentos = await db.stockMovement.count({ where: { companyId, itemId } })
  return { ...item, saldo: s.saldo, valor: s.valor, custoMedio: s.custoMedio, movimentos }
}

export async function previewMesclagem(
  companyId: string, sobreviventeId: string, absorvidoId: string, db: PrismaClient = defaultPrisma,
): Promise<PreviaMesclagem> {
  if (sobreviventeId === absorvidoId) throw new MesclarError('Escolha dois itens diferentes.')
  const [a, b] = await Promise.all([ler(db, companyId, sobreviventeId), ler(db, companyId, absorvidoId)])

  const avisos: string[] = []
  if (a.unidadeControle !== b.unidadeControle) {
    // ⛔ não é aviso, é impedimento — mas devolvido como prévia pra a tela explicar
    throw new MesclarError(
      `Os dois estão em unidades diferentes (${a.unidadeControle} e ${b.unidadeControle}) — somar isso inventaria número. ` +
        `Ajuste a unidade de um deles primeiro ("A unidade está errada?" na ficha do item) e depois mescle.`,
    )
  }
  if (a.nome.trim().toLowerCase() !== b.nome.trim().toLowerCase()) {
    avisos.push(`Os nomes são diferentes ("${a.nome}" e "${b.nome}") — confirme que é o mesmo produto.`)
  }

  const [mapasDeNota, mapasDeVenda, comps] = await Promise.all([
    db.stockSupplierProduct.count({ where: { companyId, itemId: absorvidoId } }),
    db.stockVendaProdutoMap.count({ where: { companyId, itemId: absorvidoId } }),
    db.stockFichaComponente.findMany({ where: { companyId, itemId: absorvidoId }, select: { versaoId: true } }),
  ])

  const fichasQueApontam: { fichaId: string; nome: string }[] = []
  if (comps.length) {
    const versoes = await db.stockFichaVersao.findMany({
      where: { id: { in: [...new Set(comps.map((c) => c.versaoId))] } },
      select: { fichaId: true },
    })
    // ⚠️ a ficha não tem `nome` — ela é identificada pelo ITEM que produz (sem @relation
    // no schema, então é uma 2ª query e não um include).
    const fichas = await db.stockFicha.findMany({
      where: { id: { in: [...new Set(versoes.map((v) => v.fichaId))] } },
      select: { id: true, itemProduzidoId: true },
    })
    const produzidos = await db.stockItem.findMany({
      where: { id: { in: fichas.map((f) => f.itemProduzidoId) } }, select: { id: true, nome: true },
    })
    const nomePorItem = new Map(produzidos.map((i) => [i.id, i.nome]))
    fichasQueApontam.push(...fichas.map((f) => ({ fichaId: f.id, nome: nomePorItem.get(f.itemProduzidoId) ?? '(ficha)' })))
    avisos.push(
      `${fichas.length} ficha(s) usam o item absorvido (${fichasQueApontam.map((f) => f.nome).join(', ')}) — ` +
        `elas passam a apontar pro item que fica. A receita não muda de conteúdo, só de destino.`,
    )
  }

  // ⚠️ ARREDONDA A 2 CASAS DE PROPÓSITO — é a régua de `saldoItem`, que é o que a Posição
  // mostra (0,93 + 0,926 → 1,86). A prévia tem que falar a MESMA língua da tela que ela
  // prevê; "melhorar" a precisão só aqui faria a prévia dizer 1,856 e a Posição 1,86.
  const saldo = round2(a.saldo + b.saldo)
  const valor = round2(a.valor + b.valor)
  return {
    sobrevivente: { id: a.id, nome: a.nome, saldo: a.saldo, valor: a.valor, custoMedio: a.custoMedio, movimentos: a.movimentos },
    absorvido: { id: b.id, nome: b.nome, saldo: b.saldo, valor: b.valor, custoMedio: b.custoMedio, movimentos: b.movimentos },
    // ⭐ custo médio PONDERADO cai de graça: valor/saldo é a definição, e os dois somam.
    depois: { saldo, valor, custoMedio: saldo !== 0 ? round2(valor / saldo) : null },
    unidadeControle: a.unidadeControle,
    mapasDeNota, mapasDeVenda, fichasQueApontam, avisos,
  }
}

export interface ResultadoMesclagem {
  sobreviventeId: string
  absorvidoId: string
  movimentosTransferidos: number
  mapasDeNota: number
  mapasDeVenda: number
  fichasRepontadas: number
  antes: { saldo: number; valor: number }
  depois: { saldo: number; valor: number; custoMedio: number | null }
}

export async function mesclarItens(
  input: { companyId: string; sobreviventeId: string; absorvidoId: string; userId?: string | null },
  db: PrismaClient = defaultPrisma,
): Promise<ResultadoMesclagem> {
  const { companyId, sobreviventeId, absorvidoId } = input
  const previa = await previewMesclagem(companyId, sobreviventeId, absorvidoId, db)
  const antes = { saldo: round2(previa.sobrevivente.saldo + previa.absorvido.saldo), valor: round2(previa.sobrevivente.valor + previa.absorvido.valor) }

  const movimentos = await db.stockMovement.findMany({
    where: { companyId, itemId: absorvidoId },
    orderBy: { criadoEm: 'asc' },
  })

  await db.$transaction(async (tx) => {
    for (const m of movimentos) {
      // ⚠️ estorno de estorno não existe (o ledger recusa): o par original+estorno já
      // soma zero, então basta não transferir nenhum dos dois.
      if (m.tipo === 'ESTORNO') continue
      const jaEstornado = await tx.stockMovement.findFirst({ where: { estornoDeId: m.id, tipo: 'ESTORNO' } })
      if (jaEstornado) continue

      await estornarMovimento(tx as unknown as PrismaClient, m.id, { criadoPorId: input.userId ?? null })
      await criarMovimento(tx as unknown as PrismaClient, {
        companyId, itemId: sobreviventeId, tipo: m.tipo,
        quantidade: m.quantidade, custoUnitario: m.custoUnitario, custoTotal: m.custoTotal,
        // ⭐ preserva a procedência: nota, conferência e data continuam legíveis no
        // histórico de compras do sobrevivente — e o E16 segue fechando por nota.
        receiptId: m.receiptId, nfeChave: m.nfeChave, nItem: m.nItem,
        origem: m.origem, criadoPorId: input.userId ?? null, dataMovimento: m.dataMovimento,
      })
    }

    // mapas aprendidos migram — a próxima nota do fornecedor cai no item certo
    // ⚠️ o UNIQUE é (companyId, supplierCnpj, cProd): se o sobrevivente JÁ tem o mesmo
    // cProd, o do absorvido é descartado (não dá pra ter dois) — o destino é o mesmo.
    const mapas = await tx.stockSupplierProduct.findMany({ where: { companyId, itemId: absorvidoId } })
    let mapasMigrados = 0
    for (const mp of mapas) {
      const conflito = await tx.stockSupplierProduct.findFirst({
        where: { companyId, supplierCnpj: mp.supplierCnpj, cProd: mp.cProd, NOT: { id: mp.id } },
      })
      if (conflito) await tx.stockSupplierProduct.delete({ where: { id: mp.id } })
      else { await tx.stockSupplierProduct.update({ where: { id: mp.id }, data: { itemId: sobreviventeId } }); mapasMigrados++ }
    }

    const vendas = await tx.stockVendaProdutoMap.updateMany({
      where: { companyId, itemId: absorvidoId }, data: { itemId: sobreviventeId },
    })
    const fichas = await tx.stockFichaComponente.updateMany({
      where: { companyId, itemId: absorvidoId }, data: { itemId: sobreviventeId },
    })

    // ⚠️ o absorvido NÃO é apagado: os movimentos dele (agora zerados pelos estornos) são
    // o rastro da mescla, e o ledger não perde linha.
    //
    // ⭐⭐ MAS ELE DEIXA DE SER UM ITEM (30/08/2026, pedido do dono). ARQUIVADO ≠ MESCLADO:
    // o arquivado é um item de verdade que saiu de uso e volta em "mostrar arquivados"; o
    // mesclado **virou parte de outro** e some de toda lista, busca e dropdown. Sem o
    // registro abaixo os dois seriam o mesmo `ativo=false`, e o absorvido reapareceria no
    // Catálogo com "mostrar inativos" ligado — que é exatamente o "juntar lixo" que o dono
    // não quer.
    await tx.stockItem.update({
      where: { id: absorvidoId },
      data: { ativo: false, nome: `${previa.absorvido.nome} (mesclado)` },
    })
    await tx.stockItemMesclado.create({
      data: {
        companyId, itemId: absorvidoId, mescladoEmId: sobreviventeId,
        nomeOriginal: previa.absorvido.nome,
        saldoNaEpoca: previa.absorvido.saldo, valorNaEpoca: previa.absorvido.valor,
        criadoPorId: input.userId ?? null,
      },
    })

    void mapasMigrados; void vendas; void fichas
  })

  await recomputeSaldoCache(db, companyId)

  const depoisS = await saldoItem(db, companyId, sobreviventeId)
  const depoisA = await saldoItem(db, companyId, absorvidoId)

  // ⭐ A PROVA EM RUNTIME, não a promessa: o valor total tem que ser o mesmo ao centavo.
  if (Math.abs(round2(depoisS.valor + depoisA.valor) - antes.valor) > 0.01) {
    throw new MesclarError(
      `INVARIANTE VIOLADA: antes ${brl(antes.valor)}, depois ${brl(round2(depoisS.valor + depoisA.valor))} — a mescla teria mudado o dinheiro em estoque.`,
    )
  }

  return {
    sobreviventeId, absorvidoId,
    movimentosTransferidos: movimentos.filter((m) => m.tipo !== 'ESTORNO').length,
    mapasDeNota: previa.mapasDeNota, mapasDeVenda: previa.mapasDeVenda,
    fichasRepontadas: previa.fichasQueApontam.length,
    antes,
    depois: { saldo: depoisS.saldo, valor: depoisS.valor, custoMedio: depoisS.custoMedio },
  }
}


// ---------------------------------------------------------------------------
// QUEM SUMIU POR MESCLA — o resolvedor ÚNICO (REGRA 4)
// ---------------------------------------------------------------------------
//
// ⚠️ Toda lista/busca/dropdown de item chama ESTE helper pra excluir os mesclados. Uma
// segunda leitura ("filtra ativo=false") confundiria arquivado com mesclado e o duplicado
// voltaria a aparecer em algum canto — que é justamente o que o dono pediu pra nunca
// acontecer.
export async function idsMesclados(companyId: string, db: Db = defaultPrisma): Promise<Set<string>> {
  const rows = await db.stockItemMesclado.findMany({ where: { companyId }, select: { itemId: true } })
  return new Set(rows.map((r) => r.itemId))
}

/** "este item absorveu quais?" — a auditoria fica na ficha do SOBREVIVENTE, que é onde
 *  alguém procura por ela ("cadê a outra bobina?"). */
export async function absorvidosPor(
  companyId: string, itemId: string, db: Db = defaultPrisma,
): Promise<Array<{ nomeOriginal: string; saldoNaEpoca: number; valorNaEpoca: number; quando: string }>> {
  const rows = await db.stockItemMesclado.findMany({
    where: { companyId, mescladoEmId: itemId }, orderBy: { criadoEm: 'asc' },
  })
  return rows.map((r) => ({
    nomeOriginal: r.nomeOriginal, saldoNaEpoca: r.saldoNaEpoca, valorNaEpoca: r.valorNaEpoca,
    quando: r.criadoEm.toISOString(),
  }))
}
