/**
 * ⭐⭐⭐ A PORTA ÚNICA DO VEREDITO DE PREÇO (13/10/2026) — farol, charme, gross-up e frases.
 *
 * **Ordem do dono:** *"Farol, charme, gross-up e frases moram numa LIB PURA só (porta única do
 * veredito de preço), usada pelos DOIS cartões — e é nela que os testes batem. Conta de
 * veredito duplicada em tela = vermelho."*
 *
 * ⛔⛔ E aqui a duplicação seria pior que de costume: o montador de pizza e o cartão
 * "escolha um produto" ficam **lado a lado, na mesma dobra da mesma página**. Duas contas
 * divergindo a dez centímetros uma da outra é como a confiança na tela se perde — é a lição
 * do B1 (dois leitores, duas respostas) com as duas respostas visíveis ao mesmo tempo.
 *
 * ⛔ **PURA de propósito, zero import de `prisma`.** Quem lê o banco é a leitura; aqui só
 * entram números. É isso que permite o red-first sem banco e o teste de propriedade do
 * gross-up (6 custos × 6 alvos) rodar em milissegundos.
 *
 * ⚠️ **A ESCALA É FRAÇÃO onde o número ATRAVESSA** (`cmvPct: 0.6357`, `taxaPct: 0.2`) — a
 * mesma convenção de `canais.ts` e de `margem.pct`. Os **TETOS e ALVOS** ficam em PERCENTO
 * INTEIRO (`tetoPct: 33`) porque é assim que o dono fala (*"pizza 33 · lanche 35 · porção
 * 40"*) e é assim que o chip aparece na tela — e o mapa tem que ser conferível contra as
 * palavras dele sem tradução no meio. A conversão acontece **num lugar só**, aqui dentro.
 *
 * ⚠️ O percentual sai pelo **`pctBR`** (dono único do projeto desde 10/10) — a referência v4
 * aponta pra ele por escrito: *"pctBR, dono único de %"*. Divergência conhecida e aceita: o
 * `toLocaleString` da referência imprime `33%` e o `pctBR` da casa imprime `33,0%`. Mantive o
 * dono único: uma 4ª formatação de percentual nasceria no 1º módulo que não soubesse dele.
 */
import { pctBR } from '@/lib/format/percentual'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐ O DEGRAU DO ÂMBAR — acima dele é *"fora do padrão"* em QUALQUER categoria.
 *
 * ⛔ Mora aqui e não digitado na tela: número solto em tela é a segunda régua no dia em que
 * ele mudar (a cicatriz do `TETO = 25` hardcoded da conciliação e do `30` da janela do
 * "a vencer"). Ele é também o **último alvo** de toda categoria — ver `REGUA_POR_SECAO`.
 */
export const TETO_AMBAR_PCT = 45

export type TomDoFarol = 'verde' | 'ambar' | 'coral' | 'neutro'

export interface Farol {
  tom: TomDoFarol
  /** pronto pra tela, com o % em pt-BR; no neutro **não carrega número nenhum** */
  rotulo: string
  /** FRAÇÃO (0.6357 = 63,57%) · `null` quando não dá pra calcular */
  cmvPct: number | null
}

/**
 * ⭐ O FAROL — `CMV = custo ÷ preço`, com o teto da categoria.
 *
 * ≤ teto → verde *"no padrão"* · ≤ 45 → âmbar *"apertado"* · > 45 → coral *"fora do padrão"*.
 *
 * ⛔⛔ **Sem custo fechado ou sem preço → NEUTRO, e o rótulo não tem UM dígito.** Número
 * inventado numa tela de preço é o pior palpite possível: ele é **obedecido** — o dono
 * remarca o cardápio em cima dele. É a mesma régua do *"sem contagem" nunca vira zero* do
 * estoque e do *"a apurar" nunca vira R$ 0,00* dos custos fixos.
 */
