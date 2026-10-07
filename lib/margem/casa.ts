/**
 * ⭐⭐⭐ A CASA DE TIJOLOS — "quem paga a casa" (07/10/2026).
 *
 * O custo fixo do período É uma casa: cada produto é um **TIJOLO com área proporcional à
 * SOBRA TOTAL** que ele gerou, empilhado da fundação ao telhado em ordem de contribuição
 * (maior embaixo). O telhado é **100% do custo fixo**.
 *
 * ⛔⛔ **ZERO CONTA NOVA:** a sobra vem de `sobrasDoPeriodo` (que vem do `hubCardapio`, que
 * vem do `explodirReceita` e do PDV) e o custo fixo vem da tela **Custos Fixos**,
 * **RESPEITANDO os chips que o dono deixou ligados** — e a tela DIZ a composição
 * ("casa+banco+compromissos"), porque o mesmo mês custa números diferentes conforme o
 * interruptor, e número sem régua em tela de dinheiro é pior que ausência.
 *
 * ═══ ⛔⛔ O PLACAR "A CASA FOI PAGA NO DIA D" É GATEADO PELA COBERTURA ═══
 *
 * Medido em prod (07/10): **54 de 214 produtos** têm custo; **157 ficaram fora da obra**,
 * incluindo o `XIS - COMPLETO` com **1.951 vendas**. E as bases de pizza estão incompletas
 * (massa em 1 de 6, molho em nenhuma), o que **infla** a sobra das pizzas. Com um lado
 * deflacionando e o outro inflando, cravar *"a casa foi paga no dia 12"* seria um número com
 * cara de autoridade sobre uma conta que não fecha.
 *
 * ⭐ Então o placar **só nasce acima de `COBERTURA_MINIMA`** (80% das UNIDADES vendidas com
 * custo conhecido — o limiar que o dono escolheu). Abaixo disso o cartão mostra **a
 * cobertura**, que é o trabalho a fazer, em vez de um dia inventado.
 *
 * ⚠️ Função PURA.
 */
import { caraDaReceita } from '@/lib/stock/producao/cara-da-receita'
import type { ProdutoComSobra, Sobras } from './sobra'

/** ⭐ o limiar do dono (07/10): abaixo disso o placar do dia D não nasce */
export const COBERTURA_MINIMA = 0.8

/**
 * ⚠️ Teto de tijolos DESENHADOS. Acima dele os pequenos viram UM tijolo "+N produtos" — e
 * ele **abre a lista**, nunca descarta. Com 54 produtos, 54 tijolos de 1px não são legíveis
 * em 390px, e o dono precisa ler a casa no celular.
 */
export const TIJOLOS_VISIVEIS = 8

export interface Tijolo {
  chave: string
  nome: string
  familia: string
  icone: string
  sobraTotal: number
  unidades: number
  /** fração da CASA que este tijolo pagou (sobra ÷ custo fixo do período) */
  pctDaCasa: number | null
  /** fração da SOBRA do período — usada pra a ÁREA quando não há custo fixo */
  pctDaSobra: number
  /** 👑 no maior contribuinte */
  rei: boolean
  /** ⭐ o tijolo agrupado: os pequenos que não cabem no desenho */
  agrupado: { quantos: number; itens: { chave: string; nome: string; sobraTotal: number }[] } | null
}

