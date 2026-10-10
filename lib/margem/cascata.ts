/**
 * ⭐⭐⭐ A CASCATA DO MÊS — VENDEU · − CMV · = SOBRA · − A CASA · = LUCRO (10/10/2026).
 *
 * **Pedido do dono:** *"A CASCATA substitui o placar atual (é ele crescido): 5 cartões em
 * linha"*, e *"ZERO conta nova: CMV por consumo = a MESMA soma de custos que já produz a
 * sobra"*.
 *
 * ⛔⛔⛔ **A CADEIA FECHA POR CONSTRUÇÃO, e é só isso que a torna defensável.** O truque é o
 * CMV ser DERIVADO da sobra que já existe, em vez de somado por fora:
 *
 * ```
 *   vendeu       = Σ (preço × unidades)       ← dos produtos COM custo conhecido
 *   cmvProdutos  = vendeu − sobraTotal        ← a MESMA soma de custos que produziu a sobra
 *   cmv          = cmvProdutos + complementos
 *   sobra        = sobraLiquida               ← ela é, por identidade, vendeu − cmv
 *   lucro        = sobraLiquida − custoFixo
 * ```
 *
 * ⚠️ **Por que o CMV é derivado e não somado:** `sobraUn` é `round2(preço_cru − custo_cru)`,
 * então `Σ round2(preço) − Σ round2(custo)` pode divergir da sobra **em centavos acumulados**.
 * Somar o custo por fora criaria uma cascata que não fecha com a sobra que a liga, a aba
 * "quem carregou" e o veredito já usam — e aí a tela mostraria dois números do mesmo mês.
 * **O resíduo de arredondamento vai pro número NOVO (o CMV), nunca pro que já está em prod.**
 * ⭐ E isso não é maquiagem: `receita − sobra` **é** o custo que a sobra usou, por definição.
 *
 * ⛔⛔ **E O COMPLEMENTO ENTRA NO CMV, não fora dele.** A porção de calabresa é insumo
 * consumido — ela sai do estoque a cada ocorrência (a baixa já acontece no ledger desde
 * 07/10). Até aqui ela abatia a sobra como *"linha nomeada"* porque não pertence à ficha de
 * nenhum produto do cardápio; na cascata o lugar honesto dela é o CMV, e a cadeia fecha igual.
 *
 * ⛔ **O CONJUNTO É O MESMO DO PLACAR** — as vendas com custo conhecido. Misturar as vendas
 * "fora da obra" no `vendeu` quebraria a cadeia na hora (elas não têm custo), e foi o dono
 * quem fixou isso: *"sobre o MESMO conjunto, pra cadeia nunca quebrar"*. As vendas TOTAIS
 * aparecem na linha de honestidade, com a cobertura ao lado.
 */
import { pctBR, pctInteiroBR } from '@/lib/format/percentual'
import type { Casa } from './casa'
import type { Sobras } from './sobra'

/** ⚠️ 2 centavos: o mesmo degrau `FECHA` da casa — ruído de arredondamento não é divergência */
const TOL = 0.02
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export type QualDaCascata = 'vendeu' | 'cmv' | 'sobra' | 'casa' | 'lucro'

export interface CartaoDaCascata {
  qual: QualDaCascata
  /** o operador que vem ANTES do cartão — `null` no primeiro */
  operador: '−' | '=' | null
  rotulo: string
  /** `null` = **a apurar**. ⛔ Nunca 0,00 — ausência de plano não é casa de graça */
  valor: number | null
  /** ≤5 palavras, a régua da dieta de texto */
  sub: string
  /**
   * ⭐ o % GIGANTE embaixo do valor — **só no CMV** (*"45,2% das vendas"*).
   * ⚠️ `pctBR`, com vírgula: ponto é o defeito que a dieta de ontem deixou visível.
   */
  pctDasVendas: string | null
}

/**
 * ⭐⭐ O LUCRO É O HERÓI, e ele tem DOIS estados — nunca "lucro negativo".
 *
 * ⛔ Lucro negativo disfarçado de lucro é a mentira mais cara desta tela: o dono leria
 * *"lucro −R$ 8.000"* como um número ruim num mês ruim, quando o que ele precisa ler é
 * **"FALTAM R$ 8.000"** — que é uma AÇÃO. Mesma régua do `FALTAM` do placar.
 */
