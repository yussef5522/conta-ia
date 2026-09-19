// ⭐⭐⭐ AVISO SEM PORTA É BECO — AS TRÊS SAÍDAS DA ORDEM PARADA (19/09/2026).
//
// **O dono:** *"o painel diz '1 ordem de ontem ainda em produção — o insumo saiu da
// prateleira e não virou produto'. Me explica NA TELA: o card do aviso leva pra ordem com
// as saídas possíveis. Aviso sem porta é a regra de sempre."*
//
// ⭐ **E as três portas JÁ EXISTIAM** — concluir, cancelar-e-devolver e o plano de etapa
// (15/09, *"o lote pode dormir"*). O que faltava era o aviso **nomeá-las**: quem lê
// *"insumo saiu da prateleira e não virou produto"* fica sabendo do problema e não do que
// fazer com ele, e o lote passa dois dias parado com dinheiro dentro — foi o que houve com
// os **R$ 42,18** da calabresa ralada.
//
// ⛔ **O QUE ESTA LIB NÃO FAZ: decidir.** Ela diz quais saídas cabem e o que cada uma
// significa em dinheiro e em rastro. *Concluir sem o dono é inventar rendimento; cancelar
// sem o dono é jogar fora trabalho que pode estar feito.* As três aparecem, ele escolhe.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** ⚠️ erro de DOMÍNIO: a recusa é pro dono ler, não stack trace */
export class OrdemParadaError extends Error {}

export type SaidaDaOrdem = 'CONCLUIR' | 'CANCELAR_E_DEVOLVER' | 'CONTINUA_DEPOIS'

export interface EstadoDaOrdemParada {
  estado: string
  /** R$ que saíram da prateleira e ainda não viraram produto */
  valorPreso: number
  horasParada: number
  /** alguma etapa com cronômetro correndo? (aí não está parada, está sendo feita) */
  temEtapaEmAndamento: boolean
  /** já existe plano dizendo que ela continua noutro dia? (15/09) */
  temPlanoDeContinuar: boolean
  /** ⛔ a data dela é do mundo real? (a ordem do ano 202) */
  dataPlausivel: boolean
}

export interface PortaDaOrdem {
  acao: SaidaDaOrdem
  rotulo: string
  /** o que acontece de fato — em dinheiro e em rastro */
  efeito: string
  primaria?: boolean
}

export interface VeredictoDaOrdemParada {
  /** o aviso só existe quando há o que avisar */
  avisar: boolean
  motivo: string | null
  portas: PortaDaOrdem[]
}

/** ⭐ 24h é o mesmo limiar do P2 — uma régua, um dono */
export const HORAS_PARA_AVISAR = 24

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * ⭐⭐ A DECISÃO, pura.
 *
 * ⚠️ **Etapa em andamento NÃO é ordem parada** — alguém está com a mão na massa agora, e
 * avisar ali treinaria o dono a ignorar o aviso (a lição dos 111 alarmes falsos). O mesmo
 * vale pro lote que **já foi marcado pra continuar depois**: massa que descansa é a
 * RECEITA, não atraso (15/09).
 */
export function saidasDaOrdemParada(e: EstadoDaOrdemParada): VeredictoDaOrdemParada {
  const aberta = e.estado === 'EM_PRODUCAO' || e.estado === 'SEPARADA'
  const parada = aberta && e.horasParada >= HORAS_PARA_AVISAR && !e.temEtapaEmAndamento && !e.temPlanoDeContinuar
  if (!parada) return { avisar: false, motivo: null, portas: [] }

  const dias = Math.floor(e.horasParada / 24)
  const tempo = dias >= 1 ? `há ${dias} dia${dias === 1 ? '' : 's'}` : `há ${Math.round(e.horasParada)}h`
  const dinheiro = e.valorPreso > 0.01
    ? ` R$ ${brl(e.valorPreso)} saíram da prateleira e ainda não viraram produto.`
    : ''
  // ⚠️ a data torta entra no MOTIVO porque ela explica o sumiço — sem isso o dono lê
  //    "parada há 2 dias" numa ordem que ele jurava não existir (o caso do ano 202).
  const datas = e.dataPlausivel ? '' : ' ⚠️ A data desta ordem está fora do calendário — foi por isso que ela sumiu das listas.'

  return {
    avisar: true,
    motivo: `Esta ordem está parada ${tempo}.${dinheiro}${datas}`,
    portas: [
      {
        acao: 'CONCLUIR', rotulo: 'concluir agora (digitar quanto saiu)', primaria: true,
        efeito: 'o produto entra no estoque com o custo real do lote e as etapas abertas são encerradas sem tempo medido',
      },
      {
        acao: 'CANCELAR_E_DEVOLVER', rotulo: 'cancelar e devolver os insumos',
        efeito: e.valorPreso > 0.01
          ? `os R$ ${brl(e.valorPreso)} voltam pra prateleira e a ordem fica cancelada no histórico`
          : 'a ordem fica cancelada no histórico',
      },
      {
        acao: 'CONTINUA_DEPOIS', rotulo: 'continua depois (é lote que dorme)',
        efeito: 'o insumo continua reservado e o aviso cala — massa que descansa é a receita, não atraso',
      },
    ],
  }
}

/**
 * ⭐ A GRAVAÇÃO DA 3ª PORTA — marca que o lote continua noutro dia.
 *
 * ⛔ Reusa `stock_etapa_plano` (15/09), que já é o dono da pergunta *"em que dia esta
 * etapa acontece?"*. Uma tabela nova aqui seria uma SEGUNDA resposta pra mesma pergunta, e
 * as duas divergiriam no primeiro caso de borda — a doença que este módulo mais paga.
 *
 * ⚠️ Marca a primeira etapa NÃO finalizada: é ela que representa o trabalho que falta.
 * Marcar todas faria o tablet mostrar etapas futuras como se fossem do dia.
 */
export async function marcarQueContinuaDepois(
  input: { companyId: string; ordemId: string; dia: Date; userId?: string | null },
  db: Db,
): Promise<{ etapaId: string }> {
  const etapa = await db.stockOrdemEtapa.findFirst({
    where: { companyId: input.companyId, ordemId: input.ordemId, finalizadoEm: null },
    orderBy: { posicao: 'asc' }, select: { id: true },
  })
  if (!etapa) throw new OrdemParadaError('Esta ordem não tem etapa aberta pra continuar depois.')
  await db.stockEtapaPlano.upsert({
    where: { etapaId: etapa.id },
    create: { companyId: input.companyId, etapaId: etapa.id, diaPrevisto: input.dia, definidoPorId: input.userId ?? null },
    update: { diaPrevisto: input.dia, definidoPorId: input.userId ?? null },
  })
  return { etapaId: etapa.id }
}
