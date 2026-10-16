/**
 * ⭐⭐⭐ **A LEI DA DATA DO RELATÓRIO DE VENDAS (16/10/2026) — em três degraus.**
 *
 * **O CASO QUE PEDIU ISTO (medido em prod, 6a):** na madrugada de 16/10 os DOIS relatórios da
 * quinta 15/10 foram subidos, 16 segundos um do outro, e o calendário ficou assim:
 * ```
 * 03:40:04  PRODUTOS      "Relatório de Produtos - Agrupado (1).xls"      → dia 16/10  ⛔
 * 03:40:20  COMPLEMENTOS  "Relatório de Complementos - Agrupado (1).xls"  → dia 15/10  ✓
 * ```
 * **15/10 ficou com R$ 769 (só os sabores) e 16/10 com R$ 13.749 — uma SEXTA que nem abriu.**
 * Nas palavras do dono: *"venda de sexta nem chegou, estamos na 1 da manhã"*.
 *
 * ⚠️⚠️ **A PREMISSA DO PEDIDO CAIU NA MEDIÇÃO, e isso muda o conserto:** não existe *"fallback
 * de hoje"* no caminho de vendas. Os dois campos de data **nascem vazios** (`useState('')`) e as
 * duas rotas **EXIGEM** `data` pelo zod. O dia 16/10 não foi chutado pelo sistema — **foi
 * APONTADO**, por quem estava importando às 3h40 da manhã. ⭐ *Não havia relógio decidindo; o
 * que faltava era alguém PERGUNTAR.*
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * **OS TRÊS DEGRAUS, na ordem do dono:**
 *
 * **1º O ARQUIVO MANDA.** Se o relatório declarar o dia por dentro, é ele e ponto — documento
 * ganha de digitação. ⚠️⚠️ **E HOJE ELE NÃO DECLARA:** medido em 08/10, *"o relatório do
 * Suitable NÃO TRAZ DATA NENHUMA — zero ocorrência"*; o nome do arquivo também não (*"Relatório
 * de Produtos - Agrupado (1).xls"*). ⭐ O degrau fica **construído e dormente**, com o
 * `diaDoArquivo` opcional: no dia em que o Suitable (ou outro PDV) passar a declarar, a lei já
 * sabe o que fazer — e **não precisa de uma 2ª régua escrita às pressas**.
 *
 * **2º O DONO APONTA.** Sem data no arquivo, vale o dia que ele escolheu — digitando, ou
 * clicando num dia da central (que já é organizada por dia e **manda o dia junto do gesto**).
 *
 * **3º PERGUNTA SÓ NA DISCORDÂNCIA.** ⛔ *"Rotina normal: zero perguntas"* é regra, não
 * aspiração — alarme que aparece todo dia é alarme que se aprende a confirmar sem ler (os 111
 * falsos de 26/08). A lei só abre a boca em quatro situações, cada uma com evidência:
 *   · **(a) o arquivo diz um dia e o dono aponta outro** — aí a dúvida é real;
 *   · **(b) MADRUGADA apontando pra HOJE** — é o caso de 16/10. A rotina medida da casa é
 *     *"o dia anterior, importado na madrugada"* (13/10 04:19→12/10 · 14/10 03:24→13/10 ·
 *     15/10 03:43→14/10). Então madrugada + dia de hoje é a assinatura exata do erro, e
 *     madrugada + ontem — a rotina — **passa calada**;
 *   · **(c) o IRMÃO foi pra outro dia** — produtos num dia e complementos noutro é o estado
 *     que racha o dia, e ele é detectável no instante do 2º import;
 *   · **(d) dia no FUTURO → RECUSA**, não pergunta: dia que não aconteceu não tem venda, e
 *     confirmar não deveria ser possível.
 *
 * ⛔⛔ **E A PERGUNTA É UMA, CURTA, COM AS DUAS OPÇÕES NA MÃO** — *"esse relatório parece de
 * quinta 15/10 — confirma?"* `[15/10] [16/10]`. Pergunta sem as opções é trabalho que o dono
 * tem que fazer de cabeça às 3h da manhã, que é justamente quando ele errou.
 *
 * ⚠️ **MÓDULO PURO, e o `agora` entra por PARÂMETRO.** A decisão tem que ser a mesma rodando
 * hoje, amanhã ou num teste — *"o relógio serve pra exibir hoje na tela, nunca pra decidir"*
 * (13/08), e aqui ele é **evidência** (a hora do upload), nunca a resposta.
 */

/** até que hora da manhã um upload é "madrugada" — a janela da rotina medida (3h-5h) */
export const MADRUGADA_ATE_HORA = 6

/**
 * ⭐⭐ A JANELA DO "MESMO LOTE" — 10 minutos, e o número tem evidência: no caso de 16/10 os
 * dois relatórios entraram com **16 segundos** de diferença.
 *
 * ⛔⛔ **E ela é estreita de propósito.** Sem janela, um dono subindo 5 dias atrasados de uma
 * vez levaria 5 perguntas — *alarme que aparece em batch legítimo é alarme que se aprende a
 * confirmar sem ler*. Com 10 minutos, o que dispara é a assinatura do erro: **o par do mesmo
 * lote caindo em dias diferentes**.
 */
