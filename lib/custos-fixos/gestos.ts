/**
 * ⭐⭐ OS DOIS GESTOS DO DONO (06/10/2026) — marcar categoria como fixa, e declarar o plano.
 *
 * ⛔⛔ **SÓ ESTAS DUAS COISAS SE GRAVAM NESTA TELA.** O realizado nunca passa por aqui — ele é
 * derivado das transações, pela porta do fluxo. Um `valorRealizado` gravado seria a 2ª fonte do
 * mesmo fato, e ele envelheceria no primeiro estorno (a doença do `CreditCardInvoice.status`).
 *
 * ⚠️ TODO gesto grava RASTRO (quem/quando) porque o plano é uma AFIRMAÇÃO do dono: em três
 * meses, *"quem disse que o aluguel era 8.400?"* tem que ter resposta.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prateleiraOuPadrao, type Prateleira } from './prateleira'

type Db = PrismaClient | Prisma.TransactionClient

export class CustoFixoError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'CustoFixoError'
  }
}

/** ⭐ a FORMA do mês — o vocabulário mora aqui, o banco garante só o formato */
export const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * ⭐ MARCA a categoria como custo fixo da casa.
 *
 * ⚠️ Idempotente e REVERSÍVEL COM HISTÓRIA: marcar de novo uma que foi removida **reabre a
 * mesma linha** (limpa `removidoEm`) em vez de criar uma segunda — o `@@unique` recusaria, e
 * gravar uma 2ª linha faria o "quem marcou" perder o começo da história.
 */
export async function marcarComoFixa(
  companyId: string,
  categoryId: string,
  quemId: string | null,
  db: Db = prisma,
  /**
   * ⭐ 07/10 — EM QUAL PRATELEIRA. `undefined` preserva a de quem já estava na lista (marcar de
   * novo não move a linha de lugar) e usa o padrão CASA pra quem entra agora.
   *
   * ⛔⛔ **MARCAR E MOVER CAEM NO MESMO GESTO, de propósito.** A ordem é *"o seletor de marcar
   * categoria ganha a escolha da prateleira"* — se mover fosse um segundo endpoint, haveria
   * duas portas gravando a mesma decisão, e a 2ª herdaria as travas da 1ª só se alguém
   * lembrasse (é a doença do `PAGAMENTO_EMPRESTIMO` que gravou sem split em 11/09).
   */
  prateleira?: Prateleira,
): Promise<{ marcada: true; prateleira: Prateleira }> {
  const cat = await db.category.findFirst({
    where: { id: categoryId, companyId },
    select: { id: true, type: true, isActive: true },
  })
  // ⚠️ REGRA 8: resolver por ID **dentro da empresa** — categoria de outra empresa não existe aqui
  if (!cat) throw new CustoFixoError('Esta categoria não é desta empresa.', 'CATEGORIA_DE_OUTRA_EMPRESA')
  if (cat.type !== 'EXPENSE') {
    throw new CustoFixoError(
      'Custo fixo é despesa — categoria de receita não entra na lista do que a casa custa.',
      'CATEGORIA_NAO_E_DESPESA',
    )
  }
  if (!cat.isActive) {
    throw new CustoFixoError('Esta categoria está desativada — reative antes de marcar como fixa.', 'CATEGORIA_INATIVA')
  }

  const agora = new Date()
  /**
   * ⚠️ O RASTRO DA PRATELEIRA SÓ NASCE QUANDO ELA FOI ESCOLHIDA. Carimbar quem/quando numa
   * marcação que caiu no padrão CASA diria *"o dono pôs isto no banco"* sobre uma decisão que
   * ninguém tomou — e o CHECK do banco exige os dois campos juntos ou nenhum (REGRA 13).
   */
  const rastro = prateleira
    ? { prateleira, prateleiraDefinidaPorId: quemId, prateleiraDefinidaEm: agora }
    : {}

  const linha = await db.custoFixoCategoria.upsert({
    where: { companyId_categoryId: { companyId, categoryId } },
    create: { companyId, categoryId, marcadoPorId: quemId, ...rastro },
    // ⛔ reabrir ZERA o rastro da remoção — senão a linha fica dizendo "removida" e ativa
    update: { removidoEm: null, removidoPorId: null, marcadoPorId: quemId, marcadoEm: agora, ...rastro },
    select: { prateleira: true },
  })
  return { marcada: true, prateleira: prateleiraOuPadrao(linha.prateleira) }
}

