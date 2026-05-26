// Sprint 5.0.2.c — Validação da Knowledge Base contábil.

import { describe, it, expect } from 'vitest'
import {
  SIMPLES_NACIONAL,
  LUCRO_PRESUMIDO,
  LUCRO_REAL,
  REFORMA_TRIBUTARIA,
  BENEFICIOS_FISCAIS,
  SUBSTITUICAO_TRIBUTARIA,
  PIS_COFINS_MONOFASICO,
  ESTADOS_PARTICULARIDADES,
  FATOR_R,
  JURISPRUDENCIA,
  ALL_KNOWLEDGE,
  KNOWLEDGE_TOPICS,
  getKnowledgeFor,
} from '@/lib/tax/knowledge'

describe('Simples Nacional KB', () => {
  it('limite global anual = R$ 4,8M', () => {
    expect(SIMPLES_NACIONAL.limites.globalAnual).toBe(4_800_000)
  })

  it('limite MEI = R$ 81k', () => {
    expect(SIMPLES_NACIONAL.limites.mei).toBe(81_000)
  })

  it('5 anexos cadastrados (I-V)', () => {
    expect(SIMPLES_NACIONAL.anexos.anexoI).toBeDefined()
    expect(SIMPLES_NACIONAL.anexos.anexoII).toBeDefined()
    expect(SIMPLES_NACIONAL.anexos.anexoIII).toBeDefined()
    expect(SIMPLES_NACIONAL.anexos.anexoIV).toBeDefined()
    expect(SIMPLES_NACIONAL.anexos.anexoV).toBeDefined()
  })

  it('Anexo I tem 6 faixas com alíquotas corretas (4% → 19%)', () => {
    const f = SIMPLES_NACIONAL.anexos.anexoI.faixas
    expect(f).toHaveLength(6)
    expect(f[0].aliquota).toBe(4.0)
    expect(f[5].aliquota).toBe(19.0)
  })

  it('Anexo III tem Fator R com threshold 28%', () => {
    expect(SIMPLES_NACIONAL.anexos.anexoIII.fatorR.threshold).toBe(0.28)
  })

  it('Anexo V tem alíquota inicial 15,5% (gatilho pra otimização Fator R)', () => {
    expect(SIMPLES_NACIONAL.anexos.anexoV.faixas[0].aliquota).toBe(15.5)
  })

  it('Inclui exclusões da base (ICMS-ST + monofásico + devoluções)', () => {
    const tipos = SIMPLES_NACIONAL.exclusoesDaBase.map((e) => e.tipo)
    expect(tipos.some((t) => t.includes('Substituição'))).toBe(true)
    expect(tipos.some((t) => t.includes('Monofásico'))).toBe(true)
    expect(tipos.some((t) => t.includes('Devoluções'))).toBe(true)
  })

  it('Cita LC 192/2022 (Lei dos Restaurantes)', () => {
    const cnaes = SIMPLES_NACIONAL.anexos.anexoI.cnaesExemplos.join(' ')
    expect(cnaes).toContain('LC 192/2022')
  })
})

describe('Lucro Presumido KB', () => {
  it('limite R$ 78M', () => {
    expect(LUCRO_PRESUMIDO.limites.receitaBrutaAnual).toBe(78_000_000)
  })

  it('margem IRPJ comércio = 8%', () => {
    expect(LUCRO_PRESUMIDO.margensIRPJ.comercio).toBe(8.0)
  })

  it('margem IRPJ serviços = 32%', () => {
    expect(LUCRO_PRESUMIDO.margensIRPJ.servicosGerais).toBe(32.0)
  })

  it('PIS/COFINS cumulativo 0,65% + 3%', () => {
    expect(LUCRO_PRESUMIDO.pisCofinsCumulativo.pis).toBe(0.65)
    expect(LUCRO_PRESUMIDO.pisCofinsCumulativo.cofins).toBe(3.0)
  })

  it('CSLL alíquota 9%', () => {
    expect(LUCRO_PRESUMIDO.aliquotas.csll).toBe(9.0)
  })
})

