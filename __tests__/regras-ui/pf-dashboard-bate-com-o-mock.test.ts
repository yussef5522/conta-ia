// ⛔⛔⛔ O MOCK DO DASHBOARD PF É A RÉGUA (13/09/2026)
//
// **O dono:** *"copia pra docs/mocks/ e versiona com guard de tokens (o protocolo da
// Conciliação: o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido)."*
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL: sem jsdom não dá pra medir pixel. O que morde é provar
// que **os valores que a tela usa são os que o arquivo manda** — e, depois da lição de hoje
// (o guard que passava porque a cor estava no degradê da barra), a conferência é sobre a
// **DECLARAÇÃO do token**, não sobre a cor aparecer em algum lugar.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const MOCK = 'docs/mocks/pf-dashboard-mock.html'
const TELA = 'components/perfis/dashboard-pf.tsx'
const FAB = 'components/perfis/lancamento-rapido.tsx'
const HOME = 'app/(dashboard)/perfis/[id]/page.tsx'
const MES = 'app/(dashboard)/perfis/[id]/mes/page.tsx'

const mock = ler(MOCK)
/**
 * ⚠️ **A TELA SÃO DOIS ARQUIVOS desde 13/09**: `dashboard-pf.tsx` tem as duas COMPOSIÇÕES
 * (celular e cockpit) e `widgets-pf.tsx` tem os WIDGETS — que são os mesmos objetos nas
 * duas. Os tokens do mock moram nos widgets, que é de onde a tela inteira lê. Apontar o
 * guard só pra composição o faria acusar um token que está no lugar certo.
 */
const WIDGETS = 'components/perfis/widgets-pf.tsx'
// ⚠️ e o BOTTOM-NAV (13/09): o FAB mudou de casa — de botão solto pro ＋ central da barra
// de polegar. O caminho de render são os três arquivos.
const NAV = 'components/perfis/bottom-nav-pf.tsx'
const tela = semComentarios(ler(TELA)) + semComentarios(ler(WIDGETS)) + semComentarios(ler(NAV))
const fab = semComentarios(ler(FAB))

function tokensDo(html: string): string[] {
  const root = html.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  return [...root.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0].toLowerCase())
}
const declarado = (src: string, nome: string): string | null =>
  src.match(new RegExp(`${nome}:\\s*'(#[0-9a-fA-F]{3,8})'`))?.[1]?.toLowerCase() ?? null

describe('⭐⭐ o mock está versionado', () => {
  it('o arquivo existe no repo — é o que transforma "igual ao mock" em dado', () => {
    expect(existsSync(join(raiz, MOCK))).toBe(true)
    expect(mock.length).toBeGreaterThan(2000)
  })
})

describe('⭐ os TOKENS da tela são os do arquivo', () => {
  const tk = tokensDo(mock)
  it('o :root do mock tem os tokens que a tela precisa', () => expect(tk.length).toBeGreaterThanOrEqual(14))

  it.each([
    ['bg', '#f4f4f8'], ['card', '#fff'], ['ink', '#1c2030'], ['sub', '#7a8095'], ['line', '#ebebf2'],
    ['roxo', '#534ab7'], ['roxo2', '#6f63d8'], ['roxoFraco', '#eeecfa'],
    ['verde', '#16a34a'], ['verdeFraco', '#e8f7ee'], ['coral', '#e5484d'], ['coralFraco', '#fdecec'],
    ['ambar', '#d97706'], ['ambarFraco', '#fdf3e3'],
  ])('o token %s vale %s — o valor que o ARQUIVO manda', (nome, cor) => {
    expect(tk, `${cor} sumiu do MOCK`).toContain(cor)
    expect(declarado(tela, nome), `o token ${nome} da tela não é o do mock`).toBe(cor)
  })

  it('⭐ o gradiente do hero é o do arquivo, literal', () => {
    const g = 'linear-gradient(150deg,#4c42b3 0%,#6f63d8 60%,#8b7ee6 100%)'
    expect(mock).toContain(g)
    expect(tela).toContain(g)
  })

  it('⭐ a sombra dos cards é a do arquivo', () => {
    const s = '0 1px 3px rgba(28,32,48,.06), 0 6px 20px rgba(28,32,48,.05)'
    expect(mock).toContain(s)
    expect(tela).toContain(s)
  })
})

describe('⭐ as MEDIDAS e os TEXTOS do mock', () => {
  it.each([
    ['largura mobile 480px', 'max-w-[480px]'],
    ['raio do card 18px', 'rounded-[18px]'],
    ['raio do hero 28px', 'rounded-b-[28px]'],
    ['saldo em 34px', 'text-[34px]'],
    ['FAB de 56px', 'h-14 w-14'],
    ['espaço do FAB embaixo', 'pb-[90px]'],
  ])('%s', (_r, medida) => expect(tela).toContain(medida))

  /**
   * ⚠️ O CAMINHO DE RENDER É TELA **+ MOTOR**: rótulo que vem do dado (como
   * *"sem categoria"*) mora no dono único (`dashboard.ts`) de propósito — é ele que decide
   * que aquela fatia existe. Exigir a string na VIEW empurraria o texto pra dentro do
   * componente e criaria a segunda fonte do mesmo rótulo.
   */
  const caminhoDeRender = tela + semComentarios(ler('lib/pf-dashboard/dashboard.ts'))

  it.each([
    'SALDO NAS CONTAS', 'previsto pro fim do mês', 'RECEITAS', 'DESPESAS',
    'Recebido da', 'Despesas por categoria', 'Meus cartões', 'Balanço mensal',
    'Contas a vencer', 'Últimos lançamentos', 'do limite usado', 'disponível',
    'espelhadas na empresa', 'sem categoria',
  ])('o texto do mock chega na tela: "%s"', (t) => {
    expect(mock, `"${t}" sumiu do MOCK`).toContain(t)
    expect(caminhoDeRender, `"${t}" está no mock e não chega na tela`).toContain(t)
  })
})

