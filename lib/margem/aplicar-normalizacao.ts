/**
 * ⭐⭐⭐ A GRAVAÇÃO DA NORMALIZAÇÃO — só depois do OK do dono (08/10/2026).
 *
 * ⛔⛔ GRAVA PELA PORTA QUE VERSIONA (`atualizarFicha`), NUNCA por `stockFichaVersao.create`.
 * Aquela é a única porta de receita desde 21/08: ela cria a versão nova, detecta ciclo, herda
 * etapas e deixa o autor no rastro. Uma segunda porta de gravação de receita é literalmente o
 * defeito que o `PAGAMENTO_EMPRESTIMO` do import cometeu em 11/09 (gravou sem split por um
 * caminho paralelo) — e aqui o estrago seria pior: ordem de produção antiga aponta pra versão
 * da época, e escrever por fora deixaria a ficha sem histórico.
 *
 * ⛔ O HISTÓRICO NÃO REPROCESSA (ordem do dono, item 3): margem, liga e casa são **leitura ao
 * vivo** e melhoram sozinhas no próximo carregamento. Movimento passado não se toca — o
 * ledger é imutável, e reprocessar dias de venda seria gesto PRÓPRIO, com preview.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { atualizarFicha } from '@/lib/stock/producao/fichas'
import { TAMANHOS_CANONICOS, motivoDaDoseADeclarar, type TamanhoCanonico } from './bases-canonicas'
import { previewNormalizacao, type PreviewDaNormalizacao } from './preview-normalizacao'

export interface ResultadoDaNormalizacao {
  fichas: { fichaId: string; nome: string; de: number; para: number; resumo: string }[]
  basesApontadas: { tamanho: string; fichaId: string; nome: string; criada: boolean }[]
  dosesADeclarar: { ficha: string; item: string }[]
  pulados: { fichaId: string; nome: string; porque: string }[]
}

/**
 * ⚠️ `confirmados` é a lista de fichaIds que o dono confirmou NO CHAT. Linha classificada como
 * `PERGUNTA` **só é tocada se vier aqui** — é o que separa "o preview perguntou" de "o sistema
 * decidiu". Sem a lista, só as `CLARO` entram.
 */