export interface HeroiDoLucro {
  estado: 'LUCRO' | 'FALTAM' | 'A_APURAR'
  /** sempre POSITIVO (o módulo) — o `estado` diz o sinal */
  valor: number | null
  rotulo: string
}

/**
 * ⭐⭐ DE CADA R$ 100 VENDIDOS — e a Σ é 100% POR CONSTRUÇÃO quando há lucro.
 *
 * ⛔⛔ **Com lucro NEGATIVO não existe fatia verde, e a barra não pode fingir que existe.**
 * Ali `cmv + casa > vendeu`, então os dois pedaços são normalizados pelo TOTAL GASTO e o selo
 * coral diz quanto falta — inventar um verde de 0% deixaria a barra somando 100% com uma
 * terceira cor invisível, que é pior que dizer a verdade.
 */
export interface ComposicaoDeCem {
  cmv: number
  casa: number
  /** 0 quando o lucro é negativo — e aí `faltam` carrega o número */
  lucro: number
  /** ⭐ a legenda: os 3 percentuais, em pt-BR */
  legenda: { cmv: string; casa: string; lucro: string | null }
  /** ⚠️ `null` quando houve lucro; com prejuízo, o selo coral */
  faltam: string | null
}

export interface HonestidadeDaCascata {
  /** a linha de 1 linha */
  linha: string
  /** o que o ⓘ abre — consumo × compra lado a lado */
  explicacoes: { titulo: string; texto: string }[]
  /** ⭐ a régua do setor, miúda */
  reguaDoSetor: string
}

export interface Cascata {
  cartoes: CartaoDaCascata[]
  heroi: HeroiDoLucro
  composicao: ComposicaoDeCem | null
  honestidade: HonestidadeDaCascata
  /**
   * ⛔⛔ O GUARD NA PRÓPRIA SAÍDA: `vendeu − cmv == sobra` **e** `sobra − casa == lucro`.
   * A tela GRITA se for `false` — número de dinheiro que não fecha com as partes é a
   * família do cabeçalho que afirmava 69 duplicatas com a aba dizendo 0.
   */
  fecha: boolean
}

/** ⚠️ a faixa saudável do setor — o dono ditou; vive aqui pra a tela não digitar número */
export const CMV_SAUDAVEL = { de: 0.28, ate: 0.35 } as const

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⭐ A FAIXA DO SETOR, derivada da CONSTANTE — *"28–35%"*, com o `%` uma vez no fim.
 * ⛔ A tela e esta frase NUNCA digitam o número: ele vive em `CMV_SAUDAVEL` e há teste
 * exigindo isso (o `TETO = 25` hardcoded da Conciliação é a cicatriz).
 */
const faixaSaudavel = () =>
  `${Math.round(CMV_SAUDAVEL.de * 100)}–${pctInteiroBR(CMV_SAUDAVEL.ate)}`

/**
 * ⭐ A CASCATA, de uma função só.
 *
 * @param casa  o que `montarCasa` já decidiu (sobra bruta/líquida, complementos, custo fixo)
 * @param sobras  o conjunto medido — é dele que sai o `vendeu`
 * @param cmvPorCompra  o CMV das NOTAS no mesmo período (a comparação do ⓘ); `null` sem dado
 */
