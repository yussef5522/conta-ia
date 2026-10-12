/**
 * ⭐⭐⭐ A ESTRELA DO DONO — AS RECEITAS PRINCIPAIS (12/10/2026).
 *
 * **Ordem do dono:** *"mais importante ou mais caro e eu tem opcao de coloca receitas dentro…
 * e tira tbm quando achou q nao mais importante"* — 44 receitas, e ele quer as que importam
 * fixadas EM CIMA. ⛔ Categoria automática (carnes/queijos/legumes) foi **DESCARTADA no chat**:
 * quem decide o que importa é ele, não um mapa de palavra — e um mapa erraria exatamente na
 * receita atípica, que costuma ser a mais cara.
 *
 * ═══ ⛔⛔ A LEI DA ESTRELA: ELA É ROUPA, A RECEITA É LEI ═══
 *
 * A marca vive na **IDENTIDADE** da receita (`fichaId`), **NUNCA na versão**. Marcar/desmarcar:
 *   · **não cria versão nova** — versão é o CORPO da receita (componentes, dose, lote base), e
 *     uma versão a mais faria a ordem antiga apontar pra um snapshot que ninguém mudou;
 *   · **não mexe em custo** — o custo do lote é Σ(dose × custo médio), e a estrela não é dose;
 *   · **não passa perto de `explodirReceita`** — este arquivo não importa a porta da explosão,
 *     e é por construção que ele não pode mexer no que a cozinha separa.
 *
 * ⭐ **E É PORTA ÚNICA DE ESCRITA:** `marcarReceitaPrincipal` é a única função que escreve em
 * `stock_receita_principal`, e ela grava **o booleano e mais nada**. Um segundo caminho (um
 * `upsert` solto numa rota, um script) faria a coluna significar duas coisas — a doença que
 * esta casa mais paga (os 7 detectores de par, as 2 cópias do FITID).
 *
 * ⚠️ **A MARCA É DA CASA, não por usuário** (pedido do dono): todo mundo do painel vê as
 * mesmas principais. Por isso a chave é `(companyId, fichaId)` e não `(userId, fichaId)` —
 * fosse por usuário, o gerente marcaria e o dono não veria.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class ReceitaPrincipalError extends Error {}

/**
 * ⭐ LIGA/DESLIGA a estrela. **A única porta de escrita.**
 *
 * ⚠️ Resolve a ficha **por ID escopado por empresa** (REGRA 8): sem o `companyId` no `where`,
 * um id de outra empresa marcaria a receita do vizinho — e multi-tenant é onde isso dói mais.
 *
 * ⭐ **IDEMPOTENTE:** marcar o que já é principal não muda nada além do rastro (o `upsert`
 * cuida), e o índice único garante que dois toques rápidos no celular não criem duas linhas.
 *
 * ⚠️ **Aceita QUALQUER ficha da empresa, de propósito.** A pergunta que a coluna responde é
 * *"o dono fixou esta receita no topo?"* — se amanhã o cardápio quiser o mesmo gesto, é a
 * MESMA pergunta e a MESMA porta (REGRA 4). Restringir a INTERMEDIARIO aqui forçaria uma
 * segunda tabela pro cardápio, e aí a estrela passaria a significar duas coisas.
 */
export async function marcarReceitaPrincipal(
  input: { companyId: string; fichaId: string; principal: boolean; userId?: string | null },
  db: Db = defaultPrisma,
): Promise<{ fichaId: string; principal: boolean }> {
  const ficha = await db.stockFicha.findFirst({
    where: { id: input.fichaId, companyId: input.companyId },
    select: { id: true },
  })
  if (!ficha) throw new ReceitaPrincipalError('Receita não encontrada.')

  await db.stockReceitaPrincipal.upsert({
    where: { companyId_fichaId: { companyId: input.companyId, fichaId: ficha.id } },
    create: {
      companyId: input.companyId,
      fichaId: ficha.id,
      principal: input.principal,
      marcadoPorId: input.userId ?? null,
    },
    // ⚠️ o rastro é REESCRITO no desmarcar — *quem tirou e quando* é a informação que importa
    // depois (quem marcou um dia já está no histórico do que a tela mostrou naquele dia).
    update: { principal: input.principal, marcadoPorId: input.userId ?? null, marcadoEm: new Date() },
  })

  return { fichaId: ficha.id, principal: input.principal }
}

/**
 * ⭐ A LEITURA, EM LOTE. Devolve os `fichaId` que são principais HOJE.
 *
 * ⛔ Em lote porque a lista tem 44 receitas e a tela é de todo dia: uma consulta por ficha é
 * o N+1 que custou 4,9 s na própria lista de fichas em 28/09 (1.786 round-trips).
 *
 * ⚠️ `principal: true` explícito no `where` — linha com `false` (o desmarcado, que fica pelo
 * rastro) **não** é principal, e tratar "tem linha" como "é principal" ressuscitaria o
 * defeito do `?? 'CAIXA'` que sumiu com o CASPER em 20/09: *default que resolve é default
 * que esconde*.
 */
export async function principaisDaEmpresa(companyId: string, db: Db = defaultPrisma): Promise<Set<string>> {
  const linhas = await db.stockReceitaPrincipal.findMany({
    where: { companyId, principal: true },
    select: { fichaId: true },
  })
  return new Set(linhas.map((l) => l.fichaId))
}
