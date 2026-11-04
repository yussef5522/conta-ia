# Leis de tela — referencia visual, densidade, molde de layout

> Extraido do CLAUDE.md em 2026-11-04. Backup integral: `docs/memoria/CLAUDE-completo-2026-11-04.md`.
> Ler POR TRECHO (`grep -n` + `sed -n`), nunca inteiro.

## Indice

- 🎨 CUSTOS FIXOS — CARTÕES SÓLIDOS + DIETA DE TEXTO (10/10/2026)
- ⭐⭐⭐ QUEM PAGA A CASA v4 — A LEI DAS COLUNAS + CMV + O CARTÃO DE PRODUTO (13/10/2026)
- 🎨⭐⭐⭐ A CARA NOVA DO SISTEMA — FUNDAÇÃO FASE 1 (14/10/2026)
- 🧺⭐⭐⭐ O CARTÃO DE PRODUTO VIROU CESTA + O CAMPO DE PREÇO CONSERTADO (14/10/2026)
- ⭐⭐ QUEM PAGA A CASA v3.1 — A LEI DE LAYOUT: LARGURA CHEIA + DUPLAS (08/10/2026)
- ⭐⭐⭐ QUEM PAGA A CASA v3 — A REFERÊNCIA VISUAL VIROU LEI, E O GUARD LÊ O ARQUIVO (07/10/2026)
- ⭐⭐⭐ A ETIQUETA VIROU A TELA — E A LIÇÃO É SOBRE ENSINO, NÃO SOBRE LÓGICA (31/08/2026)
- ⛔⛔ "RÓTULO SOZINHO NÃO VIRA LINHA" ERA REGRA ERRADA — E O ASSASSINO NÃO ERA O SUSPEITO (31/08/2026)
- ⭐⭐⭐ EDITOR DE MODELO DE ETIQUETA — O DONO DESENHA (30/08/2026)
- ⭐⭐⭐ A TORNEIRA — TELA DE ETIQUETAS COM PRÉVIA EM TAMANHO REAL (30/08/2026)
- ⭐ DENSIDADE / MOLDE DE LAYOUT (23/08/2026, EM PROD — toda tela nova segue)

---
## 🎨 CUSTOS FIXOS — CARTÕES SÓLIDOS + DIETA DE TEXTO (10/10/2026)

**Opção A do dono:** *"cor sólida cheia, número branco — cores de vida"*, cada cartão em **3 linhas**, e *"TODOS os parágrafos dos cartões MORREM e viram UMA linha miúda sob os 4"*. **Nada de conta mudou — só apresentação.**

### ⛔⛔⛔ A MEDIÇÃO MUDOU O DESENHO ANTES DA PRIMEIRA LINHA — a letra do pedido REPROVA WCAG

Ele pediu o tom forte da família (o `-mid`) com número branco, **e pediu a prova pelo guard**. A prova dá vermelho em **6 dos 8 casos**:

```
                 TEMA CLARO              TEMA ESCURO (o -mid CLAREIA)
índigo  #534ab7  6,93:1 OK      #8a81f0  3,24:1 REPROVA
azul    #2563eb  5,17:1 OK      #6aa0fb  2,61:1 REPROVA
verde   #0f9d58  3,51:1 REPROVA #3ecf8e  2,00:1 REPROVA
coral   #e5484d  3,91:1 REPROVA #ff6369  2,90:1 REPROVA
```

⚠️ **E o verde e o coral reprovam já no tema CLARO, que é o que ele usa** — o coral é o cartão **herói** ("PRA NÃO AFUNDAR"). O número de 30px é texto grande (limiar 3:1), mas a **etiqueta de 11px e a sub ficam sobre o MESMO chão** e são texto normal, exigindo 4,5:1.

**⭐ O QUE FICA É SÓLIDO CHEIO COM O DEGRAU CERTO POR TEMA** — o par `--fam-X-solid` / `-on` / `-on-soft`: no claro o chão é o tom 800/900 e no escuro é o fundo escuro da família; **a tinta é branca nos dois**, que é exatamente o que ele pediu. **8 de 8 passam, de 7,88 a 16,94:1.** ⚠️ É o MESMO desenho de `--prod-acao-bg`/`--prod-acao-ink` (04/10) e a mesma lei de *"no escuro o 50 e o 800 trocam de lado"* — o que inverte é o **CHÃO**, não a tinta. ⛔ Só as 4 famílias que têm cartão: *token sem chamador é token que alguém religa por descuido*.

### ⭐ O CARTÃO, EM 3 LINHAS

Etiqueta 11px/700 no tom claro · **NÚMERO 30px/700 BRANCO tabular, ARREDONDADO AO REAL** · UMA sub de ≤5 palavras. **O centavo vai pro tooltip** — a mesma régua do pão (27/08): *o ledger guarda precisão cheia, quem arredonda é a leitura*.

**⛔⛔ A RÉGUA MORA EM LIB PURA (`cartao-de-dono.ts`), NÃO NO JSX** — o projeto roda em `environment: node`, sem jsdom, e *regra que mora num `value={...}` é regra que ninguém prova* (a lição do prefill do cardápio, que quebrou 2× antes de virar função). Ali a sub tem **contagem de palavra conferida**, o número tem o "sem centavos" **executado**, e o texto do ⓘ é **dado**. ⛔ E a tela não escolhe cor: a família vem de `FAMILIA_DO_CARTAO`.

⚠️ **E O `escuro` MORREU:** os quatro são sólidos. Três pastéis ao lado de um escuro fazia o herói competir por atenção com cartões de peso visual diferente.
⚠️ **Decisões declaradas:** o `/mês` do 1º cartão saiu (o título *"O mês custa"* já carrega) e o título dele virou **fixo** — a composição (`CASA + BANCO + COMPROMISSOS`) desceu pro ⓘ, e **quais chips estão ligados os próprios chips já mostram**. A sub do **porDia** é minha, derivada da que a tela já tinha: ele deu **três** exemplos pros quatro cartões, e inventar tom novo ali seria escrever por ele.

### ⭐⭐ O CHIP "7 SEM PLANO →" — e ele FILTRA de verdade

No 1º cartão, fundo branco translúcido, **`<button>` e não `<div>`** (clicável que não é botão perde teclado e leitor de tela). O clique **liga o filtro E rola** até a lista: filtrar sem rolar deixaria o dono olhando o cartão sem ver o efeito; rolar sem filtrar o largaria numa lista de 26 linhas.

⛔ **O filtro nasce DESLIGADO** (ligado por default esconderia linha sem ninguém pedir) · a tela **DIZ que recortou** e oferece *"ver tudo"* — a régua de 23/09 (*"ausência de resultado NESTE recorte não é ausência de trabalho"*, que evitou o *"tudo resolvido"* com 35 linhas esperando) · e **o Σ do rodapé é da prateleira INTEIRA**: um subtotal que mudasse com o filtro deixaria de fechar com o cartão, que é o guard que ele mandou manter.

### ⭐⭐ A LINHA MIÚDA E O ⓘ — honestidade guardada, não gritada

*"margem 47,7% (CMV por compra) · 31 dias corridos · como eu conto ⓘ"*, e o ⓘ abre **a margem · o calendário · a composição · o que ficou fora · pra não afundar**. ⛔ **Nada se perde: cada parágrafo que morreu na frente do dono está lá dentro**, e o guard é de dois lados — se eu só proibisse os parágrafos, aprovaria o dia em que a ressalva do CMV sumisse da tela inteira.

**⛔⛔ E O ⓘ É `<details>`, NUNCA `title`:** **tooltip não existe no celular**, e é lá que o dono opera (a cicatriz de 30/08). O que pode ir pro `title` nesta tela é só o que **repete** um número já visível (os centavos) ou **explica um rótulo**; a régua completa fica a um **toque**.

### ⚠️⚠️ A TENSÃO COM 07/10, RESOLVIDA COM DESENHO E REGISTRADA

Em **07/10** ele exigiu que a linha-mitigação do Arafat *"não ficasse muda"* (virou parágrafo); hoje pediu *"linha curta, resto no tooltip"*. **A pergunta do guard não mudou** (*a prateleira DIZ qual é a dela*) — mudou **onde** ela diz. O que segura a promessa é a **divisão**: o **FATO** (os dois números) fica no CHIP, visível no dedo — `devolvido R$ 40.000,00 · faltam R$ 1.428,57` — e só a **RÉGUA** (o rótulo `~referência flexível` + o porquê do mês) vai pro `title`. Jogar o fato pro hover o faria **desaparecer** pro dono. O selo foi partido em `selo` + `seloDetalhe` na lib, com teste exigindo que o detalhe continue nomeando a agenda flexível. ⚠️ `referenciaFlexivelDoMes` tem **um único consumidor** (a prateleira), então a tela do empréstimo não foi afetada — conferido antes de partir.

**O resto do item 4:** *"o planejado é seu…"* **morreu** (a tela ensina pela FORMA: as colunas se chamam planejado e realizado, e o planejado é o único editável) · *"não são custo — é caixa que certamente sai"* virou **tooltip + `aria-label` do título** · o *"~previsto com base na parcela N"* virou tooltip **do próprio número**, com o `~` seguindo visível (ele distingue previsão de fato e isso não pode morar no hover) · a nota do cartão virou **1 linha, só quando houve compra** · campo do plano 13→14px · **Σ dos rodapés em 700**.

### ⚠️⚠️ A PROVA EM PROD ACHOU UM DEFEITO QUE A DIETA DEIXOU VISÍVEL

O ⓘ imprimia **`47.7%`, com PONTO** — **três cópias** de `(pct * 100).toFixed(1)` em `margem.ts` e `prateleira.ts`, nenhuma trocando o separador. É **pré-existente** (vivia escondido num parágrafo de cartão) e a dieta o pôs no popover, onde ficou na cara. Virou `pctBR`, **dono único**, consumido pelos três. ⚠️ **E um teste afirmava o defeito** (`toContain('49.8%')`) — invertido com o motivo escrito; a metade certa dele (*a conta vai ESCRITA, a tela nunca mostra percentual sem régua*) continua travada.

### A PROVA — 2 VIEWPORTS × 2 TEMAS, ZERO ESCRITA

```
OS 4 CARTÕES (rota real → 200)
  [indigo] O MÊS CUSTA          R$ 193.083   (tooltip R$ 193.082,88) · a casa come isso parada
  [azul]   POR DIA ABERTO       R$   6.228   (tooltip R$   6.228,48) · isso por dia, parado
  [verde]  PONTO DE EQUILÍBRIO  R$  13.055   (tooltip R$  13.054,68) · venda/dia que paga o mês
  [coral]  PRA NÃO AFUNDAR      R$  13.055   (tooltip R$  13.054,68) · acima disso, sobra de verdade
  ⛔ cartão com CENTAVOS na frente: 0 ⭐   ·   chip: "7 sem plano →" (realizado R$ 150,00)

A LINHA MIÚDA  "margem 47,7% (CMV por compra) · 31 dias corridos · como eu conto ⓘ"
  ⓘ a margem · o calendário · a composição (CASA + BANCO + COMPROMISSOS) · pra não afundar

NADA DE CONTA MUDOU
  ⛔ Σ(linhas) casa  R$ 93.868,79 × subtotal R$ 93.868,79 → ⭐ FECHA
  ⛔ Σ(linhas) banco R$ 13.734,01 × subtotal R$ 13.734,01 → ⭐ FECHA
  as 8 combinações de chips responderam: 8 de 8 ⭐
  ⭐ o 4º cartão NÃO obedece aos chips: IDÊNTICO nas 8

celular 200/235ms · desktop 200/151ms · 18 chunks · 871 KB
  ✓ 10/10 peças novas · ✓ 6/6 frases mortas FORA
  ✓ os 12 tokens (4 famílias × 3 papéis) nos DOIS mapas do CSS servido
  ✓ hex de cor no chunk DESTA tela: 0
marcações 26→26 · planos 38→38 · chips 1→1 · ⭐ ZERO ESCRITA
```

**REGRA 11 — os 3 vermelhos que o dono nomeou, mais um:** parágrafo de volta no cartão (**2**) · centavos no número (**2**) · sólido trocado por pastel (**3**) · **o `-mid` cru como chão (2)**.

**⚠️⚠️ E O 4º VEIO VERDE NA 1ª RODADA — era SONDA ERRADA, não guard cego.** Minha substituição procurava `--fam-coral-solid: #8f2327;` com **um** espaço e o arquivo tem **dois** (alinhamento) — o defeito **nunca foi reposto**. Refeito com verificação de que o `sed` aplicou, ele morde com a mensagem exata (*"on sobre solid = 3.91:1"*). ***Reposição que não reproduz o defeito é um verde de graça*** — e é a cicatriz do `perl` que não aplicou, de 09/10.

**⚠️ DOIS GUARDS MEUS FORAM CORRIGIDOS NO CAMINHO:** (a) o *"máximo 3 parágrafos"* contava **4 tags** porque o número e o "a apurar" eram dois `<p>` em ramos exclusivos — em vez de afrouxar pra 4 (e perder a mordida), **o cartão passou a ter UM `<p>` pro número** com o texto mudando; (b) o guard do Σ deu **falso vermelho** por fatiar ±700 caracteres e alcançar o botão *"ver todas"*, que usa o recorte **corretamente** — ***janela de distância já produziu falso vermelho e falso verde nesta casa 7 vezes***; reapontado pro bloco do rodapé, por estrutura.

**⚠️ 4 GUARDS REAPONTADOS, nenhum afrouxado, e DOIS ficaram MAIS FORTES:** o do 4º cartão passou a conferir a família no **dono único** em vez da string no JSX; o do token virou *"o chão é o SÓLIDO"* e **proíbe o pastel e o `-mid`** — que é o vermelho do pedido.

