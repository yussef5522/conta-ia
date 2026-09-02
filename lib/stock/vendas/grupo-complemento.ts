// ⭐⭐ SABOR DE PIZZA × OUTRO COMPLEMENTO — a régua, e ela é EDITÁVEL (02/09/2026).
//
// ⚠️ POR QUE AGRUPAR: o relatório traz na MESMA lista o sabor da pizza (CALABRESA 115),
// a borda (BORDA CATUPIRY), o adicional (ADICIONE OVO FRITO), o combo de bebida
// (COCA LATA MAIS MINI FRITAS) e até o **tamanho** (GRANDE/MEDIO/PEQUENO) e respostas de
// formulário do PDV ("não desejo borda recheada", "padrão"). São trabalhos diferentes:
// sabor precisa de ficha; tamanho e "não desejo" precisam de IGNORAR.
//
// ⭐ A RÉGUA É O CARDÁPIO REAL (lista passada pelo dono em 02/09, extraída das fotos do
// cardápio online). Ela é um SEED, não um veredito: quem manda é a marcação do dono na
// tabela de override (`stock_venda_complemento_grupo`).
//
// ⛔ E O SISTEMA NÃO ADIVINHA POR SEMELHANÇA. "STROGONOFF DE CARNE FAMILIA" e
// "SABOR CREME DE AVELA PROMO" ficam em OUTROS até o dono mover — casar por parecido é a
// mesma classe do "memo diz Transferência": sugere, nunca decide.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export type GrupoComplemento = 'SABOR' | 'OUTRO'

/**
 * Os 52 sabores do cardápio da Caçula (02/09/2026).
 *
 * ⚠️ `STROGONOFF DE CARNEE` está assim no CARDÁPIO (com EE) e `STROGONOFF DE CARNE` é como o
 * PDV escreve — as DUAS grafias existem em fontes reais, então as duas entram. Isso não é
 * adivinhação: é registrar o que cada documento diz.
 */
export const SABORES_DO_CARDAPIO: readonly string[] = [
  'CAIPIRA MIX', 'PIZZA ATUM', 'BASCA', 'BACON', 'BACON ACEBOLADO', 'BROCOLIS',
  'BROCOLIS COM CATUPIRY', 'BROCOLIS COM BACON', 'CALABRESA', 'CALABRESA ACEBOLADA',
  'CHEF', 'ENTREVERO', 'ITALIANINHA', 'FILE MIGNON', 'FILE CRISPY', 'FILE DA CASA',
  'FILE COM BACON', 'PIZZA - FILE COM BROCOLIS', 'FILE ALHO E OLEO', 'FILE AOS 3 MOLHOS',
  'FILE MOSTARDA E MEL', 'FILE ESPECIAL', 'FILE BACONNAISE', 'FILE COM CHEDDAR',
  'FILE ACEBOLADO', 'FILE CATUPIRY', 'FILE COM PALHA', 'FRANGO', 'FRANGO COM CATUPIRY',
  'FRANGO COM CHEDDAR', 'FRANGO COM BARBECUE', 'FRANGO AOS 3 MOLHOS', 'FRANGO COM BACON',
  'FRANGO CHINES', 'MILHO', 'MILHO ESPECIAL', 'MILHO COM BACON', 'MEXICANA',
  'STROGONOFF DE FRANGO', 'STROGONOFF DE CARNEE', 'STROGONOFF DE CARNE',
  'NAPOLITANA', 'MARGHERITA', 'MUSSARELA ACEBOLADA', 'MUSSARELA', 'PORTUGUESA',
  'PAULISTA', 'VEGETARIANA', 'HOT DOG', '4 QUEIJOS', '5 QUEIJOS',
  'CHOCOLATE PRETO', 'CHOCOLATE BRANCO', 'KIT KAT',
]

/**
 * ⚠️ CAIXA E ACENTO NÃO PODEM SEPARAR O MESMO SABOR: o PDV real tem
 * `filé acebolado` **e** `FILE ACEBOLADO`, `frango com bacon` **e** `FRANGO COM BACON`.
 * Normalizar é o mínimo pra não tratar o mesmo prato como dois.
 * (Mesma lição do `contains` case-sensitive do Postgres, 28/08.)
 */
