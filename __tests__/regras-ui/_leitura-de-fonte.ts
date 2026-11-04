import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
/**
 * ⭐⭐ O DETECTOR DE "USO, NUNCA MENÇÃO" — UM lugar, não uma cópia por guard (07/10/2026).
 *
 * ⚠️⚠️ **NASCEU DE O GUARD TER VINDO VERDE COM O DEFEITO REPOSTO — a 11ª "menção, não uso"
 * desta casa, e a primeira por IMPORT MULTILINHA.** A versão anterior filtrava LINHA que
 * começa com `import`, então num import quebrado em três linhas
 *
 *     import {
 *       cartoesDoTopo, PRATELEIRAS,
 *     } from '@/lib/custos-fixos/prateleira'
 *
 * o nome sobrevivia na **segunda** linha e `usosDe` contava 1 **com a tela não chamando nada**.
 * Repus a aritmética própria na tela e os 168 testes passaram.
 *
 * ⭐ A cura não é um regex melhor por guard: é **um detector, um lugar** — porque duas cópias
 * do mesmo detector divergem, e foi exatamente por isso que esta passou cega.
 *
 * ⚠️ Este arquivo NÃO é coletado pelo vitest (o include é `*.test.ts`): é helper, não suíte.
 */

/**
 * ⚠️ Tira comentário de bloco, de linha e JSX — **o arquivo que documenta o defeito não pode
 * ser o que o absolve** (a lição de 21/09, no motor do Radar).
 *
 * ⛔⛔⛔ **DESDE 05/11/2026 ISTO USA O PARSER DO TYPESCRIPT, NÃO REGEX — e a troca foi por
 * MEDIÇÃO, não por gosto.**
 *
 * A versão regex tinha duas cicatrizes registradas e uma terceira medida:
 *   1. 08/10 — o comentário JSX preguiçoso comeu **4.431 chars** na central de import;
 *   2. a cura foi um regex melhor… que durou até 04/11;
 *   3. 04/11 — numa tela com `accept` de upload de imagem (valor terminando em
 *      barra-asterisco), a sequência **dentro da string** abriu um comentário falso e o
 *      apagador engoliu **27.816 de 81.765 chars (34%)**, num bloco único de **16.069**.
 *      Todo guard que lia aquela tela estava cego em um terço dela — e o `data-testid` que
 *      eu acabara de adicionar caiu justo ali.
 *
 * ⭐⭐ **A lição não é "regex melhor": é que apagar comentário por regex é a abordagem
 * errada.** Para saber se uma barra-asterisco é comentário, é preciso saber se ela está
 * dentro de string, de template, de regex literal, de texto JSX ou de divisão — isso é
 * trabalho de PARSER, e um regex nunca vai ter esse contexto. A mesma família de bug morde
 * bibliotecas conhecidas da indústria (`strip-comments`, `windicss`) exatamente aqui.
 * ***Detector com um lugar só é força; detector com um lugar só e um furo é cegueira em
 * todos os guards de uma vez*** — e foram três furos no mesmo lugar.
 *
 * ⚠️ **Apaga por ESPAÇOS, não por remoção**, preservando os `\n`: o tamanho e o número de
 * linhas ficam idênticos, então `indexOf`, contagem de linha e qualquer medida de posição
 * continuam valendo. *Remoção faria as posições derivarem e os guards de medida mentiriam.*
 *
 * ⛔ **E FALHA ALTO se o arquivo não parsear.** Vigia lendo lixo é pior que vigia nenhum:
 * ele fica verde sobre um texto que não é o código. O nome do arquivo entra na mensagem
 * quando foi informado — *achado não atribuível não é achado*.
 */