describe('⛔⛔ as RÉGUAS de honestidade da tela', () => {
  it('⭐ o olhinho esconde TODOS os números, não só o hero', () => {
    // a régua do dono. Se `oculto` só governasse o hero, o dono abriria a tela no ônibus
    // achando que escondeu e o cartão estaria lá.
    //
    // ⚠️ os formatadores viraram UM objeto `Fmt` passado a todo widget (13/09) — e isso é
    // MAIS forte que o `useCallback` que o guard olhava antes: agora não existe widget que
    // formate número por fora, porque nenhum recebe outra função.
    expect(tela).toMatch(/oculto \? '••••'/)
    expect(tela).toMatch(/oculto \? '••'/)
    expect(tela, 'o formatador não é único').toContain('const f: Fmt =')
    // e todo widget que mostra número recebe o MESMO `f`
    for (const w of ['WSaldo', 'WFluxo', 'WDonut', 'WCartoes', 'WBalanco', 'WAVencer', 'WUltimos']) {
      expect(tela, `${w} não recebe o formatador único`).toMatch(new RegExp(`<${w}[^>]*f=\\{f\\}`))
    }
  })

  it('⛔ cartão SEM LIMITE não desenha barra', () => {
    expect(tela).toContain('c.usoPct != null')
    expect(tela).toContain('sem limite cadastrado')
  })

  it('⛔⛔ ZERO WIDGET SEM DADO — e agora a trava é DO WIDGET, não da composição', () => {
    /**
     * ⭐ A REGRA MUDOU DE LUGAR E FICOU MAIS FORTE (13/09): antes cada composição decidia
     * se renderizava; agora **o próprio widget se recusa** (`if (…length === 0) return
     * null`). Com duas composições, a trava na composição teria que ser lembrada DUAS
     * vezes — e a segunda é a que alguém esquece.
     */
    for (const gate of [
      'd.donut.length === 0', 'd.cartoes.length === 0', 'd.aVencer.length === 0',
      'd.ultimos.length === 0', 'd.recebidoDaEmpresa.transferencias === 0',
    ]) {
      expect(tela, `widget sem trava própria: ${gate}`).toContain(gate)
    }
  })

  it('⛔ e NÃO existe widget de investimento/metas/recorrente — nem cinza', () => {
    expect(tela).not.toMatch(/investiment|metas|recorrent/i)
  })

  it('⭐ os selos de vínculo só aparecem quando o vínculo EXISTE', () => {
    expect(tela).toContain('t.casou &&')
    expect(tela).toContain('t.temPonte && !t.casou')
  })
})

describe('⛔ NUNCA DOIS PAINÉIS', () => {
  it('⭐ a home do perfil É o dashboard', () => {
    expect(semComentarios(ler(HOME))).toContain('DashboardPFView')
  })

  it('⛔⛔ e o /mes MORREU — virou redirect, não uma segunda tela', () => {
    const m = semComentarios(ler(MES))
    expect(m).toContain('redirect')
    // a tela antiga não pode voltar junto com o redirect
    expect(m).not.toContain('ENTROU')
    expect(m).not.toContain('painelDoMes')
  })
})

describe('⭐⭐ o FAB entende frase', () => {
  it('o campo de texto livre está EM CIMA das opções', () => {
    const iFrase = fab.indexOf('setFrase')
    const iValor = fab.indexOf('setValor')
    expect(iFrase).toBeGreaterThan(0)
    expect(iFrase, 'o campo de frase ficou depois do formulário').toBeLessThan(iValor)
  })

  it('⛔ SEM VALOR não salva — a régua do parser vale na tela também', () => {
    expect(fab).toContain('Falta o valor')
  })

  it('⭐ e a regra APRENDE quando o dono troca a categoria', () => {
    expect(fab).toContain('aprender:')
    expect(fab).toContain('vou aprender')
  })

  it('⭐ a sugestão DIZ por quê — nunca um palpite mudo', () => {
    expect(fab).toContain('l.sugestao.porQue')
  })
})

describe('⛔ nenhum bloco nasce escondido atrás de um booleano falso', () => {
  it.each([[TELA], [FAB]])('%s', (arq) => {
    const src = semComentarios(ler(arq))
    // o guard irmão de 10/09 — `fab`/`oculto` são gestos do dono, não conteúdo escondido
    const suspeitos = [...src.matchAll(/const \[(mostrar|ver|expandido|visivel|colapsad)\w*, set\w+\] = useState\(false\)/gi)]
    expect(suspeitos.map((m) => m[0])).toEqual([])
  })
})
