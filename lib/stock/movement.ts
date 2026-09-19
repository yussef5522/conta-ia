// ESTOQUE FASE 1 (20/08) — o LEDGER. Criar movimento (validado) e ESTORNAR (correção).
// O banco garante a imutabilidade (trigger) e o CHECK; aqui é a porta da app que
// valida ANTES de gravar (mesma regra, runtime) e implementa a correção = estorno+novo.

import type { PrismaClient, Prisma } from '@prisma/client'
import { TIPOS_FORA_DA_PRATELEIRA } from './saldo'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const CUSTO_TOL = 0.01 // por LINHA (o mesmo do CHECK do banco)

/** ⭐ quem é o item barrado — a tela precisa disto pra oferecer "deixa este pendente" */
export interface CulpadoDoMovimento {
  itemId: string
  nome: string
  saldoDepois: number
  valorDepois: number
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
    const item = await db.stockItem.findUnique({ where: { id: m.itemId }, select: { nome: true, unidadeControle: true } })
    const nome = item?.nome ?? m.itemId
    const un = item?.unidadeControle ?? ''
    throw new MovementInvalidError(
      `«${nome}» ficaria com ${saldoDepois} ${un || unidadeOuUnidades(saldoDepois)} e valor `
      + `R$ ${valorDepois.toFixed(2)} — dinheiro negativo com saldo positivo é um estado que não existe. `
      + `Hoje ele tem ${saldoAntes} ${un} valendo R$ ${valorAntes.toFixed(2)}; esta baixa tira `
      + `${Math.abs(m.quantidade)} ${un} (R$ ${Math.abs(custoTotal).toFixed(2)}). `
      + (cruzouOZero
        ? `O saldo estava em ${saldoAntes} (saiu mais do que entrou), então falta registrar `
          + 'a COMPRA que não foi lançada — não é a sua contagem que está errada.'
        : 'Confira a quantidade: ela costuma ser o sintoma.'),
      { itemId: m.itemId, nome, saldoDepois, valorDepois },
    )
  }
}

/** Cria um movimento no ledger (valida antes). custoTotal default = round2(qtd×custo). */
export async function criarMovimento(db: Db, m: NovoMovimento) {
  const custoTotal = m.custoTotal ?? round2(m.quantidade * m.custoUnitario)
  assertMovementValid({ quantidade: m.quantidade, custoUnitario: m.custoUnitario, custoTotal })
  await assertSaldoNaoFicaImpossivel(db, m, custoTotal)
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
