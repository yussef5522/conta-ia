/**
 * ⭐⭐⭐ A LEITURA DA TELA CONSUMO & COMPRAS — ORQUESTRADOR, não motor (16/10/2026).
 *
 * **Ordem do dono:** *"CONSUMO = O LIVRO (baixas + separações), nunca digitado; dia sem dado =
 * 'a apurar' — proibido inventar"* e *"PERDA real × teórico: use as MESMAS portas da tela Real
 * vs Teórico — tradutor puro, ZERO matcher novo"*.
 *
 * ═══ ⛔⛔ ZERO CONTA NOVA — ESTE ARQUIVO SÓ COSTURA PORTAS QUE JÁ EXISTEM ═══
 *
 * | pergunta                        | quem responde (dono único)                        |
 * |---------------------------------|---------------------------------------------------|
 * | *o que conta como consumo?*     | `consumoPorDiaDoItem` (06/10, baldes do `TIPOS`)  |
 * | *quanto este dia-da-semana usa?*| `mediaPorDiaDaSemana` (vendas, 15/10)             |
 * | *qual é a janela do período?*   | `janelaDaMargem` (a mesma da margem e da casa)    |
 * | *quanto tem na prateleira?*     | `saldosDaEmpresa` (a porta da Posição)            |
 * | *quanto vale uma unidade?*      | `custoVigentePorItem` (lei-do-custo-medio, 13/10) |
 * | *quanto faltou de verdade?*     | `calcularRealVsTeorico` (a tela de variância)     |
 * | *quais itens o dono acompanha?* | `listasDoRadar` (`stock_radar_item`, 20/09)       |
 * | *quando a mercadoria chega?*    | `configsDeCompraDaEmpresa` (a porta de 16/10)     |
 * | *quanto pedir / quanto produzir?*| `contaDoPedido` / `contaDoPlano` (a lib PURA)    |
 *
 * ⛔ Uma régua própria pra qualquer uma dessas linhas faria esta tela discordar da tela irmã no
 * primeiro caso de borda — e *"duas telas com números diferentes pro mesmo dia é a doença que
 * esta casa mais paga"*.
 *
 * ═══ ⚠️⚠️ TRÊS DIVERGÊNCIAS DO BRIEF, DECLARADAS COM O MOTIVO ═══
 *
 * **1. A PERDA ENTRA NO CONSUMO** (o brief diz *"baixas + separações"*). O dono único
 * (`consumoDoItem`, 06/10) inclui `PERDA`/`USO_INTERNO`, e **está certo pra a conta do PEDIDO**:
 * o que estraga SAI da prateleira, e um pedido que cobre só a venda deixa faltar no balcão.
 * ⚠️ Escrever aqui um balde "só venda+separação" seria a 2ª resposta pra *"o que saiu"*, com a
 * tela da ficha do item dizendo um número e esta dizendo outro. A perda segue aparecendo
 * **NOMEADA** no seu módulo, pela porta do Real vs Teórico.
 *
 * **2. `montarDias` NÃO é reusado.** Ele decide a `fonte` do dia por PDV/extrato/bloco — o
 * vocabulário de VENDAS — e exigiria fabricar um mapa de PDV falso pra consumo. O que se reusa
 * é a **média por dia-da-semana**, que é a pergunta de fato compartilhada (o parâmetro dela foi
 * alargado pro mínimo estrutural em 16/10, sem regressão).
 *
 * **3. PARA ONDE FOI só afirma o que o LEDGER PROVA.** A separação carrega a ordem → a ficha →
 * o nome da receita. A `BAIXA_VENDA`, não: ela é o resultado de uma explosão que **não fica
 * gravada no movimento**. ⛔ Re-explodir hoje atribuiria a receita de HOJE a uma baixa de ontem
 * — exatamente o que o M1 passa as noites avisando (*"a ficha mudou depois desta baixa"*). Então
 * a venda aparece como balde PRÓPRIO e nomeado, nunca rateada por palpite.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { listasDoRadar } from '@/lib/stock/radar/watchlist'
import { saldosDaEmpresa } from '@/lib/stock/saldo'
import { custoVigentePorItem } from '@/lib/stock/custo-vigente'
import { calcularRealVsTeorico, TIPOS, PISO_DADOS } from '@/lib/stock/real-vs-teorico'
import { consumoPorDiaDoItem, type MovimentoParaConsumo } from '@/lib/stock/item/consumo-e-cobertura'
import { mediaPorDiaDaSemana, MIN_AMOSTRAS_DO_DIA } from '@/lib/vendas/dia-a-dia'
import { janelaDaMargem, hojeBrasil, type PeriodoDaMargem, type JanelaDaMargem } from '@/lib/margem/janela'
import { configsDeCompraDaEmpresa, configPadrao, type ConfigDeCompra } from './config-de-compra'
import {
  montarDias,
  entraNaMedia,
  temDiaAApurar,
  legendaDaCobertura,
  type EstadoDoDia,
} from './dia-do-consumo'
import { medirPendenciaDoLivro, pendentesDoItem, cobertoDesdeDoItem } from './pendencia-do-livro'
import {
  contaDoPedido,
  contaDoPlano,
  coberturaEmDias,
  farolDaCobertura,
  diaPedir,
  textoDoPedido,
  totalDoCard,
  segPrimeiro,
  DIAS_DA_BASELINE,
  COMPRAS_NA_MEDIA,
  DIAS,
  type ContaDoPedido,
  type ContaDoPlano,
  type FarolDaCobertura,
} from './consumo-e-compras'

const DIA_MS = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
const diaDaSemanaDe = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()

/** ⭐ quantas semanas o spark do herói mostra (lei C3) */
export const SEMANAS_DO_SPARK = 8

