# QA — FASE 2: Contas Bancárias, Transações e OFX

**Versão testada:** 0.2.0  
**Data:** 2026-04-20  
**Testador:** Yussef Musa

Para cada item: marque ✅ se passou, ❌ se falhou, e anote o erro observado.

---

## Como reportar um bug

Anote:
1. **Passo exato** que causou o problema
2. **O que você viu** (mensagem de erro, comportamento inesperado, screenshot)
3. **O que era esperado**

Reporte em: https://github.com/yussef5522/conta-ia/issues

---

## Pré-requisitos

```bash
npm run dev
```

Acesse: http://localhost:3000  
Login: `admin@contaia.com.br` / `ContaIA@2025`

---

## 1. Cadastrar Empresa e Ver Categorias Automáticas

### 1.1 — Categorias automáticas por setor

**Contexto:** Ao criar uma empresa, o sistema semeou categorias automaticamente conforme o tipo escolhido.

**Passo a passo:**
1. Crie uma empresa nova (se ainda não tiver): Menu lateral → Empresas → Nova Empresa
2. Preencha os dados e selecione **Tipo: Serviços** (ou qualquer outro)
3. Salve a empresa
4. Acesse a empresa criada → você verá a seção de Contas Bancárias

> As categorias são usadas internamente. Para ver quais foram criadas, abra o banco via `npx prisma studio` e inspecione a tabela `categories` filtrando pelo `companyId`.

**Esperado:**
- Tipo **SERVICE**: Mensalidades, Serviços prestados, ISS, Planos mensais, Cancelamentos + categorias comuns
- Tipo **RETAIL**: Vendas à vista, Vendas parceladas, ICMS, Compra de mercadorias + comuns
- Tipo **RESTAURANT**: Vendas salão, Delivery, ICMS, Insumos alimentícios + comuns
- Tipo **INDUSTRY**: Vendas de produtos, IPI, Matéria-prima, Frete + comuns
- Todos incluem: Salários, Aluguel, Água/luz/internet, Tarifas bancárias, Impostos, Transferência

**Como reportar se errado:** Informe o tipo escolhido e quais categorias apareceram/faltaram.

---

## 2. Contas Bancárias

### 2.1 — Cadastrar conta bancária

**Passo a passo:**
1. Acesse Empresas → selecione uma empresa → clique em **Contas Bancárias** (ou acesse `/empresas/[id]/contas`)
2. Clique em **Nova Conta**
3. Preencha:
   - Nome: `Conta Principal`
   - Banco: `Itaú`
   - Tipo: `Conta Corrente`
   - Agência: `1234`
   - Número: `56789-0`
   - Saldo inicial: `5000`
4. Clique em **Cadastrar conta**

**Esperado:**
- Redirecionado para listagem de contas
- Card da conta aparece com nome, banco e saldo **R$ 5.000,00**
- Card de "Saldo Total" no topo mostra **R$ 5.000,00**

---

### 2.2 — Editar conta bancária

**Passo a passo:**
1. Na listagem de contas, passe o mouse sobre o card da conta
2. Clique no ícone `⋮` (três pontos)
3. Selecione **Editar**
4. Altere o nome para `Conta Corrente Itaú`
5. Clique em **Atualizar conta**

**Esperado:**
- Volta para a listagem
- Nome exibido foi atualizado

---

### 2.3 — Deletar conta bancária

**Passo a passo:**
1. Cadastre uma segunda conta: nome `Conta Teste Deletar`, saldo `100`
2. No card dessa conta, clique em `⋮` → **Excluir**
3. Confirme no dialog

**Esperado:**
- Conta removida da listagem
- Saldo total atualizado (não conta mais a segunda conta)

---

## 3. Transações — Lançamento Manual

### 3.1 — Lançar transação de entrada (crédito)

**Passo a passo:**
1. Acesse Contas → clique em `⋮` na conta → **Ver transações**
2. Clique em **Novo Lançamento**
3. Preencha:
   - Tipo: **+ Entrada**
   - Data: hoje
   - Descrição: `Pagamento de cliente ABC`
   - Valor: `1500`
   - Categoria: qualquer categoria de receita
4. Clique em **Lançar transação**

**Esperado:**
- Volta para listagem de transações
- Transação aparece com sinal `+` e valor em verde
- Card "Saldo atual" aumentou em R$ 1.500,00 (agora R$ 6.500,00 se partiu de R$ 5.000,00)
- Card "Entradas no período" mostra R$ 1.500,00

---

### 3.2 — Lançar transação de saída (débito)

