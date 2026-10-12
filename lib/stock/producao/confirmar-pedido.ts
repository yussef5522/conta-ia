/**
 * ⭐⭐⭐ "QUANTAS UNIDADES PRODUZIR?" — O WRITER ÚNICO DO PEDIDO (11/10/2026).
 *
 * **Defeito do dono:** *"a quantidade é perguntada 2× — na criação E depois de criar — e números
 * diferentes deixam o 1º assombrando a tela. Decisão: pergunta UMA vez, no lugar certo = DEPOIS
 * de criar, onde dá pra ver a prateleira."*
 *
 * ═══ ⛔⛔ O RETRATO: NÃO ERAM 2 WRITERS — ERAM 2 LUGARES DE PERGUNTA E O 2º NÃO ESCREVIA ═══
 *
 * A criação gravava `escalaReceitas` **e** `stock_ordem_meta` (um writer só, em `criarOrdem`). O
 * campo *"Quero fazer"* da página da ordem **só mexia em `useState`**: ele recalculava a
 * separação linha a linha e **nunca regravava nem a meta nem a escala**. Resultado medido no
 * código: digitar 20 ali fazia a cozinha separar material pra 20 enquanto o cabeçalho, a home, a
 * lista e os relatórios seguiam imprimindo **30** — todos leem o pedido/escala do banco.
 *
 * ⚠️ *O fantasma não era dado divergente: era a 2ª pergunta sem escrita.* **E a divergência de
 * material medida em prod (10 de 120 ordens com escala-material ≠ escala-gravada >10%) NÃO é
 * atribuível a ele** — ajustar a linha pelo que REALMENTE saiu da câmara é comportamento
 * legítimo e desenhado. *Achado não atribuível não é achado.*
 *
 * ═══ ⭐⭐ POR QUE ESTA FUNÇÃO EXISTE (e não um `update` na rota) ═══
 *
 * "O pedido desta ordem" vive em **DUAS colunas**: `stock_ordem_meta.unidades` (o que o dono
 * declarou, em unidades do produto) e `stock_production_order.escalaReceitas` (o múltiplo do lote
 * base, que a SEPARAÇÃO usa). Elas são a mesma informação em duas réguas, e é por isso que
 * precisam de **um lugar só** que as escreva juntas: gravar a meta sem a escala faria o
 * cabeçalho dizer 20 e a separação pré-preencher material pra 30 — o fantasma de volta, por
 * dentro. É a lição do B1 e dos 7 detectores de par aplicada a duas colunas.
 *
 * ⛔ E a escala sai da **PORTA ÚNICA** (`escalaDoPedido`), nunca de `pedido / loteBase` escrito
 * aqui: a mesma conta que a separação usa, ou a tela promete um material e a ordem separa outro.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { escalaDoPedido } from './escala-da-ordem'
import { configDeRetalho } from './retalho'
import { OrdemError } from './ordens'

type Db = PrismaClient | Prisma.TransactionClient

export interface ConfirmarPedidoInput {
  companyId: string
  ordemId: string
  /** quantas unidades do PRODUTO o dono quer — na unidade de controle do item produzido */
  unidades: number
  /**
   * ⭐⭐ o retalho de ontem, quando a receita aceita (a pergunta mudou da criação pra cá, junto
   * do número). **TRÊS valores, três significados diferentes (12/10):**
   *   · `undefined` → *"não respondi"* → **o retalho de antes CONTINUA**;
   *   · `null` → *"não tem"* (resposta explícita) → **apaga** o que estava declarado;
   *   · `> 0` → substitui (o CHECK do banco exige `kg > 0`).
   *
   * ⛔⛔ **A separação entre `undefined` e `null` NASCEU DE UM DEFEITO MEDIDO.** Até 12/10 os
   * dois significavam *"não tem"*, e o campo do retalho **nasce vazio** na correção (ordem do
   * dono: *"nunca pré-preenchido"*) — então **corrigir só o pedido APAGAVA, em silêncio, o
   * retalho que já estava gravado**. No caso real isso jogaria no lixo os 10 KG da ordem de
   * 12/10 e o fiscal voltaria a acusar o lote à toa. ***Campo que nasce vazio não pode
   * significar "apague o que você já me disse".***
   */
  retalhoKg?: number | null
  userId?: string
}

