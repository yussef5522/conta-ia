/**
 * ⛔⛔⛔ O GUARD DA DECISÃO: **RENDIMENTO MEDIDO NÃO ENTRA NA CONTA DA SEPARAÇÃO** (03/10/2026).
 *
 * **Ordem do dono, e o guard que ele pediu junto:** *"rendimento medido aparecendo em QUALQUER
 * conta de separação = vermelho"*.
 *
 * ⭐⭐ **POR QUE UM GUARD ESTRUTURAL, e não só os testes de comportamento:** o pin do par prova
 * que HOJE a conta está certa. Ele **não impede** alguém (eu, em três meses, "melhorando a
 * previsão") de reintroduzir `pedido ÷ rendimentoMedio` numa tela nova. E o estrago dessa
 * reintrodução é **invisível**: a separação sai plausível, só menor — foi exatamente assim que
 * a ordem de 10 beef de xis passou dias separando pra 6,7 sem ninguém ver.
 *
 * ⛔ **A 1ª camada é o TIPO** (`escala-da-ordem.ts` não tem campo de rendimento, REGRA 5).
 * Esta é a 2ª.
 *
 * ⚠️⚠️ **A 1ª VERSÃO DESTE GUARD DEIXOU PASSAR O CASO QUE MAIS IMPORTA — a REGRA 11 pegou.**
 * Eu procurava o rendimento ADJACENTE ao operador (`/\s*rendimento\w*`), e a reposição real
 * foi `alvo / (ficha.rendimentoMedio ?? ficha.loteBase)`: o parêntese no meio fez o guard
 * passar **VERDE** com o defeito de volta na tela de criar ordem. *Guard que não pega a forma
 * que já quebrou é uma afirmação sobre o mundo bom.*
 *
 * ⭐ **A régua nova não procura o rendimento — procura QUEM CALCULA ESCALA.** Fora da porta,
 * ninguém divide pra achar escala: a divisão existe num lugar só, e lá ela é por `loteBase`.
 * Isso é imune à forma do identificador (`rend.medido`, `mediana(...)`, `x ?? y`) porque não
 * depende de adivinhar o nome do veneno.
 *
 * ⚠️ E ele distingue **CONTA** de **ESPELHO**, senão mataria o item 1 do próprio dono: mostrar
 * *"seus últimos 27 lotes renderam 125%"* na tela é o que ele PEDIU.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()

/** ⚠️ sem comentário: o arquivo que DOCUMENTA a regra não pode ser o que a viola */
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** ⭐ A PORTA — o único lugar do sistema autorizado a dividir pra achar escala. */
const A_PORTA = 'lib/stock/producao/escala-da-ordem.ts'

/**
 * ⭐ OS ARQUIVOS QUE DECIDEM SEPARAÇÃO — o caminho do "quero N" até o `escalaReceitas` gravado.
 *
 * ⚠️ A lista é EXPLÍCITA de propósito. Varrer `lib/stock` inteiro acusaria `conclusao.ts` e
 * `custo-teorico.ts`, que usam rendimento legitimamente (o custo por unidade É "quanto custou
 * de verdade"); e varrer `app/` inteiro acusaria relatório. **Alarme falso no dia 1 é como um
 * guard morre.**
 */
const FORA_DA_PORTA = [
  'lib/stock/producao/escala-do-pedido.ts',
  'lib/stock/producao/ordens.ts',
  'lib/stock/producao/sugestao-cardapio.ts',
  /**
   * ⭐ ENTROU EM 04/10 com o assistente de conversão KG→UN: ele mostra a separação **ANTES ×
   * DEPOIS** pro dono decidir, então ele calcula separação — e tem que calcular pela PORTA.
   * Se ele fizesse `dose × pedido` por conta própria, o preview prometeria um material que a
   * ordem não vai separar, e o dono descobriria com a carne na mão.
   */
  'lib/stock/producao/preview-da-conversao.ts',
  /**
   * ⭐ ENTROU em 04/10 com o item 2: ele monta a lista *"o que vai sair da câmara"* que a tela
   * mostra ANTES de criar a ordem. Se calculasse por conta própria, a tela prometeria um
   * material e a ordem separaria outro.
   */
  'lib/stock/producao/lista-da-separacao.ts',
  'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx',
]
const CAMINHO_DA_SEPARACAO = [A_PORTA, ...FORA_DA_PORTA]

