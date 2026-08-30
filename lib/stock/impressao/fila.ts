// ⭐⭐ FILA DE IMPRESSÃO DE ETIQUETA (30/08/2026) — o celular da cozinha imprime.
//
// ⚠️ POR QUE FILA E NÃO "SERVIDOR → IP DA IMPRESSORA" (o pedido original do dono): o
// servidor roda num DATACENTER e a impressora está na LAN da cozinha — **não existe
// rota**. Alcançar o IP dela exigiria expor a porta 9100 na internet, e **9100 não tem
// autenticação nenhuma**: qualquer um imprimiria, ou entupiria a bobina de propósito.
//
// ⭐ O DESENHO QUE ENTREGA O OBJETIVO:
//     celular → app (HTTPS) → FILA → agente PUXA (HTTPS de saída) → impressora
//
//   · o agente só faz conexão de SAÍDA: sem porta aberta, sem IP fixo, sem VPN
//   · a fila é o que faz **etiqueta não se perder**: impressora ocupada, sem papel ou
//     desligada → o job espera e sai depois, com retry contado
//   · e o agente deixa de precisar estar no PC com o cabo: com impressora de REDE ele
//     roda em QUALQUER máquina da LAN (um Raspberry Pi serve)
//
// ⚠️ O TOKEN DO AGENTE É GUARDADO COMO HASH. O agente não tem sessão de navegador, então
// precisa de um segredo próprio — e segredo em texto no banco é o tipo de coisa que só se
// descobre que era problema depois. Guarda-se o hash; o token aparece UMA vez, na criação.

import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class ImpressaoError extends Error {}

/** máximo de tentativas antes de o job parar e pedir olho humano */
export const MAX_TENTATIVAS = 5

export const hashToken = (token: string) => createHash('sha256').update(token.trim()).digest('hex')
export const novoToken = () => `zeb_${randomBytes(24).toString('base64url')}`

// ---------------------------------------------------------------------------
// CADASTRO DA IMPRESSORA
// ---------------------------------------------------------------------------

export interface NovaImpressora {
  companyId: string
  nome: string
  tipo: 'REDE' | 'USB'
  /** IP na LAN (só REDE) */
  host?: string | null
  porta?: number
  /** nome da fila no sistema operacional (só USB) */
  filaUsb?: string | null
  userId?: string | null
}

export async function cadastrarImpressora(input: NovaImpressora, db: PrismaClient = defaultPrisma) {
  const nome = input.nome.trim()
  if (!nome) throw new ImpressaoError('Dê um nome pra impressora (ex: "Zebra da cozinha").')
  if (input.tipo === 'REDE' && !input.host?.trim()) {
    throw new ImpressaoError('Impressora de rede precisa do IP dela na sua rede (ex: 192.168.0.50).')
  }
  const token = novoToken()
  const imp = await db.stockImpressora.create({
    data: {
      companyId: input.companyId, nome, tipo: input.tipo,
      host: input.tipo === 'REDE' ? input.host!.trim() : null,
      porta: input.porta ?? 9100,
      filaUsb: input.tipo === 'USB' ? (input.filaUsb?.trim() || null) : null,
      tokenHash: hashToken(token), criadoPorId: input.userId ?? null,
    },
  })
  // ⚠️ o token volta AQUI e nunca mais — a tela mostra uma vez e manda copiar.
  return { impressora: imp, token }
}

/** o agente se identifica pelo token; devolve a impressora ou null (nunca diz "existe mas…") */
export async function impressoraPorToken(token: string, db: Db = defaultPrisma) {
  if (!token?.trim()) return null
  return db.stockImpressora.findFirst({ where: { tokenHash: hashToken(token), ativa: true } })
}

// ---------------------------------------------------------------------------
// ENFILEIRAR (qualquer dispositivo, inclusive o celular)
// ---------------------------------------------------------------------------

export async function enfileirar(
  input: { companyId: string; zpl: string; descricao: string; copias?: number; impressoraId?: string | null; userId?: string | null },
  db: Db = defaultPrisma,
) {
  const zpl = input.zpl?.trim()
  if (!zpl) throw new ImpressaoError('Não há ZPL pra imprimir.')
  const copias = input.copias ?? 1
  if (!(copias > 0 && copias <= 200)) throw new ImpressaoError('Quantidade de cópias fora do razoável (1 a 200).')
  return db.stockImpressaoJob.create({
    data: {
      companyId: input.companyId, zpl, copias,
      descricao: input.descricao.trim() || 'etiqueta',
      impressoraId: input.impressoraId ?? null, criadoPorId: input.userId ?? null,
    },
  })
}

// ---------------------------------------------------------------------------
// O AGENTE PUXA
// ---------------------------------------------------------------------------

/**
 * Entrega o próximo job e o marca IMPRIMINDO.
 *
 * ⚠️ A MARCA É O QUE IMPEDE DOIS AGENTES DE IMPRIMIR A MESMA ETIQUETA. `updateMany` com
 * `status: 'PENDENTE'` no WHERE é a trava: quem atualizar 0 linhas perdeu a corrida e
 * pega o próximo. Sem isso, dois PCs rodando o agente dobrariam cada etiqueta — e ninguém
 * descobriria até faltar bobina.
 */
