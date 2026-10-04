/**
 * ⭐⭐⭐ A PORTA ÚNICA DA CENTRAL DE AVISOS (04/10/2026) — registrar, resolver, ler.
 *
 * ⛔⛔ **UMA PORTA, por decisão de arquitetura.** Os produtores são vários (o juiz das 3h, os
 * guards de estoque, os de produção, os de ponte) e vão crescer. Se cada um gravasse na tabela
 * do seu jeito, a lei da língua do balcão e o dedupe por `origem+alvo` viravam disciplina de N
 * autores — e é exatamente assim que esta casa acabou com 7 detectores de par, 4 chaves de
 * identidade de linha e 3 réguas de "vence este mês". **Aqui é `registrarAviso` ou nada.**
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { exigirLinguaDoBalcao } from './lingua-do-balcao'
import { PESO_SEVERIDADE, type NovoAviso, type Setor, type Severidade } from './tipos'

type Db = PrismaClient | Prisma.TransactionClient

export interface AvisoNaTela {
  id: string
  setor: Setor
  severidade: Severidade
  titulo: string
  corpo: string
  oQueFazer: string
  acaoRotulo: string | null
  acaoHref: string | null
  origem: string
  alvo: string
  vezes: number
  criadoEm: string
  lido: boolean
}

/**
 * ⭐ REGISTRA (ou ATUALIZA) um aviso.
 *
 * ⛔⛔ **O ANTI-SPAM É O UPSERT, não um `if` antes dele.** `origem + alvo` é UNIQUE no banco, e
 * o mesmo problema reaparecendo **atualiza a linha** — 30 rodadas do juiz sobre o CHEDDAR dão
 * **1 aviso com `vezes: 30`**, nunca 30 avisos. Era ordem do dono (*"o mesmo problema atualiza
 * o aviso existente, não cria 10"*) e virou impossibilidade.
 *
 * ⚠️ **REABRIR ZERA O "LIDO", e isso é deliberado:** se o problema volta depois de resolvido (ou
 * depois de o dono marcar como lido), ele é notícia OUTRA VEZ — deixar lido faria o sininho
 * calar sobre um problema que voltou, que é a pior falha possível numa central de avisos.
 */
export async function registrarAviso(novo: NovoAviso, db: Db = prisma): Promise<{ id: string; reaberto: boolean }> {
  exigirLinguaDoBalcao(novo)

  const existente = await db.aviso.findUnique({
    where: { companyId_origem_alvo: { companyId: novo.companyId, origem: novo.origem, alvo: novo.alvo } },
    select: { id: true, vezes: true, resolvidoEm: true, lidoEm: true },
  })

  const campos = {
    setor: novo.setor,
    severidade: novo.severidade,
    titulo: novo.titulo.trim(),
    corpo: novo.corpo.trim(),
    oQueFazer: novo.oQueFazer.trim(),
    acaoRotulo: novo.acaoRotulo?.trim() || null,
    acaoHref: novo.acaoHref?.trim() || null,
  }

  if (!existente) {
    const criado = await db.aviso.create({
      data: { companyId: novo.companyId, origem: novo.origem, alvo: novo.alvo, ...campos },
      select: { id: true },
    })
    return { id: criado.id, reaberto: false }
  }

  const reaberto = existente.resolvidoEm !== null
  await db.aviso.update({
    where: { id: existente.id },
    data: {
      ...campos,
      vezes: existente.vezes + 1,
      resolvidoEm: null,
      // ⭐ problema que volta é notícia de novo
      lidoEm: reaberto ? null : existente.lidoEm,
    },
  })
  return { id: existente.id, reaberto }
}

/**
 * ⭐ RESOLVE — e "resolvido SOME da tela" é ordem do dono.
 *
 * ⛔ Não apaga a linha: o rastro é o que permite responder *"isso já aconteceu antes?"*, e é o
 * mesmo `origem+alvo` que REABRE se o problema voltar. Apagar perderia o histórico e faria o
 * `vezes` recomeçar do zero a cada ida e volta.
 *
 * ⚠️ Idempotente: resolver duas vezes não é erro — o juiz roda toda noite e vai chamar isto
 * pra todo problema que deixou de existir.
 */
export async function resolverAviso(
  companyId: string,
  origem: string,
  alvo: string,
  db: Db = prisma,
): Promise<boolean> {
  const r = await db.aviso.updateMany({
    where: { companyId, origem, alvo, resolvidoEm: null },
    data: { resolvidoEm: new Date() },
  })
  return r.count > 0
}

