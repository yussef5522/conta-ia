/**
 * ⭐⭐⭐ O RECEBIDO — *"vendi X, já me pagaram Y, falta Z chegar"* (10/10/2026).
 *
 * **Ordem do dono:** *"RECEBIDO = créditos de venda no extrato (PIX + repasses de cartão,
 * pela lógica do retrato, dono único) + entradas de dinheiro no cofre do período."*
 *
 * ═══ O RETRATO DECIDIU A RÉGUA, e havia DUAS possíveis ═══
 *
 * Medido em prod (outubro, 01→31):
 * ```
 *   VENDIDO (PDV)                            R$ 186.940,50
 *   (a) recebido por COMPETÊNCIA              R$ 144.196,87   a caminho  R$ 42.743,63
 *   (b) recebido por CAIXA (caiu no período)  R$ 158.613,79   a caminho  R$ 28.326,71
 *                                             diferença entre as réguas: R$ 14.416,92
 * ```
 * ⭐⭐ **FICOU A (a), COMPETÊNCIA — e o motivo é que só nela a conta É VERDADEIRA.** A
 * pergunta do dono é sobre **AS VENDAS DESTE PERÍODO**: quanto DELAS já caiu. Em (b) o
 * `vendido − recebido` subtrai grandezas de **vendas diferentes** (o caixa do período inclui
 * o repasse de setembro e exclui o de outubro que cai em novembro), e o resultado **não
 * significa "falta chegar"** — seria um número plausível e sem sentido, que é o pior tipo.
 *
 * ⚠️⚠️ E A RESSALVA DO DONO (*"recebido > vendido"*) CONTINUA VALENDO EM (a) — por um motivo
 * que o retrato achou e que eu não tinha visto: **o BLOCO**. A `VendaDiaria` do cartão cobre
 * sex+sáb+dom numa linha só (medido: `02→04/10 CARTAO R$ 23.908,49`), e pela régua de
 * SOBREPOSIÇÃO ela entra INTEIRA em qualquer recorte que toque esses três dias. Num recorte
 * de **1 dia**, o recebido pode passar com folga o vendido daquele dia. ⛔ Não é defeito: é a
 * granularidade do que o banco informa. A tela mostra normal e o ⓘ explica — *"nunca
 * esconder"*, a ordem dele.
 *
 * ═══ ZERO MOTOR NOVO ═══
 *
 * ⛔⛔ A classificação *"este crédito é venda?"* **NÃO se repete aqui**. Ela é
 * `computeExpectedVendas` (`recompute-vendas.ts`), e a régua dela é dura: **só conta com
 * `RegraRecebimento`** (4 em prod: banrisul CARTAO D+1 útil · sicredi PIX D+1 útil · stone
 * PIX D+0 corrido · cofre DINHEIRO D+1 corrido) **e só categoria `RECEITA_BRUTA`** (26 em
 * prod) — ***pela CATEGORIA do dono, nunca pelo memo do banco***, a régua de 17/08. Este
 * arquivo **LÊ a `VendaDiaria` que aquele motor já gravou** e soma; escrever uma 2ª
 * classificação seria a doença dos 7 detectores de par.
 *
 * ⭐ O dinheiro do cofre entra de graça: ele é uma `RegraRecebimento` (`DINHEIRO`, D+1
 * corrido) como as outras. Medido: 12 lançamentos `MANUAL` em outubro, R$ 27.725,28 — o
 * motor já os pega porque a régua é conta+categoria, não origem do lançamento.
 */
import { cruzaOMes, type LinhaCompetencia } from './janela-mes'

/** ⭐ uma linha de `VendaDiaria` como esta lib precisa dela — nada mais */
export interface LinhaRecebida extends LinhaCompetencia {
  /**
   * ⚠️ O ESTORNO JÁ VEM COM SINAL AQUI — o motor grava `valorLiquido` negativo nele
   * (`signed = type === 'CREDIT' ? amount : -amount`), então somar tudo já o subtrai. ⛔ Por
   * isso **não há campo `tipo` nesta interface**: ele seria um campo que ninguém usa e que o
   * próximo leitor acharia que precisa checar — e aí passaria a subtrair DUAS vezes.
   */
  valorLiquido: number
  meio: string
}