**Passo a passo:**
1. Clique em **Novo Lançamento**
2. Preencha:
   - Tipo: **− Saída**
   - Data: hoje
   - Descrição: `Pagamento de aluguel`
   - Valor: `2000`
   - Categoria: `Aluguel`
3. Clique em **Lançar transação**

**Esperado:**
- Transação aparece com sinal `−` e valor em vermelho
- Saldo atual diminuiu R$ 2.000,00
- Card "Saídas no período" mostra R$ 2.000,00

---

### 3.3 — Editar transação existente

**Passo a passo:**
1. Na listagem, passe o mouse sobre a transação `Pagamento de aluguel`
2. Clique em `⋮` → **Editar**
3. Altere o valor de `2000` para `2200`
4. Clique em **Atualizar**

**Esperado:**
- Transação exibe novo valor R$ 2.200,00
- Saldo da conta reflete a diferença (R$ 200,00 a menos do que estava)

---

### 3.4 — Deletar transação

**Passo a passo:**
1. Crie uma transação de saída de R$ 50,00 com descrição `Transação para deletar`
2. Passe o mouse → `⋮` → **Excluir**
3. Confirme

**Esperado:**
- Transação removida da lista
- Saldo da conta voltou ao valor anterior (R$ 50,00 a mais)

---

## 4. Filtros de Transações

### 4.1 — Filtrar por período

**Pré-requisito:** Ter pelo menos 2 transações em datas diferentes (crie uma com data do mês passado se necessário).

**Passo a passo:**
1. Na listagem de transações, altere o filtro **De** para o primeiro dia do mês atual
2. Altere **Até** para hoje
3. Observe o resultado

**Esperado:**
- Apenas transações dentro do intervalo aparecem
- Cards de "Entradas" e "Saídas" refletem só o período filtrado

---

### 4.2 — Filtrar por tipo

**Passo a passo:**
1. No filtro **Tipo**, selecione **Entradas**
2. Observe

**Esperado:**
- Apenas transações de crédito (verde) aparecem

3. Mude para **Saídas**

**Esperado:**
- Apenas transações de débito (vermelho) aparecem

4. Mude de volta para **Todos**

**Esperado:**
- Todas as transações voltam a aparecer

---

### 4.3 — Filtrar por categoria

> O filtro de categoria ainda não está implementado na UI (está na API, mas não no formulário de filtros). Isso é esperado — será adicionado na FASE 3.

**Status esperado:** Filtro de categoria não aparece na tela → ✅ (comportamento correto para FASE 2)

---

## 5. Importação de Arquivo OFX

### 5.1 — Preparar o arquivo de teste

Salve o conteúdo abaixo como `teste.ofx` na sua área de trabalho:

```
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260401
<DTEND>20260420
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260401
<TRNAMT>3500.00
<FITID>IT20260401001
<MEMO>SALARIO REFERENTE MARCO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260405
<TRNAMT>-850.00
<FITID>IT20260405001
<MEMO>BOLETO INTERNET FIBRA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260410
<TRNAMT>-1200.00
<FITID>IT20260410001
<MEMO>ALUGUEL SALA COMERCIAL
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260415
<TRNAMT>750.00
<FITID>IT20260415001
<MEMO>PIX RECEBIDO CLIENTE SILVA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260418
<TRNAMT>-320.50
<FITID>IT20260418001
<MEMO>SUPERMERCADO ATACADAO
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5879.50
<DTASOF>20260420
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
```

---

### 5.2 — Importar OFX (primeira vez)

**Passo a passo:**
1. Acesse as transações de uma conta
2. Clique em **Importar OFX** (botão ao lado de "Novo Lançamento")
3. Na tela de importação, clique na área de drop ou arraste o arquivo `teste.ofx`
4. Aguarde o preview carregar

**Esperado no preview:**
- Total no arquivo: **5**
- Novas (serão importadas): **5**
- Duplicadas (ignoradas): **0**
- Lista mostra as 5 transações com data, descrição e valor
- SALARIO: entrada +R$ 3.500,00
- BOLETO INTERNET: saída −R$ 850,00
- ALUGUEL SALA: saída −R$ 1.200,00
- PIX RECEBIDO: entrada +R$ 750,00
- SUPERMERCADO: saída −R$ 320,50

5. Clique em **Confirmar importação (5)**

**Esperado:**
- Mensagem de sucesso "5 transações importadas com sucesso"
- Redirecionado para listagem de transações
- As 5 transações aparecem na lista
- Saldo da conta ajustado: +3500 −850 −1200 +750 −320.50 = **+1879.50** em relação ao saldo anterior

---

### 5.3 — Reimportar o mesmo arquivo (teste de deduplicação)

**Passo a passo:**
1. Vá em **Importar OFX** novamente
2. Selecione o mesmo `teste.ofx`

