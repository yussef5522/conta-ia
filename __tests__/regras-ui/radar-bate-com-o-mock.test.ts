// ⭐⭐⭐ O RADAR BATE COM O MOCK — o guard que LÊ O ARQUIVO (20/09/2026).
//
// **A régua da casa:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido."*
// Enquanto o desenho viver na minha memória, *"igual ao mock"* é promessa; versionado, ele
// é DADO — e o teste aponta o token e o valor que o arquivo manda.
//
// ⚠️ Ele lê a TELA sem comentário: repondo o defeito num guard irmão (apagar a frase do
// JSX), a MENÇÃO no cabeçalho de documentação deixava o teste verde. *Guard que conta a
// menção aprova a tela que não imprime nada.*

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RADAR, TOM } from '@/components/estoque/radar-tokens'

const raiz = process.cwd()
const MOCK = readFileSync(join(raiz, 'docs/mocks/radar-do-estoque-mock.html'), 'utf-8')
const semComentario = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')
const TELA = semComentario(readFileSync(join(raiz, 'app/(dashboard)/empresas/[id]/estoque/radar/page.tsx'), 'utf-8'))
/**
 * ⚠️⚠️ **O MOTOR TAMBÉM É LIDO SEM COMENTÁRIO — e isso custou a REGRA 11 do v1.2.**
 * Repondo dois defeitos (a ressalva voltando a dizer "hoje"; os dias somindo do balde) o
 * guard ficou **VERDE**, porque as duas frases aparecem no **comentário de documentação**
 * logo acima do código. ***"Menção, não uso" pela QUARTA vez nesta casa*** (o
 * `acaoValePraSentido` 15/09, o `respostaDeErroDoEstoque` 16/09, o `hrefSemPagamento`
 * 20/09). O arquivo que documenta o próprio defeito não pode ser o que o absolve.
 */
const MOTOR = semComentario(readFileSync(join(raiz, 'lib/stock/radar/fechamento.ts'), 'utf-8'))
/** ⭐ o texto CRU, pra quando a pergunta é sobre o TIPO declarado (aí o comentário não atrapalha) */
const MOTOR_CRU = readFileSync(join(raiz, 'lib/stock/radar/fechamento.ts'), 'utf-8')

/**
 * ⭐ Lê a DECLARAÇÃO do token no `:root{}` — nunca "a cor aparece em algum lugar".
 *
 * ⚠️⚠️ E ele ancora no `<style>` por um motivo medido: a 1ª versão fazia
 * `MOCK.indexOf(':root{')` e casava a MENÇÃO `:root{}` **no comentário de documentação do
 * topo do arquivo** — os 15 tokens vinham `null` e o guard reprovava a tela CERTA. É a
 * mesma armadilha do "menção, não uso" que já mordeu três guards desta casa, agora do
 * lado do mock.
 */
function tokenDoMock(nome: string): string | null {
  const css = MOCK.slice(MOCK.indexOf('<style>'))
  const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')))
  const m = root.match(new RegExp(`--${nome}\\s*:\\s*([^;]+);`))
  return m ? m[1]!.trim() : null
}

describe('⭐ as CORES do Radar saem do :root{} do mock, ao caractere', () => {
  const pares: [keyof typeof RADAR, string][] = [
    ['bg', 'bg'], ['card', 'card'], ['ink', 'ink'], ['sub', 'sub'], ['line', 'line'],
    ['roxo', 'roxo'], ['roxoBg', 'roxo-bg'],
    ['verde', 'verde'], ['verdeBg', 'verde-bg'],
    ['coral', 'coral'], ['coralBg', 'coral-bg'],
    ['ambar', 'ambar'], ['ambarBg', 'ambar-bg'],
    // ⭐ o cinza do "falta contar" tem token PRÓPRIO — não é um verde pálido
    ['mudo', 'mudo'], ['mudoBg', 'mudo-bg'],
  ]
  for (const [nosso, deles] of pares) {
    it(`--${deles} == RADAR.${nosso}`, () => {
      expect(tokenDoMock(deles), `o mock declara --${deles}; o nosso token divergiu`).toBe(RADAR[nosso])
    })
  }

  it('⭐ a paleta é a MESMA do mock v3 da Conciliação — a casa tem UMA paleta', async () => {
    const { V3 } = await import('@/components/conciliacao/mock-v3-tokens')
    for (const k of ['bg', 'card', 'ink', 'sub', 'line', 'roxo', 'verde', 'coral', 'ambar'] as const) {
      expect(RADAR[k], `o Radar inventou um tom próprio pra "${k}"`).toBe(V3[k])
    }
  })
})

