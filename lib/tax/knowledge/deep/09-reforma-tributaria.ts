/**
 * REFORMA TRIBUTÁRIA 2026-2033
 * EC 132/2023 + LC 214/2025
 */

export const REFORMA_TRIBUTARIA_DEEP_KB = {
  base_legal: ['EC 132/2023 (21/12/2023)', 'LC 214/2025 (16/01/2025)'],

  visao_geral: `Reforma substitui CINCO TRIBUTOS por TRÊS NOVOS:

ANTIGOS (sumirão gradativamente):
- PIS (federal)
- COFINS (federal)
- IPI (federal)
- ICMS (estadual)
- ISS (municipal)

NOVOS:
- CBS (Contribuição sobre Bens e Serviços) - federal - substitui PIS+COFINS
- IBS (Imposto sobre Bens e Serviços) - estadual/municipal - substitui ICMS+ISS
- IS (Imposto Seletivo) - federal - substitui IPI em bens prejudiciais

NÃO MUDAM:
- IRPJ, CSLL
- INSS, FGTS
- ITR, IPTU, IPVA
- ITCMD, ITBI`,

  cronograma: {
    '2026': { mudanca: 'Início TESTE com alíquotas reduzidas', cbs_aliquota: '0.9%', ibs_aliquota: '0.1%', observacao: 'Empresas se adaptam' },
    '2027': { mudanca: 'CBS substitui INTEGRAMENTE PIS+COFINS', cbs_aliquota_estimada: '~9%', observacao: 'PIS e COFINS DEIXAM DE EXISTIR para Lucro Real/Presumido' },
    '2028-2032': {
      mudanca: 'Transição GRADUAL ICMS/ISS → IBS',
      ano_2028: '90% ICMS/ISS + 10% IBS',
      ano_2029: '70% ICMS/ISS + 30% IBS',
      ano_2030: '50% ICMS/ISS + 50% IBS',
      ano_2031: '30% ICMS/ISS + 70% IBS',
      ano_2032: '10% ICMS/ISS + 90% IBS',
    },
    '2033': { mudanca: 'Sistema NOVO completo', tributos_ativos: ['IBS', 'CBS', 'IS'], tributos_extintos: ['PIS', 'COFINS', 'ICMS', 'ISS', 'IPI'] },
  },

  aliquota_padrao_estimada: {
    cbs: '~9% (federal)',
    ibs: '~18% (estadual/municipal - varia jurisdição)',
    total_padrao: '~27% (alíquota cheia)',
    importante: 'Alíquota INCLUÍDA no preço (transparente). Diferente de "por fora" como ICMS hoje.',
  },

  reducoes_por_setor: {
    cesta_basica: { reducao: '100% (alíquota zero)', produtos: 'Lista cesta básica nacional' },
    saude_servicos_essenciais: {
      reducao: '30%',
      atividades: ['Serviços médicos', 'Academias (LC 214/2025)', 'Medicamentos', 'Próteses, órteses'],
    },
    educacao: { reducao: '30%', atividades: 'Ensino regular' },
    alimentos_in_natura: { reducao: '60%', produtos: 'Frutas, legumes, ovos, carnes' },
    restaurantes_alimentacao: { reducao: '60%', observacao: 'Alimentação essencial' },
    transporte_publico: { reducao: '100% (alíquota zero)' },
    produtos_culturais: { reducao: '60%' },
    agropecuaria: { reducao: 'Regimes especiais' },
  },

  cashback: {
    descricao: 'Devolução de IBS+CBS para famílias de baixa renda',
    valores_estimados: { luz: '100% devolvido (até consumo X)', gas_botijao: '100% devolvido', cesta_basica: 'Devolução parcial', outros: 'Conforme renda' },
    cadastro: 'CadÚnico - automático para inscritos',
    impacto_comercio: 'Pode aumentar consumo baixa renda em produtos elegíveis',
  },

  imposto_seletivo: {
    titulo: 'IS - Imposto Seletivo (Imposto do Pecado)',
    objetivo: 'Desestimular consumo bens prejudiciais à saúde/meio ambiente',
    produtos_taxados: ['Cigarros, tabaco', 'Bebidas alcoólicas', 'Bebidas açucaradas (refri)', 'Veículos poluentes', 'Combustíveis fósseis', 'Loterias, apostas', 'Minerais'],
    aliquotas: 'Variáveis por produto - alguns 10%, outros 30%+',
    impacto_setores: {
      restaurantes: 'Bebidas alcoólicas e refrigerantes terão IS além de IBS+CBS',
      atacado_distribuicao: 'Cigarros, bebidas',
      mineracao: 'Custo subirá',
    },
  },

  nao_cumulatividade_plena: {
    conceito: 'IBS e CBS totalmente NÃO-CUMULATIVOS. Cada empresa CREDITA o que pagou na cadeia. Diferente do ICMS atual (limitações). Diferente do PIS/COFINS atual (algumas restrições).',
    impacto: `Empresa compra R$ 100 (com R$ 27 IBS+CBS embutido).
Vende R$ 150 (com R$ 40.50 IBS+CBS embutido).
Crédita R$ 27 + Paga R$ 13.50 (diferença).
Carga efetiva sobre a margem (R$ 50): 27%`,
  },

  decisao_setembro_2026: {
    titulo: 'DECISÃO CRÍTICA: Continuar Simples ou Migrar?',
    contexto: 'Em setembro/2026, Simples Nacional vai oferecer CHOICE: A - CONTINUAR Simples (regras atuais) ou B - MIGRAR para IBS+CBS (não-cumulativo).',
    quando_continuar_simples: [
      'Anexo I/II/III com alíquota baixa (4-10%)',
      'Cliente final é PF (consumidor)',
      'Pouco volume compras qualificadas',
      'Faturamento próximo limite',
    ],
    quando_migrar: [
      'Anexo V (15.5%+) - migrar pode reduzir',
      'B2B - cliente PJ exige crédito',
      'Alto volume compras (créditos altos)',
      'Vai crescer acima R$ 4.8M',
    ],
    setor_a_setor: {
      restaurantes: 'Geralmente CONTINUAR Simples (Anexo I LC 192/2022)',
      academias: 'CONTINUAR Simples (Anexo III Fator R 6%)',
      comercio_varejo_b2c: 'GERALMENTE Simples - cliente PF não exige crédito',
      servicos_b2b: 'MIGRAR IBS+CBS se cliente exige crédito',
      industria_pequena: 'AVALIAR caso a caso',
    },
  },

  preparacao_empresarial: [
    'Levantar todos fornecedores (PJ vs PF)',
    'Mapear NCMs/serviços para reduções',
    'Estimar carga futura vs atual (caso a caso)',
    'Avaliar sistemas (ERP precisa adaptar)',
    'Treinar contadores',
    'Cadastro CadÚnico (clientes baixa renda)',
    'Setembro/2026: decisão consciente Simples vs IBS+CBS',
  ],
} as const
