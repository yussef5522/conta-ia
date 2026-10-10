/**
 * ⭐⭐ A COBERTURA E OS CARREGADORES — quem pagou a casa, e sobre quanto do dado (v3.1).
 *
 * ⛔⛔⛔ ZERO CONTA NOVA — e isto é o coração do arquivo: ele **TRADUZ a `Casa`**, não recalcula
 * nada. `sobraLiquida`, `custoFixo`, `cobertura` e o `veredito` já vêm decididos por
 * `montarCasa`. Uma régua própria aqui faria dois lugares discordarem do mesmo mês — a doença
 * que este módulo mais paga.
 */
import { COBERTURA_MINIMA, type Casa } from './casa'
import { pctInteiroBR } from '@/lib/format/percentual'

/** ⚠️ pt-BR com VÍRGULA e sem casa — a régua de percentual do PROJETO, nunca um `toFixed` local */
const pct = (n: number) => pctInteiroBR(n)
const round2DoPlacar = (n: number) => Math.round(n * 100) / 100

/**
 * ⚠️⚠️ `montarPlacar` / `CartaoDoPlacar` / `BarraDaCasa` / `TomDoResultado` MORRERAM em
 * 10/10/2026 — a CASCATA de 5 cartões substituiu o placar de 3, por ordem escrita do dono
 * (*"é ele crescido"*). A régua vive em `lib/margem/cascata.ts`.
 *
 * ⛔ Eles foram APAGADOS, não deixados sem chamador: *enquanto o componente existe no arquivo,
 * alguém religa* (a lição do `GruposSugeridos` em 23/09) — e aí a tela voltaria a ter DUAS
 * apresentações do mesmo dinheiro. ⭐ As ressalvas que viviam na `sublinhaDaSobra` (cobertura,
 * abatimento dos complementos e o piso *"o CMV acima é o MÍNIMO"*) não se perderam: migraram
 * pro ⓘ da honestidade da cascata, onde há teste exigindo cada uma.
 */

/** ⭐ um pedaço da frase; `forte` é o que a referência põe em `<b>` */
export interface PedacoDaCobertura {
  texto: string
  forte?: boolean
}

const ddmmCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * ⭐⭐ A LINHA DA COBERTURA — *"cobertura: **55% das unidades vendidas têm custo** · 49 na obra
 * · 114 fora · acima de **80%** eu digo **o dia em que a casa se pagou**"*.
 *
 * ⛔⛔ ELA É O QUE IMPEDE O VEREDITO DE FICAR SECO. O cartão 3 pode dizer *"✓ casa paga"*; é
 * esta linha, no pé do MESMO cartão, que diz sobre QUANTO do dado aquilo foi medido. Montá-la
 * no JSX seria regra dentro de `value={...}` — *regra que mora na tela é regra que ninguém
 * prova* (a lição do prefill do cardápio, 28/08). Aqui ela é PURA e executada em teste.
 *
 * ⚠️ Cobertura `null` (período sem venda) **não vira 0%**: a frase diz que não há o que medir.
 * E o **meta vem da constante**, nunca digitado — número solto em tela vira a 2ª régua no dia
 * em que o dono mudar o limiar.
 */
export function linhaDaCobertura(casa: Casa): PedacoDaCobertura[] {
  const cob = casa.cobertura.pct
  const p: PedacoDaCobertura[] = [{ texto: 'cobertura: ' }]

  if (cob == null) {
    p.push({ texto: 'nenhuma venda no período', forte: true })
  } else {
    p.push({ texto: `${pct(cob)} das unidades vendidas têm custo`, forte: true })
    p.push({
      texto: ` · ${casa.cobertura.produtosDentro} na obra · ${casa.cobertura.produtosFora} fora`,
    })
  }

  p.push({ texto: ' · ' })

  if (casa.placar.dia) {
    p.push({ texto: `🏁 a casa se pagou no dia ${ddmmCurto(casa.placar.dia)}`, forte: true })
  } else if (cob == null || cob < COBERTURA_MINIMA) {
    // ⭐ a frase da referência, com o limiar da constante
    p.push({ texto: 'acima de ' })
    p.push({ texto: pct(COBERTURA_MINIMA), forte: true })
    p.push({ texto: ' eu digo ' })
    p.push({ texto: 'o dia em que a casa se pagou', forte: true })
  } else {
    // ⚠️ cobertura boa e ainda sem dia: o motivo é OUTRO (sem plano, ou a sobra não cobriu) —
    // repetir a frase do limiar aqui mandaria o dono atacar a fila de fichas pelo motivo errado
    p.push({ texto: casa.placar.porque ?? 'o dia em que a casa se pagou: a apurar' })
  }

  return p
}

