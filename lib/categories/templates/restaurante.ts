// Template de Plano de Contas — RESTAURANTE (CNAE 5611-2/01)
// Particularidades: insumos perecíveis, gás cozinha, taxa iFood/Rappi/99Food
// (recebida bruta, comissão como Despesa Comercial), embalagens delivery,
// comissão garçons (taxa serviço 10%), motoboys CLT opcional, dedetização.

import { buildTemplate, type CategoryTemplateNode } from './_common'

const especificas: CategoryTemplateNode[] = [
  // 1.0/1.1/1.2
  { code: '1.0', name: 'Receitas Operacionais', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: null, description: 'Raiz das receitas da operação do restaurante.', color: '#10b981', icon: 'trending-up', visibleInRegimes: null, order: 100 },
  { code: '1.1', name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Vendas de comidas e bebidas (todos os canais).', color: '#10b981', icon: 'utensils', visibleInRegimes: null, order: 110 },
  { code: '1.1.01', name: 'Salão / Consumo Local', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Refeições consumidas no estabelecimento.', color: '#16a34a', icon: 'utensils', visibleInRegimes: null, order: 111 },
  { code: '1.1.02', name: 'Delivery', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Receita BRUTA dos canais de delivery (taxas em 6.4).', color: '#16a34a', icon: 'bike', visibleInRegimes: null, order: 112 },
  { code: '1.1.02.01', name: 'Pedidos Próprios', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'WhatsApp, site próprio, telefone (sem comissão de plataforma).', color: '#22c55e', icon: 'message-square', visibleInRegimes: null, order: 1121 },
  { code: '1.1.02.02', name: 'iFood', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Receita BRUTA antes da taxa do iFood (12-23%).', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1122 },
  { code: '1.1.02.03', name: 'Rappi', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Receita BRUTA antes da taxa do Rappi.', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1123 },
  { code: '1.1.02.04', name: '99Food', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Receita BRUTA antes da taxa do 99Food.', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1124 },
  { code: '1.1.02.05', name: 'Outros Apps Delivery', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Uber Eats, James, plataformas regionais.', color: '#22c55e', icon: 'shopping-bag', visibleInRegimes: null, order: 1125 },
  { code: '1.1.03', name: 'Balcão / Take Away', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Retirada no local sem consumo (sem ocupar mesa).', color: '#16a34a', icon: 'shopping-bag', visibleInRegimes: null, order: 113 },
  { code: '1.1.04', name: 'Eventos / Buffet / Catering', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Eventos privados, buffet externo, fornecimento corporativo.', color: '#16a34a', icon: 'calendar-check', visibleInRegimes: null, order: 114 },
  { code: '1.1.05', name: 'Bebidas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Vendas de bebidas (separar permite ver margem bebida vs prato).', color: '#16a34a', icon: 'wine', visibleInRegimes: null, order: 115 },
  { code: '1.2', name: 'Receita Acessória', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Receitas vinculadas mas fora do core de vendas.', color: '#10b981', icon: 'plus-circle', visibleInRegimes: null, order: 120 },
  { code: '1.2.01', name: 'Couvert Artístico', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Cobrança por música ao vivo, espetáculo.', color: '#16a34a', icon: 'music', visibleInRegimes: null, order: 121 },
  { code: '1.2.02', name: 'Comissão Cartas (Vinhos)', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Comissão sobre seleção de vinhos / cervejas especiais.', color: '#16a34a', icon: 'wine', visibleInRegimes: null, order: 122 },
  { code: '1.2.03', name: 'Sublocação Espaço', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Aluguel para eventos privados, casamentos, formaturas.', color: '#16a34a', icon: 'home', visibleInRegimes: null, order: 123 },

  // 3.0 Custos
  { code: '3.0', name: 'Custo dos Serviços Prestados', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: null, description: 'Custos diretamente atribuíveis ao prato/bebida vendido.', color: '#ea580c', icon: 'cog', visibleInRegimes: null, order: 300 },
  { code: '3.1', name: 'Pessoal Operacional Direto', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Folha de quem produz/serve diretamente ao cliente.', color: '#ea580c', icon: 'users', visibleInRegimes: null, order: 310 },
  { code: '3.1.01', name: 'Salários Cozinha', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Chef, cozinheiros, ajudantes, padeiros.', color: '#f97316', icon: 'chef-hat', visibleInRegimes: null, order: 311 },
  { code: '3.1.02', name: 'Salários Salão', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Garçons, atendentes, recepção do salão.', color: '#f97316', icon: 'user', visibleInRegimes: null, order: 312 },
  { code: '3.1.03', name: 'Encargos Operação', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'FGTS+RAT (Simples) ou +CPP+Terceiros (Não-Simples).', color: '#f97316', icon: 'shield', visibleInRegimes: null, order: 313 },
  { code: '3.1.04', name: 'Comissão Garçons', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Gorjeta organizada (taxa de serviço 10%) repassada aos garçons.', color: '#f97316', icon: 'percent', visibleInRegimes: null, order: 314 },
  { code: '3.1.05', name: 'Salários Motoboys CLT', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Folha CLT de motoboys próprios (delivery interno). Ignorar se usar só plataformas.', color: '#f97316', icon: 'bike', visibleInRegimes: null, order: 315 },
  { code: '3.2', name: 'Insumos e Mercadorias', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'CMV — Custo da Mercadoria Vendida (insumos perecíveis).', color: '#ea580c', icon: 'package', visibleInRegimes: null, order: 320 },
  { code: '3.2.01', name: 'Alimentos / Hortifruti', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Frutas, legumes, verduras (perecíveis).', color: '#f97316', icon: 'apple', visibleInRegimes: null, order: 321 },
  { code: '3.2.02', name: 'Carnes e Proteínas', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Carnes, peixes, ovos, frango.', color: '#f97316', icon: 'beef', visibleInRegimes: null, order: 322 },
  { code: '3.2.03', name: 'Bebidas (compra)', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Refrigerantes, sucos, vinhos, cervejas, destilados.', color: '#f97316', icon: 'wine', visibleInRegimes: null, order: 323 },
  { code: '3.2.04', name: 'Frios / Laticínios', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Queijos, iogurtes, manteiga, frios.', color: '#f97316', icon: 'milk', visibleInRegimes: null, order: 324 },
  { code: '3.2.05', name: 'Mercearia / Outros', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Arroz, feijão, óleo, temperos, condimentos.', color: '#f97316', icon: 'package', visibleInRegimes: null, order: 325 },
  { code: '3.3', name: 'Embalagens Delivery', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Marmitas, sacolas, talheres descartáveis (variável com volume de delivery).', color: '#ea580c', icon: 'package', visibleInRegimes: null, order: 330 },
  { code: '3.4', name: 'Royalties (Franqueada)', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Royalties pagos à franqueadora. Oculto por default.', color: '#ea580c', icon: 'crown', visibleInRegimes: null, order: 340, isActive: false },

  // 5.x específicas
  { code: '5.0', name: 'Despesas Operacionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Gastos pra manter o restaurante funcionando.', color: '#fb923c', icon: 'building-2', visibleInRegimes: null, order: 500 },
  { code: '5.1.09', name: 'Combustível Delivery', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Gasolina/álcool das motos próprias de delivery.', color: '#fbbf24', icon: 'fuel', visibleInRegimes: null, order: 519 },
  { code: '5.2', name: 'Manutenção e Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Conservação do espaço e equipamentos.', color: '#fb923c', icon: 'wrench', visibleInRegimes: null, order: 520 },
  { code: '5.2.01', name: 'Limpeza Terceirizada', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'NF tomada de empresa de limpeza.', color: '#fbbf24', icon: 'sparkles', visibleInRegimes: null, order: 521 },
  { code: '5.2.07', name: 'Manut. Equipamentos Cozinha', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Forno, fogão industrial, fritadeira, geladeira (manutenção corretiva).', color: '#fbbf24', icon: 'flame', visibleInRegimes: null, order: 527 },
  { code: '5.2.08', name: 'Dedetização e Pragas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Obrigação sanitária — controle de pragas mensal.', color: '#fbbf24', icon: 'bug', visibleInRegimes: null, order: 528 },
  { code: '5.2.09', name: 'Manutenção Motos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Manutenção de motos próprias de delivery (oficina, peças).', color: '#fbbf24', icon: 'bike', visibleInRegimes: null, order: 529 },
  { code: '5.3', name: 'Tecnologia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Software e infra digital.', color: '#fb923c', icon: 'laptop', visibleInRegimes: null, order: 530 },
  { code: '5.3.01', name: 'Software de Gestão', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Saipos, ColibriPOS, sistemas de PDV/comanda.', color: '#fbbf24', icon: 'monitor', visibleInRegimes: null, order: 531 },
  { code: '5.3.05', name: 'iFood Plus / Plano Mensal', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Mensalidade fixa do plano iFood (R$ 150 Plano Delivery).', color: '#fbbf24', icon: 'shopping-bag', visibleInRegimes: null, order: 535 },
  { code: '5.3.06', name: 'Cardápio Digital / QR Code', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Plataforma de cardápio digital (Goomer, Cardápio Web, MenuFree).', color: '#fbbf24', icon: 'qr-code', visibleInRegimes: null, order: 536 },
  { code: '5.5', name: 'Depreciação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Reconhecimento contábil do desgaste de imobilizado.', color: '#fb923c', icon: 'trending-down', visibleInRegimes: null, order: 550 },
  { code: '5.5.01', name: 'Depreciação Equipamentos Cozinha', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10% a.a. típico (vida útil 10 anos).', color: '#fbbf24', icon: 'flame', visibleInRegimes: null, order: 551 },
  { code: '5.5.02', name: 'Depreciação Móveis e Utensílios', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10% a.a. típico.', color: '#fbbf24', icon: 'armchair', visibleInRegimes: null, order: 552 },

  // 6.0/6.4
  { code: '6.0', name: 'Despesas Comerciais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Investimento em captação e retenção de cliente.', color: '#f97316', icon: 'megaphone', visibleInRegimes: null, order: 600 },
  { code: '6.4', name: 'Comissões de Plataformas', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.0', description: 'Taxas pagas a plataformas de delivery — diferencial pra ver margem real do canal.', color: '#f97316', icon: 'percent', visibleInRegimes: null, order: 640 },
  { code: '6.4.01', name: 'Comissão iFood', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: '12-23% comissão + 3,2% processamento. Pode chegar a 26% do pedido.', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 641 },
  { code: '6.4.02', name: 'Comissão Rappi', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: 'Em 2026, taxa zero pra muitos PMEs (3 anos). Pode ser zero, mas categoria existe.', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 642 },
  { code: '6.4.03', name: 'Comissão 99Food', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: 'Comissão sobre vendas via 99Food.', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 643 },
  { code: '6.4.04', name: 'Comissão Outros Apps', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: 'Uber Eats, James, plataformas regionais.', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 644 },

  // 7.0/7.4
  { code: '7.0', name: 'Despesas Administrativas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Serviços profissionais e custos da gestão.', color: '#fbbf24', icon: 'briefcase', visibleInRegimes: null, order: 700 },
  { code: '7.4', name: 'Anuidades de Conselhos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.0', description: 'Contribuições obrigatórias e setoriais.', color: '#fbbf24', icon: 'award', visibleInRegimes: null, order: 740 },
  { code: '7.4.01', name: 'ABRASEL (anuidade setorial)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.4', description: 'Associação Brasileira de Bares e Restaurantes.', color: '#fde047', icon: 'award', visibleInRegimes: null, order: 741 },

  // 9.2 Investimentos
  { code: '9.2', name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: null, description: 'Aquisições de longo prazo (capitalizar e depreciar).', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 920 },
  { code: '9.2.01', name: 'Fogão Industrial / Forno', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Equipamentos pesados de cozinha.', color: '#c084fc', icon: 'flame', visibleInRegimes: null, order: 921 },
  { code: '9.2.02', name: 'Câmara Fria / Geladeira', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Equipamentos de refrigeração.', color: '#c084fc', icon: 'snowflake', visibleInRegimes: null, order: 922 },
  { code: '9.2.03', name: 'Mesas e Cadeiras', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Mobiliário do salão.', color: '#c084fc', icon: 'armchair', visibleInRegimes: null, order: 923 },
  { code: '9.2.04', name: 'Reformas e Benfeitorias', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Obras estruturais.', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 924 },
  { code: '9.2.05', name: 'Sistema de Som / Climatização', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Som ambiente, AC, ventilação, exaustores.', color: '#c084fc', icon: 'volume-2', visibleInRegimes: null, order: 925 },
  { code: '9.2.06', name: 'PDV / SAT / NFC-e', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Sistemas de ponto de venda, SAT fiscal, impressora cupom.', color: '#c084fc', icon: 'cpu', visibleInRegimes: null, order: 926 },
  { code: '9.2.07', name: 'Sistema de Vigilância', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Câmeras, alarme, controle de acesso.', color: '#c084fc', icon: 'camera', visibleInRegimes: null, order: 927 },
]

export const restauranteTemplate: CategoryTemplateNode[] = buildTemplate(especificas)
