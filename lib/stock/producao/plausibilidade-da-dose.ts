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
  /** doseEfetiva ÷ doseDaFicha — 1,21 quer dizer "21% a mais por lote" */
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
  const out: DoseSuspeita[] = []
  for (const d of doses) {
    if (!(d.doseDaFicha > 0) || !(d.consumido > 0)) continue
    const doseEfetiva = d.consumido / escalaDaOrdem
    const razao = doseEfetiva / d.doseDaFicha
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
 * ⭐⭐ A ASSINATURA — a régua que o próprio dono ditou pra ler o resultado (04/10 do pedido):
 * *"razão IDÊNTICA nos N componentes = ESCALA (o caso da maionese); razão só em UM = dose ou
 * versão de ficha."*
 *
 * ⚠️ Isto é o que transforma o aviso em DIAGNÓSTICO: sem a assinatura, três avisos de ±21%
 * na mesma ordem parecem três problemas, quando são **um** (a escala) — e mandariam o dono
 * conferir três fichas que estão certas.
 */
export type AssinaturaDoDesvio = 'ESCALA' | 'COMPONENTE' | 'INDEFINIDA'

export function assinaturaDoDesvio(
  suspeitas: DoseSuspeita[],
  totalDeComponentes: number,
  tolerancia = 0.02,
): AssinaturaDoDesvio {
  if (!suspeitas.length) return 'INDEFINIDA'
  if (suspeitas.length === 1) return totalDeComponentes > 1 ? 'COMPONENTE' : 'INDEFINIDA'
  // ⭐ TODOS os componentes desviando com a MESMA razão = a escala, não as doses
  const todos = suspeitas.length === totalDeComponentes
  const iguais = suspeitas.every((s) => Math.abs(s.razao - suspeitas[0].razao) <= tolerancia)
  return todos && iguais ? 'ESCALA' : 'COMPONENTE'
}
