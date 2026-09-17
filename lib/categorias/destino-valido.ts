// ⭐⭐⭐ O QUE PODE SER DESTINO DE UMA CATEGORIZAÇÃO — UMA FONTE (17/09/2026).
//
// ⛔⛔ **O DEFEITO QUE ISTO MATA, medido em prod:** o seletor da fatura oferecia **260
// categorias, das quais 203 estavam INATIVAS** (78%) e 47 eram de RECEITA — porque a tela
// pedia a lista crua e só tirava a fila `A_CLASSIFICAR`. A rota de gravação valida
// `isActive: true`. Resultado: **quase 4 de cada 5 opções eram armadilha**, e escolher uma
// devolvia *"Categoria não encontrada ou inativa."*
//
// ⚠️ É a família *"duas fontes pra mesma pergunta"* — a mesma que fez o menu dizer um número
// e a tela outro, e que este projeto paga desde os 5 detectores de par. Aqui a pergunta é
// *"posso mandar um lançamento pra esta categoria?"*, e ela passa a ter um dono.
//
// ⭐ A INVARIANTE QUE O TESTE TRAVA: **toda categoria oferecida é aceita pela rota.** O que
// a tela mostra é, por construção, um SUBCONJUNTO do que a gravação admite — nunca o
// contrário.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export interface CategoriaDestino {
  id: string
  name: string
}

/**
 * ⛔ A REGRA MÍNIMA DA GRAVAÇÃO: categoria **ativa** da empresa. É o que
 * `/despesas/recategorizar` exige, e por isso é o piso de qualquer lista oferecida.
 */
export function whereCategoriaAceita(companyId: string) {
  return { companyId, isActive: true }
}

/**
 * ⭐ AS CATEGORIAS QUE UMA DESPESA PODE RECEBER.
 *
 * ⚠️ Mais estrita que a régua da gravação de propósito: **inativa não entra** (a rota
 * recusaria) e **receita não entra** (mandar uma compra de cartão pra "Receita de Vendas"
 * é erro de digitação que ninguém revisa depois). ⛔ E a fila `A_CLASSIFICAR` não é destino
 * — ela é de onde se sai.
 */
export async function categoriasDestinoDespesa(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<CategoriaDestino[]> {
  return db.category.findMany({
    where: { ...whereCategoriaAceita(companyId), type: 'EXPENSE', NOT: { dreGroup: 'A_CLASSIFICAR' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
}
