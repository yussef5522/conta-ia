/**
 * ⭐⭐⭐ A PORTA ÚNICA DA CONFIG DE COMPRA (lei C5, 16/10/2026).
 *
 * **O que o dono declara por item dos 🥩 CAROS:** os **dias de CHEGADA** (chips SEG..DOM, um ou
 * vários), a **antecedência** do pedido em dias (o prazo do fornecedor), o **fornecedor** (texto
 * livre) e a **folga %**. Sem isso `contaDoPedido` devolve *"configura os dias de chegada"* e o
 * item fica fora da mesa — por desenho, nunca com um número inventado (lei C2).
 *
 * ═══ ⭐⭐ POR QUE ESTA É A ÚNICA PORTA DE ESCRITA ═══
 *
 * `salvarConfigDeCompra` é a única função que escreve em `stock_compra_config`. Um `upsert`
 * solto numa rota ou num script faria a coluna significar duas coisas, e as duas divergiriam no
 * primeiro campo novo — a doença que esta casa mais paga (os 7 detectores de par, as 2 cópias do
 * FITID, o `recomputeVendas` que a tela e o juiz corrigiram em dias diferentes).
 *
 * ⚠️ **E ela é o ÚNICO lugar que sabe o formato do CSV.** `diasChegada` viaja como `number[]` em
 * todo o resto do sistema (é o que `ItemParaPedido` consome); a serialização mora aqui, com
 * `parseDiasChegada`/`serializarDiasChegada` exportados **só pra teste**. Quem lê CSV por fora
 * passa a ser um 2º parser, e aí a mesa e o banco discordam sobre que dia a mercadoria chega.
 *
 * ⛔⛔ **A LISTA SEG-FIRST É A DA REFERÊNCIA, e isso não é detalhe:** `0 = SEG`, como os chips e
 * como `DIAS` da lib pura. O `getUTCDay()` do JavaScript é DOM-first, e misturar as duas
 * convenções é um deslocamento de um dia que **não dá erro nenhum** — o pedido só cobre a janela
 * errada. A conversão tem um lugar só (`segPrimeiro`) e não acontece aqui.
 *
 * ⚠️ **A config é da CASA, não por usuário** (mesma régua da estrela das receitas): a chave é
 * `(companyId, itemId)`. Fosse por usuário, o gerente configuraria o frango e a mesa do dono
 * continuaria dizendo *"configura os dias de chegada"*.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { ANTECEDENCIA_PADRAO, FOLGA_PADRAO } from './consumo-e-compras'

type Db = PrismaClient | Prisma.TransactionClient

/** ⚠️ erro de DOMÍNIO — a rota traduz em 422 com a frase que ENSINA a saída */
export class ConfigDeCompraError extends Error {}

/**
 * ⭐ A folga em PONTOS PERCENTUAIS que o dono vê, DERIVADA do fator da lib pura.
 * ⛔ Escrever `10` aqui seria o mesmo número em dois lugares: no dia em que a lei C5 mudar a
 * folga padrão, a tela e a conta discordariam.
 */
export const FOLGA_PCT_PADRAO = Math.round((FOLGA_PADRAO - 1) * 100)

/**
 * ⭐ pct → FATOR, a única conversão.
 * ⚠️ `ItemParaPedido.folga` é **fator** (`1.1` = +10%); passar o pct cru ali pediria **11×** o
 * necessário. O comentário da lib avisa, e esta função é o que torna o erro impossível.
 */
export const folgaDoPct = (pct: number): number => 1 + pct / 100

export interface ConfigDeCompra {
  itemId: string
  /** SEG-first (0=SEG … 6=DOM), **ordenado e sem repetição** */
  diasChegada: number[]
  antecedenciaDias: number
  fornecedor: string | null
  /** o que o dono digitou (pontos percentuais) */
  folgaPct: number
  /** o FATOR que `contaDoPedido` consome — derivado, nunca gravado */
  folga: number
}

/** ⭐ a config de quem não configurou nada: sem dias → o item fica fora da mesa, com o aviso */
export function configPadrao(itemId: string): ConfigDeCompra {
  return {
    itemId,
    diasChegada: [],
    antecedenciaDias: ANTECEDENCIA_PADRAO,
    fornecedor: null,
    folgaPct: FOLGA_PCT_PADRAO,
    folga: FOLGA_PADRAO,
  }
}

