-- ⭐⭐ O TEMA DE CADA USUÁRIO — claro | escuro, default claro.
--
-- ⛔ **CREATE-only, ADITIVA PURA:** uma tabela nova, zero ALTER, zero referência a tabela
-- existente. Rollback = `DROP TABLE "user_tema_preferencia";` (nada mais aponta pra ela).
--
-- ⛔ `userId` é a CHAVE PRIMÁRIA, não um campo com unique: "duas preferências de tema pro mesmo
-- usuário" deixa de ser estado checado e passa a ser IMPOSSÍVEL (REGRA 5).
--
-- ⚠️⚠️ **CHECK na FORMA, NUNCA no vocabulário.** É a cicatriz de 21/09: o
-- `CHECK (lista IN ('CAROS','PORCOES'))` do radar virou PAREDE **um dia depois**, quando o dono
-- pediu a 3ª lista — e migration daquele módulo é CREATE-only, então não havia como afrouxar.
-- Tema é CONFIGURAÇÃO: o dia em que entrar um `'sistema'` (seguir o aparelho) se resolve
-- editando `lib/tema/preferencia.ts`, sem tocar no banco. O que o banco garante é que não entra
-- string vazia nem `'ESCURO'` em caixa alta — as duas formas que fariam a leitura cair no
-- default em silêncio.
CREATE TABLE "user_tema_preferencia" (
    "userId" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_tema_preferencia_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "chk_user_tema_forma" CHECK (
      "tema" <> '' AND "tema" = lower("tema")
    )
);