/** atribuição a um nome que É uma quantidade de separação */
const ATRIBUI_ESCALA =
  /(?:const|let|var)\s+(?:esc|escala[A-Za-z]*|insumo[A-Za-z]*|qtdSeparada)\s*=|^[ \t]*(?:esc|escala[A-Za-z]*|insumo[A-Za-z]*)\s*=[^=]/

/**
 * ⭐ divisão cujo DENOMINADOR menciona a medição — tolera parêntese, cadeia de propriedade e
 * `?.`, que foi exatamente o que furou a 1ª versão. Pega também o campo `medido` da régua
 * (`alvo / rend.medido`), que nenhum regex por "rendimento" alcançaria.
 */
const DIVIDE_POR_MEDICAO =
  /\/\s*\(?\s*(?:[\w$]+\s*(?:\?\.|\.)\s*)*(?:rendimento\w*|medido|mediana\w*)\b/i

/** as funções que foram APAGADAS em 03/10 porque dividiam o pedido pela medição */
const APAGADAS = ['insumoParaSaida', 'escalaParaSaida', 'reguaDoRendimento']

function arquivosTs(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(join(raiz, dir))) {
    if (e === 'node_modules' || e === '__tests__' || e.startsWith('.')) continue
    const rel = `${dir}/${e}`
    if (statSync(join(raiz, rel)).isDirectory()) out.push(...arquivosTs(rel))
    else if (/\.tsx?$/.test(e)) out.push(rel)
  }
  return out
}
const linhasDe = (rel: string) => semComentario(readFileSync(join(raiz, rel), 'utf-8')).split('\n')

describe('⛔⛔⛔ fora da PORTA, ninguém calcula escala', () => {
  it('⭐⭐ nenhuma linha fora da porta divide pra achar escala', () => {
    /**
     * ⛔ É a régua central: `escalaDoPedido`/`insumoDoPedido` são a única conversão. Quem
     * precisa de escala CHAMA a porta — não escreve a própria divisão, qualquer que seja o
     * denominador. Assim a trava vale até pra uma reintrodução que não mencione rendimento
     * nenhum (`alvo / fator`, `alvo / media`, `alvo / x`).
     */
    const achados: string[] = []
    for (const rel of FORA_DA_PORTA) {
      linhasDe(rel).forEach((linha, i) => {
        if (ATRIBUI_ESCALA.test(linha) && linha.includes('/')) {
          achados.push(`${rel}:${i + 1} → divide pra achar escala  «${linha.trim().slice(0, 100)}»`)
        }
      })
    }
    expect(
      achados,
      'DECISÃO DO DONO (03/10/2026): a separação é SEMPRE ficha × pedido.\n' +
        `Chame escalaDoPedido()/insumoDoPedido() de ${A_PORTA} em vez de dividir aqui.\n` +
        `Achados:\n  ${achados.join('\n  ')}`,
    ).toEqual([])
  })

  it('⭐⭐ nenhuma divisão do caminho tem a MEDIÇÃO no denominador', () => {
    /**
     * ⚠️ Esta é a 2ª rede, e ela existe pra cobrir o que a 1ª não vê: uma divisão espalhada
     * em **duas linhas** (a atribuição numa, o denominador na seguinte). Ela não depende de
     * atribuição nenhuma — só da forma da divisão.
     */
    const achados: string[] = []
    for (const rel of CAMINHO_DA_SEPARACAO) {
      linhasDe(rel).forEach((linha, i) => {
        if (DIVIDE_POR_MEDICAO.test(linha)) {
          achados.push(`${rel}:${i + 1} → divide pela medição  «${linha.trim().slice(0, 100)}»`)
        }
      })
    }
    expect(achados, `o rendimento medido é ESPELHO, nunca denominador:\n  ${achados.join('\n  ')}`).toEqual([])
  })

  it('⭐⭐ e DENTRO da porta, a única divisão é por `loteBase`', () => {
    /**
     * ⭐ A porta tem permissão de dividir — e é obrigada a dividir pelo que a FICHA declara.
     * Sem isto, bastaria trocar o denominador lá dentro pra o sistema inteiro voltar a
     * adaptar a separação, com todos os outros guards verdes.
     */
    const divisoes = linhasDe(A_PORTA)
      .map((l, i) => ({ l: l.trim(), n: i + 1 }))
      .filter((x) => /[\w$)\]]\s*\/\s*[\w$(]/.test(x.l) && !x.l.startsWith('const round4'))
    expect(divisoes.length, 'a porta deveria ter ao menos uma divisão (pedido ÷ loteBase)').toBeGreaterThan(0)
    for (const d of divisoes) {
      expect(d.l, `${A_PORTA}:${d.n} divide por algo que não é loteBase`).toMatch(/\/\s*p?\.?loteBase\b/)
    }
  })

  it('⛔⛔ as funções apagadas NÃO VOLTAM — nem exportadas, nem usadas em lugar nenhum', () => {
    /**
     * ⭐ Elas foram APAGADAS, não deixadas sem chamador: *função sem chamador é função que
     * alguém religa por descuido*. Varredura de `lib/` e `app/` inteiros — aqui a varredura
     * larga é segura, porque os nomes são específicos deste defeito.
     */
    const ressuscitadas: string[] = []
    for (const rel of [...arquivosTs('lib'), ...arquivosTs('app')]) {
      const src = semComentario(readFileSync(join(raiz, rel), 'utf-8'))
      for (const nome of APAGADAS) {
        if (new RegExp(`\\b${nome}\\b`).test(src)) ressuscitadas.push(`${rel} → ${nome}`)
      }
    }
    expect(
      ressuscitadas,
      'apagadas em 03/10 porque dividiam o pedido pelo rendimento medido.\n' +
        `Reintroduzi-las reabre o defeito do beef de xis:\n  ${ressuscitadas.join('\n  ')}`,
    ).toEqual([])
  })

  it('⛔ e a MEDIANA não aparece no caminho da separação (foi a 1ª cura, recusada)', () => {
    /** ⚠️ Ela segue viva em `conclusao.ts` — é a tendência central do ESPELHO, e isso ficou. */
    for (const rel of CAMINHO_DA_SEPARACAO) {
      expect(semComentario(readFileSync(join(raiz, rel), 'utf-8')), rel).not.toMatch(/\bmedianaDosRendimentos\b/)
    }
  })
})

