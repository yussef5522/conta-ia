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
 *
 * ═══ ⚠️⚠️ REAPONTADO EM 11/10 — A MAÇANETA MUDOU DE CASA (item 4 do dono) ═══
 *
 * A tela-fila *"Corrigir o lote"* foi **APOSENTADA**: as neutras a auto-conversão resolve
 * sozinha, e o que sobra é decisão, que se resolve **NA FICHA**. Então a maçaneta deixou de ser
 * um link pra uma tela separada e passou a ser:
 *   (a) o **chip NA LINHA** da lista de receitas (*"rendimento a declarar"* → a ficha com o
 *       campo aceso) — *a fila morreu porque a LISTA é a fila*;
 *   (b) o **aviso no sininho**, um por ficha, com o mesmo destino;
 *   (c) o **aviso da ORDEM**, que continua oferecendo a saída — agora a ficha, não a fila.
 *
 * ⭐ **A PERGUNTA DO GUARD NÃO MUDOU:** *o aviso que diz o problema tem que oferecer a saída, e
 * o gesto tem que ser alcançável pelo dedo no celular.* O que mudou é o endereço da saída. E ele
 * ficou **MAIS FORTE**: passou a exigir que a rota legada **redirecione** (link velho não vira
 * 404 silencioso) e que a tela-fila **não ressuscite**.
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
/**
 * ⚠️⚠️ REAPONTADO EM 11/10 — **o AVISO mudou de tela COM o número.**
 *
 * O `avisosDaEscala` nasceu no ATO DA CRIAÇÃO (03/10), porque a quantidade era digitada lá. Com
 * a pergunta única indo pra página da ordem, o aviso foi junto: *o aviso vive onde o número é
 * digitado* — deixá-lo na criação (que não pergunta mais quantidade) o tornaria inalcançável, e
 * aí a maçaneta que este arquivo existe pra garantir estaria pendurada no nada.
 *
 * ⭐ A PERGUNTA do guard não mudou: *o aviso que diz o problema tem que oferecer a saída*.
 */
const TELA_DA_ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'
const ROTA_DA_FILA = 'app/api/empresas/[id]/estoque/fichas/conversao/route.ts'
const ROTA_DO_GESTO = 'app/api/empresas/[id]/estoque/fichas/[fichaId]/conversao/route.ts'

