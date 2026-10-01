/**
 * ⛔⛔⛔ OS TRÊS BECOS DO DESFECHO (30/09/2026) — o guard da REGRA 11 que o dono ditou
 *
 * **As palavras dele:** *"gesto de desfecho sem confirmação = vermelho; arquivo
 * inescontrável = vermelho; categoria-com-ponte que não dispara = vermelho."*
 *
 * ⚠️ **Os três nasceram do MESMO par de cliques**, e a medição em prod conta a história:
 *
 * - **COOPERATIVA DE PAIS E MESTRES (−100,00, 30/09):** o dono escolheu *Distribuição de
 *   Lucros* no seletor, a ponte **não abriu**, ele clicou *«avulsa»* — e a avulsa **jogou a
 *   categoria escolhida no lixo**. Medido: `categoryId = null`, `avulsaConfirmada = true`,
 *   estação ARQUIVO. Ou seja: saiu da caixa **sem entrar em DRE nenhum**, e sem ponte.
 * - **RONE MESSA (−250,00, 29/09):** *"clique sem querer"* — e o gesto gravava no PRIMEIRO
 *   clique, sem confirmação.
 * - E nenhuma das duas estava em *"Já conciliadas"*, porque aquela lista filtra
 *   `reconciledWithId` e a avulsa **não tem vínculo**: ela era **inencontrável**.
 *
 * ⛔ Este guard é ESTRUTURAL e é assumido como tal (sem jsdom não dá pra clicar). Quem prova
 * o COMPORTAMENTO é `lib/conciliacao/__tests__/avulsa-pede-categoria.integration.test.ts`,
 * que roda os gestos contra o banco.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve
 *  (a lição do "menção, não uso", que já custou 7 guards nesta casa) */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const CAIXA_UI = semComentario(ler('components/conciliacao/caixa-de-entrada.tsx'))
const HISTORICO_UI = semComentario(ler('components/conciliacao/historico-table.tsx'))
const HISTORICO_ROTA = semComentario(ler('app/api/conciliacao/historico/route.ts'))
const RESOLVER = semComentario(ler('lib/conciliacao/resolver-linha.ts'))
const REGUA_CATEGORIA = semComentario(ler('lib/conciliacao/categoria-antes-do-gesto.ts'))
const FORM_TX = semComentario(ler('components/transacoes/transacao-form.tsx'))

