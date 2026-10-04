/**
 * ⛔⛔⛔ O GUARD DOS DOIS LADOS — o assistente de conversão TEM maçaneta E a rota responde.
 *
 * ⚠️⚠️ **Esta casa pagou ONZE vezes pela mesma família de defeito** ("porta sem maçaneta"):
 * motor em prod, provado por rota, e **inalcançável pelo dedo do dono**. E o caso de hoje é o
 * mais caro da série, porque o aviso `LOTE_NAO_COMPARAVEL` existe desde **03/10** dizendo o
 * problema e **sem dizer onde resolver** — o dono lia e ficava com ele na mão.
 *
 * ⭐ **Guard de UM lado não serve:** só olhar a TELA aprovaria um botão apontando pro nada; só
 * olhar a ROTA aprovaria um motor que ninguém alcança. Ele prova os dois.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA a regra não pode ser o que a cumpre */
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const TELA_DA_VARREDURA = 'app/(dashboard)/empresas/[id]/estoque/fichas/conversao/page.tsx'
const TELA_DAS_RECEITAS = 'app/(dashboard)/empresas/[id]/estoque/producao/receitas/page.tsx'
const TELA_DA_PRODUCAO = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const ROTA_DA_FILA = 'app/api/empresas/[id]/estoque/fichas/conversao/route.ts'
const ROTA_DO_GESTO = 'app/api/empresas/[id]/estoque/fichas/[fichaId]/conversao/route.ts'

describe('⭐⭐ a maçaneta existe — nos dois pontos que o dono pediu', () => {
  it('⭐ a tela da varredura EXISTE', () => {
    expect(() => statSync(join(raiz, TELA_DA_VARREDURA))).not.toThrow()
  })

  it('⭐⭐ o AVISO DA ORDEM carrega o gesto (era ele que dizia o problema sem a saída)', () => {
    const tela = semComentario(ler(TELA_DA_PRODUCAO))
    expect(tela, 'o aviso LOTE_NAO_COMPARAVEL tem que oferecer o caminho').toContain('estoque/fichas/conversao')
    /**
     * ⚠️ E o atalho é CONDICIONAL ao motivo certo: o `MEDIA_DESTOA` não se resolve convertendo
     * lote nenhum, e oferecer ali mandaria o dono pro lugar errado (a lição de 16/09 —
     * *mensagem que acusa o campo errado faz o dono caçar um erro que não existe*).
     */
    expect(tela).toMatch(/motivo === 'LOTE_NAO_COMPARAVEL'/)
  })

  it('⭐ a tela das RECEITAS tem a porta permanente (ferramenta não some com a fila)', () => {
    const tela = semComentario(ler(TELA_DAS_RECEITAS))
    expect(tela).toContain('estoque/fichas/conversao')
    /**
     * ⛔ A régua de 12/09: *fila zerada esconde o TRABALHO, nunca a FERRAMENTA*. O link não
     * pode nascer atrás do contador — só o TEXTO dele muda quando `faltam` é zero.
     *
     * ⚠️⚠️ **A REGRA 11 PEGOU ESTE TESTE: a 1ª versão NÃO MORDIA.** Eu fatiava 600 caracteres
     * antes do primeiro `estoque/fichas/conversao` do arquivo — e o primeiro é o **`fetch` do
     * `useEffect`** que carrega o contador, lá no topo. Repondo o defeito (o link atrás do
     * contador) o teste passou **VERDE**. *Guard que mede a vizinhança da ocorrência errada é
     * uma afirmação sobre outro trecho do arquivo* — é a 7ª vez que a janela de distância
     * engana nesta casa. O que vale é o que vem imediatamente antes da **TAG**.
     */
    const iTag = tela.search(/<a\b[^>]*\n?[^>]*estoque\/fichas\/conversao/)
    expect(iTag, 'nenhum <a> aponta pro assistente nesta tela').toBeGreaterThan(-1)
    const antesDaTag = tela.slice(Math.max(0, iTag - 200), iTag)
    expect(
      /faltamConverter\s*(?:!=|>|&&)/.test(antesDaTag),
      'o LINK não pode estar atrás de um contador de pendência — só o rótulo muda (12/09)',
    ).toBe(false)
  })

  /**
   * ⚠️⚠️ **A 1ª VERSÃO DESTE TESTE MEDIU A OCORRÊNCIA ERRADA — e o vermelho era MEU, não da
   * tela.** Eu procurava `indexOf('estoque/fichas/conversao')` e caía no `fetch(...)` do
   * `useEffect` (que carrega o contador), onde não há `className` nenhum por perto. É a
   * **janela de distância** pela 6ª vez nesta casa (o rastro em 12/09, o menu do PF em 13/09,
   * o rodapé em 14/09, o do CATEGORIA em 18/09…). *O que define o elemento é a ESTRUTURA —
   * `href=` —, nunca a vizinhança de caracteres.*
   */
  it('⛔ nenhum dos caminhos é hover-only (no celular não existe hover — a lição de 30/08)', () => {
    for (const rel of [TELA_DAS_RECEITAS, TELA_DA_PRODUCAO]) {
      const tela = semComentario(ler(rel))
      // ⭐ só as ocorrências que são DESTINO de link, não a URL do fetch
      /**
       * ⚠️ `[^}]*` NÃO serve pro href: o template da casa é `` {`/empresas/${id}/...`} `` e o
       * `}` do `${id}` fecha a classe cedo. O que delimita a tag é o PRIMEIRO `>`.
       */
      const links = [...tela.matchAll(/<a\b[\s\S]*?>/g)].filter((m) => m[0].includes('estoque/fichas/conversao'))
      expect(links.length, `${rel}: nenhum <a> aponta pro assistente`).toBeGreaterThan(0)
      for (const m of links) {
        expect(
          /className=/.test(m[0]) && /border|bg-|rounded/.test(m[0]),
          `${rel}: o atalho precisa de afordância visível (borda/fundo), não só hover`,
        ).toBe(true)
      }
    }
  })
})

