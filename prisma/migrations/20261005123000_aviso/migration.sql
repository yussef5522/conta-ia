-- ⭐⭐⭐ A CENTRAL DE AVISOS — a tela que o alarme não tinha.
--
-- ⛔ CREATE-only, ADITIVA PURA: tabela nova, zero ALTER, zero FK pra tabela existente.
-- Rollback: DROP da tabela (nada aponta pra ela).
--
-- ⛔⛔ **A LEI DA LÍNGUA DO BALCÃO VIRA CONSTRAINT, não combinado (REGRA 5).** A ordem do dono é
-- *"aviso sem ação clara NÃO PODE ser criado"* — e enquanto isso fosse uma checagem na lib,
-- o próximo produtor (um guard novo, um script de madrugada) nasceria podendo gravar um aviso
-- mudo. Com o CHECK, **o banco recusa**: título, corpo e "o que fazer" vazios são impossíveis.
-- É a mesma disciplina do `chk_venda_map_alvo` e do CHECK de quantidade do ledger.
--
-- ⚠️ E os CHECKs são de FORMA, nunca de VOCABULÁRIO (cicatriz de 21/09 — o
-- `CHECK (lista IN (…))` do radar virou parede em UM dia): setor e severidade só precisam ser
-- minúsculos e não-vazios. A lista de valores vive em `lib/avisos/tipos.ts`, onde o dia em que
-- entrar um setor novo (`cozinha`, `fiscal`) se resolve editando um array.
CREATE TABLE "aviso" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "severidade" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "oQueFazer" TEXT NOT NULL,
    "acaoRotulo" TEXT,
    "acaoHref" TEXT,
    "origem" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "vezes" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "lidoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),
    CONSTRAINT "aviso_pkey" PRIMARY KEY ("id"),
    -- ⛔⛔ aviso MUDO é impossível: as três frases que o dono exige têm que existir
    CONSTRAINT "chk_aviso_fala" CHECK (
      length(trim("titulo")) > 0
      AND length(trim("corpo")) > 0
      AND length(trim("oQueFazer")) > 0
    ),
    -- ⚠️ botão pela METADE também não: rótulo sem destino é um botão que não leva a lugar
    -- nenhum (a "porta pintada na parede" de 13/09), e destino sem rótulo é link invisível.
    CONSTRAINT "chk_aviso_acao_completa" CHECK (
      ("acaoRotulo" IS NULL AND "acaoHref" IS NULL)
      OR (length(trim("acaoRotulo")) > 0 AND length(trim("acaoHref")) > 0)
    ),
    CONSTRAINT "chk_aviso_forma" CHECK (
      "setor" = lower("setor") AND length(trim("setor")) > 0
      AND "severidade" = lower("severidade") AND length(trim("severidade")) > 0
      AND length(trim("origem")) > 0 AND length(trim("alvo")) > 0
      AND "vezes" > 0
    )
);

-- ⭐⭐ O ANTI-SPAM É ESTRUTURAL: o MESMO problema (origem + alvo) ATUALIZA a linha existente.
-- "Dedupe por origem+alvo" deixa de ser disciplina do produtor e passa a ser impossibilidade —
-- 10 rodadas do juiz sobre o mesmo defeito dão 1 aviso com `vezes = 10`, nunca 10 avisos.
CREATE UNIQUE INDEX "aviso_companyId_origem_alvo_key" ON "aviso"("companyId", "origem", "alvo");

CREATE INDEX "aviso_companyId_setor_resolvidoEm_idx" ON "aviso"("companyId", "setor", "resolvidoEm");
