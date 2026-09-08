// ⭐⭐⭐ "EM ANDAMENTO" TEM UMA DEFINIÇÃO SÓ NO SISTEMA (08/09/2026) — ordem do dono.
//
// **CASO REAL, o que motivou este arquivo:** a Carlise digitou o PIN no tablet e levou
// *"Você está com 'produção' em andamento. Finalize antes de começar outra."* — **sem ter
// nada em aberto**. A etapa dela era de 06/09, de uma ordem **já concluída pela Produção**,
// registrada como `ENCERRADA_SEM_FINALIZAR`. Ela ficou **trancada fora do próprio trabalho**.
//
// ⛔⛔ **A CAUSA É A LIÇÃO DO B1, DE NOVO:** a trava do tablet lia `finalizadoEm IS NULL`
// **cru**, e nos DOIS gestos que fecham uma etapa sem tempo medido (`FINALIZADA_PELO_GERENTE`
// e `ENCERRADA_SEM_FINALIZAR`) essa coluna **fica NULL de propósito** — é justamente o que as
// mantém fora das médias (REGRA 5). Ou seja: **a coluna que segura a honestidade do relatório
// é a mesma que, lida crua, tranca a pessoa.** Quem pergunta "está em andamento?" olhando a
// coluna vai errar sempre, e vai errar mais a cada gesto novo que fechar etapa sem carimbo.
//
// ⭐ A resposta certa já existia: `derivarEstadoDaEtapa`. Este arquivo é a PORTA que leva
// todo leitor até ela — em vez de cada um remontar a pergunta com o seu `where`.
//
// ⛔⛔ **E A CAMADA DO PARTICIPANTE NÃO SE RESOLVE CARIMBANDO O RELÓGIO DELE.** A tentação
// óbvia era fazer o gesto do gerente escrever `participante.finalizadoEm = agora` pra "fechar
// os dois níveis". Isso seria **inventar um horário que ninguém mediu** — exatamente o erro
// que o `finalizadoEm` NULL da etapa existe pra impedir, só que um nível abaixo e fora do
// alcance de todos os testes que protegem o de cima. **Quem manda é o ESTADO DA ETAPA; o
// relógio do participante é RASTRO, não veredito.** Etapa fechada ⇒ ninguém está em
// andamento nela, tenha o participante carimbo ou não.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { resolverEstadoDasEtapas } from './gestos-do-gerente'
import type { EstadoDaEtapa } from './estado-da-etapa'

type Db = PrismaClient | Prisma.TransactionClient

/** o mínimo que a derivação precisa — qualquer select mais rico passa */
export interface EtapaCrua {
  id: string
  ordemId: string
  iniciadoEm: Date | null
  finalizadoEm: Date | null
}

/**
 * ⭐⭐ O FILTRO BASE: destas etapas, quais estão nos estados pedidos **pela derivação única**.
 *
 * ⚠️ Recebe as etapas já lidas em vez de fazer a query: o `where` de cada chamador é diferente
 * (por pessoa, por ordem, por janela de tempo) e só o ESTADO é comum. Tentar unificar a query
 * também transformaria esta função num canivete com cinco parâmetros opcionais.
 */
export async function somenteNosEstados<T extends EtapaCrua>(
  companyId: string,
  etapas: T[],
  estados: readonly EstadoDaEtapa[],
  db: Db = defaultPrisma,
): Promise<T[]> {
  if (!etapas.length) return []
  const resolvidas = await resolverEstadoDasEtapas(companyId, etapas, db)
  const alvo = new Set(estados)
  return etapas.filter((e) => {
    const estado = resolvidas.get(e.id)?.estado
    return estado != null && alvo.has(estado)
  })
}

/** ⭐ as que estão de fato com alguém na mão da massa */
export async function somenteEmAndamento<T extends EtapaCrua>(
  companyId: string, etapas: T[], db: Db = defaultPrisma,
): Promise<T[]> {
  return somenteNosEstados(companyId, etapas, ['EM_ANDAMENTO'], db)
}

/**
 * ⭐ AS QUE AINDA PEDEM TRABALHO — na fila ou em andamento.
 *
 * ⚠️ É outra pergunta que "em andamento": quem conclui uma ordem precisa saber se **sobrou
 * etapa por fazer**, e uma etapa designada que ninguém começou conta. Já a que o gerente
 * finalizou, ou que a ordem levou junto, **não sobra** — está resolvida, sem tempo medido.
 */
export async function somentePendentes<T extends EtapaCrua>(
  companyId: string, etapas: T[], db: Db = defaultPrisma,
): Promise<T[]> {
  return somenteNosEstados(companyId, etapas, ['AGUARDANDO', 'EM_ANDAMENTO'], db)
}

export interface EtapaEmAndamento {
  id: string
  nome: string
  ordemId: string
}

/**
 * ⭐⭐ A PERGUNTA DO TABLET: **esta pessoa está com alguma tarefa em andamento agora?**
 *
 * ⛔ Olha os DOIS relógios, porque desde a dupla eles são dois de verdade: o da ETAPA
 * (`executorId`, o primeiro toque, caminho de sempre) e o do PARTICIPANTE (a segunda pessoa
 * da dupla, cujo relógio **só existe** na linha dela — a etapa carrega o executor, que é a
 * primeira). Perguntar só pela etapa deixaria a segunda pessoa iniciar duas tarefas ao mesmo
 * tempo; só pelo participante perderia toda etapa anterior à camada nova.
 *
 * ⭐ E as duas listas passam pelo MESMO filtro de estado — é isso que faz a etapa encerrada
 * parar de trancar quem quer que seja.
 */
export async function etapasEmAndamentoDoColaborador(
  companyId: string, colaboradorId: string, db: Db = defaultPrisma,
): Promise<EtapaEmAndamento[]> {
  const comRelogioAberto = await db.stockOrdemEtapaParticipante.findMany({
    where: { companyId, colaboradorId, iniciadoEm: { not: null }, finalizadoEm: null },
    select: { etapaId: true },
  })
  const idsPorParticipante = comRelogioAberto.map((p) => p.etapaId)

  const candidatas = await db.stockOrdemEtapa.findMany({
    where: {
      companyId,
      finalizadoEm: null,
      OR: [
        { executorId: colaboradorId, iniciadoEm: { not: null } },
        ...(idsPorParticipante.length ? [{ id: { in: idsPorParticipante } }] : []),
      ],
    },
    select: { id: true, nome: true, ordemId: true, iniciadoEm: true, finalizadoEm: true },
  })

  const vivas = await somenteEmAndamento(companyId, candidatas, db)
  return vivas.map((e) => ({ id: e.id, nome: e.nome, ordemId: e.ordemId }))
}
