/**
 * ⭐⭐ O CARD LISTA E LEVA — EXECUTADO, não grepado (04/11/2026)
 *
 * ⚠️ O projeto roda em `environment: node`, sem jsdom — não há clique. Mas `AlarmeDeContas`
 * é uma **função**: chamá-la É executar o comportamento (REGRA 3), e a árvore que ela
 * devolve carrega os `href` de verdade. *Grep de string não distingue "refatorei" de
 * "quebrei"*; isto aqui lê o link que o componente realmente montou.
 */
import { describe, it, expect } from 'vitest'
import { AlarmeDeContas, linkDaConta } from '../alarme-de-contas'
import type { ContaDaFilaDTO } from '../par-sugerido'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, chamadasDe, elementosJsx } from '../../../__tests__/regras-ui/_leitura-de-fonte'

const PAGE = 'app/(dashboard)/conciliacao/page.tsx'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo'

/** o caso real dos R$ 408,65, com os campos preenchidos */
const conta = (over: Partial<ContaDaFilaDTO> = {}): ContaDaFilaDTO => ({
  conta: {
    id: 'cmw107zq21v6oljf8u71otgyc',
    descricao: 'E.M.S. COMERCIO DE ALIMENTOS LTDA — compra sem nota',
    valor: 408.65,
    data: '2026-11-03T00:00:00.000Z',
    tipo: 'DEBIT',
  },
  situacao: 'PAGA_POR_FORA',
  fornecedor: 'E.M.S. COMERCIO DE ALIMENTOS LTDA',
  sugestoes: [],
  ...over,
})

/** ⭐ anda a árvore React devolvida e junta todo `href` que existir nela */
function hrefsDe(no: unknown, out: string[] = []): string[] {
  if (no == null || typeof no !== 'object') return out
  if (Array.isArray(no)) {
    for (const f of no) hrefsDe(f, out)
    return out
  }
  const props = (no as { props?: Record<string, unknown> }).props
  if (props) {
    if (typeof props.href === 'string') out.push(props.href)
    hrefsDe(props.children, out)
  }
  return out
}

/** ⭐ junta o texto corrido da árvore, pra provar o que o card AFIRMA */
function textoDe(no: unknown, out: string[] = []): string[] {
  if (no == null) return out
  if (typeof no === 'string' || typeof no === 'number') { out.push(String(no)); return out }
  if (Array.isArray(no)) { for (const f of no) textoDe(f, out); return out }
  const props = (no as { props?: Record<string, unknown> }).props
  if (props) textoDe(props.children, out)
  return out
}

const props = (over: Partial<Parameters<typeof AlarmeDeContas>[0]> = {}) => ({
  tom: 'amber' as const,
  contas: [conta()],
  ocultas: 0,
  empresaId: EMPRESA,
  titulo: (n: number) => `${n} conta paga por fora.`,
  explicacao: () => 'Só confirme a categoria.',
  ...over,
})

