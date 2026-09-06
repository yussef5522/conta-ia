-- ⭐⭐ A MARCA EXPLÍCITA DE "CONTA DE APARELHO" (06/09/2026) — decisão do dono.
--
-- ⛔ POR QUE ELA EXISTE: a lista de Equipe tentava INFERIR "aparelho" do papel
-- (`EXECUTOR_PRODUCAO`) e, na prova contra os dados reais, chamou uma PESSOA de máquina — o
-- dono tinha criado uma conta de login pra Carlise com esse papel. **O papel diz o ACESSO,
-- não se é gente.** Regra que ficou: *"heurística nunca decide quem é máquina"* — quem marca
-- é o dono, no cadastro.
--
-- ⚠️ A MARCA É DO **ACESSO NUMA EMPRESA**, não da pessoa: a mesma conta poderia ser aparelho
-- numa empresa e não em outra. Por isso mora em `user_company_roles`, e não em `users`.
--
-- ⚠️ ALTERs EM TABELA COM DADOS REAIS:
--   tabela              | operação                     | tipo     | linhas | risco | mitigação
--   user_company_roles  | ADD COLUMN ehAparelho        | aditiva  | 7      | baixo | NOT NULL
--                       | BOOLEAN NOT NULL DEFAULT false                   |       | com DEFAULT:
--                       |                                                 |       | toda linha
--                       |                                                 |       | existente vira
--                       |                                                 |       | `false`, que é o
--                       |                                                 |       | estado de hoje
--                       |                                                 |       | (ninguém está
--                       |                                                 |       | marcado)
--
-- ROLLBACK: ALTER TABLE "user_company_roles" DROP COLUMN "ehAparelho";
ALTER TABLE "user_company_roles" ADD COLUMN "ehAparelho" BOOLEAN NOT NULL DEFAULT false;

-- ⭐ o índice serve à pergunta que a tela faz ("quais acessos desta empresa são aparelho?"),
-- e é PARCIAL porque a resposta é quase sempre "nenhum" — índice cheio custaria por nada.
CREATE INDEX "user_company_roles_aparelho_idx"
  ON "user_company_roles" ("companyId") WHERE "ehAparelho" = true;
