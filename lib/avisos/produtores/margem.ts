/**
 * ⭐⭐ OS AVISOS DA MARGEM (07/10/2026) — no SININHO, nunca inline.
 *
 * ⛔ A lei de 04/10 vale: *"nada de bloco de aviso inline em tela nenhuma sem o dono pedir"*.
 * A tela de margem mostra o ESTADO (o selo, a cobertura, o banquinho); o que pede AÇÃO vai pro
 * sininho.
 *
 * ⛔⛔ **ZERO CONTA NOVA:** os três produtores leem a MESMA `lerMargem` que a tela desenha. Uma
 * régua própria aqui faria o sininho e a tela discordarem do mesmo produto — a doença que este
 * projeto mais paga.
 *
 * ⚠️ O client vem por PARÂMETRO (a lição de 04/09): com o `prisma` global cravado, o preview
 * que embrulha o produtor num `$transaction` gravaria de verdade.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { registrarAviso } from '../central'
import { lerMargem } from '@/lib/margem/leitura'
import { formatBRL } from '@/lib/format/money'

type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM_NEGATIVA = 'MARGEM_SOBRA_NEGATIVA'
export const ORIGEM_DESPENCOU = 'MARGEM_DESPENCOU'
export const ORIGEM_RELATORIO = 'COMPLEMENTO_RELATORIO_INCOMPLETO'

/**
 * ⚠️ Quantos PONTOS de margem a queda precisa ter pra virar aviso. **8 pontos** é bem acima do
 * ruído de custo médio (o custo do insumo oscila com cada nota) e bem abaixo de uma mudança de
 * receita — e é âmbar, não vermelho: a margem caiu, nada está quebrado.
 */
export const QUEDA_EM_PONTOS = 0.08

/**
 * ⚠️ Abaixo de 10 unidades no período a margem de um produto não sustenta comparação: uma
 * venda atípica move o preço praticado inteiro. É a mesma trava do *"um lote não é média"*.
 */
export const MINIMO_DE_UNIDADES = 10

export interface ResumoDaMargem {
  gravados: number
  reabertos: number
  /** ⚠️ os que NÃO viraram aviso, com o porquê — supressão silenciosa viraria "o aviso não funciona" */
  calados: { produto: string; porque: string }[]
}