export function montarCascata(
  casa: Casa,
  sobras: Sobras,
  cmvPorCompra: number | null,
): Cascata {
  // ⭐ o VENDEU do conjunto medido — Σ(preço × unidades) dos produtos que têm custo
  const vendeu = round2(sobras.dentro.reduce((s, p) => s + p.preco * p.unidades, 0))
  /**
   * ⭐⭐ O CMV É **DERIVADO DA SOBRA**, não somado por fora — e a razão é de ACOPLAMENTO, não
   * de arredondamento.
   *
   * ⚠️⚠️ CORREÇÃO DE UMA PREMISSA MINHA, MEDIDA EM 10/10: eu havia escrito que somar os
   * custos por outro caminho divergiria *"por centavos acumulados, porque `sobraUn` usa
   * valores CRUS"*. **O dado refutou:** `sobrasDoPeriodo` já arredonda `custo` em 2 casas e
   * `sobraUn = preço − custoArredondado`, então `vendeu − sobraTotal` e `Σ custo × unidades`
   * dão **o MESMO número ao centavo** (medido com custo de 3 e 4 casas e 2.429 unidades: as
   * três formas alternativas fecham igual). *Evidência medida não se abandona por raciocínio
   * confortável — e aqui o raciocínio era meu.*
   *
   * ⭐ O que a derivação garante é que **a cadeia não depende da régua de arredondamento de
   * OUTRO arquivo**: no dia em que `sobra.ts` mudar a precisão do `custo`, a soma paralela
   * divergiria em silêncio e o `fecha` acusaria; a derivada continua fechando por construção.
   * ⛔ E o `fecha` morde nas causas REAIS (medido): o CMV esquecer os complementos, a sobra
   * virar a BRUTA, ou a casa entrar inflada no 2º elo dão **7 vermelhos** cada.
   */
  const cmvProdutos = round2(vendeu - casa.sobraTotal)
  const cmv = round2(cmvProdutos + casa.complementos.custo)
  const sobra = casa.sobraLiquida
  const temPlano = casa.custoFixo != null && casa.custoFixo > 0
  const custoFixo = temPlano ? casa.custoFixo! : null
  const lucro = custoFixo == null ? null : round2(sobra - custoFixo)

  // ⚠️ sem venda medida no período, o % do CMV é `null` — nunca "0,0% das vendas"
  const pctCmv = vendeu > 0 ? cmv / vendeu : null

  const cartoes: CartaoDaCascata[] = [
    {
      qual: 'vendeu',
      operador: null,
      rotulo: 'Vendeu',
      valor: vendeu > 0 ? vendeu : null,
      sub: 'o que o PDV registrou',
      pctDasVendas: null,
    },
    {
      qual: 'cmv',
      operador: '−',
      rotulo: 'CMV (insumos)',
      valor: vendeu > 0 ? cmv : null,
      sub: 'o que saiu da prateleira',
      pctDasVendas: pctCmv == null ? null : `${pctBR(pctCmv)} das vendas`,
    },
    {
      qual: 'sobra',
      operador: '=',
      rotulo: 'Sobra',
      valor: vendeu > 0 ? sobra : null,
      sub: 'vendeu menos o insumo',
      pctDasVendas: null,
    },
    {
      qual: 'casa',
      operador: '−',
      rotulo: 'A casa',
      valor: custoFixo,
      // ⚠️ a composição dos chips vai na sub: o mesmo mês custa números diferentes conforme
      // o dono liga casa/banco/compromissos, e um total mudo aqui seria indefensável
      sub: temPlano ? casa.composicao.texto : 'declare o plano do mês',
      pctDasVendas: null,
    },
    {
      qual: 'lucro',
      operador: '=',
      rotulo: lucro != null && lucro < 0 ? 'Faltam' : 'Lucro',
      valor: lucro == null ? null : Math.abs(lucro),
      sub:
        lucro == null
          ? 'depende do plano'
          : lucro < 0
            ? 'pra fechar o mês'
            : 'daqui pra frente é lucro',
      pctDasVendas: null,
    },
  ]

  const heroi: HeroiDoLucro =
    lucro == null
      ? { estado: 'A_APURAR', valor: null, rotulo: 'Lucro' }
      : lucro < 0
        ? { estado: 'FALTAM', valor: round2(-lucro), rotulo: 'Faltam' }
        : { estado: 'LUCRO', valor: lucro, rotulo: 'Lucro' }

  /**
   * ⭐⭐ A BARRA — e ela só existe com venda medida E plano declarado: sem um dos dois,
   * "de cada R$ 100" não tem como ser respondido, e uma barra pela metade é pior que nenhuma.
   */
  let composicao: ComposicaoDeCem | null = null
  if (vendeu > 0 && lucro != null) {
    if (lucro >= 0) {
      // ⭐ Σ = 1 por construção: vendeu = cmv + casa + lucro
      composicao = {
        cmv: cmv / vendeu,
        casa: custoFixo! / vendeu,
        lucro: lucro / vendeu,
        legenda: {
          cmv: `CMV ${pctBR(cmv / vendeu)}`,
          casa: `casa ${pctBR(custoFixo! / vendeu)}`,
          lucro: `lucro ${pctBR(lucro / vendeu)}`,
        },
        faltam: null,
      }
    } else {
      const gasto = cmv + custoFixo!
      composicao = {
        cmv: cmv / gasto,
        casa: custoFixo! / gasto,
        lucro: 0,
        legenda: {
          cmv: `CMV ${pctBR(cmv / vendeu)}`,
          casa: `casa ${pctBR(custoFixo! / vendeu)}`,
          // ⛔ sem verde: `null` e a tela não desenha legenda de lucro
          lucro: null,
        },
        faltam: `faltam ${brl(-lucro)} pra fechar`,
      }
    }
  }

  return {
    cartoes,
    heroi,
    composicao,
    honestidade: honestidadeDaCascata(casa, sobras, vendeu, cmv, cmvPorCompra),
    // ⛔ a cadeia, conferida na própria saída
    fecha:
      Math.abs(vendeu - cmv - sobra) <= TOL &&
      (lucro == null || Math.abs(sobra - custoFixo! - lucro) <= TOL),
  }
}

