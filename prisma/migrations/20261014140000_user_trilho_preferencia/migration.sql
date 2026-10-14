-- ⭐⭐ A PREFERÊNCIA DO TRILHO — NA MESMA CASA DO TEMA (14/10/2026).
--
-- **Ordem do dono (FRENTE B da fundação):** *"A escolha (fixo aberto ou recolhido) fica SALVA
-- POR USUÁRIO, **na MESMA casa da preferência de tema que já existe** — porta única de escrita,
-- REGRA 13 se houver constraint. Esta é a ÚNICA escrita do sprint inteiro."*
--
-- ⭐ **POR QUE COLUNA E NÃO TABELA NOVA:** ele disse "a MESMA casa", e a casa é esta linha. Uma
-- tabela `user_trilho_preferencia` ao lado seria uma SEGUNDA porta de escrita pra "a preferência
-- de tela deste usuário" — e duas portas pro mesmo fato é a doença que esta casa mais paga (os 7
-- detectores de par, as 2 cópias do FITID, os 3 leitores de "é o mesmo fornecedor?"). Com uma
-- coluna, o upsert na PK `userId` segue sendo UM, e gravar tema e trilho é o mesmo gesto.
--
-- ⚠️ **ALTER permitido AQUI:** a regra CREATE-only é do módulo de ESTOQUE (guard de CI
-- `migration-isolation.test.ts`, que só olha migrations `stock_`). Esta tabela é de
-- configuração do app, nasceu em 05/10 e tem poucas linhas (uma por usuário que tocou o botão
-- de tema). `ADD COLUMN ... NOT NULL DEFAULT` é instantâneo no PG 11+ (não reescreve a tabela).
--
-- ⛔⛔ **REGRA 13 RESOLVIDA PELA AUSÊNCIA DE NULL, não por `IS NOT NULL` no CHECK.** A coluna
-- nasce `NOT NULL DEFAULT 'recolhido'`, então o CHECK **nunca vê NULL** e não há lógica de três
-- valores pra escapar. Se ela fosse nullable, `"trilho" <> ''` com NULL avaliaria pra **NULL** e
-- ***CHECK com expressão NULL PASSA*** — o furo exato do `chk_aviso_acao_completa` (04/10).
-- ⚠️ O DEFAULT é `'recolhido'` porque é o estado que o dono pediu pra nascer: linha antiga
-- (quem já escolheu tema antes de hoje) e linha nova dizem a mesma coisa, e a AUSÊNCIA de linha
-- também — `TRILHO_PADRAO` é `'recolhido'`. **Três caminhos, uma resposta.**
--
-- ⚠️⚠️ **CHECK na FORMA, NUNCA no vocabulário** — a mesma cicatriz de 21/09 que o CHECK do tema
-- já documenta: `CHECK (trilho IN ('recolhido','aberto'))` viraria parede no dia em que o dono
-- pedir um terceiro estado. O vocabulário vive em `lib/trilho/preferencia.ts`. O que o banco
-- garante é que não entra string vazia nem `'ABERTO'` em caixa alta — as duas formas que fariam
-- a leitura cair no default **em silêncio**.
--
-- ROLLBACK:
--   ALTER TABLE "user_tema_preferencia" DROP CONSTRAINT "chk_user_trilho_forma";
--   ALTER TABLE "user_tema_preferencia" DROP COLUMN "trilho";
ALTER TABLE "user_tema_preferencia"
  ADD COLUMN "trilho" TEXT NOT NULL DEFAULT 'recolhido';

ALTER TABLE "user_tema_preferencia"
  ADD CONSTRAINT "chk_user_trilho_forma" CHECK (
    "trilho" <> '' AND "trilho" = lower("trilho")
  );
