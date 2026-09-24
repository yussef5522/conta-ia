// ⭐⭐⭐ O QUE O RECEBIMENTO OFERECE PRA CASAR (23/09/2026).
//
// **O dono, com a nota do ALAN na mão:** *"chegou nota com SAL e o recebimento NÃO ACHA o
// item «sal» pra casar — só criando produto novo. E o sal EXISTE."*
//
// ⚠️⚠️ **A HIPÓTESE DELE CAIU NA MEDIÇÃO, e a causa real é mais boba e mais grave.** Ele
// apostou em *"filtra saldo negativo?"*. **Não filtra nada de saldo.** Medido em prod:
//
// ```
// a rota mandava: findMany({ companyId, ativo: true }, take: 300, orderBy: nome asc)
// ativos na empresa: 348   →  ⛔ TRUNCOU, e "sal" (minúsculo) cai no fim da ordem
// ```
//
// ⭐⭐ **E A RAIZ É O UNIVERSO QUE NUNCA FOI DECLARADO.** Esta rota nasceu antes da régua de
// 16/09 (*"cada gesto tem seu universo"*) e ficou de fora do contrato obrigatório. Sem ele
// a lista traz **189 invólucros de CARDÁPIO** — 95 PRODUTO_FINAL + 50 SABOR + 44
// INTERMEDIARIO — que **ninguém compra**, e eles comem as vagas do que se compra de fato:
//
// ```
// o que de fato se COMPRA (universo COMPRAVEL): 159   ⭐ o sal entra
// vagas comidas por invólucro de cardápio:      189
// ```
//
// ⛔ **É A TERCEIRA VEZ QUE O TETO DE LEITURA ESCONDE O ITEM**: o `take: 50` que sumiu com o
// fermento da busca (16/09), o `take: 200` que sumiu com a ordem do ano 202 (19/09), e agora
// o `take: 300` do recebimento. ***Teto aplicado ANTES da pergunta que importa é um item
// invisível esperando a vez.***
//
// ⭐⭐ **E A REGRA DO DONO, que fica:** *"o universo COMPRAVEL NUNCA esconde item por saldo;
// item negativo é quem MAIS precisa aparecer no recebimento — a entrada é o conserto."*
// Por isso o saldo viaja junto: não pra FILTRAR, e sim pra a tela **AVISAR**.

import type { PrismaClient } from '@prisma/client'
import { categoriasDoUniverso } from './universo-do-seletor'
import { saldosDaEmpresa } from './saldo'

export interface ItemParaCasar {
  id: string
  nome: string
  unidadeControle: string
  categoria: string
  /** ⭐ o saldo VIAJA — nunca filtra, só avisa. Negativo é quem mais precisa aparecer. */
  saldo: number
}

/**
 * ⚠️ Teto alto e declarado: o catálogo de estoque não chega perto (Caçula: 348 no total,
 * 159 compráveis). É o mesmo número que a rota `/estoque/itens` usa desde 28/08 — ali o
 * comentário já dizia *"catálogo de estoque não chega perto disso"*, e esta rota ficou com
 * 300 por ter nascido antes.
 */
const LIMITE_LEITURA = 2000

/**
 * ⭐ Os itens que a conferência oferece pra CASAR com a linha da nota.
 *
 * ⛔ **Universo COMPRAVEL**, nunca o catálogo inteiro: apontar a linha de uma nota pra um
 * invólucro de cardápio faria a compra baixar num item que ninguém estoca.
 */
export async function itensParaCasarNoRecebimento(
  companyId: string,
  db: PrismaClient,
): Promise<ItemParaCasar[]> {
  const cats = categoriasDoUniverso('COMPRAVEL')
  const [itens, saldos] = await Promise.all([
    db.stockItem.findMany({
      where: { companyId, ativo: true, ...(cats ? { categoria: { in: [...cats] } } : {}) },
      select: { id: true, nome: true, unidadeControle: true, categoria: true },
      orderBy: { nome: 'asc' },
      take: LIMITE_LEITURA,
    }),
    saldosDaEmpresa(db, companyId),
  ])
  const porItem = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  return itens.map((i) => ({ ...i, saldo: porItem.get(i.id) ?? 0 }))
}