describe('⭐⭐ os TEXTOS que o mock imprime existem na tela', () => {
  const frases = [
    'Radar do estoque',
    'OS CAROS',
    'PORÇÕES',
    'DEVIA TER',
    'CONTAMOS',
    'falta contar hoje',
    'ver cada movimento',
    'não é fechamento contábil',
  ]
  for (const f of frases) {
    it(`"${f}" está no mock E na tela`, () => {
      expect(MOCK, 'a frase saiu do mock — reveja o guard').toContain(f)
      expect(TELA, `a tela não imprime "${f}"`).toContain(f)
    })
  }
})

describe('⛔⛔ as RÉGUAS DE HONESTIDADE do desenho, travadas', () => {
  it('⛔ "sem contagem" é ESTADO PRÓPRIO — o motor devolve null, nunca 0', () => {
    // ⚠️ o que morde não é a palavra: é o tipo. `faltouValor: number` deixaria o zero
    // entrar em silêncio, e zero afirmaria que bateu.
    expect(MOTOR_CRU).toContain('faltou: number | null')
    expect(MOTOR_CRU).toContain('faltouValor: number | null')
    expect(MOTOR, 'o veredito perdeu o estado próprio').toContain("'SEM_CONTAGEM'")
  })

  it('⛔ o dia sem contagem vai `null` pro gráfico — barra vazia, nunca zero', () => {
    expect(MOTOR_CRU).toContain('valor: number | null')
    expect(MOTOR).toMatch(/porDiaMap\.has\(d\) \? porDiaMap\.get\(d\)! : null/)
    // e o mock desenha a barra vazia tracejada, que é a leitura honesta disso
    expect(MOCK, 'o mock perdeu a barra vazia do dia sem contagem').toContain('.b.vazio')
  })

  it('⭐ a ORDEM é pelo DINHEIRO, e a régua mora no SERVIDOR', () => {
    expect(MOTOR).toContain('export function ordenarPorDinheiro')
    /**
     * ⛔ A tela não pode reordenar AS LINHAS — seria a segunda régua, e as duas divergiriam
     * no primeiro empate.
     * ⚠️ REAPONTADO em v1.2: a régua era `não existe .sort() na tela`, e ela ficou vermelha
     * com a tela CERTA — o `.sort()` novo acha o **pior DIA** da barra da semana, que não é
     * ordenar linha nenhuma. *Guard largo demais reprova o certo e ensina a afrouxar.*
     */
    expect(TELA, 'a tela voltou a ordenar as LINHAS por conta própria')
      .not.toMatch(/(caros|porcoes|linhas)\s*[.)]?\s*\.sort\(/)
  })

  it('⭐⭐ o rodapé honesto está nos DOIS — "aponta, não fecha"', () => {
    for (const fonte of [MOCK, TELA]) {
      expect(fonte).toContain('onde o dinheiro escapa')
      expect(fonte).toContain('não é fechamento contábil')
    }
  })

  it('⛔ o que está FORA das listas aparece nomeado — o placar não subestima calado', () => {
    expect(MOTOR).toContain('foraDasListasValor')
    expect(TELA, 'a tela parou de mostrar o que está fora das listas').toContain('foraDasListasItens')
  })
})

/**
 * ⭐⭐⭐ v1.1 — O QUE O SISTEMA SABE, ELE MOSTRA (20/09/2026).
 *
 * **A decisão do dono:** *"cada item mostra, na linha fechada, QUANTO O SISTEMA DIZ QUE TEM
 * AGORA"* e *"a conta de padeiro abre MESMO SEM CONTAGEM, com as duas últimas linhas como
 * «— falta contar»"*. ⛔ A variância continua exigindo contagem — o que mudou é a tela
 * parar de calar sobre o que ela já sabe.
 */
