import { PrismaClient } from '@prisma/client'
import { comTetoDeConexoes } from './db/teto-de-conexoes'

/**
 * Teto de conexões do pool do app, dimensionado pras 2 vCPU do droplet (FASE 0 PASSO 5, 26/10).
 *
 * ⚠️⚠️ ESTE NÚMERO É O TETO QUE JÁ VALIA — ele passa a ser DECLARADO, não MUDADO.
 * O default do Prisma é `num_cpus * 2 + 1`, que num droplet de 2 vCPU dá exatamente 5.
 * Então ligar isto NÃO altera o comportamento de hoje; o que muda é que o teto deixa de
 * ser implícito. Num resize de 2→4 vCPU o default saltaria pra 9 **em silêncio**, e o
 * pool do app é a coisa que não se quer descobrindo sozinha depois de um upgrade.
 *
 * ⛔ E ELE NÃO É A CURA DO BADGE DE 1,3s — isso foi MEDIDO antes de escrever a linha:
 *   conexões reais no Postgres: 1 active + 10 idle de max_connections=100.
 *   O pool NUNCA foi o gargalo. O 1,3s do badge é CPU no app (`reconhecerFornecedor`
 *   rodando linha a linha), decisão registrada do dono em 11/09: "performance se resolve
 *   com cache, nunca com número errado".
 *
 * ⚠️ AO FAZER O RESIZE pra 8 GB / 4 vCPU (o gatilho combinado em 25/08): revisar este
 * número junto, senão o app fica com o teto de 2 vCPU numa máquina de 4.
 */
const CONNECTION_LIMIT_2_VCPU = 5

/**
 * ⛔ POR QUE O TETO É APLICADO AQUI E NÃO NO `.env` DO SERVIDOR: a variável de ambiente
 * alcançaria TODO consumidor — inclusive os ~100 scripts de `scripts/`, que criam
 * `PrismaClient` próprio, e o próprio `prisma migrate`. Aqui ele fica escopado ao client
 * LONGO do app, que é quem tem pool de verdade; script curto abre, faz e fecha.
 *
 * ⚠️ A RÉGUA mora em `./db/teto-de-conexoes` (módulo PURO, com teste). Ela ficou de fora
 * deste arquivo de propósito: ele INSTANCIA o `PrismaClient` no topo, então um teste que o
 * importasse abriria conexão — e ***regra que mora num arquivo que instancia client é
 * regra que ninguém prova***. Esta precisava ser provada: ela já quebrou o dev inteiro em
 * 26/10 (`new URL('file:./dev.db')` → `file:///dev.db` → SQLITE_CANTOPEN, 198 arquivos
 * vermelhos de uma vez).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * ⚠️ O override de `datasources` só vai quando HÁ URI. Passar `url: undefined` fica pior
 * que não passar: o Prisma reclama do datasource em vez de cair no `DATABASE_URL` do
 * ambiente — e aí o app não sobe por causa de um teto de pool.
 */
const urlComTeto = comTetoDeConexoes(process.env.DATABASE_URL, CONNECTION_LIMIT_2_VCPU)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(urlComTeto ? { datasources: { db: { url: urlComTeto } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
