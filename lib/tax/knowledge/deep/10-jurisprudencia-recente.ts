/**
 * JURISPRUDÊNCIA TRIBUTÁRIA RECENTE
 * STF, STJ, CARF, Soluções de Consulta Receita Federal.
 *
 * Versão: 2026
 */

export const JURISPRUDENCIA_DEEP_KB = {
  stf: {
    re_574706: {
      titulo: 'Exclusão ICMS da base PIS/COFINS',
      ano: '2017 (decisão) + 2021 (modulação)',
      principal: 'ICMS NÃO compõe base PIS/COFINS',
      impacto: 'Empresas Lucro Real podem recuperar valores pagos a maior (últimos 5 anos)',
      tese: 'Tema 69 - definitivo',
      como_aproveitar: 'PER/DCOMP para recuperar valores pagos indevidamente desde 2017',
    },
    re_1187264: {
      titulo: 'Exclusão ISS da base PIS/COFINS',
      ano: '2024',
      principal: 'ISS NÃO compõe base PIS/COFINS',
      impacto: 'Prestadores de serviço Lucro Real podem recuperar',
      tese: 'Tema 1067',
    },
    re_1221170: {
      titulo: 'Conceito de Insumo PIS/COFINS',
      ano: '2018',
      principal: 'Insumo = essencial OU relevante para a atividade',
      impacto: 'Amplia direito a créditos PIS/COFINS no Lucro Real',
    },
    adi_5469: {
      titulo: 'DIFAL e Convênio CONFAZ',
      ano: '2021',
      principal: 'DIFAL precisa de Lei Complementar (não basta Convênio)',
      impacto: 'LC 190/2022 supriu - aplicação a partir de 2022',
    },
  },

  stj: {
    tema_756: {
      titulo: 'Frete de venda gera crédito PIS/COFINS',
      ano: '2023',
      principal: 'Frete de venda integra cadeia produtiva - gera crédito',
      impacto: 'Empresas podem creditar PIS/COFINS sobre frete venda',
    },
    tema_1093: {
      titulo: 'PIS/COFINS sobre receita financeira',
      ano: '2024',
      principal: 'Receitas financeiras genéricas não compõem base PIS/COFINS no Lucro Presumido',
      impacto: 'Empresas Lucro Presumido recuperam PIS/COFINS sobre rendimentos financeiros',
    },
  },

  carf: {
    fator_r_calculo: {
      tema: 'Composição da Folha para Fator R',
      principais_decisoes: [
        'Pró-labore conta integralmente',
        'PLR conta SE tiver regulamento formal',
        'Vale-transporte conta',
        'INSS patronal e FGTS contam',
        'Distribuição de lucros NÃO conta',
      ],
    },
    perse_cadastur: { tema: 'PERSE e Cadastur', principal: 'CARF tem mantido exigência de Cadastur quando previsto' },
    icms_st_credito: { tema: 'Créditos sobre ICMS-ST', principal: 'ICMS-ST destacado na NF pode gerar crédito em algumas hipóteses' },
  },

  receita_federal_solucoes_consulta: {
    cosit_89_2024: {
      tema: 'PERSE - vigência e CNAEs',
      principais: [
        'Vigente até fev/2027 para PIS/COFINS',
        'IRPJ/CSLL para Lucro Real voltou em 2025',
        'CNAE elegível em 18/03/2022 obrigatório',
        'Cadastur quando aplicável',
      ],
    },
    cosit_215_2023: { tema: 'PERSE - mudança de CNAE', principal: 'CNAE alterado após 18/03/2022 NÃO retroage' },
    cosit_76_2013: { tema: 'Créditos PIS/COFINS - material de limpeza', principal: 'Material de limpeza essencial à atividade GERA CRÉDITO' },
    cosit_183_2019: { tema: 'Lucro Real - depreciação acelerada', principal: 'Decreto-Lei 1.598/77 - permitida em casos específicos' },
    cosit_67_2025: { tema: 'Reforma tributária - regimes transitórios', principal: 'Empresas devem se adaptar gradualmente 2026-2033' },
  },

  tese_filhotes_574706: {
    titulo: 'Teses derivadas da exclusão ICMS da base PIS/COFINS',
    teses_aplicaveis: [
      'Exclusão ISS da base PIS/COFINS (Tema 1067 - decidido 2024)',
      'Exclusão ICMS da base IRPJ/CSLL (em julgamento)',
      'Exclusão PIS/COFINS da própria base PIS/COFINS (controvertido)',
      'Exclusão tributos do faturamento no Lucro Presumido (parcialmente decidido)',
    ],
    estrategia_recuperacao: `Empresas Lucro Real (PIS/COFINS não-cumulativo):
1. Levantar valores pagos últimos 5 anos
2. Calcular ICMS excluído (Tema 69 STF)
3. Calcular ISS excluído se aplicável (Tema 1067)
4. Compensar via PER/DCOMP ou pedir restituição

Empresas Lucro Presumido (cumulativo):
1. Tema 1093 STJ - receitas financeiras
2. Avaliar restituição valores pagos a maior`,
  },

  legislacao_recente_2025_2026: {
    lei_15030_2024: 'Mudanças Lucro Real (subvenções para investimento)',
    lc_214_2025: 'Regulamentação Reforma Tributária',
    lei_14973_2024: 'Desoneração folha pagamento (alguns setores)',
    lei_14859_2024: 'PERSE estendido até fev/2027',
    in_rfb_2121_2022: 'PIS/COFINS - regulamentação atualizada',
  },

  estrategia_aproveitamento_jurisprudencia: `PARA O CLIENTE:

1. LEVANTAMENTO HISTÓRICO (últimos 5 anos):
   - Quanto pagou de PIS/COFINS
   - Quanto pagou de ICMS/ISS
   - Identificar valores incluídos indevidamente

2. CÁLCULO DAS TESES:
   - Tema 69: exclusão ICMS base PIS/COFINS
   - Tema 1067: exclusão ISS base PIS/COFINS
   - Tema 756: créditos sobre frete venda
   - Outros temas aplicáveis

3. RECUPERAÇÃO:
   - PER/DCOMP (compensação tributária)
   - Ou restituição administrativa
   - Ou ação judicial (se complexo)

4. ATUALIZAÇÃO:
   - SELIC desde data do pagamento indevido
   - Pode dobrar o valor recuperado

5. RISCO:
   - Receita Federal pode contestar
   - Documentação RIGOROSA é essencial
   - Acompanhamento contábil especializado`,
} as const
