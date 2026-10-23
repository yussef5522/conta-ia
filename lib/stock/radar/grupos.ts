// ⭐⭐⭐ OS GRUPOS DO RADAR SÃO AS LISTAS DO DONO (RT2 + RT3 da referência, 22/10/2026).
//
// A referência versionada (`docs/real-x-teorico-referencia.html`, aprovada em 22/10) é A LEI
// desta tela. RT2: *"os grupos são as listas do dono, COMPARTILHADAS (Radar · Consumo &
// Compras · aqui — uma verdade só, porta única): renomear no lápis ✎, adicionar item, criar
// grupo novo. Mexeu aqui, valeu nas três telas."* RT3: a agenda de contagem por grupo.
//
// ═══ ⛔⛔ ESTA É A PORTA ÚNICA DE ESCRITA DE GRUPO ═══
//
// Quatro gestos (semear · criar · renomear · definir agenda) e NENHUM outro caminho escreve
// em `stock_grupo_vigiado`. Rota é casca fina. Dois lugares gravando o mesmo grupo
// divergiriam no 1º campo novo — e aqui a divergência seria visível na hora, porque a MESMA
// linha alimenta o Radar, a mesa do Real × Teórico e o Consumo & Compras.
//
// ═══ ⭐⭐ O SLUG É A IDENTIDADE; O NOME É SÓ ROUPA ═══
//
// `stock_radar_item.lista` (a membership, de 21/09) guarda o SLUG cru. Logo:
//   · renomear **não toca uma linha** de vínculo → "idêntico antes==depois" é PROVÁVEL
//   · não existe caminho pra trocar o slug — ele não está em nenhum input daqui (REGRA 5:
//     impossibilidade, não disciplina)
// É a lição do `systemSlug='BRIDGE_ENTRY'` (13/08): marcador estável é o que faz o rename
// sair de graça. Sem ele, "renomear" seria reescrever N vínculos num UPDATE em massa.
//
// ═══ ⚠️ O SEED NÃO COPIA MEMBERSHIP NENHUMA — e é por isso que ele é seguro ═══
//
// Semear os 3 grupos com os slugs `CAROS`/`REVENDA`/`PORCOES` **já os faz apontar pros
// vínculos que existem**, porque é exatamente esse literal que está gravado em
// `stock_radar_item.lista` desde 21/09. Nada é movido, nada é duplicado: o que nasce é só o
// nome, o emoji, a ordem e a agenda.

import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { exigirEscolha, EscolhaVaziaError } from '../texto-de-escolha'
import { LISTAS, type Lista } from './watchlist'

/** ⚠️ erro próprio pra a rota traduzir em 422 com a frase, nunca um 500 mudo (16/09) */
export class GrupoError extends Error {}

/**
 * ⭐ A SEMEADURA NOMINAL AUTORIZADA PELO DONO (22/10) — nome, emoji e ORDEM **idênticos** ao
 * que `montarMesa` cravava na tela até hoje (`'revenda'/🥤`, `'os caros'/💰`, `'porções'/🍳`).
 *
 * ⛔⛔ Os três literais são copiados DAQUELE código de propósito: é isso que torna o
 * "comportamento idêntico antes==depois" uma comparação de strings, não uma promessa. Se eu
 * "melhorasse" os nomes aqui (CAROS → "Os caros"), a prova morreria junto.
 *
 * ⚠️ A ORDEM também é a de hoje (revenda · caros · porções, a ordem que `montarMesa` devolve),
 * NÃO a de `LISTAS` — aquela é a ordem do vocabulário, esta é a das seções na tela.
 */
const SEMENTE: { slug: Lista; nome: string; emoji: string; ordem: number; todoDia: boolean; dias: number[] }[] = [
  // ⭐ o padrão da agenda é a ROTINA DO DONO (brief de 22/10):
  //    PORÇÕES = todo dia · OS CAROS = SEX · REVENDA = SEG
  { slug: 'REVENDA', nome: 'revenda', emoji: '🥤', ordem: 0, todoDia: false, dias: [0] },
  { slug: 'CAROS', nome: 'os caros', emoji: '💰', ordem: 1, todoDia: false, dias: [4] },
  { slug: 'PORCOES', nome: 'porções', emoji: '🍳', ordem: 2, todoDia: true, dias: [] },
]

/** ⭐ emoji do grupo novo — o mesmo que o `<script>` da referência usa em `novoGrupo()` */
export const EMOJI_PADRAO = '⭐'

/**
 * ⭐⭐ O VOCABULÁRIO DOS DIAS TEM UM DONO SÓ: `agenda-da-contagem.ts`.
 *
 * ⛔⛔ **A SETA É SEMPRE PORTA → REGRA PURA, NUNCA O CONTRÁRIO.** Este arquivo importa
 * `@/lib/db`; a regra da agenda é lida pela TELA. Se a regra importasse daqui, um `import`
 * no cliente arrastaria o **PrismaClient pro bundle do navegador**.
 *
 * ⚠️ E ele é RE-EXPORTADO porque quem já consome a porta não tem que aprender um 2º
 * endereço — mas a definição vive num lugar só (duas listas de dias divergiriam no dia em
 * que alguém trocasse `SÁB` por `SAB`).
 */
