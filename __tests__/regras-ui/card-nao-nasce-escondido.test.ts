// ⛔⛔⛔ PORTA SEM MAÇANETA — O MOTOR SUBIU E A TELA NÃO MUDOU (10/09/2026)
//
// **O dono, depois de um deploy 4/4 verde:** *"a TELA que eu vejo em /conciliacao NÃO
// mudou — continua a mensagem '16 pagamentos nomeiam um fornecedor que tem notas abertas,
// mas nenhuma combinação fecha na soma' com o visual antigo, sem os cards novos
// (checkboxes, conta viva, atalho ⭐, baixa parcial). Já recarreguei com cache limpo."*
//
// **O DIAGNÓSTICO DELE ESTAVA CERTO:** o `EscolherNaMaoCard` estava em prod, funcionando —
// e **inalcançável**. Três coisas escondiam:
//   1. a seção nascia **colapsada** (`useState(false)`) → ele via só a frase;
//   2. dentro dela, cada linha exigia um segundo clique ("escolher na mão");
//   3. o card renderizava **no RODAPÉ da página**, longe de onde ele clicou.
//
// ⭐ **A REGRA QUE FICA:** *componente que o dono precisa VER não pode nascer atrás de um
// booleano que começa `false`.* Motor que só liga por URL secreta ou clique escondido é
// motor que não subiu — e o deploy verde mente sobre isso, porque o teste de rota e o
// smoke não abrem a tela.
//
// ⚠️⚠️ E A 1ª CORREÇÃO FOI LONGE DEMAIS PRO OUTRO LADO: 16 cards ABERTOS, o mesmo
// fornecedor repetido 5× com as mesmas notas. **Colapsar por FORNECEDOR, com o nome e o
// valor no cabeçalho, é o desenho aprovado — e é OUTRA COISA:** ali o trabalho está
// visível e nomeado, e o clique abre o que ele escolheu. O que este guard proíbe é a
// seção que **esconde a existência** do trabalho atrás de uma frase.
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL: o projeto roda em `environment: node`,
// sem jsdom, então não dá pra renderizar e clicar. Ele lê a FONTE. Por isso tem
// **auto-teste do detector** (REGRA 11): sem ele, passaria verde por cegueira — que é
// exatamente como três guards desta casa já nasceram mentindo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const PAGINA = 'app/(dashboard)/conciliacao/page.tsx'
const fonte = readFileSync(join(raiz, PAGINA), 'utf-8')

/**
 * ⚠️ O QUE A TELA MOSTRA ≠ O QUE O ARQUIVO DIZ: comentário citando a frase antiga (como
 * este arquivo faz o tempo todo) não é texto na tela. A checagem roda sobre o código
 * SEM comentários, senão o guard morderia a própria documentação do defeito.
 */
export function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}
const renderizado = semComentarios(fonte)

/** os estados que NASCEM fechados — `const [x, setX] = useState(false)` */
export function estadosQueNascemFalse(src: string): string[] {
  return [...src.matchAll(/const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useState(?:<[^>]*>)?\(\s*false\s*\)/g)]
    .map((m) => m[1])
}

/** ⚠️ acha o fim de `(` … `)` contando parênteses a partir de um índice de abertura */
function fimDoParenteses(src: string, abre: number): number {
  let n = 0
  for (let i = abre; i < src.length; i++) {
    if (src[i] === '(') n++
    else if (src[i] === ')') { n--; if (n === 0) return i }
  }
  return src.length
}

/**
 * ⭐ O DETECTOR: a `tag` está renderizada DENTRO de um gate `{estado && (` ou
 * `{estado ? (` cujo estado nasce `false`? Devolve os estados culpados.
 */
export function gatesQueEscondem(src: string, tag: string): string[] {
  const culpados: string[] = []
  for (const estado of estadosQueNascemFalse(src)) {
    for (const forma of [`{${estado} && (`, `{${estado} ? (`]) {
      let de = src.indexOf(forma)
      while (de !== -1) {
        const abre = src.indexOf('(', de + forma.length - 1)
        const ate = fimDoParenteses(src, abre)
        if (src.slice(abre, ate).includes(tag)) culpados.push(estado)
        de = src.indexOf(forma, de + 1)
      }
    }
  }
  return [...new Set(culpados)]
}

