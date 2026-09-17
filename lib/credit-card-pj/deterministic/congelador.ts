// ⭐⭐⭐ O CONGELADOR — todo PDF lido certo vira fixture permanente (16/09/2026).
//
// **A régua do dono:** *"TODO PDF de fatura que JÁ FOI LIDO CERTO vira fixture permanente:
// a suíte lê cada um e compara com o resultado CONGELADO. A partir daí, consertar Banrisul
// roda os goldens de TODOS os bancos — se Sicredi quebrar, VERMELHO NA HORA, não no mês que
// vem na minha mão."*
//
// ⛔⛔ **O QUE ISTO MATA É A REINCIDÊNCIA.** Os goldens já existiam — **cinco arquivos, um
// por banco** — mas **soltos**: nada ligava *"mexi no parser do Banrisul"* a *"rode o do
// Sicredi"*. O conserto de um banco quebrava outro **em silêncio**, e o defeito aparecia
// semanas depois, na mão do dono, com cara de bug novo.
//
// ⭐ Aqui o registro é UM: cada entrada aponta a fixture, o parser e os números
// congelados. O runner (`golden-todos-os-bancos.test.ts`) percorre a lista inteira, e o
// guard exige que **todo parser tenha pelo menos um golden** — parser sem congelador é
// parser que pode mudar sem ninguém ver.

export interface GoldenDeFatura {
  /** o nome que aparece no vermelho — tem que dizer o BANCO e o MÊS */
  nome: string
  /** caminho da fixture, a partir da raiz do repo */
  fixture: string
  /** o arquivo do parser que ela protege — é o que liga "mexeu aqui" a "rode isto" */
  parser: string
  /**
   * ⚠️ OS NÚMEROS CONGELADOS. Só entram os que o **documento declara** — nunca os que a
   * nossa soma produziu: congelar a nossa conta seria congelar o nosso erro junto.
   */
  esperado: {
    /** quantas linhas de lançamento o parser tem que achar */
    linhas?: number
    /** o total que o PDF declara (o número que o dono confere no boleto) */
    declarado?: number
    /** o que fecha a conferência daquele banco (cada um tem a sua composição) */
    fecha?: number
  }
  /** ⭐ a versão de layout que esta fixture representa (peça 3) */
  layout?: string
  /** por que este PDF virou golden — o que ele pegou quando entrou */
  motivo: string
}

/**
 * ⭐⭐ O REGISTRO. **Toda fatura lida certo entra aqui** — é a promessa da peça 2.
 *
 * ⚠️ Os números vêm dos goldens que já rodavam desde agosto: eles não foram inventados
 * agora, foram **reunidos**. Cada um tem o arquivo de origem citado.
 */
