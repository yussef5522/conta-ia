// Sprint 5.0.2.b — Expertise Restaurantes.
//
// Base: LC 192/2022 (Lei dos Restaurantes), LC 123/2006 (Simples Nacional),
// Lei 14.148/2021 (PERSE), Convênios CONFAZ ICMS ST bebidas, IN RFB 1.252
// (PIS/COFINS monofásico cervejas/refrigerantes).

import type { CNAEEntry, ExpertiseRamo } from './types'

export const CNAES_RESTAURANTES: CNAEEntry[] = [
  {
    code: '5611-2/01',
    name: 'Restaurantes e similares',
    anexo: 'I',
    icon: '🍽️',
    aliases: ['restaurante', 'comida', 'almoco', 'jantar', 'churrascaria', 'comercial', 'a la carte'],
  },
  {
    code: '5611-2/02',
    name: 'Restaurante self-service',
    anexo: 'I',
    icon: '🍱',
    aliases: ['self service', 'self-service', 'buffet', 'comida por quilo', 'quilao', 'kilo'],
  },
  {
    code: '5611-2/03',
    name: 'Lanchonetes, casas de chá e sucos',
    anexo: 'I',
    icon: '🥪',
    aliases: ['lanchonete', 'lanche', 'cafeteria', 'suco', 'cha', 'cafe', 'snack'],
  },
  {
    code: '5611-2/04',
    name: 'Bar com refeição',
    anexo: 'I',
    icon: '🍻',
    aliases: ['bar', 'boteco', 'pub', 'tira gosto', 'petisco', 'bar restaurante'],
  },
  {
    code: '5611-2/05',
    name: 'Bar sem refeição',
    anexo: 'I',
    icon: '🍺',
    aliases: ['bar', 'choperia', 'cervejaria', 'pub', 'happy hour'],
  },
  {
    code: '1091-1/02',
    name: 'Hamburgueria / Fast food',
    anexo: 'I',
    icon: '🍔',
    aliases: ['hamburgueria', 'fast food', 'hamburguer', 'burger', 'lanche americano', 'mcdonalds', 'burger king', 'subway'],
  },
  {
    code: '5620-1/01',
    name: 'Pizzaria delivery',
    anexo: 'I',
    icon: '🍕',
    aliases: ['pizzaria', 'pizza', 'delivery', 'tele pizza', 'tele-pizza', 'massa'],
  },
  {
    code: '5620-9/02',
    name: 'Padaria / Cafeteria',
    anexo: 'I',
    icon: '🥐',
    aliases: ['padaria', 'panificadora', 'cafeteria', 'confeitaria', 'paes', 'pao', 'doceria'],
  },
]

