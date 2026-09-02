// ⭐⭐ TODO SCRIPT DE INVESTIGAÇÃO PROVA EM QUAL BANCO ESTÁ (02/09/2026).
//
// ⛔ O ERRO QUE CRIOU ISTO, e ele foi meu: rodei a reconciliação dos 195 produtos do PDV
// contra o `companyId` CERTO da Caçula — mas com `npx tsx` no Mac, onde o `.env` aponta pro
// **SQLite de dev**. A empresa não existe lá. O Prisma devolveu **0 mapeamentos** e eu
// concluí, por escrito, que *"os 4 mapeamentos sumiram"*.
//
// ⚠️ O dono ia abrir uma investigação de PERDA DE DADO e adiar uma tarde inteira de
// trabalho por causa disso. Os 4 estavam intactos em prod o tempo todo.
//
// ⭐ A CLASSE: **zero silencioso é indistinguível de "não tem"**. `findMany` num banco que
// não conhece aquela empresa não erra — devolve lista vazia, que é uma resposta plausível.
// É a mesma família do empty state que mentiu na home PF ("nenhum cartão cadastrado") e do
// `contains` case-sensitive que achava 0 em prod e funcionava em dev.
//
// ⚠️ E A TRAVA QUE JÁ EXISTIA É ASSIMÉTRICA: `guard-banco-de-teste` impede a SUÍTE de rodar
// contra produção (a cicatriz de 08/08). Não havia nada no sentido inverso — script de
// investigação apontado pro dev enquanto se conclui sobre prod.
//
// ⭐ REGRA 8, segunda metade: resolver por ID não basta se o ID for lido no banco errado.

import type { PrismaClient } from '@prisma/client'

export class BancoErradoError extends Error {
  constructor(companyId: string, url: string) {
    super(
      `⛔ A empresa ${companyId} NÃO EXISTE neste banco (${url}).\n` +
      `   Medir aqui devolveria ZERO em silêncio — e zero não é "não tem", é "banco errado".\n` +
      `   Rode este script no servidor (ssh + npx tsx) ou aponte o DATABASE_URL pra base certa.`,
    )
    this.name = 'BancoErradoError'
  }
}

/** só o formato do banco, nunca credencial — o projeto proíbe echo de senha */
function urlSegura(): string {
  const u = process.env.DATABASE_URL ?? ''
  if (u.startsWith('file:')) return `sqlite ${u.slice(0, 40)}`
  const m = u.match(/@[^/]+\/([^?]+)/)
  return m ? `postgres .../${m[1]}` : 'desconhecido'
}

/**
 * PROVA que este banco conhece a empresa, e devolve o nome dela pro script imprimir.
 * ⛔ ABORTA se não conhecer — barulhento, em vez de medir zero e concluir errado.
 */
export async function exigirEmpresaNesteBanco(db: PrismaClient, companyId: string): Promise<string> {
  const c = await db.company.findUnique({ where: { id: companyId }, select: { name: true } })
  if (!c) throw new BancoErradoError(companyId, urlSegura())
  // ⭐ imprime SEMPRE: o script deixa registrado contra o que ele mediu. Um output sem esta
  // linha é um output do qual não dá pra concluir nada.
  console.log(`[banco] ${urlSegura()} · empresa: ${c.name.trim()}`)
  return c.name
}