export interface PedidoConfirmado {
  unidades: number
  /** o múltiplo do lote base que a ordem passou a guardar (o que a separação vai usar) */
  escala: number
  /** `true` quando já havia um pedido declarado — é o caminho "corrigir antes de separar" */
  corrigiu: boolean
}

/**
 * Grava o pedido declarado da ordem. **É o único lugar que escreve `stock_ordem_meta` e
 * `escalaReceitas`** (guard estrutural em `__tests__/regras-ui/pergunta-do-pedido-uma-vez`).
 *
 * ⛔⛔ **RECUSA depois de SEPARADA**, por ordem do dono: *"ATÉ separar, o pedido pode ser
 * corrigido; DEPOIS de separada, não — a separação já obedeceu"*. Mudar o número ali deixaria o
 * material que já saiu da câmara obedecendo a um pedido que não existe mais, e a eficiência
 * compararia a produção com uma meta que ninguém usou pra separar.
 */
export async function confirmarPedido(
  input: ConfirmarPedidoInput,
  db: Db = defaultPrisma,
): Promise<PedidoConfirmado> {
  if (!(input.unidades > 0)) {
    throw new OrdemError('Diga quantas unidades produzir — um número maior que zero.')
  }

  const ordem = await db.stockProductionOrder.findFirst({
    where: { id: input.ordemId, companyId: input.companyId },
    select: { id: true, estado: true, fichaId: true, versaoFicha: true },
  })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'PLANEJADA') {
    throw new OrdemError(
      ordem.estado === 'SEPARADA' || ordem.estado === 'EM_PRODUCAO'
        ? 'Esta ordem já foi separada — a separação obedeceu ao pedido atual. Pra mudar a quantidade, cancele a ordem (o material volta pra prateleira) e crie outra.'
        : 'Esta ordem já foi encerrada.',
    )
  }

  const versao = await db.stockFichaVersao.findFirst({
    where: { companyId: input.companyId, fichaId: ordem.fichaId, versao: ordem.versaoFicha },
    select: { loteBase: true },
  })
  if (!versao) throw new OrdemError('Não achei a versão da ficha que esta ordem congelou.')

  const escala = escalaDoPedido({ pedido: input.unidades, loteBase: versao.loteBase })
  if (escala == null || !(escala > 0)) {
    throw new OrdemError('Não consegui converter o pedido — confira o lote base da ficha.')
  }

  /**
   * ⛔⛔ A CONFIG DO RETALHO É CONFERIDA **ANTES** DE QUALQUER ESCRITA.
   *
   * ⚠️ É a ordem que a prova em prod de 09/10 cobrou: a 1ª versão do `criarOrdem` checava DEPOIS
   * do `create`, a rota devolvia 422 **e a ordem ficava gravada** — recusa com estado pela
   * metade, o pior dos dois mundos. Quem pegou foi a contabilidade de escrita (531 → 532), não
   * um teste meu.
   */
  /** ⭐ *"respondeu"* é o que separa `null` (apaga) de ausente (não toca) — ver o input */
  const respondeuRetalho = input.retalhoKg !== undefined
  const temRetalho = input.retalhoKg != null && input.retalhoKg > 0
  if (temRetalho) {
    const cfg = (await configDeRetalho(input.companyId, [ordem.fichaId], db)).get(ordem.fichaId)
    if (!cfg?.aceita) {
      throw new OrdemError(
        'Esta receita não aceita retalho — o retalho só entra em receita marcada (hoje, a massa de pizza).',
      )
    }
  }

  const jaTinha = await db.stockOrdemMeta.findFirst({
    where: { companyId: input.companyId, ordemId: input.ordemId },
    select: { id: true },
  })

  const gravar = async (tx: Db) => {
    /**
     * ⭐ `upsert` pela chave única `(companyId, ordemId)` — e o unique é o que torna a meta
     * duplicada **impossível**, não checada. Corrigir é UPDATE da mesma linha, de propósito: o
     * valor corrente mora num lugar só, e a história vai na tabela de rastro abaixo.
     */
    await tx.stockOrdemMeta.upsert({
      where: { companyId_ordemId: { companyId: input.companyId, ordemId: input.ordemId } },
      create: {
        companyId: input.companyId, ordemId: input.ordemId,
        unidades: input.unidades, registradoPorId: input.userId ?? null,
      },
      update: { unidades: input.unidades },
    })
    /**
     * ⭐⭐ O RASTRO — append-only, uma linha por declaração (a 1ª e cada correção).
     *
     * ⚠️ Ele existe porque a meta tem `criadoEm DEFAULT now()` (não `@updatedAt`): sem esta
     * tabela, corrigir deixaria o "quem · quando" apontando pra a PRIMEIRA declaração — a
     * cicatriz medida do `stock_venda_import` (08/10).
     */
    await tx.stockOrdemPedidoDeclarado.create({
      data: {
        companyId: input.companyId, ordemId: input.ordemId,
        unidades: input.unidades, correcao: jaTinha != null,
        declaradoPorId: input.userId ?? null,
      },
    })
    /**
     * ⛔⛔ A ESCALA ANDA NA MESMA TRANSAÇÃO — é ela que a separação lê (`explodirSeparacao` usa
     * `ordem.escalaReceitas` pra pré-preencher o que sai da câmara) e é ela que a home e a lista
     * usam pro DERIVADO. Gravar uma e não a outra é o fantasma renascendo por dentro.
     */
    await tx.stockProductionOrder.update({
      where: { id: input.ordemId },
      data: { escalaReceitas: escala },
    })
    /**
     * ⭐⭐ O RETALHO declarado — e as três respostas (ver `retalhoKg` no input).
     *
     * ⚠️ *"Não tem"* (`null`) **apaga** o anterior: deixar o kg velho faria o fiscal seguir
     * dando um bônus que o dono acabou de retirar — e bônus silencioso é bônus que ninguém
     * confere (a régua de 09/10). ⛔ Já *"não respondi"* (`undefined`) **não toca em nada** —
     * era por aqui que a correção do pedido apagava o retalho calado.
     */
    if (respondeuRetalho) {
      await tx.stockOrdemRetalho.deleteMany({ where: { companyId: input.companyId, ordemId: input.ordemId } })
      if (temRetalho) {
        await tx.stockOrdemRetalho.create({
          data: {
            companyId: input.companyId, ordemId: input.ordemId,
            kg: input.retalhoKg!, declaradoPorId: input.userId ?? null,
          },
        })
      }
    }
  }

  /**
   * ⚠️ Se o chamador já está numa transação, NÃO abre outra: **Prisma não aninha `$transaction`**
   * (a cirurgia que o `aplicar-marcacao` levou em 29/08). O `in` testa a presença do método.
   */
  if ('$transaction' in db) await (db as PrismaClient).$transaction(gravar)
  else await gravar(db)

  return { unidades: input.unidades, escala, corrigiu: jaTinha != null }
}