**945 arquivos · 12.500 verdes · 2 todo · TS 0 · migration NENHUMA · deploys 4/4 (`C9hzrW7xHutvMOMlzhfaN`, `ABQ7DhgElKzluRa6k4yn0`) · Δ chunks +4 KB.**

📋 **FICA PRO DONO:** abrir a tela no celular e no notebook, **nos dois temas**, com o olho dele — a prova mede o que prod serve (tokens nos dois mapas, zero hex, as 10 peças), mas screenshot está indisponível (extensão do Chrome desligada). ⚠️ E um detalhe do dado de hoje, que **não é defeito**: o **EQUILÍBRIO e o PRA NÃO AFUNDAR mostram o mesmo R$ 13.055** porque os 3 chips estão ligados — o 3º obedece aos chips e o 4º soma tudo sempre, então eles **convergem** nesse estado. Desligar um chip separa os dois na hora.

## ⭐⭐⭐ QUEM PAGA A CASA v4 — A LEI DAS COLUNAS + CMV + O CARTÃO DE PRODUTO (13/10/2026)

**A referência `docs/margem-referencia.html` virou v4** (aprovada pelo dono) e com ela três frentes num sprint só, com **MOTOR ÚNICO**: a lei das colunas, o CMV no montador e o cartão "escolha um produto".

### ⭐⭐⭐ A PORTA ÚNICA DO VEREDITO DE PREÇO (`lib/margem/veredito-de-preco.ts`)

**Farol, charme, gross-up, teto/alvo e as frases moram num arquivo PURO (zero import de prisma), e os DOIS cartões passam por ele** (`montarBlocoDoVeredito`). ⛔ Se cada cartão chamasse `farolDoPreco` + `precosIdeais` + `fraseDoEspecialista` por conta própria, a ORDEM das decisões (qual alvo, qual teto, o que fazer com custo pendente) viveria **duas vezes** — e divergiria no primeiro estado de borda, que aqui é o mais comum: **a pizza com fatia em aberto**. ⚠️ E o risco era maior que o de costume: **o montador e o cartão de produto ficam LADO A LADO, na mesma dobra** — duas contas discordando a dez centímetros uma da outra é a doença do B1 com as duas respostas visíveis ao mesmo tempo.

- **CHARME, e por que ele não arredonda:** `chao + 0,90`, e **se ficar abaixo do ideal bruto sobe pro `chao + 1,90`**. Arredondar pro `,90` mais próximo **puxaria o preço PRA BAIXO do ideal** — e aí o número bonito custaria margem, que é o oposto do que ele existe pra fazer. ⛔ Vermelho do dono travado: *charme abaixo do ideal bruto = vermelho*.
- **GROSS-UP, na ordem que importa:** o iFood sai de `(custo + sobra do balcão) ÷ (1 − taxa)` — o **gross-up é EXATO antes do charme**, e o charme vem depois. Com isso a **sobra do iFood é SEMPRE ≥ a do balcão** (medido nos 3 alvos do caso real), que é o vermelho *"sobra do iFood menor que a do balcão"*. ⛔ **E nunca copia o preço do balcão pro iFood** — há teste exigindo que os dois sejam diferentes quando a taxa é > 0.
- ⛔⛔ **`taxaPct: null` é "a declarar", NUNCA 0%** — 0% afirma que o canal é de graça e inflaria a sobra justo no canal em que ela é menor. A taxa vem da **porta de canais que o montador já usava** (`CanalDeVenda.taxaPct`): **zero `0.20` novo cravado**, e há guard provando que nem a porta nem a tela digitam taxa.
- **`custo == null` NUNCA vira número:** farol **neutro**, canais **"a apurar"**, frase que convida (*"cria a ficha que eu te digo o preço na hora"*). É o vermelho *"produto sem ficha mostrando número de custo/ideal"*.
- **PERCENTUAL COM VÍRGULA, por `pctBR`** (dono único, `lib/format/percentual.ts`). O caso do dono sai **`CMV 63,6% · fora do padrão`** — ponto decimal ali é vermelho.
- ⚠️ **Convenção de grandeza, declarada:** fração onde o número **VIAJA** (`cmvPct: 0.6357`, `taxaPct: 0.2`) e percentual inteiro onde ele é **régua de dono** (`tetoPct: 33`). Misturar os dois é como um `× 100` se perde.

**⭐ O MAPA CATEGORIA → TETO/ALVOS É ÚNICO (`REGUA_POR_SECAO`), e ele se pendura no vocabulário que a casa JÁ tem** (`secaoDaLinha`/`secoesPorNome` + `SECOES_SEED`) — **nunca um segundo vocabulário de categoria**. PIZZAS 33 · XIS/BURGERS/LANCHES 35 · PORCOES/FRANGO_FRITO/PRATOS 40, todos **DECLARADO**; BEBIDAS/DOCES/OUTROS **DERIVADO** e **marcado como tal** na tela. ⚠️ `TETO_SEM_SECAO = 40` (o mais FOLGADO de propósito): teto apertado num produto que o sistema não soube classificar **grita lobo** e ensina o dono a ignorar o farol.

### ⭐⭐ A LEI DAS COLUNAS (`lib/margem/recorte-de-coluna.ts`)

*"Lista comprida NUNCA mora inteira numa coluna lateral — ela ganha teto: TOP 10 + «ver todos» que expande ALI MESMO. Recolhido, as duas colunas de cada dupla terminam JUNTAS. Coluna fantasma = tela REPROVADA."*

- ⛔⛔ **UM TETO SÓ PROS DOIS CARTÕES DA DUPLA — e isso não é economia, é a única forma de a lei valer.** `CARREGADORES_VISIVEIS` era `6` cravado em `placar.ts` e passou a **derivar de `TOPO_DA_COLUNA = 10`**. ⚠️ **A própria v4 se contradiz no desenho:** ela DECLARA `TOP 10` e DESENHA 6 linhas em "quem carregou"; a 38px por linha (o `padding:9px` + `13.5px/1.45` do CSS dela), 4 linhas de diferença são **152px**, fora da tolerância de ~140 que ela mesma escreveu. **Com dois tetos separados, alguém ajusta um e a coluna fantasma volta sem nada ficar vermelho; com um dono único ela é impossível** (REGRA 5). **Medido em prod: diferença de 0 linha.**
- ⚠️ **A tolerância é em LINHAS, derivada dos px da referência** (`~140 ÷ ~38 = 3,6` → **3**), não escolhida a dedo. Converter pra linha é o que torna a lei **testável sem navegador**: as duas colunas usam o MESMO padding e a MESMA fonte, então contar linha **É** medir altura.
- ⚠️ **O teto é de EXIBIÇÃO, nunca de leitura** — a lista inteira chega na tela e expandir **não refaz consulta**. É o oposto do `take` que escondeu o fermento (16/09) e a ordem do ano 202 (19/09), onde o teto cortava o **DADO**.
- ⛔ **Lista que CABE no teto não ganha botão** (botão que não faz nada é ruído) e o **estado inicial é SEMPRE recolhido** — nascer aberta é a lista de 50 rolando sozinha, que é o que a lei existe pra matar.
- **Ordem nova das zonas:** dupla [quem carregou | a liga] → dupla [montador | escolha um produto] → **fila de sabores em LARGURA CHEIA**. O mobile empilha na ordem do HTML (uma composição só).

### ⭐⭐ O CARTÃO "ESCOLHA UM PRODUTO" (`lib/margem/produto-do-veredito.ts`)

**Tradução, zero conta nova** — e as portas ficam declaradas: **custo** = `LinhaCardapio.custoUnitario` (de `explodir` com qtd 1, a MESMA porta que a baixa de venda usa) · **preço** = `precoUsado` (`round2(vendasValor ÷ vendasQtd)`, a **MESMA fonte da liga** — média REAL do PDV no período da tela) · **categoria** = `secaoDaLinha` + `REGUA_POR_SECAO`.

- **Busca pela `casaBusca` da casa** (palavra em qualquer ordem, sem caixa e sem acento), sobre nome **e apelidos do PDV**. ⛔ `includes` cru é o bug de 08/09: medido em prod, `"porcao"` acha as 3 de `"porçao"` — com a régua crua acharia **zero**.
- ⛔ **Sem ficha = farol neutro + canais "a apurar" + convite**, com o **custo PARCIAL guardado como PISO** e nunca no lugar do total (*"1 componente da ficha sem custo, parcial R$ 13,12"*).
- ⛔ **Sem venda no período = campo VAZIO + "sem venda no período"**, nunca R$ 0,00 — e quando o preço vem do **cardápio** em vez do PDV, a **origem é DITA** (a tela não pode passar preço de tabela por média real).
- ⚠️ **`secao` NUNCA é null** (`secaoDaLinha` cai em `sugerirSecao`), e a **sugestão não confirmada vem MARCADA** — decisão do dono não é proposta.
- **Editar o preço SIMULA e nada grava** (`montarProdutosDoVeredito` é tradução; o único POST da seção é o da config de canais, que já existia).

### ⛔⛔ E A REGRA 11 REPROVOU O GUARD DUAS VEZES — as duas instrutivas

1. **O guard estrutural passou com a tela NÃO consumindo a porta.** Eu somava `usosDe(t, 'veredito')` e **`SeloDoVeredito`** (da liga, outra coisa) casava — ***"menção, não uso" pela 14ª vez nesta casa, cometida DENTRO do guard que existe pra isso***. Apertado pro nome EXATO que a porta assina (`blocoDoVeredito`) + a exigência de o farol chegar **pronto** (`.farol`), nunca derivado na tela.
2. **O detector de CMV na tela nasceu CEGO na forma que o código real teria.** Eu procurava `custo\w*\s*/\s*preco\w*` (**adjacente**), e `custoTotal`/`precoVenda` são **nullable** — quem escrevesse a conta à mão escreveria `(pizza?.custoTotal ?? 0) / (pizza?.precoVenda ?? 1)`, com o `??` no meio, e **o regex não casa**. Virou `divisoesDeCmv()` **estrutural** (por linha: o que vem antes do `/` fala de custo, o que vem depois fala de preço; pula `//` e `/>`), **com auto-teste nos dois sentidos**.

**REGRA 11 — 20 defeitos repostos, 20 morderam** (7 na lib + 13 na tela), baseline 0, restaurado 0. ⚠️ E a **sonda** da REGRA 11 nasceu com dois furos meus: backup por **basename** (duas telas se chamam `page.tsx` — a cicatriz de 09/10) e um `assert antes not in novo` que **falha em reposição por INSERÇÃO** (o `depois` CONTÉM a âncora) — relaxado pra `novo != src and depois in novo`, com a suíte que **não coleta** contando como vermelho.

### ⚠️⚠️ UMA DIVERGÊNCIA DECLARADA ENTRE A v4 E O QUE ESTÁ EM PROD: A CASCATA

A v4 **não tem** a cascata de 5 cartões (a v3.1 tinha, 11 matches; a v4 tem **zero**). **Medi com git antes de decidir** e são três evidências de que é **artefato de recorte, não ordem**: as **4 novidades** que a v4 anuncia não falam do topo; as seções 1-2 estão marcadas **"INTOCADO na v4"**; e a cascata é **ordem escrita do dono, já em prod** (10/10, *"é ele crescido"*). **A cascata FICA**, o guard foi **re-apontado com o motivo escrito** (`fraseSoNoCodigo`, que exige um motivo de 20+ caracteres pra cada frase que vive só no código), e a divergência está **declarada** em vez de resolvida por conta própria.

### ⛔ ACHADO NO CAMINHO: UMA CONSULTA SEM LEITOR

`lerMargem` buscava `canaisDb` no `Promise.all` e **jogava fora** — consulta paga, dado nunca usado. Agora ele viaja no payload (`canais`), que é o que o cartão de produto precisa pra não cravar taxa.

### PROVADO EM PROD, PELO MOTOR REAL (zero escrita)

```
[banco] postgres .../conta_ia_prod · empresa: caçula mix

A LEI DAS COLUNAS   teto único: liga 10 · quem carregou 10 · iguais ✓
   a liga tem 42 linhas · RECOLHIDO 10 visíveis · 32 atrás do botão "ver todos os 42 ▾"
   EXPANDIDO 42 · botão "mostrar só o top 10 ▴"
   ⭐ a dupla recolhida: carregou 12 × liga 12 → TERMINAM JUNTAS (diferença de 0 linha)

O CASO DO DONO (custo 25,42 · vendendo a 39,99 · régua PIZZAS teto 33 · alvos 28/33/45)
   FAROL [coral] CMV 63,6% · fora do padrão      ⭐ vírgula, nunca ponto
   ESPECIALISTA: "esse sabor não cabe na tabela comum. Ou vira linha premium com
                  preço próprio, ou o mix compensa."
   ALVO 28%  ideal bruto 90,79 → balcão 90,90 (sobra 65,48) · iFood 113,90 (sobra 65,70)
   ALVO 33%  ideal bruto 77,03 → balcão 77,90 (sobra 52,48) · iFood  97,90 (sobra 52,90)
   ALVO 45%  ideal bruto 56,49 → balcão 56,90 (sobra 31,48) · iFood  71,90 (sobra 32,10)
   ⭐ 9 de 9 preços terminam em ,90 · 0 abaixo do ideal bruto
   ⭐ sobra do iFood ≥ a do balcão nos 3 · balcão NUNCA copiado pro iFood

O PRODUTO COM FICHA   «MINI FRITAS» 399 un · seção PORCOES · teto 40% (DECLARADO)
   custo R$ 3,11 · vendendo hoje a R$ 9,99 [praticado] · FAROL [verde] CMV 31,1% · no padrão
   ideal balcão R$ 7,90 (sobra 4,79) · iFood R$ 9,90 (sobra 4,81)
O PRODUTO SEM FICHA   «Combo Caçula» 564 un · custo a definir (1 componente sem custo,
   parcial R$ 13,12) · FAROL [neutro] · canais "a apurar" · convite pra criar a ficha

A BUSCA   "xis"→23 · "porcao"/"porçao"/"PORCAO"→3 cada ⭐ · "coxao"→2 · "zzz"→0
O GUARD DO DONO   Σ(quem carregou) R$ 27.507,53 == sobra bruta == Σ da aba ⭐ FECHA
REGRA 12   celular e desktop: PAGE 200 · 14/14 peças do v4 · hex no chunk DESTA tela: 0
           os 10 tokens nos DOIS mapas do CSS servido (2.597 regras recortadas)
ESCRITA    movimentos 7732→7732 · versões 334→334 · canais 3→3  ⭐ ZERO
```