/**
 * ⭐⭐ RESOLVE EM MASSA o que a origem NÃO reportou nesta rodada.
 *
 * ⛔⛔ **Sem isto a central vira cemitério.** O juiz roda toda noite e reporta o que ESTÁ
 * errado; o que ele deixou de reportar **deixou de estar errado** e tem que sumir sozinho —
 * senão o dono conserta o CHEDDAR e o aviso do CHEDDAR fica lá pra sempre, e em duas semanas
 * ele para de olhar o sininho. É o mesmo raciocínio do *"fila zerada esconde o trabalho, nunca
 * a ferramenta"* (12/09), do outro lado: trabalho FEITO tem que sair da fila.
 *
 * ⚠️ Escopado por ORIGEM, nunca global: cada produtor só sabe fechar o que ele mesmo abriu.
 * Um `resolverTudoQueNaoVeio` global apagaria avisos de guards que não rodaram naquela noite.
 */
export async function reconciliarOrigem(
  companyId: string,
  origem: string,
  alvosVivos: string[],
  db: Db = prisma,
): Promise<number> {
  const r = await db.aviso.updateMany({
    where: {
      companyId,
      origem,
      resolvidoEm: null,
      ...(alvosVivos.length ? { alvo: { notIn: alvosVivos } } : {}),
    },
    data: { resolvidoEm: new Date() },
  })
  return r.count
}

/** ⭐ ordena pelo que dói primeiro; empate pelo mais recente */
function ordenar(a: AvisoNaTela, b: AvisoNaTela): number {
  const p = PESO_SEVERIDADE[a.severidade] - PESO_SEVERIDADE[b.severidade]
  if (p !== 0) return p
  return b.criadoEm.localeCompare(a.criadoEm)
}

function paraTela(r: {
  id: string; setor: string; severidade: string; titulo: string; corpo: string; oQueFazer: string
  acaoRotulo: string | null; acaoHref: string | null; origem: string; alvo: string; vezes: number
  criadoEm: Date; lidoEm: Date | null
}): AvisoNaTela {
  return {
    id: r.id,
    setor: r.setor as Setor,
    severidade: r.severidade as Severidade,
    titulo: r.titulo,
    corpo: r.corpo,
    oQueFazer: r.oQueFazer,
    acaoRotulo: r.acaoRotulo,
    acaoHref: r.acaoHref,
    origem: r.origem,
    alvo: r.alvo,
    vezes: r.vezes,
    criadoEm: r.criadoEm.toISOString(),
    lido: r.lidoEm !== null,
  }
}

/**
 * ⭐⭐ O QUE O SININHO MOSTRA: tudo que está em aberto, agrupado por setor.
 *
 * ⚠️ `resolvidoEm: null` é a única régua de "está em aberto" — e ela é a MESMA que o bloco por
 * setor usa, porque os dois chamam esta função. Duas leituras divergiriam no primeiro caso de
 * borda e o contador diria um número com a tela mostrando outro (o defeito que o badge da
 * Conciliação carregou por meses).
 */
export async function avisosAbertos(companyId: string, db: Db = prisma): Promise<AvisoNaTela[]> {
  const rows = await db.aviso.findMany({
    where: { companyId, resolvidoEm: null },
    orderBy: { criadoEm: 'desc' },
  })
  return rows.map(paraTela).sort(ordenar)
}

/**
 * ⭐⭐⭐ O BLOCO POR SETOR — **e esta função é onde a LEI do dono mora.**
 *
 * ⛔⛔ *"Na home de PRODUÇÃO só avisos de produção; financeiro NUNCA aparece na produção (lei)"*.
 * O filtro é por `setor` no WHERE, não por uma escolha da tela: se a tela decidisse, a próxima
 * tela nova decidiria de novo — e uma delas decidiria errado. ⚠️ `sistema` também NÃO entra em
 * bloco de setor: ele é do sininho (é aviso sobre o SISTEMA, não sobre o trabalho daquela tela).
 */
export async function avisosDoSetor(
  companyId: string,
  setor: Setor,
  db: Db = prisma,
): Promise<AvisoNaTela[]> {
  const rows = await db.aviso.findMany({
    where: { companyId, setor, resolvidoEm: null },
    orderBy: { criadoEm: 'desc' },
  })
  return rows.map(paraTela).sort(ordenar)
}

/** ⭐ marcar lido — gesto do dono no painel do sininho */
export async function marcarLido(companyId: string, id: string, db: Db = prisma): Promise<boolean> {
  const r = await db.aviso.updateMany({
    where: { companyId, id, lidoEm: null },
    data: { lidoEm: new Date() },
  })
  return r.count > 0
}

/** ⭐ marcar TODOS lidos — o gesto de quem acabou de ler o painel inteiro */
export async function marcarTodosLidos(companyId: string, db: Db = prisma): Promise<number> {
  const r = await db.aviso.updateMany({
    where: { companyId, resolvidoEm: null, lidoEm: null },
    data: { lidoEm: new Date() },
  })
  return r.count
}
