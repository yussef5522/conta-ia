-- ⭐⭐⭐ OS GRUPOS DO RADAR VIRAM DADO DO DONO (RT2 + RT3 da referência, 22/10/2026)
--
-- Até hoje "REVENDA · OS CAROS · PORÇÕES" eram uma CONSTANTE DE TYPESCRIPT
-- (`type Lista = 'CAROS' | 'REVENDA' | 'PORCOES'` em lib/stock/radar/watchlist.ts) com
-- nome e emoji **CRAVADOS NA TELA** (`montarMesa` escrevia 'os caros'/'💰'). O dono não
-- tinha onde renomear nem como criar um grupo novo.
--
-- ═══ ⭐⭐ O QUE **NÃO** NASCE AQUI, E POR QUÊ (o retrato veio antes da 1ª linha) ═══
--
-- ⛔ **A MEMBERSHIP JÁ EXISTE E NÃO SE DUPLICA.** `stock_radar_item (companyId, lista,
-- itemId)` guarda "quais itens o dono acompanha" desde 21/09, com porta única
-- (`listasDoRadar`/`porNaLista`/`tirarDaLista`) e tela de gestão no Radar. Criar uma 2ª
-- tabela de vínculo daria **DUAS verdades** pra mesma pergunta: o dono poria o FRANGO nos
-- CAROS por uma tela e a outra não saberia. ***Reusar não foi economia: é a régua.***
--
-- ⭐ **E É POR ISSO QUE O SLUG É A IDENTIDADE, NUNCA O NOME.** `stock_radar_item.lista`
-- guarda o slug CRU; renomear o grupo **não toca uma linha de membership**. É a lição do
-- `systemSlug='BRIDGE_ENTRY'` (13/08): marcador estável é o que faz o rename ser de graça.
-- Sem isso, "renomear" teria que reescrever N vínculos — e a prova de que o
-- comportamento é idêntico antes==depois deixaria de existir.
--
-- ⛔⛔ **O SLUG É MAIÚSCULO POR OBRIGAÇÃO DO BANCO, não por estilo.** O
-- `chk_stock_radar_item_lista` (21/09) exige `lista = upper(lista)`. Logo um slug
-- minúsculo seria **IMPOSSÍVEL de gravar na membership** — grupo novo nasceria sem poder
-- receber item. O slug de grupo novo é `'G' || upper(cuid)` (ver lib/stock/radar/grupos.ts).
--
-- ═══ ⚠️⚠️ DIVERGÊNCIA DECLARADA DO BRIEF: A AGENDA É COLUNA, NÃO TABELA ═══
--
-- O pedido diz, no item 2, *"gravando em config própria (CREATE-only, porta única)"*, e eu
-- li isso como **tabela separada**. Medindo o conteúdo, ela seria uma tabela 1:1 — colunas
-- disfarçadas:
--   · a agenda é atributo do GRUPO (um grupo, uma agenda), não entidade com vida própria
--   · não existe agenda por usuário, nem duas agendas pro mesmo grupo, nem histórico
--   · com `@@unique(companyId, grupoId)`, o "relacionamento" nunca é 1:N
-- E o custo seria real: **dobraria a superfície da prova REGRA 13** e a porta passaria a
-- escrever em duas tabelas no mesmo gesto.
--
-- ⭐ A ASSIMETRIA QUE EXPLICA O PRECEDENTE: `stock_compra_config` (16/10) é tabela separada
-- porque `stock_item` **já existia** e ALTER é proibido neste módulo. Aqui a tabela é NOVA,
-- então a config nasce DENTRO dela — com CHECKs próprios e rastro próprio, que é o que
-- *"config própria"* pede de verdade. Se um dia a agenda ganhar HISTÓRICO (quem mudou, de
-- que pra que), isso é uma tabela append-only de RASTRO (o padrão do
-- `stock_item_categoria_trocada`), nunca de ESTADO.
--
-- ═══ ⛔ CHECK VALIDA **FORMA**, NUNCA VOCABULÁRIO ═══
--
-- Nenhum CHECK aqui sabe que existem "CAROS/REVENDA/PORCOES" — e isso é deliberado: em
-- 20/09 eu cravei `CHECK (lista IN ('CAROS','PORCOES'))` e **em UM DIA** ele virou parede
-- quando a 3ª lista nasceu; num módulo CREATE-only, enum fechada no banco custa uma tabela
-- nova a cada valor novo. O vocabulário mora no TypeScript, onde se acrescenta; o banco
-- protege o que NÃO muda (não-vazio, caixa, forma do CSV, coerência da agenda).
--
-- ═══ ⛔⛔⛔ REGRA 13 — E AQUI O FURO É REAL, NÃO TEÓRICO ═══
--
-- `criadoPorId`/`renomeadoPorId`/`agendaDefinidaPorId` são **NULLABLE comparados por
-- CONTEÚDO** — a forma EXATA do `chk_aviso_acao_completa` (04/10), em que
-- `length(trim(NULL)) > 0` avalia pra **NULL** e ***CHECK com expressão NULL PASSA***. Por
-- isso o `IS NULL` vem **EXPLÍCITO e PRIMEIRO** em cada um deles.
--
-- ⚠️ E o `btrim` leva a classe de espaço em branco **ESCRITA POR EXTENSO** (` \t\n\r\f\v`):
-- medido no próprio Postgres em 14/10, `trim()` apara **somente o caractere espaço** por
-- default (`length(trim(E'\t'))` → 1), ao contrário do `String.prototype.trim()` do JS.
-- ***Caractere que não está na lista é caractere que passa.***
--
-- ⭐ E ESTA TABELA **NÃO PRECISA** do trigger `stock_texto_de_escolha()`: ele existe pra
-- consertar CHECK **já aplicado** (que não se reescreve, o checksum do Prisma reprova o
-- deploy). Tabela nova nasce com o CHECK certo, com a classe inteira — o precedente é o
-- `stock_compra_config`, que declarou o mesmo pelo mesmo motivo.
--
-- ROLLBACK: DROP TABLE "stock_grupo_vigiado";