**963 arquivos · 12.882 verdes · 2 todo · TS 0 · migration NENHUMA · deploy 4/4 (`OnKpiwiGmSznT45f0Dn5X`) · Δ chunks +12 KB.**

### ⚠️⚠️ E A PROVA EM PROD ACHOU UM ESTADO DE DADO QUE TRAVA O MONTADOR — não é defeito

As **4 bases de pizza** vieram `custo: a apurar`, e a causa foi medida componente a componente: **`metade de bolinha massa de pizza` está com saldo 0 e valor 0**, e `custoMedio` é `saldo > 0 ? valor/saldo : null` → **null** → a régua *"`null` quando QUALQUER folha não tem custo médio"* (a mesma do `custoUnitario` do hub, que este módulo obedece) derruba a base inteira. Queijo (4,20), caixa 25 (1,98), caixa 35 (2,74) e caixa 45 (4,48) estão todos com custo.

⭐ **O v4 responde a isso do jeito certo:** farol **neutro "fecha a pizza"**, canais **"a apurar"**, **zero número inventado** — é o vermelho do dono sendo obedecido, não contornado. ⚠️ **Consequência de desenho que vale registrar:** o custo da base **oscila com o saldo**, então ele vira "a apurar" todo dia em que a massa zerar na prateleira. O caso filé+bacon foi provado com o **custo que o dono mediu (25,42)**; a conta canônica de 08/10 (`2×massa 0,54 + 2×queijo 4,20 + caixa 2,74 = 12,22` + sabores `9,00 + 4,29`) dá **25,51**, que é a confirmação independente de que é o mesmo caso.

## 🎨⭐⭐⭐ A CARA NOVA DO SISTEMA — FUNDAÇÃO FASE 1 (14/10/2026)

**`docs/cara-do-sistema-referencia.html` (v1.2, aprovada pelo dono) virou a LEI VISUAL do sistema inteiro**, e o guard **abre o arquivo**: os 28 tokens do `:root{}` são comparados **por VALOR**, não por presença de nome — *guard que só conta nomes aprova a paleta trocada* (foi assim que o do mock da Conciliação nasceu cego em 13/09).

**⭐⭐ HIERARQUIA DAS LEIS, resolvida e escrita:** a referência da **fundação** manda nos TOKENS; as de **TELA** mandam na estrutura das telas delas; **em conflito de token, a fundação vence**. Isso substituiu **8 valores cravados** nos testes — eles afirmavam os tons que o dono pediu **em prosa** em 04/10 (`#f8fafc`/`#16151d`), e o arquivo versionado declara outros (`#F3F5FA`/`#0B0E1C`). Tom ajustado "no olho" agora fica vermelho **apontando o hex que o arquivo manda**.

### ⛔⛔ L7 — DOIS DEFEITOS DE CONTRASTE VIVOS, nos botões que o dono clica

```
o "concluir agora" da ordem parada    branco sobre --fam-ambar-mid   3,19:1 claro · 2,15:1 escuro
o "confirmar a troca" da ficha        --prod-acao-ink (branco!) idem  3,19:1 claro
o par que ficou (solid/on)                                           7,09:1 claro · 14,79:1 escuro
```

⚠️ **O `--prod-acao-ink` é BRANCO no claro** (ele pareia com `--prod-acao-bg`), e foi por essa porta que o 2º defeito entrou — **com o token "certo" no chão errado**.

**⭐⭐ E A VARREDURA É POR USO, NUNCA POR TOM** — a 1ª versão da minha asserção dizia *"só o índigo-mid pode receber branco"* e **ficou vermelha contra a tela certa**: azul (5,17), teal (5,06) e rosa (5,11) **passam no claro**. A lei proíbe **PINTAR** tinta clara num chão que reprova, e o perigo real é a **inversão** — os quatro reprovam no escuro, porque o `-mid` **clareia**.

**⛔⛔ O DETECTOR GANHOU NOME E AUTO-TESTE, e a REGRA 11 cobrou isso:** com os dois defeitos **já corrigidos**, enfraquecer a varredura **não produzia vermelho nenhum** (medido: tirar a linha do `text-white` deixava tudo VERDE). *Sem o auto-teste, a próxima mão que mexesse ali deixava o defeito voltar INVISÍVEL.* ⚠️ E ele lê a tela **sem comentário**: o arquivo que documenta o defeito removido não pode ser o que o absolve (21/09).

### ⛔⛔⛔ E A VARREDURA ACHOU UM TERCEIRO, PINTADO NO CSS — o flanco era maior que a instância

**Medindo os contrastes pro relatório:** o **badge do Contas a Pagar** e o **contador do sininho** pintavam branco sobre o **coral vivo** — **3,75:1 no claro e 2,78:1 no escuro**, num número de **10,5px** (texto normal, piso 4,5). **Reprovava nos dois temas.**

⭐ **A causa de a varredura não ver:** ela lê **TSX** (`telasDoApp()`) e o badge pinta por **CLASSE no `globals.css`**. *"Guard que lê a vitrine não enxerga a prateleira"* — agora em CSS. Nasceu `violacoesL7NoCss`, e ela achou **DOIS** pares, não um.

**⚠️⚠️ E A CURA DE 10/10 (TROCAR O CHÃO PRO `-solid`) NÃO SERVE AQUI — medido:** no escuro o `--fam-coral-solid` é **`#3a1917`**, um marrom quase preto. Num disco de 17px dentro de um trilho escuro **o badge de alarme ficaria invisível** — o número passaria e **a função morreria**. Lá o chão era um cartão grande; aqui é um ponto de alerta.

**⭐⭐ ENTÃO O QUE CEDE É A TINTA, NÃO O CHÃO.** O vermelho vivo que ele pediu fica **idêntico** (`#e2544a`/`#f87168`) e o dígito vira o quase-preto da casa (`--prod-coral-on: #0a0f1e`): **5,09:1 claro · 6,87:1 escuro**. As quatro opções foram **medidas antes de escolher** — tinta forte reprova no escuro (2,44), coral-ink reprova nos dois (2,34/1,64), inverter o chão reprova no escuro (1,69).

**⛔⛔ E O DETECTOR SAIU PRA LIB porque a REGRA 11 mostrou o limite dele:** repor o defeito e **arrancar a varredura com `it.skip` não produz vermelho nenhum** — *nenhum teste pega o próprio desligamento* (a classe do `void X` que contava como uso, 13/10). Com o detector em `lib/ui/varredura-l7.ts` ele roda em **DOIS lugares**: o guard da suíte **e a prova em prod, contra o CSS que o servidor SERVE**. Desligar um não esconde o outro.

⚠️ **E o regex dele tinha um furo que só a medição pegou:** consumindo o delimitador, ele **pula de dois em dois** — **62 blocos de ~600**, e o badge ficava de fora. O auto-teste agora **exige que ele veja o badge**.

### ⭐ FRENTE A — a tinta, a linha e a sombra

Os tokens viram a única fonte de cor nos 2 temas. **`--radius` 0.5 → 0.75rem** (o `--r-cartao` da referência) alcança **161 Cards** com uma edição; a sombra sai do `ui/card` **por token**; `.dinheiro` (800 tabular) com **dois consumidores**.

**⛔⛔ A ZEBRA FICOU OPT-IN POR MEDIÇÃO, não por gosto:** **13 de 22** tabelas de densidade pintam fundo de linha **por ESTADO**, e a zebra global **apagaria o sinal de estado**. ⚠️ E a especificidade é a armadilha: `.density-normal tbody tr:nth-child(even) td` vale (0,2,1) e vence um `bg-amber-50` no `tr` (0,1,0) — a zebra ganharia da cor que significa alguma coisa.

**⛔⛔ A SOMBRA DO ESCURO VIROU `none` PORQUE A MEDIÇÃO REFUTOU A JUSTIFICATIVA ESCRITA NO ARQUIVO.** Ela dizia *"os painéis fundem"*; medido, canvas→cartão dá **1,09:1** e linha-sobre-cartão **1,24:1** — **idênticos ao tema claro**. Era precaução sem lastro.

⚠️ **E o `.density-*` foi CONSUMIDO, nunca editado:** `lib/contas-pagar/virtualization.ts` **duplica** as alturas 36/48/60 pra virtualizar, com testes travando — mexer no CSS quebraria o cálculo da Contas a Pagar.

### ⭐⭐ FRENTE B — o trilho, e a preferência na MESMA casa do tema

Nasce **recolhido (64px)**, cresce no **`:hover` do PAI** (CSS, **zero listener**), o «» **fixa aberto**, badge **mini sobre o ícone** no recolhido, **gaveta** no celular. **A classe vem do SERVIDOR** (`class="trilho rec"` medido no HTML) — nunca de um `useState` com default, senão o trilho piscaria aberto antes de recolher.

**⛔⛔ A PREFERÊNCIA É COLUNA, NÃO TABELA NOVA:** o dono disse *"a MESMA casa"*, e a casa é aquela linha. Uma tabela ao lado seria a **2ª porta de escrita** pro mesmo fato. Com a coluna, o upsert na PK `userId` segue sendo **UM** e gravar tema e trilho é o mesmo gesto. ⚠️ `ALTER` é permitido ali: a regra CREATE-only é do módulo de **ESTOQUE** (o guard só olha migrations `stock_`).

**⭐ TRÊS CAMINHOS, UMA RESPOSTA:** a coluna nasce `NOT NULL DEFAULT 'recolhido'`, então **linha antiga, linha nova e a AUSÊNCIA de linha dizem a mesma coisa** — nada de backfill.

### ⛔⛔⛔ REGRA 13 — O CHECK DEIXAVA PASSAR SÓ-ESPAÇO, E A PRÓPRIA PROVA ACHOU

```
⭐ recusou "trilho VAZIO"            pela chk_user_trilho_forma
⛔⛔ ACEITOU "trilho só ESPAÇO"      — o CHECK não morde!
⭐ recusou "trilho em CAIXA ALTA"    pela chk_user_trilho_forma
                                      → 5 de 6
```

**A causa, medida:** `"trilho" <> ''` é **true** pra `'   '`, e `'   ' = lower('   ')` também. **A forma fraca só pega a string vazia.**

⚠️⚠️ **E o estrago é exatamente o que a migration diz que o CHECK existe pra impedir:** só-espaço **cai no default CALADO** (`normalizarTrilho` apara e devolve `'recolhido'`). O dono fixaria o trilho aberto, o banco guardaria `'   '`, e ele nasceria recolhido **pra sempre, sem erro em lugar nenhum**.

⭐ **O IRMÃO FOI JUNTO (REGRA 4):** `chk_user_tema_forma` (05/10) tem a **mesma forma, o mesmo furo e a mesma tabela**. *Corrigir N−1 é pior que não corrigir nenhum — metade fica certa e nada avisa.* **Migration NOVA**, porque aplicada não se reescreve (o checksum reprova o deploy). **Depois: 7 de 7 recusados · 3 de 3 aceitos · zero escrita líquida.**

⚠️ O `IS NOT NULL` entra **mesmo com a coluna `NOT NULL`**, de propósito: hoje é redundante (a prova mede `is_nullable=NO`), e fica como **cinto pro dia em que alguém a tornar nullable** — a migration que fizer isso não vai lembrar de revisar o CHECK.

📋 **REGISTRADO E NÃO CORRIGIDO, com a restrição nomeada:** dois CHECKs do **estoque** têm a mesma forma fraca (`chk_stock_radar_item_lista` 21/09 e `chk_venda_ignorado_nome` 23/09) e **NÃO têm como ser corrigidos por ALTER** — o guard de CI reprova `ALTER TABLE` em migration `stock_`. O estrago medido é **inerte** nos dois (só-espaço não casa lista nenhuma; o nome entra num índice único e nunca casa com nome do PDV), e a porta de escrita normaliza antes de gravar. **Decisão do dono se vale um sprint.**

### ⭐⭐ FRENTE C — UMA BARRA, DOIS VIEWPORTS

**A segunda composição MORREU.** O `dashboard-shell` tinha um header `md:hidden` com **os quatro controles escritos de novo**, e havia um guard policiando a igualdade das duas (*"o sininho tem que estar nas DUAS"*). **Com uma barra só, "o sininho é global" deixa de ser combinado e passa a ser construção** (REGRA 5). O que muda entre os viewports é o ☰ aparecer, **e isso é CSS** (`.menu-m`).

**⚠️ TRÊS DIVERGÊNCIAS DECLARADAS da referência, cada uma com motivo:** `.pf` é extensão (ela só desenha PJ) · o `.sinal` mantém a **CONTAGEM** em vez do `.ponto` de 7px (o número existe desde 04/10 e **um disco não distingue 1 de 9**) · **nenhum `.busca`**, porque *CSS de controle que não existe é o convite pra alguém desenhar o campo achando que está pronto*.

**⛔ A BUSCA ⌘K FICA PRA FASE 2, com o motivo escrito no arquivo:** **não há registro de telas pra ligar nela**, e campo morto é proibido (o `registry.parse` decorativo que esta casa já pagou). ⚠️ E o guard checa a ausência em `semComentarios(BAR)` e o **motivo** no arquivo cru — a 1ª versão se contradizia (afirmava que a frase não existe E que existe).