describe('⭐⭐ a maçaneta existe — nos dois pontos que o dono pediu', () => {
  it('⭐ a tela da varredura EXISTE', () => {
    expect(() => statSync(join(raiz, TELA_DA_VARREDURA))).not.toThrow()
  })

  it('⭐⭐ o AVISO DA ORDEM carrega o gesto (era ele que dizia o problema sem a saída)', () => {
    const tela = semComentario(ler(TELA_DA_ORDEM))
    // ⭐ o destino agora é a FICHA, com o campo do rendimento aceso (11/10)
    expect(tela, 'o aviso LOTE_NAO_COMPARAVEL tem que oferecer o caminho').toContain('foco=rendimento')
    expect(tela, 'e o caminho de VOLTA pra ordem — senão o dono se perde no meio do gesto').toContain('voltar=')
    // ⛔ e os dois lados: ele SAIU da criação junto com o campo de quantidade
    expect(semComentario(ler(TELA_DA_PRODUCAO)), 'o aviso voltou pra criação, que não pergunta mais quantidade')
      .not.toContain('foco=rendimento')
    /**
     * ⚠️ E o atalho é CONDICIONAL ao motivo certo: o `MEDIA_DESTOA` não se resolve convertendo
     * lote nenhum, e oferecer ali mandaria o dono pro lugar errado (a lição de 16/09 —
     * *mensagem que acusa o campo errado faz o dono caçar um erro que não existe*).
     */
    expect(tela).toMatch(/motivo === 'LOTE_NAO_COMPARAVEL'/)
  })

  it('⭐⭐ a tela das RECEITAS leva à ficha NA LINHA (a fila virou a linha)', () => {
    const tela = semComentario(ler(TELA_DAS_RECEITAS))
    /**
     * ⛔⛔ A régua de 12/09 continua: *fila zerada esconde o TRABALHO, nunca a FERRAMENTA*. A
     * ferramenta não sumiu — ela mudou de casa pro editor da ficha, e **toda linha desta lista
     * já leva pra lá**. O que é condicional é a MARCA da pendência (o chip), que é trabalho;
     * e isso é o certo: chip zerado em toda linha treina o dono a não olhar o chip.
     */
    /**
     * ⚠️⚠️ **A REGRA 11 REPROVOU A 1ª VERSÃO (11/10):** ela fazia `toContain('foco=rendimento')`
     * no arquivo. Troquei o gate do chip por `{false && (` e o teste ficou **VERDE** — o `<a>`
     * continuava no arquivo, dentro de um ramo morto. ⭐ O que morde é olhar **o que vem
     * imediatamente antes da TAG** (estrutura, nunca distância — a janela de caracteres já
     * enganou 7 vezes aqui).
     */
    const iTagChip = tela.search(/<a\b[^>]*foco=rendimento/)
    expect(iTagChip, 'nenhum <a> leva à ficha com o campo aceso').toBeGreaterThan(-1)
    const antes = tela.slice(Math.max(0, iTagChip - 120), iTagChip)
    expect(
      /\{esperam\[f\.id\]\s*&&/.test(antes),
      'o chip tem que ser gateado pela pendência DAQUELA ficha — nem solto, nem em ramo morto',
    ).toBe(true)
    expect(tela, 'e com o caminho de volta pra lista').toContain('voltar=')

    // ⛔ a tela-fila NÃO pode voltar a ser destino de link nenhum
    expect(tela, 'a tela-fila foi aposentada — nenhuma tela aponta pra ela').not.toMatch(/<a\b[\s\S]*?estoque\/fichas\/conversao/)

    /**
     * ⭐ E a LEITURA dela continua viva: a rota `/fichas/conversao` é quem diz QUAIS fichas
     * esperam o rendimento. Apagar a leitura junto com a tela deixaria a lista sem como marcar
     * a pendência — e aí a fila teria morrido levando o trabalho com ela.
     */
    expect(tela).toContain('estoque/fichas/conversao')
    expect(tela).toContain('esperamRendimento')
  })

  /**
   * ⛔⛔⛔ A ROTA LEGADA REDIRECIONA — link velho não vira 404 silencioso (a régua de 15/09).
   *
   * ⚠️ E ela redireciona **pro destino que o link antigo de fato queria**: com `?ficha=`, pra
   * aquela ficha com o campo aceso. Mandar todo mundo pra uma lista genérica faria o dono
   * procurar de novo o que o link já sabia (o defeito do Bamberg, 13/09).
   */
  it('⭐⭐ a tela-fila aposentada REDIRECIONA, e diz que é legada', () => {
    const tela = ler(TELA_DA_VARREDURA)
    expect(tela, 'a rota aposentada tem que registrar que é legada').toMatch(/ROTA LEGADA|APOSENTADA/)
    const semCom = semComentario(tela)
    expect(semCom).toMatch(/router\.replace/)
    expect(semCom, 'com ?ficha= leva À FICHA, com o campo aceso').toContain('foco=rendimento')
    // ⛔ e ela não pode voltar a LISTAR: a segunda vitrine é o que morreu
    expect(semCom, 'a tela-fila ressuscitou — ela não pode listar pendentes de novo')
      .not.toMatch(/pendentes\.map|sugestoes/)
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
    for (const rel of [TELA_DAS_RECEITAS, TELA_DA_ORDEM]) {
      const tela = semComentario(ler(rel))
      // ⭐ só as ocorrências que são DESTINO de link, não a URL do fetch
      /**
       * ⚠️ `[^}]*` NÃO serve pro href: o template da casa é `` {`/empresas/${id}/...`} `` e o
       * `}` do `${id}` fecha a classe cedo. O que delimita a tag é o PRIMEIRO `>`.
       */
      const links = [...tela.matchAll(/<a\b[\s\S]*?>/g)].filter((m) => m[0].includes('foco=rendimento'))
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
