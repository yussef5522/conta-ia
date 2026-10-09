/**
 * ⭐⭐⭐ O FISCAL DE N LOTES, EM LOTE DE CONSULTAS (04/10/2026).
 *
 * **Ordem do dono:** *"o fiscal continua, mas no lugar certo"* — a conta *"o declarado cabe no
 * material separado?"* roda por baixo, e na LISTA da home o único resto visual é um **pontinho
 * vermelho** quando ela acusa impossível.
 *
 * ⛔⛔ **ZERO CONTA NOVA: quem decide é `eficienciaDaOrdem`/`fiscalDoDeclarado`** (a porta do
 * espelho, que por sua vez deriva de `insumoDoPedido`). Este arquivo só **BUSCA** o que a conta
 * precisa — e busca em **4 consultas pra N ordens**, nunca uma por ordem: a home é tela de todo
 * dia, e `for (…) await` nela é literalmente o defeito de 28/09 (**4.909 ms · 1.786 consultas**).
 *
 * ⚠️⚠️ **O FISCAL É POR ORDEM, NÃO POR CONCLUSÃO — e isso importa na produção PARCIAL.** O
 * material é separado e consumido pela ORDEM; uma ordem com 2 conclusões tem UM consumo. Julgar
 * cada conclusão contra o consumo inteiro acusaria a primeira metade de ter declarado o dobro.
 * Então soma-se TODAS as conclusões da ordem contra TODO o consumo dela, e o pontinho aparece
 * nas linhas daquela ordem.
 *
 * ⭐ **E a álgebra dispensa o pedido:** `permitido = pedido × real ÷ plano` com
 * `plano = porLote × pedido ÷ loteBase` → o `pedido` **se cancela**. Ou seja o fiscal mede o
 * material de verdade, e vale igual em ordem com meta DECLARADA e em ordem antiga DERIVADA.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { consumidoPorOrdem } from './ordens'
import { eficienciaDaOrdem, type FiscalDoDeclarado } from './eficiencia-da-ordem'
import { fichasParaConverter } from './fichas-para-converter'
import { configDeRetalho, retalhoDasOrdens, unidadesDoRetalho } from './retalho'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⭐⭐ "UMA CAUSA, UM ALARME" — AS FICHAS CUJO % MEDIDO NÃO É RENDIMENTO (09/10/2026).
 *
 * **Ordem do dono (item 4a):** *"aplicar a MESMA supressão «uma causa, um alarme» do sininho —
 * 73 das 90 linhas com pontinho são ficha com lote na unidade errada, já avisadas na fila de
 * conversão; o pontinho ali é ruído que ensina a ignorar o fiscal."*
 *
 * ⛔⛔ **ESTA FUNÇÃO SAIU DE DENTRO DO PRODUTOR DE AVISOS, não foi copiada.** Lá ela era um
 * helper privado (`fichasComLoteTorto`) que o sininho usava desde 04/10. Copiar as 2 linhas
 * daria **duas respostas pra «esta ficha mede rendimento?»** — e elas divergiriam no primeiro
 * ajuste da régua do M5, com o sininho calado e o pontinho aceso (ou o contrário). É a lição
 * do B1 aplicada a um `Set`.
 *
 * ⚠️ Ali o `permitido` não mede lançamento, **mede a ficha quebrada** (é o CHEDDAR que *"permite
 * ~0,152 e declarou 2"*). A fila de conversão já diz o que fazer; o pontinho em cima mandaria o
 * dono conferir a mão da cozinha por um defeito de cadastro.
 */
export async function fichasComLoteTorto(companyId: string, db: Db = defaultPrisma): Promise<Set<string>> {
  const fila = await fichasParaConverter(companyId, db)
  return new Set(fila.pendentes.map((f) => f.fichaId))
}

/**
 * ⭐ O pontinho vale a pena? `true` só quando o impossível tem **causa própria**.
 *
 * ⚠️ PURA de propósito: a decisão dá pra provar sem banco, e o red-then-green da REGRA 11
 * pega quem tirar a supressão.
 */
export function pontinhoVale(f: Pick<FiscalDoLote, 'impossivel' | 'fichaId'>, loteTorto: ReadonlySet<string>): boolean {
  return f.impossivel && !loteTorto.has(f.fichaId)
}

export interface FiscalDoLote extends FiscalDoDeclarado {
  ordemId: string
  /** ⭐ os KG que o dono declarou nesta ordem (`null` = não houve) — é o que a tela nomeia */
  retalhoKg: number | null
  /** ⭐ a RECEITA — é por ela que o sininho agrupa o padrão (e é ela que o dono conserta) */
  fichaId: string
  /** quantas unidades a ordem declarou no total (soma das conclusões dela) */
  declarado: number
  /** o nome do produto — entra na frase do aviso */
  produto: string
  unidade: string
}

/**
 * ⭐ O fiscal de cada ordem CONCLUÍDA passada.
 *
 * ⚠️ Ordem sem componente com dose, ou com `loteBase`/escala zerados, volta com
 * `permitido: null` e **`impossivel: false`** — *não há material pra fiscalizar, e inventar uma
 * acusação a partir de ausência é o oposto do que este fiscal existe pra fazer*.
 */