### ⛔⛔ A REGRESSÃO É "ROUPA", E ISSO VIROU GUARD

`a-fundacao-e-roupa.test.ts` é o **dono único** da pergunta *"o sprint é roupa?"* — o describe que vivia no `tinta-e-linha-da-fundacao` **mudou de casa** e ficou **mais forte**. Três redes: quem é roupa **não fala com o banco**; a **escrita é UMA** (varredura do app inteiro: 1 arquivo escreve a preferência, a rota é casca, a régua é pura); as **migrations** mexem numa tabela só e **não encostam em nenhuma tabela de dinheiro ou de estoque**.

**⭐ E "QUEM BUSCA TEM A LISTA FECHADA" é mais forte que "zero fetch":** três arquivos de roupa já falavam com rota **antes** do sprint (o tema, a sessão, o badge de retiradas) — proibir `fetch` neles obrigaria a afrouxar pra zero. Com a lista por arquivo, **rota nova aparece como vermelho**, inclusive uma rota de dinheiro no botão do tema.

⚠️ **E um guard foi REAPONTADO com o motivo escrito:** ele dizia *"o sprint trouxe UMA migration"*, e a correção do CHECK exigiu uma segunda. *A pergunta é sobre a TABELA, não sobre a contagem — contagem cresce junto com o sprint e cobra por cada arquivo novo; ela media o tamanho, não a doença.*

### ⚠️⚠️ REGRA 11 — 20 DEFEITOS REPOSTOS, e DOIS verdes com lição

Mordem: o fóssil do `text-white` (**1**) · ler COMENTÁRIO (**2**) · primitivo buscando dado (**1**) · botão do tema falando com rota de dinheiro (**1**) · 2ª porta de escrita (**2**) · rota tocando Prisma (**1**) · régua gravando (**2**) · migration encostando em dinheiro (**2**) · migration com DROP (**1**) · o badge voltando ao branco (**1**) · o regex pulando blocos (**1**) · o token nascendo claro no escuro (**1**).

**⛔⛔ Os dois verdes:** (a) **cegar o detector com o defeito JÁ corrigido** não dá vermelho — *com nada na tela pra detectar, o detector não tem o que achar*; o caso que **isola** é o **PAR** (repor o defeito **e** cegar o detector no mesmo gesto). (b) **`it.skip` na varredura** — nenhum teste alcança o próprio desligamento, e **foi isso que levou o detector pra lib**.

**⚠️ E A SONDA DEIXOU O REPO SUJO UMA VEZ:** o backup usava `d.name.replace('__','/')` e `__tests__/…` **começa com `__`** → ela tentou escrever em `/tests/…` e deixou o guard **mutado**. Restaurado do backup (`cp`, **nunca** `git checkout` — a cicatriz de 14/09). As sondas passaram a usar sentinela `%%` e a **ASSERTAR que a substituição aplicou**.

### A PROVA EM PROD — 7 TELAS × 2 VIEWPORTS × 2 TEMAS

```
Quem paga a casa   CELULAR 200/375ms · DESKTOP 200/75ms     Custos fixos      200 · 200
Produção (hoje)    200 · 200                                 Vendas            200 · 200
Receitas           200 · 200                                 página da ordem   200 · 200
CSS servido: 2 arquivos · 2.671 regras
  ⭐ os 23 tokens da fundação nos DOIS mapas: 23
  ⭐ L6 sombra: claro "0 1px 2px … , 0 2px 6px …" · escuro "none"
  ⭐ L4: cabeçalho 2px · divisória 1px · zebra OPT-IN · hover gateado · .dinheiro 800 tabular
  ⭐ L1: 64px/230px · :hover no pai · transição · badge absoluto · marca em gradiente · .menu-m
⭐⭐ L7 no CSS SERVIDO (o mesmo detector do guard): 0 pares reprovando
O TRILHO E O TOPO (nos dois): class="trilho rec" do servidor · UMA barra · ☰ no DOM ·
  logomarca · selo PJ/PF · sino · botão de tema · avatar
A PREFERÊNCIA: PUT aberto → 200 e a TELA nasce aberta · PUT recolhido → 200
  "ABERTO" TOLERADO e normalizado (o banco nunca vê caixa alta) · "gaveta" → 400, nada gravou
  o TEMA sobreviveu aos PUTs do trilho
⭐ DEVOLVIDO: tema=claro trilho=recolhido · linhas 2 → 2 — como encontrou
```

**⚠️⚠️ E A PROVA ERROU 4 VEZES ANTES DE MEDIR CERTO — as quatro MINHAS:** chutei o nome do token (`--prod-trilho-bg` **não existe**) · chutei o campo do relatório (`createdAt`, é **`runAt`**) · afirmei *"nenhuma rota de negócio"* no **bundle**, onde o chunk junta o trilho inteiro com o badge que lê `/api/empresas` (***achado não atribuível não é achado***) · e chamei `'ABERTO'` de torto levando **200**: a rota **tolera caixa e espaço** e normaliza antes de gravar; o que ela recusa é **`'gaveta'`**. ***Caixa alta é torto pro CHECK do BANCO; valor desconhecido é torto pra ROTA*** — duas perguntas, e eu as misturei.

**976 arquivos · 13.095 verdes · 2 todo · TS 0 · `pg_dump pre-fundacao-fase1-20261014-151931.dump` (9.280.851 bytes, tamanho conferido) · 2 migrations (ADD COLUMN + CHECK; e a correção do CHECK) · deploys 4/4 (`4Mf4I_eDMwLb17P7NM5pf`, `21fRIHm52wM2930U4Cv3Y`, `RRrLvoZg-mt-yVftaC2T5`) · Δ chunks +4 KB.**

⚠️ **O JUIZ NÃO SE MOVEU POR CAUSA DA FUNDAÇÃO, e a prova é melhor que um antes/depois:** o sprint **não gravou uma linha** de conta (a prova mede zero escrita líquida além da preferência, devolvida), e **invariante é função do estado do banco**. Quadro de hoje: `V1 125 · E7 118 · P6 90 · P8 62 · P3 58 · M1 53 · F2 26 · E15 10 · P5 4 · P1 2 · M2 1 · M3 1 · **E17 1**`, com `venda 2 · cartão 7 · balance 0 · dup 0 · 10/10 contratos`. **`venda` e `cartão` idênticos ao registrado em 06/10**; os deltas do estoque são operação entre 13/10 e hoje. 📋 **O `E17 1` é NOVO** (o invariante do custo vigente, que estava em 0 em 13/10) — **não é deste sprint** (nada da fundação toca custo) e fica registrado.

⚠️ **E O D4 DO JUIZ ACUSOU POR MINHA CAUSA, com o diagnóstico INVERTIDO:** eu rodo `git checkout -- prisma/schema.prisma` antes de cada pull (o swap é passo do deploy), então o schema do disco voltou pra `sqlite` enquanto o client gerado é `postgresql`. **O D4 diz *"TODA query ao banco falha"* e o app estava respondendo 200 nas 7 telas** — ele foi desenhado pra a direção oposta (client sqlite com schema postgres). Alinhado com o swap; login **401**, não 500. 📋 Fica registrado: **depois de `git pull` sem deploy, rodar o swap** — ou o D4 acusa sozinho.

📋 **FICA PRO DONO (REGRA 2, o olho é dele):** abrir as telas-chave **no celular e no notebook, nos dois temas**, passar o mouse no trilho recolhido, fixar com o «» e recarregar (a preferência tem que sobreviver), e **conferir a gaveta pelo ☰ no celular**. ⚠️ **Screenshot indisponível** (a extensão do Chrome não está ligada nesta sessão): a prova mede o que prod serve — os 23 tokens nos dois mapas, as regras do CSS, a classe que vem do servidor, zero par reprovando —, **mas quem vê a cara é ele**.

📋 **FASE 2 (o próprio brief defere):** densidade tela a tela · as telas antigas fora do padrão · a **busca ⌘K**, que só entra quando houver registro de telas pra ligar nela.

## 🧺⭐⭐⭐ O CARTÃO DE PRODUTO VIROU CESTA + O CAMPO DE PREÇO CONSERTADO (14/10/2026)

**A dor, nas palavras do dono:** *"quando vou troca numero eu excluir ele volta na hora mesmo numero"*. E o pedido grande: o cartão *"Escolha um produto"* passa a aceitar **2+ produtos** e virar **MODO COMBO**.

### ⛔⛔⛔ 1 · O CAMPO — A CURA É DISTINGUIR `null` DE `''`

**O campo era `value={preco ?? media}`.** Com "nunca digitado" e "apagado" **colapsados no mesmo estado**, QUALQUER fallback é uma **reposição**: o dono apaga, o React re-renderiza, e a média volta no mesmo keystroke. ⭐ **A cura é de TIPO, não de `if`:** `TextoDoCampo = string | null` — **`null` = intocado (vale a média) · `''` = APAGADO (vale vazio)**. Enquanto digita, **o campo é DONO do texto**: nunca reformatar, nunca repor, **nem no blur**.

⛔⛔ **E A RÉGUA MORA EM LIB PURA (`campo-de-preco.ts`), NUNCA NO `value={...}`** — o projeto roda em `environment: node`, sem jsdom: ***regra que mora num `value={...}` é regra que ninguém prova***. É a cicatriz do prefill do cardápio (28/08), que quebrou **duas vezes** antes de virar função.

**⭐ `↺ voltar pra média` aparece SÓ quando o valor difere da média (ou está vazio) e SOME quando volta** — link que fica sempre na tela deixa de ser informação. ⚠️ **E o campo é UM COMPONENTE PRA OS DOIS CARTÕES** (`CampoDePreco`): o montador de pizza tinha a MESMA doença, e duas cópias divergiriam no primeiro ajuste — a doença do B1 em forma de input.

### ⭐⭐ 2-3 · A CESTA E O MODO COMBO — A CONTA MORA NA LIB, A TELA ECOA

`lib/margem/cesta-do-veredito.ts`: toque **LIGA/DESLIGA** (✓ no chip), qtd **−/+ com mínimo 1**, e **1 item = o cartão de HOJE, campo por campo** — o caminho de um item chama o **`montarBlocoDoVeredito` de sempre, com `tipo: 'produto'`**, e um teste compara farol/teto/alvos/canais dos dois lados **nos três alvos**. ⛔ *Regressão travada por EXECUÇÃO, não por promessa.*

**⛔⛔ O MOTOR DO VEREDITO É O MESMO — `tipo: 'combo'` é um RAMO, não um segundo motor.** `vereditoDaCesta` chama `montarBlocoDoVeredito` com o custo da cesta; charme, gross-up do iFood e os alvos vêm da porta única de 13/10. **Uma conta de veredito na TELA = vermelho** (guard).

- **`custo do combo` = Σ das linhas ao centavo** · **`os mesmos, avulsos` = Σ (média PDV × qtd)**.
- ⛔⛔ **ITEM SEM FICHA NULA O COMBO INTEIRO** (`custoDoCombo: null`), com o convite *"cria a ficha que eu calculo"* — **número inventado NUNCA**. Idem item sem venda no período nos avulsos.
- ⛔ **`vendendo o combo a` NASCE VAZIO** — combo não tem média no PDV, e pré-preencher afirmaria um preço que ninguém praticou.
- **⭐⭐ TETO DO COMBO = média dos tetos PONDERADA PELO CUSTO** (`reguaPonderada`): o xis pesa mais que a coca. **Medido no caso real: 36% ponderado contra 38% de média simples** — e no caso de 3 itens 35/40/25 com pesos 10/5/1 dá **36%**, onde a média simples diria 33%.
- **A LINHA DA VANTAGEM:** preço < avulsos → **verde** com o % por `pctBR`; preço ≥ avulsos → **coral "combo SEM vantagem — ninguém leva"**. ⚠️ No estado neutro a `frase` é `null` e **a faixa não renderiza** — ausência de notícia não vira faixa vazia.

**⛔ PIZZA SEPARADA (ordem do dono):** produto da seção PIZZAS ganha **linha discreta** *"sabores e custo por fatia: no montador ao lado"* com âncora `#montador`. **O montador ficou INTOCADO** — provado por regressão em prod (3 canais, 4 tamanhos, 63 sabores, 52 com ficha).

### ⭐⭐ 4 · NA MESA — E A METADE QUE ELE NUNCA PODE DIZER

`naMesa()`: ideal > hoje → âmbar *"subindo pro ideal, entravam +R$ X no período"* = `(ideal − hoje) × unidades`. ⛔⛔ **Hoje ≥ ideal → VERDE, valor ZERO, conselho "segura o preço, não baixa"** — a diferença negativa imprimiria *"entravam −R$ 800"* ou *"descendo pro ideal"*, ou seja **o sistema sugerindo baixar preço**, que é a ordem do dono ao contrário. ⭐ **A decisão mora num `tom` fechado**: um `Math.abs` ou um sinal solto na tela reabririam o flanco.

**A FATIA DOS FIXOS** (letra miúda): `custo fixo do período ÷ unidades vendidas`, pelas portas que as telas já usam. ⚠️⚠️ **As unidades são as TOTAIS (dentro + fora da obra), e é escolha MEDIDA:** a cobertura é ~55%, então dividir só pelas unidades COM custo conhecido quase **DOBRARIA** a fatia — a tela cobraria de cada unidade a parte dos fixos que as outras também pagam. ⛔ **E aqui o R$ vai COM CENTAVOS**, ao contrário dos cartões do topo: a fatia é de poucos reais, e o redondo transformaria `R$ 12,64` em `R$ 13` — redondo é régua de MILHAR (`valorDoCartao` segue dono único do redondo).

