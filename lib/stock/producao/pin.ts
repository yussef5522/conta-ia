// ⭐⭐ O PIN DA COZINHA — IDENTIFICA, NÃO AUTENTICA (decisão do dono, 06/09/2026).
//
// > *"Ele diz 'quem está apertando iniciar/finalizar' no aparelho compartilhado da cozinha;
// > não abre nada além da janela de produção. Qualquer tela sensível continua exigindo login
// > de verdade."*
//
// ⭐ É O PADRÃO DA CATEGORIA: o Jolt separa *Personal Device Mode* (e-mail e senha) de
// *Shared Device Mode*, onde um PIN de 4 dígitos identifica entre vários usuários do mesmo
// aparelho; Operandio, Connecteam e Clockspot fazem igual. Ninguém pede login completo numa
// cozinha — e o custo de pedir seria o funcionário não usar a tela.
//
// ⛔⛔ MESMO IDENTIFICANDO, VAI COMO HASH. O segredo mora num tablet de cozinha, lugar
// exposto, e gente reusa quatro dígitos em outros lugares (banco, celular). Guardar em claro
// seria vazar o PIN do cartão de alguém por preguiça nossa. É o mesmo tratamento do token da
// Zebra — lá o estrago de vazar era imprimir etiqueta, aqui é menor ainda, e ainda assim
// não se guarda em claro o que a pessoa digita como segredo.
//
// ⚠️ QUEM DIZ **QUAL EMPRESA** É A SESSÃO DO APARELHO, não o PIN: a rota exige `stock.executar`
// na empresa antes de olhar qualquer dígito. Sem isso, quatro dígitos abririam a cozinha de
// qualquer empresa do sistema — e 10.000 combinações não são segredo nenhum.

import { createHash, timingSafeEqual } from 'crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class PinError extends Error {}

export const TAMANHO_DO_PIN = 4

/**
 * Hash do PIN. ⚠️ **Com o `companyId` dentro**: o mesmo "1234" em duas empresas dá hashes
 * diferentes, então um dump de uma empresa não conta nada sobre a outra — e ninguém consegue
 * pré-computar uma tabela dos 10.000 PINs possíveis que sirva pra todo mundo.
 */
export function hashDoPin(companyId: string, pin: string): string {
  return createHash('sha256').update(`stock-pin:${companyId}:${pin}`).digest('hex')
}

/** ⚠️ comparação em tempo constante — barato, e evita a classe inteira de ataque por tempo */
function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * ⛔ PINs que não protegem nada. Quatro dígitos já são pouco; "0000" e "1234" são o que todo
 * mundo escolhe, e num cadastro de 5 pessoas isso vira *quem apertou* virando adivinhação.
 *
 * ⚠️ Recusa BARULHENTA na hora de cadastrar, nunca silenciosa — e a mensagem diz o porquê.
 */
const OBVIOS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123'])

export function validarFormatoDoPin(pin: string): void {
  if (!new RegExp(`^\\d{${TAMANHO_DO_PIN}}$`).test(pin)) {
    throw new PinError(`O PIN tem ${TAMANHO_DO_PIN} dígitos, só números.`)
  }
  if (OBVIOS.has(pin)) {
    throw new PinError('Esse PIN é fácil demais (0000, 1234…). Como ele é a assinatura de quem fez a tarefa, escolha outro.')
  }
}

/**
 * Define o PIN de um colaborador. Trocar = **revogar o anterior e criar** — o rastro fica
 * dos dois lados, como toda decisão neste módulo.
 *
 * ⚠️ É gesto de GERÊNCIA (`stock.manage`): quem escolhe o PIN de alguém decide de quem vai
 * ser a assinatura do trabalho.
 */
export async function definirPin(
  input: { companyId: string; colaboradorId: string; pin: string; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ trocou: boolean }> {
  validarFormatoDoPin(input.pin)
  const colab = await db.stockColaborador.findFirst({ where: { id: input.colaboradorId, companyId: input.companyId } })
  if (!colab) throw new PinError('Esse colaborador não existe nesta empresa.')

  const hash = hashDoPin(input.companyId, input.pin)
  // ⛔ dois colaboradores com o MESMO PIN tornariam a identificação ambígua — e ambiguidade
  // aqui não é um erro de tela, é o tempo do trabalho indo pro nome errado.
  const jaUsado = await db.stockColaboradorPin.findFirst({
    where: { companyId: input.companyId, pinHash: hash, revogadoEm: null, colaboradorId: { not: input.colaboradorId } },
  })
  if (jaUsado) throw new PinError('Outra pessoa já usa esse PIN. Escolha outro — o PIN é a assinatura de quem fez a tarefa.')

  return db.$transaction(async (tx) => {
    const anterior = await tx.stockColaboradorPin.findFirst({
      where: { companyId: input.companyId, colaboradorId: input.colaboradorId, revogadoEm: null }, select: { id: true },
    })
    if (anterior) await tx.stockColaboradorPin.update({ where: { id: anterior.id }, data: { revogadoEm: new Date() } })
    await tx.stockColaboradorPin.create({
      data: { companyId: input.companyId, colaboradorId: input.colaboradorId, pinHash: hash, criadoPorId: input.userId ?? null },
    })
    return { trocou: !!anterior }
  })
}

export async function revogarPin(companyId: string, colaboradorId: string, db: PrismaClient = defaultPrisma): Promise<void> {
  await db.stockColaboradorPin.updateMany({
    where: { companyId, colaboradorId, revogadoEm: null }, data: { revogadoEm: new Date() },
  })
}

/** quem tem PIN ativo (a tela de cadastro mostra isso — nunca o PIN em si) */
export async function colaboradoresComPin(companyId: string, db: Db = defaultPrisma): Promise<Set<string>> {
  const rows = await db.stockColaboradorPin.findMany({ where: { companyId, revogadoEm: null }, select: { colaboradorId: true } })
  return new Set(rows.map((r) => r.colaboradorId))
}

/**
 * ⭐ QUEM É ESTE PIN? `null` quando não bate — e o caller **não diz o motivo**: "PIN não
 * confere" é a única resposta possível, porque distinguir "não existe" de "é de outra
 * pessoa" seria ensinar a enumerar.
 */
export async function quemEstaComOPin(
  companyId: string, pin: string, db: Db = defaultPrisma,
): Promise<{ colaboradorId: string; nome: string } | null> {
  if (!new RegExp(`^\\d{${TAMANHO_DO_PIN}}$`).test(pin)) return null
  const hash = hashDoPin(companyId, pin)
  const ativos = await db.stockColaboradorPin.findMany({
    where: { companyId, revogadoEm: null }, select: { colaboradorId: true, pinHash: true },
  })
  // ⚠️ varre todos comparando em tempo constante em vez de buscar pelo hash: o custo é
  // desprezível (uma cozinha tem dezenas de pessoas) e o tempo de resposta não vaza nada.
  let achado: string | null = null
  for (const a of ativos) if (iguais(a.pinHash, hash)) achado = a.colaboradorId
  if (!achado) return null
  const colab = await db.stockColaborador.findFirst({ where: { companyId, id: achado, ativo: true }, select: { id: true, nome: true } })
  // colaborador desativado com PIN vivo → trata como PIN inválido (e o gestor revoga quando quiser)
  return colab ? { colaboradorId: colab.id, nome: colab.nome } : null
}