/** ⚠️ os baldes que o LEDGER sabe nomear — ver a divergência 3 no cabeçalho */
const TIPOS_DE_SEPARACAO = new Set<string>([...TIPOS.SEPARACAO, ...TIPOS.DEVOLUCAO])
const TIPOS_DE_VENDA = new Set<string>(TIPOS.VENDA)
const TIPOS_DE_ENTRADA = new Set<string>(TIPOS.ENTRADA)

export interface DestinoDoConsumo {
  /** o nome da receita que consumiu, ou o balde nomeado da venda */
  nome: string
  quantidade: number
  pct: number
  /** ⭐ pra onde o clique leva — *número morto é proibido* */
  fichaId: string | null
}

export interface PrecoPago {
  /** a última compra (custo por unidade daquela nota) */
  ultimo: number | null
  /** ⭐ média das últimas compras (até `COMPRAS_NA_MEDIA`) — lei C12 */
  mediaDasUltimas: number | null
  /** ▲ subiu · ▼ caiu · ━ estável (5% de banda morta) */
  tendencia: 'SUBIU' | 'CAIU' | 'ESTAVEL' | null
  ultimaEm: string | null
  /** quantas compras o livro tem na janela lida */
  comprasConsideradas: number
  /**
   * ⭐⭐ quantas compras entraram **na base da tendência** — é ESTE o número que a tela escreve.
   * ⛔ Antes ela dizia `comprasConsideradas` (todas da janela) sobre uma conta feita com 3.
   */
  baseDaTendencia: number
}

export interface BarraDaSemana {
  dia: string
  diaDaSemana: number
  /**
   * ⭐ FECHADO → o número (**0** quando não houve consumo) · HOJE → o parcial · PENDENTE →
   * `null`, o único "a apurar" que existe. Ver a lei em `dia-do-consumo.ts`.
   */
  valor: number | null
  /** ⭐⭐ o ESTADO manda no rótulo: zero de verdade ≠ dia pendente ≠ hoje parcial */
  estado: EstadoDoDia
  /** ⭐ o GHOST tracejado: o mesmo dia-da-semana na semana anterior (lei C3) */
  ghost: number | null
}

export interface LinhaDeConsumo {
  itemId: string
  nome: string
  unidade: string
  lista: 'CAROS' | 'PORCOES'

  // ── o herói (lei C3)
  /** consumo no período do seletor */
  consumoDoPeriodo: number
  /** Δ% contra o período anterior de MESMO tamanho; `null` sem base pra comparar */
  deltaPct: number | null
  consumoAnterior: number | null
  /**
   * ⭐⭐ **UM selo, nunca N** (anti-spam, ordem do dono): `true` quando existe dia PENDENTE DE
   * VERDADE em **qualquer um dos dois lados** do Δ% — é o herói avisando que a comparação tem
   * um período incompleto. ⛔ Sem pendência, **sem selo**: alarme que pisca em todo item é
   * alarme que o dono aprende a ignorar (a lição dos 111 falsos de 26/08).
   */
  temDiaAApurar: boolean
  /** ⭐ 8 semanas, da mais antiga pra a mais recente */
  spark: number[]
  barras: BarraDaSemana[]

  // ── a prateleira
  estoque: number
  custoVigente: number | null
  /** consumo do período × custo vigente (lei C12) */
  custoDoPeriodo: number | null
  coberturaDias: number | null
  farol: FarolDaCobertura
  /**
   * ⭐⭐ A legenda que MATA A CONTRADIÇÃO (*"7,6 dias"* embaixo de *"sem média medida ainda"*):
   * ela sai do dono único (`legendaDaCobertura`), com a JANELA escrita. ⛔ Montá-la na tela
   * seria a 2ª régua do mesmo rótulo — e é a tela que estava mentindo.
   */
  coberturaLegenda: string

