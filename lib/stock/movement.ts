// ESTOQUE FASE 1 (20/08) — o LEDGER. Criar movimento (validado) e ESTORNAR (correção).
// O banco garante a imutabilidade (trigger) e o CHECK; aqui é a porta da app que
// valida ANTES de gravar (mesma regra, runtime) e implementa a correção = estorno+novo.

import type { PrismaClient, Prisma } from '@prisma/client'
import { avaliarEntrada, ehEntradaQueConserta, frasePergunta, TIPO_AJUSTE_RESIDUO } from './entrada-cruza-o-zero'
import { TIPOS_FORA_DA_PRATELEIRA } from './saldo'
import { familiaDoItem, porQueEstaNegativo, type FatosDoNegativo } from './porta-do-negativo'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const CUSTO_TOL = 0.01 // por LINHA (o mesmo do CHECK do banco)

/** ⚠️ dia do CALENDÁRIO em UTC — `dataProducao` é data, não instante; formatar no fuso a
 *  puxaria pro dia anterior (a cicatriz do card do cartão, 09/09). */
const diaCurto = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/** ⭐ quem é o item barrado — a tela precisa disto pra oferecer "deixa este pendente" */
export interface CulpadoDoMovimento {
  itemId: string
  nome: string
  saldoDepois: number
  valorDepois: number
  /**
   * ⭐ 22/09 — os FATOS que decidem a porta da recusa, resolvidos AQUI porque aqui tem
   * banco. O tradutor (`erro-da-tela`) é puro e só os traduz em rótulo+href; sem isto ele
   * teria que consultar o banco, e aí a decisão da porta nasceria em dois lugares.
   */
  fatos?: FatosDoNegativo
  /**
   * ⭐ 23/09 — o code que a TELA usa pra oferecer a porta certa. `RESIDUO_AO_CRUZAR_O_ZERO`
   * é uma **pergunta**, não uma recusa: reenviar com `confirmouResiduo` passa.
   */
  code?: string
  /** o dinheiro pendurado (negativo) e o teto que este item absorveria calado */
  residuo?: number
  teto?: number
}

export class MovementInvalidError extends Error {
  /** ⛔ sem isto a recusa vira um texto que ninguém consegue acionar em lote */
  readonly culpado?: CulpadoDoMovimento
  constructor(message: string, culpado?: CulpadoDoMovimento) {
    super(message)
    this.name = 'MovementInvalidError'
    this.culpado = culpado
  }
}

export interface NovoMovimento {
  companyId: string
  itemId: string
  tipo: string // ENTRADA_NF | ESTORNO | ...
  quantidade: number
  custoUnitario: number
  custoTotal?: number // default = round2(quantidade*custoUnitario)
  receiptId?: string | null
  nfeChave?: string | null
  nItem?: number | null
  estornoDeId?: string | null
  origem: string // SEFAZ | MANUAL | CAMERA
  criadoPorId?: string | null
  dataMovimento?: Date
  /**
   * ⭐ 23/09 — o dono JÁ VIU a conta na tela e confirmou que a entrada pode limpar o
   * resíduo de custo pendurado. Sem isso, resíduo acima do teto **PERGUNTA** (nunca beco,
   * nunca recusa cega — a régua do `confirmouSanidade`).
   */
  confirmouResiduo?: boolean
}

/** Valida a MESMA regra do CHECK do banco (quantidade≠0; custoTotal==qtd×custo ±0,01/linha).
 *  Testável — cobre o arredondamento real (0,333 × 10,00 = 3,33). */
export function assertMovementValid(m: { quantidade: number; custoUnitario: number; custoTotal: number }): void {
  if (m.quantidade === 0) {
    throw new MovementInvalidError('Movimento com quantidade 0 não faz sentido (nada entrou nem saiu).')
  }
  const esperado = m.quantidade * m.custoUnitario
  if (Math.abs(m.custoTotal - esperado) > CUSTO_TOL) {
    throw new MovementInvalidError(
      `custoTotal ${m.custoTotal.toFixed(2)} não bate com quantidade×custoUnitário (${esperado.toFixed(4)}) além da tolerância de ±${CUSTO_TOL.toFixed(2)}/linha.`,
    )
  }
}

