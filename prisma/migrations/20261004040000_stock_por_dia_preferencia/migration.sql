-- ⭐ A ESCOLHA DO DONO SOBRE O QUE ELE VÊ — por USUÁRIO, em TABELA.
--
-- ⛔ A régua é a do Real×Teórico (29/09): **nunca localStorage**. localStorage é por NAVEGADOR,
-- e o dono confere no celular e no notebook — a escolha feita num sumiria no outro, e
-- *"salva por usuário" só é verdade se for no banco*.
--
-- ⚠️ CREATE-only (o isolamento do módulo proíbe ALTER em tabela existente), com UNIQUE por
-- (companyId, userId): duas preferências pra mesma pessoa é impossível, não "checado".
-- ⚠️ CHECK na FORMA, nunca no vocabulário: a lista de receitas muda toda semana, e CHECK com
-- vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal — a cicatriz do
-- `lista IN ('CAROS','PORCOES')` que virou parede em UM dia (21/09).
CREATE TABLE "stock_por_dia_preferencia" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ocultas" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_por_dia_preferencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_por_dia_pref_ocultas_json" CHECK ("ocultas" LIKE '[%]')
);

CREATE UNIQUE INDEX "stock_por_dia_preferencia_companyId_userId_key"
    ON "stock_por_dia_preferencia"("companyId", "userId");
