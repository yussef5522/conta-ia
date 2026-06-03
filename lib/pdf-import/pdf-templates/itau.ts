// Sprint PF Fatia 3.5 — Template específico Itaú.

import { GENERIC_PROMPT } from './generic'

export const ITAU_PROMPT = `${GENERIC_PROMPT}

⚠️ DICAS ESPECÍFICAS ITAÚ:

1. ESTRUTURA:
   - Bandeira "Itaú" + nome da modalidade (Personnalité, Click, Uniclass)
   - Tabela: data | estabelecimento | parcela | valor R$
   - Compras internacionais com "(USD)" ou "(EUR)" no memo

2. PARCELAS:
   - Padrão: "ESTABELECIMENTO 1/5" ou "PARCELA X/Y"
   - Itaú às vezes usa "(X/Y)" entre parênteses

3. PAGAMENTO:
   - "PGTO DEBITO AUTOMATICO" ou "PAGAMENTO" — CREDIT
   - Aparece como negativo no extrato (sinal invertido)

4. \`detectedBank\` = "Itaú"`
