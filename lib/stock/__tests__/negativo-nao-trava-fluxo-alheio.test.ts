/**
 * ⭐⭐⭐ A VARREDURA — ONDE O SALDO NEGATIVO TRAVA EM VEZ DE AVISAR (23/09/2026).
 *
 * **Régua do dono:** *"negativo ACONTECE na vida real; o sistema AVISA e oferece a porta
 * (a compra/produção que falta), mas NUNCA bloqueia fluxo alheio."*
 *
 * ⚠️ Este arquivo é o MAPA executável dos fluxos. Fluxo novo que passe a travar por causa
 * de um item negativo fica vermelho aqui — e é justamente essa a classe que já mordeu três
 * vezes: a nota do ALAN parada, a ficha do XIS com custo "a definir" e o "dá pra fazer −4548".
 */
import { describe, it, expect } from 'vitest'
import { avaliarEntrada, ehEntradaQueConserta } from '../entrada-cruza-o-zero'
import { custoDeUmaUnidade } from '../cardapio/hub'
import { categoriasDoUniverso } from '../universo-do-seletor'
import { porQueEstaNegativo, portaDoNegativo } from '../porta-do-negativo'

describe('⛔⛔ 1. RECEBIMENTO — o universo COMPRAVEL nunca esconde por saldo', () => {
  it('⭐⭐ o recorte é por CATEGORIA, e saldo não é categoria', () => {
    const cats = categoriasDoUniverso('COMPRAVEL')
    expect(cats).toBeTruthy()
    // ⭐ o que decide quem entra é o que se COMPRA — nunca quanto tem na prateleira
    expect([...cats!]).toContain('MATERIA_PRIMA')
    expect([...cats!]).not.toContain('PRODUTO_FINAL')
    expect([...cats!]).not.toContain('SABOR')
  })
})

describe('⛔⛔ 2. ENTRADA — a compra que falta é a CURA, não pode ser barrada', () => {
  it('⭐ a nota entra e limpa (o caso do SAL, medido em prod)', () => {
    const v = avaliarEntrada({ saldoAntes: -0.9, valorAntes: -0.22, qtdDaEntrada: 2.9, valorDaEntrada: 0 })
    expect(v.decisao, 'a entrada voltou a ser RECUSA — a nota fica parada de novo').not.toBe('RECUSA')
    expect(['AJUSTA_RESIDUO', 'PERGUNTA']).toContain(v.decisao)
  })

  it('⭐ e a PRODUÇÃO lançada também conserta — é a porta que a recusa oferece', () => {
    expect(ehEntradaQueConserta('PRODUCAO_GERACAO')).toBe(true)
  })
})

describe('⛔⛔ 3. FICHA — componente negativo é aviso na LINHA DELE, não veneno na ficha', () => {
  /** ⚠️ ctx mínimo: a ficha do XIS com um componente COM custo e outro SEM (o negativo) */
  const ctx = {
    componentesByFicha: new Map([['f-xis', [
      { itemId: 'i-pao', qtdPlanejada: 1 },
      { itemId: 'i-ervilha', qtdPlanejada: 0.01 },
    ]]]),
    fichaByItemProduzido: new Map(),
    fichaById: new Map([['f-xis', { id: 'f-xis', tipoProduto: 'PRODUTO_FINAL', itemProduzidoId: 'i-xis' }]]),
    nomeItem: new Map([['i-pao', 'PAO DE XIS'], ['i-ervilha', 'ERVILHA']]),
  } as Parameters<typeof custoDeUmaUnidade>[1]

  const custoDe = new Map<string, number | null>([
    ['i-pao', 8.58],
    ['i-ervilha', null], // ⛔ negativo ⇒ sem custo médio (valor/saldo não existe com saldo ≤ 0)
  ])

  it('⭐⭐ o custo PARCIAL sobrevive — R$ 8,58 não somem da tela', () => {
    const r = custoDeUmaUnidade({ tipo: 'FICHA', fichaId: 'f-xis' }, ctx, custoDe)
    expect(r.parcial, 'o custo conhecido sumiu junto com o que falta').toBe(8.58)
    expect(r.semCusto).toBe(1)
    // ⭐⭐ E3 (12/11, ordem do dono): o custo é o PARCIAL, com a marca explícita — nunca se
    // veste de completo (`completo: false` + quem falta). Era `null` e estragava o total.
    expect(r.custo).toBe(8.58)
    expect(r.completo).toBe(false)
    expect(r.faltantes).toEqual(['ERVILHA'])
  })

  it('⭐ com todos os custos, parcial == custo fechado', () => {
    const cheio = new Map<string, number | null>([['i-pao', 8.58], ['i-ervilha', 0.42]])
    const r = custoDeUmaUnidade({ tipo: 'FICHA', fichaId: 'f-xis' }, ctx, cheio)
    expect(r.custo).toBe(r.parcial)
    expect(r.semCusto).toBe(0)
    expect([r.completo, r.faltantes]).toEqual([true, []])
  })
})

