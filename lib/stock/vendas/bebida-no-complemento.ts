// ⛔⛔⛔ A BEBIDA VENDIDA COMO COMPLEMENTO NÃO BAIXAVA (12/09/2026)
//
// **O dono:** *"bebida vende nos DOIS relatórios do Suitable — COCA 2L é produto no cardápio
// E complemento quando o cliente adiciona. A do relatório de Produtos baixa certinho; a MESMA
// bebida no relatório de Complementos não baixa nada."*
//
// **⚠️ A APOSTA DELE ERA "complemento = sabor", e o dado REFUTOU:** não existe régua nenhuma
// barrando bebida. `baixaComplemento` aceita **qualquer** ficha (`alvoTipo === 'FICHA'`), e
// `upsertComplementoMap` também — o comentário de lá até explica que aceita `INTERMEDIARIO`
// **e** `PRODUTO_FINAL` de propósito.
//
// **⭐ A CAUSA MEDIDA É OUTRA, e é mais simples: são DOIS MAPAS, e ninguém preencheu o de
// complementos.** Das **18 bebidas** que aparecem no relatório de complementos, **18 estavam
// PENDENTES** — e **7 delas já tinham ficha no mapa de PRODUTOS**:
// ```
// "COCA COLA 2L"  38 ocorrências em 6 dias  · complemento: PENDENTE | produto: FICHA
// "COCA ZERO 2L"  14 ocorrências em 6 dias  · complemento: PENDENTE | produto: FICHA
// "FANTA UVA 2L"   3 ocorrências            · complemento: PENDENTE | produto: FICHA
// ```
// ⚠️ Os dois mapas continuam separados **de propósito** (decisão de 02/09: 25 nomes vivem nos
// dois relatórios e cada um tem seu destino). O que faltava não era fundir os mapas — era
// **herdar** o destino quando o nome é literalmente o mesmo.
//
// ⭐ E a régua do que entra sozinho é a de **08/09**, sem afrouxar nada: **canônico IDÊNTICO**
// (mesma string ignorando caixa, acento e espaço repetido). `COCA LATA MAIS MINI FRITAS` é
// outro produto — é combo, tem fritas dentro — e **continua pedindo o clique do dono**.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarNome } from './grupo-complemento'

export interface HerancaDeMapa {
  nomeSuitable: string
  /** o nome no mapa de PRODUTOS de onde o destino veio (pode diferir na caixa/acento) */
  vindoDe: string
  fichaId: string
  ocorrencias: number
}

/**
 * ⭐⭐ Quais nomes PENDENTES do complemento têm o MESMO canônico de um nome já mapeado em
 * ficha no mapa de PRODUTOS.
 *
 * ⛔ Só herda destino que **BAIXA de verdade**: `alvoTipo === 'FICHA'`. Mapa de produtos
 * apontando pra item de REVENDA não entra — o mapa de complementos só guarda ficha (o schema
 * nem tem `itemId`), e inventar um caminho aqui seria a segunda mecânica de baixa que este
 * módulo passou 09/09 inteiro eliminando.
 *
 * ⚠️ Nome já mapeado no complemento (inclusive `IGNORAR`) **não é tocado**: decisão do dono
 * não se sobrescreve — ignorar é uma resposta, não uma ausência.
 */
export async function heranciasDisponiveis(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<HerancaDeMapa[]> {
  const [linhas, mapaC, mapaP] = await Promise.all([
    db.stockVendaComplementoLinha.groupBy({
      by: ['nomeSuitable'], where: { companyId }, _sum: { ocorrencias: true },
    }),
    db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    db.stockVendaProdutoMap.findMany({
      where: { companyId, alvoTipo: 'FICHA', fichaId: { not: null } },
      select: { nomeSuitable: true, fichaId: true },
    }),
  ])
  const jaMapeado = new Set(mapaC.map((m) => normalizarNome(m.nomeSuitable)))
  const porCanonico = new Map<string, { nome: string; fichaId: string }>()
  for (const p of mapaP) {
    const k = normalizarNome(p.nomeSuitable)
    if (!porCanonico.has(k)) porCanonico.set(k, { nome: p.nomeSuitable, fichaId: p.fichaId! })
  }

  const out: HerancaDeMapa[] = []
  for (const l of linhas) {
    const k = normalizarNome(l.nomeSuitable)
    if (jaMapeado.has(k)) continue
    const alvo = porCanonico.get(k)
    if (!alvo) continue
    out.push({
      nomeSuitable: l.nomeSuitable, vindoDe: alvo.nome, fichaId: alvo.fichaId,
      ocorrencias: l._sum.ocorrencias ?? 0,
    })
  }
  return out.sort((a, b) => b.ocorrencias - a.ocorrencias)
}

/**
 * ⭐ Grava as heranças — com RASTRO (`criadoPorId: null` + o registro da origem).
 *
 * ⚠️ Roda no IMPORT, como o agrupamento por canônico de 08/09: *"deixa PLANTADO — quando uma
 * ficha nova nascer, as grafias pendentes entram juntas na hora, senão a regra só vale pro
 * passado"*. E é **fail-soft**: herdar é bônus, nunca derruba import legítimo.
 */
export async function aplicarHerancas(
  companyId: string, userId: string | undefined, db: PrismaClient = defaultPrisma,
): Promise<HerancaDeMapa[]> {
  const herancas = await heranciasDisponiveis(companyId, db)
  for (const h of herancas) {
    await db.stockVendaComplementoMap.upsert({
      where: { companyId_nomeSuitable: { companyId, nomeSuitable: h.nomeSuitable } },
      create: { companyId, nomeSuitable: h.nomeSuitable, alvoTipo: 'FICHA', fichaId: h.fichaId, criadoPorId: userId ?? null },
      // ⛔ `update` vazio de propósito: se alguém mapeou entre a leitura e a gravação, a
      // decisão DELE vence — herdar nunca sobrescreve escolha humana.
      update: {},
    })
  }
  return herancas
}