describe('⭐⭐ AUTO-TESTE DOS DETECTORES — as formas que JÁ quebraram', () => {
  it('⛔⛔ pega a reposição REAL que furou a 1ª versão do guard', () => {
    const forma = 'const esc = alvo / (ficha.rendimentoMedio ?? ficha.loteBase)'
    expect(ATRIBUI_ESCALA.test(forma) && forma.includes('/')).toBe(true) // 1ª rede
    expect(DIVIDE_POR_MEDICAO.test(forma)).toBe(true)                    // 2ª rede
  })

  it('⛔ pega a SEGUNDA porta (min/máx), que gravava escala torta sem passar por tela', () => {
    const forma = 'const escalaSugerida = round2(faltam / rendimentoMedio)'
    expect(ATRIBUI_ESCALA.test(forma) && forma.includes('/')).toBe(true)
    expect(DIVIDE_POR_MEDICAO.test(forma)).toBe(true)
  })

  it('⭐ pega formas que NENHUM regex por "rendimento" alcançaria', () => {
    // o campo `medido` da régua, sem a palavra rendimento em lugar nenhum
    expect(DIVIDE_POR_MEDICAO.test('const q = alvo / rend.medido')).toBe(true)
    expect(DIVIDE_POR_MEDICAO.test('const q = alvo / (r?.medido ?? 1)')).toBe(true)
    expect(DIVIDE_POR_MEDICAO.test('const e = pedido / medianaDosRendimentos(xs)')).toBe(true)
    // ⭐ e pega até a divisão por um fator que não se chama nada disso (1ª rede)
    const neutro = 'const escala = alvo / fator'
    expect(ATRIBUI_ESCALA.test(neutro) && neutro.includes('/')).toBe(true)
  })

  it('⭐ e NÃO morde o ESPELHO, que é o que o dono pediu pra aparecer', () => {
    const ok = [
      'const espelho = eficienciaMedia({ teorico: ficha.loteBase, medido: ficha.rendimentoMedio, lotes: n })',
      "valor={painel.rendimentoPeriodo == null ? 'a apurar' : `${Math.round(painel.rendimentoPeriodo * 100)}%`}",
      'const rend = { teorico: loteBase, medido: rendimentoMedio, lotes: rendimentoLotes }',
      'interface FichaOpt { loteBase: number; rendimentoMedio: number | null }',
      'const ef = eficienciaDaOrdem({ escala, loteBase, qtdGerada, componentes })',
      'out.push({ fichaId, faltam, escalaSugerida, rendimentoMedio })',
      'const esc = escalaDoPedido({ pedido: alvo, loteBase: ficha.loteBase })',
    ]
    for (const linha of ok) {
      expect(ATRIBUI_ESCALA.test(linha) && linha.includes('/'), linha).toBe(false)
      expect(DIVIDE_POR_MEDICAO.test(linha), linha).toBe(false)
    }
  })

  it('⚠️ a lista de arquivos do caminho EXISTE de verdade (não envelhece calada)', () => {
    for (const rel of CAMINHO_DA_SEPARACAO) {
      expect(() => statSync(join(raiz, rel)), `${rel} está na lista e não existe mais`).not.toThrow()
    }
  })
})

