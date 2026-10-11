/**
 * ⭐⭐⭐ A TABELA AO VIVO DA PERGUNTA ÚNICA — *"quantas unidades produzir?"* (11/10/2026).
 *
 * **Pedido do dono (item 2):** campo grande + **tabela recalculando a cada dígito**: INSUMO ·
 * VAI TIRAR (ficha × número) · NA PRATELEIRA (saldo atual) · veredito curto (*"dá ✓"* / *"faltam
 * X"*). *"Falta NÃO bloqueia — a tela só mostra ANTES o que hoje só se descobria depois."*
 *
 * ═══ ⛔⛔ A RÉGUA MORA AQUI, NÃO NO JSX ═══
 *
 * Este projeto roda em `environment: node`, **sem jsdom**: regra que vive dentro de um
 * `onChange` é regra que ninguém prova. Foi assim que o prefill do cardápio quebrou **duas
 * vezes** (28/08) e que o `querFazer` desta mesma página passou meses recalculando a separação
 * sem gravar nada. A tela desenha o que esta função devolve.
 *
 * ═══ ⛔⛔ E "VAI TIRAR" SAI DA PORTA DA SEPARAÇÃO, NUNCA DE UMA CONTA DAQUI ═══
 *
 * Quem multiplica dose × pedido é `listaDoQueVaiSeparar` → `insumoDoPedido`, a MESMA porta que
 * a ordem usa pra pré-preencher o que sai da câmara. Escrever `dose * pedido / loteBase` aqui
 * faria a tela prometer um material e a ordem separar outro — e o dono descobriria **com a carne
 * na mão**. É a lição dos 7 detectores de par aplicada a uma multiplicação.
 */
import { listaDoQueVaiSeparar, type ComponenteParaSeparar, type LinhaDoQueSai } from './lista-da-separacao'
import { fmtPedido } from './pedido-na-tela'

export interface LinhaDaPergunta extends LinhaDoQueSai {
  /** quanto FALTA na prateleira pra cobrir o que vai sair — `null` quando dá, ou sem saldo conhecido */
  faltam: number | null
}

export interface TabelaDaPergunta {
  linhas: LinhaDaPergunta[]
  /** quantos componentes não são cobertos pelo saldo */
  faltando: number
  /** Σ do custo do que vai sair — `null` quando algum componente não tem custo médio */
  custoTotal: number | null
  /** quantos componentes estão sem custo médio (a tela DIZ o número, nunca soma só os que têm) */
  semCusto: number
  /**
   * ⚠️ `true` quando o número digitado ainda não dá pra calcular nada (vazio, zero, lixo). A
   * tela mostra a tabela **apagada**, não uma tabela de zeros: zero é uma afirmação, e dizer
   * *"vai tirar 0 KG"* antes de o dono digitar é a mesma mentira do *"pedido 0"*.
   */
  semNumero: boolean
}

/**
 * PURA. A tabela da pergunta pro número que está no campo AGORA.
 *
 * @param pedido  o número digitado (já convertido); `null`/0/negativo → `semNumero`
 * @param loteBase quantas unidades 1 execução da receita produz
 */
export function tabelaDaPergunta(
  componentes: ComponenteParaSeparar[],
  pedido: number | null,
  loteBase: number,
): TabelaDaPergunta {
  const semNumero = pedido == null || !(pedido > 0)
  const base = listaDoQueVaiSeparar(componentes, semNumero ? 0 : pedido, loteBase)
  const linhas: LinhaDaPergunta[] = base.linhas.map((l) => ({
    ...l,
    /**
     * ⚠️ `faltam` só existe quando o saldo é CONHECIDO e a quantidade dá pra calcular — a
     * mesma trava do `falta` da porta: *pintar de vermelho por ausência de dado é a família do
     * "erro disfarçado de vazio"*, e o dono deixaria de produzir algo que talvez tenha.
     */
    faltam: l.falta && l.saldo != null && l.quantidade != null
      ? Math.round((l.quantidade - l.saldo + 1e-9) * 1e6) / 1e6
      : null,
  }))
  return {
    linhas,
    faltando: semNumero ? 0 : base.faltando,
    custoTotal: semNumero ? null : base.custoTotal,
    semCusto: base.semCusto,
    semNumero,
  }
}

/**
 * PURA. O rótulo do botão de confirmar — *"Confirmar pedido · 30 UN"*.
 *
 * ⭐ O número vai pelo **dono único** (`fmtPedido`), nunca por um `toFixed` daqui: a home, a
 * lista, o cabeçalho e este botão mostram o MESMO pedido. Quatro arredondamentos divergiriam, e
 * o dono leria "85" num lugar e "84,8608" no outro **pro mesmo lote** (a cicatriz de 05/10).
 *
 * ⛔ Sem número, o rótulo **não finge** um: ele pede o número.
 */
export function rotuloDoConfirmar(pedido: number | null, unidade: string): string {
  const t = pedido != null && pedido > 0 ? fmtPedido(pedido, unidade) : null
  return t == null ? 'Diga quantas unidades' : `Confirmar pedido · ${t} ${unidade}`
}

/**
 * PURA. A frase do veredito de uma linha — curta, do jeito que o dono pediu.
 *
 * ⚠️ *"saldo desconhecido"* é estado PRÓPRIO: sem o saldo não dá pra dizer que dá **nem** que
 * falta, e inventar um dos dois é pior que admitir (a régua do *"sem contagem"* do estoque).
 */
export function vereditoDaLinha(l: LinhaDaPergunta): { texto: string; falta: boolean } {
  if (l.quantidade == null) return { texto: '—', falta: false }
  if (l.saldo == null) return { texto: 'saldo a apurar', falta: false }
  if (l.faltam == null) return { texto: 'dá ✓', falta: false }
  const n = l.faltam.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return { texto: `faltam ${n} ${l.unidade}`, falta: true }
}