export function semComentarios(s: string, arquivo?: string): string {
  const { sf, kind } = parsear(s, arquivo)

  const diags = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics
  if (diags && diags.length) {
    const primeiro = ts.flattenDiagnosticMessageText(diags[0]!.messageText, ' ')
    throw new Error(
      `semComentarios: não consegui PARSEAR ${arquivo ?? '(fonte sem nome)'} como ${kind}: `
      + `${primeiro}. ⛔ Um guard lendo texto que o parser recusa fica verde sobre lixo — `
      + `conserte o fonte, ou passe o nome do arquivo pra escolher o ScriptKind certo.`,
    )
  }

  return apagar(s, [...comentariosDe(sf, s), ...chavesSoDeComentario(sf)])
}

/**
 * ⭐ Apaga os ranges por ESPAÇO, preservando `\n` — UM lugar, usado pelo arquivo e pelo
 * fragmento. ⛔ Duas cópias deste laço divergiriam no primeiro ajuste, e seria a esquecida
 * que mentiria (a doença que este próprio arquivo documenta).
 */
function apagar(s: string, ranges: ts.CommentRange[]): string {
  if (!ranges.length) return s
  const buf = s.split('')
  for (const r of ranges) {
    for (let i = r.pos; i < r.end && i < buf.length; i++) {
      if (buf[i] !== '\n' && buf[i] !== '\r') buf[i] = ' '
    }
  }
  return buf.join('')
}

/**
 * ⭐⭐⭐ O MODO FRAGMENTO — pra quem recebe um PEDAÇO de código, não um programa (05/11/2026).
 *
 * ⛔⛔ **ISTO NASCEU DE UM DEFEITO MEU, MEDIDO: 25 guards ficaram vermelhos de uma vez.**
 * `usosDe` e `hexCravados` chamam o apagador por dentro, e o que chega nelas quase nunca é
 * um arquivo: é o corpo de uma função (`blocoDa`, `blocoEntre`, `corpoDoCartao`) ou um
 * pedaço de atributo JSX (`"style={{ color: '#fff' }}"`). **Fragmento não parseia como
 * programa** — e o `throw` novo, que é a trava certa pra arquivo inteiro, matava o guard.
 *
 * ⭐ A régua: tenta como programa; se o parser recusa, **devolve o texto intocado**. É a
 * leitura MAIS ESTRITA, não a mais frouxa — na prática o fragmento chega de um texto que já
 * passou pelo apagador, então não há comentário pra tirar, e re-apagar era trabalho
 * redundante que só podia introduzir erro.
 *
 * ⚠️ **O falhar-alto NÃO foi enfraquecido:** ele mora em {@link semComentarios}, que é quem
 * os guards chamam pro ARQUIVO INTEIRO (com nome). Quem lê pedaço usa esta porta e declara
 * isso no nome. *Duas perguntas diferentes, duas funções* — misturar as duas foi o erro.
 */
export function semComentariosDeFragmento(s: string): string {
  const comoTsx = criar('fragmento.tsx', s, ts.ScriptKind.TSX)
  if (!temErro(comoTsx)) return apagar(s, [...comentariosDe(comoTsx, s), ...chavesSoDeComentario(comoTsx)])
  const comoTs = criar('fragmento.ts', s, ts.ScriptKind.TS)
  if (!temErro(comoTs)) return apagar(s, [...comentariosDe(comoTs, s), ...chavesSoDeComentario(comoTs)])
  return s
}

/**
 * ⭐⭐ CSS TEM APAGADOR PRÓPRIO — porque CSS não é TypeScript (05/11/2026).
 *
 * ⛔ **Achado ao trocar o miolo:** `o-trilho-nasce-recolhido` passava `app/globals.css` pra
 * `semComentarios`. Com regex isso "funcionava" **por acidente** — regex não liga pra
 * linguagem. Com o parser, o CSS não parseia e o guard morreu na coleta. O guard precisa da
 * limpeza de verdade: ele acha `.trilho {` no texto limpo, e um `.trilho {` COMENTADO
 * passaria por bloco de verdade.
 *
 * ⚠️ **Aqui o regex é a ferramenta certa, e isso não contradiz a troca acima:** o que torna
 * regex errado em JS/TS é o CONTEXTO — string, template, regex literal, JSX, divisão. CSS
 * não tem nenhum desses. A única armadilha concebível é uma barra-asterisco dentro de string
 * (`content: "…"`), e eu MEDI: em `app/globals.css` são **143 comentários de bloco, zero
 * `content:` com a sequência, zero `//`**. O limite fica declarado e com teste.
 *
 * ⛔ A forma do regex é a estrutural (abre, nada que contenha o fecha, o fecha) — a mesma
 * lição de 08/10: assim o match **não pode** atravessar o fechamento.
 */
