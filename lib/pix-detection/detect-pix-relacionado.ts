// Sprint 5.0.2.h — Detecta Pix entre relacionados (sócio PF, CNPJ do grupo).
//
// Função pura — recebe transaction + relações cadastradas, retorna detecção.
// Loader DB separado em loadAndDetect() pra UI/jobs.

import { prisma } from '@/lib/db'
import {
  parsePixDescription,
  nameMatch,
  normalizePixKey,
  type ParsedPix,
} from './parse-pix'

export type RelatedPartyType = 'SOCIO_PF' | 'GRUPO_PJ' | null

export interface PixDetectionInput {
  description: string | null
  socios: Array<{
    id: string
    nome: string
    cpf: string | null
    pixKeys: string[]
    papel: string
  }>
  empresasRelacionadas: Array<{
    id: string
    nomeFantasia: string
    cnpjRelacionado: string
    pixKeys: string[]
    relacao: string
  }>
}

export interface PixDetection {
  parsed: ParsedPix
  tipo: RelatedPartyType
  destinatarioId?: string
  destinatarioNome?: string
  /** Categoria sugerida (display label) */
  categoriaSugerida?: string
  /** dreGroup pra usar com auto-classificação */
  dreGroupSugerido?: string
  matchedBy?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'chave' | 'nome'
}

const PRO_LABORE_DRE = 'PRO_LABORE'
const DISTRIBUICAO_LUCROS_DRE = 'DISTRIBUICAO_LUCROS'
const TRANSFERENCIA_DRE = 'TRANSFERENCIA'

/**
 * Detecção PURA. Recebe transação + cadastros, devolve resultado sem tocar DB.
 */
export function detectPixRelacionado(input: PixDetectionInput): PixDetection {
  const parsed = parsePixDescription(input.description)
  if (!parsed.isPix) return { parsed, tipo: null }

  // 1. Match por CNPJ (alta confiança, prioridade máxima)
  if (parsed.cnpj) {
    const cnpjDigits = parsed.cnpj
    const e = input.empresasRelacionadas.find(
      (er) => normalizePixKey(er.cnpjRelacionado) === cnpjDigits,
    )
    if (e) {
      return {
        parsed,
        tipo: 'GRUPO_PJ',
        destinatarioId: e.id,
        destinatarioNome: e.nomeFantasia,
        categoriaSugerida: 'Transferência entre Contas (mesmo grupo)',
        dreGroupSugerido: TRANSFERENCIA_DRE,
        matchedBy: 'cnpj',
      }
    }
  }

  // 2. Match por CPF do sócio
  if (parsed.cpf) {
    const cpfDigits = parsed.cpf
    const s = input.socios.find((sp) => sp.cpf && normalizePixKey(sp.cpf) === cpfDigits)
    if (s) {
      return socioResult(parsed, s, 'cpf')
    }
  }

  // 3. Match por email/telefone (pixKeys)
  const candidateKeys = [parsed.email, parsed.telefone].filter(Boolean) as string[]
  for (const key of candidateKeys) {
    const normKey = normalizePixKey(key)
    // Empresa relacionada primeiro
    const e = input.empresasRelacionadas.find((er) =>
      er.pixKeys.map(normalizePixKey).includes(normKey),
    )
    if (e) {
      return {
        parsed,
        tipo: 'GRUPO_PJ',
        destinatarioId: e.id,
        destinatarioNome: e.nomeFantasia,
        categoriaSugerida: 'Transferência entre Contas (mesmo grupo)',
        dreGroupSugerido: TRANSFERENCIA_DRE,
        matchedBy: key.includes('@') ? 'email' : 'telefone',
      }
    }
    const s = input.socios.find((sp) => sp.pixKeys.map(normalizePixKey).includes(normKey))
    if (s) {
      return socioResult(parsed, s, key.includes('@') ? 'email' : 'telefone')
    }
  }

  // 4. Match por nome (menor confiança — só se nada bateu)
  if (parsed.textoLimpo) {
    // Empresa primeiro (nome fantasia geralmente único)
    const e = input.empresasRelacionadas.find((er) =>
      nameMatch(er.nomeFantasia, parsed.textoLimpo),
    )
    if (e) {
      return {
        parsed,
        tipo: 'GRUPO_PJ',
        destinatarioId: e.id,
        destinatarioNome: e.nomeFantasia,
        categoriaSugerida: 'Transferência entre Contas (mesmo grupo)',
        dreGroupSugerido: TRANSFERENCIA_DRE,
        matchedBy: 'nome',
      }
    }
    const s = input.socios.find((sp) => nameMatch(sp.nome, parsed.textoLimpo))
    if (s) {
      return socioResult(parsed, s, 'nome')
    }
  }

  return { parsed, tipo: null }
}

function socioResult(
  parsed: ParsedPix,
  s: PixDetectionInput['socios'][number],
  matchedBy: PixDetection['matchedBy'],
): PixDetection {
  const isProLabore = s.papel === 'ADMINISTRADOR' || s.papel === 'FAMILIAR'
  return {
    parsed,
    tipo: 'SOCIO_PF',
    destinatarioId: s.id,
    destinatarioNome: s.nome,
    categoriaSugerida: isProLabore ? 'Pró-labore' : 'Distribuição de Lucros',
    dreGroupSugerido: isProLabore ? PRO_LABORE_DRE : DISTRIBUICAO_LUCROS_DRE,
    matchedBy,
  }
}

/**
 * Loader DB — busca cadastros + roda detecção. Útil pra UI/jobs.
 */
export async function detectPixForTransaction(
  companyId: string,
  description: string | null,
): Promise<PixDetection> {
  const [socios, empresas] = await Promise.all([
    prisma.socioPF.findMany({ where: { companyId } }),
    prisma.empresaRelacionada.findMany({ where: { companyId } }),
  ])

  return detectPixRelacionado({
    description,
    socios: socios.map((s) => ({
      id: s.id,
      nome: s.nome,
      cpf: s.cpf,
      pixKeys: parsePixKeys(s.pixKeys),
      papel: s.papel,
    })),
    empresasRelacionadas: empresas.map((e) => ({
      id: e.id,
      nomeFantasia: e.nomeFantasia,
      cnpjRelacionado: e.cnpjRelacionado,
      pixKeys: parsePixKeys(e.pixKeys),
      relacao: e.relacao,
    })),
  })
}

function parsePixKeys(stored: string): string[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