/**
 * ⛔⛔⛔ ESTADO IMPOSSÍVEL É IMPOSSÍVEL, NÃO IMPROVÁVEL (11/09/2026) — ordem do dono.
 *
 * **O que aconteceu em 10/09:** o import baixou **1.499 FANTA UVA** (o real era **1**) e
 * depois a contagem devolveu **+1.496 a R$ 0,00**. Resultado: **saldo 4 unidades e valor
 * −R$ 10.160,52** — unidades positivas com dinheiro negativo, um estado que **não existe
 * no mundo**. A Coca-Cola 2L e a Coca Zero ficaram iguais.
 *
 * ⚠️ **SALDO negativo continua permitido** — é sinal legítimo de *"vendeu sem produzir"*,
 * e barrá-lo esconderia o aviso. O que não pode é **saldo ≥ 0 com valor < 0**: aí o custo
 * médio vira negativo e contamina a Posição, o cardápio (margem 5218%!) e o CMV.
 *
 * ⭐ E o guard mora AQUI, no choke-point de escrita do ledger — não em cada chamador
 * (REGRA 5): a Posição é derivada, então checar na tela seria checar depois do estrago.
 */
/** ⚠️ "1 unidade" e não "1 unidade(s)" — parêntese em mensagem de erro é ruído */
function unidadeOuUnidades(n: number): string {
  return Math.abs(n) === 1 ? 'unidade' : 'unidades'
}

/**
 * ⭐⭐ 23/09 — A ENTRADA QUE CRUZA O ZERO NÃO É BARRADA: ela LIMPA.
 *
 * ⛔ O guard abaixo nasceu pra a BAIXA (*"dinheiro negativo com saldo positivo não existe"*)
 * e, cravado, travava também a **entrada que conserta** — a nota do ALAN com SAL parou por
 * causa de R$ 0,22 pendurados. ***Item negativo não pode travar o fluxo alheio; a compra
 * que falta é justamente a cura.***
 *
 * Devolve o resíduo a absorver (negativo) quando há o que absorver.
 */
async function residuoAAbsorverNaEntrada(
  db: Db, m: NovoMovimento, custoTotal: number,
): Promise<number | null> {
  // ⛔ só a ENTRADA conserta — contagem sobre negativo continua na porta de 22/09
  if (m.quantidade <= 0 || !ehEntradaQueConserta(m.tipo)) return null
  const atual = await db.stockMovement.aggregate({
    where: { companyId: m.companyId, itemId: m.itemId, tipo: { notIn: [...TIPOS_FORA_DA_PRATELEIRA] } },
    _sum: { quantidade: true, custoTotal: true },
  })
  const v = avaliarEntrada({
    saldoAntes: round2(atual._sum.quantidade ?? 0),
    valorAntes: round2(atual._sum.custoTotal ?? 0),
    qtdDaEntrada: m.quantidade,
    valorDaEntrada: custoTotal,
  })
  if (v.decisao === 'OK' || v.decisao === 'RECUSA') return null
  if (v.decisao === 'AJUSTA_RESIDUO' || m.confirmouResiduo) return v.residuo

  // ⭐ PERGUNTA — com a conta na tela. Nunca beco.
  const item = await db.stockItem.findUnique({ where: { id: m.itemId }, select: { nome: true, unidadeControle: true } })
  throw new MovementInvalidError(frasePergunta(v, item?.nome ?? m.itemId, item?.unidadeControle ?? ''), {
    itemId: m.itemId, nome: item?.nome ?? m.itemId, saldoDepois: v.saldoDepois, valorDepois: v.valorDepois,
    code: 'RESIDUO_AO_CRUZAR_O_ZERO', residuo: v.residuo, teto: v.teto,
  })
}

