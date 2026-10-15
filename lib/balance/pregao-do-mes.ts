/**
 * ⭐⭐⭐ O PREGÃO DO MÊS — o módulo 3 da mesa (15/10/2026).
 *
 * **O que ele responde:** *"a casa do mês está paga?"* — a barra enchendo até a bandeirinha, e
 * as três frases que o dono ditou: ontem (a linha de chegada), o que falta pra pagar a casa de
 * HOJE, e os empréstimos do mês.
 *
 * ⛔⛔⛔ **A REGRA DE OURO DO DONO — "o pregão == o placar AO CENTAVO" — É GARANTIDA POR
 * CONSTRUÇÃO, NÃO POR PROMESSA.** Este módulo **não calcula um único número de dinheiro**: ele
 * recebe a `Casa` e a `Cascata` que a tela de *Quem paga a casa* já desenha e **LÊ os campos**.
 * ⚠️ Uma soma própria aqui — ainda que "igualzinha" — seria a **2ª derivação** do mesmo fato, e
 * as duas divergiriam na primeira borda (cobertura, complemento, plano ausente). O dono teria
 * dois números pra mesma pergunta em duas telas, que é a doença que esta casa mais paga.
 *
 * ⛔ **MÓDULO PURO, ZERO BANCO, ZERO ARITMÉTICA DE DINHEIRO.** O que ele faz é **traduzir**:
 * escolher o estado da barra, montar as frases e dizer quanto falta — sempre a partir de campos
 * que outra lib assinou.
 *
 * ⚠️ **E ele herda o "a apurar" das duas pontas.** Sem plano declarado (`custoFixo: null`) ou
 * sem venda medida, o pregão **não inventa 0%**: ele diz que falta declarar. `0 ÷ casa` daria
 * *"a casa se paga sozinha"*, que é a pior mentira possível neste módulo (a lição de 06/10).
 */
import type { Casa } from '@/lib/margem/casa'
import type { Cascata } from '@/lib/margem/cascata'
import type { LinhaDeChegada } from '@/lib/margem/dia'
import { MIN_AMOSTRAS_DO_DIA, type MediaDoDiaDaSemana } from '@/lib/vendas/dia-a-dia'

const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const
const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface BarraDoPregao {
  /**
   * fração 0..1 do trecho **até a bandeirinha** — ⭐ é o `pctPago` da `Casa`, já clampado lá.
   * ⛔ A tela NÃO clampa de novo: dois clamps são duas réguas, e foi um clamp na tela que
   * estourou a pilha de tijolos em 07/10.
   */
  pago: number
  /** fração 0..1 do trecho DEPOIS da bandeirinha — `0` quando a casa ainda está em obra */
  transbordo: number
  /** o rótulo do transbordo (*"+31%"*); `null` em obra */
  rotuloTransbordo: string | null
  /** ⭐ `true` quando a casa está paga — é o que acende a 🏁 e a cor verde */
  bandeira: boolean
}

export interface PregaoDoMes {
  /** o título com o período, vindo do dono único do rótulo (`janela.rotuloCurto`) */
  titulo: string
  /** `null` quando não há o que desenhar (plano ou venda a apurar) */
  barra: BarraDoPregao | null
  /** o número grande: o que a casa já cobriu — ou a frase do "a apurar" */
  valor: string
  /** o veredito, herdado da `Casa` — com a ressalva da cobertura quando houver */
  veredito: { rotulo: string; ressalva: string | null; tom: 'VERDE' | 'INDIGO' | 'NEUTRO' }
  /** ⭐ as TRÊS frases que o dono pediu, na ordem dele */
  legenda: string[]
}

export interface PregaoInput {
  /** o rótulo curto do período (*"outubro"*) — ⚠️ do dono único, nunca montado aqui */
  rotuloDoPeriodo: string
  casa: Casa
  cascata: Cascata
  /** a linha de chegada de ONTEM (o cartão 1 da margem) */
  ontem: LinhaDeChegada
  /** a média por dia-da-semana do dono único em `lib/vendas/dia-a-dia.ts` */
  medias: MediaDoDiaDaSemana[]
  /** YYYY-MM-DD do dia do BRASIL — decidido pela ROTA */
  hoje: string
  /** 0 = domingo … 6 = sábado, do dia do Brasil — também da ROTA */
  dowDeHoje: number
  /** Σ das parcelas/compromissos agendados do mês (do dono único de compromissos) */
  emprestimosDoMes: { total: number; quantos: number }
}