describe('AlarmeDeContas', () => {
  /** ⛔⛔ ERA ESTE O DEFEITO: o alarme ficava aceso sobre nada a fazer */
  it('⛔ ZERO conta não desenha card nenhum (nem a caixa vazia)', () => {
    expect(AlarmeDeContas(props({ contas: [], ocultas: 0 }))).toBeNull()
  })

  it('⭐ LISTA a conta e LEVA até ela — href com empresa, escopo PAGA e a busca', () => {
    const hrefs = hrefsDe(AlarmeDeContas(props()))
    expect(hrefs).toHaveLength(1)
    const url = new URL(hrefs[0]!, 'https://x.test')
    expect(url.pathname).toBe('/contas-a-pagar')
    expect(url.searchParams.get('empresaId')).toBe(EMPRESA)
    expect(url.searchParams.get('escopo')).toBe('PAGA')
    expect(url.searchParams.get('q')).toBe('E.M.S. COMERCIO DE ALIMENTOS LTDA')
  })

  it('⭐ mostra o VALOR e o DIA de cada linha — número sem régua é pior que ausência', () => {
    const txt = textoDe(AlarmeDeContas(props())).join(' ')
    expect(txt).toContain('408,65')
    expect(txt).toContain('03/11')
    expect(txt).toContain('E.M.S. COMERCIO DE ALIMENTOS LTDA')
  })

  it('uma conta só NÃO ganha rodapé de soma (rótulo não promete o que não entrega)', () => {
    expect(textoDe(AlarmeDeContas(props())).join(' ')).not.toContain('soma desta lista')
  })

  it('duas contas ganham a soma das duas', () => {
    const duas = [conta(), conta({ conta: { ...conta().conta, id: 'outra', valor: 91.35 } })]
    const txt = textoDe(AlarmeDeContas(props({ contas: duas }))).join(' ')
    expect(txt).toContain('soma desta lista')
    expect(txt).toContain('500,00') // 408,65 + 91,35
  })

  /** ⛔ *remoção sem realocação é perda*: a que foi pro lote é DITA, não encolhida em silêncio */
  it('⛔ conta que saiu pro lote é contada no título e anunciada no rodapé', () => {
    const txt = textoDe(AlarmeDeContas(props({ ocultas: 2 }))).join(' ')
    expect(txt).toContain('3 conta') // 1 na lista + 2 no lote
    expect(txt).toContain('num pagamento em lote')
  })

  it('sem fornecedor, a busca cai na descrição — nunca num link sem q', () => {
    const semForn = conta({ fornecedor: null })
    const url = new URL(linkDaConta(EMPRESA, semForn), 'https://x.test')
    expect(url.searchParams.get('q')).toBe(semForn.conta.descricao)
  })
})

/**
 * ⭐⭐ A FIAÇÃO — o componente certo sem uso na tela é a porta sem maçaneta (de novo).
 *
 * ⚠️ Lê o fonte pelo detector ÚNICO da casa (`_leitura-de-fonte`), sem comentário: *o
 * arquivo que documenta o defeito não pode ser o que o absolve* — e este arquivo cita por
 * escrito as duas situações que ele cobra.
 */
describe('a Conciliação REALMENTE usa o alarme', () => {
  const src = semComentarios(readFileSync(join(process.cwd(), PAGE), 'utf8'))

  it('a page monta o AlarmeDeContas (uso, não import)', () => {
    expect(usosDe(src, 'AlarmeDeContas'), 'importado e nunca montado é o defeito').toBeGreaterThanOrEqual(2)
  })

  it('⛔ e passa as DUAS listas — uma só deixaria metade da tela mentindo', () => {
    for (const lista of ['emDuplaContagem', 'pagasPorFora']) {
      // ⛔ `elementosJsx`, não `chamadasDe`: JSX não tem `(` e a outra casaria o bloco errado
      const blocos = elementosJsx(src, 'AlarmeDeContas')
      expect(blocos.some((b) => b.includes(`contas={${lista}}`)), `nenhum alarme recebe ${lista}`).toBe(true)
    }
  })

  /**
   * ⛔⛔ ESTRUTURAL, e a 1ª versão deste guard NÃO era: eu escrevi
   * `/emDuplaContagem[\s\S]{0,160}situacao === 'DUPLA_CONTAGEM'/` — **janela de distância**,
   * o anti-padrão que esta casa proíbe e que já deu falso verde E falso vermelho aqui. O que
   * importa é a comparação estar DENTRO do `useMemo` daquela lista, não a 160 chars dela.
   */
  it('⛔ as listas saem de fila.contas pela SITUAÇÃO — não de um contador paralelo', () => {
    for (const [lista, estado] of [
      ['emDuplaContagem', 'DUPLA_CONTAGEM'], ['pagasPorFora', 'PAGA_POR_FORA'],
    ] as const) {
      const [bloco] = chamadasDe(src, new RegExp(`const ${lista} = useMemo\\s*\\(`, 'g'))
      expect(bloco, `${lista} não é derivada por useMemo de fila.contas`).toBeTruthy()
      expect(bloco!, `${lista} tem que filtrar por situacao === '${estado}'`)
        .toContain(`situacao === '${estado}'`)
      expect(bloco!).toContain('fila?.contas')
    }
  })
})
