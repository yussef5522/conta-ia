// ⭐⭐ A LEITURA E A ESCRITA DAS SEÇÕES (08/09/2026) — o lado com banco.
//
// ⛔ A régua pura mora em `secoes.ts` (palavras, agrupamento, lote). Aqui só existe o que
// precisa de banco: a lista editável do dono, a seção de cada nome do PDV, e o gesto do
// lote. Separar é o que deixa a régua testável sem subir Postgres.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { SECOES_SEED, SECAO_PADRAO, sugerirSecao } from './secoes'

type Db = PrismaClient

export interface Secao { chave: string; nome: string; ordem: number }

/**
 * A lista de seções da empresa. **Semeia na primeira leitura** com a lista que o dono ditou.
 *
 * ⚠️ Semear na LEITURA e não numa migration: migration de dados envelhece (empresa criada
 * depois não recebe), e o seed aqui vale pra toda empresa, sempre — inclusive as futuras.
 * ⛔ E só semeia quando está VAZIO: empresa que já editou a lista nunca é sobrescrita.
 */
export async function secoesDaEmpresa(companyId: string, db: Db = defaultPrisma): Promise<Secao[]> {
  const atuais = await db.stockCardapioSecao.findMany({
    where: { companyId, ativo: true },
    select: { chave: true, nome: true, ordem: true },
    orderBy: { ordem: 'asc' },
  })
  if (atuais.length) return atuais

  // ⚠️ sem `skipDuplicates`: o schema de desenvolvimento é SQLite e o Prisma não o
  // suporta lá. A trava real é o índice único (companyId, chave) + o `if` acima.
  await db.stockCardapioSecao.createMany({
    data: SECOES_SEED.map((s) => ({ companyId, chave: s.chave, nome: s.nome, ordem: s.ordem })),
  })
  return [...SECOES_SEED]
}

export interface SecaoDoNome { secao: string; sugerida: boolean; porQue: string | null }

/** o que está gravado, por nome do PDV */
export async function secoesPorNome(
  companyId: string, db: Db = defaultPrisma,
): Promise<Map<string, SecaoDoNome>> {
  const rs = await db.stockCardapioProdutoSecao.findMany({
    where: { companyId },
    select: { nomeSuitable: true, secao: true, sugerida: true, porQue: true },
  })
  return new Map(rs.map((r) => [r.nomeSuitable, { secao: r.secao, sugerida: r.sugerida, porQue: r.porQue }]))
}

/**
 * ⭐ A seção VIGENTE de uma linha do hub.
 *
 * ⚠️ A linha tem VÁRIOS nomes do PDV (os apelidos). A regra: **a confirmada pelo dono ganha
 * de qualquer sugestão**, e entre iguais vale a primeira. Sem isso, um apelido novo com
 * sugestão automática poderia sobrescrever visualmente a decisão que ele já tomou.
 */
export function secaoDaLinha(
  nomesSuitable: readonly string[], gravadas: ReadonlyMap<string, SecaoDoNome>, nome: string,
): SecaoDoNome {
  let sugerida: SecaoDoNome | null = null
  for (const n of nomesSuitable) {
    const g = gravadas.get(n)
    if (!g) continue
    if (!g.sugerida) return g          // ⛔ decisão do dono manda, e para aqui
    sugerida ??= g
  }
  if (sugerida) return sugerida
  // ⚠️ nada gravado ainda: a régua sugere na hora, mas NÃO grava — a tela mostra como
  // proposta, e o lote é que persiste. Ler não pode escrever.
  const s = sugerirSecao(nome)
  return { secao: s.secao, sugerida: true, porQue: s.porQue }
}

export type OrigemDaSecao = 'LOTE' | 'MANUAL' | 'IMPORT'

/**
 * Grava a seção de um produto — **em TODOS os nomes do PDV dele**.
 *
 * ⛔ Gravar só no nome representante deixaria os apelidos órfãos: no dia em que o hub
 * reagrupasse por outro critério, o produto voltaria pra Outros sem ninguém ter mexido.
 */
export async function definirSecao(
  companyId: string,
  nomesSuitable: readonly string[],
  secao: string,
  opts: { sugerida: boolean; porQue?: string | null; userId?: string },
  db: Db = defaultPrisma,
): Promise<number> {
  let n = 0
  for (const nomeSuitable of nomesSuitable) {
    if (!nomeSuitable?.trim()) continue
    await db.stockCardapioProdutoSecao.upsert({
      where: { companyId_nomeSuitable: { companyId, nomeSuitable } },
      create: {
        companyId, nomeSuitable, secao, sugerida: opts.sugerida,
        porQue: opts.porQue ?? null, criadoPorId: opts.userId ?? null,
      },
      update: { secao, sugerida: opts.sugerida, porQue: opts.porQue ?? null },
    })
    n++
  }
  return n
}

/**
 * ⭐⭐ O GESTO DO LOTE: confirma N produtos de uma vez.
 *
 * *"Os 156 agrupados pela sugestão, eu corro o olho, corrijo os errados e confirmo tudo de
 * uma vez."* — o dono. O que chega aqui **já passou pelo olho dele**, então entra como
 * `sugerida: false`: é decisão, não proposta.
 */
export async function confirmarLote(
  companyId: string,
  itens: readonly { nomesSuitable: string[]; secao: string }[],
  userId?: string,
  db: Db = defaultPrisma,
): Promise<{ produtos: number; nomes: number }> {
  let nomes = 0
  for (const i of itens) {
    nomes += await definirSecao(companyId, i.nomesSuitable, i.secao, { sugerida: false, userId }, db)
  }
  return { produtos: itens.length, nomes }
}

/**
 * ⭐ PRODUTO NOVO DO IMPORT entra com a seção sugerida, MARCADA.
 *
 * *"Entra com a seção sugerida pela mesma régua, marcada 'sugerida' até eu confirmar."*
 *
 * ⚠️ Quem já tem linha NÃO é tocado — nem pra corrigir a sugestão. Reavaliar o que já
 * existe faria a régua reabrir decisão do dono a cada import.
 */
export async function semearSecoesDeNovos(
  companyId: string, nomes: readonly string[], db: Db = defaultPrisma,
): Promise<number> {
  if (!nomes.length) return 0
  const jaTem = new Set((await db.stockCardapioProdutoSecao.findMany({
    where: { companyId, nomeSuitable: { in: [...nomes] } }, select: { nomeSuitable: true },
  })).map((r) => r.nomeSuitable))

  const novos = nomes.filter((n) => n?.trim() && !jaTem.has(n))
  if (!novos.length) return 0
  await db.stockCardapioProdutoSecao.createMany({
    data: novos.map((nomeSuitable) => {
      const s = sugerirSecao(nomeSuitable)
      return { companyId, nomeSuitable, secao: s.secao, sugerida: true, porQue: s.porQue }
    }),
  })
  return novos.length
}

export { SECAO_PADRAO }