const ANTECEDENCIA_MAX = 30
const FOLGA_PCT_MAX = 200

/**
 * ⭐ CSV → dias. **Tolerante de propósito na LEITURA:** o CHECK do banco garante a forma de tudo
 * que entra pela porta, e um dia tolo que escape por outro caminho é melhor **ignorado** que
 * derrubando a tela inteira do dono (a mesma régua do leitor resiliente do `metadata` do audit,
 * 20/09 — *vazio com cara de "não havia dado" é pior que linha feia*).
 */
export function parseDiasChegada(csv: string): number[] {
  if (!csv.trim()) return []
  const dias = csv
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  return [...new Set(dias)].sort((a, b) => a - b)
}

/** ⭐ dias → CSV **CANÔNICO** (ordenado, sem repetição) — ver `normalizarDias` */
export function serializarDiasChegada(dias: readonly number[]): string {
  return [...new Set(dias)].sort((a, b) => a - b).join(',')
}

/**
 * ⭐⭐ A NORMALIZAÇÃO DA ESCRITA — e ela RECUSA em vez de consertar calado.
 *
 * ⚠️ **Dia repetido é DEDUPLICADO, não erro:** dois toques no mesmo chip SEG não são uma
 * declaração inválida, são o dedo do dono. ⛔ **Dia fora de 0..6 é RECUSADO:** ele passaria a
 * tornar `contaDoPedido` inalcançável pra aquele item (a conta varre 7 dias e nunca acha a
 * chegada), e o item sairia da mesa **sem ninguém dizer por quê**.
 *
 * ⭐ A ordenação é o que faz o CSV ser **canônico**: `"4,0,2"` e `"0,2,4"` são a MESMA config, e
 * gravar as duas formas faria o mesmo item parecer duas configurações diferentes no banco.
 */
function normalizarDias(dias: readonly number[]): number[] {
  const torto = dias.find((d) => !Number.isInteger(d) || d < 0 || d > 6)
  if (torto !== undefined) {
    throw new ConfigDeCompraError(
      `Dia de chegada inválido (${torto}) — os dias vão de 0 (SEG) a 6 (DOM).`,
    )
  }
  return [...new Set(dias)].sort((a, b) => a - b)
}

/**
 * ⭐⭐⭐ SALVA a config de um item. **A única porta de escrita.**
 *
 * ⚠️ Resolve o item **por ID escopado por empresa** (REGRA 8): sem o `companyId` no `where`, um
 * id de outra empresa configuraria a compra do vizinho — e multi-tenant é onde isso dói mais.
 *
 * ⭐ **IDEMPOTENTE:** salvar duas vezes é UPDATE (o `upsert` + o índice único cuidam), então dois
 * toques rápidos no celular não criam duas configs que divergem.
 *
 * ⚠️ **Fornecedor só-espaço vira `null`**, nunca `'   '`: o CHECK do banco é o backstop (REGRA
 * 13, com o `IS NULL` explícito e primeiro), mas quem passa pela porta já entra limpo — senão o
 * texto do WhatsApp sairia com um nome em branco no meio.
 */
