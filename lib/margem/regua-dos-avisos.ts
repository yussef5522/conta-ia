/**
 * ⭐⭐ A RÉGUA DOS AVISOS DA MARGEM — PURA, pra ser EXECUTADA (07/10/2026).
 *
 * ⛔⛔ POR QUE ELA SAIU DO PRODUTOR: lá ela vivia no meio de dois `await lerMargem` e de
 * `registrarAviso`, então a única coisa que dava pra conferir sobre ela era a MENÇÃO do
 * símbolo no arquivo — e **"menção, não uso" já custou 11 guards nesta casa**. A prova em
 * prod confirmou o tamanho do vão: o produtor rodou contra o dado real (18 produtos
 * avaliados, gate do dia 10 aberto na sonda) e devolveu **ZERO avisos, por razão legítima** —
 * ou seja, o caminho que MONTA a frase nunca foi exercido nem em teste nem em produção.
 *
 * ⚠️ Aqui a régua decide; quem lê e grava é o produtor. Ele continua sendo a única porta de
 * escrita (`registrarAviso`), e continua lendo a MESMA `lerMargem` que a tela desenha — uma
 * régua própria aqui faria o sininho e a tela discordarem do mesmo produto.
 */
import { formatBRL } from '@/lib/format/money'
import type { NovoAviso } from '@/lib/avisos/tipos'

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

/** ⚠️ o mês corrente é PARCIAL: comparar com um mês cheio antes disso acusa queda em metade
 * do cardápio todo dia 2. */
export const DIA_QUE_ABRE_A_COMPARACAO = 10

/** só o que a régua precisa de cada produto — o resto do payload da margem não entra */
export interface ProdutoParaAviso {
  chave: string
  nome: string
  unidades: number
  preco: number
  custo: number
  sobraUn: number
  sobraTotal: number
  margemPct: number
}

export interface DiaSuspeito {
  dia: string
  pizzas: number
  sabores: number
}

export interface Calado {
  produto: string
  porque: string
}

export interface VeredictoDosAvisos {
  avisos: Omit<NovoAviso, 'companyId'>[]
  calados: Calado[]
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const pts = (n: number) => (n * 100).toFixed(0)

export function reguaDosAvisosDaMargem(opts: {
  companyId: string
  /** produtos DENTRO da obra no mês corrente (os que têm preço e custo) */
  mes: readonly ProdutoParaAviso[]
  /** produtos do mês ANTERIOR INTEIRO — `null` quando o gate do dia ainda não abriu */
  anterior: readonly ProdutoParaAviso[] | null
  diaDoMes: number
  diasComRelatorioSuspeito: readonly DiaSuspeito[]
}): VeredictoDosAvisos {
  const { companyId, mes, anterior, diaDoMes, diasComRelatorioSuspeito } = opts
  const avisos: Omit<NovoAviso, 'companyId'>[] = []
  const calados: Calado[] = []
  const href = (chave: string) =>
    `/empresas/${companyId}/estoque/cardapio/${encodeURIComponent(chave)}`

  // ─────────── 1. SOBRA NEGATIVA — vermelho, com a CONTA na frase ───────────
  const negativos = new Set<string>()
  for (const p of mes) {
    if (p.sobraUn >= 0) continue
    if (p.unidades < MINIMO_DE_UNIDADES) {
      calados.push({ produto: p.nome, porque: `só ${p.unidades} un no mês — abaixo do mínimo pra comparar` })
      continue
    }
    negativos.add(p.chave)
    avisos.push({
      setor: 'estoque',
      severidade: 'vermelho',
      titulo: `Confere o preço de ${p.nome} — está vendendo abaixo do custo`,
      // ⛔ a CONTA vai na frase: número sem a conta é o dono tendo que confiar
      corpo: `No mês, ${p.nome} saiu a ${formatBRL(p.preco)} e custa ${formatBRL(p.custo)} pra fazer — cada venda tira ${formatBRL(-p.sobraUn)} do caixa. Foram ${p.unidades} unidades, ${formatBRL(-p.sobraTotal)} no período.`,
      oQueFazer: 'Suba o preço, corte o custo da receita, ou confirme que é isca de propósito.',
      acaoRotulo: 'ver a margem deste produto',
      acaoHref: href(p.chave),
      origem: ORIGEM_NEGATIVA,
      alvo: p.chave,
    })
  }

  // ─────────── 2. MARGEM DESPENCOU vs o mês anterior INTEIRO — âmbar ───────────
  if (anterior == null) {
    calados.push({
      produto: '(todos)',
      porque: `dia ${diaDoMes} — o mês ainda não tem corpo pra comparar margem`,
    })
  } else {
    const antes = new Map(anterior.map((p) => [p.chave, p]))
    for (const p of mes) {
      const a = antes.get(p.chave)
      if (!a) continue
      if (p.unidades < MINIMO_DE_UNIDADES || a.unidades < MINIMO_DE_UNIDADES) {
        calados.push({ produto: p.nome, porque: 'volume abaixo do mínimo num dos dois meses' })
        continue
      }
      const queda = a.margemPct - p.margemPct
      if (queda < QUEDA_EM_PONTOS) continue
      // ⛔ "uma causa, um alarme": produto que já está vendendo abaixo do custo não ganha
      // também o aviso de queda — o vermelho de cima já diz o que fazer
      if (negativos.has(p.chave)) {
        calados.push({ produto: p.nome, porque: 'já tem o aviso de sobra negativa (uma causa, um alarme)' })
        continue
      }
      avisos.push({
        setor: 'estoque',
        severidade: 'ambar',
        titulo: `Confere a margem de ${p.nome} — caiu ${pts(queda)} pontos`,
        corpo: `No mês passado ${p.nome} deixava ${pts(a.margemPct)}% (${formatBRL(a.sobraUn)} por unidade); neste mês está em ${pts(p.margemPct)}% (${formatBRL(p.sobraUn)}). Insumo mais caro ou preço que não acompanhou.`,
        oQueFazer: 'Veja qual insumo subiu na ficha de margem e decida: repassar no preço ou trocar o fornecedor.',
        acaoRotulo: 'ver a margem deste produto',
        acaoHref: href(p.chave),
        origem: ORIGEM_DESPENCOU,
        alvo: p.chave,
      })
    }
  }

  // ─────────── 3. RELATÓRIO DE COMPLEMENTOS INCOMPLETO (item 1 do dono) ───────────
  /**
   * ⭐ A razão sabores/pizza oscila de 0,37 a 7,03 em prod, então ela **não serve de fator**
   * (foi por isso que o fator por tamanho morreu). Mas razão **< 1 é IMPOSSÍVEL**: toda pizza
   * obriga ao menos 1 sabor. Aí é dado faltando, e isso vira aviso com o DIA citado.
   */
  for (const d of diasComRelatorioSuspeito) {
    avisos.push({
      setor: 'estoque',
      severidade: 'ambar',
      titulo: `Confere o relatório de complementos de ${ddmm(d.dia)}`,
      corpo: `Nesse dia saíram ${d.pizzas} pizzas e o relatório de complementos trouxe só ${d.sabores} sabores — toda pizza obriga ao menos um. O relatório veio incompleto?`,
      oQueFazer: 'Exporte o relatório de complementos desse dia de novo e reimporte — o estoque dos sabores está sendo baixado a menos.',
      acaoRotulo: 'ver os imports de venda',
      acaoHref: `/empresas/${companyId}/estoque/vendas?aba=processados#dia-${d.dia}`,
      origem: ORIGEM_RELATORIO,
      alvo: `dia:${d.dia}`,
    })
  }

  return { avisos, calados }
}
