// ⭐⭐⭐ A CAIXA DE ENTRADA DO BANCO — O BALCÃO ÚNICO (15/09/2026).
//
// **A lei que faltava, nas palavras do dono:** *"o SENTIDO decide o menu, o menu decide a
// fila"*. É o que QuickBooks, Conta Azul e Organizze fazem há anos, cada um com a sua
// roupa: crédito nunca vê "pagar conta", débito nunca vê "receber".
//
// ⛔⛔ **O BURACO QUE ISTO FECHA, MEDIDO EM PROD (15/09):** o `LINHA_DISPONIVEL_WHERE`
// filtrava onze coisas (cartão, empréstimo, transferência, ignorada…) e **não filtrava
// sentido**. Resultado: a fila de *"casar com conta a pagar"* tinha **6.555 linhas, das
// quais 5.705 eram CRÉDITO — 87%**. O PIX de venda de R$ 308,50 do dono estava ali, junto
// com `ANTECIP STONE` e `OP.CREDITO C/GARANTIA` de R$ 28.223,77. *A fila de pagar dívida
// era, quase toda, dinheiro que entrou.*
//
// ⭐ **AS TRÊS ESTAÇÕES** (o desenho aprovado):
//   1. **IMPORT** — o portão. Resolve só o AUTOMÁTICO (regra aprendida) e PREPARA sugestões.
//   2. **CAIXA DE ENTRADA** — este balcão. Toda linha não-resolvida mora aqui, **e só aqui**.
//   3. **MOVIMENTAÇÕES** — o arquivo. Tudo resolvido, com o selo de COMO. Nunca fila.
//
// ⚠️ **UMA LINHA, UMA ESTAÇÃO** — `Σ(caixa + arquivo) == total importado`. Órfã e bicéfala
// são as duas vermelhas, e o guard confere as duas pontas.

/** o sentido da linha — é ele que manda em tudo que vem depois */
export type SentidoDaLinha = 'SAIDA' | 'ENTRADA'

/**
 * As ações que a linha aceita. ⛔ Elas são por SENTIDO, e a lista é FECHADA: ação nova
 * entra aqui e no `resolver-linha`, ou não existe — foi um menu que oferecia o que a tela
 * não fazia que produziu os dois selects mortos dos Pendentes (medido em 15/09).
 */
export type AcaoDoBalcao =
  // ── SAÍDA ──
  | 'CASAR_PAGAR'
  | 'PGTO_CARTAO'
  | 'PARCELA_EMPRESTIMO'
  /**
   * ⭐⭐ 25/09 — **APORTE EM INVESTIMENTO: o espelho do empréstimo, do lado do ATIVO.**
   *
   * Decisão do dono: *"CAPITALIZACAO RG e PAGAMENTO CONSORCIO não são despesa nem conta a
   * pagar — são APORTES que constroem patrimônio. Lá a parcela reduz dívida, aqui aumenta
   * ativo."* ⛔ Por isso o gesto é PRÓPRIO: resolver isso como "é despesa: categoria"
   * arquivaria a linha sem dizer em QUAL contrato o dinheiro entrou.
   */
  | 'APORTE_INVESTIMENTO'
  | 'TRANSFERENCIA_ENVIADA'
  // ── ENTRADA ──
  | 'CASAR_RECEBER'
  | 'RECEBIMENTO_VENDA'
  | 'TRANSFERENCIA_RECEBIDA'
  | 'ESTORNO'
  // ── os dois lados ──
  | 'CATEGORIA'
  | 'IGNORAR'
  /**
   * ⭐⭐ 25/09 — **"É DESPESA AVULSA — NÃO TEM NOTA"**, a saída honesta da linha de
   * fornecedor que ficou na caixa por não ter vínculo.
   *
   * ⛔ Sem ela o aviso *"categorizada, mas sem vínculo"* seria um **beco**: compra
   * pré-sistema e pix pro entregador são casos legítimos. ***Decisão, nunca silêncio.***
   */
  | 'AVULSA_CONFIRMADA'