export const MESMO_LOTE_MINUTOS = 10

/**
 * ⚠️ E a diferença entre os dias tem que ser de **1 dia** — é o erro de quem troca ontem por
 * hoje às 3h da manhã. Produtos de 15/10 e complementos de 02/10 no mesmo lote não é dia
 * rachado: é o dono recuperando atraso, e perguntar ali seria ruído.
 */
export const RACHA_DIAS_DE_DISTANCIA = 1

export type DecisaoDaData = 'ACEITA' | 'PERGUNTA' | 'RECUSA'

export interface VeredictoDaData {
  decisao: DecisaoDaData
  /** o dia que vale quando a decisão é ACEITA */
  dia: string
  /** a frase, na língua do balcão — `null` quando não há nada a dizer */
  frase: string | null
  /**
   * ⭐ as opções do botão, **na ordem em que a lei aposta** (a sugerida primeiro).
   * ⛔ Vazio quando a decisão é ACEITA ou RECUSA — botão que não resolve nada é ruído.
   */
  opcoes: { dia: string; rotulo: string }[]
  /** ⭐ qual degrau falou — entra no rastro e no teste, nunca uma decisão anônima */
  porque: 'ARQUIVO' | 'DONO' | 'ARQUIVO_DISCORDA' | 'MADRUGADA' | 'IRMAO_EM_OUTRO_DIA' | 'FUTURO'
}