export function farolDoPreco(
  custo: number | null,
  preco: number | null,
  tetoPct: number,
  opts?: { motivoNeutro?: string },
): Farol {
  if (custo == null || preco == null || preco <= 0) {
    return { tom: 'neutro', rotulo: opts?.motivoNeutro ?? '—', cmvPct: null }
  }
  const cmvPct = custo / preco
  const teto = tetoPct / 100
  const ambar = TETO_AMBAR_PCT / 100
  const corpo = `CMV ${pctBR(cmvPct)}`

  if (cmvPct <= teto + 1e-9) return { tom: 'verde', rotulo: `${corpo} · no padrão`, cmvPct }
  if (cmvPct <= ambar + 1e-9) return { tom: 'ambar', rotulo: `${corpo} · apertado`, cmvPct }
  return { tom: 'coral', rotulo: `${corpo} · fora do padrão`, cmvPct }
}

/**
 * ⭐⭐ O CHARME — todo preço ideal termina em `,90` e **NUNCA fica abaixo do ideal cru**.
 *
 * ⛔ A direção importa e é a parte que protege o dinheiro: arredondar `30,30` pra `29,90`
 * seria **cortar a margem que o alvo acabou de pedir** — o sistema entregaria um preço que
 * não cumpre o alvo que ele próprio sugeriu. Então sobe (`30,90`), nunca desce.
 *
 * ⚠️ Valor que já termina em `,90` fica como está: subir pro `,90` seguinte inventaria margem
 * que ninguém pediu.
 */
export function charme(bruto: number): number {
  const chao = Math.floor(bruto)
  let r = chao + 0.9
  if (r < bruto - 1e-9) r = chao + 1.9
  return round2(r)
}

export interface CanalDoVeredito {
  canal: string
  /** FRAÇÃO · `null` = o dono ainda não declarou a taxa deste canal */
  taxaPct: number | null
}

export interface PrecoIdealDoCanal {
  canal: string
  /** `null` quando não dá pra calcular — e aí a tela diz *"a apurar"*, nunca R$ 0,00 */
  preco: number | null
  sobra: number | null
  taxaPct: number | null
  porque: string | null
}

/**
 * ⭐⭐⭐ OS PREÇOS IDEAIS — e o **GROSS-UP** é o coração disto.
 *
 * O balcão é direto: `ideal = charme(custo ÷ alvo)`, e a `sobra` é o que fica depois dele.
 *
 * ⛔⛔ **O iFood ganha preço PRÓPRIO, calculado pra DEIXAR A MESMA SOBRA** —
 * `preço × (1 − taxa) − custo == sobra do balcão` — e **NUNCA o preço do balcão**. Copiar o
 * preço entregaria a taxa de graça: a plataforma leva 20% do faturamento, então vender a
 * R$ 30,90 no app deixa R$ 14,72 onde o balcão deixa R$ 20,90. É o mesmo raciocínio do
 * `sobraNoCanal` (*"a taxa incide sobre o PREÇO, nunca sobre a sobra"*), de cabeça pra baixo:
 * lá a gente mede a sobra de um preço dado; aqui a gente acha o preço de uma sobra pedida.
 *
 * ⚠️ **O gross-up é EXATO antes do charme, e o charme vem DEPOIS** (é a ordem da referência
 * v4). Como o charme só SOBE, a sobra do iFood sai **igual ou MAIOR** que a do balcão, nunca
 * menor — e há teste de propriedade varrendo 6 custos × 6 alvos exigindo exatamente isso.
 *
 * ⛔ Taxa `null` não vira 0%: a sobra sairia maior que a real **justo no canal em que ela é
 * menor**. Devolve `a apurar` com o porquê.
 */
export function precosIdeais(
  custo: number | null,
  alvoPct: number,
  canais: readonly CanalDoVeredito[],
): PrecoIdealDoCanal[] {
  if (custo == null) {
    return canais.map((c) => ({
      canal: c.canal,
      preco: null,
      sobra: null,
      taxaPct: c.taxaPct,
      porque: 'precisa da ficha',
    }))
  }

  const idealBase = charme(custo / (alvoPct / 100))
  const sobraBase = round2(idealBase - custo)

  return canais.map((c) => {
    if (c.taxaPct == null) {
      return {
        canal: c.canal,
        preco: null,
        sobra: null,
        taxaPct: null,
        porque: 'taxa deste canal a declarar',
      }
    }
    if (c.taxaPct <= 0) {
      // ⚠️ canal sem taxa (balcão, tele própria) é o preço base — não existe gross-up de zero
      return { canal: c.canal, preco: idealBase, sobra: sobraBase, taxaPct: c.taxaPct, porque: null }
    }
    const preco = charme((custo + sobraBase) / (1 - c.taxaPct))
    const sobra = round2(preco * (1 - c.taxaPct) - custo)
    return { canal: c.canal, preco, sobra, taxaPct: c.taxaPct, porque: null }
  })
}