async function assertSaldoNaoFicaImpossivel(db: Db, m: NovoMovimento, custoTotal: number) {
  // ⚠️ só olha quando ESTE movimento tira valor: entrada nunca cria o estado
  if (custoTotal > 0) return
  const atual = await db.stockMovement.aggregate({
    // ⚠️ a MESMA régua de prateleira do `saldo.ts` (dono único): o `PRODUCAO_CONSUMO` é
    // transferência interna e não conta no saldo — usar outra lista aqui faria o guard
    // julgar um saldo que a tela não mostra.
    where: { companyId: m.companyId, itemId: m.itemId, tipo: { notIn: [...TIPOS_FORA_DA_PRATELEIRA] } },
    _sum: { quantidade: true, custoTotal: true },
  })
  const saldoDepois = round2((atual._sum.quantidade ?? 0) + m.quantidade)
  const valorDepois = round2((atual._sum.custoTotal ?? 0) + custoTotal)
  if (saldoDepois >= 0 && valorDepois < -0.01) {
    /**
     * ⚠️⚠️ A MENSAGEM APONTA O CAMPO CERTO (16/09) — e isto veio de um caso real.
     *
     * Ela dizia *"confira a quantidade (ela costuma ser o sintoma)"*. No fermento a
     * quantidade do dono estava **CERTA** (10 kg é o que está na prateleira); o sintoma
     * era o **VALOR** residual de −R$ 31,04, de consumo lançado antes da nota de compra.
     * **Mensagem que acusa o campo errado faz o dono caçar um erro que não existe.**
     *
     * ⭐ Agora ela separa os dois casos pelo que o próprio movimento revela: se o saldo
     * **cruza o zero** (vinha negativo), o buraco é a ENTRADA que falta; se já estava
     * positivo, aí sim a quantidade é a suspeita.
     */
    const saldoAntes = round2(atual._sum.quantidade ?? 0)
    const valorAntes = round2(atual._sum.custoTotal ?? 0)
    const cruzouOZero = saldoAntes < 0 && saldoDepois >= 0
    /**
     * ⛔⛔ **A MENSAGEM NOMEIA O RÉU** (19/09). Ela dizia *"Este item ficaria com 0 unidades
     * e valor R$ -0.04"* — **sem dizer QUAL item**. Numa baixa de 58 produtos o dono ficava
     * travado sem saber onde agir, e os outros 57 viravam reféns do 1. ***Recusa que não
     * nomeia o réu é a mesma coisa que silêncio*** (a régua do 422 do estoque).
     */
    const item = await db.stockItem.findUnique({ where: { id: m.itemId }, select: { nome: true, unidadeControle: true, categoria: true } })
    const nome = item?.nome ?? m.itemId
    const un = item?.unidadeControle ?? ''

    /**
     * ⭐⭐ 22/09 — O ITEM PRODUZIDO NEGATIVO NÃO PEDE NOTA, PEDE PRODUÇÃO.
     *
     * A frase acima ("falta a COMPRA") nasceu do FERMENTO, que é matéria-prima. Cravada
     * pra todo item, ela mandava o dono caçar uma nota de `PORÇAO CALABRESA 85g` — que
     * ninguém compra. Os fatos que decidem a frase E a porta são resolvidos aqui, onde
     * há banco; quem os traduz em rótulo+href é uma função PURA (`porta-do-negativo`).
     *
     * ⚠️ As duas consultas só rodam no caminho da RECUSA (que é raro), nunca no feliz.
     */
    const familia = familiaDoItem(item?.categoria)
    const ordem = familia === 'PRODUZIDO'
      ? await db.stockProductionOrder.findFirst({
          where: { companyId: m.companyId, itemProduzidoId: m.itemId, estado: { in: ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'] } },
          select: { id: true, dataProducao: true },
          orderBy: { dataProducao: 'desc' },
        })
      : null
    const ficha = familia === 'PRODUZIDO'
      ? await db.stockFicha.findFirst({ where: { companyId: m.companyId, itemProduzidoId: m.itemId, ativo: true }, select: { id: true } })
      : null

    const fatos: FatosDoNegativo = {
      empresaId: m.companyId, itemId: m.itemId, nome, unidade: un, saldoAntes, familia,
      ordemAberta: ordem ? { id: ordem.id, dia: diaCurto(ordem.dataProducao) } : null,
      fichaAtivaId: ficha?.id ?? null,
    }

    throw new MovementInvalidError(
      `«${nome}» ficaria com ${saldoDepois} ${un || unidadeOuUnidades(saldoDepois)} e valor `
      + `R$ ${valorDepois.toFixed(2)} — dinheiro negativo com saldo positivo é um estado que não existe. `
      + `Hoje ele tem ${saldoAntes} ${un} valendo R$ ${valorAntes.toFixed(2)}; esta baixa tira `
      + `${Math.abs(m.quantidade)} ${un} (R$ ${Math.abs(custoTotal).toFixed(2)}). `
      + (cruzouOZero
        // ⭐ a frase agora segue a FAMÍLIA do item, não um só caso
        ? porQueEstaNegativo(fatos)
        : 'Confira a quantidade: ela costuma ser o sintoma.'),
      { itemId: m.itemId, nome, saldoDepois, valorDepois, fatos },
    )
  }
}

/** Cria um movimento no ledger (valida antes). custoTotal default = round2(qtd×custo). */
export async function criarMovimento(db: Db, m: NovoMovimento) {
  const custoTotal = m.custoTotal ?? round2(m.quantidade * m.custoUnitario)
  assertMovementValid({ quantidade: m.quantidade, custoUnitario: m.custoUnitario, custoTotal })
  /**
   * ⭐⭐ A ORDEM IMPORTA: a entrada que CRUZA O ZERO é avaliada ANTES do guard da baixa —
   * senão o guard barraria (valorDepois < 0) o movimento que existe pra consertar isso.
   */
  const residuo = await residuoAAbsorverNaEntrada(db, m, custoTotal)
  /**
   * ⛔ Com resíduo a absorver, o guard da BAIXA **não pode disparar**: ele veria o estado
   * do meio (saldo já positivo, valor ainda negativo) e barraria justamente o movimento
   * que existe pra consertar isso. O estado FINAL — depois do ajuste, logo abaixo — é
   * válido, e é ele que importa. Sem resíduo, o guard roda normal (inclusive pra dar a
   * frase certa no caso do FERMENTO, que é RECUSA por não cruzar o zero).
   */
  if (residuo == null) await assertSaldoNaoFicaImpossivel(db, m, custoTotal)
  if (residuo != null) {
    /**
     * ⛔⛔ O AJUSTE É UMA LINHA PRÓPRIA, nunca um `custoTotal` inflado na entrada.
     * Somar no movimento da nota quebraria (a) o CHECK do ledger e (b) o invariante **E16**
     * (`Σ(ENTRADA_NF da nota) == Σ(vProd)`) — a nota passaria a valer mais do que o
     * documento assinado diz. ***A nota é FATO e não se reescreve.***
     *
     * ⚠️ Sem `nfeChave` de propósito: ele é do ITEM, não do documento.
     */
    /**
     * ⚠️ O IDIOMA É O DO `encerrar-item` (REGRA 4): a quantidade **não pode ser zero** (o
     * CHECK do ledger recusa), então vai **0,001** — o menor passo que o módulo reconhece,
     * que o `round2` do saldo absorve. E o unitário é **DERIVADO do total**, nunca montado
     * na mão: lá isso errou o sinal e o banco recusou por 14 centavos.
     */
    const q = 0.001
    const custoDoAjuste = round2(-residuo)
    assertMovementValid({ quantidade: q, custoUnitario: custoDoAjuste / q, custoTotal: custoDoAjuste })
    await db.stockMovement.create({
      data: {
        companyId: m.companyId, itemId: m.itemId, tipo: TIPO_AJUSTE_RESIDUO,
        quantidade: q, custoUnitario: custoDoAjuste / q, custoTotal: custoDoAjuste,
        receiptId: m.receiptId ?? null, origem: m.origem, criadoPorId: m.criadoPorId ?? null,
        ...(m.dataMovimento ? { dataMovimento: m.dataMovimento } : {}),
      },
    })
  }
  return db.stockMovement.create({
    data: {
      companyId: m.companyId, itemId: m.itemId, tipo: m.tipo, quantidade: m.quantidade,
      custoUnitario: m.custoUnitario, custoTotal, receiptId: m.receiptId ?? null, nfeChave: m.nfeChave ?? null,
      nItem: m.nItem ?? null, estornoDeId: m.estornoDeId ?? null, origem: m.origem, criadoPorId: m.criadoPorId ?? null,
      ...(m.dataMovimento ? { dataMovimento: m.dataMovimento } : {}),
    },
  })
}

/**
 * ESTORNA um movimento (correção). Cria o movimento OPOSTO (mesmo item, quantidade e
 * custoTotal com sinal invertido, tipo=ESTORNO, estornoDeId → original). NÃO edita nem
 * apaga o original (o banco nem deixa). Depois quem chama cria o movimento CERTO.
 * Idempotente: se já existe um estorno deste movimento, devolve o existente.
 */
export async function estornarMovimento(db: Db, movimentoId: string, opts: { criadoPorId?: string | null } = {}) {
  const orig = await db.stockMovement.findUnique({ where: { id: movimentoId } })
  if (!orig) throw new MovementInvalidError(`Movimento ${movimentoId} não existe.`)
  if (orig.tipo === 'ESTORNO') throw new MovementInvalidError('Não se estorna um estorno — crie o movimento certo.')
  const jaEstornado = await db.stockMovement.findFirst({ where: { estornoDeId: movimentoId, tipo: 'ESTORNO' } })
  if (jaEstornado) return jaEstornado
  return criarMovimento(db, {
    companyId: orig.companyId, itemId: orig.itemId, tipo: 'ESTORNO',
    quantidade: -orig.quantidade, custoUnitario: orig.custoUnitario, custoTotal: round2(-orig.custoTotal),
    receiptId: orig.receiptId, nfeChave: orig.nfeChave, nItem: orig.nItem,
    estornoDeId: orig.id, origem: orig.origem, criadoPorId: opts.criadoPorId ?? null,
  })
}
