/**
 * ⛔⛔ PLAUSIBILIDADE DA DOSE — a ordem consumiu o que a ficha diz? (item 2b, 02/10/2026)
 *
 * **A ordem do dono:** *"dose efetiva (consumo ÷ unidades produzidas) fora de ±20% da ficha
 * atual = AVISO NOMEADO. Pega ficha errada E motor errado, os dois lados."*
 *
 * ⚠️⚠️ **E O DENOMINADOR DA LETRA DO PEDIDO ESTÁ CORRIGIDO AQUI, por medição — não por
 * preferência.** Ele escreveu *"÷ unidades produzidas"*; medido contra as 319 conclusões reais,
 * aquilo mede o **RENDIMENTO** e não a dose (ver o bloco do denominador, abaixo), acusando 107
 * ordens e repetindo a pergunta que o P3 já faz. A régua que entrega o que ele PEDIU — *"pega
 * ficha errada E motor errado"* — divide pela **escala da ordem**, e é a mesma conta que a
 * perícia do acém fez à mão no mesmo dia. *Repetir o número do pedido sem medir seria o erro
 * que este doc já registra sobre mim em 29/08.*
 *
 * ⭐⭐ E a filosofia que sustenta isso é a do Toast: ***um teórico torto é quase sempre uma
 * ficha mal configurada*** — então o aviso aponta a ficha, não acusa o motor. É por isso que
 * ele é AVISO e não erro: a resposta certa pode ser *"a ficha está errada"*, e isso é decisão
 * do dono (a régua da casa desde 17/08: *categoria/receita é decisão do dono*).
 *
 * ═══ ⚠️ O QUE ESTE INVARIANTE **NÃO** É ═══
 *
 * Ele **não** é o P1 (`Σ separado == Σ consumido + Σ devolvido`, o invariante contábil) nem o
 * P3 (rendimento do lote contra a média histórica da própria ficha). A pergunta aqui é
 * **terceira e diferente**: *"quanto de CADA componente entrou em cada LOTE que a ordem mandou
 * fazer?"* — a dose, não o rendimento.
 *
 * ⭐ É a pergunta que a perícia do acém respondeu à mão em 02/10: `beef de xis` 91 g e
 * `beef de hamburger` 110 g, doses **corretas e nunca alteradas** — e as razões efetivas em
 * 1,00–1,06, com **um outlier de 1,21 em 26/09**. Sem este invariante, aquele 1,21 só aparece
 * quando alguém for olhar de novo.
 *
 * ═══ ⛔⛔ O DENOMINADOR: A ESCALA DA ORDEM, NUNCA AS UNIDADES PRODUZIDAS ═══
 *
 * ⚠️⚠️ **A PROVA EM PROD PEGOU UM DEFEITO DE DESENHO MEU AQUI, e ele valia 107 avisos.** A 1ª
 * versão dividia o consumo por `qtdGerada` (unidades que saíram). Mas a dose da ficha é **POR
 * LOTE-BASE**, e `consumo ÷ qtdGerada = dose ÷ RENDIMENTO` — ou seja, a razão media o
 * **rendimento**, não a dose. Medido na Caçula: o rendimento vai de **0,0386 a 3,78** (umas
 * fichas fazem 1 receita → 184 porções, outras → 1), então a razão acusava **107 de 319
 * conclusões** — e acusava a pergunta que o **P3 já faz** (rendimento contra a média).
 *
 * ⭐ O denominador certo é a **ESCALA DA ORDEM** (`escalaReceitas`) — o PLANO. Aí
 * `consumo ÷ escala` é a dose por lote de verdade, e a razão contra a ficha dá **1,000** nas
 * ordens limpas e **1,154 / 1,173** nas desviantes: exatamente os números que a perícia do
 * acém mediu à mão em 02/10.
 *
 * ⛔ **E NÃO PODE SER `escalaConsumida`** (o campo da conclusão), por mais tentador que pareça:
 * ela é **DERIVADA do próprio consumo** (`escalaDoConsumo` = consumo ÷ porLote), então a razão
 * daria 1,000 **sempre**, por construção. Invariante circular é selo verde de graça — a mesma
 * armadilha do *"saldo na data do LEDGERBAL == LEDGERBAL"* de 28/08.
 *
 * ⚠️ **E A RAZÃO DE A FAIXA SER ±20%, medida:** o consumo fecha EXATO contra a escala em 13 de
 * 16 ordens recentes; o que sobra é a folga de separação (a cozinha tira um pouco mais da
 * câmara). Com ±20% acende o que tem sinal; com ±10% acenderia a rotina.
 */