/** ⭐ o ideal de UM canal — casca fina sobre `precosIdeais`, pra não existir 2ª conta */
export function precoIdealDoCanal(
  custo: number | null,
  alvoPct: number,
  canal: CanalDoVeredito,
): number | null {
  return precosIdeais(custo, alvoPct, [canal])[0].preco
}

// ────────────────────────────────────────────────────────────────
// A RÉGUA POR CATEGORIA
// ────────────────────────────────────────────────────────────────

export interface ReguaDaCategoria {
  /** PERCENTO INTEIRO, como o dono fala */
  tetoPct: number
  /** os 3 chips, o do meio sempre é o teto */
  alvosPct: readonly number[]
  origem: 'DECLARADO' | 'DERIVADO'
  porque: string
}

/**
 * ⭐ A DERIVAÇÃO DOS ALVOS — `[teto − 5, teto, 45]`, e ela não foi escolhida: foi MEDIDA.
 *
 * O dono deu dois conjuntos e os dois obedecem essa régua: pizza teto 33 → `28/33/45` (é o que
 * a referência v4 desenha nos chips) e lanche teto 35 → `30/35/45` (as palavras dele). Então o
 * terceiro (porção, teto 40 → `35/40/45`) sai da MESMA régua, sem inventar número.
 *
 * ⚠️ E o último chip ser sempre `45` tem significado: é o degrau do âmbar — *"o alvo mais
 * frouxo que ainda não é «fora do padrão»"*. Não é um número a mais, é o limite do farol.
 */
function alvosDe(tetoPct: number): readonly number[] {
  return [tetoPct - 5, tetoPct, TETO_AMBAR_PCT]
}

const declarado = (tetoPct: number, porque: string): ReguaDaCategoria => ({
  tetoPct,
  alvosPct: alvosDe(tetoPct),
  origem: 'DECLARADO',
  porque,
})
const derivado = (tetoPct: number, porque: string): ReguaDaCategoria => ({
  tetoPct,
  alvosPct: alvosDe(tetoPct),
  origem: 'DERIVADO',
  porque,
})

/**
 * ⭐⭐ UM MAPA SÓ — e ele pendura nas **seções do cardápio que a casa JÁ TEM**.
 *
 * ⛔⛔ O dono mandou: *"se a casa ainda não tem categoria de produto, derivar do que já existe
 * e RELATAR a escolha — nunca dois mapas."* **Ela TEM**: `SECOES_SEED` (XIS · BURGERS ·
 * LANCHES · PORÇÕES · FRANGO FRITO · PRATOS · PIZZAS · BEBIDAS · DOCES · OUTROS), com
 * `sugerirSecao()` sugerindo e o martelo do dono confirmando, desde 08/09. Criar um
 * vocabulário novo aqui (`pizza|lanche|porcao`) seria **o segundo mapa que a ordem proíbe** —
 * e ele divergiria do cardápio no primeiro produto que o dono reclassificasse na tela.
 *
 * ⚠️ `DECLARADO` = o dono disse, ou a referência v4 aprovada escreve o teto no exemplo
 * (`prato alaminuta: teto 40`, `porção frango frito: teto 40`, os `xis` em 35, a pizza em 33).
 * `DERIVADO` = ninguém disse ainda, e a tela **marca como derivado** em vez de calar.
 */