**Esperado no preview:**
- Total no arquivo: **5**
- Novas: **0**
- Duplicadas: **5**
- Mensagem: "Todas as transações deste extrato já foram importadas anteriormente"
- Botão de confirmar NÃO aparece

---

### 5.4 — Importar arquivo com mistura de novas e duplicadas

**Passo a passo:**
1. Crie um arquivo `teste2.ofx` com o conteúdo abaixo (3 transações: 2 existentes + 1 nova):

```
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>12345-6
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260401
<TRNAMT>3500.00
<FITID>IT20260401001
<MEMO>SALARIO REFERENTE MARCO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260405
<TRNAMT>-850.00
<FITID>IT20260405001
<MEMO>BOLETO INTERNET FIBRA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260420
<TRNAMT>500.00
<FITID>IT20260420001
<MEMO>NOVA TRANSACAO UNICA
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
```

2. Importe esse arquivo

**Esperado:**
- Novas: **1** (apenas NOVA TRANSACAO UNICA)
- Duplicadas: **2**
- Preview mostra apenas a transação nova
- Confirmar importa só 1 transação
- Saldo aumenta em R$ 500,00

---

## 6. Categorias Customizadas

> A tela de gestão de categorias não está implementada na FASE 2 (as categorias existem no banco mas não têm CRUD na UI). O formulário de transação usa as categorias criadas automaticamente.

**Verificação via Prisma Studio:**
```bash
npx prisma studio
```
Acesse a tabela `categories` e filtre por `companyId` da sua empresa.

**Status esperado:** Tela de categorias ausente → ✅ (será implementado na FASE 3)

**Workaround disponível:** Inserir categoria customizada diretamente via Prisma Studio enquanto a UI não está pronta.

---

## 7. Multi-tenant — Isolamento entre Empresas

### 7.1 — Criar segunda empresa

**Passo a passo:**
1. Menu lateral → Empresas → Nova Empresa
2. Cadastre uma segunda empresa com CNPJ diferente (ex: `12.345.678/0001-95`)
3. Acesse essa empresa → Contas Bancárias

**Esperado:**
- Listagem de contas está vazia (sem as contas da primeira empresa)

---

### 7.2 — Confirmar isolamento de transações

**Passo a passo:**
1. Cadastre uma conta na segunda empresa: nome `Conta Empresa 2`, saldo `999`
2. Lance uma transação nessa conta: `Receita Empresa 2`, R$ 100, entrada
3. Volte para as contas da **primeira empresa**
4. Acesse as transações da conta da primeira empresa

**Esperado:**
- Transações da Empresa 2 NÃO aparecem nas contas da Empresa 1
- Saldo da conta da Empresa 1 não foi afetado pela transação da Empresa 2

---

### 7.3 — Confirmar que API rejeita acesso cruzado

**Passo a passo:**
1. Abra o DevTools do navegador (F12) → aba Network
2. Copie o ID de uma conta da Empresa 2 (visível na URL ao acessar transações)
3. Tente acessar diretamente: `http://localhost:3000/api/transacoes?contaId=ID_DA_EMPRESA_2`

**Esperado:**
- Se as duas empresas pertencem ao mesmo usuário: retorna as transações (correto — o usuário tem acesso a ambas)
- Se tentasse com conta de outro usuário: retornaria 404 (não testável com um usuário só)

---

## 8. Checklist Final

| # | Item | Status | Observações |
|---|------|--------|------------|
| 1 | Cadastrar conta bancária | | |
| 2 | Editar conta bancária | | |
| 3 | Deletar conta bancária | | |
| 4 | Lançar transação de entrada | | |
| 5 | Lançar transação de saída | | |
| 6 | Saldo atualizado após lançamento | | |
| 7 | Editar transação (saldo recalculado) | | |
| 8 | Deletar transação (saldo revertido) | | |
| 9 | Filtrar por período | | |
| 10 | Filtrar por tipo (entrada/saída) | | |
| 11 | Importar OFX — preview correto | | |
| 12 | Importar OFX — confirmar importação | | |
| 13 | Reimportar mesmo OFX — 0 novas (dedup) | | |
| 14 | OFX misto — importa só as novas | | |
| 15 | Categorias automáticas no banco (via Prisma Studio) | | |
| 16 | Segunda empresa sem contas da primeira | | |
| 17 | Transações isoladas por empresa | | |

---

## Resultado do QA

**Data do teste:**  
**Versão:**  
**Ambiente:** localhost Windows  
**Resultado geral:** APROVADO / REPROVADO  

**Bugs encontrados:**

_(preencher durante o teste)_
