/**
 * ⭐⭐ AS TRÊS LEITURAS NOVAS DO HISTÓRICO (06/10/2026) — resumo do período, a LINHA DO ZERO e
 * o saldo no tempo. **Puras, e todas DERIVADAS das linhas que a tabela já desenha.**
 *
 * ⛔⛔ **NENHUMA DELAS RECALCULA NADA.** O `saldoApos` de cada linha já desce do saldo de hoje
 * (11/09), e o `movePrateleira` já diz quem entra na conta (09/09). Somar o ledger de novo
 * aqui seria a 2ª derivação do mesmo número — e ela divergiria da coluna que o dono está
 * olhando, no primeiro tipo de movimento novo.
 *
 * ⭐ É isso que mantém de pé o guard que o dono mandou preservar: **Σ(linhas) == saldo**. Estas
 * funções leem as MESMAS linhas, então não existe como elas discordarem do rodapé.
 */
import type { LinhaDoHistorico } from '../movimento-explicado'

export interface ResumoDoPeriodo {
  /** quanto ENTROU nas linhas visíveis (positivo) */
  entrou: number
  /** quanto SAIU (positivo, pra ler sem sinal) */
  saiu: number
  /** o líquido — `entrou − saiu` */
  delta: number
  entrouValor: number
  saiuValor: number
  deltaValor: number
  /** quantas linhas o recorte tem (inclusive as que não movem a prateleira) */
  movimentos: number
  /** ⚠️ quantas das linhas visíveis NÃO entram na conta (consumo de produção, par anulado) */
  foraDaConta: number
}

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const r3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000

/**
 * ⭐ O RESUMO DO RECORTE — *"entrou X · saiu Y · Δ Z · N movimentos"*.
 *
 * ⛔ Só **linha que move a prateleira** entra na soma, pela MESMA régua do rodapé
 * (`movePrateleira`): *ou a linha entra na conta, ou não aparece somando* (ordem do dono,
 * 09/09). ⚠️ E as que ficam fora são **CONTADAS e ditas** (`foraDaConta`) — exclusão escondida
 * é tão ruim quanto exclusão nenhuma.
 */
export function resumoDoPeriodo(linhas: LinhaDoHistorico[]): ResumoDoPeriodo {
  let entrou = 0, saiu = 0, entrouValor = 0, saiuValor = 0, fora = 0
  for (const l of linhas) {
    if (!l.movePrateleira) { fora++; continue }
    if (l.quantidade >= 0) entrou += l.quantidade
    else saiu += -l.quantidade
    if (l.custoTotal >= 0) entrouValor += l.custoTotal
    else saiuValor += -l.custoTotal
  }
  return {
    entrou: r3(entrou), saiu: r3(saiu), delta: r3(entrou - saiu),
    entrouValor: r2(entrouValor), saiuValor: r2(saiuValor), deltaValor: r2(entrouValor - saiuValor),
    movimentos: linhas.length,
    foraDaConta: fora,
  }
}

/**
 * ⭐⭐ A LINHA DO ZERO — *"o momento em que o saldo cruzou pro negativo"*.
 *
 * A lista vem do **mais recente pro mais antigo**, então o cruzamento é a linha cujo
 * `saldoApos < 0` e cuja **vizinha mais ANTIGA** (a de baixo) ainda estava `>= 0`. É o
 * primeiro lançamento que empurrou o item pro buraco — *acha a origem de bate-olho*.
 *
 * ⛔ Devolve `null` quando não dá pra AFIRMAR: lista sem `saldoApos` (recorte não contíguo) ou
 * item que **já começou negativo** na primeira linha que existe. ⚠️ No segundo caso inventar
 * um "cruzou aqui" seria apontar o dedo pra o lançamento errado.
 *
 * ⚠️ E ela acha o cruzamento MAIS RECENTE, de propósito: um item pode ter ido e voltado do
 * negativo várias vezes, e o que o dono está investigando é o buraco de agora.
 */
export function linhaDoZero(linhas: LinhaDoHistorico[]): { movimentoId: string; data: string } | null {
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    if (l.saldoApos == null || l.saldoApos >= 0) continue
    const anterior = linhas.slice(i + 1).find((x) => x.saldoApos != null)
    // ⛔ sem vizinha mais antiga com saldo conhecido, não há como dizer que ELA cruzou
    if (!anterior || anterior.saldoApos == null) return null
    if (anterior.saldoApos >= 0) return { movimentoId: l.movimentoId, data: l.data }
  }
  return null
}

export interface PontoDoSaldo { data: string; saldo: number }

/**
 * ⭐⭐ O SALDO NO TEMPO — a série do gráfico.
 *
 * ⛔ É **projeção do `saldoApos`**, nunca um acumulado novo: a linha do gráfico e a coluna da
 * tabela mostram o MESMO número por construção. Com uma soma própria aqui, o gráfico poderia
 * desenhar um buraco que a tabela não tem.
 *
 * ⚠️ **Um ponto por DIA, o ÚLTIMO do dia** (a lista é desc, então o primeiro que aparece é o
 * mais recente daquele dia): vários movimentos no mesmo dia viram um ponto, senão o eixo
 * repete a data e o desenho vira serrote sem informação.
 */
export function saldoNoTempo(linhas: LinhaDoHistorico[]): PontoDoSaldo[] {
  const porDia = new Map<string, number>()
  for (const l of linhas) {
    if (l.saldoApos == null) continue
    const d = l.data.slice(0, 10)
    if (!porDia.has(d)) porDia.set(d, l.saldoApos)
  }
  return [...porDia.entries()]
    .map(([data, saldo]) => ({ data, saldo }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * ⭐ O FILTRO DE PERÍODO E A BUSCA — e eles moram aqui porque **são régua, não JSX**.
 *
 * ⚠️ A busca varre o que a LINHA MOSTRA (chip, de-onde-veio, quem) — é o que o dono tem na
 * frente quando digita "NF 1234" ou o nome do fornecedor. Buscar em campo invisível faria a
 * tabela esconder/mostrar linha por um motivo que a tela não explica.
 */
export interface RecorteDoHistorico {
  de?: string | null
  ate?: string | null
  busca?: string | null
  /** 'TUDO' · 'COMPRAS' · ou um tipo */
  filtro?: string
}

export function aplicarRecorte(linhas: LinhaDoHistorico[], r: RecorteDoHistorico, casa: (texto: string, busca: string) => boolean): LinhaDoHistorico[] {
  let out = linhas
  if (r.filtro && r.filtro !== 'TUDO') {
    out = r.filtro === 'COMPRAS' ? out.filter((l) => l.ehCompra) : out.filter((l) => l.tipo === r.filtro)
  }
  if (r.de) out = out.filter((l) => l.data.slice(0, 10) >= r.de!)
  if (r.ate) out = out.filter((l) => l.data.slice(0, 10) <= r.ate!)
  const b = (r.busca ?? '').trim()
  if (b) {
    // ⛔ a régua de texto é a `casaBusca` da casa (palavra em qualquer ordem, sem caixa e sem
    //    acento) — injetada pra esta lib ficar pura e pra NÃO nascer uma 2ª régua de busca.
    out = out.filter((l) => casa([l.chip, l.detalhe, l.quem ?? ''].join(' '), b))
  }
  return out
}

/** ⭐ o recorte está mexendo em algo? (o rodapé da Σ só aparece sem recorte) */
export function temRecorte(r: RecorteDoHistorico): boolean {
  return !!((r.filtro && r.filtro !== 'TUDO') || r.de || r.ate || (r.busca ?? '').trim())
}