### ⛔⛔⛔ 5 · A PREMISSA DO ITEM 5 CAIU NA MEDIÇÃO — e o achado é mais útil

A ordem dizia *"provável que as seções do dono já estejam certas e o mapa só não conheça os nomes"*. **Medido em prod: `seções que o MAPA NÃO CONHECE: 0`** — as 10 seções do cardápio dele são exatamente as 10 do mapa. ***O conserto de 1 linha que a ordem previa NÃO EXISTE***, e os 121 derivados vêm de **DUAS** causas, nenhuma delas o mapa:

| # | causa | tamanho | o gesto |
|---|---|---|---|
| **1** | **CLASSIFICAR** — a régua de palavra não soube o que o produto é, e `OUTROS` é derivado **por desenho** | **81 produtos · 1.923 un** | o do Cardápio (08/09), e é **DELE** |
| **2** | **DECLARAR O TETO** — BEBIDAS (1.247 un) e DOCES (111 un) estão na seção CERTA e o teto nunca foi declarado | **40 produtos · 1.358 un** | **2 números dele** |

⛔ **E eu NÃO alarguei a régua de palavra por conta própria** — a decisão de 08/09 é explícita: *nome desconhecido em Outros é 1 clique; nome na seção ERRADA é um número errado no relatório de cobertura, e ninguém desconfia de número.* ⚠️⚠️ **E medir mostrou que alargar nem resolveria o "derivado":** ~59 dos 81 são MILKSHAKE/SUNDAE/CASQUINHA/MIX, que cairiam em **DOCES — que também é DERIVADO**. ***Classificar move o produto de uma seção derivada pra outra; o que tira o "derivado" é o número do dono.***

**⭐⭐ E O CASO QUE O DONO PINOU NO BRIEF É UM DOS 81.** Ele escreveu *"(95,90 − 78,34) × 212 = +R$ 3.723"*; medido, é o **CACULA BOX HAMBURGUERES** (215 un, hoje R$ 78,64, custo R$ 32,50) — o **2º maior volume de OUTROS**. E o teto derivado custa dinheiro na conta dele:

```
OUTROS (derivado, hoje)   teto 40% · ideal R$  92,90 → entravam +R$ 3.066 no período
LANCHES (se classificado) teto 35% · ideal R$ 108,90 → entravam +R$ 6.506 no período
                                              ⛔ R$ 3.440 de diferença, num produto só
```

### A PROVA EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS (REGRA 12)

```
celular 200 em 586ms · desktop 200 em 158ms · chunk DESTA tela 94 KB
  ⭐ 22/22 peças do sprint nos dois · ⛔ hex cravado: 0 · ✓ os 24 tokens nos DOIS mapas do CSS

O CAMPO (digitação real)   nasce "95,90" ↺não → apago "" ↺SIM → "7" → "78," → apago ""
  ⭐ o campo VAZIO continua vazio (nem no blur ele repõe) · ⭐ o ↺ devolve a média e SOME

1 ITEM == O CARTÃO DE HOJE, nos 3 alvos (farol · teto · alvos · canais idênticos)
  30% balcão R$ 29,90 · iFood R$ 37,90   |   35% R$ 25,90 · R$ 32,90   |   45% R$ 19,90 · R$ 24,90

A CESTA REAL (XIS - COMPLETO ×3 + MINI FRITAS ×2)
  ⭐ qtd mínima 1 (pedi −5, ficou 1)
  ⛔ Σ custo das linhas R$ 32,59 == custo do combo R$ 32,59 → FECHA
  ⛔ Σ avulsos        R$ 83,76 == avulsos        R$ 83,76 → FECHA
  ⭐ TETO 36% (ponderado pelo CUSTO) × 38% de média simples · alvos 31 · 36 · 45
  a R$ 71,20 → [verde] "vantagem pro cliente: R$ 12,56 (15,0% mais barato que avulso)"
  a R$ 83,76 → [coral] "combo SEM vantagem — ninguém leva"
  com «MAIONESE CASEIRA» (sem ficha) na cesta → ⭐ custo do combo "a apurar"

NA MESA  «XIS - COMPLETO» hoje 21,26 · ideal 29,90 · 226 un → [ambar] +R$ 1.953 no período
         «MINI FRITAS»   hoje  9,99 · ideal  8,90 · 421 un → [verde] "nada — teu preço já
                                        ganha desse alvo · segura o preço, não baixa"
  ⛔ alguma frase sugere BAIXAR o preço? NÃO ✓
FATIA DOS FIXOS: ~R$ 12,64 por unidade  ← R$ 87.198,72 ÷ 6.901 un
MONTADOR (regressão): 3 canais · 4 tamanhos · 63 sabores (52 com ficha) — INTOCADO
movimentos 7926→7926 · versões 340→340 · canais 3→3  ⭐ ZERO ESCRITA
```

**REGRA 11 — 17 defeitos repostos** (13 nas libs/tela + 4 na referência), **e QUATRO vieram VERDES:**
1. ⛔⛔ **o encaixe do teto ponderado** — meu teste chamava `reguaPonderada` **DIRETO** e nada exercia a chamada dentro de `montarCesta`. ***Guard que testa a função não prova o encaixe de quem a chama*** (a cicatriz da mediana de 03/10). Ganhou o caso de cesta real (XIS + FRITAS → 36 contra 38 simples), e aí morde.
2. a asserção pt-BR com `not.toContain('.')` **pegou o ponto final da frase** (`…CMV 30,0%.`) — apertada pro padrão `\d\.\d`.
3. ⛔ **o grep do "zero escrita" mordeu o COMENTÁRIO do próprio arquivo** (o cabeçalho diz que ele não conhece `prisma`/`react`) — passou a ler via `semComentarios`: ***o arquivo que documenta a regra não pode ser o que a reprova***.
4. o teto da referência casou `l.custo*l.qtd` **dentro do `custoDaCesta`** em vez do bloco do `tetoDaCesta` — apertado pro bloco certo.

**⚠️ E A SONDA DA REGRA 11 DEU UM VERDE FALSO CONVINCENTE:** `npx vitest run $G` com `$G` **sem aspas** — **zsh não faz word-splitting**, então os guards rodaram contra **zero arquivo** e imprimiram nada. É a cicatriz de 23/09 cometida de novo. ⚠️ **E a prova em prod me pegou chutando campo** duas vezes (`farol.frase` em vez de `rotulo`; `m.canais` sem a tradução que a TELA faz) — *sonda errada dá um vermelho tão convincente quanto um defeito real.*

**⚠️ 5 GUARDS REAPONTADOS, nenhum afrouxado, 4 MAIS FORTES:** os de `sanitizarQtd`/`valorQtd` foram **INVERTIDOS com o motivo escrito** — a régua de QUANTIDADE do estoque num campo de DINHEIRO fazia `1.500` virar `1,5` (precisão vem da UNIDADE lá; dinheiro é sempre 2 casas e ponto é MILHAR), e agora o proibido é ela voltar. Os de `p.preco`/`href` foram repontados pro `umSo` e dois ganharam a procedência (`media={umSo.preco}` + proibição de uma 2ª média; proibição do `value={...toFixed}` e do fallback `precoTxt !== ''`).

**⚠️ E A REFERÊNCIA É LEI — EU TINHA RENOMEADO O CARTÃO.** Troquei o título por *"🧺 Escolha produtos…"*; `docs/margem-referencia.html` é a régua versionada, então **o título exato voltou** (*"🍔 Escolha um produto e veja o preço ideal"*) e o combo é dito na `dica`. ⭐ A seção que eu escrevi na referência **declara a procedência num comentário HTML** (deriva do brief ESCRITO do dono, **não** de um desenho aprovado) — o precedente da cascata de 10/10: *inventar um visual e chamá-lo de "o mock aprovado" é exatamente o erro que o protocolo de 10/09 existe pra impedir*.

**970 arquivos · 12.987 verdes · 2 todo · TS 0 · migration NENHUMA · deploy 4/4 (`N1sFwm9HE6vTeVOO9JejB`) · Δ chunks +4 KB.**

📋 **FICA PRO DONO (o clique é dele, REGRA 2):** navegar a cesta no celular e no notebook (xis bacon SOZINHO, depois XIS - COMPLETO + MINI FRITAS, digitando e apagando o preço) · **declarar o teto de BEBIDAS e de DOCES** (2 números, matam 1.358 un de derivado) · e **classificar os 81 de OUTROS** pelo gesto do Cardápio — começando pelos de volume: Combo Caçula (564), CACULA BOX (215), MAIONESE CASEIRA (126), ORIGINAL (93), PRENSADO COMPLETO (81). ⚠️ *"tele entrega" (16 un) não é comida* — é taxa, e vale uma decisão à parte.

## ⭐⭐ QUEM PAGA A CASA v3.1 — A LEI DE LAYOUT: LARGURA CHEIA + DUPLAS (08/10/2026)

**O dono substituiu `docs/margem-referencia.html` pela v3.1** (o rodapé do arquivo diz a versão). A mudança é **SÓ DE LAYOUT**, e nasceu comentada no CSS dele como **"LEI DE LAYOUT"**:

> *"a tela ocupa a largura útil do conteúdo do dashboard (ao lado da sidebar), como as telas profissionais — **NUNCA uma coluna estreita centralizada com vazio dos dois lados**. Teto 1440px só pra monitores gigantes."*

**⚠️⚠️ E O ARQUIVO NOVO TAMBÉM NÃO ESTAVA EM `docs/` — estava em `~/Downloads`. TERCEIRA VEZ a mesma cicatriz** (o mock da Conciliação em 10/09, a referência v3 em 07/10, esta agora). Copiado e versionado. ⭐ *O protocolo que sobrevive a isso é o guard LER o arquivo versionado: o diff conta a história sozinho.*

**⭐⭐⭐ E O RED-THEN-GREEN VEIO DE GRAÇA, COMO O DONO PREVIU.** Porque o guard **abre o arquivo** em vez de descrever o visual em palavras, bastou a referência nova entrar no repo pra ele acusar **2 vermelhos contra a tela velha**, sem eu escrever uma linha: *"`max-width:860px` não está no CSS"* e *"medidas da referência ausentes da tela: 1024"*. ***É o pagamento do protocolo de 10/09:*** com o mock versionado, *"igual à referência"* deixou de ser memória minha e virou **dado que diverge e grita**.

### O QUE MUDOU — e nada além disso

| # | a lei | como ficou |
|---|---|---|
| **1 CONTAINER** | largura útil do conteúdo, teto **1440px**, padding **22/28px** (16/14 no celular) | `max-w-[860px]` **morreu** → `max-w-[1440px] px-[28px] pt-[22px] pb-[64px]` + `max-[700px]:` com 14/16/56 |
| **2 DUPLAS ≥1024px** | (Quem carregou \| A liga) e (Montador \| Fila) lado a lado · grid `1fr 1fr` · gap 14 · `align-items:start` | componente `<Duo>` com `lg:grid lg:grid-cols-2 lg:items-start lg:gap-[14px]`; abaixo de 1024 **empilha igual antes** |
| **3 nada mais** | tokens, frases, medidas de letra, conta e comportamento **idênticos à v3** | nenhuma lib tocada, nenhuma frase mudada, Δ bundle **+0 KB** |

**⛔ `.duo .card{margin-bottom:0}` MORA NO SELETOR DE FILHO DA PRÓPRIA DUPLA** (`lg:[&>section]:mb-0`), não numa prop que cada chamador tem que lembrar de passar — **REGRA 5: disciplina virada impossibilidade**. Sem zerar a margem, a coluna mais curta empurraria a linha seguinte. ⚠️ E o `items-start` é o que mantém os dois cartões no topo: sem ele o mais curto esticaria até a altura do vizinho e a **borda de baixo dele mentiria sobre onde o conteúdo acaba**.

⚠️ **O montador na meia-largura cabe sem composição nova:** o `.mont-wrap` da referência já tem `flex-wrap`, e `170 (svg) + 20 (gap) + 250 (conta mínima) = 440px` entra na metade de 1024 em diante. **Uma composição, três tamanhos** (REGRA 12) — o que muda é a LARGURA dos elementos, nunca um bloco só-celular.

⚠️ **E o shell do dashboard já põe `px-4 lg:px-6` por fora** (o molde de 23/08), então o respiro lateral real soma o dele aos nossos 28px. Os 4 números do padding são os do ARQUIVO, escritos literais; se o dono quiser exatamente 28, a saída é deixar o molde do shell mandar (é o que todas as outras telas fazem) — **é decisão dele, e está registrada em vez de resolvida por conta própria**.

### ⛔⛔ O GUARD APRENDEU A DIFERENÇA ENTRE BREAKPOINT E MEDIDA DE ELEMENTO

A extração de medidas pegava `(?:^|[^-a-z])…width:Npx`, e com a v3.1 o **`min-width:1024px` do `@media`** passou a entrar **como se fosse largura de elemento** — cobrando um `[1024px]` literal numa tela que expressa aquele corte como `lg:`, o alias do Tailwind. ⭐ **Breakpoint e medida de elemento são duas coisas**, e cada uma ganhou leitor próprio: as medidas excluem o que vem depois de `(`, e os cortes têm teste próprio (alias pros padrão `sm:`/`lg:`, **literal** pros que o dono escolheu fora da escala — 700 e 560).

**⚠️⚠️ E A LISTA DE RENDER DO GUARD PASSOU A TERMINAR NO `</>` DO FRAGMENTO, nunca no primeiro `</div>`:** com as duplas, aquele `</div>` é o fechamento de uma `<Duo>` — cortar ali faria o guard **aprovar uma tela com 4 dos 6 cartões**. Achado antes de morder, mas é a mesma família do teto de leitura que esconde o item (o `take: 50` do fermento, o `take: 200` da ordem do ano 202).

