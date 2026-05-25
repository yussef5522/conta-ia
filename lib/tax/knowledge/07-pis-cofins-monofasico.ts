// Sprint 5.0.2.c — Knowledge Base: PIS/COFINS Monofásico

export const PIS_COFINS_MONOFASICO = {
  versao: '2026',

  conceito: {
    oQueE:
      'Sistemática em que a tributação de PIS e COFINS é concentrada no produtor/importador, com alíquotas mais altas. Demais elos da cadeia ficam com alíquota zero ou reduzida.',
    objetivo: 'Concentrar a fiscalização e reduzir sonegação',
    impactoVarejo:
      'Comércio que revende produtos monofásicos paga PIS/COFINS sob alíquota zero (em algumas hipóteses) ou se mantém em sistemática cumulativa específica',
    impactoSimples: 'Receita de produto monofásico NÃO entra na base do Simples (segregar)',
  },

  // === PRODUTOS MONOFÁSICOS ===
  produtos: {
    combustiveis: {
      baseLegal: 'Lei 9.718/1998 + Lei 9.990/2000',
      itens: ['Gasolina', 'Diesel', 'GNV', 'Querosene de aviação', 'Álcool combustível'],
      aliquotaPISCOFINS: 'Específicas (R$/m³ ou %)',
      cadeia: 'Refinaria/distribuidora recolhe; postos têm alíquota zero',
    },

    bebidas: {
      baseLegal: 'Lei 10.147/2000 + Lei 10.485/2002 + Lei 11.727/2008',
      itens: ['Cervejas', 'Refrigerantes', 'Águas', 'Refrescos', 'Outras bebidas frias'],
      aliquotaFabricante: 'PIS 2,5% + COFINS 11,9% (Anexo I Lei 10.147)',
      cadeia: 'Fabricante recolhe; atacado e varejo têm alíquota zero',
    },

    medicamentos: {
      baseLegal: 'Lei 10.147/2000',
      itens: ['Medicamentos de uso humano (lista PMVG ANVISA)'],
      aliquotaIndustria: 'PIS 2,1% + COFINS 9,9%',
      cadeia: 'Indústria/importador recolhe; farmácia tem alíquota zero',
      excecaoMedicamentos: 'Medicamentos isentos não monofásicos seguem regra geral',
    },

    cosmeticos: {
      baseLegal: 'Lei 10.147/2000',
      itens: ['Perfumaria, cosméticos, higiene pessoal (lista TIPI específica)'],
      aliquotaIndustria: 'PIS 2,2% + COFINS 10,3%',
      cadeia: 'Indústria/importador recolhe; varejo alíquota zero',
    },

    autopecas: {
      baseLegal: 'Lei 10.485/2002',
      itens: ['Pneus, câmaras de ar, autopeças listadas'],
      aliquotaIndustria: 'PIS 1,65% + COFINS 7,6% (não-cumulativo padrão na origem)',
      cadeia: 'Fabricante recolhe; revendedor varejista tem alíquota zero',
    },

    veiculos: {
      baseLegal: 'Lei 10.485/2002',
      itens: ['Veículos automotores listados', 'Máquinas agrícolas'],
      aliquotaIndustria: 'PIS 2% + COFINS 9,6%',
      cadeia: 'Montadora recolhe; concessionária tem alíquota zero',
    },

    cervejasArtesanais: {
      baseLegal: 'Lei 14.341/2022 (regime cervejarias artesanais)',
      itens: ['Cervejas de microcervejarias específicas'],
      observacao: 'Regime tributário específico, menos oneroso',
    },
  },

  // === COMO IDENTIFICAR ===
  comoIdentificar: [
    'Nota fiscal do fornecedor com CFOP específico (5.401, 5.403, etc) ou observação "Tributação monofásica"',
    'Código NCM do produto consta na lista das leis citadas',
    'Campo de PIS/COFINS na nota com alíquota = 0',
    'Consultar tabela de NCM monofásico (Receita Federal publica)',
  ],

  // === COMO EXCLUIR DA BASE DO SIMPLES ===
  exclusaoSimples: {
    fundamento: 'Resolução CGSN 140/2018 art. 25',
    procedimento: [
      '1. Identificar produtos monofásicos (NCM + nota fiscal)',
      '2. Segregar a receita de venda desses produtos no PGDAS-D',
      '3. Sistema desconta a parcela PIS/COFINS do DAS (3,65% no cumulativo)',
      '4. Manter documentos comprobatórios (notas fiscais de compra)',
    ],
    economia: '~3,65% sobre vendas monofásicas',
  },

  // === COMO TRATAR NO LUCRO PRESUMIDO ===
  tratamentoLucroPresumido: {
    explicacao: 'Receita de revenda monofásica fica fora da base PIS/COFINS',
    fundamentacao: 'IN RFB 247/2002 art. 30',
    procedimento: 'Reduzir da base de cálculo do PIS/COFINS cumulativo',
  },

  // === COMO TRATAR NO LUCRO REAL ===
  tratamentoLucroReal: {
    explicacao: 'Receita também fora da base PIS/COFINS não-cumulativo (alíquota zero)',
    creditos: 'Empresa NÃO tem crédito sobre essa compra (Lei 10.637 art. 3º §3º)',
  },

  // === DIFERENÇA ENTRE MONOFÁSICO E ST ===
  diferencaParaSubstituicaoTributaria: {
    monofasico: 'PIS/COFINS — federal — concentra no produtor',
    substituicaoTributaria: 'ICMS — estadual — concentra no atacadista/fabricante',
    coexistencia:
      'Um mesmo produto pode ter ST de ICMS + monofásico de PIS/COFINS (cervejas, combustíveis, autopeças)',
    importante:
      'Ao segregar no PGDAS-D, verificar AMBOS — produto pode estar fora da base de ICMS E de PIS/COFINS',
  },

  // === REFORMA TRIBUTÁRIA E MONOFÁSICO ===
  reformaImpacto: {
    extincaoPISCOFINS: 'PIS e COFINS extintos em 2027 (substituídos por CBS não-cumulativa plena)',
    mecanismoSubstituto:
      'CBS terá não-cumulatividade ampla — não há previsão de regime monofásico para a maior parte dos produtos',
    impostoSeletivo:
      'Combustíveis, bebidas alcoólicas, cigarros passam a ter Imposto Seletivo federal (sucessor parcial do IPI seletivo)',
    transicao: 'Empresas com estoque monofásico em 31/12/2026 — regras transitórias na LC 214/2025',
  },
} as const

export type PISCofinsMonofasicoKnowledge = typeof PIS_COFINS_MONOFASICO