export async function salvarConfigDeCompra(
  input: {
    companyId: string
    itemId: string
    diasChegada: readonly number[]
    antecedenciaDias?: number
    fornecedor?: string | null
    folgaPct?: number
    userId?: string | null
  },
  db: Db = defaultPrisma,
): Promise<ConfigDeCompra> {
  const item = await db.stockItem.findFirst({
    where: { id: input.itemId, companyId: input.companyId },
    select: { id: true },
  })
  if (!item) throw new ConfigDeCompraError('Item não encontrado nesta empresa.')

  const dias = normalizarDias(input.diasChegada)

  const antecedenciaDias = input.antecedenciaDias ?? ANTECEDENCIA_PADRAO
  // ⚠️ 0 é LEGÍTIMO (fornecedor que entrega no mesmo dia do pedido); o teto existe pra dedo
  // escorregado não virar "pedir com 300 dias de antecedência" na agenda do comprador.
  if (!Number.isInteger(antecedenciaDias) || antecedenciaDias < 0 || antecedenciaDias > ANTECEDENCIA_MAX) {
    throw new ConfigDeCompraError(
      `A antecedência do pedido vai de 0 a ${ANTECEDENCIA_MAX} dias — recebi ${antecedenciaDias}.`,
    )
  }

  const folgaPct = input.folgaPct ?? FOLGA_PCT_PADRAO
  // ⚠️ folga 0 é LEGÍTIMA (o dono pode não querer folga nenhuma neste item)
  if (!Number.isInteger(folgaPct) || folgaPct < 0 || folgaPct > FOLGA_PCT_MAX) {
    throw new ConfigDeCompraError(`A folga vai de 0% a ${FOLGA_PCT_MAX}% — recebi ${folgaPct}%.`)
  }

  const fornecedor = input.fornecedor?.trim() ? input.fornecedor.trim() : null

  await db.stockCompraConfig.upsert({
    where: { companyId_itemId: { companyId: input.companyId, itemId: item.id } },
    create: {
      companyId: input.companyId,
      itemId: item.id,
      diasChegada: serializarDiasChegada(dias),
      antecedenciaDias,
      fornecedor,
      folgaPct,
      definidoPorId: input.userId ?? null,
    },
    // ⚠️ o rastro é REESCRITO: *quem mexeu por último e quando* é a informação que importa
    // depois — a config de hoje é a que manda na compra de amanhã.
    update: {
      diasChegada: serializarDiasChegada(dias),
      antecedenciaDias,
      fornecedor,
      folgaPct,
      definidoPorId: input.userId ?? null,
      definidoEm: new Date(),
    },
  })

  return { itemId: item.id, diasChegada: dias, antecedenciaDias, fornecedor, folgaPct, folga: folgaDoPct(folgaPct) }
}

/**
 * ⭐ A LEITURA, **EM LOTE**. Devolve a config de cada item configurado desta empresa.
 *
 * ⛔ Em lote porque a tela é de todo dia e a lista tem N itens: uma consulta por item é o N+1 que
 * custou **4,9 s** na lista de fichas em 28/09 (1.786 round-trips pra 189 fichas).
 *
 * ⚠️ **Item sem config NÃO entra no mapa** — quem pergunta usa `configPadrao`, e é essa ausência
 * que faz `contaDoPedido` devolver *"configura os dias de chegada"* em vez de um pedido montado
 * sobre dias que ninguém declarou.
 */
export async function configsDeCompraDaEmpresa(
  companyId: string,
  db: Db = defaultPrisma,
): Promise<Map<string, ConfigDeCompra>> {
  const linhas = await db.stockCompraConfig.findMany({
    where: { companyId },
    select: { itemId: true, diasChegada: true, antecedenciaDias: true, fornecedor: true, folgaPct: true },
  })
  return new Map(
    linhas.map((l) => [
      l.itemId,
      {
        itemId: l.itemId,
        diasChegada: parseDiasChegada(l.diasChegada),
        antecedenciaDias: l.antecedenciaDias,
        fornecedor: l.fornecedor,
        folgaPct: l.folgaPct,
        folga: folgaDoPct(l.folgaPct),
      },
    ]),
  )
}

/**
 * ⭐ A config de UM item, já com o padrão quando não há linha.
 * ⚠️ Existe pra a tela de config não ter que lembrar de aplicar o default — *disciplina vira
 * impossibilidade* (REGRA 5).
 */
export async function configDeCompraDoItem(
  companyId: string,
  itemId: string,
  db: Db = defaultPrisma,
): Promise<ConfigDeCompra> {
  const linha = await db.stockCompraConfig.findFirst({
    where: { companyId, itemId },
    select: { diasChegada: true, antecedenciaDias: true, fornecedor: true, folgaPct: true },
  })
  if (!linha) return configPadrao(itemId)
  return {
    itemId,
    diasChegada: parseDiasChegada(linha.diasChegada),
    antecedenciaDias: linha.antecedenciaDias,
    fornecedor: linha.fornecedor,
    folgaPct: linha.folgaPct,
    folga: folgaDoPct(linha.folgaPct),
  }
}