export { DIAS_SEG_FIRST } from './agenda-da-contagem'

export interface GrupoVigiado {
  id: string
  slug: string
  nome: string
  emoji: string
  ordem: number
  /** a agenda, já desserializada — o CSV não atravessa a porta */
  agenda: { todoDia: boolean; dias: number[] }
  /** ⭐ true quando o grupo é um dos 3 de origem (o Consumo & Compras tem comportamento só neles) */
  legado: boolean
}

const SELECT = {
  id: true,
  slug: true,
  nome: true,
  emoji: true,
  ordem: true,
  agendaTodoDia: true,
  agendaDias: true,
} as const

type LinhaCrua = {
  id: string
  slug: string
  nome: string
  emoji: string
  ordem: number
  agendaTodoDia: boolean
  agendaDias: string
}

function paraGrupo(l: LinhaCrua): GrupoVigiado {
  return {
    id: l.id,
    slug: l.slug,
    nome: l.nome,
    emoji: l.emoji,
    ordem: l.ordem,
    agenda: { todoDia: l.agendaTodoDia, dias: lerDias(l.agendaDias) },
    legado: (LISTAS as string[]).includes(l.slug),
  }
}

/** ⛔ o CSV é detalhe de armazenamento: quem serializa/parseia é SÓ esta porta */
function lerDias(csv: string): number[] {
  if (!csv) return []
  const nums = csv
    .split(',')
    .map((p) => Number.parseInt(p, 10))
    // ⚠️ dado torto que tenha entrado por outra porta não vira dia inventado: ele SAI
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  return [...new Set(nums)].sort((a, b) => a - b)
}

