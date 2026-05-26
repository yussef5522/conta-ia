/**
 * PIS/COFINS NÃO-CUMULATIVO - CRÉDITOS DETALHADOS
 * Lei 10.637/2002 + Lei 10.833/2003 + IN RFB 2.121/2022.
 *
 * Versão: 2026
 */

export const PIS_COFINS_CREDITOS_KB = {
  conceito: `Regime NÃO-CUMULATIVO PIS/COFINS (Lucro Real):
- PIS 1.65% + COFINS 7.6% = 9.25% sobre RECEITA
- Permite CRÉDITOS sobre INSUMOS e BENS adquiridos
- Crédito = compra × 9.25% (deduz do débito)

Diferente do regime CUMULATIVO (Lucro Presumido):
- PIS 0.65% + COFINS 3% = 3.65% sobre RECEITA
- SEM créditos`,

  conceito_insumo: {
    definicao: 'IN RFB 1.911/2019 + RE 1.221.170 STF (2018)',
    criterio_essencialidade: `STF decidiu (Recurso Extraordinário 1.221.170):
Insumo = bem ou serviço ESSENCIAL ou RELEVANTE para a atividade.
ESSENCIAL: sem ele a atividade não acontece
RELEVANTE: contribui materialmente para a atividade
Critério amplo - favorece o contribuinte.`,
  },

  itens_com_credito: {
    bens_para_revenda: { baseLegal: 'Lei 10.637/2002 art. 3º, I', exemplo: 'Loja roupa compra mercadoria pra revender', credito: '9.25% sobre valor compra (excluindo ICMS-ST)' },
    insumos_producao: {
      baseLegal: 'Lei 10.637/2002 art. 3º, II',
      exemplos: ['Matéria-prima (restaurante: carnes, alimentos)', 'Materiais embalagem', 'Combustíveis produção', 'Lubrificantes'],
    },
    energia_eletrica: { baseLegal: 'Lei 10.637/2002 art. 3º, III', observacao: 'Crédito INTEGRAL pra qualquer atividade' },
    alugueis_pj: { baseLegal: 'Lei 10.833/2003 art. 3º, IV', observacao: 'Aluguel IMÓVEL ou MÁQUINA pago a PJ. PF NÃO gera crédito.' },
    frete: {
      compras: 'Frete COMPRAS - crédito (Lei 10.833/2003 art. 3º, IX)',
      vendas: 'Frete VENDAS - controvertido. STJ tem permitido (Tema 756).',
    },
    bens_ativo_imobilizado: {
      baseLegal: 'Lei 10.637/2002 art. 3º, VI',
      observacao: 'Crédito sobre DEPRECIAÇÃO mensal (não valor total)',
      exemplo: 'Equipamento R$ 50k, depreciação 10 anos = R$ 416/mês. Crédito = R$ 416 × 9.25% = R$ 38/mês',
    },
    armazenagem: { baseLegal: 'Lei 10.833/2003 art. 3º, IX', observacao: 'Armazenagem - crédito' },
    despesas_financeiras: { observacao: 'NÃO geram crédito (Lei 10.865/2004 art. 32)' },
    vale_transporte: { baseLegal: 'Lei 11.196/2005 art. 30', observacao: 'ÚNICO item de folha que gera crédito' },
  },

  itens_sem_credito: [
    'Folha pagamento (exceto vale-transporte)',
    'Pró-labore',
    'INSS, FGTS sobre folha',
    'Material escritório (administrativo)',
    'Marketing/propaganda (geralmente)',
    'Comissões/honorários a PF',
    'Aluguel pago a PF',
    'Multas/juros',
    'Taxas cartão',
    'Despesas financeiras',
  ],

  estrategia_maximizar_creditos: `1. CATEGORIZAR FORNECEDORES: PJ vs PF (PF não gera crédito), atividade do fornecedor
2. NEGOCIAR FORNECEDORES: pedir NF-e correta, fornecedor PF? Buscar PJ
3. ALUGUEL: sempre PJ se possível
4. ENERGIA: crédito integral - sempre aproveitar
5. EMBALAGENS: considerar TODAS (sacola, etiqueta, papel presente)
6. APROVEITAMENTO CRÉDITOS NÃO USADOS: saldo credor → PER/DCOMP ou compensar outros tributos federais. Prazo 5 anos.`,

  exemplo_pratico_restaurante: `Restaurante R$ 200k receita/mês Lucro Real:
DÉBITO: R$ 200k × 9.25% = R$ 18.500
CRÉDITOS DETALHADOS:
- Carnes/insumos: R$ 60k × 9.25% = R$ 5.550
- Embalagens delivery: R$ 8k × 9.25% = R$ 740
- Energia elétrica: R$ 6k × 9.25% = R$ 555
- Aluguel imóvel (PJ): R$ 10k × 9.25% = R$ 925
- Gás cozinha: R$ 2k × 9.25% = R$ 185
- Frete compras: R$ 1.5k × 9.25% = R$ 138
- Material limpeza: R$ 1k × 9.25% = R$ 92
- Depreciação equipamentos: R$ 500 × 9.25% = R$ 46
TOTAL: R$ 8.231/mês
PIS/COFINS LÍQUIDO: R$ 10.269/mês
ECONOMIA via créditos: R$ 98.772/ano`,

  jurisprudencia_relevante: {
    re_1221170_STF: { decisao: 'Insumo é ESSENCIAL ou RELEVANTE para a atividade', ano: '2018', impacto: 'Ampliou conceito de insumo' },
    tema_756_STJ: { decisao: 'Frete de venda gera crédito PIS/COFINS', ano: '2023' },
  },
} as const
