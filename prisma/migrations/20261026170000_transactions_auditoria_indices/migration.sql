-- FASE 0 PASSO 5 (26/10/2026) — índices dos 3 filtros da auditoria em `transactions`.
--
-- ADITIVA PURA: 3 CREATE INDEX, zero ALTER de coluna, zero toque em linha.
--
-- ⚠️ MEDIDO EM PROD ANTES DE ESCREVER ESTA MIGRATION, e duas premissas do pedido caíram:
--
--   (a) `transactions_employeeId_idx` JÁ EXISTIA NO BANCO desde a migration
--       20260606000000_sprint_5_0_2_0_excel_import_ap (linha 28) e NUNCA esteve declarado
--       no schema.prisma — DRIFT schema×banco. A declaração entra agora; sem ela, um
--       `prisma migrate diff` futuro tentaria CRIAR um índice que já existe.
--
--   (b) O ganho de HOJE é pequeno e está medido: transactions tem 10.547 linhas / 13 MB,
--       inteira em cache (`shared hit=575`). O Seq Scan levava 2,67ms (supplierId) e
--       2,16ms (categoryId). Com índice: Index Scan / Bitmap Index Scan, `shared hit`
--       caindo de 575 → 5 páginas. ⭐ Eles valem por CRESCIMENTO, não pelo badge de 1,3s
--       — esse é CPU no app (`reconhecerFornecedor` linha a linha), não I/O de banco.
--
-- ⭐ POR QUE `IF NOT EXISTS` NÃO-CONCURRENT AQUI (o padrão da casa desde 20260619000000):
--   Em PROD os dois índices novos já foram criados à mão com `CREATE INDEX CONCURRENTLY`
--   (que NÃO trava a tabela quente, mas NÃO roda dentro de transação — e o Prisma envolve
--   toda migration numa). Então aqui a forma é a não-concurrent com IF NOT EXISTS:
--     - em PROD é NO-OP nos três (os três já existem);
--     - em DEV / instalação nova, cria normalmente, com a tabela vazia ou pequena.
--   Usar CONCURRENTLY nesta migration faria o Prisma falhar ("cannot run inside a
--   transaction block"); omitir o IF NOT EXISTS faria o deploy em prod quebrar no 1º.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS "transactions_supplierId_idx";
--   DROP INDEX IF EXISTS "transactions_categoryId_idx";
--   -- ⛔ NÃO derrubar transactions_employeeId_idx: ele é de 06/06 e vem de outra migration.

CREATE INDEX IF NOT EXISTS "transactions_supplierId_idx" ON "transactions"("supplierId");
CREATE INDEX IF NOT EXISTS "transactions_employeeId_idx" ON "transactions"("employeeId");
CREATE INDEX IF NOT EXISTS "transactions_categoryId_idx" ON "transactions"("categoryId");
