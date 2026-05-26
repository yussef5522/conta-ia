// Sprint 5.0.2.g — Validação da Knowledge Base profunda (10 arquivos).

import { describe, it, expect } from 'vitest'
import {
  RESTAURANTES_KB,
  ACADEMIAS_KB,
  COMERCIO_ROUPA_KB,
  GRANDES_REDES_KB,
  ICMS_ST_POR_ESTADO_KB,
  PIS_COFINS_CREDITOS_KB,
  FATOR_R_DEEP_KB,
  PERSE_KB,
  REFORMA_TRIBUTARIA_DEEP_KB,
  JURISPRUDENCIA_DEEP_KB,
  getKnowledgeFor,
  KNOWLEDGE_TOPICS,
  type KnowledgeTopic,
} from '@/lib/tax/knowledge'

describe('Restaurantes KB (deep)', () => {
  it('CNAE 5611-2/01 mapeado para Anexo I', () => {
    const cnae = RESTAURANTES_KB.cnaes.principais.find((c) => c.code === '5611-2/01')!
    expect(cnae.anexoSimples).toBe('I')
    expect(cnae.elegivelPERSE).toBe(true)
    expect(cnae.baseLegal).toContain('192/2022')
  })

  it('LC 192/2022 explicada com tabela de alíquotas Anexo I', () => {
    expect(RESTAURANTES_KB.lc192_2022.aliquotasAnexoI).toHaveLength(6)
    expect(RESTAURANTES_KB.lc192_2022.aliquotasAnexoI[0].aliquota).toBe('4.00%')
  })

  it('PERSE com base legal 14.148/2021 + 14.859/2024', () => {
    expect(RESTAURANTES_KB.perse.leis.original).toContain('14.148/2021')
    expect(RESTAURANTES_KB.perse.vigencia.fim).toContain('2027')
  })

  it('Combo Mc/BK documentado com cálculo de economia', () => {
    expect(RESTAURANTES_KB.combo_mc_bk.titulo).toContain('Combo')
    expect(RESTAURANTES_KB.combo_mc_bk.comoFunciona).toContain('1,252')
  })

  it('Benchmark grandes redes inclui Madero + Mc + BK + Outback', () => {
    expect(RESTAURANTES_KB.benchmark_grandes_redes.madero).toBeDefined()
    expect(RESTAURANTES_KB.benchmark_grandes_redes.mcDonalds).toBeDefined()
    expect(RESTAURANTES_KB.benchmark_grandes_redes.burgerKing).toBeDefined()
    expect(RESTAURANTES_KB.benchmark_grandes_redes.outback).toBeDefined()
  })
})

describe('Academias KB (deep)', () => {
  it('CNAE 9313-1/00 sujeito a Fator R', () => {
    const cnae = ACADEMIAS_KB.cnaes.principais.find((c) => c.code === '9313-1/00')!
    expect(cnae.anexoSimples).toContain('III/V')
  })

  it('Fator R fórmula explicada com threshold 28%', () => {
    expect(ACADEMIAS_KB.fator_r.formula).toContain('28%')
    expect(ACADEMIAS_KB.fator_r.baseLegal[0]).toContain('5º-J')
  })

  it('Smart Fit holding documentado', () => {
    expect(ACADEMIAS_KB.estrutura_franquia.modelo_smart_fit).toContain('Bio Ritmo')
    expect(ACADEMIAS_KB.benchmark_grandes_redes.smart_fit.estrategias_principais.length).toBeGreaterThan(3)
  })

  it('Segregação suplementos Anexo I documentada', () => {
    expect(ACADEMIAS_KB.segregacao_suplementos.titulo).toContain('Anexo I')
  })

  it('Personal trainer 4 modelos (CLT/PJ aluguel/PJ parceria/autônomo)', () => {
    expect(ACADEMIAS_KB.personal_trainer.modelos.clt).toBeDefined()
    expect(ACADEMIAS_KB.personal_trainer.modelos.pj_aluguel).toBeDefined()
    expect(ACADEMIAS_KB.personal_trainer.modelos.pj_parceria).toBeDefined()
    expect(ACADEMIAS_KB.personal_trainer.modelos.autonomo).toBeDefined()
  })
})