/**
 * ⭐⭐⭐ O CUSTO DOS COMPLEMENTOS — e ele VIRA O VEREDITO DA CASA (medido 07/10).
 *
 * ```
 * pizzas: receita R$ 194.415,00
 *   custo da BASE (o que o hub contava)   R$ 30.410,02  → margem 84%
 *   + custo dos COMPLEMENTOS              R$ 35.700,53
 *   ⛔ custo REAL                         R$ 66.110,55  → margem 66%   (−18,4 pontos)
 * ```
 *
 * ⛔⛔ **A baixa do complemento JÁ ACONTECE no ledger** (a porção de calabresa sai do estoque
 * a cada ocorrência); **só a MARGEM o ignorava**, porque o custo do sabor não pertence à
 * ficha de nenhum produto do cardápio. Sem ele a casa dizia *"✓ paga, transbordou
 * R$ 26.823,28"* quando a verdade é **95%, faltam R$ 8.877,25**.
 *
 * ⛔⛔ **E ELE NÃO É ATRIBUÍDO A TIJOLO NENHUM, de propósito.** O relatório de complementos
 * **não diz a qual produto cada ocorrência pertenceu** (medido: a tabela não tem campo de
 * tamanho nem de produto-pai). Ratear por receita *inventaria* a atribuição — e é a mesma
 * recusa do fator por tamanho. Então ele entra como **LINHA PRÓPRIA, nomeada**, abatendo a
 * sobra da CASA sem mexer na área de tijolo nenhum.
 *
 * ⭐ Isso preserva o guard do dono: **Σ(tijolos) == sobra BRUTA == Σ da aba "encheu o
 * caixa"**; o que a casa usa pra decidir "pagou" é a **sobra LÍQUIDA**.
 *
 * ⚠️ E o número é um **PISO**: 4.534 das 11.735 ocorrências ainda não têm ficha, então o
 * custo real dos complementos é MAIOR. A tela diz isso.
 */
export interface CustoDosComplementos {
  custo: number
  ocorrenciasComCusto: number
  /** ⚠️ as que ainda não têm ficha — fazem do `custo` um PISO, não um total */
  ocorrenciasSemCusto: number
}

