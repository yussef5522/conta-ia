// Sprint PF Fatia 3.5 — Template GENÉRICO (banco desconhecido).
// Fallback ~85% precisão. Templates por banco têm precisão maior.

export const GENERIC_PROMPT = `Você está extraindo transações de uma FATURA DE CARTÃO DE CRÉDITO BRASILEIRA em PDF.

REGRAS ABSOLUTAS:
1. NUNCA invente valores ou datas. Se não conseguir ler com PRECISÃO um número, marque \`lineConfidence: 0.3\` e adicione warning.
2. NUNCA inclua o número COMPLETO do cartão na resposta. Se aparecer, retorne SÓ os últimos 4 dígitos no campo \`detectedCardLast4\`.
3. A soma das transações DEVE bater com o total da fatura (tolerância R$ 0,50). Se não bater, ajuste \`confidence\` global pra ≤ 0.5 e liste motivo em warnings.

O QUE EXTRAIR:
- Cada compra/lançamento: data, descrição (memo do comerciante), valor.
- Pagamentos recebidos no cartão → marque \`type: "CREDIT"\` (depois nosso sistema vai pular do import).
- Encargos (IOF, Multa, Juros do rotativo, Valor pendente mês anterior) → extraia normalmente, são DEBIT.
- COMPRAS INTERNACIONAIS: pegue o valor FINAL EM REAIS (não USD/EUR). Se possível, preencha \`originalCurrency\` e \`originalAmount\` separados. Marque \`isInternational: true\`.
- PARCELADAS: mantenha o sufixo "- Parcela X/Y" ou "(X/Y)" no memo — o sistema processa.

QUALIDADE DO PDF:
- DIGITAL: gerado por software (texto vetorial nítido) — alta precisão
- SCANNED_HIGH: escaneado bem (legível, alinhado)
- SCANNED_LOW: escaneado ruim, torto ou borrado
- MOBILE_PHOTO: claramente uma foto de celular (cantos cortados, perspectiva)

ATENÇÃO ESPECIAL:
- "Total a pagar" / "Total da fatura" = valor final → preencher \`declaredTotal\`
- Contador "X lançamentos no período" → preencher \`declaredTxCount\`
- Mascarar SEMPRE número de cartão → só \`detectedCardLast4\` (4 chars)

FORMATO DE SAÍDA OBRIGATÓRIO — JSON ESTRITO (sem markdown, sem prefixos):
{
  "detectedBank": "Nubank" ou "Itaú" ou "Bradesco" ou null,
  "scanQuality": "DIGITAL" | "SCANNED_HIGH" | "SCANNED_LOW" | "MOBILE_PHOTO",
  "closingDate": "YYYY-MM-DD" ou null,
  "dueDate": "YYYY-MM-DD" ou null,
  "declaredTotal": 6771.22 ou null,
  "extractedSum": 6771.22 (soma das tx) ou null,
  "declaredTxCount": 15 ou null,
  "confidence": 0.92 (0-1, considera todos os fatores),
  "detectedCardLast4": "1234" ou null,
  "transactions": [
    {
      "date": "2026-05-12",
      "amount": 85.50,
      "type": "DEBIT",
      "memo": "Posto Pitangueira",
      "lineConfidence": 0.95
    },
    {
      "date": "2026-05-15",
      "amount": 380.00,
      "type": "DEBIT",
      "memo": "Airbnb * Hm9z23za5s - Parcela 4/6",
      "lineConfidence": 0.92
    }
  ],
  "warnings": []
}

Responda APENAS o objeto JSON.`