CREATE TABLE "stock_grupo_vigiado" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    -- ⭐ A IDENTIDADE. Vai CRU em `stock_radar_item.lista`; renomear NUNCA mexe nela.
    "slug" TEXT NOT NULL,

    -- o que o dono vê e edita (✎ da tela)
    "nome" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    -- ⭐ a ORDEM das seções na mesa (hoje: revenda · caros · porções, a ordem de LISTAS)
    "ordem" INTEGER NOT NULL,

    -- ═══ a AGENDA DE CONTAGEM (RT3) ═══
    -- ⚠️ CSV SEG-first dos dias (0=SEG … 6=DOM); '' = nenhum dia escolhido.
    -- ⛔ CSV e não `Int[]`: array do Postgres **não existe no SQLite do dev**, e código que
    --    só compila num dos dois bancos é a divergência dev×prod que já custou a busca
    --    case-sensitive (28/08). Quem serializa/parseia é a porta única.
    "agendaTodoDia" BOOLEAN NOT NULL DEFAULT false,
    "agendaDias" TEXT NOT NULL DEFAULT '',

    -- rastro: quem criou/renomeou/definiu a agenda, e quando
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renomeadoPorId" TEXT,
    "renomeadoEm" TIMESTAMP(3),
    "agendaDefinidaPorId" TEXT,
    "agendaDefinidaEm" TIMESTAMP(3),

    CONSTRAINT "stock_grupo_vigiado_pkey" PRIMARY KEY ("id"),

    -- forma: id de empresa, slug, nome ou emoji vazio/só-branco é dado torto entrando por
    -- outra porta (script, lib nova, $executeRawUnsafe) — o caminho que o CHECK cobre
    CONSTRAINT "chk_grupo_vigiado_forma" CHECK (
        length(btrim("companyId", E' \t\n\r\f\v')) > 0
        AND length(btrim("slug", E' \t\n\r\f\v')) > 0
        AND length(btrim("nome", E' \t\n\r\f\v')) > 0
        AND length(btrim("emoji", E' \t\n\r\f\v')) > 0
    ),

    -- ⛔⛔ CAIXA, não vocabulário: o slug tem que ser gravável em
    --    `stock_radar_item.lista`, que exige `lista = upper(lista)` desde 21/09.
    --    Sem isso, grupo novo nasceria sem poder receber UM item.
    CONSTRAINT "chk_grupo_vigiado_slug_caixa" CHECK ("slug" = upper("slug")),

    -- ⭐ FORMA do CSV, não vocabulário: índices 0..6, sem repetir sintaxe, '' permitido
    --    (a mesma régua do `diasChegada` de stock_compra_config)
    CONSTRAINT "chk_grupo_vigiado_dias" CHECK ("agendaDias" ~ '^$|^[0-6](,[0-6])*$'),

    -- ⛔ "todo dia" E uma lista de dias é CONTRADIÇÃO, não um 3º estado — o `<script>` da
    --    referência já desenha isso (`tglTodo` zera os dias). Deixar as duas convivendo
    --    faria o selo ter que ESCOLHER qual manda, e as duas telas escolheriam diferente.
    CONSTRAINT "chk_grupo_vigiado_agenda_coerente" CHECK (
        NOT ("agendaTodoDia" AND "agendaDias" <> '')
    ),

    -- ⚠️ ordem é posição, nunca negativa
    CONSTRAINT "chk_grupo_vigiado_ordem" CHECK ("ordem" >= 0),

    -- ⛔⛔ REGRA 13: o `IS NULL` vem PRIMEIRO e explícito nos três autores. Sem ele o CHECK
    --    avalia pra NULL e um `criadoPorId = '   '` PASSARIA — é o furo exato do
    --    `chk_aviso_acao_completa` (04/10). NULL é LEGÍTIMO aqui (a semeadura não tem
    --    autor; o grupo nunca renomeado não tem quem renomeou).
    CONSTRAINT "chk_grupo_vigiado_criado_por" CHECK (
        "criadoPorId" IS NULL OR length(btrim("criadoPorId", E' \t\n\r\f\v')) > 0
    ),
    CONSTRAINT "chk_grupo_vigiado_renomeado_por" CHECK (
        "renomeadoPorId" IS NULL OR length(btrim("renomeadoPorId", E' \t\n\r\f\v')) > 0
    ),
    CONSTRAINT "chk_grupo_vigiado_agenda_por" CHECK (
        "agendaDefinidaPorId" IS NULL OR length(btrim("agendaDefinidaPorId", E' \t\n\r\f\v')) > 0
    )
);

-- ⭐ UM grupo por slug na empresa: semear 2× é UPDATE, nunca uma 2ª linha (idempotente por
--   construção, não "checado" — dois toques no celular não criam dois grupos que divergem)
CREATE UNIQUE INDEX "stock_grupo_vigiado_companyId_slug_key"
    ON "stock_grupo_vigiado"("companyId", "slug");

-- a leitura da tela é sempre "os grupos DESTA empresa, na ordem", em 1 consulta
CREATE INDEX "stock_grupo_vigiado_companyId_ordem_idx"
    ON "stock_grupo_vigiado"("companyId", "ordem");