describe('⭐⭐ E3 (12/11) · a PORTA soma o que tem preço e marca o que falta — nunca zera a ficha', () => {
  const comps: [string, string, number, number | null][] = [
    ['beef', 'beef de xis', 1, 3.7], ['pao', 'PAO DE XIS', 1, 1.75], ['papel', 'PAPEL ACOPLADO', 1, 0.86], ['milho', 'MILHO VERDE', 0.04, null],
    ['ervilha', 'ERVILHA', 0.03, 11.57], ['ovo', 'OVO', 1, 0.53], ['catchup', 'CATCHUP', 0.002, 8.98],
    ['queijo', 'QUEIJO', 0.02, 30.06], ['maionese', 'MAIONESE', 1, 0.32], ['tomate', 'TOMATE', 0.001, 13.39],
  ]
  const ctx = {
    componentesByFicha: new Map([['f-xis', comps.map(([id, , q]) => ({ itemId: id, qtdPlanejada: q }))], ['f-vazia', []], ['f-nada', [{ itemId: 'milho', qtdPlanejada: 1 }]]]),
    fichaByItemProduzido: new Map(),
    fichaById: new Map([['f-xis', { id: 'f-xis', tipoProduto: 'PRODUTO_FINAL', itemProduzidoId: 'i-xis' }], ['f-vazia', { id: 'f-vazia', tipoProduto: 'PRODUTO_FINAL', itemProduzidoId: 'i-v' }], ['f-nada', { id: 'f-nada', tipoProduto: 'PRODUTO_FINAL', itemProduzidoId: 'i-n' }]]),
    nomeItem: new Map(comps.map(([id, nome]) => [id, nome])),
  } as Parameters<typeof custoDeUmaUnidade>[1]
  const custoDe = new Map<string, number | null>(comps.map(([id, , , c]) => [id, c]))

  it('o caso REAL do XIS COMPLETO: 9 com preço + MILHO VERDE sem → custo 8,14, completo:false, faltantes:[MILHO VERDE]', () => {
    expect(custoDeUmaUnidade({ tipo: 'FICHA', fichaId: 'f-xis' }, ctx, custoDe)).toMatchObject({ custo: 8.14, completo: false, faltantes: ['MILHO VERDE'] })
  })
  it('ficha VAZIA continua sem custo (sem ficha) · ficha só de insumo sem preço: nada a somar, sem custo', () => {
    expect(custoDeUmaUnidade({ tipo: 'FICHA', fichaId: 'f-vazia' }, ctx, custoDe)).toMatchObject({ custo: null, completo: false, faltantes: [] })
    expect(custoDeUmaUnidade({ tipo: 'FICHA', fichaId: 'f-nada' }, ctx, custoDe)).toMatchObject({ custo: null, completo: false, faltantes: ['MILHO VERDE'] })
  })
})

describe('⭐ 4. AS PORTAS — o negativo sempre oferece a saída (a régua de 22/09, intacta)', () => {
  const base = { empresaId: 'e1', itemId: 'i1', nome: 'sal', unidade: 'KG', saldoAntes: -0.9 }

  it('⭐ COMPRADO → a frase pede a NOTA e a porta leva ao histórico', () => {
    const fatos = { ...base, familia: 'COMPRADO' as const, ordemAberta: null, fichaAtivaId: null }
    expect(porQueEstaNegativo(fatos)).toContain('COMPRA')
    expect(portaDoNegativo(fatos).href).toContain('/estoque/itens/i1')
  })

  it('⭐ PRODUZIDO → a frase pede a PRODUÇÃO, nunca uma nota que não existe', () => {
    const fatos = { ...base, nome: 'porção', familia: 'PRODUZIDO' as const, ordemAberta: null, fichaAtivaId: 'f1' }
    expect(porQueEstaNegativo(fatos)).toContain('produção')
    expect(portaDoNegativo(fatos).href).toContain('ficha=f1')
  })

  it('⛔ e NUNCA existe porta vazia — beco é o que estas réguas existem pra matar', () => {
    for (const familia of ['COMPRADO', 'PRODUZIDO'] as const) {
      for (const ficha of [null, 'f1']) {
        const p = portaDoNegativo({ ...base, familia, ordemAberta: null, fichaAtivaId: ficha })
        expect(p.rotulo.length, `porta muda em ${familia}/${ficha}`).toBeGreaterThan(0)
        expect(p.href.length).toBeGreaterThan(0)
      }
    }
  })
})
