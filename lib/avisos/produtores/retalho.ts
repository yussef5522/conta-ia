/**
 * ⭐⭐ A SANIDADE DO RETALHO — *"retalho > 20 kg = aviso âmbar no sininho"* (09/10/2026).
 *
 * **Ordem do dono (item 5):** o retalho é campo livre, digitado todo dia, e **afrouxa o teto do
 * fiscal**. Um dedo escorregando num zero (92 onde era 9,2) daria **+460 metades** de folga e
 * calaria o fiscal justamente no lote em que ele deveria falar.
 *
 * ⛔⛔ **AVISA, NÃO TRAVA.** Um dia o número grande vai ser verdade (véspera de feriado, sobra
 * de um corte grande), e travar empurraria a cozinha a declarar MENOS do que entrou — o oposto
 * do que o campo existe pra medir. É a régua do FREIO da contagem e da sanidade do import.
 *
 * ⚠️ **ÂMBAR, não coral:** o dado não está errado, ele está ALTO. Pintar de coral o que é só
 * *"confere se é isso mesmo"* é como o dono aprende a ignorar coral (os 111 alarmes falsos de
 * 26/08).
 *
 * ⚠️ E o setor é **`producao`**: quem declarou o retalho é quem está na cozinha, e ele não
 * carrega número esperado nenhum — é o kg que a própria cozinha pesou, não cola de prova.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { RETALHO_ALTO_KG, configDeRetalho } from '@/lib/stock/producao/retalho'
import type { NovoAviso } from '../tipos'

/** ⚠️ client por PARÂMETRO — a lição de 04/09: com o global cravado, um preview GRAVARIA */
type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'RETALHO_ALTO'

/** ⚠️ a MESMA janela da fila de conferência: o aviso é sobre o lote de agora, não histórico */
export const JANELA_HORAS = 48

export interface ResumoDoRetalho {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

/**
 * ⭐ PURA. A frase, com a CONSEQUÊNCIA dentro: o retalho afrouxa o fiscal.
 *
 * ⚠️ Sem dizer o efeito, *"o retalho está alto"* é uma observação; com o efeito, é uma razão
 * pra conferir. A régua de 16/09: mensagem que não aponta o que está em jogo manda o dono
 * procurar no lugar errado.
 */
export function fraseDoRetalhoAlto(e: {
  companyId: string
  ordemId: string
  produto: string
  kg: number
  unidades: number | null
}): NovoAviso {
  const kg = e.kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  const extra = e.unidades != null
    ? ` Isso dá ~${Math.round(e.unidades)} unidades a mais de folga no fiscal deste lote.`
    : ''
  return {
    companyId: e.companyId,
    setor: 'producao',
    severidade: 'ambar',
    titulo: `Confere o retalho de ${e.produto}`,
    corpo:
      `Esta ordem entrou com ${kg} kg de retalho de ontem — acima dos ${RETALHO_ALTO_KG} kg que ` +
      `costumam sobrar.${extra}`,
    oQueFazer:
      'Se foi isso mesmo, ignore este aviso. Se o número saiu errado, abra a ordem e confira ' +
      'antes de conferir a conclusão — o retalho entra no que o fiscal aceita.',
    acaoRotulo: 'abrir a ordem',
    acaoHref: `/empresas/${e.companyId}/estoque/producao/${e.ordemId}`,
    origem: ORIGEM,
    /** ⭐ o alvo é a ORDEM: um aviso por ordem, por quantas rodadas o cron fizer */
    alvo: `ordem:${e.ordemId}`,
  }
}

export async function produzirAvisosDeRetalho(
  companyId: string,
  agora: Date = new Date(),
  db: Db = prisma,
): Promise<ResumoDoRetalho> {
  const r: ResumoDoRetalho = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }
  const desde = new Date(agora.getTime() - JANELA_HORAS * 3_600_000)

  const linhas = await db.stockOrdemRetalho.findMany({
    where: { companyId, declaradoEm: { gte: desde }, kg: { gt: RETALHO_ALTO_KG } },
    select: { ordemId: true, kg: true },
  })
  const vivos: string[] = []
  if (linhas.length) {
    const ordens = await db.stockProductionOrder.findMany({
      where: { companyId, id: { in: linhas.map((l) => l.ordemId) } },
      select: { id: true, fichaId: true, itemProduzidoId: true },
    })
    const itens = await db.stockItem.findMany({
      where: { companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
      select: { id: true, nome: true },
    })
    const nomeDe = new Map(itens.map((i) => [i.id, i.nome]))
    const ordemDe = new Map(ordens.map((o) => [o.id, o]))
    const cfg = await configDeRetalho(companyId, ordens.map((o) => o.fichaId), db)

    for (const l of linhas) {
      const o = ordemDe.get(l.ordemId)
      if (!o) continue
      /**
       * ⛔ ficha com o interruptor DESLIGADO não avisa: o retalho dela já não conta pro fiscal,
       * então não há folga a conferir — avisar ali seria cobrar ação sobre um dado inerte.
       */
      const c = cfg.get(o.fichaId)
      if (!c?.aceita) continue
      const novo = fraseDoRetalhoAlto({
        companyId,
        ordemId: l.ordemId,
        produto: nomeDe.get(o.itemProduzidoId) ?? 'o produto',
        kg: l.kg,
        unidades: c.pesoUnidadeG > 0 ? (l.kg * 1000) / c.pesoUnidadeG : null,
      })
      const v = avaliarLinguaDoBalcao(novo)
      // ⚠️ texto recusado é erro MEU no produtor, nunca motivo pra derrubar o cron
      if (!v.ok) { r.recusados.push({ motivo: v.motivo, titulo: novo.titulo }); continue }
      const { reaberto } = await registrarAviso(novo, db)
      if (reaberto) r.reabertos++
      else r.gravados++
      vivos.push(novo.alvo)
    }
  }

  /** ⚠️ RECONCILIA: ordem que saiu da janela tem o aviso RESOLVIDO — senão o sininho acumula */
  r.resolvidos = await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}