export interface EntradaDaLei {
  /** o dia que o DONO apontou (YYYY-MM-DD) */
  diaEscolhido: string
  /**
   * ⭐ o dia que o ARQUIVO declara, se declarar. ⚠️ Hoje é SEMPRE `null` no Suitable — o
   * degrau 1 está pronto e dormente, de propósito (ver o cabeçalho).
   */
  diaDoArquivo?: string | null
  /**
   * ⭐ o relatório IRMÃO (o outro do par), se já existir — com o INSTANTE do import.
   * ⚠️ A rota só consulta; **a régua do "mesmo lote" mora aqui**, num lugar só.
   */
  irmao?: { dia: string; importadoEm: Date } | null
  /** ⚠️ evidência (a hora do upload), nunca a resposta */
  agora: Date
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/** "2026-10-15" → "quinta 15/10" — ⚠️ do TEXTO, nunca de `new Date(dia)` (que desloca o fuso) */
export function nomeDoDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return `${DIAS[dow]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

/** o dia do BRASIL do instante — a casa toda decide "hoje" por aqui */
export function diaDoBrasil(agora: Date): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** a hora do BRASIL (0..23) do instante */
function horaDoBrasil(agora: Date): number {
  return Number(
    agora.toLocaleString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }),
  )
}

/** ontem, no calendário (não em milissegundos — o fuso já foi resolvido no `diaDoBrasil`) */
function ontemDe(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d) - 86_400_000)
  return x.toISOString().slice(0, 10)
}

/**
 * ⭐ "é o par do mesmo lote caindo em dias vizinhos?" — as DUAS condições, num lugar só.
 */
function ehMesmoLoteERachado(
  irmao: { dia: string; importadoEm: Date },
  escolhido: string,
  agora: Date,
): boolean {
  const minutos = Math.abs(agora.getTime() - irmao.importadoEm.getTime()) / 60_000
  if (minutos > MESMO_LOTE_MINUTOS) return false
  const dias = Math.abs(
    (Date.parse(`${escolhido}T00:00:00Z`) - Date.parse(`${irmao.dia}T00:00:00Z`)) / 86_400_000,
  )
  return dias <= RACHA_DIAS_DE_DISTANCIA
}

/**
 * ⭐⭐ A LEI, nos três degraus. Devolve ACEITA (o caminho de todo dia), PERGUNTA (com as duas
 * opções) ou RECUSA (só o dia futuro).
 */
export function avaliarDiaDoRelatorio(i: EntradaDaLei): VeredictoDaData {
  const hoje = diaDoBrasil(i.agora)
  const escolhido = i.diaEscolhido

  // ─── (d) FUTURO: recusa, não pergunta ──────────────────────────────────────────────────
  if (escolhido > hoje) {
    return {
      decisao: 'RECUSA',
      dia: escolhido,
      frase: `${nomeDoDia(escolhido)} ainda não aconteceu — não existe venda desse dia pra importar.`,
      opcoes: [],
      porque: 'FUTURO',
    }
  }

  // ─── 1º DEGRAU: o ARQUIVO manda ────────────────────────────────────────────────────────
  if (i.diaDoArquivo) {
    if (i.diaDoArquivo === escolhido) {
      return { decisao: 'ACEITA', dia: escolhido, frase: null, opcoes: [], porque: 'ARQUIVO' }
    }
    /**
     * ⚠️ O arquivo discorda do dono: a lei **PERGUNTA** em vez de decidir sozinha. O documento
     * é mais forte (por isso vem primeiro na lista de opções), mas sobrescrever calado tiraria
     * do dono a chance de dizer *"não, esse arquivo é do dia que eu digitei"* — e PDV que
     * declara data errada existe.
     */
    return {
      decisao: 'PERGUNTA',
      dia: i.diaDoArquivo,
      frase: `o arquivo diz que é de ${nomeDoDia(i.diaDoArquivo)}, e você apontou ${nomeDoDia(escolhido)} — qual vale?`,
      opcoes: [
        { dia: i.diaDoArquivo, rotulo: `${ddmm(i.diaDoArquivo)} (o arquivo diz)` },
        { dia: escolhido, rotulo: `${ddmm(escolhido)} (eu aponto)` },
      ],
      porque: 'ARQUIVO_DISCORDA',
    }
  }

  // ─── (c) o IRMÃO do MESMO LOTE entrou em OUTRO dia ─────────────────────────────────────
  if (i.irmao && i.irmao.dia !== escolhido && ehMesmoLoteERachado(i.irmao, escolhido, i.agora)) {
    /**
     * ⭐⭐ É o caso de 16/10 pego no 2º import, 16 segundos depois do 1º: produtos num dia e
     * complementos noutro **racha o dia** — um lado fica com o faturamento e o outro com os
     * sabores, e nenhum dos dois fecha. A lei aposta no dia do IRMÃO, porque ele já está
     * gravado e o dono o escolheu uma vez.
     */
    return {
      decisao: 'PERGUNTA',
      dia: i.irmao.dia,
      frase: `o outro relatório deste par acabou de entrar em ${nomeDoDia(i.irmao.dia)}, e você apontou ${nomeDoDia(escolhido)} — se forem dias diferentes, um fica com o faturamento e o outro com os sabores.`,
      opcoes: [
        { dia: i.irmao.dia, rotulo: `${ddmm(i.irmao.dia)} (como o outro)` },
        { dia: escolhido, rotulo: `${ddmm(escolhido)} (dias diferentes mesmo)` },
      ],
      porque: 'IRMAO_EM_OUTRO_DIA',
    }
  }

  // ─── (b) MADRUGADA apontando pra HOJE ──────────────────────────────────────────────────
  if (escolhido === hoje && horaDoBrasil(i.agora) < MADRUGADA_ATE_HORA) {
    const ontem = ontemDe(hoje)
    return {
      decisao: 'PERGUNTA',
      dia: ontem,
      frase: `esse relatório parece de ${nomeDoDia(ontem)} — são ${String(horaDoBrasil(i.agora)).padStart(2, '0')}h e o dia de hoje quase não vendeu ainda. Confirma?`,
      opcoes: [
        { dia: ontem, rotulo: ddmm(ontem) },
        { dia: hoje, rotulo: `${ddmm(hoje)} (é de hoje mesmo)` },
      ],
      porque: 'MADRUGADA',
    }
  }

  // ─── 2º DEGRAU: o dono aponta, e a rotina passa CALADA ─────────────────────────────────
  return { decisao: 'ACEITA', dia: escolhido, frase: null, opcoes: [], porque: 'DONO' }
}

/**
 * ⛔⛔ **O ERRO DE DOMÍNIO QUE A ROTA TRADUZ EM 409 — "pergunta", nunca "erro".**
 *
 * ⭐ É o desenho do `SanidadeNaoConfirmadaError` (05/09) e do `MOTIVO_DO_NEGATIVO` (22/09):
 * a tela mostra a frase com os dois botões e **reenviar o MESMO gesto com `confirmouDia`
 * passa**. ⚠️ E a trava não é um `force`: o `confirmouDia` tem que **bater com o dia enviado**
 * — é a régua do `diferencaAceita` (07/09), e é ela que separa *"eu vi e decidi"* de
 * *"ignora a pergunta"*.
 */
export class DiaNaoConfirmadoError extends Error {
  constructor(readonly veredicto: VeredictoDaData) {
    super(veredicto.frase ?? 'Confirme o dia deste relatório.')
    this.name = 'DiaNaoConfirmadoError'
  }
}

/**
 * ⭐ A PORTA ÚNICA que as rotas chamam: avalia e **lança** quando precisa de resposta.
 *
 * ⛔ Uma 2ª avaliação escrita dentro de cada rota seria o caminho pra produtos e complementos
 * perguntarem coisas diferentes sobre o MESMO par — que é literalmente o defeito que a lei
 * existe pra fechar.
 */
export function exigirDiaDecidido(
  i: EntradaDaLei & { confirmouDia?: string | null },
): string {
  const v = avaliarDiaDoRelatorio(i)
  if (v.decisao === 'ACEITA') return v.dia
  if (v.decisao === 'RECUSA') throw new DiaNaoConfirmadoError(v)

  /**
   * ⚠️ O dono respondeu — e a resposta só vale se for **uma das opções oferecidas**. Aceitar
   * qualquer valor transformaria o campo num `force`, e aí a pergunta deixaria de proteger.
   */
  const respondeu = i.confirmouDia && v.opcoes.some((o) => o.dia === i.confirmouDia)
  if (respondeu) return i.confirmouDia as string
  throw new DiaNaoConfirmadoError(v)
}