/** ⭐ O rastro das declarações de uma ordem, mais recente primeiro (pra a tela mostrar). */
export async function rastroDoPedido(
  companyId: string,
  ordemId: string,
  db: Db = defaultPrisma,
): Promise<Array<{ unidades: number; correcao: boolean; quem: string | null; quando: string }>> {
  const rows = await db.stockOrdemPedidoDeclarado.findMany({
    where: { companyId, ordemId },
    /**
     * ⚠️ Desempate por `id` junto do tempo: duas declarações no MESMO milissegundo sairiam em
     * ordem arbitrária com `declaradoEm` sozinho — é a cicatriz do juiz de saldo (28/08), em que
     * ordenar só por `anchorDate` produziu dois alarmes de ±3.026,31 que se cancelavam.
     */
    orderBy: [{ declaradoEm: 'desc' }, { id: 'desc' }],
    select: { unidades: true, correcao: true, declaradoPorId: true, declaradoEm: true },
  })
  if (!rows.length) return []
  const ids = [...new Set(rows.map((r) => r.declaradoPorId).filter((x): x is string => !!x))]
  const users = ids.length
    ? await (db as PrismaClient).user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : []
  const nome = new Map(users.map((u) => [u.id, u.name]))
  return rows.map((r) => ({
    unidades: r.unidades,
    correcao: r.correcao,
    quem: r.declaradoPorId ? nome.get(r.declaradoPorId) ?? null : null,
    quando: r.declaradoEm.toISOString(),
  }))
}
