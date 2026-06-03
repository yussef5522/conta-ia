// Sprint PF Fatia 3.5 — Template específico Nubank.
//
// Características da fatura Nubank:
// - Logo roxo no topo "Nubank" + "NU PAGAMENTOS S.A."
// - Tabela de transações nas últimas 2-3 páginas
// - Cada linha: data (DD MMM), descrição, valor (com sinal)
// - Compras internacionais têm 3 linhas: original (USD/EUR), conversão (R$), IOF
// - Parcelas no MEMO: "- Parcela X/Y"
// - "Pagamento em DD MMM −R$X,XX" no topo
// - Total da fatura no resumo: "Total a pagar"

import { GENERIC_PROMPT } from './generic'

export const NUBANK_PROMPT = `${GENERIC_PROMPT}

⚠️ DICAS ESPECÍFICAS NUBANK (banco "NU PAGAMENTOS S.A."):

1. ESTRUTURA DA FATURA:
   - Página 1-2: resumo (total a pagar, pagamento anterior, datas)
   - Página 3-4: detalhamento das transações por categoria
   - "Total de compras" + "IOF compras internacionais" + "Outros lançamentos" = Total

2. COMPRAS INTERNACIONAIS NO NUBANK:
   - Aparecem como bloco de 2-3 linhas:
     Linha A: nome+moeda original (ex: "Anthropic" USD 20)
     Linha B: cotação/conversão visível
     Linha C: IOF separado
   - VOCÊ DEVE: extrair 1 transação com valor FINAL EM REAIS no \`amount\`,
     e \`originalCurrency\`/\`originalAmount\` preenchidos.
   - O IOF da linha seguinte é OUTRA transação (memo "IOF de compra internacional").

3. PARCELAS:
   - Padrão: "Loja XYZ - Parcela X/Y" (com hífen e espaço)
   - Manter o sufixo exato no memo.

4. PAGAMENTO RECEBIDO:
   - "Pagamento em DD MMM" → TIPO CREDIT (valor positivo), memo "Pagamento recebido"
   - Sistema vai SKIPAR no import.

5. DATAS:
   - Nubank usa formato "DD MMM" (ex: "12 MAI", "15 MAI")
   - Converta pra YYYY-MM-DD baseado no MÊS DE COMPETÊNCIA da fatura
     (que aparece no cabeçalho: "Fatura de MAI/2026", "Vence em 15/06/2026")

6. \`detectedBank\` = "Nubank"`
