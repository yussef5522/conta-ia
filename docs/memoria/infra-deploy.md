# Infra, deploy e check-up de saude

> Extraido do CLAUDE.md em 2026-11-04. Backup integral: `docs/memoria/CLAUDE-completo-2026-11-04.md`.
> Ler POR TRECHO (`grep -n` + `sed -n`), nunca inteiro.

## Indice

- 🩺 CHECK-UP DE SAÚDE (28/09/2026) — o mapa antes de otimizar, e o que ele refutou
- ⛔⛔⛔ INCIDENTE 28/08 — LOGIN 500 POR 8 HORAS COM O TRIO VERDE. O GATE PROVAVA PRESENÇA, NÃO SAÚDE.
- ⛔⛔ DEPLOY QUE NUNCA DERRUBA PROD (26/08/2026) — USE `scripts/deploy.sh`
- 🛡⭐⭐⭐ FASE 0 — A CHAVE RESERVA (backup 3-2-1 + disco + os 3 ajustes, 26/10/2026)
- Ordem de deploy (PJ + PF)
- ANTES do pull: descartar o swap-postgres local (senão o pull ABORTA calado).
- ⚠️ O lock é prisma/migrations/migration_lock.toml (NÃO prisma/migration_lock.toml).
- ⭐ INVARIANTES DE INFRA — o juiz olha a máquina também (25/08)
- ⛔⛔ `exit 0` DE SSH QUE CAIU NÃO É PROVA DE DEPLOY (medido 3× em 04-05/11/2026)

---
## ⛔⛔ `exit 0` DE SSH QUE CAIU NÃO É PROVA DE DEPLOY — medido 3× em 04-05/11/2026

**O sintoma:** rodei `ssh root@198.211.103.10 'cd /opt/conta-ia && bash scripts/deploy.sh …'`
e o comando voltou **sem saída nenhuma** — arquivo de log com **0 byte** — e, quando
terminou, com **`exit code 0`**. A causa, lida depois no output do próprio wrapper:

```
Read from remote host 198.211.103.10: Operation timed out
client_loop: send disconnect: Broken pipe
[exited with code 0]
```

O `deploy.sh` **seguiu rodando no servidor**; quem morreu foi o canal SSH. O `0` é do
wrapper quebrado, não do deploy.

⛔⛔ **Por que isso é perigoso:** o zero parece sucesso. Se eu o tratasse como prova, teria
declarado *"deploy 4/4 verde"* sem ter lido gate nenhum — e **deploy cujo gate eu não li é
deploy não provado**. ⛔ E nos **três** casos o deploy de fato tinha dado certo — é
justamente isso que torna o zero perigoso: o hábito se forma com o falso positivo e cobra o
preço no primeiro dia em que o build falhar.

⚠️ **E não é intermitência de um dia ruim: são 3 casos, todos com a MESMA assinatura** (duas
linhas de `Operation timed out` / `Broken pipe` e `exit code 0`), em deploys diferentes:
`a626e040`, `a6fc4ec9` e `f4878f6e`. ***Trate como o comportamento normal de comando longo
via SSH, não como acidente.***

⭐ **A mitigação, VALIDADA EM CAMPO:** disparar com o log **em arquivo no servidor** e ler o
gate de lá, nunca do stdout do SSH. No 3º caso (`f4878f6e`, 05/11) o canal caiu **de novo** e
**não custou nada** — o `deploy.sh` seguiu rodando, escreveu o log, e o gate 4/4 (BUILD_ID
`UEZ8Jwy_oZLPAvHAQKU6L`) foi lido de `/tmp/deploy-fila.log`. *A mitigação deixou de ser
hipótese: ela já salvou um deploy real.*

```bash
ssh root@198.211.103.10 'cd /opt/conta-ia && nohup bash scripts/deploy.sh > /tmp/deploy-<tema>.log 2>&1 &'
# depois (o SSH pode cair de novo — não importa):
ssh root@198.211.103.10 'grep -E "1/4|2/4|3/4|4/4|DEPLOY OK|FALHOU" /tmp/deploy-<tema>.log'
```

⚠️ E se o log tiver sumido ou a sessão tiver caído antes de escrever: rodar o **gate 4/4 na
mão**, com os comandos literais de `scripts/deploy.sh` (hoje nas linhas 232-267) — BUILD_ID
servido == buildado · pm2 `online` com o MESMO pid depois de 10s · TODOS os CSS do HTML em
200 vindos do build novo · POST no login com credencial inválida → **401**. Foi o que fiz em
04/11 no deploy `a626e040` (o log tinha voltado com **0 byte**), e o gate passou — mas por
medição, não por fé no `exit 0`.

⚠️ **Corolário para migrations:** o deploy imprime *"schema do banco em dia"* e isso **não
substitui olhar a tabela**. Em 04/11 (`a6fc4ec9`) fui conferir no banco:
`_prisma_migrations` com a linha registrada, colunas e índices presentes. *Rótulo não é
prova* — a cicatriz do próprio `deploy.sh:101` é exatamente uma migration não aplicada com
gate 4/4 verde.

---
## 🩺 CHECK-UP DE SAÚDE (28/09/2026) — o mapa antes de otimizar, e o que ele refutou

**O dono:** *"páginas às vezes demoram e ficam no «carregando». Quero o mapa ANTES de qualquer otimização."*

**⭐ A MÁQUINA ESTÁ FOLGADA E NÃO PRECISA CRESCER** (nenhum número pede): disco **13%** (15 de 116 GB) · RAM **777 MB de 3.915** · load **0.00/0.03/0.12** em 2 vCPUs · pm2 **54 MB**, 0 restart instável, **0 OOM kill em 113 dias** · banco **68 MB** com cache hit **99,98%** (cabe inteiro na RAM) · 16 conexões de 100. ⚠️ Swap **105 MB** em uso — abaixo do alarme N1 (256), mas não é zero.

**⭐⭐ O BANCO NÃO É O GARGALO — NEM PERTO.** `EXPLAIN ANALYZE` nas duas piores: o where dos 4 cards de Contas a Pagar em **1,2 ms** e o universo do Fluxo em **1,1 ms**, as duas por índice. As 27 colunas indexadas de `transactions` cobrem os where novos.

### ⛔⛔⛔ O GARGALO É REDE E PROTOCOLO — e a conta fecha

```
o servidor responde a página em      40 ms   (medido de dentro)
o navegador recebe o 1º byte em     563 ms   (medido de fora, como o dono)
RTT Brasil → Nova York: 143 ms  ·  handshake TLS: 297 ms
```
Cada tela pede **22 recursos** (319 KB gzip) e só então hidrata e dispara as chamadas de API. **Estimativa: 2,5–3,5 s no desktop; 5–8 s no celular em 4G** — com o servidor respondendo em 40 ms.

### ⭐⭐⭐ HTTP/2 — LIGADO, e o caminho até o número certo é a lição

**Ele passou por três veredictos no mesmo dia, e os dois primeiros eram MEUS ERROS DE MÉTODO.**

**1ª medição (errada) — forçando o protocolo nos dois lados:**
```
curl --http1.1  1.181 ms      curl --http2  1.335 ms   ← "h2 é 11% PIOR"
```
Com base nisso o dono mandou reverter, e eu revertei.

**⚠️⚠️ A RE-MEDIÇÃO DO ROLLBACK DENUNCIOU O VIÉS.** Pedido pra confirmar que voltara ao baseline, o número só batia **forçando**:
```
--http1.1 FORÇADO     1.193 ms   ← bate com o baseline ✓
negociação NATURAL    1.480 ms   ← +287 ms, MESMO servidor, MESMO protocolo
```
**287 ms ≈ um handshake TLS**, e o `-v` mostra a causa: `ALPN: curl offers h2,http/1.1` → `server accepted http/1.1`. ⭐ **O cliente espera a 1ª conexão negociar pra saber se precisa abrir as outras 5** — se fosse h2, uma bastaria. **E o navegador faz exatamente isso.** Ou seja: *forçar o protocolo mede um cenário que o navegador nunca vive* — e foi assim que eu recomendei e desrecomendei a mesma coisa.

**2ª medição (a certa) — natural × natural, com CONTROLE DE DRIFT (A-B-A'):**
```
A   h2 DESLIGADO  1.493 ms  (negociou 1.1)
B   h2 LIGADO     1.346 ms  (negociou h2)
A'  h2 DESLIGADO  1.480 ms  ← a rede NÃO driftou: a comparação é sólida
                  ─────────────────────────
⭐ h2 GANHA ~140 ms (9,4%)  →  FICA LIGADO
```
⭐ **O A' é o que torna o número defensável.** Sem ele, 1.493 × 1.346 poderia ser só a rede mudando entre duas medições — e foi falta desse rigor que produziu os dois veredictos errados antes.

⚠️ **Por que o h2 ganha aqui, ao contrário do que a 1ª medição dizia:** ele não economiza no *transporte* (com 22 recursos pequenos, as 6 janelas TCP do 1.1 competem bem) — economiza os **5 handshakes TLS** que o 1.1 precisa abrir depois de descobrir que não tem multiplexação. **O ganho está na negociação, não na transferência**, e só aparece quando se mede como o navegador vive.

**Estado final provado:** `curl -I` → **HTTP/2 200** · `/login` 200 · `/` 200 · ⭐ e o **`$request_time` intacto** (`rt=0.015 urt=0.015` na última linha) — os R1/R2 seguem com o que medir.

### ⛔⛔ E APARECERAM OUTLIERS DE ~40 SEGUNDOS — só em paralelo

Dois em ~20 rodadas (**10%**), e **0 em 25 requisições sequenciais**. O servidor **não** tem rate limit, fail2ban nem falta de conexão (`worker_connections 768`, 30 estabelecidas). A assinatura bate com **retry de SYN perdido** (1+3+7+15 s ≈ 40 s) quando várias conexões abrem de uma vez. ⚠️ **Não consigo provar de onde vem** — pode ser a minha rede, o caminho, ou o NAT. *É exatamente o "às vezes" do sintoma*, e é por isso que o item 2 existe: agora fica gravado.

### ⭐⭐ R1/R2 — A LENTIDÃO PASSA A FICAR GRAVADA E VIGIADA

**⛔ O buraco que isto fecha:** o nginx usava o `combined` padrão, **sem `$request_time`** — *"as páginas às vezes demoram"* **não existia em lugar nenhum**, e o check-up teve que **simular** requisições. Agora: `log_format comtempo` (o combined INTEIRO + `rt=`/`urt=`, nada do que já era lido se perde) + **`lib/infra/rotas-lentas.ts`** no juiz das 3h — **R1 (erro)** rota com p95 > 2 s em 20+ chamadas · **R2 (aviso)** rota com >5% de 4xx em 50+.

- ⛔ **linha sem `rt=` é IGNORADA, nunca contada como zero** — log antigo diluiria o p95 e daria **verde por diluição**.
- ⛔ **a rota é NORMALIZADA** (`/empresas/<id>/…`), senão cada id vira uma "rota" e nenhum percentil junta chamadas que signifiquem algo.
- ⚠️ **R2 é AVISO de propósito:** 4xx pode ser a trava de permissão **funcionando**; erro deixaria o e-mail vermelho por comportamento correto, e aí o dono para de ler (os 111 falsos de 26/08).
- ⭐ **E é honesto sem dado:** `linhasComTempo: 0` faz o juiz dizer *"sem dado"* em vez de calar — *silêncio lido como saúde* é a doença que ele existe pra não ter.

**⚠️⚠️ E OS TESTES CORRIGIRAM A MINHA ARITMÉTICA:** eu escrevi uma fixture com **1 outlier em 20** esperando que acendesse. Não acende, **com razão** — 1/20 é *exatamente* 5%, o limite do p95. **O guard pega "1 em cada 20 ou pior"**, e isso está escrito no arquivo em vez de eu prometer que ele vê tudo. *(Os travamentos medidos foram 2 em 20 = 10%, dentro do alcance.)*

**⭐ PROVADO EM PROD na 1ª rodada**, contra o log real (682 requisições): top 5 por p95 impresso, e o **R2 acusou sozinho** *"/api/dashboard/badges: 67% das 57 chamadas voltaram 4xx"*.

### ⛔ O BADGE LEVAVA 403 A CADA 60 s — 17% DE TODO O TRÁFEGO

**Medido no log:** **1.391 respostas 403/dia** do `/api/dashboard/badges` + 39 do `retiradas-pendentes`, de **um IP só** — a máquina do estoque, com o `OPERADOR_ESTOQUE` logado (ele tem `stock.*`, a rota exige `transaction.view`). ⭐ **Não travava tela** (o hook faz `if (!res.ok) return`, best-effort), mas eram ~1.430 requisições/dia queimadas **e ruído que esconderia problema de verdade** — o R2 gritaria isso todo dia.

⭐ Agora o badge só é chamado por quem tem a permissão. ⛔ **"Ainda não sei" (permissões carregando) NÃO vira "pode"**: chutar custaria 1 403 por carregamento de página — *badge é enfeite, aparecer 200 ms depois não custa nada; cobrar porta fechada, sim*. ⚠️ `usePermissoes` subiu ~90 linhas (hook só lê o que já foi declarado), os dois seguem no topo do componente — **REGRA 9** travada em teste.

⚠️ **A cadência revelou outra coisa:** 4-5 403 por minuto = **~4-5 abas do app abertas** naquela máquina, cada uma com o seu polling.

**REGRA 11 — 5 becos repostos, todos vermelhos.** ⚠️ 1 guard de 30/06 reapontado (ancorava no **nome da variável**, que mudou — *grep não distingue "renomeei" de "quebrei"*) e ficou **mais forte**: passou a exigir o gate.

**11.022 verdes · TS 0 · deploy 4/4 (`VSg-wTKOB5LF4_OKQZkjX`) · Δ bundle +0 KB.**

### 📋 REGISTRADO, NÃO CONSTRUÍDO (ordem do dono)

- **FLUXO DE CAIXA — sprint seguinte.** A rota leva **760 ms** e a causa está medida: ela carrega **7.239 linhas / 2.994 KB de seis meses** pra desenhar um gráfico de **6 barras** (12 números). A query sozinha são **878 ms**; agrupar e montar a série custam **46 ms**. ⚠️ Não é um `groupBy` cru: o `serieMensal` aplica a régua do `entradaInformativa` (liberação de empréstimo **não** é entrada), que depende do vínculo — então é agregado **+** uma consulta pequena pras informativas.
- **MIGRAÇÃO DE SERVIDOR — NÃO fazer, NÃO planejar.** Fica só registrado que existe: o servidor está em **nyc1** e o RTT de **143 ms** cairia pra ~10-20 ms em São Paulo, valendo em *toda* requisição. **Só se a lentidão continuar depois dos itens 1-4**, e só com o dono pedindo.
- **`pg_stat_statements`** está *disponível* e **não instalado** — exigiria `shared_preload_libraries` + **restart do Postgres**. Não feito, e pelo que foi medido não mudaria o veredito (o banco responde em 1 ms).
- **Achado do R1 na 1ª rodada, abaixo do mínimo de amostra:** `/api/empresas/<id>/estoque/recebimentos/<id>/confirmar` com **p95 4,84 s** em 2 chamadas — é o confirmar de conferência de nota (cria itens, movimentos e evento SEFAZ numa transação). Não acendeu (2 < 20 chamadas), e **está certo que não tenha acendido**; fica de olho.

**ROLLBACKS ANOTADOS (as duas mudanças de servidor deste dia):**
```
HTTP/2:     cp /etc/nginx/sites-available/caixaos.conf.bak.pre-http2-20260928-143527 \
               /etc/nginx/sites-available/caixaos.conf && nginx -t && systemctl reload nginx
            (a linha antiga, 4×:  listen 443 ssl;)
$request_time: cp /etc/nginx/nginx.conf.bak.pre-request-time-20260928-145024 \
               /etc/nginx/nginx.conf && nginx -t && systemctl reload nginx
            (a linha antiga:  access_log /var/log/nginx/access.log;)
```

### ⛔⛔⛔ UMA RÉGUA, TODOS OS ANDARES — O GESTO TERMINA O SERVIÇO (27/09)

**O dono:** *"Concilio pelo gesto 🏦/💳/📈 e a transação fica «Sem categoria · Pendente» na tela de Transações — mas o Fluxo já mostra ela como «Parcela de empréstimo» lendo o vínculo. **Dois andares lendo réguas diferentes: um sabe, o outro cobra.**"*

**OS CASOS, medidos por id:** `LIQUIDACAO DE PARCELA-C41033828` (R$ 2.665,44) e `AMORTIZACAO CONTRATO-C41033828` (R$ 7.568,91), 25/09 — as duas vinculadas à **parcela #22 pela porta N:1**, as duas `PENDING` + `categoryId: null`. **O universo: 58 linhas** (48 de empréstimo, 10 de fatura), **R$ 192.679,93**.

**⭐⭐ A RÉGUA JÁ EXISTIA — em `comoFoiResolvida` (a caixa), com as travas certas.** O que faltava era ela ter **DONO** e os outros andares a consumirem: o Fluxo tinha a própria cópia e a tela de Transações não tinha nenhuma. `seloDoSistema` é a porta única; os três delegam. *Três andares, uma pergunta — a lição do B1 em forma de rótulo de tela.*

**⛔⛔ E A DELEGAÇÃO APERTA O FLUXO, não afrouxa:** lá era `if (l.isCardPayment)` **sem exigir o vínculo** — a régua VELHA, que 20/09 já tinha corrigido na caixa (*a flag diz "parece", o vínculo diz "é"* — foi confiar nela que deixou a fatura do Carter **OPEN com o pagamento dela no extrato**). **Medido antes de trocar: 0 linhas com a flag sem vínculo** — nenhum número se move hoje; o que muda é a divergência deixar de ser possível amanhã.

**⭐ O CARIMBO É O `status`, E O RÓTULO É DERIVADO** — e a decisão sai da própria frase dele: *"não é categoria de despesa que eu escolho, é o vínculo falando"*. **Três razões medidas** (escritas em `selo-do-sistema.ts`): categoria gravada viraria **tag fantasma** em relatório por categoria — é por isso que o `applyTransferCandidate` **zera** o `categoryId` desde 06/08, e medi **256 transferências** nesse estado, de propósito; **campo gravado envelhece** (se o vínculo for desfeito, ela mentiria — a doença da `CreditCardInvoice.status`); e o **DRE já trata os três sem categoria**, por fontes que não mentem (`paidInterest`, a competência da compra, `nonDreGroups` — o contrafactual de 25/09). Inventar categoria arriscaria contar a despesa **2×**.

**⭐ E O CARIMBO MORA NO CHOKE-POINT** que envolve o `switch`, pelo mesmo motivo do audit: são **11 ações**, e dentro dos ramos o próximo gesto nasceria sem carimbo (*"N caminhos, 1 esquecido"*). Ele é **derivado do vínculo que o gesto deixou**, nunca da intenção da ação — gesto que não vincula não é afetado, e o gesto NOVO é carimbado **de graça** (REGRA 5). ⚠️ **Fail-soft, mas nunca silencioso:** o gesto já gravou quando o carimbo roda; a falha entra no **efeito** e no **audit**, e o retroativo (idempotente) conserta.

**⛔⛔ O DEGRAU QUE IMPEDE O DEFEITO DE VOLTAR SOZINHO:** `enforceStatusLadder` roda no fim de **todo** create/update (a defesa em profundidade de 29/06) e devolvia `PENDING` pra toda linha sem categoria — então **mudar a descrição** de um pagamento de empréstimo o devolveria pra *"Pendente"*, **em silêncio**. O contexto ganhou `temVinculoDeGesto` **OBRIGATÓRIO** (opcional seria `undefined` = "sem vínculo", o default errado): o **`tsc` achou os 4 chamadores**, a REGRA 4 de graça.

**⚠️⚠️ E A PREMISSA DO PEDIDO PRECISOU DE UMA CORREÇÃO MEDIDA:** o dono disse que as 2 linhas estavam *"inflando o A CLASSIFICAR (27.226,67 / 22)"*. **Não estavam.** O número dele bate exato com o balde do Fluxo (24.226,67 saída + 3.000 entrada, 22 lanç), mas o Fluxo **já** rotulava as duas como *"Parcela de empréstimo"* — as 22 são outras linhas, que **realmente** esperam a palavra dele. ⭐ O item 3 do pedido já estava atendido **naquele** andar; quem cobrava era a tela de Transações.

### ⛔⛔ E EU ESTREITEI A FILA SEM QUERER — achado e consertado antes de chegar no dono (27/09)

A 1ª versão do fix trocou `isCardPayment: false` por **`businessCreditCardId: null`** em `NEEDS_REVIEW_WHERE_PRISMA` — o que exclui **TODA linha de cartão, inclusive as COMPRAS**, que são justamente as que esperam categoria. A régua antiga mantinha as compras na fila; eu a estreitei. **Medido em prod na hora: 0 compras de cartão sem categoria na Caçula hoje** — nada sumiu de fato, mas a **próxima fatura importada** teria compras invisíveis. ⭐ Agora sai da fila o **PAGAMENTO com vínculo**, nunca a compra (a mesma condição do `seloDoSistema`). *Defeito latente medido é defeito consertado; latente não medido é o que volta em três meses.*

⚠️ A fila também ganhou **aporte** e **liberação**, que ninguém tinha acrescentado (nasceram em 25/09 e 26/08) — *lista de exclusão que envelhece é o que faz a fila cobrar o que já foi decidido*.

**PROVADO EM PROD, pelas rotas reais, nos DOIS viewports (REGRA 12):**
```
ANDAR 1 · TRANSAÇÕES (rota 200) — os 2 casos do dono
  R$ 2.665,44 «LIQUIDACAO DE PARCELA-C41033828»
     status: RECONCILED · categoria: (nenhuma — por desenho)
     ⭐ selo: «Parcela de empréstimo» · contrato C41033828-8 · parcela 22 · pelo sistema
  R$ 7.568,91 «AMORTIZACAO CONTRATO-C41033828»   idem

ANDAR 2 · FLUXO · setembro   «Parcela de empréstimo» 7 · R$ 81.184,57
                             «Fatura de cartão (paga)» 3 · R$ 14.721,67
ANDAR 3 · A FILA             0 com vínculo de gesto ✓ o número é honesto
⛔ INVARIANTE: linhas com vínculo ainda "Pendente": 0 ✓

RETROATIVO (preview → pg_dump → aplicar): 58 carimbadas · 0 sobrando
   48 parcela de empréstimo R$ 138.152,85 · 10 fatura R$ 54.527,08
   ⛔ nenhuma categoria criada nem gravada

celular 200 em 77ms · desktop 200 em 69ms · 1.007 KB
  ✓ `.selo.rotulo` · `.selo.detalhe` · `.selo.pelo` · o badge «Resolvida»
```

**REGRA 11 — 7 becos repostos, todos vermelhos:** o gesto sem carimbar (**3**) · o Fluxo voltando à flag (**2**) · a fila pela flag e sem aporte/liberação (**3**) · a escada ignorando o vínculo (**1**) · o selo aceitando a flag (**1**) · o carimbo sobrescrevendo o `IGNORED` do dono (**1**) · a fila excluindo toda linha de cartão (**2**).

**⚠️ 3 TESTES AJUSTADOS E 1 MOCK CORRIGIDO, todos com o motivo escrito** — e o mock é o mais instrutivo: ele marcava só `isCardPayment` enquanto o motor real grava **`businessCreditCardId` + `paidInvoiceMonth`**. ***Mock que simula menos que o original aprova a tela que depende do que ele não simula*** — é a lição de 20/09 (*"guard que troca a peça não prova o encaixe dela"*).

**⚠️ E O GUARD `sem-data-fixa-no-futuro` PEGOU O MEU PRÓPRIO TESTE NOVO** (`ate: '2026-09-30'` é uma data que o calendário alcança). Trocado pela régua da casa (`janelaDoMes`). ⚠️ **As sondas da prova erraram 3 vezes**: rodei de `/tmp` (o Node resolve módulo a partir do ARQUIVO, não do cwd), chutei nomes de campo do payload, e procurei `t.selo` num bundle onde **o minificador renomeia a variável** (`e.selo.rotulo`). *Sonda errada dá um vermelho tão convincente quanto um defeito real.*

**10.990 verdes · TS 0 · `pg_dump pre-carimbo-vinculos-20260928-134237` (7,2 MB) · deploys 4/4 (`puYDucmCgOjJikDVJjYw9` e `r-W5NDnu5qyK23f4VAg1R`) · Δ bundle +0 KB.**

### 💰 CONTAS A PAGAR — «PAGAS» CONTA TODAS AS DO MÊS · E O «VENCE HOJE» CHEGOU NA LISTA (26/09)

**⛔⛔⛔ 1. O CARTÃO MOSTRAVA 8,7% DO QUE O DONO PAGOU — medido antes de codar.** Setembro tem **236 contas pagas (R$ 292.743,50)**; o cartão dizia **40 (R$ 25.441,86)**. As outras **196 (R$ 267.301,64)** eram invisíveis nesta tela. *O card respondia "quanto eu paguei sem o banco", que não é a pergunta que ele faz.*

⭐ **E a causa era UMA LINHA, não a régua de recorte:** o `lifecycleScope` da lista carrega `reconciledWithId: null` (a decisão de 28/05, pra a mesma linha não viver em duas telas), e os KPIs de pagas herdavam isso. **É por isso que o guard roda contra BANCO:** um teste puro sobre `whereDoStatus` daria **verde com o defeito vivo**.

**⭐ AS DUAS METADES DERIVAM DO RAMO `PAGA` POR RECURSÃO** — nunca reescritas. É o que faz a **Σ das partes ser sempre o total**, que era o invariante que o dono pediu. E a relaxação vale **só** sob escopo de pagas: nos escopos de aberto a conciliada continua fora, travado em teste (*"linha em duas telas é duplicação"*).

⭐ **A RESSALVA NÃO MORREU — virou o DETALHE:** *"196 conciliadas com o banco · 33 sem vínculo"* na linha pequena do cartão, e o recorte virou **sub-opção do dropdown**. ⛔ E ela é **APENSADA** ao `N contas`, nunca substituta: deixar o detalhe tomar o lugar da contagem abriria a porta pros dois números divergirem.

**⛔⛔ 2. O «VENCE HOJE» NÃO CHEGAVA NA LISTA — E O DEFEITO ERA MEU, DE ONTEM.** O cartão separava; a linha continuava dizendo *"A PAGAR"*. **Não eram duas réguas brigando: era UMA régua com um TRADUTOR CEGO** — o `payableVisualStatus` já era casca sobre `statusDaConta` e colapsava `VENCE_HOJE` em `pending`. Agora o switch é **TOTAL** (estado novo não compila sem par) e a faixa é **âmbar**, entre o azul do a-pagar e o vermelho da vencida.

**⛔⛔ 3. E O CARTÃO NOVO CRIOU UMA MENTIRA DE RÓTULO QUE FOI FECHADA NO MESMO GESTO:** o preset manda `escopo: 'PAGA'` com `status: 'TODOS'`, e o dropdown mostraria *"Em aberto e pagas sem vínculo"* **com as conciliadas na lista**. ⭐ Sob um escopo de pagas ele deixa de perguntar `status` e passa a perguntar **o recorte** — *um controle por pergunta*, a régua da limpeza de ontem. ⚠️ O `ROTULO_PAGAS` continua honesto **onde ele é verdade** (`status=RECONCILED`, caminho pelo qual a conciliada segue excluída).

### ⛔⛔⛔ E A PROVA EM PROD ACHOU A **TERCEIRA** DEFINIÇÃO DE "PAGAS NO MÊS" (26/09)

O bundle trazia **`"Pagas no mês"`** (a saved view) ao lado de **`"Pagas · setembro"`** (o cartão) — e os dois nomes davam números diferentes: a view usava `status: 'RECONCILED'` **sem escopo**, então entregava **33** contra os **229** do cartão. ***Um nome, dois números*** — a doença que este sprint conserta, aparecendo num lugar que ninguém tinha olhado. Agora ela manda o **escopo**, a mesma porta dos cards, e o período próprio sai (o escopo já recorta por `paymentDate`; manter `dataDe/dataAte` seria a 2ª régua de período no mesmo pedido).

⭐⭐ **E A METADE CERTA DOS 5 TESTES INVERTIDOS FOI REALOCADA, não apagada:** eles guardavam a **BORDA DO MÊS** (fevereiro bissexto, janeiro 31, dezembro virando o ano). Quem responde isso agora é a `janelaDoMes` — e é contra ela que a borda é conferida, com o fim **exclusivo** (`< ate`), mais o **mês do BRASIL**. *Remoção sem realocação é perda.*

**⭐ E A DECISÃO GANHOU DONO POR EXIGÊNCIA DA REGRA 11.** O defeito vivia no `where` que a **ROTA** monta, então o guard ficaria **verde com ele reposto**: `baseDosKpisDePagas` é a porta única, o teste executa a MESMA função que a rota chama, e o **contrafactual** da base errada (que devolve 2 em vez de 4) fica no arquivo — senão o dia em que a base de aberto parar de esconder, ninguém saberá que o teste perdeu o sentido.

**PROVADO EM PROD, pelas rotas reais, nos DOIS viewports (REGRA 12):**
```
O CARTÃO «PAGAS · SETEMBRO»   229 contas · R$ 291.965,54
   a linha de baixo: 196 conciliadas com o banco · 33 sem vínculo
   ⛔ Σ das partes == total do cartão ✓ FECHA          (antes o cartão mostrava 33)

CLICANDO CADA ESCOPO — o card diz X, a lista mostra X
   PAGA 229→229 · PAGA_CONCILIADA 196→196 · PAGA_SEM_VINCULO 33→33
   VENCE_HOJE 1→1 · A_PAGAR 84→84 · VENCIDA 25→25
   ⛔ Σ dos três de aberto: 110 · R$ 159.886,28 (o 4º card segue sem dupla contagem)

⭐ LATICINIOS SANTO CRISTO R$ 1.940,59 · vence 2026-09-26 → VENCE HOJE na lista
⭐ e as pagas que estavam INVISÍVEIS aparecem: vandre 216,00 · FRIGORIFICO 1.426,38 …
⭐ «Pagas no mês» (saved view) 229 == o cartão 229 — um nome, um número

celular 200 em 321ms · desktop 200 em 121ms · 1.112 KB
  ✓ o detalhe · ✓ Vence hoje · ✓ bg-amber-500 · ✓ as 3 sub-opções
  ✓ a ressalva viva no dropdown de status
  ⛔ o rótulo velho no cartão · a legenda · o subtítulo · o seletor de mês: MORTOS
```

**REGRA 11 — 6 becos repostos, todos vermelhos:** a rota voltando pra base de aberto (**2 braços**: a declaração e o aggregate) · o `lifecycleScope` excluindo sempre (**4 vermelhos**) · os recortes deixando de derivar do ramo `PAGA` (**2**) · a lista colapsando `VENCE_HOJE` (**4**) · a saved view voltando à régua antiga (**1**).

**⚠️ 1 GUARD REAPONTADO E 7 TESTES INVERTIDOS, todos com o motivo escrito:** a âncora do rótulo do card (a ORDEM dos quatro, que é a régua dele, não mudou — e ele passou a exigir que **a ressalva siga viva** nos dois lugares novos); os 2 de 13/09 que afirmavam o mundo de TRÊS estados (*"hoje → A PAGAR"* e *"3 cores distintas"* → **4**, com a metade certa — *não é VENCIDA, o dia não acabou* — travada num `expect` próprio); e os 5 da saved view.

**⚠️ E A SONDA DA PROVA ERROU DUAS VEZES ANTES DE MEDIR:** rodei o script de `/tmp`, fora do repo, e o `@prisma/client` não resolvia (o Node sobe diretórios a partir do ARQUIVO, não do cwd) — pior, num `until` que virou laço infinito num erro permanente; e chutei os nomes dos campos do payload (`countPendentes`/`total` em vez de `countPendente`/`paginacao.total`), o que imprimiu `undefined` com cara de KPI quebrado. **A terceira armadilha foi o minificador:** o `·` sai como `\xb7` no bundle enquanto o resto fica em UTF-8 cru — a cicatriz de 15/09 (`Sa\xeddas:`) de novo. *Sonda errada dá um vermelho tão convincente quanto um defeito real* — e aqui ela quase me fez reportar 4 frases ausentes que estavam lá.

**10.971 verdes · TS 0 · deploys 4/4 (`4DhWL-zVkBJv-6eEBVzBn` e `x-DcyeOQdnF7soD_8wtWe`) · Δ bundle +0 KB.**

### ⭐⭐⭐ INVESTIMENTOS — O ESPELHO DO EMPRÉSTIMO, DO LADO DO ATIVO (25/09)

**Decisão do dono:** *"CAPITALIZACAO RG e PAGAMENTO CONSORCIO não são despesa nem conta a pagar — são APORTES recorrentes que constroem patrimônio. O espelho do empréstimo: lá a parcela reduz dívida, aqui aumenta ativo."*

**⭐⭐ A MEDIÇÃO MUDOU O ESCOPO ANTES DE EU ESCREVER UMA LINHA — o item 3 já estava atendido.** As linhas **já vinham** categorizadas como `Investimentos`, e `INVESTIMENTOS` **já era um dreGroup NÃO-DRE**. Provado por **contrafactual**, não por inspeção: o DRE de setembro é **idêntico ao centavo** com e sem os R$ 2.214,23, e eles aparecem em `nonDreGroups`. *O que faltava era o CONTRATO, o GESTO e uma linha na lista fechada.*

**1. OS CONTRATOS** (`InvestmentContract` + `InvestmentContribution`, migration **aditiva pura**: 2 CREATE, zero ALTER em tabela com dado). ⭐ O **total aportado é DERIVADO** dos vínculos, nunca gravado — *campo gravado envelhece*, foi assim que a `CreditCardInvoice.status` ficou eternamente OPEN. ⚠️ E o que o dono **declarou** ter pago antes do sistema fica **separado** do que o sistema **viu**: misturar faria a tela afirmar um histórico que ninguém conferiu. ⛔ `transactionId @unique`: a mesma linha virar dois aportes é **impossível**, não checado. ⚠️ Sem total conhecido, "restantes" é **`null`** — 0 se leria como *"acabou"*.

**2. O GESTO 📈** na fileira de caminhos, com menu de **contrato · valor da parcela · quanto já aportei** (listar só o nome repetiria o defeito do menu de cartão que a manhã de hoje consertou). **O palpite exige VALOR EXATO + sinal de NOME**, e ⛔ **empate devolve `null`** — a Caçula tem **dois** títulos de R$ 297,84 debitados no mesmo dia (medido: externalId 590236 e 590237), e escolher um poria o dinheiro no contrato errado. ⚠️ O **dia** é o 3º sinal e decide a **confiança**, nunca exclui: o consórcio dela caiu dia 9, 10 e 11 em meses diferentes.

**4. `INVESTIMENTOS` ENTROU NA LISTA FECHADA** — era por isso que o CONSÓRCIO de R$ 1.478,51 estava entre as 18 com o aviso, cobrando um boleto que o consórcio **nunca emite**.

### ⛔⛔⛔ E O ITEM 4 CRIOU A PORTA SEM MAÇANETA — a 11ª volta, pela minha mão

Com a lista fechada certa, a categoria passou a resolver sozinha e **os aportes saíram da caixa**: medido em prod, **14 → 4 linhas**, e o gesto 📈 ficou **inalcançável**.

⭐ **A cura é a régua do CARTÃO (20/09), palavra por palavra:** ***a flag diz "parece", o vínculo diz "é"***. Categoria `Investimentos` sem contrato vinculado é *"parece aporte"*; **com** o vínculo sai com o selo que nomeia onde o dinheiro entrou. ⚠️ **E a diferença que importa:** ela fica na caixa esperando o **CONTRATO**, nunca a NOTA.

**⛔ E O AVISO AINDA COBRAVA A COISA ERRADA** — as 5 linhas voltaram dizendo *"casa com a nota ou confirma que não tem"*. É a lição de 16/09 (*"mensagem que acusa o campo errado faz o dono caçar um erro que não existe"*) **na frase que eu acabei de pôr na tela**. A régua do aviso saiu de **inline na rota** pra função pura (*regra que mora numa rota é regra que ninguém prova*) e virou **por caso**: aporte pede contrato, fornecedor pede nota, salário não pede nada.

### ⛔⛔⛔ DOIS GESTOS NASCERAM QUEBRADOS EM PROD — e só a prova NAVEGANDO pegou

O `z.enum` da rota `/resolver` repetia a lista de ações **à mão**, e quem acrescentava gesto na lib não sabia disso. Medido **com controle**:
```
AVULSA_CONFIRMADA   (25/09) → 400 "Gesto inválido"          ⛔ NUNCA funcionou
APORTE_INVESTIMENTO (25/09) → 400 "Gesto inválido"          ⛔ idem
IGNORAR (no enum)           → 422 "linha não encontrada"    ⭐ chega na lib
```
⚠️⚠️ **Ou seja: o *"é despesa avulsa — não tem nota"* de ontem nunca funcionou** — o dono clicaria e levaria *"Gesto inválido"*. **E os testes não pegavam porque chamam `resolverLinha` DIRETO, por cima do zod** — *"testar a lib não prova o encaixe da rota"* (23/09), a **3ª ocorrência** desta classe. ⭐ Agora o enum **DERIVA** de `TODAS_AS_ACOES`: gesto fora do schema é **impossível** (REGRA 5).

### ⛔⛔ E O `@@map` QUE FALTAVA — um defeito que SÓ APARECE EM PROD

A migration criava `investment_contracts` (snake_case, como todo o schema) e os modelos não declaravam `@@map`, então o Prisma procurava `public.InvestmentContract`. ⚠️ **O dev não pega por construção:** `db push` cria a tabela com o nome do **modelo**; o SQL da migration só roda em **prod**. ***É a mesma classe do `contains` case-sensitive (08/09): funciona em dev e falha calado em prod.***

⭐ **Guard novo fecha a classe** (`modelo-e-tabela-batem.test.ts`): todo modelo aponta pra uma tabela que alguma migration cria. Medido no repo inteiro — **157 modelos, 0 divergências** —, então nasce **sem allowlist**.

**PROVADO EM PROD, pelas rotas reais, nos DOIS viewports (REGRA 12):**
```
PAGE /investimentos  celular 200 em 246ms · desktop 200 em 46ms
⭐ os 5 aportes VOLTARAM pra caixa, cada um com o 📈 na fileira e o aviso CERTO:
   "falta dizer em qual contrato este dinheiro entrou — escolha no 📈 aporte em investimento"
   R$ 1.478,51 «PAGAMENTO CONSORCIO» → palpite: valor exato · cai por volta do dia 9 · o
                                        nome bate com «Consórcio Banrisul» · parcela 2026-09
   R$ 70,02 ×2 «CAPITALIZACAO RG»    → palpite aceso
   R$ 297,84 ×2                      → ⭐ SEM palpite (dois títulos iguais: "não sei qual é")

O GESTO (endpoint real) → HTTP 200
   {"efeito":"aporte de R$ 1.478,51 no Consórcio Banrisul (2026-09) — já aportado: R$ 1.478,51"}
   a caixa: 5 → 4 aportes · o contrato: R$ 1.478,51 em 1 · último 2026-09
   RASTRO na linha: "aporte no Consórcio Banrisul, parcela de set/2026"

ITEM 3 (contrafactual): despesas operacionais R$ 117.504,57 COM e SEM os aportes ·
   lucro líquido R$ 43.748,82 nos dois · TOTAIS IDÊNTICOS ⭐
   nonDreGroups: INVESTIMENTOS R$ 2.214,23 em 5 transações
```

**REGRA 11 — 7 becos repostos, 7 vermelhos** (a lista fechada · valor parecido · escolher no empate · dispensar o nome · o gesto fora da fileira · a rota sem o campo · o enum digitado à mão). ⭐ **E o TypeScript achou os 3 `switch` que precisavam conhecer o gesto novo** — a REGRA 4 de graça, em vez de grep; o campo `temAporteVinculado` entrou **obrigatório** e o compilador achou a leitura e o teste que faltavam.

**⚠️ E DOIS GUARDS DA CASA PEGARAM DEFEITOS MEUS:** o `return` antes do fetch **sem tocar no estado** (spinner eterno, a classe de 20/09) e o **CNPJ de teste colidindo** — duas vezes, porque eu chutei em vez de conferir; na terceira eu **listei os 157 CNPJs do repo** antes de escolher.

**10.942 verdes · TS 0 · `pg_dump pre-investimentos-20260925-173714.dump` (6,9 MB) · deploys 4/4 (`WWsY-5dIh9Idlyc426UhT`, `SVyVlqS33O3MHpOxgVSI0`, `saybyQJHg5WGpAaZ9wnKI`, `s79_QVYGEisIdjvnZ7bS3`, `KnRsnSxvaEXHjAQyWsZqd`) · Δ bundle +8 KB.**

⚠️ **OS 3 CONTRATOS EM PROD SÃO MEUS, PRA PROVAR O CICLO — os nomes são do dono.** Criei *"Consórcio Banrisul"*, *"Consórcio Banco Caixa"* e *"Capitalização RG 70"* a partir do que o DADO mostrou (valor + dia + conta). **Ele renomeia, acrescenta o 2º título de cada capitalização e informa o total de parcelas.** Apagar é 1 clique enquanto não houver aporte; com aporte, o caminho é **encerrar** (a régua do *"sumir com o item"*, 09/09).

### 📋 ACHADO À PARTE, MEDIDO E NÃO CORRIGIDO — R$ 595,68 de duplicata em julho

Ao mapear os aportes, a contagem por **externalId** (a identidade que o BANCO dá) achou:
```
externalId 590236 → 2 linhas · 01/07 E 02/07 · R$ 297,84 (imports de 01/07 19:20 e 02/07 19:49)
externalId 590237 → 2 linhas · 01/07 E 02/07 · R$ 297,84
```
⭐ **É EXATAMENTE a mania do Banrisul de re-datar linha já publicada**, a mesma classe que o *Tier 1.5* (`fronteira-de-dia.ts`) passou a barrar em **05/09** — e nela o exemplo documentado é a própria `CAPITALIZACAO RG`. A trava vale **dali pra frente**; **as de julho ficaram**. ⚠️ **Cirurgia de dado é decisão do dono** — o mapa está medido e o estorno é pelo caminho de sempre.

⚠️⚠️ **E QUASE REPORTEI UMA DUPLICATA FALSA ANTES DESSA:** a minha sonda rotulava *"FITIDs distintos"* enquanto media `contentHash` (igual por construção, porque data+valor+descrição são iguais). Os pares do MESMO dia têm `externalId` **diferentes** — são dois títulos de verdade. ***Rótulo de sonda que mente produz achado falso tão convincente quanto um real.***

### ⛔⛔⛔ REUNITIZAR O ITEM NUNCA É EFEITO COLATERAL DO RECEBIMENTO (24/09)

**O dono, na nota do ALAN:** *"item da nota «SAL CISNE REFINADO 1KG · 10 UN · R$ 4,79», destino «sal» (controlado em KG). O preview propõe «o item passa a ser controlado em UN» + converter 41 movimentos e 18 fichas + «saldo −0,9 KG → −12,76 UN» (número sem sentido)."*

**⭐⭐ SÃO DUAS PERGUNTAS DIFERENTES, e *"a unidade difere"* não as separa:**
- **a nota veio noutra unidade** (`uCom` ≠ régua do item) → isso é o **FATOR**, e converte **SÓ A ENTRADA**: *1 UN da nota = 1 KG* → entram 10 KG a R$ 4,79/KG, o item continua em KG e as 18 fichas ficam intactas. **É o caso comum, o de todo dia.**
- **o dono CORRIGIU a unidade de entrada** → aí ele está dizendo *"a régua do ITEM está errada"*, e é o caso do QUEIJO (11/09), em que reunitizar é o certo.

A condição da tela era `unidadeEntrada ?? uCom`, que **colapsava as duas** e disparava a proposta de reunitização **toda vez que a nota vinha noutra unidade**. ***Gesto raro e global não pode nascer de um gesto diário.***

**⭐⭐ E A GRAVAÇÃO SEMPRE ESTEVE CERTA** — o `confirmarConferencia` só reunitiza com `aval.corrigida`. **Quem mentia era o PREVIEW**, que é o pior lugar possível pra mentir: é onde o dono decide. É a família *"preview e confirm discordando"* de cabeça pra baixo — a tela prometendo um estrago que a gravação não faria.

**⚠️ E AS DUAS CONDIÇÕES CONCORDAVAM POR ACASO.** Eu conferi os três casos e batiam; **é exatamente assim que a divergência nasce no quarto**. A tela passou a chamar **a mesma função pura do servidor** (`avaliarUnidadeDeEntrada`) — REGRA 4.

### ⛔⛔ O −12,76 INVESTIGADO: ERAM DUAS RÉGUAS DE SALDO NO MESMO CARD

Medido: **−12,76 é a soma CRUA dos 41 movimentos do sal**, incluindo os **19 `PRODUCAO_CONSUMO` (−11,86)** que o saldo **exclui** por serem transferência interna. O `antes` vinha do `saldoItem` (régua da prateleira) e o `depois` somava o plano cru — então, **com fator 1, ou seja SEM MUDAR NADA**, o card anunciava *"−0,9 KG → −12,76 UN"*.

⭐ O `movePrateleira` é o dono único dessa pergunta desde 09/09, e era ele que faltava ali. O `UnidadeDoMovimento` passou a carregar o **`tipo`** — sem ele a régua não tinha como ser aplicada. **Provado em prod: fator 1 agora dá `13,29 → 13,29`.**

### ⛔ E A PORTA DO NEGATIVO NÃO TINHA MAÇANETA DO OUTRO LADO

A recusa manda o dono pra ficha do item dizendo *"corrigir a entrada que faltou"* — e a ficha **não oferecia gesto nenhum**. É a **10ª volta** da família. Agora, com saldo negativo, ela mostra o botão *"lançar a entrada que faltou"* (borda + ícone + verbo — *ação sem afordância não existe no celular*, 30/08), pedindo a **quantidade e o valor VERDADEIROS** da compra que faltou; e a entrada manual **abre com o item já escolhido** (`?item=`), porque perder no caminho a informação que a tela acabou de mostrar é obrigar o dono a procurar de novo entre 159 itens.

**⭐⭐⭐ E O RED-THEN-GREEN ACONTECEU EM PROD PELA MÃO DELE, melhor que a minha simulação:**
```
24/09 13:51  ENTRADA_NF   10 KG · R$ 47,90   (a nota do ALAN: 10 UN × 4,79, fator 1)
24/09 13:53  ENTRADA_NF    5 KG · R$ 13,75   (a 2ª: SAL CBS 1KG, 5 UN × 2,75)
⭐ o item continua em KG · as 18 fichas continuam em KG · saldo −0,9 → 13,29 · R$ 61,43
⭐ o resíduo de −0,22 nem precisou de pergunta: a entrada trouxe valor de sobra (decisão OK)

o preview com fator 1: 13,29 → 13,29 ✓   (antes dizia −0,9 → −12,76)
a contagem depois: conto 2,5 kg → o FREIO PERGUNTA ("89% fora do sistema"), eu respondo
celular ficha 158ms · entrada 53ms    desktop 49ms · 48ms    4/4 frases nos dois
```
**REGRA 11 — 4 becos repostos, 4 vermelhos** (a tela colapsando as duas perguntas · o preview somando o plano cru · a ficha perdendo a maçaneta · a entrada manual ignorando o `?item=`).

⚠️ **Três sondas minhas erraram antes de eu medir:** chamei `previewReunitizar` com um objeto (a assinatura é posicional), inventei a forma do `Ctx` do `explodir`, e comparei `'R$ 4,79/KG'` com espaço comum quando o `Intl` usa **espaço não-quebrável**. **Parei de supor e li a assinatura** — é o que separa *"a sonda está errada"* de *"prod está quebrada"*.

**10.805 verdes · TS 0 · deploy 4/4 (`9CHm5M_5vyXbKmQPrMFTA`) · Δ bundle +4 KB.**

📋 **FICA PRO DONO:** a contagem do sal (o freio vai perguntar, é o desenho) e a **entrada manual retroativa** dos 3 que seguem negativos sem nota por vir — **ervilha −45,48 · arroz −11,5 · feijão −9,34** —, com a quantidade e o valor verdadeiros da compra que faltou. A porta está na ficha de cada um.

### ⛔⛔⛔ ITEM NEGATIVO TRAVAVA O FLUXO ALHEIO — 4 FRENTES (23/09)

**A régua do dono, e ela fecha as quatro:** ***"negativo ACONTECE na vida real; o sistema AVISA e oferece a porta (a compra/produção que falta), mas NUNCA bloqueia fluxo alheio."***

### ⭐⭐ 1. O RECEBIMENTO NÃO ACHAVA O SAL — e a hipótese caiu na medição

**O dono:** *"chegou nota do ALAN com SAL e o recebimento NÃO ACHA o item «sal» pra casar — só criando produto novo. Filtra saldo negativo?"*

**⚠️⚠️ NÃO FILTRA NADA DE SALDO.** Medido em prod, as causas eram **duas, nenhuma a suspeita**:
```
a rota mandava: findMany({ companyId, ativo: true }, take: 300, orderBy: nome asc)
ativos na empresa: 348  →  ⛔ TRUNCOU, e "sal" (minúsculo) cai no fim da ordem
```
**⭐⭐ E A RAIZ É O UNIVERSO QUE NUNCA FOI DECLARADO.** Esta rota nasceu antes da régua de 16/09 (*"cada gesto tem seu universo"*) e ficou de fora do contrato obrigatório. Sem ele a lista traz **189 invólucros de CARDÁPIO** (95 PRODUTO_FINAL + 50 SABOR + 44 INTERMEDIARIO) que **ninguém compra**, e eles comem as vagas: o universo COMPRAVEL tem **159**, e o sal entra.

**⛔ É A TERCEIRA VEZ QUE UM TETO DE LEITURA ESCONDE O ITEM** — o `take: 50` que sumiu com o fermento (16/09), o `take: 200` que sumiu com a ordem do ano 202 (19/09), e agora o `take: 300` do recebimento. ⚠️ **E o modo teste escondia MAIS que a tela real** (`take: 200`): as duas rotas passaram pelo mesmo dono da pergunta.

**⛔⛔ SEGUNDO DEFEITO, ACHADO NO CAMINHO: a busca da conferência era uma SEGUNDA RÉGUA.** Ela fazia `nome.toLowerCase().includes(busca.toLowerCase())` em vez da `casaBusca` da casa, e **diverge no acento**: medido, digitar **`"feijão"`** (como o dono escreve) achava **ZERO** onde a régua da casa acha **2** (`FEIJAO PRETO…`, como a NOTA escreve). É literalmente o bug de 09/09 sobrevivendo nesta tela.

**⭐ E O NEGATIVO APARECE COM AVISO NA LINHA DELE** — *"saldo −0,9 KG, saiu mais do que entrou · esta nota conserta"* —, porque ele é quem **mais** precisa daquela tela. O vazio também passou a dizer o recorte (*"nada com «x» entre os 159 itens que se COMPRAM"*).

**⭐ E A CONFERÊNCIA QUE ELE PEDIU: NÃO NASCEU SAL DUPLICADO.** Existe **1 item** chamado exatamente `sal`, criado em 08/09. Nada a mesclar.

### ⭐⭐ 2. A ENTRADA QUE CRUZA O ZERO LIMPA O RESÍDUO — a régua IRMÃ

`avaliarResiduo` (19/09) responde *"a BAIXA pode levar o resíduo junto?"* e só diz sim **quando a quantidade vai a ZERO**. `avaliarEntrada` responde a oposta: *"a ENTRADA pode limpar o que ficou pendurado?"* — e diz sim **justamente porque a compra que faltava acabou de chegar**. Dentro do teto (o mesmo limite matemático, proporcional ao que saiu sem lastro) **absorve e registra**; acima, **PERGUNTA com a conta na tela**, nunca beco.

**⛔⛔ E O RESÍDUO NÃO ENTRA NO CUSTO DA NOTA.** A baixa absorve somando no `custoTotal` do próprio movimento; aqui isso seria errado **duas vezes**: quebraria o **CHECK do ledger** (`|custoTotal − qtd×custoUnit| ≤ 0,01`) **e o E16** (`Σ(ENTRADA_NF da nota) == Σ(vProd)`) — o documento assinado pela SEFAZ passaria a *valer* 22 centavos a mais. ***A nota é FATO e não se reescreve.*** O ajuste é linha própria (`AJUSTE_RESIDUO`), pelo idioma do `encerrar-item` (0,001 e unitário **derivado** do total).

**⛔⛔⛔ E A FRONTEIRA VEIO DE UM TESTE VERMELHO, NÃO DE UM RACIOCÍNIO MEU.** A 1ª versão valia pra **qualquer** movimento que cruzasse o zero — e **engoliu a porta do negativo** (22/09): a CONTAGEM sobre item negativo passou a perguntar sobre centavos em vez de dizer *"vendeu sem ter produção registrada — contar por cima ENTERRA o lote que ninguém lançou"*. ⭐ A régua do dono é ***"a ENTRADA é o conserto"***: `ENTRADA_NF` · `ENTRADA_MANUAL` · `PRODUCAO_GERACAO` (a própria porta que a recusa oferece) · `DEVOLUCAO_PRODUCAO`. **`AJUSTE_CONTAGEM` fica FORA — contar por cima não é o conserto, é o enterro.**

### ⭐⭐ 3. A FICHA NÃO QUEBRA POR COMPONENTE NEGATIVO

**⚠️ A causa de fundo:** `custoMedio` é `valor/saldo` e **não existe com saldo ≤ 0** — então um item negativo entra na receita **sem custo** e a ficha inteira caía pra *"a definir"*. **O conserto não é inventar custo: é mostrar o parcial e nomear o que falta.**

- **`dá pra fazer` nunca é negativo.** Era `Math.floor(saldo/qtd)` cru: com a ERVILHA em **−45,48** a tela dizia ***"dá pra fazer −4.548"***. Falta é **ZERO**; o que muda é a frase — *"limitado por ERVILHA — em falta"*.
- **o custo mostra o PARCIAL** (*"R$ 10,35 + falta ERVILHA"*). O `custoUnitario` segue `null` (margem inventada é pior que margem ausente), e a **margem parcial vai marcada como TETO** (*"até X% · teto — falta custo de componente"*): o que falta só pode **derrubar**.
- **a linha do componente explica o PORQUÊ** — *"saldo −45,48 — saiu mais do que entrou, por isso sem custo médio"*, em vez de um *"sem custo"* que mandaria o dono esperar uma nota que já chegou.

⚠️ **Um número do pedido saiu diferente, medido:** ele escreveu *"R$ 8,58 + ervilha"*; o parcial real do XIS COMPLETO é **R$ 10,35**. Repetir o número dele seria inventar.

### ⭐ 4. A VARREDURA (mapa executável, `negativo-nao-trava-fluxo-alheio.test.ts`)

| fluxo | com item negativo |
|---|---|
| **recebimento** | ⭐ **AVISA** — aparece na lista com o saldo e *"esta nota conserta"* |
| **entrada (nota/manual/produção)** | ⭐ **AVISA e PERGUNTA** — absorve dentro do teto, pergunta acima |
| **ficha / cardápio** | ⭐ **AVISA** — custo parcial, margem-teto, *"limitado por X — em falta"* |
| **contagem** | ⭐ **PORTA de 22/09** (intacta) — *"vendeu sem produção registrada"* + o link |
| **baixa de venda** | ⚠️ **passa** — saldo negativo é o sinal *"vendeu sem produzir"*, e barrar esconderia o aviso |
| **produção** | ⭐ *"produzir agora"* na linha do componente em falta |

**PROVADO EM PROD, pelo caminho da tela, nos DOIS viewports (REGRA 12):**
```
1. a lista do recebimento: 159 itens · ⛔ invólucros de cardápio: 0
   "sal" → 3 · 1 NEGATIVO com aviso (sal −0,9)      "feijão" → 1 (com acento!)
   "ervilha" → 2 · 1 NEGATIVO (−45,48)              "xis pao" → 1 (ordem livre)
   ⭐ o sal que ele citou: ✓ NA LISTA     ⭐ itens chamados "sal": 1 (nada a mesclar)

2. as 4 entradas que cruzam o zero → PERGUNTA (resíduo acima do teto), com a conta na tela
   sal −0,22/teto 0,05 · arroz −32,77/0,06 · feijão −12,47/0,05 · ervilha −3,26/0,23

3. XIS COMPLETO: custo fechado "a definir" · ⭐ PARCIAL R$ 10,35 · falta ERVILHA
   ⭐ dá pra fazer 0 (limitado por ERVILHA — em falta) · ⛔ rendeAte negativo: NÃO

celular recebimento 113ms · cardápio 57ms · produto 64ms   desktop 78/45/48ms · 6/6 frases
```
**REGRA 11 — 7 becos repostos, 7 vermelhos** (sem universo · filtrando por saldo · busca virando 2ª régua · entrada recusada · rendeAte cru · custo parcial sumindo · contagem tratada como entrada).

⚠️ **E A SONDA DA REGRA 11 NASCEU QUEBRADA DE NOVO — `$G` sem aspas NÃO faz word-splitting em zsh** (a cicatriz de 23/09, no mesmo mês): os 7 rodaram contra zero arquivo e "passaram" com saída vazia. Refeita com array. ⚠️ Outras duas sondas minhas erraram antes: `saldosDaEmpresa` tem o campo **`saldo`**, não `quantidade` (eu media `undefined < 0`, sempre falso, e quase reportei *"zero negativos"*), e inventei a forma do `Ctx` do `explodir` em vez de ler. **Parei de supor e li a assinatura** — é a 4ª vez que isso aparece no doc.

**10.791 verdes · TS 0 · deploy 4/4 (`rHzyJW80XykbSm943faoo`) · Δ bundle +4 KB.**

📋 **FICA PRO DONO (o clique é dele):** conferir a nota do ALAN pela tela — o `sal` agora aparece na busca com o aviso, e o confirmar vai **perguntar** sobre os R$ 0,22 antes de gravar. As outras 3 (arroz, feijão, ervilha) seguem negativas até a nota delas chegar.

### ⛔⛔⛔ O LOTE EXIGIA CATEGORIA E NÃO HAVIA ONDE RESPONDER — O BECO (23/09)

**O dono:** *"o cartão exige categoria («Vincular 6 · diga a categoria primeiro — ela grava nas 6») mas NÃO EXISTE onde responder: o seletor esquerdo mostra «⚙ categoria vem do gesto» e NÃO ABRE nada. As duas metades se contradizem — a esquerda diz «não é comigo», o botão diz «é com você»."*

**⛔⛔ ERAM DOIS DEFEITOS SOMADOS, OS DOIS MEUS, dos dois sprints anteriores:**
1. **`estadoDoSeletor` lia a ação do PALPITE da linha** — e o palpite da MARIA LUIZA é **pagamento de fatura**, que é ESTRUTURAL. Daí o ⚙. **Mas lote é CASAR, e casar HERDA da conta**; com as 6 sem categoria, o caso é o **herda-pedindo** (o mesmo da TOZZO).
2. **o `SeletorDoLote` que eu construí ontem vivia no `abaixoDoValor` do chassi — e o modo painel NÃO desenha chassi.** Ou seja: ele existia no arquivo e **não era renderizado em lugar nenhum**.

**⭐ FIX NA RÉGUA, NÃO COM REMENDO** (ordem do dono): `estadoDoSeletorDoLote(notasSemCategoria, total)` — **PEDE** quando falta (com o número do que FALTA, não do total: *"2 de 6 notas sem categoria"*) · **HERDA** quando todas têm (*"herda das contas"*, honesto) · e carrega **`gravaEm`**, que é o que faz a tela dizer *"a resposta grava nas 6 contas"*. A escolha vai pela **porta única** (`resolverLinha` com `categoryId`), que já grava em CADA conta desde 20/09.

**⛔ E O LOTE VIROU PAINEL-ONLY.** O ramo do card inteiro (com chassi próprio) ficou **sem chamador** quando a seção morreu em *"uma lista só"* — e **código sem chamador é o que alguém religa por descuido**. Ele não tem mais um `if` a checar: **ele não sabe desenhar chassi**. Desenhar ali mostraria a linha do banco **duas vezes no mesmo cartão**.

**⭐⭐ A REGRA DE PÁGINA (a REGRA 11 do beco, palavras do dono):** ***botão exigindo resposta + nenhum lugar pra responder = vermelho — toda exigência aponta pra um controle QUE ABRE.*** O guard afirma que o único ramo que renderiza controle é o `PEDE`, que a tela escolhe a régua pelo **CASO** (não pelo palpite), e que a resposta da esquerda **chega no Vincular**.

**⚠️⚠️ E A PROVA EM PROD ACHOU UM SEGUNDO BECO, MENOR, QUE EU TINHA DEIXADO:** o botão dizia *"diga a categoria primeiro — ela grava nas 6"* e **parava ali** — cobrava a resposta **sem dizer onde responder**. Meia-porta. Agora: ***"escolha a categoria na esquerda ← · ela grava nas 6 contas"***. *Exigência que não aponta é a mesma doença, um degrau menor.*

**⛔ REGRESSÃO MINHA CORRIGIDA JUNTO:** com as seções mortas, o **deep-link `?abrir=`/`?conta=`** continuava sendo lido e alimentava um bloco que **não existe mais** — a linha apontada não entrava em lugar nenhum. É a ***porta pintada na parede*** (13/09) de volta, por dentro. A rota da caixa passou a aceitar `abrir`/`conta` e repassar pro `cardsDeEscolha`; a tela forwarda por um `deepLink()`.

**PROVADO EM PROD, pelo caminho da tela, nos DOIS viewports (REGRA 12):**
```
A LISTA 49 linhas · filtros {tudo 49 · prontos 1 · mão 14}
⭐ MARIA LUIZA R$ 2.886,37 · 6 notas · SEM categoria 6
   SELETOR DA ESQUERDA: PEDE · "as 6 notas sem categoria — escolha" · gravaEm=6 · ABRE ✓
⛔ vincular SEM categoria → HTTP 422 · PEDE_CATEGORIA · nada gravado

E o resto da lista, cada um na sua régua:
   TOZZO / BORTOLAZZO / LAMANA / NESTLÉ …  PEDE       "a conta casada não tem categoria"
   TOZZO / CENTERMIX                       HERDA      "herda da conta: Matéria-Prima - Alimentos"
   PIX_DEB / CARTÓRIO                      ESTRUTURAL "categoria vem do gesto"   ⭐ o ⚙ só onde é
celular 200 em 594ms · desktop 200 em 201ms · 1.089 KB · as 4 frases nos dois
```
**REGRA 11 — 6 becos repostos, 6 vermelhos** (lote voltando a ler o palpite · a resposta não chegando no Vincular · a régua devolvendo ESTRUTURAL · o deep-link sumindo da rota · o seletor morto voltando pro chassi · a exigência sem apontar).

**⚠️ 2 GUARDS REAPONTADOS, os dois MAIS FORTES:** o `comoPainel` do lote virou ***"ele não pode conter `ChassiDoCartao`"*** (antes era *"tem que ter o `if`"*) e o `um-modelo-so` tirou o lote da lista de decisores **afirmando quem hospeda** — a régua não mudou (*nenhuma decisão fora do chassi ≍*), mudou **quem desenha**.

**10.756 verdes · TS 0 · deploys 4/4 (`m11SvNjxI8Tx1ddzSdJWp` e `L7_lA5h1b1WDoH6zX93-O`) · Δ bundle −8 KB.**

### ⛔⛔ E O DEPLOY DECLAROU 4/4 VERDE COM O CÓDIGO ANTIGO (23/09) — o gate prova SAÚDE, não NOVIDADE

**Eu rodei `bash scripts/deploy.sh` direto e ele respondeu `✓ DEPLOY OK` com BUILD_ID novo.** Prod continuou no commit **anterior ao meu**. Só apareceu porque a prova em prod estourou `estadoDoSeletorDoLote is not a function` — e eu quase rotulei de sonda errada.

**A CAUSA:** o **`deploy.sh` NÃO FAZ `git pull`** — ele builda o que está na árvore de trabalho. O pull é passo do runbook, feito na mão antes. Eu pulei. **E a armadilha documentada agrava:** o swap-postgres deixa `prisma/schema.prisma` e `migration_lock.toml` **modificados**, então o `git pull` seguinte **aborta calado** — é preciso `git checkout --` nos dois antes.

**⚠️ E O GATE NÃO TINHA COMO PEGAR, honestamente:** ele mede BUILD_ID novo, pm2 estável, CSS servindo e banco respondendo — e **um rebuild do código velho passa nos quatro**. ***Gate de saúde não é gate de versão.*** É a mesma família do incidente de 28/08 (*"o gate provava presença, não saúde"*), um degrau acima: **agora prova saúde, e não prova qual código**.

📋 **DÍVIDA REGISTRADA (não construída):** o `deploy.sh` devia **imprimir o SHA que buildou × `origin/main`** e avisar quando estiverem diferentes — ou fazer o pull ele mesmo, com o `git checkout --` do swap embutido (a REGRA 5: *disciplina vira impossibilidade*). Enquanto não for, **a sequência é `git checkout -- prisma/schema.prisma prisma/migrations/migration_lock.toml && git pull && bash scripts/deploy.sh`**, e conferir o `git log --oneline -1` do servidor depois.

### ⛔⛔⛔ O LOTE FURAVA O "NADA SAI SEM CATEGORIA" — E O PALPITE PEDIA ASSINATURA NO ESCURO (23/09)

**Quatro itens do dono, e o segundo tinha risco de dado.**

**⛔⛔ O FURO (item 2).** As 6 notas da MARIA LUIZA (R$ 2.886,37) estão **todas sem categoria**, e o *"Vincular 6"* deixaria passar. **A causa é estrutural:** o card do lote postava em **`/find-and-match/reconcile`** — uma rota **PRÓPRIA**, **fora** do `resolverLinha`, que é onde o `PEDE_CATEGORIA` mora desde 20/09. Conciliadas por ali, as 6 sairiam da caixa **sem classificação nenhuma** e a despesa não entraria em DRE nenhum. ***"N caminhos, 1 esquecido"*** — agora na regra que existe justamente pra isso não acontecer.

**⭐ A cura é a PORTA ÚNICA**, não um segundo check: o lote passou a postar no `/resolver`, e a regra vale **de graça, pro N inteiro**. ⭐ E a nota passou a carregar **`temCategoria`**, então a tela **PEDE ANTES do clique** — *fazer o dono clicar pra levar um não é trabalho que dava pra poupar* (a régua do seletor da caixa). **UMA pergunta pras N**, do lado esquerdo do chassi, e a resposta **grava em CADA conta** (aprende). ⛔ Por-nota diferente continua sendo *"Escolher na mão"*: oferecer N seletores aqui transformaria o card do lote no painel manual, e o lote existe pro caso *"todas iguais"*.

**⭐ ITEM 1 — o lote veste o chassi ≍** (`moldura={false}` + `painelColado`, como o N:M em 20/09). O **grid próprio morreu**: dois modelos convivendo é exatamente o que o guard proíbe.

**⭐⭐ ITEM 3 — O PALPITE MOSTRA A CONTA INTEIRA.** Ele mostrava **só o nome da empresa**; agora traz **valor · vencimento · NF/parcela**, **espelhando a coluna da esquerda** (a anatomia que os cards de CASO já usam; o 1↔1 é que tinha ficado pra trás). *"Eu confiro valor e data ANTES de confirmar, não depois."* ⚠️ Os dados saem da **MESMA conta que o matcher escolheu** — uma 2ª leitura poderia mostrar um valor e conciliar outro. ⛔ E o vencimento compara com o **dia do BRASIL**: em UTC, das 21h à meia-noite **toda conta que vence hoje apareceria como vencida** (a cicatriz do card do cartão, 09/09, e do Contas a Pagar, 13/09). O ano só aparece quando **não** é o corrente — *"venceu 22/09"* numa conta de 2025 se lê como deste mês.

**⭐ ITEM 4 — "NÃO É ESSA — ESCOLHER OUTRA"**, ao lado do ✓ Confirmar: abre o Find & Match **SEM a sugerida pré-marcada**. ⛔ Marcar a errada de novo é obrigar o dono a **desmarcar antes de escolher**, e desmarcar é o gesto que ninguém lembra de fazer. Sem ela, palpite errado só se resolvia **abandonando o palpite**. ⚠️ O botão só **ABRE** o painel — nenhuma porta de gravação nova.

**⚠️⚠️ E A PROVA EM PROD PEGOU UM BUG MEU QUE A SUÍTE NÃO PEGAVA:** o corpo do lote ia **sem `empresaId`**, que o schema da rota exige → **HTTP 400 "Gesto inválido"**, ou seja o botão simplesmente não funcionaria. Os 8 testes chamam o **`resolverLinha` direto** e passam por cima do zod. ***Testar a lib não prova o encaixe da rota*** — a mesma lição do mock que escondeu o contrato em 20/09. O guard passou a exigir os campos **dentro do corpo do fetch**.

**PROVADO EM PROD, pelas rotas reais:**
```
ITEM 3   TOZZO       linha R$ 1.081,44 → A CONTA R$ 1.081,44 · venc 23/09 · NF 25926 (parcela 001)
         BORTOLAZZO  linha R$   948,50 → A CONTA R$   946,50 · venc 23/09 · NF 618318
                                                   ⭐ R$ 2,00 de diferença, VISTA antes de confirmar
ITEM 2   vincular as 6 sem categoria → HTTP 422 · PEDE_CATEGORIA, nomeando a NF 69009352
         ⛔ conciliadas: 0 · com categoria: 0 — INTACTAS
celular 200 · desktop 200 · bundle com o retrato, o "não é essa", o "são da mesma?" e o aviso
```
**REGRA 11 — 7 furos repostos, 7 vermelhos** (rota própria de volta · Vincular liberando sem categoria · servidor parando de exigir · palpite só com o nome · palpite sem porta de troca · troca reabrindo com a sugerida marcada · lote fora do chassi). ⚠️ **E dois guards meus não morderam de primeira**, os dois por asserção não ancorada: o do `empresaId` casou com a **declaração da prop** (*"menção, não uso"*), e um guard de 20/09 ficou **vermelho com a tela CERTA** — ele afirmava o literal do `preSelecionados`, e a régua ganhou uma **exceção explícita**. **REAPONTADO, não afrouxado:** passou a exigir as duas metades (com palpite, marcado; na troca, vazio).

**10.727 verdes · TS 0 · deploys 4/4 (`E4XwEwat8mxvuUvdbbdv2` e `LeB6ed-mZ91q_umhaEG1W`) · Δ bundle +4 KB.**

📋 **NOMEADO, NÃO FEITO:** o palpite de **fatura de cartão** traz valor no `detalhe` (*"fatura 2026-09 · R$ 2.886,37"*) mas **não o vencimento** — é outra família, com outros campos, e o pedido era sobre a conta a pagar. Fica registrado em vez de eu estender por conta própria.

### ⛔⛔⛔ A "CALABRESA BLACK QUE SUMIU" — E O IGNORAR QUE NUNCA FUNCIONOU (23/09)

**O dono, urgente:** *"cliquei sem querer num botão e a CALABRESA BLACK sumiu da minha frente"*.

**⭐⭐ A MEDIÇÃO REFUTOU A HIPÓTESE — ela não foi ignorada nem desmapeada.** Os três estão no mapa de complementos, os três como `FICHA`, e `atualizadoEm == criadoEm` nos três: **nenhuma linha foi tocada depois de criada**.
```
CALABRESA BLACK FRIDAY  → ficha cmtkwy7pl…  criado 21/09 04:57:56   (= a ficha da CALABRESA COMUM)
FRANGO BLACK FRIDAY     → ficha cmuarysgk…  criado 21/09 04:58:34   (ficha PRÓPRIA)
MUSSARELA BLACK FRIDAY  → ficha cmuarzsha…  criado 21/09 04:59:21   (ficha PRÓPRIA)
```
**A tela agrupa por FICHA** (`chaveDeApresentacao`, 03/09), então a CALABRESA BLACK **não sumiu: ela foi absorvida pela linha "CALABRESA"**, que hoje mostra 4 apelidos — `CALABRESA | CALABRESA BLACK FRIDAY | calabresa | Calabresa`. Os outros dois têm linha própria porque ganharam ficha própria, 38 e 85 segundos depois.

**⛔⛔ E O ACHADO QUE VALE DINHEIRO É OUTRO: 172 ocorrências estão baixando a porção ERRADA.** A ficha comum consome `porcao de calabresa 120 grama`; existe um item `CALABRESA BLACK 120 GRAMAS` (INTERMEDIARIO, 248 un) criado justamente pra a promoção, **e ele não é consumido por ninguém**. ⚠️ **NÃO corrigido** — a receita é decisão do dono (*"o sistema não cria ficha de sabor nenhuma automaticamente"*, 14/09), e as duas que funcionam consomem coisas diferentes (FRANGO = frango + queijo black; MUSSARELA = só queijo black). Inventar o que a pizza leva seria decidir a receita por ele.

**⛔⛔⛔ E AO PROVAR O RED-THEN-GREEN, O ACHADO MAIOR: IGNORAR PRODUTO NUNCA FUNCIONOU EM PROD.** `POST /vendas/mapear` com `alvoTipo=IGNORAR` devolve **HTTP 500 de corpo vazio, toda vez, desde 14/09** — o CHECK de 22/08 (`chk_venda_map_alvo IN ('FICHA','REVENDA')`) recusa a linha. **Nove dias de feature morta**, e os *"0 IGNORAR no mapa de produtos"* que eu tinha medido de manhã não eram *"ninguém usou"*: eram ***"é impossível"***.

⚠️⚠️ **É A MESMA LIÇÃO QUE EU ESCREVI ANTEONTEM**, no radar: ***"CHECK com vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal"***. Lá o prazo foi de **um dia**; aqui o CHECK é de agosto e a palavra nova chegou em setembro. E só apareceu porque a prova em prod **executou o gesto** em vez de conferir o código.

**⭐ A CURA NÃO FOI CLONAR O MAPA.** Renomear o model custaria **61 usos em 34 arquivos**, um deles a **baixa de venda** (mexe em estoque). E mais fundo: `alvoTipo` responde *"para onde baixa"*, e **ignorar não responde isso** — ignorar é ***ausência de destino + decisão tomada***, que é exatamente o que separa o IGNORADO do SEM_DESTINO. `stock_venda_ignorado` (CREATE-only, CHECK na FORMA, unique por nome): ignorar apaga o destino **e** grava a marca numa transação (meio gesto deixaria o nome indistinguível de quem nunca foi tocado); o [voltar] apaga as duas. ⭐ **Efeito colateral bom:** sem linha no mapa, a baixa **já não baixa** o ignorado — por construção, sem nenhum leitor novo precisar aprender a palavra.

**⭐⭐ E O IGNORADO VOLTOU A EXISTIR NO CARDÁPIO.** No `hubCardapio` ele caía num `else { continue }` e **desaparecia**: sem seção, sem contador, sem volta. Agora é seção **última e colapsada**, com **[voltar] por item**, e **some quando não há nenhum** (móvel fixo zerado treina o dono a não olhar). ⛔ Ele viaja **à parte** de `linhas`: misturá-lo o poria nas seções, no CSV e em todo contador — *decisão tomada não disputa espaço, nem número, com trabalho pendente*. ⭐ E o [voltar] **não escolhe destino**: devolve o nome pra fila como pergunta.

**⭐ E O GESTO PASSOU A PERGUNTAR** — *"tirar «X» do cardápio?"*, modal NOSSO (nunca `confirm()` nativo, que já falhou em silêncio no Safari em fluxo async, 22/08). **Leve de propósito**: ignorar é reversível, e cobrar cerimônia por um gesto que se desfaz num clique seria pesar a mão.

**PROVADO EM PROD, navegando pelas rotas reais (efeito líquido ZERO — ignorei e devolvi):**
```
ANTES     ignorados=0 · fila sem destino=111 · produtos=206
IGNORO    HTTP 200 → ignorados=1 · fila=110 · produtos=205
          🗂 seção: «Açaí 250ml» chave=ignorado:Açaí 250ml · 1 un · fora da fila
[VOLTAR]  HTTP 200 → ignorados=0 · fila=111 · produtos=206 · volta como SEM_DESTINO
celular 200 · desktop 200 · bundle com a seção, o "tirar … do cardápio?" e o voltar
```
**REGRA 11 — 6 defeitos repostos, 6 vermelhos.** ⚠️ **DOIS vieram VERDES na 1ª versão, os dois por asserção não ancorada:** `toContain('IgnoradosDoCardapio')` passou **com a seção arrancada do JSX**, porque a **definição** da função ainda tem o nome (*"menção, não uso"*, 7ª vez — o que morde é a TAG); e o `useState(false)` do colapsado casou com o **componente VIZINHO**, porque minha fatia ia até o fim do arquivo. ⚠️ E um terceiro guard mordeu **o próprio comentário** que proíbe `confirm()` nativo — passou a ler sem comentário.

**10.710 verdes · TS 0 · guard de isolamento 48 · `pg_dump pre-venda-ignorado-20260923-101151.dump` (6,7 MB) · deploys 4/4 (`jo9AgBzBqpDJvL3BW_dI_` e `116UNYBFuDoH144UoPiqc`) · Δ bundle +4 KB.**

⚠️ **DÍVIDA REGISTRADA:** a página do Cardápio declara `Status` e `Hub` **à mão** sobre o payload, então o `IGNORADO` precisou ser acrescentado nos dois lugares. É a dívida de 01/09 (*"interface escrita à mão sobre payload é promessa, não prova"*) cobrando juros — derivar de `StatusCardapio`/`HubCardapio` é o certo e fica pro sprint dela.

**✅ E A CALABRESA BLACK VOLTOU — receita confirmada pelo dono** (*calabresa black + queijo black*, o mesmo padrão do FRANGO). `pg_dump pre-ficha-calabresa-black-20260923-102654` antes; criada pela **porta real** (`criarFicha` com `mapearComplemento`, ficha e vínculo na MESMA transação — a trava que existe porque 3 fichas nasceram órfãs em 01/09 e a PIZZA saiu duplicada).
```
⭐ «CALABRESA BLACK FRIDAY»  172 ocorr · ficha cmue509vb…  ↳ 1× CALABRESA BLACK 120 GRAMAS + 1× QUEIJO Black Friday 200G
⭐ «FRANGO BLACK FRIDAY»      60 ocorr
⭐ «MUSSARELA BLACK FRIDAY»   42 ocorr
   e a «CALABRESA» comum voltou aos 3 apelidos dela (CALABRESA | calabresa | Calabresa)
```
⚠️ **O passado NÃO foi reescrito:** as 172 ocorrências já baixadas consumiram a porção comum, e o ledger é imutável. Da venda de hoje em diante a baixa é a certa; acertar o histórico seria reprocessar os dias — **decisão do dono**, não feita.

### ⛔⛔⛔ A RECUSA DO ITEM NEGATIVO MANDAVA CAÇAR UMA NOTA QUE NÃO EXISTE (22/09)

**O dono, contando a `PORÇAO CALABRESA 85g congelada`** (−8 UN · −R$ 135,20): *"a recusa diz só 'estoque negativo, não aceita' — sem explicar POR QUE nem O QUE FAZER."*

**⛔⛔ E A FRASE ESTAVA PIOR QUE VAGA: ela mandava registrar a COMPRA.** Ninguém **compra** porção de calabresa — ela se **produz**. A frase nasceu do **FERMENTO** (16/09), que é matéria-prima e onde o buraco era mesmo uma nota; cravada pra todo item negativo, passou a mandar o dono procurar um documento que não existe. ***É a lição de 16/09 — "mensagem que acusa o campo errado faz o dono caçar um erro que não existe" — cometida um degrau acima***, na mesma função que aquele dia consertou.

**⛔ A RÉGUA NÃO MUDOU** (ordem do dono: *"FIX na mensagem, não na régua"*). O guard de 11/09 recusa o mesmo estado impossível; o que mudou foi a **frase** e a **porta**.

**⭐⭐ O PORQUÊ É O QUE IMPORTA, e ele justifica a recusa:** item PRODUZIDO negativo significa **vendeu sem ter produção registrada** — e ***contar por cima ENTERRA o lote que ninguém lançou***: o ajuste entra, o saldo fecha, e a produção perdida some do Real vs Teórico pra sempre. A recusa existe exatamente pra impedir isso, então agora ela **diz** isso.

**⭐ A PORTA — três casos, nenhum beco** (`lib/stock/porta-do-negativo.ts`, pura):
| caso | porta |
|---|---|
| **ordem PARADA** do item | link **direto nela** — *"concluir a ordem aberta de 19/09"* |
| ficha ativa, sem ordem | `/producao?ficha=<id>`, com o formulário **já aberto e a ficha escolhida** |
| sem ordem nem ficha · ou item **COMPRADO** | a entrada/ajuste pelo histórico do item |

⚠️ **Sem o `?ficha=` a porta seria meia-porta:** o dono cairia num dropdown pra procurar de novo o que o sistema acabou de nomear — o defeito do Bamberg (13/09). A tela de produção passou a ler o parâmetro **no 1º render** (em `useEffect` ela piscaria fechada antes de abrir).

**⭐ OS FATOS SÃO RESOLVIDOS ONDE HÁ BANCO; A DECISÃO MORA NA FUNÇÃO PURA.** O guard consulta ordem/ficha e manda tudo no `culpado`; o tradutor só traduz em rótulo+href. Consultar o banco no tradutor faria a decisão da porta **nascer em dois lugares** — e as duas divergiriam no primeiro caso de borda.

**⚠️ A FAMÍLIA SAI DA CATEGORIA, NÃO DA EXISTÊNCIA DE FICHA:** item produzido cuja ficha foi **arquivada** continua produzido, e mandá-lo pra *"registrar a compra"* seria o bug de hoje por outro caminho. A lista de tipos produzidos tem **dono único** (`tipos-ficha.ts`) — reescrevê-la aqui faria o `SABOR` divergir entre dois arquivos.

**📋 A VARREDURA — são 8 negativos, e a frase errada valia pra 3:**
```
MATERIA_PRIMA (pedem NOTA)   ARROZ −9,5 kg · FEIJÃO −7,72 · ERVILHA −40,53 · sal −0,1 · PAO DE XIS −224
INTERMEDIARIO (pedem PRODUÇÃO)  PORÇAO CALABRESA 85g −8 UN · Porçao aneis de cebola −7 · porcao file xis −3
⭐ ordens de produção abertas hoje: ZERO
```
⚠️⚠️ **E ISSO CORRIGE DUAS PREMISSAS DO PEDIDO:** *"linka DIRETO nela (o caso de hoje: a ordem do P2)"* — **não há ordem aberta nenhuma** (a do ano 202 foi fechada), então **hoje todas caem na 2ª porta**; a 1ª está construída e travada em teste, mas não dispara com o dado atual. E o item é a **85g congelada**, não a *"calabresa ralada"*.

**PROVADO EM PROD, com os itens reais e `$transaction` de rollback forçado — 0 movimentos gravados:**
```
ARROZ [MATERIA_PRIMA]      422 · "…falta registrar a COMPRA que não foi lançada"
                           → [ver o histórico deste item e corrigir a entrada que faltou →]
CALABRESA 85g [INTERMED.]  422 · "…vendeu sem ter produção registrada. Contar por cima
                                  ENTERRA o lote que ninguém lançou — por isso a contagem espera."
                           → [registrar a produção que faltou →] /producao?ficha=cmtxfpxll…
celular e desktop: contagem 200 · a PORTA (/producao?ficha=) 200 · as 5 frases no bundle
```
**REGRA 11 — 5 defeitos repostos** (frase cravada **1** · porta vazia **4** · ordem não linkada **1** · `?ficha=` ignorado **1** · um dos 2 estados da tela sem o link **1**). **10.701 verdes · TS 0 · deploy 4/4 (`kXAmH7e2IB6Tfu1iYgB-K`) · Δ bundle +0 KB.**

⚠️ **TRÊS SONDAS MINHAS ERRARAM ANTES DE EU MEDIR** — assinatura invertida (`saldosDaEmpresa(db, id)`), `StockFicha` sem campo `nome`, `StockProductionOrder` sem `@relation` (o isolamento proíbe). **Parei de supor e li o schema.** *Sonda errada dá um vermelho tão convincente quanto um defeito real* — e aqui ela quase virou "a produção não tem ficha".

### ⭐⭐ RADAR v1.3 — A QUANTIDADE PRIMEIRO, O TOTAL POR SEÇÃO E A CASA DA REVENDA (21/09)

**⭐ 1. O VEREDITO DIZ QUANTIDADE, DEPOIS DINHEIRO** — decisão do dono: *"quantidade é o número MAIS importante"*. `faltou 1 un · R$ 3,31` · `faltou 0,5 kg · R$ 18,42`, na unidade do item. ⭐ **Uma função (`textoDoVeredito`), os TRÊS lugares** — pílula, chip do último veredito e conta de padeiro; uma segunda formatação faria o chip e a linha discordarem sobre o mesmo fato.

**⛔⛔ 2. O RODAPÉ DA SEÇÃO, E A LEI QUE ELE OBEDECE: UN E KG NUNCA SOMAM NUM NÚMERO SÓ.** A quantidade sai **por unidade** (`faltouPorUnidade: Record<string, number>`) e só o **dinheiro** soma tudo. ⛔ **Item "falta contar" fica FORA do total** (`continue`, nunca zero) e é **dito** no rodapé (*"29 ainda sem contagem (fora do total)"*) — zero afirmaria que bateu, que é a mentira que esta tela existe pra não contar. ⭐ `totalDaSecao` é **UMA função pros três blocos**: soma por seção escrita na tela seria a segunda régua, e ela divergiria do placar no primeiro caso de borda.

**⭐ 3. A SEÇÃO 🥤 REVENDA** entre os caros e as porções — *"os caros fica só matéria-prima, como o nome diz"*. As bebidas **migram na própria migration** (`INSERT...SELECT` com `categoria = 'REVENDA'` → lista REVENDA), CREATE-only.

**⛔⛔ E O CHECK DO BANCO VALIDA FORMA, NUNCA VOCABULÁRIO.** Ontem eu criei `stock_radar_watchlist` com `CHECK (lista IN ('CAROS','PORCOES'))`; hoje o dono pediu a 3ª lista e o CHECK **virou parede**, porque este módulo é CREATE-only e `ALTER` é proibido. A tabela nova valida `lista <> '' AND lista = upper(lista)`; **o vocabulário mora no TypeScript**, onde se acrescenta. ⭐ *CHECK com vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal — e o prazo foi de um dia.*

**⭐ O UNIVERSO `REVENDA` NASCEU ESCRITO ITEM A ITEM** (`universo-do-seletor.ts`, o dono único). Eu tinha ligado a busca da seção em `PRATELEIRA`, que oferece **queijo e coxão na lista da bebida** — recriando exatamente a mistura que a seção nasceu pra desfazer. ⚠️ E **derivar de COMPRAVEL seria o erro de 16/09** (quando `RECEITA = [...COMPRAVEL, ...]` arrastou LIMPEZA e o editor ofereceu desengraxante como ingrediente). ⭐ O tipo do `universo` na tela passou a **DERIVAR** de `UniversoDoSeletor` em vez de enumerar à mão — a lista à mão envelheceu no primeiro universo novo, e o `tsc` cobrou.

**⚠️⚠️ REGRA 11 — 5 DEFEITOS REPOSTOS, E O DO TOTAL VEIO VERDE: "MENÇÃO, NÃO USO" PELA QUINTA VEZ.** O guard fazia `toContain('faltouPorUnidade: Record<string, number>')` e passou com o campo da interface trocado por um escalar — porque a MESMA frase existe na **variável local** que acumula o total, sessenta linhas abaixo. O que morde é ler **dentro do bloco da interface** (o contrato, não o rascunho), e proibir ali qualquer escalar de quantidade. ⚠️ **E o guard do CHECK mordia o COMENTÁRIO** que documenta o defeito removido: o SQL passou a ser lido **sem comentário**, como já se fazia com o motor. ***O arquivo que documenta o defeito não pode ser o que o absolve*** — agora em SQL.

**⛔ O FLAKE DO `isolamento-pf-pj` TINHA CAUSA MEDIDA, e é a TERCEIRA ocorrência da classe.** Ele ficou vermelho na suíte cheia e **verde 3/3 sozinho**; `fotoDaPJ()` fazia `prisma.transaction.count()` **sem `where`**, e a suíte roda arquivos em PARALELO contra o mesmo banco — outro teste criou 2 transações entre as duas fotos. É o `snapshotClosedModules` global de novo (23/08 e 24/08). **Escopado por empresa — e isso APERTA**: a pergunta virou exatamente *"o import PF mexeu em alguma coisa DESTA empresa?"*, que é a única coisa que aquele teste pode afirmar. ⚠️ Medido antes de rotular, a régua de 01/09.

**PROVADO EM PROD, pelo motor real e nos DOIS viewports (REGRA 12):**
```
🥤 REVENDA   COCA COLA 600ML   faltou 1 un · R$ 3,31   [sistema 109 un]
             └─ faltaram no total: 1 un · R$ 3,31
💰 OS CAROS  └─ nada faltou · 5 ainda sem contagem (fora do total)
🍳 PORÇÕES   └─ nada faltou · 29 ainda sem contagem (fora do total)
⛔ Σ(seções) R$ 3,31 == placar R$ 3,31 ✓   ·   Coca nos CAROS? ✓ não
busca da 🥤: 30 itens, TODOS REVENDA · FANTA UVA 2L entre eles ✓ · matéria-prima: 0
celular 200 · desktop 200 (37.478B idênticos) · bundle 24KB com as 3 seções e o rodapé
⛔ o veredito só-dinheiro ("faltou R$ …" sem quantidade): SUMIU ✓
```
⚠️ **E UM NÚMERO DO PEDIDO SAIU DIFERENTE, medido:** o dono escreveu *"faltou 2 un · R$ 3,31"*; o dado diz **1 un · R$ 3,31** (o custo é 3,31/un). Repetir o número dele seria inventar meia unidade — a disciplina de 29/08.

**10.690 verdes · TS 0 · `pg_dump pre-radar-v13-20260921-004058.dump` (6,6 MB) antes da migration · deploy 4/4 (`HuW6zzhh58s0dKk0I517r`).**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** adicionar a **FANTA UVA 2L** na 🥤 REVENDA pela tela — o universo já a oferece — e a recontagem do creme de leite, que segue pendente.

### 📋 O RASTRO DA RECONTAGEM DO CREME DE LEITE — ELA NÃO ESTÁ NO BANCO (21/09)

**O dono:** *"Recontei o creme de leite pela tela (o freio ofereceu o número certo e usei). Confere o rastro."*

**⛔ MEDIDO, E A RESPOSTA É DURA: não há recontagem.** O item tem **uma única** linha de contagem (14/09 14:51) e o saldo segue **16.600 UN · R$ 39.342,36** — **23% do estoque inteiro da empresa** (total R$ 167.944,20). ⚠️ E o fato que fecha a questão: **a última contagem de QUALQUER item foi 20/09 às 11:22**, e o botão *"usar 166"* só existe desde o deploy das **23:40**. ***Desde que o botão existe, ninguém contou nada*** — então não dá pra dizer nem que ele funcionou nem que falhou; o que dá pra dizer é que a recontagem não chegou ao banco.

| pergunta dele | resposta medida |
|---|---|
| **(a)** a posição zerou o fantasma? | **não** — 16.600 UN · R$ 39.342,36, intactos |
| **(b)** juiz limpo? | **nada mudou por causa do Radar nem da recontagem** (comparação dos relatórios abaixo) |
| **(c)** Δ de custo dos consumos? | **ZERO saídas na janela** — nenhum consumo levou custo desta janela. ⭐ E o custo médio **não foi distorcido**: R$ 2,37 antes e depois, porque o `AJUSTE_CONTAGEM` entrou com o custo médio vigente. **O que está errado é a QUANTIDADE (e o valor total), nunca o custo unitário** — então nenhuma receita saiu com preço torto. |

**⭐ O JUIZ, COMPARADO EM VEZ DE ROTULADO** (a régua: *"pré-existente só depois de medir"*):
```
19/09 03:53  E15=7 E7=82 F2=26        P2=1 P3=24 P5=1 P6=84 V1=77   143 issues
20/09 03:00  E15=7 E7=85 F2=26        P1=1 P3=24 P5=1 P6=84 V1=79   143 issues
21/09 00:00  E15=7 E7=86 F2=26 F3=1   P1=1 P3=24 P5=1 P6=84 V1=90   143 issues
```
⭐ **O P1 já existia em 20/09 — ANTES do Radar subir** (18:55). O que cresceu foi E7 (82→86, itens com saldo nunca contados), V1 (77→90, vendas sem destino) e o F3 novo — **crescimento da operação, não do sprint**. Os três achados que **não estão registrados** e valem o olho dele:
- **P1** — `ordem cmu1l8uj · separado 5,58 ≠ consumido 11,16 + devolvido 0` (**algo evaporou entre a câmara e a panela** — o invariante contábil da produção);
- **P5** — uma ficha de produto final sem preço há >14 dias;
- **F3** — boleto do **M. IVAN LUNARDI R$ 326,50 (venceu 14/09)** conferido e **nunca enviado ao financeiro**.

**⚠️⚠️ E UM ERRO MEU DE LEITURA, pego antes de virar relatório:** a contagem de hoje `MAIONESE · 3 → 11.432` me pareceu um segundo fantasma de grandeza. **É `11,432 kg`** — o ponto era o decimal do JavaScript, não separador de milhar. O que me salvou foi conferir o VALOR (R$ 82,80, não R$ 100 mil). *Número formatado por engano vira achado falso tão convincente quanto um real.*

### ⛔⛔⛔ O FLAKE VIGIADO DE 20/09 TINHA CAUSA — E ERA COLISÃO DE CNPJ ENTRE ARQUIVOS DE TESTE

**O `resolvido-de-um-lado-some-do-outro` ficou vermelho *"1× em 4 rodadas"* e eu registrei como vigiado, sem rotular de pré-existente** (a régua: *"'pré-existente' só depois de MEDIR a causa"*). Hoje ele caiu de novo e deixou pista: `prisma.transaction.create()` inválido. **Sozinho passa 3/3; só quebra em paralelo.**

**A CAUSA, medida:** dois arquivos usavam `const CNPJ = '50607080000616'` e **os dois** fazem `company.deleteMany({ where: { cnpj } })` no setup. A suíte roda arquivos **em paralelo contra o mesmo banco**: um apaga a empresa do outro no meio, o cascade leva `bankAccount`/`category`/`supplier` junto, e o `transaction.create` seguinte morre com FK inválida. ***É a terceira vez que esta casa paga por escopo de teste***: o `afterEach` sem empresa (20/09) e o `snapshotClosedModules` global (23/08).

**⭐ A varredura achou 5 colisões — e uma era MINHA, criada neste mesmo sprint.** Todas corrigidas, e a classe virou **impossibilidade** (`__tests__/regras-testes/cnpj-de-teste-nao-colide.test.ts`): CNPJ criado/apagado por dois arquivos = vermelho com os nomes na mensagem.

**⚠️ E O DETECTOR NASCEU LARGO DEMAIS:** a 1ª versão pegava qualquer literal de 14 dígitos e acusou **CNPJ de FORNECEDOR** (o `36603841000130` da CIA DA FRUTA, dado real de dois testes) e até o literal do meu próprio auto-teste. *Alarme falso no dia 1 é como um guard morre.* Ele ficou estreito: resolve a indireção da constante e olha **só dentro da chamada a `company.*`**. Red-then-green nos dois sentidos — morde a colisão real, não morde o fornecedor. **Suíte: 10.649 verdes em 3 rodadas seguidas.**

### ⭐⭐⭐ O RADAR ACHOU DINHEIRO NA ESTREIA — R$ 39.342,36 DE ESTOQUE FANTASMA

A prova em prod trouxe `FORA DAS LISTAS: R$ 1.619.008,87`, que é absurdo — e **o absurdo é REAL, está no ledger**:
```
REQUEIJAO CHEDDAR 1,5KG   14/09 15:27 · sistema 31 → contou 28500 · +R$ 1.622.448,31  [freio confirmado]
                          14/09 23:35 · sistema 42750 → contou 28,5 · −R$ 1.622.989,78 [freio confirmado]
                          ⭐ a marcyelle CORRIGIU no mesmo dia · saldo hoje 28,5 KG
CREME LEITE ITALAC 200GR  14/09 14:51 · sistema 177 → contou 16600 · +R$ 38.922,51    [freio confirmado]
                          ⛔ NUNCA corrigido · SALDO HOJE 16.600 UN · R$ 39.342,36
```
**É a família do lote que entrou mil vezes maior (19/09, a maionese 22.864 g × 22,864 kg), agora na CONTAGEM.** ⚠️ E **o FREIO foi confirmado nos dois** — ele PERGUNTA e a pessoa confirma; **ele não distingue "divergência real" de "erro de grandeza"**. O `plausibilidade.ts` (que compara o lote com o histórico dele) existe pra a PRODUÇÃO e **não cobre a contagem**.

📋 **NÃO CORRIGI NADA** — cirurgia de dado é decisão do dono. Duas frentes registradas: **(a)** o creme de leite (contar de novo pela tela zera os R$ 39 mil fantasma); **(b)** levar a régua de **plausibilidade de grandeza** pra a contagem, que é o que impediria o próximo.

📋 **E O CASO QUE VOCÊ MANDOU DEIXAR APARECER** — `PORÇAO CALABRESA 85g congelada`, a conta de padeiro dela:
```
janela: (1ª contagem) → 14/09      tinha 0 · produziu +15 · vendeu −13 · estornos +8
DEVIA TER 10 · CONTAMOS 15 · SOBROU 5 (R$ 11,60)
saldo hoje no ledger: −7 · valor R$ 0,02
```
⭐ Ou seja: em 14/09 ela **sobrava 5**; o saldo −7 de hoje é **posterior à contagem** — vendeu sem produzir DEPOIS. O Radar a mostra como *"falta contar"* no período de hoje, que é o estado honesto. **O gesto é teu: contar ou concluir a produção que falta.**

📋 **DÍVIDA REGISTRADA — DARK MODE GLOBAL (decisão do dono, 20/09):** o Radar nasce CLARO como o resto do app (*"nada de prefers-color-scheme sozinho — duas metades do sistema com temas diferentes, não"*). ⚠️ **Medido, não herdado do doc: 107 arquivos usam `dark:` e NINGUÉM liga a classe** (`darkMode:['class']`, zero chamadores). Ligar o interruptor global é **sprint próprio**, e o escopo tem que incluir **conferir os 107** — eles nunca renderizaram. O mock guarda os dois temas versionados até lá.

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** abrir a lixeira e reconhecer o que sumiu (restaurar o que faltar — o aviso de duplicata mostra as duas lado a lado), e conciliar uma nota pra ver a pergunta da categoria aparecer e **ficar gravada na conta**.


### ⭐⭐⭐ ITEM ENCERRADO — "PRA OPERAÇÃO, ELE NÃO EXISTE MAIS" (19-20/09/2026)

**A ordem do dono, sobre a CUBA MAIONESE:** *"sai DE TUDO que é vivo (…) nenhum lugar oferece ela pra nada. O passado fica legível: as ordens e movimentos antigos continuam mostrando o nome dela — apagar isso reescreveria custos de poções já vendidas."*

**⛔⛔ POR QUE NÃO É SÓ `ativo = false`.** Desativado é *"parei de usar, posso voltar"* — e o Catálogo mostra os inativos num toggle, de propósito. **Encerrado é decisão final**, e a diferença precisa estar ESCRITA: sem ela, em três meses ninguém sabe se o item sumiu por engano, por faxina ou porque o dono aposentou a receita. ⭐ É a mesma distinção que a casa já fez em **mesclado ≠ arquivado** (30/08) e **`ENCERRADA_SEM_FINALIZAR` ≠ FEITA** (07/09): estado com significado próprio ganha nome próprio.

**⛔ E O GESTO RECUSA COM SALDO ≠ 0** — é o coração dele: encerrar um item com estoque dentro **esconderia o dinheiro** em vez de resolvê-lo. O valor não evapora por sumir da tela; continuaria no ledger, invisível, contaminando o total e o Real vs Teórico. *A saída é contar primeiro; o encerramento é o último passo, nunca o atalho.*

**⭐⭐ QUANTIDADE ZERADA COM CENTAVOS SOBRANDO — a régua do dono, reusada.** A CUBA foi contada a zero e sobraram **R$ 0,07** (resíduo do custo médio arredondado ao longo de ~36 kg). Recusar por 7 centavos deixaria o item preso pra sempre. Vale o que ele ditou de manhã: ***zerar quantidade zera valor, SEMPRE*** — com o **mesmo teto** do `residuo-de-centavos.ts` (o limite matemático do arredondamento, proporcional ao giro) e o ajuste **registrado**, nunca sumindo calado. Acima do teto continua recusando: *ali não é centavo, é entrada que falta*.

**═══ TRÊS ERROS MEUS NO CAMINHO, os três pegos pelo próprio guard ═══**

**⛔⛔ 1. ESCREVI UMA SEGUNDA RÉGUA DE SALDO** dentro do `encerrarItem` — um `aggregate` próprio em vez de `saldoItem` — e ela **repetiu o defeito dos estornos internos que eu tinha acabado de corrigir**: acusou **36,25 KG / R$ 1,51** num item já zerado pela contagem. ***Segunda derivação da mesma pergunta diverge no primeiro caso de borda — inclusive quando quem escreve a segunda acabou de consertar a primeira.***

**⚠️ 2. ERREI O SINAL DO CUSTO UNITÁRIO** no ajuste do resíduo; o CHECK do ledger recusou por 14 centavos. Agora o unitário é **derivado do total** (`custoTotal / quantidade`), que fecha por construção.

**⚠️ 3. UMA ASSERÇÃO MINHA FICOU OBSOLETA COM A MINHA PRÓPRIA CORREÇÃO** — o guard proibia `stockMovement.aggregate` no arquivo, e o aggregate que sobrou soma só `quantidade` (o giro, pro teto). **Apertado, não afrouxado**: o proibido passou a ser somar `custoTotal` ali, que era exatamente a segunda régua.

**⭐ O GUARD EXECUTA os 5 universos + Posição + Contagem** (REGRA 3) — grep não distingue *"filtra"* de *"seleciona o campo e esquece de usar"*, que é como a Posição deixou 9 itens invisíveis em 11/09, pelo lado contrário.

**PROVADO EM PROD, pelas funções que as telas chamam:**
```
COMPRAVEL 0 · PRATELEIRA 0 · RECEITA 0 · VENDAVEL 0 · CATALOGO 0
POSIÇÃO 0 · CONTAGEM 0 · FICHAS ativas 0 · PRODUÇÃO aberta 0 · componente de ficha 0

O PASSADO:  extrato 28 linhas · 28 COM SELO · ficha 28 linhas de histórico
   «CUBA MAIONESE» → item encerrado em 20/09/2026 — a família virou uma MAIONESE só, em KG
   10 ordens antigas preservadas · o Catálogo (a casa do passado) continua achando
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (a ficha não indo junto · encerrar com saldo · o selo sumindo do extrato). **10.475 verdes · TS 0 · `pg_dump pre-encerrar-cuba-20260919-212908` · deploy `ZDh5ejNBCMLX899Zho8Xw` 4/4.**

⚠️ **E a interface da ficha do item passou a DERIVAR do tipo da lib** — a mesma dívida do tablet (*"interface escrita à mão sobre payload é promessa, não prova"*): o campo novo ficava invisível e um rename lá passava verde no `tsc`.


### ⭐⭐⭐ A FAMÍLIA MAIONESE VIROU UMA SÓ — E A CIRURGIA ACHOU 4 DEFEITOS DE LEDGER (19/09/2026)

**Autorizado pelo dono** (*"DISPARA A SEQUÊNCIA COMPLETA"*), `pg_dump pre-familia-maionese-20260919-203347` (6,5 MB) antes.

**⛔⛔ PASSO 1 — CORRIGIR SÓ A GERAÇÃO NÃO BASTAVA.** Com os 22864 kg desfeitos, a CUBA ficaria em **R$ 21,96/kg** contra os ~10,87 dos lotes bons: as separações seguintes tinham saído a **R$ 0,04/kg**, porque o custo médio já estava poluído pela própria geração podre. ***O erro de custo não fica parado — ele escorre pelos movimentos seguintes.*** `cascata-de-custo.ts` estorna do ponto podre em diante e recria em ordem cronológica, recalculando o custo médio a cada passo, com a **data do FATO** (nunca a do conserto).

⚠️ E o preview de ontem estava **desatualizado**: eram **6 pares** (a cozinha produziu em 19/09), não 5 — e a separação de 14/09 18:40 saiu a **R$ 12,51/kg** com o consumo dela a **R$ 0,04**, R$ 69,58 presos numa ordem já encerrada.

⚠️ **E o meu Δ estava inflado:** somava separação **e** consumo, que é o mesmo dinheiro contado duas vezes. Separados: **Δ prateleira R$ 365,35** (o valor a mais que sai do estoque) e **Δ CMV R$ 433,25** (o custo que entra nos produtos).

═══ **OS QUATRO DEFEITOS QUE A CIRURGIA EXPÔS** ═══

**⛔⛔ 1. O ESTORNO DE UM MOVIMENTO INTERNO ENTRAVA NA PRATELEIRA.** `estornarMovimento` cria a linha oposta com `tipo: 'ESTORNO'` — e ESTORNO **conta no saldo**. Desfazer um `PRODUCAO_CONSUMO` (que é interno e NÃO conta) **somava ao estoque**: o consumo saía por fora e voltava por dentro. A CUBA ficou com **72,74 kg** onde a reconstrução previa **36,49** — a diferença de **36,25** é a soma exata dos 6 consumos. ⚠️⚠️ **E não era da cirurgia:** medidos **9 estornos** nessa situação em prod, e o «Patinho Bife (mesclado)» carregava **+38,16 kg / R$ 1.754,36** desde uma mescla antiga. ⭐ **A cura é de LEITURA, não de dado** — o ledger está certo, quem somava é que errava (a família do E2, que contava linha crua).

**⛔⛔ 2. A REUNITIZAÇÃO IGNORAVA OS ESTORNOS.** `unidadeFisicaDosMovimentos` filtrava `tipo: { not: 'ESTORNO' }`, e como o plano de conversão nasce dessa lista, eles (a) ficavam fora do saldo previsto — o preview anunciou **22.915,44 KG** onde o saldo é **51,44** — e (b) **não seriam convertidos ao aplicar**, deixando metade do ledger em cada unidade. *O "nunca converte metade e cala" acontecendo por omissão.* ⭐ Um estorno está na mesma unidade física do original; resolver pelo `estornoDeId` é a única resposta que não chuta.

**⛔⛔ 3. REUNITIZAR PERDIA MASSA — e o CHECK do banco pegou.** Era `round2(quantidade)`, e o estoque trabalha em **3 casas** (grama/ml, a régua do próprio módulo): `22,864` virava `22,86`, e `22,86 × 9,79103 = 223,82` contra os **223,86** do dinheiro → o banco **recusou a linha** por 4 centavos. ⭐ Agora o unitário é **derivado da quantidade final**, com o `custoTotal` como âncora: o CHECK fecha **por construção**, não por sorte.

**⚠️ 4. O PREVIEW FALAVA LÍNGUA DIFERENTE DA POSIÇÃO** (pego antes do OK): o `saldoAntes` vinha de um `aggregate` cru, mostrando 3,12 onde a tela mostra 36,494.

═══ **O RESULTADO** ═══
```
MAIONESE            51,44 KG · R$ 503,69 · R$  9,79/kg   ⭐ agora em KG (era UN)
CUBA MAIONESE       36,49 KG · R$ 436,13 · R$ 11,95/kg   (ficha já inativa; espera a contagem)
POÇAO MAIONESE 30G  ← 0,030 KG de MAIONESE = R$ 0,294/pote   ⭐ consumo em kg, rende em POTES
ENCHER TUBO         ← 0,590 KG de MAIONESE = R$ 5,776/tubo
Patinho Bife (mesclado)  R$ 1.754,36 de fantasma → R$ 0,00
```

**⚠️⚠️ E A ORDEM DO PASSO 4 ESTAVA ERRADA NO PLANO — minha, não dele.** Desativar a CUBA **antes** da contagem a tiraria da lista de contagem, e aí o saldo dela não teria como ser zerado pela porta certa. ***Item desativado não aparece pra contar*** — o gesto tem que vir primeiro. Ela fica ativa até o dono contar.

**⛔ E HÁ UMA SESSÃO DE CONTAGEM ABERTA HÁ 28H, do cristian, com ZERO linhas** — *"1 sessão ABERTA por vez"* é índice único no banco, então ela **bloqueia a contagem do dono**. Não fechei sessão de outra pessoa sem ordem; está reportada.

**10.458 verdes · TS 0.**

📋 **FICA PRO DONO (o passo 5 é dele):** fechar a sessão vazia do cristian, contar **MAIONESE 3,000 KG** e **CUBA 0** na mesma sessão (o FREIO vai perguntar nas duas — é pra isso que ele existe), e então eu desativo a CUBA.


### ⛔⛔⛔ A ORDEM DO ANO 202 — O AVISO E O "SUMIU" ERAM O MESMO CASO (19/09/2026)

**O dono trouxe dois problemas:** *"o painel diz '1 ordem de ontem ainda em produção'"* e *"criei uma produção de calabresa ralada e ELA SUMIU — não aparece em lugar nenhum"*. **Medido por id, é a MESMA ordem** (`…4et405`).

**⭐⭐ A CAUSA, PROVADA ATÉ OS SEGUNDOS.** A rota validava com **`z.string().min(1)`** — que aceita qualquer texto — e montava `new Date(\`${data}T12:00:00\`)`, **sem `Z`**:
```
new Date('0202-09-18T12:00:00')  em America/Sao_Paulo  →  0202-09-18T15:06:28.000Z
                                    o gravado em prod  →  0202-09-18T15:06:28.000Z  ⭐
```
⚠️ **Os `:06:28` são a assinatura.** No ano 202 São Paulo não tinha fuso de hora inteira — usava **LMT −03:06:28**. Toda ordem normal grava `15:00:00` cravado; **só esta tem segundos**. *Foi o resíduo do relógio histórico que identificou a string de origem* (`"0202-09-18"`, o que um `<input type="date">` manda quando o ano sai com um zero a mais).

**⛔⛔ MAS O ESTRAGO NÃO FOI A DATA — FOI O SUMIÇO.** `listOrdens` ordenava por `dataProducao desc` com **`take: 200`**, e a empresa tem **238 ordens**: o ano 202 jogou a linha pra **posição 238 de 238**, dentro das 38 que o teto corta.
```
ordens ABERTAS no banco: 1  ·  visíveis em qualquer tela: 0  ·  R$ 42,18 de insumo preso
```
⭐ É **o teto de leitura aplicado ANTES da pergunta que importa** — a mesma doença do `take: 50` que escondeu o fermento da busca (16/09), e o *"desativar que não some"* ao contrário: **o ativo que não aparece**.

**A CURA É DE DUAS PONTAS, e as duas são necessárias:** a data **não pode mais nascer torta** (formato + plausibilidade + `Z`, REGRA 5 — sem o `Z` ela continuaria dependendo do fuso do processo) e **a ordem ABERTA deixou de depender do teto** (ele vale só pras encerradas, que são a massa e envelhecem). ⚠️ *Trabalho pendente não é histórico: ele é a razão da tela existir.*

**⭐⭐ E O AVISO GANHOU AS TRÊS PORTAS** — elas **já existiam** (concluir · cancelar-e-devolver · o plano de etapa de 15/09); faltava o aviso **nomeá-las**. Quem lê *"o insumo saiu da prateleira e não virou produto"* fica sabendo do problema e não do que fazer com ele. Agora cada porta **diz o efeito em dinheiro** (*"os R$ 42,18 voltam pra prateleira"*), o estado vem do **SERVIDOR** (se a tela deduzisse, discordaria do P2 na primeira borda) e a 3ª reusa `stock_etapa_plano` — nenhuma segunda resposta pra *"em que dia?"*.

⛔ **E o aviso NÃO é ruidoso:** etapa em andamento não é ordem parada (alguém está com a mão na massa) · lote com plano de continuar não avisa (massa que descansa é a **receita**) · **plano VENCIDO volta a avisar** (lote esquecido continua sendo lote esquecido).

**📋 O CENSO (14 dias) — 196 ordens:** 158 concluídas · 37 canceladas · **1 em produção**. Dinheiro em trânsito: **só a calabresa, R$ 42,18, parada há 45h**. ⭐ **E as canceladas SEMPRE devolveram** — varridas todas as 37, zero com sobra; o guard ganhou o caso que faltava (cancelar **EM_PRODUCAO**, não só logo após separar) com o invariante P1 junto.

**PROVADO EM PROD, pelas rotas reais depois do deploy:**
```
GET ordem → 200 · «porçao calabresa ralada 50 grama» EM_PRODUCAO
  parada.avisar: true · "parada há 1 dia · R$ 42,18 saíram da prateleira…
   ⚠️ a data desta ordem está fora do calendário — foi por isso que ela sumiu das listas"
  [concluir agora] [cancelar e devolver] [continua depois]  — cada uma com o efeito
GET lista → ordens 201 · abertas 1 · ⭐ a calabresa aparece nas DUAS
PAGE celular 200 · desktop 200        POST com "0202-09-18" → 422 que ENSINA
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (o `.min(1)` de volta · o teto na busca das abertas · o efeito sumindo da tela). ⚠️ **E uma sonda minha deu 401 em tudo** antes de eu reportar: o cookie é `auth_token` com **underscore**, não hífen — *o 401 do proxy é indistinguível do 401 de credencial*, e a diferença entre "prod quebrada" e "sonda errada" era um caractere. **10.453 verdes · TS 0 · deploy `iCPgTIeg6zTGnJ32pPfnZ` 4/4 · Δ bundle +4 KB.**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** abrir a ordem da calabresa e escolher uma das três portas — o aviso some quando ela sair do estado parado.


### ⛔⛔⛔ O LOTE QUE ENTROU MIL VEZES MAIOR — E A CAUSA NÃO ERA O PARSE (19/09/2026)

**O dono:** *"a receita de maionese está descontando demais."* E ele apontou a causa: *"PAGA A DÍVIDA DE 08/09 — costura os 4 campos de parse próprio no `sanitizarQtd`."*

**⚠️⚠️ A MEDIÇÃO REFUTOU A CAUSA APONTADA, e isso mudou o conserto inteiro:**
```
digitou "22.864" → sanitizarQtd(KG) "22,864" → 22.864   |  parse do tablet: 22.864
digitou "22,864" → sanitizarQtd(KG) "22,864" → 22.864   |  parse do tablet: 22.864
digitou "22864"  → sanitizarQtd(KG) "22864"  → 22864    |  parse do tablet: 22864
```
**Os dois caminhos concordam** — costurar os parses não teria impedido nada. O que produz 22864 é digitar **sem separador**. *A dívida dos 4 parses é legítima (o `|| 0` engolindo lixo), e não era a cura daqui.*

**⭐⭐ A CAUSA REAL, e ela tem nome:** as duas conclusões podres são da **viviane** (14/09 e 16/09), com uma boa da mesma pessoa no meio (28,58 em 15/09). O fator é **EXATAMENTE MIL**:
```
14/09 CUBA MAIONESE  gerou 22864 · rendimento 2855,50 (a média: 2,85)  · custo un R$ 0,01 (era 10,95)
16/09 MAIONESE       gerou 22864 · rendimento 2858,00 (a média: 2,858) · custo un R$ 0,01 (era  9,79)
```
**A balança da cozinha mostra GRAMA e o item é controlado em KG.** 22.864 g **são** 22,864 kg. Não é erro aleatório de digitação: é **unidade mental ≠ unidade de controle**, e por isso se repete.

**⭐ O GUARD DE PLAUSIBILIDADE (`plausibilidade.ts`) COMPARA O LOTE COM ELE MESMO NO PASSADO.** *"22864 é muito?"* não tem resposta sem contexto — 22.864 porções é um dia normal. O que não existe é **mil vezes o rendimento histórico da MESMA ficha**. **10× PERGUNTA · 100× RECUSA**, e a assinatura de grandeza (500×–2000×) **sugere o número certo em um toque**.

**⛔ E ELE NÃO É RUIDOSO — é o que o separa dos 111 alarmes falsos:** produção do DOBRO passa (variação ≠ grandeza) · **sem histórico não julga** (primeira receita nunca é alarme) · **com UM lote só também não** (um lote atípico viraria a régua).

**⚠️⚠️ ACHADO AO LIGAR O GUARD — a etapa fechava ANTES da conclusão.** Com a recusa dentro do `concluir`, a cozinha digitava 22864, levava o aviso **e a tarefa já estava fechada**, sem como repetir: estado pela metade no meio do turno. A pergunta passou pra **antes de qualquer escrita** (`avaliarGrandezaDaConclusao`). ⛔ **E não é uma segunda régua:** é a MESMA composição chamada mais cedo, com o guard do motor de pé pros outros caminhos.

**⭐ E O TABLET PASSOU A DIZER A UNIDADE** (*"Quantos saíram? **em KG**"*) — a cura da causa na raiz, porque quem pesa em grama vê a régua do sistema antes de digitar.

**⛔⛔ LOTE ESTORNADO NUNCA ENTRA NA MÉDIA** (`stock_conclusao_estornada`, CREATE-only, **unique por conclusão** — estornar 2× é impossível, não "checado"). Sem isso o rendimento podre de **2858** continuaria sendo *"o histórico"* da maionese e envenenaria toda conclusão seguinte — **inclusive o próprio guard**, que passaria a aprovar o erro por ele ter virado a norma. *É o dado ruim mais perigoso: o que se legitima com o tempo.*

**⭐ O ESTORNA-E-RELANÇA (`estorna-e-relanca.ts`) NÃO É CONTAGEM** — e a diferença é o ponto: um ajuste deixaria no ledger um `AJUSTE_CONTAGEM` de **−22.841 kg**, um buraco com cara de perda física que envenenaria o Real vs Teórico pra sempre. Não houve perda: **houve um número digitado errado**. Correção = **estorno + novo**, e o **custo do lote NÃO muda** (R$ 248,56), o que é justamente a prova de que é grandeza.

**⭐⭐ "RECEITA JÁ EXISTE" — AS TRÊS PORTAS.** Medido: as fichas da CUBA e da MAIONESE estão `ativo=false` **com o item-invólucro ATIVO**, e como `seContaFisicamente` inclui INTERMEDIARIO, o dono levava a frase sobre **NOTA FISCAL** num produto que a cozinha FAZ. Em PRODUTO_FINAL era pior: **nascia um segundo item em silêncio**. Agora é uma recusa só (409, pergunta), com **reativar** (primária — é o caso dele) · **renomear a antiga** (pela porta única de rename, que grava o apelido de busca) · **criar assim mesmo** (o escape que já existia — nenhuma terceira porta de escrita nasceu).

**⭐⭐ A QUARENTENA DE VENDAS NASCEU** — nos DOIS relatórios, por uma **porta única de leitura**. É a **terceira** vez que esta casa paga pela mesma ausência (`rawOfxBlob` 13/08 · `fatura_quarentena` 16/09). ⭐ E o *"não leu nada"* deixou de ser uma frase só: as pistas separam **arquivo vazio** · **sem tabela** (o `.xls` do Suitable é HTML) · **outro relatório** · **dia sem venda**. O expurgo de 12 meses **nasceu com chamador** no cron (a lição do E10: promessa escrita que não roda é pior que nada).

**⚠️⚠️ REGRA 11 PEGOU DOIS GUARDS MEUS — "menção, não uso" pela QUARTA vez.** Repondo os defeitos, eles ficaram **verdes**: a linha do `import` no topo já bastava pro `toMatch`, e o `indexOf` da ordem achava o símbolo no próprio import. Apertados com `usosDe`/`posDoUso`, os três defeitos mordem.

**⚠️ 1 TESTE DE 01/09 INVERTIDO COM O MOTIVO ESCRITO:** ele afirmava *"ficha INATIVA não bloqueia — arquivar e recriar continua possível"*. Medido, isso é a fábrica de duplicata.

**10.435 verdes · TS 0 · `pg_dump pre-sprintB-20260919-033749` (6,5 MB) antes das 2 migrations (CREATE-only, guard de isolamento verde).**

📋 **PENDENTE, E É DECISÃO DO DONO (preview pronto, NADA gravado):** o estorno das 2 gerações podres. A cascata (as porções de maionese que consumiram a cuba a R$ 0,04/kg em vez de R$ 10,87) tem o Δ CMV medido no preview.


### ⛔⛔⛔ A RECUSA NÃO DIZIA QUAL DOS 58 ITENS — E O TETO DE 5 CENTAVOS CAIU NA MEDIÇÃO (19/09/2026)

**O dono, travado na baixa de 18/09:** *"o confirmar recusa com «Este item ficaria com 0 unidades e valor R$ -0.04» mas NÃO DIZ QUAL ITEM dos 58 — fico travado sem saber onde agir (e os outros 57 reféns do 1)."*

**⭐⭐ DE ONDE O CENTAVO NEGATIVO NASCE, medido em prod:** `custoMedioPorItem` devolve `round2(valor / saldo)` — um número de **TELA** — e a baixa **multiplica** esse arredondado pela quantidade. O erro **cresce com a quantidade**:
```
OVO BRANCO · 1.019 un · R$ 555,64 · custo médio arredondado 0,55
   zerar: 1.019 × 0,55 = R$ 560,45  →  sobra R$ -4,81
```
**47 de 190 itens com saldo > 0 ficariam negativos ao zerar** — o pior é a **CUBA MAIONESE, R$ -113,63** (o resíduo do lote podre do Sprint B).

**⚠️⚠️ ISSO DERRUBOU O TETO DE ~R$ 0,05 QUE O DONO PROPÔS** — ele recusaria 46 dos 47. O teto que fica é o **LIMITE MATEMÁTICO DO ARREDONDAMENTO**, não um número escolhido a dedo: **meio centavo por unidade** (`max(0,05; qtd × 0,005)`), a **mesma régua do E16** (*"0,005 × Σ|quantidade|"*, 29/08). Um custo arredondado na 2ª casa erra no máximo meio centavo por unidade — acima disso não é centavo, é dado torto, e **continua recusando**.

**⭐ E A CURA DE FUNDO É A LIÇÃO QUE ESTA CASA JÁ APRENDEU DUAS VEZES** (a reunitização do pão, 27/08; o custo por unidade da conclusão de produção, 21/08): ***o ledger guarda precisão cheia; quem arredonda é a leitura***. `custoParaBaixar` devolve `valor / saldo` **sem arredondar** — com ele o resíduo **não nasce**. O teto acima é só pra o que JÁ está gravado.

**⛔ `AJUSTA_RESIDUO` SÓ EXISTE QUANDO A QUANTIDADE VAI A ZERO.** Com saldo remanescente, valor negativo é dado torto de verdade — é o caso do **fermento** (16/09: consumo lançado antes da nota de compra) — e zerar o valor de um item que ainda está na prateleira **esconderia a compra que falta**.

**⭐⭐ O RÉU TEM NOME.** `MovementInvalidError` passou a carregar o `culpado` (item, nome, saldo e valor depois) e a mensagem diz o estado de hoje e o que a baixa tira. Medido em prod, com rollback:
```
«porcao file para xis 150grama» ficaria com 1 UN e valor R$ -10.00 — dinheiro negativo
com saldo positivo é um estado que não existe. Hoje ele tem 3 UN valendo R$ 0.00;
esta baixa tira 2 UN (R$ 10.00). Confira a quantidade: ela costuma ser o sintoma.
```

**⭐ O LOTE NÃO FICA REFÉM DE UM ITEM — e a ATOMICIDADE NÃO AFROUXA.** A baixa **junta todos os barrados** e **desfaz tudo** (gravar 57 e "meio" o 58º seria o estado pela metade que o módulo existe pra evitar). O que muda é que a **recusa carrega o caminho**: 409 `ITEM_BARRADO` com os réus e a oferta *"baixar os outros N e deixar este pendente"* — o mesmo desenho do `confirmouSanidade` (05/09), ***pergunta, nunca recusa cega***. ⚠️ E **as linhas do dia continuam gravadas**: resolvido o item, um reprocesso baixa o que faltou, **sem reimportar nada** — a tela diz isso, senão pular vira perder.

**⚠️ O SUSPEITO DO DONO FOI INOCENTADO PELA MEDIÇÃO:** *"porcao file para xis"* está em **3 UN · R$ 0,00**, não negativo (é um dos **6 itens** com saldo > 0 e valor zerado). **Os dois candidatos com a assinatura EXATA de −0,04** são *«porcao beef de alimenuta»* (40 un · R$ 490,36 → 40 × 12,26 = 490,40) e *«beef aparmegiana de carne 120g»* (13 un · R$ 121,25 → 13 × 9,33 = 121,29). **Os dois cabem no teto proporcional e, com o custo cheio, nem chegam a nascer.**

**⚠️ E A PRIMEIRA PROVA EM PROD FOI SONDA MINHA ERRADA:** ela só baixava os chunks do primeiro paint e devolveu **5 ⛔** com o código **no build**. *Sonda errada dá um vermelho tão convincente quanto um defeito real* — conferido por grep no build servido antes de reportar qualquer coisa.

**PROVADO EM PROD, no chunk que prod serve, nos DOIS viewports (REGRA 12):**
```
CELULAR 200 · 56 KB      DESKTOP 200 · 56 KB
  ✓ a recusa NOMEIA os réus · ✓ "baixar os outros N" · ✓ o dia continua reprocessável
  ✓ 409 ITEM_BARRADO · ✓ o escape · ✓ composição ÚNICA (uma lista, não uma por viewport)
```
**REGRA 11 — 16 guards, cada trava reposta dá vermelho** (custo arredondado de volta · contiguidade do teto · atomicidade afrouxada · a lista sumindo da tela). ⚠️ E **uma asserção minha estava errada**: contei `barrados.itens.map` e peguei os 2 usos do *reenvio* — a régua é a **lista desenhada** (`<li key>`), não toda menção. **10.401 verdes · TS 0 · deploy `4SF_-n8AiR1uo3zoEthUS` 4/4 · Δ bundle +4 KB.**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** repor a baixa de 18/09 — ou ela passa inteira, ou a recusa **nomeia** o réu e oferece baixar os outros. **Recusa sem nome reposta = vermelho.**


### ✅ O VÍNCULO CRUZADO FOI DESFEITO (19/09/2026, autorizado: *"preview conferido"*)

`pg_dump pre-vinculo-cruzado-20260919-010501.dump` (6,5 MB) antes · preview conferido contra o estado do minuto · aplicado **pelas portas únicas**, nunca por script replicando a lógica.

```
ANTES  C41022227-1 #24: PAID · paidTotal 5.617,23 · 2 pagamentos somando 12.520,68 ⛔ não fecha
DEPOIS C41022227-1 #24: PAID · paidTotal 6.903,45 · 1 pagamento ✓ · juros 2.517,49 · amort 4.385,96
       C41022570-0 #14: PAID · paidTotal 5.617,23 · 1 pagamento ✓
              amortização 4.166,64 + encargos 1.450,59 (juros 466,52 + correção 984,07)
              saldo 95.833,36 → 91.666,72   ⭐ ao centavo o que o dono aprovou
INTEGRIDADE: 22 parcelas com N:1 na empresa · 0 inconsistentes
JUIZ: 10/10 contratos · balance 0 · dup 0 · venda 0
```

**⭐⭐ E A CIRURGIA CRIOU A PORTA QUE FALTAVA — `desfazerVinculoDeParcela`.** Não existia jeito de soltar um vínculo N:1: o `DELETE .../parcelas/[number]` mexe **só no caminho 1:1** e **deixa os `LoanInstallmentPayment` de pé** — usá-lo aqui deixaria a parcela **OPEN segurando pagamento**, pior que o defeito. ⚠️ *Cirurgia que se faz uma vez vira script perdido; gesto que fica vira porta* — e o dono vai errar de novo (dois contratos do mesmo banco adjacentes num menu é caso de repetir).

⛔ **A porta devolve a parcela ao estado de quem NUNCA foi paga** (pagamentos soltos, split limpo, status OPEN) e **quem re-grava é sempre `vincularPagamentoDeParcela`**, que recalcula do zero. *Nada de ajustar `paidTotal` na mão: número de dinheiro corrigido a dedo é o começo do dado que ninguém explica depois.*

**⚠️ E EU QUASE REPORTEI UM ALARME FALSO:** vi `paidInterest 466,52` e anunciei que o split tinha saído diferente dos R$ 1.450,59 aprovados. **Medi antes de afirmar** e os encargos estavam inteiros — num contrato POS eles vêm **partidos em juros + correção monetária** (466,52 + 984,07), que é mais preciso que a linha única do meu preview. *Olhar um campo e concluir sobre a soma é a mesma pressa que produziu o `'categoryId' in t`.*

⚠️ **DRE de setembro (mês aberto):** estas duas parcelas somam **R$ 3.968,08** de despesa financeira — antes a #24 sozinha lançava 1.231,27 sobre um `paidTotal` que não era o dela.

⚠️ E a **ponte da RGE (R$ 307,22) FICA** — decisão do dono: *"era retirada de verdade, conta de luz da minha casa paga pela empresa"*.


### ⛔⛔⛔ O PALPITE DE EMPRÉSTIMO NUNCA EXISTIU — SELECT INCOMPLETO, E O ESTRAGO FOI VÍNCULO CRUZADO (19/09/2026)

**O dono:** *"vinculei a parcela pelo gesto da caixa e nada aconteceu."* E a cadeia, medida por id, é mais longa que o relato:

```
1. palpites-da-caixa buscava os contratos SEM o campo `status`
2. detectLoanPayment começa com  loans.filter(l => l.status === 'ACTIVE' || 'LATE')
   → com o campo UNDEFINED, a lista fica VAZIA
3. → nenhum contrato casa → NENHUM palpite de parcela, NUNCA (zero, desde que a caixa nasceu)
4. sem palpite, o dono escolheu numa lista de 8 contratos → pegou o errado
5. a linha do C41022570 foi parar na parcela #24 do C41022227-1  ⛔ VÍNCULO CRUZADO
```

**⚠️⚠️ É A DOENÇA DO SELECT INCOMPLETO — a mesma do PIX de 7.000 (17/08):** o motor decide com um campo que a consulta não trouxe, e **não dá erro: dá silêncio**. ⭐ O que deixou passar foi um **`as never`** no call-site — sem o cast, o TypeScript teria acusado o campo faltando. *Cast que cala o compilador é o lugar onde o select incompleto se esconde.* ⚠️ E o `.catch(() => new Map())` da rota fechava o caixão: se explodisse, alguém veria; como só "não casa", o silêncio é perfeito.

**⭐ A LIB SEMPRE SOUBE A RESPOSTA** (medido com a forma certa): `LIQUIDACAO DE PARCELA-C41022570` → contrato **C41022570-0**, **parcela 14** — o extrato escreve o número sem o sufixo e `descriptionMatchesContract` já resolve isso desde 27/06. O motor estava certo; quem o cegava era a consulta.

**⚠️ E TRÊS SONDAS MINHAS ERRARAM ANTES DE EU ACERTAR** — a primeira chamou a lib com a assinatura errada, a segunda esqueceu o `status` (o MESMO campo do bug), a terceira passou `dueDay`, que não existe em `Loan`. *Sonda errada dá um vermelho tão convincente quanto um defeito real* — cada uma foi conferida contra a assinatura antes de virar conclusão.

**AS TRÊS CAMADAS DA FALHA MUDA, todas consertadas:**
| camada | como calava |
|---|---|
| **motor** | select sem `status` → palpite nunca nasce |
| **mensagem** | *"Alguns lançamentos não são elegíveis (conta errada, já vinculados, ou não são débito)"* — três motivos, nenhum nomeado |
| **rota** | `VinculoDeParcelaError` não é `ResolverError` → escapava como **500 sem corpo** |
| **tela** | a recusa renderizava **no topo da caixa** — no celular, com o dedo num cartão do meio da lista, está fora da tela |

⭐ Agora a recusa diz **qual** e **onde**: *"«LIQUIDACAO DE PARCELA-C41022570» já está vinculada à parcela 24 do contrato C41022227-1 — desfaça lá primeiro"*, em 422, **dentro do cartão da linha**.

**⭐⭐ E O CONVITE DA PONTE DEIXOU DE SER UM TOAST.** O dono: *"aparece uma mensagem em cima e ela DESAPARECE sozinha — depois eu não sei onde achar as retiradas. **Fiz 2 que teriam ido pra PF e não sei se deram certo.**"* ***Nada que some sozinho carrega decisão.*** O painel passou a abrir **ancorado na linha** (como o Find & Match) e **a linha não sai da caixa** até ele responder — mandar ou pular, explícito.

**⭐ E "RETIRADAS" GANHOU LUGAR VISÍVEL — a 9ª volta da porta sem maçaneta.** A tela `/empresas/[id]/retiradas` existe **desde 08/08** e só era alcançável por um banner de órfãs ou de dentro do próprio painel da ponte: **nunca esteve no menu**. Entrou, e ganhou a seção **"já mandadas pro perfil pessoal"**, cada uma com link pra ponte — que mostra as duas pontas. *A pergunta "deu certo?" não tinha tela.*

**AS 2 RETIRADAS DELE, respondidas por id:**
```
✅ RGE SUL · R$ 307,22 · 17/09 → PONTE COMPLETA
     ponte cmu7tbagr006llqd9mrtrefsr · entrada na PF cmu7tbag4006jlqd9oxbqstec
⛔ MONIQUE SOARES PAZ · R$ 350,00 · 16/09 → PENDENTE (sem ponte) · tx cmu7qxrxh013g7tu92g58moyv
```

**PROVADO EM PROD depois do deploy** (o montador real, sobre as linhas que ele tentou):
```
LIQUIDACAO DE PARCELA-C41022227 → Contrato C41022227-1 — parcela 25 · R$ 6.903,45
LIQUIDACAO DE PARCELA-C41022570 → Contrato C41022570-0 — parcela 14 · R$ 5.617,23
(antes deste deploy: ZERO palpites de empréstimo, sempre)
```
**REGRA 11 — 4 defeitos repostos, 1 vermelho cada** (select sem `status` · convite voltando a recarregar · recusa genérica · Retiradas fora do menu). **10.381 verdes · TS 0 · deploy `PT39n-HltnU-kOg9XCbVv` 4/4.**

📋 **PENDENTE, E É DECISÃO DO DONO (preview pronto, NADA gravado):** desfazer o vínculo cruzado — tirar os R$ 5.617,23 da #24 do C41022227-1 (ela nunca foi desse contrato) e vinculá-los à **#14 do C41022570-0**: amortização R$ 4.166,64 + encargos R$ 1.450,59, saldo 95.833,36 → 91.666,72. ⚠️ Hoje a #24 tem **2 pagamentos somando R$ 12.520,68 com `paidTotal` 5.617,23** — inconsistente enquanto o cruzado estiver lá.


### ⛔⛔ DOIS GESTOS QUE EFETIVAVAM PELA METADE — E NENHUMA DAS DUAS CAUSAS ERA A SUSPEITA (18/09/2026)

**⭐ 1. RETIRADA SEM PONTE — a capacidade NÃO tinha sido guardada.** O dono: *"marquei uma saída como Distribuição de Lucros na caixa e ela só gravou a categoria: não abriu a ponte que mandava a retirada pro meu perfil PF. **Não quero meia-ponte gravada.**"* Ele perguntou se a peça tinha ficado nas guardadas da faxina de 15/09. **Não:** o `WithdrawalPanel` está **VIVO** (usado pelo `xero-row` e pela tela do sócio) e os 4 arquivos com selo `CAPACIDADE GUARDADA` são outros. O que houve é mais silencioso — **a caixa de entrada nasceu sem o convite**, porque o *"convite pós-categorização"* morava no **Pendentes**, e o Pendentes morreu como TELA em 15/09. *Quando uma tela morre, some junto tudo que era oferecido POR ELA — e some sem erro nenhum.*

⭐ **O passo 2 agora é oferecido na hora** (e reusa o painel que existe — REGRA 4): categorizar na seção 💰 abre *"mandar pro perfil PF →"*, que cria a entrada na PF e vincula as duas pontas pelo mesmo `/api/pontes` de sempre. ⛔ **Pular é legítimo** (*"opcional mas oferecido sempre"*) — e a tela **diz onde reabrir**, senão pular vira perder. ⭐ Quem decide se é retirada é o **`dreGroup`**, a MESMA régua que separa a seção do menu: uma decisão, um lugar.

⚠️ **E o estado que sobra já tinha nome e casa:** `orphanWithdrawalWhere` chama de **órfã** a saída marcada como retirada **sem ponte**, e `/retiradas-pendentes` a lista. **Medido: a linha do dono está lá** — `cmu7qxrxh013g7tu92g58moyv` (R$ 350, 16/09, *PAGAMENTO PIX-PIX_DEB … MONIQUE SOARES PAZ*). O gesto sempre foi reabrível; o que faltava era a caixa **dizer isso**.

**⛔⛔ 2. SELETOR DE EMPRÉSTIMO "VAZIO" — NÃO ERA DADO, ERA CSS.** O dono: *"clico «parcela de empréstimo» e o seletor abre SEM NENHUM empréstimo — e a empresa TEM contratos ativos."* As três hipóteses dele (companyId, filtro de status, universo) **caíram na medição**: a rota devolve **10 contratos, 8 com parcela em aberto, em 41 ms** — e o **log do nginx prova que o payload chegou no navegador dele**: `GET /api/empresas/…/emprestimos → 200 · 8024 bytes`, às 23:37:06.

⭐ **A causa:** o cartão ≍ é `overflow-hidden` (é o que arredonda os dois lados do grid) e o menu era `absolute` **dentro** dele — os chips são o **último bloco** do cartão, então **o painel era recortado pela borda**. ***Menu que abre fora da vista é indistinguível de menu vazio.*** ⚠️ E foi por isso que a categoria "funcionou" e o contrato não: a seção 💰 é a **primeira**, e era o único pedaço que sobrava visível.

⭐ **O conserto é no MENU, não no cartão:** o painel foi pro **portal** (sem ancestral que corte) e a posição virou função pura (`posicaoDoMenu`) — abre **pra cima** quando o chip está no rodapé (no celular do dono: `ACIMA com 682px`), **nunca sangra pela direita**, e a altura é o **espaço REAL** que sobra. Um teste prova que o cartão **continua** com `overflow-hidden`: o conserto não pagou o arredondamento como preço.

**⛔ 3. E O VAZIO PAROU DE MENTIR.** As três listas carregam com falha macia; o menu dizia *"nenhum contrato com parcela em aberto"* — uma **afirmação sobre a empresa feita a partir de uma falha de rede**. Agora `CARREGANDO`, `FALHOU` e `OK+vazio` têm frases diferentes, e **só a última fala da empresa**.

**PROVADO EM PROD (bundle servido, os dois viewports):**
```
seletor de empréstimo: 10 contratos · 8 no menu (Caixa 33/32 · Sicredi 4/22/14/24 · Banrisul 25/59)
convite da ponte nas 5 categorias de retirada · tipo sugerido só quando o nome não é ambíguo
   "Pró-labore e Distribuição" → (o dono escolhe)   ⭐ diz as duas coisas, não chuta
menu no PORTAL ✓ · convite ✓ · pular diz onde reabrir ✓ · selo das 2 pontas ✓ · vazio honesto ✓
chip no rodapé do celular → menu abre ACIMA com 682px
```
**REGRA 11 — 3 defeitos repostos, 1 vermelho cada** (portal removido · convite não oferecido · vazio afirmando com a carga falha). **10.365 verdes · TS 0 · deploy `BHyeQ3x61hkDzdCxmQgut` 4/4 · Δ bundle +16 KB.**

📋 **FICA PRO DONO:** a linha de R$ 350 de 16/09 está em **Retiradas pendentes** esperando a ponte — e daqui pra frente o convite aparece no ato.


### ⛔⛔⛔ 10 DOS 12 CHIPS DO CARTÃO ≍ NÃO ENTREGAVAM O GESTO (17-18/09/2026)

**O dono, navegando em prod no celular:** *"clico «casar com conta a pagar» na linha do BAMBERG (que TEM candidata — o card dela está logo abaixo no PRA TUA MÃO) e não abre painel nenhum — pior: a tela SAI/fecha o cartão. **Gesto principal do balcão mudo = REGRA 2.**"*

**⭐ A PERÍCIA COMEÇOU MEDINDO, e o que ela achou é maior que o relato.** O deep-link estava certo, o card existia no destino e a fila até abria o grupo. **O defeito era NAVEGACIONAL:** `window.location.href` levava pra `/conciliacao?abrir=` — **a PRÓPRIA tela**. O reload fechava o cartão ≍, jogava o scroll pro topo e deixava o painel **abaixo da dobra**. No celular ele nunca chegava a vê-lo.

**⛔⛔ E AÍ A VARREDURA DOS 12 CHIPS (6 saída + 6 entrada) MOSTROU QUE SÓ DOIS FUNCIONAVAM:**

| chip | o que acontecia |
|---|---|
| casar com conta a pagar | reload da própria tela — painel fora da dobra |
| **casar com conta a receber** | deep-link pra `/empresas/<id>/contas-a-receber` — **rota que NÃO EXISTE**, 404 |
| **é despesa: categoria** · recebimento de venda · aporte | `<select>` alimentado por **`/api/categorias`** — **rota que NÃO EXISTE**: o menu nascia **VAZIO** |
| **parcela de empréstimo** · **estorno** | botão **sem seletor nenhum** → ação sem alvo → **422** *"Escolha o contrato…"* |
| transferência enviada/recebida | levava ao `/parear`, que **ignorava o `?abrir=`** |
| pagamento de fatura · ignorar | ✓ os dois únicos que entregavam |

**⭐⭐ A LEI QUE FICOU, e é o que o guard de família cobra chip a chip:**

> **todo chip ou EFETIVA com o alvo que a TELA consegue fornecer, ou LEVA a uma rota que EXISTE e que CONSOME o parâmetro.** Não há terceira saída: chip que manda a ação sem alvo é **mudo**; chip que aponta pra rota inexistente é **porta pintada**.

**O QUE MUDOU:**
- **Casar resolve ONDE O GESTO NASCEU:** o `FindAndMatchPanel` abre **embaixo da própria linha** (não é um segundo card — é o mesmo componente que o lote e a sugestão já abrem por props, e ele cobre PAYABLE **e** RECEIVABLE, o que dá destino real ao "casar com conta a receber"). Conciliar → a linha **sai da caixa na hora**.
- ⛔ **`destinoDaAcao` só devolve destino PROVADO.** As duas ações de casar deixaram de ser caminho e voltaram a ser *"gesto que pede alvo"*: o servidor recusa **ensinando**, como todos os outros. Sobram as transferências — e o `/parear` **passou a consumir o `?abrir=`**, pré-marcando a perna tocada (⛔ **sem chutar a outra**: achar o par é do detector, que sugere pro dono confirmar).
- **O menu virou o do mock:** pílula que **abre só ao tocar**, com seções, busca a partir de 8 opções e ESC/clique-fora pelo hook único da casa. Morreu o `<select>` nativo — era ele que no celular cobria a tela com os 4 cartões.
- **⭐ A RETIRADA GANHOU CASA, SEM VIRAR DESPESA.** ⚠️ A hipótese óbvia (*"o seletor filtra só EXPENSE"*) **caiu na medição**: as 5 categorias de retirada **já são `EXPENSE`** com `dreGroup DISTRIBUICAO_LUCROS`. O que as escondia era o menu chapado. A cura **NOMEIA a classe** — seção *«💰 retirada / distribuição de lucros»*, primeira, com a frase *"dinheiro do sócio — não é despesa operacional e fica fora do DRE"* — e **nada é reclassificado pra caber**.

**⚠️⚠️ E A PROVA EM PROD PEGOU DOIS DEFEITOS MEUS que teste nenhum pegaria:**
1. **O menu ofereceria 203 ARMADILHAS.** A rota devolve o catálogo INTEIRO — **263 categorias, 60 ativas**. É o defeito de 17/09 na fatura do cartão de novo (*"o que a tela oferece é SUBCONJUNTO do que a gravação aceita"*). A trava ficou na **régua pura** (vale mesmo se a chamada esquecer o `?soAtivas=true`), não só no parâmetro.
2. **⭐ O BANCO ABREVIA — e semear a busca com o nome inteiro devolvia ZERO.** Extrato: `BAMBERG COMERCIO E REPRES LTDA`; cadastro: `…REPRESENTACOES LTDA`. Busca cheia → **0 candidatas** (o painel abriria dizendo *"nada encontrado"* com **3 contas abertas dele** logo abaixo — *erro disfarçado de vazio*); `BAMBERG COMERCIO` → **as 3**. A semente virou o **prefixo com 2 palavras significativas**, com o conector junto (a busca é `contains`: o fragmento tem que ser **contíguo** — `CIA DA FRUTA`, nunca `CIA FRUTA`).

**PROVADO EM PROD, pelas rotas reais e no BUNDLE SERVIDO (REGRA 12, os dois viewports):**
```
BAMBERG → casar → o painel abre AQUI, buscando "BAMBERG COMERCIO" → 3 candidatas
   · NF 1746952 · R$ 2.870,70 · venceu 14/09 · dif R$ 165,06   ← a "1 vencida" do dono
   · NF 1748144 · R$ 1.477,28 · vence 21/09
   · NF 1749209 · R$ 1.341,80 · vence 28/09
FRANCIELE R$ 500 → 1ª seção do menu: 💰 retirada / distribuição (5) · depois despesa (44)
menu de categoria: 263 → 60 ativas     ⛔ /api/categorias: 404 (era daqui que vinha o vazio)
bundle celular e desktop: menu ao toque ✓ · retirada ✓ · painel na linha ✓ · <select> nativo: NÃO ✓
/parear?abrir= → lê o alvo ✓ · marca a perna ✓ · e DIZ quando não achou ✓
```
**REGRA 11 — 6 defeitos repostos, todos vermelhos** (o do casar-receber dá **3**: a lista de destinos, a rota inexistente e o alvo ignorado). **2 testes invertidos com o motivo escrito** (o E2E que afirmava `DEEP_LINK` e as 4 asserções que afirmavam o nome inteiro na busca). **10.345 verdes · TS 0 · deploys `QLzcIxYKSkuYyCb3IoU8O`, `SC5edWDFe6PLMCPJMh3DC` e `zQzIWczVVh_q2CXi5Salq`, os três 4/4 · Δ bundle +8 KB.**

📋 **FICA PRO DONO (REGRA 2, o clique é dele):** BAMBERG → casar → escolher a NF 1746952 (a diferença de R$ 165,06 é 5,4% da linha, dentro do degrau que **pergunta** — o painel pede pra nomear como juros) → conciliar e ver a linha sair da caixa. E o PIX da FRANCIELE → *"é despesa: categoria"* → **Distribuição de Lucros**.


### ⛔⛔⛔ IMPORT MISTO NÃO GRAVAVA — A TELA APRENDEU A PARTIÇÃO E O VALIDADOR FICOU PRA TRÁS (17/09)

**O dono, na fatura Sicredi:** *"40 linhas, 8 já no sistema (R$ 828,50, em leitura sem checkbox — como a tela de ontem manda), 32 novas marcadas (R$ 2.365,85). Confirmar → 'a soma das linhas 2.365,85 não fecha com o total 3.194,35, diferença 828,50'."*

**⛔⛔ A DIFERENÇA ACUSADA ERA, AO CENTAVO, O QUE A PRÓPRIA TELA TINHA TIRADO DA MÃO DELE.** E foi eu quem criou as duas metades: ontem a tela passou a **impedir de marcar** as já-no-sistema (sem checkbox, em leitura — e está certo), mas o `confirm` continuava exigindo que as linhas **ENVIADAS** fechassem sozinhas com o total. Juntas, as duas tornavam o import misto **impossível de gravar**.

⚠️ **É a segunda régua de novo — agora entre PREVIEW e CONFIRM.** O preview já dizia a frase certa (*"você marcou 32 de 40, por isso o total é outro"*); quem não sabia da partição era a gravação. É a dupla que já custou o import de OFX inteiro, e que o `resolveImportStatuses` resolveu lá com o mesmo desenho: **uma função, as duas pontas**.

**⭐ A CONTA CERTA:** `Σ(novas) + Σ(já no sistema) == total da fatura`. A já-gravada **conta pra fechar e não regrava** — o dedup de sempre cuida. E a partição é a **MESMA** da tela porque nasce do mesmo `contentHash` (`identidadeDaLinha`): o validador não inventa o que é novo, ele pergunta pela mesma chave. ⚠️ E ele **não confia no cliente**: lê as já-gravadas do banco pela competência da fatura.

**⛔ E A DEFESA NÃO AFROUXOU** — em fatura 100% nova não há nada gravado, `jaNoSistema` é 0 e o fechamento continua exigindo a soma cheia. *Ela não ficou mais permissiva: aprendeu que a fatura pode chegar em duas partes.*

⭐ **As bordas que fariam a conta torcer, todas travadas:** reenviar a fatura inteira **não conta duas vezes** (a enviada que já existe vale uma) · **estorno já gravado entra com sinal** (senão misto com crédito nunca fecharia) · **pagamento de fatura fica fora** (não é lançamento dela, é a quitação).

**⛔⛔⛔ E A MINHA PRIMEIRA CORREÇÃO TROUXE A SEGUNDA RÉGUA DENTRO DELA — o dono pegou na volta seguinte.** A tela pergunta *"esta linha já está no sistema?"* pelo **hash**: a linha é conhecida **onde quer que ela more**. Eu fui buscar as gravadas **pela competência da fatura** — e as 8 do caso real são **parcelas que moram em faturas de jun/jul/ago**. Em `2026-09` a busca achou **ZERO**, e o fechamento voltou a cobrar as novas sozinhas com a mesma diferença de 828,50. ***Duas chaves de partição são duas réguas***, e eu escrevi a segunda dentro do conserto da primeira.

**⭐ A PERGUNTA TEM UMA RESPOSTA SÓ:** o `contentHash` existe no banco — sem competência, sem data, sem o mês de qual fatura. E ela precisa das duas metades:
- **o validador** parte as linhas por hash (a mesma chave que pinta o selo "já no sistema" na tela);
- **a tela manda as já-no-sistema JUNTO** — senão o servidor nunca as vê, e nenhuma partição do mundo as encontra. Elas **contam pra fechar e não regravam** (o dedup de sempre pula).

**REGRA 11 — 2 defeitos repostos:** a busca por competência (**3 vermelhos**, um reproduzindo os 2.365,85 × 3.194,35) · a tela voltando a mandar só as marcadas (**1**).

⚠️ E o tudo-ou-nada original segue travado: reposto, dá vermelho igual.


### ⛔⛔ FATURA DA CAIXA — DUAS RÉGUAS NA MESMA TELA (17/09)

**O dono:** *"o banner do topo diz 'não fecha' (somou compras+encargos 5.119,53 sem SUBTRAIR os estornos 12,54) enquanto o rodapé diz '✓ bate: 5.106,99'."*

**⭐ E A CONTA PRINCIPAL SEMPRE ESTEVE CERTA — `diferenca 0`.** Quem reprovava era um **check secundário** que confere o BRUTO contra o *"Total cartão"* declarado:

```
diferenca 0 · matches FALSE
"Total cartão não bate: somei compras+encargos R$ 5.119,53 mas o declarado é R$ 5.106,99"
```

**⛔⛔ A CAUSA: nem todo banco declara DOIS números.** O Banrisul PJ imprime `TOTAL DE GASTOS` **e** `Saldo da fatura atual` (13.797,73 × 13.779,73); a **Caixa imprime um só** — o que se paga —, e o parser o devolve nos dois campos. Aí o check passava a comparar **bruto contra líquido**, e os 12,54 de estorno viravam "não fecha".

⭐ **A cura não é remover a defesa** (ela existe pra pegar bruto declarado que não bate): é ela **só existir quando há duas declarações diferentes pra conferir**. Onde o banco declara os dois, continua mordendo — há teste pros dois lados.

**REGRA 11 — a fórmula sem estornos reposta: 3 vermelhos**, um deles reproduzindo a mensagem exata que o dono viu.

**⭐⭐ E O SEGUNDO GOLDEN VEIO DA QUARENTENA — o primeiro com desfecho OK.** É a promessa *"a que FECHOU é o golden de amanhã"* se cumprindo pela primeira vez: `caixa-fatura-rica.txt`, 15 linhas, com **rotativo, multa, mora, IOF, anuidade, cashback e estornos** num documento só. **11 fixtures / 7 bancos**, todas verdes.

⚠️ **E O GERADOR PEGOU UMA PALAVRA FALTANDO NA LISTA DE PRESERVAR:** a anonimização comeu **`final`** (de `Total final (cartão XXXX)`) e o `totalFinalByCard` veio vazio. O script abortou em vez de gravar uma fixture que testaria outro documento — **é a terceira vez que essa trava se paga** (26/08 "PAGAMENTO", 31/08 os meses, hoje "final").

**⭐ O IMPORT QUE O DONO CONFIRMOU ENTROU FECHANDO:** 15 lançamentos · `5.119,53 − 12,54 = 5.106,99` ao centavo · os estornos são `CASHBACK ANUIDADE 12,50` e `AJUSTE CREDITO 0,04`.


### ⚠️⚠️ O SELETOR "SEM CATEGORIA" COM O DADO GRAVADO — NÃO REPRODUZI (17/09)

**O dono:** *"o painel mostra os 4 grupos certos, mas TODAS as linhas exibem o seletor em '— sem categoria —'. O value do `<select>` não está sendo hidratado."*

**⛔ MEDI AS QUATRO CAMADAS E TODAS ESTAVAM CERTAS:**
```
payload sem parâmetro     33 linhas · 33 com categoryId · 49 opções · 0 ids fora da lista
payload COM ?fatura=2026-09  idem  ← o caminho que a tela usa ao escolher a fatura
fonte no servidor         value={otimista[t.id] ?? t.categoryId ?? ''}
JS SERVIDO (minificado)   value: W[e.id] ?? e.categoryId ?? ""
```

⚠️⚠️ **E É POR ISSO QUE ESTA ENTRADA EXISTE: eu NÃO reproduzi o defeito, e não vou registrar conserto de bug que não vi quebrar.** A hipótese que sobra é **bundle velho no navegador** (a casa já pagou isso em 26/08: *"o navegador do dono guardou a página quebrada em cache; um hard-reload resolvia"*), mas **hipótese não é medição** — fica dito como hipótese.

⚠️ **UMA SONDA MINHA ERA FRACA E EU A REPORTEI COMO PROVA:** na volta anterior escrevi *"com categoryId no payload: 33 de 33"* — o teste era `'categoryId' in t`, que é **verdade mesmo com `null`**, e naquele momento as 33 estavam todas sem categoria. *Chave presente não é valor presente*, e eu apresentei isso como se fosse.

**⭐⭐ E O TEXTO DEDUROU O WIDGET — a volta seguinte fechou o cerco.** O dono: *"TODAS as 33 linhas mostram 'categoria salva: <certa>' e o `<select>` AO LADO continua em '— sem categoria —'"*. ⭐ **Foi o cinto que virou instrumento de diagnóstico:** ele matou a hipótese do bundle velho (o texto só existe no bundle novo) e isolou a falha no widget. ⚠️ Uma ressalva que eu devia: o texto lê `categoryName` direto do payload, então ele prova o NOME, não que o id case com alguma `<option>`.

**⛔ MEDIDO DE NOVO, E AS OPÇÕES TINHAM OS IDS:** contra o `dashboard.expenseCategories` (49) e contra o fallback de `/categorias` (262), **linhas com id fora da lista = 0 nas duas**. Então não é descasamento de id — a causa continua sem observação direta (a tela é cliente; não consigo o DOM dele).

**⭐⭐ O CONSERTO ENTÃO É POR CONSTRUÇÃO, nas duas suspeitas que o dono nomeou:**
1. **`key` carregando o valor** (`key={\`cat-${'${t.id}'}-${'${valor}'}\`}`) — React aplica `value` no nó; se no commit a lista de options ainda não tem aquele id, o browser cai na primeira opção, e **num commit seguinte, com o `value` IGUAL, React não reaplica** (só escreve prop que mudou). O nó fica preso em "sem categoria" com o dado certo por baixo. Com o valor no `key`, o nó é NOVO quando o valor chega — **não existe estado velho pra ficar preso**.
2. **`opcoesDoSeletor` garante a option da categoria salva**, mesmo que a lista venha curta, vazia ou de outra fonte. ⛔ *Value sem option é um select que não mostra nada.*

**⭐ E O GUARD RENDERIZA DE VERDADE** (`renderToStaticMarkup`, sem jsdom): pra cada uma das 33 linhas, a `<option selected>` tem que **existir** e carregar o **nome** da categoria — a separação que o dono fez (*"não basta o value bater"*). **REGRA 11: com a garantia removida, o markup volta `null` — exatamente o sintoma dele — 2 vermelhos.**

**O QUE FOI FEITO, e o que cada coisa é:**
- ⭐ **A regra saiu do JSX** pra `valorDoSeletor` (pura, testável). *Regra que mora num `value={...}` é regra que ninguém prova* — a lição do prefill do cardápio (28/08), que quebrou duas vezes antes de virar função. **REGRA 11: o binding ignorando o dado do servidor = vermelho.**
- ⭐⭐ **A categoria gravada passou a ser dita em TEXTO** na linha (*"categoria salva: EQUIPAMENTOS"*). ⛔ **Isto não é o conserto de um defeito que eu vi** — é a tela deixando de depender de **um widget só** pra afirmar o que o banco já sabe. Se o `<select>` falhar em hidratar por qualquer motivo, a linha continua dizendo a verdade.
- ⚠️ **Um guard de hoje foi REAPONTADO, não afrouxado** — ele afirmava o literal do `value` no JSX; a pergunta é a mesma, a resposta mudou de casa.

⭐ **E a tela do cartão tem UMA composição só** (uma `.map` de `linhasDaFatura`), então não há a segunda metade esquecida da entrada manual (16/09) — celular e desktop renderizam o mesmo DOM.


### ⛔⛔⛔ "CATEGORIA NÃO ENCONTRADA OU INATIVA" — DUAS FONTES E UMA PORTA FECHADA (17/09)

**O dono, tentando usar a maçaneta que eu tinha acabado de ligar:** *"escolho categoria na linha da fatura → 'Não consegui categorizar · Categoria não encontrada ou inativa'."*

**⛔⛔ DOIS BLOQUEIOS EM SÉRIE, os dois medidos em prod — e a aposta dele estava certa nos dois:**

```
o seletor oferece 260 categorias — 203 INATIVAS (78%) e 47 de RECEITA
   a rota valida isActive → quase 4 de cada 5 opções eram armadilha

a porta não alcança cartão:  bankAccount.companyId       → 0 linhas
                             businessCreditCard.companyId → 1
```

**1. DUAS FONTES.** A tela pedia `/categorias` **cru** e só tirava a fila `A_CLASSIFICAR`; a gravação exige `isActive`. Agora a lista nasce de `categoriasDestinoDespesa` e a rota valida por `whereCategoriaAceita` — **mesma origem**, com a invariante travada em teste: *o que a tela oferece é SUBCONJUNTO do que a gravação aceita, nunca o contrário*.

**⚠️⚠️ 2. E O SEGUNDO É ERRO MEU DA VOLTA ANTERIOR.** Reusei `/despesas/recategorizar` em nome da REGRA 4 e **não medi se ela abria pro caso novo**: ela filtra posse por `bankAccount: { companyId }`, e **compra de cartão nasce SEM conta bancária** (quem a prende à empresa é o `businessCreditCardId`). Mesmo com categoria válida, a resposta seria *"Nenhuma transação encontrada na empresa"*. ⭐ **A REGRA 4 tem duas metades — achar a porta única E provar que ela serve.** Metade dela é um bug com cara de disciplina. Fix: o filtro passa a aceitar `bankAccount` **OU** `businessCreditCard`. ⚠️ O resto da rota já tolerava (`accountType ?? null` na escada de status).

**⭐ 3. A RECUSA QUE SOBRA ENSINA** (a régua do tradutor 422 do estoque): em vez de *"Categoria não encontrada ou inativa"*, ela diz **o nome**, **o porquê** (inativa · de outra empresa · não existe mais) e **para onde ir**.

**⭐⭐ 4. O FEEDBACK DE SALVO — e o dono nomeou a classe:** *"silêncio depois do clique é o sucesso-disfarçado (ou o fracasso-disfarçado, como agora)"*. Não nasceu botão de confirmar (cada escolha grava na hora); nasceu **selo "salvo ✓"** na linha, o painel **Por categoria** atualizando na frente, e **a falha REVERTE** o seletor com o motivo do servidor. ⚠️ O `value` do select vem do `data`, que só muda no reload — sem o estado **otimista** ele voltava pra *"sem categoria"* na frente dele, que é o fracasso-disfarçado de novo.

**REGRA 11 — 4 defeitos repostos:** a porta voltando a exigir conta bancária (**1 vermelho**) · a mensagem genérica (**1**) · o valor sem sinal (**1**) · o gesto sumindo (**1**).


### ⛔⛔ A TELA DA FATURA — O SINAL, A MAÇANETA E O TOGGLE (17/09)

**⭐⭐ O ITEM 1 ERA DE VALOR, E A MEDIÇÃO O REBAIXOU DE CIRURGIA PRA DEPLOY.** O dono viu os 14 estornos listados POSITIVOS (`NETFLIX R$ 85,70`, `VIDAU R$ 1.052,42`) e perguntou o certo: *"perdeu no GRAVAR ou só na EXIBIÇÃO? A soma por categoria vai errar por 5.499,82 se o dado estiver positivo."*

**Medido antes de tocar em qualquer coisa:**
```
amount NEGATIVO no banco: 0   (a casa grava amount POSITIVO; o sinal é o type)
type=CREDIT: 14 · type=DEBIT: 19
Σ DEBIT 11.376,89 − Σ CREDIT 2.749,91 = 8.626,98
```
⭐ **O dado está certo** — é a convenção do módulo desde a Fase 2 — **e a agregação por categoria já usava `signedFaturaAmount`** (REGRA 6, 14/08), então **o erro de 5.499,82 que ele temia não existia**. O defeito era a linha imprimindo `formatBRL(amount)` sem olhar o tipo. ⚠️ **Nenhuma cirurgia.** *A diferença entre "o número está errado no banco" e "errado na tela" é a diferença entre mexer em dado real e um deploy* — e só se sabe medindo.

**O QUE MUDOU NA TELA:** estorno sai **`− R$ x` em verde** com o selo *estorno (crédito)*, e o cabeçalho mostra a **conta à vista**: `débitos − estornos = total`. Sem ela, uma lista com 14 créditos parece somar muito mais do que a fatura cobra.

**⭐⭐ ITEM 2 — A PORTA SEM MAÇANETA, DE NOVO:** as 33 linhas entraram sem categoria (decisão do dono) e **não havia onde decidir**. Agora: **seletor por linha**, **seleção múltipla** com barra fixa (*"categorizar as 15 como…"*) e a **sugestão da regra APRENDIDA** (`predictCategory`) só onde falta categoria — ⛔ determinística e barata, nada de chamada de IA numa rota de dashboard; e ela **sugere**, quem aplica é o clique.

⚠️ **REGRA 4 cumprida duas vezes:** grava pelo **`/despesas/recategorizar`**, a MESMA porta que o "mover em lote" desta tela já usava (inclusive pra UMA linha); e a lista de categorias vem do `expenseCats` que a tela **já carregava** — cheguei a pôr `expenseCategories` no payload do dashboard e **tirei** ao ver que era a segunda fonte.

**⭐ ITEM 3 — A LINHA VENCE O CARTÃO, POR CONSTRUÇÃO.** Varrido: `defaultTreatment` é lido **só no import** (pra SUGERIR a categoria de retirada) e pra exibir; **nenhum caminho reescreve `categoryId` de linha gravada** a partir do toggle. Então em fatura mista o toggle não é mentira — ele é o default, e a linha manda. Guard trava os dois lados: o `recategorizar` não pode passar a olhar o toggle, e o PATCH do cartão não pode escrever em `transaction`.

**REGRA 11 — 2 defeitos repostos na tela:** o valor sem sinal (**1 vermelho**) · o gesto de categorizar sumindo (**1**).

**⚠️⚠️ E A 1ª VERSÃO DO GUARD DO TOGGLE DEU FALSO VERMELHO — a janela de distância, pela quarta vez.** Eu procurei `defaultTreatment` seguido de `categoryId:` numa janela de 400 caracteres e mordi o `queries.ts`, onde o campo só é exibido e há um `categoryId` do mapa de categorias por perto. *Janela de distância já produziu falso vermelho e falso verde nesta casa* (o rastro em 12/09, o menu do PF em 13/09, o rodapé em 14/09). **O que morde é perguntar pelo ARQUIVO certo, não pela vizinhança.**


### ⛔⛔ ESTADO RESOLVIDO DISFARÇADO DE TRABALHO PENDENTE (17/09)

**O dono:** *"quando TODAS as linhas são duplicata, a tela continua parecendo um import pendente — tabela inteira, checkboxes, 'Confirmar e importar 0', nota pequena no rodapé. **Eu quase confirmei duas vezes achando que faltava algo.**"*

**⭐⭐ E A INFORMAÇÃO JÁ ESTAVA LÁ — cada linha vinha com o selo "duplicata".** Não adiantou: ***ninguém lê 33 selos pra concluir que não há nada a fazer.*** Quem conclui é a TELA. É o *"erro disfarçado de vazio"* de cabeça pra baixo — aqui é **estado resolvido com cara de trabalho pendente**, e o custo é o dono gravar duas vezes.

**O QUE MUDOU:**
- **Banner no topo** quando tudo é duplicata: *"Esta fatura já está importada (DD/MM) — nada novo pra entrar"* + **"Ver a fatura no cartão →"**. ⛔ Banner sem saída é só um aviso; o link é o que fecha o gesto.
- **Linha já-no-sistema vira LEITURA** — sem checkbox, cinza, selo *"já no sistema"*, tipo e categoria como texto. ⚠️ Oferecer seletor pra um lançamento que **não vai entrar** é a mesma mentira do botão que não faz nada.
- **⛔ O botão SOME quando não há linha marcada — `disabled` não basta.** Botão desabilitado continua dizendo *"é aqui que se conclui"*, e foi lendo *"Confirmar e importar 0"* que ele quase confirmou de novo.
- **Caso misto:** novas em cima (com checkbox), já-no-sistema embaixo, e o contador diz **"N nova(s) · M já no sistema"**.
- ⭐ **Quem decide o estado é a ROTA** (`jaNoSistema.todasDuplicatas`), não a tela varrendo linhas — senão nasce a segunda régua e ela diverge do `isDuplicate` no primeiro caso de borda.

**REGRA 11 — 3 defeitos repostos:** o botão voltando a `disabled` (**1 vermelho**) · o checkbox incondicional (**1**) · o banner apagado (**2**). O guard tem **auto-teste do detector** contra a tela antiga, senão passaria por cegueira — já aconteceu três vezes nesta casa.


### ⛔⛔ "A IA CLASSIFICOU ERRADO EM MASSA" — ERA A IDENTIDADE, NÃO A CLASSIFICAÇÃO (17/09)

**O dono, na tela de revisão:** *"as compras normais do bloco com sinal negativo (NETFLIX, IFD, VIDAU, ULTRAFARMA) vieram como estorno, só 14 de 33 marcadas, e o rodapé diz Compras R$ 0,00 · Total a importar −2.749,91. O sinal negativo ali é convenção DE SEÇÃO desse layout, não estorno."*

**⛔⛔ MEDI ANTES DE MEXER, E O DOCUMENTO CONTRADIZ A LEITURA DELE — as 14 linhas SÃO crédito.** Três totais impressos pelo próprio banco concordam:

```
Despesas / Débitos no Brasil  11.376,89 = só as POSITIVAS (as 19)
Pagamentos / Créditos         16.529,64 = pagamento 13.779,73 + 2.749,91 (as 14)
Saldo da fatura atual          8.626,98 = 13.779,73 − 16.529,64 + 11.376,89
```

⚠️ **E não existe "seção" pra usar como régua:** dentro do MESMO `HISTÓRICO DE TRANSAÇÕES` do `NR. 0115` convivem as linhas de 24-25/08 **negativas** e as de 02/09 **positivas**, sem nenhum cabeçalho separando. O único sinal que o documento dá é o sinal — e o bloco negativo é estorno de compras do ciclo anterior (uma delas se chama, literalmente, `ESTORNO IOF S/ TRANSAC NO EXTERIOR`; refund carrega o nome do lojista, por isso "NETFLIX" aparece ali).

**⛔ Reclassificar as 14 como compra quebraria os TRÊS totais** e a fatura pararia de fechar — depois de quatro rodadas pra fazer fechar. **Não reclassifiquei**, e é a mesma disciplina de 29/08: *evidência medida não se abandona por hipótese confortável*.

**⭐⭐ MAS O RELATO ERA REAL, E A CAUSA É DA FAMÍLIA MAIS CARA DESTE PROJETO: PREVIEW E CONFIRM DISCORDANDO.**

```
PREVIEW  computeIdentity({ …, type: 'DEBIT' })                         ← cravado
CONFIRM  computeIdentity({ …, type: kind === 'ESTORNO' ? 'CREDIT' : … })
```

Estorno gravado com hash de **CREDIT** nunca casa com o hash de **DEBIT** do preview → **o estorno aparece como "novo" pra sempre**. Medido contra a fatura real, com ela já importada:

| régua | duplicatas detectadas | a tela marcaria |
|---|---|---|
| velha (`DEBIT` cravado) | 19 de 33 | **14** ← o "14 de 33" do dono |
| nova (identidade única) | **33 de 33** | 0 |

E a fatura tem **exatamente 14 estornos** — o que a régua velha deixava escapar. *A classificação estava certa; o que divergia era a identidade.* É o mesmo defeito que custou o import de OFX (a tela dizia "N novas" e a gravação fazia outra coisa), e a cura é a mesma de lá: **uma função que as duas pontas chamam** (`identidadeDaLinha`), com **guard proibindo qualquer das rotas de calcular por conta própria** — foi a cópia que fez a divergência nascer.

**⭐ O RODAPÉ MOSTRAVA COMPRAS · ENCARGOS · TOTAL E ESCONDIA OS ESTORNOS.** Por isso o *"Compras R$ 0,00 · Total −2.749,91"* parecia mágica: o que reduzia o total era invisível. Agora são **quatro** colunas (com `Estornos (−)`) e, quando a soma não bate com a fatura, a tela **diz por quê** (*"a fatura fecha em R$ 8.626,98 · você marcou N de M lançamentos"*). ⚠️ *Número em tela de dinheiro sem régua é pior que ausência.*

⚠️ **E O DEFAULT JÁ MARCAVA TUDO QUE NÃO É DUPLICATA** — não havia o que consertar ali. As 14 apareciam marcadas porque a divergência as escondia da dedup. Com o conserto, **esta** fatura marca 0: ela já está importada.

**REGRA 11 — o `type: 'DEBIT'` reposto no preview: vermelho no guard.**


### ⭐⭐⭐ A FATURA DAS TRÊS RECUSAS FECHOU — E O GOLDEN VEIO DA QUARENTENA (17/09)

**Primeira vez que a régua nova roda inteira: quarentena → perícia → conserto → golden.** O texto é o que o motor leu **em produção** (registro `cmu4xpfv00064z0ci36uz0q8n`, cartão "Carter banrisul"), não um `pdftotext` meu e muito menos uma reconstrução.

**⭐ A PERÍCIA, contra o texto real — `cutCol = 68`:**
```
LIDO 11.358,89 × DECLARADO 11.376,89 · dif −18,00      (reproduzido ao centavo)
⛔ DESCARTADO  07/09   +18,00 BRASIL  [0123] ANUIDADEINT DIFER 05/12 0123   ← a dif
⛔ DESCARTADO  07/09   −18,00 ESTORNO [0123] DESC. ANUID. 0123 05/12
⛔ DESCARTADO  15/09 1.585,81 IOF     [—]    lixo do PAINEL de taxas
```

**As duas pistas do dono confirmadas no documento:** o bloco do `0123` aparece **2×** (cabeçalho `NR. 0123` na coluna direita da página de lançamentos **e** um bloco próprio com `US$ | R$`), e o par de anuidade mora nas linhas físicas **compartilhadas** com as compras do titular.

**⛔⛔ E "LER A DIREITA INTEIRA" NÃO ERA A CURA** — medido: inventa um **IOF de 1.585,81** colhido da tabela de taxas. *O corte existia por um motivo real; o que faltava era distinguir PAINEL de COLUNA.*

**⭐⭐ A CURA FOI MEDIDA NOS DOIS DOCUMENTOS ANTES DE TROCAR:**

| | fatura real (alvo 11.376,89) | golden PJ de agosto (alvo 13.797,73) |
|---|---|---|
| corte fixo (`cutCol`) | ⛔ 11.358,89 | ✅ bate |
| geometria por BANDAS | ✅ **11.376,89** | ✅ bate, número a número |

**As bandas não são troca de risco, são SUPERCONJUNTO** — então o que era *"a única coisa específica da PJ"* (onde cortar a coluna) **virou nada**, e some a segunda cópia da decisão *"onde a coluna termina"*. Um motor, dois documentos. ⚠️ E o que fez as bandas darem conta foi o trabalho de ontem no PF — a calha enxergando a geometria da TABELA e a apara perguntando se o que ia cortar é painel ou coluna. *O conserto estava no lugar errado; a peça, não.*

**REGRA 11 — o corte fixo reposto: 8 vermelhos**, 4 deles no golden novo.

**⭐ O GOLDEN:** `banrisul-pj-2-portadores.txt` no congelador (10 fixtures / 7 bancos), gerado por `scripts/gerar-fixture-banrisul-pj-2portadores.ts` — anonimização com trocas do **mesmo comprimento** (a geometria é o que está sob teste), preservando as palavras que o parser usa pra decidir, e **o script aborta se qualquer número, o banco reconhecido ou o comprimento de qualquer linha mudar**. ⚠️ O congelador confere só os DECLARADOS, então o teste próprio é que trava a soma das linhas — sem ele o −18,00 voltaria sem ninguém ver. Inclui **dois contrafactuais**: o corte fixo dando 11.358,89 e a direita crua inventando o IOF.

**⛔ A RECONSTRUÇÃO FOI APAGADA** (`banrisul-pf-dois-portadores`), como o dono determinou: *"a reconstrução sai da suíte quando o real entrar"*.


### ⛔⛔⛔ EU CONSERTEI O PARSER ERRADO DURAS RODADAS — A FATURA ENTRA PELA PORTA DA EMPRESA (16/09)

**O dono, na terceira recusa idêntica:** *"mesma dif −18,00 APÓS os consertos, e o número idêntico (11.358,89) prova que a RECONSTRUÇÃO não reproduzia o defeito real."*

**⭐⭐ ELE ESTAVA CERTO, E A PROVA ESTAVA NO NOME DO ERRO O TEMPO TODO.** Os rótulos **`V1 Σ Brasil`** e **`V4 Σ débitos = TOTAL DE GASTOS`** vivem em `lib/credit-card-pj/deterministic/validate-banrisul-fatura.ts` — **o validador do caminho PJ**. A fatura dele **nunca passou pelo parser PF**; entra por `/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview`, no cartão **"Carter banrisul"** (confirmado em prod: 5 cartões PJ, e as transações PJ com o padrão `MERCADOLIVRE*…` que ele citou).

⛔⛔ **E o parser PJ CORTA A COLUNA DIREITA POR DESENHO** — está escrito no arquivo: *"a defesa do parser PJ é CORTAR a direita fora"* (lá a direita é BanriClube/pontos/limites). **Se o histórico do portador adicional mora na direita, ele é jogado fora por construção.** Bate com o sintoma dele desde o começo: *lê o esquerdo, perde o direito*.

**⚠️⚠️ A LIÇÃO É SOBRE MIM, e é a mais cara da série:** eu tinha o rótulo `V1/V4` na mão desde a primeira mensagem e **não fui atrás de qual arquivo o imprime**. Consertei duas rodadas no parser **PF** — cotação, calha, apara, fatiador —, tudo medido, tudo verde, **e nada disso toca o caminho por onde a fatura dele entra**. *Conserto provado no lugar errado é tão inútil quanto conserto nenhum, e custa a confiança de quem esperou.*

**⛔⛔ POR QUE A QUARENTENA ESTAVA VAZIA: ela nasceu SÓ no caminho PF.** *"N caminhos, 1 esquecido"*, a doença que este projeto mais paga, agora entre **dois imports de fatura**. O caminho da empresa lançava `VALIDATION_FAILED` e **o texto morria no `throw`** — por isso diagnosticar exigia pedir o PDF de novo, e por isso eu passei a adivinhar.

**O QUE SUBIU (instrumento, não correção de parser):**
- **`CreditCardPjExtractError` carrega o TEXTO** que o motor leu, e a rota PJ guarda **toda tentativa** na quarentena — a recusada pra diagnosticar e **a que FECHA como o golden de amanhã**. Fail-soft.
- ⛔ **A correção do parser NÃO subiu junto, de propósito** — ver a regra abaixo. A cadeia de evidência é forte (rótulo ⇒ caminho PJ; parser PJ corta a direita; o dono leu no PDF que o 0123 está na direita), mas **falta o documento**, e é exatamente isso que a regra nova proíbe.

### ⛔⛔⛔ REGRA DE PROCESSO — CORREÇÃO DE PARSER SÓ COM O TEXTO REAL NA SUÍTE (16/09)

**Ditada pelo dono depois de duas rodadas perdidas, e vale pra sempre:**

> **Correção de parser só é aceita com o TEXTO REAL do caso na suíte (quarentena → teste). Reconstrução nunca mais vira prova.**

⚠️ **O que a reconstrução fez de mal:** ela **fechou** — 11.376,89 ao centavo — e isso me deu confiança de que o caso estava resolvido. Só que ela exercitava o parser **PF**, e o defeito vive no **PJ**. *Fixture que eu invento testa o mundo que eu imaginei; o documento testa o mundo que existe.*

⭐ **O corolário operacional:** quando a fatura recusar, **o primeiro movimento é abrir a quarentena**, não teorizar. E se a quarentena estiver vazia, a pergunta certa não é *"qual é o bug?"* — é **"por qual porta esse documento entrou?"**.

📋 **A reconstrução `banrisul-pf-dois-portadores` fica ATÉ o texto real entrar na suíte, e sai quando entrar** — foi o dono quem pôs o prazo, e ela não é golden nem entra no congelador.


### ⛔⛔⛔ O PORTADOR ADICIONAL SUMIA — A COLUNA DESCARTADA EM SILÊNCIO (16/09)

**O dono, com o PDF na mão:** *"a fatura tem DOIS PORTADORES (principal + adicional NR. 0123) e 'Débitos no Brasil' 11.376,89 = TOTAL principal 11.225,33 + TOTAL do 0123 151,56. O parser lê o lado esquerdo e o `DESC. ANUID. 0123 −18,00`, mas PERDE o `ANUIDADEINT DIFER 05/12 0123 +18,00` — a dif de −18,00 é exatamente ele."*

**⭐ E A ARITMÉTICA DELE FECHA A CAUSA SOZINHA.** O `DESC. ANUID.` é **crédito** (vai pro balde de estorno, fora das despesas) e o `ANUIDADEINT` é **débito** (entra em Brasil). Perder só o débito deixa `despesasCalculado` exatamente **18,00 curto** — que é o número que a conferência acusou. *As duas linhas existem e nenhuma se deduplica* (já era a trap 5 do núcleo).

**⛔⛔ O SINTOMA REFUTOU A MINHA PRIMEIRA HIPÓTESE.** Ele leu o lado **esquerdo** e perdeu o direito — isso **não é linha colada** (ali o motor leria o valor da direita e perderia o da esquerda, o oposto). É **corte por dentro**: a geometria de colunas descartando conteúdo.

**A PERÍCIA ACHOU TRÊS MECANISMOS DE DESCARTE, e nenhum gritava:**

| mecanismo | o que fazia |
|---|---|
| **a calha cega pra tabela** | a faixa em branco tem que existir em **TODAS** as linhas da página — então **uma única linha que atravessa as colunas** (cabeçalho do bloco, linha de totais, parágrafo de aviso) **apaga a divisão da página inteira**. A coluna do adicional deixava de existir |
| **a apara do dinheiro** | ela tira o painel de juros/pontos à direita do valor. Quando as colunas não foram separadas, a borda de valor é a da **esquerda**, e a apara cai **entre a data e o valor da direita**: a linha sobra **datada e sem dinheiro** → `nums.length === 0` → descartada calada |
| **banda com poucos lançamentos** | banda com menos de 2 linhas datadas era jogada fora inteira |

**AS DUAS CURAS (a terceira foi revertida — ver abaixo):**
1. **A geometria da tabela é definida pelas linhas da tabela.** O corte passa a ser procurado **também** só entre as linhas datadas. É a ideia do `INICIO_DOS_LANCAMENTOS` do Itaú sem depender de um rótulo que cada banco escreve com outras palavras: *quem define a coluna é o lançamento*. ⛔ E só **acrescenta** candidatos — cada um ainda passa pelo `LINHAS_PRA_SER_COLUNA`, que é o que impede data solta de inventar coluna.
2. **A apara pergunta se o que ela ia cortar é PAINEL ou COLUNA.** Painel tem números mas **nenhum lançamento**; coluna tem **data + descrição + valor**. Se o lado de fora tem lançamento, não se corta nada. ⚠️ O painel do Itaú não morde aqui: lá o valor da linha datada fica **antes** da apara.

**⚠️⚠️ E UMA CORREÇÃO MINHA FOI REVERTIDA POR NÃO MORDER — REGRA 11 cobrando de mim.** Eu tinha separado *"este corte é uma coluna?"* de *"vale ler esta banda?"* e baixado a segunda pra 1 linha datada, com um argumento bonito (*"coluna com uma compra também é coluna"*). Repondo o defeito, **o teste ficou VERDE**: quem entrega o caso é a apara, não ela. **Afrouxar um guard sem prova é trocar risco por nada** — o guard existe pra painel não virar lançamento. Revertida.

**REGRA 11 — 3 defeitos repostos:** a calha cega (**4 vermelhos**) · a apara cortando coluna (**1**) · e o terceiro **não mordeu e por isso não foi ao ar**.

**⭐⭐ A FIXTURE DE DOIS PORTADORES FECHA AO CENTAVO — 11.376,89.** Dois portadores reconhecidos · o V4 somando os **dois** `TOTAL DE GASTOS` · o par de anuidade inteiro (crédito no principal, débito no adicional) · cada linha marcada com o portador de quem gastou · `FECHA: true`.

⚠️⚠️ **MAS ELA É UMA RECONSTRUÇÃO, NÃO O PDF DELE — e isso está dito no arquivo e no nome.** O texto da fatura real nunca foi guardado (a quarentena subiu 20 min depois da tentativa); o que existe aqui é a **estrutura que ele descreveu** com os **números que ele mediu**. Ela trava a estrutura pra sempre; **não substitui o golden do documento real**, e o congelador não a lista — *o congelador é de PDF lido certo, e chamar reconstrução de golden diluiria o que a palavra significa*.

📋 **FALTA, E É UM CLIQUE:** subir a fatura de novo. Se a causa era um destes três mecanismos, ela fecha nos 11.376,89; se não era, **o texto fica na quarentena** e o diagnóstico sai sem pedir o PDF.


### ⛔⛔⛔ MOEDA ESTRANGEIRA — QUATRO JEITOS DE PERDER DINHEIRO CALADO (16/09)

**O dono, com a fatura recusando de novo:** *"a mesma dif −18,00 nos dois verificadores (o V4 agora confere igual, o conserto do latente pegou) — conserta a leitura NO PARSER DO BANRISUL, a classe inteira de linha em moeda estrangeira, não só esta."*

**⛔⛔ PRIMEIRO, A CORREÇÃO DE ROTA: A QUARENTENA ESTAVA VAZIA.** A migration fechou **01:49** e o app subiu **01:53**; a tentativa do dono é anterior. O texto da fatura de hoje **não existe em lugar nenhum** — e isso não é o mecanismo falhando, é ele tendo nascido depois do fato. ⚠️ Conferido no caminho, não suposto: o `guardarNaQuarentena` roda dentro do **`previewFaturaPF`**, antes do `return`, com `desfecho RECUSADA` — toda tentativa a partir de agora fica guardada.

**⭐ E UMA BRECHA REAL FECHADA NO CAMINHO:** o ramo *"banco não reconhecido"* retornava **antes** da quarentena. Era justo a recusa em que o documento mais importa (é dele que sai o parser que falta) e a única saída era pedir o PDF de novo — o buraco que a quarentena existe pra tapar. Agora guarda com `banco: 'DESCONHECIDO'`.

**⭐⭐ A CLASSE, MEDIDA NAS LINHAS REAIS DA FATURA — e ela perde dinheiro de QUATRO jeitos.** Numa compra internacional o Banrisul imprime a transação (`US$` + `R$`), o IOF, e uma linha **informativa** com a moeda de origem e a taxa (`JOD 49,95 TX DÓLAR R$ 5,2264`). A régua velha era *"linha que fala TX DÓLAR não é transação → pula a LINHA INTEIRA"*, e ela **só vale enquanto a cotação estiver sozinha na linha física**:

| linha REAL da fatura | o que o motor fazia |
|---|---|
| compra `617,00` │ cotação ao lado | lia **R$ 5,22** — a **TAXA** — e jogava em EXTERIOR |
| `IOF 0,06` │ cotação ao lado | **sumia** |
| cotação │ compra `559,42` | **sumia** |
| `IOF 9,62` │ `22/07 … 18,00` | lia **IOF 18,00** (o valor do vizinho) e **perdia a compra** |
| `06/07 … 347,50` │ `15/07 … 45,49` | lia **uma** transação de 45,49 e perdia **347,50** |

⚠️ **O primeiro é o pior: não falta LINHA, falta DINHEIRO dentro de uma linha que existe.** A conferência acusa a diferença e o dono sai procurando uma transação inteira que está lá, na cara dele. ⚠️ E repare na aritmética que produz o `5,22`: a taxa tem **4 casas** e o leitor de dinheiro casa `[\d.]+,\d{2}` — `5,2264` vira **5,22**, um número plausível com cara de valor.

**⭐ O GATILHO É A CALHA FALHANDO** — e ela **já falhou em documento real** (setembro, última página com 2 lançamentos na direita, registrado em 10/09). Quando falha, a página vira uma banda só e as duas colunas colam.

**AS DUAS RÉGUAS NOVAS, as duas no núcleo compartilhado:**
1. **`removerCotacaoInformativa`** — tira o FRAGMENTO, nunca a linha. Sobrou conteúdo? é transação. Não sobrou? era só a cotação. ⛔ O token da moeda só é comido quando é **alfabético** (`JOD`, `USD`): engolir `\S+` comeria o **valor da compra** que vem antes quando a fatura não imprime o token.
2. **`fatiarColunasColadas`** — backstop da calha: onde uma data de lançamento começa depois de **3+ espaços**, ali começa outra coluna. É o mesmo princípio da calha (*o documento diz onde ele se divide*), aplicado à linha. ⛔ **Conservadora de propósito:** a parcela `01/04` vem colada com UM espaço e por isso não parte nada — **inventar transação é pior que perder**, porque ninguém desconfia de um número a mais.

**⚠️ E O DIAGNÓSTICO DA PEÇA 4 QUASE ME MANDOU PRA PISTA FALSA — corrigido junto.** Ele apontou `JOD 18,00 TX DÓLAR R$ 5,2504` como candidata à diferença de −R$ 18,00. Aqueles `18,00` são **18 dinares** (≈ R$ 94,51), não 18 reais. A linha continua aparecendo (esconder seria pior), agora **marcada**: *"esta linha é de CÂMBIO — o número provavelmente está na moeda de origem, não em R$"*. **Coincidência de número não é evidência.**

**REGRA 11 — 2 defeitos repostos:** a cotação voltando a pular a linha inteira (**3 vermelhos**) · o fatiador removido (**2**).

**⭐ RED-THEN-GREEN DOS OUTROS BANCOS: os 9 goldens de 7 bancos VERDES** — o conserto do Banrisul não alcançou ninguém, que era a condição do dono.

⚠️ **DUAS FUNÇÕES DA QUARENTENA NASCERAM SEM CHAMADOR — uma corrigida, uma registrada:** o **expurgo de 12 meses** (LGPD) era promessa minha escrita e **nunca rodaria** — entrou no cron noturno do juiz, fail-soft (é a lição do E10: *planejado e não construído é pior que nenhum*). E o **`recusadasParaDiagnosticar`** (o leitor) **não tem tela**: hoje quem abre a quarentena sou eu, por script. Fica registrado como a maçaneta que falta — o dono não tem por onde olhar sozinho.

📋 **O QUE SÓ O DOCUMENTO FECHA:** a fatura de hoje **não importou** — o V1 (Σ Brasil 11.376,89 × 11.358,89) segue em aberto. A classe consertada **produz exatamente esse sintoma** (um único valor somindo de uma linha colada), mas afirmar que era ela sem o texto seria a hipótese confortável no lugar da medida — o erro que este doc já registra sobre mim em 29/08. **Subir a fatura de novo agora resolve as duas pontas: se a classe era a causa, ela fecha; se não, o texto fica na quarentena e eu diagnostico sem pedir o PDF.**


### ⭐⭐⭐ EXCLUIR RECEITA DE PRODUÇÃO — E O SERVIDOR DECIDE QUAL DOS DOIS CASOS É (16/09)

**A régua do dono:** receita **sem lote na história** → **exclui de vez** (*"rascunho que nasceu errado não merece cerimônia"*); **com lotes** → **DESATIVA**, e ***o passado não se reescreve*** — a mesma regra do fornecedor mesclado (11/09) e do item desativado (09/09).

**⛔⛔ A TRAVA MORA NO SERVIDOR, NÃO NA TELA.** A tela só **pergunta**: a prévia vem do servidor e o gesto **re-avalia dentro da transação**. Uma tela que decidisse mandaria o `DELETE` de uma receita com 40 lotes — é a régua do FREIO da contagem (23/08): *"aviso que vive no componente some no dia em que a rota for chamada por outro caminho"*.

**⭐⭐ E ELE RE-AVALIA POR UM MOTIVO REAL: a cozinha produz enquanto o dono lê o confirm.** Se o `DELETE` confiasse na prévia, apagaria uma receita que **acabou de ganhar história**. ⭐ E quando o desfecho **muda do que foi prometido**, a resposta **DIZ que mudou** (*"ganhou 1 lote enquanto você decidia — foi DESATIVADA em vez de excluída"*) — *fazer diferente do prometido e não avisar é a família do clique que gravou em silêncio (14/09)*.

**O QUE VAI JUNTO NA EXCLUSÃO, e o que NÃO vai:** somem ficha, versões, componentes e os mapas do PDV. ⭐ **O item-invólucro vai junto** — toda ficha cria um item pra nomear o que ela produz, e deixá-lo órfão poluiria o catálogo (foi item-invólucro esquecido que produziu as contagens fantasma da Coca). ⛔ **Mas com movimento ele FICA e só desativa**: movimento é ledger, e ledger é imutável. ⛔ **E o INSUMO nunca vai** — apagar a receita não apaga a carne.

**⚠️ O CONFIRM MOSTRA O EFEITO COLATERAL ANTES, NÃO DEPOIS:** *"⚠️ ela é ingrediente de: XIS COMPLETO, Combo Caçula — essas receitas ficam sem esse componente"* e *"N nomes do PDV apontam pra ela — a venda desses nomes para de baixar estoque"*. ⭐ **Sem digitar o nome pra confirmar** (decisão do dono: *"exagero pra cozinha"*) — o que segura é a frase dizendo **o efeito**, não a cerimônia.

**⛔⛔ E A VARREDURA ACHOU UM BURACO QUE TORNARIA O GESTO UMA MENTIRA: `listFichas` NÃO FILTRAVA `ativo`.** Ou seja, a receita desativada **continuaria aparecendo no planejar produção, no seletor de tarefas e na lista da cozinha** — e o confirm promete *"ela sai do planejar e do produzir"*. ***Desativar que não some de lugar nenhum é o mesmo que não desativar***, e promessa de tela que o dado não cumpre é como a confiança se perde. Agora o default é **só ativas**; `incluirInativas` existe pro toggle explícito de histórico.

**⚠️ UM GUARD DE SETEMBRO FOI REAPONTADO SEM PERDER A PROVA:** o `ficha-arquivada-fora-da-busca` existia pra provar que **a TELA filtra** (`ehReceitaDeProducao` carrega o `ativo` por dentro), e o comentário dele dizia *"um `.filter(f => f.ativo)` aqui esconderia que a tela não filtra"*. Com o servidor filtrando também, a cena passou a ser montada com `incluirInativas` e **as duas camadas ficaram provadas** — cinto **e** suspensório.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12), no bundle servido:**
```
CELULAR lista  ✓ botão · ✓ vermelho discreto (não é hover) · ✓ o confirm
CELULAR editar ✓ · DESKTOP lista ✓ · DESKTOP editar ✓

NO DADO REAL DA CAÇULA — 165 receitas:
  38 seriam DESATIVADAS · 127 seriam EXCLUÍDAS (nunca produzidas)
  "beef de xis" → DESATIVA · 13 lotes
     ⚠️ "é ingrediente de: XIS COMPLETO, Combo Caçula, XIS - COMPLETO"
  "CUBA MAIONESE" → DESATIVA · 10 lotes
     ⚠️ "é ingrediente de: POÇAO MAIONESE 30G, ENCHER TUBO MAIONESE"
⛔ nada foi excluído na prova — só a prévia, que é leitura
```
**REGRA 11 — 3 defeitos repostos:** a receita COM história voltando a ser apagada (**2 vermelhos**) · a SEM história virando desativação (**3**) · a desativada voltando pro planejar (**2**).

**10.178 verdes · TS 0 · deploy `i1VgMzogxnj5wLhFXU7aC` 4/4.**

📋 **FICA PRO DONO (REGRA 2):** criar a receita de teste, excluir (some de vez), e tentar excluir uma com história pra ver o confirm virar desativação.


### ⛔⛔⛔ CADA GESTO TEM SEU UNIVERSO DE SELETOR (16/09)

**O dono, fazendo a entrada manual da compra do fermento:** *"na hora de escolher o produto a lista traz coisa de CARDÁPIO (fichas) e coisa de PRODUÇÃO — e não acho direito os itens de ESTOQUE que aparecem na Posição."*

**⛔ A CAUSA, numa linha:** `/api/.../estoque/itens` **sem parâmetro** devolvia `{ companyId, ativo: true }` — **TUDO**, inclusive os invólucros de `SABOR` e `PRODUTO_FINAL` que existem só pra dar nome a uma linha do cardápio. ⚠️ **O default silencioso era o veneno:** quem esquecia o recorte não via erro nenhum — via uma lista **plausível e errada**.

**A RÉGUA, registrada:** ***compra NUNCA aponta pra ficha de cardápio nem pra tarefa de produção.*** Cada seletor com o WHERE do seu gesto, e **o universo é contrato obrigatório** — a rota recusa com **400 que ensina**, e o helper o carrega **no TIPO**: chamador que não declara **não compila**.

**⚠️⚠️ E A VARREDURA ACHOU QUE NÃO É UM UNIVERSO SÓ — SÃO DOIS, e a diferença é real.** O dono listou, pra compra, *"matéria-prima, insumo, revenda, embalagem"* — **sem intermediário**, e está certo: **ninguém COMPRA "porção de carne 100g"**, ela se produz. Mas ela **se conta** (está na câmara) e **se perde** (cai no chão). Um universo só poria porção na lista de compra **ou** tiraria porção da contagem — os dois errados.

| universo | gesto | o que entra |
|---|---|---|
| **COMPRAVEL** | entrada manual, nota | matéria-prima · revenda · embalagem · limpeza · uso interno |
| **PRATELEIRA** | contagem, saída/perda | os de cima **+ intermediário** |
| **RECEITA** | componente de ficha | matéria-prima · intermediário · produto final · revenda · embalagem |
| **VENDAVEL** | mapa do PDV | produto final · sabor · revenda |
| **CATALOGO** | a lista administrativa | tudo — **e o nome diz isso** |

**A VARREDURA DOS CHAMADORES (item 1 do pedido):** dos 17 que tocam a rota, **só 4 LISTAM** — o resto é `PATCH`/`POST` ou `href`. Os defeitos reais eram **dois**: a **entrada manual** e a **saída/perda**. O seletor de ficha já declarava (`escopo=receita`, 27/08) e o hub já filtrava `categoria=REVENDA`.

**⭐ E O TOGGLE "mostrar tudo" DO EDITOR DE FICHA É UMA DECLARAÇÃO**, não uma exceção: o dono está dizendo, com o dedo, que quer o catálogo naquele momento. O que deixou de existir é o universo **que ninguém escolheu**.

**⭐ O VAZIO PASSOU A DIZER O RECORTE:** *"Nada com «xis» entre os itens que se COMPRAM"*. ⛔ *"Nenhum item encontrado"* faria o dono achar que o item não existe, quando ele só não pertence àquele gesto — **vazio que não diz o recorte é a ausência fingindo verdade**.

**⚠️⚠️ O TESTE POR GESTO PEGOU UM DEFEITO MEU NA HORA:** eu escrevi `RECEITA = [...COMPRAVEL, INTERMEDIARIO]` por conveniência e **arrastei LIMPEZA junto** — quebrando a régua de 27/08 (*"o editor oferecia DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA como ingrediente de lanche"*). **Universo se escreve item a item**; derivar um do outro é como a régua de um gesto vaza pro outro.

**⭐⭐ E HÁ TESTE PROVANDO QUE PRATELEIRA == `seContaFisicamente`**, item a item. Aqui a régua é uma **LISTA** (vira `where`, não atravessa a query) e lá é uma **FUNÇÃO** — sem o teste, as duas divergiriam no primeiro tipo novo, que é exatamente como o B1 se perdeu.

**⚠️⚠️ REGRA 11 — 3 defeitos repostos, e o PRIMEIRO VEIO VERDE:** trocar o universo da entrada manual pra `CATALOGO` deixou **515 testes verdes**, porque os meus chamavam `listar(universo)` direto e **nenhum lia o que a TELA declara**. ***Guard que testa a lib aprova a tela que ignora a lib*** — a mesma lição de 14/09 (o modal) e 13/09 (o card do PJBANK). Com o bloco novo (*"cada TELA declara o universo do SEU gesto"*), o defeito fica vermelho. Os outros dois morderam de primeira: `PRODUTO_FINAL` voltando pra compra (**5 vermelhos**) e a PRATELEIRA deixando de concordar com a função (**2**).

**⚠️ E UM VERMELHO PRÉ-EXISTENTE FOI DIAGNOSTICADO EM VEZ DE ROTULADO** (a régua de 01/09): o rastro de vencimento ordenava só por `criadoEm`, e dois eventos gravados **no mesmo milissegundo** saíam em ordem arbitrária — às vezes `BOLETO` primeiro, às vezes `DONO`. **É a cicatriz do juiz de saldo de 28/08** (*"ordenar só por `anchorDate` deixava o desempate arbitrário"*), que lá custou dois alarmes de ±3.026,31 que se cancelavam. **Timestamp sozinho não é ordem total** — desempate por `id`, estável em 3 rodadas.

**⚠️⚠️ E A PROVA EM PROD ACHOU A SEGUNDA METADE DA QUEIXA — o universo certo não bastava.** Medido: o universo da compra tem **152 itens**, a rota devolve no máximo **50** (`slice(0, 50)`), e o **`fermento` NÃO estava entre os 50 primeiros** — a lista alfabética parava em *"COPOS PS 150ML"*. Ou seja: **mesmo com o recorte certo, o item nunca chegava ao navegador**, e a tela filtrava **no CLIENTE** sobre a lista já truncada.

⭐ **É a doença de 28/08 por outra porta** — e o comentário da própria rota já a documentava: *"o `take` passa a valer DEPOIS de filtrar; antes, 50 itens eram lidos e só então a busca acontecia, então item fora das 50 sumia"*. **A correção daquele dia valeu pra busca NO SERVIDOR; esta tela buscava no cliente.**

**O `<select>` de 50 virou o `BuscaItem`** — o seletor único da casa (o de 14/09, *"definir ficha me expulsa da tela"*), que busca no servidor e mostra o custo médio. ⭐ E o `universo` virou **prop obrigatória** dele: o *"não compila"* achou **2 chamadores** que eu não tinha tocado — o **DANFE digitado** (que é COMPRA) e o **editor de ficha** (RECEITA).

**⚠️⚠️ E A PROVA NO CELULAR PEGOU O FIX PELA METADE — REGRA 12 cobrando.** A entrada manual tem **duas composições** (tabela no desktop, cards no celular) e eu troquei **só a de cima**. **O dono opera no celular** — o conserto teria passado **ao lado do caso que motivou o sprint**. O guard agora conta os `<select>` de catálogo e exige **zero nos dois viewports**.

**10.167 verdes · TS 0 · deploys `hSHk9o85aeSpk6Z6KKP3A`, `ezU4mxIgKczgGLLzHxQml` e o do celular, todos 4/4 · Δ bundle −96 KB.**


### ⛔⛔⛔ "NÃO CONSEGUI GRAVAR A CONTAGEM" — O ERRO SEM MOTIVO, E A CAUSA QUE NÃO ERA A SUSPEITA (16/09)

**⭐ A HIPÓTESE DO DONO CAIU NA MEDIÇÃO, e isso mudou a resposta inteira.** Ele apostou em *"unidade UN-inteira recusando decimal"* e perguntou se o reunitizar resolvia. Medido por id: o item **`fermento` JÁ É KG** (`cmttb7w1p0003o9db38fdqthf`) — **a unidade está certa e o reunitizar não tem o que fazer**. Mandá-lo reunitizar seria mandá-lo consertar o campo errado.

**⛔ A CAUSA REAL, achada no log de prod:**
```
Error [MovementInvalidError]: Este movimento deixaria o item com 10 unidade(s) e valor
R$ -31.04 — dinheiro negativo com saldo positivo é um estado que não existe.
```
É o **guard estrutural de 11/09** funcionando. O fermento está com **saldo −1,921 e valor −R$ 31,04**, e contar 10 kg (a quantidade **CERTA** — é o que está na prateleira) cruza o zero com o valor ainda negativo.

**A HISTÓRIA, lida no ledger:** em 10-11/09 saíram **21,24 kg de produção a custo ZERO** — *antes de qualquer nota*. Em 11/09 a NF trouxe **1,5 kg a R$ 62,28**, e um **AJUSTE_CONTAGEM de +21,24 entrou a custo ZERO**. As separações seguintes saíram a **62,28/62,22** (o custo da nota, não o médio diluído) e drenaram R$ 124,46 com 2 kg. ⭐ **A compra que nunca foi registrada é o buraco.**

**⛔⛔ E O SEGUNDO DEFEITO É O QUE O DONO NOMEOU: A FRASE EXISTIA E NINGUÉM A ENTREGAVA.** O `MovementInvalidError` **não é `ContagemError`** → caía no **`throw e`** do catch da rota → **500 sem corpo** → o cliente fazia `j.erro ?? 'Não consegui gravar a contagem.'` e o `??` só cai no fallback **quando o servidor não manda nada**. ⚠️ **Eram 52 `throw e` nas rotas de estoque** — cada um é um 500 mudo esperando a vez.

**⭐⭐ A CURA É UM TRADUTOR ÚNICO** (`lib/stock/erro-da-tela.ts`, REGRA 5): erro de domínio vira **422 com a mensagem**; o que ninguém previu **continua 500** — *ali o genérico é honesto, e inventar frase amigável pra bug desconhecido esconde o bug*. ⚠️ A lista é **FECHADA** de propósito: `e instanceof Error` pegaria `TypeError` e erro do Prisma, cujas mensagens são pra MIM, não pro dono.

**⭐⭐ E A RECUSA CARREGA A SAÍDA** — *"recusa ensina a saída"*, a régua que o 409 do fornecedor já cumpria. O 422 agora devolve `{ erro, code, saida: { rotulo, href } }` e a tela desenha o link do gesto.

**⚠️⚠️ A MENSAGEM APONTAVA O CAMPO ERRADO, e isso foi corrigido junto.** Ela dizia sempre *"confira a quantidade (ela costuma ser o sintoma)"*. Agora ela separa pelos fatos: **saldo que CRUZA o zero** → *"o saldo estava em −1,92 (saiu mais do que entrou), então falta registrar a COMPRA que não foi lançada — **não é a sua contagem que está errada**"*; saldo que já era positivo → aí sim a quantidade é a suspeita.

**PROVADO EM PROD, na rota REAL com a sessão do dono:**
```
POST /estoque/contagem/linha  { itemId: fermento, qtdContada: 10 }  →  HTTP 422
{
  "erro": "… valor R$ -31.04 — dinheiro negativo com saldo positivo é um estado que
           não existe. O saldo estava em -1.92 (saiu mais do que entrou), então falta
           registrar a COMPRA que não foi lançada — não é a sua contagem que está errada.",
  "code": "ESTADO_IMPOSSIVEL",
  "saida": { "rotulo": "ver o histórico deste item e corrigir a entrada que faltou", "href": "…" }
}
⭐ 422 (não 500) ✓ · tem MOTIVO ✓ · tem SAÍDA ✓ · nada gravou ✓
```

**⚠️⚠️ REGRA 11 — 3 defeitos repostos, e o PRIMEIRO VEIO VERDE: a "menção, não uso" pela TERCEIRA VEZ EM TRÊS DIAS.** Repondo o `throw e` mudo na rota, o guard passou — porque a linha do **`import`** já casava com `toContain('respostaDeErroDoEstoque')`. É o mesmo defeito do `acaoValePraSentido` (15/09) e do `MELHOR PALPITE` no comentário (16/09). **O padrão virou helper (`usosDe`), não lembrança.** Os outros dois morderam de primeira (o fallback genérico de volta na tela; o guard do estado impossível removido).

**⚠️ E UM GUARD DE 11/09 PASSAVA POR VACUIDADE:** ele era `try/catch` **sem `expect.fail()`** — se `criarMovimento` não lançasse, o catch nunca rodava e o teste ficava verde **sem asserção nenhuma**. Corrigido junto, e reapontado pra a frase nova.

**10.145 verdes · TS 0 · deploy `u-aKjqpYYvzuR_JSkCG3L` 4/4 · Δ bundle +0 KB.**

📋 **A DECISÃO É DO DONO — e eu NÃO gravei nada** (preview read-only, a régua de sempre):
- **(a)** se **houve compra sem nota**, o gesto é **entrada manual** do fermento. ⚠️ Pra zerar o valor negativo bastariam **0,498 kg a R$ 62,28**, mas **a quantidade é a que ele comprou de verdade** — *saldo não se chuta*. Feito isso, contar 10 kg grava normal (há teste provando exatamente essa sequência).
- **(b)** se **não houve compra** (o consumo é que foi lançado a mais), o caminho é **estornar as separações erradas** — e aí ele precisa dizer **quais**.


### ⭐⭐⭐ A CAIXA DE ENTRADA NO DESENHO DO MOCK v3 — O CARTÃO ≍ (16/09)

**O dono:** *"mesma tela, mesmos motores, ROUPA nova — nenhuma régua de negócio muda."* Mock aprovado em `docs/mocks/conciliacao-caixa-mock-v3.html`, **versionado e lido pelo guard** (`caixa-bate-com-o-mock-v3.test.ts`): 17 tokens do `:root{}`, 10 medidas e as frases que o arquivo imprime. *Divergência do mock = defeito.*

**⭐⭐ O CARTÃO ≍ (padrão Xero):** à esquerda **O BANCO DIZ** (chip do banco, memo, data, valor gigante — coral débito, verde crédito), no meio o conector, à direita **MELHOR PALPITE** com a **diferença SEMPRE nomeada** e o botão que diz **o efeito** (*"✓ Confirmar — baixa a fatura"*). Sem palpite, o lado direito abre direto nos chips — *ausência de palpite não pode virar linha morta*. Mais: anel do mês, abas segmented, faixa verde com o selo do COMO, e o **inbox zero** do mock.

**⛔⛔ ZERO MATCHER NOVO — e é o ponto.** `palpite-da-linha.ts` é **puro**: ele **escolhe e traduz** o que os motores provados devolveram (`mesQueBateOValor` do cartão · `sugerirVinculoEmprestimo` · `sugerirVinculos`). Um matcher próprio seria a **segunda régua** — *a tela não pode achar um par que o servidor recusa*.

**⛔ E O EMPATE NÃO ESCOLHE NO ESCURO:** dois candidatos igualmente bons devolvem **nenhum palpite**. *"Não sei qual é"* é resposta — a trava do PAO DE MEL.

**⚠️⚠️ E ELA SE PAGOU NA PRIMEIRA PROVA EM PROD, com uma lição de CONTRATO.** Eu liguei o palpite do cartão no `resolvePaidInvoiceMonth`, e ele devolveu **`2026-08` pros QUATRO cartões da Caçula** com a linha de R$ 3.194,35 — sendo que nenhum tem fatura desse valor (os nets são 13.779,73 · 7.305,55 · 8.094,78 · 2.666,44). **Por quê:** aquela função tem **fallback pra fatura mais recente**, e ele é **CERTO no contrato dela** — *"o dono JÁ disse que este pagamento é deste cartão; qual competência ele quita?"*. A minha pergunta era outra: *"este pagamento é de ALGUM cartão?"* — e aí o fallback é veneno. **Nasceu `mesQueBateOValor` (sem fallback), com a tolerância extraída pra um lugar só.** ⭐ **Quem segurou o estrago foi a trava do empate** (4 candidatos ALTA empatados → nenhum palpite); sem ela a tela poria um botão verde gigante *"baixa a fatura"* sobre o cartão errado. **Depender disso seria depender de sorte** — a régua certa é não usar motor fora do contrato dele.

**⚠️ SEGUNDO DEFEITO DA MESMA PROVA: o anel dava 100% com trabalho na caixa.** 220 no arquivo e **1 na caixa** = 99,5%, que arredondava pra **100%** — a tela fechando o anel com o dono ainda tendo o que fazer. *Tela que se parabeniza cedo ensina o dono a não olhar o número.* **100% é reservado pro inbox zero**; com linha na caixa o teto é 99.

**⭐ O RESTO DA COMPOSIÇÃO:** os 3 stats viraram **cards-filtro** (hover levanta, ativo com borda roxa) — ⚠️ e viraram `<button>`, não `<div>`: *elemento clicável que não é botão perde teclado e leitor de tela*. Os cards de fornecedor ganharam **avatar** e **pílula de estado**; ⛔ o comportamento não mudou — continua UM card por fornecedor, fechado, uma linha por vez (a trava que impede dois cards disputarem as MESMAS notas, o caso Cancian).

**⚠️⚠️ REGRA 11 REPROVOU O GUARD NOVO — a "menção, não uso" de novo, dois dias seguidos.** Repondo o defeito (apagar `MELHOR PALPITE` do JSX) ele ficou **VERDE**, porque a frase também aparece no **comentário** do arquivo. Agora ele lê a tela **sem comentário**. E o conector passou a ser conferido pelo **uso do token** (`{CONECTOR}`), não pelo glifo solto — escrever `≍` à mão seria a segunda cópia do valor.

**⚠️ 6 ASSERÇÕES DO GUARD DE 10/09 FORAM REAPONTADAS, nenhuma apagada:** o v3 redesenhou os stats (raio, fonte, tokens) e o cabeçalho do card de fornecedor. ⭐ Uma delas merece nota: o mock antigo indicava "isto abre" com a **seta ▶ girando**; o v3 troca por **texto** (*"abrir o caso →"* / *"fechar o caso"*), o que é **mais forte** — a seta exigia interpretar um glifo, o texto DIZ o que acontece, e o `aria-expanded` segue carregando o estado.

**⛔ REGRA DE NEGÓCIO: ZERO MUDANÇA.** Degraus, contenção, corte de época, uma-linha-uma-estação — intocados. **A suíte E2E das 9 linhas passou SEM UMA EDIÇÃO**, que era a condição que o dono pôs.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12), no bundle servido:**
```
CELULAR /conciliacao 1.063 KB        DESKTOP 1.063 KB
  ✓ título · ✓ O BANCO DIZ · ✓ MELHOR PALPITE · ✓ OU ESCOLHA OUTRO CAMINHO
  ✓ 🎉 inbox zero · ✓ "resolvida agora" · ✓ o anel · ✓ min-[900px] (empilha)
  ✓ tokens do mock: roxo · verde · coral · âmbar-bg

A ROTA: SAÍDAS 1 · ENTRADAS 0 · ARQUIVO 220 · TOTAL 221 · Σ fecha ✓
        anel 99% — "220 resolvidas · 1 na caixa" · corte 01/09
```
**REGRA 11 — 4 desvios repostos, 1 vermelho cada:** o tom do verde trocado · o conector virando `=` · o inbox zero sumindo · `MELHOR PALPITE` sumindo (este só mordeu **depois** do aperto).

**10.124 verdes · TS 0 · deploys `zGH_tUpi2QINT9Zvsi2l0` e o do fix, os dois 4/4 · Δ bundle +4 KB.**

⚠️ **DUAS COISAS REGISTRADAS, NÃO ESCONDIDAS:**
1. **O red-then-green do dono não acontece com o dado de hoje:** a linha `DEB.CTA.FATURA` de R$ 3.194,35 **não tem fatura correspondente em nenhum dos 4 cartões** — a de setembro ainda não foi importada. Ela aparece no cartão ≍ **sem palpite**, com os 6 chips do sentido, que é o comportamento honesto. Assim que a fatura entrar, o palpite acende sozinho.
2. **Dois mocks convivem na mesma tela:** o v3 governa a caixa, os stats e o cabeçalho do card de fornecedor; o mock de 10/09 continua governando **o interior do card** (as caixinhas de nota, o rodapé sticky), que o v3 não redesenhou. Enquanto for assim, o verde/coral dos dois é um tom diferente. **É o preço de "igual ao mock" com dois mocks aprovados** — o dia em que o dono pedir, o v3 absorve o interior e o arquivo de tokens vira um só.


### 🧹 A FAXINA DO PENDENTES — O QUE MORRE, O QUE FICA, E A VIGILÂNCIA QUE MUDA DE RÉGUA (15/09)

**A regra que o dono ditou:** ***o que era DA TELA morre; o que é DO DOMÍNIO fica.*** O conceito *"linha sem destino"* continua existindo — dentro da caixa. Só a **TELA** morreu.

**⛔ O QUE O INVENTÁRIO ACHOU ANTES DE APAGAR — e o achado é o item de menu.** O `pendentes-client.tsx` tinha sido deletado na entrega das estações, mas **o item "Pendentes" continuava na sidebar, com badge âmbar**, apontando pra uma rota que só redireciona. *É a "porta sem maçaneta" ao contrário: a maçaneta sem a porta.*

**MORRERAM (tela, 0 chamadores):** o item da sidebar · `VincularTransferenciaModal` **e a rota `/api/transferencias/candidatas/[id]` que só ele usava** (a capacidade vive em `/parear`, com o motor único, pra onde a caixa deep-linka) · `SugestaoDeVinculoBanner` (virou o menu `CASAR_PAGAR`) · `lib/pendentes/row-actions` · `/api/conciliacao/sugestoes-pendentes` (**zero fetch no repo inteiro**).

**⚠️ E EU ERREI UMA CLASSIFICAÇÃO NO MEIO DA FAXINA:** apaguei o `SourceBadge` como "órfão" — ele tinha **2 chamadores**, e os dois eram justamente as capacidades que o dono mandou guardar. **Restaurado no mesmo passo.** *Órfão de segundo grau não é órfão: é peça de quem está guardado.*

**⚠️⚠️ FICARAM COM SELO DE DÍVIDA (decisão do dono: *"guardar e registrar"*) — 4 arquivos SEM chamador, de propósito:** `AutoCategorizePreviewModal` (auto-categorizar em lote com prévia) · `VendorSuggestionBanner` (o selo *"sugerido por IA"* com a fonte) · `AprenderEAplicarModal` (criar regra aprendida ao categorizar — o ciclo que este doc registra como **nunca provado E2E**) · `SourceBadge`. **A caixa não tem nenhuma das três**, e *"remoção sem realocação é perda"*. Cada arquivo abre com o selo **`CAPACIDADE GUARDADA — NÃO É LIXO, É DÍVIDA REGISTRADA`**, e há guard exigindo que o selo continue lá: sem ele, a próxima faxina trata como lixo.

**⭐ O REDIRECT FICA, MARCADO:** `/pendentes` e `/empresas/:id/pendentes` abrem com **`ROTA LEGADA, REDIRECT PERMANENTE`**. *Link velho em e-mail, no histórico ou num print não pode virar 404 — redirect de uma linha não é lixo, é cortesia.*

**⭐⭐ A VIGILÂNCIA FOI REAPONTADA, NÃO APAGADA — e a régua mudou de lado.** O badge contava `NEEDS_REVIEW` (*"linha sem CATEGORIA, desde sempre"*). Agora conta o que a **CAIXA** tem esperando decisão — o que **inclui o crédito que a régua velha nunca olhou** e **exclui** o que já foi resolvido por qualquer caminho.

**⛔ E ELE NÃO SOMA COM OS VÍNCULOS, de propósito:** `conciliacao.pendentes` conta **CONTAS a pagar** com par sugerido; `conciliacao.caixa` conta **LINHAS do extrato** sem destino. Casar uma linha com uma conta **apaga as duas de uma vez** — somar seria a **dupla contagem** que esta casa combate desde o cabeçalho dos *"69 duplicatas"* (07/09). Os vínculos seguem visíveis nos **3 stats do topo da tela**.

**⭐⭐ E A LEITURA DA CAIXA GANHOU DONO ÚNICO** (`lib/conciliacao/leitura-da-caixa.ts`): a **rota** e o **badge** chamam a MESMA função, com o MESMO recorte — corte de época e teto de 400 inclusive. ⚠️ Sem isso o badge teria consulta própria, que é **exatamente** como o menu passou meses dizendo um número e a tela outro (10/09: o badge contava os pares 1:1 **sem os lotes**). *Badge com teto diferente da tela é a divergência de novo, com outra roupa.*

**⚠️ 6 GUARDS ANTIGOS FICARAM VERMELHOS COM A FAXINA CERTA — todos REAPONTADOS, nenhum apagado:** o filtro de data (×2, o corte mudou pra a leitura única) · o payload do badge (`transacoesPendentes` → `conciliacao.caixa`) · a lista de callers do `NEEDS_REVIEW` (o badges saiu, com o porquê) · o `owner-detection` (a rota `/candidatas` morreu com o modal) · o gate do PF (o item não existe mais pra esconder).

**PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS:**
```
DEEP-LINKS VELHOS   /pendentes → 307 → /conciliacao      (celular e desktop)
                    /empresas/:id/pendentes → 307 → select-and-redirect
ROTAS APAGADAS      sugestoes-pendentes → 404 ✓ · candidatas/[id] → 404 ✓   (não 500)
O MENU (no bundle)  item "Pendentes"? ✓ não · href "/pendentes"? ✓ não   (nos dois)
O BADGE             conciliacao = {"pendentes":0,"caixa":1}
                    campo velho "transacoesPendentes": ✓ não existe mais
                    ⭐ badge (1) == caixa saídas+entradas (1) — MESMA leitura
```
**GUARD NOVO — `rota-morta-nao-volta-pro-menu.test.ts`, e ele prova OS DOIS LADOS:** o item **não pode renascer** em nenhuma sidebar (detector que ignora comentário, senão morderia a documentação do próprio defeito) · o **redirect tem que continuar vivo e dizer que é legado** · os apagados continuam apagados · e as 4 guardadas continuam existindo **com o selo**. Rota aposentada nova entra na lista `ROTAS_APOSENTADAS`. **REGRA 11: repondo o item no menu, vermelho na hora; auto-teste do detector nos 4 sentidos** (template literal, aspas, comentário, rota de nome parecido).

**10.071 verdes · TS 0 · deploy 4/4 (`-gbCQ43EO4DtoIJqI5Gva`) · Δ chunks vs deploy anterior: +0 KB** (faxina não engorda bundle — a série de performance já mostrando serviço).

⚠️ **RESSALVA NOMEADA, não escondida:** o badge agora mede a CAIXA, então **conta a pagar com par pronto cuja linha já foi categorizada** não acende o badge (a linha saiu da caixa, a conta segue esperando). É a fronteira de 07/09 (*"ter categoria não quita conta nenhuma"*) aparecendo no contador. Ela fica **visível nos 3 stats do topo** quando o dono abre a tela; se incomodar, a saída é o badge mostrar os dois números lado a lado — não somá-los.


### ⭐⭐⭐ O EXTRATO EM 3 ESTAÇÕES — O PENDENTES MORRE COMO TELA (15/09)

**O desenho aprovado pelo dono, depois do estudo de QuickBooks/Conta Azul/Organizze:** ***o SENTIDO decide o menu, o menu decide a fila.*** **ESTAÇÃO 1 — IMPORT** (o portão; resolve só o automático) → **ESTAÇÃO 2 — CAIXA DE ENTRADA** (o balcão único, duas abas) → **ESTAÇÃO 3 — MOVIMENTAÇÕES** (o arquivo, com o selo de COMO).

**⛔⛔⛔ O BURACO, MEDIDO EM PROD ANTES DE CODAR:** o `LINHA_DISPONIVEL_WHERE` filtrava **onze coisas** (cartão, empréstimo, transferência, ignorada…) e **não filtrava SENTIDO**. A fila de *"casar com conta a pagar"* tinha **6.555 linhas, das quais 5.705 eram CRÉDITO — 87%**. O PIX de venda de **R$ 308,50** do dono estava ali, junto de `ANTECIP STONE` e `OP.CREDITO C/GARANTIA` de R$ 28.223,77. ***A fila de pagar dívida era, quase toda, dinheiro que entrou.*** Uma linha (`type: 'DEBIT'`) tirou os 5.705 — e ela exclui `TRANSFER` **por construção**, então a trava antiga ficou mais forte, não mais fraca.

**⭐⭐ TODO GESTO EFETIVA — a régua nova da casa:** ***gesto que ESCOLHE um alvo e não EFETIVA o vínculo é MEIA-PONTE.*** O defeito que a criou: no `pendentes-client.tsx` o seletor oferecia *"Pgto cartão"* e *"Pgto empréstimo"* e o `onChange` só tratava `TRANSFER` e `IGNORAR` — as outras duas **caíam no vazio**, guardando um rótulo num `useState` local. O dono escolhia o cartão e a fatura não baixava. *Não era meia-ponte: era ponte que não começa.*

**⛔ E NENHUM MOTOR NOVO NASCEU:** `resolverLinha` é o choke-point e **despacha pros motores provados** — `casarPagamentoDeCartao` (extraído da rota, que virou casca), `vincularPagamentoDeParcela` (a porta única de 11/09), o update + `recomputeVendasSeVenda`. As **quatro ações de VÍNCULO** (casar pagar/receber, as duas transferências) **não gravam aqui de propósito** — a escolha do alvo já tem casa provada — e por isso **devolvem o CAMINHO** em vez de calar. **A lei do sentido é checada no SERVIDOR**, não só no menu: esconder o botão não impede a chamada.

**⛔⛔ O PENDENTES MORREU NO MESMO DEPLOY, com realocação completa** — e o `pendentes-client.tsx` foi **DELETADO**, não deixado órfão: enquanto o arquivo existisse, o seletor morto podia ser remontado.

**⚠️ E OS GUARDS DE SPRINTS ANTIGOS COBRARAM A MUDANÇA DE CASA — 5 ficaram vermelhos e TODOS foram REAPONTADOS, nenhum apagado:** o filtro de data (**deixou de existir de propósito** — *"Pendentes é FILA e NUNCA ganha mês"*, a régua de 14/09; quem navega por período é Movimentações) · o `status=PENDING` forçado (virou *"a caixa não define a fila por status NEM por categoria"*) · os call-sites de `fetchJson` (a caixa usa `fetchComTimeout`) · e o **banner retroativo de transferência**, que **já morava** em `/parear` — o guard passou a provar **os dois lados**: a detecção vive lá **e** a caixa leva até lá.

**⚠️⚠️ REGRA 11 REPROVOU UM GUARD MEU — a lição do rastro (12/09) em roupa nova.** O `meia-ponte-proibida` afirmava `toContain('acaoValePraSentido')`; troquei a condição por `if (false)` no servidor e ele ficou **VERDE** — **a linha do `import` já bastava**. O que morde é `usosDe()`, que ignora import/comentário e exige a chamada dentro do `if`. **Guard que conta a MENÇÃO aprova o servidor que não checa nada.**

**PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS (REGRA 12):**
```
CELULAR /conciliacao 200 · 1.057 KB      DESKTOP 200 · 1.057 KB   (bundle servido)
  ✓ o fluxo no topo · ✓ abas SAÍDAS/ENTRADAS · ✓ contador do arquivo
  ✓ "⛔ a soma não fecha" (o invariante VISÍVEL) · ✓ o vazio que DIZ · ✓ "tentar de novo"
  ✓ o gesto vai pro choke-point · ⛔ "Pgto cartão" (o seletor morto): SUMIU

/pendentes → 307 → /conciliacao   ·   /empresas/:id/pendentes → 307   (nos dois)

A CAIXA:  SAÍDAS 1 · ENTRADAS 0 · ARQUIVO 220 · TOTAL 221
          ⭐ Σ(caixa + arquivo) == total ✓ · crédito vendo "casar com conta a pagar": 0
A FILA DE PAGAR:  régua VELHA 6.555 → régua NOVA 850   ⭐ −5.705 créditos
```
**REGRA 11 — 5 defeitos repostos:** a fila voltando a filtrar por categoria (**1 vermelho**) · a lei do sentido caindo no servidor (**1**, depois do aperto) · o invariante sumindo da tela (**3**) · a detecção de par sumindo do `/parear` (**1**) · o `not: 'TRANSFER'` de volta no lugar do `DEBIT` (**1**).

**10.063 verdes · TS 0 · `pg_dump pre-estacoes-20260915-214235` (6,2 MB) · deploy 4/4 (`PO9SGRQsL5-iul7g5IpLT`).** Migration nenhuma — o `conciliarAPartirDe` já estava em prod desde 11/09.

**⭐ SÉRIE DE PERFORMANCE POR DEPLOY LIGADA** (`scripts/serie-performance.sh`, uma linha no `deploy.sh`): grava `data · build · chunks_kb · mem_mb · home_p95_ms` em `.perf-serie.tsv` e imprime o **Δ vs o deploy anterior**. 1ª linha: **8.228 KB · 54 MB · home p95 25 ms**.

⚠️ **DÍVIDA REGISTRADA, NÃO TOCADA (ordem do dono):** os **874 KB de JS do estoque** são dívida de **code-splitting**.

**⚠️⚠️ E A LIÇÃO DO DIA É SOBRE A MINHA SONDA, que errou TRÊS VEZES seguidas e cada vez com cara de defeito de prod:** (a) assinei o token só com `{sub}` e **todas** as páginas do dashboard deram **500** — o shell faz `initials(name)`, e o login real assina `name`; eu ia reportar prod quebrada; (b) mandei `?empresaId=` sem o cookie `current_empresa_id` e o `/pendentes` respondeu **200** em vez do 307, parecendo que o redirect não subiu; (c) procurei `"Saídas:"` no bundle e o minificador escreve **`Sa\xeddas:`** — a aba estava lá. ***Sonda errada dá um vermelho tão convincente quanto um defeito real*** — é a mesma família do `"Custo total"` de 14/09 e do token de 09/09. **Antes de reportar prod quebrada, provar que a SONDA reproduz o caminho real do dono.**

📋 **FICA PRO DONO (REGRA 2, o red-then-green navegando):** abrir a Conciliação, resolver uma saída e uma entrada pelo menu de cada sentido, e ver a linha **sair da caixa na hora** com o efeito nomeado no destino.


### ⭐⭐⭐ ETAPAS EM DIAS DIFERENTES + O SILÊNCIO NÃO PUBLICA (15/09)

Duas dores de operação do dono, e **a armadilha que ele nomeou ANTES de ela aparecer já estava cobrando em prod**.

**⛔⛔⛔ 1. A ARMADILHA DO RELÓGIO — E ELA NÃO ERA HIPOTÉTICA.** `lotes.ts` dizia, em comentário: *"a duração do LOTE é da 1ª etapa iniciada à última finalizada"* — **fim − início**. **MEDIDO EM PROD ANTES DE MEXER: 30 de 45 lotes com 2+ etapas estavam inflados**, com casos de **51 min de trabalho contados como 305 min (6×)** e **57 min como 343 min**. Isso ia pra média por lote, pro gráfico por dia e pro *"melhor ritmo"*.

**A régua do dono, ao pé da letra:** *"o TEMPO do lote é a SOMA dos cronômetros das etapas. Lote que dorme 16h não produziu 16h — se a etapa 1 levou 40min e a 2 levou 35min, o lote levou 1h15."* ⚠️ E a honestidade não afrouxou: **etapa sem `finalizadoEm` = lote sem tempo medido** (`null` ≠ 0).

**⭐⭐ 2. O LOTE PODE DORMIR.** `stock_etapa_plano` (CREATE-only — `stock_ordem_etapa` não aceita ALTER desde a Fase 0) guarda **dia previsto por etapa** e **liberada pra equipe**. ⚠️ **Ausência = padrão**: sem linha, a etapa é do dia da ordem e não está liberada — é o que faz a regra nova valer pro histórico inteiro **sem backfill**.
- terminar a etapa 1 **não obriga** começar a 2: à noite a fila fica vazia;
- amanhã ela aparece com **"começou 03/09 — 'sovar' feita por Eliane"**, em tom **neutro**: massa que descansa é a RECEITA, não atraso (a lição dos 111 alarmes falsos);
- **o P2 não grita mais** sobre descanso planejado — e a exceção é **estreita**: só cala com plano **vigente** (hoje ou pra frente). Lote esquecido com plano vencido continua vermelho.

**⭐⭐⭐ 3. SEM NOME = RASCUNHO MEU.** Até 14/09 a etapa **solta** aparecia pra TODO MUNDO e qualquer um iniciava. Agora ela só chega ao tablet **designada** (e só pros nomeados) ou **liberada** — um gesto explícito. ***O silêncio não publica.***
⛔ **E QUEM RECUSA É O SERVIDOR**, não a tela: esconder o botão não impede a chamada (a lição de 06/09, a etapa 2 do beef feita antes da 1, e a de 09/09, *"o menu esconde e a rota nega"*). A mensagem ENSINA a saída: *"é rascunho do encarregado — peça pra ele te designar ou liberar pra equipe"*.
⚠️ E o dono continua vendo: a tela de gestão traz o selo **"sem responsável — não aparece pra equipe"**. Invisível pros dois seria a fila que some quando o trabalho zera (12/09) — ele planejaria o mesmo lote duas vezes.

**⭐ MEDIDO EM PROD ANTES DE SUBIR — a régua nova NÃO esconde nada hoje:** das **8 ordens abertas / 9 etapas por fazer**, **ZERO estão sem responsável**. A cozinha não perde nada ao acordar amanhã.

**PROVADO EM PROD, depois do deploy:**
```
tempo dos lotes, agora por SOMA (83 medidos):
   278 min · 408 UN · metade de bolinha massa de pizza    média por lote: 61 min
   262 min ·  68 UN · porcao bacon 80 grama               ⛔ lotes acima de 8h: 0 ✓
tela da ordem (celular e desktop, REGRA 12): ✓ dia por etapa · ✓ liberar pra equipe
   ✓ a frase do mundo velho ("quem pegar com o PIN fica registrado") MORREU
tablet: ✓ "começou …" · ✓ "liberada pra equipe"
a régua pura: NINGUEM/EQUIPE/NOMEADOS · rodrigo vê a da eliane? false · o rascunho? false
```
**REGRA 11 — 4 defeitos repostos:** a régua velha do tempo (**1 vermelho**) · a etapa voltando pro dia da ordem (**1**) · o silêncio voltando a publicar (**1**) · o selo "começou ontem" sumindo (**1**).

**⚠️⚠️ E REGRA 11 ME CORRIGIU NO CAMINHO:** o teste *"a eliane vê só a etapa 1"* passava **mesmo sem o filtro de dia** — a etapa 2 estava sem responsável e a régua da VISIBILIDADE já a escondia. *Duas travas empilhadas, e o teste media a de cima.* O caso que ISOLA o dia é a etapa **designada à própria eliane** e marcada pra amanhã: visível por responsável, invisível por DIA.

**⚠️ E O CONTRAFACTUAL ME CORRIGIU TAMBÉM:** eu escrevi "20h35" de cabeça; a conta é **18h35 = 1.115 min** — **quinze vezes** os 75 min que a cozinha trabalhou. O número que importa não mudou; a minha aritmética estava errada.

**⚠️ 2 TESTES INVERTIDOS COM O MOTIVO ESCRITO** (afirmavam *"a solta aparece pros dois"* e *"etapa SEM designação aparece pra todo mundo"* — o mundo que o dono aposentou) **e 6 fixtures passaram a declarar `liberadaParaEquipe`**: elas se apoiavam no antigo padrão **sem dizer**, e o assunto delas não mudou — o que mudou é que o pressuposto agora está escrito.

**10.027 verdes · TS 0 · `pg_dump pre-plano-etapa-20260915-144932` (6,2 MB) antes da migration · deploy `tjb48eK8CFXFDhHbSB0tK` 4/4.**

📋 **FICA PRO DONO (REGRA 2, o red-then-green navegando):** criar a tarefa de 2 etapas com a etapa 2 marcada pra amanhã, ver o tablet da eliane, e nomear o rodrigo no dia seguinte.

### ⛔⛔⛔ O CLIQUE QUE GRAVAVA E NÃO DIZIA NADA (14/09) — REGRA 2 no confirmar do dia

**O dono, navegando:** *"abro Vendas → Complementos → dia 13/09 → revisão → clico 'Confirmar e baixar' → NADA acontece: nenhum modal de prévia, nenhum recibo, nenhuma mudança de contador."*

**⛔⛔ E ERA PIOR QUE NADA — O CLIQUE GRAVOU.** Medido no ledger: **`BAIXA_VENDA` de complementos às 19:33:17**, do clique dele. A tela zerava o preview, recarregava a lista (que **não mudava**, porque os nomes já estavam vinculados) e **jogava o recibo fora**.

**⭐⭐ A RÉGUA QUE FICA:** ***gravar sem dizer é pior que não gravar — porque o dono clica de novo.*** Todo botão que escreve no ledger: **modal de prévia antes**, **recibo depois**.

**⚠️⚠️ E A LIÇÃO SOBRE O GUARD ANTERIOR É A QUE DÓI:** eu tinha um teste verde provando que `<PlanoVendaModal` existe no fluxo de complementos. **Ele passava porque eu liguei o modal no caminho do UPLOAD e o dono navegou o caminho do DIA.** *É o "guard que testa a lib e aprova a tela que ignora a lib" em versão nova: **testei o modal, não o botão que o abre**.* O guard novo pergunta **quem dispara a escrita** — e exige que a resposta seja *"o modal"*, nunca *"o botão"*.

**A INVESTIGAÇÃO, na ordem que ele pediu:** o clique chamava `reprocessar()` direto (o caminho do DIA nunca passou pelo modal — só o do upload) · o preview do rodapé respondia em **132 ms** com `mudam: 2`, então o botão estava **habilitado** e a rota **não travava** · `montarRevisaoDeLinhas` com as 1.014 ocorrências: **202 ms** · deploy íntegro. **Nada estava pendurado: estava mudo.**

**O QUE SUBIU:**
1. o botão do rodapé **ABRE O MODAL** (o mesmo de produtos), nos **dois** relatórios — e quem grava é o `gravar()`, chamado **só de dentro dele**;
2. a rota da revisão devolve o **plano do dia na forma do modal** (`planoDoDia`), saindo do **MESMO motor que a baixa executa** — um cálculo "só pro modal" faria a tela prometer um número e o ledger gravar outro;
3. **recibo do SERVIDOR** no topo da revisão (*"baixado: N ocorrências · M itens · R$ X"*) + `carregar()` e `verPreview()` logo depois, pros contadores andarem;
4. prévia e gravação com **teto de tempo** — e o da gravação é **maior (60 s)**: desistir cedo de uma escrita que está acontecendo é pior que esperar.

⚠️ **A tradução do recibo mora num lugar só:** complementos contam **ocorrências**, produtos contam **produtos**, e os campos do servidor têm nomes diferentes. Remontar isso em duas telas daria dois números pro mesmo fato.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12):**
```
CELULAR 200 · 876 KB      DESKTOP 200 · 876 KB
  ✓ modal de prévia · ✓ recibo · ✓ "custo total baixado" · ✓ teto de tempo · ✓ "tentar de novo"

O QUE O MODAL DESENHA — 13/09 COMPLEMENTOS (a rota real):
  46 baixam · 84 sem destino · 0 ignorados
  sai do estoque: 22 itens · custo total R$ 2.682,80
    − 181 porcao de calabresa 120 grama · R$ 427,16
    − 117 porcao bacon 80 grama         · R$ 586,17
    − 113 porcao frango 100 grama       · R$ 322,05
12/09 PRODUTOS → 52 baixam · 52 itens
```
**REGRA 11 — 4 defeitos repostos:** o botão gravando direto (**2 vermelhos**) · o recibo jogado fora (**1**) · o modal sumindo do fluxo do dia (**3**) · a gravação sem teto (**1**).

⚠️ **UM VERMELHO DA MINHA SONDA, NÃO DA TELA:** a 1ª prova acusou *"⛔ o custo total do modal"* — eu procurei `"Custo total"` e o rótulo real é `"custo total baixado"`, minúsculo. **Erro da sonda**; conferido com o texto certo, está lá.

**10.015 verdes · TS 0 · deploy `51NroDCWdqIp4XDi1ZRL0` 4/4.**

⚠️ **E O DIA 13/09 FOI REPROCESSADO PELO CLIQUE MUDO DELE** (19:33:17). O estoque está correto — `processarComplementos` estorna e refaz, é idempotente —, mas o ledger tem esse par a mais, sem ninguém ter visto o que ia acontecer. É o custo registrado do defeito.

### ⛔⛔⛔ A TELA PENDUROU EM PROD — 20 REQUISIÇÕES POR SEGUNDO, 18.051 NO DIA (14/09)

**O dono:** *"com a página RECARREGADA, três fetches não resolvem — o 'Lendo…' do topo, a lista de receitas do seletor ('carregando…' eterno) e o POST do processar ('processando…' preso)."*

**⭐ A INVESTIGAÇÃO INOCENTOU TUDO QUE ELE LEVANTOU, e a medição é que apontou o culpado:**
```
pm2        online · 40 restarts · uptime 629s · 54 MB · CPU 0,1%   → sem loop, sem OOM
dmesg      nenhum "killed process"                                 → sem OOM killer
free       2.854 MB livres de 3.915                                → sem pressão
as rotas   destinos 184/261ms · revisao 13/09 202ms · processados 302ms
           preview-do-ajuste 72-112ms                              → montarRevisaoDeLinhas NÃO é pesado
deploy     BUILD_ID servido == buildado, 4/4                       → não ficou pela metade
```
⛔ **E o nginx deu o veredito: 489 de 500 requisições eram o MESMO `POST /vendas/preview`, ~20 por segundo, todas 200, cada uma reenviando o arquivo inteiro** — do Safari dele. **18.051 no dia.**

**A CAUSA É MINHA, do deploy das 17h:** o `carregar` da revisão tinha **`recarregarExterna` nas dependências**, e a tela pai monta essa função **nova a cada render**:
```
efeito → fetch → setState no pai → render → identidade nova → efeito → …
```
⚠️ **E é por isso que os TRÊS spinners travaram, não só um:** com o limite de **~6 conexões por host** do browser saturado pelo laço, o `GET /destinos` do seletor e o `POST /processar` **ficaram na FILA — pra sempre**. *O servidor nunca soube que havia um problema.*

**⭐⭐ A CURA É ESTRUTURAL, não um `useRef` em cima do laço:** no modo externo **a lista É a prop** — o componente **ESPELHA**, não busca. Quem busca é o pai, e só quando alguém pede (um ajuste). **Sem efeito que busca, não há laço possível** (REGRA 5). O `recarregarExterna` foi pro ref: é chamado por GESTO, nunca por dependência.

**⚠️ A RÉGUA GERAL QUE FICA:** ***`useCallback`/`useEffect` que busca não pode depender de função vinda de prop*** — a identidade muda a cada render do pai **por construção**. É um laço armado esperando o pai re-renderizar.

**⭐ A VARREDURA (REGRA 4) ACHOU A MESMA BOMBA NOUTRO LUGAR:** `LinkPaymentModal` tem `load` com `onClose` e `toast` nas deps + `useEffect(… , [load])`. Lá não virou enxurrada porque o `load` só mexe em estado **local** — mas é a mesma bomba armada, e foi fechada junto (os dois foram pro ref).

**⛔⛔ E O TIMEOUT QUE O DONO PEDIU — com uma declaração honesta: ELE NÃO TERIA PEGO ESTE DEFEITO.** As requisições eram **200 e rápidas**; o que pendurou foi a FILA. O timeout não impede o laço — **impede a mentira**: em vez de girar pra sempre, a tela diz *"não consegui carregar — tentar de novo"* em **12 s**. `lib/http/fetch-com-timeout.ts` (12 s pra ler, **60 s pra gravar** — desistir cedo de uma gravação que está acontecendo é pior que esperar), **nunca lança** (throw solto em efeito vira spinner com o erro só no console), e respeita o `signal` de quem chama.

**⭐ *"Carregando pra sempre e erro são estados diferentes; o spinner eterno é a ausência fingindo progresso"*** — palavras do dono, e virou régua da casa.

**O GUARD (`spinner-eterno-nao-existe.test.ts`) TEM DUAS FORMAS, e a 2ª nasceu de o guard não morder:**
- **(A) direta** — o hook tem `fetch(` no corpo e uma prop-função nas deps;
- **(B) indireta** — um `useCallback` com prop-função nas deps é ele próprio dependência de um `useEffect`.

**⚠️⚠️ REGRA 11 REPROVOU A 1ª VERSÃO:** repondo o defeito, o `fetch(` ficou num callback **VIZINHO** e o detector que só olhava o corpo passou **VERDE**. *O laço não precisa do `fetch` na mesma função — precisa da **identidade instável chegando ao efeito**.* ⛔ E `onClose` num efeito de listener **não** cai no detector: a forma é outra, e alarme falso no dia 1 mataria o guard.

**PROVADO EM PROD:**
```
CELULAR 200 · DESKTOP 200  →  ✓ teto de tempo no fetch · ✓ "tentar de novo" · ✓ a frase do erro
nginx    último POST /preview 16:26 (antes do deploy) · agora 16:31
         últimas requisições: navegação normal, ZERO /preview
```
**9.992 verdes · TS 0 · deploy `BjtjdYxjEEHTrXkBHb-OQ` 4/4.**

### ⛔⛔⛔ A TELA VELHA NÃO MORREU QUANDO A NOVA NASCEU — NAS DUAS (14/09)

**O dono:** *"depois do confirmar (e no upload), a página empilha: recibo + REVISÃO nova + o RELATÓRIO/TABELA VELHA (produtos: 'Mapeamento (115)' com trocar/desmapear e SEGUNDO botão de confirmar; complementos: o relatório feio antigo que não edita nada). O mesmo dado em duas vitrines, dois confirmares — **é a segunda derivação em forma de página**."*

**⭐⭐⭐ A REGRA QUE FICA, E VALE PRAS PRÓXIMAS:** ***quando a tela nova assume, a velha MORRE NO MESMO DEPLOY.*** Conviver *"por enquanto"* é como nasce a página com duas verdades — a mesma doença dos 7 detectores de par, agora em HTML. ⚠️ **E o defeito foi meu:** eu subi a revisão ao lado da tabela em vez de no lugar dela.

**⭐⭐ A PEÇA QUE DESTRAVOU TUDO: `montarRevisaoDeLinhas`.** A tabela velha existia por um motivo técnico real — **a revisão só sabia ler do BANCO, e antes de confirmar o dia não está no banco**. Separando as LINHAS do resto, a MESMA função serve os dois momentos: o arquivo recém-lido e o dia já importado. ⚠️ **E isso NÃO ressuscita o "baixar" separado que morreu em 07/09:** o upload continua **sem escrever nada** — o que a tela pré-import edita é o **MAPA** (configuração, vale pra sempre), e o dia nasce num confirmar só.

**1. PRODUTOS — a tabela "Mapeamento (N)" SAI.** A revisão é a única lista, com as ações completas na linha: **definir/trocar** · **desmapear** (migrou da velha) · **IGNORAR** (novo aqui).

**⭐⭐ IGNORAR CHEGOU AO MAPA DE PRODUTOS**, e o dono nomeou o custo de não ter: *"os ~30 doces/milkshakes/açaí que POR MINHA DECISÃO não controlam estoque param de engordar o contador de pendentes pra sempre"*. ⛔ **PENDENTE = "espera decisão", NUNCA "tudo que não baixa"** — contador que cobra o que já foi resolvido é como o dono aprende a não olhar o contador. Ele é **reversível** (o desmapear devolve à fila), **datado** (o *"por você, em DD/MM"* da linha) e o plano de baixa lista os ignorados **nomeados**, nunca só contados.

**2. COMPLEMENTOS — o relatório velho pós-upload SAI.** Upload → **revisão direto** → `[Confirmar e baixar]` → recibo + contadores. ⭐ E o confirmar de lá passou a usar o **MESMO `PlanoVendaModal`** da tela de produtos: o resumo inline que existia ali era um **segundo desenho da mesma pergunta** (*"o que acontece se eu confirmar?"*), e dois desenhos divergem no primeiro campo novo.

**3. O PREVIEW MORRE NO CONFIRMAR.** Sem isso a página ficaria com a lista do ARQUIVO e a lista do DIA ao mesmo tempo — as duas vitrines de novo, agora por dentro. Depois de confirmar existe **uma verdade: o dia gravado**.

**⚠️ "DESFAZER" TEM NOME DIFERENTE NOS DOIS MAPAS** — `LIMPAR` nos complementos, `REMOVER` nos produtos. A tradução mora **num lugar só** (o `aplicar` da revisão): uniformizar as rotas quebraria um dos dois guards, que são opostos de propósito desde 02/09.

**OS 3 GUARDS DA FAMÍLIA** (`uma-vitrine-um-confirmar.test.ts`): **(a)** a página não desenha NENHUMA lista de nomes do dia — quem lista é a revisão; **(b)** **zero** botão de gravar o dia fora do rodapé da revisão, nos dois relatórios; **(c)** o **guard da mudança de casa** — desmapear EXISTE na revisão, e IGNORAR não pode voltar a ser só de complementos. *Remoção sem realocação é perda* (a disciplina da conferência de saldo que mudou de casa em 10/09).

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12):**
```
/estoque/vendas   CELULAR 200 · 873 KB      DESKTOP 200 · 873 KB
  ✓ morreu — a tabela velha "Mapeamento ("      ✓ morreu — o filtro "só pendentes"
  ✓ morreu — o relatório velho de complementos  ✓ morreu — o 2º confirmar
  ✓ a revisão · ignorar · desmapear · Confirmar do rodapé · o modal único

PRODUTOS     12/09 → 🟡 33 · ✅ 52 · soma 85 = linhas 85 ✓
COMPLEMENTOS 13/09 → 🟡 84 · ✅ 46 · soma 130 = linhas 130 ✓
```
⭐ **E o dono já usou a tela enquanto eu provava:** `COCA COLA LATA` e `COCA COLA ZERO LATA` mapeadas por ele às **17:59 de hoje** (auditoria: `criadoPorId` dele) — é por isso que os complementos saíram de 🟡86/✅44 pra 🟡84/✅46.

**REGRA 11 — 5 defeitos repostos, 1-2 vermelhos cada:** a segunda vitrine de volta na página (**2**) · o segundo confirmar (**1**) · o preview sobrevivendo ao confirmar (**1**) · IGNORAR voltando a ser só de complementos (**1**) · desmapear não migrando (**1**).

**⚠️ 5 TESTES DO GUARD ANTERIOR FICARAM VERMELHOS COM A TELA CERTA — e foram REAPONTADOS, não afrouxados.** Eles mediam *"a tela de produtos renderiza `<SeletorDeDestino>`"*, o que era verdade **enquanto a tabela velha existia**; agora ela renderiza a REVISÃO, e é a revisão que usa o seletor. A pergunta continua a mesma (*"o destino se edita pelo componente único?"*); o que mudou é por onde ela passa. É a mesma classe do guard que quebrou com a tela certa em 13/09.

**9.983 verdes · TS 0 · deploy `VFe4IlUZ2ogobVspE6a_H` 4/4.**

📋 **DUAS CONSEQUÊNCIAS MEDIDAS, NOMEADAS E NÃO ESCONDIDAS:**
1. **O checkbox "não processar este nome HOJE" morreu com a tabela velha.** Ele era o `fora` do plano (mapeado que o dono desmarcava naquele processamento). **Não foi pedido pra ficar e não foi realocado** — o IGNORAR cobre a decisão permanente, que é o caso real; o "só hoje" deixou de existir. Se ele fizer falta, volta como um toggle na linha.
2. **Produto IGNORADO sai do CARDÁPIO.** O hub pula quem não tem destino FICHA/REVENDA, então o milkshake ignorado deixa de aparecer lá — inclusive com as vendas dele. É o efeito pretendido no contador de pendentes, mas o número de vendas daquele nome some junto da tela de margem. Fica registrado pro dia em que ele quiser um estado "ignorado" visível também no cardápio.

### ⛔⛔⛔ "O DEFINIR FICHA ME EXPULSA DA TELA" — PARIDADE COM PRODUTOS (14/09)

**O dono, na revisão de complementos:** *"clico em definir → navega pro cardápio e eu SAIO da revisão — perco o dia, a lista e o fio. A referência é a NOSSA tela de PRODUTOS, que está certa: clico no destino → seletor abre ALI → escolho → sigo na mesma tela."*

**A EXPULSÃO ERA LITERAL:** o "definir" era um `<a href>` pro cardápio. E **o gesto se repete ~80 vezes num dia de import** — sair e voltar 80 vezes não é fluxo, é castigo. ⚠️ É a "porta sem maçaneta" **do avesso**: o gesto existe, o caminho de VOLTA é que não.

**⭐⭐ 1. O SELETOR VIROU UM SÓ (`seletor-de-destino.tsx`), pros dois relatórios e pras duas telas.** ⛔ Dois seletores divergiriam no primeiro destino novo, e o dono veria opções diferentes pra mesma pergunta em duas telas do mesmo módulo. ⚠️ **E a referência dele ganhou o que faltava:** o `<select>` nativo da tela de produtos **não tinha busca**, e a lista já passa de **150 nomes** — agora busca pela régua da casa (palavra em qualquer ordem, sem caixa e sem acento, 08/09) e é dispensável com ESC/clique-fora (28/08).

**⛔ UNIFICAR NÃO PODE TIRAR CAPACIDADE:** o `<select>` velho oferecia **"desmapear"** (que DEVOLVE o nome pra fila, diferente de ignorar) e **"criar item de revenda"**. Os dois sobreviveram — senão o fix seria uma regressão com cara de melhoria. O guard trava os dois.

**⭐⭐ 2. A FICHA SIMPLES NASCE DO GESTO — e a régua não afrouxou.** O caso `FRUKI LATA` comum: escolher um item do estoque cria a ficha ×1 e mapeia, sem sair. ⛔ **`REVENDA` continua sendo ATALHO, não um quarto destino** — por baixo vira `FICHA`, pelo **MESMO** `garantirFichaDeRevenda` que o mapa de produtos usa desde 09/09. Ele saiu de dentro do `venda-map.ts` porque agora serve os dois mapas: **REGRA 4** — copiar as 20 linhas faria duas implementações da mesma decisão.

⚠️ **O QUE NÃO VEIO JUNTO: os GUARDS de destino.** `venda-map` recusa INTERMEDIARIO, `complemento-map` ACEITA — são **opostos de propósito desde 02/09** e unificá-los quebraria um dos dois. O que é comum é só a **construção** da ficha. E `destinosPossiveis` decide **o que a tela OFERECE, nunca o que o mapa ACEITA**: se divergirem, quem ganha é o guard da fonte.

**⭐⭐ 3. IDA COM VOLTA — o combo sai e VOLTA pro mesmo dia e pra mesma linha.** `?revisar=<dia>&relatorio=<R>#rev-<nome>`, lido no **1º render** (como o `?aba=`): em `useEffect` a tela renderizaria sem a revisão antes de abri-la, e *"voltar e não ver nada"* é indistinguível de *"não gravou"*. ⚠️ A régua mora em `lib/stock/vendas/volta-da-revisao.ts`, **nunca no componente** — sem jsdom, regra dentro de JSX é regra que ninguém prova (foi assim que o prefill do cardápio quebrou 2× em 28/08). O `voltar` só aceita **caminho interno**.

**⭐⭐ 4. O ARREMATE — CONFIRMAR NO PÉ DA TELA ONDE EU TRABALHEI.** ⛔ Antes o botão só existia **depois** de um ajuste (o preview só nascia ali), então voltar do editor com a linha vinculada deixava o dono **sem onde aplicar** — e o reprocessar morava na lista de dias, fora da tela. Agora o preview carrega junto com a tela e o rodapé é **permanente**: *botão que aparece e some conforme o estado é botão que se aprende a não procurar.* ⚠️ E ele **não grava sem preview**: mudança de vínculo é escrita em estoque.

**PROVADO EM PROD, NOS DOIS VIEWPORTS (REGRA 12):**
```
/estoque/vendas   CELULAR 200 · 880 KB      DESKTOP 200 · 880 KB
  ✓ seletor inline  ✓ 2 abas  ✓ busca  ✓ criar-item inline
  ✓ ida-com-volta do combo  ✓ Confirmar no pé  ✓ desmapear
  ✓ o <select> velho morreu

DESTINOS (a rota real)  PRODUTOS 80 receitas · 31 itens
                        COMPLEMENTOS 114 receitas · 31 itens
  ⭐ COCA LATA → "COCA COLA LATA 350ML ×1"   (o destino DIZ o que desconta)

IDA COM VOLTA  voltar: /…/vendas?aba=complementos&revisar=2026-09-13
                       &relatorio=COMPLEMENTOS#rev-coca-lata-mais-mini-fritas
               interno ✓ · responde 200
```
**REGRA 11 — 4 defeitos repostos:** o "definir" de volta a link (**3 vermelhos**) · o `?revisar=` fora do estado inicial (**1**) · a âncora da linha sumindo (**1**) · o rodapé de volta atrás do preview (**1**).

**⚠️⚠️ E O DETECTOR DO RODAPÉ NÃO MORDEU NA 1ª VERSÃO:** ele era um regex com **janela de 400 caracteres** entre o gate e o botão — e no arquivo real há o bloco inteiro do preview no meio. **Janela de distância já produziu falso vermelho e falso verde nesta casa** (o rastro em 12/09, o menu do PF em 13/09). O que morde é olhar o que vem **imediatamente antes** da tag: estrutura, não distância.

**⚠️ E O GUARD DE 09/09 ("rótulo que some não é rótulo") ME PEGOU — com razão parcial.** Ele acusou o campo de busca do seletor porque a exceção dele casava `placeholder="buscar…"` **com aspas literais**, e o meu é `placeholder={cond ? 'buscar item…' : 'buscar receita…'}`. **A pergunta é "é um campo de busca?", não "com que aspas foi escrito"** — a exceção foi corrigida na forma, não afrouxada: campo de DADO sem rótulo continua vermelho (medido).

**9.943 verdes · TS 0 · deploy `F02MS2AbYIC97UGbM0Ul6` 4/4.**

⚠️ **OS DOIS CLIQUES DO RED-THEN-GREEN SÃO DELE, e de propósito:** mapear `COCA COLA LATA` e criar a ficha do `FRUKI LATA` comum é **decisão do dono** (a régua desde 22/08) — o sistema oferece, ele aponta. O caminho de escrita está provado ponta a ponta nos 9 testes de integração contra banco real; o que falta é o dedo dele. ⚠️ E pro `FRUKI LATA` comum **não existe item no estoque** (só a `FRUKI GUARANA 2L` e a lata ZERO): ali o caminho é o **"criar no estoque"** do próprio seletor — o item nasce com **saldo ZERO** e entra na fila de contagem, porque saldo não se chuta.

### ⛔⛔⛔ A REVISÃO SÓ EXISTIA POR ROTA DIRETA — 8ª VOLTA DA "PORTA SEM MAÇANETA" (14/09)

**O dono, com o deploy 4/4 verde e a tela provada:** *"NAVEGANDO EM PROD (cache limpo, celular e desktop) eu NÃO ACHO a tela: subo arquivo, vejo o resumo velho, e nenhum botão/link leva à revisão."*

**⭐ NAVEGUEI COMO ELE E ELE ESTAVA CERTO — o defeito era MAIOR que o relato.** O caminho existia e tinha três degraus invisíveis:
```
Estoque → Vendas (Suitable) → aba "Processados" (a 4ª) → última coluna da tabela
  → <button class="text-xs text-violet-700 hover:underline">revisar</button>
```
1. ⛔ **`hover` NÃO EXISTE NO CELULAR**, que é onde ele importa — a lição literal do *"converter a unidade"* (30/08): **ação sem afordância não existe**;
2. ⛔ **o caminho REAL dele nem passava por ali:** subir o arquivo → confirmar desembocava no **recibo velho** (três números + link pro extrato). A pergunta que o recibo LEVANTA (*"86 pendentes — quais?"*) não tinha resposta na tela;
3. ⛔⛔ **e do lado dos COMPLEMENTOS a revisão NÃO TINHA CAMINHO NENHUM** — o `relatorio` estava cravado em `'PRODUTOS'`. O relatório que motivou a tela (as bebidas) só era revisável por URL secreta.

**⭐ A REGRA QUE FICA** (irmã da de 12/09, *"fila zerada esconde o trabalho, nunca a ferramenta"*): ***o RESULTADO do gesto abre a tela que responde a pergunta do gesto, e todo item da lista carrega o caminho À VISTA.***

**O QUE SUBIU:** **(a)** confirmar o import — produtos **e** complementos — **ABRE a revisão do dia** (⛔ PERÍODO fica de fora: não é dia de venda, é semente da prateleira); **(b)** as **duas** listas de dias ganharam **"revisar" com borda e ícone**, nunca só hover; **(c)** o painel tem **um dono só** (`BlocoRevisao`) aberto de quatro lugares — copiar o cabeçalho em cada um faria quatro telas divergindo no primeiro rótulo novo.

⚠️ **E o painel renderiza em DOIS SLOTS (`origem`)**: aberto pelo upload, cola no resultado; aberto pela lista, embaixo da lista. Um slot só o faria nascer longe do dedo que clicou — o defeito de 10/09, de novo.

**GUARD DE 2 LADOS** (`revisao-do-import-tem-macaneta.test.ts`), porque guard que só olha a TELA aprovaria botão apontando pro nada: o botão existe **E** a rota responde (GET+POST, `view` pra ler e `manage` pra mudar vínculo, aceitando os DOIS relatórios), **e** todo caminho que o painel chama tem arquivo de rota. Mais: nenhum "revisar" pode ser texto hover-only, e o detector de `useState(false)` de 10/09 é **reusado**, não copiado.

**PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS (REGRA 12):**
```
/estoque/vendas  CELULAR 200 · 874 KB    ·    DESKTOP 200 · 874 KB
  ✓ botão revisar  ✓ "O que chegou em"  ✓ selo complementos
  ✓ border-violet-300 (não é hover-only)  ✓ 3 contadores  ✓ sugestão  ✓ o que desconta

PRODUTOS     13/09 → 🟡 5 (39 oc) · ✅ 2 (22 oc) · soma 7 = linhas 7 ✓
PRODUTOS     12/09 → 🟡 33 (126) · ✅ 52 (559) · soma 85 = linhas 85 ✓
COMPLEMENTOS 13/09 → 🟡 86 (457) · ✅ 44 (557) · soma 130 = linhas 130 ✓
COMPLEMENTOS 12/09 → 🟡 59 (228) · ✅ 40 (306) · soma 99 = linhas 99 ✓
  ✅ CACHORRO QUENTE → baixa CACHORRO GG ×1, SALSICHA ×0,085, MILHO ×0,04, …
```
**REGRA 11 — 4 defeitos repostos, 1 vermelho cada:** o link de volta a hover-only · o confirm voltando a terminar no recibo · a lista de complementos sem o botão · o upload de complementos deixando de avisar.

### ⛔⛔ E A PROVA EM PROD ACHOU DOIS DEFEITOS NA SUGESTÃO — UM DELES CRIADO POR MIM (14/09)

**1. `FANTA LARANJA ZERO 2L` (PDV) ganhava a sugestão da ficha `FANTA LARANJA 2L` — a COMUM.** A régua da DIREÇÃO **passava** (a ficha ESTÁ contida no nome do PDV) e **um clique baixaria a bebida errada**. ⚠️ **É o espelho exato do `FRUKI LATA`:** a régua velha supunha que a palavra a mais do PDV é **ruído** (`COCA COLA LATA` × `COCA LATA` — "COLA" é ruído); **`ZERO` distingue o produto**. Lista **FECHADA** (`ZERO · DIET · LIGHT · SEM ACUCAR`), como a dos volumes de bebida e a dos sufixos societários: inferir "qualificador" de qualquer palavra a mais mataria as sugestões boas, que são a razão de a tela existir.

**⭐ E a régua nova ganhou um efeito que eu não previ (o teste me corrigiu):** com as duas fichas na lista, o que antes era **ambiguidade** (as duas casavam → nada sugerido) agora **se resolve sozinho** — a comum cai pelo qualificador e sobra a certa.

**⛔⛔ 2. …E ESSE MESMO EFEITO CRIOU UM DEFEITO MEU, achado na prova seguinte:** `COCA COLA ZERO LATA MAIS MINI FRITAS` passou a **ganhar sugestão de 1 clique pra `COCA ZERO LATA`**. A régua de 12/09 (*"combo não herda — baixaria só a lata e esqueceria a batata"*) valia aqui **POR ACIDENTE**: o combo casava com DUAS fichas e morria na trava da ambiguidade. Tirei o acidente e o buraco apareceu. Agora é **explícito** (marcas `MAIS` e `+`, lista fechada). ⚠️ **`COM` fica de fora de propósito:** `FRANGO COM CATUPIRY` é **um sabor**, e barrá-lo mataria sugestão legítima.

**⚠️⚠️ REGRA 11 REPROVOU DUAS VERSÕES MINHAS DO MESMO GUARD:** (a) a fixture com **duas** candidatas passava pela trava da **ambiguidade** — repondo o defeito, ficava **VERDE**; o caso que isola é o REAL de prod, com **uma** ficha só; (b) a lista de qualificadores nasceu em **minúsculas** e `normalizarNome` devolve **MAIÚSCULAS** → o guard era **no-op**, verde com o defeito reposto. *Guard que não roda contra o defeito que o motivou é uma afirmação sobre o mundo bom.*

**PROVADO EM PROD depois dos dois:**
```
PRODUTOS     12/09  ✓ FANTA LARANJA ZERO 2L — sem sugestão (a comum não entra)
COMPLEMENTOS 13/09  ⭐ COCA COLA LATA → COCA LATA          (comum → comum)
                    ⭐ COCA COLA ZERO LATA → COCA ZERO LATA (zero  → zero)
                    ✓ COCA LATA MAIS MINI FRITAS            — combo sem sugestão
                    ✓ COCA COLA ZERO LATA MAIS MINI FRITAS  — combo sem sugestão
                    ✓ FANTA LARANJA LATA MAIS MINI FRITAS · SPRITE LATA MAIS MINI FRITAS
```
**9.880 verdes · TS 0 · deploys `Muxqj0EeHnkUlt0WpwA1a`, `rsUZZXoICeOUbMyVaIq_G` e `-f9t45mvSaLEh0bDD_QoE`, os três 4/4.**

### ⭐⭐ O IMPORT DE COMPLEMENTOS DE 13/09 — AS BEBIDAS BAIXARAM; O DEFEITO ERA DA TELA (14/09)

**O relato:** *"bebidas não baixaram"*. **A investigação read-only inocentou o arquivo, o import e a baixa** — e achou o defeito na TELA.

**⭐ O QUE O DADO DIZ (import `comp-…-2026-09-13`, 130 linhas):**
```
  ocorr  nome do PDV                             mapa?   desfecho
    19×  COCA LATA MAIS MINI FRITAS              ⛔ NÃO  pendente (combo)
    15×  COCA COLA 2L                            SIM     BAIXOU
     7×  COCA COLA ZERO LATA MAIS MINI FRITAS    ⛔ NÃO  pendente (combo)
     6×  COCA ZERO 2L                            SIM     BAIXOU
     5×  COCA COLA LATA                          ⛔ NÃO  pendente
     3×  COCA COLA ZERO LATA                     ⛔ NÃO  pendente
     1×  FRUKI 2L · FANTA LARANJA LATA · FANTA UVA 2L · FANTA UVA LATA   SIM  BAIXARAM
     1×  FANTA LARANJA LATA MAIS MINI FRITAS · GUARANA FRUKI ZERO LATA · FRUKI LATA  ⛔ pendentes

O QUE SAIU (líquido, 54 movimentos · 17 estornados · 20 vivos):
  −15 COCA-COLA 2L · −6 COCA COLA Zero 2L · −1 FANTA LARANJA LATA · −1 FANTA UVA 2L
  −1 FANTA UVA LATA · −1 FRUKI GUARANA 2L
```
⭐ **As 15 ocorrências viraram −15.** Os 17 estornos são o **estorna-e-refaz do reprocesso funcionando** — o dia foi baixado parcial e refeito inteiro.

**⛔⛔ O DEFEITO REAL ERA DE TELA:** o modal só desenhava o `agregada` — **o que sai do ESTOQUE, por ITEM**. A pergunta do dono é *"e a COCA COLA 2L?"*, e **um xis vira 6 itens**: o nome do PDV sumia no meio do efeito. ***Contar o efeito não é listar o que entrou.*** Agora o resumo traz **três contadores** (N baixam · M sem mapa · K fora) e **a lista por NOME** com quantidade e destino — e o *"fora"* também passou a ser **nomeado**, nunca só contado.

**⭐ ITEM 2 — POR QUE A HERANÇA NÃO PEGOU OS NOVOS: o canônico DIFERE, e a régua de 08/09 está certa** (*"canônico IDÊNTICO"*, nunca *"parecido"*). Os pares, **pro dono decidir**:

| nome no PDV | ocorr. | ficha que existe |
|---|---|---|
| `COCA COLA LATA` | 5 | **`COCA LATA`** |
| `COCA COLA ZERO LATA` | 3 | **`COCA ZERO LATA`** |
| `GUARANA FRUKI ZERO LATA` | 1 | **`FRUKI LATA ZERO`** |
| `FRUKI LATA` (comum) | 1 | ⛔ **não existe** — só a `FRUKI LATA ZERO` |

⚠️ **O `FRUKI LATA` comum é o caso que NÃO se resolve mapeando**: apontá-lo pra a ZERO baixaria a bebida errada. É a régua de 09/09 (*"se só existe a ZERO, me AVISA em vez de apontar na errada"*) — **a ausência se reporta, não se preenche**.

**⭐ ITEM 3 — OS COMBOS ESTÃO PENDENTES POR DESENHO, confirmado.** São **4 nomes · 28 ocorrências**: `COCA LATA MAIS MINI FRITAS` (19) · `COCA COLA ZERO LATA MAIS MINI FRITAS` (7) · `FANTA LARANJA LATA MAIS MINI FRITAS` (1) · e o irmão do FRUKI. ⛔ **Combo não herda** (régua de 12/09): herdar por *"parece"* baixaria só a lata e **esqueceria a batata**. Cada um precisa da ficha do dono, **uma vez** (lata + porção mini fritas) — daí em diante baixa sozinho.

**⚠️⚠️ REGRA 11 — o defeito reposto veio VERDE:** meus testes provavam o **PLANO**, e ele **sempre carregou tudo**; apagar o resumo por nome DA TELA deixava os 5 verdes. ***Guard que testa o dado aprova a tela que não o desenha*** — a mesma lição do card do PJBANK, no dia anterior. O teste passou a perguntar pra TELA.

⚠️ **E um fixture meu nasceu degenerado**: a ficha produzia e consumia o MESMO item — o ciclo que `criarFicha` recusa desde 09/09. O motor acusou (*"explosão de venda muito profunda"*) antes de eu perceber.

**9.827 verdes · TS 0 · deploy `Spe71jNqCfRobDq6FdJYg` 4/4.**

### ⭐⭐⭐ FLUXO ABRE NO MÊS; ESTOQUE MOSTRA O ESTADO DE AGORA (14/09) — régua da casa

**A REGRA DOS DOIS TEMPOS, ditada pelo dono, e ela existe pra NÃO ESCONDER DÍVIDA:**
- **PAGAS é FLUXO** → recorta no período, padrão **mês corrente**. *"É o número que muda com o filtro."*
- **VENCIDAS e A PAGAR são ESTOQUE** → mostram **tudo que está em aberto, SEMPRE**. *"Dívida aberta não expira com a virada do mês — esconder vencida de agosto seria mentir que não devo."*

**⭐⭐ E A DECISÃO MORA NO DONO DO ESCOPO, não em cada tela:** `whereDoStatus` **IGNORA o mês** quando o status é de estoque, **mesmo recebendo um**. ⛔ Se dependesse de cada chamador lembrar de não passar o período, a primeira tela nova esconderia dívida em silêncio — *aqui é impossível*. Quem separa os dois é `ehFluxo`, num lugar só.

⚠️ **O MÊS É O DO BRASIL**, pelo mesmo motivo do `inicioDoDiaBrasil`: **1º de outubro às 00h30 de São Paulo ainda é setembro**, e o servidor em UTC já diria outubro desde as 21h do dia 30.

**⭐ O CABEÇALHO DIZ O RECORTE *E* O QUE ELE ALCANÇA:** *"setembro ‹ › · o mês recorta as **pagas**; **vencidas** e **a pagar** mostram tudo que está em aberto"*. ⛔ Sem a segunda metade, ver "setembro" no topo faria o dono concluir que as vencidas de agosto sumiram — exatamente a mentira que a régua evita. ⚠️ E **limpar os filtros volta pro mês corrente**, nunca pro começo dos tempos.

**PROVADO EM PROD:**
```
ABRO A TELA → mês "2026-09"
   PAGAS     26 · R$  19.040,90   (era 250 · R$ 220.353,76 "desde sempre")
   VENCIDAS   7 · R$  20.346,54   ⭐ TODAS as abertas
   A PAGAR   87 · R$ 175.982,36
‹ AGOSTO → PAGAS 62 · R$ 87.710,77 (recalculou) · VENCIDAS 7 · R$ 20.346,54 (IGUAIS ✓)
clico PAGAS: card 26 → lista 26 ✓   ·   clico VENCIDAS: card 7 → lista 7 ✓
```

**REGRA 11 — 3 defeitos repostos, 1 vermelho cada:** o mês vazando pro estoque (vencida de agosto sumindo) · PAGAS sem recorte (voltando aos R$ 220 mil) · o mês pelo fuso do servidor.

### 📋 A VARREDURA DAS OUTRAS TELAS (14/09) — o que mudou e o que NÃO muda

| tela | o que mostra | classe | desfecho |
|---|---|---|---|
| **Contas a Pagar** | pagas · vencidas · a pagar | **misto** | ⭐ FEITO — pagas no mês, as duas abertas sempre |
| **Contas a Receber** | a receber · vencidas | **ESTOQUE (os dois)** | ⭐ **não ganha mês** — e o *"vencidas"* entrou na mesma fronteira: usava o MESMO `dueDate < now` de timestamp, e às 23h daria número diferente do Contas a Pagar ao lado |
| **Movimentações** (`/transacoes`) | linhas do extrato · **7.360 desde sempre** | FLUXO | ✅ **já abria no mês** (1º → hoje) desde o Sprint 3 — conferido, nada a fazer |
| **Pendentes** | 60 linhas a classificar | **FILA DE TRABALHO** | ⛔ **NUNCA ganha mês** — esconder pendente antigo é esconder trabalho, e foi assim que 21 notas ficaram invisíveis |
| **Posição de estoque · saldo das contas** | foto de agora | **ESTOQUE** | ⛔ não ganham filtro, por ordem do dono |

### ✅ AS DUAS REGISTRADAS FECHARAM (14/09) — uma de cada vez, cada uma com o seu red-then-green

**⭐⭐ 1. RECEBIMENTOS → "RECEBIDAS" abre no mês.** 123 conferências desde sempre viravam a lista; agora **80 em setembro**, com ‹ ›.

⚠️ **O recorte vai na CONFERÊNCIA, não na emissão:** `confirmadoEm` é *"quando eu recebi"* — o fato que aconteceu comigo. A `dataEmissao` é do FORNECEDOR, e **nota de agosto conferida em setembro é recebimento DE SETEMBRO**. Há teste com esse caso exato.

⛔⛔ **E A FILA NÃO ENTRA NISSO.** *"Na fila"* e *"pra depois"* são **TRABALHO PENDENTE**, a mesma classe dos Pendentes de classificação — recortá-los por mês esconderia a nota de agosto esperando conferência, e **foi assim que 21 notas ficaram invisíveis** (o F5 de 03/09). A trava mora na lib, não na tela, e o contrafactual (`fila` em 4 meses diferentes) é o que segura a régua.

**⭐⭐ 2. PF → LANÇAMENTOS abre no mês — e é A MESMA ESCOLHA do dashboard.** 499 desde sempre → **27 em setembro** (151 em agosto).

⭐ `useMesDoPerfil` (localStorage **por perfil**) faz *"uma escolha, duas telas"*: mudar o mês num lado muda no outro. ⛔ Não vai na URL porque são **rotas diferentes** — o link teria que carregar o parâmetro em toda navegação, e a primeira que esquecesse voltaria a divergir. ⚠️ E todo acesso ao storage é protegido: ele **lança** em aba anônima e com cookies bloqueados, e um throw ali derrubaria a tela por causa de uma preferência.

**⚠️⚠️ E O DASHBOARD PF USAVA O MÊS DO UTC:** `new Date().toISOString().slice(0,7)` — **no dia 1º às 00h30 de São Paulo ele abria no mês ANTERIOR**. Achado ao unificar; o `mesCorrente` resolve os dois de uma vez.

**PROVADO EM PROD, pela rota real:**
```
RECEBIMENTOS  (padrão) mês 2026-09 · recebidas  80 · FILA 6 ⭐
              ‹ agosto  mês 2026-08 · recebidas  43 · FILA 6 ⭐ (não muda)
PF LANÇAMENTOS  desde sempre 499 · setembro 27 · agosto 151
BUNDLE: navegador ✓ · "é a mesma escolha" ✓ · a frase da fila ✓
```

**⚠️⚠️ REGRA 11 — 4 defeitos repostos, e OS DOIS DO PF VIERAM VERDES.** Meus testes provavam a **régua** (`janelaDoMes`, `mesCorrente`) e ficaram verdes quando repus os defeitos **nas telas**: tirei o recorte do fetch dos Lançamentos e devolvi o mês UTC ao hook, e nada acusou. ***Guard que testa a lib aprova a tela que ignora a lib.*** O bloco novo pergunta pras TELAS e agora eles mordem.

⚠️ **E UM ERRO MEU NO CAMINHO, o mesmo de 13/09:** rodei `git checkout` num arquivo **não-commitado** pra desfazer a reposição e apaguei a edição de verdade junto. Reaplicada — e a suíte pegou (2 vermelhos) antes de virar deploy.

**9.821 verdes · TS 0 · deploy `EcpG5H1uXzJC-EmVfQ_jS` 4/4.**

**9.809 verdes · TS 0 · deploy `cTM4f16yZDDbIlirCzNvj` 4/4.**

### ⛔⛔⛔ O `?abrir=` NÃO ABRIA O CARD — E O DEFEITO ERA MEU, DO MESMO DIA (13/09)

**O dono, preso há 3 dias nos mesmos 2 casos:** *"clico 'casar conta' no pendente PJBANK 183,65 → a tela abre e o card do PJBANK NÃO ESTÁ — só o Casper de sempre."*

**⭐ MEDIDO COM OS DOIS IDS EXATOS DELE: a ROTA devolvia o card certo** (3 cards, o do PJBANK entre eles). **Quem o perdia era a TELA** — e a causa entrou no código **naquela mesma manhã**, comigo: eu dei `fornecedorId: ''` pro card da linha sem fornecedor reconhecido, e a fila usa o id do grupo como *"quem está aberto"*. Com `a && …`, **string vazia é FALSY**: o grupo abria e **se fechava no mesmo render**. O card estava na tela, sem nome e fechado.

**⭐⭐ O CONSERTO É UMA FUNÇÃO COM DONO (`identidadeDoCard`):** id **não-vazio e único por linha** (cada pagamento não reconhecido é o próprio grupo — juntá-los faria o ‹ anterior / próxima › passear entre pagamentos sem relação) e **nome = o TEXTO DA LINHA**. ⚠️ Não é inventar identidade: é mostrar **o que o banco escreveu**. *Cabeçalho em branco é um card que o dono não consegue nomear nem procurar.* E a fila passou a comparar `a !== null`, nunca `a &&` — cinto sobre o suspensório.

**⛔ O CONTRATO, escrito pelo dono:** *"`?abrir=<linha>` SEMPRE mostra o card daquela linha; se ela não tem candidata nenhuma, o card abre VAZIO dizendo 'nenhuma conta em aberto parece par desta linha · busca livre →'. **Deep-link que abre a tela sem o alvo é porta pintada na parede.**"*

**⛔⛔ E A PORTA DO OUTRO LADO ESTAVA PIOR:** o `?conta=` (o *"procurar no extrato"* do Contas a Pagar) **não ia no fetch da tela nem existia na rota** — o dono clicava na conta e caía numa Conciliação sem card nenhum. Agora a rota resolve as **linhas candidatas daquela conta** pelo MESMO `LINHA_DISPONIVEL_WHERE` e a mesma janela; não é um segundo matcher, é o recorte que alimenta o card que já existe.

**⛔⛔⛔ 2. A TABELA DE AGING SAIU DA TELA** — decisão do dono: *"meu negócio paga em DIAS, não carrego dívida de 90 dias — 100% sempre vai estar no 0-30. O card VENCIDAS já diz tudo, e clicar nele já filtra."* ⭐ **Móvel que mostra sempre a mesma coisa ocupa dobra e treina o dono a não olhar** (a régua que tirou o card de dupla contagem zerado da Conciliação). ⚠️ **O motor FICA** — `aging.ts` e a rota seguem vivos e testados pro dia em que ele vender com prazo longo. **Saiu a VITRINE, não a régua** — e o **fetch saiu junto**: dado que ninguém desenha é dado que alguém religa por descuido (a lição da conferência de saldo, 10/09).

**⛔ 3. O "R$ R$" ERA CLASSE, NÃO UM CANTO:** **13 ocorrências em 7 arquivos**. `formatBRL` usa `Intl` com `style:'currency'` e **já traz o cifrão**. ⚠️ O `totals-bar.tsx` documentava o bug desde a travessia e ele **renasceu em 6 telas** — *comentário não é guard*. Agora um guard varre `app/` e `components/`, ignorando comentário em bloco.

**PROVADO EM PROD, pelo caminho da tela (celular, sessão real):**
```
R$ 183,65 PJBANK  → card SIM · grupo "linha:cmtxpb1cd…" · nome "PJBANK PAGAMENTOS S.A."
                    oferece 180,00 "oficina" → diferença R$ 3,65 · OFERECE
R$ 111,21 MIXX    → card SIM · nome "MIXX PLAY - Pagamento"
                    oferece 109,00 "radio"   → diferença R$ 2,21 · OFERECE
?conta= isabel camera fria R$ 3.700,00 → 5 cards (a linha de R$ 3.700,00 entre eles)
CONTAS A PAGAR: "Análise de inadimplência" SUMIU ✓ · "0-30" SUMIU ✓ · "R$ R$" SUMIU ✓
```

**⚠️⚠️ REGRA 11 — 4 DEFEITOS REPOSTOS E **TRÊS VIERAM VERDES**, e a lição é a mesma de sempre com outra roupa:** o guard montava os cards **à mão** e testava a `agruparDTO` — repondo o `fornecedorId: ''` **na rota**, ele seguia verde. ***Guard que pergunta pro fixture em vez de perguntar a quem decide não prova nada.*** A decisão saiu pra `identidadeDoCard` e os três passaram a morder (2 · 1 · 1 vermelhos). ⚠️ E o guard do cifrão me pegou de volta: a 1ª versão limpava comentário **linha a linha** e acusou o `{/* … */}` de duas linhas que **documenta o próprio defeito**.

**9.800 verdes · TS 0 · deploy `S5aLScVIc8OkThnyEMcXm` 4/4.**

### ⛔⛔⛔ CONTAS A PAGAR — TRÊS STATUS, UMA RÉGUA, E A MAÇANETA À VISTA (13/09)

**⛔⛔ 1. "VENCE EM BREVE" MORREU COMO STATUS.** Decisão do dono: *"'Vence em 2 dias' é informação da COLUNA de vencimento, nunca um status/filtro/stat próprio."* ⭐ E como status ele fazia duas coisas erradas: era **SUBCONJUNTO de "a pagar"**, então a soma dos 4 cards (e o total do rodapé) contava a mesma conta **2×**; e o `3` era um número escolhido a dedo virando ESTADO — a família do `TETO = 25` hardcoded e do `30` da janela do "a vencer". **A informação não se perdeu**: virou `textoDoPrazo`, colado na data (*"14/09 · em 2d"*). O tipo tem 3 valores **por construção** — um `warn` novo não compila.

**⛔⛔⛔ 2. OS NÚMEROS DO TOPO BRIGAVAM — e a conta fecha AO CENTAVO.**
```
KPI VENCIDAS  34 · R$ 48.502,57   ← `dueDate < now`, um TIMESTAMP
AGING          9 · R$ 20.635,54   ← `bucketFor`, que compara por DIA
a diferença:  25 · R$ 27.867,03   ← as contas que vencem HOJE
9 + 25 = 34   ·   20.635,54 + 27.867,03 = 48.502,57
```
**Duas réguas pra mesma palavra** — e a lista tinha uma terceira (o preset "pagas" filtrava `status=RECONCILED` enquanto o card contava `paymentDate != null`).

⚠️⚠️ **E HAVIA UM SEGUNDO ERRO NO MESMO LUGAR: o servidor roda em UTC.** Às 23h12 de São Paulo o `new Date()` já diz **14/09** — então o dono, olhando à noite, via **25 contas vermelhas que ainda tinha o dia inteiro pra pagar**. É o mesmo fuso que fazia o card do cartão PF mentir 3 horas por dia (09/09).

⭐ **`lib/contas-pagar/escopo.ts` é o dono único:** `VENCIDA | A_PAGAR | PAGA`, pela fronteira do **dia do BRASIL**. Consumido pelos **stats**, pelo **aging**, pela **lista** e pelo **status visual** da tabela (`payableVisualStatus` virou casca — perdeu a régua própria). ⛔ **PAGA ganha de tudo**: paga com atraso não é vencida — não há ação pendente quando o dinheiro já saiu. ⚠️ E **A PAGAR carrega a sem-vencimento**, senão a soma dos três não fecha com o total.

**⭐⭐ E O NÚMERO É O FILTRO:** clicar no card manda o MESMO `escopo` que o servidor usou pra contar. ⚠️ Com `status: 'TODOS'` de propósito — deixar o filtro de status junto recortaria de novo por outra régua, que é como a lista mostrava "muito menos" do que o card dizia.

**⛔ 3. A MAÇANETA NA TABELA.** O dono: *"nenhuma linha tem 'procurar no extrato' à vista"*. Ele estava certo: o deep-link nasceu em 10/09 **dentro do menu ⋮**, o mesmo que não existir — a **7ª volta da "porta sem maçaneta"** e a lição de 30/08. Virou botão à vista em **VENCIDA** e em **PAGA** (toda paga desta tela é *paga-sem-vínculo*, pela decisão de 28/05); **não** aparece em A PAGAR, porque conta que não venceu não tem pagamento pra procurar. Mesmo deep-link, guard estrutural com auto-teste do detector.

**⭐⭐ E A CONCILIAÇÃO ENTROU NA MESMA FRONTEIRA** (*"as duas telas, uma verdade"*): o `resumirSemPar` usava `c.conta.data > agora`, o mesmo timestamp — às 23h ele e o Contas a Pagar dariam respostas diferentes pra mesma conta.

**PROVADO EM PROD, pela rota real:**
```
VENCIDAS   9 · R$  20.635,54     card diz   9 → lista tem   9 ✓
A PAGAR   87 · R$ 175.982,36     card diz  87 → lista tem  87 ✓
PAGAS    250 · R$ 220.353,76     card diz 250 → lista tem 250 ✓
INADIMPLÊNCIA 9 · R$ 20.635,54 → bate com o card VENCIDAS ✓
4º card "a vencer 3d" no payload: SUMIU ✓

BUNDLE: "Procurar no extrato" ✓ · "Vencidas" ✓ · "A pagar" ✓
        ⛔ "Vence em breve": SUMIU ✓ · "A vencer (3d)": SUMIU ✓
isabel camera fria R$ 3.700,00 → /conciliacao?conta=… → 200 ✓
```

**REGRA 11 — 5 defeitos repostos:** fronteira de volta ao timestamp (**4 vermelhos**) · fuso UTC no lugar do dia do Brasil (**5**) · PAGA deixando de ganhar de tudo (**2**) · maçaneta de volta pro menu ⋮ (**3**) · Conciliação com o timestamp (**1**).

**⚠️ 4 TESTES INVERTIDOS COM O MOTIVO ESCRITO:** os três que afirmavam `warn` como status, e o do `vencidasOnly` — que além do timestamp **atropelava o filtro de período** do dono (os dois escreviam em `where.dueDate`).

**9.787 verdes · TS 0 · deploys `tnQI9u_69G72Xfc9iNodF` e `VQqCVQcczykSC8yboN9fF`, os dois 4/4.**

### ⛔⛔⛔ OS 5 CASOS QUE NÃO APARECIAM PRA CASAR — E AS DUAS CAUSAS ERAM GERAIS (13/09)

**O dono trouxe 5 pagamentos reais, todos no extrato e invisíveis na fila.** A medição por id achou **duas causas de classe**, as duas maiores que o relato — e uma terceira que era só a maçaneta.

**⛔⛔ CAUSA 1 — BOLETO PAGO COM JUROS NUNCA ERA SUGERIDO.** Medido no `scoreMatch`: valor dentro de ±5% vale **25 pontos**; exato vale **50**. `FOCATTO 2.528,31 × 2.459,76` — **fornecedor EXATO**, descrição 81% parecida, 4 dias — soma **50 contra um corte de 70**. Ou seja: **o caso mais comum de conta vencida (boleto com juros/multa) era invisível por construção**, e isso explicava 4 dos 5.

⭐ **O conserto reusa o dono único dos degraus** (`avaliarDiferenca`, 12/09): quase-exato **com âncora de identidade** e dentro do **teto do gesto manual (10% da linha)** passa pelo corte, **em confiança BAIXA**. ⚠️ O score **não é inflado** — ele só deixa de ser filtro, exatamente como a porta do valor exato (09/09) e a da processadora (11/09).

⛔ **E o guard do falso-amigo continua barrando — isso foi MEDIDO, não suposto.** Repondo o defeito na condição nova a suíte ficou **verde**; ela só ficou vermelha ao remover o `continue` anterior (3 vermelhos). **Quem barra `aluguel caçula × DOCEOLI` é o guard de cima; a condição nova é cinto e suspensório**, e o comentário no código foi reescrito com essa verdade.

**⛔⛔ CAUSA 2 — 10 CONTAS EM ABERTO **SEM FORNECEDOR** (R$ 30.738,31) QUE NENHUM CARD ALCANÇAVA.** `oesa 1.759,44` · `oficina 180` · `radio 109` · `aluguel caçula 5.234` · fgts · inss · icms… Conta lançada à mão não tem FK, e **o card nasce de um fornecedor reconhecido** — era o débito registrado em 10/09 (*"sem fornecedor dos dois lados, o Find & Match não alcança"*) e nunca fechado.

⭐ O card passa a oferecê-las, e as três travas são o que separa isto do caça-níquel de 09/09: **só pela porta** (`?abrir=`, nunca na fila automática) · **nada pré-marcado** · **fora do atalho ⭐** (impossível por construção: `combinacoesQueFecham` só recebe as do fornecedor). ⚠️ E passam por uma **janela de VALOR**, não de data — sem nome, o tamanho é o único sinal, e despejar o FGTS de 8.072,17 numa linha de R$ 111,21 é a parede que o dono já recusou no "a vencer".

**⛔ CAUSA 3 — A PORTA EXISTIA E ESTAVA DENTRO DO MENU ⋮.** O dono: *"é onde eu estou quando quero casar; hoje só me oferecem categoria."* Ele estava certo: o deep-link nasceu em 10/09 **dentro do dropdown de 3 pontinhos**, que é o mesmo que não existir (a lição de 30/08 — *"ação escondida sem afordância não existe, principalmente no celular"*). Virou **botão à vista**, o MESMO deep-link.

**⭐⭐⭐ E O 5º CASO ERA OUTRA COISA: DUPLICATA DE CADASTRO POR SUFIXO SOCIETÁRIO.** `CIA DA FRUTA … LTDA` (sem CNPJ, MANUAL, 05/06) × `CIA DA FRUTA … EIRELI` (CNPJ 36603841000130, ESTOQUE_NF, 04/09) — a mesma empresa. As 2 contas abertas (**790,49 + 472,64 = 1.263,13, o valor EXATO da linha**) vivem na EIRELI, a linha empatava entre as duas e o reconhecedor devolvia **NULL** (trava certa: *"dois igualmente parecidos = não sei qual é"*).

⚠️⚠️ **É A FÁBRICA DOS 11 DUPLICADOS DE 11/09, E ELA NÃO TINHA FECHADO:** o fix daquele dia casa por nome **IDÊNTICO**, e `LTDA ≠ EIRELI`. A chave de identidade passou a **ignorar o sufixo societário no FIM do nome**. ⛔ **Não funde nada — é leitura**: os dois viram irmãos e o card oferece as contas dos dois. **Fundir cadastro segue sendo decisão do dono** (04/09).

**⭐⭐ A PROVA DA DÚVIDA VIROU TESTE PERMANENTE — e a resposta é NÃO.** `categorizar-nao-esconde-da-conciliacao.integration.test.ts` categoriza de verdade e roda as MESMAS funções da tela: a linha **continua disponível**, a conta **continua com sugestão**, o lote **não a perde**, e **só CONCILIAR a tira**. ⭐ Com o **contrafactual** da régua velha (`categoryId IS NULL`) — sem ele os outros quatro passariam verdes num mundo onde nada nunca filtrou por categoria. **Medido: não há caminho onde categoria esconde linha da fila.**

**PROVADO EM PROD, pela rota real (sessão de celular) — os 5, um a um:**
```
CIA DA FRUTA  1.263,13 → card ✓ · 790,49 ✓ + 472,64 ✓ marcadas  → diferença R$ 0,00 · FECHA ⭐
FOCATTO       2.528,31 → card ✓ · nota 2.459,76                  → diferença 68,55 · PERGUNTA
OESA          1.838,61 → card ✓ · [sem forn.] "oesa" 1.759,44    → diferença 79,17 · PERGUNTA
PJBANK          183,65 → card ✓ · [sem forn.] "oficina" 180,00   → diferença  3,65 · OFERECE
MIXX PLAY       111,21 → card ✓ · [sem forn.] "radio"  109,00    → diferença  2,21 · OFERECE

FILA: comSugestao 0 → 4      PENDENTES → 200 · botão "casar conta" à vista ✓
```

**REGRA 11 — 6 defeitos repostos, e TRÊS vieram VERDES**: (a) o `alguemDizQuemE` redundante (virou comentário com a medição, e o teste foi apontado pro `continue` que morde de verdade); (b) *"conta sem fornecedor nasce desmarcada"* não tinha ninguém conferindo → ganhou teste, e agora dá **2 vermelhos**; (c) *"não entra no atalho"* é **impossível por construção** — a asserção documenta, quem garante é a forma do código, e o comentário diz isso.

**⚠️ 1 TESTE INVERTIDO COM O MOTIVO ESCRITO:** o contrafactual do Cancian de 07/09 (*"sem os fornecedores o par SOME"*) — hoje ele aparece pela âncora `DESC_MUITO_SIMILAR`, **que o guard do falso-amigo já aceitava desde 11/09**. Entrou um teste novo provando que o falso-amigo continua barrado.

**9.759 verdes · TS 0 · deploys `WSgLTuKq5Z8Ppr6cHR8DS`, `-oKEfZvr4uZvc_uEx5Wkr` e `3TH4N984JQIEQkDgScHBU`, os três 4/4.**

### ✅ A CIA DA FRUTA FOI MESCLADA (13/09, autorizada pelo dono)

`pg_dump pre-mescla-cia-da-fruta-20260913-222443` (6,1 MB) antes; preview → aplicar, o protocolo dos 11 de 11/09.

**⚠️⚠️ E O SCRIPT PRECISOU DA MESMA CHAVE DA LEITURA — REGRA 4, que mordeu de verdade.** O `mesclar-fornecedores-duplicados.ts` tinha régua PRÓPRIA casando por nome **IDÊNTICO**, e foi por isso que a CIA DA FRUTA **escapou da rodada de 11/09**. Ele passou a importar `chaveDeIdentidadeDoFornecedor` da lib: *duas réguas de "é o mesmo fornecedor?" — uma na leitura, outra na mescla — é o caminho pro card tratar dois cadastros como um e a mescla se recusar a juntá-los.*

⭐ **E o rastro diz a VERDADE do que casou** — `"mesmo nome, sufixo societário diferente"`, não `"nome idêntico"`, que seria falso aqui.

**CONFERIDO DEPOIS:**
```
LTDA  [fs6zaj] ativo=false · 0 tx · rastro: mesclado em …z78jix39 (mesmo nome, sufixo societário diferente)
EIRELI[8jix39] ativo=true  · 10 tx        seletor: 70 → 69 ativos · órfãs: 0
a linha de 1.263,13 → reconhece a EIRELI direto (irmãos: 1)
⭐ e ela JÁ PAGA as duas: 790,49 + 472,64 = R$ 1.263,13 — soma exata, conciliadas pelo card
```

**⭐⭐ E A CHAVE NOVA FEZ APARECER UM SEGUNDO PAR — que a trava de 04/09 RECUSOU, corretamente:** `TOZZO ALIMENTOS` tem dois cadastros com **CNPJs diferentes** (`01314317000165` × `01314317000599` — mesma raiz, filial diferente). ⛔ *"Matriz e filial têm o mesmo nome"*: **não mescla**, e o script diz por quê. É a régua funcionando no primeiro caso que ela encontrou depois de ficar mais larga.

### ✅ A FÁBRICA NA ESCRITA FECHOU (13/09, autorizada pelo dono)

*"A ponte passa a procurar pela MESMA `chaveDeIdentidadeDoFornecedor` da leitura (sufixo societário fora), com as regras de 11/09 intactas."* **Uma régua, os dois lados** — `chaveDoNomeDoFornecedor` virou casca sobre a da leitura, e o POST manual (409-apontando + escape `permitirNomeDuplicado`) herda de graça.

**AS TRÊS REGRAS DE 11/09, INTACTAS E COM TESTE:** achou **sem CNPJ** → completa com o da SEFAZ e reusa · achou com o **MESMO CNPJ** → reusa · achou com **CNPJ DIFERENTE** → **cria** (matriz e filial têm o mesmo nome — a régua de 04/09 na origem).

**⭐⭐ E A TROCA FOI MEDIDA ANTES, contra os 69 cadastros reais** — porque isto é caminho de **ESCRITA** e a chave da leitura é agressiva de propósito (nasceu pra descrição de banco: corta `- Pagamento`, `| Pix`, datas e códigos no fim):
```
chave VELHA → 1 grupo com 2+ cadastros     chave NOVA → 1 grupo (o MESMO)
grupos que só a chave nova junta: 1 — o TOZZO, e a trava do CNPJ o RECUSA
```
**Zero colisão nova na base real.** ⚠️ O risco fica nomeado: fornecedor cujo nome TERMINE numa dessas palavras (`ALFA TED` → `alfa`) — não existe hoje, e o escape é o `permitirNomeDuplicado`.

**⚠️⚠️ E O GUARD DE 11/09 PEGOU UMA REGRESSÃO REAL NO CAMINHO.** Ao delegar, o teste do `DISTRIB. DE PROD. ALIMENT. LAMANA` ficou **vermelho**: `normalizeForMatch` só limpa pontuação **no FIM**, enquanto a régua da ponte já trocava **toda** pontuação por espaço desde 11/09 — e a **LAMANA é uma das 11 mescladas naquele dia**. Sem isso ela duplicaria de novo. ⭐ A chave compartilhada passou a colapsar pontuação interna, **o que deixa a LEITURA mais forte também**: até hoje o card tratava `DISTRIB. DE PROD.` e `DISTRIB DE PROD` como dois fornecedores.

**PROVADO EM PROD, contra os cadastros REAIS (read-only):**
```
"CIA DA FRUTA … LTDA" [36603841000130] → ⭐ REUSA a EIRELI (CNPJ)   ← a NF-e de amanhã
"TOZZO ALIMENTOS EIRELI" [01314317000599] → REUSA o cadastro da filial (CNPJ)
69 ativos · nomes que ainda aparecem 2×: 1 (o TOZZO — matriz + filial, por desenho)
```

**REGRA 11 — 3 defeitos repostos:** chave crua de volta na ponte (**3 vermelhos**) · pontuação interna sem colapsar, o caso LAMANA (**2**) · trava do CNPJ diferente caindo, fundindo matriz com filial (**1**).

⚠️ **RESÍDUO NOMEADO (medido, não consertado):** documento **SEM CNPJ** ao lado de um cadastro **COM CNPJ** ainda **cria** um segundo registro — o `semCnpj` procura cadastro sem CNPJ, e ali não há. **Não morde na NF-e** (documento fiscal sempre traz `emitCnpj`); morde só na **entrada manual** sem CNPJ digitado, que usa o mesmo `resolverFornecedor`. Reusar ali significaria **amarrar a compra a um CNPJ que o documento não declarou** — a direção conservadora é a que está no código. Fica registrado pro dia em que ele quiser decidir.

**9.768 verdes · TS 0 · deploy `U_bX3oIyb2ewqcYQtRBbC` 4/4.**



### ⭐⭐⭐ NOTA SEM VENCIMENTO VIRA CONTA A PAGAR — as 21 do F5 ganharam gesto (13/09)

**A história, nas palavras do dono:** *"no começo a conferência não tinha onde pôr vencimento; notas entraram só como estoque."* O **F5** conta o estrago desde 03/09: **21 notas · R$ 8.588,75** que passaram pelo estoque e nunca chegaram ao Contas a Pagar.

**⭐ MEDIDO EM PROD ANTES DE CODAR — e o dado apertou o desenho:** as **21 são sem duplicata NENHUMA no XML** (0 com duplicata). Não é boleto perdido: é nota de pix/dinheiro que entrou calada.

**O CASO QUE FECHA A CONTA (a régua do dono):** a linha da stone de **R$ 2.843,35 (08/09)** paga **6 notas** da MARIA LUIZA — 2 com conta (518,87 + 967,63 = **1.486,50**) e **4 invisíveis** (463,74 · 326,69 · 235,16 · 331,28 = **1.356,87**). **A diferença que o card não fechava eram exatamente elas.**

**⭐⭐ 1. O GESTO (`lib/stock/ponte/definir-parcelas.ts`) — ORQUESTRADOR, NÃO MOTOR NOVO.** Ele costura dois donos que já existiam: `salvarCombinado` (29/08 — dono de *"o que a gente combinou pagar"*, que já refaz a fila de sugestão na mesma transação) e `enviarParaContasPagar` (24/08 — **a única porta** que cria conta no financeiro). ⛔ Escrever a gravação aqui seria a segunda porta, que é o que o `@@unique` do `stock_payable_link` existe pra recusar.

⚠️ **Duas transações, de propósito, e o estado do meio é VISÍVEL:** se as parcelas gravarem e o envio falhar, a nota fica **na fila de envio** (o card de 30/08) — estado legítimo e à vista, não um buraco. Enfiar o envio na transação do combinado faria um fornecedor recusado **apagar as parcelas que o dono acabou de digitar**.

⚠️ **E a soma que não fecha AVISA, não trava** (a régua do combinado): boleto com juros embutido é o mundo real, e travar empurraria o dono a lançar por fora — que é literalmente o que produziu estas 21. Passa com o motivo escrito.

**⭐⭐ 2. O RECIBO PAROU DE FICAR MUDO — estado `A_DEFINIR`.** `combinadoDaNota` responde *"quais parcelas VALEM hoje"*, e parcela sem data **não vale** (não pode virar conta a pagar; `dueDate` alimenta fluxo de caixa e DRE). Resultado: a nota sem vencimento devolvia **lista vazia** e o recibo não mostrava nada — justamente onde havia dívida. **Vazio não é "não deve nada".** ⛔ E não nasceu um terceiro leitor: quem responde *"o que está sem data"* é o `parcelasSemData`, dono da pergunta desde 03/09 — o mesmo que alimenta o F5. ⚠️ O selo é **ÂMBAR, não cinza**: "a definir" é trabalho pendente, não informação neutra.

**⭐ 3. A FILA DAS 21 (o F5 virando TELA).** Lista em Recebimentos: fornecedor · nº · total · data de entrada, **cada linha abrindo o recibo**. ⛔⛔ E ela é a metade que faltava do card: o card já dizia *"N notas sem data"* desde 04/09 e levava pra uma tela que **não listava nenhuma** — o dono via o número e não tinha por onde começar. **É a 6ª volta da "porta sem maçaneta", do outro lado.** ⚠️ Nota sem conferência aparece **cinza dizendo o porquê**, nunca como link morto.

**⛔⛔ 4. A PORTA FECHA PRO FUTURO.** Nota sem duplicata no XML **não confirma sem resposta**: ou o dono digita o(s) vencimento(s), ou marca **"sem data — defino depois"**. O estado final é o mesmo de antes (A DEFINIR); o que muda é que ele virou **ESCOLHA**. Nas palavras do dono: ***"o silêncio era a fábrica dessas 21"***.

⚠️ **A trava mora no SERVIDOR**, não num diálogo de tela — a régua do FREIO da contagem (23/08): aviso que vive no componente some no dia em que a rota for chamada por outro caminho, **e foi por outro caminho que estas 21 entraram**. O botão desabilitado e o rótulo *"Diga como esta nota vai ser paga"* são UX; a recusa é do `confirmarConferencia`.

**PROVADO EM PROD, pelo caminho da tela (sessão real, celular):**
```
ROTA DA FILA → 21 notas sem vencimento · R$ 8.588,75 · com link pro recibo: 21 de 21
MARIA LUIZA na fila: 5 notas · R$ 1.852,69

PREVIEW das 4 (confirmar:false — NADA gravado):
  NF 68770459 · 463,74 → 200 · fecha com a nota ✓   NF 68815521 · 326,69 → 200 ✓
  NF 68824809 · 235,16 → 200 ✓                      NF 68850297 · 331,28 → 200 ✓
  as 4 somam 1.356,87  +  as 2 que já têm conta 1.486,50  =  2.843,37
  × a linha da stone 2.843,35 → diferença R$ 0,02  ⭐ dentro do degrau FECHA
  a fila continua 21 · ⛔ nada gravado

RECEBIMENTOS → 200 · "notas entraram sem vencimento" ✓ · "não viraram conta a pagar e não
               aparecem no fluxo de caixa" ✓ · "confira a nota primeiro" ✓
RECIBO       → 200 · "Definir parcelas e vencimentos" ✓ · A_DEFINIR ✓
CONFERÊNCIA  → 200 · "defino depois" ✓ · "Diga como esta nota vai ser paga" ✓
               ⛔ a frase passiva antiga ("ou deixe a definir"): SUMIU ✓
```

**REGRA 11 — 4 defeitos repostos:** recibo mudo na nota sem data (**1**) · a porta somindo (**2**) · o gesto renegociando por cima (**1**) · **e o D4 ficou VERDE** — dava pra apagar a resolução do `conferenceId` e a fila continuava listando o trabalho **sem jeito de alcançá-lo**. Ganhou teste próprio; é a mesma família da porta sem maçaneta.

**⚠️ 1 BLOCO DE TESTE INVERTIDO COM O MOTIVO ESCRITO:** ele afirmava *"sem preencher, o caminho de ontem continua"* — e o caminho de ontem é o que produziu as 21.

**⚠️ E A ORDEM DAS TRAVAS FICA REGISTRADA:** a porta do pagamento roda **antes** da validação de item (que vive dentro da transação), então nota com fator errado responde primeiro sobre o pagamento. Três fixtures de unidade passaram a mandar `semDataDefinirDepois` — o assunto delas é unidade, e a resposta honesta ali é *"defino depois"*.

**9.742 verdes · TS 0 · deploy `VbCxzTmVLJnbtXKGFcBW8` 4/4.**

**⛔ PENDENTE E É DO DONO — as 4 datas.** O preview fecha, mas **o vencimento é o do boleto, que está na mão dele** — e este módulo não inventa data (*"sem documento, quem sabe é o dono"*). As 4 esperam o clique em `Definir parcelas e vencimentos`; com as contas nascidas, o card da Maria Luiza passa a oferecer as 6 notas e a linha de 2.843,35 crava.

### ⭐⭐ PF — ESPINHA DE NAVEGAÇÃO, WIDGET DE CONTAS E O GRID POR HIERARQUIA (13/09)

**Deploy `Dn6OBbAu6bPFYc7oMZs_f` 4/4.** Quatro frentes numa: navegação, a porta do dado, a ordem dos cards e dois defeitos do print.

**⛔⛔ 1. A ESPINHA — e NÃO nasceu uma segunda sidebar: a que existe FOI LIMPA.** O PF tinha **9 itens**, e entre eles um **"Mês" apontando pro redirect que morreu no mesmo dia**, **DOIS** caminhos pro mesmo import (*"Extrato da conta"* e *"Importar extrato"*) e **TRÊS** formas de ver lançamento (*Despesas · Receitas · Movimentações*). ⭐ Ficou: **Meu Dinheiro · Contas · Cartões · Lançamentos · Relatórios**. *Menu com três portas pra mesma sala é o B1 em forma de navegação — e uma sidebar nova ao lado desta seria a quarta.*

**⛔⛔ E O QUE SAIU DO MENU NÃO FICOU ÓRFÃO.** `Despesas` e `Receitas` são telas VIVAS e **nada mais apontava pra elas** — eu ia criar a **6ª volta da porta sem maçaneta com as minhas próprias mãos**. Passaram a ser alcançadas **do topo de Lançamentos**, com botão à vista.

**⚠️⚠️ E ISSO ABRIU UMA TENSÃO COM O SPRINT DE 02/07, que fica registrada:** naquele dia Despesas ganhou *"lugar próprio no workspace PF"* **porque o gesto estava enterrado** dentro de `/transacoes`. Hoje ela voltou pra lá — mas **o defeito de 02/07 era o gesto enterrado SEM CAMINHO VISÍVEL**, e agora ele é um botão no topo. Os dois guards daquele sprint foram **reapontados** (de *"o item está no menu"* pra *"a tela está alcançável"*), com o porquê escrito nos dois.

**⭐ 2. BOTTOM-NAV no celular** (Início · Lançamentos · **＋** · Cartões · Contas). ⛔ **O FAB solto SAIU** — virou o **＋ central**: dois botões de lançar na mesma tela seriam dois gestos pra uma coisa só, e o de baixo cobriria o outro. **O modal é o mesmo.**

**⭐⭐ 3. O WIDGET "MINHAS CONTAS" na home, com "↑ extrato" POR CONTA.** *"A porta de entrada do dado ficou fora da home"* — e ele tem razão: o gesto que **alimenta o dashboard inteiro** vivia numa tela de cadastro, a dois cliques de onde ele olha os números. A **conferência** aparece ali (a casa dela desde 10/09), incluindo o *"nunca conferida"*.

**⭐ 4. O GRID PELA RÉGUA DELE:** *"quem AGE fica em cima (contas/cartões/vencer); quem ANALISA fica embaixo (donut/balanço)"*. E o **recebido da empresa virou FAIXA FINA** — *"é selo, não bloco gigante"*: ele ocupava um card do tamanho do donut pra dizer um número.

**⛔⛔ 5. OS DOIS DEFEITOS DO PRINT:** a pílula do "a vencer" dizia **"HOJE"** em fatura de **4 dias atrás** — *pílula que mente a data ensina a ignorar a pílula*. Agora mostra **a data do vencimento sempre**, em coral quando atrasada, e **"HOJE" só quando vence hoje de verdade**. E a data tem **um formato só**: `09/09`, nunca `9/09`.

**PROVADO EM PROD, no bundle e pela rota:**
```
espinha ✓ · bottom-nav ✓ · widget Minhas contas ✓ · ↑ extrato por conta ✓
faixa da empresa ✓ · grid de 12 ✓ · FAB solto: SUMIU ✓
[09 SET] fatura magazine luiza — atrasada 4d      selos: venceu 09/09 · venceu 10/09
[10 SET] fatura banrisul — atrasada 3d            L1 saldo/fluxo/CONTAS · L2 faixa
[15 SET] fatura nubank — estimada                 L3 donut/balanço(6m) · L4 cartões/(vencer+últimos)
/contas → 200 (viva pela espinha) · /transacoes → 200
```

**⚠️ QUATRO GUARDS REAPONTADOS, nenhum apagado** — e um deles me pegou de novo com **janela de ±400 caracteres**: ele quebrou **com a tela CERTA** quando os 5 itens viraram um fragmento único. *O que define o bloco é a ESTRUTURA, não a distância* (a lição do detector de rastro, 12/09). ⭐ E o guard de vazamento do menu ficou **mais afiado**: ele casava por **label**, e *"Relatórios"* do perfil colidia com *"Relatórios"* da empresa — **dois destinos, o mesmo nome**. Agora a régua é o **destino**: `@sempre` **nunca** aponta pra rota de `/empresas/`.

**REGRA 11 — 4 defeitos repostos, todos vermelhos.** **9.714 verdes · TS 0.**

### ⛔⛔ O DESKTOP ERA O CELULAR ESTICADO — O COCKPIT (13/09)

**O dono, no MacBook:** *"o mock era MOBILE e o desktop ficou uma coluna de 480px boiando no meio do monitor."* Virou a **REGRA 12** da casa (acima).

**O DESENHO:** barra fina de página (título · ‹ mês › · olhinho · **＋ Novo lançamento**) e **grid de 12 colunas, 1200px**: linha 1 `saldo · fluxo · empresa` (o hero gradiente vira **card roxo**, não banner), linha 2 `donut grande · balanço de 6 meses`, linha 3 `cartões · (a vencer + últimos)`. ⚠️ **O FAB flutuante fica só no celular** — é gesto de polegar; no mouse ele vira botão de barra, **com o MESMO campo de frase**.

**⭐⭐ FONTE ÚNICA DE WIDGET:** os 8 widgets moram em `widgets-pf.tsx` e são **os mesmos objetos** nas duas composições — o guard conta e exige **exatamente 2 usos** de cada. ⛔ E ele proíbe a composição redesenhar widget por conta própria (o donut na mão, a barra de limite na mão): seria o começo de duas telas divergentes.

**⭐ O BALANÇO É 6 MESES NO MONITOR E 4 NO BOLSO — e quem corta é a TELA**, não uma segunda consulta: o payload é o mesmo, senão o mesmo mês teria dois números dependendo do aparelho.

**⚠️ AS DUAS COMPOSIÇÕES VIVEM NO DOM e o CSS escolhe** (`lg:hidden` × `hidden lg:block`). Escolher por JS exigiria a largura no 1º render — que **no servidor não existe**: daria hydration mismatch, ou o app piscando o layout errado antes de trocar.

**⚠️ E O `hover` É `lg:` DE PROPÓSITO:** no toque o `:hover` **GRUDA** — o card fica com a sombra levantada depois do dedo sair, parecendo selecionado. Desktop tem mouse; celular não.

**⚠️⚠️ O MEU PRÓPRIO GUARD ACHOU UM DEFEITO DE DESENHO MEU:** eu tinha posto o *"a vencer"* na coluna 3 quando não há recebimento da empresa, **pra não deixar buraco** — e com isso o widget aparecia **duas vezes na mesma composição**. *Tapar buraco duplicando widget é o começo de duas telas divergentes.* **Quem se adapta é a LINHA**: sem a empresa, saldo e fluxo dividem as 12 colunas.

**⚠️⚠️ E A REGRA 11 ME PEGOU DUAS VEZES NO GUARD NOVO:** (a) o detector de largura fixa acusava os **próprios containers do grid**, porque `\b` casa **depois do hífen** de `max-w-[…]`; (b) o teste dos "3 lado a lado" **contava `col-span-`** — e **`col-span-12` casava**, então com os três cards empilhados (que É o defeito) ele ficava **verde**. Largura cheia num grid de 12 é o oposto de lado a lado. ⭐ E numa terceira volta ele quebrou por medir a LETRA (`col-span-4`) quando a classe virou variável, com a tela CERTA — *guard que mede texto e não composição vira falso vermelho no primeiro refactor legítimo*.

**REGRA 11 — 5 defeitos repostos, todos vermelhos:** o desktop virando a coluna de 480px (**4**) · a linha 1 empilhada (**1**) · o cockpit redesenhando o donut (**2**) · o hover vazando pro toque (**1**) · a faixa do tablet sumindo (**1**).

⚠️ **E dois guards anteriores foram REAPONTADOS, não afrouxados:** o do mock (os tokens se mudaram pro módulo de widgets) e o de "zero widget sem dado" — que agora mede a trava **DENTRO do widget**, e isso é **mais forte**: com duas composições, a trava na composição teria que ser lembrada duas vezes, e a segunda é a que alguém esquece.

**9.704 verdes · TS 0 · deploy `8sYjYGPJZRHYlyhvUXLAp` 4/4.**

### ⭐⭐⭐ PF — DASHBOARD "MEU DINHEIRO" + LANÇAMENTO POR FRASE (13/09)

**Mock versionado** em `docs/mocks/pf-dashboard-mock.html`, com guard que **lê o HTML** e compara token a token (o protocolo da Conciliação). Deploy `pW6SzxKDdLJQtOK3SF_va` 4/4.

**⭐ A ROTA DECIDIDA (o dono pediu pra eu escolher e dizer): o dashboard É `/perfis/[id]`, a HOME.** É onde ele cai ao entrar no workspace pessoal; pôr num endereço próprio deixaria a home velha viva ao lado, e *"qual é a tela do meu dinheiro?"* teria duas respostas. ⛔ **E `/perfis/[id]/mes` MORREU** — virou redirect. *"NUNCA dois painéis"* é ordem dele, e dois painéis do mesmo mês divergem na primeira régua nova.

**⭐⭐ FONTE ÚNICA, literal:** `montarDashboard` **não recalcula** ENTROU/SAIU/SOBROU — chama a MESMA `painelDoMes`, **e cada mês do balanço também**. O teste que morde compara o topo com o mês atual do balanço e exige igualdade.

**AS RÉGUAS DE HONESTIDADE, todas travadas:** previsto = saldo − **faturas conhecidas** (⛔ zero projeção de gasto inventado) · **cartão sem limite não ganha barra** · *"sem categoria"* tem **fatia própria em âmbar** (enterrá-la em "outras" esconderia o que pede ação) · pagamento de fatura **fora do SAIU** · o **olhinho esconde TODOS os números**, não só o hero · **zero widget sem dado** (investimento/metas/recorrentes não existem nem cinza).

**⭐⭐ LANÇAMENTO POR FRASE:** *"mercado 280,50"* · *"gastei 45 na farmácia"* · *"recebi 500 pix"* viram lançamento com a categoria sugerida pelas regras **DO PERFIL**. ⛔⛔ **SEM VALOR, SEM LANÇAMENTO** — descrição a gente deduz, sentido a gente deduz, **valor não**: um valor chutado é dinheiro errado no extrato dele, e o erro só aparece no fim do mês. ⚠️ **`1.280,50` não é R$ 1,28** — o ponto é milhar em pt-BR, a mesma armadilha que o campo de quantidade do estoque pagou em 08/09. Trocar a categoria **ENSINA** a regra.

**PROVADO EM PROD, navegando como celular:**
```
/perfis/<id> → 200      /perfis/<id>/mes → 307 → a home  ⭐ morreu
SETEMBRO  saldo 71.609,96 · previsto 42.315,32 (3 faturas)
   banrisul 18.593,16 [VENCIDA] 24% do limite · nubank 6.210,30 [ABERTA] 44%
   magalu 4.491,18 [VENCIDA] 69% · a vencer: 3, duas atrasadas + 1 estimada
   balanço jun 61k/22k · jul 72k/22k · ago 35k/35k · set* 38k/38k
AGOSTO    tudo recalcula (35.098,26) · o balanço anda pra mai-ago
FRASES    "mercado 280,50" → SAIDA 280,50 "Mercado"
          "gastei 45 na farmácia" → SAIDA 45,00 "Farmácia"
          "recebi 500 pix" → ENTRADA 500,00 "Pix"
          "almoço com a Daniela" → montou:false "não achei o valor" ⭐ não trava
```

**⚠️⚠️ DOIS ACHADOS NO DADO REAL, pro dono saber:**
1. **RECEITAS == DESPESAS e SOBROU R$ 0,00 em TODOS os meses.** Não é bug: **toda ponte PJ→PF cria o par** crédito *"Distribuição de Lucros"* + débito *"yussef gastos"* (o fluxo A/B *"já gastei esse dinheiro"*, de 10/08). O dinheiro entra e sai no mesmo gesto, então o PF nunca "sobra". ⭐ Quando o extrato da conta entrar, os gastos REAIS aparecem e o número passa a significar alguma coisa.
2. **"Recebido da empresa" conta 6 transferências em setembro, não 3** — as 3 que o dono cita mais outras com ponte no mesmo mês. O widget soma **todo crédito com ponte**, que é o que ele pediu.

⚠️ **E o guard de contrato de 27/08 foi REAPONTADO, não apagado** (a home mudou; a lição — *contrato quebrado dá silêncio* — não). O alvo novo expôs **duas cegueiras dele**: via só `fetch` cru (o dashboard usa `fetchJson`) e cortava o payload em **400 caracteres**, enxergando só o `{erro}` do 404. Os dois consertados.

**REGRA 11 — 5 defeitos repostos, todos vermelhos.** **9.688 verdes · TS 0.**

📋 **ROADMAP REGISTRADO, NÃO CONSTRUÍDO** (ordem do dono): **Fase 2** recorrentes + orçamento por categoria → é o que destrava a projeção estilo Meu Assessor na pílula do hero (*"contas fixas + média dos meses = o mês que vem já tem número"*). **Fase 3** o assessor por **WhatsApp** (lançar por mensagem/áudio, *"quanto gastei?"*, alerta de fatura — e falando PJ também: *"quanto a Caçula vendeu hoje?"*) — **visão, não item de sprint**: WhatsApp Business API é projeto próprio.

### ⛔⛔⛔ O GESTO SÓ EXISTIA POR ROTA — 5ª VOLTA DA "PORTA SEM MAÇANETA" (13/09)

**O dono, no celular:** *"o import de extrato existe (você provou pela rota: 3 casadas, 2 novas, aprender-na-conta) mas **NÃO TEM BOTÃO NA TELA**. Estou em /perfis/[id] → Contas bancárias: os 3 cards e 'Nova conta' — nenhum 'importar extrato' em card nenhum."*

**Ele estava certo, e o card era pior do que o relato:** um `<Card>` **MORTO** — sem botão, sem link, **sem nem responder ao toque**. O motor estava em prod, provado pela rota, e **inalcançável**. ⚠️ **Eu tinha posto o gesto na SIDEBAR e chamado de feito** — mas o dono não estava na sidebar, estava na **lista de contas**, que é onde a pergunta nasce.

**⭐⭐ A FAMÍLIA INTEIRA, agora com cinco voltas:** (1) 10/09 o card da conciliação nascia colapsado · (2) 10/09 o motor subiu e a tela não mudou · (3) 12/09 a porta do cardápio sumia quando a fila zerava · (4) 12/09 o produto individual nunca teve o gesto · **(5) hoje: o gesto só existia por rota**. ⭐ **A regra que fecha as cinco:** *se o motor está em prod, o dedo do dono tem que alcançar ele **a partir de onde ele ESTÁ*** — e não de onde eu achei natural pôr o link.

**O QUE FICOU:** o card ganha **"Importar extrato (OFX)"** apontando pra **aquela** conta (`?conta=`), a **conferência aparece ali** (a casa dela desde 10/09 — inclusive o *"nunca conferida"*, que não é defeito, é informação antes presumida), e a tela do extrato **abre falando daquela conta** (saldo, conferência, e se ela já tem identidade pra trava morder). ⚠️ E ela **não sobrescreve** a escolha que veio do card — perder no caminho a informação que a tela acabou de mostrar é obrigar o dono a escolher de novo.

**⚠️⚠️ E A PRIMEIRA PROVA FALHOU POR MÉTODO MEU, não por defeito:** eu conferi o **HTML servido** e deu *"⛔ o botão não está no card"* — a tela é **client-side**, os cards nascem do `fetch` e **não existem no primeiro paint**. A prova certa é o **BUNDLE que prod serve**, como em 10/09. *Medir no lugar errado dá um vermelho tão convincente quanto um defeito real.*

**PROVADO NO BUNDLE, navegando como celular:**
```
PAGE /perfis/<id>/contas → 200 · bundle 856 KB
   "Importar extrato (OFX)" ✓ · /extrato?conta= ✓ · "nunca conferida" ✓
   "confere com o banco" ✓ · "difere do banco em" ✓ · "Ver o mês" ✓
TOCO o botão → /extrato?conta=<banrisul> → 200 · bundle 821 KB
   lê ?conta= ✓ · "casam, não duplicam" ✓ · "de fatura reconhecido" ✓
   o aprender-na-conta ✓ · "sem identificação ainda" ✓
SUBO O OFX pela rota da tela:
   ⭐ CASADAS na ponte: 3 (10.000 · 3.500 · 21.000)
   ⭐ NOVAS: 2 · fatura encontrada: banrisul · aprender: {"041","0605534106"}
```
⛔ **Não confirmei** — a gravação é o clique do dono.

**O GUARD (`gesto-existe-na-tela-pf.test.ts`) PROVA OS DOIS LADOS:** o card não pode voltar a ser morto, o link não pode virar decorativo — **e as rotas por trás têm que EXISTIR e exigir o dono do perfil**. ⚠️ Guard que só olhasse a TELA aprovaria um botão apontando pro nada, que é o mesmo defeito de cabeça pra baixo. **REGRA 11 — 3 defeitos repostos, todos vermelhos. 9.596 verdes · TS 0 · deploy `jE1B8cwx9E6PiXW_cT6QO` 4/4.**

### ⭐⭐⭐ PF FASE 1 EM PROD (13/09) — EXTRATO DA CONTA · CASAMENTO COM A PONTE · PAINEL DO MÊS

**O desenho veio da investigação, item por item.** `pg_dump pre-pf-fase1-20260913-022651` (6,0 MB) antes da migration; deploy `p19qaHOzNljwql1pV37WX` 4/4.

**⭐⭐ O CASAMENTO É O CORAÇÃO — régua confirmada pelo dono:** *"a linha do extrato é o FATO, a tx da ponte é o REGISTRO do mesmo fato — o import CASA com a ponte existente, NUNCA cria segunda."*

**⛔⛔ E ELE NÃO PODE OLHAR O TEXTO.** A ponte diz *"Distribuição de Lucros caçula"* (as palavras do dono) e o banco dirá *"PIX RECEBIDO…"* — **o mesmo fato com dois nomes**. Casar por memo não casaria NADA. A régua é **data ±2d + valor exato + sentido**, e é estreita justamente porque não há texto pra desempatar. **Duas camadas:** identidade (`stableKey`, pro re-import) e o fato (a janela larga, só pra quem **não** tem `dedupHash`). ⚠️ **Dois candidatos = AMBÍGUA**, e o sistema não escolhe — casar com o errado amarraria a categoria de um gasto no outro.

**A TRAVA NASCEU JUNTO, como o dono exigiu.** O 1º import **propõe gravar `bankCode`/`accountNumber`** (o arquivo já diz quem é a conta) e a partir daí `verifyOfxMatchesAccount` morde. Teste prova: com a conta já identificada, um OFX do Sicredi na conta do Banrisul **bloqueia** com `OFX_BANK_MISMATCH`.

**ORQUESTRADOR FINO:** reusa `parseOFX` · `stableKey` · `resolveBankProfile` · `partitionFutureLines` — **zero gatilho de vendas/DRE/conciliação**, que não existem no PF. ⚠️ E **sem âncora no arquivo não se descarta nada**: o relógio não decide (a régua de 13/08).

**⭐ ITEM 2a JUNTO:** pagamento de fatura casa por **valor EXATO + janela do vencimento**, o cartão vira **paga ✓** sozinho, e **APRENDE a conta de pagamento no 1º casamento** (*"aprende, não pede cadastro antes"*). ⛔ **Cartão INATIVO nunca é candidato** — o perfil tem um `banrisul pf ****9113` **vazio e inativo** ao lado do `banrisul ****9113` com 277 transações; casar pelos 4 dígitos escolheria o morto. **Não houve mescla: não há o que absorver** (0 faturas, 0 tx, 0 imports).

**⭐ PAINEL DO MÊS:** ENTROU · SAIU · SOBROU + barras por categoria + contas com conferência + cartões. ⛔⛔ **O PAGAMENTO DE FATURA FICA FORA DO SAIU** — senão a mesma despesa conta **duas vezes** (a compra no mês em que foi feita, a fatura no mês em que foi paga) — e **aparece nomeado**, porque exclusão escondida é tão ruim quanto exclusão nenhuma (a régua do Fluxo da PJ, 25/08).

**PROVADO EM PROD, pelo motor real (preview, nada gravado):**
```
PAGE /mes · /extrato · /cartoes → 200
PAINEL 09/2026: ENTROU 38.090,00 · SAIU 38.090,00 · SOBROU 0,00 · 13 lançamentos
   yussef gastos 31.000 · nura 3.590 · Daniela 3.500 · sem categoria: 0
   ⭐ 1 pagamento de fatura FORA do SAIU

O OFX do banrisul PF com os 3 créditos da empresa:
   ⭐⭐ CASADAS: 3 — "já registrado como dinheiro vindo da empresa (ponte PJ→PF)"
   ⭐ NOVAS: 2 (a fatura de 18.593,16 e o mercado de 280,50)
   ⭐ PAGAMENTO DE FATURA: banrisul — valor exato da fatura 2026-08, que vence 10/09
   aprender na conta: {"bankCode":"041","accountNumber":"0605534106"}
```
⭐ **Os 3 créditos da empresa NÃO viram transação nova** — era exatamente o red-then-green pedido.

**⚠️⚠️ UMA RESSALVA QUE O DONO PRECISA SABER: o BATE/DIVERGE NÃO VAI FUNCIONAR NO BANRISUL.** O preview devolveu `SEM_DECLARADO` **com o `<LEDGERBAL>` dentro do arquivo** — e está **certo**: a ficha do Banrisul tem `ledgerBalReliable: false` desde 29/08, porque **o saldo declarado dele embute o bloqueado +24h** (provado com os 1.700 do card da PJ). A conferência vale nas outras contas; no Banrisul quem confere é o PDF, dia a dia — igual na empresa.

**REGRA 11 — 5 defeitos repostos, todos vermelhos:** o import criando tx nova pro dinheiro da ponte (**7**) · a trava da conta errada fora do caminho (**1**) · sem LEDGERBAL dizendo que BATE (**2**) · cartão inativo voltando a ser candidato (**1**) · uma tx manual casando com várias linhas (**1**). **⛔ Guard de isolamento PF↔PJ:** foto da PJ (contagens de `transactions`/`bankAccounts`/`categories`/`suppliers` + saldo da conta) **idêntica** depois de um import PF completo. **9.584 verdes · TS 0.**

📋 **FICA PRA FASE 2 (não construído, por ordem do dono):** orçamento/metas (*"meta sem histórico é chute"*), a hierarquia de categorias (o modelo suporta `parentId`, hoje 0 em uso) e a tela de classificar em lote — as **regras aprendidas do perfil nascem em 0** e só passam a existir quando o dono categorizar o primeiro extrato.

### 📋 PF FASE 1 — A INVESTIGAÇÃO (13/09). **Dois dos três itens já existem, e um COLIDE com o terceiro.**

**0.1 — CONTA BANCÁRIA PF: existem 3.** `nubank` (R$ 0) · `bradesco` (R$ 0) · **`banrisul` (R$ 71.609,96)**. ⚠️ **Nenhuma tem `bankCode` nem `accountNumber` preenchidos** — e é exatamente disso que vive a trava `verifyOfxMatchesAccount` (12/08), a que impediu 355 tx do Sicredi de entrarem na conta Stone. **Sem esses dois campos a trava não tem como conferir nada** e o import PF nasceria sem a proteção que a PJ tem.

**0.2 — O MOTOR DA PJ NÃO SE APONTA PRO PERFIL, e o import PF que existe é de CARTÃO.** `lib/ofx-card/` é card-only; o campo `PersonalOfxImport.bankAccountId` está no schema com o comentário *"reservado pra Fatia 3B (OFX de conta PF)"* — **planejado em 2026-06 e nunca construído**. **0 imports de OFX feitos no perfil.** O `runImportV2` da PJ escreve em `Transaction`/`BankAccount` e chama gatilho de vendas, conciliação e DRE — nada disso existe no PF. ⭐ **O que É reusável é a camada de baixo** (parser OFX, `stableKey`/dedup, perfil de banco, descarte de futuro); o que precisa nascer é um orquestrador PF fino.
⛔ **E FALTA A ÂNCORA: `PersonalBankAccount` não tem `ledgerBal`/`ledgerBalDate`.** A conferência BATE/DIVERGE pedida **não tem onde se apoiar** no PF — é migration aditiva de 2 colunas nullable.

**0.3 — CATEGORIAS PF: árvore PRÓPRIA, e está CERTA.** `personal_categories`, **23 categorias**, tabela separada, **zero vínculo com `Category`/`dreGroup`** — os dois mundos já estão separados como o dono exige. INCOME 6 (Salário · Outros recebimentos · **Retirada da empresa [BRIDGE_ENTRY]** · 3 inativas, as duplicatas já documentadas em 13/08) · EXPENSE 17 (Alimentação, Transporte, Moradia, Contas, Saúde, Educação, Lazer, Vestuário, Investimentos, Cartão de crédito, Empréstimos, Telefone, Viagem, Daniela, nura, yussef gastos, Outros). ⚠️ **Lista PLANA** (0 categorias com pai, embora o modelo suporte) e **0 `AiLearningRule` no perfil** — a categorização aprendida do PF **nunca aprendeu nada**.

**⭐⭐ ITEM 2b JÁ ESTÁ FEITO — e o red-then-green do dono JÁ É VERDE.** As três transferências têm **ponte `DISTRIBUICAO` + gasto**:
```
08/09 R$ 10.000 · sicredi · ponte SIM     09/09 R$ 3.500 · sicredi · ponte SIM
10/09 R$ 21.000 · sicredi · ponte SIM     84 pontes no perfil
```
E o dinheiro já está espelhado na PF: `CREDIT 21.000 "Distribuição de Lucros caçula"` + `DEBIT 21.000 "yussef gastos"` (o fluxo A/B de 10/08).

**⛔⛔ E DAÍ SAI A COLISÃO QUE PRECISA DE DECISÃO ANTES DE CONSTRUIR O ITEM 1:** quando o OFX do banrisul PF entrar, **esses mesmos créditos virão no arquivo** — e hoje viram **transação nova**, porque as 152 tx de conta do PF são `origin: MANUAL` **sem `dedupHash`**. Resultado: *o mesmo dinheiro duas vezes*, que é a doença que esta casa mais paga. **A régua honesta: a linha do extrato é o FATO, a tx da ponte é o REGISTRO do mesmo fato → o import CASA com ela (como o dedup da PJ faz), nunca cria a segunda.**

**⚠️ ITEM 2a — o `casar-pagamento` JÁ EXISTE** (rota + lib, 26/08); o que falta é **disparar no import**. Mas há dois obstáculos de DADO: **3 dos 4 cartões não têm `defaultPaymentAccountId`**, e existem **dois cartões com os mesmos 4 dígitos** (`banrisul pf ****9113` fecha 28 · `banrisul ****9113` fecha 29) — duplicata de cadastro que faria o casamento por nome/dígitos escolher o errado. É a família do Cancian (08/09), e o desenho certo é **nem criar a disputa**.

**📋 ESTADO PF MEDIDO:** 499 transações (347 `PDF_FATURA` de cartão · 152 `MANUAL` de conta) · **348 sem categoria** (as de fatura) · tx de conta por mês: jun 47 · jul 42 · ago 50 · **set 13**. Faturas: `banrisul 2026-08` OPEN R$ 18.593,16 (venceu 10/09) · `nubank 2026-09` OPEN R$ 6.210,30 · `magalu 2026-09` OPEN R$ 4.491,18.

### ⛔⛔⛔ O FILTRO DE TAREFA VAZAVA — PAINÉIS GERAIS DENTRO DO RECORTE (13/09)

**O dono, com o print:** filtrou *"metade de bolinha massa de pizza"* e a tela mostrava, **dentro do recorte**, *"Unidades por pessoa · todas as tarefas"* (rodrigo 1.415) e *"Geral do período"* (51 lotes, top queijo). **A tela dizia falar de massa de pizza e mostrava a cozinha inteira.**

**⚠️ A CAUSA RAIZ NÃO ERA O FILTRO — era a tela ESCOLHER A TAREFA SOZINHA.** Sem tarefa na URL ela adotava a que mais produziu e **seguia desenhando os painéis gerais embaixo**: recorte em cima, empresa inteira embaixo, sem ninguém dizer qual era qual. **O estado "todas as tarefas" virou EXPLÍCITO** (opção no topo do seletor, default ao abrir), o recorte mora **num lugar só** na rota, e o geral **só renderiza na visão geral**. ⭐ Na visão geral as **top tarefas viram LINKS** pro recorte de cada uma. **Mesmo princípio pra PESSOA** — e ali faltava o LOTE: as execuções já vinham filtradas, os lotes não.

**A VARREDURA, item a item:**

**⛔⛔ 1. `UN + KG` NUNCA SOMAM.** O placar dizia *"rodrigo 1.415,84 un"* — e aquele `,84` era **porção de queijo (UN) somada com massa de pizza (KG)**. O decimal estranho era o sintoma de um número que **não existe**. `somarQuantidades` virou o dono da pergunta *"quanto saiu?"* e devolve **"1.410 UN · 522 KG"**; a barra por pessoa passa a medir **LOTES** quando as unidades se misturam, e a tela **diz**. ⚠️ A casa já tinha essa disciplina no leitor mais antigo (`relatorio-por-pessoa.ts` recusa `min/un` com `unidades.size !== 1`, desde 06/09) — faltava ela existir no dono novo. ⭐ **E ordenar "top tarefa" por unidades era, ele próprio, comparar UN com KG**: passou a ser por **lotes**, com a razão escrita.

**⛔ 2. "MELHOR" NÃO DIZIA A RÉGUA.** *"melhor: 3h10 p/ 214 un"* num lote que era o **mais longo** do período. Virou **"melhor ritmo: 1,13 UN/min · 12/09 (214 UN em 3h10)"** — o rótulo carrega a conta.

**⭐ 3. O GRÁFICO NÃO INVENTA ZERO.** Dia **com lote e sem tempo medido** ganha marca vazada no eixo + nota (*"○ N dia(s) com lote e sem tempo medido — sem ponto, nunca zero"*); dia **sem lote** não entra no eixo. O volume do dia continua contado.

**⭐ 4. META PARCIAL É DITA:** *"2 de 3 lotes com meta · 104% nesses"* — nunca uma média silenciosa só dos que têm. O volume conta os três.

**⭐ 5. O FILTRO VIVE NA URL** (`router.replace`, não `push` — cada chip não merece entrada no histórico).

**PROVADO EM PROD, pelo caminho da tela:**
```
VISÃO GERAL   100 lotes · 10.421 UN · 22,86 KG  ⭐ (mista) · porTarefa: null
              top tarefas clicáveis: queijo 13L · calabresa 12L · coxão 10L · bacon 10L
              por pessoa: edmar 880,01 UN [barra=20 lotes] · rodrigo 1.420,34 UN [15 lotes]

FILTRO massa  3 lotes · 522 UN · média 162min · eliane 522 UN
              ⛔ "rodrigo" na tela inteira? NÃO ✓   ⛔ "queijo"? NÃO ✓
              o GERAL vem recortado: 3 lotes · top: só a massa
              melhor ritmo: 1,13 UN/min · 12/09 (214 UN em 3h10)
              série 10/09=129 · 11/09=168 · 12/09=190 (sem zeros inventados)

FILTRO edmar  só ele nas barras · top tarefas DELE · 19 lotes (a cozinha tinha 100)
```
**REGRA 11 — 8 defeitos repostos, todos vermelhos:** escopo sem recorte · soma mista · "melhor" por duração · rendimento espalhado · barra somando misto · geral sempre visível · auto-escolhe de volta · top tarefas não-clicáveis. **9.552 verdes · TS 0 · deploy `Vnx8a956PkqFAZU-3rjXW` 4/4.**

### ⛔⛔⛔ O LOTE RELÂMPAGO ENVENENAVA A MÉDIA — PISO DE 5 MIN (13/09)

**Decisão do dono, depois do raio-x:** *"Piso de 5 minutos: execução medida abaixo disso é RELÂMPAGO — conta à parte (como o 'sem tempo' já é), fora das médias, dito no rodapé. **Nenhum lote real fica pronto em menos de 5 min; registro retroativo é o caso, e vai se repetir.** Os 2 lotes atuais ficam classificados pelo piso — não mexe neles na mão, a régua resolve."*

**⚠️⚠️ A PERGUNTA *"esta duração conta na média?"* VIVIA COPIADA EM 7 LUGARES** (`minutos != null && minutos > 0`) — e foi exatamente por isso que o piso não tinha onde entrar. Virou **`foiMedido()` / `ehRelampago()`** em `desempenho.ts`, e os 7 passaram a consumir. É a lição do B1 outra vez: quando N leitores precisam da MESMA decisão, a decisão vira função.

**⛔ O TRABALHO NÃO SOME — essa é a metade que segura a régua.** O relâmpago sai do TEMPO e fica na PRODUÇÃO: `lotesRelampago`/`tarefasRelampago` contados à parte e **ditos na tela**, exatamente como o "sem tempo" já era. ⚠️ E **zero não é relâmpago**: zero é ausência de cronômetro, relâmpago é alguém tocando os dois botões seguidos — misturar apagaria uma distinção real.

**O EFEITO EM PROD, medido pela rota real — a régua estava envenenada e cobrava de gente:**
```
porçao queijo   média 44,3 → 87,7 min/lote   ·   mediana 26,5 → 84
melhor lote     "1min p/ 504 un" → "53min p/ 306 un"        ⭐ o falso recorde morreu
Cristian        "+98% vs média" → "registro retroativo (menos de 5 min) — sem ritmo medido"
rodrigo (12/09) "−19% · 2h07 (média 44min)" → "+9% vs média"  ⭐ MUDOU DE LADO
7 dias: 3 relâmpago · mês: 7 relâmpago — contados, ditos, fora do tempo
```
⭐ O rodrigo aparecia **abaixo da média** porque a média dele era metade do real. Não era desempenho: eram três toques de botão.

**⚠️⚠️ E EU QUASE MUDEI UMA DECISÃO DE 06/09 CALADO — os testes daquele dia me pararam.** Ao aplicar o piso na tela "Por pessoa", troquei a trava da coroa por *"conta quem tem relógio"*, o que fazia a pessoa cujo único concorrente era relâmpago **perder a coroa**. Mas a casa **já decidiu, por escrito**, que *"quem TEM minuto medido continua concorrendo, mesmo com um zero na mistura"* — e **relâmpago é o zero um minuto acima, não um caso novo**. Revertido. 📋 Fica a pergunta registrada pro dono: *coroar quem foi medido, quando o único concorrente não tem tempo medido, é prêmio disputado?* Hoje a resposta da casa é sim, e vale igual pros dois.

**⚠️ REGRA 11 REPROVOU MAIS UM GUARD MEU:** a exigência *"a tela DIZ o relâmpago"* **não tinha ninguém conferindo** — repus o defeito (tirei a frase do placar) e os 48 testes ficaram **VERDES**. Agora existe, e ele também proíbe **digitar o `5` em tela** (a lição do `TETO = 25` hardcoded e do `30` da janela do "a vencer"): o número vem do dono único ou não vem.

**REGRA 11 nos outros três, cada um com vermelho:** piso de volta a 0 → **19** · `relatorios.ts` com régua própria → **1** · a 7ª cópia com a régua velha → **2**. **9.525 verdes · TS 0 · deploy `oqV3Bap34r5uHaxqGXeKz` 4/4.**

### ✅ O EDITOR DE RECEITA **NÃO** PERDE COMPONENTE — investigado e inocentado (13/09)

**A pergunta do dono:** *"o editor PERDE componente ao salvar depois de uma mescla de itens? Reproduz: ficha com componente X → mescla o item X em outro → abre a ficha, salva sem mexer → o componente sumiu?"*

**⭐⭐ A CRONOLOGIA JÁ RESPONDIA, e ela é dura:**
```
19:08  o fantasma recebe a separação de −0,161
18:55  v1 da MAIONESE (COM vinagre)
19:23  v2 — SEM vinagre          ← a perda aconteceu AQUI
19:27  v3 e v4
19:58  A MESCLA acontece (estornos + re-entradas no item vivo)   ← 35 min DEPOIS
```
**O vinagre saiu da receita 35 minutos ANTES de existir mescla.** E é por isso que a v1 hoje aponta pro item vivo: a mescla das 19:58 repontou aquele componente depois. **O sumiço da v2 foi gesto de tela**, não efeito colateral.

**⛔ MAS CRONOLOGIA PROVA O CASO, NÃO A CLASSE** — então a classe ganhou teste (`editor-nao-perde-componente.integration.test.ts`, 6 casos rodando o caminho REAL: o mesmo `getFicha` que a tela carrega e o mesmo `atualizarFicha` que o PATCH chama). **Todos verdes:** a mescla **repõe** o componente (`updateMany`, sem unique pra colidir), o load devolve todos (`versaoView` não filtra nada), o save persiste todos, componente de item **desativado** sobrevive, mudar o corpo **sem** mandar a lista **herda** a receita, e lista vazia é **recusada**.

**⚠️⚠️ E A REGRA 11 IMPORTOU MAIS AQUI DO QUE DE COSTUME — porque o veredito é "não tem bug".** Um teste verde por vacuidade **inocentaria um defeito real**, que é o pior desfecho possível de uma investigação. Repus três defeitos:
| defeito reposto | mordeu? |
|---|---|
| a mescla NÃO repõe a ficha | ✓ vermelho na hora |
| o load descarta componente de item inativo | ⛔ **VERDE** — depois da mescla o componente aponta pro SOBREVIVENTE, que está ativo |
| `componentes` ausente vira lista vazia | ⛔ **VERDE** — o teste do "salvar só o preço" **nem alcança** a linha de herança (`valorVenda` sozinho não muda o corpo, e `atualizarFicha` retorna cedo) |

Os dois buracos viraram caso próprio: **item arquivado** com a ficha apontando pra ele, e **mudar o modo de preparo** sem mandar os componentes. Com eles, os três defeitos ficam vermelhos.

**9.531 verdes · TS 0.**

### 📋 OS DOIS VINAGRES — JÁ ESTAVAM RESOLVIDOS, E NÃO POR MIM (13/09)

**O dono autorizou aplicar; o preview quebrou porque o mundo mudou.** `scripts/vinagres.ts` procura `VINAGRE 750ML` e não acha mais — e a medição explicou: **o próprio dono fez a costura na tela em 12/09** (audit: sessão dele às 19:24), mesclando os três vinagres.

**O ESTADO MEDIDO HOJE — dois dos três passos estão feitos:**
```
✓ POSIÇÃO com UM vinagre só:  "VINAGRE" · 6,84 · R$ 47,75 · custo R$ 6,98
✓ o fantasma "VINAGRE 750ML (mesclado)" está INATIVO, saldo 0, a separação de −0,161 ESTORNADA
✓ as baixas MOVERAM pro item vivo (SEPARACAO_SAIDA −0,161 e PRODUCAO_CONSUMO −0,16)
✓ o ROSINA também foi absorvido (entrada de 4 × 5,75 estornada e refeita no vivo)
```
⚠️ **P1 NÃO QUEBROU** — minha primeira fórmula acusou `dif −0,16` no fantasma e **o juiz real não aponta nada**. É a lição de 09/09 ao pé da letra: *fórmula errada dá alarme com cara de achado*; P1 fecha **por ORDEM**, não por item.

**⛔⛔ MAS DUAS COISAS FICARAM, e NÃO apliquei nenhuma — a autorização era pra um plano que não existe mais:**

1. **A FICHA ATUAL DA MAIONESE NÃO TEM VINAGRE.** O componente `0,02 LT` só existe na **v1**; as v2/v3/v4 (criadas 19:23–19:27 da mesma noite, na sessão dele) têm **5 componentes, sem vinagre**. Ou seja: **produzir maionese hoje não baixa vinagre nenhum**. Não dá pra distinguir no dado se ele tirou de propósito ou se o editor perdeu o componente ao salvar depois da mescla — e adivinhar qual das duas seria decidir a receita por ele.
2. **A UNIDADE DIZ LT, A QUANTIDADE ESTÁ EM GARRAFA.** A reunitização de 12/09 usou **fator 1** (as entradas de 3 e 4 foram estornadas e refeitas **com a mesma quantidade**), não o **0,75** do plano. São **7 garrafas de 750 ml = 5,25 LT**, mas o item mostra **6,84 LT**. ⭐ O **valor está certo** (R$ 47,75, invariante); o rótulo é que não. Efeito prático: `0,02 LT` na receita viraria **15 ml em vez de 20 ml** — pequeno, mas é exatamente o que o fator 0,75 existia pra resolver.

### ⛔⛔⛔ A PORTA SUMIA QUANDO O TRABALHO ACABAVA — 4ª VOLTA DA FAMÍLIA (12/09)

**O dono:** *"existia um lugar pra trocar a seção de um produto do cardápio e ele não aparece mais. **Eu uso isso direto**."*

**⛔ MEDIDO EM PROD, e o relato estava certo em cheio:** a porta pra `/estoque/cardapio/secoes` renderizava **só** com `hub.linhas.some((l) => l.secaoSugerida)` — e a Caçula tem **166 produtos com ZERO sugeridos**. O link ficou **invisível**.

⚠️ **E o comentário original explicava a intenção:** *"só aparece quando ainda há produto sem seção CONFIRMADA — decisão pronta não pede gesto de novo"*. A intenção era boa; **o efeito é que REVER uma decisão virou impossível pela tela**. ⚠️ E o **produto individual nunca teve** o gesto — só o lote.

**⭐⭐ A REGRA QUE FICA, irmã da de 10/09 (*card que nasce escondido*):**

> **Fila zerada esconde o TRABALHO, nunca a FERRAMENTA.** O contador pode sumir; a porta não.

**O FIX:**
- **a tela do produto ganhou o seletor de SEÇÃO**, à vista no cabeçalho — e usa a **MESMA rota do lote** (ela aceita `min(1)`), então não nasce uma segunda porta de gravação;
- **a porta do lote fica SEMPRE**, e o que muda é o TEXTO: com pendência ela chama pro trabalho (*"N com seção sugerida — confirme de uma vez"*), sem pendência ela é a saída de revisão (*"166 produtos classificados · revisar ou remanejar em lote"*);
- o estado novo da tela vem do que o **SERVIDOR aceitou**, nunca do clique.

**PROVADO NAVEGANDO, pelo caminho dele (sessão real, sem URL secreta):**
```
PAGE /estoque/cardapio                → 200   (com 0 sugeridos, a porta está lá)
PRODUTO "CACHORRO QUENTE" · LANCHES
   detalhe → 200 · secao "LANCHES" · 10 seções pra escolher
   PAGE do produto → 200
TROCA LANCHES → DOCES → 200 {"ok":true,"produtos":1,"nomes":1}
PLACAR:  LANCHES 2 → 1  ·  DOCES 11 → 12   ⭐ reflete na hora
⭐ devolvido ao original ("LANCHES") — o cardápio dele não fica mexido pela prova
```
**GUARD NOVO** (`porta-nao-some-quando-o-trabalho-acaba.test.ts`): link de ferramenta **não pode ficar atrás de um contador de pendência**, com **auto-teste do detector nos dois sentidos** (pega o padrão antigo, não acusa o novo). **REGRA 11 — com a porta escondida de volta: 2 vermelhos.**

**9.398 verdes · TS 0 · deploy `NjyZMu3hh2xE9ycgyF0NM` 4/4.**


### ⭐⭐ A CATEGORIA DO ITEM VIROU EDITÁVEL + OS DOIS VINAGRES (12/09)

**O dono:** *"VINAGRE CBS VINHO TINTO 750ML marquei USO INTERNO por engano — o certo é MATÉRIA-PRIMA. **Não existe onde trocar**."*

**⚠️ MEDIDO ANTES DE ESCREVER QUALQUER COISA: a ROTA JÁ ACEITAVA `categoria`** no `patchSchema`. O que faltava era **a TELA** — a mesma anatomia do *"sumir com o item"* de 09/09, em que a régua existia há dias e o menu não oferecia o gesto.

**⭐ A INVESTIGAÇÃO QUE ELE PEDIU ("a categoria pesa em alguma derivação?"), respondida:**
| onde | pesa? |
|---|---|
| **CMV / DRE** | **não** — nenhum uso de `categoria` nos dois |
| Posição / contagem (`seContaFisicamente`) | exclui só `SABOR` e `PRODUTO_FINAL` → **trocar entre MATERIA_PRIMA e USO_INTERNO não muda nada** (teste prova) |
| busca de ingrediente da receita · etiqueta | **sim** — e é justamente o efeito que ele quer |
| `sugestoes.ts` | só palpita na **criação**, não relê depois |

⭐ Ou seja: a troca vale na **LEITURA, daqui pra frente**. **Nenhum movimento é reescrito** — história não se mexe. `stock_item_categoria_trocada` (CREATE-only, `CHECK de <> para`) guarda **de, para, quem e quando**: tabela própria porque a troca tem autor e é um fato por si, e o item pode mudar de ideia mais de uma vez.

⛔ **Item PRODUZIDO não troca por ali** (`SABOR`/`PRODUTO_FINAL`/`INTERMEDIARIO`): a categoria dele vem da FICHA, e mexer soltaria o item da receita que o produz.

**PROVADO EM PROD, pela rota real:**
```
ANTES:  VINAGRE CBS VINHO TINTO 750ML → USO_INTERNO
PATCH → HTTP 200
DEPOIS: MATERIA_PRIMA
RASTRO: USO_INTERNO → MATERIA_PRIMA por 05e9mg em 2026-09-12T19:55
POSIÇÃO: ⭐ aparece · saldo 7   (não mudou de tamanho, como o teste previu)
```
**9.392 verdes · TS 0 · deploy `PItscD9x_WHFcGK9fuKoJ` 4/4.**

### 📋 OS DOIS VINAGRES — PREVIEW PRONTO, ESPERANDO O OK (`scripts/vinagres.ts`)

**A aposta do dono se confirmou — é o padrão invólucro/garrafa — MAS com uma diferença que muda o conserto: as UNIDADES DIVERGEM.**
```
FANTASMA  VINAGRE 750ML (LT, MANUAL)      saldo −0,16 · custo R$ 0,00
          └ é componente da ficha da MAIONESE (0,02 LT) e o ÚNICO movimento dele
            é a SEPARAÇÃO de hoje
COMPRADO  VINAGRE CBS VINHO TINTO (UN)    saldo 7 · R$ 47,75 · 2 entradas de NF
          └ não é componente de ficha nenhuma
```
⭐ E há um **terceiro**, já resolvido: `VINAGRE TINTO ROSINA 750 ML (mesclado)` — inativo, entrada estornada, saldo 0.

**O CONSERTO, em três passos — e o passo 3 NÃO pode ser agora:**
```
1. REUNITIZAR o CBS de UN → LT (1 garrafa = 0,75 LT)
   7 UN → 5,25 LT · custo R$ 6,82/UN → R$ 9,10/LT · valor R$ 47,75 ⭐ INVARIANTE
   2 movimentos convertem · 0 bloqueios
2. a ficha da MAIONESE aponta pro CBS — a quantidade NÃO muda (0,02 LT segue 0,02 LT)
3. ⛔⛔ a baixa de −0,161 é a SEPARAÇÃO de uma ordem **EM_PRODUCAO**
```
**⛔⛔ MOVER A BAIXA AGORA QUEBRARIA O INVARIANTE P1** (`Σ separado == Σ consumido + Σ devolvido`). O material **já foi separado fisicamente** com o item fantasma; o certo é a ordem **fechar nela** e a costura vir depois. ⚠️ **Impacto financeiro de deixar: ZERO** — o movimento é a custo R$ 0,00.


### ⛔⛔⛔ A BEBIDA VENDIDA COMO COMPLEMENTO NÃO BAIXAVA (12/09)

**O dono:** *"COCA 2L é produto no cardápio E complemento quando o cliente adiciona. A do relatório de Produtos baixa certinho; a MESMA bebida no relatório de Complementos não baixa nada."*

**⚠️ A APOSTA DELE ERA *"bebida esbarra numa régua complemento = sabor"* — E O DADO REFUTOU.** Não existe régua nenhuma barrando: `baixaComplemento` aceita **qualquer** ficha (`alvoTipo === 'FICHA'`) e `upsertComplementoMap` também — o comentário de lá até explica que aceita `INTERMEDIARIO` **e** `PRODUTO_FINAL` de propósito.

**⭐ A CAUSA MEDIDA É OUTRA, e mais simples: são DOIS MAPAS e ninguém preencheu o de complementos.** Das **18 bebidas** do relatório, **18 pendentes** — e várias já com ficha no cardápio:
```
"COCA COLA 2L"  38 ocorrências em 6 dias · complemento PENDENTE | produto FICHA
"COCA ZERO 2L"  14 ocorrências em 6 dias · complemento PENDENTE | produto FICHA
"FANTA UVA 2L"   3 ocorrências           · complemento PENDENTE | produto FICHA
```
⚠️ Os dois mapas continuam separados **de propósito** (02/09: 25 nomes vivem nos dois relatórios, cada um com seu destino). O que faltava não era fundir — era **herdar** quando o nome é literalmente o mesmo.

**⭐ A RÉGUA É A DE 08/09, SEM AFROUXAR: canônico IDÊNTICO** (mesma string ignorando caixa, acento e espaço). Roda no **IMPORT** e **antes da baixa** — o mapa precisa existir quando o plano é montado, senão a bebida cai na prateleira e só baixa no reprocesso. Fail-soft: herdar é bônus.

**⛔ O QUE NÃO HERDA, e por quê:** `COCA LATA MAIS MINI FRITAS` **tem fritas dentro** — herdar por "parece" baixaria só a lata e esqueceria a batata. E **decisão do dono não se sobrescreve**: nome já `IGNORAR` continua ignorado (ignorar é uma resposta, não uma ausência).

**REGRA 11 — sem a herança: 2 vermelhos.** ⚠️ **E a primeira reposição do guard do combo NÃO mordeu:** casar por `includes` não fazia o combo entrar de verdade. O defeito que morde é casar pela **primeira palavra** — com ele, o teste do combo fica vermelho.

**9.385 verdes · TS 0 · deploy `XD4mdFyy6i758iAzd8cin` 4/4.**

### 📋 O RETROATIVO ESTÁ EM PREVIEW, ESPERANDO O OK (`scripts/retro-bebida.ts`)

**⚠️⚠️ E O PREVIEW MOSTROU QUE O DEFEITO ERA MAIOR QUE BEBIDA: são 13 nomes, 87 ocorrências, 6 dias.** `FEIJAO` (16), `XIS - CALABRESA` (4), `XIS - BACON` (2), `XIS - FRANGO`, `XIS - COXAO MOLE` e `pizza grande (35cm)` estavam no mesmo buraco — qualquer nome do complemento que já tinha destino no cardápio.

```
COCA COLA 2L     38 ocorr  ·  FEIJAO            16  ·  COCA ZERO 2L      14
XIS - CALABRESA   4        ·  FANTA UVA 2L       3  ·  FRUKI 2L           2
FANTA LARANJA 2L  2        ·  FANTA LARANJA LATA 2  ·  XIS - BACON        2
FANTA UVA LATA    1        ·  pizza grande(35cm) 1  ·  XIS - COXAO MOLE   1
XIS - FRANGO      1
```

### ✅ APLICADO NOS 13 (12/09, autorizado pelo dono)

**A pergunta dele sobre a PIZZA foi respondida ANTES de aplicar:** a ficha da `Pizza Grande (35cm)` baixa **`2 × porção queijo 135 grama`** — a **base**. Os **54 sabores** já mapeados baixam **proteína** (calabresa, frango, bacon, coxão). **Interseção: NENHUMA** — conferido contra os 54, não contra uma amostra. Sem dobra de porção; a pizza entrou.

`pg_dump pre-heranca-complemento-20260912-013130.dump` (6,0 MB) antes. **13 heranças gravadas · 6 dias reprocessados** (02, 03, 04, 06, 10 e 11/09).

**SALDOS PRA O DONO BATER COM A COZINHA:**
```
COCA-COLA 2L                      144 UN · custo R$ 8,08 · valor R$ 1.164,23
COCA COLA Zero 2L                  30 UN · custo R$ 8,11 · valor R$   243,22
FEIJAO PRETO CALDO DE OURO 1K   12,12 KG · custo R$ 7,80 · valor R$    94,52

o que o COMPLEMENTO baixou (todos os dias):
   COCA-COLA 2L −38 · COCA Zero 2L −14 · PAO DE XIS −8 · OVO −8
   (e os sabores de sempre: calabresa −931, frango −519, coxão −503, bacon −476)
```

**⚠️ ACHADO NO CAMINHO, e NÃO é o estado impossível:** `porçao calabresa ralada 50 grama` está com **saldo −99 e valor −R$ 21,60**. ⭐ **Saldo negativo COM valor negativo é coerente** — é o sinal *"vendeu sem produzir"* que o módulo trata como comportamento certo desde 09/09. O guard de 11/09 barra **saldo ≥ 0 com valor < 0**, que é outro estado. Medido no ledger: **154 vendidas contra 71 produzidas** — ou a cozinha produziu menos, ou a produção não foi lançada. **É informação pro dono, não defeito.**

**⚠️ MEDIDO ANTES DE PEDIR O OK — os 13 vendem nos DOIS relatórios, e no MESMO dia:**
```
COCA COLA 2L   complemento 38 em 6d · produto 107 em 7d · mesmo dia nos dois: 6
FEIJAO         complemento 16 em 5d · produto  27 em 6d · mesmo dia: 5
XIS-CALABRESA  complemento  4 em 2d · produto   8 em 4d · mesmo dia: 1
```
⭐ Pra **bebida** o dono já disse que são **duas vendas** (*"a mesma garrafa, uma por caminho"*). Pra **XIS, FEIJÃO e pizza** a mesma lógica provavelmente vale (adicional, acompanhamento) — **mas eu não posso afirmar**, e aplicar em todos sem ele dizer seria decidir por ele num número que sai do estoque.


### ⛔⛔⛔ O SERVIDOR RECUSAVA O QUE A TELA OFERECIA — E A CAUSA NÃO ERA A RÉGUA (12/09)

**O dono, conciliando a OESA:** linha **1.695,27** × NF 3866696 de **1.641,12**, os **54,15** de multa+juros (3,3% da linha, dentro do gesto explícito de ontem). A tela acendeu o Conciliar e veio:

> *"Soma 1 candidate(s) (R$ 1641.12) não bate com OFX (R$ 1695.27). Diferença: R$ 54.15. **Tolerância máxima: R$ 0.02**."*

**⭐ O MAPA DAS RÉGUAS (ele pediu, e eram CINCO):**

| onde mora | valor | o que mede |
|---|---|---|
| `escolher-na-mao` `TOLERANCIA` | 0,02 | "fecha ao centavo" (card + baixa parcial) |
| `escolher-na-mao` `TETO_DA_DIFERENCA` | 25 | o que o sistema **oferece** nomeado |
| `escolher-na-mao` gesto manual | 10% | o que o **dono** confirma (11/09) |
| **`/find-and-match/reconcile` `SUM_TOLERANCE`** | **0,02** | **a régua do SERVIDOR** ← a terceira |
| `reconcile.ts` `AMOUNT_EQ_TOLERANCE` | 0,01 | bate o `diferencaAceita` ao centavo |

**⛔⛔ MAS A CAUSA NÃO ERA A RÉGUA DE 0,02 — era mais simples e pior: o card COLETAVA o nome da diferença, acendia o botão com ele e NUNCA O ENVIAVA.** O POST ia só com `candidateIds`; o servidor não tinha como saber que havia algo confirmado, e recusava **com razão**. ⭐ *A régua de 0,02 media a coisa certa — "a soma fecha?" — e não fazia a segunda pergunta: "e se não fecha, o dono nomeou?"*

**⭐ O FIX DE CLASSE (`regua-da-diferenca.ts`): quatro chamadores, uma função.** Card, Find & Match, lote e **servidor** passam pelos mesmos degraus — `FECHA` (≤0,02) · `OFERECE` (≤25) · `PERGUNTA` (≤10% da linha) · `RECUSA`. ⚠️ **O degrau NÃO muda quando o dono marca a caixinha** (só o `podeFechar`): senão a tela mudaria de degrau no clique e o servidor avaliaria outro. Um teste **varre de 0 a 20% da linha** e exige que tela e servidor **nunca** discordem.

⚠️ **E A MENSAGEM PASSOU A DIZER O QUE FAZER:** *"Diferença de R$ 54,15 — confirme na tela que é juros/multa pra conciliar"*. *"Tolerância máxima: R$ 0,02"* mandava o dono procurar um erro que não existia — ele sabia que era juros.

### ⛔⛔ E O RASTRO SÓ EXISTIA NUM DOS DOIS RAMOS

A OESA fechou (HTTP 200, RECONCILED) e o `notes` ficou **sem uma linha explicando**. Medido no audit: `diferencaAceita: undefined · mode: CLASSIC`. **O texto do rastro vivia só no ramo `EFFECTED_ORPHAN`** — o caso do Cancian (07/09), que era ex-payable já paga. **Conta em aberto normal segue o ramo CLASSIC**, e por ali não passava nada. É a família *"N caminhos, 1 esquecido"*, a mesma do estorno de cartão e do gatilho de vendas. Agora o texto é montado **uma vez**, antes da bifurcação.

⚠️ **O rastro vai na PRIMEIRA nota do grupo, não em todas:** a diferença é do **pagamento**, não de cada nota — escrevê-la nas cinco faria quem lê a segunda achar que houve 54,15 de juros ali também, e o grupo "somaria" R$ 270,75 que nunca existiram.

**PROVADO EM PROD, pela rota real, com o caso dele:**
```
SEM NOMEAR         → HTTP 422: "Diferença de R$ 54,15 — confirme na tela que é
                                juros/multa pra conciliar · marcado R$ 1641.12
                                × linha R$ 1695.27"
COM 54,15 NOMEADOS → HTTP 200: reconciled 1 · failed 0

A NOTA: RECONCILED · vínculo sim
⭐ RASTRO: "… · pagamento conciliado com a linha do extrato de 2026-09-11
   (R$ 1695.27) · diferença de R$ 54.15 = juros/tarifa de boleto,
   confirmada por quem conciliou"
```
⭐ **Os irmãos entram pelo mesmo gesto** (travado em teste com os números reais): **Focatto 68,55 · Cia da Fruta 32,35 · Box 63,78 · Ivan 69,50** — todos no degrau `PERGUNTA`, todos aceitos pelo servidor quando nomeados.

**REGRA 11 — 3 defeitos repostos:** card sem enviar → **1 vermelho** · régua de 0,02 solta de volta → **1** · ramo CLASSIC sem o rastro → **1**.

**⚠️⚠️ E A REGRA 11 REPROVOU DOIS GUARDS MEUS NO CAMINHO:** (a) o detector do rastro olhava uma **janela de 3.500 caracteres** em volta do `mode:` — e ela alcançava a **declaração** lá de cima, então remover o uso no CLASSIC deixava tudo verde; o que morde é contar o **USO**. (b) o guard do POST cortava o corpo em `'}),'` e parava no **spread interno**, acusando um campo que estava lá. **Guard novo só conta depois de rodar contra o defeito que o motivou — inclusive contra os defeitos dele mesmo.**

**9.378 verdes · TS 0 · deploys `Jh5E4QPQt7qRY9rfwCdZp` e `kX_Xe0qWe7edxs0S_LL6i`, os dois 4/4.**

⚠️ **A régua de 0,02 NÃO morreu — ela virou o degrau `FECHA`**, que é o papel legítimo dela: arredondamento bancário de um centavo não é diferença, é ruído. O que morreu foi ela ser **a única pergunta** do servidor.


### ⭐⭐⭐ O MATCHER APRESENTA O QUE JÁ ESTAVA NO EXTRATO (11-12/09)

**O dono cruzou os 99 débitos da Stone com o Contas a Pagar:** *"a maioria dos 'sumidos' ESTÁ no extrato — **o matcher é que não apresenta**."* Medido caso a caso, rodando o matcher de verdade antes de escrever régua nenhuma:

```
ELETROSUL 143,03 × conta manual "eletrosul" 143,00  →  60 pts  (corte 70) ⛔
Casper   2.120,81 × manual "casper"       2.113,83  →  60 pts ⛔
PJBANK   2.222,88 × "aluguel escritorio"  2.222,81  →  65 pts ⛔
⛔⛔ aluguel caçula 5.234,00 × DOCEOLI 5.234,88     →  70 pts: PASSAVA
```

**⭐ 1. A DIFERENÇA QUE O DONO NOMEIA — DOIS TETOS COM PAPÉIS DIFERENTES.** *"O teto de R$ 25 vale pro que o sistema SUGERE sozinho; acima dele, aparece o gesto explícito."* Até 25 o sistema **oferece**; entre 25 e **10% da linha** ele **pergunta com o valor em destaque** (*"a diferença de R$ 45,60 é juros/multa de atraso — confirmar"*); acima de 10% **não existe gesto** — o teste do *"500 de juros numa nota de 600"* trava isso. ⛔ E sem NOMEAR não fecha em nenhum dos dois.

**⭐ 2. A CONTA MANUAL TAMBÉM TEM NOME** (`nome-da-conta-manual.ts`). Conta sem FK nunca ganha os 15 do `FORNECEDOR_IGUAL` — e era exatamente isso que faltava, **com o nome escrito nos dois lados**. ⚠️ Palavra que descreve a NATUREZA do gasto (*aluguel, fgts, salario*) **não identifica ninguém** e fica de fora: casar por assunto é palpite.

**⛔⛔⛔ 6. O GUARD DO FALSO-AMIGO — a trava que protege todo o resto.** *"Quase-exato SEM nome compatível NUNCA sugere; diferença de centavos não compra identidade."* ⭐ **E ele só é possível por causa do item 2**: quando dá pra perguntar *"o nome bate?"*, dá pra **recusar** quem não bate. Valor **EXATO** continua passando sozinho (o sinal mais forte do domínio, com a janela curta impedindo coincidência).

**⭐ 5. O INTERMEDIÁRIO DE BOLETO, com exceção NOMEADA e estreita.** Na linha da PJBANK **ninguém pode dizer o beneficiário** — o banco vê a processadora. Lista **fechada**, só com data D0/D1, **sempre com o aviso na cara**, nascendo em confiança **baixa**. E **o vínculo ensina**: tabela CREATE-only, e na segunda vez a frase vira *"PJBANK costuma ser o boleto desta conta (3× confirmado por você)"*.

⚠️ **UMA CONTRADIÇÃO ENTRE OS PEDIDOS, RESOLVIDA E REGISTRADA:** `MIXX PLAY 111,21 × "radio" 109,00` é **exatamente** um quase-exato sem nome compatível — o item 2 o quer oferecido e o item 6 o proíbe. **O dono sabe que a MIXX é o rádio; o sistema não tem como saber.** Ficou barrado, e a saída é a do item 5: ele vincula uma vez pelo Find & Match e o padrão passa a ser conhecido.

⚠️ **E O `const TETO = 25` ESTAVA HARDCODED NA TELA** — número solto é a segunda régua no dia em que o teto muda, a mesma doença que o `30` da janela do "a vencer" já tinha ensinado. Agora vem do dono único.

**⚠️⚠️ A REGRA 11 ME CORRIGIU NUMA AFIRMAÇÃO MINHA.** Anunciei como bug que `'BOLETO'` normaliza pra **string vazia** e que `includes('')` faria **toda** linha virar processadora, derrubando o guard. **Repus o defeito e os 19 testes ficaram VERDES**: o `if (!achada) return null` já barrava, porque string vazia é *falsy*. O filtro ficou — a proteção era **acidental** e agora é **explícita** —, mas o comentário foi reescrito com a verdade.

**PROVADO EM PROD, pelas funções que a tela chama:**
```
casper              R$ 2.113,83 ← R$ 2.120,81  score 75 · "CASPER" aparece nos dois
ELETROSUL              R$ 40,00 ←    R$ 40,02  score 75 · "ELETROSUL" aparece nos dois
eletrosul             R$ 143,00 ←   R$ 143,03  score 75
box paper           R$ 5.211,85 ← R$ 5.211,85  score 75 · valor exato
aluguel escritorio  R$ 2.222,81 ← R$ 2.222,88  score 65 [baixa]
   ⚠️ pagamento via processadora de boleto (PJBANK) — ela não diz o beneficiário, confere antes

⛔ GUARD: "aluguel caçula" tem sugestão? NÃO (DOCEOLI barrada) ⭐
⭐ item 4: as linhas NOVAS de 11/09 entraram nos cards sozinhas —
   BOX PAPER 2.143,91 · OESA 1.695,27 · CASPER 2.120,81
```
**REGRA 11 — 2 defeitos repostos:** sem o guard do falso-amigo → **1 vermelho** · sem os pontos do nome manual → **4**. **1 teste invertido com o motivo escrito** (o Ivan: 69,50 é 3,5% da linha e agora fecha com ele nomeando). **9.356 verdes · TS 0 · deploy `evIGNEOToFXeSDMt34Dfq` 4/4.**

⚠️ **DÉBITO REGISTRADO, NÃO FEITO:** o card do "escolher na mão" **remonta a conta do rodapé por conta própria** em vez de chamar `contaDoRodape`. Hoje os dois concordam (o TETO já vem do dono único), mas é a segunda derivação que esta casa combate — e ela diverge no primeiro caso de borda.

⚠️ **E O ITEM 3 SE RESOLVEU SOZINHO ENQUANTO EU MEDIA:** dos 6 "exatos não oferecidos", **o dono conciliou 5 às 02:25** (o audit mostra os 5 `UPDATE Reconciliation`) e o Frigorífico já estava vinculado há dias. **Não tenho como provar que eles não foram oferecidos antes** — o estado mudou debaixo da medição, e afirmar a causa sem o estado seria inventar.


### ⭐⭐⭐ CORTE DE ÉPOCA NA CONCILIAÇÃO + O RAIO-X DE SETEMBRO (11/09)

**O dono:** *"Comecei a usar a conciliação em setembro; agosto fica pra trás POR DECISÃO — as linhas de agosto já estão categorizadas como despesa, completas no DRE; não vou caçar par de conta velha."*

**⛔⛔ O CORTE É DA VITRINE, NUNCA DO DADO.** A linha anterior continua nas Movimentações, continua no DRE e o **Find & Match manual ainda a acha** quando ele procura. O que encolhe é a fila parar de empurrar trabalho que ele recusou. ⚠️ É a diferença que separa isto do *"AGOSTO É O PISO"* das vendas: lá o piso é do **MOTOR** (o dado pré-corte nem existe), aqui é só da **VITRINE**.

**⭐ CONFIG DA EMPRESA, não constante** — `Company.conciliarAPartirDe` (migration **aditiva pura**, coluna nullable; `null` = sem corte = o comportamento de hoje pra toda empresa existente). Empresa nova define a dela no onboarding.

**⚠️ `comCorte` JUNTA O CORTE COM A JANELA SEM PERDER NENHUM DOS DOIS** — o `gte` que vale é o **mais restritivo**. Escrever o corte por cima apagaria a janela de ±N dias em silêncio, e ela existe pra não casar pagamento com conta de três meses atrás: o bug apareceria como *"a fila oferece linha velha demais"* num lugar e *"a fila esqueceu de olhar"* noutro.

Aplicado nas **4 consultas que OFERECEM** (`contasEsperandoPagamento`, `lotesDaFila`, `sugestoesParaPendentes`) — e o **badge deriva das mesmas**, então menu e tela não têm como divergir. **A tela DIZ o corte**, com o gesto de mudar ao lado: fila mostrando menos do que existe **precisa dizer por quê**, senão o dono procura o card que não vê.

**PROVADO EM PROD (corte 01/09/2026 aplicado na Caçula):**
```
ANTES (sem corte):  16 linhas oferecidas · 10 delas PRÉ-01/09
DEPOIS:              6 linhas oferecidas ·  0 pré-01/09  ⭐
```
**REGRA 11 — sem `comCorte` nas queries: 2 vermelhos. 9.337 verdes · TS 0 · deploy `vCD0uPJePbl3A0x-Fc-wI` 4/4.**

### 📋 O RAIO-X DAS 95 CONTAS DE SETEMBRO (pós-mescla, pós-corte)

**95 contas em aberto · R$ 183.061,40**, e a prestação de contas grupo a grupo:

| grupo | quantas | valor | o que é |
|---|---|---|---|
| **(a)** par/lote sugerido | **0** | — | nenhuma fecha sozinha hoje |
| **(b)** card no "pra tua mão" | **31** | R$ 64.977,65 | a linha existe, não fecha — é o clique dele |
| **(c1)** vencida **sem linha** | **25** | R$ 28.786,39 | *"paguei por onde?"* |
| **(c2)** ainda não venceu | **39** | R$ 89.297,36 | estado normal, **não é buraco** |
| **(d)** paga sem vínculo | **0** | — | a dupla contagem está zerada |

**⛔⛔ E A RESPOSTA DO (c1) É DURA: nenhuma das 25 tem um débito de valor exato em conta nenhuma desde 01/09** — nem OFX, nem manual. Elas não estão "perdidas na tela": **o pagamento delas não está no sistema**.

**⭐ O CANDIDATO MAIS FORTE, medido:** o **banco caixa está sem extrato desde 28/08** (0 linhas ≥ 01/09), enquanto banrisul, sicredi e stone estão importados até 10/09 e o cofre até 11/09. Pagamento feito por ali em setembro **não tem como aparecer**.

**⚠️⚠️ E UM PONTO CEGO REAL, ACHADO NO CAMINHO — a fila só oferece `origin: 'OFX'`.** Há **25 débitos MANUAIS sem vínculo** no cofre desde 01/09 (R$ 67.220,90) que a conciliação **nunca oferece**, por construção. ⭐ **Medi antes de chamar de causa: NENHUM deles casa por valor com conta em aberto** — são salários, entregadores e a devolução de mútuo da Arafat (R$ 50.000 em 01/09). **O ponto cego existe e fica registrado; ele não explica as 25.**

**⚠️ E UMA CORREÇÃO NO QUE O DONO LEMBROU:** os PIX pro PF são **R$ 10.000 (08/09)** e **R$ 21.000 (10/09)**, os dois no sicredi e categorizados como Distribuição de Lucros — não *"10.000 e 8.000"*. Há ainda um de **R$ 3.500 (09/09)** pra outro CPF, mesma categoria.


### ⛔⛔⛔ A CORREÇÃO DE UNIDADE VIRAVA A ENTRADA E NÃO VIRAVA O ITEM (11/09)

**O dono, depois de conferir a NF 179646 da LATICINIOS SANTO CRISTO:** *"troquei pra KG (1 peça = 2 KG), a tela mostrou certo, confirmei — o recibo diz '16 UN → Recebido 32 · custo 34,45' (**conta certa!**) mas NO ESTOQUE o item segue 'controle em UN' com o 32 entrando como unidades."* **Sucesso disfarçado, e o diagnóstico dele estava certo.**

**MEDIDO COM OS IDS, antes de tocar em código:** a entrada gravou **perfeita** (32 × R$ 34,45 = R$ 1.102,40), a `stock_unidade_corrigida` gravou (`UN→KG fator 2`) e o mapa `(cnpj, cProd)` **aprendeu o fator 2** — as três coisas que ele perguntou. O que **não** aconteceu foi a quarta: `stockItem.unidadeControle` continuou **UN**, e o saldo virou **`59,2 UN`** — um número **sem significado físico**, somando 8 peças com 19,2 kg com 32 kg.

**⛔⛔ E A MEDIÇÃO REFUTOU O FIX QUE ELE PROPÔS — "reunitiza o item com o mesmo fator" inventaria 51,2 kg de queijo.** O `reunitizar-item.ts` converte **TODOS** os movimentos vivos pelo fator; ele assume, desde 27/08, que o ledger inteiro está na régua antiga. **No queijo isso é falso:**

| quando | movimento | o que a CONFERÊNCIA registrou | fisicamente |
|---|---|---|---|
| 24/08 | 8 × R$ 69,90 | a nota disse **UN** | 8 **peças** → precisa ×2 |
| 03/09 | 19,2 × R$ 33,90 | a nota disse **KG** (outro fornecedor, a granel) | **19,2 kg — já certo** |
| 11/09 | 32 × R$ 34,45 | corrigida **UN→KG** | **32 kg — já certo** |

`59,2 × 2 = 118,4` contra os **67,2** reais. ⚠️ **Um item recebe de FORNECEDORES DIFERENTES, e cada um manda na unidade que quer** — nada garante ledger homogêneo.

**⭐⭐ E A UNIDADE DE CADA ENTRADA É DERIVÁVEL, NÃO ADIVINHÁVEL** (`lib/stock/unidade-do-movimento.ts`): a cadeia é **correção de unidade → `unidadeNota` da conferência → a régua do próprio item** (contagem e produção são digitadas nela). ⚠️ O custo unitário também denunciaria (69,90 é preço de peça, 33,90 é preço de quilo), mas isso é **heurística sobre número** — e este módulo decide pelo que foi **REGISTRADO**.

**O GESTO ÚNICO, as três coisas numa transação:** a correção converte a entrada (já fazia), grava o fator do fornecedor (já fazia) e **reunitiza o item** — **antes** de o movimento novo nascer, pra ele entrar já na régua nova e não ser convertido duas vezes. `reunitizarNaTransacao` foi extraído porque **Prisma não aninha `$transaction`** (a mesma cirurgia que o `aplicar-marcacao` levou em 29/08).

**⛔ NUNCA CONVERTE METADE E CALA:** movimento numa **terceira** unidade (nem a antiga nem a nova) **bloqueia nomeando** — sem o fator dele, converter seria chute; e se o item não puder reunitizar agora (**produção aberta**), a **conferência inteira para** e nada grava. Teste prova: 0 movimento, 0 conferência, item ainda em UN.

**⭐ O FATOR DOS MAPAS TEM A MESMA DOENÇA** — e ela mordia no mesmo caso: o queijo tem **dois** fornecedores, um que manda peça (fator 2) e outro **a granel em KG** (fator 1). Multiplicar os dois por 2 faria a próxima nota do granel entrar com **o dobro de queijo**. Agora quem já manda na unidade nova **não se mexe**.

**⚠️⚠️ E UM GUARD NASCEU SEM GUARD NO CAMINHO — o teste pegou.** Ao extrair o miolo transacional, a recusa por **produção aberta** ficou de fora (ela vivia **em duas cópias**, no preview e no aplicar). Virou `bloqueioDeProducaoAberta`, com **dono único**, chamada pelos três.

**A TELA MOSTRA O EFEITO ANTES DO CLIQUE**, e a conta vem da **mesma** `previewReunitizar` que o confirmar executa: *"o item passa a ser controlado em KG · saldo 59,2 UN → 67,2 KG · valor R$ 2.312,48 (não muda) · 1 movimento converte, 2 já estão certos"*.

**REGRA 11 — 2 defeitos repostos:** sem o reunitizar na conferência → **3 vermelhos** (o de hoje, exato) · reunitizar global (converte tudo) → **5**.

**9.327 verdes · TS 0 · deploys `bIKmA25pmFFsAHXGDE-mR` e `y2cRmD_4GrNYfjPUtV6Fw`, os dois 4/4.**

**📋 O RETROATIVO DO QUEIJO ESTÁ EM PREVIEW, ESPERANDO O OK** (`scripts/retro-queijo.ts`, read-only por padrão):
```
QUEIJO MUSSARELA FATIADO 2KG FATIA 10x10 CM   ·   UN → KG · fator 2
   ⭐ CONVERTE      8 UN → 16 KG        (unidade veio da CONFERÊNCIA)
   ✓ JÁ CERTO    19,2 KG — fica intacto (o granel)
   ✓ JÁ CERTO      32 KG — fica intacto (a entrada de hoje, já corrigida)

SALDO:  59,2 UN      →  67,2 KG
CUSTO:  R$ 39,06/UN  →  R$ 34,41/KG
VALOR:  R$ 2.312,48  →  R$ 2.312,48   ⭐ INVARIANTE ao centavo
```


### ⭐⭐⭐ A COLUNA SALDO — O EXTRATO BANCÁRIO DO ITEM (11/09)

**O dono:** *"quanto o item tinha DEPOIS de cada linha (227 → 234 → …). **Derivada do ledger na ordem, nunca gravada.**"*

**⭐ A CONTA DESCE DO SALDO DE HOJE** — que é o número que a Posição mostra. Então a linha mais recente **é** o saldo atual, e a prova que ele pediu fica **embutida na tela**: coluna, rodapé e Posição, **três leitores e uma régua só**. Cada linha devolve o próprio efeito pra quem vem abaixo; linha que não move a prateleira não desconta nada.

**⛔⛔ LISTA NÃO CONTÍGUA NÃO GANHA SALDO.** O que quebra a derivação é faltar linha **mais recente**. Filtro por **TIPO** (arranca linha de qualquer ponto) e **`ate`** (fecha o período antes de hoje) quebram → o campo vem `null` e a tela diz **"—"**. ⚠️ *Um número de estoque plausível e errado é a mentira mais cara que esta tela poderia contar.*

**⚠️⚠️ E A PROVA EM PROD CORRIGIU A MINHA RÉGUA — a coluna nasceu MORTA no extrato.** Eu tinha posto `movs.length < limite` na lista de quebras; a Caçula tem **1.013 movimentos** contra um teto de **500**, então **as 403 linhas do extrato vinham TODAS "—"**, justamente na tela em que a coluna mais serve. **Truncar corta o PASSADO** (a lista desce do mais recente), e o passado **não entra nesta conta**. Idem o filtro `de`. Um teste invertido com o motivo escrito.

**⚠️⚠️ DESCOBERTA DE DESENHO, travada em teste: CLEAN e FORENSE divergem NO MEIO da lista, de propósito.** No forense a linha de 10/09 mostra o saldo que o item **realmente tinha naquele dia** — fundo do poço, porque as baixas erradas já existiam e o estorno só veio em 11/09. No clean ela mostra a linha do tempo **sem os lançamentos anulados**. ⭐ Os dois **convergem onde tem que convergir**: no topo (hoje) e em tudo **abaixo do par** — porque o par soma zero. É por isso que o rodapé bate nos dois modos.

**⛔ O GRÁFICO DE PREÇO PASSOU PELA MESMA RÉGUA — e era defeito real que eu tinha registrado:** ele lia `ENTRADA_NF` do **CRU**, então **compra 100% estornada entrava na curva** como se alguém tivesse pago aquilo. Agora ele lê a lista **já colapsada** — fonte única, **não um filtro local a mais** —, exatamente como a compra desfeita saiu da aba "só compras". ⚠️ E usa sempre a lista limpa, **nunca o forense**: *"que preços eu paguei?"* não é pergunta que muda quando se liga o modo de auditoria.

**TIPOGRAFIA (item 4):** TOTAL e SALDO viram os protagonistas; **CUSTO UN. vira texto menor e cinza** (muda raro — é segundo olhar) e **some no celular** pra o SALDO caber. A linha anulada **não mostra saldo**: a célula fica vazia porque nada mudou ali.

**PROVADO EM PROD, pela rota real:**
```
COCA-COLA 2L — CLEAN (13 linhas)
   11/09 · Contagem      −12 un   −R$    97,08   saldo  215
   ⊘ lançamento anulado — contagem de 1.480 un estornada em 11/09   (saldo intacto: 227)
   10/09 · Compra (NF-e) +80 un    R$   646,79   saldo  227
   ⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09
   10/09 · Baixa de venda −7 un   −R$    56,63   saldo  147
   …
   24/08 · Compra (NF-e) +200 un   R$ 1.616,00   saldo  200   ← a 1ª compra da vida
   RODAPÉ: soma 215 · ✓ bate true
   ⭐ topo da coluna == rodapé == Posição:  215 == 215 == 215

FORENSE (17 linhas): mesmo topo (215) e mesmo rodapé, e no meio a verdade crua —
   10/09 · Compra (NF-e) +80 un   saldo −2.771   (o poço em que o item esteve)

EXTRATO: 403 linhas · 403 com saldo · filtrado por TIPO → todas "—" ⭐
GRÁFICO DE PREÇO: 6 pontos, sem a compra fantasma
```
**REGRA 11 — 3 travas repostas:** saldo virado gravado → **4 vermelhos** · contiguidade removida → **3** · gráfico lendo o cru → **2**. ⚠️ E o primeiro teste da linha anulada comparava com a linha **de cima**: *"anterior"* é no TEMPO, e a lista desce do mais recente — a linha anterior é a **de baixo**.

**9.321 verdes · TS 0 · deploys `T_hvFx3aQtHVubMRCxBDs` e `otksaKa7knJ55aMSKQPgS`, os dois 4/4.**


### ⭐⭐⭐ HISTÓRICO EM MODO CLEAN — O PAR QUE SE ANULA VIRA UMA LINHA FINA (11/09)

**O dono, olhando a Coca 2L depois do conserto:** *"16 linhas, das quais 6 são pares que se anulam. Pra entender 'o que aconteceu com meu estoque', essas linhas são ruído — mas APAGAR não pode: **o rastro é o que provou o desastre de ontem**."*

⚠️ **Medido antes de desenhar: são 4 pares (8 linhas), não 3.** O `+154 × −154` que ele mesmo citou também é par — a lista sai de **16 → 12**, não pros ~10 que ele estimou. Fanta: **10 → 7**.

**⭐ `colapsarAnulados` mora no MESMO dono do `dobrarProducao`** (`movimento-explicado.ts`), e por isso o histórico do item e o extrato herdam a régua juntos — duas implementações divergiriam no 1º tipo novo, que é a doença que este módulo mais paga.

**⛔⛔ A SOMA NÃO MUDA — E ISSO É POR CONSTRUÇÃO, NÃO PROMESSA.** O par só colapsa quando a contribuição dele à soma exibida é **zero**. Par **assimétrico** (um lado fora da prateleira, como o `PRODUCAO_CONSUMO` com estorno que move) **NÃO colapsa** — senão o rodapé *"✓ bate com o saldo"* passaria a mentir, e ele é justamente o teste da tela que o dono pediu em 09/09.

**AS TRÊS RECUSAS, cada uma com o seu motivo:**
| situação | decisão |
|---|---|
| desfeito **por inteiro** e contribuição zero | ⭐ colapsa numa linha fina |
| **estorno PARCIAL** | fica à vista — *sobrou efeito, o efeito aparece* |
| **par assimétrico** | fica à vista — colapsar mentiria na soma |
| estorno cujo **original não está na lista** (filtro/período) | fica como está — colapsar meio par sumiria com dado |

**⛔ NADA É APAGADO:** o par inteiro **viaja dentro da linha** (`anulado.original` + `anulado.estornos`), a tela expande em *"ver detalhe"*, e o toggle **"mostrar tudo (forense)"** devolve a lista crua. ⭐ O toggle **só aparece quando há par colapsado** — botão que não faz nada é ruído. **E o CSV vai SEMPRE forense** (o servidor força): arquivo é pra auditoria, e lá o par tem que estar inteiro.

⚠️ **A FRASE SAI SÓ DO QUE O LEDGER GUARDA.** Não existe campo de motivo em `stock_movement` — escrever *"(import com coluna errada)"* na linha seria inventar um dado que ninguém gravou. A linha diz o que dá pra provar: *"⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09"*.

**⚠️⚠️ REGRA 11 PEGOU UM TESTE MEU QUE NÃO MORDIA — de novo.** Repus o defeito tirando a trava do **PARCIAL** e os 11 testes ficaram **VERDES**: quem barrava o meu caso era a trava de **contribuição** (−100 + 40 já não soma zero). O teste que **isola** a régua do parcial é o dos **dois lados fora da prateleira**, onde a contribuição é zero de qualquer jeito e só a pergunta *"desfez tudo?"* separa. Com ele, remover a trava fica vermelho.

**7 TESTES ANTIGOS INVERTIDOS COM O MOTIVO ESCRITO** (afirmavam o mundo antigo, em que o par aparecia): os que falam da **natureza da linha** (chip, quem, href, `estornoDe`) passaram a pedir o **forense** — e isso, por si, prova que no forense **nada se perdeu**.

⚠️ **CONSEQUÊNCIA REGISTRADA:** a compra **100% estornada sai da aba "só compras"**. É o certo — aquela aba existe pra **comparar preço de fornecedor**, e uma compra desfeita não é um preço que alguém pagou; no forense ela volta. ⚠️ **E o gráfico de preço NÃO segue essa régua** (lê `ENTRADA_NF` do cru, incluindo compra estornada): é defeito **pré-existente**, achado no caminho, **não consertado sem pedido**.

**PROVADO EM PROD, pelas rotas reais com sessão assinada:**
```
COCA-COLA 2L   forense 16 linhas → CLEAN 12 (4 anuladas)
               soma clean 227 · R$ 1.835,64  ==  soma forense 227 · R$ 1.835,64
               ✓ bate com o saldo: clean true · forense true
   ⊘ lançamento anulado — contagem de 1.480 un estornada em 11/09   [1 estorno dentro]
   10/09 · Compra (NF-e)    +80 un   R$ 646,79
   10/09 · Baixa de venda    −7 un  −R$  56,63
   ⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09
   ⊘ lançamento anulado — baixa de venda de 1.499 un estornada em 11/09
   09/09 · Contagem        −406 un −R$ 3.280,48
   ⊘ lançamento anulado — contagem de 154 un estornada em 09/09

FANTA UVA 2L   forense 10 → CLEAN 7 (3 anuladas) · soma 6 un · R$ 40,86 nos dois
EXTRATO        clean 401 linhas (26 anuladas) · forense 427
```
**REGRA 11 — 2 travas repostas, 1 vermelho cada. 9.305 verdes · TS 0 · deploy `QjsylK61vkqb-L1cPEcAf` 4/4.**

⚠️ **E O BUILD FALHOU UMA VEZ POR CULPA MINHA:** deixei um script de medição (`scripts/medir-coca-tmp.ts`) no servidor e o type-check do build o compilou. **O blue-green segurou** — *"o symlink não moveu, prod continua no build anterior"*. Lição pequena e registrada: script temporário no servidor vive em `/tmp`, nunca em `scripts/`.


### ⛔⛔⛔ O IMPORT DE VENDAS DE 10/09 EXPLODIU O ESTOQUE — E O GUARD NASCEU NA PORTA ERRADA (11/09)

**O dono, congelando tudo antes de qualquer conserto:** *"CONGELA E MEDE — nada de consertar antes de responder."* A medição respondeu a pergunta dele (*"de onde saiu 1.499 de Fanta Uva?"*) e **refutou a hipótese da baixa dupla**.

**⛔⛔ A CAUSA, medida contra o arquivo real:** o **Relatório de COMPLEMENTOS** foi subido na aba de **PRODUTOS**. Os dois layouts têm colunas diferentes:

```
PRODUTOS:     [Produto   · **Quantidade**             · Valor Extra · Valor total]
COMPLEMENTOS: [Descrição · **Valor médio por unidade** · Quantidade  · Valor Total]
```

O parser lia **a coluna 1 como quantidade** — e no arquivo errado ela é o **PREÇO**. `R$ 14,99` virou **1.499 unidades**. As 54 linhas (de 86) são as de `R$ 0,00` virando quantidade 0 e sumindo: justamente os sabores inclusos no preço.

**⚠️ A HIPÓTESE DA BAIXA DUPLA NÃO SE CONFIRMOU:** as 6 baixas eram o **estorna-e-refaz do reprocesso funcionando** (3 estornadas + 3 vivas). O estrago era **o −1.499 que deveria ser −1**, não a duplicidade.

**⭐ O FIX DE CLASSE (ordem do dono): coluna se resolve pelo NOME DO CABEÇALHO, nunca pela posição.** `resolverColunas()` acha cada coluna pelo título e, quando o cabeçalho não traz o que se espera, **RECUSA o arquivo dizendo o que achou** — layout novo nunca mais entra calado. Golden com os **DOIS** layouts reais de 10/09.

⚠️ **3 testes foram INVERTIDOS com o motivo escrito:** a casa documentava *"142 linhas e 142.255 unidades"* como o **resultado esperado** de um arquivo trocado. O teste afirmava o defeito.

### ⛔⛔ E O GUARD DE SANIDADE ESTAVA NA PORTA ERRADA — a prova em prod que pegou

Escrevi `sanidade-do-import.ts` e o liguei no `previewImportSuitable` — **a tela de MAPEAMENTO**. A prova em prod mostrou o payload do `processar` (**quem baixa o estoque**) **sem bloco de sanidade nenhum**: o import de 10/09 repetido hoje passaria calado de novo, com o guard "pronto" no arquivo ao lado. ⚠️ *Guard na porta que o dono pode nem abrir no dia não é guard.*

- **`medirSanidade` tem um dono só** (`lib/stock/vendas/medir-sanidade.ts`) — o preview do mapa e o caminho da baixa chamam a MESMA; duas réguas divergiriam no 1º ajuste de fator.
- **O plano CARREGA a pergunta** (`montarPlanoDeLinhas` devolve `sanidade`) e **quem RECUSA é o SERVIDOR** (409 `SANIDADE`), não um diálogo de tela — é a régua do **FREIO da contagem** (23/08). Aviso que mora no componente some no dia em que a rota for chamada por outro caminho, e foi por outro caminho que o estrago entrou.
- ⭐ **Pergunta, nunca recusa cega** (a régua do dono): reenviar com `confirmouSanidade` passa. Encadeado nos **3** caminhos que baixam (import, reprocesso, lançamento manual). Na tela: as frases com o número dele e um checkbox que **nasce desmarcado** — confirmar tem que ser um gesto.

### ⛔⛔ O GUARD ESTRUTURAL E O LIMIAR QUE O TESTE CORRIGIU

*"Valor negativo com saldo positivo é impossível, não improvável — barra na escrita."* `assertSaldoNaoFicaImpossivel` entrou no `criarMovimento`.

⚠️⚠️ **E o teste pegou o limiar errado:** eu escrevi `if (custoTotal >= 0) return`, e **a linha que CRIOU o estado impossível tem `custoTotal` ZERO** — a contagem de **+1.496 a R$ 0,00**. Um guard que só olhasse valor negativo deixaria passar **exatamente o movimento que causou o defeito**. Agora é `> 0`. ⭐ E a baixa que deixa **saldo** negativo continua passando: "vendeu sem produzir" é sinal legítimo, e barrá-lo esconderia o aviso.

**REGRA 11 medida nos três:** parser por posição → **4 vermelhos** · guard estrutural removido → **2** · sanidade fora do `gravarVenda` → **1**.

**O CONSERTO APLICADO, na ordem que o dono aprovou** (`pg_dump pre-conserto-vendas-1009-20260911-013812`): estorno das 3 `BAIXA_VENDA` vivas + das 3 `AJUSTE_CONTAGEM` a R$ 0,00 pelo `estornarMovimento` da casa (ledger imutável) · **sessão de contagem ROTINA de 04/09 FECHADA** (7 dias aberta — *"sessão é FOTO"*) · reimport do arquivo certo.

**PROVADO EM PROD, pelas rotas e funções das telas:**
```
O ARQUIVO CERTO diz FANTA UVA: 1 un   (o trocado dizia 1.499)
o dia 10/09: 437 unidades · 30 produtos mapeados · R$ 2.764,72 baixados
  (o trocado: 53.761 un — 72× a média)

SALDO DOS 3        COCA-COLA 2L 227 · R$ 1.835,64   |  CC Zero 2L 57 · R$ 462,19
                   FANTA UVA 2L   6 · R$    40,86
POSIÇÃO   165 linhas · R$ 136.822,38 · valor negativo: 0 ✓ · custo médio negativo: 0 ✓
CARDÁPIO  165 produtos · COCA COLA 600ML 117 vendas · custo 3,31 · preço 11,00 · margem 70%
          margens impossíveis: 0 ✓ · custos negativos: 0 ✓
JUIZ      E1/E2/E8/C1/P1 = 0
```
⭐ **As 117 vendas da COCA 600 são as 107 que o dono citou + as 10 de 10/09** que agora entraram certas. **Varredura dos outros dias: nenhum inflado** (média 529 un/dia, 10/09 em 437).

**9.285 verdes · TS 0 · deploys `4dbjmd_nPB3UncJw1Yz_v` e `onzxKJE1ct9el5RIXgkCw`, os dois 4/4.**

⚠️ **PENDENTE (é do dono):** conferir os 3 saldos contra a geladeira. Se discordar, a marcyelle reconta **OS 3 numa sessão NOVA de hoje, nunca na velha** — a de 04/09 está fechada.

⚠️ **ACHADO NO CAMINHO, não consertado:** o juiz do estoque voltou 🔴 com **51 issues, nenhuma do ledger** — são **E15** (eventos 210210 em ERRO > 24h, o débito registrado *"sem cron de retry de evento SEFAZ"*), **E7** (itens com saldo nunca contados — a contagem inicial) e **F5** (21 notas sem data de pagamento, R$ 8.588,75). Registrado, não atacado.


### ⛔⛔ O ITEM PRODUZIDO SUMIA DA POSIÇÃO — E O RÓTULO PROMETIA A FONTE ERRADA (11/09)

**⛔ 1. "SEM CUSTO — ENTRA NA 1ª NOTA" NUM ITEM PRODUZIDO.** O dono: *"nota NUNCA vai chegar pra ele — é produzido: o custo nasce da 1ª PRODUÇÃO concluída. **Texto que promete fonte errada me deixa esperando o que não vem.**"* O texto era o mesmo pra todo componente sem custo. ⭐ Agora segue o TIPO, e o sinal é o **mesmo que o botão "produzir agora" já usava** (existe ficha que o produz) — nada de régua nova pra uma pergunta que a tela já sabia responder. O rodapé e o card de "sem custo" cobrem os dois caminhos, porque a lista pode ter comprado e produzido junto.

**⛔⛔ 2. A POSIÇÃO NASCIA DO LEDGER, NÃO DO CATÁLOGO.** `listPosicao` partia de `saldosDaEmpresa` — um `groupBy` em `stockMovement`. **Item com ZERO movimento não existia pra ela.**

**E não era só o item dele: 9 itens ativos estavam invisíveis** — `tomate`, `gas`, 6 porções e a **`HEINEKEN LONG NECK ZERO 330ML`**, justamente uma das bebidas que em 09/09 este doc registrou como *"nasce com saldo 0 e entra na fila de contagem"*. ⚠️ **Elas entraram na contagem e sumiram da tela onde o dono confere o estoque** — a família do *"erro disfarçado de vazio"*.

**⭐ A RÉGUA QUE FICOU:** a Posição é a PRATELEIRA, e **prateleira com zero unidades continua sendo uma linha da prateleira**. Saldo 0 é um **FATO** ("não tem"), não ausência de dado. A lista passa a partir do CATÁLOGO (`ativo` + `seContaFisicamente`) com o saldo DERIVADO.

**⭐⭐ E A MEDIÇÃO MOSTROU QUE A CONTAGEM JÁ ESTAVA CERTA:** `getQuadro` sempre partiu de `stockItem.findMany` — **a Posição é que era a exceção**, e as duas telas agora respondem a mesma coisa (165 linhas nas duas). Duas telas sobre a mesma prateleira dando números diferentes é o defeito que este módulo mais paga.

⚠️ **O que NÃO afrouxou:** invólucro de cardápio (`SABOR`/`PRODUTO_FINAL`) segue fora, item desativado segue fora, e **órfão com saldo sem cadastro continua aparecendo** — esconder por ausência de cadastro esconderia estoque de verdade.

**PROVADO EM PROD:**
```
1) POSIÇÃO   165 linhas (era 156) · "porcao beef de alimenuta" SIM · saldo 0 UN · custo a definir
2) CONTAGEM  165 linhas · o item está lá, saldo sistema 0
3) PRODUÇÃO  ficha ativa v1 — dá pra criar ordem antes do 1º movimento
```
⚠️ **O valor total do estoque não muda com a régua nova** (zero não soma) — a variação entre duas leituras (108.096,20 → 108.057,80) é movimento real da operação acontecendo entre elas, não efeito da mudança.

**REGRA 11 — a régua velha (partir do ledger) deixa 2 vermelhos. 9.265 verdes · TS 0 · deploy `LbnxjSzSEb-jHmVHJGXwD` 4/4.**

### ⛔⛔⛔ E O DEPLOY FALHOU 3× POR OOM — o teto era do V8, não do kernel

**O blue-green segurou as três**: *"o symlink não moveu, prod continua no build anterior"*. Mas o diagnóstico levou duas tentativas erradas, e as duas ficam registradas:

1. **APOSTEI NO AVISO DO TURBOPACK e errei.** O log trazia *"a file was traced that indicates that the WHOLE PROJECT was traced unintentionally"*, apontando `lib/stock/sefaz/server-ca.ts` (um `readFileSync` de caminho que o Turbopack não resolve estaticamente). O `/* turbopackIgnore: true */` **matou o aviso** — e o build **continuou estourando**. *Aviso real não é causa provada.*
2. **A CAUSA MEDIDA:** `FATAL ERROR: Reached heap limit`, e o limite padrão do Node **nesta máquina é 2006 MB** — o build do Next passou disso. ⚠️ **Não é o OOM killer de 24/08** (aquele era o kernel matando o processo); é o **próprio V8** batendo no teto dele, com **3,2 GB livres**. Fix: `NODE_OPTIONS=--max-old-space-size=3072` no build do `deploy.sh`.

⚠️ **A migration TINHA sido aplicada** nas três tentativas (ela roda antes do build): prod ficou com a tabela nova e o código velho — inofensivo por ser CREATE-only e sem leitor, mas vale saber que o deploy não é atômico entre schema e código.

⚠️ **PENDENTE (é do dono):** navegar o card e conciliar a Box Paper e a Oesa com baixa parcial — as duas estão prontas na tela, e a régua do restante em aberto só se prova com o clique dele.

## ⛔⛔⛔ INCIDENTE 28/08 — LOGIN 500 POR 8 HORAS COM O TRIO VERDE. O GATE PROVAVA PRESENÇA, NÃO SAÚDE.

**O ERRO FOI MEU, e a lição vale mais que ele.** No comando de deploy da rodada anterior rodei `git reset --hard` (que **reverte `prisma/schema.prisma` pra `sqlite`** — o swap-postgres é passo MANUAL do runbook) e em seguida `npx prisma generate` **sem o swap**. Como o **`node_modules` é COMPARTILHADO por hard link** com o workspace de build, o client gerado virou SQLite; o app subiu com ele e **toda query ao banco morria**: *"the URL must start with the protocol `file:`"*. Log real: `[LOGIN] Erro interno: PrismaClientInitializationError`.

**⚠️⚠️ O PIOR NÃO FOI O ERRO — FOI O TRIO FICAR VERDE 8 HORAS.** BUILD_ID ok · pm2 online, uptime 28.557s, sem loop · CSS servindo do build novo. **A home é ESTÁTICA e respondia 200 enquanto o login dava 500.** O gate provava que o site era **SERVIDO**, nunca que ele **FALAVA COM O BANCO**. *Gate que não enxerga banco fora do ar não é gate de saúde — é gate de presença.*

**⚠️ E O ROLLBACK NÃO RESOLVERIA** (o dono pediu "rollback imediato", e a resposta certa era outra): o build estava **íntegro**; o quebrado era o **client gerado, compartilhado por TODOS os builds**. Voltar de build daria um `✓ ROLLBACK OK` com o site ainda quebrado — mentira no pior momento possível. **Fix real:** `swap-prisma-to-postgres.sh` + `prisma generate` + `pm2 restart` (o client em disco já estava certo desde a correção anterior; era o PROCESSO que segurava o antigo em memória).

**AS 3 CAMADAS PRA NUNCA VOLTAR:**
1. **IMPOSSÍVEL POR CONSTRUÇÃO (REGRA 5)** — o `deploy.sh` confere o provider do schema, **roda o swap sozinho** se preciso, gera e **ABORTA** se o client não ficar `postgresql`. O swap deixou de depender de alguém lembrar. **PROVADO:** deployei de propósito **sem** o swap manual e o log disse *"schema em 'sqlite' — rodando o swap pra postgres → ✓ prisma client em postgresql"*.
2. **PROVADO EM RUNTIME** — o trio virou **4/4**: sonda que faz **POST no login com credencial proposital inválida e exige 401**. 500 = banco inalcançável. Sem senha real, sem efeito colateral, sem criar nada. **O `rollback.sh` ganhou a mesma sonda** e, se o login seguir quebrado depois de voltar, ele **diz que a causa não era o build** e aponta o Prisma.
3. **AUDITADO POST-FACTUM** — **D4** no juiz noturno: provider do client gerado ≠ provider do schema = **erro**, com o comando que resolve **e** o aviso de que rollback não adianta.

⚠️ **PEGADINHA que me enganou na 1ª leitura:** `grep "provider ="` no schema devolve **`prisma-client-js`** (do bloco `generator`), não o do `datasource`. `extrairProviderDatasource` lê o bloco certo — e tem teste pra isso.

**PROVA DE VOLTA (28/08):** login **401** com a mensagem correta (local e pelo IP público) · home 200 · deploy **4/4 verde** · juiz **D1-D4 🟢 0 achados**. 9 testes novos.

⚠️ **ACHADO À PARTE (pré-existente, NÃO é a queda):** `contaia.com.br` **não tem registro DNS** (`dig` vazio) — prod é acessado por **`http://198.211.103.10`**. O `smoke` que testa o domínio sempre devolveu 000. Resolver quando for publicar o domínio.

## ⛔⛔ DEPLOY QUE NUNCA DERRUBA PROD (26/08/2026) — USE `scripts/deploy.sh`

**Regra do dono:** com cliente pagando, *"deploy quebrou o site" NÃO PODE EXISTIR como categoria de evento.*

**A CAUSA COMUM DOS 3 INCIDENTES ERA UMA SÓ: o build mexia no diretório VIVO.**
| quando | o que matou o build | o que o cliente viu |
|---|---|---|
| 24/08 | `npm run build \| grep \| head` → **SIGPIPE** no meio da escrita do `.next` | pm2 em loop, site fora |
| 24/08 | **OOM killer** no type-check (servidor sem swap) | idem |
| 26/08 | build escreveu **por cima do `.next` que o pm2 servia** | **página sem CSS** por segundos |

⚠️ O incidente de 26/08 tem o log exato: `CSS 404 às 16:35:00` → `200 às 16:36:56`. Janela de troca. **Não foi OOM** (build completou, swap em 68 MB) e **não foi build parcial** — o build estava íntegro. Foi o instante da substituição. E o navegador do dono guardou a página quebrada em cache; um hard-reload já resolvia.

**O DESENHO NOVO — o build não encosta no que está no ar:**
```
.next                       → SYMLINK
.next-builds/<stamp>-<sha>  → onde cada build mora (mantém os 3 últimos, 155 MB cada)
```
`next.config.mjs` ganhou `distDir: process.env.NEXT_DIST_DIR || '.next'`. O build vai pro diretório novo; **só depois de PROVADO pronto** o symlink troca (`mv -T` de symlink é `rename(2)` — não existe instante "meio trocado"). **Build que falha por qualquer motivo não move o symlink: prod continua no build anterior INTACTO.** Falha de build virou não-evento pro cliente.

**GATE ANTES:** memória disponível ≥ 2200 MB, swap ≥ 1 GB, disco ≥ 2 GB. **Abortar cedo é melhor que deixar o kernel matar no meio** — build morto pela metade foi o que quebrou prod em 24/08.
**VERIFICAÇÃO DO ARTEFATO:** BUILD_ID existe + tem CSS + tem `server/`. Sem os três, apaga o build e nem troca.
**GATE DEPOIS — O TRIO (só declara sucesso com os três):** (1) BUILD_ID servido == o buildado; (2) pm2 `online` **e o MESMO processo depois de 10s** — ⚠️ em 24/08 o smoke passou VERDE com o processo em loop, porque o nginx ainda servia a resposta do processo anterior; uptime crescendo é o que distingue "no ar" de "reiniciando sem parar"; (3) **TODOS** os CSS que o HTML referencia respondendo 200 **e vindos do build novo** — o smoke antigo checava só o primeiro que achava, e a home pede dois.

**⏪ ROLLBACK EM UM COMANDO — `bash scripts/rollback.sh`** (segundos, sem rebuild). `--lista` mostra os builds; `<nome>` volta pra um específico. Roda o mesmo gate depois.

**JUIZ D1/D2/D3 (`lib/infra/deploy-health.ts`)** no cron das 3h: **D1 (erro)** `.next` sem BUILD_ID ou sem CSS — os dois estados que derrubaram prod; **D2 (aviso)** `.next` virou diretório real (alguém buildou por cima do vivo) — ⚠️ **isso o smoke NUNCA pegaria**: responde 200 normalmente e mesmo assim jogou fora a troca atômica e o rollback; **D3 (aviso)** menos de 2 builds guardados = rollback exigiria rebuild. D1 não empilha com "sem CSS" (uma causa, um alerta — mesma disciplina do N1/N3).

**⚠️ O DESENHO SE PAGOU NO PRIMEIRO DIA: 3 builds falharam em sequência e prod não sentiu um segundo.** As causas, todas descobertas em 26/08 tentando fazer o build sair do diretório vivo: (1) **`distDir` aninhado** (`.next-builds/<sha>`) — o Next gera os arquivos de tipo com caminho relativo de 3 níveis assumindo profundidade 1; (2) **`distDir` plano** — mesma morte, e aí veio a causa REAL: o **`tsconfig.json` inclui `.next/types/**/*.ts`**, então com qualquer `distDir` diferente o TypeScript lê o `validator.ts` **VELHO** do build anterior. Não dá pra contornar por configuração; (3) **`node_modules` por SYMLINK** no workspace — o **Turbopack recusa** ("Symlink [project]/node_modules is invalid, it points out of the filesystem root"). **SOLUÇÃO:** buildar numa **CÓPIA do repo** (`/opt/conta-ia-build`, `rsync` sem node_modules/.next), com **node_modules por HARD LINK** (`cp -al` — instantâneo, mesmo inode, e é diretório de verdade), o `.next` PADRÃO lá dentro, e `mv` do artefato pronto pro lado do app (mesmo filesystem = rename). ⚠️ **`NEXT_DIST_DIR` continua no `next.config.mjs` como escape hatch, mas o deploy NÃO o usa** — o comentário lá explica por quê.

**⚠️ NÃO rodar `npm run build` na mão no servidor** — volta a escrever no diretório vivo e o D2 vai acusar. Use sempre `bash scripts/deploy.sh`.

**MEMÓRIA — leitura DURANTE o build de 26/08 (o gatilho (b) NÃO disparou):** memória disponível no pico **431 MB** de 3.915 · swap **68 MB** de 2.047 · **zero OOM kills**. O build come ~3,5 GB e sobrevive, mas com ~11% de folga. O gatilho (b) do upgrade 4→8 GB é *"swap usado em operação normal, FORA de build"* — swap está em 68 MB, bem abaixo dos 256 MB do N1. **Não disparou.** ⚠️ E com o deploy em diretório separado, um OOM durante o build passou a ser **inofensivo** (o symlink não move): a urgência do resize CAIU. O gatilho que continua valendo é o **(a)** — a rotina real começar.

## 🛡⭐⭐⭐ FASE 0 — A CHAVE RESERVA (backup 3-2-1 + disco + os 3 ajustes, 26/10/2026)

**Risco zero, nada visível muda.** ⛔ Zero toque em dado · migration ADITIVA (3 `CREATE INDEX IF
NOT EXISTS`, no-op em prod) · deploy 4/4 (`DBzJ2ye6PbCSLjd7MRdBw`, SHA `d8e34690`).

### ⭐ PASSO 1 — O DISCO: **NÃO recomendar o upgrade** (o veredito, com número)

```
116G total · 10G usado · 105G livres → 9% usado / 91% livre     (gatilho era "abaixo de ~40% livre")
faxina de builds agendada 5h (MANTER=3) · 3 dirs de 191M cada
```
⛔ **NÃO aumentei nada por conta própria** — resize é clique do dono, e aqui ele **não é
necessário**. ⚠️ **Dois achados do disco, decisão dele:** **1.2G em 397 dumps SEM retenção** em
`/var/backups/conta-ia` (o `pg_dump` pré-sprint nunca foi expurgado) e **27 dumps de 0 BYTES** — a
cicatriz de 28/09 (*dump só conta depois de conferir o TAMANHO*) deixando rastro no disco.

### ⛔⛔⛔ PASSO 2 — O BACKUP EXISTE, ESTÁ AGENDADO, E **ABORTA SEM AS CHAVES** (é o bloqueio)

`backup-diario.sh` (2h30) faz `pg_dump -Fc` → cofre EXTERNO via rclone, retenção **30 diárias + 12
mensais**. ⭐ **E ele PARA no lugar certo**, provado rodando em prod:
```
FALHOU 2026-10-26T23:57:33-03:00  falta /opt/conta-ia/.env.backup — o dono ainda nao deu as 2 chaves do cofre
```
⚠️ **`.env.backup` NÃO EXISTE e o rclone NÃO está instalado** — então **hoje NÃO HÁ cópia do banco
fora desta máquina**. ⛔ **Nada de chave inventada nem cofre na mesma máquina:** cofre no próprio
droplet não é backup, é uma segunda pasta do mesmo ponto de falha. **O passo a passo está no
relatório ao dono; o sistema espera as 2 chaves.**

### ⭐⭐ PASSO 3 — A PROVA DE RESTAURAÇÃO: **OK, e ela restaura de verdade**

`backup-prova.sh` (dom 4h) restaura num banco **TEMPORÁRIO**, confere contagens-chave, **apaga o
temporário** e grava o state. Medido em prod: `OK · pre-grupo-vigiado-20261023-001809.dump`.
⭐ *Backup que ninguém restaurou é esperança, não cópia* — e é por isso que o teste é semanal e
avisa quando falha, em vez de supor.

### ⭐⭐ PASSO 4 — OS DOIS ALARMES NOVOS CHEGAM NO E-MAIL (N4 · N5/N6)

**N4** (`lib/infra/health.ts`): disco acima de **80%** usado. **N5/N6**
(`lib/infra/chave-reserva.ts`): backup diário FALHOU / mais velho que **36h**, e a prova de
restauração mais velha que **10 dias**.

- ⭐⭐ **`CheckChaveReserva` nasceu com o MESMO shape de `CheckInfra`** (`invariante`/`nivel`/
  `detalhe`), e isso é o que faz o array misto do payload renderizar — `judge-alert-email.ts:8`
  declara exatamente esse formato e a linha 36 itera nele. **Shape diferente sairia no e-mail como
  `undefined undefined`**, e alarme ilegível é alarme que o dono aprende a ignorar.
- ⛔ **Estado malformado vira `null`, nunca um "OK" otimista:** um `.state` truncado é precisamente
  o caso em que não se pode afirmar que o backup correu bem.
- ⛔ **O gate do aviso soma `reserva.checks`** (`cron-judge.ts:115`) e o payload leva
  `...reserva.checks` (136) — com o N5 vermelho, o e-mail das 3h carrega a frase inteira, incluindo
  *"se o droplet morrer, morre o dado com ele"*. **O teste trava o payload** (`chave-reserva.test.ts`).

**Medido em prod:** disco 9% · swap **171 MB** (abaixo do N1 de 256 → **o gatilho (b) do upgrade
4→8 GB NÃO disparou**) · `avaliarInfra` **verde** · `checkChaveReserva` **vermelho no N5**, que é o
estado honesto.

### ⭐⭐ PASSO 5 — OS ÍNDICES DA AUDITORIA, E O TETO DE POOL

3 `@@index` em `transactions` (`supplierId` · `employeeId` · `categoryId`), criados em prod **à mão
com `CREATE INDEX CONCURRENTLY`** (não trava a tabela quente) e declarados no schema com migration
**`IF NOT EXISTS`** — no-op em prod, cria em instalação nova. ⚠️ **`transactions_employeeId_idx` já
existia no banco desde `20260606000000` e nunca estava declarado: DRIFT schema×banco**, que um
`migrate diff` futuro tentaria recriar.

⚠️ **O ganho de HOJE é pequeno e está medido** (10.547 linhas / 13 MB, tabela inteira em cache):
Seq Scan 2,67ms → Index Scan com `shared hit` **575 → 5 páginas**. ⭐ **Eles valem por CRESCIMENTO,
nunca pelo badge de 1,3s** — esse é CPU no app (`reconhecerFornecedor` linha a linha), e a decisão
do dono de 11/09 continua valendo: *"performance se resolve com cache, nunca com número errado"*.

**⛔⛔⛔ E EU CRIEI 2 ÍNDICES DUPLICADOS EM PROD — defeito meu, achado e curado no mesmo passo.** A
tabela ficou com `transactions_categoryId_idx` **e** `transactions_categoryid_idx` (96 kB cada,
MESMA coluna), idem `supplierId`. **A causa:** em Postgres **identificador sem aspas é dobrado pra
minúsculo**, e eu rodei o `CREATE INDEX CONCURRENTLY` a primeira vez **sem aspas no nome**.
⚠️ Índice duplicado em tabela quente é **custo de escrita puro** — todo INSERT/UPDATE mantém os
dois. Curado com **`DROP INDEX CONCURRENTLY`** (que também não trava): **31 → 29 índices**, e os
três que sobraram são exatamente os nomes que o `@@index` gera, então **banco e schema convergem**.

**⭐ O TETO DE POOL (`connection_limit=5` pras 2 vCPU)** — `lib/db.ts`. ⚠️ **ELE NÃO MUDA NADA
HOJE:** o default do Prisma é `num_cpus × 2 + 1`, que em 2 vCPU dá **exatamente 5**. O que muda é o
teto deixar de ser implícito — num resize 2→4 vCPU o default saltaria pra 9 **em silêncio**.

- ⛔⛔ **POR QUE NO CLIENT E NÃO NO `.env`:** a variável de ambiente alcançaria **TODO** consumidor —
  inclusive os ~100 scripts de `scripts/`, que criam `PrismaClient` próprio, e o próprio
  `prisma migrate`. No client fica escopado ao processo LONGO do app, que é quem tem pool de
  verdade; script curto abre, faz e fecha.
- ⛔⛔⛔ **A RÉGUA MORA EM MÓDULO PURO (`lib/db/teto-de-conexoes.ts`), E O MOTIVO É UM INCIDENTE:**
  a 1ª versão mexia em QUALQUER URI, e **`file:` é *special scheme* no WHATWG URL** — então
  `new URL('file:./dev.db')` resolve o caminho relativo **contra a RAIZ do sistema** e devolve
  `file:///dev.db`. O engine passava a abrir `/dev.db` → **SQLITE_CANTOPEN (code 14) → 198 arquivos
  de teste vermelhos de uma vez, 1.474 testes, com cara de 198 defeitos de negócio**. Em produção
  (`postgresql://`) a URI saía perfeita, então **o estrago vivia SÓ no dev** — a mesma classe do
  `contains` case-sensitive (28/08): funciona num banco e falha calado no outro.
- ⭐ **ALLOWLIST, nunca denylist** (`postgresql:`/`postgres:`/`mysql:`): protocolo novo cai no lado
  que **NÃO MEXE**. *O erro seguro é um teto de pool não declarado; o inseguro é a URI do banco
  reescrita por uma função que não entende aquele protocolo.*
- ⚠️ **Fail-soft, e o `catch` NÃO imprime a exceção** — a mensagem do Prisma/URL **vaza a URI com a
  senha** (a cicatriz de 07/10).
- ⚠️ **Ela não mora em `lib/db.ts` de propósito:** aquele arquivo **instancia o `PrismaClient` no
  topo**, então um teste que o importasse abriria conexão. ***Regra que mora num arquivo que
  instancia client é regra que ninguém prova*** — e esta precisava ser provada.
- ⚠️⚠️ **E A REGRA 11 ACHOU UMA LINHA QUE FINGIA SER TRAVA:** o cinto que confere
  `host`/`pathname` depois da reescrita é **INALCANÇÁVEL hoje** — repondo o defeito (removendo as 2
  linhas), **os 19 testes ficam VERDES**, porque a allowlist já barra tudo que não é postgres/mysql
  e nesses o round-trip preserva host e pathname **por construção**. ⭐ **Ele FICA** pelo dia em que
  alguém acrescentar à allowlist um protocolo cujo round-trip NÃO seja lossless — **com a medição
  escrita no código E no teste**, pra ninguém chamá-lo de trava em funcionamento (o mesmo desenho do
  `IS NOT NULL` redundante dos CHECKs de 14/10).

### ⭐ PASSO 6 — `send-now` EXIGE PAPEL (o furo do e-mail)

`POST /api/alerts/send-now` dispara `runAlertsJob`, que faz
`user.findMany({ emailAlertsEnabled: true })` — **varre os usuários da PLATAFORMA INTEIRA**, sem
filtro por empresa nem por quem pediu. ⛔⛔ **E até hoje aceitava QUALQUER LOGADO**, com o
comentário prometendo *"só ADMIN"* ao lado de um corpo que dizia *"pra MVP: aceita qualquer user
logado"*. ***Comentário que promete ser a trava sem ser a trava é pior que comentário nenhum.***

⭐ Agora é o padrão (B) da casa (`getAdminSession` → `loadGerenciador`). ⚠️ **403 e não 401, com o
motivo escrito:** o cookie `admin_session` é de `admin.caixaos.com.br` e não chega aqui — responder
401 a quem está com a sessão ótima diria *"sua sessão expirou"* e mandaria o dono caçar um problema
de login que não existe.

**PROVADO EM PROD (sessão real de OWNER, `dryRun`):** `HTTP 403 · code FORBIDDEN_RBAC · nenhum
e-mail disparado`. ⛔ **Não chamei o caminho admin de propósito** — ele envia e-mail de verdade pra
toda a plataforma; esse lado está travado na suíte (`__tests__/alertas/send-now-exige-admin.test.ts`).

### ⛔⛔ ACHADO NO CAMINHO — OS 4 SCRIPTS DO CRON VIVIAM **SÓ NO SERVIDOR**

O `git status` de `scripts/` em prod trouxe 4 **untracked**: `backup-diario.sh` (2h30) ·
`backup-prova.sh` (dom 4h) · `faxina-builds.sh` (5h) · `_db-uri.sh`. ⚠️ ***O script de BACKUP
existia só na máquina que ele existe pra proteger*** — droplet morto levaria os três com ele.
Versionados (commit `f05d7c27`), com a permissão de execução preservada.

⚠️ **E o meu grep de credencial deu 2 falsos positivos:** `_db-uri.sh` **lê** o `DATABASE_URL` do
`.env` (nunca imprime a URI) e a linha que casou em `backup-prova.sh` é **um comentário dizendo que
a senha não aparece**. *Achado não atribuível não é achado.* **Credencial segue só no `.env` do
servidor, nunca no repo.**

### ⚠️ TRÊS ERROS DE SONDA MEUS, e os três da mesma família

(a) **chutei os campos do check** (`codigo`/`mensagem`; são **`invariante`/`detalhe`**) e a sonda
imprimiu **`[erro] undefined undefined`** — com cara de alarme quebrado numa lib correta; (b)
**`${PIPESTATUS[0]}` é bashism** — no zsh é `$pipestatus[1]`, e medir exit code de pipeline exige
redirecionar pra arquivo; (c) **`grep --include=*.ts` sem aspas abortou com `no matches found`** e
devolveu **saída vazia**, que eu quase li como *"ninguém consome `infraChecks`"* — a **REGRA 8b**
na minha própria verificação. ***Nome de campo e forma de comando se LEEM, nunca se chutam.***

⚠️ E **o SSH caiu num deploy anterior desta frente (exit 255)**: daqui pra frente o deploy roda com
`ServerAliveInterval` e **log em arquivo no servidor**, porque ***deploy cujo gate eu não li é
deploy não provado***.

### 📋 NÍVEL 2 — REGISTRADO, **NÃO CONSTRUÍDO** (ordem do dono)

1. **WAL / PITR** (point-in-time recovery) — hoje o backup é snapshot diário: perda máxima de ~24h.
   Com WAL arquivado, a recuperação vai ao minuto. ⚠️ Exige espaço e um destino de WAL.
2. **Postgres em máquina separada** — hoje app e banco dividem o mesmo droplet (2 vCPU), então
   build e banco competem por CPU/RAM, e um OOM alcança os dois.
3. **Schedulers FORA do processo do site** — o `instrumentation.ts` sobe o scheduler de recorrentes
   dentro do processo do Next; um reload do pm2 no meio de uma janela é perda silenciosa.

### 📋 FICA PRO DONO

1. ⛔⛔ **AS 2 CHAVES DO COFRE** — é o único bloqueio real da FASE 0, e **enquanto ele estiver aberto
   NÃO existe cópia do banco fora da máquina**. O passo a passo está no relatório.
2. ⚠️ **Os 2 índices duplicados que eu criei já foram dropados** (`DROP INDEX CONCURRENTLY`, sem
   travar) — fica registrado porque o defeito foi meu e o rastro importa.
3. ⚠️ **397 dumps / 1,2 GB sem retenção** em `/var/backups/conta-ia`, dos quais **27 têm 0 bytes**.
   Decisão dele se expurga (o backup novo já nasce com retenção; estes são os pré-sprint).
4. ⚠️ **O achado de SSH das sessões anteriores segue em aberto, e nada foi alterado (REGRA 2):**
   ~1,79 milhão de tentativas falhas · `permitrootlogin yes` · `passwordauthentication yes` ·
   **fail2ban INACTIVE** · 1 chave expirada `dotty_ssh`.
5. ⚠️ **`/api/alerts/send-now` não tem chamador nenhum** — *porta sem maçaneta*: ou ganha botão no
   painel admin, ou o teste fica escopado só pro próprio usuário.

## Ordem de deploy (PJ + PF)

**⚠️ SWAP DE 2GB É OBRIGATÓRIO NO SERVIDOR (25/08).** O `npm run build` do Next roda o type-check num worker que chega a **~1,9 GB de RSS**; o servidor tem 3,9 GB e estava **sem swap nenhum** → o OOM killer matava o worker (`signal: SIGKILL`) e o `.next` ficava **sem `BUILD_ID`**, deixando o pm2 em loop de erro. **Não adianta mexer no `--max-old-space-size`:** teto alto (2560) o kernel mata igual; teto baixo (1400) o próprio V8 aborta por heap insuficiente (`SIGABRT`) — o type-check PRECISA de ~2 GB. Criado em 25/08: `fallocate -l 2G /swapfile && chmod 600 && mkswap && swapon` + linha no `/etc/fstab` (persiste no reboot). Build voltou a passar de primeira. **Servidor novo nasce quebrado sem isso** — incluir no provisionamento junto com o poppler. Pra desfazer: `swapoff /swapfile && rm /swapfile` + tirar a linha do fstab.

**⭐ GATILHO DO UPGRADE 4 → 8 GB (combinado com o dono em 25/08).** Hoje o droplet é **DigitalOcean `s-2vcpu-4gb` em nyc1** (2 vCPU · 3,9 GB RAM · 116 GB disco) + 2 GB de swap. Fica assim **enquanto é fase de teste**. **Sobe pra 8 GB quando o PRIMEIRO destes disparar:** **(a)** a rotina real começar (Cristian operando + contagem inicial feita + notas entrando todo dia); **(b)** o **swap for usado em operação normal, fora do build** — é o invariante **N1** do juiz, que avisa por e-mail sozinho; **(c)** entrar o **segundo cliente**. **PASSO-A-PASSO (DigitalOcean):** painel → o droplet `contaia-prod` → **Resize** → escolher **"CPU and RAM only"** (⚠️ NÃO "Disk, CPU and RAM": a que mexe em disco é **irreversível**, não dá pra voltar; a de CPU/RAM é reversível) → escolher o plano de 8 GB → o painel **exige desligar o droplet antes** (Power Off) → Resize → Power On. **DOWNTIME estimado: 2 a 5 minutos** (desligar + redimensionar + bootar), mais ~15s de boot do pm2 — o pm2 sobe sozinho no reboot. É janela curta, mas é queda: **combinar horário com o dono**, nunca em horário de recebimento de nota. **Depois do upgrade:** conferir `free -m` (tem que dizer ~8 GB), rodar `npx tsx scripts/cron-judge.ts` e ver o N1/N2 verdes, e **manter o swap** (ele deixa de ser muleta e vira rede).

**Dependência de SISTEMA (não-npm):** `poppler-utils` (binário `pdftotext`) — usado pelo enriquecimento de contraparte por PDF (`lib/bank-statement-pdf/extract-pdf-text.ts`, único ponto que invoca poppler). **Servidor novo nasce quebrado sem isso** — incluir no provisionamento: `apt-get install -y poppler-utils`. Validar com `which pdftotext`. Instalado no CAIXAOS em 31/07/2026.

Sequência **crítica** (bug pego na Fatia 1 quando `npm ci` rodou `prisma generate` antes do swap):

```
# ANTES do pull: descartar o swap-postgres local (senão o pull ABORTA calado).
# ⚠️ O lock é prisma/migrations/migration_lock.toml (NÃO prisma/migration_lock.toml).
git checkout -- prisma/schema.prisma prisma/migrations/migration_lock.toml
git pull origin main
./scripts/swap-prisma-to-postgres.sh       # troca schema sqlite→postgres
npm ci --legacy-peer-deps
npx prisma generate                         # ⚠️ DEPOIS do swap
npx prisma migrate status                   # confirma migrations pendentes
npx prisma migrate deploy                   # aplica
npm run build
pm2 reload conta-ia --update-env
pm2 list | grep conta-ia                    # confirma online
bash scripts/smoke-deploy.sh                 # ⚠️ OBRIGATÓRIO — home 200 NÃO basta
```

`pg_dump -Fc` em `/var/backups/conta-ia/pre-<sprint>-YYYYMMDD-HHMMSS.dump` **antes** de toda migration.

- **⚠️ "HOME 200" NÃO É SMOKE — a página pode responder 200 e renderizar SEM CSS (16/08).** Sintoma: HTML puro, links azuis sublinhados, header duplicado. Causa: após `rm -rf .next` + rebuild, o `pm2 reload` (graceful) deixa o processo **servindo o build VELHO** — o HTML aponta CSS com hash que o rebuild apagou → 404 → site sem estilo. **FIX: `pm2 restart` (full, NÃO reload) sempre que fizer `rm -rf .next`** — reload só troca env, restart recarrega o build. **SMOKE OBRIGATÓRIO** (`scripts/smoke-deploy.sh`): extrai o `<link>` CSS do HTML servido e verifica que retorna 200 (o CSS neste Next fica em `.next/static/chunks/*.css`, não `/css/`). "deploy ok" com site quebrado aconteceu porque o smoke era só `curl -w %{http_code} /` = 200. Agora o smoke morde. **COROLÁRIO 502 (17/08):** o smoke tem que rodar **DEPOIS** do restart terminar — se o build falha no type-check (ex: `JsonValue not assignable to string` quando schema e coluna divergem) o `.next` fica parcial e o app sobe **502**. `curl` do domínio público (não localhost) pega o 502; "build sem erro" no terminal não basta se o restart não completou.
- **⚠️⚠️ `npm run build | grep ... | head -N` DERRUBA PROD — o `head` mata o build por SIGPIPE (24/08, prod ficou FORA DO AR).** Eu rodava o deploy com `npm run build 2>&1 | grep -iE "Compiled successfully|error" | head -2` pra encurtar o output. **A lista de rotas que o Next imprime no fim tem `├ ƒ /api/client-error-report`, que casa com `-i error`** → o `head -2` completou suas 2 linhas, fechou o pipe, e o `npm run build` levou **SIGPIPE no meio da escrita do `.next`**. Resultado: `.next` sem `BUILD_ID`, `pm2 restart` subindo e morrendo em loop (`errored`, 16 restarts), **site fora**. O terminal tinha mostrado "✓ Compiled successfully" — o build REALMENTE compilou; morreu na etapa seguinte. **LIÇÃO (irmã da que já estava aqui, "build sem erro no terminal não basta"): NUNCA canalizar o build pra `head`/`grep -m`/qualquer coisa que feche o pipe cedo.** Se quiser encurtar, redirecione pra arquivo e leia depois (`npm run build > /tmp/build.log 2>&1; tail -20 /tmp/build.log`), ou use `| tail -N` (tail lê tudo até o fim, não fecha cedo). **E o smoke SÓ VALE DEPOIS de conferir que o `.next/BUILD_ID` existe e que o `pm2 list` diz `online` com uptime crescendo** — o smoke passou verde num momento em que o processo já estava reiniciando em loop, porque o nginx ainda servia a resposta do processo anterior.
- **⚠️ `git add <path-inexistente>` ABORTA CALADO — todo o commit vira no-op silencioso (17/08, mordeu 3× no MESMO commit).** Ao mover `/api/admin/juiz` → `/api/juiz` fiz `git add` incluindo o dir `app/api/admin` já apagado; o git recusou o comando INTEIRO (exit≠0, mensagem some no meio do output) → **nada foi stageado**: nem a página com o fetch corrigido, nem o `schema.prisma detail String`, nem outro arquivo. O `git commit` seguinte "funcionou" (commitou o que já estava staged de antes) e eu dei por feito. Efeito: a TELA continuava chamando `/api/admin/juiz` (404) e o SERVIDOR tinha `detail Json` (o valor original — meu fix pra String nunca colou; **NÃO foi passo de deploy reescrevendo schema**, foi commit que não pegou). **REGRA: depois de todo commit que MOVE/RENOMEIA/apaga arquivo, PROVAR o conteúdo commitado com `git show HEAD:<arquivo>`** (não `git status`, não `git log --stat` — o conteúdo REAL da linha que importa). `git add -A` no lugar de listar paths também evita (não referencia path morto).
- **Relatório com `detail` malformado NÃO pode derrubar o GET (17/08).** O `/api/juiz` fazia `rows.map(r => JSON.parse(r.detail))` — UMA linha legado com `detail` objeto (coluna era `Json` no servidor) estourava o `.map` inteiro → GET 500 → o selo caía no CINZA "nunca rodou" (mentira: tinha rodado). **Mesma causa derrubava DOIS lugares** (o selo e a tela /juiz) — a correção tinha que valer pros dois (parse resiliente na FONTE → casca fina). Fix: `parseDetail(d: unknown)` no escopo do módulo — aceita objeto (Json/legado), string (parse), ou default `{byCompany:[],sharedTx:[],balanceChecks:[]}`; **nunca throw**. Um dado ruim degrada UMA linha, não a lista. **Selo tem 4 estados DISTINTOS** (`judge-selo-state.ts`, função pura testada): 🟢 verde `<24h` e ok · 🔴 vermelho `<24h` e falha · 🟡 **amarelo relatório existe mas `>24h` = cron parado, avisa DESDE QUANDO** · ⚪ cinza zero relatório. A IDADE decide, não a existência (o amarelo caía no cinza — REGRA 1, `judge-selo-state.test.ts`).

## ⭐ INVARIANTES DE INFRA — o juiz olha a máquina também (25/08)

Nasceu do episódio de 24-25/08: o `next build` foi morto pelo OOM killer **três vezes**, o `.next` ficou sem `BUILD_ID`, o pm2 entrou em loop — e **nada no sistema avisou**. O juiz olhava dinheiro e estoque; a máquina embaixo deles era ponto cego. Decisão do dono: *"infra também merece invariante"*.

`lib/infra/health.ts` (motor PURO + leitura do `/proc/meminfo`), rodado pelo **cron das 3h** (`cron-judge.ts`) e incluído no **e-mail de alerta** — e o e-mail passa a ser disparado por infra sozinha, mesmo com dinheiro e estoque verdes.

- **N3 (erro)** — servidor com menos de 1 GB de swap. É o estado exato que derrubou prod: sem folga, o type-check do build é morto pelo OOM e o `.next` fica sem `BUILD_ID`.
- **N1 (erro)** — mais de 256 MB de swap em uso. ⚠️ **O horário é o que dá sentido ao número:** às 3h NÃO há build rodando, então swap em uso ali não é o build respirando — é a operação normal já não cabendo na RAM. **É o gatilho (b) do upgrade pra 8 GB.**
- **N2 (aviso)** — menos de 15% da memória disponível. Avisa, não deixa vermelho.

**N1 não acumula sobre N3:** máquina sem swap dispara só o N3 — uma causa, um alerta (senão o e-mail vira ruído e o dono para de ler). 8 testes, incluindo a leitura REAL do servidor antes e depois do swap.