export function semComentariosDeCss(s: string): string {
  return s.replace(/\/\*(?:[^*]|\*(?!\/))*\*\//g, (m) => m.replace(/[^\n\r]/g, ' '))
}

/**
 * ⭐ O ScriptKind vem da EXTENSÃO quando o nome é informado — regra determinística.
 *
 * ⚠️ Sem nome, tenta `TSX` e cai pra `TS`: os dois divergem de verdade (`<T>x` é *cast* em
 * `.ts` e *elemento JSX* em `.tsx`), então um default único reprovaria arquivos válidos. A
 * ordem é TSX primeiro porque a varredura de telas é a dona da maioria das chamadas.
 * ⛔ Não é heurística sobre o conteúdo: é tentar e **conferir o parser**, que é fato.
 */
function parsear(s: string, arquivo?: string): { sf: ts.SourceFile; kind: string } {
  const nome = arquivo ?? 'fonte.tsx'
  if (arquivo) {
    const kind = arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX
      : arquivo.endsWith('.jsx') ? ts.ScriptKind.JSX
      : arquivo.endsWith('.js') || arquivo.endsWith('.mjs') || arquivo.endsWith('.cjs') ? ts.ScriptKind.JS
      : ts.ScriptKind.TS
    return { sf: criar(nome, s, kind), kind: ts.ScriptKind[kind] }
  }
  const comoTsx = criar(nome, s, ts.ScriptKind.TSX)
  if (!temErro(comoTsx)) return { sf: comoTsx, kind: 'TSX' }
  const comoTs = criar('fonte.ts', s, ts.ScriptKind.TS)
  if (!temErro(comoTs)) return { sf: comoTs, kind: 'TS' }
  // ⚠️ devolve o TSX de propósito: a mensagem de erro sai pela tentativa principal
  return { sf: comoTsx, kind: 'TSX (e TS também falhou)' }
}

const criar = (nome: string, s: string, kind: ts.ScriptKind) =>
  ts.createSourceFile(nome, s, ts.ScriptTarget.Latest, /* setParentNodes */ true, kind)

const temErro = (sf: ts.SourceFile) =>
  ((sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []).length > 0

/**
 * ⭐⭐ `{/* … *\/}` SAI INTEIRO — as chaves incluídas (05/11/2026).
 *
 * ⛔⛔ **Medido, e é a razão de isto existir:** apagando só o comentário, sobravam `{   }`
 * no texto — **32** em `conferencia-view.tsx`, **47** na tela de margem, **22** no contas a
 * pagar. A régua velha removia o `{…}` junto, então todo guard de JSX foi calibrado num
 * texto SEM essas chaves. Deixá-las produziria vermelhos que não são nem defeito do app nem
 * guard mal escrito — seriam **artefato da minha troca**, o pior tipo: faz triar trabalho
 * que não existe.
 *
 * ⚠️ Um `JsxExpression` cuja `expression` é `undefined` é exatamente *"chaves com só
 * comentário dentro"* — fato do AST, não heurística de texto. E continua apagando por
 * ESPAÇOS: o `{` e o `}` viram espaço, as posições não se movem.
 */
function chavesSoDeComentario(sf: ts.SourceFile): ts.CommentRange[] {
  const out: ts.CommentRange[] = []
  const andar = (n: ts.Node): void => {
    if (ts.isJsxExpression(n) && n.expression === undefined) {
      out.push({ pos: n.getStart(sf), end: n.end, kind: ts.SyntaxKind.MultiLineCommentTrivia, hasTrailingNewLine: false })
    }
    ts.forEachChild(n, andar)
  }
  andar(sf)
  return out
}

/**
 * ⭐⭐ OS COMENTÁRIOS DE VERDADE, pelo AST.
 *
 * ⚠️⚠️ **Varre os TOKENS, não só os nós** — e isto foi medido: com `forEachChild` sozinho, o
 * `{/* … *\/}` de JSX **não aparece**, porque um `JsxExpression` vazio não tem filho nenhum e
 * o comentário não é trivia de nó algum. `getChildren()` traz os tokens (`{`, `}`), e aí o
 * comentário aparece como trivia deles.
 *
 * ⚠️ Dedup por `pos:end` porque o mesmo range é trailing de um token e leading do seguinte.
 */
function comentariosDe(sf: ts.SourceFile, texto: string): ts.CommentRange[] {
  const achados = new Map<string, ts.CommentRange>()
  const guardar = (rs: readonly ts.CommentRange[] | undefined) => {
    for (const r of rs ?? []) achados.set(`${r.pos}:${r.end}`, r)
  }

  const andar = (n: ts.Node): void => {
    guardar(ts.getLeadingCommentRanges(texto, n.pos))
    guardar(ts.getTrailingCommentRanges(texto, n.end))
    let filhos: readonly ts.Node[] = []
    try {
      filhos = n.getChildren(sf)
    } catch {
      // ⚠️ nó sintético (sem posição real) não tem filhos navegáveis — segue pelos nós
      ts.forEachChild(n, andar)
      return
    }
    for (const f of filhos) andar(f)
  }

  andar(sf)
  return [...achados.values()].sort((a, b) => a.pos - b.pos)
}

/**
 * ⛔⛔ Tira a DECLARAÇÃO de import inteira, **multilinha incluída** — é o que faltava.
 *
 * ⚠️ Casa `import … from '…'` com ou sem ponto-e-vírgula, e também `import '…'` (efeito
 * colateral). O `[\s\S]*?` é preguiçoso e para no primeiro `from '…'`, então dois imports
 * seguidos não viram um só.
 */
export function semImports(s: string): string {
  return s
    .replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"];?/gm, '')
}

/** ⭐ conta o USO de um símbolo: sem comentário e sem import, multilinha incluída */
export function usosDe(src: string, nome: string): number {
  const limpo = semImports(semComentariosDeFragmento(src))
  return (limpo.match(new RegExp(`\\b${nome}\\b`, 'g')) ?? []).length
}

/**
 * ⭐⭐ OS HEX DE COR CRAVADOS NUMA TELA — um detector, um lugar (14/10/2026).
 *
 * ⚠️ Nasceu porque a cláusula *"zero hex cravado em tela"* da fundação vale pro SISTEMA TODO, e
 * até aqui cada guard de tela escrevia o próprio regex de hex (`margem-v3`, `pagina-da-ordem-v4`,
 * `custos-fixos-v4`, `home-producao-mock-v3`…). ***N cópias do mesmo detector divergem, e a que
 * diverge é sempre a que ninguém reconsertou*** — foi exatamente assim que o `semComentarios`
 * ficou cego em 08/10 e cegou TODO guard de uma vez.
 *
 * ⛔ Lê SEM COMENTÁRIO de propósito: metade dos hex que aparecem num `grep` cru desta casa vive
 * em comentário DOCUMENTANDO o tom que saiu (o `dashboard-shell` é o caso puro — os 3 hex dele
 * são a história do canvas, não CSS). Contar comentário faria o arquivo que explica o defeito
 * ser reprovado por explicá-lo.
 *
 * ⚠️ O `[^0-9a-zA-Z_#]` antes do `#` evita casar dentro de um token maior; os 8 dígitos cobrem
 * `#RRGGBBAA`, que o Tailwind aceita em valor arbitrário.
 */
export function hexCravados(src: string): string[] {
  const limpo = semComentariosDeFragmento(src)
  return [...limpo.matchAll(/(?:^|[^0-9a-zA-Z_#])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g)].map(
    (m) => m[1].toLowerCase(),
  )
}

/**
 * ⭐⭐ O CORPO DE UMA FUNÇÃO, por MARCO — o fim é a próxima declaração, não um orçamento de
 * caracteres (05/11/2026).
 *
 * ⛔⛔ Nasceu de dois guards que usavam `slice(i, i + 2000)` e `slice(i - 900, i)`. Eles
 * ficaram vermelhos quando o apagador passou a deixar ESPAÇO no lugar do comentário em vez
 * de removê-lo: as distâncias cresceram (**2.551 > 2.000** e **911 > 900 — perdeu por 11**)
 * e o app estava CERTO nos dois casos. *Janela de distância já deu falso vermelho E falso
 * verde nesta casa; aumentar o número só adia a próxima vez.*
 */
export function corpoDaFuncao(src: string, nome: string): string {
  const i = src.indexOf(`function ${nome}`)
  if (i < 0) return ''
  const depois = src.indexOf('\nfunction ', i + 1)
  const depoisConst = src.indexOf('\nconst ', i + 1)
  const fins = [depois, depoisConst].filter((x) => x > 0)
  return src.slice(i, fins.length ? Math.min(...fins) : src.length)
}

/** ⭐ o corpo de um bloco entre dois marcos — pra asserção ESTRUTURAL, não por distância */
export function blocoEntre(src: string, inicio: string, fim: string): string {
  const i = src.indexOf(inicio)
  if (i < 0) return ''
  const j = src.indexOf(fim, i + inicio.length)
  return j < 0 ? src.slice(i) : src.slice(i, j + fim.length)
}

/**
 * ⭐⭐ A VARREDURA DAS TELAS — **um lugar** (14/10/2026). Todo `.tsx` de `app/` e `components/`,
 * ordenado.
 *
 * ⚠️ Nasceu de `zero-hex-cravado`, onde ela era uma função local. Com a varredura WCAG da
 * fundação precisando do MESMO universo, copiá-la seria a 2ª cópia do mesmo detector — e é
 * exatamente assim que uma das duas fica cega (o cabeçalho deste arquivo conta a vez em que
 * isso custou um guard verde com o defeito reposto).
 */
export function telasDoApp(raiz = process.cwd()): string[] {
  const varrer = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(join(raiz, dir))) {
      const p = `${dir}/${e}`
      if (statSync(join(raiz, p)).isDirectory()) varrer(p, out)
      else if (e.endsWith('.tsx')) out.push(p)
    }
    return out
  }
  return [...varrer('app'), ...varrer('components')].sort()
}

/**
 * ⛔⛔⛔ HANDLER PASSADO POR REFERÊNCIA CUJA FUNÇÃO DECLARA PARÂMETRO (18/10/2026).
 *
 * O detector da classe que parou o import de 16 e 17/10 (`acao: abrirPreview` → React chamou
 * com o evento → `JSON.stringify` estourou antes do fetch → *"Falha de conexão"*). O porquê e
 * a cura por TIPO estão em `lib/ui/acao-sem-argumento.ts`.
 *
 * ⚠️⚠️ **A RÉGUA É ESTREITA POR MEDIÇÃO, não por preguiça.** A 1ª versão era *"função com
 * parâmetro não-evento pendurada por referência"* e deu **39 achados, dos quais ~37
 * LEGÍTIMOS** — `onEscolher={addComp}` com contrato `onEscolher: (it: ItemBusca) => void` está
 * CERTO, porque o filho chama com o argumento. ***Alarme falso no dia 1 é como um guard
 * morre.*** O que distingue o defeito é o CONTRATO de quem recebe: **prop declarada
 * zero-arg**. Com isso: **1 achado, o próprio defeito.**
 *
 * ⚠️ Prop de evento do DOM fica de fora porque o `tsc` JÁ cobra: contrato
 * `(e: MouseEvent) => void` recebendo `(x: boolean) => void` falha na contravariância. O
 * buraco de variância existe **só** no contrato zero-arg.
 */
const PROPS_DE_EVENTO_DO_DOM = new Set([
  'onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus', 'onKeyDown', 'onKeyUp',
  'onInput', 'onSelect', 'onValueChange', 'onOpenChange', 'onCheckedChange', 'onMouseDown',
])

const DECL_DE_FUNCAO =
  /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(?:async\s*)?\(([^)]*)\)\s*(?::[^=]*)?=>|function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g
const INICIO_DE_COMPONENTE = /^(?:export\s+default\s+)?(?:export\s+)?function\s+([A-Za-z_$][\w$]*)/gm
const REF_EM_JSX = /\b(on[A-Z]\w*|acao)=\{([A-Za-z_$][\w$]*)\}/g
const REF_EM_OBJETO = /\b(acao|on[A-Z]\w*)\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/g
const DECL_DE_PROP = /\b(on[A-Z]\w*|acao)\??\s*:\s*\(([^)]*)\)\s*=>/g

/** quantos parâmetros cada prop-handler DECLARA, no repo inteiro (uma prop pode ter N donos) */
export function aridadeDasProps(fontes: string[]): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>()
  for (const src of fontes) {
    for (const g of semComentariosDeFragmento(src).matchAll(DECL_DE_PROP)) {
      const p = g[2].trim()
      if (!m.has(g[1])) m.set(g[1], new Set())
      m.get(g[1])!.add(p === '' ? 0 : p.split(',').length)
    }
  }
  return m
}