describe('⭐⭐ e a rota por trás RESPONDE — e com a trava certa', () => {
  it('as duas rotas existem', () => {
    for (const rel of [ROTA_DA_FILA, ROTA_DO_GESTO]) {
      expect(() => statSync(join(raiz, rel)), `${rel} não existe`).not.toThrow()
    }
  })

  it('⛔ LER é `stock.view`; CONVERTER é `stock.manage` — receita é decisão do dono (17/08)', () => {
    const fila = ler(ROTA_DA_FILA)
    expect(fila).toMatch(/guardStock\(request, companyId, 'stock\.view'\)/)

    const gesto = ler(ROTA_DO_GESTO)
    const get = gesto.slice(gesto.indexOf('export async function GET'), gesto.indexOf('export async function POST'))
    const post = gesto.slice(gesto.indexOf('export async function POST'))
    expect(get, 'o preview é LEITURA').toMatch(/'stock\.view'/)
    expect(post, 'converter é MANAGE: o operador produz e confere, não reescreve receita').toMatch(/'stock\.manage'/)
    // ⛔ e o preview NÃO pode exigir manage: "ler nunca exige gerenciar" (a régua do guard estrutural)
    expect(get).not.toMatch(/'stock\.manage'/)
  })

  it('⭐⭐ o gesto grava pela PORTA ÚNICA da ficha (que versiona), nunca por `create` próprio', () => {
    const lib = semComentario(ler('lib/stock/producao/aplicar-conversao.ts'))
    expect(lib, 'tem que chamar atualizarFicha — a porta que versiona').toContain('atualizarFicha(')
    /**
     * ⛔ Gravar `stockFichaVersao.create` aqui seria a SEGUNDA porta de gravação de receita, e
     * ela divergiria na primeira regra nova (foi assim que o `PAGAMENTO_EMPRESTIMO` do import
     * gravou sem split, 11/09). ⚠️ E `componente.createMany` também não: a porta já faz.
     */
    expect(lib).not.toMatch(/stockFichaVersao\.create|stockFichaComponente\.createMany/)
  })

  it('⭐ e a recusa do gesto chega ao dono com a FRASE (o tradutor único, 16/09)', () => {
    const gesto = semComentario(ler(ROTA_DO_GESTO))
    expect(gesto).toContain('respostaDeErroDoEstoque')
    // ⛔ e o ConversaoError está na lista FECHADA — senão a recusa mais importante
    // ("já foi convertida enquanto você decidia") vira 500 mudo
    expect(semComentario(ler('lib/stock/erro-da-tela.ts'))).toContain('ConversaoError')
  })
})
