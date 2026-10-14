/**
 * ⭐⭐⭐ "NA MESA" — o dinheiro que o preço de hoje está deixando passar (14/10/2026).
 *
 * A pergunta do dono: *"se eu subisse pro ideal, quanto teria entrado no período?"* — e a
 * conta é a mais simples do cartão: **(ideal − hoje) × unidades vendidas**.
 *
 * ⛔⛔ **E A METADE MAIS IMPORTANTE É O QUE ELE NUNCA PODE DIZER.** Quando o preço de hoje JÁ
 * ganha do alvo, a diferença fica NEGATIVA — e imprimir *"entravam −R$ 800"* ou *"descendo
 * pro ideal"* seria o sistema **sugerindo baixar preço**, que é exatamente a ordem do dono ao
 * contrário (*"nunca parecer ordem de baixar"*). Ali o estado é VERDE, o valor é zero e o
 * conselho é **"segura o preço, não baixa"**. Um `Math.abs` ou um sinal solto na tela
 * reabririam esse flanco — por isso a decisão mora aqui, num `tom` fechado.
 *
 * ⛔ **ZERO CONTA NOVA.** `ideal` vem do `montarBlocoDoVeredito` (a porta única do veredito),
 * `preco` é a média real do PDV e `unidades` são as do período — os três chegam prontos. Este
 * arquivo multiplica e escreve a frase.
 *
 * ⚠️ **O NÚMERO REDONDO TEM DONO ÚNICO NO PROJETO** (`valorDoCartao`): a tela de margem já o
 * consome nos cartões, e o guard `margem-bate-com-a-referencia` cobra isso. Um `Intl` novo
 * aqui faria o mesmo R$ sair com duas caras na MESMA página.
 */
import { valorDoCartao, type ValorDoCartao } from '@/lib/custos-fixos/cartao-de-dono'
import { formatBRL } from '@/lib/format/money'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** o degrau de centavo que separa "é maior" de "é igual" — o mesmo do resto do veredito */
const CENTAVO = 0.005

export type TomDaMesa = 'ambar' | 'verde' | 'neutro'

export interface NaMesa {
  tom: TomDaMesa
  /** pronto pra tela */
  frase: string
  /** ⛔ no verde ele existe pra IMPEDIR a leitura errada: *"segura o preço, não baixa"* */
  conselho: string | null
  /** R$ que entrariam no período · `0` quando o preço já ganha · `null` = a apurar */
  valor: number | null
  /** o redondo pra frente e o centavo no tooltip — nunca dois formatos pro mesmo R$ */
  valorTexto: ValorDoCartao | null
  unidades: number
  /** o que falta pra dizer, pra a tela DIZER em vez de calar */
  porque: string | null
}

/**
 * ⭐⭐ O CÁLCULO — e os três estados são FECHADOS de propósito.
 *
 * ⚠️ `unidades <= 0` é "a apurar", nunca R$ 0,00: produto sem venda no período não deixou
 * dinheiro na mesa nem ganhou do alvo — **não há o que afirmar**, e zero ali se leria como
 * *"não tem nada a ganhar"* (a mesma régua do *"sem contagem"* do estoque).
 */
export function naMesa(opts: {
  /** o preço praticado hoje (média do PDV) · `null` = sem venda no período */
  preco: number | null
  /** o preço ideal no alvo ligado, do canal principal · `null` = sem ficha */
  ideal: number | null
  /** unidades vendidas no período */
  unidades: number
}): NaMesa {
  const base = { conselho: null, valor: null, valorTexto: null, unidades: opts.unidades }

  if (opts.ideal == null) {
    return { ...base, tom: 'neutro', frase: 'a apurar', porque: 'sem ficha não dá pra calcular o ideal' }
  }
  if (opts.preco == null || opts.preco <= 0) {
    return { ...base, tom: 'neutro', frase: 'a apurar', porque: 'sem venda no período não há preço de hoje pra comparar' }
  }
  if (opts.unidades <= 0) {
    return { ...base, tom: 'neutro', frase: 'a apurar', porque: 'nenhuma unidade vendida no período' }
  }

  const diferenca = opts.ideal - opts.preco

  /**
   * ⛔ O PREÇO DE HOJE JÁ GANHA DO ALVO. O valor é **zero**, não a diferença negativa — e o
   * conselho é o freio: sem ele, um cartão âmbar ao lado de um verde convidaria o dono a
   * "ajustar pro ideal" e ele **baixaria** um preço que está certo.
   */
  if (diferenca <= CENTAVO) {
    return {
      ...base,
      tom: 'verde',
      frase: 'nada — teu preço já ganha desse alvo',
      conselho: 'segura o preço, não baixa.',
      valor: 0,
      valorTexto: valorDoCartao(0),
      porque: null,
    }
  }

  const valor = round2(diferenca * opts.unidades)
  const texto = valorDoCartao(valor)
  return {
    tom: 'ambar',
    frase: `subindo pro ideal, entravam +${texto?.curto ?? formatBRL(valor)} no período`,
    conselho: null,
    valor,
    valorTexto: texto,
    unidades: opts.unidades,
    porque: null,
  }
}

export interface FatiaDosFixos {
  /** R$ por unidade · `null` = a apurar */
  porUnidade: number | null
  /** pronto pra tela, na letra miúda */
  frase: string
  porque: string | null
}

/**
 * ⭐ A FATIA DOS FIXOS — *"cada unidade ainda precisa deixar ~R$ X pros fixos"*.
 *
 * `custo fixo do período ÷ unidades vendidas no período`. As duas pontas vêm das portas que
 * as telas já usam: o custo fixo do **placar da casa** (`casa.custoFixo`) e as unidades da
 * **liga** (`cobertura.unidadesDentro + unidadesFora`).
 *
 * ⚠️⚠️ **AS UNIDADES SÃO AS TOTAIS, NÃO SÓ AS "DENTRO DA OBRA" — e isso é escolha medida.** A
 * cobertura da casa hoje é ~55% (produto sem ficha fica fora do cálculo de sobra), então
 * dividir o custo fixo só pelas unidades COM custo conhecido quase **DOBRARIA** a fatia: a
 * tela cobraria de cada unidade a parte dos fixos que as outras também pagam. A venda que
 * não tem custo fechado **continua pagando aluguel**.
 *
 * ⛔ **E AQUI O R$ VAI COM CENTAVOS**, ao contrário dos cartões do topo: a fatia é da ordem
 * de poucos reais (ou centavos), e o redondo transformaria `R$ 3,52` em `R$ 4` — um erro de
 * 14% no número que o dono usa pra decidir preço. Redondo é régua de MILHAR.
 */
export function fatiaDosFixos(custoFixo: number | null, unidades: number): FatiaDosFixos {
  if (custoFixo == null || custoFixo <= 0) {
    return {
      porUnidade: null,
      frase: 'cada unidade ainda precisa deixar pros fixos — a apurar',
      porque: 'o custo fixo do período não está declarado',
    }
  }
  if (unidades <= 0) {
    return {
      porUnidade: null,
      frase: 'cada unidade ainda precisa deixar pros fixos — a apurar',
      porque: 'nenhuma unidade vendida no período',
    }
  }
  const porUnidade = round2(custoFixo / unidades)
  return {
    porUnidade,
    frase: `cada unidade ainda precisa deixar ~${formatBRL(porUnidade)} pros fixos`,
    porque: null,
  }
}