export interface HandlerPorReferencia {
  prop: string
  funcao: string
  params: string
  linha: number
  /** o componente em que a referência mora — o ESCOPO é o que impede o falso positivo */
  componente: string
}

/**
 * ⚠️⚠️ **O ESCOPO NÃO É PRECIOSISMO — FOI O MEU PRÓPRIO ERRO NO MAPA DA CAÇA.** A tela de
 * vendas tem **três** `confirmar` (um por componente); a 1ª varredura casou o nome com a
 * declaração errada e reportei **2 defeitos onde havia 1**. Aqui a referência resolve
 * **dentro do componente dela**, e cai no módulo só quando o nome é único no arquivo.
 */
export function handlersPorReferenciaComParametro(
  src: string,
  aridade: Map<string, Set<number>>,
): HandlerPorReferencia[] {
  const limpo = semImports(semComentariosDeFragmento(src))

  const blocos: { nome: string; ini: number }[] = []
  for (const m of limpo.matchAll(INICIO_DE_COMPONENTE)) blocos.push({ nome: m[1], ini: m.index! })
  const blocoDe = (pos: number) => {
    let r = -1
    for (let i = 0; i < blocos.length; i++) if (blocos[i].ini <= pos) r = i
    return r
  }

  const decls: { nome: string; params: string; pos: number }[] = []
  for (const m of limpo.matchAll(DECL_DE_FUNCAO)) {
    decls.push({ nome: m[1] ?? m[3], params: (m[2] ?? m[4] ?? '').trim(), pos: m.index! })
  }
  const resolver = (nome: string, pos: number) => {
    const b = blocoDe(pos)
    const noBloco = decls.filter((d) => d.nome === nome && blocoDe(d.pos) === b)
    if (noBloco.length) return noBloco[noBloco.length - 1]
    const q = decls.filter((d) => d.nome === nome)
    return q.length === 1 ? q[0] : null
  }

  const refs: { prop: string; funcao: string; pos: number }[] = []
  for (const m of limpo.matchAll(REF_EM_JSX)) refs.push({ prop: m[1], funcao: m[2], pos: m.index! })
  for (const m of limpo.matchAll(REF_EM_OBJETO)) refs.push({ prop: m[1], funcao: m[2], pos: m.index! })

  const out: HandlerPorReferencia[] = []
  for (const r of refs) {
    if (PROPS_DE_EVENTO_DO_DOM.has(r.prop)) continue
    const ar = aridade.get(r.prop)
    // ⛔ só o contrato PROVADAMENTE zero-arg: prop com dono ambíguo (uma declaração zero-arg
    // e outra com parâmetro) fica de fora — chutar ali é inventar o contrato do vizinho.
    if (!ar || ar.size !== 1 || !ar.has(0)) continue
    const d = resolver(r.funcao, r.pos)
    if (!d || !d.params) continue
    out.push({
      prop: r.prop,
      funcao: r.funcao,
      params: d.params,
      linha: limpo.slice(0, r.pos).split('\n').length,
      componente: blocos[blocoDe(r.pos)]?.nome ?? '(módulo)',
    })
  }
  return out
}