export interface Casa {
  /** a composição do custo fixo que a tela DIZ — nunca um total mudo */
  composicao: { casa: boolean; banco: boolean; compromissos: boolean; texto: string }
  /** o custo fixo do período. `null` = o dono ainda não declarou o plano → casa "a apurar" */
  custoFixo: number | null
  custoFixoDiario: number | null
  dias: number
  /** Σ dos tijolos — a sobra BRUTA dos produtos (é esta que o guard do dono confere) */
  sobraTotal: number
  /** ⭐ o custo de complemento do período, NOMEADO e não atribuído a tijolo nenhum */
  complementos: CustoDosComplementos
  /** ⭐⭐ sobra BRUTA − complementos — **é esta que decide se a casa pagou** */
  sobraLiquida: number
  /** sobra ÷ custo fixo, limitado a 1 pro DESENHO (o transbordo aparece à parte) */
  pctPago: number | null
  /** quanto a sobra passou do telhado — só quando pagou */
  transbordo: number | null
  /** quanto falta pra fechar o telhado — só quando em obra */
  falta: number | null
  tijolos: Tijolo[]
  fora: Sobras['fora']
  cobertura: Sobras['cobertura']
  /**
   * ⭐ O PLACAR, gateado. `dia` = 1º dia em que a sobra ACUMULADA do período ≥ custo fixo.
   * `porque` explica a ausência — *"a tela diz a cobertura em vez de um dia inventado"*.
   */
  placar: { dia: string | null; porque: string | null }
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** ⚠️ a composição vira FRASE aqui, num lugar só — três telas escrevendo à mão divergiriam */
export function textoDaComposicao(c: { casa: boolean; banco: boolean; compromissos: boolean }): string {
  const p = [c.casa && 'casa', c.banco && 'banco', c.compromissos && 'compromissos'].filter(Boolean) as string[]
  if (p.length === 0) return 'nenhuma prateleira ligada'
  if (p.length === 1) return p[0]
  return `${p.slice(0, -1).join(' + ')} + ${p[p.length - 1]}`
}

/**
 * ⭐ A ÁREA DO TIJOLO É PROPORCIONAL À CONTRIBUIÇÃO — e o denominador é o CUSTO FIXO quando
 * ele existe (é a casa que está sendo paga), caindo pra a própria sobra quando o dono ainda
 * não declarou o plano. ⛔ Sem esse fallback a casa inteira ficaria invisível em mês sem
 * plano, justamente quando o dono abre a tela pra entender por que não sabe o número.
 */
export function montarCasa(opts: {
  sobras: Sobras
  custoFixo: number | null
  dias: number
  composicao: { casa: boolean; banco: boolean; compromissos: boolean }
  /** ⭐ o custo de complemento do período — abate a casa, não o tijolo */
  complementos: CustoDosComplementos
  /** sobra acumulada por dia (ordenada) — alimenta o placar do dia D */
  acumuladoPorDia?: readonly { dia: string; acumulado: number }[]
}): Casa {
  const { sobras, custoFixo, dias, composicao, complementos } = opts
  const sobraTotal = sobras.sobraTotal
  // ⭐⭐ é a LÍQUIDA que decide "pagou" — a bruta segue sendo a Σ dos tijolos (o guard)
  const sobraLiquida = round2(sobraTotal - complementos.custo)

  const denominador = custoFixo != null && custoFixo > 0 ? custoFixo : sobraTotal
  const pctPago = custoFixo != null && custoFixo > 0 ? Math.min(1, sobraLiquida / custoFixo) : null
  const pagou = custoFixo != null && custoFixo > 0 && sobraLiquida >= custoFixo

  // ─────────── os tijolos: os grandes desenhados, os pequenos agrupados ───────────
  const dentro = sobras.dentro
  const visiveis = dentro.slice(0, TIJOLOS_VISIVEIS)
  const resto = dentro.slice(TIJOLOS_VISIVEIS)

  const tijolo = (p: ProdutoComSobra, rei: boolean): Tijolo => {
    const cara = caraDaReceita(p.nome)
    return {
      chave: p.chave,
      nome: p.nome,
      familia: cara.familia,
      icone: cara.icone,
      sobraTotal: p.sobraTotal,
      unidades: p.unidades,
      pctDaCasa: custoFixo != null && custoFixo > 0 ? p.sobraTotal / custoFixo : null,
      pctDaSobra: denominador > 0 ? p.sobraTotal / denominador : 0,
      rei,
      agrupado: null,
    }
  }

  const tijolos: Tijolo[] = visiveis.map((p, i) => tijolo(p, i === 0))

  if (resto.length > 0) {
    const soma = round2(resto.reduce((s, p) => s + p.sobraTotal, 0))
    tijolos.push({
      chave: `agrupado:${resto.length}`,
      nome: `+${resto.length} produto${resto.length > 1 ? 's' : ''}`,
      familia: 'cinza',
      icone: 'generico',
      sobraTotal: soma,
      unidades: resto.reduce((s, p) => s + p.unidades, 0),
      pctDaCasa: custoFixo != null && custoFixo > 0 ? soma / custoFixo : null,
      pctDaSobra: denominador > 0 ? soma / denominador : 0,
      rei: false,
      agrupado: {
        quantos: resto.length,
        itens: resto.map((p) => ({ chave: p.chave, nome: p.nome, sobraTotal: p.sobraTotal })),
      },
    })
  }

  // ─────────── o placar, gateado pela cobertura ───────────
  const cob = sobras.cobertura.pct
  let placar: Casa['placar']
  if (custoFixo == null || custoFixo <= 0) {
    placar = { dia: null, porque: 'declare o plano dos custos fixos pra eu saber o tamanho da casa' }
  } else if (cob == null) {
    placar = { dia: null, porque: 'nenhuma venda no período' }
  } else if (cob < COBERTURA_MINIMA) {
    placar = {
      dia: null,
      porque: `só ${(cob * 100).toFixed(0)}% do que você vendeu tem custo conhecido — acima de ${(COBERTURA_MINIMA * 100).toFixed(0)}% eu digo o dia em que a casa se pagou`,
    }
  } else {
    const ac = opts.acumuladoPorDia ?? []
    const achou = ac.find((d) => d.acumulado >= custoFixo)
    placar = achou
      ? { dia: achou.dia, porque: null }
      : { dia: null, porque: 'a sobra do período ainda não cobriu a casa' }
  }

  return {
    composicao: { ...composicao, texto: textoDaComposicao(composicao) },
    custoFixo,
    custoFixoDiario: custoFixo != null && dias > 0 ? round2(custoFixo / dias) : null,
    dias,
    sobraTotal,
    complementos,
    sobraLiquida,
    pctPago,
    transbordo: pagou ? round2(sobraLiquida - (custoFixo as number)) : null,
    falta: custoFixo != null && custoFixo > 0 && !pagou ? round2(custoFixo - sobraLiquida) : null,
    tijolos,
    fora: sobras.fora,
    cobertura: sobras.cobertura,
    placar,
  }
}
