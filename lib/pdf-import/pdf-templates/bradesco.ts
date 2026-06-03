// Sprint PF Fatia 3.5 — Template específico Bradesco.

import { GENERIC_PROMPT } from './generic'

export const BRADESCO_PROMPT = `${GENERIC_PROMPT}

⚠️ DICAS ESPECÍFICAS BRADESCO:

1. ESTRUTURA:
   - Cabeçalho "Bradesco" + nome da modalidade (Visa Gold, Mastercard Platinum)
   - Tabela: data compra | descrição | valor

2. PARCELAS:
   - Padrão "Parc X/Y" ou "X de Y"

3. PAGAMENTO:
   - "PAGAMENTO" sem valor — CREDIT

4. \`detectedBank\` = "Bradesco"`