/**
 * ⭐⭐ TODAS as chamadas que casam `padrao`, cada uma devolvida como o bloco de argumentos
 * BALANCEADO — `(` … `)` contados, então `select: { a: { b: 1 } }` e string com parêntese
 * dentro não truncam o bloco.
 *
 * ⛔⛔ **Existe pra matar a "janela de distância"** (`[\s\S]{0,N}`), que nesta casa já deu
 * falso VERMELHO *e* falso VERDE: a cópia que espaça o código escapa da janela, e um trecho
 * alheio dentro dela acusa inocente. A pergunta certa nunca é *"quão perto?"* e sim
 * *"dentro de qual chamada?"*.
 *
 * ⚠️ Difere de {@link blocoEntre}, que acha só a PRIMEIRA ocorrência e corta na 1ª string de
 * fim — bom pra inspecionar uma chamada conhecida, cego pra varrer N delas.
 */
export function chamadasDe(src: string, padrao: RegExp): string[] {
  const re = new RegExp(padrao.source, padrao.flags.includes('g') ? padrao.flags : padrao.flags + 'g')
  const out: string[] = []
  for (const m of src.matchAll(re)) {
    const abre = src.indexOf('(', m.index!)
    if (abre < 0) continue
    let nivel = 0
    for (let i = abre; i < src.length; i++) {
      if (src[i] === '(') nivel++
      else if (src[i] === ')') {
        nivel--
        if (nivel === 0) {
          out.push(src.slice(m.index!, i + 1))
          break
        }
      }
    }
  }
  return out
}