export const EXPERTISE_RESTAURANTES: ExpertiseRamo = {
  ramo: 'RESTAURANTE',
  cnaes: CNAES_RESTAURANTES,
  anexoPreferido: 'ANEXO_I',
  aliquotaInicial: 4.0,
  aliquotaMaxima: 19.0,

  beneficios: [
    {
      tipo: 'ICMS_ST',
      descricao: 'ICMS Substituição Tributária (bebidas)',
      detalhes:
        'Bebidas (refrigerantes, cervejas, vinhos, energéticos, água) já vêm com ICMS recolhido pelo fabricante. Excluir essas receitas da base de cálculo do Simples evita dupla tributação.',
      aplicaA: ['Bebidas alcoólicas', 'Refrigerantes', 'Energéticos', 'Águas minerais'],
      economiaPotencial: '5–12% sobre as vendas de bebidas',
      comoAproveitar: [
        'Segregar receita de bebidas no PDV',
        'Solicitar nota de fornecedor com destaque de ICMS-ST',
        'Excluir essa parcela do DAS via PGDAS-D segregação',
      ],
    },
    {
      tipo: 'PIS_COFINS_MONOFASICO',
      descricao: 'PIS/COFINS Monofásico (bebidas e café)',
      detalhes:
        'Cervejas, refrigerantes, água e café têm PIS/COFINS recolhidos pelo fabricante. No Simples Anexo I você pode excluir a parcela já tributada na origem.',
      aplicaA: ['Cervejas', 'Refrigerantes', 'Café', 'Água'],
      economiaPotencial: '3,65% sobre essas vendas',
    },
    {
      tipo: 'PROGRAMA_PERSE',
      descricao: 'PERSE — Programa Emergencial Eventos (Lei 14.148/2021)',
      detalhes:
        'Restaurantes, bares e casas de eventos com CNAE aderente podem ter alíquota ZERO de PIS, COFINS, IRPJ e CSLL. Beneficiário precisa ter CADASTUR ativo (quando aplicável) e estar no rol da Portaria ME 7.163/2021.',
      aplicaA: ['Eventos', 'Bares com show', 'Casas noturnas', 'Restaurantes turísticos'],
      economiaPotencial: 'Até 100% dos impostos federais (PIS/COFINS/IRPJ/CSLL)',
      validade: 'Até março/2027 (LC 195/2022 + extensões)',
    },
    {
      tipo: 'SEGREGACAO_SALAO_DELIVERY',
      descricao: 'Segregação salão × delivery × eventos',
      detalhes:
        'Manter receitas de salão, delivery e eventos em centros de custo distintos permite identificar canais com PIS/COFINS monofásico ou ICMS-ST e otimizar a base do Simples por canal.',
      aplicaA: ['Restaurantes híbridos (presencial + delivery)'],
      economiaPotencial: 'Até 15% de otimização sobre faturamento total',
    },
  ],

  fatorRAnalysis: {
    importancia: 'CRÍTICA',
    detalhes:
      'Restaurante NORMALMENTE fica no Anexo I (comércio), mas serviços de buffet, eventos e consultoria gastronômica caem no Anexo III/V. Com Fator R >= 28% (folha 12m / RBA 12m) vai pra Anexo III (6%–15,5%). Sem Fator R, Anexo V (15,5%–30%) — diferença de até 9,5 pontos.',
    economiaTipica: 'R$ 90.000/ano em restaurante com R$ 120k/mês de buffet/eventos',
    estrategias: [
      'Aumentar pró-labore dos sócios pra subir folha',
      'Contratar CLT no lugar de PJ/MEI dos garçons e cozinheiros',
      'Manter folha entre 28% e 32% do faturamento',
      'Não terceirizar funções operacionais (cozinha, salão)',
    ],
  },

  proLaboreOtimo: {
    formula: 'Pró-labore deve garantir Fator R >= 28% considerando demais salários',
    exemplo: 'Restaurante R$ 100k/mês: pró-labore R$ 8–12k pode jogar a operação pro Anexo III',
  },

  particularidades: [
    'Lei dos Restaurantes (LC 192/2022) garante Anexo I para serviço presencial',
    'NCM 21.01 (cafés) tem alíquota PIS/COFINS específica monofásica',
    'IPI sobre embalagens de delivery pode ser crédito no Lucro Real',
    'Reforma Tributária 2026: imposto seletivo sobre bebidas alcoólicas',
    'Programas estaduais de cashback ICMS em algumas UFs (RS, MG)',
  ],

  errosComuns: [
    'Não excluir ICMS-ST de bebidas da base de cálculo do Simples',
    'Usar CNAE genérico (5611-2/01) sem segregar lanchonete (5611-2/03)',
    'Não aderir ao PERSE quando o CNAE qualifica',
    'Ignorar Fator R em operações com buffet/eventos',
    'Misturar receita de salão e delivery sem segregar',
    'Pagar PIS/COFINS sobre cerveja/refrigerante (já é monofásico)',
  ],

  redesGrandes: {
    madero: {
      regime: 'Lucro Real',
      estrategia: 'Aproveita créditos PIS/COFINS sobre insumos, energia, embalagens e marketing',
    },
    outback: {
      regime: 'Lucro Real',
      estrategia: 'Importação direta (vinhos, carnes) = ICMS importação como crédito',
    },
    girafas: {
      regime: 'Lucro Presumido',
      estrategia: 'Franquias com faturamento abaixo do limite usam presunção 8% IRPJ',
    },
  },
}
