/**
 * ⭐⭐ A ESCRITA DA CONFIG DA MARGEM — canais, sabores-por-tamanho e base (v2, 07/10/2026).
 *
 * ⭐ CHOKE-POINT ÚNICO (REGRA 5): toda escrita de config passa por `aplicarConfigDaMargem`.
 * Com um gesto novo nascendo dentro de um `switch` aqui, ele herda de graça a validação e o
 * rastro — e *"N caminhos, 1 esquecido"* deixa de ser possível.
 *
 * ⛔⛔ TODO GESTO DEIXA RASTRO (`criadoPorId`), porque estes três números mudam o dinheiro que
 * a tela mostra: a taxa do canal muda a sobra, o nº de sabores muda a pizza desenhada, e a
 * base muda o custo de toda simulação. Número de dinheiro sem autor é o que o contador não
 * consegue explicar em três meses.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { CANAIS_SEMEADOS, TAXA_MAXIMA } from './canais'
import { SABORES_SEMEADOS, SABORES_MIN, SABORES_MAX, normalizarTamanho } from './tamanhos'

type Db = PrismaClient | Prisma.TransactionClient

export class ConfigDaMargemError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ConfigDaMargemError'
  }
}

export type GestoDaConfig =
  | { acao: 'SEMEAR' }
  | { acao: 'CANAL_TAXA'; canalId: string; taxaPct: number | null }
  | { acao: 'CANAL_NOVO'; nome: string; taxaPct: number | null }
  | { acao: 'REGRA_SABORES'; tamanho: string; sabores: number }
  | { acao: 'BASE_TAMANHO'; tamanho: string; fichaId: string }

export interface EfeitoDaConfig {
  efeito: string
  /** ⚠️ o que o gesto NÃO mexeu, quando era de esperar que mexesse — nunca silêncio */
  ressalva: string | null
}

/**
 * ⭐ O SEED, idempotente e SÓ QUANDO VAZIO.
 *
 * ⛔ Rodando sempre, ele sobrescreveria a edição do dono — foi a lição literal do seed das
 * listas do Radar (20/09): *"o seed só roda no PRIMEIRO acesso; rodando sempre, sobrescreveria
 * a edição do dono"*. E aqui o estrago seria pior: a taxa do iFood voltaria pra 20% depois de
 * ele ajustar.
 */
async function semear(db: Db, companyId: string, userId: string | null): Promise<EfeitoDaConfig> {
  const [canais, regras] = await Promise.all([
    db.stockCanalVenda.count({ where: { companyId } }),
    db.stockRegraSaboresTamanho.count({ where: { companyId } }),
  ])
  const feitos: string[] = []
  if (canais === 0) {
    await db.stockCanalVenda.createMany({
      data: CANAIS_SEMEADOS.map((c) => ({ companyId, nome: c.nome, taxaPct: c.taxaPct, criadoPorId: userId })),
    })
    feitos.push(`${CANAIS_SEMEADOS.length} canais`)
  }
  if (regras === 0) {
    await db.stockRegraSaboresTamanho.createMany({
      data: SABORES_SEMEADOS.map((r) => ({ companyId, tamanho: r.tamanho, sabores: r.sabores, criadoPorId: userId })),
    })
    feitos.push(`${SABORES_SEMEADOS.length} tamanhos (precinho deriva do tamanho base)`)
  }
  if (feitos.length === 0) {
    return { efeito: 'nada a semear — a config já existe', ressalva: 'o seed não sobrescreve o que você já ajustou' }
  }
  return {
    efeito: `semeado: ${feitos.join(' e ')}`,
    // ⚠️ a base NÃO é semeada de propósito: medido em prod, o tamanho GRANDE tem 4 candidatos
    // no PDV com fichas diferentes, e a diferença entre elas é a massa
    ressalva: 'a base de cada tamanho continua a declarar — eu não escolho a ficha por você',
  }
}