describe('⛔⛔ 1. GESTO DE DESFECHO PEDE CONFIRMAÇÃO', () => {
  it('⛔⛔ a AVULSA não grava no primeiro clique — ela pergunta antes', () => {
    // o chip abre o freio; quem grava é o "confirmar"
    expect(CAIXA_UI).toContain('setConfirmandoAvulsa(true)')
    expect(CAIXA_UI).toMatch(/arquivar como avulsa\?/)
    /**
     * ⛔ E o `onGesto` da avulsa só pode estar DEPOIS do freio. O que morde é a ordem: se o
     * chip disparasse direto, o freio existiria no arquivo e não no caminho.
     */
    const iFreio = CAIXA_UI.indexOf('setConfirmandoAvulsa(true)')
    const iGrava = CAIXA_UI.indexOf("onGesto(l, a.acao, comCategoria())", CAIXA_UI.indexOf('AVULSA_CONFIRMADA'))
    expect(iFreio, 'o freio sumiu do caminho da avulsa').toBeGreaterThan(0)
    expect(iGrava, 'a avulsa parou de mandar a categoria').toBeGreaterThan(0)
  })

  it('⛔ e o EXCLUIR de lançamento também pergunta, com o motivo indo pro rastro', () => {
    expect(FORM_TX).toContain('Excluir este lançamento?')
    expect(FORM_TX).toContain('setConfirmandoExcluir(true)')
    expect(FORM_TX).toMatch(/motivo=\$\{encodeURIComponent/)
  })

  it('⛔⛔ e NENHUM dos dois usa `confirm()` nativo', () => {
    /**
     * ⚠️ O `confirm()` **falhou em silêncio no Safari** em fluxo async — duas vezes nesta
     * casa (22/08 na contagem, 23/09 no reprocessar do dia). Gesto de dinheiro não pode
     * depender de um diálogo que o browser pode engolir.
     */
    expect(CAIXA_UI, 'voltou o confirm() nativo na caixa').not.toMatch(/\bconfirm\(/)
    expect(FORM_TX, 'confirm() nativo no formulário de lançamento').not.toMatch(/\bconfirm\(/)
  })
})

describe('⛔⛔ 2. ARQUIVO INENCONTRÁVEL = VERMELHO', () => {
  it('⛔⛔ a rota do histórico devolve as AVULSAS — elas não têm vínculo, logo não entram no `where`', () => {
    /**
     * ⚠️ É o ponto exato do beco: `where: { reconciledWithId: { not: null } }` nunca
     * alcançaria a avulsa. A lista dela é uma consulta À PARTE, pela tabela da decisão.
     */
    expect(HISTORICO_ROTA).toContain('conciliacaoAvulsaConfirmada.findMany')
    expect(HISTORICO_ROTA).toMatch(/avulsas:\s*itensAvulsos/)
  })

  it('⛔ a TELA desenha a seção e oferece a VOLTA', () => {
    expect(HISTORICO_UI).toContain('Arquivadas como despesa avulsa')
    expect(HISTORICO_UI).toContain('trazer de volta')
    // ⭐ e a volta passa pela PORTA ÚNICA do balcão, nunca por uma rota nova
    expect(HISTORICO_UI).toMatch(/acao:\s*'DESFAZER_AVULSA'/)
    expect(HISTORICO_UI).toContain('/api/conciliacao/resolver')
  })

  it('⛔⛔ a tela MOSTRA quando a avulsa está sem categoria (era o furo do DRE)', () => {
    expect(HISTORICO_UI).toContain('sem categoria')
  })

  it('⭐ e o gesto de volta está no enum da ROTA — senão daria "Gesto inválido"', () => {
    /**
     * ⚠️ A cicatriz de 25/09: dois gestos novos ficaram MORTOS por dias porque o `z.enum` da
     * rota repetia a lista à mão. O enum é derivado, e a volta entra por `ACOES_DE_VOLTA`.
     */
    const ROTA = semComentario(ler('app/api/conciliacao/resolver/route.ts'))
    expect(ROTA).toContain('ACOES_ACEITAS')
    const CAIXA_LIB = semComentario(ler('lib/conciliacao/caixa-de-entrada.ts'))
    expect(CAIXA_LIB).toMatch(/ACOES_ACEITAS\s*=\s*\[\.\.\.TODAS_AS_ACOES,\s*\.\.\.ACOES_DE_VOLTA\]/)
    // ⛔ e a volta NÃO pode virar chip da fileira (não há o que desfazer na caixa)
    expect(CAIXA_LIB, 'o desfazer vazou pros chips do balcão').not.toMatch(
      /(SAIDA|ENTRADA)[\s\S]{0,2000}acao:\s*'DESFAZER_AVULSA'/,
    )
  })
})

describe('⛔⛔ 3. CATEGORIA-COM-PONTE QUE NÃO DISPARA = VERMELHO', () => {
  it('⛔⛔⛔ a consequência é decidida no SERVIDOR, não derivada na tela', () => {
    /**
     * ⚠️ Era `categorias.find(...)` + `conviteDaPonte(cat)` no cliente — e isso amarrava uma
     * CONSEQUÊNCIA DE DINHEIRO a duas coisas frágeis: a lista de categorias ter carregado
     * (`cargas.categorias` pode dizer FALHOU e a tela segue) e o `dreGroup` estar no payload.
     * Faltando qualquer uma, a retirada ficava **meia-ponte em silêncio**.
     */
    expect(RESOLVER).toContain('conviteDaPonte')
    expect(RESOLVER).toMatch(/tipo:\s*'PONTE_PJ_PF'/)
    expect(CAIXA_UI).toMatch(/consequencia/)
    expect(CAIXA_UI, 'a tela voltou a derivar o convite por conta própria').not.toMatch(
      /conviteDaPonte\(/,
    )
  })

  it('⛔ e ela é decidida UMA vez, envolvendo o switch — não dentro de um ramo', () => {
    /**
     * ⭐ São 12 gestos. Dentro de um ramo, o próximo que gravasse categoria nasceria sem
     * disparar a ponte — *"N caminhos, 1 esquecido"*, a doença que custou o gatilho de
     * vendas e o split do empréstimo.
     */
    /**
     * ⚠️⚠️ ESTE `expect` CAIU NA "MENÇÃO, NÃO USO" NA 1ª VERSÃO — dentro do meu próprio guard.
     * Eu procurava `tipo: 'PONTE_PJ_PF'` e o índice pegava a **declaração da interface**
     * `ResolverResultado`, que vem ANTES do wrapper. O que morde é a ATRIBUIÇÃO.
     */
    const iSwitch = RESOLVER.indexOf('executarGesto(input, db)')
    const iAtribuicao = RESOLVER.indexOf('consequencia: {', iSwitch)
    expect(iSwitch).toBeGreaterThan(0)
    expect(iAtribuicao, 'a consequência saiu do wrapper (ou foi pra dentro de um ramo)').toBeGreaterThan(iSwitch)
    // ⛔ e ela NÃO pode estar dentro do switch: o `case` mais próximo antes dela é o fim dele
    const trechoAntes = RESOLVER.slice(iSwitch, iAtribuicao)
    expect(trechoAntes, 'a consequência foi parar dentro de um ramo do switch').not.toMatch(/\n    case '/)
  })

  it('⛔ não oferece a ponte quando a linha JÁ tem ponte (seria a 2ª pro mesmo dinheiro)', () => {
    expect(RESOLVER).toMatch(/pJtoPFBridge\.findFirst/)
  })

  it('⛔⛔ e a AVULSA deixou de ser ESTRUTURAL: ela PEDE categoria', () => {
    /**
     * ⚠️ A premissa do comentário antigo era *"ela só existe depois de a linha já ter
     * categoria"* — **medido em prod: 1 de 1 avulsa estava SEM categoria**. O chip é
     * oferecido a qualquer linha da caixa, não só às de fornecedor já categorizadas.
     */
    const bloco = REGUA_CATEGORIA.slice(REGUA_CATEGORIA.indexOf('origemDaCategoria'))
    expect(bloco).toMatch(/case 'AVULSA_CONFIRMADA':\s*return 'ESCOLHER'/)
    expect(RESOLVER).toMatch(/AVULSA_CONFIRMADA[\s\S]{0,900}if \(!input\.categoryId\)/)
  })

  it('⭐ e o chip sem alvo passou a respeitar a régua — genérico, não caso a caso', () => {
    /**
     * ⛔ O ramo genérico fazia `onGesto(l, a.acao)` **sem a categoria**. Era por ele que a
     * avulsa saía. O gating sai de `origemDaCategoria`, então gesto novo que precise de
     * categoria nasce travado e mandando o campo.
     */
    expect(CAIXA_UI).toMatch(/origemDaCategoria\(a\.acao as AcaoDoBalcao\) === 'ESCOLHER'/)
    expect(CAIXA_UI).toMatch(/precisaCategoria \? comCategoria\(\) : undefined/)
  })
})

describe('⛔ 4. O TETO DE LEITURA DIZ O QUE NÃO ALCANÇOU', () => {
  it('⛔ a leitura devolve a cobertura e a tela imprime quando truncou', () => {
    /**
     * ⚠️ Medido em prod: **452 linhas no período, 400 lidas → 52 invisíveis**, e o contador
     * dizia *"400 no período"*. É a 4ª vez que um teto de leitura esconde linha nesta casa
     * (fermento 16/09 · ordem do ano 202 19/09 · recebimento 23/09). *Truncar em silêncio é
     * afirmar que se olhou tudo.*
     */
    const LEITURA = semComentario(ler('lib/conciliacao/leitura-da-caixa.ts'))
    expect(LEITURA).toMatch(/truncado:\s*totalNoPeriodo > rows\.length/)
    expect(CAIXA_UI).toMatch(/caixa\.cobertura\?\.truncado/)
    expect(CAIXA_UI).toContain('no período, a tela lê as')
  })
})

describe('⛔ o detector PEGA as formas antigas (auto-teste — senão passa por cegueira)', () => {
  it('⚠️ as formas EXATAS que o código tinha antes são detectadas', () => {
    const avulsaEstrutural = `    case 'AVULSA_CONFIRMADA':\n    case 'IGNORAR':\n      return 'ESTRUTURAL'`
    expect(avulsaEstrutural).not.toMatch(/case 'AVULSA_CONFIRMADA':\s*return 'ESCOLHER'/)

    const chipMudo = `<button key={a.acao} type="button" disabled={ocupado} onClick={() => onGesto(l, a.acao)} className={chip}>`
    expect(chipMudo).not.toMatch(/precisaCategoria \? comCategoria\(\) : undefined/)

    const telaDerivando = `const cat = categorias.find((x) => x.id === alvo.categoryId)\n      const convite = conviteDaPonte(cat)`
    expect(telaDerivando).toMatch(/conviteDaPonte\(/)
  })
})
