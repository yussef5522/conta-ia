-- ⛔⛔⛔ O CHECK DA PREFERÊNCIA DEIXAVA PASSAR SÓ-ESPAÇO — ACHADO PELA PRÓPRIA PROVA (14/10/2026)
--
-- **A REGRA 13 pagou no mesmo dia em que foi obedecida.** `scripts/prova-check-trilho.ts` rodou
-- contra o Postgres de prod e devolveu **5 de 6** recusados:
--
--   ⭐ recusou "trilho VAZIO"            pela chk_user_trilho_forma
--   ⛔⛔ ACEITOU "trilho só ESPAÇO"      — o CHECK não morde!
--   ⭐ recusou "trilho em CAIXA ALTA"    pela chk_user_trilho_forma
--
-- **A CAUSA, medida:** `"trilho" <> ''` é **true** pra `'   '`, e `'   ' = lower('   ')` também.
-- A forma fraca só pega a string VAZIA; três espaços passam pelas duas metades.
--
-- ⚠️⚠️ **E O ESTRAGO É EXATAMENTE O QUE A MIGRATION DE HOJE DIZ QUE O CHECK EXISTE PRA IMPEDIR:**
-- *"o que o banco garante é que não entra string vazia nem 'ABERTO' em caixa alta — as duas
-- formas que fariam a leitura cair no default **em silêncio**"*. Só-espaço é uma **TERCEIRA
-- forma**, e ela cai no default calada: `normalizarTrilho` apara e devolve `'recolhido'`. O
-- usuário fixaria o trilho aberto, o banco guardaria `'   '`, e o trilho nasceria recolhido pra
-- sempre — sem erro em lugar nenhum. *CHECK que não morde é pior que CHECK nenhum, porque dá
-- confiança falsa.*
--
-- ⭐⭐ **O IRMÃO VAI JUNTO (REGRA 4).** `chk_user_tema_forma` (05/10) tem a **mesma forma** e o
-- **mesmo furo**, na **mesma tabela** — a prova confirmou que ele recusa vazio e CAIXA ALTA, e
-- ele aceitaria só-espaço igual. Corrigir um e deixar o vizinho é a doença que esta casa mais
-- paga (os 7 detectores de par, as 2 cópias do FITID, o E2 que contava linha crua): *corrigir
-- N−1 é pior que não corrigir nenhum, porque metade fica certa e nada avisa.*
--
-- ⛔ **MIGRATION NOVA, NUNCA REESCREVER A DE HOJE** — a `20261014140000` já está aplicada em
-- prod (`_prisma_migrations.finished_at` preenchido) e o checksum do Prisma reprova o deploy se
-- o arquivo mudar (a cicatriz de 04/10).
--
-- ⚠️ **O `IS NOT NULL` ENTRA MESMO COM A COLUNA `NOT NULL`, e é de propósito.** Hoje ele é
-- redundante — `length(trim(NULL))` é NULL e ***CHECK com expressão NULL PASSA***, mas a coluna
-- não aceita NULL, então não há furo (a prova mede isso: `is_nullable=NO` nas duas). Ele fica
-- como **cinto que custa zero**: no dia em que alguém tornar a coluna nullable, a migration que
-- fizer isso **não vai lembrar de revisar este CHECK**, e aí o furo do `chk_aviso_acao_completa`
-- (04/10) renasceria aqui.
--
-- ⚠️ **ZERO BACKFILL — medido antes:** nenhuma linha em prod está com só-espaço (as 2 linhas
-- existentes têm `tema` e `trilho` normais), então o `ADD CONSTRAINT` não tem o que recusar. Se
-- houvesse, o ALTER falharia e seria a notícia certa (em vez de validar o que a régua proíbe).
--
-- 📋 **FICA REGISTRADO, NÃO CORRIGIDO — e a restrição é estrutural:** dois CHECKs do módulo de
-- ESTOQUE têm a mesma forma fraca — `chk_stock_radar_item_lista` (21/09) e
-- `chk_venda_ignorado_nome` (23/09). **Eles NÃO têm como ser corrigidos por ALTER**: o guard de
-- CI `lib/stock/__tests__/migration-isolation.test.ts` reprova `ALTER TABLE` em qualquer
-- migration `stock_`, e o artefato É o `.sql`. O estrago medido em cada um é inerte hoje —
-- `lista` com só-espaço não casa nenhuma das listas (`CAROS`/`PORCOES`/`REVENDA`) e o item fica
-- invisível no Radar; `nomeSuitable` entra num índice único e viraria uma linha que nunca casa
-- com nome nenhum do PDV. Nos dois casos a porta de escrita normaliza antes de gravar, então o
-- caminho da aplicação não produz o estado. Decisão do dono se vale um sprint.
--
-- ROLLBACK (volta à forma fraca, que é o estado de hoje em prod):
--   ALTER TABLE "user_tema_preferencia" DROP CONSTRAINT "chk_user_trilho_forma";
--   ALTER TABLE "user_tema_preferencia" DROP CONSTRAINT "chk_user_tema_forma";
--   ALTER TABLE "user_tema_preferencia" ADD CONSTRAINT "chk_user_trilho_forma"
--     CHECK ("trilho" <> '' AND "trilho" = lower("trilho"));
--   ALTER TABLE "user_tema_preferencia" ADD CONSTRAINT "chk_user_tema_forma"
--     CHECK ("tema" <> '' AND "tema" = lower("tema"));

ALTER TABLE "user_tema_preferencia" DROP CONSTRAINT "chk_user_trilho_forma";

ALTER TABLE "user_tema_preferencia"
  ADD CONSTRAINT "chk_user_trilho_forma" CHECK (
    "trilho" IS NOT NULL
    AND length(trim("trilho")) > 0
    AND "trilho" = lower("trilho")
  );

ALTER TABLE "user_tema_preferencia" DROP CONSTRAINT "chk_user_tema_forma";

ALTER TABLE "user_tema_preferencia"
  ADD CONSTRAINT "chk_user_tema_forma" CHECK (
    "tema" IS NOT NULL
    AND length(trim("tema")) > 0
    AND "tema" = lower("tema")
  );