  // ── o livro
  destinos: DestinoDoConsumo[]
  /** ⚠️ quanto do consumo o ledger NÃO sabe atribuir (a baixa de venda) */
  naoAtribuido: number
  precoPago: PrecoPago

  // ── a perda, pela porta do Real vs Teórico
  perda: { faltou: number | null; valor: number | null; porque: string | null }

  // ── a conta
  /** média por dia-da-semana SEG-first, da baseline de 28 dias; `null` = a apurar */
  mediaPorDia: (number | null)[]
  config: ConfigDeCompra
  pedido: ContaDoPedido | null
  plano: ContaDoPlano | null
}

export interface LinhaDaAgenda {
  itemId: string
  nome: string
  unidade: string
  fornecedor: string | null
  /** 'HOJE' quando já passou da hora */
  quando: string
  /** ⭐ ordena: o atrasado/hoje primeiro */
  pedirEm: number
  pedir: number
  chegaDia: number
}

export interface LinhaDaMesa {
  itemId: string
  nome: string
  unidade: string
  /** quanto saiu na janela do seletor (a coluna "NA SEMANA", que segue o período) */
  noPeriodo: number
  temAgora: number
  saiAteChegar: number
  pedir: number
  precoPago: number | null
  total: number | null
  /** ⓘ a conta aberta, em números rotulados — PROSA É PROIBIDA (lei C8) */
  conta: { cobre: string; saiNaJanela: number; folga: number; precisa: number; sobra: number }
}

export interface CardDaMesa {
  fornecedor: string | null
  chegaDia: number
  linhas: LinhaDaMesa[]
  totalReais: number | null
  /** ⭐ o texto pronto pro WhatsApp */
  texto: string
}

export interface LinhaDoPlano {
  itemId: string
  nome: string
  unidade: string
  temAgora: number
  minimo: number
  saiHoje: number
  produzir: number
  /** ⭐ SÓ APONTA, nunca cria (lei C9) */
  fichaId: string | null
}

export interface ItemSemConfig {
  itemId: string
  nome: string
  porque: string
}

export interface ConsumoECompras {
  janela: JanelaDaMargem
  /**
   * ⭐ o nome da empresa, como o CADASTRO diz — é o cabeçalho do texto do WhatsApp.
   *
   * ⚠️ Ele viaja no payload porque o − / + da mesa **remonta o texto com as quantidades
   * ajustadas**, e a tela não pode cravar o nome: cravado, ele mentiria no dia em que o dono
   * renomear a empresa, e mentiria **na mensagem que o fornecedor recebe**.
   */
  empresa: string
  /** o dia de HOJE em SEG-first — o relógio entra por aqui e por nenhum outro lugar */
  hojeSegPrimeiro: number
  hoje: string
  avisos: string[]
  caros: LinhaDeConsumo[]
  porcoes: LinhaDeConsumo[]
  agenda: LinhaDaAgenda[]
  mesa: CardDaMesa[]
  plano: LinhaDoPlano[]
  semConfig: ItemSemConfig[]
}

/**
 * ⭐⭐⭐ A LEITURA. **Só lê** — nenhum caminho daqui escreve uma linha.
 *
 * ⚠️ `agora` é PARÂMETRO (régua da casa desde 13/08): o relógio serve pra dizer "hoje" na tela,
 * nunca pra decidir por dentro. Ele entra UMA vez (`hojeBrasil`) e vira `hojeSegPrimeiro`.
 */
/**
 * ⭐ O nome da empresa APARADO — e isto não é preciosismo: medido em prod, o cadastro da Caçula
 * está gravado como `"caçula mix "`, **com espaço no fim** (a cicatriz da conta `'sicredi '`,
 * 25/08, que já custou um diagnóstico inteiro). ⚠️ Ele vai pro **cabeçalho do texto que o
 * FORNECEDOR recebe** no WhatsApp — espaço sobrando ali é sujeira na mensagem que sai da casa.
 * ⛔ Apara-se na EXIBIÇÃO, nunca no cadastro: o nome é decisão do dono.
 */
const nomeDaEmpresa = (s: string) => s.trim()