export async function aplicarConfigDaMargem(opts: {
  companyId: string
  userId: string | null
  gesto: GestoDaConfig
  db: Db
}): Promise<EfeitoDaConfig> {
  const { companyId, userId, gesto, db } = opts

  switch (gesto.acao) {
    case 'SEMEAR':
      return semear(db, companyId, userId)

    case 'CANAL_TAXA': {
      const c = await db.stockCanalVenda.findFirst({ where: { id: gesto.canalId, companyId } })
      // ⚠️ REGRA 8: resolve por ID **dentro da empresa** — sem o `companyId` no where, o id de
      // outra empresa passaria e a taxa seria gravada no canal dela
      if (!c) throw new ConfigDaMargemError('Canal não encontrado nesta empresa.', 'CANAL_NAO_ENCONTRADO')
      if (gesto.taxaPct != null && (gesto.taxaPct < 0 || gesto.taxaPct > TAXA_MAXIMA)) {
        throw new ConfigDaMargemError(
          `A taxa tem que ser uma fração entre 0 e ${TAXA_MAXIMA} (20% é 0,2). Veio ${gesto.taxaPct}.`,
          'TAXA_FORA_DA_FAIXA',
        )
      }
      await db.stockCanalVenda.update({
        where: { id: c.id },
        data: { taxaPct: gesto.taxaPct, criadoPorId: userId ?? c.criadoPorId },
      })
      return {
        efeito:
          gesto.taxaPct == null
            ? `${c.nome}: taxa volta pra "a declarar"`
            : `${c.nome}: taxa ${(gesto.taxaPct * 100).toFixed(gesto.taxaPct * 100 % 1 === 0 ? 0 : 2)}%`,
        // ⛔ taxa "a declarar" NÃO é 0%: a sobra daquele canal vira "a apurar", nunca o preço cheio
        ressalva: gesto.taxaPct == null ? 'a sobra deste canal passa a dizer "a apurar"' : null,
      }
    }

    case 'CANAL_NOVO': {
      const nome = gesto.nome.trim()
      if (!nome) throw new ConfigDaMargemError('O canal precisa de um nome.', 'NOME_VAZIO')
      if (gesto.taxaPct != null && (gesto.taxaPct < 0 || gesto.taxaPct > TAXA_MAXIMA)) {
        throw new ConfigDaMargemError(
          `A taxa tem que ser uma fração entre 0 e ${TAXA_MAXIMA} (20% é 0,2). Veio ${gesto.taxaPct}.`,
          'TAXA_FORA_DA_FAIXA',
        )
      }
      const jaTem = await db.stockCanalVenda.findFirst({
        where: { companyId, nome: { equals: nome, mode: 'insensitive' } as never },
      })
      // ⛔ recusa ENSINANDO (a régua do 409 do fornecedor): dois canais de mesmo nome dariam
      // duas colunas idênticas com taxas diferentes na ficha de margem
      if (jaTem) {
        throw new ConfigDaMargemError(
          `Já existe um canal "${jaTem.nome}" — ajuste a taxa dele em vez de criar outro.`,
          'CANAL_DUPLICADO',
        )
      }
      await db.stockCanalVenda.create({ data: { companyId, nome, taxaPct: gesto.taxaPct, criadoPorId: userId } })
      return { efeito: `canal "${nome}" criado`, ressalva: gesto.taxaPct == null ? 'a taxa dele está "a declarar"' : null }
    }

    case 'REGRA_SABORES': {
      const tamanho = normalizarTamanho(gesto.tamanho)
      if (!tamanho) throw new ConfigDaMargemError('O tamanho precisa de um nome.', 'TAMANHO_VAZIO')
      if (!Number.isInteger(gesto.sabores) || gesto.sabores < SABORES_MIN || gesto.sabores > SABORES_MAX) {
        throw new ConfigDaMargemError(
          `Quantos sabores? Um inteiro entre ${SABORES_MIN} e ${SABORES_MAX}. Veio ${gesto.sabores}.`,
          'SABORES_FORA_DA_FAIXA',
        )
      }
      await db.stockRegraSaboresTamanho.upsert({
        where: { companyId_tamanho: { companyId, tamanho } },
        create: { companyId, tamanho, sabores: gesto.sabores, criadoPorId: userId },
        update: { sabores: gesto.sabores, criadoPorId: userId },
      })
      return {
        efeito: `${tamanho}: ${gesto.sabores} sabor${gesto.sabores > 1 ? 'es' : ''}`,
        // ⭐ a derivação é informada, senão o dono muda o GRANDE e não sabe que o precinho veio junto
        ressalva: `o precinho deste tamanho segue este número, a menos que você declare um próprio`,
      }
    }

    case 'BASE_TAMANHO': {
      const tamanho = normalizarTamanho(gesto.tamanho)
      if (!tamanho) throw new ConfigDaMargemError('O tamanho precisa de um nome.', 'TAMANHO_VAZIO')
      const f = await db.stockFicha.findFirst({ where: { id: gesto.fichaId, companyId } })
      // ⚠️ REGRA 8 de novo: a ficha tem que ser DESTA empresa
      if (!f) throw new ConfigDaMargemError('Ficha não encontrada nesta empresa.', 'FICHA_NAO_ENCONTRADA')
      if (!f.ativo) {
        throw new ConfigDaMargemError(
          'Essa ficha está arquivada — a base precisa ser uma ficha viva, senão o custo da pizza para de existir no dia em que alguém a reativar.',
          'FICHA_ARQUIVADA',
        )
      }
      await db.stockBaseDoTamanho.upsert({
        where: { companyId_tamanho: { companyId, tamanho } },
        create: { companyId, tamanho, fichaId: f.id, criadoPorId: userId },
        update: { fichaId: f.id, criadoPorId: userId },
      })
      return { efeito: `a base de ${tamanho} agora é a ficha escolhida`, ressalva: null }
    }
  }
}