/**
 * ⭐ TIRA a categoria da lista — e **não apaga a linha**.
 *
 * ⚠️ Carimbar `removidoEm` em vez de deletar é o que permite responder *"quem tirou o aluguel
 * da lista, e quando?"*. Apagar deixaria a lista mudando de tamanho sem ninguém poder explicar.
 * ⛔ E o PLANEJADO dos meses passados FICA: ele é o que o dono declarou naquele mês, e apagar
 * reescreveria o histórico de uma decisão que foi tomada.
 */
export async function tirarDaLista(
  companyId: string,
  categoryId: string,
  quemId: string | null,
  db: Db = prisma,
): Promise<{ removida: true }> {
  const linha = await db.custoFixoCategoria.findUnique({
    where: { companyId_categoryId: { companyId, categoryId } },
    select: { id: true, removidoEm: true },
  })
  if (!linha) throw new CustoFixoError('Esta categoria não está na lista de custos fixos.', 'NAO_ESTA_NA_LISTA')
  if (linha.removidoEm) return { removida: true } // idempotente
  await db.custoFixoCategoria.update({
    where: { id: linha.id },
    data: { removidoEm: new Date(), removidoPorId: quemId },
  })
  return { removida: true }
}

/**
 * ⭐ DECLARA o planejado daquela categoria naquele mês.
 *
 * ⛔ Só aceita categoria QUE ESTÁ na lista — planejar um custo que não é fixo criaria um plano
 * invisível (a tela não mostraria a linha) e o cartão (a) deixaria de ser a Σ das linhas, que é
 * o invariante que o dono pediu.
 *
 * ⚠️ `valor: null` APAGA o plano (volta pra "ainda não declarei"), que é diferente de declarar
 * ZERO ("declarei que aqui não sai nada"). Dois estados, dois significados — colapsá-los faria
 * o "% pago" dividir por zero e o cartão mentir.
 */
export async function definirPlanejado(
  companyId: string,
  categoryId: string,
  mes: string,
  valor: number | null,
  quemId: string | null,
  db: Db = prisma,
): Promise<{ planejado: number | null }> {
  if (!MES_RE.test(mes)) throw new CustoFixoError('Mês inválido — use o formato AAAA-MM.', 'MES_INVALIDO')
  if (valor != null && (!Number.isFinite(valor) || valor < 0)) {
    throw new CustoFixoError('O plano não pode ser negativo — é o que a casa PAGA.', 'VALOR_INVALIDO')
  }

  const naLista = await db.custoFixoCategoria.findUnique({
    where: { companyId_categoryId: { companyId, categoryId } },
    select: { removidoEm: true },
  })
  if (!naLista || naLista.removidoEm) {
    throw new CustoFixoError(
      'Esta categoria não está na lista de custos fixos — marque ela como fixa antes de planejar.',
      'NAO_ESTA_NA_LISTA',
    )
  }

  if (valor == null) {
    await db.custoFixoPlanejado.deleteMany({ where: { companyId, categoryId, mes } })
    return { planejado: null }
  }

  // ⚠️ arredonda em CENTAVO na borda da gravação: o campo é dinheiro, não medida física
  const v = Math.round(valor * 100) / 100
  await db.custoFixoPlanejado.upsert({
    where: { companyId_categoryId_mes: { companyId, categoryId, mes } },
    create: { companyId, categoryId, mes, valor: v, definidoPorId: quemId },
    update: { valor: v, definidoPorId: quemId },
  })
  return { planejado: v }
}