describe('⛔⛔ /conciliacao — os cards do "escolher na mão" aparecem SEM clique escondido', () => {
  it('o card não nasce atrás de um estado que começa fechado', () => {
    expect(gatesQueEscondem(fonte, '<FilaEscolherNaMao')).toEqual([])
    // e dentro da fila, o card também não pode nascer atrás de um booleano fechado
    const filaSrc = readFileSync(join(raiz, 'components/conciliacao/fila-escolher-na-mao.tsx'), 'utf-8')
    expect(gatesQueEscondem(filaSrc, '<EscolherNaMaoCard')).toEqual([])
  })

  it('a página renderiza a fila de verdade (não só importa)', () => {
    /**
     * ⚠️ REAPONTADO EM 23/09, NÃO AFROUXADO — a régua é a mesma: ***o card que o dono
     * precisa VER não pode ficar inalcançável***. O que mudou é a CASA: com *"uma lista
     * só"*, o card de escolha deixou de ser uma seção e virou o **caso de uma linha da
     * caixa**, renderizado em `comoPainel` dentro do cartão ≍ dela.
     *
     * ⛔ E o guard ficou MAIS forte, não mais fraco: ele passou a exigir que o painel
     * exista E que a linha daquele card **entre na lista** — porque as 14 dela estão
     * categorizadas, e a régua antiga (`estacao === 'CAIXA'`) as excluía.
     */
    const caixa = readFileSync(join(raiz, 'components/conciliacao/caixa-de-entrada.tsx'), 'utf-8')
    expect(caixa, 'o card de escolha ficou sem casa — é a porta sem maçaneta de novo')
      .toMatch(/<EscolherNaMaoCard\s+comoPainel/)
    // ⛔ e a lista tem que CARREGAR a linha dele (caixa ∪ caso aberto)
    const rotaCaixa = readFileSync(join(raiz, 'app/api/conciliacao/caixa/route.ts'), 'utf-8')
    expect(rotaCaixa, 'a lista voltou a filtrar só a caixa — as 14 linhas somem')
      .toContain('linhasDaLista(')
  })

  // ⛔⛔ O CARD NÃO PODE VOLTAR A SER RENDERIZADO DIRETO NA PÁGINA: foi assim que
  // nasceram os 16 cards abertos, com o mesmo fornecedor repetido 5×. Quem decide o que
  // abre é a FILA — um grupo por vez, uma linha por vez.
  it('⛔ a página não renderiza card solto — quem abre é a fila agrupada', () => {
    expect(renderizado).not.toContain('<EscolherNaMaoCard')
  })

  it('⛔ a mensagem antiga MORREU — ela é o que o dono via no lugar dos cards', () => {
    expect(renderizado).not.toContain('nomeiam um fornecedor')
    expect(renderizado).not.toContain('nenhuma combinação fecha')
  })

  it('os cards vêm no CARREGAMENTO da tela, não sob demanda por linha', () => {
    // ⛔ `&extratoId=` na URL era a versão de uma-linha-por-vez, que só existia atrás
    // do segundo clique. A rota nem aceita mais o parâmetro.
    expect(fonte).not.toMatch(/escolher-na-mao\?[^`'"]*extratoId/)
    expect(fonte).toMatch(/escolher-na-mao\?empresaId=/)
  })

  it('a rota devolve a LISTA — o modo de uma linha só não sobreviveu sem chamador', () => {
    const rota = readFileSync(join(raiz, 'app/api/conciliacao/escolher-na-mao/route.ts'), 'utf-8')
    expect(rota).toContain('cards')
    expect(rota).not.toContain('extratoId: z.string()')
  })

  it('⛔ o vazio de festa não pode aparecer com trabalho na tela', () => {
    /**
     * ⚠️ REAPONTADO EM 23/09. A régua — ***a frase do vazio só sai quando NÃO há trabalho
     * visível*** — é a mesma; o vazio é que mudou de dono: quem sabe se há trabalho é a
     * LISTA, não a página.
     *
     * ⛔⛔ E ele pegou um bug que eu ACABEI de criar: com o filtro `⭐ prontos` ligado e
     * zero prontos, `visiveis.length === 0` e a caixa dizia *"tudo resolvido"* com **35
     * linhas esperando**. ***Ausência de resultado NESTE recorte não é ausência de
     * trabalho*** — a família do "erro disfarçado de vazio".
     */
    const caixa = readFileSync(join(raiz, 'components/conciliacao/caixa-de-entrada.tsx'), 'utf-8')
    expect(caixa, 'o vazio de festa voltou a sair com filtro ligado')
      .toContain("{visiveis.length === 0 && filtro === 'TUDO' && (")
    // ⭐ e o vazio DO FILTRO existe e DIZ quantas linhas a lista ainda tem
    expect(caixa).toContain("{visiveis.length === 0 && filtro !== 'TUDO' && (")
    expect(caixa).toContain('nada neste filtro')
  })
})

// ⭐⭐ REGRA 11 — O DETECTOR TEM QUE PEGAR O DEFEITO QUE MOTIVOU O GUARD.
// Sem isto ele passaria verde por cegueira: um regex que não casa nada sempre "aprova".
describe('o detector morde (auto-teste)', () => {
  const DEFEITO_REPOSTO = `
    const [naoFechamAberto, setNaoFechamAberto] = useState(false)
    return (
      <div>
        {naoFechamAberto && (
          <div>
            <EscolherNaMaoCard card={c} onFechar={() => f(null)} />
          </div>
        )}
      </div>
    )
  `
  const CONSERTADO = `
    const [naoFechamAberto, setNaoFechamAberto] = useState(false)
    return (
      <div>
        {cardsVisiveis.map((c) => (<EscolherNaMaoCard key={c.id} card={c} />))}
      </div>
    )
  `

  it('acusa quando o card volta pra trás do colapso', () => {
    expect(gatesQueEscondem(DEFEITO_REPOSTO, '<EscolherNaMaoCard')).toEqual(['naoFechamAberto'])
  })

  it('não acusa quando o card está na lista, com o mesmo estado vivo ao lado', () => {
    expect(gatesQueEscondem(CONSERTADO, '<EscolherNaMaoCard')).toEqual([])
  })

  it('não morde comentário que CITA a frase antiga (é documentação, não tela)', () => {
    expect(semComentarios('// diz "nomeiam um fornecedor"\nconst a = 1')).not.toContain('nomeiam')
    expect(semComentarios('const url = "https://x"')).toContain('https://x')
  })

  it('acha o estado que nasce fechado mesmo com tipo explícito', () => {
    expect(estadosQueNascemFalse('const [a, setA] = useState<boolean>(false)')).toEqual(['a'])
  })
})