/**
 * ⭐⭐ A LINHA DE HONESTIDADE — *"medido em N% das vendas · vendas totais R$ X · CMV por
 * compra (notas): R$ Y — detalhes ⓘ"*.
 *
 * ⚠️ As **vendas TOTAIS** entram aqui de propósito: o `vendeu` da cascata é só o conjunto
 * medido, e sem este número o dono não tem como saber o tamanho do que ficou fora.
 */
function honestidadeDaCascata(
  casa: Casa,
  sobras: Sobras,
  vendeu: number,
  cmv: number,
  cmvPorCompra: number | null,
): HonestidadeDaCascata {
  const vendasTotais = round2(vendeu + sobras.fora.reduce((s, p) => s + p.vendasValor, 0))
  const cob = casa.cobertura.pct

  const partes: string[] = []
  // ⛔ cobertura `null` (período sem venda) não vira "0% das vendas"
  partes.push(cob == null ? 'nenhuma venda no período' : `medido em ${pctBR(cob)} das vendas`)
  if (vendasTotais > 0) partes.push(`vendas totais ${brl(vendasTotais)}`)
  partes.push(
    cmvPorCompra == null
      ? 'CMV por compra (notas): a apurar'
      : `CMV por compra (notas): ${brl(cmvPorCompra)}`,
  )

  const explicacoes: { titulo: string; texto: string }[] = [
    {
      titulo: 'CMV por CONSUMO (o desta cascata)',
      texto:
        `${brl(cmv)} — é a soma dos insumos que as vendas do período REALMENTE consumiram, ` +
        'pela mesma explosão de ficha que baixa o estoque. Ele não depende de quando a nota entrou.',
    },
    {
      titulo: 'CMV por COMPRA (as notas)',
      texto:
        cmvPorCompra == null
          ? 'nenhuma nota de custo classificada no período'
          : `${brl(cmvPorCompra)} — é o que ENTROU de nota no período. Ele sobe no mês da compra grande ` +
            'e cai no mês seguinte, mesmo vendendo igual; serve de conferência, não de régua de preço.',
    },
    {
      titulo: 'por que os dois diferem',
      texto:
        'comprar não é consumir: estoque que entrou e não saiu infla o CMV por compra, e o que ' +
        'saiu de um estoque comprado antes infla o por consumo. A cascata usa o CONSUMO porque é ' +
        'ele que acompanha a venda do período.',
    },
  ]

  if (casa.complementos.custo > 0) {
    explicacoes.push({
      titulo: 'os complementos estão dentro',
      texto:
        `${brl(casa.complementos.custo)} de sabor/adicional entram no CMV — eles saem do estoque a cada ` +
        (casa.complementos.ocorrenciasSemCusto > 0
          ? `ocorrência. ⚠️ ${casa.complementos.ocorrenciasSemCusto} ocorrências ainda sem ficha: o CMV acima é o MÍNIMO, não o total.`
          : 'ocorrência.'),
    })
  }

  return {
    linha: partes.join(' · '),
    explicacoes,
    reguaDoSetor: `pizzaria/lanchonete saudável: CMV ${faixaSaudavel()} das vendas`,
  }
}
