-- Bug-fix 28/05/2026 — Backfill: contas PAYABLE com paymentDate viram EFFECTED.
--
-- Contexto:
-- Antes deste fix, 2 paths criavam/atualizavam transações em estado inválido:
--   1. Import Excel (confirm/route.ts:238) hardcodava lifecycle='PAYABLE'
--      mesmo quando a planilha vinha com paymentDate preenchida.
--   2. Bulk mark_paid (bulk/route.ts:121-129) setava paymentDate sem
--      transicionar lifecycle de PAYABLE → EFFECTED.
--
-- Isso violava lib/lifecycle/index.ts:60-69 ("PAYABLE/RECEIVABLE NÃO podem
-- ter paymentDate") e tornava as transações invisíveis nos relatórios (que
-- filtram lifecycle='EFFECTED').
--
-- Impacto observado em prod (consulta no banco antes da migration):
--   - profit sao borja: 398 contas, R$ 757.499,35
--   - cacula mix:        94 contas, R$ 182.396,54
--   - TOTAL:            492 contas, R$ 939.895,89
--
-- Critério conservador: só transiciona quando reconciledWithId IS NULL.
-- Se já estava conciliada com OFX (reconciledWithId != null), significa que
-- existe um par OFX (EFFECTED) separado contabilizando a mesma despesa nos
-- relatórios — mudar essa pra EFFECTED também causaria dupla contagem.
--
-- Idempotente: re-execução não afeta nada (WHERE filtra só PAYABLE+payment).
-- Veja docs/sprints/bug-despesas-relatorios-audit.md.

UPDATE "transactions"
SET "lifecycle" = 'EFFECTED'
WHERE "lifecycle" = 'PAYABLE'
  AND "paymentDate" IS NOT NULL
  AND "reconciledWithId" IS NULL;