### ⛔⛔⛔ E A PROVA EM PROD ACHOU DUAS CÓPIAS DA MESMA RÉGUA — ENTRE O TESTE E A PROVA

A 1ª rodada acusou **"as 13 medidas da referência no bundle — FALTAM 1024"** sobre uma tela **CORRETA**. A causa: o guard e a sonda extraíam as medidas com **duas cópias do mesmo regex**, eu consertei a do guard e **deixei a da sonda atrás**.

***É a doença que esta casa mais paga, agora num par novo: o TESTE e a PROVA.*** Duas réguas pro mesmo arquivo e uma delas mente — **e é sempre a que ninguém reconsertou**. ⚠️ Pior: a mentira aqui é do tipo que **desacredita a tela certa**, que é como se aprende a ignorar a prova.

**⭐ `lib/margem/referencia.ts` é a PORTA ÚNICA de leitura** — devolve `html`, `css`, `script`, `tokens`, `letras`, `medidas` (de ELEMENTO) e `cortes` (os `@media`); o guard e a sonda importam ELE. O `[^-a-z(]` tem o motivo escrito no arquivo: sem o `-`, o `max-width:1440px` do container entra como largura de elemento; sem o `(`, o corte do `@media` entra também.

**⭐ E O LEITOR GANHOU AUTO-TESTE, nascido do próprio vermelho:** 1024 e 700 são **cortes** e não medidas · 170 e 132 são **medidas** e não cortes · o **1440** do container fica fora das medidas · e as 4 listas vêm cheias (arquivo mudo seria **falso verde pra tudo**).

### ⚠️ REGRA 11 — 7 DEFEITOS REPOSTOS, 7 VERMELHOS

| defeito reposto | vermelhos |
|---|---|
| **a coluna de 860px centralizada VOLTA** (o defeito que a v3.1 mata) | **2** |
| as DUPLAS somem (os 4 cartões voltam empilhados) | 1 |
| a dupla deixa de ser grid de 2 colunas em ≥1024 | 1 |
| o `margin-bottom:0` do cartão dentro da dupla cai | 1 |
| o `align-items:start` cai (o cartão curto estica) | 1 |
| o padding do CELULAR (o corte de 700px) é removido | 2 |
| a ORDEM dentro da dupla trocada (a liga antes de quem carregou) | 2 |

### PROVADO EM PROD, NOS 3 TAMANHOS

```
CELULAR 390 200/286ms · NOTEBOOK 1280 200/167ms · MONITOR 1600+ 200/159ms
✓ 1 LINHA 12/12 · ✓ 2 PLACAR 27/27 · ✓ 3 QUEM CARREGOU 18/18
✓ 4 LIGA 18/18 · ✓ 5 MONTADOR 27/27 · ✓ 6 FILA 9/9  ⭐ as 6 COMPLETAS nos 3

A LEI DE LAYOUT
  ⛔ a coluna de 860px centralizada: MORREU ✓
  ✓ teto 1440px no bundle · ✓ compilado no CSS que prod serve
  ✓ ≥1024px (duplas montadas): @media ok · a regra ok
  ✓ ≤700px (padding do celular): @media ok · a regra ok
  ✓ lg:grid-cols-2 · ✓ lg:items-start · ✓ lg:gap-[14px] · ✓ max-[700px]:px-[14px]
  ✓ a margem do cartão DENTRO da dupla é zerada em ≥1024
  ⛔ hex no chunk DESTA tela: 0 · ✓ 24 tokens nos DOIS mapas · ✓ 15 letras · ✓ 12 medidas

A CONTA, intacta: cartão1 − cartão2 = cartão3 ⭐ FECHA · BARRA 87,1% + 12,9% = 100,0% ⭐
  Σ(carregadores) R$ 66.487,33 == sobra bruta ⭐ FECHA
canais 3→3 · regras 3→3 · bases 2→2 · avisos 27→27  ⭐ ZERO ESCRITA
```

⚠️ **O dono mexeu no plano de custo fixo no meio da prova** — a casa foi de R$ 43.599,36 pra **R$ 49.827,84** entre duas rodadas, e o placar **continuou fechando** com a barra somando 100 (transbordo 31% → 15%). É o motor vivo, não ruído.

**926 arquivos · 12.205 verdes · TS 0 · migration NENHUMA · deploys 4/4 (`OEjJ-FduXoZtuGupn2H8_`, `ZP30eqXhQ_MDGef75FR_E`) · Δ bundle +0 KB.** ⛔ **Zero escrita em dado de prod.**

📋 **FICA PRO DONO:** **abrir nos 3 tamanhos e nos 2 temas, com a referência ao lado.** ⚠️ A prova afirma que as REGRAS de cada corte estão no CSS que prod serve (`@media` + a regra compilada) e que as classes estão no bundle — **o servidor não tem navegador, então quem vê as duplas montadas é ele**. Screenshot indisponível (extensão do Chrome desligada). As pendências de v3/v2 seguem as mesmas: as bolinhas todas azuis (é o mapa do `caraDaReceita`, não a tela) · a busca de sabores que a referência não tem · as bases de PEQUENA e FAMILIA · ⛔⛔ a massa faltando nas fichas de pizza grande.

## ⭐⭐⭐ QUEM PAGA A CASA v3 — A REFERÊNCIA VISUAL VIROU LEI, E O GUARD LÊ O ARQUIVO (07/10/2026)

**A ordem do dono:** *"o arquivo `docs/margem-referencia.html` é a LEI VISUAL desta tela, construído e aprovado por mim. A tela em prod deve ficar IGUAL a ele — layout, hierarquia, tamanhos de letra, cores, espaçamentos, textos e comportamento. **Divergência visual da referência = defeito.**"*

**⚠️⚠️ E O ARQUIVO NÃO ESTAVA NO CAMINHO QUE ELE DEU** — estava em `~/Downloads/margem-referencia.html`. **É a cicatriz de 10/09 pela segunda vez** (o mock da Conciliação). Copiado pra `docs/`, que é onde ele espera e **onde o guard lê**.

**⭐⭐ A JOGADA QUE FECHA A CLASSE É A MESMA DE 10/09: a referência ENTROU NO REPO.** Enquanto ela vivia numa pasta de downloads, *"igual à referência"* era **memória minha** — e memória é exatamente o que falhou nas três voltas da Conciliação. Versionada, ela é **dado**: `__tests__/regras-ui/margem-bate-com-a-referencia.test.ts` **ABRE o arquivo** e compara os **28 tokens do `:root{}`**, as **15 hierarquias de letra** e as **12 medidas** extraídas do CSS, as **6 seções na ordem**, as frases, e o **`<script>` como especificação do montador**.

**⭐⭐ TODA ASSERÇÃO DE FRASE É DE DOIS LADOS:** a frase tem que existir **na REFERÊNCIA** *e* **no CÓDIGO**. Se eu inventar uma frase, o lado da referência fica vermelho; se o código andar, o lado do código fica vermelho. ⛔ Uma asserção que só olhasse o código me deixaria escrever qualquer coisa e chamar de *"o que o dono aprovou"* — e o auto-teste do detector prova os dois sentidos (o `Combo Caçula` do exemplo existe na referência e **não pode** estar no código, porque seria dado inventado).

### ⭐ O MAPA 1:1 DOS TOKENS — por PAPEL, nunca por hex

O comentário do próprio arquivo manda: *"onde houver token genérico abaixo, mapear 1:1 para o token da casa"*. `--bg`→`--prod-bg` · `--surface-2`→**`--prod-surface-1`** (⚠️ o `--prod-surface-2` da casa é OUTRA coisa) · `--border`→`--prod-line` · `--text-3`→`--prod-muted` · `--indigo`→`--fam-indigo-mid` · `--indigo-50`→`--fam-indigo-bg` · `--verde-esc`/`--verde-900`→`--fam-verde-ink` · idem ambar/coral/rosa/azul · `--shadow`→`--prod-sombra`.

⚠️ **O par NÃO é por VALOR:** `--verde` da referência é `#1D9E75` e o `--fam-verde-mid` da casa é `#0f9d58` — tons diferentes do MESMO verde, e o da casa é o que **inverte nos dois temas** junto com o resto do sistema. Cravar o hex da referência seria trocar a paleta da casa pela do arquivo de exemplo. **O guard exige que todo token do `:root{}` tenha par declarado** (token novo na referência fica vermelho) e que **a tela não pinte por token FORA dessa paleta** — com `--prod-acao-bg`/`--prod-acao-ink` como as **duas exceções nomeadas** (a referência crava `#fff` no texto de dentro da fatia; a casa tem o par "tinta sobre fundo forte", que inverte). **ZERO hex na tela.**

**⛔⛔ E OS ESPAÇAMENTOS VIRARAM px LITERAL** — `gap-2.5` **é** 10px e `pt-3.5` **é** 14px, certos, mas obrigam tradução mental, e **foi tradução mental que produziu as duas versões erradas da Conciliação** (10/09). Agora é `gap-[10px]`, `px-[18px]`, `py-[9px]`, `text-[26px]`: o número que está no arquivo, escrito igual. O guard **extrai** os valores do CSS da referência e cobra cada um.

### O QUE MUDOU NA TELA, seção por seção

| # | a referência manda | o que a tela tinha |
|---|---|---|
| **cabeçalho** | h1 **20px**/600 + sublinha 13px com o período · chips em **pílula** (12,5px, 5/12px, a ligada com fundo índigo) | h1 `text-base`, período inline, botões quadrados |
| **1 linha de chegada** | manchete **21px** com o valor em VERDE · *casa do dia* à direita (19px) · trilho de **12px** com a bandeirinha marcando o **100%** · *"daqui pra frente cada venda é lucro"* no pé | barra de 28px com a bandeira dentro, frase embaixo |
| **2 placar** | 3 cartões (lbl 12px/600 · **val 26px/700** · sub 11px), o 3º em verde/âmbar · **UMA** barra de 16px · legenda de 3 spans · **a linha da COBERTURA** no pé | a mesma ideia + uma "conta aberta" e um box do dia D que a referência substitui |
| **3 quem carregou** | **bolinha de 10px** da família · nome 200px · barra flex · valor 132px · o agregado como LINHA que expande · rodapé âmbar | `LogoDaReceita` de 32px, botão separado, lista de "fora" expansível |
| **4 liga** | medalha 22px · bolinha · **selo em pílula** (10,5px/700, cor por veredito) · valor 120px com `.det` | grid com logo + barra |
| **5 montador** | **sempre aberto** · pizza de 170px · conta de 14px com o total em borda-em-cima · preço editável de **92px** · sabores em **chips** | colapsável, grid de 260px, lista com busca |
| **6 fila** | chips tracejados âmbar + *"… e mais N ▾"* que expande | chips + nota de texto |

### ⭐⭐ AS FRASES DE DINHEIRO FORAM PRA LIB — porque é lá que elas dão pra EXECUTAR

- **`janela.rotuloCurto`** (*"outubro"*): a referência escreve o período em DOIS lugares com pesos diferentes (a sublinha leva *"outubro (até 07/10)"*, o título do placar leva *"O placar de outubro"*). ⛔ Recortar o `rotulo` na tela seria a 2ª régua do nome do período.
- **`dia.manchete`** PARTIDA (`prefixo` + `destaque`): a referência destaca o valor em verde. ⛔ Um `split(' sobrou ')` na tela seria a 2ª régua da própria frase — **quem parte é quem escreve**, e um teste exige `prefixo + destaque === frase` ao caractere. O *"daqui pra frente cada venda é lucro"* saiu do fim da frase e virou **`lucroDaquiPraFrente`**, porque a referência o põe em outro lugar do cartão (e grudado na manchete ele apareceria **duas vezes**).
- **`linhaDaCobertura(casa)`** PURA: *"cobertura: **55% das unidades vendidas têm custo** · 49 na obra · 114 fora · acima de **80%** eu digo **o dia em que a casa se pagou**"*. ⛔⛔ **É ELA que impede o veredito de ficar seco** — o cartão 3 pode dizer *"✓ CASA PAGA"*; é esta linha, no pé do MESMO cartão, que diz sobre QUANTO do dado aquilo foi medido. ⚠️ O **limiar vem da constante**, nunca digitado; cobertura `null` **não vira 0%**; e **cobertura boa ainda sem dia usa o motivo do PLACAR**, não o do limiar — repetir a frase do limiar ali mandaria o dono atacar a fila de fichas pelo motivo errado.
- **O veredito mora no RÓTULO** (*"✓ CASA PAGA — e sobrou"* / *"FALTAM"*), como a referência escreve — é o que o olho pega primeiro, em vez de um *"resultado"* mudo com o número embaixo.
- **O PISO do complemento entrou na sublinha do cartão 1**: *"já abatidos R$ 9.255,55 de complementos · 1272 ocorrências ainda sem ficha — o abatimento acima é o mínimo, não o total"*. ⚠️ A referência não tem a "conta aberta" embaixo dos cartões; ela põe o abatimento **na sublinha do número que ele afeta**. A régua de honestidade não se perdeu — mudou de casa, e agora mora onde dá pra testar.
- **`montarCarregadores().agregado`**: a linha *"+ 43 produtos · 34,8% · ver todos ▾"* com barra própria. ⛔ Nasce na LIB porque somar o resto é **aritmética de dinheiro**, e o guard proíbe `.reduce` na tela.
- **`SobraNoCanal.taxaPct`**: pra a tela escrever *"no iFood (taxa 20%)"* **sem digitar o 20** — ele vem da config de canais, editável com rastro. ⛔ `null` = *a declarar*, e isso **não é 0%**.

### ⚠️⚠️ DUAS DIVERGÊNCIAS DELIBERADAS, DECLARADAS E TRAVADAS EM TESTE