/** ⚠️ normaliza ANTES de gravar: único, ordenado, 0..6 — e o CHECK do banco é o backstop */
function escreverDias(dias: number[]): string {
  const limpos = [...new Set(dias.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
  return limpos.join(',')
}

export interface GruposDoRadar {
  grupos: GrupoVigiado[]
  semeadoAgora: boolean
}

/**
 * ⭐ A LEITURA — e ela SEMEIA no primeiro acesso.
 *
 * ⚠️⚠️ **O SEED SÓ RODA COM A TABELA VAZIA PRA ESTA EMPRESA.** Se ele rodasse a cada
 * leitura, **sobrescreveria o rename do dono** — e renomear é justamente o gesto que esta
 * tabela existe pra permitir. É a mesma régua do `listasDoRadar` (20/09), com a aposta mais
 * alta: lá o seed de volta repetiria uma lista; aqui ele apagaria o nome que ele escolheu.
 */
export async function gruposDoRadar(
  companyId: string,
  db: PrismaClient = defaultPrisma,
  quemSemeou?: string,
): Promise<GruposDoRadar> {
  const linhas = await db.stockGrupoVigiado.findMany({
    where: { companyId },
    select: SELECT,
    orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
  })
  if (linhas.length > 0) return { grupos: linhas.map(paraGrupo), semeadoAgora: false }

  /**
   * ⚠️ **A CORRIDA DO PRIMEIRO ACESSO NÃO PODE DERRUBAR A TELA.** Duas abas abrindo junto
   * semeiam junto; quem perder bate no índice único (que é quem manda) e, em vez de erro na
   * cara do dono, **relê** — o resultado é o mesmo nos dois casos.
   * ⛔ `skipDuplicates` não serve: o Prisma não o oferece no SQLite do dev, e código que só
   * compila num dos dois bancos é a divergência dev×prod que já custou a busca
   * case-sensitive (28/08).
   */
  try {
    await db.stockGrupoVigiado.createMany({
      data: SEMENTE.map((s) => ({
        companyId,
        slug: s.slug,
        nome: s.nome,
        emoji: s.emoji,
        ordem: s.ordem,
        agendaTodoDia: s.todoDia,
        agendaDias: escreverDias(s.dias),
        criadoPorId: quemSemeou ?? null,
      })),
    })
  } catch {
    const denovo = await db.stockGrupoVigiado.findMany({
      where: { companyId },
      select: SELECT,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    })
    return { grupos: denovo.map(paraGrupo), semeadoAgora: false }
  }

  const criados = await db.stockGrupoVigiado.findMany({
    where: { companyId },
    select: SELECT,
    orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
  })
  return { grupos: criados.map(paraGrupo), semeadoAgora: true }
}

/**
 * ⭐⭐ O SLUG DE GRUPO NOVO NÃO SAI DO NOME, e os dois motivos são duros:
 *
 * ⛔ (a) **o slug é imutável e o nome não é.** Derivar do nome faria o leitor pensar que um
 *    acompanha o outro, e o dia em que alguém "sincronizasse" os dois quebraria TODA a
 *    membership daquele grupo em silêncio.
 * ⛔ (b) **colisão com palavra reservada.** Um grupo chamado "caros" viraria slug `CAROS` e
 *    passaria a disputar os vínculos do grupo original.
 *
 * ⚠️ MAIÚSCULO por obrigação do banco: `chk_stock_radar_item_lista` exige
 * `lista = upper(lista)` desde 21/09 — slug minúsculo seria **impossível de gravar na
 * membership**, e o grupo novo nasceria sem poder receber um item.
 */
function slugNovo(): string {
  return `G${randomBytes(12).toString('hex').toUpperCase()}`
}

/** ⭐ "+ novo grupo" — nasce VAZIO e sem dia de contagem; o dono escolhe os dois */
export async function criarGrupo(
  input: { companyId: string; nome: string; emoji?: string; quem?: string },
  db: PrismaClient = defaultPrisma,
): Promise<GrupoVigiado> {
  const nome = texto(input.nome, 'O nome do grupo')
  const emoji = input.emoji ? texto(input.emoji, 'O emoji do grupo') : EMOJI_PADRAO

  // ⚠️ a ordem nasce no FIM da mesa: grupo novo não se mete entre os que o dono já lê
  const ultimo = await db.stockGrupoVigiado.findFirst({
    where: { companyId: input.companyId },
    select: { ordem: true },
    orderBy: { ordem: 'desc' },
  })

  const criado = await db.stockGrupoVigiado.create({
    data: {
      companyId: input.companyId,
      slug: slugNovo(),
      nome,
      emoji,
      ordem: (ultimo?.ordem ?? -1) + 1,
      // ⛔ nasce SEM agenda: inventar um dia de contagem poria um selo "CONTAR HOJE" numa
      //    rotina que ninguém combinou — a ausência é a resposta honesta até ele escolher
      agendaTodoDia: false,
      agendaDias: '',
      criadoPorId: input.quem ?? null,
    },
    select: SELECT,
  })
  return paraGrupo(criado)
}

/**
 * ⭐ O ✎ — renomeia (e troca o emoji).
 *
 * ⛔⛔ **NÃO EXISTE `slug` NESTE INPUT**, e é essa ausência que garante o RT2: *"mexeu aqui,
 * valeu nas três telas"* vale justamente porque a identidade não se mexe. Rename é escrita
 * em UMA linha; a membership nem é lida.
 */
export async function renomearGrupo(
  input: { companyId: string; grupoId: string; nome: string; emoji?: string; quem?: string },
  db: PrismaClient = defaultPrisma,
): Promise<GrupoVigiado> {
  const nome = texto(input.nome, 'O nome do grupo')
  const emoji = input.emoji === undefined ? undefined : texto(input.emoji, 'O emoji do grupo')

  // ⚠️ REGRA 8 — resolve por ID **escopado pela empresa**: sem o companyId no `where`, um id
  //    de outra empresa renomearia o grupo do vizinho
  const alvo = await db.stockGrupoVigiado.findFirst({
    where: { id: input.grupoId, companyId: input.companyId },
    select: { id: true },
  })
  if (!alvo) throw new GrupoError('Não achei este grupo nesta empresa.')

  const salvo = await db.stockGrupoVigiado.update({
    where: { id: alvo.id },
    data: {
      nome,
      ...(emoji === undefined ? {} : { emoji }),
      renomeadoPorId: input.quem ?? null,
      renomeadoEm: new Date(),
    },
    select: SELECT,
  })
  return paraGrupo(salvo)
}

/**
 * ⭐ Os chips TODO DIA · SEG–DOM.
 *
 * ⛔ `todoDia` ZERA os dias — e isso não é arrumação, é a coerência que o CHECK do banco
 *    exige: "todo dia" com uma lista de dias ao lado seria um 3º estado, e o selo teria que
 *    ESCOLHER qual manda (duas telas escolheriam diferente). O `<script>` da referência
 *    desenha exatamente isso em `tglTodo`.
 */
export async function definirAgendaDoGrupo(
  input: { companyId: string; grupoId: string; todoDia: boolean; dias: number[]; quem?: string },
  db: PrismaClient = defaultPrisma,
): Promise<GrupoVigiado> {
  const alvo = await db.stockGrupoVigiado.findFirst({
    where: { id: input.grupoId, companyId: input.companyId },
    select: { id: true },
  })
  if (!alvo) throw new GrupoError('Não achei este grupo nesta empresa.')

  const salvo = await db.stockGrupoVigiado.update({
    where: { id: alvo.id },
    data: {
      agendaTodoDia: input.todoDia,
      agendaDias: input.todoDia ? '' : escreverDias(input.dias),
      agendaDefinidaPorId: input.quem ?? null,
      agendaDefinidaEm: new Date(),
    },
    select: SELECT,
  })
  return paraGrupo(salvo)
}

/** ⚠️ `'   '` nunca é escolha — e o `GrupoError` é o que faz a rota responder 422 com a frase */
function texto(bruto: unknown, oQue: string): string {
  try {
    return exigirEscolha(bruto, oQue)
  } catch (e) {
    if (e instanceof EscolhaVaziaError) throw new GrupoError(e.message)
    throw e
  }
}