/**
 * ═══ ⛔⛔⛔ E A SEGUNDA RODADA EM PROD DERRUBOU TAMBÉM O DENOMINADOR NOVO ═══
 *
 * Com a escala da ordem, o M2 caiu de 107 pra 81 — e trouxe razões de **+15344%**, **+8200%**,
 * **+11268%**. Medido: existem ordens cuja `escalaReceitas` (o PLANO) é pequena e a cozinha
 * separou/consumiu um lote inteiro. **Então a escala do plano também não é confiável no
 * histórico.**
 *
 * ⚠️⚠️ **A CONCLUSÃO HONESTA: "a dose está errada?" NÃO É SEPARÁVEL de "a escala está errada?"
 * com os dados que existem.** Há **uma** equação (o consumo) e **duas** incógnitas (a dose
 * efetiva e quantos lotes de verdade foram feitos). Qualquer denominador que eu escolha carrega
 * a outra incógnita — foi o que aconteceu com `qtdGerada` (carregou o rendimento) e com
 * `escalaReceitas` (carregou o erro de plano). *Invariante que não tem como estar certo é pior
 * que invariante nenhum.*
 *
 * ⭐⭐ **O QUE É SEPARÁVEL — E É EXATAMENTE O QUE O DONO PEDIU NO ITEM 4b:** *"ratio IDÊNTICO nos
 * 3 componentes = ESCALA; ratio só no acém = dose/versão da ficha — alguém mudou?"*
 *
 * A **comparação ENTRE COMPONENTES DA MESMA ORDEM** é imune ao denominador, porque o
 * denominador é **o mesmo pros três**. Se o acém consumiu 40% mais *em relação ao peito e à
 * gordura*, isso é a **DOSE dele** — não há escala no mundo que mexa num componente só.
 *
 * ⛔ Então o M2 passou a acusar **só a assinatura COMPONENTE**. O caso ESCALA (todos desviando
 * junto) **já tem dono: é o P3**, que compara o rendimento com a história da própria ficha —
 * emitir os dois seria o mesmo problema contado duas vezes, e o dono ia conferir três fichas
 * certas. ⚠️ E ficha de UM componente só não é avaliável: não há com que comparar, e inventar
 * um veredito ali seria o palpite que esta casa recusa em toda parte.
 */

export const DESVIO_DA_DOSE = 0.2

export interface DoseDaOrdem {
  itemId: string
  /** a dose POR LOTE declarada na versão da ficha que a ordem usou */
  doseDaFicha: number
  /** o que realmente foi consumido (PRODUCAO_CONSUMO, estorno já fora) */
  consumido: number
}

export interface DoseSuspeita {
  itemId: string
  doseDaFicha: number
  doseEfetiva: number
  /**
   * doseEfetiva ÷ doseDaFicha, **normalizada pela MEDIANA das razões dos irmãos**.
   *
   * ⭐ É isso que a torna livre do denominador: `1,40` quer dizer *"este componente consumiu
   * 40% mais do que a ficha manda, EM RELAÇÃO aos outros componentes da mesma ordem"*. Se a
   * escala/rendimento estiver errada, ela afeta os três igual e a normalização a cancela.
   */
  razao: number
  lado: 'ACIMA' | 'ABAIXO'
}

/**
 * PURA. Dose efetiva **por lote** = consumido ÷ escala da ORDEM; compara com a dose da ficha.
 *
 * ⛔ **Escala ou dose ZERO devolvem lista VAZIA, nunca um aviso** — sem escala não existe
 * "dose por lote", e inventar uma divisão por zero aqui é a mesma classe do *"tempo zero não é
 * velocidade infinita"* (06/09). Ordem sem produção é assunto do P2 (parada), não deste
 * invariante.
 */
