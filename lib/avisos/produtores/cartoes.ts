/**
 * ⭐⭐⭐ R51 — O SININHO VIGIA O CARTÃO (24/11/2026, docs/cartoes-referencia.html).
 *
 * ⚠️ O FATO TEM UMA FONTE SÓ: a decisão é `alertasDaCarteira` (pura), sobre `lerCarteira` — a
 * MESMA leitura que a página desenha. O aviso pousa na página de cartões, no cartão da lei do topo
 * (`#pergunta-cartao-vigia`), onde a página mostra os MESMOS alertas.
 * ⭐ Reconcilia: fatura casada, PDF importado ou limite que baixou sai da fila sozinho.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { lerCarteira } from '@/lib/credit-card-pj/carteira'
import { semearQuitacoes } from '@/lib/credit-card-pj/materializar'
import { alertasDaCarteira, hrefDaVigia } from '@/lib/credit-card-pj/vigia'
import { diaDoBrasil } from '@/lib/margem/dia'

type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'CARTAO_VIGIA'

export interface ResumoDosCartoes {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

export async function produzirAvisosDeCartoes(companyId: string, agora: Date = new Date(), db: Db = prisma): Promise<ResumoDosCartoes> {
  const r: ResumoDosCartoes = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }
  // ⭐ R53 — o virar do mês: o cron semeia a quitação ANTES de vigiar (aí ela entra no "a pagar")
  await semearQuitacoes(db, companyId, diaDoBrasil(agora))
  const carteira = await lerCarteira(companyId, diaDoBrasil(agora), db)
  const vivos: string[] = []
  for (const a of alertasDaCarteira(companyId, carteira)) {
    const novo = {
      companyId, setor: 'financeiro' as const, severidade: a.severidade,
      titulo: a.titulo, corpo: a.corpo, oQueFazer: a.oQueFazer,
      // ⭐ pousa na PÁGINA, na âncora da lei do topo — o gesto mora no cartão logo abaixo
      acaoRotulo: 'ver os cartões', acaoHref: hrefDaVigia(companyId),
      origem: ORIGEM, alvo: a.alvo,
    }
    const v = avaliarLinguaDoBalcao(novo)
    if (!v.ok) { r.recusados.push({ motivo: v.motivo, titulo: novo.titulo }); continue }
    const { reaberto } = await registrarAviso(novo, db)
    if (reaberto) r.reabertos++
    else r.gravados++
    vivos.push(a.alvo)
  }
  r.resolvidos += await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}