export const REGUA_POR_SECAO: Record<string, ReguaDaCategoria> = {
  PIZZAS: declarado(33, 'o dono: "pizza 33" · a referência v4 desenha os chips 28/33/45'),
  XIS: declarado(35, 'o dono: "lanche 35" · a referência v4 põe os dois xis em teto 35'),
  BURGERS: declarado(35, 'o dono: "lanche 35" · o hambúrguer da casa está em 35 na referência'),
  LANCHES: declarado(35, 'o dono: "lanche 35", com os alvos 30/35/45'),
  PORCOES: declarado(40, 'o dono: "porção 40"'),
  FRANGO_FRITO: declarado(40, 'a referência v4 põe "porção frango frito" em teto 40'),
  PRATOS: declarado(40, 'a referência v4 põe "prato alaminuta" em teto 40'),
  BEBIDAS: derivado(40, 'o dono não declarou o teto de bebida — vale o mais frouxo dos três'),
  DOCES: derivado(40, 'o dono não declarou o teto de doce — vale o mais frouxo dos três'),
  OUTROS: derivado(40, 'sem categoria declarada — vale o mais frouxo dos três'),
}

/** ⭐ o teto de quem não tem seção: o MAIS FROUXO dos três que o dono declarou */
const TETO_SEM_SECAO = 40

/**
 * ⭐ A RÉGUA DE UM PRODUTO — pela seção dele no cardápio.
 *
 * ⛔⛔ **Seção desconhecida cai no teto MAIS FROUXO, de propósito.** O instinto da casa é
 * *"grupo novo cai no lado que EXIGE"* (custos fixos, 06/10) — e aqui ele se inverte, porque
 * o que está em jogo é um **FAROL**: teto apertado num produto que ninguém classificou faria
 * a tela gritar coral à toa, e **alarme falso repetido é como um alarme morre** (os 111 do
 * juiz de vendas). O produto que é mesmo ruim passa de 45 e vira coral de qualquer jeito —
 * esse não escapa. E a tela DIZ que o teto é derivado.
 */
export function reguaDaSecao(secao: string | null | undefined): ReguaDaCategoria {
  if (!secao) {
    return derivado(TETO_SEM_SECAO, 'produto sem seção no cardápio — vale o teto mais frouxo')
  }
  return (
    REGUA_POR_SECAO[secao] ??
    derivado(TETO_SEM_SECAO, `a seção "${secao}" ainda não tem teto declarado`)
  )
}

/**
 * ⭐⭐⭐ O TETO DE UMA CESTA — média dos tetos **PONDERADA PELO CUSTO** (ordem do dono).
 *
 * ⛔ Média simples seria errada de um jeito caro: num combo de **xis (teto 35) + coca (teto
 * 40)**, o xis custa R$ 12 e a coca R$ 2 — a média simples daria 37,5, tratando a coca como
 * metade da decisão quando ela é **1/7 do custo**. Ponderando pelo dinheiro, o teto fica em
 * ~35,7: *quem manda no CMV do combo é quem pesa no custo dele*.
 *
 * ⚠️ **Item SEM custo entra com peso ZERO** — não dá pra ponderar pelo que não se sabe, e o
 * combo inteiro já vai sair *"a apurar"* nesse caso (o teto ali é informativo). ⚠️ E se
 * NENHUM item tem custo, cai na **média simples**: é o único peso disponível, e calar o teto
 * deixaria a linha pequena sem número nenhum sem motivo.
 *
 * ⛔ O resultado é **arredondado** (o dono fala em teto inteiro: *"pizza 33 · lanche 35"*) e os
 * alvos saem do MESMO `alvosDe` do mapa — um `[teto−5, teto, 45]` escrito à mão aqui seria a
 * 2ª régua de alvo.
 */
export function reguaPonderada(
  itens: readonly { tetoPct: number; peso: number | null }[],
): ReguaDaCategoria {
  if (itens.length === 0) {
    return derivado(TETO_SEM_SECAO, 'cesta vazia — vale o teto mais frouxo')
  }
  const comPeso = itens.filter((i) => i.peso != null && i.peso > 0) as { tetoPct: number; peso: number }[]
  const base = comPeso.length > 0 ? comPeso : itens.map((i) => ({ tetoPct: i.tetoPct, peso: 1 }))
  const somaPeso = base.reduce((a, i) => a + i.peso, 0)
  const tetoPct = Math.round(base.reduce((a, i) => a + i.tetoPct * i.peso, 0) / somaPeso)

  const tetosDistintos = new Set(itens.map((i) => i.tetoPct)).size
  return {
    tetoPct,
    alvosPct: alvosDe(tetoPct),
    origem: 'DERIVADO',
    porque:
      tetosDistintos === 1
        ? `todos os itens da cesta têm teto ${tetoPct}%`
        : comPeso.length > 0
          ? `média dos tetos da cesta ponderada pelo custo (${itens.length} itens)`
          : 'média simples dos tetos — nenhum item da cesta tem custo pra ponderar',
  }
}

