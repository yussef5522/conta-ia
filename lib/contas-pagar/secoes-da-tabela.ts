/**
 * ⭐⭐ AS LINHAS-CABEÇALHO DENTRO DA TABELA (21/10 · recortadas em 23/10).
 *
 * **O pedido do dono:** *"SEÇÕES NA PRÓPRIA TABELA: linhas-cabeçalho por faixa com subtotal +
 * contagem + checkbox que seleciona a seção inteira."* E em 23/10: *"as seções da tabela
 * seguem o mesmo corte (vencidas / hoje / a vencer)."*
 *
 * ⭐⭐⭐ **O CORTE É O `statusDaConta`, UMA DERIVAÇÃO SÓ.** Até 21/10 existia um
 * `faixaDaConta` com 6 valores pra responder a mesma pergunta; com as três faixas de data
 * aposentadas, ele virava **cópia literal** do dono do status. ⛔ Duas funções respondendo
 * *"em que estado esta conta está?"* divergem no primeiro caso de borda (conta sem
 * vencimento, conta paga com atraso) — e aí o cabeçalho diz uma faixa e o cartão do topo
 * conta outra.
 *
 * ⛔⛔ **A SEÇÃO SÓ EXISTE EM ORDEM DE VENCIMENTO, e isso é trava, não preguiça.** O estado é
 * um recorte de DATA; ordenado por VALOR, os estados se intercalam (vencida, a vencer,
 * vencida…) e cada troca viraria um cabeçalho — vinte cabeçalhos numa tabela de trinta
 * linhas, cada um com um subtotal PARCIAL do próprio estado. ⚠️ E aí o invariante que o dono
 * pediu (*"Σ dos cartões == Σ das linhas"*) passaria a ser falso NA TELA, com os números à
 * vista. Fora da ordem de data a tabela é lista plana — e isso é o honesto.
 *
 * ⭐⭐ **O SUBTOTAL DO CABEÇALHO É O DO ESTADO INTEIRO, vindo do MESMO agregado que o cartão
 * do topo** — nunca a soma das linhas visíveis. A lista é paginada: somar o que está na
 * página faria o cabeçalho dizer `R$ 20 mil` e o cartão `R$ 40 mil` pra o mesmo estado, e o
 * dono veria dois números do mesmo fato a dez centímetros um do outro (a doença que esta casa
 * mais paga). ⚠️ Quando a página corta o estado, o cabeçalho **DIZ** (`N de M nesta página`):
 * truncagem silenciosa é a classe do `take: 50` que escondeu o fermento (16/09).
 *
 * ⚠️ E o CHECKBOX da seção marca **as linhas carregadas** daquele estado — é o que ele pode
 * fazer. Por isso o cabeçalho mostra a parcialidade: marcar "a seção" num estado cortado
 * selecionaria menos do que o subtotal mostra, e sem a frase isso pareceria defeito.
 */
import { statusDaConta, type ContaParaStatus } from './escopo'
import {
  nomeDoEscopo,
  ESCOPOS_EM_ABERTO,
  type EscopoEmAberto,
  type MedidaDoTempo,
} from './rotulo-do-tempo'

export interface LinhaParaSecao {
  id: string
  status: string
  dueDate: Date | string | null
  paymentDate: Date | string | null
}

/**
 * ⭐⭐ O que o servidor mediu por estado — **a MESMA medida que o cartão do topo desenha**,
 * rótulo incluído (é um alias de `MedidaDoTempo`, não uma 2ª forma).
 *
 * ⛔⛔ **O RÓTULO VEM DE LÁ, NUNCA É DERIVADO AQUI.** Até 23/10 esta função chamava
 * `rotuloDoEscopo(escopo, now, janela)` e **derivava a data no cliente** — então o cartão
 * dizia *"A VENCER · 24 a 31/10"* (computado pelo SERVIDOR, no mesmo instante do agregado) e
 * a seção dizia o que o relógio do aparelho achasse. **Dois relógios, duas frases pro mesmo
 * corte**, a dez centímetros uma da outra. Agora é um só.
 */
export type TotalDoEstado = MedidaDoTempo

export interface SecaoDaTabela {
  escopo: EscopoEmAberto
  rotulo: string
  /** ids das linhas deste estado **nesta página** — é o que o checkbox da seção marca */
  ids: string[]
  /** ⭐ do ESTADO INTEIRO (agregado do servidor), não da página */
  subtotal: number
  contagem: number
  /** `true` quando a página mostra menos linhas do que o estado tem */
  parcial: boolean
}

/**
 * ⭐ Agrupa as linhas JÁ ORDENADAS em seções de estado.
 *
 * Devolve `null` quando não dá pra agrupar com honestidade (ordenação que não é por
 * vencimento) — e aí a tela desenha a lista plana, sem cabeçalho nenhum.
 *
 * ⚠️ Percorre as linhas **na ordem em que a tabela as desenha** e abre seção quando o estado
 * muda. Agrupar por `ESCOPOS_EM_ABERTO` e re-ordenar aqui criaria uma SEGUNDA ordenação, e
 * ela divergiria da que o `@tanstack/react-table` aplicou (o dono veria a linha num lugar e o
 * cabeçalho dizendo outro).
 */
export function secoesDasLinhas(
  linhas: readonly LinhaParaSecao[],
  totaisPorEstado: Partial<Record<EscopoEmAberto, TotalDoEstado>>,
  opts: { porVencimento: boolean },
  now: Date = new Date(),
): SecaoDaTabela[] | null {
  if (!opts.porVencimento) return null

  const secoes: SecaoDaTabela[] = []
  let atual: SecaoDaTabela | null = null

  for (const l of linhas) {
    const s = statusDaConta(l as ContaParaStatus, now)
    // ⚠️ conta PAGA não entra em seção nenhuma (e não deveria estar nesta lista; se estiver,
    // fica numa cauda sem cabeçalho em vez de inventar um estado de aberto pra ela)
    if (s === 'PAGA') {
      atual = null
      continue
    }
    const escopo = s as EscopoEmAberto
    if (!atual || atual.escopo !== escopo) {
      const t: TotalDoEstado | undefined = totaisPorEstado[escopo]
      atual = {
        escopo,
        /**
         * ⚠️ sem medida do servidor o rótulo é o NOME do estado, **sem data** — honesto. Derivar
         * a janela aqui ressuscitaria o segundo relógio que esta função acabou de aposentar.
         */
        rotulo: t?.rotulo ?? nomeDoEscopo(escopo),
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
   * `contagem` é o que o estado tem. ⚠️ `>` e não `!==`: estado com agregado AUSENTE (zero)
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

/** ⭐ a ordem canônica — pra a tela desenhar a fileira de cartões sempre igual */
export const ORDEM_DOS_ESTADOS = ESCOPOS_EM_ABERTO
