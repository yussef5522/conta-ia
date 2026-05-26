/**
 * BENCHMARK CONSOLIDADO - GRANDES REDES BR
 * Estratégias tributárias reais por setor.
 *
 * Versão: 2026
 */

export const GRANDES_REDES_KB = {
  restaurantes: {
    mcdonalds: {
      regime: 'Lucro Real',
      faturamento_anual: '~R$ 4 bilhões',
      total_unidades: '~1.000 (700+ franquias)',
      estrategias: [
        'NF discriminada item por item (combo segregado)',
        'Bebidas ICMS-ST + monofásico = ZERO no varejo',
        'Créditos PIS/COFINS sobre embalagens (caixas, sacolas, bandejas)',
        'Crédito energia (alto consumo - fritadeiras, ar)',
        'Crédito frete sobre compras (logística centralizada)',
        'Royalties pra Mc Brasil = despesa dedutível',
        'Holding Arcos Dorados (matriz LatAm)',
        'Marca registrada Caymans (royalties offshore)',
      ],
      economia_estimada: '~30% redução tributária via planejamento vs sem',
    },
    burgerking: {
      regime: 'Lucro Real',
      controladora: 'Zamp S.A. (BKBR3 - B3)',
      faturamento_anual: '~R$ 1.8 bilhões',
      estrategias: [
        'Mesma estratégia combo segregado',
        'Plant-based NCM diferenciado',
        'PERSE aplicado em parte das unidades',
        'Aproveitamento bonificações Coca-Cola/Pepsi',
        'Marketing dedutível pesado',
        'IPO 2021 - reestruturação tributária',
      ],
    },
    madero: {
      regime: 'Lucro Real (pós-IPO 2024)',
      faturamento_anual: '~R$ 1.2 bilhões',
      total_unidades: '~250',
      estrategias: [
        'PERSE integral até fev/2027 (PIS+COFINS zero)',
        'Importação direta Angus = créditos PIS/COFINS importação',
        'Importação direta equipamentos',
        'Royalties intra-grupo (marca Madero)',
        'Aproveitamento ICMS-ST bebidas (Heineken parceira)',
        'Holding Junior Durski controladora',
      ],
      economia_perse: 'R$ 30M/ano enquanto PERSE vigente',
    },
    outback: {
      regime: 'Lucro Real',
      controladora: 'Bloomin Brands (US-based)',
      estrategias: [
        'Importação Angus + cervejas premium = créditos PIS/COFINS importação',
        'PERSE até fev/2027 (PIS+COFINS)',
        'Royalties matriz americana (Tratado Brasil-EUA)',
        'Pagamentos marca Bloomin Brands = despesa dedutível',
        'Hedge cambial dedutível',
        'Cervejaria própria parceira',
      ],
    },
    girafas: {
      regime: 'Simples Nacional (maioria)',
      estrategias: ['Cada unidade CNPJ separado', 'Faturamento < R$ 4.8M', 'Anexo I LC 192/2022 (4-19%)', 'Royalties despesa franqueado'],
    },
    subway: {
      regime: 'Simples Nacional (franquias pequenas)',
      modelo: 'Franquia internacional - cada CNPJ independente',
      estrategias: ['Anexo I LC 192/2022', 'Royalties Subway Brasil', 'Compras centralizadas comissaria'],
    },
  },

  academias: {
    smartfit: {
      ticker: 'SMFT3 (B3)',
      regime: 'Cada unidade Presumido ou Real',
      faturamento_anual: '~R$ 4 bilhões consolidado',
      unidades: '~1.500 (Brasil + LatAm)',
      estrategias: [
        'Estrutura HOLDING Bio Ritmo + unidades individuais',
        'Cada academia CNPJ separado',
        'Royalties 5% + Marketing 4.5% = 9.5% à matriz',
        'Folha CLT alta = Fator R alto',
        'Compras equipamento em volume',
        'Holding offshore (Caymans) pré-IPO',
        'Aproveitamento prejuízos consolidados',
      ],
      economia_estimada: '5-8 p.p. alíquota efetiva vs concorrente',
    },
    bodytech: {
      regime: 'Premium - Lucro Real',
      faturamento_anual: '~R$ 800 milhões',
      unidades: '~150',
      estrategias: [
        'Personal trainers CLT alta qualificação (Fator R alto)',
        'App BTFIT PJ separada (tecnologia)',
        'Segregação academia/loja/nutricionista',
        'PERSE parcial (yoga/dança elegível)',
        'Nutricionistas uniprofissional (ISS fixo)',
      ],
    },
    bluefit: {
      regime: 'Cada unidade Presumido',
      controladora: 'Fundo Pátria (2024)',
      modelo: 'Low cost (similar Smart Fit)',
      estrategias: ['Royalties pra controladora', 'Cada unidade CNPJ', 'Folha menor que Bodytech'],
    },
    allpfit: {
      modelo: 'Franquia 24h (auto-serviço)',
      desafio: 'Folha BAIXA → Fator R difícil',
      estrategias: ['Pró-labore alto franqueado', 'Considerar Lucro Presumido', 'Aluguel sala personal = receita extra'],
    },
    competex_crossfit: {
      modelo: 'CrossFit boxes pequenas',
      cnae: '9313-1/00 ou 8591-1/00',
      estrategias: ['Simples Anexo III com Fator R alto (CLT)', 'Possível PERSE se CNAE 8591 (ensino esporte)'],
    },
  },

  comercio_roupa: {
    renner: {
      ticker: 'LREN3',
      regime: 'Lucro Real',
      faturamento_anual: '~R$ 14 bilhões',
      unidades: '~600 lojas',
      estrategias: [
        'Créditos PIS/COFINS sobre estoque massivo (~R$ 1bi/ano)',
        'Importação direta + hedge cambial dedutível',
        'Realize Soluções Financeiras (cartão Renner) - PJ separada',
        'Marketing intenso = despesa dedutível',
        'Centro distribuição próprio (logística + créditos)',
        'Marca própria + licenciadas (Bangladesh/China)',
      ],
      economia_estimada: '3-5 p.p. via planejamento',
    },
    riachuelo_guararapes: {
      ticker: 'GUAR3 / RIAA3',
      regime: 'Lucro Real',
      faturamento_anual: '~R$ 9 bilhões',
      estrategias: [
        'INTEGRAÇÃO VERTICAL (Guararapes indústria + Riachuelo varejo)',
        'Preço transferência intra-grupo otimizado',
        'Midway Financeira (cartão Riachuelo)',
        'Centro logístico Manga/RN (SUDENE - Nordeste)',
        'Marcas próprias (Pool, AKWA, MOB)',
      ],
    },
    cea: {
      ticker: 'CEAB3',
      regime: 'Lucro Real',
      controladora: 'C&A Holanda',
      estrategias: [
        'Royalties matriz holandesa (Tratado Brasil-Holanda)',
        'Importação intensiva Ásia + Drawback',
        'Fundos de investimento (caixa)',
        'Negociação ICMS estados (incentivos)',
        'E-commerce DIFAL otimizado',
      ],
    },
    marisa: {
      ticker: 'AMAR3',
      regime: 'Lucro Real',
      situacao: 'Crise financeira recente',
      estrategias: ['Aproveitamento de prejuízos fiscais', 'Foco consumidor C/D (impacto cashback Reforma)'],
    },
    pernambucanas: {
      regime: 'Lucro Real',
      estrategias: ['Cartão Pernambucanas (Mais Crédito)', 'Receita financeira PJ separada', 'Centenário - estrutura societária consolidada'],
    },
  },
} as const
