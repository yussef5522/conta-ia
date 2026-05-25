// Sprint 5.0.2.b — Testes do engine principal CNAE Expert.

import { describe, it, expect } from 'vitest'
import {
  analyzeCNAEExpertise,
  calculateFatorR,
  totalCNAEsCadastrados,
} from '@/lib/tax/cnae-expert-engine'

describe('calculateFatorR', () => {
  it('Folha 30k / RBA 100k = 0.30', () => {
    expect(calculateFatorR(30_000, 100_000)).toBeCloseTo(0.3)
  })
  it('RBA 0 → 0 (sem div by zero)', () => {
    expect(calculateFatorR(50_000, 0)).toBe(0)
  })
  it('Folha 28k / RBA 100k = 0.28 (threshold)', () => {
    expect(calculateFatorR(28_000, 100_000)).toBeCloseTo(0.28)
  })
})

describe('analyzeCNAEExpertise — CNAE inexistente', () => {
  it('retorna null', () => {
    const r = analyzeCNAEExpertise({
      cnae: '9999-9/99',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 100_000,
      rba12m: 1_000_000,
      folha12m: 280_000,
    })
    expect(r).toBeNull()
  })
})

describe('analyzeCNAEExpertise — RESTAURANTE 5611-2/01', () => {
  it('Cacula Mix realista: 100k/mês, com bebidas, com delivery', () => {
    const r = analyzeCNAEExpertise({
      cnae: '5611-2/01',
      regime: 'SIMPLES_NACIONAL',
      anexoSimples: 'ANEXO_I',
      receitaMensal: 100_000,
      rba12m: 1_200_000,
      folha12m: 360_000, // 30% = Fator R OK
      estado: 'RS',
      hasDelivery: true,
      vendeBebidas: true,
    })

    expect(r).not.toBeNull()
    expect(r!.ramo).toBe('RESTAURANTE')
    expect(r!.anexoRecomendado).toBe('ANEXO_I')
    expect(r!.fatorR).toBeCloseTo(0.3)
    expect(r!.fatorROK).toBe(true)

    // Tem otimização de bebidas
    expect(r!.otimizacoes.some((o) => o.titulo.includes('bebidas'))).toBe(true)

    // Tem PERSE (CNAE 5611*)
    expect(r!.otimizacoes.some((o) => o.titulo.includes('PERSE'))).toBe(true)

    // Tem segregação delivery
    expect(r!.recomendacoes.some((r2) => r2.titulo.includes('delivery'))).toBe(true)
  })

  it('Sem bebidas + sem delivery: não gera otimizações específicas', () => {
    const r = analyzeCNAEExpertise({
      cnae: '5611-2/01',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 100_000,
      rba12m: 1_200_000,
      folha12m: 360_000,
      hasDelivery: false,
      vendeBebidas: false,
    })
    expect(r!.otimizacoes.some((o) => o.titulo.includes('bebidas'))).toBe(false)
    expect(r!.recomendacoes.some((r2) => r2.titulo.includes('delivery'))).toBe(false)
  })

  it('Fator R baixo + receita >30k: gera WARNING + recomendação pró-labore', () => {
    const r = analyzeCNAEExpertise({
      cnae: '5611-2/01',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 50_000, // ~8% = MUITO baixo
      vendeBebidas: true,
    })
    expect(r!.fatorROK).toBe(false)
    expect(r!.alertas.some((a) => a.severidade === 'WARNING')).toBe(true)
    expect(r!.recomendacoes.some((rec) => rec.titulo.includes('pró-labore'))).toBe(true)
  })

  it('Recomendações priorizadas por impacto desc', () => {
    const r = analyzeCNAEExpertise({
      cnae: '5611-2/01',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 100_000,
      rba12m: 1_200_000,
      folha12m: 360_000,
      vendeBebidas: true,
      hasDelivery: true,
    })
    const impacts = r!.recomendacoes.map((x) => x.impactoFinanceiro)
    const sorted = [...impacts].sort((a, b) => b - a)
    expect(impacts).toEqual(sorted)
    // Prioridade re-numerada
    expect(r!.recomendacoes[0].prioridade).toBe(1)
  })
})

