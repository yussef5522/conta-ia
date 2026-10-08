/**
 * ⭐⭐⭐ O PLACAR DA CASA — 3 cartões e UMA barra (v2, 07/10/2026).
 *
 * ⛔⛔ POR QUE A CASA DE TIJOLOS SVG MORREU: o dono reprovou por ILEGIBILIDADE. E a prova em
 * prod já tinha mostrado o custo estrutural daquele desenho — com a sobra em **152% da casa**
 * a pilha estourava o telhado e os tijolos de cima se sobrepunham; o conserto manteve a área
 * proporcional, mas um desenho que precisa de 8 retângulos empilhados pra dizer *"a casa se
 * pagou e sobrou"* está respondendo a pergunta de forma caríssima. **Três números e uma barra
 * dizem o mesmo em um olhar.**
 *
 * ⛔⛔⛔ ZERO CONTA NOVA — e isto é o coração do arquivo: ele **TRADUZ a `Casa`**, não recalcula
 * nada. `sobraLiquida`, `custoFixo`, `transbordo`, `falta`, `pctPago` e o `veredito` já vêm
 * decididos por `montarCasa`. Uma régua própria aqui faria o placar e a conta aberta logo
 * abaixo discordarem do mesmo mês — a doença que este módulo mais paga.
 *
 * ⭐ A CONTA DO PLACAR FECHA NA TELA, de propósito: `cartão 1 − cartão 2 = cartão 3`. É por
 * isso que o 1º cartão mostra a sobra **LÍQUIDA** (já abatidos os complementos) e DIZ o
 * abatimento na sublinha — mostrar a bruta faria os três cartões não somarem, e *número sem
 * régua em tela de dinheiro é pior que ausência*.
 */
import type { Casa } from './casa'

export type TomDoResultado = 'PAGOU' | 'EM_OBRA' | 'A_APURAR'

export interface CartaoDoPlacar {
  rotulo: string
  /** `null` = **a apurar**. ⛔ Nunca 0,00 — ausência de plano não é casa de graça. */
  valor: number | null
  /** a frase que acompanha o número — nunca um total mudo */
  sublinha: string
}

export interface BarraDaCasa {
  /** 0..1 — o pedaço índigo, o que foi pago da casa */
  pago: number
  /** 0..1 do comprimento TOTAL da barra — o verde depois da bandeira */
  transbordo: number
  /** ⭐ o rótulo do verde: "+37%" — só quando houve transbordo */
  rotuloTransbordo: string | null
  /** ⭐ o rótulo do índigo quando a casa NÃO fechou: "68% da casa" */
  rotuloParcial: string | null
  /** 🏁 a bandeira aparece no fim do índigo quando a casa fechou */
  bandeira: boolean
}

export interface Placar {
  sobra: CartaoDoPlacar
  casa: CartaoDoPlacar
  resultado: CartaoDoPlacar & { tom: TomDoResultado; ressalva: string | null }
  barra: BarraDaCasa | null
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⚠️ A SUBLINHA DA SOBRA CARREGA AS DUAS RESSALVAS, porque as duas mudam o significado do
 * número: **quanto das vendas foi medido** (a cobertura) e **o que já foi abatido** (o custo
 * dos complementos, que é o achado de 07/10 — R$ 9.255,55 em 7 dias que estavam fora da
 * margem de todo produto).
 */
function sublinhaDaSobra(casa: Casa): string {
  const p: string[] = []
  const cob = casa.cobertura.pct
  // ⛔ cobertura `null` (período sem venda) não vira "0% das vendas" — ausência não é zero
  if (cob != null) p.push(`sobra medida em ${pct(cob)} das vendas`)
  if (casa.complementos.custo > 0) {
    p.push(`já descontados ${brl(casa.complementos.custo)} de complementos`)
  }
  if (p.length === 0) return 'nenhuma venda com custo conhecido no período'
  return p.join(' · ')
}

export function montarPlacar(casa: Casa): Placar {
  const temPlano = casa.custoFixo != null && casa.custoFixo > 0

  const sobra: CartaoDoPlacar = {
    rotulo: 'o que as vendas deixaram',
    valor: casa.sobraLiquida,
    sublinha: sublinhaDaSobra(casa),
  }

  const cartaoCasa: CartaoDoPlacar = {
    rotulo: 'a casa custou',
    valor: casa.custoFixo,
    // ⚠️ a composição dos chips vai na sublinha SEMPRE: o mesmo mês custa números diferentes
    // conforme o dono liga casa/banco/compromissos, e um total mudo aqui seria indefensável
    sublinha: temPlano
      ? `${casa.composicao.texto} · ${casa.dias} dia${casa.dias > 1 ? 's' : ''}`
      : 'declare o que cada custo fixo deve custar pra eu dizer o resultado',
  }

  /**
   * ⛔⛔ O RESULTADO HERDA A RESSALVA DO VEREDITO — o guard de v1 que não pode cair.
   * Com cobertura abaixo do mínimo, a tela é PROIBIDA de mostrar um "✓ CASA PAGA" seco:
   * a certeza seria sobre a metade do dado que dá pra medir.
   */
  const resultado: Placar['resultado'] = temPlano
    ? casa.veredito.estado === 'PAGA'
      ? {
          rotulo: 'resultado',
          valor: casa.transbordo,
          tom: 'PAGOU',
          sublinha: '✓ casa paga — daqui pra frente é lucro',
          ressalva: casa.veredito.ressalva,
        }
      : {
          rotulo: 'resultado',
          valor: casa.falta,
          tom: 'EM_OBRA',
          sublinha: 'ainda falta pra pagar a casa',
          ressalva: casa.veredito.ressalva,
        }
    : {
        rotulo: 'resultado',
        valor: null,
        tom: 'A_APURAR',
        sublinha: 'sem o plano do mês não dá pra dizer se a casa se pagou',
        ressalva: casa.veredito.ressalva,
      }

  /**
   * ⭐ A BARRA: índigo até a bandeira (100% da casa) e VERDE depois (o transbordo).
   *
   * ⚠️ Os dois pedaços são frações do comprimento TOTAL, então eles SOMAM 1 — sem isso a
   * tela teria que normalizar por conta própria, e aí nasceria a segunda régua do desenho
   * (foi exatamente assim que a pilha de tijolos estourou o telhado).
   */
  let barra: BarraDaCasa | null = null
  if (temPlano) {
    const real = casa.sobraLiquida / casa.custoFixo!
    if (real >= 1) {
      // ⚠️ o índigo é 1/real do total: com sobra de 152% da casa, a bandeira cai em 66% da
      // barra e o verde ocupa os 34% restantes — o excedente fica VISÍVEL sem clamp
      const pago = 1 / real
      barra = {
        pago,
        transbordo: 1 - pago,
        rotuloTransbordo: `+${Math.round((real - 1) * 100)}%`,
        rotuloParcial: null,
        bandeira: true,
      }
    } else {
      barra = {
        pago: Math.max(0, real),
        transbordo: 0,
        rotuloTransbordo: null,
        rotuloParcial: `${pct(Math.max(0, real))} da casa`,
        bandeira: false,
      }
    }
  }

  return { sobra, casa: cartaoCasa, resultado, barra }
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

  return {
    visiveis: planos.slice(0, CARREGADORES_VISIVEIS),
    resto: planos.slice(CARREGADORES_VISIVEIS),
    rodape: {
      foraDaObra: casa.fora.length,
      saboresSemFicha,
      cobertura: casa.cobertura.pct,
    },
  }
}