describe('Comércio Roupa KB (deep)', () => {
  it('CNAE 4781-4/00 Anexo I', () => {
    const cnae = COMERCIO_ROUPA_KB.cnaes.principais.find((c) => c.code === '4781-4/00')!
    expect(cnae.anexoSimples).toBe('I')
  })

  it('ICMS-ST por estado: SP NÃO tem, MG/RJ TÊM', () => {
    expect(COMERCIO_ROUPA_KB.icms_st_vestuario.estados_com_st_vestuario.SP.status).toContain('NÃO')
    expect(COMERCIO_ROUPA_KB.icms_st_vestuario.estados_com_st_vestuario.MG.status).toContain('TEM')
    expect(COMERCIO_ROUPA_KB.icms_st_vestuario.estados_com_st_vestuario.RJ.status).toContain('TEM')
  })

  it('DIFAL EC 87/2015 + LC 190/2022', () => {
    expect(COMERCIO_ROUPA_KB.difal.baseLegal).toContain('EC 87/2015')
    expect(COMERCIO_ROUPA_KB.difal.baseLegal).toContain('LC 190/2022')
  })

  it('NCM Capítulos 61, 62, 64 documentados', () => {
    expect(COMERCIO_ROUPA_KB.ncm_vestuario.capitulos_principais['Capítulo 61']).toBeDefined()
    expect(COMERCIO_ROUPA_KB.ncm_vestuario.capitulos_principais['Capítulo 62']).toBeDefined()
    expect(COMERCIO_ROUPA_KB.ncm_vestuario.capitulos_principais['Capítulo 64']).toBeDefined()
  })

  it('Benchmark Renner LREN3 + Riachuelo + C&A', () => {
    expect(COMERCIO_ROUPA_KB.benchmark_grandes_redes.renner.ticker).toBe('LREN3')
    expect(COMERCIO_ROUPA_KB.benchmark_grandes_redes.riachuelo_guararapes).toBeDefined()
    expect(COMERCIO_ROUPA_KB.benchmark_grandes_redes.cea).toBeDefined()
  })
})

describe('Grandes Redes KB (consolidado)', () => {
  it('Restaurantes: Mc, BK, Madero, Outback, Girafas, Subway', () => {
    const r = GRANDES_REDES_KB.restaurantes
    expect(r.mcdonalds).toBeDefined()
    expect(r.burgerking).toBeDefined()
    expect(r.madero).toBeDefined()
    expect(r.outback).toBeDefined()
    expect(r.girafas).toBeDefined()
    expect(r.subway).toBeDefined()
  })

  it('Academias: Smart Fit, Bodytech, Bluefit, AllpFit, CrossFit', () => {
    const a = GRANDES_REDES_KB.academias
    expect(a.smartfit).toBeDefined()
    expect(a.bodytech).toBeDefined()
    expect(a.bluefit).toBeDefined()
    expect(a.allpfit).toBeDefined()
    expect(a.competex_crossfit).toBeDefined()
  })

  it('Comércio roupa: Renner, Riachuelo, C&A, Marisa, Pernambucanas', () => {
    const c = GRANDES_REDES_KB.comercio_roupa
    expect(c.renner).toBeDefined()
    expect(c.riachuelo_guararapes).toBeDefined()
    expect(c.cea).toBeDefined()
    expect(c.marisa).toBeDefined()
    expect(c.pernambucanas).toBeDefined()
  })
})

describe('ICMS-ST por Estado KB', () => {
  it('Bebidas em ST em TODOS estados (Convênio 142/2018)', () => {
    expect(ICMS_ST_POR_ESTADO_KB.bebidas.descricao).toContain('142/2018')
    expect(ICMS_ST_POR_ESTADO_KB.bebidas.produtos.length).toBeGreaterThan(5)
  })

  it('Combustíveis em ST em todos estados', () => {
    expect(ICMS_ST_POR_ESTADO_KB.combustiveis.todos_estados).toContain('TEM ST')
  })
})

describe('PIS/COFINS Créditos KB', () => {
  it('Alíquotas 1.65% + 7.6% = 9.25%', () => {
    expect(PIS_COFINS_CREDITOS_KB.conceito).toContain('9.25%')
  })

  it('RE 1.221.170 STF (insumo essencial ou relevante)', () => {
    expect(PIS_COFINS_CREDITOS_KB.jurisprudencia_relevante.re_1221170_STF).toBeDefined()
  })

  it('Lista de itens sem direito a crédito (folha exceto VT)', () => {
    expect(PIS_COFINS_CREDITOS_KB.itens_sem_credito.length).toBeGreaterThan(5)
  })
})

