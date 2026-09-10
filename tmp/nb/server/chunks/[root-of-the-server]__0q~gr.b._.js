module.exports=[463021,(e,a,t)=>{a.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},666680,(e,a,t)=>{a.exports=e.x("node:crypto",()=>require("node:crypto"))},951615,(e,a,t)=>{a.exports=e.x("node:buffer",()=>require("node:buffer"))},812057,(e,a,t)=>{a.exports=e.x("node:util",()=>require("node:util"))},918622,(e,a,t)=>{a.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,a,t)=>{a.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,a,t)=>{a.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,a,t)=>{a.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,a,t)=>{a.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,a,t)=>{a.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},442315,(e,a,t)=>{"use strict";a.exports=e.r(918622)},347540,(e,a,t)=>{"use strict";a.exports=e.r(442315).vendored["react-rsc"].React},762294,e=>{"use strict";var a=e.i(463021);let t=globalThis.prisma??new a.PrismaClient({log:["error"]});e.s(["prisma",0,t])},368105,e=>{"use strict";var a=e.i(656915),t=e.i(904975);function r(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET não configurado");return new TextEncoder().encode(e)}async function o(e){return new a.SignJWT({...e}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("1d").sign(r())}async function n(e){let{payload:a}=await (0,t.jwtVerify)(e,r());return a}async function i(e){let a=e.cookies.get("auth_token")?.value;if(!a)return null;try{return await n(a)}catch{return null}}let s=void 0===process.env.COOKIE_SECURE||"true"===process.env.COOKIE_SECURE;e.s(["COOKIE_NAME",0,"auth_token","COOKIE_OPTIONS",0,{httpOnly:!0,secure:s,sameSite:"lax",maxAge:86400,path:"/"},"getAuthUser",0,i,"signToken",0,o,"verifyToken",0,n])},254799,(e,a,t)=>{a.exports=e.x("crypto",()=>require("crypto"))},889896,905749,e=>{"use strict";var a=e.i(762294);let t="BRIDGE_ENTRY",r="Retirada da empresa";e.s(["BRIDGE_ENTRY_DEFAULT_NAME",0,r,"BRIDGE_ENTRY_SLUG",0,t],905749);let o=[{name:"Salário",type:"INCOME",color:"#10b981",icon:"Wallet"},{name:r,type:"INCOME",color:"#059669",icon:"Briefcase",systemSlug:t},{name:"Outros recebimentos",type:"INCOME",color:"#34d399",icon:"PlusCircle"},{name:"Alimentação",type:"EXPENSE",color:"#f59e0b",icon:"Utensils"},{name:"Transporte",type:"EXPENSE",color:"#3b82f6",icon:"Car"},{name:"Moradia",type:"EXPENSE",color:"#8b5cf6",icon:"Home"},{name:"Contas (luz, água, internet)",type:"EXPENSE",color:"#ef4444",icon:"Zap"},{name:"Telefone/Celular",type:"EXPENSE",color:"#0891b2",icon:"Phone"},{name:"Saúde",type:"EXPENSE",color:"#ec4899",icon:"Heart"},{name:"Educação",type:"EXPENSE",color:"#06b6d4",icon:"BookOpen"},{name:"Lazer",type:"EXPENSE",color:"#a855f7",icon:"Music"},{name:"Vestuário",type:"EXPENSE",color:"#f97316",icon:"Shirt"},{name:"Investimentos",type:"EXPENSE",color:"#0ea5e9",icon:"TrendingUp"},{name:"Cartão de crédito",type:"EXPENSE",color:"#6366f1",icon:"CreditCard"},{name:"Empréstimos",type:"EXPENSE",color:"#dc2626",icon:"Landmark"},{name:"Outros",type:"EXPENSE",color:"#6b7280",icon:"MoreHorizontal"}];class n extends Error{code;constructor(e,a){super(e),this.code=a,this.name="ProfileAccessError"}}async function i(e,t,r=null){let o=await a.prisma.userPersonalProfile.findUnique({where:{userId_profileId:{userId:e,profileId:t}}});if(!o)throw new n("Perfil não encontrado ou sem acesso","NO_ACCESS");if("OWNER"===r&&"OWNER"!==o.role)throw new n("Apenas OWNER pode realizar esta operação","INSUFFICIENT_ROLE");return o}async function s(e){return(await a.prisma.userPersonalProfile.findMany({where:{userId:e},include:{profile:!0},orderBy:[{isSelf:"desc"},{createdAt:"asc"}]})).filter(e=>e.profile.isActive).map(e=>({...e.profile,role:e.role,isSelf:e.isSelf}))}async function c(e){let t=e.type??"OWN",r=e.isSelf??!1;return!r&&"OWN"===t&&(await a.prisma.userPersonalProfile.findFirst({where:{userId:e.userId,isSelf:!0},select:{id:!0}})||(r=!0)),a.prisma.$transaction(async a=>{let n=await a.personalProfile.create({data:{name:e.name,cpf:e.cpf??null,type:t,birthDate:e.birthDate??null}});return await a.userPersonalProfile.create({data:{userId:e.userId,profileId:n.id,role:"OWNER",isSelf:r}}),await a.personalCategory.createMany({data:o.map(e=>({profileId:n.id,name:e.name,type:e.type,color:e.color,icon:e.icon,isDefault:!0,systemSlug:e.systemSlug??null}))}),n})}async function l(e,t){return await i(e,t),a.prisma.personalBankAccount.findMany({where:{profileId:t},orderBy:[{isActive:"desc"},{createdAt:"asc"}]})}async function d(e){return await i(e.userId,e.profileId,"OWNER"),a.prisma.personalBankAccount.create({data:{profileId:e.profileId,name:e.name,bankName:e.bankName??null,bankCode:e.bankCode??null,agency:e.agency??null,accountNumber:e.accountNumber??null,accountType:e.accountType??"CHECKING",balance:e.balance??0,allowNegativeBalance:e.allowNegativeBalance??!0,creditLimit:e.creditLimit??0,lowBalanceThreshold:e.lowBalanceThreshold??null}})}async function u(e,t){return await i(e,t),a.prisma.personalCategory.findMany({where:{profileId:t,isActive:!0},orderBy:[{type:"asc"},{name:"asc"}]})}async function p(e){if(await i(e.userId,e.profileId,"OWNER"),e.parentId){let t=await a.prisma.personalCategory.findUnique({where:{id:e.parentId},select:{profileId:!0}});if(!t||t.profileId!==e.profileId)throw new n("parentId inválido","INVALID_PARENT")}let t=e.name.trim();if(0===t.length)throw new n("Nome obrigatório","INVALID_NAME");let r=t.toLowerCase(),o=(await a.prisma.personalCategory.findMany({where:{profileId:e.profileId},select:{id:!0,name:!0}})).find(e=>e.name.toLowerCase()===r);if(o)throw new n(`J\xe1 existe uma categoria chamada "${o.name}"`,"CATEGORY_DUPLICATE");return a.prisma.personalCategory.create({data:{profileId:e.profileId,name:t,type:e.type,color:e.color??null,icon:e.icon??null,parentId:e.parentId??null}})}async function m(e){await i(e.userId,e.profileId);let t=e.pageSize??50,r=e.page??1,o={profileId:e.profileId};if(e.startDate||e.endDate){let a={};e.startDate&&(a.gte=e.startDate),e.endDate&&(a.lte=e.endDate),o.date=a}e.type&&(o.type=e.type),e.categoryId&&(o.categoryId=e.categoryId),e.bankAccountId&&(o.bankAccountId=e.bankAccountId),e.search&&(o.description={contains:e.search});let[n,s]=await Promise.all([a.prisma.personalTransaction.findMany({where:o,orderBy:[{date:"desc"},{createdAt:"desc"}],take:t,skip:(r-1)*t,include:{category:!0,bankAccount:!0}}),a.prisma.personalTransaction.count({where:o})]);return{items:n,total:s,page:r,pageSize:t}}async function f(e){if(await i(e.userId,e.profileId,"OWNER"),e.bankAccountId){let t=await a.prisma.personalBankAccount.findUnique({where:{id:e.bankAccountId},select:{profileId:!0}});if(!t||t.profileId!==e.profileId)throw new n("bankAccountId inválido","INVALID_ACCOUNT")}if(e.categoryId){let t=await a.prisma.personalCategory.findUnique({where:{id:e.categoryId},select:{profileId:!0}});if(!t||t.profileId!==e.profileId)throw new n("categoryId inválido","INVALID_CATEGORY")}return a.prisma.$transaction(async a=>{let t=await a.personalTransaction.create({data:{profileId:e.profileId,bankAccountId:e.bankAccountId??null,categoryId:e.categoryId??null,date:e.date,description:e.description,amount:Math.abs(e.amount),type:e.type,notes:e.notes??null,status:"RECONCILED",origin:"MANUAL"}});if(e.bankAccountId){let t="CREDIT"===e.type?e.amount:-e.amount;await a.personalBankAccount.update({where:{id:e.bankAccountId},data:{balance:{increment:t}}})}return t})}async function E(e,t){await i(e,t);let r=new Date(new Date().getTime()-2592e6),[o,n,s]=await Promise.all([a.prisma.personalBankAccount.findMany({where:{profileId:t,isActive:!0},select:{balance:!0,name:!0,id:!0}}),a.prisma.personalTransaction.findMany({where:{profileId:t,date:{gte:r}},include:{category:{select:{id:!0,name:!0,color:!0}}}}),a.prisma.personalTransaction.count({where:{profileId:t}})]),c=o.reduce((e,a)=>e+a.balance,0),l=n.filter(e=>"CREDIT"===e.type).reduce((e,a)=>e+a.amount,0),d=n.filter(e=>"DEBIT"===e.type).reduce((e,a)=>e+a.amount,0),u=new Map;for(let e of n){if("DEBIT"!==e.type||!e.category)continue;let a=u.get(e.category.id);a?a.total+=e.amount:u.set(e.category.id,{id:e.category.id,name:e.category.name,color:e.category.color,total:e.amount})}let p=[...u.values()].sort((e,a)=>a.total-e.total).slice(0,5);return{totalBalance:c,accountsCount:o.length,totalTransactions:s,incomes30d:l,expenses30d:d,net30d:l-d,topExpenseCategories:p,accounts:o.map(e=>({id:e.id,name:e.name,balance:e.balance}))}}e.s(["ProfileAccessError",0,n,"checkProfileAccess",0,i,"createAccount",0,d,"createCategory",0,p,"createProfile",0,c,"createTransaction",0,f,"getProfileSummary",0,E,"listAccountsForProfile",0,l,"listCategoriesForProfile",0,u,"listProfilesForUser",0,s,"listTransactions",0,m],889896)},588478,e=>{"use strict";function a(e,a){let t=e.getUTCFullYear(),r=e.getUTCMonth(),o=e.getUTCDate(),n=new Date(Date.UTC(t,r+a,1,e.getUTCHours(),e.getUTCMinutes(),e.getUTCSeconds(),e.getUTCMilliseconds())),i=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+1,0)).getUTCDate();return n.setUTCDate(Math.min(o,i)),n}e.s(["addMonths",0,a,"addYears",0,function(e,t){return a(e,12*t)},"lastDayOfMonthUTC",0,function(e,a){return new Date(Date.UTC(e,a+1,0)).getUTCDate()}])},292463,e=>{"use strict";let a=/^.*? - /,t=/\s+(\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{1,2}\/\d{4}|[a-z]{3}\/\d{2,4})\s*$/i,r=/[̀-ͯ]/g,o=/(?<=\p{L})\.\s+(?=\p{L})/gu;e.s(["normalizeDescription",0,function(e){if(!e)return"";let n=e;return(n=(n=(n=(n=n.replace(a,"")).replace(t,"")).toLowerCase().normalize("NFD").replace(r,"")).replace(o,".")).replace(/\s+/g," ").trim()},"normalizeExact",0,function(e){return e?e.toLowerCase().normalize("NFD").replace(r,"").replace(o,".").replace(/\s+/g," ").trim():""}])},35155,21513,373342,e=>{"use strict";var a=e.i(762294),t=e.i(254799);let r=`Voc\xea est\xe1 extraindo transa\xe7\xf5es de uma FATURA DE CART\xc3O DE CR\xc9DITO BRASILEIRA em PDF.

REGRAS ABSOLUTAS:
1. NUNCA invente valores ou datas. Se n\xe3o conseguir ler com PRECIS\xc3O um n\xfamero, marque \`lineConfidence: 0.3\` e adicione warning.
2. NUNCA inclua o n\xfamero COMPLETO do cart\xe3o na resposta. Se aparecer, retorne S\xd3 os \xfaltimos 4 d\xedgitos no campo \`detectedCardLast4\`.
3. A soma das transa\xe7\xf5es DEVE bater com o total da fatura (toler\xe2ncia R$ 0,50). Se n\xe3o bater, ajuste \`confidence\` global pra ≤ 0.5 e liste motivo em warnings.

O QUE EXTRAIR:
- Cada compra/lan\xe7amento: data, descri\xe7\xe3o (memo do comerciante), valor.
- Pagamentos recebidos no cart\xe3o → marque \`type: "CREDIT"\` (depois nosso sistema vai pular do import).
- Encargos (IOF, Multa, Juros do rotativo, Valor pendente m\xeas anterior) → extraia normalmente, s\xe3o DEBIT.
- COMPRAS INTERNACIONAIS: pegue o valor FINAL EM REAIS (n\xe3o USD/EUR). Se poss\xedvel, preencha \`originalCurrency\` e \`originalAmount\` separados. Marque \`isInternational: true\`.
- PARCELADAS: mantenha o sufixo "- Parcela X/Y" ou "(X/Y)" no memo — o sistema processa.

QUALIDADE DO PDF:
- DIGITAL: gerado por software (texto vetorial n\xedtido) — alta precis\xe3o
- SCANNED_HIGH: escaneado bem (leg\xedvel, alinhado)
- SCANNED_LOW: escaneado ruim, torto ou borrado
- MOBILE_PHOTO: claramente uma foto de celular (cantos cortados, perspectiva)

ATEN\xc7\xc3O ESPECIAL:
- "Total a pagar" / "Total da fatura" = valor final → preencher \`declaredTotal\`
- Contador "X lan\xe7amentos no per\xedodo" → preencher \`declaredTxCount\`
- Mascarar SEMPRE n\xfamero de cart\xe3o → s\xf3 \`detectedCardLast4\` (4 chars)

FORMATO DE SA\xcdDA OBRIGAT\xd3RIO — JSON ESTRITO (sem markdown, sem prefixos):
{
  "detectedBank": "Nubank" ou "Ita\xfa" ou "Bradesco" ou null,
  "scanQuality": "DIGITAL" | "SCANNED_HIGH" | "SCANNED_LOW" | "MOBILE_PHOTO",
  "closingDate": "YYYY-MM-DD" ou null,
  "dueDate": "YYYY-MM-DD" ou null,
  "declaredTotal": 6771.22 ou null,
  "extractedSum": 6771.22 (soma das tx) ou null,
  "declaredTxCount": 15 ou null,
  "confidence": 0.92 (0-1, considera todos os fatores),
  "detectedCardLast4": "1234" ou null,
  "transactions": [
    {
      "date": "2026-05-12",
      "amount": 85.50,
      "type": "DEBIT",
      "memo": "Posto Pitangueira",
      "lineConfidence": 0.95
    },
    {
      "date": "2026-05-15",
      "amount": 380.00,
      "type": "DEBIT",
      "memo": "Airbnb * Hm9z23za5s - Parcela 4/6",
      "lineConfidence": 0.92
    }
  ],
  "warnings": []
}

Responda APENAS o objeto JSON.`,o={NUBANK:`${r}

⚠️ DICAS ESPEC\xcdFICAS NUBANK (banco "NU PAGAMENTOS S.A."):

1. ESTRUTURA DA FATURA:
   - P\xe1gina 1-2: resumo (total a pagar, pagamento anterior, datas)
   - P\xe1gina 3-4: detalhamento das transa\xe7\xf5es por categoria
   - "Total de compras" + "IOF compras internacionais" + "Outros lan\xe7amentos" = Total

2. COMPRAS INTERNACIONAIS NO NUBANK:
   - Aparecem como bloco de 2-3 linhas:
     Linha A: nome+moeda original (ex: "Anthropic" USD 20)
     Linha B: cota\xe7\xe3o/convers\xe3o vis\xedvel
     Linha C: IOF separado
   - VOC\xca DEVE: extrair 1 transa\xe7\xe3o com valor FINAL EM REAIS no \`amount\`,
     e \`originalCurrency\`/\`originalAmount\` preenchidos.
   - O IOF da linha seguinte \xe9 OUTRA transa\xe7\xe3o (memo "IOF de compra internacional").

3. PARCELAS:
   - Padr\xe3o: "Loja XYZ - Parcela X/Y" (com h\xedfen e espa\xe7o)
   - Manter o sufixo exato no memo.

4. PAGAMENTO RECEBIDO:
   - "Pagamento em DD MMM" → TIPO CREDIT (valor positivo), memo "Pagamento recebido"
   - Sistema vai SKIPAR no import.

5. DATAS:
   - Nubank usa formato "DD MMM" (ex: "12 MAI", "15 MAI")
   - Converta pra YYYY-MM-DD baseado no M\xcaS DE COMPET\xcaNCIA da fatura
     (que aparece no cabe\xe7alho: "Fatura de MAI/2026", "Vence em 15/06/2026")

6. \`detectedBank\` = "Nubank"`,ITAU:`${r}

⚠️ DICAS ESPEC\xcdFICAS ITA\xda:

1. ESTRUTURA:
   - Bandeira "Ita\xfa" + nome da modalidade (Personnalit\xe9, Click, Uniclass)
   - Tabela: data | estabelecimento | parcela | valor R$
   - Compras internacionais com "(USD)" ou "(EUR)" no memo

2. PARCELAS:
   - Padr\xe3o: "ESTABELECIMENTO 1/5" ou "PARCELA X/Y"
   - Ita\xfa \xe0s vezes usa "(X/Y)" entre par\xeanteses

3. PAGAMENTO:
   - "PGTO DEBITO AUTOMATICO" ou "PAGAMENTO" — CREDIT
   - Aparece como negativo no extrato (sinal invertido)

4. \`detectedBank\` = "Ita\xfa"`,BRADESCO:`${r}

⚠️ DICAS ESPEC\xcdFICAS BRADESCO:

1. ESTRUTURA:
   - Cabe\xe7alho "Bradesco" + nome da modalidade (Visa Gold, Mastercard Platinum)
   - Tabela: data compra | descri\xe7\xe3o | valor

2. PARCELAS:
   - Padr\xe3o "Parc X/Y" ou "X de Y"

3. PAGAMENTO:
   - "PAGAMENTO" sem valor — CREDIT

4. \`detectedBank\` = "Bradesco"`,INTER:`${r}

⚠️ DICAS ESPEC\xcdFICAS INTER:

1. Bandeira laranja "Inter" — minimalista, layout limpo
2. Cada compra: data | estabelecimento | valor (cor verde pra cr\xe9dito, preto pra d\xe9bito)
3. Parcelas: "Parcela X de Y"
4. \`detectedBank\` = "Inter"`,C6:`${r}

⚠️ DICAS ESPEC\xcdFICAS C6 BANK:

1. Cabe\xe7alho preto/dourado "C6 Bank" + bandeira
2. Tabela muito visual (geralmente boa qualidade DIGITAL)
3. Parcelas: "Parcela X/Y" inline na descri\xe7\xe3o
4. \`detectedBank\` = "C6 Bank"`,GENERIC:r};class n extends Error{code;constructor(e,a){super(e),this.code=a,this.name="PdfExtractError"}}e.s(["PdfExtractError",0,n],21513);let i=["MOBILE_PHOTO"];function s(e){return{...e,detectedCardLast4:e.detectedCardLast4?e.detectedCardLast4.slice(-4):null}}async function c(e,a={}){var t;let r,s,d;if(0===e.pdfBytes.length)throw new n("PDF vazio","PDF_INVALID");if(e.pdfBytes.length>5242880)throw new n(`PDF muito grande (${(e.pdfBytes.length/1024/1024).toFixed(1)} MB; m\xe1ximo 5 MB)`,"PDF_TOO_LARGE");let u=new TextDecoder("utf-8",{fatal:!1}).decode(e.pdfBytes.slice(0,Math.min(2048,e.pdfBytes.length)));if(!u.startsWith("%PDF-"))throw new n("Arquivo não parece ser um PDF válido (sem header %PDF-).","PDF_INVALID");if(/\/Encrypt\b/.test(u))throw new n("PDF está com senha/criptografia. Remova a proteção e tente de novo.","PDF_ENCRYPTED");let p=a.apiKey??process.env.ANTHROPIC_API_KEY;if(!p)throw new n("ANTHROPIC_API_KEY não configurada no servidor.","CLAUDE_API_ERROR");let m=a.modelOverride??process.env.AI_CLAUDE_VISION_MODEL??"claude-sonnet-4-6",f=a.fetch??globalThis.fetch,E=a.timeoutMs??3e4,I=e.bankHint??((d=e.fileName.toLowerCase()).includes("nubank")||d.includes("nu_pagamentos")?"NUBANK":d.includes("itau")||d.includes("itaú")?"ITAU":d.includes("bradesco")?"BRADESCO":d.includes("inter")?"INTER":d.includes("c6")?"C6":"GENERIC"),x=o[I],A={model:m,max_tokens:4e3,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:Buffer.from(e.pdfBytes).toString("base64")}},{type:"text",text:x}]}]},C=new AbortController,h=setTimeout(()=>C.abort(),E),T=Date.now();try{r=await f("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":p,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify(A),signal:C.signal})}catch(a){if(clearTimeout(h),console.error("[pdf-extract] network error",{durationMs:Date.now()-T,bank:I,pdfSize:e.pdfBytes.length}),a instanceof Error&&"AbortError"===a.name)throw new n("Timeout na API Claude Vision","CLAUDE_TIMEOUT");throw new n("Falha de rede ao chamar Claude Vision","CLAUDE_API_ERROR")}if(clearTimeout(h),429===r.status)throw new n("Rate limit Claude","CLAUDE_RATE_LIMITED");if(!r.ok)throw console.error("[pdf-extract] api error",{status:r.status,bank:I,durationMs:Date.now()-T,pdfSize:e.pdfBytes.length}),new n(`Erro Claude API ${r.status}`,"CLAUDE_API_ERROR");let D=await r.json(),y=D.content?.[0]?.text??"",g=D.usage?.input_tokens??0,N=D.usage?.output_tokens??0,w=Math.round(100*(g/1e6*Number(process.env.AI_CLAUDE_VISION_PRICE_INPUT_USD??3)+N/1e6*Number(process.env.AI_CLAUDE_VISION_PRICE_OUTPUT_USD??15))*100);try{let e=function(e){let a=e.trim();if(a.startsWith("{"))return a;let t=a.indexOf("{");if(t<0)throw Error("no JSON found");let r=0;for(let e=t;e<a.length;e++){let o=a[e];if("{"===o)r++;else if("}"===o&&0==--r)return a.slice(t,e+1)}throw Error("unbalanced JSON")}(y);s=JSON.parse(e)}catch{throw console.error("[pdf-extract] invalid json",{bank:I,textPreview:y.slice(0,200)}),new n("Claude retornou JSON inválido","CLAUDE_INVALID_JSON")}let P=Array.isArray(s.transactions)?s.transactions.map((e,a)=>{var t,r;let o,n,i,s;return t=e,r=a,o=String(t.memo??"").trim().slice(0,200),n=String(t.date??"").slice(0,10),i=Math.abs(l(t.amount)??0),s="CREDIT"===t.type?"CREDIT":"DEBIT",{fitid:t.fitid&&"string"==typeof t.fitid?t.fitid:`PDF-${n||"nodate"}-${o.replace(/[^a-zA-Z0-9]+/g,"-").slice(0,20).toLowerCase()||`tx${r}`}-${i.toFixed(2)}`,date:n,amount:i,type:s,memo:o,lineConfidence:l(t.lineConfidence)??.8,isInternational:!0===t.isInternational,originalCurrency:"string"==typeof t.originalCurrency?t.originalCurrency:void 0,originalAmount:l(t.originalAmount)??void 0}}):[],S="DIGITAL"===(t=s.scanQuality)||"SCANNED_HIGH"===t||"SCANNED_LOW"===t||"MOBILE_PHOTO"===t||"UNKNOWN"===t?s.scanQuality:"UNKNOWN",O={detectedBank:s.detectedBank??null,scanQuality:S,closingDate:s.closingDate??null,dueDate:s.dueDate??null,declaredTotal:l(s.declaredTotal),extractedSum:l(s.extractedSum)??P.reduce((e,a)=>e+("DEBIT"===a.type?a.amount:-a.amount),0),declaredTxCount:l(s.declaredTxCount),confidence:l(s.confidence)??.7,detectedCardLast4:s.detectedCardLast4??null,transactions:P,warnings:Array.isArray(s.warnings)?s.warnings.map(String):[],modelVersion:D.model??m,inputTokens:g,outputTokens:N,costCentsUsdX100:w},{result:R,shouldReject:b,rejectReason:M}=function(e){let a=[...e.warnings??[]],t=[];if(i.includes(e.scanQuality))return{result:e,shouldReject:!0,rejectReason:"Detectamos que isso é uma foto de celular. Por favor, envie o PDF DIGITAL da fatura (baixado do app ou site do banco), não uma foto."};if(null!=e.declaredTotal&&null!=e.extractedSum&&isFinite(e.declaredTotal)&&isFinite(e.extractedSum)){let r=Math.abs(e.declaredTotal-e.extractedSum),o=e.declaredTotal>0?r/e.declaredTotal:0;r>.5&&(a.push(`⚠️ Soma das transa\xe7\xf5es (R$ ${e.extractedSum.toFixed(2)}) ≠ total da fatura (R$ ${e.declaredTotal.toFixed(2)}). Diferen\xe7a R$ ${r.toFixed(2)}.`),o<.02?t.push(.85):o<.1?t.push(.6):t.push(.4))}else null==e.declaredTotal&&(a.push("Não detectamos o total da fatura no PDF — não foi possível validar a soma."),t.push(.85));null!=e.declaredTxCount&&Math.abs(e.declaredTxCount-e.transactions.length)>1&&(a.push(`⚠️ PDF declara ${e.declaredTxCount} transa\xe7\xf5es, extra\xedmos ${e.transactions.length}.`),t.push(.7));let r=e.transactions.length,o=1;switch(r>0&&(o=e.transactions.reduce((e,a)=>e+(a.lineConfidence??1),0)/r),o<.85&&t.push(o),e.scanQuality){case"SCANNED_LOW":t.push(.55),a.push("⚠️ Qualidade do scan é BAIXA. Revise CADA linha antes de confirmar.");break;case"SCANNED_HIGH":t.push(.85);break;case"UNKNOWN":t.push(.7)}let n=e.confidence??.85;for(let e of t)n*=e;return n=Math.max(0,Math.min(1,n)),{result:{...e,confidence:n,warnings:a},shouldReject:!1}}(O);if(b)throw new n(M??"PDF rejeitado","IS_PHOTO_REJECTED");return console.log("[pdf-extract] success",{bank:I,durationMs:Date.now()-T,pdfSize:e.pdfBytes.length,inputTokens:g,outputTokens:N,costCentsUsdX100:w,modelVersion:O.modelVersion,detectedBank:O.detectedBank,txCount:O.transactions.length,confidence:R.confidence,scanQuality:O.scanQuality}),R}function l(e){if("number"==typeof e&&Number.isFinite(e))return e;if("string"==typeof e){let a=Number.parseFloat(e.replace(",","."));if(Number.isFinite(a))return a}return null}async function d(e){let t=await a.prisma.personalPdfExtractCache.findUnique({where:{pdfSha256:e}});if(!t)return null;if(t.expiresAt<new Date)return a.prisma.personalPdfExtractCache.delete({where:{id:t.id}}).catch(()=>{}),null;a.prisma.personalPdfExtractCache.update({where:{id:t.id},data:{hitCount:{increment:1}}}).catch(()=>{});try{return JSON.parse(t.resultJson)}catch{return null}}async function u(e){let t=s(e.result),r=new Date(Date.now()+6048e5);await a.prisma.personalPdfExtractCache.upsert({where:{pdfSha256:e.pdfSha256},create:{pdfSha256:e.pdfSha256,modelVersion:t.modelVersion,resultJson:JSON.stringify(t),inputTokens:t.inputTokens,outputTokens:t.outputTokens,costCentsUsdX100:t.costCentsUsdX100,ownerUserId:e.ownerUserId,expiresAt:r},update:{expiresAt:r,hitCount:{increment:1}}})}async function p(e,t){let r=await a.prisma.personalPdfExtractCache.findUnique({where:{pdfSha256:e}});return!!r&&r.ownerUserId===t&&(await a.prisma.personalPdfExtractCache.delete({where:{id:r.id}}),!0)}async function m(e){return a.prisma.personalPdfExtractCache.findMany({where:{ownerUserId:e},select:{id:!0,pdfSha256:!0,modelVersion:!0,inputTokens:!0,outputTokens:!0,costCentsUsdX100:!0,hitCount:!0,cachedAt:!0,expiresAt:!0},orderBy:{cachedAt:"desc"}})}e.s(["extractFromPdf",0,c,"sanitizeForCache",0,s,"sha256Pdf",0,function(e){return(0,t.createHash)("sha256").update(e).digest("hex")}],373342),e.s(["deleteCachedExtraction",0,p,"getCachedExtraction",0,d,"listOwnerCaches",0,m,"saveCachedExtraction",0,u],35155)},609980,e=>{"use strict";e.s(["checkPdfImportFlag",0,function(e=process.env){return"true"!==(e.PDF_IMPORT_ENABLED??"").trim().toLowerCase()?{allowed:!1,reason:"DISABLED",message:"Import de PDF está temporariamente desligado. Use OFX (Nubank, Itaú, etc)."}:"production"===(e.NODE_ENV??"").toLowerCase()&&"true"!==(e.PDF_IMPORT_ZDR_CONFIRMED??"").trim().toLowerCase()?{allowed:!1,reason:"ZDR_NOT_CONFIRMED",message:"Import de PDF aguarda confirmação de Zero Data Retention com a Anthropic. Use OFX por enquanto."}:{allowed:!0}}])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0q~gr.b._.js.map