export function normalizarNome(n: string): string {
  return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const SABORES_NORM = new Set(SABORES_DO_CARDAPIO.map(normalizarNome))

/** A régua do SEED, sem override: o nome está no cardápio? */
export function grupoPeloCardapio(nomeSuitable: string): GrupoComplemento {
  return SABORES_NORM.has(normalizarNome(nomeSuitable)) ? 'SABOR' : 'OUTRO'
}

/**
 * O grupo VIGENTE de cada nome: **override do dono manda; o cardápio é o padrão.**
 *
 * ⭐ Por isso não há backfill nem seed de 121 linhas: a tabela guarda só o que o dono MOVEU.
 * Cardápio novo = editar a lista acima, e nada no banco precisa migrar.
 */
export async function gruposVigentes(
  companyId: string, nomes: readonly string[], db: PrismaClient = defaultPrisma,
): Promise<Map<string, { grupo: GrupoComplemento; doDono: boolean }>> {
  const overrides = await db.stockVendaComplementoGrupo.findMany({
    where: { companyId, nomeSuitable: { in: [...nomes] } },
    select: { nomeSuitable: true, grupo: true },
  })
  const porNome = new Map(overrides.map((o) => [o.nomeSuitable, o.grupo as GrupoComplemento]))
  return new Map(nomes.map((n) => {
    const o = porNome.get(n)
    return [n, { grupo: o ?? grupoPeloCardapio(n), doDono: o != null }]
  }))
}

export class GrupoComplementoError extends Error {}

/** Move um nome de grupo — decisão do dono, gravada como override. */
export async function moverGrupo(
  companyId: string, nomeSuitable: string, grupo: GrupoComplemento, userId?: string,
  db: PrismaClient = defaultPrisma,
) {
  const nome = nomeSuitable.trim()
  if (!nome) throw new GrupoComplementoError('Nome do complemento vazio.')
  if (grupo !== 'SABOR' && grupo !== 'OUTRO') throw new GrupoComplementoError('Grupo inválido.')
  return db.stockVendaComplementoGrupo.upsert({
    where: { companyId_nomeSuitable: { companyId, nomeSuitable: nome } },
    create: { companyId, nomeSuitable: nome, grupo, criadoPorId: userId ?? null },
    update: { grupo },
    select: { nomeSuitable: true, grupo: true },
  })
}

/** Desfaz o override — o nome volta a seguir o cardápio. */
export async function limparGrupo(companyId: string, nomeSuitable: string, db: PrismaClient = defaultPrisma) {
  await db.stockVendaComplementoGrupo.deleteMany({ where: { companyId, nomeSuitable: nomeSuitable.trim() } })
}

/**
 * ⭐ CONFERÊNCIA: quais sabores do cardápio NUNCA apareceram no relatório.
 *
 * ⚠️ Sabor que nunca vendeu **não precisa de ficha agora** — mas precisa ser NOMEADO, pra
 * ninguém achar que sumiu. Ausência silenciosa é a doença que este módulo mais paga.
 */
export function saboresSemVenda(nomesImportados: readonly string[]): string[] {
  const vistos = new Set(nomesImportados.map(normalizarNome))
  return SABORES_DO_CARDAPIO.filter((s) => !vistos.has(normalizarNome(s)))
}

/**
 * ⭐ Nomes do relatório que PARECEM variação de um sabor do cardápio (prefixo/sufixo).
 *
 * ⛔ SÓ LISTA — o vínculo N:1 é decisão do dono (palavras dele). Casar sozinho por
 * semelhança faria "CALABRESA BLACK FRIDAY" baixar a ficha da CALABRESA sem ninguém mandar.
 */
export function variacoesDeSabor(nomesImportados: readonly string[]): { nome: string; pareceCom: string }[] {
  const fora = nomesImportados.filter((n) => !SABORES_NORM.has(normalizarNome(n)))
  const out: { nome: string; pareceCom: string }[] = []
  for (const n of fora) {
    const norm = normalizarNome(n)
    // ⚠️ exige palavra INTEIRA na borda: "MILHO ESPECIAL" não vira variação de "MILHO"
    // por acaso — os dois são sabores próprios do cardápio e já casam exato.
    const base = SABORES_DO_CARDAPIO.find((s) => {
      const sn = normalizarNome(s)
      return sn.length >= 5 && (norm.startsWith(`${sn} `) || norm.endsWith(` ${sn}`))
    })
    if (base) out.push({ nome: n, pareceCom: base })
  }
  return out
}