// ────────────────────────────────────────────────────────────────
// O BLOCO — o que os DOIS cartões desenham
// ────────────────────────────────────────────────────────────────

export interface BlocoDoVeredito {
  farol: Farol
  tetoPct: number
  /** os 3 chips de alvo · o do meio é o teto da categoria */
  alvosPct: readonly number[]
  /** qual chip está ligado */
  alvoPct: number
  canais: PrecoIdealDoCanal[]
  /** ⚠️ texto puro — o rótulo "Especialista:" é da TELA */
  frase: string
}

/**
 * ⭐⭐⭐ A CHAMADA ÚNICA — é por aqui que o montador de pizza E o cartão de produto passam.
 *
 * ⛔ Um bloco só, montado num lugar só. Se cada cartão chamasse `farolDoPreco`, `precosIdeais`
 * e `fraseDoEspecialista` por conta própria, a ordem das decisões (qual alvo, qual teto, o
 * que fazer com custo pendente) viveria **duas vezes** — e divergiria no primeiro estado de
 * borda, que aqui é o mais comum de todos: **a pizza com fatia em aberto**.
 *
 * ⚠️ `custo == null` carrega o `motivoNeutro` pra a frente: no montador ele é *"fecha a
 * pizza"* (falta escolher sabor) e no produto é *"—"* (falta a ficha). Dois estados
 * diferentes, duas frases — e nenhum deles mostra número.
 */
export function montarBlocoDoVeredito(opts: {
  custo: number | null
  preco: number | null
  tetoPct: number
  alvosPct: readonly number[]
  alvoPct: number
  canais: readonly CanalDoVeredito[]
  tipo: TipoDoVeredito
  motivoNeutro?: string
}): BlocoDoVeredito {
  return {
    farol: farolDoPreco(opts.custo, opts.preco, opts.tetoPct, { motivoNeutro: opts.motivoNeutro }),
    tetoPct: opts.tetoPct,
    alvosPct: opts.alvosPct,
    alvoPct: opts.alvoPct,
    canais: precosIdeais(opts.custo, opts.alvoPct, opts.canais),
    frase: fraseDoEspecialista(opts.custo, opts.preco, opts.tetoPct, opts.tipo),
  }
}

// ────────────────────────────────────────────────────────────────
// A FRASE DO ESPECIALISTA
// ────────────────────────────────────────────────────────────────

/**
 * ⚠️ `'combo'` entra aqui (e não só na `fraseDoCombo`) por uma razão de segurança: o bloco do
 * combo SUBSTITUI a frase pela do combo, e se amanhã alguém ler `bloco.frase` sem substituir,
 * a frase tem que ser verdadeira pra uma CESTA — nunca a do produto único falando de "ficha"
 * no singular. Cada tipo responde por si no ramo do "fora do padrão".
 */
export type TipoDoVeredito = 'pizza' | 'produto' | 'combo'

/**
 * ⭐ AS FRASES DA REFERÊNCIA — curtas, língua do balcão, uma por estado.
 *
 * ⛔ **Texto PURO, sem markdown nem HTML.** A referência escreve `<b>Especialista:</b>` porque
 * ela é uma página solta; na tela quem desenha o rótulo é o componente, e `{frase}` renderiza
 * como texto. É a cicatriz de 11/10 (*a frase do `MEDIA_DESTOA` carregava `**` e o dono veria
 * os asteriscos*) — marcação é convenção dos COMENTÁRIOS deste repo e não atravessa pra UI.
 *
 * ⚠️ E a frase do *"fora do padrão"* muda com o TIPO: pizza vira linha premium (um sabor caro
 * é um item de tabela própria), produto pede revisão de tabela ou de ficha. Dizer "sabor
 * premium" sobre um prato feito é o sistema errando o nome do que o dono vende.
 */
