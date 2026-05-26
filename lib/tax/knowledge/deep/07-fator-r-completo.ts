/**
 * FATOR R - SIMPLES NACIONAL
 * LC 123/2006 art. 18 §§ 5º-J e 5º-M
 * Resolução CGSN 140/2018 art. 25.
 *
 * Versão: 2026
 */

export const FATOR_R_KB = {
  conceito: `Fator R: razão entre Folha de Pagamento e Receita Bruta (12 meses).
FATOR R >= 28% → Anexo III (alíquota INICIAL 6%)
FATOR R < 28% → Anexo V (alíquota INICIAL 15.5%)
Diferença pode chegar a 10 pontos percentuais.
Para academias, escritórios, clínicas: ENORME impacto.`,

  formula: {
    expressao: 'Fator R = Folha 12 meses / Receita Bruta 12 meses',
    elementos_folha: [
      'Salários CLT (valor bruto)',
      'Pró-labore dos sócios',
      'INSS patronal 20% (sobre folha)',
      'FGTS 8% (sobre folha)',
      '13º salário',
      'Férias + 1/3',
      'Adicional noturno, periculosidade, insalubridade',
      'Demais verbas trabalhistas',
    ],
    NAO_entram_folha: [
      'Distribuição de lucros (dividendos)',
      'Pagamento a PJ (terceirizados)',
      'Pagamento a autônomo via RPA (controverso)',
      'Encargos não pagos (ex: INSS atrasado)',
    ],
  },

  cnaes_sujeitos_fator_r: [
    '9313-1/00 - Academias de ginástica',
    '9311-5/00 - Gestão instalações esportivas',
    '8650-0/01 - Nutricionistas',
    '8650-0/04 - Fisioterapia',
    '6201-5/01 - Desenvolvimento programas computador',
    '7020-4/00 - Consultoria gestão',
    '7311-4/00 - Agências publicidade',
    '8530-3/00 - Educação superior',
    '9602-5/01 - Cabeleireiros',
    '9602-5/02 - Esteticistas',
  ],

  estrategias_atingir_28pct: {
    aumentar_pro_labore: `ESTRATÉGIA MAIS COMUM:
- Pró-labore conta INTEGRALMENTE na Folha
- INSS sócio: 11% sobre pró-labore (responsabilidade sócio, não empresa)
- NÃO impacta DAS

Academia R$ 50k/mês = R$ 600k/ano:
- Folha CLT R$ 5k/mês = R$ 60k/ano (10% Fator R - insuficiente)
- Aumentar pró-labore: R$ 14k/mês = R$ 168k/ano
- Folha total: R$ 228k/ano = 38% Fator R (Anexo III!)
Custos: INSS sócio R$ 18.480/ano + IR PF (~R$ 62.700/ano).
Economia DAS: R$ 57.000/ano. LÍQUIDO: R$ 25.000+/ano.`,
    contratar_clt: `Funciona MAS é caro se for SÓ pro Fator R:
1 CLT R$ 4k/mês: custo total ~R$ 6k/mês = R$ 72k/ano na Folha.
Vale se TINHA NECESSIDADE OPERACIONAL. Contratar SÓ pra Fator R: prejuízo.`,
    segregar_receitas: `Academia que vende suplementos:
- Inscrever CNAE 4772 (cosméticos/suplementos)
- Receita venda separada vai pro Anexo I
- Receita CNAE serviço REDUZ
- Mesma folha ÷ receita menor = Fator R MAIOR
- Pode mudar Anexo V → III com isso`,
    plr_participacao_lucros: `PLR conta na Folha (com restrições).
Deve: pago 1x ou 2x/ano máximo. Ter regulamento (Lei 10.101/2000). Reduz IR/CSLL também.`,
  },

  armadilhas: [
    'Não atualizar mensalmente = oscila Anexo III ↔ V',
    'Esquecer pró-labore = subestima Folha',
    'Contratar CLT sem necessidade = prejuízo',
    'PLR sem regulamento formal = descaracterizada',
    'Pró-labore só de 1 sócio (outros sem) = problemas trabalhistas',
  ],

  exemplo_simulacao: `SIMULAÇÃO - Academia R$ 80k/mês (R$ 960k/ano):

CENÁRIO ATUAL:
- Folha CLT: R$ 8k/mês
- Pró-labore: R$ 3k/mês
- INSS + FGTS sobre CLT: R$ 2.5k/mês
- Folha total mensal: R$ 13.5k
- Folha 12m: R$ 162.000
- Fator R: 162k / 960k = 16.9% (Anexo V)
- DAS Anexo V (faixa 5, 14.92%): R$ 11.936/mês = R$ 143.232/ano

OTIMIZAÇÃO - Pró-labore para R$ 22k/mês (era R$ 3k):
- Folha total: R$ 32.5k/mês = R$ 390k/ano
- Fator R: 40.6% (Anexo III!)
- DAS Anexo III (faixa 4, 10.7%): R$ 8.560/mês = R$ 102.720/ano

Custos novos:
- INSS sócio sobre R$ 19k extra: R$ 25.080/ano
- IR PF (27.5%): R$ 62.700/ano (depende)

Economia DAS: R$ 40.512/ano
Custo INSS: R$ 25.080/ano
LÍQUIDO: R$ 15.432/ano
+ Patrimônio do sócio aumenta (dinheiro saindo pro pessoal dele)`,
} as const
