// Sprint 5.0.2.b — Expertise Academias.
//
// Base: LC 123/2006 (Anexo III com Fator R), LC 155/2016 (Fator R 28%),
// EC 132/2023 + LC 214/2025 (Reforma Tributária — academias = saúde =
// redução 30% IBS/CBS).

import type { CNAEEntry, ExpertiseRamo } from './types'

export const CNAES_ACADEMIAS: CNAEEntry[] = [
  { code: '9313-1/00', name: 'Atividades de condicionamento físico (academia)', anexo: 'III/V' },
  { code: '9311-5/00', name: 'Gestão de instalações esportivas', anexo: 'III/V' },
  { code: '8591-1/00', name: 'Ensino de esportes (crossfit, lutas)', anexo: 'III/V' },
  { code: '8592-9/03', name: 'Ensino de dança / balé / ginástica', anexo: 'III/V' },
  { code: '9319-1/01', name: 'Personal trainer', anexo: 'III/V' },
]

export const EXPERTISE_ACADEMIAS: ExpertiseRamo = {
  ramo: 'ACADEMIA',
  cnaes: CNAES_ACADEMIAS,
  anexoPreferido: 'ANEXO_III', // se Fator R >= 28%
  aliquotaSeFatorR_OK: 6.0,
  aliquotaSeFatorR_NAO: 15.5,

  beneficios: [
    {
      tipo: 'FATOR_R_CRITICO',
      descricao: 'Fator R — A alavanca tributária #1 da academia',
      detalhes:
        'Academia tem folha pesada (instrutores, recepção, faxina). Com folha >= 28% do RBA 12m vai pro Anexo III (6%–15,5%). Sem Fator R cai pro Anexo V (15,5%–30%). Diferença chega a 9,5 pontos percentuais sobre o faturamento.',
      economiaPotencial: '9,5 p.p. sobre o faturamento',
      aplicaA: ['Academias', 'Studios', 'Boxes CrossFit', 'Estúdios de pilates'],
      comoAproveitar: [
        'Medir Fator R todo mês (folha12m ÷ RBA12m)',
        'Ajustar pró-labore antecipadamente quando margem ficar perto de 28%',
        'Registrar instrutores como CLT (não MEI nem PJ)',
      ],
    },
    {
      tipo: 'IBS_CBS_REDUCAO_30',
      descricao: 'Reforma Tributária 2026 — Redução 30% (saúde)',
      detalhes:
        'EC 132/2023 + LC 214/2025: academias e atividades físicas são classificadas como serviços de saúde e têm redução de 30% das alíquotas IBS/CBS durante a transição.',
      economiaPotencial: 'Até R$ 15.000/ano em academia médio porte',
      validade: '2026–2033 (transição completa)',
    },
    {
      tipo: 'PRO_LABORE_ESTRATEGICO',
      descricao: 'Pró-labore como alavanca de Fator R',
      detalhes:
        'Subir pró-labore dos sócios é a maneira mais rápida de elevar o Fator R sem mexer no quadro de funcionários. Conta como folha pro 28% e ainda gera CPP do sócio.',
      economiaPotencial: 'Pode evitar troca pro Anexo V (9,5 p.p.)',
      comoAproveitar: [
        'Calcular pró-labore mínimo pra Fator R >= 28%',
        'Documentar pró-labore mensal no contrato social',
        'Recolher INSS 11% sobre pró-labore (limite teto)',
      ],
    },
    {
      tipo: 'SEGREGACAO_SERVICOS',
      descricao: 'Segregação por CNAE',
      detalhes:
        'Personal trainer (9319-1/01), nutrição (8650-0/04) e estética (9602-5/02) são CNAEs distintos. Manter atividades em CNPJs ou centros de custo separados otimiza tributação por atividade.',
      economiaPotencial: 'Variável conforme mix de serviços',
    },
  ],

  fatorRAnalysis: {
    importancia: 'EXTREMA - Maior alavanca tributária',
    detalhes:
      'Para academia, Fator R = vida ou morte tributária. Diferença entre Anexo III (6%) e Anexo V (15,5%) na alíquota inicial. Em academia de R$ 50k/mês isso vira R$ 4.750/mês = R$ 57.000/ano.',
    economiaTipica: 'R$ 57.000/ano em academia R$ 50k/mês',
    estrategias: [
      'Manter folha SEMPRE >= 28% do faturamento (medir mensal)',
      'Contratar CLT em vez de MEI/PJ para instrutores',
      'Ajustar pró-labore proporcionalmente ao crescimento da receita',
      'Não terceirizar instrutores se Fator R estiver no limite',
      'Reservar 1 dia/mês para revisar Fator R e ajustar antes do fechamento',
    ],
  },

  proLaboreOtimo: {
    formula: 'proLabore mensal = max(0, (RBA12m × 0,28 − salários12m) ÷ 12)',
    exemplo: 'Academia R$ 50k/mês com salários R$ 10k/mês: pró-labore >= R$ 4k garante Fator R',
  },

  particularidades: [
    'Smart Fit: modelo intencional de folha alta pra travar Anexo III',
    'CrossFit boxes: CNAE 8591-1/00 (ensino de esportes), também Anexo III com Fator R',
    'Personal trainer: pode ser CLT da academia OU PJ separada (planejar)',
    'Nutrição (CNAE 8650-0/04) é saúde — outro CNAE e regime fiscal',
    'Estética (CNAE 9602-5/02) entra como beleza, regime distinto',
    'Reforma Tributária 2026: academias = redução 30% IBS/CBS',
  ],

  errosComuns: [
    'Não aproveitar Fator R = pagar 15,5% em vez de 6%',
    'Terceirizar instrutores via MEI (derruba a folha)',
    'Pró-labore baixo demais para Fator R',
    'Misturar CNAEs sem segregar receita por atividade',
    'Não medir Fator R mensalmente (só descobrir no DAS)',
  ],

  redesGrandes: {
    smartFit: {
      regime: 'Lucro Real (rede)',
      estrategia: 'Unidades franqueadas mantêm folha alta intencional pra travar Anexo III',
    },
    bodytech: {
      regime: 'Lucro Real',
      estrategia: 'Investimento estratégico em CLT (instrutores + recepção próprios)',
    },
    bioRitmo: {
      regime: 'Lucro Real',
      estrategia: 'Aproveita créditos PIS/COFINS sobre equipamentos (depreciação)',
    },
  },
}