export interface AcaoOferecida {
  acao: AcaoDoBalcao
  rotulo: string
  /** precisa escolher um alvo antes de efetivar (cartão, contrato, conta, saída original) */
  pedeAlvo: 'CARTAO' | 'CONTRATO' | 'CONTRATO_INVESTIMENTO' | 'CONTA_PAGAR' | 'CONTA_RECEBER' | 'PAR' | 'CATEGORIA' | 'SAIDA_ORIGINAL' | null
}

const SAIDA: readonly AcaoOferecida[] = [
  { acao: 'CASAR_PAGAR', rotulo: 'casar com conta a pagar', pedeAlvo: 'CONTA_PAGAR' },
  { acao: 'PGTO_CARTAO', rotulo: 'pagamento de fatura', pedeAlvo: 'CARTAO' },
  { acao: 'PARCELA_EMPRESTIMO', rotulo: 'parcela de empréstimo', pedeAlvo: 'CONTRATO' },
  /** ⭐ 25/09 — o espelho do empréstimo: aqui a parcela AUMENTA ativo em vez de reduzir dívida */
  { acao: 'APORTE_INVESTIMENTO', rotulo: 'aporte em investimento', pedeAlvo: 'CONTRATO_INVESTIMENTO' },
  { acao: 'TRANSFERENCIA_ENVIADA', rotulo: 'transferência enviada', pedeAlvo: 'PAR' },
  { acao: 'CATEGORIA', rotulo: 'é despesa: categoria', pedeAlvo: 'CATEGORIA' },
  /**
   * ⭐⭐ 25/09 — a saída da linha de FORNECEDOR que ficou na caixa por não ter vínculo.
   *
   * ⛔ Ela é de SAÍDA só: crédito não paga nota, então a pergunta *"tem nota?"* não existe
   * do outro lado — e a lei do sentido é checada no servidor.
   */
  { acao: 'AVULSA_CONFIRMADA', rotulo: 'é despesa avulsa — não tem nota', pedeAlvo: null },
  { acao: 'IGNORAR', rotulo: 'ignorar', pedeAlvo: null },
]

const ENTRADA: readonly AcaoOferecida[] = [
  { acao: 'CASAR_RECEBER', rotulo: 'casar com conta a receber', pedeAlvo: 'CONTA_RECEBER' },
  /**
   * ⚠️ **NÃO casa com o caixa do PDV** — decisão do dono em 15/09: *"adquirente tem taxa,
   * prazo e antecipação"*, então o valor que cai no banco **não é** o que o PDV registrou.
   * Ele categoriza como receita com o dia; a conferência de recebíveis fica como módulo
   * futuro, registrado e não construído.
   */
  { acao: 'RECEBIMENTO_VENDA', rotulo: 'recebimento de venda', pedeAlvo: 'CATEGORIA' },
  { acao: 'TRANSFERENCIA_RECEBIDA', rotulo: 'transferência recebida', pedeAlvo: 'PAR' },
  /**
   * ⛔⛔ **ERA `SAIDA_ORIGINAL` E NASCEU MUDO** (corrigido 17/09). O chip virava um botão
   * sem seletor nenhum, mandava a ação sem alvo, e o servidor — que **EXIGE `categoryId`**
   * — devolvia 422 *"Escolha a categoria do estorno"*. Um erro no lugar de um gesto.
   *
   * ⭐ O alvo obrigatório do estorno **sempre foi a CATEGORIA**; a saída original é o
   * vínculo OPCIONAL (decisão do dono em 15/09: *"quando houver par; sem par, categoria
   * «estorno» e segue"*). O `pedeAlvo` passa a dizer a verdade sobre o que o servidor pede.
   */
  { acao: 'ESTORNO', rotulo: 'estorno', pedeAlvo: 'CATEGORIA' },
  { acao: 'CATEGORIA', rotulo: 'aporte / outra receita', pedeAlvo: 'CATEGORIA' },
  { acao: 'IGNORAR', rotulo: 'ignorar', pedeAlvo: null },
]