/**
 * ⭐⭐ UM ELEMENTO JSX INTEIRO, por NOME — `<Nome … />` ou `<Nome …>…</Nome>`.
 *
 * ⛔⛔ **Existe porque `chamadasDe` NÃO serve pra JSX e falha CALADA ali:** ela procura o
 * primeiro `(` depois do match, e `<AlarmeDeContas` não tem parêntese nenhum — ela pegaria o
 * próximo `(` do arquivo e devolveria um bloco que não é o elemento. *Sonda errada dá um
 * vermelho tão convincente quanto um defeito real* — e um verde também.
 *
 * ⚠️ Conta `{}` pra não parar num `/>` que vive dentro de uma prop (`titulo={(n) => …}`), e
 * aceita as duas formas de fechamento. Estrutural: a distância nunca entra na conta.
 */
export function elementosJsx(src: string, nome: string): string[] {
  const out: string[] = []
  const abre = new RegExp(`<${nome}(?=[\\s/>])`, 'g')
  for (const m of src.matchAll(abre)) {
    let i = m.index! + m[0].length
    let chaves = 0
    for (; i < src.length; i++) {
      const ch = src[i]
      if (ch === '{') chaves++
      else if (ch === '}') chaves--
      else if (chaves === 0 && ch === '/' && src[i + 1] === '>') { i += 2; break }
      else if (chaves === 0 && ch === '>') { i += 1; break }
    }
    out.push(src.slice(m.index!, i))
  }
  return out
}
