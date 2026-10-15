/**
 * ⭐⭐⭐ O LEITOR DAS REFERÊNCIAS VISUAIS — uma régua, N arquivos, N leitores (08/10/2026).
 *
 * Um arquivo em `docs/*-referencia.html` é a LEI VISUAL de uma tela, e **duas coisas leem cada
 * um**: o guard (`__tests__/regras-ui/*-bate-com-a-referencia.test.ts`) e a sonda da prova em
 * prod. ⚠️ Mudou de casa em 08/10 (`lib/margem/referencia.ts` → aqui) quando a **segunda**
 * referência nasceu (a central de import): escrever um leitor por tela repetiria, com outro
 * nome, exatamente a doença que o cabeçalho abaixo descreve.
 *
 * ⛔⛔ ESTE ARQUIVO NASCEU DE UM VERMELHO REAL. Na v3.1 o guard e a sonda extraíam as medidas
 * com **duas cópias do mesmo regex**; eu consertei a do guard (pra separar BREAKPOINT de
 * medida de ELEMENTO) e **deixei a da sonda atrás** — e a prova em prod acusou *"FALTAM 1024"*
 * sobre uma tela correta. ***É a doença que esta casa mais paga, agora entre o teste e a
 * prova:*** se as duas lêem o arquivo com réguas diferentes, uma delas mente, e a que mente é
 * sempre a que ninguém reconsertou.
 *
 * ⚠️ Lê do disco (`fs`), então é SERVIDOR/teste — nunca importado por código de tela.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** ⚠️ a referência da margem continua acessível pelo nome antigo — os 2 leitores dela não mudam */
export const CAMINHO_DA_REFERENCIA = 'docs/margem-referencia.html'
export const CAMINHO_DA_REFERENCIA_IMPORTAR = 'docs/importar-referencia.html'
/**
 * ⭐⭐ A referência da FUNDAÇÃO (14/10) — ela manda nos TOKENS do sistema inteiro, não numa tela.
 * HIERARQUIA: esta referência manda na fundação (tinta, linha, trilho, topo, raio, sombra); as
 * de TELA mandam na estrutura das telas delas. Em conflito de token, a fundação vence.
 */
export const CAMINHO_DA_FUNDACAO = 'docs/cara-do-sistema-referencia.html'
/**
 * ⭐⭐ A referência da MESA DE OPERAÇÕES (15/10) — a lei do VISUAL e do COMPORTAMENTO do
 * dashboard novo (① Dashboard · ② Produção), aprovada pelo dono em 15/10.
 *
 * ⚠️ Ela manda na ESTRUTURA das duas mesas (quais módulos, em que ordem, com que span); os
 * TOKENS continuam sob a fundação (`CAMINHO_DA_FUNDACAO`) — em conflito, a fundação vence.
 */
export const CAMINHO_DO_DASHBOARD = 'docs/dashboard-referencia.html'

export interface ReferenciaVisual {
  /** o arquivo inteiro */
  html: string
  /** só o `<style>` */
  css: string
  /** ⚠️ o `<script>` É a especificação do comportamento do montador */
  script: string
  /** os tokens do `:root{}` (antes do 1º `@media`), na ordem do arquivo */
  tokens: string[]
  /**
   * ⭐ os VALORES hex do `:root{}` — `{'--bg': '#f3f5fa', …}`, sempre em minúscula.
   * ⚠️ Existe porque o guard da fundação compara VALOR (a cor que o token carrega), não só a
   * presença do nome: token presente com tom ajustado "no olho" passaria por uma régua que só
   * conta nomes — foi assim que o guard do mock da Conciliação nasceu cego em 13/09.
   */
  valores: Record<string, string>
  /** ⭐ os valores do bloco `:root[data-theme="dark"]{}` (o tema escuro declarado) */
  valoresEscuros: Record<string, string>
  /** as hierarquias de letra declaradas (`font-size:Npx`) */
  letras: string[]
  /** as medidas de ELEMENTO (`width`/`height`/`min-width`) */
  medidas: string[]
  /** os BREAKPOINTS (`@media (min|max-width:Npx)`) */
  cortes: string[]
}

/**
 * ⚠️ O CAMINHO É PARÂMETRO, com o da margem como default — assim os 2 leitores que já
 * existiam seguem chamando `lerReferenciaVisual()` sem mudar uma linha, e a referência nova
 * entra passando o caminho dela. ⛔ Um 2º arquivo de leitor é que seria a segunda régua.
 */