1. **O botão de tema 🌙/☀️ NÃO vem.** Na referência ele existe pra o arquivo rodar sozinho no navegador e demonstrar os dois temas; **a casa já tem o tema dela** (`:root`/`.dark` no `globals.css`), e um segundo interruptor aqui seria **duas portas pra a mesma decisão**. O guard exige a ausência **e** que o motivo esteja escrito no arquivo da tela.
2. **O bloco do relatório de complementos incompleto FICA**, condicional. A referência mostra o estado NORMAL (sem aviso); esconder o aviso de qualidade de dado porque o exemplo não o tem seria **trocar uma régua de honestidade por fidelidade de exemplo**.

### ⚠️⚠️ REGRA 11 — 13 DEFEITOS REPOSTOS, E OS DOIS PRIMEIROS VIERAM VERDES

| defeito reposto | vermelhos |
|---|---|
| **um CARTÃO sai da lista de render** | ⛔ **VERDE** → depois do aperto: **2** |
| **a ORDEM de dois cartões trocada** | ⛔ **VERDE** → depois do aperto: **1** |
| hex cravado (o roxo da referência na mão) | 2 |
| o 26px do placar ajustado "no olho" pra 24px | 1 |
| a linha da COBERTURA sai do placar | 1 |
| o FATOR por tamanho volta (dividir pelo nº de fatias) | 7 |
| a âncora `#fila` some (o rodapé cobra sem dar o caminho) | 2 |
| a RESSALVA do veredito arrancada do cartão | 1 |
| a FRASE da referência trocada (*"já abatidos"* → *"já descontados"*) | 2 |
| token FORA da paleta da referência | 1 |
| o botão de tema vem pra prod | 1 |
| a tela derivando a cor por conta própria | 1 |
| a taxa do iFood digitada na tela | 1 |

**⛔⛔ OS DOIS PRIMEIROS SÃO A "MENÇÃO, NÃO USO" OUTRA VEZ, e o furo é instrutivo:** eu procurava as 6 âncoras **no arquivo inteiro**. Arrancar `<MontadorDePizza />` da lista de render deixou a suíte **VERDE**, porque a `function MontadorDePizza` e todos os textos dela continuavam no arquivo; trocar a ORDEM passou pela mesma razão. ***Guard que lê o arquivo aprova o componente que ninguém desenha.*** O que morde é ler a **LISTA DE RENDER** (o JSX que roda quando o payload chega) e exigir ali os 6, na ordem do arquivo do dono — e **a ordem da lista do guard é conferida contra a ordem das seções NA REFERÊNCIA**, então se o dono reordenar o arquivo é esse teste que fica vermelho primeiro.

**⚠️ 4 GUARDS DE v2 REAPONTADOS com o motivo escrito, nenhum afrouxado:** o do `LogoDaReceita` (a referência desenha a BOLINHA — a pergunta da REGRA 4 não mudou: *quem traduz nome → cor?* é o SERVIDOR, e o guard passou a **proibir** a tela de importar `caraDaReceita`) · o do complemento (mudou da "conta aberta" pra a sublinha, e passou a ser conferido na LIB, onde EXECUTA) · o do `placar.porque` (virou `linhaDaCobertura`) · o do rodapé (o caminho mudou de endereço: `#fila`, a fila DESTA página). **E 2 testes invertidos:** *"já descontados"* → *"já abatidos"* (o verbo é o da referência) e o da **busca de sabores**, que a referência não tem — ⭐ com a metade certa travada num `expect` próprio (*se a busca voltar, com o pedido dele, ela não pode ser `includes` cru*).

⚠️ **E a régua do "só escreve quando cabe"** no `/vendas|baixa|movimento|processar/` do montador virou **caminho de ROTA**, não palavra: a própria dica do cartão diz *"nada grava, nada **baixa**"* — texto da referência —, e o regex por palavra reprovava a frase honesta.

### PROVADO EM PROD, NAVEGANDO, NOS DOIS VIEWPORTS — seção por seção contra o arquivo

```
CELULAR 200 em 603ms · DESKTOP 200 em 175ms · chunk desta tela 68 KB
✓ 1 LINHA DE CHEGADA 8/8 · ✓ 2 PLACAR 18/18 · ✓ 3 QUEM CARREGOU 12/12
✓ 4 LIGA 12/12 · ✓ 5 MONTADOR 18/18 · ✓ 6 FILA 6/6   ⭐ as 6 COMPLETAS nos dois
⛔ hex de cor no chunk DESTA tela: 0 · ✓ os 24 tokens nos DOIS mapas do CSS
✓ as 15 hierarquias de letra e as 12 medidas da referência no bundle
⛔ o botão de tema: NÃO VEIO ✓

O PLACAR
  [O que as vendas deixaram] R$ 57.231,78
       sobra medida em 55% das vendas · já abatidos R$ 9.255,55 de complementos ·
       1272 ocorrências ainda sem ficha — o abatimento acima é o mínimo, não o total
  [A casa custou até aqui]   R$ 43.599,36 · casa + banco + compromissos
  [✓ CASA PAGA — e sobrou]  +R$ 13.632,42 · daqui pra frente é lucro
       ressalva: é o que dá pra medir: 55% do que você vendeu tem custo conhecido,
                 e 114 produtos estão fora da obra
  ⛔ cartão1 − cartão2 = cartão3 → ⭐ FECHA
  BARRA índigo 76,2% + verde 23,8% = 100,0% ⭐ SOMA 100 · bandeira true · +31%
  COBERTURA: cobertura: **55% das unidades vendidas têm custo** · 49 na obra ·
             114 fora · acima de **80%** eu digo **o dia em que a casa se pagou**

QUEM CARREGOU  ⛔ Σ(carregadores) R$ 66.487,33 == sobra bruta R$ 66.487,33 → ⭐ FECHA
  👑 Combo Caçula 44,5% da casa · R$ 19.408,50 · barra 100%
     PIZZA FAMILIA 45CM 25,4% · PIZZA GRANDE PRECINHO 18,0% · …
     [cinza] + 43 produtos · 34,8% · R$ 15.183,95 · barra 78% · ver todos ▾

O MONTADOR  canais balcão 0% · tele própria 0% · iFood 20%
  GRANDE(2✓) · GRANDE PRECINHO(2←GRANDE✓) · PEQUENA(1 SEM BASE) · FAMILIA(3 SEM BASE)
  61 sabores (50 com ficha · 11 âmbar) · ⭐ o clique na fatia existe no bundle
  trocar o tamanho REDESENHA: GRANDE→2 · GRANDE PRECINHO→2 · PEQUENA→1
  GRANDE de ENTREVERO + FILE COM BACON · base R$ 11,58 + sabores R$ 27,20 = R$ 38,78
    sem preço    → balcão a apurar · iFood (taxa 20%) a apurar
    a R$ 89,90   → balcão ~R$ 51,12 · iFood (taxa 20%) ~R$ 33,14
    a R$ 99,90   → balcão ~R$ 61,12 · iFood (taxa 20%) ~R$ 41,14
  ⭐ o preço RECALCULA a sobra de cada canal

canais 3→3 · regras 3→3 · bases 2→2 · avisos 27→27  ⭐ ZERO ESCRITA
```

**926 arquivos · 12.200 verdes · TS 0 · migration NENHUMA · deploy 4/4 (`gQDoEjKb6u5Q_Nh9XNzpZ`) · Δ bundle −8 KB.** ⛔ **Zero escrita em dado de prod.**

⚠️ **O CHECKLIST DO DONO, item por item:** os 6 cartões presentes e na ordem ✓ (provado na **lista de render**, não no arquivo) · o placar fecha ✓ · a barra soma 100 ✓ · as fatias respondem ao clique ✓ (o handler no bundle + a conta mudando com as escolhas e com o tamanho) · o preço recalcula ✓ (as três linhas são a MESMA pizza).

⚠️ **UMA SONDA MINHA DEU FALSO VERDE NO MEIO DA REGRA 11** — eu grepava `"Tests  N failed"` na saída do vitest e a linha vem com ANSI; os 5 primeiros defeitos "passaram" com saída vazia. *Sonda errada dá um verde tão convincente quanto um vermelho* (a cicatriz do `$G` de 23/09, em roupa nova). Refeita gravando em arquivo e limpando o ANSI — e foi só então que os dois VERDES de verdade apareceram.

📋 **FICA PRO DONO:**
1. **Abrir a tela no celular e no computador, nos dois temas, com a referência aberta ao lado** — a prova mede o que prod serve (zero hex, os tokens nos dois mapas, as 15 letras e as 12 medidas), mas **o olho é dele**. ⚠️ Screenshot indisponível (a extensão do Chrome está desligada nesta sessão).
2. ⚠️ **TODAS as bolinhas dos carregadores saem AZUIS** no dado de hoje — as 6 linhas visíveis são pizza/prato, e o `caraDaReceita` manda todas pra a família `azul`. A referência de exemplo mostra rosa e índigo porque os nomes dela caem em famílias diferentes. **Não é defeito do v3** (a cor vem da fonte única), mas a bolinha perde o poder de distinguir — se ele quiser, o caminho é o mapa do `caraDaReceita`, não a tela.
3. ⚠️ **A busca de sabores NÃO existe mais no montador** (a referência não tem): são **61 chips**, com os 50 de ficha primeiro e os 11 âmbar depois, e eles só aparecem **depois de tocar numa fatia**. Se a parede incomodar, a busca volta com a palavra dele.
4. **Carregadas de v2:** conferir as 2 bases que eu apontei e apontar as de **PEQUENA** e **FAMILIA** (hoje a bancada diz *"a apurar"* nelas, de propósito) · ⛔⛔ **a massa falta em TODAS as fichas de pizza grande** (o CASO A de 02/10 — enquanto estiver assim, o custo da base sai subestimado em qualquer escolha; receita é decisão dele desde 17/08) · a % do iFood em 20% · a ficha de margem por produto (lib pronta, tela não) · o editor de dose ao vivo · o clique no sabor em qualquer lugar.

## ⭐⭐⭐ A ETIQUETA VIROU A TELA — E A LIÇÃO É SOBRE ENSINO, NÃO SOBRE LÓGICA (31/08/2026)

**⛔⛔ O RELATO DO DONO É O ACHADO:** *"o comportamento está CORRETO, mas a tela FALHOU no teste de uso: eu mesmo, dono do produto, olhei e conclui que os dois lados faziam a mesma coisa. Se eu me confundo, a Marcyelle se confunde."*

Ele digitou **"queijo"** no campo Rótulo do nome do produto achando que trocava o CONTEÚDO, e a prévia mostrou **"queijoPorção de carne 100g"**. **Nada estava quebrado** — dois blocos de inputs visualmente idênticos, um em cada lado da tela, e **nada mostrando que "Rótulo" e o valor formam UMA linha da etiqueta**. **Se o dono lê errado, a régua está errada — não o leitor.**

**⭐ O DESENHO NOVO (padrão ZebraDesigner/BarTender/Canva): a etiqueta é o elemento principal e a edição acontece NO elemento.** Três colunas — camadas · etiqueta (400px, o centro) · inspetor da linha. Sumiram os 9 cards empilhados **e** o card "Dados de prévia": cada dado de exemplo passou a morar **na linha a que pertence**.

**⭐⭐ O QUE ENSINA SÃO TRÊS COISAS AMARRADAS**, não um texto explicativo: (1) a tira *"como sai na etiqueta"* mostra a linha **montada**, com as partes pintadas — `VAL` em chip azul, `03/09/2026` em chip âmbar tracejado; (2) as caixas de edição repetem **exatamente** as mesmas cores (🔒 azul = salvo · 👁 âmbar = só prévia); (3) focar um campo **acende** a parte correspondente na etiqueta, e clicar numa parte leva o cursor ao campo dela. O mapeamento vira literal.

⚠️ **A LINHA DE TEXTO LIVRE tem só a caixa azul** (o texto dela É salvo) — a ausência da caixa âmbar ensina o contraste de graça, sem mais uma legenda.

**⭐ A INTERAÇÃO ENTROU NO `PreviaEtiqueta` QUE JÁ EXISTIA, e não num "canvas editável" novo:** um segundo renderizador faria o que se **edita** divergir do que se **imprime** na primeira mudança de layout. Sem `onSelecionar` o componente é o mesmo de antes — a tela `/estoque/etiquetas` não mudou em nada. As partes (`{rotulo, conteudo}`) viraram **dado do layout**, com teste provando que **recompõem exatamente** o texto desenhado (não são um 2º cálculo).

**⚠️ DECISÕES DO DONO no desenho:** (a) **um card só** no topo — "Espaço usado"; "linhas ativas" e "avisos" repetiam o que já está a dois centímetros e roubavam espaço da etiqueta. **E o denominador é derivado do MESMO limite do `estourou`** (`LADO_DOTS_USAVEL`), senão a barra diria 92% numa etiqueta já estourada; (b) **arrastar E setas ↑↓ nos DOIS** (desktop e celular), uma lista só, os dois gestos chamando `moverBloco` — *"dois comportamentos diferentes pra mesma lista é fonte única quebrada"*; o teclado vem de brinde; (c) **faixa de clique da largura inteira** — clicar no vazio à direita de "25 UN" seleciona a linha da Quantidade.

**⭐⭐ O TESTE QUE MATA A CLASSE, não a instância:** *"nenhum campo do modelo fica sem jeito de ser previsto"* (`ENTRADAS_PREVIA`). Campo novo sem entrada = campo que o dono não consegue prever — e aí ele tenta trocar pelo Rótulo de novo, que foi exatamente o que aconteceu.

## ⛔⛔ "RÓTULO SOZINHO NÃO VIRA LINHA" ERA REGRA ERRADA — E O ASSASSINO NÃO ERA O SUSPEITO (31/08/2026)