describe('analyzeCNAEExpertise — ACADEMIA 9313-1/00', () => {
  it('Academia com Fator R OK: status positivo + economia info', () => {
    const r = analyzeCNAEExpertise({
      cnae: '9313-1/00',
      regime: 'SIMPLES_NACIONAL',
      anexoSimples: 'ANEXO_III',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 200_000, // 33% = OK
    })

    expect(r!.fatorROK).toBe(true)
    expect(r!.alertas.some((a) => a.severidade === 'INFO')).toBe(true)
    expect(r!.otimizacoes.some((o) => o.titulo.includes('Anexo III'))).toBe(true)
  })

  it('Academia SEM Fator R: ALERTA CRITICAL + recomendação #1 pró-labore', () => {
    const r = analyzeCNAEExpertise({
      cnae: '9313-1/00',
      regime: 'SIMPLES_NACIONAL',
      anexoSimples: 'ANEXO_V',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 100_000, // ~17% = muito baixo
    })

    expect(r!.fatorROK).toBe(false)
    expect(r!.alertas.some((a) => a.severidade === 'CRITICAL')).toBe(true)
    expect(r!.recomendacoes[0].titulo).toContain('pró-labore')
    // Impacto deve ser receita × 9.5% (anexoV - anexoIII)
    expect(r!.recomendacoes[0].impactoFinanceiro).toBeGreaterThan(50_000 * 0.05)
  })

  it('Reforma 2026 redução 30% saúde sempre presente em academia', () => {
    const r = analyzeCNAEExpertise({
      cnae: '9313-1/00',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 200_000,
    })
    expect(r!.otimizacoes.some((o) => o.titulo.includes('Reforma'))).toBe(true)
  })

  it('Academia condicionamento (9313) sugere separar personal trainer', () => {
    const r = analyzeCNAEExpertise({
      cnae: '9313-1/00',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 200_000,
    })
    expect(r!.recomendacoes.some((rec) => rec.titulo.includes('personal'))).toBe(true)
  })
})

describe('analyzeCNAEExpertise — COMERCIO_ROUPA 4781-4/00', () => {
  it('Loja em SP: ICMS-ST identificado + DIFAL recomendado', () => {
    const r = analyzeCNAEExpertise({
      cnae: '4781-4/00',
      regime: 'SIMPLES_NACIONAL',
      anexoSimples: 'ANEXO_I',
      receitaMensal: 80_000,
      rba12m: 900_000,
      folha12m: 100_000,
      estado: 'SP',
    })

    expect(r!.ramo).toBe('COMERCIO_ROUPA')
    expect(r!.otimizacoes.some((o) => o.titulo.includes('ICMS-ST'))).toBe(true)
    expect(r!.recomendacoes.some((rec) => rec.titulo.includes('DIFAL'))).toBe(true)
  })

  it('Loja em estado SEM ST: alerta INFO + sem ICMS-ST otimização', () => {
    const r = analyzeCNAEExpertise({
      cnae: '4781-4/00',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 80_000,
      rba12m: 900_000,
      folha12m: 100_000,
      estado: 'AC', // Acre, sem ST vestuário
    })

    expect(r!.otimizacoes.some((o) => o.titulo.includes('ICMS-ST'))).toBe(false)
    expect(r!.alertas.some((a) => a.severidade === 'INFO' && a.mensagem.includes('AC'))).toBe(
      true,
    )
  })

  it('Receita >20k: gera provisão sazonal', () => {
    const r = analyzeCNAEExpertise({
      cnae: '4781-4/00',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 100_000,
      estado: 'SP',
    })
    expect(r!.otimizacoes.some((o) => o.titulo.includes('sazonais'))).toBe(true)
  })

  it('Calçados 4782-2/01 também classificado como COMERCIO_ROUPA', () => {
    const r = analyzeCNAEExpertise({
      cnae: '4782-2/01',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 80_000,
      rba12m: 900_000,
      folha12m: 100_000,
      estado: 'RJ',
    })
    expect(r!.ramo).toBe('COMERCIO_ROUPA')
  })
})

describe('analyzeCNAEExpertise — economiaTotalEstimada', () => {
  it('Soma de todas as otimizações', () => {
    const r = analyzeCNAEExpertise({
      cnae: '5611-2/01',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 100_000,
      rba12m: 1_200_000,
      folha12m: 360_000,
      vendeBebidas: true,
    })
    const soma = r!.otimizacoes.reduce((s, o) => s + o.economiaEstimada, 0)
    expect(r!.economiaTotalEstimada).toBeCloseTo(soma, 4)
  })
})

describe('totalCNAEsCadastrados', () => {
  it('retorna 19', () => {
    expect(totalCNAEsCadastrados()).toBe(19)
  })
})

describe('Snapshot expertise — campos críticos', () => {
  it('Restaurante: expertise tem redesGrandes', () => {
    const r = analyzeCNAEExpertise({
      cnae: '5611-2/01',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 100_000,
      rba12m: 1_200_000,
      folha12m: 360_000,
    })
    expect(r!.expertise.redesGrandes).toBeDefined()
    expect(Object.keys(r!.expertise.redesGrandes!).length).toBeGreaterThan(0)
  })

  it('Snapshot inclui particularidades + errosComuns', () => {
    const r = analyzeCNAEExpertise({
      cnae: '9313-1/00',
      regime: 'SIMPLES_NACIONAL',
      receitaMensal: 50_000,
      rba12m: 600_000,
      folha12m: 200_000,
    })
    expect(r!.expertise.particularidades.length).toBeGreaterThan(0)
    expect(r!.expertise.errosComuns.length).toBeGreaterThan(0)
  })
})
