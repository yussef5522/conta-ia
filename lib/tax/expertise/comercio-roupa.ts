// Sprint 5.0.2.b — Expertise Comércio de Roupas (varejo vestuário).
//
// Base: LC 123/2006 (Anexo I), Convênios ICMS-ST por estado (vestuário),
// EC 87/2015 (DIFAL), TIPI/NCM, EC 132/2023 (Reforma).

import type { CNAEEntry, ExpertiseRamo } from './types'

export const CNAES_COMERCIO_ROUPA: CNAEEntry[] = [
  {
    code: '4781-4/00',
    name: 'Comércio varejista de artigos do vestuário',
    anexo: 'I',
    icon: '👕',
    aliases: ['loja roupa', 'roupas', 'vestuario', 'boutique', 'moda', 'fashion', 'renner', 'riachuelo', 'cea', 'zara'],
  },
  {
    code: '4782-2/01',
    name: 'Comércio varejista de calçados',
    anexo: 'I',
    icon: '👟',
    aliases: ['calcados', 'sapato', 'tenis', 'sandalia', 'sapataria', 'loja sapato', 'arezzo', 'havaianas'],
  },
  {
    code: '4782-2/02',
    name: 'Comércio varejista de artigos de viagem',
    anexo: 'I',
    icon: '🎒',
    aliases: ['mochila', 'mala', 'bolsa', 'viagem', 'samsonite', 'acessorio'],
  },
  {
    code: '4755-5/01',
    name: 'Comércio varejista de tecidos',
    anexo: 'I',
    icon: '🧵',
    aliases: ['tecido', 'tecidos', 'pano', 'aviamento', 'malha', 'algodao'],
  },
  {
    code: '4755-5/02',
    name: 'Comércio varejista de artigos de armarinho',
    anexo: 'I',
    icon: '🪡',
    aliases: ['armarinho', 'aviamento', 'botao', 'linha', 'agulha', 'costura'],
  },
  {
    code: '4789-0/01',
    name: 'Comércio varejista de artigos esportivos',
    anexo: 'I',
    icon: '⚽',
    aliases: ['loja esportiva', 'esportivos', 'artigo esportivo', 'futebol', 'centauro', 'decathlon', 'netshoes'],
  },
]

export const EXPERTISE_COMERCIO_ROUPA: ExpertiseRamo = {
  ramo: 'COMERCIO_ROUPA',
  cnaes: CNAES_COMERCIO_ROUPA,
  anexoPreferido: 'ANEXO_I',
  aliquotaInicial: 4.0,
  aliquotaMaxima: 19.0,

  beneficios: [
    {
      tipo: 'ICMS_ST_VESTUARIO',
      descricao: 'ICMS Substituição Tributária Vestuário',
      detalhes:
        'SP, RJ, MG, RS, PR e outros estados aplicam ICMS-ST em vestuário. O ICMS já foi recolhido pelo fabricante/atacadista, não precisa pagar de novo na venda final. No Simples Nacional, segregar essa receita evita pagar ICMS duas vezes.',
      aplicaA: ['Roupas', 'Acessórios', 'Calçados (em alguns estados)'],
      economiaPotencial: '12–18% sobre vendas (depende do estado)',
      comoAproveitar: [
        'Conferir convênio ICMS vigente no estado',
        'Solicitar nota de compra com destaque do ICMS-ST',
        'Segregar receita de produtos com ST no PGDAS-D',
      ],
    },
    {
      tipo: 'DIFAL_OTIMIZACAO',
      descricao: 'DIFAL — Diferencial de Alíquota (compras interestaduais)',
      detalhes:
        'Compras de fornecedor em outro estado pagam DIFAL = (alíq. interna − alíq. interestadual) × valor. Não-contribuinte do ICMS (Simples) recolhe DIFAL na entrada. Negociar com fornecedor pra incluir no preço evita surpresa de caixa.',
      economiaPotencial: 'Variável — evita autuação por não-pagamento',
      comoAproveitar: [
        'Priorizar fornecedores do mesmo estado',
        'Negociar preço com DIFAL embutido (CIF)',
        'Aproveitar incentivos da ZFM (Zona Franca de Manaus) quando aplicável',
      ],
    },
    {
      tipo: 'NCM_CORRETO',
      descricao: 'NCM correto por produto',
      detalhes:
        'Cada item tem NCM específico. Alíquotas e regimes (ST, IPI, PIS/COFINS) variam por NCM. NCM errado = pode pagar imposto a mais ou autuação por subfaturamento.',
      aplicaA: [
        '6203 — Vestuário masculino',
        '6204 — Vestuário feminino',
        '6403 — Calçados de couro',
        '6402 — Calçados de borracha/plástico',
      ],
      economiaPotencial: 'Até 8% de tributação evitada',
    },
    {
      tipo: 'REFORMA_TRIBUTARIA_NAO_CUMULATIVA',
      descricao: 'Reforma 2026: CBS + IBS não-cumulativos',
      detalhes:
        'EC 132/2023 substitui PIS/COFINS por CBS e ICMS/ISS por IBS. Comércio é beneficiado pela não-cumulatividade plena — créditos amplos sobre tudo que entra (mercadoria, energia, aluguel, marketing).',
      economiaPotencial: '20–30% de redução de cumulatividade',
      validade: 'Transição 2026–2033',
    },
    {
      tipo: 'SAZONALIDADE',
      descricao: 'Otimização Black Friday / Liquidações',
      detalhes:
        'Concentração de receita em poucos meses (Natal, Dia das Mães, Black Friday) puxa alíquota Simples pra cima por causa do RBA acumulado. Provisão e distribuição de receita uniformiza tributação.',
      economiaPotencial: 'Variável — evita salto de faixa de alíquota',
    },
  ],

  particularidades: [
    'Renner / Riachuelo / C&A: modelo Lucro Real + crédito de tudo',
    'Pequenas lojas: Simples Nacional Anexo I (até R$ 4,8M/ano)',
    'MEI: limite R$ 81k/ano = inviável pra loja física',
    'NCM correto define alíquota — auditar TIPI ao cadastrar produto',
    'Sazonalidade forte: Black Friday, Natal, Volta às Aulas, Dia das Mães',
    'Devoluções obrigam ajuste de base de ICMS no mês seguinte',
  ],

  errosComuns: [
    'Pagar ICMS de mercadoria com ST (já recolhido na origem)',
    'Não aproveitar créditos no Lucro Real (energia, aluguel, frete)',
    'NCM errado = alíquota errada (a mais OU a menos)',
    'CNAE genérico sem segregar tipos de produto (vestuário × esportivo)',
    'Não calcular DIFAL nas compras interestaduais',
    'Esquecer de provisionar caixa para pico Black Friday/Natal',
  ],

  redesGrandes: {
    renner: {
      regime: 'Lucro Real',
      estrategia: 'Crédito PIS/COFINS não-cumulativo + ICMS de matéria-prima e logística',
    },
    riachuelo: {
      regime: 'Lucro Real',
      estrategia: 'Crédito de embalagens, marketing e energia (operações próprias)',
    },
    cea: {
      regime: 'Lucro Real',
      estrategia: 'Importação direta = ICMS de importação como crédito + redução do COFINS-Importação',
    },
  },
}