/** ⭐ o sentido a partir do tipo da linha do banco */
export function sentidoDaLinha(tipo: string): SentidoDaLinha {
  return tipo === 'CREDIT' ? 'ENTRADA' : 'SAIDA'
}

/**
 * ⭐⭐ O MENU DA LINHA — a lei do balcão, pura.
 *
 * ⛔ **Crédito NUNCA vê `CASAR_PAGAR`.** É a regra que o dono nomeou: *"crédito não se casa
 * com dívida"*. E ela é verificável numa linha de teste, não numa promessa de tela.
 */
export function acoesDoSentido(sentido: SentidoDaLinha): readonly AcaoOferecida[] {
  return sentido === 'ENTRADA' ? ENTRADA : SAIDA
}

/** a ação é oferecida pra esse sentido? (a mesma pergunta que o servidor faz antes de gravar) */
export function acaoValePraSentido(acao: AcaoDoBalcao, sentido: SentidoDaLinha): boolean {
  return acoesDoSentido(sentido).some((a) => a.acao === acao)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐ EM QUE ESTAÇÃO A LINHA ESTÁ — a derivação única (o invariante mora nela)
// ═══════════════════════════════════════════════════════════════════════════════

import { categoriaResolveSozinha, SELO_AVULSA_CONFIRMADA } from './categoria-nao-quita'

export type Estacao = 'CAIXA' | 'ARQUIVO'

/** o que basta saber de uma linha pra dizer onde ela está */
export interface LinhaParaEstacao {
  categoryId: string | null
  reconciledWithId: string | null
  temReconciledFrom: boolean
  isCardPayment: boolean
  /** ⭐ o VÍNCULO com o cartão — a flag sozinha não resolve nada (20/09) */
  faturaVinculada: boolean
  temParcelaVinculada: boolean
  transferGroupId: string | null
  isInternalTransfer: boolean
  pendingTransfer: boolean
  ignoredAt: Date | null
  tipo: string
  /**
   * ⭐⭐ 25/09 — O GRUPO DO DRE DA CATEGORIA. É ele que decide se a categoria **encerra** a
   * linha ou se ela ainda pede o vínculo com a nota.
   *
   * ⚠️ Vem como VALOR (não pelo nome da categoria): nome é texto livre que cada cliente
   * escreve como quer; `dreGroup` é escolha estrutural. A régua mora em
   * `categoria-nao-quita.ts`, um dono só.
   */
  dreGroupDaCategoria: string | null
  /** ⭐ o dono CONFIRMOU que esta saída não tem nota (decisão registrada, com autor) */
  avulsaConfirmada: boolean
}

/**
 * ⭐⭐⭐ RESOLVIDA = tem DESTINO FINAL. E cada forma de destino tem um selo próprio — é ele
 * que o arquivo (Movimentações) mostra como "COMO isto foi resolvido".
 *
 * ⚠️⚠️ **E O PARÁGRAFO QUE ESTAVA AQUI ERA METADE VERDADE — corrigido em 25/09.**
 *
 * Ele dizia: *"ter categoria conta como resolvida AQUI, e isso NÃO contradiz a régua de
 * 07/09 — lá a pergunta era «esta linha ainda pode pagar um boleto?»; aqui é «esta linha
 * ainda pede decisão minha?», e não pede"*. ⭐ **O argumento vale pro SALÁRIO e pra RETIRADA
 * DE SÓCIO** (não existe boleto pra casar) **e NÃO vale pro FORNECEDOR**: ali a linha ainda
 * pede uma decisão, e a decisão é *qual nota ela pagou*.
 *
 * **O estrago, medido no mapa do problema 3:** 68 saídas arquivadas só com categoria, das
 * quais **18 (R$ 16.201,01) são de fornecedor que emite nota** — DOCEOLI 5.234,88, as duas
 * do CASPER de 04/09, DIVINE, CEREALISTA, E-CAIXAS, frete. ***Dinheiro que saiu, não baixou
 * conta a pagar nenhuma, fora da caixa e sem ninguém cobrando.***
 *
 * ⭐ Agora quem decide é o **grupo do DRE** (`categoriaResolveSozinha`), e a saída pra quem
 * de fato não tem nota é o dono DIZER isso — selo *"avulsa confirmada"*, com autor e data.
 */
export function comoFoiResolvida(l: LinhaParaEstacao): string | null {
  if (l.ignoredAt) return 'ignorada por você'
  if (l.reconciledWithId || l.temReconciledFrom) return 'conciliada com conta'
  /**
   * ⛔⛔⛔ **A FLAG DIZ "PARECE"; O VÍNCULO DIZ "É"** — e este `if` confiava na flag.
   *
   * **O caso, medido (20/09):** a linha `PAGAMENTO CARTAO DE CREDITO` de **R$ 8.626,98
   * (17/09)** tinha `isCardPayment: true` — marcada pelo passo 8.5 do import, por
   * **heurística de DESCRIÇÃO** — e `businessCreditCardId: null`. Ela **não quitava fatura
   * nenhuma**, e mesmo assim a lei a declarava resolvida e a mandava pro ARQUIVO com o selo
   * *"pagamento de fatura de cartão"*. Resultado: a fatura do Carter ficou **OPEN com o
   * pagamento dela no extrato**, o **K3 gritando todo dia**, e ***nenhuma tela onde
   * resolver*** — o palpite nunca pôde ser oferecido porque a linha nunca chegou na caixa.
   *
   * ⚠️⚠️ **ESTA LIÇÃO JÁ ESTAVA ESCRITA, em 29/08, com estas palavras:** *"a flag não quita
   * nada, **só tira da fila**"*. Ela virou comentário num teste e não virou régua — e o
   * defeito nasceu depois, na lei da estação.
   *
   * ⭐ Agora o selo exige o VÍNCULO. Sem ele a linha **volta pra caixa**, onde o palpite do
   * cartão (`mesQueBateOValor`) a reconhece e oferece o gesto que a resolve de verdade.
   */
  if (l.isCardPayment && l.faturaVinculada) return 'pagamento de fatura de cartão'
  if (l.temParcelaVinculada) return 'parcela de empréstimo'
  if (l.transferGroupId || l.isInternalTransfer || l.tipo === 'TRANSFER') return 'transferência entre contas'
  // ⭐ a decisão explícita do dono resolve ANTES da categoria — é ela que fecha o caso
  if (l.avulsaConfirmada) return SELO_AVULSA_CONFIRMADA
  if (l.categoryId && categoriaResolveSozinha(l.dreGroupDaCategoria)) return 'categorizada'
  return null
}

export function estacaoDaLinha(l: LinhaParaEstacao): Estacao {
  return comoFoiResolvida(l) ? 'ARQUIVO' : 'CAIXA'
}

export interface ContadoresDoBalcao {
  saidas: number
  entradas: number
  /** ⚠️ o total do arquivo entra no contador pra o invariante ser VISÍVEL na tela */
  arquivo: number
  total: number
}

/**
 * ⭐ OS CONTADORES — e eles saem da MESMA lista que a tela desenha.
 *
 * ⛔ `saidas + entradas + arquivo == total`, sempre. É o invariante *"uma linha, uma
 * estação"* em forma de aritmética: se a soma não fecha, há linha órfã ou em duas filas.
 */
export function contarEstacoes(linhas: readonly LinhaParaEstacao[]): ContadoresDoBalcao {
  let saidas = 0, entradas = 0, arquivo = 0
  for (const l of linhas) {
    if (estacaoDaLinha(l) === 'ARQUIVO') { arquivo++; continue }
    if (sentidoDaLinha(l.tipo) === 'ENTRADA') entradas++
    else saidas++
  }
  return { saidas, entradas, arquivo, total: linhas.length }
}

/** ⭐ a aritmética fecha? É o guard em forma de função — a tela e o teste chamam a MESMA. */
export function estacoesFecham(c: ContadoresDoBalcao): boolean {
  return c.saidas + c.entradas + c.arquivo === c.total
}