export function montarPregao(i: PregaoInput): PregaoDoMes {
  const { casa, cascata } = i

  /**
   * ⭐ A BARRA SÓ EXISTE QUANDO AS DUAS PONTAS SÃO CONHECIDAS. Desenhar 0% sem plano
   * afirmaria que nada foi pago de uma casa que não tem valor declarado.
   */
  const barra: BarraDoPregao | null =
    casa.pctPago == null || casa.custoFixo == null
      ? null
      : (() => {
          const pago = casa.pctPago as number
          /**
           * ⭐⭐ O TRANSBORDO É FRAÇÃO DO MESMO COMPRIMENTO, pra os dois pedaços SOMAREM 1.
           * ⚠️ `transbordo` da `Casa` vem em REAIS; a fração é dele sobre o total desenhado
           * (casa + transbordo) — e é isso que faz a barra não estourar o telhado.
           */
          const extra = casa.transbordo ?? 0
          const total = (casa.custoFixo as number) + extra
          const fracaoTransbordo = total > 0 ? round2(extra / total) : 0
          return {
            pago: total > 0 ? round2((casa.custoFixo as number) / total) * pago : pago,
            transbordo: fracaoTransbordo,
            rotuloTransbordo:
              extra > 0 && (casa.custoFixo as number) > 0
                ? `+${Math.round((extra / (casa.custoFixo as number)) * 100)}%`
                : null,
            bandeira: casa.veredito.estado === 'PAGA',
          }
        })()

  return {
    titulo: `O pregão de ${i.rotuloDoPeriodo}`,
    barra,
    /**
     * ⭐ O NÚMERO GRANDE É A SOBRA LÍQUIDA — **o mesmo campo que o 1º cartão da cascata
     * mostra**, que é o que faz o pregão e o placar baterem ao centavo.
     */
    valor:
      casa.custoFixo == null
        ? 'a apurar'
        : brl(casa.sobraLiquida),
    veredito: {
      /**
       * ⭐⭐ O RÓTULO É O DO **HERÓI DA CASCATA** — literalmente a MESMA string que o placar
       * desenha (*"✓ CASA PAGA — e sobrou"* / *"FALTAM"*). ⛔ Escrever a frase aqui a partir
       * do `estado` seria a 2ª redação do mesmo veredito, e no dia em que o dono mudar a
       * palavra numa tela a outra ficaria atrás — dizendo a mesma coisa com outro nome.
       */
      rotulo: cascata.heroi.rotulo,
      ressalva: casa.veredito.ressalva,
      tom:
        casa.veredito.estado === 'PAGA'
          ? 'VERDE'
          : casa.veredito.estado === 'EM_OBRA'
            ? 'INDIGO'
            : 'NEUTRO',
    },
    legenda: [fraseDeOntem(i.ontem), fraseDaCasaDeHoje(i), fraseDosEmprestimos(i)],
  }
}

/**
 * ⭐ FRASE 1 — ONTEM: a manchete que a linha de chegada já escreve.
 *
 * ⛔ A frase vem **inteira** do `LinhaDeChegada.frase`, nunca remontada aqui. Quem parte a
 * manchete em prefixo+destaque é quem a escreve (a régua de 07/10) — recortar string na mesa
 * seria a 2ª régua da própria frase.
 */
export function fraseDeOntem(ontem: LinhaDeChegada): string {
  if (ontem.dia == null) return 'nenhum dia com venda medida no período ainda'
  return ontem.frase
}

/**
 * ⭐⭐ FRASE 2 — A CASA DE HOJE: *"pra pagar a casa de HOJE faltam X · média de <dia> vende Y"*.
 *
 * ⚠️ Os dois números vêm de donos DIFERENTES e nenhum é calculado aqui: o `casaDoDia` é da
 * `LinhaDeChegada` (custo fixo de UM dia aberto) e a média é do `mediaPorDiaDaSemana`.
 *
 * ⛔⛔ **DIA SEM MÉDIA → "a apurar", nunca um número.** E o corte é o `MIN_AMOSTRAS_DO_DIA` da
 * casa (2): projeção de uma amostra sai **plausível**, que é o pior tipo de erro.
 */
export function fraseDaCasaDeHoje(i: PregaoInput): string {
  const casaDoDia = i.ontem.casaDoDia
  const m = i.medias.find((x) => x.dow === i.dowDeHoje)
  const media =
    m != null && m.media != null && m.amostras >= MIN_AMOSTRAS_DO_DIA ? m.media : null
  const nomeDoDia = DOW[i.dowDeHoje]

  if (casaDoDia == null) {
    return 'pra pagar a casa de hoje: a apurar — declare o plano do custo fixo'
  }
  if (media == null) {
    return `pra pagar a casa de HOJE faltam ${brl(casaDoDia)} · média de ${nomeDoDia}: a apurar`
  }
  return `pra pagar a casa de HOJE faltam ${brl(casaDoDia)} · média de ${nomeDoDia} vende ${brl(media)}`
}

/**
 * ⭐ FRASE 3 — OS EMPRÉSTIMOS DO MÊS, do dono único dos compromissos.
 *
 * ⚠️ Zero compromisso **não some**: a linha diz *"nenhum compromisso agendado"*. Frase que
 * desaparece faz o dono se perguntar se o sistema olhou — e ele não tem como saber.
 */
export function fraseDosEmprestimos(i: PregaoInput): string {
  const { total, quantos } = i.emprestimosDoMes
  if (quantos === 0) return 'empréstimos do mês: nenhum compromisso agendado'
  return `empréstimos do mês: ${brl(total)} em ${quantos} parcela(s)`
}
