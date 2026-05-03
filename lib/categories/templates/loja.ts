// Template de Plano de Contas — COMÉRCIO / LOJA (varejo)
// Particularidades: CMV mercadoria revenda detalhado, frete sobre vendas/compras,
// embalagens, ICMS-ST (CFOP 1403), devoluções de venda, marketplaces (ML, Shopee),
// inadimplência em crediário próprio.

import { buildTemplate, type CategoryTemplateNode } from './_common'
import { REGIMES_PRESUMIDO_REAL } from '@/lib/categories/regimes'

const especificas: CategoryTemplateNode[] = [
  // 1.0/1.1/1.2
  { code: '1.0', name: 'Receitas Operacionais', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: null, description: 'Raiz das receitas da loja.', color: '#10b981', icon: 'trending-up', visibleInRegimes: null, order: 100 },
  { code: '1.1', name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Vendas de mercadorias (todos os canais).', color: '#10b981', icon: 'shopping-bag', visibleInRegimes: null, order: 110 },
  { code: '1.1.01', name: 'Vendas à Vista', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Pagamento à vista (pix, débito, dinheiro).', color: '#16a34a', icon: 'banknote', visibleInRegimes: null, order: 111 },
  { code: '1.1.02', name: 'Vendas a Prazo', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Cartão crédito parcelado, crediário próprio.', color: '#16a34a', icon: 'credit-card', visibleInRegimes: null, order: 112 },
  { code: '1.1.03', name: 'Vendas Online', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Receita BRUTA do digital (taxas em 6.4).', color: '#16a34a', icon: 'globe', visibleInRegimes: null, order: 113 },
  { code: '1.1.03.01', name: 'E-commerce Próprio', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Site próprio (Shopify, Tray, VTEX, Loja Integrada).', color: '#22c55e', icon: 'globe', visibleInRegimes: null, order: 1131 },
  { code: '1.1.03.02', name: 'Mercado Livre', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Receita BRUTA antes da comissão (11-19%).', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1132 },
  { code: '1.1.03.03', name: 'Shopee', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Receita BRUTA antes da comissão (14-20%).', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1133 },
  { code: '1.1.03.04', name: 'Magalu / Americanas / Outros', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Outros marketplaces (Casas Bahia, Carrefour etc).', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1134 },
  { code: '1.1.04', name: 'Vendas Atacado (B2B)', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Mix B2B (notas de venda atacado).', color: '#16a34a', icon: 'package', visibleInRegimes: null, order: 114 },
  { code: '1.2', name: 'Receita Acessória', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Receitas vinculadas mas fora do core de vendas.', color: '#10b981', icon: 'plus-circle', visibleInRegimes: null, order: 120 },
  { code: '1.2.01', name: 'Frete Cobrado do Cliente', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Frete repassado ao cliente (quando não-grátis).', color: '#16a34a', icon: 'truck', visibleInRegimes: null, order: 121 },
  { code: '1.2.02', name: 'Embalagem para Presente', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Cobrança de embalagem premium.', color: '#16a34a', icon: 'gift', visibleInRegimes: null, order: 122 },

  // 2.0 deduções específicas (devoluções de varejo)
  { code: '2.0.04', name: 'Devoluções de Vendas (Varejo)', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Mercadoria devolvida pelo cliente (arrependimento, defeito).', color: '#ef4444', icon: 'corner-down-left', visibleInRegimes: null, order: 204 },
  { code: '2.0.05', name: 'Descontos Comerciais Volume', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Descontos por volume (atacado), fidelidade, promoções.', color: '#ef4444', icon: 'tag', visibleInRegimes: null, order: 205 },
  { code: '2.1.09', name: 'ICMS Próprio (Saída)', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: 'ICMS na saída (alíquota estadual). Apenas regimes não-Simples.', color: '#dc2626', icon: 'landmark', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 219 },

  // 3.0 Custos
  { code: '3.0', name: 'Custo dos Produtos Vendidos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: null, description: 'Custos diretamente atribuíveis aos produtos vendidos. Coração da DRE de varejo.', color: '#ea580c', icon: 'cog', visibleInRegimes: null, order: 300 },
  { code: '3.1', name: 'CMV Mercadorias', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Custo de aquisição + ajustes.', color: '#ea580c', icon: 'package', visibleInRegimes: null, order: 310 },
  { code: '3.1.01', name: 'Custo de Aquisição', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Valor da nota de compra do fornecedor (CFOP 1102 ou 1403).', color: '#f97316', icon: 'package', visibleInRegimes: null, order: 311 },
  { code: '3.1.02', name: 'Frete sobre Compras', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Frete pago pra trazer mercadoria do fornecedor (vai pro custo de aquisição).', color: '#f97316', icon: 'truck', visibleInRegimes: null, order: 312 },
  { code: '3.1.03', name: 'Devoluções a Fornecedor', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Mercadoria devolvida ao fornecedor (redutor de CMV).', color: '#f97316', icon: 'corner-up-left', visibleInRegimes: null, order: 313 },
  { code: '3.1.04', name: 'Descontos sobre Compras', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Descontos obtidos do fornecedor (redutor).', color: '#f97316', icon: 'tag', visibleInRegimes: null, order: 314 },
  { code: '3.1.05', name: 'ICMS-ST (CFOP 1403)', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'ICMS-ST integra custo de aquisição (sem crédito) — produtos sujeitos a Substituição Tributária.', color: '#f97316', icon: 'landmark', visibleInRegimes: null, order: 315 },
  { code: '3.2', name: 'Pessoal de Vendas Direto', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Vendedores que atendem cliente.', color: '#ea580c', icon: 'users', visibleInRegimes: null, order: 320 },
  { code: '3.2.01', name: 'Salários Vendedores CLT', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Folha CLT da loja (vendedores efetivos).', color: '#f97316', icon: 'user', visibleInRegimes: null, order: 321 },
  { code: '3.2.02', name: 'Comissão de Vendas', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: '% sobre vendas (típico 1-3%).', color: '#f97316', icon: 'percent', visibleInRegimes: null, order: 322 },
  { code: '3.2.03', name: 'Encargos Vendedores', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'FGTS+RAT (Simples) sobre folha CLT.', color: '#f97316', icon: 'shield', visibleInRegimes: null, order: 323 },

  // 5.x específicas
  { code: '5.0', name: 'Despesas Operacionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Gastos pra manter a loja funcionando.', color: '#fb923c', icon: 'building-2', visibleInRegimes: null, order: 500 },
  { code: '5.2', name: 'Manutenção e Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Conservação do espaço e equipamentos.', color: '#fb923c', icon: 'wrench', visibleInRegimes: null, order: 520 },
  { code: '5.2.01', name: 'Limpeza Terceirizada', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'NF tomada de empresa de limpeza.', color: '#fbbf24', icon: 'sparkles', visibleInRegimes: null, order: 521 },
  { code: '5.3', name: 'Tecnologia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Software de gestão e infra digital.', color: '#fb923c', icon: 'laptop', visibleInRegimes: null, order: 530 },
  { code: '5.3.01', name: 'Software de Gestão / ERP', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Bling, Tiny, Vhsys, Omie (ERP de varejo).', color: '#fbbf24', icon: 'monitor', visibleInRegimes: null, order: 531 },
  { code: '5.3.02', name: 'Plataforma E-commerce', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Mensalidade Shopify, Tray, VTEX, Loja Integrada.', color: '#fbbf24', icon: 'globe', visibleInRegimes: null, order: 532 },
  { code: '5.4.04', name: 'Embalagens de Venda', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.4', description: 'Sacolas, caixas, papel de presente, fitas.', color: '#fbbf24', icon: 'package', visibleInRegimes: null, order: 544 },
  { code: '5.5', name: 'Depreciação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Reconhecimento contábil do desgaste de imobilizado.', color: '#fb923c', icon: 'trending-down', visibleInRegimes: null, order: 550 },
  { code: '5.5.01', name: 'Depreciação Equipamentos Loja', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10% a.a. típico (vitrine, balcão, mobiliário).', color: '#fbbf24', icon: 'armchair', visibleInRegimes: null, order: 551 },

  // 6.0/6.4/6.5
  { code: '6.0', name: 'Despesas Comerciais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Investimento em captação e retenção de cliente.', color: '#f97316', icon: 'megaphone', visibleInRegimes: null, order: 600 },
  { code: '6.4', name: 'Comissões Marketplaces', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.0', description: 'Taxas pagas a marketplaces — diferencial pra ver margem real do canal.', color: '#f97316', icon: 'percent', visibleInRegimes: null, order: 640 },
  { code: '6.4.01', name: 'Comissão Mercado Livre', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: '11-19% por categoria (varia por tipo de produto).', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 641 },
  { code: '6.4.02', name: 'Comissão Shopee', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: '14-20% (varia por categoria).', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 642 },
  { code: '6.4.03', name: 'Comissão Outros Marketplaces', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: 'Magalu, Americanas, Casas Bahia, Carrefour etc.', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 643 },
  { code: '6.5', name: 'Frete sobre Vendas', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.0', description: 'Frete grátis ou subsidiado pra cliente (Correios, transportadora, motoboy).', color: '#f97316', icon: 'truck', visibleInRegimes: null, order: 650 },

  // 7.0
  { code: '7.0', name: 'Despesas Administrativas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Serviços profissionais e custos da gestão.', color: '#fbbf24', icon: 'briefcase', visibleInRegimes: null, order: 700 },

  // 8.4 Inadimplência (decisão Yussef L3)
  { code: '8.4.01', name: 'Provisão para Devedores Duvidosos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.4', description: 'Provisão estimada para inadimplência em vendas a prazo (crediário próprio).', color: '#ef4444', icon: 'alert-circle', visibleInRegimes: null, order: 841 },

  // 9.2 Investimentos
  { code: '9.2', name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: null, description: 'Aquisições de longo prazo (capitalizar e depreciar).', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 920 },
  { code: '9.2.01', name: 'Vitrine e Prateleiras', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Mobiliário comercial fixo.', color: '#c084fc', icon: 'archive', visibleInRegimes: null, order: 921 },
  { code: '9.2.02', name: 'Manequins e Display', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Manequins, displays de produto, suportes.', color: '#c084fc', icon: 'user', visibleInRegimes: null, order: 922 },
  { code: '9.2.03', name: 'Sistema Antifurto', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Antenas, etiquetas RF, controle de inventário.', color: '#c084fc', icon: 'shield', visibleInRegimes: null, order: 923 },
  { code: '9.2.04', name: 'PDV / Leitor Código de Barras', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Sistema de ponto de venda, balança, leitor.', color: '#c084fc', icon: 'cpu', visibleInRegimes: null, order: 924 },
  { code: '9.2.05', name: 'Reformas e Benfeitorias', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Obras estruturais, fachada, comunicação visual.', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 925 },
  { code: '9.2.06', name: 'Equipamentos de TI', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Computadores, impressoras, monitores, tablets.', color: '#c084fc', icon: 'monitor', visibleInRegimes: null, order: 926 },
  { code: '9.2.07', name: 'Sistema de Vigilância', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Câmeras, alarme, controle de acesso.', color: '#c084fc', icon: 'camera', visibleInRegimes: null, order: 927 },
]

export const lojaTemplate: CategoryTemplateNode[] = buildTemplate(especificas)