**CASO REAL, achado pelo dono no browser:** rótulo **"carne 100 grama"** no Nome do produto + conteúdo de prévia vazio → **a linha sumia inteira**. Bastava digitar uma letra pra voltar. **Isso quebrava a promessa que a própria tela faz:** a caixa azul do inspetor diz *"SAI EM TODA ETIQUETA — É SALVO"*, e não saía.

**⚠️⚠️ ERAM DOIS GUARDS, e o apontado nem chegava a rodar:**
```
201:  if (!bruto.trim()) continue     ← MATAVA AQUI (guard de 30/08, decide pelo CONTEÚDO)
204:  if (!valor) continue            ← o suspeito; inalcançável
```
**Corrigir só o `juntarRotuloValor` teria deixado o bug vivo** e o dono reabriria o chamado. **Guard que decide por UMA das partes não pode existir num lugar onde a linha é a SOMA das duas.** Os dois viraram **um só**, sobre o valor que vai ser desenhado.

**⭐ E A SUSPEITA DO DONO ESTAVA CERTA — eram duas réguas pro mesmo caso.** A regra velha nasceu pra evitar imprimir **"VAL" solto sem data**; mas `valoresDaEtiqueta` devolve **"A DEFINIR"** quando não há validade, **nunca string vazia**. Ela guardava um estado **inalcançável** e cobrava um bug real por um problema que a outra régua já resolvia.

**A REGRA ÚNICA: a linha existe se há algo pra imprimir — rótulo OU conteúdo.**

| rótulo | conteúdo | sai |
|---|---|---|
| `"VAL"` | vazio | **não acontece** (vem "A DEFINIR") |
| `"carne 100 grama"` | vazio | **`carne 100 grama`** |
| vazio | vazio | nada — linha em branco vira buraco |
| vazio | `"X"` | `X` |

⚠️ **O teste que afirmava a regra errada foi INVERTIDO com o motivo escrito, não apagado** — o mesmo tratamento que a heurística do FITID recebeu quando caiu por evidência. **Red-then-green:** com os dois guards de volta, **4 testes acusam**, incluindo *"a linha sumiu — é o bug de 31/08"*. **67 testes de etiqueta** (era 45 antes deste ciclo) · 676 stock verdes · TS 0.

⚠️ **PENDÊNCIA REGISTRADA:** a **régua de calibração da largura** (`LARGURA_CALIBRADA=false`, aviso diz *"pode sair cortada"* e nunca "corta"; um teste trava a hedge). O dono decidiu não rodar a régua ainda — **lembrar quando ele falar da Zebra de novo**. ⚠️ E um **4º teste vermelho** além dos 3 documentados: `producao-invariants > P2` (ordem parada > 24h), **provado pré-existente** com `git stash` contra o HEAD limpo.

## ⭐⭐⭐ EDITOR DE MODELO DE ETIQUETA — O DONO DESENHA (30/08/2026)

**VEREDITO DO ESTUDO, registrado:** o **conteúdo** nosso já era **≥ SuFlex** — lote com **custo real** e QR com **rastro até a nota da SEFAZ**, que eles não têm. **A flexibilidade do modelo era o gap** — e morre aqui. Eles deixam **configurar** (ligar/desligar campo); aqui o dono **DESENHA**: renomeia rótulo (`FAB` → `FABRICAÇÃO`), reordena, muda fonte, põe negrito/destaque, adiciona **linha de texto livre** ("Mantenha congelado", CNPJ, telefone) e cria **vários modelos**, com escolha por item.

**⚠️ TROQUEI COORDENADA FIXA POR FLUXO DE BLOCOS, e a razão é estrutural:** "arrastar pra reordenar" e "adicionar linha" são **impossíveis** com x/y cravados — mover um campo exigiria recalcular o y de todos os outros na mão, e uma linha nova empurraria tudo. **Com fluxo, a ORDEM DA LISTA É O LAYOUT**: o dono arrasta, o sistema calcula.

**⭐ E A FONTE CONTINUA ÚNICA:** `blocosParaLayout` vira posições, e **ZPL e prévia consomem essa saída**. **Prévia do editor == prévia da tela de imprimir == o que sai da Zebra**, nos três lugares, porque os três chamam a mesma função. Testes travam: **reordenar muda os dois na mesma medida**; **desligar tira dos dois**.

**⚠️ AVISA QUANDO NÃO CABE:** com texto livre o dono vai estourar os 480 dots. A prévia ganha borda vermelha e diz o que fazer — **cortar em silêncio seria descobrir só com a etiqueta na mão**.

**⚠️ O MÍNIMO SANITÁRIO AVISA E NÃO TRAVA** (a regra de sempre): desligar a VALIDADE diz *"não atende a Vigilância Sanitária"* e **salva assim mesmo**. **Travar empurraria o dono a escrever a validade à mão numa fita crepe — que é pior, porque sai do sistema.** Sem lote **e** sem QR avisa de rastro; **com QR só, não avisa** (o QR carrega o lote).

**⚠️ SETINHAS ↑↓ EM VEZ DE ARRASTAR:** no celular — onde o dono vai mexer — arrastar dentro de lista que rola **briga com o scroll** e vira frustração. Mesma função, no dedo frio, sem biblioteca.

**⚠️ E LÊ O JSON DO BANCO COM DESCONFIANÇA:** bloco inválido é **descartado** e o resto imprime — melhor etiqueta sem uma linha que produto sem etiqueta.

**⭐ DETALHE DE ZPL que virou teste:** "negrito" **não é uma flag** — é o texto impresso **2× com 1 dot de deslocamento** (o truque padrão da Zebra pra fonte escalável).

**PROVADO EM PROD** com um modelo customizado (texto livre no topo, `MANIP.` no lugar de `FAB`, quantidade desligada, nome maior): os 9 blocos viraram 10, **todo texto da prévia está no ZPL**, cabe na etiqueta, e a tela de imprimir passou a usar o modelo salvo. ⚠️ O modelo da prova foi **removido** depois — o dono cria o dele do zero (REGRA 2).

**32 testes do modelo · 628 stock verdes.**

## ⭐⭐⭐ A TORNEIRA — TELA DE ETIQUETAS COM PRÉVIA EM TAMANHO REAL (30/08/2026)

A fila e o agente eram o **cano**. `/estoque/etiquetas` é a **torneira**: **3 toques** — produto → confere a prévia → imprimir. É a tela que o Cristian abre no celular.

**⭐⭐ UM LAYOUT, DOIS RENDERIZADORES (`lib/stock/etiquetas/modelo.ts`).** O navegador **não renderiza ZPL**, então prévia e impressão são dois renderizadores **por necessidade**. O que dá pra garantir — e é o que o arquivo garante — é que os dois leem o **MESMO layout declarativo** (posição em dots, tamanho, ordem, quais campos entram). Uma segunda lista de campos "igualzinha" divergiria na primeira mudança e **a prévia passaria a mentir sobre o que sai da Zebra**. Testes travam: campo desligado **some dos dois**; a posição da prévia é a **mesma** do ZPL (em % de 480 dots, então é fiel em qualquer tela).

**⭐ A VALIDADE EM DESTAQUE, LOGO ABAIXO DO NOME** — vídeo invertido no ZPL (`^GB` + `^FR`), caixa preta na prévia. **Numa câmara fria, com pressa, ninguém lê a 5ª linha** — e validade lida errado vira comida estragada servida. Lote e colaborador são **rastro** (importam depois, quando alguém investiga); validade é **decisão do momento**.

**⭐ VALIDADE POR ESTADO DE CONSERVAÇÃO** (`stock_item_validade`, CREATE-only, CHECK 1..3650): a mesma carne dura **90 dias congelada, 3 resfriada, 1 em ambiente**. Trocar o estado na tela **recalcula a validade na hora, na prévia**. ⚠️ **Sem dias cadastrados a etiqueta diz "A DEFINIR"** — número inventado numa etiqueta de alimento é o pior lugar possível pra um palpite, **porque a data errada é OBEDECIDA**. A sugestão aparece **marcada como sugestão**, e quantos dias um produto dura é `stock.manage` (decisão de segurança alimentar do dono, não do operador).

**⭐ TODA IMPRESSÃO VIRA REGISTRO** (`stock_etiqueta`: produto, lote, validade, estado, quem, quando). É o que vai **fazer o painel "vence hoje" (2c) e o ciclo de vida (2d) existirem** — sem isso a etiqueta sai e o sistema não sabe que ela existe.

⚠️ **O lote da manipulação nasce do INSTANTE, não do dia:** descongelou de manhã ≠ descongelou à tarde, e o QR precisa distinguir os dois pacotes.
⚠️ **O grid não é o catálogo inteiro** (produzidos + matéria-prima que se manipula): oferecer material de limpeza transformaria a tela de 3 toques num catálogo de 90 linhas.

**PROVADO EM PROD** com a porção de carne real: 49 produtos etiquetáveis, prévia e ZPL saindo da mesma fonte, validade `02/09/2026` marcada como **sugestão** (o dono ainda não definiu os dias dela). ⚠️ **Achado pra afinar:** o grid está **48 matéria-prima × 1 intermediário** — ordenar por "mais etiquetado" faria a tela de 3 toques valer no dia a dia.

**FALTA DESTE SPRINT (não feito, registrado):** a tela `/estoque/etiquetas/modelo` (ligar/desligar campos + teste do modelo — o layout já é declarativo e aceita `desligados`, falta a tela), o override por item de por-pacote/por-lote, e a subida de nível da `/estoque/impressao` (item 4). Depois: **2b** (manipulação avulsa), **2c** (painel vence-hoje) e **2d** (ciclo de vida + QR).

## ⭐ DENSIDADE / MOLDE DE LAYOUT (23/08/2026, EM PROD — toda tela nova segue)

Comparação do dono com o Vuca: "eles usam cada canto; as nossas têm coluna estreita central com margens gigantes, linhas altas, cards enormes — cara de protótipo". **Diagnóstico: a gaiola era DUPLA.** O shell (`components/layout/dashboard-shell.tsx`) prendia tudo em `max-w-6xl` (1152px) **e** 49 das 137 páginas de `(dashboard)` ainda punham um `max-w` próprio dentro dele (no estoque, 18 de 19) + um `p-4 sm:p-6` que duplicava o padding do shell. Efeito real no notebook (~1272px úteis): `max-w-4xl` = 896px = **70% de aproveitamento**; `max-w-3xl` = 60%.

- **O MOLDE (uma linha, cobre as 137 páginas):** shell = `mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8`. **Teto ALTO, não ausência de teto** — no notebook é largura total de fato, e o teto só morde em ultrawide (tabela esticada a 2500px vira linha ilegível). Landing, `(auth)` e `/admin` não passam pelo shell.
- **REGRA: TELA DE DADOS = largura total (sem `max-w` próprio). FORMULÁRIO/DOCUMENTO mantém o seu.** Preservados de propósito: certificado, ficha nova/editar, cadastros de produção, recibo (é documento) e **a etiqueta Zebra 60×60 (`max-w-lg` = largura FÍSICA, intocável)**.
- **⭐ LINHA DE 48px REUSANDO O `density-normal` QUE JÁ EXISTIA** (`globals.css`, Sprint 5.0.3.0c: compact 36 / normal 48 / comfortable 60). **Um sistema de densidade no projeto, não dois** (REGRA 4). Receita da tabela: `<table className="density-normal w-full">` · `th` = `px-3 py-2` + `text-[11px] uppercase tracking-wide` · `td` = `px-3 py-0 text-[13px]` (**`py-0` de propósito: quem manda na altura é a classe**). O `text-[13px]` tem que ir no **`td`** — `.density-normal tbody tr{font-size:14px}` é mais específico que qualquer classe Tailwind no `tr`, então só o valor aplicado direto na célula vence.
- **⚠️ NÃO EDITAR o `.density-*` do globals.css — só CONSUMIR.** `lib/contas-pagar/virtualization.ts` (`ROW_HEIGHT_BY_DENSITY` 36/48/60) **duplica esses números** pra virtualizar >100 linhas, com testes travando, e a densidade é **persistida por usuário** na coluna `density` das saved_views. Mudar o CSS quebra o cálculo da virtualização da Contas a Pagar — não é "só visual". Guards: `virtualization.test.ts` + `use-table-preferences.test.ts`.
- **Padrão de topo de tela:** cabeçalho de UMA linha (ícone `h-5 w-5` · `h1 text-base` · subtítulo `text-xs text-slate-400` que some abaixo de `lg` · botões `h-8 px-2.5 text-xs`) · filtros numa linha `h-9` com busca limitada a `max-w-[320px]` · agregados por categoria como **faixa horizontal fina que rola no eixo x** (`h-9`, rótulo+valor na mesma linha), **nunca tijolo de 3 linhas** — tijolo quebra em 2ª fileira e come a altura da lista · coluna de faixa/barra numa linha só (barra + `mín–máx` ao lado) · texto curto em coluna de idade (`hoje` · `2d` · `23d`). Resultado na Posição: ~7 → ~12-13 linhas visíveis no notebook.
- **MOBILE INTOCADO** — os blocos `sm:hidden` de cards empilhados não entram no passe.
- **Aplicado (em prod):** molde + 11 telas do estoque (Posição=referência, Catálogo, Movimentos, Recebimentos, Vendas, Perdas, Produção, Cardápio, Fichas, Ficha do produto, Ordem) + 7 financeiras que estavam estreitas de fato, **só largura, zero lógica/golden** (vendas, juiz, auditoria, import-warnings, monitor-alerts, transferencias/ignoradas, dashboard). **Contas a Pagar/Receber, Conciliação e Empréstimos NÃO têm `max-w` próprio** — herdaram o molde (1152→1600) sem nenhum arquivo delas ser tocado; se o dono quiser congelar alguma no tamanho antigo, é `max-w-6xl` no container dela.

