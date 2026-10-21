/**
 * ⭐⭐ AS LINHAS-CABEÇALHO DE FAIXA DENTRO DA TABELA (21/10).
 *
 * **O pedido do dono:** *"SEÇÕES NA PRÓPRIA TABELA: linhas-cabeçalho por faixa com subtotal +
 * contagem + checkbox que seleciona a seção inteira."*
 *
 * ⛔⛔ **A SEÇÃO SÓ EXISTE EM ORDEM DE VENCIMENTO, e isso é trava, não preguiça.** A faixa é
 * um recorte de DATA; ordenado por VALOR, as faixas se intercalam (vencida, resto do mês,
 * vencida, 7 dias…) e cada troca viraria um cabeçalho — vinte cabeçalhos numa tabela de
 * trinta linhas, cada um com um subtotal PARCIAL da própria faixa. ⚠️ E aí o invariante que o
 * dono pediu (*"Σ das faixas == Σ das linhas"*) passaria a ser falso NA TELA, com os números
 * à vista. Fora da ordem de data a tabela é lista plana — e isso é o honesto.
 *
 * ⭐⭐ **O SUBTOTAL DO CABEÇALHO É O DA FAIXA INTEIRA, vindo do MESMO agregado que o chip do
 * topo** — nunca a soma das linhas visíveis. A lista é paginada: somar o que está na página
 * faria o cabeçalho dizer `R$ 20 mil` e o chip `R$ 40 mil` pra a mesma faixa, e o dono veria
 * dois números do mesmo fato a dez centímetros um do outro (a doença que esta casa mais
 * paga). ⚠️ Quando a página corta a faixa, o cabeçalho **DIZ** (`N de M nesta página`):
 * truncagem silenciosa é a classe do `take: 50` que escondeu o fermento (16/09).
 *
 * ⚠️ E o CHECKBOX da seção marca **as linhas carregadas** daquela faixa — é o que ele pode
 * fazer. Por isso o cabeçalho mostra a parcialidade: marcar "a seção" numa faixa cortada
 * selecionaria menos do que o subtotal mostra, e sem a frase isso pareceria defeito.
 */
import { faixaDaConta, rotuloDaFaixa, FAIXAS, type FaixaDoTempo } from './faixa-do-tempo'

export interface LinhaParaSecao {
  id: string
  status: string
  dueDate: Date | string | null
  paymentDate: Date | string | null
}

/** o que o servidor mediu por faixa — a MESMA fonte do chip do topo */
export interface TotalDaFaixa {
  contagem: number
  total: number
}

export interface SecaoDaTabela {
  faixa: FaixaDoTempo
  rotulo: string
  /** ids das linhas desta faixa **nesta página** — é o que o checkbox da seção marca */
  ids: string[]
  /** ⭐ da FAIXA INTEIRA (agregado do servidor), não da página */
  subtotal: number
  contagem: number
  /** `true` quando a página mostra menos linhas do que a faixa tem */
  parcial: boolean
}

/**
 * ⭐ Agrupa as linhas JÁ ORDENADAS em seções de faixa.
 *
 * Devolve `null` quando não dá pra agrupar com honestidade (ordenação que não é por
 * vencimento) — e aí a tela desenha a lista plana, sem cabeçalho nenhum.
 *
 * ⚠️ Percorre as linhas **na ordem em que a tabela as desenha** e abre seção quando a faixa
 * muda. Agrupar por `FAIXAS` e re-ordenar aqui criaria uma SEGUNDA ordenação, e ela
 * divergiria da que o `@tanstack/react-table` aplicou (o dono veria a linha num lugar e o
 * cabeçalho dizendo outro).
 */
export function secoesDasLinhas(
  linhas: readonly LinhaParaSecao[],
  totaisPorFaixa: Partial<Record<FaixaDoTempo, TotalDaFaixa>>,
  opts: { porVencimento: boolean },
  now: Date = new Date(),
): SecaoDaTabela[] | null {
  if (!opts.porVencimento) return null

  const secoes: SecaoDaTabela[] = []
  let atual: SecaoDaTabela | null = null

  for (const l of linhas) {
    const faixa = faixaDaConta(l, now)
    // ⚠️ conta PAGA não tem faixa — ela não entra em seção nenhuma (e não deveria estar
    // nesta lista; se estiver, fica numa cauda sem cabeçalho em vez de inventar uma faixa)
    if (!faixa) {
      atual = null
      continue
    }
    if (!atual || atual.faixa !== faixa) {
      const t: TotalDaFaixa | undefined = totaisPorFaixa[faixa]
      atual = {
        faixa,
        rotulo: rotuloDaFaixa(faixa, now),
        ids: [],
        subtotal: t?.total ?? 0,
        contagem: t?.contagem ?? 0,
        parcial: false,
      }
      secoes.push(atual)
    }
    atual.ids.push(l.id)
  }

  /**
   * ⭐ a parcialidade é MEDIDA depois de montar: `ids.length` é o que a página tem, e
   * `contagem` é o que a faixa tem. ⚠️ `>` e não `!==`: faixa com agregado AUSENTE (zero)
   * mas linha na página seria "parcial" ao contrário — ali o honesto é não afirmar nada.
   */
  for (const s of secoes) s.parcial = s.contagem > s.ids.length

  return secoes
}

/**
 * ⭐ A ordenação da tabela é por vencimento? É isto que libera as seções.
 *
 * ⚠️ Lista vazia de ordenação conta como SIM: o default da tabela é `dueDate asc` desde a
 * Fase 1 do Contas a Pagar, então "nada escolhido" é a ordem de data.
 */
export function ordenadoPorVencimento(
  sorting: readonly { id: string }[] | undefined,
): boolean {
  if (!sorting || sorting.length === 0) return true
  return sorting.length === 1 && sorting[0].id === 'dueDate'
}

/** ⭐ a ordem canônica — pra a tela desenhar os chips do topo sempre igual */
export const ORDEM_DAS_FAIXAS = FAIXAS