/**
 * ⭐⭐ QUEM CARREGOU A CASA — a lista que substitui os tijolos.
 *
 * ⚠️ Ela é a MESMA fonte do desenho antigo (`casa.tijolos`), então o guard do dono
 * (`Σ(tijolos) == sobra BRUTA == Σ da aba`) continua valendo sem uma linha nova de conta.
 * O que muda é só quantos aparecem antes do "+N produtos".
 */
export const CARREGADORES_VISIVEIS = 6

export interface Carregador {
  chave: string
  nome: string
  familia: string
  icone: string
  sobraTotal: number
  unidades: number
  /** fração da CASA que este produto pagou — `null` sem plano declarado */
  pctDaCasa: number | null
  /** 0..1 pra a BARRA da linha: a fatia dele em relação ao MAIOR (o 👑 enche a barra) */
  pctDaBarra: number
  rei: boolean
}

export interface ListaDeCarregadores {
  visiveis: Carregador[]
  /** ⭐ os que ficam atrás do "+N produtos · ver todos" — a lista expande, nada some */
  resto: Carregador[]
  /**
   * ⭐ A LINHA DO AGREGADO — *"+ 44 produtos · 28% · ver todos ▾"*, com barra própria.
   *
   * ⛔ Ela nasce AQUI e não na tela porque somar o resto é **aritmética de dinheiro**, e a
   * tela não soma (o guard proíbe `.reduce` ali). `null` quando não há resto.
   */
  agregado: { quantos: number; sobraTotal: number; pctDaCasa: number | null; pctDaBarra: number } | null
  /** ⚠️ o rodapé âmbar: o que está FORA da obra e o que destrava a cobertura */
  rodape: { foraDaObra: number; saboresSemFicha: number; cobertura: number | null }
}

export function montarCarregadores(casa: Casa, saboresSemFicha: number): ListaDeCarregadores {
  // ⛔ o tijolo AGRUPADO não é um produto — ele é a CAIXA dos pequenos. Aqui a lista expande
  // de verdade, então os itens dele voltam a ser linhas e o agrupado deixa de existir.
  const planos: Carregador[] = []
  for (const t of casa.tijolos) {
    if (t.agrupado) {
      for (const i of t.agrupado.itens) {
        planos.push({
          chave: i.chave,
          nome: i.nome,
          familia: 'cinza',
          icone: 'generico',
          sobraTotal: i.sobraTotal,
          unidades: 0,
          pctDaCasa: casa.custoFixo && casa.custoFixo > 0 ? i.sobraTotal / casa.custoFixo : null,
          pctDaBarra: 0,
          rei: false,
        })
      }
      continue
    }
    planos.push({
      chave: t.chave,
      nome: t.nome,
      familia: t.familia,
      icone: t.icone,
      sobraTotal: t.sobraTotal,
      unidades: t.unidades,
      pctDaCasa: t.pctDaCasa,
      pctDaBarra: 0,
      rei: t.rei,
    })
  }

  planos.sort((a, b) => b.sobraTotal - a.sobraTotal)
  // ⚠️ a barra da linha é relativa ao MAIOR, não à casa: com a casa paga, metade das linhas
  // encostaria no fim da barra e a comparação entre produtos (que é a pergunta da lista)
  // sumiria. O "% da casa" continua escrito ao lado, em número.
  const maior = planos[0]?.sobraTotal ?? 0
  for (const p of planos) p.pctDaBarra = maior > 0 ? p.sobraTotal / maior : 0
  if (planos[0]) planos[0].rei = true

  const resto = planos.slice(CARREGADORES_VISIVEIS)
  const somaDoResto = resto.reduce((s, p) => s + p.sobraTotal, 0)

  return {
    visiveis: planos.slice(0, CARREGADORES_VISIVEIS),
    resto,
    agregado:
      resto.length === 0
        ? null
        : {
            quantos: resto.length,
            sobraTotal: round2DoPlacar(somaDoResto),
            pctDaCasa:
              casa.custoFixo && casa.custoFixo > 0 ? somaDoResto / casa.custoFixo : null,
            pctDaBarra: maior > 0 ? Math.min(1, somaDoResto / maior) : 0,
          },
    rodape: {
      foraDaObra: casa.fora.length,
      saboresSemFicha,
      cobertura: casa.cobertura.pct,
    },
  }
}