export const GOLDENS: readonly GoldenDeFatura[] = [
  {
    nome: 'Sicredi PJ · agosto/2026',
    fixture: 'lib/credit-card-pj/deterministic/__tests__/fixtures/sicredi-fatura-real.txt',
    parser: 'lib/credit-card-pj/deterministic/sicredi-fatura-parser.ts',
    esperado: { declarado: 7896.32 },
    motivo: 'o 1º layout com "Total cartão (final …)" repetido 4× — o rótulo que engana regex solto',
  },
  {
    nome: 'Banrisul PJ · agosto/2026',
    fixture: 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-fatura-real.txt',
    parser: 'lib/credit-card-pj/deterministic/banrisul-fatura-parser.ts',
    /**
     * ⚠️ 13.797,73 é o `TOTAL DE GASTOS`; **13.779,73 é o que se PAGA** — os dois são
     * corretos e diferem em R$ 18,00, que é o par de anuidade (`DESC ANUID` −18 /
     * `ANUIDADEINT` +18). Congelar o pago no campo dos gastos criaria um vermelho eterno
     * com o parser certo. *Cada número tem o seu nome.*
     */
    esperado: { declarado: 13797.73, fecha: 13779.73 },
    motivo: 'transações à ESQUERDA (corte por coluna) + o par anuidade DESC/INT',
  },
  {
    /**
     * ⭐⭐⭐ O PRIMEIRO GOLDEN QUE VEIO DA QUARENTENA (17/09/2026) — e ele nasce da fatura
     * que recusou TRÊS vezes. O texto é o que o motor leu em PRODUÇÃO (registro
     * `cmu4xpfv00064z0ci36uz0q8n`), não um `pdftotext` meu e muito menos uma reconstrução.
     *
     * ⛔ O que ele trava: a empresa ganhou um **cartão adicional**, o histórico dele mora na
     * **coluna direita**, e o parser PJ a cortava fora por desenho (`cutCol`). Sumia o
     * `ANUIDADEINT DIFER 05/12 0123 · +18,00` e a conferência recusava por −18,00 — três
     * vezes, sempre o mesmo número.
     */
    nome: 'Banrisul PJ · setembro/2026 — DOIS portadores',
    fixture: 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-pj-2-portadores.txt',
    parser: 'lib/credit-card-pj/deterministic/banrisul-fatura-parser.ts',
    esperado: { linhas: 33, declarado: 11376.89, fecha: 8626.98 },
    layout: 'v1',
    motivo: 'portador ADICIONAL na coluna direita — o corte fixo o jogava fora (dif −18,00)',
  },
  {
    nome: 'Caixa PJ · agosto/2026',
    fixture: 'lib/credit-card-pj/deterministic/__tests__/fixtures/caixa-fatura-real.txt',
    parser: 'lib/credit-card-pj/deterministic/caixa-fatura-parser.ts',
    esperado: { declarado: 7280.39 },
    motivo: 'o crédito por SUFIXO D/C — foi o C que o Vision perdeu (os 12,58 do K1)',
  },
  {
    /**
     * ⭐⭐⭐ A FATURA RICA DA CAIXA (17/09/2026) — **o segundo golden que veio da quarentena**,
     * e o primeiro com desfecho **OK**: é a promessa de que *"a que FECHOU é o golden de
     * amanhã"* se cumprindo pela primeira vez.
     *
     * ⭐ O que ela traz num documento só: **rotativo, multa, mora, IOF, anuidade, cashback e
     * ESTORNOS** — e é justamente o estorno que expôs as duas réguas da tela (o banner somava
     * o bruto 5.119,53, o rodapé o líquido 5.106,99).
     */
    nome: 'Caixa PJ · setembro/2026 — rotativo, multa, mora e estornos',
    fixture: 'lib/credit-card-pj/deterministic/__tests__/fixtures/caixa-fatura-rica.txt',
    parser: 'lib/credit-card-pj/deterministic/caixa-fatura-parser.ts',
    esperado: { linhas: 15, declarado: 5106.99 },
    motivo: 'a fatura com estorno que provou o banner e o rodapé discordando (12,54)',
  },
  {
    nome: 'Mercado Pago PJ · agosto/2026',
    fixture: 'lib/credit-card-pj/deterministic/__tests__/fixtures/mercadopago-fatura-2026-08.txt',
    parser: 'lib/credit-card-pj/deterministic/mercadopago-fatura-parser.ts',
    esperado: { declarado: 2666.44 },
    motivo: 'o "Total a pagar" 3× — a oferta de parcelamento que parece a fatura',
  },
  {
    nome: 'Banrisul PF · agosto/2026',
    fixture: 'lib/fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf.txt',
    parser: 'lib/fatura-banrisul/banrisul-fatura-pf.ts',
    esperado: { declarado: 39302.64, fecha: 18348.72 },
    layout: 'v1',
    motivo: 'DUAS colunas com lançamento nos dois lados — cortar a direita perderia 46 linhas',
  },
  {
    nome: 'Banrisul PF · setembro/2026',
    fixture: 'lib/fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf-setembro.txt',
    parser: 'lib/fatura-banrisul/banrisul-fatura-pf.ts',
    esperado: { declarado: 18842.30, fecha: 18593.16 },
    layout: 'v1',
    motivo: 'a coluna com 2 lançamentos + painel — a densidade de datas descartava ela',
  },
  {
    nome: 'Itaú/Luizacred PF · setembro/2026',
    fixture: 'lib/fatura-itau/__tests__/fixtures/itau-luizacred-pf.txt',
    parser: 'lib/fatura-itau/parser.ts',
    esperado: { declarado: 4491.18 },
    motivo: 'a CALHA entre colunas + "Total a pagar" de SIMULAÇÃO maior que a fatura',
  },
  {
    nome: 'Itaú/Luizacred PF · o MESMO PDF por outro poppler',
    fixture: 'lib/fatura-itau/__tests__/fixtures/itau-luizacred-pf.poppler-25.txt',
    parser: 'lib/fatura-itau/parser.ts',
    esperado: { declarado: 4491.18 },
    motivo: 'o golden achava e a tela não: DOIS extratores, espaçamento diferente (09/09)',
  },
  {
    nome: 'Nubank PF · agosto/2026',
    fixture: 'lib/fatura-nubank/__tests__/fixtures/nubank-fatura-pf.txt',
    parser: 'lib/fatura-nubank/parser.ts',
    esperado: { declarado: 3053.32 },
    motivo: 'o "Total a pagar" da PROPAGANDA (3.634,43) antes do resumo',
  },
] as const

/** ⭐ os parsers que o congelador cobre — o guard exige que TODO parser esteja aqui */
export function parsersCobertos(): string[] {
  return [...new Set(GOLDENS.map((g) => g.parser))]
}

/**
 * ⭐⭐ O QUE RODAR QUANDO UM ARQUIVO MUDA.
 *
 * ⛔ A resposta é **SEMPRE TODOS** — e isso é o ponto da peça 2. Mexer no Banrisul roda o
 * Sicredi: *"se Sicredi quebrar, VERMELHO NA HORA, não no mês que vem na minha mão"*.
 * A função existe pra o guard poder afirmar isso, não pra filtrar.
 */
export function goldensPara(_arquivoAlterado: string): readonly GoldenDeFatura[] {
  void _arquivoAlterado
  return GOLDENS
}