describe('Lucro Real KB', () => {
  it('PIS não-cumulativo 1,65%', () => {
    expect(LUCRO_REAL.aliquotas.pisNaoCumulativo).toBe(1.65)
  })

  it('COFINS não-cumulativo 7,6%', () => {
    expect(LUCRO_REAL.aliquotas.cofinsNaoCumulativo).toBe(7.6)
  })

  it('Compensação prejuízo limitada a 30%', () => {
    expect(LUCRO_REAL.apuracaoLucroReal.compensacaoPrejuizos.limite).toContain('30%')
  })

  it('IRPJ adicional 10% sobre excedente trimestral 60k', () => {
    expect(LUCRO_REAL.aliquotas.irpjAdicional.aliquota).toBe(10.0)
    expect(LUCRO_REAL.aliquotas.irpjAdicional.limiteTrimestral).toBe(60_000)
  })
})

describe('Reforma Tributária KB', () => {
  it('EC 132/2023 + LC 214/2025', () => {
    expect(REFORMA_TRIBUTARIA.baseLegal.emenda).toContain('132/2023')
    expect(REFORMA_TRIBUTARIA.baseLegal.leiComplementar).toContain('214/2025')
  })

  it('3 tributos novos: CBS, IBS, Imposto Seletivo', () => {
    expect(REFORMA_TRIBUTARIA.tributos.cbs).toBeDefined()
    expect(REFORMA_TRIBUTARIA.tributos.ibs).toBeDefined()
    expect(REFORMA_TRIBUTARIA.tributos.impostoSeletivo).toBeDefined()
  })

  it('Cronograma cobre 2026-2033', () => {
    expect(REFORMA_TRIBUTARIA.cronograma['2026']).toBeDefined()
    expect(REFORMA_TRIBUTARIA.cronograma['2033']).toBeDefined()
  })

  it('Saúde tem redução 60% (academia inclusa)', () => {
    expect(REFORMA_TRIBUTARIA.regimesDiferenciados.saude.reducao).toBe(60)
    const ativs = REFORMA_TRIBUTARIA.regimesDiferenciados.saude.atividadesCobertas.join(' ')
    expect(ativs.toLowerCase()).toContain('academ')
  })

  it('Decisão Simples em setembro/2026 com 3 alternativas', () => {
    expect(REFORMA_TRIBUTARIA.decisaoSimples.prazo).toContain('2026')
    expect(REFORMA_TRIBUTARIA.decisaoSimples.alternativas).toHaveLength(3)
  })
})

describe('Benefícios Fiscais KB', () => {
  it('PERSE: Lei 14.148/2021', () => {
    expect(BENEFICIOS_FISCAIS.perse.baseLegal).toContain('14.148/2021')
  })

  it('PERSE inclui restaurantes (5611-2/01)', () => {
    const cnaes = BENEFICIOS_FISCAIS.perse.cnaesElegiveis.join(' ')
    expect(cnaes).toContain('5611-2/01')
  })

  it('Lei do Bem requer Lucro Real', () => {
    expect(BENEFICIOS_FISCAIS.leiDoBem.requisito).toContain('Lucro Real')
  })

  it('ZFM preservada pela EC 132', () => {
    expect(BENEFICIOS_FISCAIS.zonaFrancaManaus.preservacaoReforma).toContain('132/2023')
  })
})

describe('Substituição Tributária KB', () => {
  it('Convênio CONFAZ 142/2018 citado', () => {
    expect(SUBSTITUICAO_TRIBUTARIA.baseLegal.convenioPrincipal).toContain('142/2018')
  })

  it('Bebidas tipicamente sujeitas a ST', () => {
    expect(SUBSTITUICAO_TRIBUTARIA.produtosTipicos.bebidas).toBeDefined()
  })

  it('Resolução CGSN 140/2018 art. 25 é fundamento da exclusão Simples', () => {
    expect(SUBSTITUICAO_TRIBUTARIA.exclusaoSimples.fundamento).toContain('140/2018')
  })
})

describe('PIS/COFINS Monofásico KB', () => {
  it('Combustíveis: Lei 9.718/1998', () => {
    expect(PIS_COFINS_MONOFASICO.produtos.combustiveis.baseLegal).toContain('9.718')
  })

  it('Bebidas: Lei 10.147/2000', () => {
    expect(PIS_COFINS_MONOFASICO.produtos.bebidas.baseLegal).toContain('10.147/2000')
  })

  it('Veículos: Lei 10.485/2002', () => {
    expect(PIS_COFINS_MONOFASICO.produtos.veiculos.baseLegal).toContain('10.485/2002')
  })

  it('Distingue Monofásico × ST', () => {
    expect(PIS_COFINS_MONOFASICO.diferencaParaSubstituicaoTributaria).toBeDefined()
  })
})