export function dosesSuspeitas(
  doses: DoseDaOrdem[],
  escalaDaOrdem: number,
  desvio = DESVIO_DA_DOSE,
): DoseSuspeita[] {
  if (!(escalaDaOrdem > 0)) return []

  const uteis = doses.filter((d) => d.doseDaFicha > 0 && d.consumido > 0)
  /**
   * ⛔⛔ MENOS DE **TRÊS** COMPONENTES: NÃO É AVALIÁVEL — e o 3 não é gosto, é aritmética.
   *
   * Com **um**, não há irmão com que comparar: qualquer veredito seria o denominador falando,
   * e o denominador é justamente o que não dá pra confiar.
   *
   * ⚠️⚠️ **E com DOIS a régua MENTE CALANDO — o teste pegou isto.** A mediana de dois valores
   * é a média deles, então ela fica **no meio do desvio**: um componente 40% fora vira
   * `1,4/1,2 = +17%` e o irmão vira `1,0/1,2 = −17%` — **os dois abaixo do teto, e o
   * invariante cala num caso que ele existe pra achar**. Pior: cala em SILÊNCIO.
   *
   * ⭐ E a razão de fundo é a trava que esta casa já aplica em toda parte: com dois valores
   * divergindo **não há como saber QUAL dos dois está errado** — é o *"dois igualmente
   * parecidos = não sei qual é"* do PAO DE MEL (09/09) e do empate do pagamento de fatura
   * (25/09). Três é o mínimo em que a maioria define a referência.
   *
   * ⚠️ Fica REGISTRADO o que isto não alcança: ficha de 2 componentes não é vigiada por este
   * invariante. O P1 (contábil) e o P3 (rendimento) seguem valendo nela.
   */
  if (uteis.length < 3) return []

  const razoesCruas = uteis.map((d) => d.consumido / escalaDaOrdem / d.doseDaFicha)
  /**
   * ⭐ A MEDIANA (não a média) é a referência: ela não se move quando UM componente está
   * fora — que é exatamente o caso que este invariante existe pra achar. Com a média, o
   * desviante puxaria a própria referência e se esconderia.
   */
  const ordenadas = [...razoesCruas].sort((a, b) => a - b)
  const meio = Math.floor(ordenadas.length / 2)
  const mediana = ordenadas.length % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2
  if (!(mediana > 0)) return []

  const out: DoseSuspeita[] = []
  for (let i = 0; i < uteis.length; i++) {
    const d = uteis[i]
    const doseEfetiva = d.consumido / escalaDaOrdem
    // ⭐ normalizada: o denominador comum some, sobra a dose RELATIVA entre os irmãos
    const razao = razoesCruas[i] / mediana
    /**
     * ⚠️ O `1e-9` NÃO é folga de régua, é RUÍDO DE FLOAT: uma ordem exatamente na borda sai
     * como `1.2000000000000002` da divisão e acenderia um aviso por 2 quatrilionésimos.
     * Alarme por erro de ponto flutuante é a forma mais barata de um alarme perder a
     * credibilidade — e o teste da borda pegou isto antes de ir pro juiz noturno.
     */
    if (Math.abs(razao - 1) <= desvio + 1e-9) continue
    out.push({
      itemId: d.itemId,
      doseDaFicha: d.doseDaFicha,
      doseEfetiva,
      razao,
      lado: razao > 1 ? 'ACIMA' : 'ABAIXO',
    })
  }
  // maior desvio primeiro — é onde o dinheiro está
  out.sort((a, b) => Math.abs(b.razao - 1) - Math.abs(a.razao - 1))
  return out
}

/**
 * ⭐⭐ A ASSINATURA — a régua que o próprio dono ditou (item 4b): *"razão IDÊNTICA nos N
 * componentes = ESCALA (o caso da maionese); razão só em UM = dose ou versão de ficha."*
 *
 * ⚠️ Com a razão já NORMALIZADA pela mediana, o caso ESCALA some sozinho: se os três desviam
 * junto, a razão de cada um contra a mediana vira ~1,00 e nenhum entra na lista. **A
 * assinatura é, então, uma leitura do que SOBROU** — e é sempre COMPONENTE.
 *
 * ⛔ A função fica porque ela é o CONTRATO escrito dessa decisão: o dia em que alguém trocar a
 * normalização por uma razão crua, este tipo volta a ter dois valores possíveis e o teste
 * cobra. Ver o contrafactual em `plausibilidade-da-dose.test.ts`.
 */
export type AssinaturaDoDesvio = 'ESCALA' | 'COMPONENTE' | 'INDEFINIDA'

export function assinaturaDoDesvio(
  suspeitas: DoseSuspeita[],
  totalDeComponentes: number,
  tolerancia = 0.02,
): AssinaturaDoDesvio {
  if (!suspeitas.length) return 'INDEFINIDA'
  if (suspeitas.length === 1) return totalDeComponentes > 1 ? 'COMPONENTE' : 'INDEFINIDA'
  // ⚠️ só alcançável com razão CRUA (normalizada, todos-iguais nunca chega aqui)
  const todos = suspeitas.length === totalDeComponentes
  const iguais = suspeitas.every((s) => Math.abs(s.razao - suspeitas[0].razao) <= tolerancia)
  return todos && iguais ? 'ESCALA' : 'COMPONENTE'
}