export async function fiscalDeOrdens(
  companyId: string,
  ordemIds: string[],
  db: Db = defaultPrisma,
): Promise<Map<string, FiscalDoLote>> {
  const out = new Map<string, FiscalDoLote>()
  const ids = [...new Set(ordemIds)]
  if (!ids.length) return out

  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: ids } },
    select: { id: true, fichaId: true, versaoFicha: true, escalaReceitas: true, itemProduzidoId: true },
  })
  if (!ordens.length) return out

  /** ⭐ as 4 consultas em LOTE: versões, componentes, nomes de item, conclusões + o consumo */
  const versoes = await db.stockFichaVersao.findMany({
    where: {
      companyId,
      OR: ordens.map((o) => ({ fichaId: o.fichaId, versao: o.versaoFicha })),
    },
    select: { id: true, fichaId: true, versao: true, loteBase: true },
  })
  const versaoDe = new Map(versoes.map((v) => [`${v.fichaId}#${v.versao}`, v]))

  const comps = versoes.length
    ? await db.stockFichaComponente.findMany({
        where: { companyId, versaoId: { in: versoes.map((v) => v.id) } },
        select: { versaoId: true, itemId: true, qtdPlanejada: true },
        orderBy: { posicao: 'asc' },
      })
    : []
  const compsDaVersao = new Map<string, typeof comps>()
  for (const c of comps) compsDaVersao.set(c.versaoId, [...(compsDaVersao.get(c.versaoId) ?? []), c])

  const itemIds = [...new Set([...comps.map((c) => c.itemId), ...ordens.map((o) => o.itemProduzidoId)])]
  const itens = itemIds.length
    ? await db.stockItem.findMany({
        where: { companyId, id: { in: itemIds } },
        select: { id: true, nome: true, unidadeControle: true },
      })
    : []
  const itemDe = new Map(itens.map((i) => [i.id, i]))

  /**
   * ⭐⭐ O RETALHO ENTRA EM **DUAS CONSULTAS PRA N ORDENS** (09/10) — a config por ficha e o
   * declarado por ordem.
   *
   * ⚠️ Uma por ordem aqui seria o N+1 de 28/09 (4.909 ms) na tela que o dono abre todo dia —
   * e esta função é chamada tanto pela home quanto pela fila de conferência.
   * ⛔ Empresa que nunca ligou retalho em ficha nenhuma devolve dois `Map` vazios: o bônus é
   * zero e **nada muda** pras 189 receitas.
   */
  const [conclusoes, consumo, cfgRetalho, retalhos] = await Promise.all([
    db.stockProducaoConclusao.findMany({
      where: { companyId, ordemId: { in: ids } },
      select: { ordemId: true, qtdGerada: true },
    }),
    consumidoPorOrdem(companyId, ids, db),
    configDeRetalho(companyId, ordens.map((o) => o.fichaId), db),
    retalhoDasOrdens(companyId, ids, db),
  ])
  const geradoPorOrdem = new Map<string, number>()
  for (const c of conclusoes) {
    geradoPorOrdem.set(c.ordemId, (geradoPorOrdem.get(c.ordemId) ?? 0) + c.qtdGerada)
  }

  for (const o of ordens) {
    const v = versaoDe.get(`${o.fichaId}#${o.versaoFicha}`)
    const gerado = geradoPorOrdem.get(o.id) ?? 0
    if (!v || gerado <= 0) continue
    const real = consumo.get(o.id) ?? new Map<string, number>()
    const componentes = (compsDaVersao.get(v.id) ?? []).map((c) => {
      const it = itemDe.get(c.itemId)
      return {
        nome: it?.nome ?? 'componente',
        unidade: it?.unidadeControle ?? '',
        porLote: c.qtdPlanejada,
        consumido: real.get(c.itemId) ?? 0,
      }
    })

    /**
     * ⭐ o BÔNUS DO RETALHO — e ele só existe quando a ficha ACEITA.
     *
     * ⛔⛔ **A config manda, não a existência da linha.** Ordem antiga que declarou retalho numa
     * ficha que o dono DESLIGOU depois volta a ser fiscalizada sem o bônus — o interruptor é a
     * decisão vigente dele, e honrar a linha contra a config seria a config não valer nada.
     */
    const cfg = cfgRetalho.get(o.fichaId)
    const bonusDeRetalho = cfg?.aceita
      ? unidadesDoRetalho(retalhos.get(o.id)?.kg ?? null, cfg.pesoUnidadeG) ?? 0
      : 0

    /** ⭐ a CONTA é da porta — aqui só se monta a entrada dela */
    const ef = eficienciaDaOrdem({
      escala: o.escalaReceitas,
      loteBase: v.loteBase,
      qtdGerada: gerado,
      componentes,
      bonusDeRetalho,
    })
    const prod = itemDe.get(o.itemProduzidoId)
    out.set(o.id, {
      ...ef.fiscal,
      ordemId: o.id,
      retalhoKg: cfg?.aceita ? retalhos.get(o.id)?.kg ?? null : null,
      fichaId: o.fichaId,
      declarado: gerado,
      produto: prod?.nome ?? 'o produto',
      unidade: prod?.unidadeControle ?? '',
    })
  }
  return out
}
