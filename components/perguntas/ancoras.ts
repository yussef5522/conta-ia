// ⭐ AS ÂNCORAS DAS PERGUNTAS DO SISTEMA (lei de 19/11) — PORTA ÚNICA: a tela desenha a pergunta com este
// `id` e o aviso do sininho pousa em `#<id>`. Módulo PURO (sem Prisma): o servidor e a tela importam daqui.
export const ANCORAS = {
  DIA_PARADO: 'pergunta-dia-parado',
  GEMEOS: 'pergunta-gemeos',
  SANIDADE: 'pergunta-sanidade',
  CONFLITO: 'pergunta-conflito',
  JA_EXISTE: 'pergunta-ja-existe',
  PAGAMENTO_DA_FATURA: 'pergunta-pagamento-da-fatura',
  // (24/11) R51 — o sininho vigia o cartão: fatura vencendo sem pagamento, fatura não importada, limite > 80%
  CARTAO_VIGIA: 'pergunta-cartao-vigia',
} as const