export function lerReferenciaVisual(
  caminho: string = CAMINHO_DA_REFERENCIA,
  raiz = process.cwd(),
): ReferenciaVisual {
  const html = readFileSync(resolve(raiz, caminho), 'utf8')
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
  const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'))

  const topo = css.slice(0, css.indexOf('@media'))
  const tokens = [...topo.matchAll(/(--[a-z0-9-]+):\s*#[0-9A-Fa-f]{3,8}/g)].map((m) => m[1])

  /** ⚠️ minúscula sempre: a referência escreve `#F3F5FA` e o CSS da casa `#f3f5fa` — comparar
   *  hex com caixa diferente daria vermelho sobre dois valores IDÊNTICOS. */
  const hexDe = (trecho: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const m of trecho.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)) {
      out[m[1]] = m[2].toLowerCase()
    }
    return out
  }
  const valores = hexDe(topo)

  /** ⭐ o bloco do interruptor explícito. ⚠️ A referência declara o escuro DUAS vezes (no
   *  `@media (prefers-color-scheme: dark)` e aqui) de propósito — é o que faz o botão de tema
   *  ganhar nos dois sentidos. Leio o do `[data-theme]` porque é o que a classe `.dark` da casa
   *  espelha; o teste abaixo confere que os dois blocos da referência concordam. */
  const abreEscuro = css.indexOf(':root[data-theme="dark"]{')
  const valoresEscuros =
    abreEscuro === -1 ? {} : hexDe(css.slice(abreEscuro, css.indexOf('}', abreEscuro)))

  const unico = (xs: string[]) => [...new Set(xs)]
  const letras = unico([...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => m[1]))

  /**
   * ⚠️ O `[^-a-z(]` NÃO é preciosismo de regex, e é a razão de este arquivo existir:
   *  · sem excluir o `-`, o `max-width:1440px` do container entraria como largura de elemento;
   *  · sem excluir o `(`, o `min-width:1024px` do `@media` entraria também — e aí a régua
   *    cobraria um `[1024px]` literal numa tela que expressa aquele corte como `lg:`, o alias
   *    do Tailwind. **Breakpoint e medida de elemento são duas coisas**, e cada uma tem o seu
   *    leitor abaixo.
   */
  const medidas = unico(
    [...css.matchAll(/(?:^|[^-a-z(])(?:width|height|min-width):\s*([\d.]+)px/g)].map((m) => m[1]),
  )
  const cortes = unico(
    [...css.matchAll(/@media\s*\((?:min|max)-width:\s*([\d.]+)px\)/g)].map((m) => m[1]),
  )

  return { html, css, script, tokens, valores, valoresEscuros, letras, medidas, cortes }
}

/**
 * ⭐⭐ A PALETA DE UM SELETOR — e ela nasceu de uma armadilha REAL (15/10).
 *
 * ⛔⛔ A referência da mesa é **DARK-FIRST**: o `:root` cru carrega o tema ESCURO e o
 * `:root[data-theme="light"]` carrega o CLARO. Os campos `valores`/`valoresEscuros` acima
 * recortam *"tudo antes do primeiro `@media`"*, então **os dois blocos caem no mesmo recorte e
 * o último sobrescreve o primeiro** — medido: o `valores` daquele arquivo devolve a paleta
 * CLARA com o nome de clara e a ESCURA desaparece.
 *
 * ⚠️ Em vez de mudar a semântica dos campos antigos (que os guards da fundação e da margem já
 * consomem, e ali o `:root` É o claro), a leitura por SELETOR entra como função própria.
 * **Quem sabe se o arquivo é claro-first ou dark-first é o guard daquele arquivo**, não o leitor.
 *
 * @param seletor `':root'` pega o bloco CRU (sem `[data-theme]`); `':root[data-theme="light"]'`
 *                pega o do interruptor.
 */
export function paletaDoSeletor(css: string, seletor: string): Record<string, string> {
  const marca = `${seletor}{`
  const i = css.indexOf(marca)
  if (i === -1) return {}
  const bloco = css.slice(i + marca.length, css.indexOf('}', i))
  const out: Record<string, string> = {}
  for (const m of bloco.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)) {
    out[m[1]] = m[2].toLowerCase()
  }
  return out
}