/**
 * ═══ ⭐⭐⭐ A FRONTEIRA DO ASSISTENTE DE CONVERSÃO (04/10/2026) ═══
 *
 * ⚠️⚠️ **ESTE BLOCO EXISTE PORQUE O ASSISTENTE PARECE VIOLAR A DECISÃO E NÃO VIOLA — e alguém
 * (eu, em três meses) vai olhar `sugestoesDaConversao` devolvendo o MEDIDO e achar que achou um
 * bug.** A régua do dono tem QUATRO itens, e o 4º é o que autoriza isto:
 *
 * > *"Se um dia eu quiser declarar perda (ex. acém limpo = 95% do cru), **EU mudo a ficha** ou o
 * > campo declarado — nunca o sistema sozinho pela medição."*
 *
 * ⭐ **A distinção é QUEM e QUANDO:**
 * - ⛔ **PROIBIDO**: o medido dividir o pedido **na hora da separação** (o laço que aprende o
 *   roubo — a ordem de 10 beef separando pra 6,7).
 * - ⭐ **AUTORIZADO**: o medido ser **SUGERIDO** ao dono, ele **CONFIRMAR**, e aquilo virar uma
 *   **VERSÃO NOVA DA FICHA**. Daí em diante a separação é ficha × pedido como sempre — a
 *   medição não está mais na conta, está no documento que o dono assinou.
 *
 * ⛔ As duas travas que fazem isso ser verdade, e não intenção:
 */
describe('⭐⭐ o assistente de conversão SUGERE o medido — e nada converte sozinho', () => {
  const CONVERSOR = 'lib/stock/producao/converter-lote.ts'

  it('⛔ o CONVERSOR não lê rendimento de ninguém: ele RECEBE o número que o dono confirmou', () => {
    /**
     * ⭐ É a REGRA 5 aplicada aqui: enquanto `converterLote` só aceitar um `number` por
     * parâmetro, é **impossível** ele se auto-alimentar da medição. Se alguém importar um leitor
     * de rendimento neste arquivo, o passo "o dono confirma" deixa de existir sem ninguém ver.
     */
    const src = readFileSync(join(raiz, CONVERSOR), 'utf8')
    const imports = src.match(/^import[\s\S]*?from\s+'[^']+'/gm) ?? []
    expect(
      imports,
      'converter-lote.ts tem que ser PURO: sem import, ele não pode buscar o rendimento sozinho.\n' +
        'O medido chega como SUGESTÃO (sugestoesDaConversao) e só vira ficha depois do clique do dono.',
    ).toEqual([])
  })

  it('⛔ e a conversão NUNCA é a resposta automática da sugestão: quem escolhe é o dono', () => {
    /**
     * ⚠️ A trava é de FORMA: `sugestoesDaConversao` devolve candidatas e, no máximo, uma
     * `recomendada` — ela **não chama** `converterLote` em lugar nenhum. Se um dia chamar, o
     * assistente passa a converter pela medição, que é exatamente a decisão que o dono revogou.
     */
    const limpo = semComentario(readFileSync(join(raiz, CONVERSOR), 'utf8'))
    const corpoDaSugestao = limpo.slice(limpo.indexOf('export function sugestoesDaConversao'))
    expect(
      corpoDaSugestao.includes('converterLote('),
      'sugestoesDaConversao() não pode converter: ela SUGERE. Converter é gesto do dono.',
    ).toBe(false)
  })

  it('⭐ e o preview da conversão segue separando pela PORTA (a amarra que importa)', () => {
    const limpo = semComentario(readFileSync(join(raiz, 'lib/stock/producao/preview-da-conversao.ts'), 'utf8'))
    // ⛔ as duas pontas (antes e depois) pela mesma função — nunca `dose * pedido` à mão
    expect((limpo.match(/insumoDoPedido\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(limpo).toMatch(/from\s+'\.\/escala-da-ordem'/)
  })
})
