// ⭐⭐ A CATEGORIZAÇÃO DO PF — árvore PRÓPRIA e regras DO PERFIL (13/09/2026).
//
// **A investigação achou o buraco:** o perfil tem **23 categorias próprias** (tabela
// `personal_categories`, zero vínculo com `dreGroup` — os mundos já estão separados como o
// dono exige) e **ZERO `AiLearningRule`**. A categorização aprendida da PF **nunca aprendeu
// nada**, porque nunca houve extrato pra aprender de.
//
// ⛔⛔ **PF NUNCA USA CATEGORIA DE DRE.** A consulta é `personalCategoryId`, e as regras são
// filtradas por `profileId` — uma regra da empresa não alcança o perfil nem por engano.
//
// ⭐ **A IA SUGERE, O DONO CONFIRMA** (a régua da casa desde sempre): aqui só a regra
// APRENDIDA classifica sozinha. Nome que ninguém ensinou entra **sem categoria**, à vista,
// em vez de receber um palpite com cara de fato.

import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarBusca } from '@/lib/busca-texto'
import type { LinhaDoExtrato } from './casar-com-existente'

type Db = typeof defaultPrisma

/**
 * ⭐ Devolve `fitid → categoriaId` (ou `null`). Puro no espírito: só LÊ.
 *
 * ⚠️ O casamento é por CONTÉM sobre o texto normalizado (sem caixa, sem acento) — a régua
 * de 08/09, nascida do `contains` que era case-sensitive no Postgres e devolvia zero
 * calado. Aqui o filtro roda no app, sobre a mesma lista que a tela vê.
 */
export async function classificarLinhas(
  profileId: string, linhas: LinhaDoExtrato[], db: Db = defaultPrisma,
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  if (!linhas.length) return out

  const regras = await db.aiLearningRule.findMany({
    // ⛔ `profileId` na consulta: regra de empresa não vaza pro perfil
    where: { profileId, personalCategoryId: { not: null }, isActive: true },
    select: { padrao: true, personalCategoryId: true, vezesAplicada: true },
    orderBy: { vezesAplicada: 'desc' },
  })
  for (const l of linhas) {
    const texto = normalizarBusca(l.memo)
    const r = regras.find((x) => texto.includes(normalizarBusca(x.padrao)))
    out[l.fitid] = r?.personalCategoryId ?? null
  }
  return out
}
