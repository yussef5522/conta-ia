import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
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
 */
export function semComentarios(s: string): string {
  return s
    .replace(COMENTARIO_JSX, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * ⛔⛔⛔ O COMENTÁRIO JSX SE FECHA NO PRIMEIRO FECHA-COMENTÁRIO, E ISSO NÃO É DETALHE DE REGEX
 * (08/10/2026).
 *
 * A versão anterior usava um `[\s\S]*?` preguiçoso entre `{` e `}` — e o FIM dela exigia o
 * fecha-comentário **seguido de `}`**. Num arquivo onde um bloco abre com `{` e a primeira
 * coisa dentro dele é um comentário de bloco (o caso trivial de `}) {` seguido de um JSDoc de
 * variável), o match **não parava no fecha-comentário dele**: corria até achar o primeiro
 * comentário JSX de verdade lá embaixo e **engolia tudo no meio**.
 *
 * ⚠️⚠️ MEDIDO: na central de import ele comeu **4.431 caracteres**, levando o container
 * (`max-w-[1440px]`), as medidas do celular e a `casaBusca` junto — e o guard passou a acusar
 * peças que ESTAVAM na tela, enquanto seria **cego** a qualquer defeito naquele trecho.
 * ***Detector com um lugar só é força; detector com um lugar só e um furo é cegueira em todos
 * os guards de uma vez.***
 *
 * ⭐ A cura é dizer NA FORMA o que um comentário de bloco é: abre-comentário, nada que contenha
 * o fecha, e o fecha. Assim o match **não pode** atravessar o fechamento, e o `{…}` em volta
 * precisa abraçar exatamente um comentário.
 */
const COMENTARIO_JSX = /\{\s*\/\*(?:[^*]|\*(?!\/))*\*\/\s*\}/g

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
  const limpo = semImports(semComentarios(src))
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
  const limpo = semComentarios(src)
  return [...limpo.matchAll(/(?:^|[^0-9a-zA-Z_#])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g)].map(
    (m) => m[1].toLowerCase(),
  )
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
    for (const g of semComentarios(src).matchAll(DECL_DE_PROP)) {
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
  const limpo = semImports(semComentarios(src))

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
