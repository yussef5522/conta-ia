// Sprint 5.0.2.n — Cache global anonimizado de vendors.
//
// Lookup primário do pipeline de Vendor Discovery. Multi-tenant SAFE:
// não tem companyId — é tabela GLOBAL compartilhada entre todos clientes.

import { prisma } from '@/lib/db'
import { normalizeVendorName } from './normalize'

export interface CacheHit {
  id: string
  cnpj: string | null
  vendorName: string
  razaoSocial: string | null
  nomeFantasia: string | null
  cnaePrincipal: string | null
  cnaeDescricao: string | null
  categoriaSugerida: string
  tipoTransacao: string
  origem: string
  scoreAtual: number
}

/**
 * Busca no cache global por CNPJ ou por nome normalizado.
 * Retorna o registro com maior scoreAtual (priorizando active=true).
 *
 * Threshold: só retorna se scoreAtual ≥ 0.70 (evita lixo).
 */
export async function lookupCacheGlobal(params: {
  cnpj?: string | null
  vendorName?: string | null
}): Promise<CacheHit | null> {
  const MIN_SCORE = 0.7

  // Prioridade 1: CNPJ (unique)
  if (params.cnpj) {
    const cnpjLimpo = params.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length === 14) {
      const found = await prisma.globalVendorKnowledge.findFirst({
        where: { cnpj: cnpjLimpo, active: true, scoreAtual: { gte: MIN_SCORE } },
      })
      if (found) return toCacheHit(found)
    }
  }

  // Prioridade 2: vendor name normalizado (top vezesConfirmado)
  if (params.vendorName) {
    const normalized = normalizeVendorName(params.vendorName)
    if (normalized.length >= 3) {
      const found = await prisma.globalVendorKnowledge.findFirst({
        where: {
          vendorNameNormalized: normalized,
          active: true,
          scoreAtual: { gte: MIN_SCORE },
        },
        orderBy: [{ vezesConfirmado: 'desc' }, { scoreAtual: 'desc' }],
      })
      if (found) return toCacheHit(found)
    }
  }

  return null
}

/** Incrementa vezesUsado (cache hit telemetria). */
export async function incrementCacheHit(id: string): Promise<void> {
  await prisma.globalVendorKnowledge.update({
    where: { id },
    data: { vezesUsado: { increment: 1 } },
  })
}

/**
 * Salva uma nova descoberta no cache global (de BRASIL_API ou CLAUDE_AI).
 * Upsert por CNPJ quando disponível (evita race entre clientes simultâneos).
 *
 * Retorna o ID criado/atualizado.
 */
export async function persistDiscovery(params: {
  cnpj?: string | null
  vendorName: string
  razaoSocial?: string | null
  nomeFantasia?: string | null
  cnaePrincipal?: string | null
  cnaeDescricao?: string | null
  setor?: string | null
  categoriaSugerida: string
  categoriaConfidence: number
  tipoTransacao: 'INCOME' | 'EXPENSE' | 'ANY'
  origem: 'BRASIL_API' | 'CLAUDE_AI' | 'USER_CONFIRMED' | 'KEYWORD_MATCH'
  scoreInicial: number
}): Promise<string> {
  const cnpjLimpo = params.cnpj
    ? params.cnpj.replace(/\D/g, '').slice(0, 14)
    : null
  const normalized = normalizeVendorName(params.vendorName)

  // Sprint 5.0.2.p — Fix Bug 2: NÃO usar upsert.
  //
  // O índice unique no schema é PARCIAL (`WHERE cnpj IS NOT NULL` no SQL
  // de produção). Prisma upsert tenta ON CONFLICT na constraint cnpj_key,
  // mas Postgres rejeita: `code: 42P10 — there is no unique or exclusion
  // constraint matching the ON CONFLICT specification`.
  //
  // Solução: findFirst + update/create. Levemente race-prone (2 inserts
  // concorrentes podem duplicar), mas dedup natural via normalized name
  // mitiga, e o cron de auto-ajuste consolidaria duplicatas se aparecessem.
  const where = cnpjLimpo
    ? { cnpj: cnpjLimpo }
    : { vendorNameNormalized: normalized, cnpj: null }

  const existing = await prisma.globalVendorKnowledge.findFirst({ where })
  if (existing) {
    await prisma.globalVendorKnowledge.update({
      where: { id: existing.id },
      data: {
        vendorName: params.vendorName,
        vendorNameNormalized: normalized,
        razaoSocial: params.razaoSocial ?? existing.razaoSocial,
        nomeFantasia: params.nomeFantasia ?? existing.nomeFantasia,
        cnaePrincipal: params.cnaePrincipal ?? existing.cnaePrincipal,
        cnaeDescricao: params.cnaeDescricao ?? existing.cnaeDescricao,
        ultimaValidacao: new Date(),
      },
    })
    return existing.id
  }

  const created = await prisma.globalVendorKnowledge.create({
    data: {
      cnpj: cnpjLimpo,
      vendorName: params.vendorName,
      vendorNameNormalized: normalized,
      razaoSocial: params.razaoSocial ?? null,
      nomeFantasia: params.nomeFantasia ?? null,
      cnaePrincipal: params.cnaePrincipal ?? null,
      cnaeDescricao: params.cnaeDescricao ?? null,
      setor: params.setor ?? null,
      categoriaSugerida: params.categoriaSugerida,
      categoriaConfidence: params.categoriaConfidence,
      tipoTransacao: params.tipoTransacao,
      origem: params.origem,
      scoreAtual: params.scoreInicial,
    },
  })
  return created.id
}

export async function recordAcceptance(cacheId: string): Promise<void> {
  await prisma.globalVendorKnowledge.update({
    where: { id: cacheId },
    data: {
      vezesConfirmado: { increment: 1 },
      vezesUsado: { increment: 1 },
    },
  })
}

export async function recordRejection(cacheId: string): Promise<void> {
  await prisma.globalVendorKnowledge.update({
    where: { id: cacheId },
    data: {
      vezesRejeitado: { increment: 1 },
      vezesUsado: { increment: 1 },
    },
  })
}

function toCacheHit(row: {
  id: string
  cnpj: string | null
  vendorName: string
  razaoSocial: string | null
  nomeFantasia: string | null
  cnaePrincipal: string | null
  cnaeDescricao: string | null
  categoriaSugerida: string
  tipoTransacao: string
  origem: string
  scoreAtual: number
}): CacheHit {
  return {
    id: row.id,
    cnpj: row.cnpj,
    vendorName: row.vendorName,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    cnaePrincipal: row.cnaePrincipal,
    cnaeDescricao: row.cnaeDescricao,
    categoriaSugerida: row.categoriaSugerida,
    tipoTransacao: row.tipoTransacao,
    origem: row.origem,
    scoreAtual: row.scoreAtual,
  }
}