export async function proximoJob(companyId: string, impressoraId: string, db: PrismaClient = defaultPrisma) {
  for (let i = 0; i < 5; i++) {
    const candidato = await db.stockImpressaoJob.findFirst({
      where: {
        companyId, status: 'PENDENTE', tentativas: { lt: MAX_TENTATIVAS },
        OR: [{ impressoraId: null }, { impressoraId }],
      },
      orderBy: { criadoEm: 'asc' },
    })
    if (!candidato) return null
    const ganhou = await db.stockImpressaoJob.updateMany({
      where: { id: candidato.id, status: 'PENDENTE' },
      data: { status: 'IMPRIMINDO', impressoraId, tentativas: { increment: 1 } },
    })
    // ⚠️ devolve o estado DEPOIS do update, não o de antes: o objeto dizia PENDENTE com o
    // banco já em IMPRIMINDO, e quem lesse o retorno tomaria decisão sobre um estado que
    // não existe mais. É a família do "duas fontes pra mesma pergunta", em miniatura.
    if (ganhou.count === 1) {
      return { ...candidato, status: 'IMPRIMINDO', impressoraId, tentativas: candidato.tentativas + 1 }
    }
    // outro agente pegou este — tenta o próximo
  }
  return null
}

/** o agente diz o que aconteceu. Erro volta pra PENDENTE até o teto de tentativas. */
export async function registrarResultado(
  input: { companyId: string; jobId: string; ok: boolean; erro?: string | null },
  db: PrismaClient = defaultPrisma,
) {
  const job = await db.stockImpressaoJob.findFirst({ where: { id: input.jobId, companyId: input.companyId } })
  if (!job) throw new ImpressaoError('Job não encontrado.')
  if (input.ok) {
    return db.stockImpressaoJob.update({ where: { id: job.id }, data: { status: 'IMPRESSA', ultimoErro: null } })
  }
  // ⚠️ o job volta pra fila e tenta de novo — impressora sem papel é evento comum, não
  // motivo pra perder a etiqueta. Só depois de MAX_TENTATIVAS ele para e pede olho humano.
  const esgotou = job.tentativas >= MAX_TENTATIVAS
  return db.stockImpressaoJob.update({
    where: { id: job.id },
    data: { status: esgotou ? 'ERRO' : 'PENDENTE', ultimoErro: (input.erro ?? 'falha na impressão').slice(0, 400) },
  })
}

export async function pingImpressora(impressoraId: string, db: PrismaClient = defaultPrisma) {
  await db.stockImpressora.update({ where: { id: impressoraId }, data: { ultimoPing: new Date() } })
}

// ---------------------------------------------------------------------------
// A FILA NA TELA
// ---------------------------------------------------------------------------

export interface FilaView {
  impressoras: Array<{
    id: string; nome: string; tipo: string; host: string | null; porta: number
    ativa: boolean; ultimoPing: string | null; online: boolean
  }>
  jobs: Array<{
    id: string; descricao: string; status: string; copias: number
    tentativas: number; ultimoErro: string | null; criadoEm: string
  }>
  pendentes: number
  comErro: number
}

/** agente considerado ONLINE se falou com o servidor nos últimos 2 minutos */
export const JANELA_ONLINE_MS = 120_000

export async function verFila(companyId: string, db: PrismaClient = defaultPrisma, agora = new Date()): Promise<FilaView> {
  const [impressoras, jobs] = await Promise.all([
    db.stockImpressora.findMany({ where: { companyId }, orderBy: { criadoEm: 'asc' } }),
    db.stockImpressaoJob.findMany({ where: { companyId }, orderBy: { criadoEm: 'desc' }, take: 50 }),
  ])
  return {
    impressoras: impressoras.map((i) => ({
      id: i.id, nome: i.nome, tipo: i.tipo, host: i.host, porta: i.porta, ativa: i.ativa,
      ultimoPing: i.ultimoPing?.toISOString() ?? null,
      online: !!i.ultimoPing && agora.getTime() - i.ultimoPing.getTime() < JANELA_ONLINE_MS,
    })),
    jobs: jobs.map((j) => ({
      id: j.id, descricao: j.descricao, status: j.status, copias: j.copias,
      tentativas: j.tentativas, ultimoErro: j.ultimoErro, criadoEm: j.criadoEm.toISOString(),
    })),
    pendentes: jobs.filter((j) => j.status === 'PENDENTE' || j.status === 'IMPRIMINDO').length,
    comErro: jobs.filter((j) => j.status === 'ERRO').length,
  }
}

/** o dono manda tentar de novo um job que estourou as tentativas */
export async function reenfileirar(companyId: string, jobId: string, db: PrismaClient = defaultPrisma) {
  const job = await db.stockImpressaoJob.findFirst({ where: { id: jobId, companyId } })
  if (!job) throw new ImpressaoError('Job não encontrado.')
  return db.stockImpressaoJob.update({
    where: { id: job.id }, data: { status: 'PENDENTE', tentativas: 0, ultimoErro: null },
  })
}