describe('Estados Particularidades KB', () => {
  it('Cobre todas as 27 UFs', () => {
    const ufs = Object.keys(ESTADOS_PARTICULARIDADES.aliquotasInternasPadrao).filter((k) => k !== 'observacao')
    expect(ufs).toHaveLength(27)
  })

  it('SP = 18%, RJ = 22% (com FECP)', () => {
    expect(ESTADOS_PARTICULARIDADES.aliquotasInternasPadrao.SP).toBe(18)
    expect(ESTADOS_PARTICULARIDADES.aliquotasInternasPadrao.RJ).toBe(22)
  })

  it('Sublimite menor (R$ 1,8M) em AC, AP, RR', () => {
    const reduzido = ESTADOS_PARTICULARIDADES.sublimitesSimples['R$_1_800_000']
    expect(reduzido).toContain('AC')
    expect(reduzido).toContain('AP')
    expect(reduzido).toContain('RR')
  })

  it('DIFAL: LC 190/2022', () => {
    expect(ESTADOS_PARTICULARIDADES.difal.baseLegal).toContain('190/2022')
  })
})

describe('Fator R KB', () => {
  it('threshold 0.28 (28%)', () => {
    expect(FATOR_R.conceito.threshold).toBe(0.28)
  })

  it('Pró-labore incluído na folha', () => {
    const itens = FATOR_R.oQueComputaFolha.incluso.map((i) => i.item).join(' ').toLowerCase()
    expect(itens).toContain('pró-labore')
  })

  it('PJ/MEI excluso (anti-pejotização)', () => {
    const exclusos = FATOR_R.oQueComputaFolha.excluso.join(' ').toLowerCase()
    expect(exclusos).toContain('pj')
  })

  it('Tem caso de uso pra academia', () => {
    expect(FATOR_R.casosUso.academia).toBeDefined()
  })
})

describe('Jurisprudência KB', () => {
  it('STF Tema 69 (ICMS na base PIS/COFINS) presente', () => {
    expect(JURISPRUDENCIA.stf.some((d) => d.tema.includes('Tema 69'))).toBe(true)
  })

  it('STJ Tema 1182 (crédito presumido ICMS)', () => {
    expect(JURISPRUDENCIA.stj.some((d) => d.tema.includes('1182'))).toBe(true)
  })

  it('STF Tema 201 (restituição ICMS-ST)', () => {
    expect(JURISPRUDENCIA.stf.some((d) => d.tema.includes('Tema 201'))).toBe(true)
  })
})

describe('Index e helpers', () => {
  it('ALL_KNOWLEDGE agrega 10 tópicos', () => {
    expect(Object.keys(ALL_KNOWLEDGE)).toHaveLength(10)
  })

  it('KNOWLEDGE_TOPICS lista 20 entries (10 originais + 10 deep Sprint 5.0.2.g)', () => {
    expect(KNOWLEDGE_TOPICS).toHaveLength(20)
  })

  it('getKnowledgeFor("simples-nacional") retorna SIMPLES_NACIONAL', () => {
    expect(getKnowledgeFor('simples-nacional')).toBe(SIMPLES_NACIONAL)
  })

  it('getKnowledgeFor("reforma-tributaria") retorna REFORMA_TRIBUTARIA', () => {
    expect(getKnowledgeFor('reforma-tributaria')).toBe(REFORMA_TRIBUTARIA)
  })
})

describe('Versão consistente', () => {
  it('Todos os 10 KBs marcados como versão 2026', () => {
    expect(SIMPLES_NACIONAL.versao).toBe('2026')
    expect(LUCRO_PRESUMIDO.versao).toBe('2026')
    expect(LUCRO_REAL.versao).toBe('2026')
    expect(REFORMA_TRIBUTARIA.versao).toBe('2026')
    expect(BENEFICIOS_FISCAIS.versao).toBe('2026')
    expect(SUBSTITUICAO_TRIBUTARIA.versao).toBe('2026')
    expect(PIS_COFINS_MONOFASICO.versao).toBe('2026')
    expect(ESTADOS_PARTICULARIDADES.versao).toBe('2026')
    expect(FATOR_R.versao).toBe('2026')
    expect(JURISPRUDENCIA.versao).toBe('2026')
  })
})
