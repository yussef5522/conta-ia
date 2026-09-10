module.exports=[463021,(e,t,a)=>{t.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},666680,(e,t,a)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},951615,(e,t,a)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},812057,(e,t,a)=>{t.exports=e.x("node:util",()=>require("node:util"))},918622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},193695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},442315,(e,t,a)=>{"use strict";t.exports=e.r(918622)},347540,(e,t,a)=>{"use strict";t.exports=e.r(442315).vendored["react-rsc"].React},762294,e=>{"use strict";var t=e.i(463021);let a=globalThis.prisma??new t.PrismaClient({log:["error"]});e.s(["prisma",0,a])},368105,e=>{"use strict";var t=e.i(656915),a=e.i(904975);function r(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET não configurado");return new TextEncoder().encode(e)}async function n(e){return new t.SignJWT({...e}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("1d").sign(r())}async function o(e){let{payload:t}=await (0,a.jwtVerify)(e,r());return t}async function s(e){let t=e.cookies.get("auth_token")?.value;if(!t)return null;try{return await o(t)}catch{return null}}let i=void 0===process.env.COOKIE_SECURE||"true"===process.env.COOKIE_SECURE;e.s(["COOKIE_NAME",0,"auth_token","COOKIE_OPTIONS",0,{httpOnly:!0,secure:i,sameSite:"lax",maxAge:86400,path:"/"},"getAuthUser",0,s,"signToken",0,n,"verifyToken",0,o])},254799,(e,t,a)=>{t.exports=e.x("crypto",()=>require("crypto"))},35155,21513,373342,e=>{"use strict";var t=e.i(762294),a=e.i(254799);let r=`Voc\xea est\xe1 extraindo transa\xe7\xf5es de uma FATURA DE CART\xc3O DE CR\xc9DITO BRASILEIRA em PDF.

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

Responda APENAS o objeto JSON.`,n={NUBANK:`${r}

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
4. \`detectedBank\` = "C6 Bank"`,GENERIC:r};class o extends Error{code;constructor(e,t){super(e),this.code=t,this.name="PdfExtractError"}}e.s(["PdfExtractError",0,o],21513);let s=["MOBILE_PHOTO"];function i(e){return{...e,detectedCardLast4:e.detectedCardLast4?e.detectedCardLast4.slice(-4):null}}async function d(e,t={}){var a;let r,i,c;if(0===e.pdfBytes.length)throw new o("PDF vazio","PDF_INVALID");if(e.pdfBytes.length>5242880)throw new o(`PDF muito grande (${(e.pdfBytes.length/1024/1024).toFixed(1)} MB; m\xe1ximo 5 MB)`,"PDF_TOO_LARGE");let u=new TextDecoder("utf-8",{fatal:!1}).decode(e.pdfBytes.slice(0,Math.min(2048,e.pdfBytes.length)));if(!u.startsWith("%PDF-"))throw new o("Arquivo não parece ser um PDF válido (sem header %PDF-).","PDF_INVALID");if(/\/Encrypt\b/.test(u))throw new o("PDF está com senha/criptografia. Remova a proteção e tente de novo.","PDF_ENCRYPTED");let p=t.apiKey??process.env.ANTHROPIC_API_KEY;if(!p)throw new o("ANTHROPIC_API_KEY não configurada no servidor.","CLAUDE_API_ERROR");let x=t.modelOverride??process.env.AI_CLAUDE_VISION_MODEL??"claude-sonnet-4-6",m=t.fetch??globalThis.fetch,h=t.timeoutMs??3e4,f=e.bankHint??((c=e.fileName.toLowerCase()).includes("nubank")||c.includes("nu_pagamentos")?"NUBANK":c.includes("itau")||c.includes("itaú")?"ITAU":c.includes("bradesco")?"BRADESCO":c.includes("inter")?"INTER":c.includes("c6")?"C6":"GENERIC"),E=n[f],A={model:x,max_tokens:4e3,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:Buffer.from(e.pdfBytes).toString("base64")}},{type:"text",text:E}]}]},C=new AbortController,T=setTimeout(()=>C.abort(),h),R=Date.now();try{r=await m("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":p,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify(A),signal:C.signal})}catch(t){if(clearTimeout(T),console.error("[pdf-extract] network error",{durationMs:Date.now()-R,bank:f,pdfSize:e.pdfBytes.length}),t instanceof Error&&"AbortError"===t.name)throw new o("Timeout na API Claude Vision","CLAUDE_TIMEOUT");throw new o("Falha de rede ao chamar Claude Vision","CLAUDE_API_ERROR")}if(clearTimeout(T),429===r.status)throw new o("Rate limit Claude","CLAUDE_RATE_LIMITED");if(!r.ok)throw console.error("[pdf-extract] api error",{status:r.status,bank:f,durationMs:Date.now()-R,pdfSize:e.pdfBytes.length}),new o(`Erro Claude API ${r.status}`,"CLAUDE_API_ERROR");let I=await r.json(),g=I.content?.[0]?.text??"",S=I.usage?.input_tokens??0,D=I.usage?.output_tokens??0,N=Math.round(100*(S/1e6*Number(process.env.AI_CLAUDE_VISION_PRICE_INPUT_USD??3)+D/1e6*Number(process.env.AI_CLAUDE_VISION_PRICE_OUTPUT_USD??15))*100);try{let e=function(e){let t=e.trim();if(t.startsWith("{"))return t;let a=t.indexOf("{");if(a<0)throw Error("no JSON found");let r=0;for(let e=a;e<t.length;e++){let n=t[e];if("{"===n)r++;else if("}"===n&&0==--r)return t.slice(a,e+1)}throw Error("unbalanced JSON")}(g);i=JSON.parse(e)}catch{throw console.error("[pdf-extract] invalid json",{bank:f,textPreview:g.slice(0,200)}),new o("Claude retornou JSON inválido","CLAUDE_INVALID_JSON")}let O=Array.isArray(i.transactions)?i.transactions.map((e,t)=>{var a,r;let n,o,s,i;return a=e,r=t,n=String(a.memo??"").trim().slice(0,200),o=String(a.date??"").slice(0,10),s=Math.abs(l(a.amount)??0),i="CREDIT"===a.type?"CREDIT":"DEBIT",{fitid:a.fitid&&"string"==typeof a.fitid?a.fitid:`PDF-${o||"nodate"}-${n.replace(/[^a-zA-Z0-9]+/g,"-").slice(0,20).toLowerCase()||`tx${r}`}-${s.toFixed(2)}`,date:o,amount:s,type:i,memo:n,lineConfidence:l(a.lineConfidence)??.8,isInternational:!0===a.isInternational,originalCurrency:"string"==typeof a.originalCurrency?a.originalCurrency:void 0,originalAmount:l(a.originalAmount)??void 0}}):[],v="DIGITAL"===(a=i.scanQuality)||"SCANNED_HIGH"===a||"SCANNED_LOW"===a||"MOBILE_PHOTO"===a||"UNKNOWN"===a?i.scanQuality:"UNKNOWN",P={detectedBank:i.detectedBank??null,scanQuality:v,closingDate:i.closingDate??null,dueDate:i.dueDate??null,declaredTotal:l(i.declaredTotal),extractedSum:l(i.extractedSum)??O.reduce((e,t)=>e+("DEBIT"===t.type?t.amount:-t.amount),0),declaredTxCount:l(i.declaredTxCount),confidence:l(i.confidence)??.7,detectedCardLast4:i.detectedCardLast4??null,transactions:O,warnings:Array.isArray(i.warnings)?i.warnings.map(String):[],modelVersion:I.model??x,inputTokens:S,outputTokens:D,costCentsUsdX100:N},{result:w,shouldReject:y,rejectReason:b}=function(e){let t=[...e.warnings??[]],a=[];if(s.includes(e.scanQuality))return{result:e,shouldReject:!0,rejectReason:"Detectamos que isso é uma foto de celular. Por favor, envie o PDF DIGITAL da fatura (baixado do app ou site do banco), não uma foto."};if(null!=e.declaredTotal&&null!=e.extractedSum&&isFinite(e.declaredTotal)&&isFinite(e.extractedSum)){let r=Math.abs(e.declaredTotal-e.extractedSum),n=e.declaredTotal>0?r/e.declaredTotal:0;r>.5&&(t.push(`⚠️ Soma das transa\xe7\xf5es (R$ ${e.extractedSum.toFixed(2)}) ≠ total da fatura (R$ ${e.declaredTotal.toFixed(2)}). Diferen\xe7a R$ ${r.toFixed(2)}.`),n<.02?a.push(.85):n<.1?a.push(.6):a.push(.4))}else null==e.declaredTotal&&(t.push("Não detectamos o total da fatura no PDF — não foi possível validar a soma."),a.push(.85));null!=e.declaredTxCount&&Math.abs(e.declaredTxCount-e.transactions.length)>1&&(t.push(`⚠️ PDF declara ${e.declaredTxCount} transa\xe7\xf5es, extra\xedmos ${e.transactions.length}.`),a.push(.7));let r=e.transactions.length,n=1;switch(r>0&&(n=e.transactions.reduce((e,t)=>e+(t.lineConfidence??1),0)/r),n<.85&&a.push(n),e.scanQuality){case"SCANNED_LOW":a.push(.55),t.push("⚠️ Qualidade do scan é BAIXA. Revise CADA linha antes de confirmar.");break;case"SCANNED_HIGH":a.push(.85);break;case"UNKNOWN":a.push(.7)}let o=e.confidence??.85;for(let e of a)o*=e;return o=Math.max(0,Math.min(1,o)),{result:{...e,confidence:o,warnings:t},shouldReject:!1}}(P);if(y)throw new o(b??"PDF rejeitado","IS_PHOTO_REJECTED");return console.log("[pdf-extract] success",{bank:f,durationMs:Date.now()-R,pdfSize:e.pdfBytes.length,inputTokens:S,outputTokens:D,costCentsUsdX100:N,modelVersion:P.modelVersion,detectedBank:P.detectedBank,txCount:P.transactions.length,confidence:w.confidence,scanQuality:P.scanQuality}),w}function l(e){if("number"==typeof e&&Number.isFinite(e))return e;if("string"==typeof e){let t=Number.parseFloat(e.replace(",","."));if(Number.isFinite(t))return t}return null}async function c(e){let a=await t.prisma.personalPdfExtractCache.findUnique({where:{pdfSha256:e}});if(!a)return null;if(a.expiresAt<new Date)return t.prisma.personalPdfExtractCache.delete({where:{id:a.id}}).catch(()=>{}),null;t.prisma.personalPdfExtractCache.update({where:{id:a.id},data:{hitCount:{increment:1}}}).catch(()=>{});try{return JSON.parse(a.resultJson)}catch{return null}}async function u(e){let a=i(e.result),r=new Date(Date.now()+6048e5);await t.prisma.personalPdfExtractCache.upsert({where:{pdfSha256:e.pdfSha256},create:{pdfSha256:e.pdfSha256,modelVersion:a.modelVersion,resultJson:JSON.stringify(a),inputTokens:a.inputTokens,outputTokens:a.outputTokens,costCentsUsdX100:a.costCentsUsdX100,ownerUserId:e.ownerUserId,expiresAt:r},update:{expiresAt:r,hitCount:{increment:1}}})}async function p(e,a){let r=await t.prisma.personalPdfExtractCache.findUnique({where:{pdfSha256:e}});return!!r&&r.ownerUserId===a&&(await t.prisma.personalPdfExtractCache.delete({where:{id:r.id}}),!0)}async function x(e){return t.prisma.personalPdfExtractCache.findMany({where:{ownerUserId:e},select:{id:!0,pdfSha256:!0,modelVersion:!0,inputTokens:!0,outputTokens:!0,costCentsUsdX100:!0,hitCount:!0,cachedAt:!0,expiresAt:!0},orderBy:{cachedAt:"desc"}})}e.s(["extractFromPdf",0,d,"sanitizeForCache",0,i,"sha256Pdf",0,function(e){return(0,a.createHash)("sha256").update(e).digest("hex")}],373342),e.s(["deleteCachedExtraction",0,p,"getCachedExtraction",0,c,"listOwnerCaches",0,x,"saveCachedExtraction",0,u],35155)},244641,e=>{"use strict";var t=e.i(747909),a=e.i(174017),r=e.i(996250),n=e.i(759756),o=e.i(561916),s=e.i(174677),i=e.i(869741),d=e.i(316795),l=e.i(487718),c=e.i(995169),u=e.i(47587),p=e.i(666012),x=e.i(570101),m=e.i(520536),h=e.i(10372),f=e.i(193695);e.i(820232);var E=e.i(600220),A=e.i(89171),C=e.i(368105),T=e.i(35155);async function R(e,{params:t}){let a=await (0,C.getAuthUser)(e);if(!a)return A.NextResponse.json({erro:"Não autenticado"},{status:401});let{sha256:r}=await t;return/^[0-9a-f]{64}$/i.test(r)?await (0,T.deleteCachedExtraction)(r,a.sub)?A.NextResponse.json({ok:!0}):A.NextResponse.json({erro:"Cache não encontrado ou você não é o owner",code:"NOT_OWNER"},{status:404}):A.NextResponse.json({erro:"SHA256 inválido"},{status:400})}e.s(["DELETE",0,R],369791);var I=e.i(369791);let g=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/auth/me/pdf-cache/[sha256]/route",pathname:"/api/auth/me/pdf-cache/[sha256]",filename:"route",bundlePath:""},distDir:"/tmp/nb",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/auth/me/pdf-cache/[sha256]/route.ts",nextConfigOutput:"",userland:I,...{}}),{workAsyncStorage:S,workUnitAsyncStorage:D,serverHooks:N}=g;async function O(e,t,r){r.requestMeta&&(0,n.setRequestMeta)(e,r.requestMeta),g.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let A="/api/auth/me/pdf-cache/[sha256]/route";A=A.replace(/\/index$/,"")||"/";let C=await g.prepare(e,t,{srcPage:A,multiZoneDraftMode:!1});if(!C)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:T,params:R,nextConfig:I,parsedUrl:S,isDraftMode:D,prerenderManifest:N,routerServerContext:O,isOnDemandRevalidate:v,revalidateOnlyGenerated:P,resolvedPathname:w,clientReferenceManifest:y,serverActionsManifest:b}=C,_=(0,i.normalizeAppPath)(A),U=!!(N.dynamicRoutes[_]||N.routes[w]),M=async()=>((null==O?void 0:O.render404)?await O.render404(e,t,S,!1):t.end("This page could not be found"),null);if(U&&!D){let e=!!N.routes[w],t=N.dynamicRoutes[_];if(t&&!1===t.fallback&&!e){if(I.adapterPath)return await M();throw new f.NoFallbackError}}let B=null;!U||g.isDev||D||(B="/index"===(B=w)?"/":B);let L=!0===g.isDev||!U,k=U&&!L;b&&y&&(0,s.setManifestsSingleton)({page:A,clientReferenceManifest:y,serverActionsManifest:b});let F=e.method||"GET",q=(0,o.getTracer)(),H=q.getActiveScopeSpan(),j=!!(null==O?void 0:O.isWrappedByNextServer),$=!!(0,n.getRequestMeta)(e,"minimalMode"),G=(0,n.getRequestMeta)(e,"incrementalCache")||await g.getIncrementalCache(e,I,N,$);null==G||G.resetRequestCache(),globalThis.__incrementalCache=G;let V={params:R,previewProps:N.preview,renderOpts:{experimental:{authInterrupts:!!I.experimental.authInterrupts},cacheComponents:!!I.cacheComponents,supportsDynamicResponse:L,incrementalCache:G,cacheLifeProfiles:I.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,n)=>g.onRequestError(e,t,r,n,O)},sharedContext:{buildId:T}},Y=new d.NodeNextRequest(e),K=new d.NodeNextResponse(t),X=l.NextRequestAdapter.fromNodeNextRequest(Y,(0,l.signalFromNodeResponse)(t));try{let n,s=async e=>g.handle(X,V).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=q.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route");if(r){let t=`${F} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",r),n.updateName(t))}else e.updateName(`${F} ${A}`)}),i=async n=>{var o,i;let d=async({previousCacheEntry:a})=>{try{if(!$&&v&&P&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await s(n);e.fetchMetrics=V.renderOpts.fetchMetrics;let i=V.renderOpts.pendingWaitUntil;i&&r.waitUntil&&(r.waitUntil(i),i=void 0);let d=V.renderOpts.collectedTags;if(!U)return await (0,p.sendResponse)(Y,K,o,V.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,x.toNodeOutgoingHttpHeaders)(o.headers);d&&(t[h.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==V.renderOpts.collectedRevalidate&&!(V.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&V.renderOpts.collectedRevalidate,r=void 0===V.renderOpts.collectedExpire||V.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:V.renderOpts.collectedExpire;return{value:{kind:E.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==a?void 0:a.isStale)&&await g.onRequestError(e,t,{routerKind:"App Router",routePath:A,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:k,isOnDemandRevalidate:v})},!1,O),t}},l=await g.handleResponse({req:e,nextConfig:I,cacheKey:B,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:N,isRoutePPREnabled:!1,isOnDemandRevalidate:v,revalidateOnlyGenerated:P,responseGenerator:d,waitUntil:r.waitUntil,isMinimalMode:$});if(!U)return null;if((null==l||null==(o=l.value)?void 0:o.kind)!==E.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(i=l.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});$||t.setHeader("x-nextjs-cache",v?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),D&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,x.fromNodeOutgoingHttpHeaders)(l.value.headers);return $&&U||c.delete(h.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,m.getCacheControlHeader)(l.cacheControl)),await (0,p.sendResponse)(Y,K,new Response(l.value.body,{headers:c,status:l.value.status||200})),null};j&&H?await i(H):(n=q.getActiveScopeSpan(),await q.withPropagatedContext(e.headers,()=>q.trace(c.BaseServerSpan.handleRequest,{spanName:`${F} ${A}`,kind:o.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},i),void 0,!j))}catch(t){if(t instanceof f.NoFallbackError||await g.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:k,isOnDemandRevalidate:v})},!1,O),U)throw t;return await (0,p.sendResponse)(Y,K,new Response(null,{status:500})),null}}e.s(["handler",0,O,"patchFetch",0,function(){return(0,r.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:D})},"routeModule",0,g,"serverHooks",0,N,"workAsyncStorage",0,S,"workUnitAsyncStorage",0,D],244641)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0~922ev._.js.map