export interface FaixaVendidoRecebido {
  /** ⭐ vem do cartão "mês até agora" — NUNCA somado por fora (o vermelho do dono) */
  vendido: number | null
  /** Σ da `VendaDiaria` que cruza o recorte — o que já caiu */
  recebido: number
  /** vendido − recebido. ⚠️ pode ser NEGATIVO (bloco atravessando a borda) */
  aCaminho: number | null
  /** 0..1 pra a barra — `null` quando não dá pra dizer */
  fracaoRecebida: number | null
  /** ⭐ a frase curta do "a caminho" */
  frase: string
  /** ⚠️ o extrato está atrás do recorte? `YYYY-MM-DD` da última linha conhecida */
  extratoAte: string | null
  /** ⭐ o recorte toca um bloco que começa ANTES dele — é o que explica recebido > vendido */
  blocoAtravessaBorda: boolean
  /** a composição do recebido, por meio */
  porMeio: { meio: string; valor: number }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * ⭐ A faixa. `vendido` vem de FORA (do cartão), de propósito — ver o vermelho do dono.
 *
 * @param vendido       o MESMO número do cartão "mês até agora"; `null` = a apurar
 * @param linhas        as `VendaDiaria` já filtradas pela janela (sobreposição)
 * @param de/ate        o recorte, `YYYY-MM-DD` inclusivo
 * @param extratoAte    `YYYY-MM-DD` da última linha de extrato conhecida, ou `null`
 */
export function montarFaixa(i: {
  vendido: number | null
  linhas: LinhaRecebida[]
  de: string
  ate: string
  extratoAte: string | null
}): FaixaVendidoRecebido {
  const ini = new Date(`${i.de}T00:00:00.000Z`)
  const fimEx = new Date(new Date(`${i.ate}T00:00:00.000Z`).getTime() + 86_400_000)

  /**
   * ⚠️ A SOBREPOSIÇÃO VEM DO DONO DELA (`cruzaOMes`), não de uma comparação local — é a
   * decisão que escondeu R$ 43.106,03 em 25/08 e gerou 111 alarmes falsos em 26/08, as duas
   * vezes porque um leitor foi corrigido e o outro não.
   */
  const dentro = i.linhas.filter((l) => cruzaOMes(l, ini, fimEx))

  const recebido = round2(dentro.reduce((a, l) => a + l.valorLiquido, 0))

  const porMeioMap = new Map<string, number>()
  for (const l of dentro) porMeioMap.set(l.meio, round2((porMeioMap.get(l.meio) ?? 0) + l.valorLiquido))
  const porMeio = [...porMeioMap].map(([meio, valor]) => ({ meio, valor }))
    .sort((a, b) => b.valor - a.valor)

  const blocoAtravessaBorda = dentro.some((l) => l.dataCompetencia.getTime() < ini.getTime())

  /**
   * ⛔⛔ O EXTRATO SÓ É "ATRÁS" QUANDO ELE DE FATO NÃO ALCANÇA O RECORTE. Medido em prod:
   * banrisul/sicredi/stone até **09/10** e o recorte do mês vai até 31/10 — então a ressalva
   * é NECESSÁRIA hoje, não hipotética. ⚠️ E ela só aparece quando morde: dizer *"importado
   * até 31/10"* num recorte que acaba em 31/10 é ruído, e ruído é como um número para de ser
   * lido.
   */
  const extratoAtras = i.extratoAte != null && i.extratoAte < i.ate
  const extratoAte = extratoAtras ? i.extratoAte : null

  const aCaminho = i.vendido == null ? null : round2(i.vendido - recebido)

  /**
   * ⛔⛔⛔ NUNCA DECOMPOR SEM DADO (ordem do dono). A frase diz **as duas causas possíveis**
   * e para aí: dizer *"R$ X de cartão a receber"* exigiria saber qual parte é cartão não
   * repassado e qual é extrato que falta importar — e **o sistema não tem esse dado**.
   * Decompor seria inventar, e número inventado numa faixa de dinheiro sai plausível.
   */
  const frase = (() => {
    if (i.vendido == null) return 'sem venda medida no período — a apurar'
    if (aCaminho != null && aCaminho < 0) {
      return blocoAtravessaBorda
        ? 'recebido passa o vendido: um repasse do fim de semana anterior caiu dentro deste recorte'
        : 'recebido passa o vendido no período — veja o ⓘ'
    }
    if (aCaminho === 0) return 'tudo que foi vendido já caiu na conta'
    return extratoAtras
      ? `cartão a receber · ou extrato ainda não importado (está em ${ddmm(i.extratoAte!)})`
      : 'cartão a receber · ou extrato ainda não importado'
  })()

  /**
   * ⚠️ A FRAÇÃO É CLAMPADA EM 0..1 **SÓ PRA A BARRA** (ela não pode passar da largura nem
   * virar negativa), e o NÚMERO continua o real — a barra é desenho, o número é o fato.
   */
  const fracaoRecebida = i.vendido == null || i.vendido <= 0
    ? null
    : Math.max(0, Math.min(1, recebido / i.vendido))

  return { vendido: i.vendido, recebido, aCaminho, fracaoRecebida, frase, extratoAte, blocoAtravessaBorda, porMeio }
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
