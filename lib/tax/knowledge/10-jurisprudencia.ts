// Sprint 5.0.2.c — Knowledge Base: Jurisprudência Tributária Relevante

export const JURISPRUDENCIA = {
  versao: '2026',

  // === STF (Supremo Tribunal Federal) ===
  stf: [
    {
      tema: 'Tema 69 - ICMS na base do PIS/COFINS',
      processo: 'RE 574.706',
      decisao: 'ICMS destacado em nota fiscal NÃO compõe a base de cálculo do PIS e da COFINS',
      data: 'Trânsito em julgado 2017; modulação 2021',
      modulacao: 'Efeitos a partir de 15/03/2017 (data do julgamento de mérito)',
      impacto:
        'Empresas no Lucro Real podem recuperar PIS/COFINS pagos a maior nos últimos 5 anos sobre a parcela ICMS',
      acoesPossiveis: ['Mandado de Segurança individual', 'Restituição via PER/DCOMP'],
    },
    {
      tema: 'Tema 745 - ICMS-ST e base de PIS/COFINS',
      processo: 'RE 1.258.842',
      decisao:
        'ICMS recolhido por substituição tributária também NÃO compõe a base do PIS/COFINS (extensão do Tema 69)',
      observacao: 'Aplicável a substituídos',
    },
    {
      tema: 'Tema 201 - Restituição de ICMS-ST quando preço final < BC presumida',
      processo: 'RE 593.849',
      decisao: 'Contribuinte tem direito à restituição quando o preço de venda é inferior à base presumida do ICMS-ST',
      data: '2016',
      impacto: 'Empresas podem pleitear restituição administrativa',
    },
    {
      tema: 'Tema 277 - Imunidade tributária do papel destinado a livros',
      processo: 'RE 330.817',
      decisao: 'Imunidade do art. 150 VI d CF alcança e-books e e-readers',
    },
    {
      tema: 'Tema 985 - Contribuição previdenciária sobre o terço constitucional de férias',
      processo: 'RE 1.072.485',
      decisao: 'Incide contribuição previdenciária patronal sobre o terço constitucional de férias',
      data: '2020',
      impacto: 'Empresas que excluíam essa parcela podem ser autuadas',
    },
  ],

  // === STJ (Superior Tribunal de Justiça) ===
  stj: [
    {
      tema: 'Tema 1182 - Crédito presumido de ICMS na base de IRPJ/CSLL',
      processo: 'REsp 1.945.110',
      decisao:
        'Créditos presumidos de ICMS não compõem a base de cálculo do IRPJ e da CSLL, sendo subvenção para investimento',
      data: '2023',
      impacto:
        'Permite que indústrias beneficiárias de incentivos estaduais reduzam IRPJ/CSLL no Lucro Real',
    },
    {
      tema: 'Tema 1125 - Inclusão de ICMS-ST na base de PIS/COFINS por substituto',
      processo: 'REsp 1.896.678',
      decisao: 'STJ aplica entendimento do STF — ICMS-ST não compõe base de PIS/COFINS',
    },
    {
      tema: 'Súmula 584 STJ - Multa moratória x denúncia espontânea',
      decisao:
        'Confissão de débito de tributo ainda não vencido configura denúncia espontânea, afastando multa',
    },
    {
      tema: 'Súmula 555 STJ - Compensação tributária',
      decisao:
        'Empresa pode compensar tributos administrados pela RFB com créditos vencidos ou vincendos',
    },
    {
      tema: 'Tema 690 - ISS sobre franquia (franchising)',
      processo: 'REsp 1.131.872',
      decisao: 'Incide ISS sobre operação de franquia (contrato de franchising)',
    },
  ],

  // === CARF (Conselho Administrativo de Recursos Fiscais) ===
  carf: [
    {
      tema: 'Pejotização irregular de funcionários',
      posicao:
        'CARF tem decisões variadas — quando há subordinação, habitualidade e pessoalidade, descaracteriza PJ e reclassifica como CLT',
      consequencia: 'Cobrança de INSS patronal + multa, normalmente em fiscalização',
      atencao: 'Especialmente comum em consultorias e TI',
    },
    {
      tema: 'Glosa de despesas com PIS/COFINS não-cumulativo',
      posicao:
        'CARF restringe créditos a insumos diretamente vinculados à produção/comercialização. Despesas administrativas geralmente não geram crédito',
    },
    {
      tema: 'Distribuição de lucros sem balanço',
      posicao:
        'CARF reclassifica como pró-labore (sujeito a INSS) quando empresa não tem escrituração contábil regular',
    },
    {
      tema: 'Ágio em reorganizações societárias',
      posicao: 'CARF tem questionado planejamentos tributários que envolvem ágio interno',
    },
  ],

  // === SOLUÇÕES DE CONSULTA RFB ===
  solucoesConsulta: [
    {
      numero: 'SC COSIT 7/2021',
      tema: 'Aproveitamento de crédito de PIS/COFINS sobre subcontratação',
      decisao: 'Possível em determinadas hipóteses de prestação de serviços',
    },
    {
      numero: 'SC COSIT 99.001/2024',
      tema: 'Imposto Seletivo na Reforma Tributária',
      tema_decisao: 'Esclarece aplicação a bens prejudiciais à saúde/ambiente',
    },
    {
      numero: 'SC COSIT 56/2020',
      tema: 'PERSE — alcance da alíquota zero',
      decisao: 'Esclarece quais receitas estão abrangidas',
    },
  ],

  // === REFORMA TRIBUTÁRIA — DECISÕES INICIAIS ===
  reformaTributariaJurisprudencia: {
    statusAtual: '2026 — fase de regulamentação, sem decisões judiciais relevantes ainda',
    expectativa:
      'STF deve apreciar limites da LC 214/2025 nos primeiros anos. Focos esperados: cesta básica, redução para serviços de saúde, mecânica do split payment',
  },

  // === ORIENTAÇÕES PRÁTICAS ===
  orientacoesPraticas: {
    importanciaJurisprudencia:
      'Decisões vinculantes do STF/STJ alteram a aplicação da lei — sempre consultar antes de planejamento tributário',
    cuidadoTesesAgressivas:
      'Teses agressivas podem ser revertidas, gerando autuação retroativa. Conservadorismo é virtude',
    documentacao:
      'Sempre fundamentar planejamentos em tese sólida (lei + jurisprudência) e documentar internamente',
    consultaContador:
      'Decisões judiciais são complexas; consultar contador/advogado antes de aplicar entendimentos',
  },
} as const

export type JurisprudenciaKnowledge = typeof JURISPRUDENCIA
