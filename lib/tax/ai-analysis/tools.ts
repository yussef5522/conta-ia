// Sprint 5.0.2.d — Tools Claude pro tax analyzer.
//
// 3 ferramentas que Claude pode chamar via tool use:
//   1. get_knowledge — consulta Knowledge Base 2026 (10 tópicos)
//   2. calculate_regime — calcula imposto num regime específico
//   3. get_benchmark_redes — retorna como grandes redes do ramo otimizam

import { getKnowledgeFor, type KnowledgeTopic } from '@/lib/tax/knowledge'
import { calculateSimples } from '@/lib/tax/simples-engine'
import type { SimplesAnexo } from '@/lib/tax/simples-nacional-tables'
import { calculatePresumido } from '@/lib/tax/presumido-engine'
import { calculateReal } from '@/lib/tax/real-engine'
import { getBenchmarkRedes } from './benchmarks'
import type { Ramo } from '@/lib/tax/expertise'

export interface ClaudeTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const TAX_ANALYSIS_TOOLS: ClaudeTool[] = [
  {
    name: 'get_knowledge',
    description:
      'Consulta a Knowledge Base contábil 2026 sobre um tópico específico. Use sempre que precisar citar lei, alíquota, faixa, regra. Retorna JSON estruturado.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: [
            'simples-nacional',
            'lucro-presumido',
            'lucro-real',
            'reforma-tributaria',
            'beneficios-fiscais',
            'substituicao-tributaria',
            'pis-cofins-monofasico',
            'estados-particularidades',
            'fator-r',
            'jurisprudencia',
          ],
        },
      },
      required: ['topic'],
    },
  },

  {
    name: 'calculate_regime',
    description:
      'Calcula imposto mensal em um regime tributário específico (Simples, Presumido ou Real). Use pra comparar cenários da empresa.',
    input_schema: {
      type: 'object',
      properties: {
        regime: { type: 'string', enum: ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'] },
        receitaMensal: { type: 'number' },
        rbaAcumulada: { type: 'number', description: 'RBA 12m (Simples). Default = receitaMensal × 12' },
        anexoSimples: { type: 'string', enum: ['ANEXO_I', 'ANEXO_II', 'ANEXO_III', 'ANEXO_IV', 'ANEXO_V'] },
        folha12m: { type: 'number', description: 'Pra Fator R (Anexo III/V)' },
        margemRealPercent: { type: 'number', description: 'Margem declarada (Lucro Real)' },
        atividade: {
          type: 'string',
          enum: [
            'COMERCIO',
            'INDUSTRIA',
            'SERVICOS',
            'SERVICOS_HOSPITALARES',
            'TRANSPORTE_CARGAS',
            'TRANSPORTE_PASSAGEIROS',
            'REVENDA_COMBUSTIVEIS',
            'CONSTRUCAO_CIVIL',
          ],
        },
        estado: { type: 'string', description: 'UF (2 letras)' },
        hasICMS: { type: 'boolean' },
        hasISS: { type: 'boolean' },
      },
      required: ['regime', 'receitaMensal'],
    },
  },

  {
    name: 'get_benchmark_redes',
    description:
      'Retorna como grandes redes do mesmo ramo otimizam tributação (Madero, Smart Fit, Renner, etc).',
    input_schema: {
      type: 'object',
      properties: {
        ramo: { type: 'string', enum: ['RESTAURANTE', 'ACADEMIA', 'COMERCIO_ROUPA'] },
      },
      required: ['ramo'],
    },
  },
]

export interface ToolInput {
  [key: string]: unknown
}

/**
 * Executa uma tool e retorna JSON serializado (string) pro Claude continuar.
 */
export function executeToolCall(toolName: string, toolInput: ToolInput): string {
  try {
    switch (toolName) {
      case 'get_knowledge': {
        const topic = toolInput.topic as KnowledgeTopic
        if (!topic) return JSON.stringify({ error: 'topic obrigatório' })
        return JSON.stringify(getKnowledgeFor(topic))
      }

      case 'calculate_regime': {
        return JSON.stringify(executeCalculateRegime(toolInput))
      }

      case 'get_benchmark_redes': {
        const ramo = toolInput.ramo as Ramo
        if (!ramo) return JSON.stringify({ error: 'ramo obrigatório' })
        return JSON.stringify({ ramo, redes: getBenchmarkRedes(ramo) })
      }

      default:
        return JSON.stringify({ error: `Tool desconhecida: ${toolName}` })
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : 'Falha ao executar tool',
    })
  }
}

function executeCalculateRegime(input: ToolInput) {
  const regime = input.regime as string
  const receitaMensal = Number(input.receitaMensal ?? 0)
  const rbaAcumulada = Number(input.rbaAcumulada ?? receitaMensal * 12)
  const folha12m = Number(input.folha12m ?? 0)
  const margemRealPercent = Number(input.margemRealPercent ?? 15)
  const atividade = (input.atividade as string) ?? 'SERVICOS'
  const estado = (input.estado as string) ?? 'SP'
  const hasICMS = Boolean(input.hasICMS ?? false)
  const hasISS = Boolean(input.hasISS ?? true)

  if (regime === 'SIMPLES_NACIONAL') {
    const anexo = (input.anexoSimples as SimplesAnexo) ?? 'ANEXO_III'
    const r = calculateSimples({
      anexo,
      receitaBrutaMes: receitaMensal,
      rbaAcumulada,
      folha12m,
    })
    return {
      regime,
      total: r.dasValue,
      aliquotaEfetiva: r.aliquotaEfetiva,
      anexoUsado: r.anexoUsado,
      fatorR: r.fatorR,
      fatorRApplied: r.fatorRApplied,
      breakdown: r.breakdown,
      warnings: r.warnings,
    }
  }

  if (regime === 'LUCRO_PRESUMIDO') {
    const r = calculatePresumido({
      atividade: atividade as Parameters<typeof calculatePresumido>[0]['atividade'],
      receitaBrutaMes: receitaMensal,
      rbaAcumulada,
      estado,
      hasICMS,
      hasISS,
    })
    return {
      regime,
      total: r.total,
      aliquotaEfetiva: r.aliquotaEfetiva,
      breakdown: {
        irpj: r.irpj,
        irpjAdicional: r.irpjAdicional,
        csll: r.csll,
        pis: r.pis,
        cofins: r.cofins,
        icms: r.icms,
        iss: r.iss,
      },
      warnings: r.warnings,
    }
  }

  // LUCRO_REAL
  const r = calculateReal({
    receitaBrutaMes: receitaMensal,
    margemRealPercent,
    estado,
    hasICMS,
    hasISS,
  })
  return {
    regime,
    total: r.total,
    aliquotaEfetiva: r.aliquotaEfetiva,
    breakdown: {
      irpj: r.irpj,
      irpjAdicional: r.irpjAdicional,
      csll: r.csll,
      pis: r.pis,
      cofins: r.cofins,
      icms: r.icms,
      iss: r.iss,
    },
    warnings: r.warnings,
  }
}