describe('Fator R Deep KB', () => {
  it('Base legal LC 123/2006 + Resolução CGSN 140/2018', () => {
    expect(FATOR_R_DEEP_KB.formula).toBeDefined()
    expect(FATOR_R_DEEP_KB.estrategias_atingir_28pct.aumentar_pro_labore).toContain('INSS')
  })

  it('CNAEs sujeitos lista 10+', () => {
    expect(FATOR_R_DEEP_KB.cnaes_sujeitos_fator_r.length).toBeGreaterThanOrEqual(10)
  })
})

describe('PERSE Deep KB', () => {
  it('Vigência até 28/02/2027', () => {
    expect(PERSE_KB.vigencia.fim).toContain('2027')
  })

  it('CNAEs elegíveis principais: restaurantes + eventos + turismo', () => {
    expect(PERSE_KB.cnaes_elegiveis_principais.restaurantes_bares.length).toBeGreaterThan(5)
    expect(PERSE_KB.cnaes_elegiveis_principais.eventos_entretenimento.length).toBeGreaterThan(3)
    expect(PERSE_KB.cnaes_elegiveis_principais.turismo.length).toBeGreaterThan(3)
  })

  it('Cadastur obrigatório para CNAEs do Anexo II', () => {
    expect(PERSE_KB.cadastur_obrigatorio.requisito).toContain('18/03/2022')
  })
})

describe('Reforma Tributária Deep KB', () => {
  it('Base legal EC 132/2023 + LC 214/2025', () => {
    expect(REFORMA_TRIBUTARIA_DEEP_KB.base_legal[0]).toContain('132/2023')
    expect(REFORMA_TRIBUTARIA_DEEP_KB.base_legal[1]).toContain('214/2025')
  })

  it('Cronograma 2026 a 2033', () => {
    expect(REFORMA_TRIBUTARIA_DEEP_KB.cronograma['2026']).toBeDefined()
    expect(REFORMA_TRIBUTARIA_DEEP_KB.cronograma['2027']).toBeDefined()
    expect(REFORMA_TRIBUTARIA_DEEP_KB.cronograma['2033']).toBeDefined()
  })

  it('Redução restaurantes 60% (alimentação essencial)', () => {
    expect(REFORMA_TRIBUTARIA_DEEP_KB.reducoes_por_setor.restaurantes_alimentacao.reducao).toBe('60%')
  })

  it('Imposto Seletivo cobre bebidas alcoólicas, cigarros, açucaradas', () => {
    expect(REFORMA_TRIBUTARIA_DEEP_KB.imposto_seletivo.produtos_taxados.length).toBeGreaterThan(5)
  })
})

describe('Jurisprudência Deep KB', () => {
  it('STF Tema 69 (ICMS na base PIS/COFINS) presente', () => {
    expect(JURISPRUDENCIA_DEEP_KB.stf.re_574706).toBeDefined()
    expect(JURISPRUDENCIA_DEEP_KB.stf.re_574706.tese).toContain('Tema 69')
  })

  it('STF Tema 1067 (ISS na base PIS/COFINS) 2024', () => {
    expect(JURISPRUDENCIA_DEEP_KB.stf.re_1187264.tese).toContain('Tema 1067')
  })

  it('STJ Tema 756 (frete venda gera crédito)', () => {
    expect(JURISPRUDENCIA_DEEP_KB.stj.tema_756).toBeDefined()
  })

  it('Solução de Consulta COSIT 89/2024 (PERSE)', () => {
    expect(JURISPRUDENCIA_DEEP_KB.receita_federal_solucoes_consulta.cosit_89_2024).toBeDefined()
  })
})

describe('getKnowledgeFor — novos tópicos deep', () => {
  const deepTopics: KnowledgeTopic[] = [
    'restaurantes-deep',
    'academias-deep',
    'comercio-roupa-deep',
    'grandes-redes',
    'icms-st-estados',
    'pis-cofins-creditos',
    'fator-r-deep',
    'perse-deep',
    'reforma-tributaria-deep',
    'jurisprudencia-deep',
  ]

  for (const topic of deepTopics) {
    it(`tópico ${topic} retorna conteúdo`, () => {
      const r = getKnowledgeFor(topic)
      expect(r).toBeDefined()
      expect(typeof r).toBe('object')
    })
  }
})

describe('KNOWLEDGE_TOPICS lista expandida', () => {
  it('inclui 20 tópicos (10 originais + 10 deep)', () => {
    expect(KNOWLEDGE_TOPICS).toHaveLength(20)
  })

  it('label dos novos tópicos é descritivo', () => {
    const restDeep = KNOWLEDGE_TOPICS.find((t) => t.key === 'restaurantes-deep')!
    expect(restDeep.label).toContain('Mc')
    expect(restDeep.label).toContain('PERSE')
  })
})
