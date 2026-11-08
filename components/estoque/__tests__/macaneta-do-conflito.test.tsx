/**
 * ⭐⭐ A MAÇANETA DO CONFLITO — a FIAÇÃO da tela, EXECUTADA (08/11/2026).
 *
 * O defeito real: na linha CONFLITO o "escolher →" chamava `onMapearProduto`, que troca de aba
 * e abre a central geral — porta oferecida sem nada atrás. ⛔ Testar só a função da lib
 * passaria verde com esse defeito vivo; aqui roda o CAMINHO: a peça da linha dispara o
 * comparador, e o comparador desenha as 2 fichas e devolve o id certo no "ficar com esta".
 * (Projeto em `environment: node`: chamar o componente É executá-lo — REGRA 3. A rota que a
 * URL alcança é executada em `lib/stock/vendas/__tests__/macaneta-do-conflito.integration`.)
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { AcaoDoConflito, ComparadorView, urlDoConflito } from '../comparador-de-conflito'
import type { ComparadorDoConflito } from '@/lib/stock/vendas/conflito-de-grafia'
import { semComentarios, elementosJsx } from '../../../__tests__/regras-ui/_leitura-de-fonte'

type No = { type?: unknown; props?: Record<string, unknown> } | null | undefined

/** anda a árvore devolvida, expandindo componentes-função (os puros desta casa) */
function nos(n: unknown, out: { type: unknown; props: Record<string, unknown> }[] = []): typeof out {
  if (n == null || typeof n !== 'object') return out
  if (Array.isArray(n)) { for (const x of n) nos(x, out); return out }
  const el = n as No
  if (!el?.props) return out
  if (typeof el.type === 'function') return nos((el.type as (p: unknown) => unknown)(el.props), out)
  out.push({ type: el.type, props: el.props })
  nos(el.props.children, out)
  return out
}
const porTestId = (arvore: unknown, id: string) => nos(arvore).filter((x) => x.props['data-testid'] === id)
const texto = (n: unknown): string => {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(texto).join('')
  const el = n as No
  if (typeof el?.type === 'function') return texto((el.type as (p: unknown) => unknown)(el.props))
  return texto(el?.props?.children)
}

/** o caso real do Xis, campos preenchidos */
const DADOS: ComparadorDoConflito = {
  nome: 'Xis Completo',
  canonico: 'XIS COMPLETO',
  fichas: [
    {
      fichaId: 'cmq_xis_710m2', nome: 'XIS COMPLETO', ativo: true, ingredientes: 9, custoLote: 14.37,
      ultimaEdicao: '2026-10-02T13:00:00.000Z', grafias: ['XIS COMPLETO'], vendasRecentes: { unidades: 41, ultimoDia: '2026-11-06' },
      consumidores: { outrasGrafias: [], complementos: [], basesDeTamanho: [], emOutrasFichas: [], ordensAbertas: 0 }, inativarSemAviso: true,
    },
    {
      fichaId: 'cmq_xis_7kjsx', nome: 'XIS - COMPLETO', ativo: true, ingredientes: 7, custoLote: 12.1,
      ultimaEdicao: '2026-09-20T10:00:00.000Z', grafias: ['XIS - COMPLETO'], vendasRecentes: { unidades: 3, ultimoDia: '2026-11-03' },
      consumidores: { outrasGrafias: ['XIS COMPLETO PROMO'], complementos: [], basesDeTamanho: [], emOutrasFichas: [], ordensAbertas: 0 }, inativarSemAviso: false,
    },
  ],
}
const view = (over: Partial<Parameters<typeof ComparadorView>[0]> = {}) =>
  ComparadorView({ dados: DADOS, escolhida: null, inativar: new Set(), gravando: false, erro: null, onEscolher: vi.fn(), onAlternarInativar: vi.fn(), onConfirmar: vi.fn(), onVoltar: vi.fn(), ...over })

describe('a peça da linha (central e revisão usam a MESMA)', () => {
  it('⭐ o "escolher →" dispara o comparador — e mostra as candidatas', () => {
    const onEscolher = vi.fn()
    const a = AcaoDoConflito({ candidatas: ['XIS COMPLETO', 'XIS - COMPLETO'], onEscolher })
    const [botao] = porTestId(a, 'escolher-conflito')
    expect(botao, 'a linha de conflito precisa de um botão de escolher').toBeTruthy()
    ;(botao.props.onClick as () => void)()
    expect(onEscolher).toHaveBeenCalledTimes(1)
    expect(texto(a)).toContain('XIS COMPLETO × XIS - COMPLETO')
  })
})

describe('o comparador', () => {
  it('⭐ desenha as 2 fichas LADO A LADO com os números de cada uma', () => {
    const v = view()
    const cards = porTestId(v, 'ficha-do-conflito')
    expect(cards).toHaveLength(2)
    const t = texto(v)
    for (const s of ['XIS COMPLETO', 'XIS - COMPLETO', '9', '7', '02/10/2026', '41 un', 'grafias de outro produto: XIS COMPLETO PROMO']) expect(t).toContain(s)
  })

  it('⭐ "ficar com esta" devolve o id da ficha DAQUELE card', () => {
    const onEscolher = vi.fn()
    const botoes = porTestId(view({ onEscolher }), 'ficar-com-esta')
    ;(botoes[1].props.onClick as () => void)()
    expect(onEscolher).toHaveBeenCalledWith('cmq_xis_7kjsx')
  })

  it('⭐ escolhida → aparece a confirmação, com o inativar da perdedora e o aviso do que a usa', () => {
    const v = view({ escolhida: 'cmq_xis_710m2', inativar: new Set() })
    const [check] = porTestId(v, 'inativar-perdedora')
    expect(check.props.checked).toBe(false)
    expect(texto(v)).toContain('ainda usada: grafias de outro produto: XIS COMPLETO PROMO')
    expect(porTestId(v, 'confirmar-escolha')).toHaveLength(1)
    expect(porTestId(view(), 'confirmar-escolha'), 'sem escolha não há confirmar').toHaveLength(0)
  })
})

describe('⛔ a fiação nas DUAS telas (estrutural, sem comentário)', () => {
  const ler = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), 'utf8'), p)
  for (const [arquivo, setter, estado] of [
    ['components/estoque/central-de-import.tsx', 'setConflito', 'conflito'],
    ['components/estoque/revisao-do-import.tsx', 'setConflitoAberto', 'conflitoAberto'],
  ] as const) {
    it(`${arquivo}: a linha abre o comparador, nunca o mapear geral`, () => {
      const src = ler(arquivo)
      const acoes = elementosJsx(src, 'AcaoDoConflito')
      expect(acoes).toHaveLength(1)
      expect(acoes[0]).toContain(`${setter}(`)
      expect(acoes[0]).not.toContain('onMapearProduto')
      const modal = elementosJsx(src, 'ComparadorDeConflito')
      expect(modal).toHaveLength(1)
      expect(modal[0]).toContain(`nome={${estado}}`)
    })
  }

  it('a URL do componente existe como rota com GET e POST', () => {
    const rota = urlDoConflito('EMPRESA').replace('/api/empresas/EMPRESA/', 'app/api/empresas/[id]/') + '/route.ts'
    expect(existsSync(join(process.cwd(), rota)), rota).toBe(true)
    const src = readFileSync(join(process.cwd(), rota), 'utf8')
    expect(src).toMatch(/export async function GET/)
    expect(src).toMatch(/export async function POST/)
  })
})