export async function lerConsumoECompras(
  input: {
    companyId: string
    empresa: string
    periodo: PeriodoDaMargem
    datas?: { de?: string | null; ate?: string | null }
    agora: Date
  },
  db: PrismaClient = defaultPrisma,
): Promise<ConsumoECompras> {
  const janela = janelaDaMargem(input.periodo, input.agora, input.datas)
  const hoje = hojeBrasil(input.agora)
  const hojeSegPrimeiro = segPrimeiro(diaDaSemanaDe(hoje))
  const avisos: string[] = []

  // ── 1. QUAIS ITENS (a porta do Radar — nenhuma lista nova)
  const listas = await listasDoRadar(input.companyId, db)
  const ids = [...new Set([...listas.caros, ...listas.porcoes])]
  if (!ids.length) {
    return {
      janela, hoje, hojeSegPrimeiro, empresa: nomeDaEmpresa(input.empresa),
      avisos: ['as listas nascem vazias — escolha os itens que você acompanha'],
      caros: [], porcoes: [], agenda: [], mesa: [], plano: [], semConfig: [],
    }
  }

  // ── 2. A JANELA DE LEITURA: a mais larga entre a baseline, o spark e o período do seletor.
  //      ⚠️ UMA leitura de movimentos pros N itens — uma consulta por item é o N+1 que custou
  //      4,9 s na lista de fichas (28/09).
  const desdeBaseline = iso(new Date(Date.parse(`${hoje}T00:00:00Z`) - DIAS_DA_BASELINE * DIA_MS))
  const desdeSpark = iso(new Date(Date.parse(`${hoje}T00:00:00Z`) - SEMANAS_DO_SPARK * 7 * DIA_MS))
  // ⚠️ o período ANTERIOR (pro Δ%) também precisa de dado: ele é do mesmo tamanho, atrás
  const anteriorDe = iso(new Date(janela.deUtc.getTime() - janela.dias * DIA_MS))
  const desde = [desdeBaseline, desdeSpark, anteriorDe].sort()[0]

  const movs = await db.stockMovement.findMany({
    where: { companyId: input.companyId, itemId: { in: ids }, dataMovimento: { gte: new Date(`${desde}T00:00:00Z`) } },
    select: {
      itemId: true, tipo: true, quantidade: true, custoUnitario: true, custoTotal: true,
      dataMovimento: true, estornoDeId: true, receiptId: true,
    },
    orderBy: { dataMovimento: 'asc' },
  })

  // ⭐ o ESTORNO conta pelo tipo que ele DESFEZ — e resolver isso exige os originais, que podem
  //   estar FORA da janela de leitura. Uma consulta a mais pelos ids, nunca uma por movimento.
  const idsEstornados = [...new Set(movs.map((m) => m.estornoDeId).filter((x): x is string => !!x))]
  const tipoOriginal = new Map<string, string>()
  if (idsEstornados.length) {
    for (const o of await db.stockMovement.findMany({
      where: { id: { in: idsEstornados } },
      select: { id: true, tipo: true },
    })) tipoOriginal.set(o.id, o.tipo)
  }

  /**
   * ⭐⭐⭐ A PENDÊNCIA DO LIVRO — MEDIDA, nunca suposta (ver `pendencia-do-livro.ts`).
   *
   * ⚠️ **O brief apontava a fila de CONFERÊNCIA e a medição refutou:** separação, devolução e a
   * correção do gerente são datadas com `now()`, então **não mudam o consumo de um dia passado**.
   * A única coisa que ainda escreve consumo retroativo é a **BAIXA DA VENDA** daquele dia — e é
   * dela que "a apurar" nasce. ⛔ Uma consulta pros N itens e N dias, nunca uma por dia.
   */
  const pendencia = await medirPendenciaDoLivro(
    { companyId: input.companyId, desde, hoje, movimentos: movs, itemIds: ids },
    db,
  )

  const paraConsumo = new Map<string, MovimentoParaConsumo[]>()
  for (const m of movs) {
    const a = paraConsumo.get(m.itemId) ?? []
    a.push({
      tipo: m.tipo,
      data: m.dataMovimento.toISOString(),
      quantidade: m.quantidade,
      estornoDeTipo: m.estornoDeId ? (tipoOriginal.get(m.estornoDeId) ?? null) : null,
    })
    paraConsumo.set(m.itemId, a)
  }

  // ── 3. A PRATELEIRA e o CUSTO (as portas da Posição e da lei-do-custo-medio)
  const saldos = new Map((await saldosDaEmpresa(db, input.companyId)).map((s) => [s.itemId, s]))
  const vigentes = await custoVigentePorItem(db, input.companyId)
  const configs = await configsDeCompraDaEmpresa(input.companyId, db)

  const itens = new Map(
    (await db.stockItem.findMany({
      where: { companyId: input.companyId, id: { in: ids } },
      select: { id: true, nome: true, unidadeControle: true },
    })).map((i) => [i.id, i]),
  )

  // ── 4. A PERDA, pela porta do Real vs Teórico (tradutor puro, ZERO matcher novo)
  //      ⚠️ o piso do módulo manda: período anterior a ele não tem variância defensável
  const deRvT = janela.de < PISO_DADOS ? PISO_DADOS : janela.de
  const rvt = deRvT <= janela.ate
    ? await calcularRealVsTeorico({ companyId: input.companyId, de: deRvT, ate: janela.ate }, db)
    : null
  if (rvt) avisos.push(...rvt.resumo.avisos)
  const perdaPorItem = new Map((rvt?.linhas ?? []).map((l) => [l.itemId, l]))

  // ── 5. AS RECEITAS que consumiram (o PARA ONDE FOI que o ledger prova)
  const idsOrdens = [...new Set(movs.filter((m) => TIPOS_DE_SEPARACAO.has(m.tipo) && m.receiptId).map((m) => m.receiptId!))]
  const ordens = new Map<string, { fichaId: string; nome: string }>()
  if (idsOrdens.length) {
    const os = await db.stockProductionOrder.findMany({
      where: { companyId: input.companyId, id: { in: idsOrdens } },
      select: { id: true, fichaId: true, itemProduzidoId: true },
    })
    const nomes = new Map(
      (await db.stockItem.findMany({
        where: { companyId: input.companyId, id: { in: [...new Set(os.map((o) => o.itemProduzidoId))] } },
        select: { id: true, nome: true },
      })).map((i) => [i.id, i.nome]),
    )
    for (const o of os) ordens.set(o.id, { fichaId: o.fichaId, nome: nomes.get(o.itemProduzidoId) ?? 'receita' })
  }

  // ── 6. MONTA LINHA POR LINHA
  const linhaDe = (itemId: string, lista: 'CAROS' | 'PORCOES'): LinhaDeConsumo | null => {
    const item = itens.get(itemId)
    if (!item) return null // item apagado da watchlist antiga — não inventa nome
    const meus = paraConsumo.get(itemId) ?? []
    const porDia = consumoPorDiaDoItem(meus)

    const consumoEntre = (de: string, ate: string) => {
      let t = 0
      for (const [d, v] of porDia) if (d >= de && d <= ate) t += v
      return round3(Math.max(0, t))
    }

    const consumoDoPeriodo = consumoEntre(janela.de, janela.ate)
    const anteriorAte = iso(new Date(janela.deUtc.getTime() - DIA_MS))
    const consumoAnterior = consumoEntre(anteriorDe, anteriorAte)
    // ⛔ Δ% só existe com base > 0: dividir por zero viraria ∞ ou 100% inventado
    const deltaPct = consumoAnterior > 0 ? round2(((consumoDoPeriodo - consumoAnterior) / consumoAnterior) * 100) : null

    // ⭐ spark: 8 blocos de 7 dias, o último terminando HOJE
    const spark: number[] = []
    for (let s = SEMANAS_DO_SPARK - 1; s >= 0; s--) {
      const fim = iso(new Date(Date.parse(`${hoje}T00:00:00Z`) - s * 7 * DIA_MS))
      const ini = iso(new Date(Date.parse(`${fim}T00:00:00Z`) - 6 * DIA_MS))
      spark.push(consumoEntre(ini, fim))
    }

    /**
     * ⭐⭐⭐ BARRAS E BASELINE PELA **MESMA** LEI (`montarDias`) — e isto não é economia.
     *
     * A barra diz *"o dia foi zero"* e a média usa esse mesmo zero; duas montagens divergiriam
     * no primeiro estado novo, e aí **a tela mostraria "0" num dia que a média tratou como
     * pendente** — a doença do B1 dentro de um item só.
     */
    const pendentes = pendentesDoItem(itemId, pendencia)
    const cobertoDesde = cobertoDesdeDoItem(itemId, pendencia)

    const diasDoPeriodo = montarDias({
      de: janela.de, ate: janela.ate, hoje, pendentes, cobertoDesde, porDia,
      diaDaSemana: (d) => segPrimeiro(diaDaSemanaDe(d)),
      arredonda: round3,
    })
    const barras: BarraDaSemana[] = diasDoPeriodo.map((d) => {
      const ghostDia = iso(new Date(Date.parse(`${d.dia}T00:00:00Z`) - 7 * DIA_MS))
      return {
        dia: d.dia,
        diaDaSemana: d.diaDaSemana,
        valor: d.valor,
        estado: d.estado,
        // ⚠️ o GHOST é REFERÊNCIA visual, não medição: ele segue mostrando só o que o ledger
        //    tem (sem a lei), porque um "0" tracejado no fundo da barra é ruído, não dado.
        ghost: porDia.has(ghostDia) ? round3(Math.max(0, porDia.get(ghostDia)!)) : null,
      }
    })

    /**
     * ⭐ O SELO DO HERÓI cobre **os dois lados do Δ%** — é a comparação que ele mostra. Olhar só
     * o período atual deixaria o dono comparar um período completo com um incompleto sem saber.
     */
    const diasDoAnterior = montarDias({
      de: anteriorDe, ate: anteriorAte, hoje, pendentes, cobertoDesde, porDia,
      diaDaSemana: (d) => segPrimeiro(diaDaSemanaDe(d)),
      arredonda: round3,
    })

    /**
     * ⭐⭐ A BASELINE DO PEDIDO: média por dia-da-semana sobre 28 dias, pelo DONO ÚNICO.
     *
     * ⚠️ `mediaPorDiaDaSemana` fala **DOM-first** e exige `MIN_AMOSTRAS_DO_DIA` (ela devolve a
     * contagem e **não julga** — quem decide o mínimo é o consumidor, e aqui o mínimo é o mesmo
     * que o dono já aprovou em 10/10: *"média de uma amostra"* não é média).
     * ⛔ A conversão pra SEG-first passa pelo `segPrimeiro`, o único lugar que sabe disso.
     */
    /**
     * ⭐⭐⭐ **OS ZEROS ENTRAM, OS PENDENTES FICAM FORA, HOJE FORA ATÉ FECHAR** (a lei de 17/10).
     *
     * ⛔ Antes a baseline mandava `null` pra todo dia sem movimento, e o efeito era grande: no
     * coxão **nenhum dia-da-semana alcançava `MIN_AMOSTRAS_DO_DIA`** → `mediaPorDia` todo `null`
     * → cobertura `null` → o `contaDoPedido` dizia *"sem consumo medido"* num item que a casa
     * usa toda semana. **Dia fechado sem consumo é uma MEDIÇÃO de zero, não uma lacuna.**
     *
     * ⚠️ `montarDias` já exclui HOJE da conta (ele vira `HOJE`, e `entraNaMedia` só aceita
     * `FECHADO`) — a baseline nem o inclui na janela, então é cinto sobre suspensório.
     */
    const baseDe = iso(new Date(Date.parse(`${hoje}T00:00:00Z`) - DIAS_DA_BASELINE * DIA_MS))
    const baseAte = iso(new Date(Date.parse(`${hoje}T00:00:00Z`) - DIA_MS))
    const diasDaBaseline = montarDias({
      de: baseDe, ate: baseAte, hoje, pendentes, cobertoDesde, porDia,
      // ⚠️ `mediaPorDiaDaSemana` fala DOM-first — a conversão pra SEG-first é na SAÍDA
      diaDaSemana: diaDaSemanaDe,
      arredonda: (n) => n,
    }).map((d) => ({
      dia: d.dia,
      diaDaSemana: d.diaDaSemana,
      total: entraNaMedia(d.estado) ? d.valor : null,
    }))
    const medias = mediaPorDiaDaSemana(diasDaBaseline, hoje)
    const mediaPorDia: (number | null)[] = Array.from({ length: 7 }, () => null)
    for (const m of medias) {
      mediaPorDia[segPrimeiro(m.dow)] = m.amostras >= MIN_AMOSTRAS_DO_DIA ? m.media : null
    }

    // ── PARA ONDE FOI (só o que o ledger prova)
    const porDestino = new Map<string, { nome: string; fichaId: string | null; qtd: number }>()
    let naoAtribuido = 0
    for (const m of movs) {
      if (m.itemId !== itemId) continue
      if (m.dataMovimento.toISOString().slice(0, 10) < janela.de || m.dataMovimento.toISOString().slice(0, 10) > janela.ate) continue
      const base = m.estornoDeId ? (tipoOriginal.get(m.estornoDeId) ?? m.tipo) : m.tipo
      const sinal = m.estornoDeId ? -1 : 1
      if (TIPOS_DE_SEPARACAO.has(base)) {
        const o = m.receiptId ? ordens.get(m.receiptId) : undefined
        const chave = o?.fichaId ?? 'separacao-sem-ordem'
        const atual = porDestino.get(chave) ?? { nome: o?.nome ?? 'separação sem ordem', fichaId: o?.fichaId ?? null, qtd: 0 }
        // ⚠️ DEVOLUCAO volta: ela ENTRA com sinal contrário no destino que a consumiu
        const volta = (TIPOS.DEVOLUCAO as readonly string[]).includes(base) ? -1 : 1
        atual.qtd += sinal * volta * Math.abs(m.quantidade)
        porDestino.set(chave, atual)
      } else if (TIPOS_DE_VENDA.has(base)) {
        naoAtribuido += sinal * Math.abs(m.quantidade)
      }
    }
    const destinosBrutos = [...porDestino.values()].filter((d) => d.qtd > 0).sort((a, b) => b.qtd - a.qtd)
    if (naoAtribuido > 0) {
      destinosBrutos.push({ nome: 'baixa de venda (o livro não diz a receita)', fichaId: null, qtd: naoAtribuido })
      destinosBrutos.sort((a, b) => b.qtd - a.qtd)
    }
    const somaDestinos = destinosBrutos.reduce((s, d) => s + d.qtd, 0)
    const destinos: DestinoDoConsumo[] = destinosBrutos.slice(0, 5).map((d) => ({
      nome: d.nome,
      fichaId: d.fichaId,
      quantidade: round3(d.qtd),
      pct: somaDestinos > 0 ? round2((d.qtd / somaDestinos) * 100) : 0,
    }))

    // ── PREÇO PAGO (as entradas de nota, pela própria linha do ledger)
    const compras = movs
      .filter((m) => m.itemId === itemId && !m.estornoDeId && TIPOS_DE_ENTRADA.has(m.tipo) && m.quantidade > 0)
      .sort((a, b) => b.dataMovimento.getTime() - a.dataMovimento.getTime())
    const unit = (m: typeof compras[number]) => round2(Math.abs(m.custoTotal) / Math.abs(m.quantidade))
    const ultimas = compras.slice(0, COMPRAS_NA_MEDIA)
    const mediaDasUltimas = ultimas.length ? round2(ultimas.reduce((s, m) => s + unit(m), 0) / ultimas.length) : null
    const ultimo = compras.length ? unit(compras[0]) : null
    // ⚠️ banda morta de 5%: oscilação de centavo não é "subiu" — alarme de tendência que
    //    pisca em todo item é alarme que o dono aprende a ignorar.
    let tendencia: PrecoPago['tendencia'] = null
    if (ultimo != null && compras.length >= 2) {
      // ⚠️ a base é o que veio ANTES da última — comparar a última com ela mesma diluiria o sinal
      const anteriores = compras.slice(1, 1 + COMPRAS_NA_MEDIA)
      const base = round2(anteriores.reduce((s, m) => s + unit(m), 0) / anteriores.length)
      if (base > 0) {
        const d = (ultimo - base) / base
        tendencia = d > 0.05 ? 'SUBIU' : d < -0.05 ? 'CAIU' : 'ESTAVEL'
      }
    }

    const estoque = saldos.get(itemId)?.saldo ?? 0
    const custoVigente = vigentes.get(itemId) ?? null
    const config = configs.get(itemId) ?? configPadrao(itemId)

    const pedido = lista === 'CAROS'
      ? contaDoPedido(
          {
            diasChegada: config.diasChegada,
            antecedenciaDias: config.antecedenciaDias,
            folga: config.folga,
            estoque,
            mediaPorDia,
          },
          hojeSegPrimeiro,
        )
      : null
    const plano = lista === 'PORCOES' ? contaDoPlano({ estoque, mediaPorDia }, hojeSegPrimeiro) : null

    const cobertura = coberturaEmDias(estoque, mediaPorDia)
    const chegaEm = pedido?.ok ? pedido.chegaEm : null
    const farol = farolDaCobertura(cobertura, chegaEm)

    const p = perdaPorItem.get(itemId)
    return {
      itemId,
      nome: item.nome,
      unidade: item.unidadeControle,
      lista,
      consumoDoPeriodo,
      deltaPct,
      consumoAnterior: consumoAnterior > 0 ? consumoAnterior : null,
      spark,
      barras,
      estoque,
      custoVigente,
      // ⛔ sem custo vigente o custo do período é `null`, nunca R$ 0,00 (lei C2)
      custoDoPeriodo: custoVigente != null ? round2(consumoDoPeriodo * custoVigente) : null,
      temDiaAApurar: temDiaAApurar(diasDoPeriodo) || temDiaAApurar(diasDoAnterior),
      coberturaDias: cobertura,
      farol,
      coberturaLegenda: legendaDaCobertura({
        cobertura,
        farol,
        diasComMedia: mediaPorDia.filter((m) => m != null).length,
        diasDaBaseline: DIAS_DA_BASELINE,
      }),
      destinos,
      naoAtribuido: round3(Math.max(0, naoAtribuido)),
      precoPago: {
        ultimo,
        mediaDasUltimas,
        tendencia,
        ultimaEm: compras.length ? iso(compras[0].dataMovimento) : null,
        comprasConsideradas: compras.length,
        baseDaTendencia: Math.max(0, Math.min(COMPRAS_NA_MEDIA, compras.length - 1)),
      },
      /**
       * ⚠️ **PERDA SEM OS DOIS LADOS É "A APURAR"** (ordem do dono). A variância do Real vs
       * Teórico é `null` quando o item **não foi contado** no período — e `null` ali nunca vira
       * zero, porque *"ausência de medição não é ausência de fato"*.
       */
      perda: {
        faltou: p?.variancia ?? null,
        valor: p?.varianciaValor ?? null,
        porque: p ? (p.variancia == null ? 'sem contagem no período' : null) : 'item fora do período medido',
      },
      mediaPorDia,
      config,
      pedido,
      plano,
    }
  }

  const caros = listas.caros.map((id) => linhaDe(id, 'CAROS')).filter((l): l is LinhaDeConsumo => !!l)
  const porcoes = listas.porcoes.map((id) => linhaDe(id, 'PORCOES')).filter((l): l is LinhaDeConsumo => !!l)

  // ── 7. O QUE FALTA CONFIGURAR (o item aparece na lista e fica FORA da mesa, com o aviso)
  const semConfig: ItemSemConfig[] = caros
    .filter((l) => l.pedido && !l.pedido.ok)
    .map((l) => ({ itemId: l.itemId, nome: l.nome, porque: (l.pedido as { ok: false; porque: string }).porque }))

  // ── 8. A AGENDA DO COMPRADOR (lei C7) — ⚠ HOJE primeiro
  const agenda: LinhaDaAgenda[] = caros
    .filter((l) => l.pedido?.ok && l.pedido.pedir > 0)
    .map((l) => {
      const p = l.pedido as Extract<ContaDoPedido, { ok: true }>
      return {
        itemId: l.itemId,
        nome: l.nome,
        unidade: l.unidade,
        fornecedor: l.config.fornecedor,
        quando: diaPedir(p, hojeSegPrimeiro),
        pedirEm: p.pedirEm,
        pedir: p.pedir,
        chegaDia: p.chegaDia,
      }
    })
    .sort((a, b) => a.pedirEm - b.pedirEm || b.pedir - a.pedir)

  // ── 9. A MESA DE PEDIDO (lei C8) — um card por FORNECEDOR + DIA DE CHEGADA
  const cards = new Map<string, CardDaMesa>()
  for (const l of caros) {
    if (!l.pedido?.ok || l.pedido.pedir <= 0) continue
    const p = l.pedido
    const chave = `${l.config.fornecedor ?? ''}|${p.chegaDia}`
    const card = cards.get(chave) ?? { fornecedor: l.config.fornecedor, chegaDia: p.chegaDia, linhas: [], totalReais: null, texto: '' }
    const preco = l.precoPago.ultimo
    card.linhas.push({
      itemId: l.itemId,
      nome: l.nome,
      unidade: l.unidade,
      noPeriodo: l.consumoDoPeriodo,
      temAgora: l.estoque,
      saiAteChegar: p.saiAteChegar,
      pedir: p.pedir,
      precoPago: preco,
      total: preco != null ? round2(p.pedir * preco) : null,
      conta: {
        cobre: p.janela.map((d) => DIAS[d]).join('+'),
        saiNaJanela: p.saiJanela,
        folga: l.config.folgaPct,
        precisa: p.precisa,
        sobra: p.sobraNaChegada,
      },
    })
    cards.set(chave, card)
  }
  const mesa = [...cards.values()].map((c) => ({
    ...c,
    linhas: c.linhas.sort((a, b) => (b.total ?? 0) - (a.total ?? 0)),
    // ⭐⭐ a MESMA régua que o − / + da tela usa (`totalDoCard`, na lib pura): o total só existe
    //    se TODA linha tem preço. ⛔ Somar aqui por conta própria faria o card mostrar um total
    //    ao abrir e outro depois do primeiro clique — o número que o dono leva pro fornecedor.
    totalReais: totalDoCard(c.linhas.map((l) => ({ quantidade: l.pedir, precoPago: l.precoPago }))),
    texto: textoDoCard(input.empresa, c),
  })).sort((a, b) => a.chegaDia - b.chegaDia)

  // ── 10. O PLANO DE PRODUÇÃO (lei C9) — ordenado pelo que falta mais
  const fichaPorItem = new Map(
    (await db.stockFicha.findMany({
      where: { companyId: input.companyId, itemProduzidoId: { in: listas.porcoes }, ativo: true },
      select: { id: true, itemProduzidoId: true },
    })).map((f) => [f.itemProduzidoId, f.id]),
  )
  const plano: LinhaDoPlano[] = porcoes
    .filter((l) => l.plano?.ok)
    .map((l) => {
      const p = l.plano as Extract<ContaDoPlano, { ok: true }>
      return {
        itemId: l.itemId,
        nome: l.nome,
        unidade: l.unidade,
        temAgora: l.estoque,
        minimo: p.minimo,
        saiHoje: p.saiHoje,
        produzir: p.produzir,
        fichaId: fichaPorItem.get(l.itemId) ?? null,
      }
    })
    .sort((a, b) => b.produzir - a.produzir)

  return {
    janela, hoje, hojeSegPrimeiro, empresa: nomeDaEmpresa(input.empresa),
    avisos, caros, porcoes, agenda, mesa, plano, semConfig,
  }
}

/**
 * ⭐ O TEXTO DO CARD — delega pro `textoDoPedido` da lib PURA.
 * ⛔ Montar a frase aqui seria o 2º formatador do mesmo texto, e ele divergiria do que a mesa
 * mostra no primeiro ajuste (o texto é o que o fornecedor recebe).
 */
function textoDoCard(empresa: string, c: CardDaMesa): string {
  return textoDoPedido({
    empresa,
    fornecedor: c.fornecedor,
    chegaDia: c.chegaDia,
    linhas: c.linhas.map((l) => ({ nome: l.nome, quantidade: l.pedir, unidade: l.unidade })),
  })
}
