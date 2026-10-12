/**
 * ⭐⭐ AS FICHAS QUE ESPERAM O RENDIMENTO — o aviso do item 2a (11/10/2026).
 *
 * **Ordem do dono:** *"aviso no sininho lista as pendentes («N fichas esperam o rendimento —
 * [completar]»), clique abre a FICHA com o campo aceso; o dono resolve todas numa sentada."*
 *
 * ⛔⛔ **UM AVISO POR FICHA, e isso é o que faz o gesto existir.** Um aviso agregado não tem pra
 * onde linkar: o gesto é *"abrir ESTA ficha com ESTE campo aceso"*, e cada ficha espera um número
 * DIFERENTE, que só o dono sabe. Um aviso só com a contagem seria a *porta sem maçaneta* de
 * novo — ele diria quantas faltam e deixaria o dono procurar quais. ⚠️ O corpo DIZ quantas outras
 * esperam, pra ele saber o tamanho da sentada sem precisar contar os sininhos.
 *
 * ⛔⛔ **E ELE LISTA SÓ AS NÃO-NEUTRAS** (`rendimentosPendentes`): ficha neutra ainda na fila é
 * trabalho do SISTEMA (a auto-conversão resolve sozinha na próxima rodada), não pendência dele.
 * Cobrar um gesto que ele não precisa dar é como o dono aprende a não olhar a fila.
 *
 * ⚠️ **SETOR `gerencia`, nunca `producao`:** o rendimento é RECEITA, e receita é decisão do dono
 * desde 17/08 — o tablet da cozinha não tem o que fazer com este aviso (e `gerencia` é a chave
 * `stock.manage`, a mesma fronteira dos boletos e da conferência).
 *
 * ⚠️ **ÂMBAR, não coral:** nada está quebrado AGORA — a separação segue fazendo o que já fazia.
 * O que falta é o número que torna o rótulo honesto. Pintar de coral o que é *"preciso da tua
 * decisão"* é como o dono aprende a ignorar coral (os 111 alarmes falsos de 26/08).
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { rendimentosPendentes } from '@/lib/stock/producao/auto-conversao-de-lote'
import type { NovoAviso } from '../tipos'

/** ⚠️ client por PARÂMETRO — com o global cravado, um preview GRAVARIA (lição de 04/09) */
type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'RENDIMENTO_PENDENTE'

export interface ResumoDoRendimento {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

/**
 * ⭐ PURA. A frase, com a CONSEQUÊNCIA dentro.
 *
 * ⚠️ Sem dizer o efeito, *"falta o rendimento"* é jargão; com o efeito (*"é esse número que
 * divide o pedido quando a cozinha separa"*), é uma razão pra abrir a ficha. A régua de 16/09.
 *
 * ⛔ E ela **não carrega o rendimento MEDIDO** — nem como palpite. A lei de 03/10 é que a
 * separação é SEMPRE ficha × pedido; um aviso que sugerisse o medido seria o laço que *"aprende
 * o desvio como normal"*, escondido num texto de sininho.
 */
export function fraseDoRendimentoPendente(e: {
  companyId: string
  fichaId: string
  produto: string
  unidadeProduto: string
  unidadeLoteBase: string
  loteBase: number
  outras: number
}): NovoAviso {
  const lote = e.loteBase.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  const fila = e.outras > 0
    ? ` Outras ${e.outras} ficha${e.outras > 1 ? 's' : ''} também esperam — dá pra resolver todas numa sentada.`
    : ''
  return {
    companyId: e.companyId,
    setor: 'gerencia',
    severidade: 'ambar',
    titulo: `Confere o rendimento de ${e.produto}`,
    corpo:
      `A ficha diz que 1 receita rende ${lote} ${e.unidadeLoteBase}, mas “${e.produto}” se conta ` +
      `em ${e.unidadeProduto} — então esse número não responde quantas ${e.unidadeProduto} saem ` +
      `de 1 receita, que é o que divide o pedido quando a cozinha separa o material.${fila}`,
    oQueFazer:
      `Abra a ficha e diga quantas ${e.unidadeProduto} saem de 1 receita. O editor mostra, antes ` +
      'de salvar, o que a separação passa a tirar da câmara.',
    acaoRotulo: 'completar a ficha',
    /** ⭐ `?foco=rendimento` acende o campo — perder no caminho a informação que o aviso
     *  acabou de dar é obrigar o dono a procurar de novo (o defeito do Bamberg, 13/09) */
    acaoHref: `/empresas/${e.companyId}/estoque/fichas/${e.fichaId}?foco=rendimento`,
    origem: ORIGEM,
    /** ⭐ o alvo é a FICHA: um aviso por ficha, por quantas rodadas o cron fizer */
    alvo: `ficha:${e.fichaId}`,
  }
}

export async function produzirAvisosDeRendimento(
  companyId: string,
  _agora: Date = new Date(),
  db: Db = prisma,
): Promise<ResumoDoRendimento> {
  const r: ResumoDoRendimento = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }

  const pendentes = await rendimentosPendentes(companyId, db)
  const vivos: string[] = []

  for (const p of pendentes) {
    const novo = fraseDoRendimentoPendente({
      companyId,
      fichaId: p.fichaId,
      produto: p.nomeProduto,
      unidadeProduto: p.unidadeProduto,
      unidadeLoteBase: p.unidadeLoteBase,
      loteBase: p.loteBase,
      outras: pendentes.length - 1,
    })
    const v = avaliarLinguaDoBalcao(novo)
    // ⚠️ texto recusado é erro MEU no produtor, nunca motivo pra derrubar o cron
    if (!v.ok) { r.recusados.push({ motivo: v.motivo, titulo: novo.titulo }); continue }
    const { reaberto } = await registrarAviso(novo, db)
    if (reaberto) r.reabertos++
    else r.gravados++
    vivos.push(novo.alvo)
  }

  /**
   * ⚠️ RECONCILIA: ficha que saiu da lista — porque o dono completou, ou porque a auto a
   * converteu — tem o aviso RESOLVIDO. Sem isso o sininho cobraria pra sempre um gesto já
   * dado, que é exatamente como o dono aprende a ignorar o sininho.
   */
  r.resolvidos = await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}