describe('⭐⭐ v1.1 — toda linha diz o saldo do sistema, e a conta abre sem contagem', () => {
  it('⛔ o mock mostra "no sistema:" em TODA linha das duas listas', () => {
    const blocos = MOCK.slice(MOCK.indexOf('OS CAROS'))
    const linhas = [...blocos.matchAll(/<span class="nm">([\s\S]*?)<\/span>/g)]
    expect(linhas.length, 'o mock perdeu as linhas dos blocos').toBeGreaterThan(8)
    for (const l of linhas) {
      expect(l[1], `uma linha do mock não diz o saldo do sistema: ${l[1]!.slice(0, 40)}`).toContain('no sistema:')
    }
  })

  it('⭐ e a TELA desenha o mesmo, da porta da Posição', () => {
    expect(TELA).toContain('no sistema:')
    expect(TELA).toContain('saldoSistema')
    expect(TELA).toContain('valorSistema')
    // ⛔ a fonte é a da Posição — segunda régua de saldo faria as duas telas divergirem
    expect(MOTOR).toContain('saldosDaEmpresa')
    expect(MOTOR, 'o Radar voltou a ter conta própria de saldo').not.toMatch(/groupBy[\s\S]{0,200}_sum:\s*\{\s*quantidade/)
  })

  it('⛔⛔ sem contagem a conta ABRE e diz "— falta contar" nas duas últimas', () => {
    expect(MOCK, 'o mock perdeu a conta que abre sem contagem').toContain('DEVE TER AGORA')
    expect(MOCK).toContain('— falta contar')
    expect(TELA).toContain('DEVE TER AGORA')
    expect(TELA).toContain('— falta contar')
    // ⛔ e o tipo continua impedindo o zero de entrar em silêncio
    expect(MOTOR_CRU).toContain('contamos: number | null')
  })

  it('⛔ a RESSALVA da baixa não deixa o número se passar por completo', () => {
    expect(MOTOR).toContain('ressalva')
    // ⚠️ REAPONTADO em v1.2: a frase ganhou a DATA ("o dia 20/09 ainda não tem baixa de
    // vendas") por ordem do dono — a pergunta do guard é a mesma, o texto é que mudou.
    expect(MOTOR).toContain('ainda não tem baixa de vendas')
    expect(TELA, 'a tela parou de desenhar a ressalva do balde').toContain('b.ressalva')
    expect(MOCK).toContain('ainda não tem baixa de vendas')
  })

  it('⭐ o placar sem contagem soma o SISTEMA em vez de um traço', () => {
    expect(MOTOR).toContain('valorNoSistema')
    expect(TELA).toContain('valorNoSistema')
    expect(TELA, 'o traço voltou — o placar sem contagem perdeu a utilidade')
      .not.toContain("'SEM_CONTAGEM' ? '—'")
  })
})

/**
 * ⭐⭐⭐ v1.2 — CLAREZA E VIDA NO DIA SEM CONTAGEM (20/09/2026).
 *
 * **A ordem do dono:** *"a linha «vendeu» NOMEIA os dias incluídos"*, *"cada linha «falta
 * contar» ganha o chip do ÚLTIMO VEREDITO com data e cor + mini-sparkline dos últimos 7
 * dias (ponto só em dia contado — dia sem contagem é LACUNA, nunca zero)"* e *"o placar
 * ganha a mini-barra da semana no celular também"*.
 *
 * ⛔ **E A HONESTIDADE NÃO MUDOU:** tudo que a tela ganhou de cor é HISTÓRIA MEDIDA. Nada
 * aqui é número do dia de hoje — `number | null` continua mandando.
 */
describe('⭐⭐ v1.2 — os dias NOMEADOS e a história verdadeira', () => {
  it('⭐ o balde carrega os DIAS que o formaram', () => {
    expect(MOTOR_CRU, 'o balde parou de declarar os dias').toContain('dias?: string[]')
    // ⛔ o que morde é o `dias` CHEGAR no objeto devolvido — declarar não basta
    expect(MOTOR, 'o balde parou de ENTREGAR os dias').toMatch(/\.\.\.\(dias\.length \? \{ dias \} : \{\}\)/)
    expect(TELA, 'a tela parou de escrever os dias do balde').toContain('b.dias')
    expect(MOCK).toContain('baixas de 18 e 19/09')
  })

  it('⛔⛔ a ressalva diz a DATA, nunca "hoje"', () => {
    // ⚠️ quem abre a tela amanhã de manhã lê "hoje" e entende outro dia
    expect(MOTOR).toContain('ainda não tem baixa de vendas')
    expect(MOTOR, 'a ressalva voltou a dizer "hoje", que é ambíguo no dia seguinte')
      .not.toMatch(/as vendas de \$\{.*'hoje'/)
    expect(MOCK).toMatch(/o dia \d{2}\/\d{2} ainda não tem baixa de vendas/)
  })

  it('⭐ a linha sem contagem carrega o ÚLTIMO VEREDITO, com data', () => {
    expect(MOTOR).toContain('ultimoVeredito')
    expect(MOTOR_CRU).toMatch(/ultimoVeredito: \{ dia: string; valor: number; veredito: Veredito \} \| null/)
    expect(TELA).toContain('<ChipDoUltimo')
    expect(MOCK, 'o mock perdeu o chip do último veredito').toContain('chip-ult')
  })

  it('⛔⛔ a sparkline tem LACUNA no dia sem contagem — nunca ponto em zero', () => {
    // ⭐ o tipo é quem garante: `valor: number | null` no histórico
    expect(MOTOR_CRU).toContain('historico: { dia: string; valor: number | null }[]')
    expect(MOTOR).toMatch(/historiaPorItem\.get\(itemId\)\?\.get\(d\) \?\? null/)
    // ⛔ e a TELA pula o segmento quando um dos vizinhos não foi medido
    expect(TELA).toMatch(/if \(a\.valor == null \|\| b\.valor == null\) continue/)
    expect(TELA, 'a sparkline voltou a desenhar ponto em dia sem contagem')
      .toMatch(/p\.valor == null \? null :/)
  })

  it('⭐ o placar tem a barra da semana — e ela é UMA composição (REGRA 12)', () => {
    expect(TELA).toContain('<BarraDaSemana')
    expect(MOCK, 'o mock perdeu a barra da semana no celular').toContain('class="semana"')
    // ⛔ dia sem contagem é barra VAZIA tracejada, a mesma régua do resto
    expect(TELA).toMatch(/border: `1px dashed \$\{RADAR\.line\}`/)
    expect(MOCK).toContain('i.vazio')
  })

  it('⛔ e a semana sai do histórico que a tela JÁ tem — sem 2ª consulta', () => {
    // ⚠️ uma query a mais por causa de uma barrinha é como o badge virou 1,3s (11/09)
    expect(TELA).toMatch(/const semana = useMemo/)
    expect(TELA).toContain('l.historico[i]?.valor')
  })
})

describe('⛔⛔ TELA NOVA NASCE COM O GUARD (a lição da lixeira, 20/09)', () => {
  /**
   * ⚠️⚠️ **REGRA 11 REPROVOU A 1ª VERSÃO DESTE TESTE.** Ela tinha um detector PRÓPRIO de
   * `fetch` cru (`not.toMatch(/[^m]\bfetch\(/)`) — e o defeito reposto passou **verde**,
   * porque a forma que eu escrevi não casava o regex. ⭐ A cura não é um regex melhor: o
   * detector do `fetch*` **já tem dono** (`__tests__/regras-react/spinner-eterno-nao-existe`),
   * que varre o app INTEIRO e já mordeu três vezes por causa de regex frouxo. *Um detector,
   * um lugar* — aqui fica só a afirmação positiva, específica do Radar.
   */
  it('⭐ usa fetchComTimeout (e o detector do fetch cru mora no guard de família)', () => {
    expect(TELA).toContain('fetchComTimeout')
  })

  it('⭐ os estados são EXPLÍCITOS — carregando ≠ falhou ≠ ok', () => {
    expect(TELA).toContain("type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'")
    expect(TELA).toContain("estado === 'CARREGANDO'")
    expect(TELA).toContain("estado === 'FALHOU'")
  })

  it('⛔ e a falha SEMPRE oferece "tentar de novo"', () => {
    expect(TELA).toContain('tentar de novo')
  })

  it('⭐ REGRA 12: empilha no celular pela MESMA medida da casa (900px)', () => {
    expect(TELA).toContain('min-[900px]:grid-cols-2')
  })
})

describe('⭐ TEMA CLARO — a decisão do dono (20/09)', () => {
  it('⛔ a TELA não usa prefers-color-scheme: o app inteiro é claro hoje', () => {
    // *"nada de prefers-color-scheme sozinho — duas metades do sistema com temas
    // diferentes, não."* Ligar o dark global é sprint próprio, com os 107 arquivos.
    expect(TELA).not.toContain('prefers-color-scheme')
    const tokens = readFileSync(join(raiz, 'components/estoque/radar-tokens.ts'), 'utf-8')
    expect(tokens).not.toContain('prefers-color-scheme')
  })

  it('⭐ mas o MOCK guarda os dois temas versionados — a dívida fica desenhada', () => {
    expect(MOCK, 'o mock perdeu o tema escuro que o dono mandou guardar').toContain('prefers-color-scheme: dark')
    expect(MOCK).toContain('data-tema="escuro"')
  })
})

describe('⭐ o semáforo tem um tom por veredito', () => {
  it('cada estado do motor tem cor declarada — nenhum cai num default mudo', () => {
    for (const v of ['FALTOU_GRANDE', 'FALTOU_PEQUENO', 'SOBROU', 'BATEU', 'SEM_CONTAGEM']) {
      expect(TOM[v], `o veredito ${v} não tem cor`).toBeTruthy()
    }
    // ⛔ "falta contar" NÃO pode usar o verde do "bateu" — são coisas diferentes
    expect(TOM.SEM_CONTAGEM!.cor).not.toBe(TOM.BATEU!.cor)
  })
})