export async function produzirAvisosDeMargem(
  companyId: string,
  agora: Date = new Date(),
  db: Db = defaultPrisma,
): Promise<ResumoDaMargem> {
  const r: ResumoDaMargem = { gravados: 0, reabertos: 0, calados: [] }

  // ⚠️ o MÊS é a janela do aviso: 7 dias oscila demais pra cobrar ação, e "hoje" muda de
  // veredito a cada import da madrugada
  const agora_ = agora
  const mes = await lerMargem(companyId, 'MES', agora_, {}, db as PrismaClient)

  const reg = async (a: Parameters<typeof registrarAviso>[0]) => {
    const { reaberto } = await registrarAviso(a, db)
    r.gravados++
    if (reaberto) r.reabertos++
  }

  // ─────────── 1. SOBRA NEGATIVA — vermelho, com a CONTA na frase ───────────
  for (const p of mes.sobras.dentro) {
    if (p.sobraUn >= 0) continue
    if (p.unidades < MINIMO_DE_UNIDADES) {
      r.calados.push({ produto: p.nome, porque: `só ${p.unidades} un no mês — abaixo do mínimo pra comparar` })
      continue
    }
    await reg({
      companyId,
      setor: 'estoque',
      severidade: 'vermelho',
      titulo: `Confere o preço de ${p.nome} — está vendendo abaixo do custo`,
      // ⛔ a CONTA vai na frase: número sem a conta é o dono tendo que confiar
      corpo: `No mês, ${p.nome} saiu a ${formatBRL(p.preco)} e custa ${formatBRL(p.custo)} pra fazer — cada venda tira ${formatBRL(-p.sobraUn)} do caixa. Foram ${p.unidades} unidades, ${formatBRL(-p.sobraTotal)} no período.`,
      oQueFazer: 'Suba o preço, corte o custo da receita, ou confirme que é isca de propósito.',
      acaoRotulo: 'ver a margem deste produto',
      acaoHref: `/empresas/${companyId}/estoque/cardapio/${encodeURIComponent(p.chave)}`,
      origem: ORIGEM_NEGATIVA,
      alvo: p.chave,
    })
  }

  // ─────────── 2. MARGEM DESPENCOU vs o período anterior — âmbar ───────────
  /**
   * ⚠️ A comparação é com o MÊS ANTERIOR INTEIRO, e o mês corrente é PARCIAL — então ela só
   * vale depois que o mês tem corpo. Sem essa trava, todo dia 2 do mês o sininho acusaria
   * queda em metade do cardápio.
   */
  const diaDoMes = Number(agora_.toISOString().slice(8, 10))
  if (diaDoMes >= 10) {
    const anteriorMes = new Date(Date.UTC(agora_.getUTCFullYear(), agora_.getUTCMonth(), 0))
    const ini = `${anteriorMes.toISOString().slice(0, 7)}-01`
    const anterior = await lerMargem(
      companyId, 'DATAS', agora_,
      { de: ini, ate: anteriorMes.toISOString().slice(0, 10) },
      db as PrismaClient,
    )
    const antesPorChave = new Map(anterior.sobras.dentro.map((p) => [p.chave, p]))

    for (const p of mes.sobras.dentro) {
      const a = antesPorChave.get(p.chave)
      if (!a) continue
      if (p.unidades < MINIMO_DE_UNIDADES || a.unidades < MINIMO_DE_UNIDADES) {
        r.calados.push({ produto: p.nome, porque: 'volume abaixo do mínimo num dos dois meses' })
        continue
      }
      const queda = a.margemPct - p.margemPct
      if (queda < QUEDA_EM_PONTOS) continue
      // ⛔ "uma causa, um alarme": produto que já está vendendo abaixo do custo não ganha
      // também o aviso de queda — o vermelho de cima já diz o que fazer
      if (p.sobraUn < 0) {
        r.calados.push({ produto: p.nome, porque: 'já tem o aviso de sobra negativa (uma causa, um alarme)' })
        continue
      }
      await reg({
        companyId,
        setor: 'estoque',
        severidade: 'ambar',
        titulo: `Confere a margem de ${p.nome} — caiu ${(queda * 100).toFixed(0)} pontos`,
        corpo: `No mês passado ${p.nome} deixava ${(a.margemPct * 100).toFixed(0)}% (${formatBRL(a.sobraUn)} por unidade); neste mês está em ${(p.margemPct * 100).toFixed(0)}% (${formatBRL(p.sobraUn)}). Insumo mais caro ou preço que não acompanhou.`,
        oQueFazer: 'Veja qual insumo subiu na ficha de margem e decida: repassar no preço ou trocar o fornecedor.',
        acaoRotulo: 'ver a margem deste produto',
        acaoHref: `/empresas/${companyId}/estoque/cardapio/${encodeURIComponent(p.chave)}`,
        origem: ORIGEM_DESPENCOU,
        alvo: p.chave,
      })
    }
  } else {
    r.calados.push({ produto: '(todos)', porque: `dia ${diaDoMes} — o mês ainda não tem corpo pra comparar margem` })
  }

  // ─────────── 3. RELATÓRIO DE COMPLEMENTOS INCOMPLETO (item 1 do dono) ───────────
  /**
   * ⭐ A razão sabores/pizza oscila de 0,37 a 7,03 em prod, então ela **não serve de fator**
   * (foi por isso que o fator por tamanho morreu). Mas razão **< 1 é IMPOSSÍVEL**: toda pizza
   * obriga ao menos 1 sabor. Aí é dado faltando, e isso vira aviso com o DIA citado.
   */
  for (const d of mes.diasComRelatorioSuspeito) {
    await reg({
      companyId,
      setor: 'estoque',
      severidade: 'ambar',
      titulo: `Confere o relatório de complementos de ${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`,
      corpo: `Nesse dia saíram ${d.pizzas} pizzas e o relatório de complementos trouxe só ${d.sabores} sabores — toda pizza obriga ao menos um. O relatório veio incompleto?`,
      oQueFazer: 'Exporte o relatório de complementos desse dia de novo e reimporte — o estoque dos sabores está sendo baixado a menos.',
      acaoRotulo: 'ver os imports de venda',
      acaoHref: `/empresas/${companyId}/estoque/vendas?aba=processados#dia-${d.dia}`,
      origem: ORIGEM_RELATORIO,
      alvo: `dia:${d.dia}`,
    })
  }

  return r
}