export function fraseDoEspecialista(
  custo: number | null,
  preco: number | null,
  tetoPct: number,
  tipo: TipoDoVeredito,
): string {
  if (custo == null) {
    return tipo === 'combo'
      ? 'tem item sem ficha na cesta — cria a ficha que eu calculo o combo inteiro.'
      : 'sem ficha eu não calculo — cria a ficha que eu te digo o preço na hora.'
  }
  if (preco == null || preco <= 0) {
    return tipo === 'combo'
      ? 'digita o preço do combo que eu dou o veredito.'
      : 'digita o preço de hoje que eu dou o veredito.'
  }
  const cmvPct = custo / preco
  if (cmvPct > TETO_AMBAR_PCT / 100 + 1e-9) {
    if (tipo === 'pizza') {
      return 'esse sabor não cabe na tabela comum. Ou vira linha premium com preço próprio, ou o mix compensa.'
    }
    return tipo === 'combo'
      ? 'sobe o preço ou tira o item caro da cesta.'
      : 'esse produto tá consumindo demais do preço. Ou sobe a tabela, ou revisa a ficha.'
  }
  if (cmvPct > tetoPct / 100 + 1e-9) {
    return 'acima do teto — só fecha se o resto do cardápio segurar a média.'
  }
  return 'saudável. O jogo agora é a média do cardápio inteiro.'
}

/** ⭐ acima disso o desconto deixou de ser atrativo e passou a ser dinheiro dado */
export const VANTAGEM_GENEROSA_PCT = 20

/**
 * ⭐⭐ A FRASE DO COMBO — estados do mock, curta, no máximo 2 frases.
 *
 * ⛔ Mora AQUI e não na tela porque frase de veredito tem um dono (o guard
 * `veredito-tem-uma-porta-so` existe por isso) — mas os ESTADOS são próprios do combo e não
 * cabiam no `fraseDoEspecialista`: eles dependem de `avulsos` e da vantagem, que só existem
 * quando há cesta. Reusar aquele exigiria dois parâmetros que não significam nada no produto
 * único.
 *
 * ⚠️ **A ORDEM DOS ESTADOS É A DO PREJUÍZO**, não a do mock: *"o ideal não fecha"* vem antes
 * de tudo porque ali o problema **não é o combo** — é o preço avulso de um item da cesta, e
 * mandar o dono mexer no combo o faria caçar no lugar errado (a lição de 16/09).
 */
export function fraseDoCombo(opts: {
  custoDoCombo: number | null
  avulsos: number | null
  /** o preço que o dono digitou pro combo — `null` = ainda não digitou */
  preco: number | null
  /** o ideal no alvo ligado, pro canal principal */
  ideal: number | null
  tetoPct: number
  /** FRAÇÃO (0.18 = 18%) · `null` = não dá pra calcular */
  vantagemPct: number | null
}): string {
  if (opts.custoDoCombo == null) {
    return 'tem item sem ficha na cesta — cria a ficha que eu calculo o combo inteiro.'
  }
  /**
   * ⛔⛔ O IDEAL ACIMA DOS AVULSOS é o diagnóstico mais importante do cartão: significa que
   * vender junto no alvo pedido sairia MAIS CARO que vender separado — ou seja, **o preço
   * avulso de algum item já está abaixo do que ele deveria custar**. O combo não tem como
   * consertar isso.
   */
  if (opts.ideal != null && opts.avulsos != null && opts.ideal > opts.avulsos + 0.005) {
    return 'nesse alvo o combo não fecha — o problema tá no preço avulso de algum item da cesta.'
  }
  if (opts.vantagemPct != null && opts.vantagemPct > VANTAGEM_GENEROSA_PCT / 100 + 1e-9) {
    return 'generoso demais — 10–15% já leva o cliente.'
  }
  if (opts.preco != null && opts.preco > 0) {
    const cmvPct = opts.custoDoCombo / opts.preco
    if (cmvPct > TETO_AMBAR_PCT / 100 + 1e-9) {
      return 'sobe o preço ou tira o item caro da cesta.'
    }
    if (opts.vantagemPct != null) {
      return `cliente ganha ${pctBR(opts.vantagemPct)}, a casa fica com CMV ${pctBR(cmvPct)}.`
    }
  }
  return 'digita o preço do combo que eu dou o veredito.'
}
