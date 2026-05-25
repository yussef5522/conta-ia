// Sprint 5.0.2.d — Benchmark de grandes redes por ramo.

import type { Ramo } from '@/lib/tax/expertise'

export interface BenchmarkRede {
  rede: string
  regime: string
  estrategias: string[]
}

export const BENCHMARK_REDES: Record<Ramo, BenchmarkRede[]> = {
  RESTAURANTE: [
    {
      rede: 'Madero',
      regime: 'Lucro Real',
      estrategias: [
        'Aproveita créditos PIS/COFINS não-cumulativo (Lei 10.637/02 + 10.833/03)',
        'Exclui ICMS-ST de bebidas da base (Convênio CONFAZ 110/2006)',
        'PERSE (Lei 14.148/2021) — alíquota zero PIS/COFINS/IRPJ/CSLL',
        'Segregação salão × delivery × eventos',
        'Crédito de embalagens, energia, aluguel, marketing',
      ],
    },
    {
      rede: 'Outback',
      regime: 'Lucro Real',
      estrategias: [
        'Importação direta de vinhos/carnes — ICMS importação como crédito',
        'Crédito de PIS/COFINS sobre insumos premium',
        'Folha alta deduz IRPJ/CSLL',
      ],
    },
    {
      rede: 'Girafas',
      regime: 'Simples Nacional Anexo I',
      estrategias: [
        'Franquias com faturamento abaixo do limite (R$ 4,8M) usam Simples',
        'LC 192/2022 garante Anexo I para restaurantes',
        'Margem de presunção 8% IRPJ permite Lucro Presumido em unidades maiores',
      ],
    },
  ],
  ACADEMIA: [
    {
      rede: 'Smart Fit',
      regime: 'Lucro Real (rede)',
      estrategias: [
        'Folha alta INTENCIONAL pra travar Anexo III (6%) nas franquias',
        'CLT em vez de MEI para instrutores — preserva Fator R ≥ 28%',
        'Reforma 2026: redução 30% IBS/CBS (classificação saúde) — LC 214/2025 art. 124',
        'Crédito PIS/COFINS sobre depreciação de equipamentos',
      ],
    },
    {
      rede: 'Bodytech',
      regime: 'Lucro Real',
      estrategias: [
        'Investimento estratégico em CLT (instrutores + recepção próprios)',
        'Centralização de fornecedores pra ganhar crédito PIS/COFINS',
        'Aproveitamento de incentivos regionais',
      ],
    },
    {
      rede: 'Bio Ritmo',
      regime: 'Lucro Real',
      estrategias: [
        'Crédito PIS/COFINS sobre equipamentos de musculação',
        'Depreciação acelerada de equipamentos (vida útil RFB)',
      ],
    },
  ],
  COMERCIO_ROUPA: [
    {
      rede: 'Renner',
      regime: 'Lucro Real',
      estrategias: [
        'Crédito PIS/COFINS sobre estoque adquirido (Lei 10.833/03)',
        'ICMS de mercadorias como crédito (não-cumulatividade)',
        'Provisões fiscais para Black Friday + Natal (sazonalidade)',
        'STJ Tema 1182 — créditos presumidos ICMS fora da base IRPJ/CSLL',
      ],
    },
    {
      rede: 'Riachuelo',
      regime: 'Lucro Real',
      estrategias: [
        'Crédito sobre embalagens, sacolas e marketing',
        'Logística como centro de custo dedutível',
        'Operações próprias (não franqueadas) maximizam crédito',
      ],
    },
    {
      rede: 'C&A',
      regime: 'Lucro Real',
      estrategias: [
        'Importação direta — ICMS de importação como crédito',
        'Hedge cambial dedutível (proteção de moeda)',
        'Drawback (Lei 11.945/2009) em produção integrada',
      ],
    },
  ],
}

export function getBenchmarkRedes(ramo: Ramo): BenchmarkRede[] {
  return BENCHMARK_REDES[ramo] ?? []
}
