// SPRINT EQUIPAMENTO (20/10/2026) — o LADO FINANCEIRO da nota de máquina.
//
// ⭐⭐⭐ A DECISÃO QUE ESTE ARQUIVO EXISTE PRA GARANTIR: o `dreGroup`.
//
// `INVESTIMENTOS` é NÃO-DRE (`NON_DRE_GROUPS`, `lib/dre/types.ts`) — é isso que cumpre a
// exigência do brief (*"no DRE isso não come o lucro do mês como despesa; Lucro Real:
// imobilizado não é despesa"*). Uma categoria com o nome certo e o GRUPO errado seria
// pior que nenhuma: a máquina de R$ 21.000 viraria despesa operacional do mês, em
// silêncio, e o lucro do mês sairia 21 mil menor sem ninguém desconfiar do número.
//
// ⛔⛔ E É POR ISSO QUE O SISTEMA CRIA, EM VEZ DE PEDIR PRO DONO CRIAR.
// Deixar o cadastro na mão dele é deixar o `dreGroup` na mão dele — e o grupo é
// justamente a parte invisível da decisão. O nome ele reconhece; o grupo, não.
//
// ⚠️⚠️ ESTA É UMA EXTENSÃO DECLARADA DA FRONTEIRA DO MÓDULO. A ponte já escrevia em
// `transactions` e `suppliers` (a exceção desenhada de 24/08, que nasceu do MESMO
// argumento: medido, sem cadastrar fornecedor a ponte não criava NENHUMA parcela).
// Agora ela escreve **UMA linha em `category`**, e o escopo é o mais estreito possível:
//   · nome FIXO + grupo FIXO (os dois do dono único, `destino-da-linha.ts`)
//   · idempotente — a 2ª nota de equipamento reusa a mesma categoria
//   · só a ponte chama; nenhum outro caminho do estoque encosta em `category`
//
// PRECEDENTE da casa: `getOrCreateCardWithdrawalCategory` (cartão) e
// `getOrCreateBridgeEntryCategory` (ponte PJ→PF) fazem exatamente isto, pelo mesmo motivo.

import type { PrismaClient, Prisma } from '@prisma/client'
import { CATEGORIA_FINANCEIRA_EQUIPAMENTO, DRE_GROUP_EQUIPAMENTO } from './destino-da-linha'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Acha ou cria a categoria **"Equipamentos (investimento)"** da empresa.
 *
 * ⚠️ A busca é por **(grupo, nome)**, não só pelo nome: se o dono renomear, nasce outra —
 * e isso é o erro SEGURO. O inseguro seria casar só pelo nome e reusar uma categoria que
 * alguém pôs em `OUTRAS_DESPESAS`, que é o cenário em que a máquina come o lucro do mês.
 */
export async function getOrCreateCategoriaEquipamento(db: Db, companyId: string): Promise<string> {
  const existe = await db.category.findFirst({
    where: { companyId, dreGroup: DRE_GROUP_EQUIPAMENTO, name: CATEGORIA_FINANCEIRA_EQUIPAMENTO },
    select: { id: true },
  })
  if (existe) return existe.id
  const criada = await db.category.create({
    data: {
      companyId,
      name: CATEGORIA_FINANCEIRA_EQUIPAMENTO,
      // ⚠️ `EXPENSE` é o TIPO (o dinheiro SAI, e é assim que ela aparece nos seletores de
      // conta a pagar). Quem decide se entra no resultado é o `dreGroup`, não o tipo —
      // misturar os dois foi o que fez "Aporte de Capital" receber uma liberação de
      // empréstimo em 26/08.
      type: 'EXPENSE',
      dreGroup: DRE_GROUP_EQUIPAMENTO,
      color: '#7c3aed',
      description:
        'Compra de máquina/equipamento (imobilizado). Fora do DRE: no Lucro Real o '
        + 'imobilizado NÃO é despesa do mês — ele vira ativo. A depreciação é lançamento '
        + 'separado, feito com o contador.',
    },
    select: { id: true },
  })
  return criada.id
}