export async function aplicarNormalizacao(
  companyId: string,
  opts: { preview?: PreviewDaNormalizacao; confirmados?: string[]; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<ResultadoDaNormalizacao> {
  const p = opts.preview ?? (await previewNormalizacao(companyId, {}, db))
  if (p.bloqueio) throw new Error(`não dá pra aplicar: ${p.bloqueio}`)
  const confirmados = new Set(opts.confirmados ?? [])

  const r: ResultadoDaNormalizacao = { fichas: [], basesApontadas: [], dosesADeclarar: [], pulados: [] }
  const todas = p.grupos.flatMap((g) => g.linhas)

  // ─────────── 1. a COMPOSIÇÃO de cada base, versionada ───────────
  for (const l of todas) {
    if (l.jaNormalizada) {
      r.pulados.push({ fichaId: l.fichaId, nome: l.nome, porque: 'já está na composição canônica' })
      continue
    }
    if (!l.classificacao.tamanho || l.proposta.length === 0) {
      r.pulados.push({ fichaId: l.fichaId, nome: l.nome, porque: 'tamanho não resolvido — o dono precisa dizer qual é' })
      continue
    }
    if (l.classificacao.confianca === 'PERGUNTA' && !confirmados.has(l.fichaId)) {
      r.pulados.push({ fichaId: l.fichaId, nome: l.nome, porque: `espera confirmação — ${l.classificacao.porque}` })
      continue
    }

    const { versao } = await atualizarFicha(
      companyId,
      l.fichaId,
      {
        componentes: l.proposta.map((c, i) => ({
          itemId: c.itemId,
          qtdPlanejada: c.qtd,
          unidade: 'UN',
          posicao: i,
        })),
        userId: opts.userId,
      },
      db,
    )
    r.fichas.push({
      fichaId: l.fichaId,
      nome: l.nome,
      de: l.versaoAtual,
      para: versao,
      resumo: l.proposta.map((c) => `${c.qtd}× ${c.nome}`).join(' + '),
    })
  }

  // ─────────── 2. o APONTAMENTO da base de cada tamanho ───────────
  /**
   * ⭐ A base de um tamanho é a ficha do tamanho SEM variação de preço, com mais volume.
   *
   * ⚠️ `PRECINHO`/`PROMO`/app são pontos de PREÇO do mesmo tamanho; apontar a bancada pro
   * precinho faria a simulação do dono nascer no preço promocional sem ele pedir. ⛔ E é
   * SUGESTÃO: o apontamento já existente **nunca** é sobrescrito — quem aponta é o dono, e
   * trocar por baixo a base que ele escolheu é a classe do "sistema decidiu sozinho".
   */
  const jaApontadas = await db.stockBaseDoTamanho.findMany({ where: { companyId } })
  for (const t of TAMANHOS_CANONICOS) {
    if (jaApontadas.some((b) => b.tamanho === t)) continue
    const candidatas = todas
      .filter((l) => l.classificacao.tamanho === t && l.classificacao.multiplicador === 1)
      .filter((l) => !/PRECINHO|PROMO|AIQ/i.test(l.nome))
      .sort((a, b) => b.unidades - a.unidades)
    const escolhida = candidatas[0]
    if (!escolhida) continue
    await db.stockBaseDoTamanho.create({
      data: { companyId, tamanho: t, fichaId: escolhida.fichaId, criadoPorId: opts.userId ?? null },
    })
    r.basesApontadas.push({ tamanho: t, fichaId: escolhida.fichaId, nome: escolhida.nome, criada: true })
  }

  // ─────────── 3. a DOSE do molho, declarada como pendência ───────────
  /**
   * ⛔ Nunca um número: a dose é do dono. A pendência fica VISÍVEL na ficha e some sozinha
   * quando o molho virar componente de verdade (o leitor esconde o que já está na receita).
   */
  const molho = p.itens.molho
  if (molho) {
    for (const l of todas) {
      if (!l.classificacao.tamanho) continue
      /** ⭐ a régua do texto mora em `motivoDaDoseADeclarar` (pura) — aqui só se consome */
      const motivo = motivoDaDoseADeclarar(l.classificacao.multiplicador)
      await db.stockDoseADeclarar.upsert({
        where: { companyId_fichaId_itemId: { companyId, fichaId: l.fichaId, itemId: molho.id } },
        /** ⚠️ o motivo é texto DERIVADO da classificação, então ele se atualiza: a pendência do
         *  combo nasceu antes da régua do multiplicador existir e ficaria mentindo "uma pizza". */
        update: { motivo },
        create: {
          companyId,
          fichaId: l.fichaId,
          itemId: molho.id,
          motivo,
          criadoPorId: opts.userId ?? null,
        },
      })
      r.dosesADeclarar.push({ ficha: l.nome, item: molho.nome })
    }
  }

  return r
}

/**
 * ⭐ O LEITOR da pendência — a ficha diz o que falta.
 *
 * ⚠️ Esconde a pendência cujo item JÁ é componente da versão atual: a pendência se resolve
 * pelo FATO (o dono declarou a dose), nunca por alguém lembrar de apagar a linha.
 */
export async function dosesADeclararDaFicha(
  companyId: string,
  fichaId: string,
  db: PrismaClient = defaultPrisma,
): Promise<{ itemId: string; nome: string; motivo: string }[]> {
  const pend = await db.stockDoseADeclarar.findMany({ where: { companyId, fichaId } })
  if (!pend.length) return []
  const ficha = await db.stockFicha.findFirst({ where: { id: fichaId, companyId } })
  if (!ficha) return []
  const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId, versao: ficha.versaoAtual } })
  const comps = v ? await db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id } }) : []
  const jaNaReceita = new Set(comps.map((c) => c.itemId))
  const faltantes = pend.filter((x) => !jaNaReceita.has(x.itemId))
  if (!faltantes.length) return []
  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: faltantes.map((x) => x.itemId) } },
    select: { id: true, nome: true },
  })
  const nome = new Map(itens.map((i) => [i.id, i.nome]))
  return faltantes.map((x) => ({ itemId: x.itemId, nome: nome.get(x.itemId) ?? x.itemId, motivo: x.motivo }))
}
